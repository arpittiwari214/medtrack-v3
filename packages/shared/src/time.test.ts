import { describe, expect, it } from 'vitest';
import {
  TimeError,
  addDays,
  daysBetween,
  eachLocalDate,
  formatTime12h,
  isValidTimeZone,
  minutesBetween,
  toInstant,
  toLocalDate,
  toLocalTime,
  todayIn,
  weekdayOf,
} from './time.js';

const IST = 'Asia/Kolkata';

describe('wall clock to UTC instant', () => {
  it('resolves an IST wall time to the correct UTC instant', () => {
    // 08:00 IST is 02:30 UTC. v3 compared "08:00" against a UTC clock and so
    // believed the dose was due six hours later than it was.
    expect(toInstant('2026-08-25', '08:00', IST).toISOString()).toBe('2026-08-25T02:30:00.000Z');
  });

  it('round-trips an instant back to the same wall clock', () => {
    const instant = toInstant('2026-08-25', '21:15', IST);
    expect(toLocalDate(instant, IST)).toBe('2026-08-25');
    expect(toLocalTime(instant, IST)).toBe('21:15');
  });

  it('gives a different calendar date for the same instant in different zones', () => {
    const instant = toInstant('2026-08-25', '08:00', IST); // 02:30Z
    expect(toLocalDate(instant, IST)).toBe('2026-08-25');
    expect(toLocalDate(instant, 'Pacific/Auckland')).toBe('2026-08-25');
    expect(toLocalDate(instant, 'America/Los_Angeles')).toBe('2026-08-24');
  });

  it('rejects an unknown timezone rather than silently falling back to UTC', () => {
    expect(() => toInstant('2026-08-25', '08:00', 'Mars/Olympus')).toThrow(TimeError);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone(IST)).toBe(true);
  });

  it('rejects malformed dates and times instead of coercing them', () => {
    expect(() => toInstant('25-08-2026', '08:00', IST)).toThrow(TimeError);
    expect(() => toInstant('2026-08-25', '8:00', IST)).toThrow(TimeError);
    expect(() => toInstant('2026-08-25', '25:00', IST)).toThrow(TimeError);
    expect(() => toInstant('2026-02-30', '08:00', IST)).toThrow(TimeError);
  });
});

describe('todayIn', () => {
  it('uses the zone, not the process timezone', () => {
    // 20:00Z on the 25th is already 01:30 on the 26th in India. v3's
    // toISOString().split('T')[0] would have said the 25th for an IST user.
    const instant = new Date('2026-08-25T20:00:00.000Z');
    expect(todayIn(IST, instant)).toBe('2026-08-26');
    expect(todayIn('UTC', instant)).toBe('2026-08-25');
    expect(todayIn('America/New_York', instant)).toBe('2026-08-25');
  });
});

describe('daylight saving transitions', () => {
  it('resolves a non-existent spring-forward wall time exactly once, moving forward', () => {
    // 2026-03-08, clocks jump 02:00 to 03:00 in New York, so 02:30 never happens.
    const instant = toInstant('2026-03-08', '02:30', 'America/New_York');
    expect(toLocalTime(instant, 'America/New_York')).toBe('03:30');
    expect(toLocalDate(instant, 'America/New_York')).toBe('2026-03-08');
  });

  it('resolves an ambiguous fall-back wall time to a single instant', () => {
    // 2026-11-01, 01:30 occurs twice. Firing once early beats firing twice.
    const instant = toInstant('2026-11-01', '01:30', 'America/New_York');
    expect(toLocalTime(instant, 'America/New_York')).toBe('01:30');
  });

  it('keeps a daily 08:00 dose at 08:00 local across a DST boundary', () => {
    const before = toInstant('2026-03-07', '08:00', 'America/New_York');
    const after = toInstant('2026-03-09', '08:00', 'America/New_York');
    expect(toLocalTime(before, 'America/New_York')).toBe('08:00');
    expect(toLocalTime(after, 'America/New_York')).toBe('08:00');
    // 48 wall-clock hours, but only 47 real hours because an hour vanished.
    expect(minutesBetween(before, after)).toBe(47 * 60);
  });
});

describe('calendar arithmetic', () => {
  it('adds days in calendar space, across month and year boundaries', () => {
    expect(addDays('2026-08-25', 1)).toBe('2026-08-26');
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29'); // leap year
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-08-25', '2026-08-28')).toBe(3);
    expect(daysBetween('2026-08-28', '2026-08-25')).toBe(-3);
    expect(daysBetween('2026-08-25', '2026-08-25')).toBe(0);
  });

  it('enumerates an inclusive range and refuses an absurd one', () => {
    expect(eachLocalDate('2026-08-25', '2026-08-27')).toEqual([
      '2026-08-25', '2026-08-26', '2026-08-27',
    ]);
    expect(eachLocalDate('2026-08-27', '2026-08-25')).toEqual([]);
    expect(() => eachLocalDate('2000-01-01', '2026-01-01')).toThrow(TimeError);
  });

  it('reports ISO weekdays', () => {
    expect(weekdayOf('2026-08-24')).toBe(1); // Monday
    expect(weekdayOf('2026-08-30')).toBe(7); // Sunday
  });
});

describe('formatting', () => {
  it('renders 24h times for humans', () => {
    expect(formatTime12h('00:00')).toBe('12:00 AM');
    expect(formatTime12h('08:05')).toBe('8:05 AM');
    expect(formatTime12h('12:00')).toBe('12:00 PM');
    expect(formatTime12h('21:30')).toBe('9:30 PM');
  });
});
