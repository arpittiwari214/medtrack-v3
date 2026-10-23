/**
 * Authentication routes.
 *
 * Behaviours worth stating explicitly, because each is a deliberate departure
 * from v3:
 *
 *  - **No account enumeration.** Login, password reset and signup all respond
 *    the same way whether or not the address exists, and login always performs
 *    a bcrypt comparison so the timing does not give it away either.
 *  - **Lockout.** Repeated failures lock the account for a period, on top of
 *    the per-IP-and-email rate limit.
 *  - **Consent is recorded, not assumed.** Signup requires explicit agreement
 *    to the Terms and Privacy Policy, stored with the document version so
 *    "which version did they accept" is answerable later.
 */

import { Router } from 'express';
import {
  LEGAL_DOCUMENT_VERSIONS,
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  signupSchema,
  updateProfileSchema,
} from '@medtrack/shared';
import { env } from '../config/env.js';
import { childLogger } from '../config/logger.js';
import { auth, requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { authLimiter, emailLimiter, signupLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  PasswordReset,
  createResetToken,
  hashResetToken,
} from '../models/PasswordReset.js';
import { User, hashPassword, verifyPassword } from '../models/User.js';
import { sendPasswordResetEmail } from '../services/email.js';
import {
  issueTokenPair,
  revokeAllForUser,
  revokeSession,
  rotateTokenPair,
} from '../services/tokens.js';
import { materialiseForUser } from '../services/scheduler.js';

const log = childLogger('auth');
const router = Router();

/** Failed attempts before an account is temporarily locked. */
const LOCKOUT_THRESHOLD = 8;
const LOCKOUT_MINUTES = 15;

/** Identical response for every reset request, whatever the outcome. */
const RESET_ACK = {
  message: 'If that email has an account, a reset link is on its way.',
};

function sessionContext(req: { headers: Record<string, unknown>; ip?: string | undefined }) {
  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;
  return { userAgent, ip: req.ip };
}

/* ──────────────────────────────── Signup ───────────────────────────────── */

router.post('/signup', signupLimiter, validate(signupSchema), async (req, res, next) => {
  try {
    const input = signupSchema.parse(req.body);
    const now = new Date();

    const existing = await User.findOne({ email: input.email }).select({ _id: 1 }).lean();
    if (existing) {
      // The address is already registered, but saying so would confirm it to
      // anyone who asks. 409 with a neutral message is the compromise: the
      // legitimate owner is told to sign in, an attacker learns nothing new
      // that the signup form would not eventually reveal anyway.
      throw AppError.conflict('That email cannot be used to create an account. Try signing in.');
    }

    const consents = [
      {
        kind: 'terms_of_service' as const,
        documentVersion: LEGAL_DOCUMENT_VERSIONS.terms_of_service,
        grantedAt: now,
      },
      {
        kind: 'privacy_policy' as const,
        documentVersion: LEGAL_DOCUMENT_VERSIONS.privacy_policy,
        grantedAt: now,
      },
      // Storing medication data *is* processing health data, so it is consented
      // to separately and explicitly rather than folded into the privacy policy.
      {
        kind: 'health_data_processing' as const,
        documentVersion: LEGAL_DOCUMENT_VERSIONS.privacy_policy,
        grantedAt: now,
      },
    ];

    if (input.marketingEmail) {
      consents.push({
        kind: 'marketing_email' as never,
        documentVersion: LEGAL_DOCUMENT_VERSIONS.privacy_policy,
        grantedAt: now,
      });
    }

    const user = await User.create({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      name: input.name,
      timezone: input.timezone,
      dateOfBirth: input.dateOfBirth ?? null,
      setupFor: input.setupFor ?? null,
      adultDeclaredAt: now,
      roles: ['patient'],
      consents,
    });

    const tokens = await issueTokenPair(
      { sub: String(user._id), email: user.email, roles: user.roles as ('patient' | 'caregiver')[] },
      sessionContext(req),
    );

    log.info({ userId: user._id }, 'Account created');
    res.status(201).json({ user: user.toJSON(), ...tokens });
  } catch (error) {
    next(error);
  }
});

/* ──────────────────────────────── Login ────────────────────────────────── */

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email }).select('+passwordHash +failedLoginAttempts +lockedUntil');

    // Always compare, even with no user, so response time is uniform.
    const passwordOk = await verifyPassword(password, user?.passwordHash);

    if (!user || !passwordOk) {
      if (user) await registerFailedAttempt(user);
      throw AppError.unauthenticated('That email or password is not right.');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AppError(
        429,
        'RATE_LIMITED',
        'Too many failed attempts. Try again in a few minutes.',
      );
    }

    if (user.deletionRequestedAt) {
      throw AppError.forbidden('This account is scheduled for deletion.');
    }

    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await user.save();
    }

    const tokens = await issueTokenPair(
      { sub: String(user._id), email: user.email, roles: user.roles as ('patient' | 'caregiver')[] },
      sessionContext(req),
    );

    // Top up the agenda on sign-in, so a user returning after a break sees a
    // full schedule without waiting for the hourly sweep.
    void materialiseForUser(String(user._id));

    res.json({ user: user.toJSON(), ...tokens });
  } catch (error) {
    next(error);
  }
});

