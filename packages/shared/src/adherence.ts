/**
 * Adherence reporting.
 *
 * v3 implemented this twice — `Dashboard.jsx` and `AdherenceAnalytics.jsx` each
 * had their own `calcRate` and `calcStreak`, which is how the two screens could
 * disagree. There is one implementation here, used by the API, the web app and
 * the mobile app.
 */

import type {
  AdherenceSummary,
  DailyAdherencePoint,
  DoseEvent,
  DoseStatus,
  LocalDate,
  MedicineAdherence,
  TimeZone,
} from './types.js';
import { addDays, compareLocalDate, eachLocalDate, todayIn, now } from './time.js';

/** Doses that count towards a rate. Pending doses are excluded, not counted as failures. */
const COUNTS_TOWARDS_RATE: ReadonlySet<DoseStatus> = new Set<DoseStatus>([
  'taken',
  'missed',
  'skipped',
]);

/**
 * Whether a deliberate skip counts against adherence.
 *
 * Default is `false`: a patient who skips on medical advice ("stop the course,
 * you've recovered") should not be punished for it. Callers producing a
 * clinical report can flip this on.
 */
export interface AdherenceOptions {
  countSkippedAsMissed?: boolean;
}

interface Tally {
  taken: number;
  missed: number;
  skipped: number;
  pending: number;
}

function tally(doses: readonly DoseEvent[]): Tally {
  const counts: Tally = { taken: 0, missed: 0, skipped: 0, pending: 0 };
  for (const dose of doses) {
    switch (dose.status) {
      case 'taken': counts.taken++; break;
      case 'missed': counts.missed++; break;
      case 'skipped': counts.skipped++; break;
      case 'scheduled':
      case 'snoozed': counts.pending++; break;
    }
  }
  return counts;
}

function rateFrom(counts: Tally, options: AdherenceOptions): number {
  const denominator = options.countSkippedAsMissed
    ? counts.taken + counts.missed + counts.skipped
    : counts.taken + counts.missed;
  if (denominator === 0) return 0;
  return Math.round((counts.taken / denominator) * 100);
}

/* ──────────────────────────────── Summary ───────────────────────────────── */

export interface SummariseContext {
  timezone: TimeZone;
  /** Defaults to today in `timezone`. Injectable so tests are not time-dependent. */
  today?: LocalDate;
  options?: AdherenceOptions;
}

export function summarise(doses: readonly DoseEvent[], context: SummariseContext): AdherenceSummary {
  const options = context.options ?? {};
  const today = context.today ?? todayIn(context.timezone);
  const counts = tally(doses);

  return {
    ratePercent: rateFrom(counts, options),
    taken: counts.taken,
    missed: counts.missed,
    skipped: counts.skipped,
    pending: counts.pending,
    streakDays: currentStreak(doses, today),
  };
}

/* ──────────────────────────────── Streak ────────────────────────────────── */

/**
 * Consecutive fully-adherent days ending today.
 *
 * v3 broke the streak the moment today had an unresolved dose, so a patient on
 * a 20-day run saw "0" every morning until their last dose of the day. Here a
 * day still in progress is *neutral*: it extends the streak once complete, and
 * is skipped over otherwise, so the number only ever falls on a real miss.
 *
 * A day with no scheduled doses is also neutral — it neither extends nor breaks
 * the run.
 */
