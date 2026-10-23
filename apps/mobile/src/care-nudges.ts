/**
 * Nudges for falling out of care, not just missing a dose.
 *
 * In India the commoner failure is running out and not refilling, or simply
 * stopping — 43% of patients in one national hypertension programme never
 * returned for a first follow-up, and biomarker work found refill access, not
 * memory, was the main barrier. Dose reminders do not touch either. So:
 *
 *  - a "buy more" reminder each morning while a medicine is running low;
 *  - a check-in three days ahead that is pushed back every time the app is
 *    used, so it only ever fires for someone who has stopped opening it.
 *
 * Both are local notifications: they work offline and need no server.
 * Pure: no Expo imports, so `node --test` can exercise it.
 */

import {
  addDays,
  dosesRemainingInStock,
  formatLocalDate,
  isLowStock,
  projectedRunOutDate,
  toInstant,
  todayIn,
  type Medicine,
} from '@medtrack/shared';

export const CHECK_IN_ID = 'care:checkin';
export const REFILL_PREFIX = 'care:refill:';

/** iOS caps pending notifications at 64; dose reminders take most of them. */
export const MAX_REFILL_NUDGES = 3;
export const CHECK_IN_AFTER_DAYS = 3;

const REFILL_TIME = '09:00';
const CHECK_IN_TIME = '10:00';

export interface Nudge {
  identifier: string;
  fireAt: Date;
  title: string;
  body: string;
}

/** The next occurrence of a wall-clock time, at least a minute from now. */
function nextAt(localTime: string, timezone: string, now: Date): Date {
  const today = todayIn(timezone, now);
  const todayAt = toInstant(today, localTime, timezone);
  return todayAt.getTime() > now.getTime() + 60_000
    ? todayAt
    : toInstant(addDays(today, 1), localTime, timezone);
}

export function planCareNudges(medicines: Medicine[], timezone: string, now: Date): Nudge[] {
  const active = medicines.filter((medicine) => !medicine.archivedAt);
  if (active.length === 0) return [];

  const nudges: Nudge[] = active
    .filter((medicine) => isLowStock(medicine) && (dosesRemainingInStock(medicine) ?? 0) > 0)
    .map((medicine) => ({ medicine, runOut: projectedRunOutDate(medicine, now) }))
    .map(({ medicine, runOut }) => {
      const left = dosesRemainingInStock(medicine) ?? 0;
      return { medicine, runOut, left };
    })
    // Run-out is a date, so two medicines can tie; fewer doses left runs out first.
    .sort((a, b) => (a.runOut ?? '9999').localeCompare(b.runOut ?? '9999') || a.left - b.left)
    .slice(0, MAX_REFILL_NUDGES)
    .map(({ medicine, runOut, left }) => {
      return {
        identifier: REFILL_PREFIX + medicine.id,
        fireAt: nextAt(REFILL_TIME, timezone, now),
        title: `Time to buy more ${medicine.name}`,
        body: runOut
          ? `About ${left} ${left === 1 ? 'dose' : 'doses'} left — runs out around ${formatLocalDate(runOut)}.`
          : `About ${left} ${left === 1 ? 'dose' : 'doses'} left.`,
      };
    });

  nudges.push({
    identifier: CHECK_IN_ID,
    fireAt: toInstant(addDays(todayIn(timezone, now), CHECK_IN_AFTER_DAYS), CHECK_IN_TIME, timezone),
    title: 'We have not seen you for a few days',
    body: 'Open MedTrack to check today’s medicines.',
  });

  return nudges;
}
