/**
 * Dose scheduling engine.
 *
 * Expands a medicine's recurrence rule into concrete dose occurrences. This is
 * the single implementation used by the API (to materialise dose rows), the
 * mobile app (to schedule local notifications that fire offline), and the web
 * app (to render an agenda) — so all three can never disagree about when a
 * dose is due.
 *
 * Two properties matter most:
 *
 *  - **Deterministic IDs.** A dose's id is derived from `medicineId` and the
 *    exact instant. Regenerating the same window yields byte-identical ids, so
 *    generation is idempotent and two offline devices creating "the same" dose
 *    converge instead of duplicating. In Mongo this id is the primary key, so
 *    the database enforces it rather than application code.
 *  - **Instants, not wall-clock strings.** Occurrences carry a real UTC
 *    instant. Comparing "is this overdue" is then plain arithmetic, with no
 *    dependence on the server's local timezone.
 */

import type {
  DoseEvent,
  DoseSchedule,
  InstantISO,
  LocalDate,
  LocalTime,
  Medicine,
  TimeZone,
} from './types.js';
import {
  TimeError,
  addDays,
  compareLocalDate,
  daysBetween,
  eachLocalDate,
  toInstant,
  todayIn,
  weekdayOf,
  now,
} from './time.js';

/** Default grace period before a due dose is treated as missed. */
export const DEFAULT_MISSED_AFTER_MINUTES = 60;

/** How long after the scheduled time a patient may still log a dose as taken. */
export const LATE_LOG_WINDOW_HOURS = 24;

/** Upper bound on snoozes per dose, so a dose cannot be deferred indefinitely. */
export const MAX_SNOOZES_PER_DOSE = 4;

/** A dose occurrence produced by expanding a schedule. Not yet persisted. */
export interface PlannedDose {
  /** Deterministic id: stable across regeneration, devices, and processes. */
  id: string;
  medicineId: string;
  userId: string;
  /** Authoritative UTC instant this dose is due. */
  scheduledAt: InstantISO;
  /** Wall-clock rendering of `scheduledAt` in `timezone`. */
  localDate: LocalDate;
  localTime: LocalTime;
  timezone: TimeZone;
  /** Instant after which this dose counts as missed. */
  missedAt: InstantISO;
  medicineName: string;
  medicineStrength: string;
  isCritical: boolean;
}

/**
 * Deterministic dose identifier.
 *
 * `${medicineId}_${epochSeconds}` is unique by construction — one medicine
 * cannot have two doses at the same instant — so no hashing is needed and the
 * uniqueness guarantee lives in the primary key rather than in a nullable
 * secondary index that application code has to remember to check.
 */
export function doseIdFor(medicineId: string, scheduledAt: Date | InstantISO): string {
  const instant = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  const epochSeconds = Math.floor(instant.getTime() / 1000);
  return `${medicineId}_${epochSeconds}`;
}

/* ─────────────────────────── Recurrence rules ───────────────────────────── */

/** Whether the schedule places any dose on `localDate`, ignoring time of day. */
export function isDosingDay(schedule: DoseSchedule, localDate: LocalDate): boolean {
  if (schedule.kind === 'as_needed') return false;
  if (compareLocalDate(localDate, schedule.startDate) < 0) return false;
  if (schedule.endDate && compareLocalDate(localDate, schedule.endDate) > 0) return false;

  switch (schedule.kind) {
    case 'daily':
      return true;

    case 'interval_days': {
      const interval = schedule.intervalDays ?? 1;
      if (interval < 1) throw new TimeError(`intervalDays must be >= 1, got ${interval}`);
      return daysBetween(schedule.startDate, localDate) % interval === 0;
    }

    case 'days_of_week': {
      const weekdays = schedule.weekdays ?? [];
      if (weekdays.length === 0) return false;
      return weekdays.includes(weekdayOf(localDate));
    }

    case 'cyclic': {
      const on = schedule.cycleOnDays ?? 0;
      const off = schedule.cycleOffDays ?? 0;
      if (on < 1) throw new TimeError(`cycleOnDays must be >= 1, got ${on}`);
      if (off < 0) throw new TimeError(`cycleOffDays must be >= 0, got ${off}`);
      const cycleLength = on + off;
      const position = daysBetween(schedule.startDate, localDate) % cycleLength;
      return position < on;
    }

    default: {
      const exhaustive: never = schedule.kind;
      throw new TimeError(`Unhandled schedule kind: ${String(exhaustive)}`);
    }
  }
}

