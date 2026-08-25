/**
 * Structured logging.
 *
 * Two things matter here beyond "not using console.log":
 *
 *  1. **Nothing sensitive reaches the log.** This is health data, so passwords,
 *     tokens and patient-identifying fields are redacted at the logger rather
 *     than trusted to every call site. Logs get shipped to third-party
 *     aggregators and read by people who are not the patient.
 *  2. **Errors are logged server-side, not returned to the client.** v3 sent
 *     `error: err.message` on every 500, leaking Mongo schema and index names.
 */

import pino from 'pino';
import { env, isProduction, isTest } from './env.js';

/**
 * Paths scrubbed before anything is written. `censor` rather than `remove` so
 * the shape of the log line stays stable and a redaction is visible.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.newPassword',
  'req.body.currentPassword',
  'req.body.token',
  'req.body.refreshToken',
  'res.headers["set-cookie"]',
  // Patient-identifying and clinical fields — never useful in a log line.
  '*.password',
  '*.passwordHash',
  '*.refreshToken',
  '*.pushToken',
  '*.email',
  '*.phone',
  '*.dateOfBirth',
  '*.medicineName',
  '*.strength',
  '*.instructions',
];

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  base: { service: 'medtrack-api' },
  formatters: {
    // Emit `level: "info"` rather than `level: 30`, which most log
    // aggregators handle better out of the box.
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Human-readable locally, newline-delimited JSON in production.
  transport: isProduction || isTest
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});

/** Child logger for a subsystem, so background jobs are filterable. */
export function childLogger(component: string): pino.Logger {
  return logger.child({ component });
}
