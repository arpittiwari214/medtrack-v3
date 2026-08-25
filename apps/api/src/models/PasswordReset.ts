/**
 * Single-use password reset tokens.
 *
 * Stored hashed, short-lived, and consumed on first use. The row is inserted
 * whether or not the email exists is irrelevant here — the *route* decides that,
 * and always responds identically so the endpoint cannot be used to discover
 * which addresses are registered.
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Schema, model, type InferSchemaType } from 'mongoose';

export const RESET_TTL_MINUTES = 60;

const passwordResetSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    userId: { type: String, required: true, ref: 'User', index: true },

    /** SHA-256 of the token. The plaintext exists only in the email. */
    tokenHash: { type: String, required: true },

    /** Set the moment it is redeemed, making the token single-use. */
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

passwordResetSchema.index({ tokenHash: 1 }, { unique: true });

/** Mongo reaps expired rows, so no cleanup job is needed. */
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetAttributes = InferSchemaType<typeof passwordResetSchema>;

export const PasswordReset = model('PasswordReset', passwordResetSchema);

export function createResetToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
  };
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
