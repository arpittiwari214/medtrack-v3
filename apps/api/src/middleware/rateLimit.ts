/**
 * Rate limiting.
 *
 * v3 had none, so `POST /api/auth/login` accepted unlimited password guesses —
 * the single most consequential omission for an app holding health data.
 *
 * Limits are tiered by what the endpoint costs and what abusing it achieves:
 * guessing a password is worth far more to an attacker than listing medicines,
 * and sending email costs real money and reputation.
 */

import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit';
import { isTest } from '../config/env.js';
import { AppError } from './error.js';

/** Shared behaviour: standard headers, and our error shape on rejection. */
function make(options: Partial<Options> & { limit: number; windowMs: number }) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Tests would otherwise trip limits and fail for the wrong reason.
    skip: () => isTest,
    handler: (_req, _res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please wait and try again.'));
    },
    ...options,
  });
}

/**
 * Sign-in and password reset.
 *
 * Keyed on IP *and* the submitted email, so one attacker cannot lock out a
 * victim by burning the shared limit on their address, and a distributed
 * attack still hits a per-account ceiling. Successful requests do not count,
 * so a legitimate user is never penalised for signing in repeatedly.
 */
export const authLimiter = make({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : 'anonymous';
    // ipKeyGenerator normalises IPv6 to a /64 so a single host cannot rotate
    // through addresses within its own prefix to reset the counter.
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
  },
});

/**
 * Re-entering the password on a signed-in account — changing it, deleting the
 * account. Keyed by account: without a limit, someone holding an unlocked
 * phone could guess the password here and lock the owner out.
 */
export const passwordCheckLimiter = make({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? ''),
});

/** Account creation — throttled to stop bulk signup and mail-bombing. */
export const signupLimiter = make({
  windowMs: 60 * 60 * 1000,
  limit: 5,
});

/**
 * Anything that sends an email on the user's behalf: caregiver invites,
 * password resets, SOS. Keyed by authenticated user where possible.
 */
export const emailLimiter = make({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? ''),
});

/**
 * SOS is deliberately generous — a patient in trouble pressing it repeatedly
 * must get through — but not unbounded, since each press emails and pushes to
 * every caregiver.
 */
export const sosLimiter = make({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? ''),
});

/** General authenticated API ceiling, sized well above real client usage. */
export const apiLimiter = make({
  windowMs: 60 * 1000,
  limit: 300,
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? ''),
});

/**
 * Offline sync. A device returning after a long outage legitimately sends a
 * large batch, so the window is short and the limit low rather than the
 * reverse — this bounds sustained load without punishing a genuine catch-up.
 */
export const syncLimiter = make({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? ''),
});
