/**
 * Auth and data state for the mobile app.
 *
 * Combined into one provider on purpose: on mobile the two are coupled — signing
 * in must seed the offline cache and schedule notifications, and signing out
 * must wipe both. Splitting them invites the state where a device is signed out
 * but still holding someone's medication data and firing their reminders.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { DoseAction, DoseEvent, Medicine, User } from '@medtrack/shared';
import { api, setSessionEndedHandler } from '../api/client.js';
import { clearTokens, getAccessToken, setTokens } from '../storage/secure.js';
import {
  actOnDoseLocally,
  clearAll,
  readCache,
  type CachedData,
} from '../storage/offline.js';
import { sync } from '../sync/index.js';
import {
  cancelAllDoseReminders,
  configureChannels,
  registerNotificationActions,
  rescheduleReminders,
} from '../notifications/index.js';
import { SYNC_INTERVAL_MS } from '../config.js';

interface AppContextValue {
  user: User | null;
  loading: boolean;
  cache: CachedData;
  syncing: boolean;
  lastSyncError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  actOnDose: (doseId: string, action: DoseAction, snoozeMinutes?: number) => Promise<DoseEvent>;
  refresh: () => Promise<void>;
}

const EMPTY_CACHE: CachedData = {
  medicines: [],
  doses: [],
  appointments: [],
  syncedAt: null,
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cache, setCache] = useState<CachedData>(EMPTY_CACHE);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const appState = useRef<AppStateStatus>(AppState.currentState);

  /* ── Bootstrap ── */

  useEffect(() => {
    setSessionEndedHandler(() => {
      setUser(null);
      void clearAll();
    });

    void (async () => {
      await configureChannels();
      await registerNotificationActions();

      // Show cached data immediately, before any network call. On a cold start
      // with no signal the app is still fully usable.
      const cached = await readCache();
      setCache(cached);

      const token = await getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { user: current } = await api.get<{ user: User }>('/auth/me');
        setUser(current);
        void runSync();
      } catch {
        // Offline with a stored token: stay signed in and work from cache.
        // Only an explicit 401 clears the session, via the handler above.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── Sync ── */

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      const outcome = await sync();
      if (outcome.cache) setCache(outcome.cache);

      if (outcome.offline) setLastSyncError(null);
      else if (!outcome.ok) setLastSyncError('Could not sync with the server.');
      else setLastSyncError(null);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Sync when the app comes back to the foreground: that is when a person
  // actually looks at it, and when their queued changes should go out.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const cameForward = appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (cameForward && user) void runSync();
    });
    return () => subscription.remove();
  }, [user, runSync]);

  // A gentle periodic sync while in use, so a caregiver's view is not hours stale.
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => void runSync(), SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, runSync]);

  /* ── Actions ── */

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
        '/auth/login',
        { email, password },
        { anonymous: true },
      );
      await setTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      await runSync();
    },
    [runSync],
  );

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Signing out must always succeed locally — otherwise someone handing
      // their phone over cannot get out of the account.
    }
    // Order matters: kill the reminders before dropping the data they describe,
    // so no notification can fire for a medicine the device no longer knows.
    await cancelAllDoseReminders();
    await clearTokens();
    await clearAll();
    setUser(null);
    setCache(EMPTY_CACHE);
  }, []);

  const actOnDose = useCallback(
    async (doseId: string, action: DoseAction, snoozeMinutes?: number) => {
      const { cache: nextCache, dose } = await actOnDoseLocally(doseId, action, {
        ...(snoozeMinutes !== undefined ? { snoozeMinutes } : {}),
      });
      setCache(nextCache);

      // Fire and forget — the change is already durable in the outbox, so the
      // UI must not wait on the network to feel responsive.
      void runSync();
      return dose;
    },
    [runSync],
  );

  // Keep the OS notification schedule aligned with the medicine list.
  useEffect(() => {
    if (!user || cache.medicines.length === 0) return;
    void rescheduleReminders(cache.medicines as Medicine[]);
  }, [user, cache.medicines]);

  const value = useMemo(
    () => ({
      user,
      loading,
      cache,
      syncing,
      lastSyncError,
      signIn,
      signOut,
      actOnDose,
      refresh: runSync,
    }),
    [user, loading, cache, syncing, lastSyncError, signIn, signOut, actOnDose, runSync],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}
