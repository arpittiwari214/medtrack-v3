/**
 * Refresh-token sessions.
 *
 * v3 issued a single 7-day JWT held in `localStorage` with no server-side
 * record, so "sign out" only cleared the client and a stolen token stayed valid
 * for a week with no way to revoke it.
 *
 * Here a short-lived access token (15 min) is paired with a rotating refresh
 * token backed by this collection, which gives three properties v3 lacked:
 *
 *  - **Revocation.** Signing out, changing a password, or deleting an account
 *    invalidates sessions immediately.
 *  - **Rotation.** Each refresh mints a new token and retires the old one, so a
 *    captured refresh token has a short useful life.
 *  - **Reuse detection.** Presenting an already-rotated token means it leaked,
 *    so the whole family is revoked and the user must sign in again.
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const sessionSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    userId: { type: String, required: true, ref: 'User', index: true },

    /** SHA-256 of the refresh token. The plaintext never touches the database. */
    tokenHash: { type: String, required: true },

    /**
     * All rotations descended from one sign-in share a family id. Detecting
     * reuse anywhere in the family revokes the whole chain.
     */
    familyId: { type: String, required: true },

    /** Set when this token is rotated away; presenting it again signals theft. */
    rotatedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedReason: {
      type: String,
      default: null,
      enum: ['logout', 'rotation', 'reuse_detected', 'password_changed', 'account_deleted', null],
    },

    /** Coarse client details, to show a recognisable device list. */
    userAgent: { type: String, default: null, maxlength: 300 },
    ipHash: { type: String, default: null },

    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true, versionKey: false },
);

/** Refresh lookups go by token hash. */
sessionSchema.index({ tokenHash: 1 }, { unique: true });

/** Revoking a family on reuse detection. */
sessionSchema.index({ familyId: 1 });

/** Listing and bulk-revoking a user's sessions. */
sessionSchema.index({ userId: 1, revokedAt: 1 });

/**
 * Mongo removes expired sessions on its own, so the collection cannot grow
 * without bound and no cleanup job is needed.
 */
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionAttributes = InferSchemaType<typeof sessionSchema>;
export type SessionDocument = HydratedDocument<SessionAttributes>;

export const Session = model('Session', sessionSchema);

/* ─────────────────────────── Token generation ───────────────────────────── */

export function createRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, tokenHash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Coarse, salted IP fingerprint — enough to spot an unfamiliar sign-in, not to track. */
export function hashIp(ip: string | undefined, salt: string): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}
