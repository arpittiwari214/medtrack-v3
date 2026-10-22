import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PlannedDose } from '@medtrack/shared';
import { DOSE_ID_PREFIX, fingerprintOf, planReminders, type PlanInput } from './reminder-plan.ts';

const NOW = Date.parse('2026-10-22T00:00:00.000Z');
const HOUR = 3_600_000;

function dose(id: string, hoursAhead: number, name = 'Metformin'): PlannedDose {
  const at = new Date(NOW + hoursAhead * HOUR).toISOString();
  return {
    id,
    medicineId: 'm',
    userId: 'u',
    scheduledAt: at,
    localDate: at.slice(0, 10),
    localTime: at.slice(11, 16),
    timezone: 'Asia/Kolkata',
    missedAt: at,
    medicineName: name,
    medicineStrength: '500 mg',
    isCritical: false,
  };
}

function input(overrides: Partial<PlanInput>): PlanInput {
  return {
    planned: [],
    resolvedDoseIds: new Set(),
    existing: [],
    nowMs: NOW,
    horizonDays: 14,
    max: 300,
    contentVersion: 2,
    force: false,
    ...overrides,
  };
}

test('schedules up to the cap, not the old iOS-derived 50', () => {
  // Five medicines, three a day, fourteen days: 210 reminders.
  const planned = Array.from({ length: 210 }, (_, i) => dose(`d${i}`, 1 + i * 1.5));
  const plan = planReminders(input({ planned }));
  assert.equal(plan.toSchedule.length, 210);
});

test('skips a dose already taken, so its reminder never fires', () => {
  const plan = planReminders(input({ planned: [dose('a', 2), dose('b', 4)], resolvedDoseIds: new Set(['a']) }));
  assert.deepEqual(plan.toSchedule.map((r) => r.dose.id), ['b']);
});

test('cancels the reminder for a dose taken after it was scheduled', () => {
  const a = dose('a', 2);
  const plan = planReminders(
    input({
      planned: [a],
      resolvedDoseIds: new Set(['a']),
      existing: [{ identifier: DOSE_ID_PREFIX + 'a', fingerprint: fingerprintOf(a, 2) }],
    }),
  );
  assert.deepEqual(plan.toCancel, [DOSE_ID_PREFIX + 'a']);
});

test('leaves matching reminders alone instead of rebuilding them', () => {
  const a = dose('a', 2);
  const plan = planReminders(
    input({ planned: [a], existing: [{ identifier: DOSE_ID_PREFIX + 'a', fingerprint: fingerprintOf(a, 2) }] }),
  );
  assert.equal(plan.kept, 1);
  assert.equal(plan.toSchedule.length, 0);
  assert.equal(plan.toCancel.length, 0);
});

test('replaces a reminder whose medicine was renamed', () => {
  const before = dose('a', 2, 'Metformin');
  const after = dose('a', 2, 'Glycomet');
  const plan = planReminders(
    input({ planned: [after], existing: [{ identifier: DOSE_ID_PREFIX + 'a', fingerprint: fingerprintOf(before, 2) }] }),
  );
  assert.deepEqual(plan.toCancel, [DOSE_ID_PREFIX + 'a']);
  assert.equal(plan.toSchedule[0]?.dose.medicineName, 'Glycomet');
});

test('force replaces everything — alarms set while exact timing was denied stay inexact otherwise', () => {
  const a = dose('a', 2);
  const plan = planReminders(
    input({ planned: [a], force: true, existing: [{ identifier: DOSE_ID_PREFIX + 'a', fingerprint: fingerprintOf(a, 2) }] }),
  );
  assert.equal(plan.toCancel.length, 1);
  assert.equal(plan.toSchedule.length, 1);
});

test('cancels reminders left by the old scheduler, which carried no fingerprint', () => {
  const plan = planReminders(input({ existing: [{ identifier: 'random-uuid', fingerprint: undefined }] }));
  assert.deepEqual(plan.toCancel, ['random-uuid']);
});

test('never schedules into the past or beyond the horizon', () => {
  const plan = planReminders(input({ planned: [dose('past', -1), dose('soon', 1), dose('far', 24 * 20)] }));
  assert.deepEqual(plan.toSchedule.map((r) => r.dose.id), ['soon']);
});
