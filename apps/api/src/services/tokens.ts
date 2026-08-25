/**
 * Access and refresh token issuance.
 *
 * Access tokens are short-lived JWTs carrying just enough to authorise a
 * request. Refresh tokens are opaque random strings stored hashed in the
 * `Session` collection — deliberately *not* JWTs, because the whole point is
 * that the server can revoke them, and a self-contained token cannot be
 * revoked without a server-side check anyway.
 *
 * Rotation with reuse detection: every refresh mints a new token and marks the
 * old one rotated. If a rotated token is ever presented again, it has leaked,
 * so the entire family is revoked and the user must sign in.
 */

import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { UserRole } from '@medtrack/shared';
import { env } from '../config/env.js';
import { childLogger } from '../config/logger.js';
import {
  Session,
  createRefreshToken,
  hashIp,
  hashRefreshToken,
  type SessionDocument,
} from '../models/Session.js';
import { AppError } from '../middleware/error.js';

const log = childLogger('tokens');

const ISSUER = 'medtrack';
const AUDIENCE = 'medtrack-app';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: UserRole[];
  sessionId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires, so clients can pre-emptively refresh. */
  expiresIn: number;
}

/* ─────────────────────────────── Access ─────────────────────────────────── */

export function signAccessToken(claims: AccessTokenClaims): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
    subject: claims.sub,
  };
  return jwt.sign(
    { email: claims.email, roles: claims.roles, sessionId: claims.sessionId },
    env.JWT_ACCESS_SECRET,
    options,
  );
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (typeof payload === 'string') throw new Error('Unexpected token payload');
    const { sub, email, roles, sessionId } = payload as jwt.JwtPayload & {
      email?: unknown;
      roles?: unknown;
      sessionId?: unknown;
    };

    if (
      typeof sub !== 'string' ||
      typeof email !== 'string' ||
      typeof sessionId !== 'string' ||
      !Array.isArray(roles)
    ) {
      throw new Error('Malformed token claims');
    }

    return { sub, email, roles: roles as UserRole[], sessionId };
  } catch {
    // Never surface the underlying jwt error — it distinguishes "expired" from
    // "bad signature", which is more than a caller needs to know.
    throw AppError.unauthenticated('Your session has ended. Please sign in again.');
  }
}

/* ─────────────────────────────── Refresh ────────────────────────────────── */

export interface SessionContext {
  userAgent?: string | undefined;
  ip?: string | undefined;
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Start a new session — called on sign-in and sign-up. */
export async function issueTokenPair(
  claims: Omit<AccessTokenClaims, 'sessionId'>,
  context: SessionContext = {},
): Promise<TokenPair> {
  const sessionId = randomUUID();
  const familyId = randomUUID();
  const { token, tokenHash } = createRefreshToken();

  await Session.create({
    _id: sessionId,
    userId: claims.sub,
    tokenHash,
    familyId,
    expiresAt: refreshExpiry(),
    userAgent: context.userAgent?.slice(0, 300) ?? null,
    ipHash: hashIp(context.ip, env.JWT_REFRESH_SECRET),
  });

  const accessToken = signAccessToken({ ...claims, sessionId });
  return { accessToken, refreshToken: token, expiresIn: ttlSeconds(env.JWT_ACCESS_TTL) };
}

/**
 * Exchange a refresh token for a new pair.
 *
 * Presenting a token that was already rotated means it leaked — the legitimate
 * client would be holding its replacement — so the whole family is revoked.
 */
export async function rotateTokenPair(
  refreshToken: string,
  claimsFor: (userId: string) => Promise<Omit<AccessTokenClaims, 'sessionId'>>,
  context: SessionContext = {},
): Promise<TokenPair> {
  const tokenHash = hashRefreshToken(refreshToken);
  const session = await Session.findOne({ tokenHash });

  if (!session) throw AppError.unauthenticated('Please sign in again.');

  if (session.rotatedAt || session.revokedAt) {
    await revokeFamily(session.familyId, 'reuse_detected');
    log.warn(
      { userId: session.userId, familyId: session.familyId },
      'Refresh token reuse detected — session family revoked',
    );
    throw AppError.unauthenticated('Please sign in again.');
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw AppError.unauthenticated('Your session has expired. Please sign in again.');
  }

  // Retire the presented token before issuing its replacement.
  session.rotatedAt = new Date();
  session.revokedAt = new Date();
  session.revokedReason = 'rotation';
  await session.save();

  const claims = await claimsFor(session.userId);
  const sessionId = randomUUID();
  const { token, tokenHash: nextHash } = createRefreshToken();

  await Session.create({
    _id: sessionId,
    userId: session.userId,
    tokenHash: nextHash,
    familyId: session.familyId,
    expiresAt: refreshExpiry(),
    userAgent: context.userAgent?.slice(0, 300) ?? session.userAgent,
    ipHash: hashIp(context.ip, env.JWT_REFRESH_SECRET) ?? session.ipHash,
  });

  const accessToken = signAccessToken({ ...claims, sessionId });
  return { accessToken, refreshToken: token, expiresIn: ttlSeconds(env.JWT_ACCESS_TTL) };
}

/** Sign out one session. */
export async function revokeSession(
  sessionId: string,
  reason: SessionDocument['revokedReason'] = 'logout',
): Promise<void> {
  await Session.updateOne(
    { _id: sessionId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

export async function revokeFamily(
  familyId: string,
  reason: SessionDocument['revokedReason'],
): Promise<void> {
  await Session.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
}

/** Sign out everywhere — used on password change and account deletion. */
export async function revokeAllForUser(
  userId: string,
  reason: SessionDocument['revokedReason'],
): Promise<number> {
  const result = await Session.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
  return result.modifiedCount;
}

/** Convert a `15m`-style TTL into seconds for the client. */
function ttlSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return value * multiplier;
}
