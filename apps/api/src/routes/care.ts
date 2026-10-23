/**
 * Care links: invitations, permissions, and the caregiver's view of a patient.
 *
 * This is the only place one account reads another's health data, so the rules
 * are concentrated here and enforced by `requireCareAccess`:
 *
 *  - Sharing requires an **active** link the patient created and can revoke.
 *  - Each read checks the specific permission it needs, not just "is linked".
 *  - Unauthorised access returns 404, never 403, so the endpoints cannot be
 *    used to discover which patient ids exist.
 */

import { Router } from 'express';
import {
  byMedicine,
  dailySeries,
  inviteCaregiverSchema,
  respondToInviteSchema,
  splitToday,
  summarise,
  todayIn,
  addDays,
  updateCareLinkSchema,
} from '@medtrack/shared';
import { env } from '../config/env.js';
import { childLogger } from '../config/logger.js';
import { auth, careContext, requireAuth, requireCareAccess } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { emailLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  CareLink,
  createInviteToken,
  hashInviteToken,
  inviteExpiryDate,
} from '../models/CareLink.js';
import { DoseEvent } from '../models/DoseEvent.js';
import { Medicine } from '../models/Medicine.js';
import { User } from '../models/User.js';
import { Appointment } from '../models/Appointment.js';
import { sendCaregiverInviteEmail } from '../services/email.js';
import { toDomainDose } from '../services/doses.js';
import { audit } from '../services/privacy.js';

const log = childLogger('care');
const router = Router();
router.use(requireAuth);

/* ─────────────────────── Patient side: manage links ─────────────────────── */

/** Caregivers this patient has invited or linked. */
router.get('/caregivers', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const links = await CareLink.find({
      patientId: userId,
      status: { $in: ['pending', 'active'] },
    }).lean();

    res.json({
      caregivers: links.map((link) => ({
        id: String(link._id),
        email: link.invitedEmail,
        relation: link.relation,
        status: link.status,
        permissions: link.permissions,
        invitedAt: link.invitedAt,
        respondedAt: link.respondedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/caregivers', emailLimiter, validate(inviteCaregiverSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const input = inviteCaregiverSchema.parse(req.body);

    const patient = await User.findById(userId).select({ name: 1, email: 1 }).lean();
    if (!patient) throw AppError.unauthenticated('Please sign in again.');

    if (input.email === patient.email) {
      throw AppError.badRequest('You cannot add yourself as your own caregiver.');
    }

    const { token, tokenHash } = createInviteToken();

    let link;
    try {
      link = await CareLink.create({
        patientId: userId,
        invitedEmail: input.email,
        relation: input.relation,
        permissions: input.permissions,
        status: 'pending',
        inviteTokenHash: tokenHash,
        expiresAt: inviteExpiryDate(),
        invitedAt: new Date(),
      });
    } catch (error) {
      // The partial unique index rejects a second live link to the same address.
      if ((error as { code?: number }).code === 11000) {
        throw AppError.conflict('You have already invited that person.');
      }
      throw error;
    }

    await sendCaregiverInviteEmail({
      to: input.email,
      patientName: patient.name,
      relation: input.relation,
      acceptUrl: `${env.WEB_APP_URL}/care/accept?token=${token}`,
    });

    await audit(userId, 'caregiver_invited', { careLinkId: String(link._id) });
    log.info({ patientId: userId, careLinkId: link._id }, 'Caregiver invited');
    res.status(201).json({ caregiver: link.toJSON() });
  } catch (error) {
    next(error);
  }
});

router.patch('/caregivers/:id', validate(updateCareLinkSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const input = updateCareLinkSchema.parse(req.body);

    const link = await CareLink.findOne({ _id: req.params['id'], patientId: userId });
    if (!link) throw AppError.notFound('That caregiver could not be found.');

    if (input.relation !== undefined) link.relation = input.relation;
    if (input.permissions) {
      // Merge rather than replace, so a partial update cannot silently clear
      // permissions the patient did not mention.
      link.permissions = { ...link.permissions, ...input.permissions };
    }
    await link.save();

    res.json({ caregiver: link.toJSON() });
  } catch (error) {
    next(error);
  }
});

/**
 * Withdraw a caregiver's access.
 *
 * Revocation is immediate and unilateral — the patient never needs the
 * caregiver's cooperation to stop sharing. Required by the DPDP Act's
 * right to withdraw consent, and just correct regardless.
 */
router.delete('/caregivers/:id', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const link = await CareLink.findOne({ _id: req.params['id'], patientId: userId });
    if (!link) throw AppError.notFound('That caregiver could not be found.');

    link.status = 'revoked';
    link.revokedAt = new Date();
    link.inviteTokenHash = null;
    await link.save();

    await audit(userId, 'caregiver_revoked', { careLinkId: String(link._id) });
    log.info({ patientId: userId, careLinkId: link._id }, 'Caregiver access revoked');
    res.json({ message: 'Access withdrawn. They can no longer see your information.' });
  } catch (error) {
    next(error);
  }
});

