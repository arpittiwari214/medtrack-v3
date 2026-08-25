/**
 * Dose state machine and offline conflict resolution.
 *
 * v3 treated `snoozed` as a terminal state: the reminder loop only fired for
 * `pending` doses and the miss detector only queried `pending`, so snoozing a
 * dose removed it from the system entirely — no second reminder, and no
 * caregiver alert if it was never taken. Here `snoozed` is explicitly a
 * *deferral*: the dose becomes due again when `snoozedUntil` passes, and
 * `scheduledAt` is never rewritten, so the prescribed time survives for
 * analytics and the deterministic dose id stays stable.
 */

import type { DoseEvent, DoseStatus, InstantISO } from './types.js';
import { LATE_LOG_WINDOW_HOURS, MAX_SNOOZES_PER_DOSE } from './schedule.js';
import { addMinutes, minutesBetween, now } from './time.js';

export class DoseTransitionError extends Error {
  readonly code: 'INVALID_TRANSITION' | 'SNOOZE_LIMIT' | 'LATE_LOG_EXPIRED';
  constructor(code: DoseTransitionError['code'], message: string) {
    super(message);
    this.name = 'DoseTransitionError';
    this.code = code;
  }
}

export type DoseAction = 'take' | 'skip' | 'snooze' | 'undo' | 'mark_missed';

/** States in which the dose is settled and no longer needs the patient's attention. */
const RESOLVED: ReadonlySet<DoseStatus> = new Set<DoseStatus>(['taken', 'skipped', 'missed']);

/**
 * States the patient asserted directly. These outrank anything the server
 * inferred, which is what stops a background job from overwriting a dose the
 * patient logged offline. See `mergeDoseConflict`.
 */
const USER_ASSERTED: ReadonlySet<DoseStatus> = new Set<DoseStatus>(['taken', 'skipped']);

const ALLOWED: Readonly<Record<DoseStatus, ReadonlySet<DoseStatus>>> = {
  scheduled: new Set<DoseStatus>(['taken', 'skipped', 'snoozed', 'missed']),
  snoozed: new Set<DoseStatus>(['taken', 'skipped', 'snoozed', 'missed']),
  // A missed dose can still be logged late — patients often take a dose an hour
  // after the reminder and expect that to count.
  missed: new Set<DoseStatus>(['taken', 'skipped']),
  taken: new Set<DoseStatus>(['scheduled']),
  skipped: new Set<DoseStatus>(['scheduled']),
};

export function isResolved(status: DoseStatus): boolean {
  return RESOLVED.has(status);
}

export function canTransition(from: DoseStatus, to: DoseStatus): boolean {
  return ALLOWED[from].has(to);
}

/* ──────────────────────────── Due-ness queries ──────────────────────────── */

/**
 * The instant this dose is actually due, honouring an active snooze.
 *
 * Every "is it time yet" check goes through here, so a snoozed dose reliably
 * comes back instead of vanishing.
 */
export function effectiveDueAt(dose: Pick<DoseEvent, 'scheduledAt' | 'snoozedUntil' | 'status'>): InstantISO {
  if (dose.status === 'snoozed' && dose.snoozedUntil) return dose.snoozedUntil;
  return dose.scheduledAt;
}

/** Whether the dose is awaiting action and its due time has arrived. */
export function isDue(
  dose: Pick<DoseEvent, 'scheduledAt' | 'snoozedUntil' | 'status'>,
  at: Date = now(),
): boolean {
  if (isResolved(dose.status)) return false;
  return new Date(effectiveDueAt(dose)).getTime() <= at.getTime();
}

/** Whether the grace period has elapsed, so the dose should be marked missed. */
export function isOverdue(
  dose: Pick<DoseEvent, 'scheduledAt' | 'snoozedUntil' | 'status'>,
  graceMinutes: number,
  at: Date = now(),
): boolean {
  if (isResolved(dose.status)) return false;
  return minutesBetween(effectiveDueAt(dose), at) >= graceMinutes;
}

/** Whether a missed dose may still be logged as taken. */
export function canLogLate(
  dose: Pick<DoseEvent, 'scheduledAt' | 'snoozedUntil' | 'status'>,
  at: Date = now(),
): boolean {
  const hoursSinceDue = minutesBetween(effectiveDueAt(dose), at) / 60;
  return hoursSinceDue <= LATE_LOG_WINDOW_HOURS;
}

/* ─────────────────────────────── Transitions ────────────────────────────── */

export interface TransitionInput {
  action: DoseAction;
  at?: Date;
  /** Required for `snooze`: how long to defer, in minutes. */
  snoozeMinutes?: number;
  skipReason?: string | null;
}

/**
 * Apply an action and return the changed fields. Pure — the caller persists the
 * patch, so the same logic runs on the server and against the offline cache.
 */
