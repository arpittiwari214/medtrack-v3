/**
 * JavaScript side of the reliability module.
 *
 * The native module exists only in a development or release build. In Expo Go
 * it is absent, so every reader returns `null` ("cannot tell") rather than a
 * guess, and the openers fall back to the closest screen React Native can
 * reach on its own. iOS has neither concept, so it reports "fine".
 */

import { requireOptionalNativeModule } from 'expo';
import { Linking, Platform } from 'react-native';

interface NativeAlarms {
  canScheduleExactAlarms(): boolean;
  isIgnoringBatteryOptimizations(): boolean;
  openExactAlarmSettings(): boolean;
  openBatteryOptimizationSettings(): boolean;
  openAutostartSettings(): boolean;
  openAppDetails(): boolean;
}

const native =
  Platform.OS === 'android' ? requireOptionalNativeModule<NativeAlarms>('MedtrackAlarms') : null;

/** Whether this build can actually read the settings below. */
export const canInspect = Platform.OS !== 'android' || native !== null;

/** True/false when known; null when this build cannot tell (Expo Go). */
export function exactAlarmsAllowed(): boolean | null {
  if (Platform.OS !== 'android') return true;
  return native ? native.canScheduleExactAlarms() : null;
}

export function batteryUnrestricted(): boolean | null {
  if (Platform.OS !== 'android') return true;
  return native ? native.isIgnoringBatteryOptimizations() : null;
}

export async function openExactAlarmSettings(): Promise<void> {
  if (native?.openExactAlarmSettings()) return;
  await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM').catch(() =>
    Linking.openSettings(),
  );
}

export async function openBatterySettings(): Promise<void> {
  if (native?.openBatteryOptimizationSettings()) return;
  await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() =>
    Linking.openSettings(),
  );
}

export async function openAutostartSettings(): Promise<void> {
  if (native?.openAutostartSettings()) return;
  await Linking.openSettings();
}
