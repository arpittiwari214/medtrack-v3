/**
 * Deciding which dose reminders the OS should hold.
 *
 * Pure: no Expo imports, so `node --test` can exercise it. The notifications
 * module reads the OS state, calls this, and applies the result.
 */

import type { PlannedDose } from '@medtrack/shared';

/** Identifier prefix for scheduled dose reminders; snoozes use their own. */
export const DOSE_ID_PREFIX = 'dose:';

export interface ScheduledReminder {
  identifier: string;
  /** Fingerprint stored in the notification's data, if it has one. */
  fingerprint: string | undefined;
}

export interface DesiredReminder {
  identifier: string;
  fingerprint: string;
  dose: PlannedDose;
}

export interface PlanInput {
  /** Upcoming occurrences, sorted by time. May include resolved or past ones. */
  planned: PlannedDose[];
  /** Doses already taken or skipped — their reminder must not fire. */
  resolvedDoseIds: ReadonlySet<string>;
  /** Dose reminders currently held by the OS. */
  existing: ScheduledReminder[];
  nowMs: number;
  horizonDays: number;
  max: number;
  /** Bumped when wording changes, so old text is replaced rather than fired. */
  contentVersion: number;
  /** Replace everything regardless of fingerprint. */
  force: boolean;
}

export interface Plan {
  toCancel: string[];
  toSchedule: DesiredReminder[];
  /** Reminders left untouched because they already match. */
  kept: number;
}

export function fingerprintOf(dose: PlannedDose, contentVersion: number): string {
  return [
    contentVersion,
    dose.scheduledAt,
    dose.medicineName,
    dose.medicineStrength,
    dose.isCritical ? 1 : 0,
  ].join('|');
}

/**
 * Diff the desired reminders against what the OS holds.
 *
 * Diffing rather than cancel-and-recreate matters now that the horizon is
 * hundreds deep on Android: rebuilding hundreds of alarms on every sync is
 * slow on a low-end phone, and a rebuild interrupted half-way leaves gaps.
 * Ids are deterministic, so "same id and same fingerprint" really does mean
 * "the same reminder".
 */
export function planReminders(input: PlanInput): Plan {
  // A second of slack so a dose falling due while we compute is not scheduled
  // into the past, where Android would fire it immediately.
  const earliest = input.nowMs + 1000;
  const latest = input.nowMs + input.horizonDays * 86_400_000;

  const desired = new Map<string, DesiredReminder>();
  for (const dose of input.planned) {
    if (desired.size >= input.max) break;
    if (input.resolvedDoseIds.has(dose.id)) continue;

    const at = Date.parse(dose.scheduledAt);
    if (at <= earliest || at > latest) continue;

    const identifier = DOSE_ID_PREFIX + dose.id;
    desired.set(identifier, {
      identifier,
      fingerprint: fingerprintOf(dose, input.contentVersion),
      dose,
    });
  }

  const toCancel: string[] = [];
  const kept = new Set<string>();

  for (const reminder of input.existing) {
    const want = desired.get(reminder.identifier);
    if (!input.force && want && want.fingerprint === reminder.fingerprint) {
      kept.add(reminder.identifier);
    } else {
      toCancel.push(reminder.identifier);
    }
  }

  const toSchedule = [...desired.values()].filter((item) => !kept.has(item.identifier));
  return { toCancel, toSchedule, kept: kept.size };
}