/* ──────────────────────────── Expansion ─────────────────────────────────── */

export interface ExpandOptions {
  /** First calendar date to expand, in the medicine's timezone. Inclusive. */
  from: LocalDate;
  /** Last calendar date to expand. Inclusive. */
  to: LocalDate;
}

/**
 * Expand a medicine into every dose occurrence in the window.
 *
 * Archived medicines and `as_needed` medicines produce nothing — the former
 * because they are no longer active, the latter because their doses only exist
 * when the patient logs one.
 */
export function expandMedicine(medicine: Medicine, options: ExpandOptions): PlannedDose[] {
  if (medicine.archivedAt) return [];
  if (medicine.schedule.kind === 'as_needed') return [];
  if (medicine.schedule.times.length === 0) return [];

  const { schedule, timezone } = medicine;
  const graceMinutes = medicine.missedAfterMinutes ?? DEFAULT_MISSED_AFTER_MINUTES;

  // Clamp the requested window to the medicine's own active range before
  // iterating, so a 10-year request against a 3-day course is cheap.
  const from = compareLocalDate(options.from, schedule.startDate) < 0
    ? schedule.startDate
    : options.from;
  const to = schedule.endDate && compareLocalDate(options.to, schedule.endDate) > 0
    ? schedule.endDate
    : options.to;
  if (compareLocalDate(from, to) > 0) return [];

  // De-duplicate the configured times: a user entering 08:00 twice should not
  // produce two doses that collide on the same deterministic id.
  const times = [...new Set(schedule.times)].sort();

  const planned: PlannedDose[] = [];
  for (const localDate of eachLocalDate(from, to)) {
    if (!isDosingDay(schedule, localDate)) continue;

    for (const localTime of times) {
      const scheduledAt = toInstant(localDate, localTime, timezone);
      const missedAt = new Date(scheduledAt.getTime() + graceMinutes * 60_000);

      planned.push({
        id: doseIdFor(medicine.id, scheduledAt),
        medicineId: medicine.id,
        userId: medicine.userId,
        scheduledAt: scheduledAt.toISOString(),
        localDate,
        localTime,
        timezone,
        missedAt: missedAt.toISOString(),
        medicineName: medicine.name,
        medicineStrength: medicine.strength,
        isCritical: medicine.isCritical,
      });
    }
  }

  // A DST spring-forward can map two distinct wall times onto one instant.
  // Collapse those so the patient is reminded once, not twice.
  return dedupeById(planned);
}

/** Expand several medicines at once, ordered by when each dose is due. */
export function expandMedicines(medicines: Medicine[], options: ExpandOptions): PlannedDose[] {
  const all = medicines.flatMap((medicine) => expandMedicine(medicine, options));
  all.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return all;
}

function dedupeById(doses: PlannedDose[]): PlannedDose[] {
  const seen = new Map<string, PlannedDose>();
  for (const dose of doses) {
    if (!seen.has(dose.id)) seen.set(dose.id, dose);
  }
  return [...seen.values()];
}

/* ──────────────────────── Forward-looking queries ───────────────────────── */

/**
 * The next `limit` occurrences strictly after `after`.
 *
 * The mobile app uses this to register local notifications, which is what makes
 * reminders fire with the app closed and the device offline. It walks forward a
 * bounded number of days rather than expanding an open-ended range, so a
 * medicine dosed once a year still terminates.
 */
export function nextOccurrences(
  medicine: Medicine,
  limit: number,
  after: Date = now(),
  maxLookaheadDays = 400,
): PlannedDose[] {
  if (limit <= 0) return [];
  if (medicine.schedule.kind === 'as_needed') return [];

  const startDate = todayIn(medicine.timezone, after);
  const endDate = addDays(startDate, maxLookaheadDays);
  const clampedEnd = medicine.schedule.endDate &&
    compareLocalDate(medicine.schedule.endDate, endDate) < 0
      ? medicine.schedule.endDate
      : endDate;

  const afterISO = after.toISOString();
  const upcoming: PlannedDose[] = [];

  // Expand a month at a time so the common case (a daily medicine) allocates
  // ~30 candidates instead of 400 days' worth.
  let windowStart = startDate;
  while (compareLocalDate(windowStart, clampedEnd) <= 0 && upcoming.length < limit) {
    const windowEnd = compareLocalDate(addDays(windowStart, 30), clampedEnd) > 0
      ? clampedEnd
      : addDays(windowStart, 30);

    const batch = expandMedicine(medicine, { from: windowStart, to: windowEnd })
      .filter((dose) => dose.scheduledAt > afterISO);
    upcoming.push(...batch);

    windowStart = addDays(windowEnd, 1);
  }

  upcoming.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return upcoming.slice(0, limit);
}

