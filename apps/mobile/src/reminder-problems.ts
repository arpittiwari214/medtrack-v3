/**
 * Turning reliability signals into problems worth telling the patient about.
 *
 * Pure: no Expo imports, so `node --test` can exercise it.
 */

import type { DeliverySummary } from './delivery-health';

export interface ReminderSignals {
  hasMedicines: boolean;
  notifications: 'granted' | 'denied' | 'undetermined';
  /** null when this build cannot tell (Expo Go). */
  exactAlarms: boolean | null;
  batteryUnrestricted: boolean | null;
  /** dontkillmyapp severity of this vendor's skin, 0–5. */
  vendorSeverity: number;
  scheduled: number;
  delivery: DeliverySummary;
}

export type ReminderProblem =
  | 'notifications_off'
  | 'exact_alarms_off'
  | 'arriving_late'
  | 'battery_restricted'
  | 'nothing_scheduled';

/** Most serious first. An empty list means reminders look healthy. */
export function reminderProblems(signals: ReminderSignals): ReminderProblem[] {
  if (!signals.hasMedicines) return [];

  // Nothing else matters if the OS will not show a notification at all.
  if (signals.notifications !== 'granted') return ['notifications_off'];

  const problems: ReminderProblem[] = [];
  if (signals.exactAlarms === false) problems.push('exact_alarms_off');
  if (signals.delivery.verdict === 'late') problems.push('arriving_late');
  // Only worth raising where the skin is known to kill apps; on a Pixel the
  // default optimisation is harmless and the warning would be noise.
  if (signals.batteryUnrestricted === false && signals.vendorSeverity >= 3) {
    problems.push('battery_restricted');
  }
  if (signals.scheduled === 0) problems.push('nothing_scheduled');
  return problems;
}
