import { describe, expect, it } from 'vitest';
import type { DoseEvent } from './types.js';
import {
  DoseTransitionError,
  applyDoseAction,
  canLogLate,
  canTransition,
  effectiveDueAt,
  isDue,
  isOverdue,
  mergeDoseConflict,
} from './dose-status.js';
import { MAX_SNOOZES_PER_DOSE } from './schedule.js';

const SCHEDULED_AT = '2026-08-25T02:30:00.000Z'; // 08:00 IST

function makeDose(overrides: Partial<DoseEvent> = {}): DoseEvent {
  return {
    id: 'med-1_1787625000',
    userId: 'user-1',
    medicineId: 'med-1',
    scheduledAt: SCHEDULED_AT,
    localDate: '2026-08-25',
    localTime: '08:00',
    timezone: 'Asia/Kolkata',
    status: 'scheduled',
    takenAt: null,
    snoozedUntil: null,
    snoozeCount: 0,
    skipReason: null,
    medicineName: 'Metformin',
    medicineStrength: '500 mg',
    isCritical: false,
    isAdHoc: false,
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T00:00:00.000Z',
    rev: 1,
    ...overrides,
  };
}

/** Apply a patch the way a caller would, so assertions see the resulting dose. */
function apply(dose: DoseEvent, patch: Partial<DoseEvent>): DoseEvent {
  return { ...dose, ...patch };
}

describe('snooze is a deferral, not a terminal state', () => {
  it('never rewrites scheduledAt', () => {
    // v3 wrote the new time into scheduledTime, which destroyed the prescribed
    // time, broke the unique index, and let the generator recreate the dose.
    const dose = makeDose();
    const snoozed = apply(dose, applyDoseAction(dose, {
      action: 'snooze',
      snoozeMinutes: 15,
      at: new Date('2026-08-25T02:35:00.000Z'),
    }));

    expect(snoozed.scheduledAt).toBe(SCHEDULED_AT);
    expect(snoozed.snoozedUntil).toBe('2026-08-25T02:50:00.000Z');
    expect(snoozed.status).toBe('snoozed');
    expect(snoozed.id).toBe(dose.id); // id stays stable, so no duplicate is generated
  });

  it('becomes due again once the snooze elapses', () => {
    // The v3 bug: the reminder loop only fired for "pending", so a snoozed dose
    // never came back and the patient was never reminded again.
    const dose = makeDose();
    const snoozed = apply(dose, applyDoseAction(dose, {
      action: 'snooze',
      snoozeMinutes: 15,
      at: new Date('2026-08-25T02:35:00.000Z'),
    }));

    expect(effectiveDueAt(snoozed)).toBe('2026-08-25T02:50:00.000Z');
    expect(isDue(snoozed, new Date('2026-08-25T02:45:00.000Z'))).toBe(false);
    expect(isDue(snoozed, new Date('2026-08-25T02:50:00.000Z'))).toBe(true);
    expect(isDue(snoozed, new Date('2026-08-25T03:00:00.000Z'))).toBe(true);
  });

  it('can still be marked missed, so the caregiver is not left uninformed', () => {
    const dose = makeDose();
    const snoozed = apply(dose, applyDoseAction(dose, {
      action: 'snooze',
      snoozeMinutes: 15,
      at: new Date('2026-08-25T02:35:00.000Z'),
    }));

    expect(isOverdue(snoozed, 60, new Date('2026-08-25T03:30:00.000Z'))).toBe(false);
    expect(isOverdue(snoozed, 60, new Date('2026-08-25T03:50:00.000Z'))).toBe(true);
    expect(canTransition('snoozed', 'missed')).toBe(true);
  });

  it('measures overdue from the snooze time, not the original schedule', () => {
    const dose = makeDose();
    const snoozed = apply(dose, applyDoseAction(dose, {
      action: 'snooze',
      snoozeMinutes: 30,
      at: new Date('2026-08-25T02:30:00.000Z'),
    }));
    // 03:35Z is 65 min past the original time but only 5 min past the snooze.
    expect(isOverdue(snoozed, 60, new Date('2026-08-25T03:05:00.000Z'))).toBe(false);
  });

  it('caps repeated snoozing', () => {
    let dose = makeDose({ snoozeCount: MAX_SNOOZES_PER_DOSE - 1, status: 'snoozed' });
    dose = apply(dose, applyDoseAction(dose, { action: 'snooze', snoozeMinutes: 5 }));
    expect(dose.snoozeCount).toBe(MAX_SNOOZES_PER_DOSE);

    expect(() => applyDoseAction(dose, { action: 'snooze', snoozeMinutes: 5 }))
      .toThrow(DoseTransitionError);
  });

  it('rejects a nonsensical snooze duration', () => {
    const dose = makeDose();
    expect(() => applyDoseAction(dose, { action: 'snooze', snoozeMinutes: 0 })).toThrow(DoseTransitionError);
  });
});

