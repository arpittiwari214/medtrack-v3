import { describe, expect, it } from 'vitest';
import type { DoseEvent, DoseStatus } from './types.js';
import {
  byMedicine,
  currentStreak,
  dailySeries,
  insights,
  longestStreak,
  splitToday,
  summarise,
} from './adherence.js';

const IST = 'Asia/Kolkata';
const TODAY = '2026-08-25';

let sequence = 0;

function dose(localDate: string, status: DoseStatus, overrides: Partial<DoseEvent> = {}): DoseEvent {
  sequence += 1;
  return {
    id: `dose-${sequence}`,
    userId: 'user-1',
    medicineId: 'med-1',
    scheduledAt: `${localDate}T02:30:00.000Z`,
    localDate,
    localTime: '08:00',
    timezone: IST,
    status,
    takenAt: status === 'taken' ? `${localDate}T02:35:00.000Z` : null,
    snoozedUntil: null,
    snoozeCount: 0,
    skipReason: null,
    medicineName: 'Metformin',
    medicineStrength: '500 mg',
    isCritical: false,
    isAdHoc: false,
    createdAt: `${localDate}T00:00:00.000Z`,
    updatedAt: `${localDate}T00:00:00.000Z`,
    rev: 1,
    ...overrides,
  };
}

describe('adherence rate', () => {
  it('excludes doses that are not yet resolved', () => {
    // A dose that has not come due yet is not a failure. v3 counted only
    // resolved doses too, but recomputed the rule in two places.
    const doses = [
      dose(TODAY, 'taken'),
      dose(TODAY, 'missed'),
      dose(TODAY, 'scheduled'),
      dose(TODAY, 'snoozed'),
    ];
    const summary = summarise(doses, { timezone: IST, today: TODAY });
    expect(summary.ratePercent).toBe(50); // 1 taken of 2 resolved
    expect(summary.pending).toBe(2);
  });

  it('does not punish a deliberate skip by default', () => {
    const doses = [dose(TODAY, 'taken'), dose(TODAY, 'skipped')];
    expect(summarise(doses, { timezone: IST, today: TODAY }).ratePercent).toBe(100);
  });

  it('counts skips against the rate when a clinical report asks for it', () => {
    const doses = [dose(TODAY, 'taken'), dose(TODAY, 'skipped')];
    const summary = summarise(doses, {
      timezone: IST,
      today: TODAY,
      options: { countSkippedAsMissed: true },
    });
    expect(summary.ratePercent).toBe(50);
  });

  it('reports zero rather than dividing by zero when there is no data', () => {
    expect(summarise([], { timezone: IST, today: TODAY }).ratePercent).toBe(0);
  });
});

describe('streak', () => {
  it('is not broken by a day still in progress', () => {
    // The v3 bug: the streak read 0 every morning until the last dose of the
    // day was taken, so a patient on a 3-day run saw their progress vanish.
    const doses = [
      dose('2026-08-22', 'taken'),
      dose('2026-08-23', 'taken'),
      dose('2026-08-24', 'taken'),
      dose(TODAY, 'taken'),
      dose(TODAY, 'scheduled'), // this evening's dose, not yet due
    ];
    expect(currentStreak(doses, TODAY)).toBe(3);
  });

  it('extends to include today once the day is complete', () => {
    const doses = [
      dose('2026-08-23', 'taken'),
      dose('2026-08-24', 'taken'),
      dose(TODAY, 'taken'),
    ];
    expect(currentStreak(doses, TODAY)).toBe(3);
  });

  it('breaks on a genuine miss', () => {
    const doses = [
      dose('2026-08-22', 'taken'),
      dose('2026-08-23', 'missed'),
      dose('2026-08-24', 'taken'),
      dose(TODAY, 'taken'),
    ];
    expect(currentStreak(doses, TODAY)).toBe(2);
  });

  it('breaks when today has already been missed, even with doses left', () => {
    const doses = [
      dose('2026-08-24', 'taken'),
      dose(TODAY, 'missed'),
      dose(TODAY, 'scheduled'),
    ];
    expect(currentStreak(doses, TODAY)).toBe(0);
  });

  it('stops at a gap in the data instead of counting through it', () => {
    const doses = [
      dose('2026-08-20', 'taken'),
      // 21st–24th missing entirely
      dose(TODAY, 'taken'),
    ];
    expect(currentStreak(doses, TODAY)).toBe(1);
  });

  it('reports a personal best that survives a later miss', () => {
    const doses = [
      dose('2026-08-20', 'taken'),
      dose('2026-08-21', 'taken'),
      dose('2026-08-22', 'taken'),
      dose('2026-08-23', 'missed'),
      dose('2026-08-24', 'taken'),
    ];
    expect(longestStreak(doses)).toBe(3);
  });
});

