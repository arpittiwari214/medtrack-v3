/**
 * DPDP record-keeping: what each consent covered, and the privacy log.
 */

import { CONSENT_SCOPE, consentVersionOf, type ConsentKind } from '@medtrack/shared';
import { childLogger } from '../config/logger.js';
import { AuditEvent, type AuditAction } from '../models/AuditEvent.js';

const log = childLogger('privacy');

/** A consent record carrying the itemised notice it was given against. */
export function consentRecord(kind: ConsentKind, language: string, grantedAt = new Date()) {
  const scope = CONSENT_SCOPE[kind];
  return {
    kind,
    documentVersion: consentVersionOf(kind),
    purpose: scope.purpose,
    dataItems: [...scope.dataItems],
    language,
    grantedAt,
    withdrawnAt: null,
  };
}

/**
 * Append to the privacy log. A failed write is logged, never thrown: it must
 * not stop someone exporting or erasing their data.
 */
export async function audit(
  userId: string,
  action: AuditAction,
  detail: Record<string, string> = {},
): Promise<void> {
  try {
    await AuditEvent.create({ userId, action, detail, at: new Date() });
  } catch (error) {
    log.error({ err: error, action }, 'Privacy log write failed');
  }
}
