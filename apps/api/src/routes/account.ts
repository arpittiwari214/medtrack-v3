/**
 * Account and data-rights routes.
 *
 * India's Digital Personal Data Protection Act, 2023 gives a Data Principal the
 * right to access their data, to correct it, to withdraw consent, and to have
 * it erased. These endpoints are the machinery behind those promises — the
 * Privacy Policy is only truthful if they work.
 *
 * Deletion is a two-stage process: the request marks the account and revokes
 * every session immediately, and a grace period follows during which the user
 * can cancel. That protects against an angry moment or a hijacked session
 * destroying a medication history irrecoverably, while still honouring erasure.
 */

import { Router } from 'express';
import { LEGAL_DOCUMENT_VERSIONS, deleteAccountSchema, updateConsentSchema } from '@medtrack/shared';
import { childLogger } from '../config/logger.js';
import { auth, requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { Alert } from '../models/Alert.js';
import { Appointment } from '../models/Appointment.js';
import { CareLink } from '../models/CareLink.js';
import { Device } from '../models/Device.js';
import { DoseEvent } from '../models/DoseEvent.js';
import { Medicine } from '../models/Medicine.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { Session } from '../models/Session.js';
import { SyncMutation } from '../models/SyncMutation.js';
import { User, verifyPassword } from '../models/User.js';
import { revokeAllForUser } from '../services/tokens.js';

const log = childLogger('account');
const router = Router();
router.use(requireAuth);

/** Days between requesting deletion and the data actually being purged. */
export const DELETION_GRACE_DAYS = 14;

/* ─────────────────────────── Right of access ────────────────────────────── */

/**
 * Export everything held about the caller, as JSON.
 *
 * Deliberately complete and self-describing: the point of a data export is that
 * the person can read it and understand what was held, not that it round-trips
 * into our own database.
 */
router.get('/export', async (req, res, next) => {
  try {
    const { userId } = auth(req);

    const [user, medicines, doses, appointments, careLinks, alerts, devices] = await Promise.all([
      User.findById(userId).lean(),
      Medicine.find({ userId }).lean(),
      DoseEvent.find({ userId }).sort({ scheduledAt: 1 }).lean(),
      Appointment.find({ userId }).sort({ scheduledAt: 1 }).lean(),
      CareLink.find({ $or: [{ patientId: userId }, { caregiverId: userId }] }).lean(),
      Alert.find({ patientId: userId }).lean(),
      Device.find({ userId }).select({ pushToken: 0 }).lean(),
    ]);

    if (!user) throw AppError.unauthenticated('Please sign in again.');

    const strip = (rows: Record<string, unknown>[]) =>
      rows.map(({ _id, ...rest }) => ({ id: String(_id), ...rest }));

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="medtrack-export-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    res.json({
      exportedAt: new Date().toISOString(),
      notice:
        'This file contains personal and health-related data. Store it somewhere you trust.',
      account: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        roles: user.roles,
        timezone: user.timezone,
        dateOfBirth: user.dateOfBirth,
        phone: user.phone,
        createdAt: user.createdAt,
        consents: user.consents,
      },
      medicines: strip(medicines as Record<string, unknown>[]),
      doseHistory: strip(doses as Record<string, unknown>[]),
      appointments: strip(appointments as Record<string, unknown>[]),
      caregivers: strip(careLinks as Record<string, unknown>[]),
      alerts: strip(alerts as Record<string, unknown>[]),
      devices: strip(devices as Record<string, unknown>[]),
    });
  } catch (error) {
    next(error);
  }
});

/* ───────────────────────────── Consent ──────────────────────────────────── */