export function applyDoseAction(dose: DoseEvent, input: TransitionInput): Partial<DoseEvent> {
  const at = input.at ?? now();
  const atISO = at.toISOString();

  switch (input.action) {
    case 'take': {
      requireTransition(dose.status, 'taken');
      if (dose.status === 'missed' && !canLogLate(dose, at)) {
        throw new DoseTransitionError(
          'LATE_LOG_EXPIRED',
          `This dose can no longer be logged — the ${LATE_LOG_WINDOW_HOURS}-hour window has passed.`,
        );
      }
      return {
        status: 'taken',
        takenAt: atISO,
        snoozedUntil: null,
        updatedAt: atISO,
      };
    }

    case 'skip': {
      requireTransition(dose.status, 'skipped');
      return {
        status: 'skipped',
        takenAt: null,
        snoozedUntil: null,
        skipReason: input.skipReason ?? null,
        updatedAt: atISO,
      };
    }

    case 'snooze': {
      requireTransition(dose.status, 'snoozed');
      const minutes = input.snoozeMinutes;
      if (!minutes || minutes < 1) {
        throw new DoseTransitionError('INVALID_TRANSITION', 'snoozeMinutes must be at least 1.');
      }
      if (dose.snoozeCount >= MAX_SNOOZES_PER_DOSE) {
        throw new DoseTransitionError(
          'SNOOZE_LIMIT',
          `This dose has already been snoozed ${MAX_SNOOZES_PER_DOSE} times.`,
        );
      }
      return {
        status: 'snoozed',
        // `scheduledAt` is deliberately untouched — snoozing defers the
        // reminder, it does not rewrite the prescription.
        snoozedUntil: addMinutes(at, minutes).toISOString(),
        snoozeCount: dose.snoozeCount + 1,
        updatedAt: atISO,
      };
    }

    case 'undo': {
      requireTransition(dose.status, 'scheduled');
      return {
        status: 'scheduled',
        takenAt: null,
        snoozedUntil: null,
        skipReason: null,
        updatedAt: atISO,
      };
    }

    case 'mark_missed': {
      requireTransition(dose.status, 'missed');
      return {
        status: 'missed',
        takenAt: null,
        snoozedUntil: null,
        updatedAt: atISO,
      };
    }

    default: {
      const exhaustive: never = input.action;
      throw new DoseTransitionError('INVALID_TRANSITION', `Unknown action: ${String(exhaustive)}`);
    }
  }
}

function requireTransition(from: DoseStatus, to: DoseStatus): void {
  if (!canTransition(from, to)) {
    throw new DoseTransitionError(
      'INVALID_TRANSITION',
      `Cannot move a dose from "${from}" to "${to}".`,
    );
  }
}

/* ─────────────────────── Offline conflict resolution ────────────────────── */

const PRECEDENCE: Readonly<Record<DoseStatus, number>> = {
  taken: 4,
  skipped: 3,
  missed: 2,
  snoozed: 1,
  scheduled: 0,
};

/**
 * Merge two versions of the same dose that were edited independently.
 *
 * Plain last-write-wins is wrong here. Consider: the patient takes a dose at
 * 08:30 on a phone with no signal, the server's miss detector marks it missed
 * at 09:00, and the phone syncs at 10:00. By timestamp the server wins and the
 * patient's dose is silently un-taken — and their caregiver has already been
 * alerted. So:
 *
 *   1. A state the *patient asserted* (taken, skipped) always beats one the
 *      *server inferred* (missed, scheduled, snoozed), regardless of clock.
 *   2. Between two patient assertions, the later one wins — they changed their
 *      mind, and their most recent statement is the true one.
 *   3. Otherwise the higher-precedence state wins, ties broken by timestamp.
 */
export function mergeDoseConflict(a: DoseEvent, b: DoseEvent): DoseEvent {
  if (a.id !== b.id) {
    throw new DoseTransitionError('INVALID_TRANSITION', 'Cannot merge two different doses.');
  }

  const aAsserted = USER_ASSERTED.has(a.status);
  const bAsserted = USER_ASSERTED.has(b.status);

  if (aAsserted !== bAsserted) return aAsserted ? a : b;
  if (aAsserted && bAsserted) return laterOf(a, b);

  const byPrecedence = PRECEDENCE[a.status] - PRECEDENCE[b.status];
  if (byPrecedence !== 0) return byPrecedence > 0 ? a : b;
  return laterOf(a, b);
}

function laterOf(a: DoseEvent, b: DoseEvent): DoseEvent {
  if (a.updatedAt === b.updatedAt) {
    // Deterministic tiebreak so every device converges on the same winner.
    return a.rev >= b.rev ? a : b;
  }
  return a.updatedAt > b.updatedAt ? a : b;
}

/** Human-readable label for a status, shared by all three clients. */
export function doseStatusLabel(status: DoseStatus): string {
  switch (status) {
    case 'scheduled': return 'Scheduled';
    case 'snoozed': return 'Snoozed';
    case 'taken': return 'Taken';
    case 'skipped': return 'Skipped';
    case 'missed': return 'Missed';
    default: {
      const exhaustive: never = status;
      return String(exhaustive);
    }
  }
}
