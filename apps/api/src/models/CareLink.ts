/**
 * The patient ↔ caregiver relationship.
 *
 * This is the only channel through which one account can see another's health
 * data, so it is a first-class, revocable record rather than v3's embedded
 * `{name, email}` blob on the user. Every caregiver read is authorised against
 * an `active` link and its `permissions`.
 *
 * The invite token is stored hashed: a leaked database backup should not let
 * someone redeem outstanding invitations.
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/** Invitations expire so a forwarded email cannot be redeemed months later. */
export const INVITE_TTL_DAYS = 14;

const permissionsSchema = new Schema(
  {
    viewMedicines: { type: Boolean, default: true },
    viewAdherence: { type: Boolean, default: true },
    viewAppointments: { type: Boolean, default: false },
    receiveAlerts: { type: Boolean, default: true },
    manageAlerts: { type: Boolean, default: false },
  },
  { _id: false },
);

const careLinkSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },

    patientId: { type: String, required: true, ref: 'User', index: true },
    /** Null until the invitee accepts and an account exists. */
    caregiverId: { type: String, default: null, ref: 'User', index: true },

    invitedEmail: { type: String, required: true, lowercase: true, trim: true },
    relation: { type: String, required: true, trim: true, maxlength: 100 },

    status: {
      type: String,
      required: true,
      default: 'pending',
      enum: ['pending', 'active', 'revoked', 'declined', 'expired'],
    },
    permissions: { type: permissionsSchema, required: true, default: () => ({}) },

    /** SHA-256 of the invite token. The plaintext only ever exists in the email. */
    inviteTokenHash: { type: String, default: null, select: false },
    expiresAt: { type: Date, required: true },

    invitedAt: { type: Date, required: true, default: () => new Date() },
    respondedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret['id'] = ret['_id'];
        delete ret['_id'];
        delete ret['inviteTokenHash'];
        return ret;
      },
    },
  },
);

/** Authorisation lookup on every caregiver read — must be fast. */
careLinkSchema.index({ caregiverId: 1, status: 1 });
careLinkSchema.index({ patientId: 1, status: 1 });

/** Redeeming an invite looks the link up by token hash. */
careLinkSchema.index({ inviteTokenHash: 1 }, { sparse: true });

/**
 * One live link per patient/caregiver-email pair. Partial, so a revoked link
 * does not block re-inviting the same person later.
 */
careLinkSchema.index(
  { patientId: 1, invitedEmail: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'active'] } },
    name: 'uniq_live_carelink',
  },
);

export type CareLinkAttributes = InferSchemaType<typeof careLinkSchema>;
export type CareLinkDocument = HydratedDocument<CareLinkAttributes>;

export const CareLink = model('CareLink', careLinkSchema);

/* ──────────────────────────── Invite tokens ─────────────────────────────── */

/** Generate an invite token: plaintext for the email, hash for the database. */
export function createInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function inviteExpiryDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}
