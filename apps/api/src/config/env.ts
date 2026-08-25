/**
 * Environment configuration, parsed and validated once at boot.
 *
 * v3 checked for two variables and then read `process.env` directly from a
 * dozen places, so a typo in `EMAIL_PORT` surfaced as `NaN` deep inside the
 * mail transport at 3am. Here every variable is parsed, typed and defaulted in
 * one schema — the process refuses to start on a bad config rather than failing
 * later on a code path nobody exercises in development.
 */

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

/**
 * Treat a blank value as absent.
 *
 * In a `.env` file `FOO=` is the natural way to write "not configured", but Zod
 * sees the empty string — which is *present* and therefore validated. Without
 * this, `EMAIL_FROM_ADDRESS=` fails `.email()` and the whole process refuses to
 * boot, even though email is optional. Applied to every optional string so the
 * shipped `.env.example`, which leaves the email block blank, works as-is.
 */
const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().optional(),
);

const optionalEmail = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().email().optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),

    /** Mongo connection string. Required — there is no sensible default. */
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

    /**
     * Signing secrets. Separate secrets for access and refresh tokens means a
     * leaked access secret cannot be used to mint long-lived refresh tokens.
     */
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    /** Short-lived by design; the refresh token carries the session. */
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

    /**
     * Comma-separated list of origins allowed to call the API.
     * v3 shipped `origin: true`, which reflects any caller. This is an explicit
     * allowlist and the server refuses to start in production without one.
     */
    CORS_ORIGINS: z.string().default('http://localhost:5173'),

    /** Public URL of the web app, used to build links in emails. */
    WEB_APP_URL: z.string().url().default('http://localhost:5173'),
    /** Public URL of this API, used in invite links and deep links. */
    API_PUBLIC_URL: z.string().url().default('http://localhost:5000'),

    /* Email — optional. Alerts degrade to in-app only when unset. */
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: booleanish.default('false'),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    EMAIL_FROM_NAME: z.string().default('MedTrack'),
    EMAIL_FROM_ADDRESS: optionalEmail,

    /** Expo access token. Only needed for push to devices with restricted tokens. */
    EXPO_ACCESS_TOKEN: optionalString,

    /** How long after a dose is due before it counts as missed, unless overridden per medicine. */
    DEFAULT_MISSED_GRACE_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),

    /** Disable background jobs — used by tests and by any second instance. */
    SCHEDULER_ENABLED: booleanish.default('true'),

    LOG_LEVEL: z
      .enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),

    /** Trust proxy hop count. Railway and Fly both put exactly one proxy in front. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    // Guard rails that only matter once real patient data is involved.
    if (env.CORS_ORIGINS.split(',').some((origin) => origin.trim() === '*')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'Wildcard CORS is not allowed in production. List the exact origins.',
      });
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'Access and refresh secrets must differ.',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (result.success) return result.data;

  // Fail loudly and specifically, rather than crash-looping on a stack trace.
  // A silent boot failure is exactly what took v3's backend down.
  const problems = result.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  console.error(`\nInvalid environment configuration:\n${problems}\n`);
  console.error('Copy .env.example to .env and fill in the missing values.\n');
  process.exit(1);
}

export const env = parseEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Parsed CORS allowlist. */
export const corsOrigins: string[] = env.CORS_ORIGINS
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/** Whether outbound email is configured. Callers skip email rather than throwing. */
export const emailEnabled: boolean = Boolean(
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD,
);
