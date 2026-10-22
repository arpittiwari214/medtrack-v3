/**
 * Local notification scheduling.
 *
 * This is the reason MedTrack has a native app at all.
 *
 * v3 tried to remind people with a `setInterval` in a web page, which only
 * fires while the tab is open and focused — so in practice it never reminded
 * anyone who had closed the app, which is everyone, most of the time. Server
 * push is better but still depends on the network at the exact moment the dose
 * is due, and on the OS choosing to deliver promptly.
 *
 * Locally scheduled notifications are handed to the operating system in
 * advance. They fire with the app closed, the phone locked, and in airplane
 * mode. That is the only arrangement that actually works for medication.
 *
 * The scheduling strategy:
 *
 *  - Hold a rolling horizon of upcoming doses, sized per platform.
 *  - Recompute from the shared scheduling engine, so the phone and the server
 *    agree on when doses fall without the phone needing to ask.
 *  - Diff against what the OS already holds (see `reminder-plan.ts`), and
 *    re-run whenever local data changes — online or not.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { formatTime12h, nextOccurrencesForAll, type Medicine, type PlannedDose } from '@medtrack/shared';
import { DOSE_ID_PREFIX, planReminders, type ScheduledReminder } from '../reminder-plan';

/**
 * How many dose reminders to hand the OS at once.
 *
 * iOS silently drops anything past 64 pending per app, so it stays under that
 * with room for snoozes. Android documents no cap — about 500 per app is
 * observed via `dumpsys alarm`, varying by OEM — and the previous value of 50
 * was the iOS figure applied to both. At five medicines three times a day that
 * was about three days of reminders.
 */
const MAX_SCHEDULED = Platform.OS === 'ios' ? 56 : 300;

/** Never schedule further ahead than this. Topped up on every data change. */
const HORIZON_DAYS = 14;

/** Bump when reminder wording changes, so old text is replaced, not fired. */
const CONTENT_VERSION = 2;

/**
 * Android channel for time-critical reminders.
 *
 * A channel's importance and sound are fixed once it exists on a device. If
 * either needs to change — a recorded voice prompt, say — it must be a new
 * channel id, not an edit to this one.
 */
const REMINDER_CHANNEL = 'reminders';
const ALERT_CHANNEL = 'alerts';

/** Category id carrying the Taken / Snooze buttons. */
const DOSE_CATEGORY = 'dose-reminder';
/** Data tags, so a reschedule only ever touches its own notifications. */
const DOSE_TAG = 'dose-reminder';
const SNOOZE_TAG = 'dose-snooze';
const SNOOZE_ID_PREFIX = 'snooze:';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/* ─────────────────────────────── Permissions ────────────────────────────── */

export interface PermissionResult {
  granted: boolean;
  canAskAgain: boolean;
}

/**
 * Request notification permission.
 *
 * Asked once the patient has a medicine to be reminded about, not on first
 * launch: asking before they understand what the app does earns a reflexive
 * "no", and a denied permission cannot be re-requested from inside the app.
 *
 * On Android 13+ the system prompt only appears once a channel exists, so
 * `configureChannels` must have run first — it runs at startup.
 */
export async function requestPermission(): Promise<PermissionResult> {
  const existing = await Notifications.getPermissionsAsync();

  if (existing.granted) return { granted: true, canAskAgain: true };
  if (!existing.canAskAgain) return { granted: false, canAskAgain: false };

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: true,
      // Lets a critical dose reminder break through a Focus mode, subject to
      // Apple granting the entitlement.
      allowCriticalAlerts: true,
    },
  });

  return { granted: requested.granted, canAskAgain: requested.canAskAgain };
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  const status = await Notifications.getPermissionsAsync();
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

/** Set up Android channels. No-op elsewhere. */
export async function configureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Dose reminders',
    description: 'Reminders to take your medicine',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0891a8',
    // Reminders must be visible on a locked screen — that is where they are read.
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
  });

  await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
    name: 'Important alerts',
    description: 'Caregiver alerts and emergencies',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
    lightColor: '#c0342f',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    // Emergencies should get through Do Not Disturb.
    bypassDnd: true,
  });
}

/* ──────────────────────────────── Scheduling ────────────────────────────── */

export interface RescheduleOptions {
  /** Doses already taken or skipped — their reminders must not fire. */
  resolvedDoseIds?: ReadonlySet<string>;
  /**
   * Replace every reminder regardless of whether it changed. Needed after the
   * exact-alarm permission is granted: alarms set while it was denied remain
   * inexact until they are re-created.
   */
  force?: boolean;
}

/**
 * Bring the OS's dose reminders in line with the current medicines.
 *
 * Returns how many dose reminders the OS holds afterwards.
 */
