/**
 * Timezone-safe date helpers.
 *
 * v3 mixed three clocks — `toISOString()` (UTC), `new Date().getHours()`
 * (server-local), and the browser's local time — which meant a dose scheduled
 * for 08:00 IST was flagged missed at 14:00 IST on a UTC server. Every function
 * here takes the IANA zone as a *required* argument, so there is no way to ask
 * "what day is it" without saying "where".
 *
 * The only permitted source of "now" is `now()`, which returns a UTC instant.
 */

import { DateTime, IANAZone } from 'luxon';
import type { InstantISO, LocalDate, LocalTime, TimeZone, Weekday } from './types.js';

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class TimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeError';
  }
}

/* ─────────────────────────────── Validation ─────────────────────────────── */

export function isValidTimeZone(zone: string): zone is TimeZone {
  return IANAZone.isValidZone(zone);
}

export function isValidLocalDate(value: string): value is LocalDate {
  if (!LOCAL_DATE_RE.test(value)) return false;
  return DateTime.fromISO(value, { zone: 'utc' }).isValid;
}

export function isValidLocalTime(value: string): value is LocalTime {
  return LOCAL_TIME_RE.test(value);
}

function assertZone(zone: string): asserts zone is TimeZone {
  if (!isValidTimeZone(zone)) throw new TimeError(`Unknown IANA timezone: ${zone}`);
}

function assertLocalDate(value: string): asserts value is LocalDate {
  if (!isValidLocalDate(value)) throw new TimeError(`Invalid local date (want YYYY-MM-DD): ${value}`);
}

function assertLocalTime(value: string): asserts value is LocalTime {
  if (!isValidLocalTime(value)) throw new TimeError(`Invalid local time (want HH:MM, 24h): ${value}`);
}

/* ──────────────────────────────── Now ───────────────────────────────────── */

/** The one sanctioned source of current time. Always a UTC instant. */
export function now(): Date {
  return new Date();
}

export function nowISO(): InstantISO {
  return new Date().toISOString();
}

/* ─────────────────────── Wall clock  ⇄  UTC instant ─────────────────────── */

/**
 * Convert a wall-clock date and time in `zone` to the UTC instant it denotes.
 *
 * DST edge cases, which matter for any zone that observes it (India does not,
 * but caregivers and travelling patients may be elsewhere):
 *
 *  - **Spring forward** — the wall time may not exist (02:30 when the clock
 *    jumps 02:00 → 03:00). Luxon resolves this forward, so 02:30 becomes 03:30
 *    local. The dose still fires once, which is the safe behaviour for medicine.
 *  - **Fall back** — the wall time occurs twice. Luxon picks the first
 *    occurrence (the pre-transition offset), so the dose fires once, earlier.
 *    Firing twice would be worse than firing early.
 */
export function toInstant(localDate: LocalDate, localTime: LocalTime, zone: TimeZone): Date {
  assertLocalDate(localDate);
  assertLocalTime(localTime);
  assertZone(zone);

  const dt = DateTime.fromISO(`${localDate}T${localTime}`, { zone });
  if (!dt.isValid) {
    throw new TimeError(`Cannot resolve ${localDate}T${localTime} in ${zone}: ${dt.invalidReason}`);
  }
  return dt.toUTC().toJSDate();
}

export function toInstantISO(localDate: LocalDate, localTime: LocalTime, zone: TimeZone): InstantISO {
  return toInstant(localDate, localTime, zone).toISOString();
}

/** The calendar date `instant` falls on, as seen in `zone`. */
export function toLocalDate(instant: Date | InstantISO, zone: TimeZone): LocalDate {
  assertZone(zone);
  return fromInstant(instant, zone).toFormat('yyyy-MM-dd');
}

/** The wall-clock time `instant` falls on, as seen in `zone`. */
export function toLocalTime(instant: Date | InstantISO, zone: TimeZone): LocalTime {
  assertZone(zone);
  return fromInstant(instant, zone).toFormat('HH:mm');
}

/** Today's calendar date in `zone`. Replaces every `toISOString().split('T')[0]`. */
export function todayIn(zone: TimeZone, reference: Date = now()): LocalDate {
  return toLocalDate(reference, zone);
}

