/**
 * Alerts and SOS.
 *
 * A patient sees alerts raised about them. A caregiver sees alerts for patients
 * they are linked to, and needs `manageAlerts` to acknowledge one.
 */

import { Router } from 'express';
import { listAlertsSchema, sosSchema } from '@medtrack/shared';
import { childLogger } from '../config/logger.js';
import { auth, requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { sosLimiter } from '../middleware/rateLimit.js';
import { validate, validated } from '../middleware/validate.js';
import { Alert } from '../models/Alert.js';
import { CareLink } from '../models/CareLink.js';
import { User } from '../models/User.js';
import { acknowledgeAlert, raiseAlert } from '../services/alerts.js';

const log = childLogger('alerts-route');
const router = Router();
router.use(requireAuth);

/**
 * Patient ids the caller may read alerts for: themselves, plus anyone who has
 * granted them an active link.
 */
async function visiblePatientIds(userId: string): Promise<string[]> {
  const links = await CareLink.find({ caregiverId: userId, status: 'active' })
    .select({ patientId: 1 })
    .lean();
  return [userId, ...links.map((link) => link.patientId)];
}

router.get('/', validate(listAlertsSchema, 'query'), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const query = validated(res, listAlertsSchema, 'query');

    const allowed = await visiblePatientIds(userId);

    // A requested patient is honoured only if it is already in the allowed set.
    const patientFilter = query.patientId
      ? allowed.includes(query.patientId) ? [query.patientId] : []
      : allowed;

    const alerts = await Alert.find({
      patientId: { $in: patientFilter },
      ...(query.acknowledged === undefined
        ? {}
        : query.acknowledged
          ? { acknowledgedAt: { $ne: null } }
          : { acknowledgedAt: null }),
    })
      .sort({ createdAt: -1 })
      .limit(query.limit)
      .lean();

    const unacknowledged = await Alert.countDocuments({
      patientId: { $in: allowed },
      acknowledgedAt: null,
    });

    res.json({
      alerts: alerts.map((a) => ({ ...a, id: String(a._id), _id: undefined })),
      unacknowledged,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/acknowledge', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const alertId = String(req.params['id']);

    const alert = await Alert.findById(alertId).lean();
    if (!alert) throw AppError.notFound('That alert could not be found.');

    if (alert.patientId !== userId) {
      const link = await CareLink.findOne({
        patientId: alert.patientId,
        caregiverId: userId,
        status: 'active',
      }).lean();

      if (!link) throw AppError.notFound('That alert could not be found.');
      if (!link.permissions.manageAlerts) {
        throw AppError.forbidden('You can see this alert but not resolve it.');
      }
    }

    const updated = await acknowledgeAlert(alertId, alert.patientId, userId);
    res.json({ alert: updated ? { ...updated.toJSON() } : null });
  } catch (error) {
    next(error);
  }
});

/**
 * Emergency SOS.
 *
 * Never deduplicated — every press reaches every caregiver. Rate limited only
 * enough to bound a runaway client, deliberately generously.
 */
router.post('/sos', sosLimiter, validate(sosSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const input = sosSchema.parse(req.body);

    const patient = await User.findById(userId).select({ name: 1, timezone: 1 }).lean();
    if (!patient) throw AppError.unauthenticated('Please sign in again.');

    const activeLinks = await CareLink.countDocuments({
      patientId: userId,
      status: 'active',
      'permissions.receiveAlerts': true,
    });

    const timestamp = new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: patient.timezone,
    }).format(new Date());

    const alert = await raiseAlert({
      patientId: userId,
      kind: 'sos',
      severity: 'critical',
      title: 'Emergency SOS',
      body: `${patient.name} triggered an emergency SOS at ${timestamp}.`,
      emailContext: { message: input.message ?? null },
    });

    log.warn({ userId, caregivers: activeLinks }, 'SOS triggered');

    // Tell the patient plainly whether anyone was actually reachable — an SOS
    // that silently went nowhere is worse than one that reports the truth.
    res.json({
      alert: alert ? alert.toJSON() : null,
      caregiversNotified: activeLinks,
      message:
        activeLinks > 0
          ? `Your caregivers have been alerted.`
          : 'You have no caregivers set up to receive alerts. Please contact someone directly.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