export async function rescheduleReminders(
  medicines: Medicine[],
  options: RescheduleOptions = {},
): Promise<number> {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return 0;

  const resolved = options.resolvedDoseIds ?? new Set<string>();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  const existing: ScheduledReminder[] = scheduled
    .filter((item) => item.content.data?.['tag'] === DOSE_TAG)
    .map((item) => ({
      identifier: item.identifier,
      fingerprint: item.content.data?.['fp'] as string | undefined,
    }));

  const plan = planReminders({
    // Over-fetch by the resolved count so taken doses do not eat the cap.
    planned: nextOccurrencesForAll(medicines, MAX_SCHEDULED + resolved.size),
    resolvedDoseIds: resolved,
    existing,
    nowMs: Date.now(),
    horizonDays: HORIZON_DAYS,
    max: MAX_SCHEDULED,
    contentVersion: CONTENT_VERSION,
    force: options.force ?? false,
  });

  for (const identifier of plan.toCancel) {
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
  }

  let added = 0;
  for (const reminder of plan.toSchedule) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.identifier,
        content: buildContent(reminder.dose, reminder.fingerprint),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(reminder.dose.scheduledAt),
          channelId: REMINDER_CHANNEL,
        },
      });
      added++;
    } catch {
      // One failed schedule must not abort the rest.
    }
  }

  return plan.kept + added;
}

function buildContent(dose: PlannedDose, fingerprint: string): Notifications.NotificationContentInput {
  return {
    title: dose.isCritical ? `Time for ${dose.medicineName}` : 'Time to take your medicine',
    body: dose.isCritical
      ? `${dose.medicineStrength} — this one matters. Due at ${formatTime12h(dose.localTime)}.`
      : `${dose.medicineName} ${dose.medicineStrength} — due at ${formatTime12h(dose.localTime)}.`,
    sound: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
    // Carried back when the user taps, so the app can act on the exact dose,
    // and so delivery lateness can be measured against the prescribed time.
    data: {
      tag: DOSE_TAG,
      fp: fingerprint,
      doseId: dose.id,
      medicineId: dose.medicineId,
      scheduledAt: dose.scheduledAt,
    },
    categoryIdentifier: DOSE_CATEGORY,
  };
}

/** Cancel every reminder this module created — dose and snooze. Used on sign-out. */
export async function cancelAllDoseReminders(): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    pending
      .filter((item) => {
        const tag = item.content.data?.['tag'];
        return tag === DOSE_TAG || tag === SNOOZE_TAG;
      })
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

/**
 * Register the interactive actions on a dose reminder.
 *
 * Both buttons open the app. With `opensAppToForeground: false`, Expo parks
 * the response in an in-memory list until JavaScript next starts — and if the
 * OS kills the process first, which Indian OEM skins do aggressively, the tap
 * is lost and the dose is never recorded. Opening the app costs a second of
 * the patient's time and guarantees the record, and it also tops up the
 * reminder horizon as a side effect.
 *
 * shortcut: recording without opening the app needs a headless handler via
 * `Notifications.registerTaskAsync` (expo-task-manager), which must be tested
 * on real MIUI / ColorOS / One UI devices before it can be trusted.
 */
export async function registerNotificationActions(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(DOSE_CATEGORY, [
    {
      identifier: 'TAKEN',
      buttonTitle: 'Taken',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'SNOOZE',
      buttonTitle: 'Snooze 10 min',
      options: { opensAppToForeground: true },
    },
  ]);
}

/**
 * Schedule the follow-up reminder for a snoozed dose.
 *
 * Keyed by dose, so snoozing again replaces the previous follow-up rather than
 * stacking reminders. Until this was wired up nothing called it at all — a
 * snoozed dose was recorded as snoozed and then never reminded again, which is
 * the same failure v3 had.
 */
export async function scheduleSnooze(
  doseId: string,
  medicineName: string,
  minutes: number,
): Promise<void> {
  const identifier = SNOOZE_ID_PREFIX + doseId;
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: 'Reminder',
      body: `${medicineName} — you asked to be reminded again.`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { tag: SNOOZE_TAG, doseId, scheduledAt: new Date(Date.now() + minutes * 60_000).toISOString() },
      categoryIdentifier: DOSE_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60,
      channelId: REMINDER_CHANNEL,
    },
  });
}

/** Drop a pending snooze follow-up once the dose is taken or skipped. */
export async function cancelSnooze(doseId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(SNOOZE_ID_PREFIX + doseId).catch(
    () => undefined,
  );
}

/** Clear the app icon badge, e.g. once the user has seen today's list. */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

/** How many dose reminders the OS currently holds. Surfaced in Settings. */
export async function pendingReminderCount(): Promise<number> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  return pending.filter((item) => item.content.data?.['tag'] === DOSE_TAG).length;
}

/** When the furthest-ahead reminder is due — how long the app can go unopened. */
export async function reminderRunway(): Promise<Date | null> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const times = pending
    .filter((item) => item.content.data?.['tag'] === DOSE_TAG)
    .map((item) => Date.parse(String(item.content.data?.['scheduledAt'] ?? '')))
    .filter((value) => Number.isFinite(value));
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

export { DOSE_ID_PREFIX };
