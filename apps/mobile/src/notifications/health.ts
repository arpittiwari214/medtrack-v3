/**
 * Reading the phone's reminder reliability, and recording delivery samples.
 *
 * The decisions live in pure modules (`delivery-health`, `reminder-problems`,
 * `oem-guide`); this file only gathers the inputs from the OS and storage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {
  batteryUnrestricted,
  canInspect,
  exactAlarmsAllowed,
} from '../../modules/medtrack-alarms';
import {
  addSamples,
  sampleFrom,
  summariseDelivery,
  type DeliverySample,
  type DeliverySummary,
} from '../delivery-health';
import { guideFor, type VendorGuide } from '../oem-guide';
import { reminderProblems, type ReminderProblem } from '../reminder-problems';
import { notificationPermission, pendingReminderCount, reminderRunway } from './index';

const DELIVERY_KEY = 'mt.delivery.v1';
const EXACT_KEY = 'mt.exact.v1';
const REMINDER_TAGS = new Set(['dose-reminder', 'dose-snooze']);

export interface ReminderHealth {
  notifications: 'granted' | 'denied' | 'undetermined';
  exactAlarms: boolean | null;
  batteryUnrestricted: boolean | null;
  /** Whether this build can read the two settings above at all. */
  canInspect: boolean;
  scheduled: number;
  /** When the furthest-ahead reminder fires: how long the app can go unopened. */
  runwayUntil: Date | null;
  delivery: DeliverySummary;
  vendor: VendorGuide;
  problems: ReminderProblem[];
}

async function readLog(): Promise<DeliverySample[]> {
  try {
    const raw = await AsyncStorage.getItem(DELIVERY_KEY);
    return raw ? (JSON.parse(raw) as DeliverySample[]) : [];
  } catch {
    return [];
  }
}

async function recordSamples(samples: (DeliverySample | null)[]): Promise<void> {
  const valid = samples.filter((sample): sample is DeliverySample => sample !== null);
  if (valid.length === 0) return;
  const next = addSamples(await readLog(), valid);
  await AsyncStorage.setItem(DELIVERY_KEY, JSON.stringify(next)).catch(() => undefined);
}

function sampleOf(notification: Notifications.Notification): DeliverySample | null {
  const data = notification.request.content.data ?? {};
  if (!REMINDER_TAGS.has(String(data['tag'] ?? ''))) return null;
  return sampleFrom(
    notification.request.identifier,
    String(data['scheduledAt'] ?? ''),
    notification.date,
    Date.now(),
  );
}

/** Record one delivered reminder — from a tap, or while the app was open. */
export async function recordDelivery(notification: Notifications.Notification): Promise<void> {
  await recordSamples([sampleOf(notification)]);
}

/**
 * Record every reminder sitting in the notification tray. Run on each open:
 * the patient may never tap a reminder, but it still tells us when it landed.
 */
export async function recordDeliveredFromTray(): Promise<void> {
  const presented = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  await recordSamples(presented.map(sampleOf));
}

/**
 * True exactly once after the patient grants exact alarms.
 *
 * Alarms scheduled while the permission was denied were set as inexact and
 * stay inexact until re-created, so the caller must force a full reschedule.
 */
export async function exactAlarmsJustGranted(): Promise<boolean> {
  const now = exactAlarmsAllowed();
  if (now === null) return false;
  const before = await AsyncStorage.getItem(EXACT_KEY).catch(() => null);
  await AsyncStorage.setItem(EXACT_KEY, String(now)).catch(() => undefined);
  return now && before === 'false';
}

export async function readReminderHealth(hasMedicines: boolean): Promise<ReminderHealth> {
  const [notifications, scheduled, runwayUntil, log] = await Promise.all([
    notificationPermission(),
    pendingReminderCount(),
    reminderRunway(),
    readLog(),
  ]);

  const vendor = guideFor(Device.manufacturer);
  const exactAlarms = exactAlarmsAllowed();
  const battery = batteryUnrestricted();
  const delivery = summariseDelivery(log);

  return {
    notifications,
    exactAlarms,
    batteryUnrestricted: battery,
    canInspect,
    scheduled,
    runwayUntil,
    delivery,
    vendor,
    problems: reminderProblems({
      hasMedicines,
      notifications,
      exactAlarms,
      batteryUnrestricted: battery,
      vendorSeverity: vendor.severity,
      scheduled,
      delivery,
    }),
  };
}