describe('taking, skipping and undoing', () => {
  it('records when the dose was actually taken', () => {
    const dose = makeDose();
    const taken = apply(dose, applyDoseAction(dose, {
      action: 'take',
      at: new Date('2026-08-25T02:41:00.000Z'),
    }));
    expect(taken.status).toBe('taken');
    expect(taken.takenAt).toBe('2026-08-25T02:41:00.000Z');
    expect(taken.scheduledAt).toBe(SCHEDULED_AT); // still knows when it was due
  });

  it('clears an active snooze when the dose is taken', () => {
    const snoozed = makeDose({ status: 'snoozed', snoozedUntil: '2026-08-25T02:50:00.000Z', snoozeCount: 1 });
    const taken = apply(snoozed, applyDoseAction(snoozed, { action: 'take' }));
    expect(taken.snoozedUntil).toBeNull();
  });

  it('keeps the reason on a skip', () => {
    const dose = makeDose();
    const skipped = apply(dose, applyDoseAction(dose, { action: 'skip', skipReason: 'Doctor said stop' }));
    expect(skipped.status).toBe('skipped');
    expect(skipped.skipReason).toBe('Doctor said stop');
  });

  it('allows undoing back to scheduled and clears the resolution fields', () => {
    const taken = makeDose({ status: 'taken', takenAt: '2026-08-25T02:41:00.000Z' });
    const undone = apply(taken, applyDoseAction(taken, { action: 'undo' }));
    expect(undone.status).toBe('scheduled');
    expect(undone.takenAt).toBeNull();
  });

  it('refuses a transition the state machine does not permit', () => {
    const taken = makeDose({ status: 'taken' });
    expect(() => applyDoseAction(taken, { action: 'snooze', snoozeMinutes: 5 })).toThrow(DoseTransitionError);
    expect(canTransition('taken', 'snoozed')).toBe(false);
  });
});

describe('logging a missed dose late', () => {
  const missed = makeDose({ status: 'missed' });

  it('accepts a late log inside the 24-hour window', () => {
    const at = new Date('2026-08-25T14:30:00.000Z'); // 12 h after due
    expect(canLogLate(missed, at)).toBe(true);
    const taken = apply(missed, applyDoseAction(missed, { action: 'take', at }));
    expect(taken.status).toBe('taken');
  });

  it('refuses once the window has closed', () => {
    const at = new Date('2026-08-26T06:30:00.000Z'); // 28 h after due
    expect(canLogLate(missed, at)).toBe(false);
    expect(() => applyDoseAction(missed, { action: 'take', at }))
      .toThrow(/no longer be logged/);
  });
});

describe('offline conflict resolution', () => {
  it('lets a dose the patient took offline beat a later server-inferred miss', () => {
    // The scenario that would silently un-take a dose under plain
    // last-write-wins: phone is offline, patient takes the dose at 08:30 IST,
    // the server marks it missed at 09:00, the phone syncs at 10:00.
    const takenOffline = makeDose({
      status: 'taken',
      takenAt: '2026-08-25T03:00:00.000Z',
      updatedAt: '2026-08-25T03:00:00.000Z',
      rev: 2,
    });
    const missedByServer = makeDose({
      status: 'missed',
      updatedAt: '2026-08-25T03:30:00.000Z', // later clock
      rev: 3,
    });

    expect(mergeDoseConflict(takenOffline, missedByServer).status).toBe('taken');
    expect(mergeDoseConflict(missedByServer, takenOffline).status).toBe('taken');
  });

  it('takes the later of two patient assertions', () => {
    const taken = makeDose({ status: 'taken', updatedAt: '2026-08-25T03:00:00.000Z', rev: 2 });
    const skipped = makeDose({ status: 'skipped', updatedAt: '2026-08-25T03:10:00.000Z', rev: 3 });
    expect(mergeDoseConflict(taken, skipped).status).toBe('skipped');
  });

  it('prefers the more advanced state when neither side is a patient assertion', () => {
    const scheduled = makeDose({ status: 'scheduled', updatedAt: '2026-08-25T04:00:00.000Z' });
    const missed = makeDose({ status: 'missed', updatedAt: '2026-08-25T03:00:00.000Z' });
    expect(mergeDoseConflict(scheduled, missed).status).toBe('missed');
  });

  it('resolves identical timestamps deterministically, so devices converge', () => {
    const a = makeDose({ status: 'snoozed', updatedAt: '2026-08-25T03:00:00.000Z', rev: 5 });
    const b = makeDose({ status: 'snoozed', updatedAt: '2026-08-25T03:00:00.000Z', rev: 9 });
    expect(mergeDoseConflict(a, b).rev).toBe(9);
    expect(mergeDoseConflict(b, a).rev).toBe(9); // order-independent
  });

  it('refuses to merge two different doses', () => {
    expect(() => mergeDoseConflict(makeDose({ id: 'a' }), makeDose({ id: 'b' })))
      .toThrow(DoseTransitionError);
  });
});

describe('resolved doses are inert', () => {
  it('never reports a resolved dose as due or overdue', () => {
    for (const status of ['taken', 'skipped', 'missed'] as const) {
      const dose = makeDose({ status });
      expect(isDue(dose, new Date('2030-01-01T00:00:00.000Z'))).toBe(false);
      expect(isOverdue(dose, 30, new Date('2030-01-01T00:00:00.000Z'))).toBe(false);
    }
  });
});