describe('per-medicine breakdown', () => {
  it('groups by medicine and surfaces the worst first', () => {
    const doses = [
      dose(TODAY, 'taken', { medicineId: 'good', medicineName: 'Aspirin' }),
      dose(TODAY, 'taken', { medicineId: 'good', medicineName: 'Aspirin' }),
      dose(TODAY, 'missed', { medicineId: 'bad', medicineName: 'Warfarin' }),
      dose(TODAY, 'taken', { medicineId: 'bad', medicineName: 'Warfarin' }),
    ];
    const results = byMedicine(doses, { timezone: IST, today: TODAY });
    expect(results.map((r) => r.medicineName)).toEqual(['Warfarin', 'Aspirin']);
    expect(results[0]?.ratePercent).toBe(50);
    expect(results[1]?.ratePercent).toBe(100);
  });
});

describe('daily series', () => {
  it('emits a null rate for days with no data, so charts show a gap', () => {
    const doses = [dose('2026-08-23', 'taken'), dose('2026-08-25', 'missed')];
    const series = dailySeries(doses, '2026-08-23', '2026-08-25');

    expect(series).toHaveLength(3);
    expect(series[0]).toMatchObject({ localDate: '2026-08-23', ratePercent: 100 });
    expect(series[1]).toMatchObject({ localDate: '2026-08-24', total: 0, ratePercent: null });
    expect(series[2]).toMatchObject({ localDate: '2026-08-25', ratePercent: 0 });
  });

  it('returns nothing for an inverted range', () => {
    expect(dailySeries([], '2026-08-25', '2026-08-23')).toEqual([]);
  });
});

describe('insights', () => {
  it('stays silent on a single miss instead of inventing a pattern', () => {
    // v3 would announce "you miss evening doses most often (1 time)".
    const doses = [dose(TODAY, 'taken'), dose(TODAY, 'missed', { localTime: '21:00' })];
    const found = insights(doses, { timezone: IST, today: TODAY });
    expect(found.some((i) => i.kind === 'time_of_day_pattern')).toBe(false);
  });

  it('reports a time-of-day pattern once one window clearly dominates', () => {
    const doses = [
      dose('2026-08-22', 'missed', { localTime: '21:00' }),
      dose('2026-08-23', 'missed', { localTime: '20:00' }),
      dose('2026-08-24', 'missed', { localTime: '21:30' }),
      dose('2026-08-25', 'missed', { localTime: '22:00' }),
      dose('2026-08-22', 'taken', { localTime: '08:00' }),
    ];
    const found = insights(doses, { timezone: IST, today: TODAY });
    const pattern = found.find((i) => i.kind === 'time_of_day_pattern');
    expect(pattern?.message).toContain('evening');
  });

  it('names a medicine the patient is struggling with', () => {
    const doses = [
      dose(TODAY, 'missed', { medicineId: 'bad', medicineName: 'Warfarin' }),
      dose(TODAY, 'missed', { medicineId: 'bad', medicineName: 'Warfarin' }),
      dose(TODAY, 'missed', { medicineId: 'bad', medicineName: 'Warfarin' }),
      dose(TODAY, 'taken', { medicineId: 'bad', medicineName: 'Warfarin' }),
    ];
    const found = insights(doses, { timezone: IST, today: TODAY });
    expect(found.find((i) => i.kind === 'struggling_medicine')?.message).toContain('Warfarin');
  });
});

describe('today split', () => {
  it('separates today’s doses by state and orders them by due time', () => {
    const doses = [
      dose(TODAY, 'taken', { scheduledAt: `${TODAY}T15:30:00.000Z`, localTime: '21:00' }),
      dose(TODAY, 'scheduled', { scheduledAt: `${TODAY}T02:30:00.000Z`, localTime: '08:00' }),
      dose(TODAY, 'missed'),
      dose('2026-08-24', 'taken'), // yesterday, excluded
    ];
    const split = splitToday(doses, IST, TODAY);
    expect(split.upcoming).toHaveLength(1);
    expect(split.taken).toHaveLength(1);
    expect(split.missed).toHaveLength(1);
    expect(split.skipped).toHaveLength(0);
  });
});
