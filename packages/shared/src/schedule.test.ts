import { describe, expect, it } from 'vitest';
import type { Medicine } from './types.js';
import {
  doseEventFromPlanned,
  doseIdFor,
  dosesRemainingInStock,
  expandMedicine,
  expandMedicines,
  isDosingDay,
  isLowStock,
  nextOccurrences,
  plannedDoseFor,
  projectedRunOutDate,
} from './schedule.js';

const IST = 'Asia/Kolkata';

function makeMedicine(overrides: Partial<Medicine> = {}): Medicine {
  return {
    id: 'med-1',
    userId: 'user-1',
    name: 'Metformin',
    strength: '500 mg',
    form: 'tablet',
    timezone: IST,
    isCritical: false,
    stock: null,
    archivedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    rev: 1,
    schedule: {
      kind: 'daily',
      times: ['08:00', '21:00'],
      startDate: '2026-08-25',
      endDate: null,
    },
    ...overrides,
  };
}

describe('expansion', () => {
  it('produces one dose per time per day', () => {
    const doses = expandMedicine(makeMedicine(), { from: '2026-08-25', to: '2026-08-27' });
    expect(doses).toHaveLength(6);
    expect(doses.map((d) => d.localTime)).toEqual(['08:00', '21:00', '08:00', '21:00', '08:00', '21:00']);
  });

  it('anchors each dose to the correct UTC instant for the zone', () => {
    const [morning, evening] = expandMedicine(makeMedicine(), {
      from: '2026-08-25',
      to: '2026-08-25',
    });
    expect(morning?.scheduledAt).toBe('2026-08-25T02:30:00.000Z'); // 08:00 IST
    expect(evening?.scheduledAt).toBe('2026-08-25T15:30:00.000Z'); // 21:00 IST
  });

  it('sets missedAt from the grace period', () => {
    const [dose] = expandMedicine(makeMedicine({ missedAfterMinutes: 30 }), {
      from: '2026-08-25',
      to: '2026-08-25',
    });
    expect(dose?.missedAt).toBe('2026-08-25T03:00:00.000Z'); // 02:30Z + 30 min
  });

  it('clamps the window to the medicine’s own start and end dates', () => {
    const medicine = makeMedicine({
      schedule: { kind: 'daily', times: ['08:00'], startDate: '2026-08-26', endDate: '2026-08-27' },
    });
    const doses = expandMedicine(medicine, { from: '2026-08-20', to: '2026-09-30' });
    expect(doses.map((d) => d.localDate)).toEqual(['2026-08-26', '2026-08-27']);
  });

  it('produces nothing for archived or as-needed medicines', () => {
    const archived = makeMedicine({ archivedAt: '2026-08-24T00:00:00.000Z' });
    expect(expandMedicine(archived, { from: '2026-08-25', to: '2026-08-27' })).toEqual([]);

    const asNeeded = makeMedicine({
      schedule: { kind: 'as_needed', times: [], startDate: '2026-08-25', endDate: null },
    });
    expect(expandMedicine(asNeeded, { from: '2026-08-25', to: '2026-08-27' })).toEqual([]);
  });

  it('collapses a duplicated time instead of creating two colliding doses', () => {
    const medicine = makeMedicine({
      schedule: { kind: 'daily', times: ['08:00', '08:00'], startDate: '2026-08-25', endDate: null },
    });
    expect(expandMedicine(medicine, { from: '2026-08-25', to: '2026-08-25' })).toHaveLength(1);
  });

  it('merges and orders several medicines by due time', () => {
    const a = makeMedicine({ id: 'a', schedule: { kind: 'daily', times: ['21:00'], startDate: '2026-08-25', endDate: null } });
    const b = makeMedicine({ id: 'b', schedule: { kind: 'daily', times: ['08:00'], startDate: '2026-08-25', endDate: null } });
    const doses = expandMedicines([a, b], { from: '2026-08-25', to: '2026-08-25' });
    expect(doses.map((d) => d.medicineId)).toEqual(['b', 'a']);
  });
});

