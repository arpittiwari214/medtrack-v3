import Constants from 'expo-constants';

/**
 * Runtime configuration.
 *
 * The API URL comes from `app.json`'s `extra` block so it can be changed per
 * build profile without touching code. The localhost default only works in a
 * simulator — on a physical device it must point at a LAN address or a deployed
 * server, which is called out in the mobile README.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

export const API_URL: string = extra.apiUrl ?? 'http://localhost:5000/api';

/** How often the app syncs while in the foreground. */
export const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/** Snooze options offered from the dose sheet. */
export const SNOOZE_OPTIONS = [5, 10, 15, 30] as const;