function fromInstant(instant: Date | InstantISO, zone: TimeZone): DateTime {
  const dt =
    instant instanceof Date
      ? DateTime.fromJSDate(instant, { zone })
      : DateTime.fromISO(instant, { zone });
  if (!dt.isValid) throw new TimeError(`Invalid instant: ${String(instant)}`);
  return dt;
}

/* ──────────────────────── Calendar-date arithmetic ──────────────────────── */

/**
 * Shift a calendar date by whole days. Done in calendar space, not by adding
 * 86 400 000 ms, so a DST transition never skips or repeats a day.
 */
export function addDays(localDate: LocalDate, days: number): LocalDate {
  assertLocalDate(localDate);
  return DateTime.fromISO(localDate, { zone: 'utc' }).plus({ days }).toFormat('yyyy-MM-dd');
}

/** Whole days from `a` to `b`, positive when `b` is later. */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  assertLocalDate(a);
  assertLocalDate(b);
  const start = DateTime.fromISO(a, { zone: 'utc' });
  const end = DateTime.fromISO(b, { zone: 'utc' });
  return Math.round(end.diff(start, 'days').days);
}

/** Every calendar date from `from` to `to`, inclusive. */
export function eachLocalDate(from: LocalDate, to: LocalDate): LocalDate[] {
  assertLocalDate(from);
  assertLocalDate(to);
  const span = daysBetween(from, to);
  if (span < 0) return [];
  // Guard against a bad range fanning out into millions of iterations.
  if (span > 3660) throw new TimeError(`Date range too large: ${span} days (max 3660)`);
  const out: LocalDate[] = [];
  for (let i = 0; i <= span; i++) out.push(addDays(from, i));
  return out;
}

/** ISO weekday for a calendar date: 1 = Monday … 7 = Sunday. */
export function weekdayOf(localDate: LocalDate): Weekday {
  assertLocalDate(localDate);
  return DateTime.fromISO(localDate, { zone: 'utc' }).weekday as Weekday;
}

export function compareLocalDate(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/* ────────────────────────────── Formatting ──────────────────────────────── */

/** `08:00` → `8:00 AM`. Presentation only; never round-trip through this. */
export function formatTime12h(localTime: LocalTime): string {
  assertLocalTime(localTime);
  const [h, m] = localTime.split(':') as [string, string];
  const hour = Number(h);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${suffix}`;
}

/** `2026-08-25` → `25 Aug 2026`, rendered in the given locale. */
export function formatLocalDate(localDate: LocalDate, locale = 'en-IN'): string {
  assertLocalDate(localDate);
  return DateTime.fromISO(localDate, { zone: 'utc' })
    .setLocale(locale)
    .toFormat('dd LLL yyyy');
}

/** Human gap between two instants, e.g. `in 2 h`, `35 min ago`. */
export function formatRelative(instant: Date | InstantISO, reference: Date = now()): string {
  const target = instant instanceof Date ? instant : new Date(instant);
  const deltaMs = target.getTime() - reference.getTime();
  const abs = Math.abs(deltaMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  let value: number;
  let unit: string;
  if (abs < hour) {
    value = Math.max(1, Math.round(abs / minute));
    unit = 'min';
  } else if (abs < day) {
    value = Math.round(abs / hour);
    unit = value === 1 ? 'hour' : 'hours';
  } else {
    value = Math.round(abs / day);
    unit = value === 1 ? 'day' : 'days';
  }
  return deltaMs >= 0 ? `in ${value} ${unit}` : `${value} ${unit} ago`;
}

/** Offset of `zone` from UTC in minutes at `instant`. Useful for diagnostics. */
export function offsetMinutes(zone: TimeZone, instant: Date = now()): number {
  assertZone(zone);
  return DateTime.fromJSDate(instant, { zone }).offset;
}

export function minutesBetween(a: Date | InstantISO, b: Date | InstantISO): number {
  const ta = (a instanceof Date ? a : new Date(a)).getTime();
  const tb = (b instanceof Date ? b : new Date(b)).getTime();
  return (tb - ta) / 60_000;
}

export function addMinutes(instant: Date | InstantISO, minutes: number): Date {
  const base = instant instanceof Date ? instant : new Date(instant);
  return new Date(base.getTime() + minutes * 60_000);
}
