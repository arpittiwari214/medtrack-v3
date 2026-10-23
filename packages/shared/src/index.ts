/**
 * @medtrack/shared — the domain core.
 *
 * Everything here is pure and dependency-light so the API, the web app and the
 * Expo app can all import it. No database access, no HTTP, no React.
 */

import type { ConsentKind, ConsentRecord } from './types.js';

export * from './types.js';
export * from './time.js';
export * from './schedule.js';
export * from './dose-status.js';
export * from './adherence.js';
export * from './validation.js';
export * from './recognition.js';

/**
 * Document versions. Bumping one makes the web app ask every signed-in user to
 * agree again before continuing (see `outdatedConsents`).
 */
export const LEGAL_DOCUMENT_VERSIONS = {
  terms_of_service: '1.0.0',
  privacy_policy: '1.1.0',
} as const;

/**
 * What each consent covers: the personal data it uses and the one purpose it
 * serves, which the DPDP Rules (r.3) require a notice to itemise. Copied onto
 * every consent record when given, so a record still says what was agreed
 * after this text changes.
 */
export const CONSENT_SCOPE: Record<
  ConsentKind,
  { purpose: string; dataItems: readonly string[]; optional: boolean }
> = {
  terms_of_service: { purpose: 'Agreeing to the Terms of Service', dataItems: [], optional: false },
  privacy_policy: { purpose: 'Agreeing to the Privacy Policy', dataItems: [], optional: false },
  health_data_processing: {
    purpose: 'Reminding you to take your medicines and keeping your record',
    dataItems: ['Name', 'Email address', 'Timezone', 'Medicines and their schedules', 'Dose history', 'Appointments'],
    optional: false,
  },
  caregiver_sharing: {
    purpose: 'Showing your record to caregivers you invite',
    dataItems: ['Name', 'Medicines', 'Dose history', 'Missed-dose alerts'],
    optional: true,
  },
  marketing_email: {
    purpose: 'Occasional email about new features',
    dataItems: ['Name', 'Email address'],
    optional: true,
  },
  research_use: {
    purpose:
      'Research by MedTrack into why doses are missed, to improve the app. Your name, email and phone are removed first. Never sold, and never shared with drug companies, insurers or employers.',
    dataItems: ['Medicines and their schedules', 'Dose history', 'Timezone', 'Year of birth, if given'],
    optional: true,
  },
};

/** Terms have their own version; every other consent is given under the Privacy Policy. */
export function consentVersionOf(kind: ConsentKind): string {
  return kind === 'terms_of_service'
    ? LEGAL_DOCUMENT_VERSIONS.terms_of_service
    : LEGAL_DOCUMENT_VERSIONS.privacy_policy;
}

/** Required consents with no live record at the current document version. */
export function outdatedConsents(consents: readonly ConsentRecord[]): ConsentKind[] {
  return (['terms_of_service', 'privacy_policy', 'health_data_processing'] as const).filter(
    (kind) =>
      !consents.some(
        (consent) =>
          consent.kind === kind && !consent.withdrawnAt && consent.documentVersion === consentVersionOf(kind),
      ),
  );
}

/** Snooze durations offered in the UI, in minutes. */
export const SNOOZE_PRESETS = [5, 10, 15, 30, 60] as const;