describe('deterministic identity', () => {
  it('derives a stable id from medicine and instant', () => {
    const at = new Date('2026-08-25T02:30:00.000Z');
    expect(doseIdFor('med-1', at)).toBe('med-1_1787625000');
    expect(doseIdFor('med-1', at.toISOString())).toBe(doseIdFor('med-1', at));
  });

  it('regenerates byte-identical ids, so generation is idempotent', () => {
    // v3 regenerated dose rows on every medicine write and relied on a
    // findOne-then-create check, which duplicated doses whenever the schedule
    // shifted. Identical ids make a second generation a no-op instead.
    const medicine = makeMedicine();
    const first = expandMedicine(medicine, { from: '2026-08-25', to: '2026-08-30' });
    const second = expandMedicine(medicine, { from: '2026-08-25', to: '2026-08-30' });
    expect(first.map((d) => d.id)).toEqual(second.map((d) => d.id));
    expect(new Set(first.map((d) => d.id)).size).toBe(first.length);
  });

  it('gives overlapping windows the same ids for the shared days', () => {
    const medicine = makeMedicine();
    const early = expandMedicine(medicine, { from: '2026-08-25', to: '2026-08-27' });
    const late = expandMedicine(medicine, { from: '2026-08-26', to: '2026-08-28' });
    const overlapEarly = early.filter((d) => d.localDate === '2026-08-26').map((d) => d.id);
    const overlapLate = late.filter((d) => d.localDate === '2026-08-26').map((d) => d.id);
    expect(overlapEarly).toEqual(overlapLate);
  });
});

describe('recurrence rules', () => {
  it('handles every-other-day intervals', () => {
    const medicine = makeMedicine({
      schedule: { kind: 'interval_days', times: ['08:00'], startDate: '2026-08-25', endDate: null, intervalDays: 2 },
    });
    const days = expandMedicine(medicine, { from: '2026-08-25', to: '2026-08-30' }).map((d) => d.localDate);
    expect(days).toEqual(['2026-08-25', '2026-08-27', '2026-08-29']);
  });

  it('handles specific weekdays', () => {
    const medicine = makeMedicine({
      schedule: { kind: 'days_of_week', times: ['08:00'], startDate: '2026-08-24', endDate: null, weekdays: [1, 4] },
    });
    const days = expandMedicine(medicine, { from: '2026-08-24', to: '2026-09-01' }).map((d) => d.localDate);
    // Mondays and Thursdays only.
    expect(days).toEqual(['2026-08-24', '2026-08-27', '2026-08-31']);
  });

  it('handles on/off cycles', () => {
    const medicine = makeMedicine({
      schedule: { kind: 'cyclic', times: ['08:00'], startDate: '2026-08-25', endDate: null, cycleOnDays: 3, cycleOffDays: 2 },
    });
    const days = expandMedicine(medicine, { from: '2026-08-25', to: '2026-09-03' }).map((d) => d.localDate);
    expect(days).toEqual([
      '2026-08-25', '2026-08-26', '2026-08-27', // on
      '2026-08-30', '2026-08-31', '2026-09-01', // on again after 2 off
    ]);
  });

  it('answers isDosingDay directly', () => {
    const daily = makeMedicine().schedule;
    expect(isDosingDay(daily, '2026-08-25')).toBe(true);
    expect(isDosingDay(daily, '2026-08-24')).toBe(false); // before start
  });
});

describe('next occurrences', () => {
  it('returns only doses strictly after the reference instant', () => {
    const medicine = makeMedicine();
    const after = new Date('2026-08-25T02:30:00.000Z'); // exactly the 08:00 IST dose
    const upcoming = nextOccurrences(medicine, 3, after);
    expect(upcoming).toHaveLength(3);
    expect(upcoming[0]?.localTime).toBe('21:00');
    expect(upcoming[0]?.localDate).toBe('2026-08-25');
    expect(upcoming[1]?.localDate).toBe('2026-08-26');
  });

  it('terminates on a sparse schedule instead of scanning forever', () => {
    const yearly = makeMedicine({
      schedule: { kind: 'interval_days', times: ['08:00'], startDate: '2026-08-25', endDate: null, intervalDays: 365 },
    });
    const upcoming = nextOccurrences(yearly, 5, new Date('2026-08-25T12:00:00.000Z'));
    expect(upcoming.length).toBeLessThanOrEqual(2);
  });

  it('stops at the end of a finite course', () => {
    const course = makeMedicine({
      schedule: { kind: 'daily', times: ['08:00'], startDate: '2026-08-25', endDate: '2026-08-27' },
    });
    const upcoming = nextOccurrences(course, 10, new Date('2026-08-25T00:00:00.000Z'));
    expect(upcoming).toHaveLength(3);
  });
});

