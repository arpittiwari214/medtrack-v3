import Constants from 'expo-constants';
import { pickApiUrl } from './api-url';

/**
 * Runtime configuration.
 *
 * The API URL comes from `app.json`'s `extra` block so it can be changed per
 * build profile without touching code.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; webUrl?: string };

/** The website: signup, the legal pages, and adding visits. */
export const WEB_URL: string = extra.webUrl ?? 'https://medtrack-v3.vercel.app';

export const API_URL: string = pickApiUrl({
  configured: extra.apiUrl,
  hostUri:
    Constants.expoConfig?.hostUri ??
    // Older Expo Go clients expose the dev host here instead.
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost,
  dev: __DEV__,
});

/** How often the app syncs while in the foreground. */
export const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Snooze options offered from the dose sheet. */
export const SNOOZE_OPTIONS = [5, 10, 15, 30] as const;
