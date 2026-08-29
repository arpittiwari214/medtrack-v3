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
 *  - Schedule a rolling horizon of upcoming doses (iOS caps an app at 64
 *    pending notifications, so the horizon is bounded and re-topped rather than
 *    scheduling everything).
 *  - Recompute from the shared scheduling engine, so the phone and the server
 *    agree on when doses fall without the phone needing to ask.
 *  - Re-run on app foreground, after a sync, and whenever a medicine changes.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  nextOccurrencesForAll,
  formatTime12h,
  type Medicine,
  type PlannedDose,
} from '@medtrack/shared';

/**
 * iOS silently drops scheduled notifications beyond 64 per app. Staying well
 * under leaves room for appointment reminders alongside doses.
 */
const MAX_SCHEDULED = 50;

/** Android channel for time-critical reminders. */
const REMINDER_CHANNEL = 'reminders';
const ALERT_CHANNEL = 'alerts';

/** Marks our notifications so a re-schedule only cancels its own. */
const DOSE_TAG = 'dose-reminder';

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
 * Called after the user has added their first medicine rather than on first
 * launch: asking before they understand what the app does earns a reflexive
 * "no", and on iOS a denied permission cannot be re-requested from inside the
 * app — the user has to go to Settings.
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

/**
 * Rebuild the schedule of local notifications from the current medicines.
 *
 * Cancels and re-creates rather than diffing. Diffing sounds cheaper but the
 * failure mode is a stale reminder for a medicine the patient stopped taking,
 * which is worse than the few milliseconds saved.
 */
export async function rescheduleReminders(medicines: Medicine[]): Promise<number> {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return 0;

  await cancelAllDoseReminders();

  const upcoming = nextOccurrencesForAll(medicines, MAX_SCHEDULED);
  let scheduled = 0;

  for (const dose of upcoming) {
    const fireAt = new Date(dose.scheduledAt);
    // Guard against a dose that became due while we were computing.
    if (fireAt.getTime() <= Date.now() + 1000) continue;

    try {
      await Notifications.scheduleNotificationAsync({
        content: buildContent(dose),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: REMINDER_CHANNEL,
        },
      });
      scheduled++;
    } catch {
      // One failed schedule must not abort the rest.
    }
  }

  return scheduled;
}

function buildContent(dose: PlannedDose): Notifications.NotificationContentInput {
  return {
    title: dose.isCritical ? `Time for ${dose.medicineName}` : 'Time to take your medicine',
    body: dose.isCritical
      ? `${dose.medicineStrength} — this one matters. Due at ${formatTime12h(dose.localTime)}.`
      : `${dose.medicineName} ${dose.medicineStrength} — due at ${formatTime12h(dose.localTime)}.`,
    sound: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
    // Carried back when the user taps, so the app can open straight to the dose
    // and offer Taken / Snooze without them hunting for it.
    data: {
      tag: DOSE_TAG,
      doseId: dose.id,
      medicineId: dose.medicineId,
      scheduledAt: dose.scheduledAt,
    },
    categoryIdentifier: DOSE_TAG,
  };
}

/** Cancel only the reminders this module created. */
export async function cancelAllDoseReminders(): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();

  await Promise.all(
    pending
      .filter((notification) => notification.content.data?.['tag'] === DOSE_TAG)
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier),
      ),
  );
}

/**
 * Register the interactive actions on a dose reminder.
 *
 * Being able to record a dose straight from the notification — without
 * unlocking, opening the app and finding the row — is the difference between a
 * reminder that gets actioned and one that gets dismissed.
 */
export async function registerNotificationActions(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(DOSE_TAG, [
    {
      identifier: 'TAKEN',
      buttonTitle: 'Taken',
      options: { opensAppToForeground: false },
    },
    {
      identifier: 'SNOOZE',
      buttonTitle: 'Snooze 10 min',
      options: { opensAppToForeground: false },
    },
  ]);
}

/** Schedule a one-off reminder for a snoozed dose. */
export async function scheduleSnooze(
  doseId: string,
  medicineName: string,
  minutes: number,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Reminder',
      body: `${medicineName} — you asked to be reminded again.`,
      sound: true,
      data: { tag: DOSE_TAG, doseId },
      categoryIdentifier: DOSE_TAG,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60,
      channelId: REMINDER_CHANNEL,
    },
  });
}

/** Clear the app icon badge, e.g. once the user has seen today's list. */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

/** How many reminders the OS currently holds. Surfaced in Settings for support. */
export async function pendingReminderCount(): Promise<number> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  return pending.filter((notification) => notification.content.data?.['tag'] === DOSE_TAG).length;
}
