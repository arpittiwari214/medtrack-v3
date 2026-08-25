/**
 * Caregiver alerting.
 *
 * Two behaviours distinguish this from v3's version:
 *
 *  1. **Deduplication is durable.** The dedupe key includes a time bucket and is
 *     enforced by a unique index, so two workers racing on the same missed dose
 *     produce one alert. v3 did a `findOne` for a recent unresolved alert, which
 *     both raced and reset whenever a caregiver acknowledged one.
 *  2. **Delivery is recorded per recipient, including failures.** v3 stored a
 *     single `emailSent` boolean, so "the caregiver was never told" was
 *     indistinguishable from "the caregiver was told". For an escalation system
 *     that ambiguity is the whole ballgame.
 */

import type { AlertKind, AlertSeverity } from '@medtrack/shared';
import { MongoServerError } from 'mongodb';
import { childLogger } from '../config/logger.js';
import { Alert, type AlertDocument } from '../models/Alert.js';
import { CareLink } from '../models/CareLink.js';
import { User } from '../models/User.js';
import {
  sendConsecutiveMissEmail,
  sendCriticalMissEmail,
  sendLowStockEmail,
  sendSosEmail,
  type SendResult,
} from './email.js';
import { pushToUser } from './push.js';

const log = childLogger('alerts');

/** How wide a window collapses into one alert, per kind. */
const DEDUPE_WINDOW_MS: Record<AlertKind, number> = {
  dose_missed: 60 * 60 * 1000,
  consecutive_misses: 24 * 60 * 60 * 1000,
  critical_dose_missed: 6 * 60 * 60 * 1000,
  low_stock: 7 * 24 * 60 * 60 * 1000,
  appointment_upcoming: 24 * 60 * 60 * 1000,
  appointment_missed: 24 * 60 * 60 * 1000,
  // SOS is never deduped — every press must get through.
  sos: 0,
};

/**
 * Build the dedupe key.
 *
 * Bucketing time into the window means the key naturally expires: the same
 * event next week lands in a different bucket and alerts again, without needing
 * a TTL or a cleanup job.
 */
function dedupeKeyFor(input: {
  patientId: string;
  kind: AlertKind;
  subjectId?: string | null;
  at: Date;
}): string {
  const window = DEDUPE_WINDOW_MS[input.kind];
  const bucket = window === 0
    // Unique per occurrence, so nothing is ever collapsed.
    ? `${input.at.getTime()}`
    : `${Math.floor(input.at.getTime() / window)}`;
  return [input.patientId, input.kind, input.subjectId ?? 'none', bucket].join(':');
}

export interface RaiseAlertInput {
  patientId: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  body: string;
  medicineId?: string | null;
  appointmentId?: string | null;
  doseEventId?: string | null;
  /** Extra detail passed to the email templates. */
  emailContext?: { medicineName?: string; missCount?: number; dosesRemaining?: number; message?: string | null };
  at?: Date;
}

/**
 * Record an alert and fan it out to the patient's caregivers.
 *
 * Returns `null` when the alert was deduplicated — the caller should treat that
 * as success, not failure.
 */
export async function raiseAlert(input: RaiseAlertInput): Promise<AlertDocument | null> {
  const at = input.at ?? new Date();
  const dedupeKey = dedupeKeyFor({
    patientId: input.patientId,
    kind: input.kind,
    subjectId: input.medicineId ?? input.appointmentId ?? null,
    at,
  });

  let alert: AlertDocument;
  try {
    alert = await Alert.create({
      patientId: input.patientId,
      kind: input.kind,
      severity: input.severity,
      title: input.title,
      body: input.body,
      medicineId: input.medicineId ?? null,
      appointmentId: input.appointmentId ?? null,
      doseEventId: input.doseEventId ?? null,
      dedupeKey,
      deliveries: [],
    });
  } catch (error) {
    // Duplicate key means an equivalent alert already exists in this window.
    if (error instanceof MongoServerError && error.code === 11000) {
      log.debug({ kind: input.kind, patientId: input.patientId }, 'Alert deduplicated');
      return null;
    }
    throw error;
  }

  await deliverToCaregivers(alert, input.emailContext ?? {});
  return alert;
}