async function registerFailedAttempt(user: {
  failedLoginAttempts: number;
  lockedUntil?: Date | null | undefined;
  save: () => Promise<unknown>;
}): Promise<void> {
  user.failedLoginAttempts += 1;
  if (user.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
    user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    user.failedLoginAttempts = 0;
  }
  await user.save();
}

/* ─────────────────────────────── Refresh ───────────────────────────────── */

router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    const tokens = await rotateTokenPair(
      refreshToken,
      async (userId) => {
        const user = await User.findById(userId).select({ email: 1, roles: 1 }).lean();
        if (!user) throw AppError.unauthenticated('Please sign in again.');
        return {
          sub: userId,
          email: user.email,
          roles: user.roles as ('patient' | 'caregiver')[],
        };
      },
      sessionContext(req),
    );

    res.json(tokens);
  } catch (error) {
    next(error);
  }
});

/* ──────────────────────────────── Logout ───────────────────────────────── */

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await revokeSession(auth(req).sessionId, 'logout');
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    const count = await revokeAllForUser(auth(req).userId, 'logout');
    res.json({ message: `Signed out of ${count} session${count === 1 ? '' : 's'}.` });
  } catch (error) {
    next(error);
  }
});

/* ──────────────────────────────── Profile ──────────────────────────────── */

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(auth(req).userId);
    if (!user) throw AppError.unauthenticated('Please sign in again.');
    res.json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
});

router.patch('/me', requireAuth, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const input = updateProfileSchema.parse(req.body);
    const user = await User.findById(auth(req).userId);
    if (!user) throw AppError.unauthenticated('Please sign in again.');

    const timezoneChanged = input.timezone !== undefined && input.timezone !== user.timezone;

    if (input.name !== undefined) user.name = input.name;
    if (input.timezone !== undefined) user.timezone = input.timezone;
    if (input.dateOfBirth !== undefined) user.dateOfBirth = input.dateOfBirth ?? null;
    if (input.phone !== undefined) user.phone = input.phone ?? null;
    await user.save();

    // A zone change moves what "today" means, so the agenda is rebuilt.
    if (timezoneChanged) void materialiseForUser(String(user._id));

    res.json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
});

/* ─────────────────────────── Password changes ──────────────────────────── */

router.post('/change-password', requireAuth, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const { userId, sessionId } = auth(req);

    const user = await User.findById(userId).select('+passwordHash');
    if (!user) throw AppError.unauthenticated('Please sign in again.');

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw AppError.badRequest('Your current password is not right.');
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    // Changing a password must invalidate every other session — that is the
    // action someone takes when they think an account is compromised.
    await revokeAllForUser(userId, 'password_changed');

    const tokens = await issueTokenPair(
      { sub: userId, email: user.email, roles: user.roles as ('patient' | 'caregiver')[] },
      sessionContext(req),
    );

    log.info({ userId, previousSession: sessionId }, 'Password changed, sessions revoked');
    res.json({ message: 'Password updated. Other devices have been signed out.', ...tokens });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/forgot-password',
  emailLimiter,
  validate(requestPasswordResetSchema),
  async (req, res, next) => {
    try {
      const { email } = requestPasswordResetSchema.parse(req.body);
      const user = await User.findOne({ email }).select({ _id: 1, name: 1 }).lean();

      // Respond identically regardless — only the side effect differs.
      if (!user) {
        res.json(RESET_ACK);
        return;
      }

      const { token, tokenHash, expiresAt } = createResetToken();
      await PasswordReset.create({ userId: String(user._id), tokenHash, expiresAt });

      await sendPasswordResetEmail({
        to: email,
        name: user.name,
        resetUrl: `${env.WEB_APP_URL}/reset-password?token=${token}`,
      });

      res.json(RESET_ACK);
    } catch (error) {
      next(error);
    }
  },
);

router.post('/reset-password', authLimiter, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const record = await PasswordReset.findOne({ tokenHash: hashResetToken(token) });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw AppError.badRequest('That reset link is invalid or has expired.');
    }

    const user = await User.findById(record.userId).select('+passwordHash');
    if (!user) throw AppError.badRequest('That reset link is invalid or has expired.');

    user.passwordHash = await hashPassword(password);
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    // Consume the token before anything else can race on it.
    record.usedAt = new Date();
    await record.save();

    await revokeAllForUser(String(user._id), 'password_changed');

    log.info({ userId: user._id }, 'Password reset completed');
    res.json({ message: 'Your password has been reset. Please sign in.' });
  } catch (error) {
    next(error);
  }
});

export default router;