/* ──────────────────── Caregiver side: accept and view ───────────────────── */

/** Inspect an invitation before accepting. Requires the token, not a session. */
router.get('/invitations/:token', async (req, res, next) => {
  try {
    const link = await CareLink.findOne({
      inviteTokenHash: hashInviteToken(String(req.params['token'])),
      status: 'pending',
    })
      .select('+inviteTokenHash')
      .lean();

    if (!link || link.expiresAt.getTime() < Date.now()) {
      throw AppError.notFound('That invitation is invalid or has expired.');
    }

    const patient = await User.findById(link.patientId).select({ name: 1 }).lean();

    res.json({
      invitation: {
        patientName: patient?.name ?? 'A MedTrack user',
        relation: link.relation,
        permissions: link.permissions,
        expiresAt: link.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/invitations/respond', validate(respondToInviteSchema), async (req, res, next) => {
  try {
    const { userId, email } = auth(req);
    const { token, accept } = respondToInviteSchema.parse(req.body);

    const link = await CareLink.findOne({
      inviteTokenHash: hashInviteToken(token),
      status: 'pending',
    }).select('+inviteTokenHash');

    if (!link || link.expiresAt.getTime() < Date.now()) {
      throw AppError.notFound('That invitation is invalid or has expired.');
    }

    // The invitation is addressed to a specific mailbox; only that account may
    // redeem it. Otherwise a leaked link would grant anyone access.
    if (link.invitedEmail !== email) {
      throw AppError.forbidden('This invitation was sent to a different email address.');
    }

    link.status = accept ? 'active' : 'declined';
    link.caregiverId = accept ? userId : null;
    link.respondedAt = new Date();
    // The token is spent either way.
    link.inviteTokenHash = null;
    await link.save();

    if (accept) {
      await User.updateOne({ _id: userId }, { $addToSet: { roles: 'caregiver' } });
      // Logged against the patient: it is their data that someone can now see.
      await audit(link.patientId, 'caregiver_access_granted', {
        careLinkId: String(link._id),
        caregiverId: userId,
      });
    }

    res.json({
      message: accept ? 'You now have access.' : 'Invitation declined.',
      careLink: accept ? link.toJSON() : null,
    });
  } catch (error) {
    next(error);
  }
});

/** Patients this caregiver supports. */
router.get('/patients', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const links = await CareLink.find({ caregiverId: userId, status: 'active' }).lean();

    const patients = await User.find({ _id: { $in: links.map((l) => l.patientId) } })
      .select({ name: 1, timezone: 1 })
      .lean();

    const byId = new Map(patients.map((p) => [String(p._id), p]));

    res.json({
      patients: links.map((link) => ({
        careLinkId: String(link._id),
        patientId: link.patientId,
        name: byId.get(link.patientId)?.name ?? 'Unknown',
        timezone: byId.get(link.patientId)?.timezone ?? 'UTC',
        relation: link.relation,
        permissions: link.permissions,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/* ─────────────────── Caregiver views of a patient's data ────────────────── */

router.get(
  '/patients/:patientId/overview',
  requireCareAccess('viewAdherence'),
  async (req, res, next) => {
    try {
      const { patientId } = careContext(req);

      const patient = await User.findById(patientId).select({ name: 1, timezone: 1 }).lean();
      if (!patient) throw AppError.notFound('Not found.');

      const today = todayIn(patient.timezone);
      const from = addDays(today, -29);

      const doses = await DoseEvent.find({
        userId: patientId,
        localDate: { $gte: from, $lte: today },
      }).lean();

      const domain = doses.map((dose) => toDomainDose(dose as never));
      const context = { timezone: patient.timezone, today };

      res.json({
        patient: { id: patientId, name: patient.name, timezone: patient.timezone },
        today: splitToday(domain, patient.timezone, today),
        summary: summarise(domain, context),
        perMedicine: byMedicine(domain, context),
        daily: dailySeries(domain, from, today),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/patients/:patientId/medicines',
  requireCareAccess('viewMedicines'),
  async (req, res, next) => {
    try {
      const { patientId } = careContext(req);
      const medicines = await Medicine.find({ userId: patientId, archivedAt: null })
        .select({ name: 1, strength: 1, form: 1, schedule: 1, isCritical: 1, instructions: 1 })
        .lean();

      res.json({
        medicines: medicines.map((m) => ({ ...m, id: String(m._id), _id: undefined })),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/patients/:patientId/appointments',
  requireCareAccess('viewAppointments'),
  async (req, res, next) => {
    try {
      const { patientId } = careContext(req);
      const appointments = await Appointment.find({
        userId: patientId,
        scheduledAt: { $gte: new Date() },
      })
        .sort({ scheduledAt: 1 })
        .limit(50)
        .lean();

      res.json({
        appointments: appointments.map((a) => ({ ...a, id: String(a._id), _id: undefined })),
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