/**
 * Send an alert to every caregiver with an active link and `receiveAlerts`.
 *
 * Delivery is best-effort by design: the alert is already durably recorded, so
 * a failed email degrades to an in-app notification rather than losing the
 * event. Every attempt is written back to the alert.
 */
async function deliverToCaregivers(
  alert: AlertDocument,
  context: NonNullable<RaiseAlertInput['emailContext']>,
): Promise<void> {
  const [patient, links] = await Promise.all([
    User.findById(alert.patientId).select({ name: 1 }).lean(),
    CareLink.find({ patientId: alert.patientId, status: 'active' }).lean(),
  ]);

  if (!patient) return;

  const recipients = links.filter((link) => link.permissions.receiveAlerts);
  if (recipients.length === 0) {
    log.debug({ alertId: alert._id }, 'No caregivers to notify');
    return;
  }

  const patientName = patient.name;
  const attemptedAt = new Date();

  await Promise.all(
    recipients.map(async (link) => {
      const emailResult = await sendAlertEmail(alert.kind, {
        to: link.invitedEmail,
        caregiverName: '',
        patientName,
        ...context,
      });

      alert.deliveries.push({
        careLinkId: String(link._id),
        channel: 'email',
        status: emailResult.status,
        error: emailResult.status === 'failed' ? emailResult.error : null,
        attemptedAt,
      });

      // Caregivers with an account also get a push.
      if (link.caregiverId) {
        const pushResult = await pushToUser(String(link.caregiverId), {
          title: alert.title,
          body: alert.body,
          priority: alert.severity === 'critical' ? 'high' : 'default',
          data: { type: 'alert', alertId: String(alert._id), patientId: alert.patientId },
        });

        alert.deliveries.push({
          careLinkId: String(link._id),
          channel: 'push',
          status: pushResult.sent > 0 ? 'sent' : pushResult.failed > 0 ? 'failed' : 'skipped',
          error: null,
          attemptedAt,
        });
      }
    }),
  );

  await alert.save();

  const delivered = alert.deliveries.filter((d) => d.status === 'sent').length;
  log.info(
    { alertId: alert._id, kind: alert.kind, recipients: recipients.length, delivered },
    'Alert dispatched',
  );
}

/** Route an alert kind to its email template. */
function sendAlertEmail(
  kind: AlertKind,
  payload: {
    to: string;
    caregiverName: string;
    patientName: string;
    medicineName?: string;
    missCount?: number;
    dosesRemaining?: number;
    message?: string | null;
  },
): Promise<SendResult> {
  switch (kind) {
    case 'critical_dose_missed':
      return sendCriticalMissEmail(payload);
    case 'consecutive_misses':
    case 'dose_missed':
      return sendConsecutiveMissEmail(payload);
    case 'low_stock':
      return sendLowStockEmail({ ...payload, dosesRemaining: payload.dosesRemaining ?? 0 });
    case 'sos':
      return sendSosEmail({
        ...payload,
        timestamp: new Date().toISOString(),
        message: payload.message ?? null,
      });
    case 'appointment_upcoming':
    case 'appointment_missed':
      // Reuse the generic template; the title and body already carry the detail.
      return sendConsecutiveMissEmail(payload);
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unhandled alert kind: ${String(exhaustive)}`);
    }
  }
}

/** Mark an alert handled. Caregivers need `manageAlerts` to do this. */
export async function acknowledgeAlert(
  alertId: string,
  patientId: string,
  userId: string,
): Promise<AlertDocument | null> {
  return Alert.findOneAndUpdate(
    { _id: alertId, patientId, acknowledgedAt: null },
    { $set: { acknowledgedAt: new Date(), acknowledgedBy: userId } },
    { new: true },
  );
}
