/**
 * User account.
 *
 * Notes on the security-relevant choices:
 *
 *  - `passwordHash` is `select: false`, so it is excluded from every query
 *    unless explicitly asked for. v3 used `select: true`, meaning a forgotten
 *    `.select('-password')` anywhere would have leaked hashes.
 *  - `toJSON` strips the hash and renames `_id` to `id`, so a handler cannot
 *    accidentally serialise internals by returning a document directly.
 *  - Consents are stored as an append-only-ish list with the document version,
 *    which is what makes "prove the patient agreed to this" answerable under
 *    the DPDP Act.
 */

import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

/**
 * bcrypt work factor. 12 is roughly 250 ms on current hardware — slow enough to
 * make offline guessing expensive, fast enough not to stall a login.
 */
const BCRYPT_ROUNDS = 12;

const consentSchema = new Schema(
  {
    kind: {
      type: String,
      required: true,
      enum: [
        'terms_of_service',
        'privacy_policy',
        'health_data_processing',
        'caregiver_sharing',
        'marketing_email',
        'research_use',
      ],
    },
    documentVersion: { type: String, required: true },
    purpose: { type: String, default: null },
    dataItems: { type: [String], default: undefined },
    language: { type: String, default: null },
    grantedAt: { type: Date, required: true },
    withdrawnAt: { type: Date, default: null },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 120 },

    roles: {
      type: [String],
      enum: ['patient', 'caregiver'],
      default: ['patient'],
    },

    /** IANA zone. Every wall-clock value in this user's data is read against it. */
    timezone: { type: String, required: true, default: 'Asia/Kolkata' },

    dateOfBirth: { type: String, default: null },
    phone: { type: String, default: null, maxlength: 20 },
    setupFor: { type: String, enum: ['self', 'family', null], default: null },
    /** Evidence of the 18+ self-declaration made at signup. */
    adultDeclaredAt: { type: Date, default: null },

    emailVerifiedAt: { type: Date, default: null },
    consents: { type: [consentSchema], default: [] },

    /** Counts consecutive failed logins, to lock out sustained guessing. */
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },

    /** Set when the user requests erasure; a job purges after the grace window. */
    deletionRequestedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret['id'] = ret['_id'];
        delete ret['_id'];
        delete ret['passwordHash'];
        delete ret['failedLoginAttempts'];
        delete ret['lockedUntil'];
        return ret;
      },
    },
  },
);

/** Caregiver lookups by email happen on every invite acceptance. */
userSchema.index({ deletionRequestedAt: 1 }, { sparse: true });

export type UserAttributes = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserAttributes>;

export const User = model('User', userSchema);

/* ─────────────────────────── Password helpers ───────────────────────────── */

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Constant-time-ish password check.
 *
 * When the caller has no user (unknown email), pass `null` — this still runs a
 * bcrypt comparison against a dummy hash so the response time does not reveal
 * whether the address is registered. v3 returned immediately on unknown email,
 * which made accounts enumerable by timing.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO3f4wYIH7L0Zj1oQ1lJvJ1qXKQm7Vv3W';

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(plain, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(plain, hash);
}