router.get('/consents', async (req, res, next) => {
  try {
    const user = await User.findById(auth(req).userId).select({ consents: 1 }).lean();
    if (!user) throw AppError.unauthenticated('Please sign in again.');

    res.json({
      consents: user.consents,
      currentVersions: LEGAL_DOCUMENT_VERSIONS,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Grant or withdraw a consent.
 *
 * Withdrawal is recorded rather than deleted, so the history of what was agreed
 * and when remains auditable. The two consents the service cannot operate
 * without cannot be withdrawn piecemeal — withdrawing those means deleting the
 * account, and the response says so plainly instead of silently doing nothing.
 */
router.post('/consents', validate(updateConsentSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const input = updateConsentSchema.parse(req.body);

    if (!input.granted && (input.kind === 'terms_of_service' || input.kind === 'privacy_policy')) {
      throw AppError.badRequest(
        'MedTrack cannot operate without these. To withdraw them, delete your account.',
      );
    }

    const user = await User.findById(userId);
    if (!user) throw AppError.unauthenticated('Please sign in again.');

    const existing = user.consents.find(
      (consent) => consent.kind === input.kind && !consent.withdrawnAt,
    );

    if (input.granted) {
      if (existing && existing.documentVersion === input.documentVersion) {
        res.json({ consents: user.consents });
        return;
      }
      if (existing) existing.withdrawnAt = new Date();
      user.consents.push({
        kind: input.kind,
        documentVersion: input.documentVersion,
        grantedAt: new Date(),
        withdrawnAt: null,
      });
    } else if (existing) {
      existing.withdrawnAt = new Date();
    }

    await user.save();
    log.info({ userId, kind: input.kind, granted: input.granted }, 'Consent updated');
    res.json({ consents: user.consents });
  } catch (error) {
    next(error);
  }
});

/* ──────────────────────────── Right of erasure ──────────────────────────── */

router.post('/delete', validate(deleteAccountSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const input = deleteAccountSchema.parse(req.body);

    const user = await User.findById(userId).select('+passwordHash');
    if (!user) throw AppError.unauthenticated('Please sign in again.');

    if (!(await verifyPassword(input.password, user.passwordHash))) {
      throw AppError.badRequest('That password is not right.');
    }

    const purgeAt = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    user.deletionRequestedAt = new Date();
    await user.save();

    // Caregivers lose access the moment deletion is requested, not at purge.
    await CareLink.updateMany(
      { $or: [{ patientId: userId }, { caregiverId: userId }], status: { $in: ['pending', 'active'] } },
      { $set: { status: 'revoked', revokedAt: new Date(), inviteTokenHash: null } },
    );

    // Stop all push immediately.
    await Device.deleteMany({ userId });
    await revokeAllForUser(userId, 'account_deleted');

    log.info({ userId, purgeAt }, 'Account deletion requested');
    res.json({
      message: `Your account is scheduled for deletion on ${purgeAt.toISOString().slice(0, 10)}. Sign in before then to cancel.`,
      purgeAt,
      graceDays: DELETION_GRACE_DAYS,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/delete/cancel', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const user = await User.findById(userId);
    if (!user) throw AppError.unauthenticated('Please sign in again.');

    if (!user.deletionRequestedAt) {
      throw AppError.badRequest('Your account is not scheduled for deletion.');
    }

    user.deletionRequestedAt = null;
    await user.save();

    log.info({ userId }, 'Account deletion cancelled');
    res.json({ message: 'Deletion cancelled. Your account is active again.' });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────── Purge job ───────────────────────────────── */

/**
 * Permanently erase accounts whose grace period has elapsed.
 *
 * Called by the scheduler. Ordered so that if it fails partway, what remains is
 * an account with no health data rather than health data with no owner.
 */
export async function purgeDeletedAccounts(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const due = await User.find({ deletionRequestedAt: { $ne: null, $lte: cutoff } })
    .select({ _id: 1 })
    .lean();

  for (const user of due) {
    const userId = String(user._id);
    await Promise.all([
      DoseEvent.deleteMany({ userId }),
      Medicine.deleteMany({ userId }),
      Appointment.deleteMany({ userId }),
      Alert.deleteMany({ patientId: userId }),
      CareLink.deleteMany({ $or: [{ patientId: userId }, { caregiverId: userId }] }),
      Device.deleteMany({ userId }),
      Session.deleteMany({ userId }),
      SyncMutation.deleteMany({ userId }),
      PasswordReset.deleteMany({ userId }),
    ]);
    await User.deleteOne({ _id: userId });
    log.info({ userId }, 'Account purged');
  }

  return due.length;
}

export default router;