export function currentStreak(doses: readonly DoseEvent[], today: LocalDate): number {
  const byDate = new Map<LocalDate, Tally>();
  for (const dose of doses) {
    const existing = byDate.get(dose.localDate) ?? { taken: 0, missed: 0, skipped: 0, pending: 0 };
    switch (dose.status) {
      case 'taken': existing.taken++; break;
      case 'missed': existing.missed++; break;
      case 'skipped': existing.skipped++; break;
      case 'scheduled':
      case 'snoozed': existing.pending++; break;
    }
    byDate.set(dose.localDate, existing);
  }

  let streak = 0;
  let cursor = today;

  // Today is allowed to be incomplete without breaking the run.
  const todayCounts = byDate.get(today);
  if (todayCounts && todayCounts.pending > 0 && todayCounts.missed === 0) {
    cursor = addDays(today, -1);
  }

  // Bounded so a corrupt date can't spin forever.
  for (let guard = 0; guard < 3660; guard++) {
    const counts = byDate.get(cursor);
    if (!counts) break;                       // no data — the run ends here
    if (counts.missed > 0) break;             // a real miss breaks it
    if (counts.pending > 0) break;            // an older unresolved day breaks it
    if (counts.taken > 0) streak++;           // a day with doses, all handled
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/**
 * The longest run of fully-adherent days in the data, for a "personal best"
 * figure that does not collapse the moment a single dose is missed.
 */
export function longestStreak(doses: readonly DoseEvent[]): number {
  const dates = [...new Set(doses.map((d) => d.localDate))].sort();
  if (dates.length === 0) return 0;

  const missedDates = new Set(
    doses.filter((d) => d.status === 'missed' || d.status === 'scheduled' || d.status === 'snoozed')
      .map((d) => d.localDate),
  );

  let best = 0;
  let run = 0;
  let previous: LocalDate | null = null;

  for (const date of dates) {
    const contiguous = previous !== null && addDays(previous, 1) === date;
    if (missedDates.has(date)) {
      run = 0;
    } else {
      run = contiguous ? run + 1 : 1;
      if (run > best) best = run;
    }
    previous = date;
  }
  return best;
}

/* ───────────────────────────── Per medicine ─────────────────────────────── */

export function byMedicine(
  doses: readonly DoseEvent[],
  context: SummariseContext,
): MedicineAdherence[] {
  const options = context.options ?? {};
  const today = context.today ?? todayIn(context.timezone);

  const grouped = new Map<string, DoseEvent[]>();
  for (const dose of doses) {
    const bucket = grouped.get(dose.medicineId);
    if (bucket) bucket.push(dose);
    else grouped.set(dose.medicineId, [dose]);
  }

  const results: MedicineAdherence[] = [];
  for (const [medicineId, group] of grouped) {
    const counts = tally(group);
    results.push({
      medicineId,
      medicineName: group[0]?.medicineName ?? 'Unknown',
      ratePercent: rateFrom(counts, options),
      taken: counts.taken,
      missed: counts.missed,
      skipped: counts.skipped,
      pending: counts.pending,
      streakDays: currentStreak(group, today),
    });
  }

  // Worst adherence first — that is what needs the patient's attention.
  results.sort((a, b) => a.ratePercent - b.ratePercent);
  return results;
}

/* ────────────────────────────── Daily series ────────────────────────────── */

/**
 * One point per calendar day, including days with no doses, so a chart shows a
 * real gap rather than silently compressing the x-axis.
 */
export function dailySeries(
  doses: readonly DoseEvent[],
  from: LocalDate,
  to: LocalDate,
  options: AdherenceOptions = {},
): DailyAdherencePoint[] {
  if (compareLocalDate(from, to) > 0) return [];

  const byDate = new Map<LocalDate, Tally>();
  for (const dose of doses) {
    if (compareLocalDate(dose.localDate, from) < 0) continue;
    if (compareLocalDate(dose.localDate, to) > 0) continue;
    const existing = byDate.get(dose.localDate) ?? { taken: 0, missed: 0, skipped: 0, pending: 0 };
    switch (dose.status) {
      case 'taken': existing.taken++; break;
      case 'missed': existing.missed++; break;
      case 'skipped': existing.skipped++; break;
      case 'scheduled':
      case 'snoozed': existing.pending++; break;
    }
    byDate.set(dose.localDate, existing);
  }

  return eachLocalDate(from, to).map((localDate) => {
    const counts = byDate.get(localDate);
    if (!counts) return { localDate, taken: 0, total: 0, ratePercent: null };

    const total = options.countSkippedAsMissed
      ? counts.taken + counts.missed + counts.skipped
      : counts.taken + counts.missed;

    return {
      localDate,
      taken: counts.taken,
      total,
      ratePercent: total === 0 ? null : Math.round((counts.taken / total) * 100),
    };
  });
}

/* ──────────────────────────────── Insights ──────────────────────────────── */

export type InsightKind =
  | 'time_of_day_pattern'
  | 'weekday_pattern'
  | 'struggling_medicine'
  | 'improving'
  | 'declining'
  | 'strong_adherence';

export interface Insight {
  kind: InsightKind;
  /** Sentence shown to the patient. */
  message: string;
  /** Higher is more worth surfacing. Callers usually show the top one or two. */
  weight: number;
  medicineId?: string;
}

/** Minimum missed doses before a "pattern" is claimed, so noise isn't dressed up as insight. */
const MIN_SAMPLE_FOR_PATTERN = 3;

/**
 * Derive observations worth showing the patient.
 *
 * Deliberately conservative: v3 would announce "you miss evening doses most
 * often" off a single miss. Nothing here fires below `MIN_SAMPLE_FOR_PATTERN`,
 * and each claim states the count it rests on.
 */
export function insights(
  doses: readonly DoseEvent[],
  context: SummariseContext,
): Insight[] {
  const found: Insight[] = [];
  const missed = doses.filter((d) => d.status === 'missed');

  if (missed.length >= MIN_SAMPLE_FOR_PATTERN) {
    const buckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    for (const dose of missed) {
      const hour = Number(dose.localTime.slice(0, 2));
      if (hour < 12) buckets.morning++;
      else if (hour < 17) buckets.afternoon++;
      else if (hour < 22) buckets.evening++;
      else buckets.night++;
    }

    const entries = Object.entries(buckets) as [keyof typeof buckets, number][];
    entries.sort((a, b) => b[1] - a[1]);
    const [topName, topCount] = entries[0] ?? ['morning', 0];
    const secondCount = entries[1]?.[1] ?? 0;

    // Only call it a pattern when one window clearly dominates.
    if (topCount >= MIN_SAMPLE_FOR_PATTERN && topCount > secondCount * 1.5) {
      // Tips are about where the medicine is kept — never about when or how it
      // is taken. Under CDSCO's 2026 software guidance the test is functional:
      // suggesting a dose be moved ("consider moving this dose earlier") is
      // treatment-related decision support and can make the app a regulated
      // medical device. Moving the reminder is the same advice in disguise,
      // because here the reminder time is the dose time. And meal-pairing tips
      // are out too: some medicines must not be taken with food.
      const WHEN: Record<keyof typeof buckets, string> = {
        morning: 'in the morning',
        afternoon: 'in the afternoon',
        evening: 'in the evening',
        night: 'at night',
      };
      const tip: Record<keyof typeof buckets, string> = {
        morning: 'Keeping the strip next to something you use first thing, like your toothbrush, can help.',
        afternoon: 'Keeping a strip in your bag or at work can help.',
        evening: 'Keeping the strip where you spend your evenings can help.',
        night: 'Keeping the strip beside your bed can help.',
      };
      found.push({
        kind: 'time_of_day_pattern',
        message: `Most of your missed doses (${topCount} of ${missed.length}) are ${WHEN[topName]}. ${tip[topName]}`,
        weight: 80,
      });
    }
  }

  const perMedicine = byMedicine(doses, context);
  const worst = perMedicine[0];
  if (worst && worst.taken + worst.missed >= MIN_SAMPLE_FOR_PATTERN && worst.ratePercent < 70) {
    found.push({
      kind: 'struggling_medicine',
      message: `${worst.medicineName} is your lowest at ${worst.ratePercent}% — ${worst.missed} missed of ${worst.taken + worst.missed}.`,
      weight: 90,
      medicineId: worst.medicineId,
    });
  }

  const trend = compareRecentToPrior(doses, context);
  if (trend) found.push(trend);

  const overall = summarise(doses, context);
  if (overall.taken + overall.missed >= 10 && overall.ratePercent >= 90) {
    found.push({
      kind: 'strong_adherence',
      message: `${overall.ratePercent}% adherence over ${overall.taken + overall.missed} doses. That is genuinely good.`,
      weight: 40,
    });
  }

  found.sort((a, b) => b.weight - a.weight);
  return found;
}

/** Compare the last 7 days against the 7 before, when both windows have enough data. */
function compareRecentToPrior(
  doses: readonly DoseEvent[],
  context: SummariseContext,
): Insight | null {
  const today = context.today ?? todayIn(context.timezone);
  const recentFrom = addDays(today, -6);
  const priorFrom = addDays(today, -13);
  const priorTo = addDays(today, -7);

  const inWindow = (from: LocalDate, to: LocalDate) =>
    doses.filter(
      (d) => compareLocalDate(d.localDate, from) >= 0 && compareLocalDate(d.localDate, to) <= 0,
    );

  const recent = tally(inWindow(recentFrom, today));
  const prior = tally(inWindow(priorFrom, priorTo));

  const recentTotal = recent.taken + recent.missed;
  const priorTotal = prior.taken + prior.missed;
  if (recentTotal < 5 || priorTotal < 5) return null;

  const recentRate = Math.round((recent.taken / recentTotal) * 100);
  const priorRate = Math.round((prior.taken / priorTotal) * 100);
  const delta = recentRate - priorRate;

  if (delta >= 10) {
    return {
      kind: 'improving',
      message: `Your adherence is up ${delta} points this week — ${recentRate}%, from ${priorRate}%.`,
      weight: 60,
    };
  }
  if (delta <= -10) {
    return {
      kind: 'declining',
      message: `Your adherence has slipped ${Math.abs(delta)} points this week — ${recentRate}%, down from ${priorRate}%.`,
      weight: 85,
    };
  }
  return null;
}

/* ───────────────────────────── Convenience ──────────────────────────────── */

/** Today's doses split for a dashboard, ordered by when each is due. */
export function splitToday(
  doses: readonly DoseEvent[],
  timezone: TimeZone,
  today: LocalDate = todayIn(timezone, now()),
): { upcoming: DoseEvent[]; taken: DoseEvent[]; missed: DoseEvent[]; skipped: DoseEvent[] } {
  const forToday = doses
    .filter((d) => d.localDate === today)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return {
    upcoming: forToday.filter((d) => d.status === 'scheduled' || d.status === 'snoozed'),
    taken: forToday.filter((d) => d.status === 'taken'),
    missed: forToday.filter((d) => d.status === 'missed'),
    skipped: forToday.filter((d) => d.status === 'skipped'),
  };
}
