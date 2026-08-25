/**
 * @medtrack/shared — the domain core.
 *
 * Everything here is pure and dependency-light so the API, the web app and the
 * Expo app can all import it. No database access, no HTTP, no React.
 */

export * from './types.js';
export * from './time.js';
export * from './schedule.js';
export * from './dose-status.js';
export * from './adherence.js';
export * from './validation.js';

/** Document versions. Bumping one forces affected users to re-consent on next sign-in. */
export const LEGAL_DOCUMENT_VERSIONS = {
  terms_of_service: '1.0.0',
  privacy_policy: '1.0.0',
} as const;

/** Snooze durations offered in the UI, in minutes. */
export const SNOOZE_PRESETS = [5, 10, 15, 30, 60] as const;