/** Next occurrences across a whole regimen, merged and ordered. */
export function nextOccurrencesForAll(
  medicines: Medicine[],
  limit: number,
  after: Date = now(),
): PlannedDose[] {
  const merged = medicines.flatMap((medicine) => nextOccurrences(medicine, limit, after));
  merged.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return merged.slice(0, limit);
}

/* ────────────────────────── Single-dose lookup ──────────────────────────── */

/**
 * The planned dose a deterministic id refers to, or null when the id does not
 * name a real occurrence of this medicine.
 *
 * Lets either side materialise one dose on demand — a reminder actioned for a
 * dose the phone has not synced yet, or a "taken" arriving at the server for a
 * dose it has not generated — without trusting the caller's claim that the
 * occurrence exists. Before this, both cases silently dropped the record.
 */
export function plannedDoseFor(medicine: Medicine, doseId: string): PlannedDose | null {
  const separator = doseId.lastIndexOf('_');
  if (separator <= 0 || doseId.slice(0, separator) !== medicine.id) return null;

  const epochSeconds = Number(doseId.slice(separator + 1));
  if (!Number.isSafeInteger(epochSeconds)) return null;

  const localDate = todayIn(medicine.timezone, new Date(epochSeconds * 1000));
  return (
    expandMedicine(medicine, { from: localDate, to: localDate }).find((dose) => dose.id === doseId) ??
    null
  );
}

/** A freshly generated, unresolved dose record for a planned occurrence. */
export function doseEventFromPlanned(planned: PlannedDose, at: InstantISO): DoseEvent {
  return {
    id: planned.id,
    userId: planned.userId,
    medicineId: planned.medicineId,
    scheduledAt: planned.scheduledAt,
    localDate: planned.localDate,
    localTime: planned.localTime,
    timezone: planned.timezone,
    status: 'scheduled',
    takenAt: null,
    snoozedUntil: null,
    snoozeCount: 0,
    skipReason: null,
    medicineName: planned.medicineName,
    medicineStrength: planned.medicineStrength,
    isCritical: planned.isCritical,
    isAdHoc: false,
    createdAt: at,
    updatedAt: at,
    rev: 1,
  };
}

/* ──────────────────────────── Stock forecasting ─────────────────────────── */

/**
 * Calendar date the supply is projected to run out, or null when the medicine
 * has no stock tracking, no schedule, or already has none left.
 *
 * Drives the low-stock alert, which is the difference between "you ran out
 * yesterday" and "order a refill this week".
 */
export function projectedRunOutDate(
  medicine: Medicine,
  from: Date = now(),
  horizonDays = 365,
): LocalDate | null {
  const stock = medicine.stock;
  if (!stock || stock.unitsPerDose <= 0) return null;
  if (stock.unitsRemaining <= 0) return null;
  if (medicine.schedule.kind === 'as_needed') return null;

  const startDate = todayIn(medicine.timezone, from);
  const doses = expandMedicine(medicine, {
    from: startDate,
    to: addDays(startDate, horizonDays),
  }).filter((dose) => dose.scheduledAt >= from.toISOString());

  let remaining = stock.unitsRemaining;
  for (const dose of doses) {
    remaining -= stock.unitsPerDose;
    if (remaining < stock.unitsPerDose) return dose.localDate;
  }
  return null;
}

/** Doses still coverable by the units on hand. */
export function dosesRemainingInStock(medicine: Medicine): number | null {
  const stock = medicine.stock;
  if (!stock || stock.unitsPerDose <= 0) return null;
  return Math.floor(stock.unitsRemaining / stock.unitsPerDose);
}

export function isLowStock(medicine: Medicine): boolean {
  const stock = medicine.stock;
  if (!stock) return false;
  return stock.unitsRemaining <= stock.lowThreshold;
}
