/**
 * The privacy log: consents, exports, erasure, sign-ins and caregiver access.
 *
 * Holds only the account's random id and what happened — never a name, email
 * or health detail — so it can outlive the account it describes. The DPDP Rules
 * (r.6) want such logs kept for at least a year; erasure therefore leaves these
 * rows in place, and Mongo expires them a little after the year is up.
 */

import { randomUUID } from 'node:crypto';
import { Schema, model } from 'mongoose';

export const AUDIT_ACTIONS = [
  'account_created',
  'signed_in',
  'consent_granted',
  'consent_withdrawn',
  'data_exported',
  'deletion_requested',
  'deletion_cancelled',
  'account_purged',
  'caregiver_invited',
  'caregiver_access_granted',
  'caregiver_revoked',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const RETAIN_DAYS = 400;

const auditEventSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    userId: { type: String, required: true, index: true },
    action: { type: String, required: true, enum: AUDIT_ACTIONS },
    /** Ids and consent kinds only. */
    detail: { type: Schema.Types.Mixed, default: {} },
    at: { type: Date, required: true },
  },
  { versionKey: false },
);

auditEventSchema.index({ at: 1 }, { expireAfterSeconds: RETAIN_DAYS * 86_400 });

export const AuditEvent = model('AuditEvent', auditEventSchema);