describe('stock forecasting', () => {
  const stocked = makeMedicine({
    schedule: { kind: 'daily', times: ['08:00', '21:00'], startDate: '2026-08-25', endDate: null },
    stock: { unitsRemaining: 10, unitsPerDose: 1, lowThreshold: 4, lastRefillAt: null, lastRefillUnits: null },
  });

  it('projects the run-out date from the real schedule', () => {
    // 10 units, 2 doses a day starting on the 25th, so the supply covers
    // through the 29th and the last coverable dose is on the 29th.
    expect(projectedRunOutDate(stocked, new Date('2026-08-25T00:00:00.000Z'))).toBe('2026-08-29');
  });

  it('counts remaining doses accounting for multi-unit doses', () => {
    expect(dosesRemainingInStock(stocked)).toBe(10);
    const twoPerDose = makeMedicine({
      stock: { unitsRemaining: 10, unitsPerDose: 2, lowThreshold: 4, lastRefillAt: null, lastRefillUnits: null },
    });
    expect(dosesRemainingInStock(twoPerDose)).toBe(5);
  });

  it('flags low stock at or below the threshold', () => {
    expect(isLowStock(stocked)).toBe(false);
    const low = makeMedicine({
      stock: { unitsRemaining: 4, unitsPerDose: 1, lowThreshold: 4, lastRefillAt: null, lastRefillUnits: null },
    });
    expect(isLowStock(low)).toBe(true);
  });

  it('returns null when the medicine has no stock tracking', () => {
    expect(projectedRunOutDate(makeMedicine())).toBeNull();
    expect(dosesRemainingInStock(makeMedicine())).toBeNull();
    expect(isLowStock(makeMedicine())).toBe(false);
  });
});

describe('single-dose lookup', () => {
  const medicine = makeMedicine();
  const [first] = expandMedicine(medicine, { from: '2026-08-26', to: '2026-08-26' });

  it('resolves a real occurrence from its id alone', () => {
    const planned = plannedDoseFor(medicine, first!.id);
    expect(planned).toEqual(first);
  });

  it('rejects an id at a time the schedule never doses', () => {
    // 08:30 IST on a medicine taken at 08:00 and 21:00.
    const fake = doseIdFor(medicine.id, '2026-08-26T03:00:00.000Z');
    expect(plannedDoseFor(medicine, fake)).toBeNull();
  });

  it('rejects an id that belongs to a different medicine', () => {
    const other = makeMedicine({ id: 'med-2' });
    expect(plannedDoseFor(other, first!.id)).toBeNull();
  });

  it('rejects a day outside the course', () => {
    const before = doseIdFor(medicine.id, '2026-08-20T02:30:00.000Z');
    expect(plannedDoseFor(medicine, before)).toBeNull();
  });

  it('rejects malformed ids without throwing', () => {
    expect(plannedDoseFor(medicine, 'nonsense')).toBeNull();
    expect(plannedDoseFor(medicine, `${medicine.id}_abc`)).toBeNull();
  });

  it('builds an unresolved dose record from a planned occurrence', () => {
    const event = doseEventFromPlanned(first!, '2026-08-26T00:00:00.000Z');
    expect(event).toMatchObject({ id: first!.id, status: 'scheduled', snoozeCount: 0, isAdHoc: false, rev: 1 });
  });
});

describe('run-out forecast matches walking every dose', () => {
  // The old implementation, kept as a reference: expand a whole year and
  // consume dose by dose.
  function reference(medicine: Medicine, from: Date): string | null {
    const stock = medicine.stock!;
    const start = from.toISOString().slice(0, 10);
    const doses = expandMedicine(medicine, { from: start, to: '2027-12-31' }).filter(
      (d) => d.scheduledAt >= from.toISOString(),
    );
    let remaining = stock.unitsRemaining;
    for (const d of doses) {
      remaining -= stock.unitsPerDose;
      if (remaining < stock.unitsPerDose) return d.localDate;
    }
    return null;
  }

  const from = new Date('2026-08-25T00:00:00.000Z');
  const schedules: Medicine['schedule'][] = [
    { kind: 'daily', times: ['08:00', '21:00'], startDate: '2026-08-25', endDate: null },
    { kind: 'interval_days', times: ['09:00'], startDate: '2026-08-25', intervalDays: 3, endDate: null },
    { kind: 'days_of_week', times: ['07:30'], startDate: '2026-08-25', weekdays: [1, 3, 5], endDate: null },
    { kind: 'cyclic', times: ['20:00'], startDate: '2026-08-25', cycleOnDays: 21, cycleOffDays: 7, endDate: null },
  ];

  for (const schedule of schedules) {
    for (const [units, perDose] of [[1, 1], [2, 1], [3, 2], [30, 1], [31, 2], [90, 3]] as const) {
      it(`${schedule.kind}, ${units} units at ${perDose} per dose`, () => {
        const medicine = makeMedicine({
          schedule,
          stock: { unitsRemaining: units, unitsPerDose: perDose, lowThreshold: 5 },
        });
        expect(projectedRunOutDate(medicine, from)).toBe(reference(medicine, from));
      });
    }
  }
});
