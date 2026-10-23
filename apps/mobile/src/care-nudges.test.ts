import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Medicine } from '@medtrack/shared';
import { CHECK_IN_ID, MAX_REFILL_NUDGES, REFILL_PREFIX, planCareNudges } from './care-nudges.ts';

const IST = 'Asia/Kolkata';
// 22 Oct 2026, 13:00 IST.
const NOW = new Date('2026-10-22T07:30:00.000Z');

function medicine(id: string, units: number | null, overrides: Partial<Medicine> = {}): Medicine {
  return {
    id,
    userId: 'u',
    name: `Med ${id}`,
    strength: '5 mg',
    form: 'tablet',
    timezone: IST,
    isCritical: false,
    stock: units === null ? null : { unitsRemaining: units, unitsPerDose: 1, lowThreshold: 6 },
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    rev: 1,
    schedule: { kind: 'daily', times: ['08:00', '21:00'], startDate: '2026-10-01', endDate: null },
    ...overrides,
  };
}

test('nothing to nudge about with no medicines', () => {
  assert.deepEqual(planCareNudges([], IST, NOW), []);
});

test('a medicine running low gets a buy-more reminder at 9am the next morning', () => {
  const nudges = planCareNudges([medicine('a', 4)], IST, NOW);
  const refill = nudges.find((n) => n.identifier === REFILL_PREFIX + 'a');
  assert.ok(refill);
  // 13:00 now is past 09:00, so tomorrow 09:00 IST = 03:30 UTC.
  assert.equal(refill.fireAt.toISOString(), '2026-10-23T03:30:00.000Z');
  assert.match(refill.body, /About 4 doses left/);
});

test('a well-stocked or untracked medicine gets no buy-more reminder', () => {
  const nudges = planCareNudges([medicine('a', 60), medicine('b', null)], IST, NOW);
  assert.equal(nudges.filter((n) => n.identifier.startsWith(REFILL_PREFIX)).length, 0);
});

test('an empty supply is not nagged about — there is nothing left to warn before', () => {
  const nudges = planCareNudges([medicine('a', 0)], IST, NOW);
  assert.equal(nudges.filter((n) => n.identifier.startsWith(REFILL_PREFIX)).length, 0);
});

test('buy-more reminders are capped, soonest to run out first', () => {
  const meds = [medicine('a', 5), medicine('b', 1), medicine('c', 3), medicine('d', 2), medicine('e', 4)];
  const refills = planCareNudges(meds, IST, NOW).filter((n) => n.identifier.startsWith(REFILL_PREFIX));
  assert.equal(refills.length, MAX_REFILL_NUDGES);
  assert.deepEqual(
    refills.map((n) => n.identifier.slice(REFILL_PREFIX.length)),
    ['b', 'd', 'c'],
  );
});

test('the check-in is three days out, at a sensible hour', () => {
  const checkIn = planCareNudges([medicine('a', 60)], IST, NOW).find((n) => n.identifier === CHECK_IN_ID);
  assert.ok(checkIn);
  // 25 Oct 10:00 IST = 04:30 UTC, regardless of the time the app was opened.
  assert.equal(checkIn.fireAt.toISOString(), '2026-10-25T04:30:00.000Z');
});

test('archived medicines are ignored', () => {
  assert.deepEqual(planCareNudges([medicine('a', 2, { archivedAt: '2026-10-10T00:00:00.000Z' })], IST, NOW), []);
});
