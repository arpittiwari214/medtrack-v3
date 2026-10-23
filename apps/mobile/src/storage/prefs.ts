/**
 * Small per-device preferences. Not health data, and not synced: they describe
 * how this phone should behave, not anything about the patient.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'mt.prefs.v1';

export interface Prefs {
  /**
   * Play the medicine's voice label (or read its description) when the app is
   * opened from a reminder. Off by default: audio that starts on its own is a
   * surprise in a shared room, and it names what the medicine is for.
   */
  speakOnOpen: boolean;
  /** Interface language; null follows the phone's setting. */
  language: string | null;
}

const DEFAULTS: Prefs = { speakOnOpen: false, language: null };

export async function readPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export async function writePrefs(next: Prefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
}
