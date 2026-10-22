/**
 * Measuring whether reminders actually arrive on time.
 *
 * No Android API reports whether a vendor's battery manager is killing the
 * app, or whether alarms are being deferred. The only honest check is
 * behavioural: compare when each reminder was due with when the phone actually
 * delivered it. Samples come from notifications already in the tray and from
 * the ones the patient taps — no extra "heartbeat" notifications, which would
 * be noise on a patient's lock screen.
 *
 * Pure: no Expo imports, so `node --test` can exercise it.
 */

export interface DeliverySample {
  /** Notification identifier plus due time, so the same delivery counts once. */
  key: string;
  /** Minutes between the due time and actual delivery. Negative is clamped. */
  lateMinutes: number;
  /** When the sample was recorded, epoch ms. */
  recordedAt: number;
}

export type DeliveryVerdict = 'ok' | 'late' | 'unknown';

export interface DeliverySummary {
  count: number;
  medianLateMinutes: number | null;
  verdict: DeliveryVerdict;
}

/** Keep the most recent samples only — old behaviour says little about now. */
export const MAX_SAMPLES = 30;

/** Fewer than this and a verdict would be a guess. */
export const MIN_SAMPLES = 3;

/**
 * Inexact alarms in Doze are deferred to maintenance windows, typically by
 * ten minutes or more. An exact alarm lands within seconds.
 */
export const LATE_THRESHOLD_MINUTES = 10;

export function sampleFrom(
  identifier: string,
  dueISO: string,
  deliveredAtMs: number,
  now: number,
): DeliverySample | null {
  const due = Date.parse(dueISO);
  if (!Number.isFinite(due) || !Number.isFinite(deliveredAtMs)) return null;
  return {
    key: `${identifier}@${dueISO}`,
    lateMinutes: Math.max(0, (deliveredAtMs - due) / 60_000),
    recordedAt: now,
  };
}

export function addSamples(log: DeliverySample[], incoming: DeliverySample[]): DeliverySample[] {
  const byKey = new Map(log.map((sample) => [sample.key, sample]));
  for (const sample of incoming) {
    if (!byKey.has(sample.key)) byKey.set(sample.key, sample);
  }
  return [...byKey.values()]
    .sort((a, b) => a.recordedAt - b.recordedAt)
    .slice(-MAX_SAMPLES);
}

export function summariseDelivery(log: DeliverySample[]): DeliverySummary {
  if (log.length < MIN_SAMPLES) {
    return { count: log.length, medianLateMinutes: null, verdict: 'unknown' };
  }
  const sorted = log.map((sample) => sample.lateMinutes).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;

  return {
    count: log.length,
    medianLateMinutes: Math.round(median),
    verdict: median > LATE_THRESHOLD_MINUTES ? 'late' : 'ok',
  };
}
