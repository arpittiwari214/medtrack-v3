/**
 * Auth and data state for the mobile app.
 *
 * Combined into one provider on purpose: on mobile the two are coupled — signing
 * in must seed the offline cache and schedule notifications, and signing out
 * must wipe both. Splitting them invites the state where a device is signed out
 * but still holding someone's medication data and firing their reminders.
 *
 * This is also the single owner of the reminder schedule. It reschedules after
 * every change to local data, so reminders keep extending whether or not the
 * network is there.
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
import {
  addDays,
  isResolved,
  todayIn,
  type Appointment,
  type CreateMedicineInput,
  type DoseAction,
  type DoseEvent,
  type Medicine,
  type User,
} from '@medtrack/shared';
import { api, setSessionEndedHandler } from '../api/client';
import { clearTokens, getAccessToken, setTokens } from '../storage/secure';
import { deleteAllMedia, photoStore, voiceStore } from '../storage/media';
import { readPrefs, writePrefs, type Prefs } from '../storage/prefs';
import { resolveLocale } from '../i18n';
import {
  actOnDoseLocally,
  clearAll,
  createMedicineLocally,
  ensureLocalDoses,
  readCache,
  updateAppointmentLocally,
  type CachedData,
} from '../storage/offline';
import { sync } from '../sync/index';
import {
  cancelAllDoseReminders,
  cancelSnooze,
  configureChannels,
  notificationPermission,
  registerNotificationActions,
  requestPermission,
  rescheduleReminders,
  scheduleCareNudges,
  scheduleSnooze,
} from '../notifications/index';
import {
  exactAlarmsJustGranted,
  readReminderHealth,
  recordDeliveredFromTray,
  type ReminderHealth,
} from '../notifications/health';
import { SYNC_INTERVAL_MS } from '../config';

interface AppContextValue {
  user: User | null;
  /** No account: the data lives only on this phone and nothing syncs. */
  isLocal: boolean;
  /** Start using the app with no account. */
  startLocally: () => Promise<void>;
  /** A local user asked for the sign-in screen, to back their data up. */
  wantsSignIn: boolean;
  setWantsSignIn: (wants: boolean) => void;
  loading: boolean;
  cache: CachedData;
  syncing: boolean;
  lastSyncError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  actOnDose: (doseId: string, action: DoseAction, snoozeMinutes?: number) => Promise<DoseEvent>;
  updateAppointment: (appointmentId: string, patch: Partial<Appointment>) => Promise<Appointment>;
  refresh: () => Promise<void>;
  /** Re-run the reminder schedule, replacing everything when `force` is set. */
  rescheduleNow: (force?: boolean) => Promise<number>;
  /** Add a medicine on this phone, optionally with a strip photo. Works offline. */
  addMedicine: (
    input: CreateMedicineInput,
    media?: { photo?: string | null; voice?: string | null },
  ) => Promise<Medicine>;
  /** Voice labels recorded on this phone, by medicine id. */
  voices: Record<string, string>;
  prefs: Prefs;
  updatePrefs: (patch: Partial<Prefs>) => Promise<void>;
  /** A dose the patient opened from a reminder, to be read aloud once. */
  announceDoseId: string | null;
  setAnnounceDoseId: (doseId: string | null) => void;
  /** Strip photos stored on this phone, by medicine id. */
  photos: Record<string, string>;
  /** Whether reminders on this phone can be trusted; null until first read. */
  health: ReminderHealth | null;
  refreshHealth: () => Promise<void>;
}

const EMPTY_CACHE: CachedData = {
  medicines: [],
  doses: [],
  appointments: [],
  syncedAt: null,
};

const AppContext = createContext<AppContextValue | null>(null);

function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

/**
 * Stand-in for an account, so someone can start with nothing but the app.
 * Asking for an email and password before the first reminder is where people
 * give up; the account only earns its place once there is something to back
 * up. Signing in later uploads everything queued on the phone.
 */
export const LOCAL_USER_ID = 'local';

function localUser(): User {
  const now = new Date().toISOString();
  return {
    id: LOCAL_USER_ID,
    email: '',
    name: '',
    roles: ['patient'],
    timezone: deviceZone(),
    consents: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Yesterday to tomorrow — enough for Today, a late "taken", and midnight. */
async function withLocalDoses(timezone: string): Promise<CachedData> {
  const today = todayIn(timezone);
  return ensureLocalDoses(addDays(today, -1), addDays(today, 1));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cache, setCache] = useState<CachedData>(EMPTY_CACHE);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [health, setHealth] = useState<ReminderHealth | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [voices, setVoices] = useState<Record<string, string>>({});
  const [prefs, setPrefs] = useState<Prefs>({ speakOnOpen: false, language: null, localProfile: false });
  const [announceDoseId, setAnnounceDoseId] = useState<string | null>(null);
  const [wantsSignIn, setWantsSignIn] = useState(false);
  const isLocal = user?.id === LOCAL_USER_ID;

  const setLocalProfile = useCallback(async (localProfile: boolean) => {
    const next = { ...(await readPrefs()), localProfile };
    await writePrefs(next);
    setPrefs(next);
  }, []);
  const locale = resolveLocale(prefs.language);

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const askedForPermission = useRef(false);


  /* ── Bootstrap ── */

  useEffect(() => {
    setSessionEndedHandler(() => {
      setUser(null);
      void cancelAllDoseReminders();
      void clearAll();
      void deleteAllMedia();
      setPhotos({});
      setVoices({});
    });

    void (async () => {
      // Channels before anything that could prompt: on Android 13+ the
      // permission dialog does not appear until a channel exists.
      await configureChannels();

      // Show cached data immediately, before any network call. On a cold start
      // with no signal the app is still fully usable.
      setCache(await withLocalDoses(deviceZone()));
      setPhotos(await photoStore.read());
      setVoices(await voiceStore.read());
      const storedPrefs = await readPrefs();
      setPrefs(storedPrefs);

      const token = await getAccessToken();
      if (!token) {
        if (storedPrefs.localProfile) setUser(localUser());
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

  // Button titles and channel names are held by the OS, so they are re-sent
  // whenever the language changes, not just at startup.
  useEffect(() => {
    void configureChannels(locale).then(() => registerNotificationActions(locale));
  }, [locale]);

  /* ── Sync ── */

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      // With no account there is nothing to sync with.
      const outcome = (await getAccessToken()) ? await sync() : null;
      // Generate today's doses locally either way, so an offline phone still
      // rolls over at midnight and shows the new day.
      setCache(await withLocalDoses(deviceZone()));

      setLastSyncError(
        outcome && !outcome.ok && !outcome.offline ? 'Could not sync with the server.' : null,
      );
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

  /* ── Reminders ── */

  const resolvedDoseIds = useMemo(
    () => new Set(cache.doses.filter((dose) => isResolved(dose.status)).map((dose) => dose.id)),
    [cache.doses],
  );

  const rescheduleNow = useCallback(
    (force = false) =>
      rescheduleReminders(cache.medicines as Medicine[], { resolvedDoseIds, force, locale }),
    [cache.medicines, resolvedDoseIds, locale],
  );

  const refreshHealth = useCallback(async () => {
    setHealth(await readReminderHealth(cache.medicines.length > 0));
  }, [cache.medicines.length]);

  /**
   * Each time the app comes forward: log when tray reminders actually landed,
   * and if exact alarms were just granted, replace every reminder — those set
   * while it was denied stay inexact until re-created.
   */
  const checkReliability = useCallback(async () => {
    await recordDeliveredFromTray();
    if (await exactAlarmsJustGranted()) await rescheduleNow(true);
    await refreshHealth();
  }, [rescheduleNow, refreshHealth]);

  useEffect(() => {
    if (!user) return;
    void checkReliability();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void checkReliability();
    });
    return () => subscription.remove();
  }, [user, checkReliability]);

  // Every change to local data re-plans reminders — after a sync, an action,
  // or a medicine edit, online or not. Debounced, because a sync can land
  // several state updates in a row.
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      void rescheduleNow()
        // Every open and every action pushes the check-in back, so it only
        // fires for someone who has stopped using the app.
        .then(() => scheduleCareNudges(cache.medicines as Medicine[], user.timezone, locale))
        .then(refreshHealth);
    }, 400);
    return () => clearTimeout(timer);
  }, [user, cache.medicines, rescheduleNow, refreshHealth, locale]);

  // Ask for notification permission once there is something to remind about.
  // Nothing asked before: the only route was a button deep in Settings, so on
  // Android 13+ a new user simply never received a reminder.
  useEffect(() => {
    if (!user || askedForPermission.current || cache.medicines.length === 0) return;
    askedForPermission.current = true;
    void (async () => {
      if ((await notificationPermission()) === 'undetermined') {
        const result = await requestPermission();
        if (result.granted) await rescheduleNow();
      }
    })();
  }, [user, cache.medicines.length, rescheduleNow]);

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
      setWantsSignIn(false);
      // Anything recorded without an account is still in the outbox, so this
      // first sync is what uploads it.
      await setLocalProfile(false);
      await runSync();
    },
    [runSync, setLocalProfile],
  );

  const startLocally = useCallback(async () => {
    await setLocalProfile(true);
    setUser(localUser());
  }, [setLocalProfile]);

  const signOut = useCallback(async () => {
    try {
      if (await getAccessToken()) await api.post('/auth/logout');
    } catch {
      // Signing out must always succeed locally — otherwise someone handing
      // their phone over cannot get out of the account.
    }
    // Order matters: kill the reminders before dropping the data they describe,
    // so no notification can fire for a medicine the device no longer knows.
    await cancelAllDoseReminders();
    await clearTokens();
    await clearAll();
    // Photos and voice labels are health data too; they leave with everything else.
    await deleteAllMedia();
    await setLocalProfile(false);
    setUser(null);
    setCache(EMPTY_CACHE);
    setPhotos({});
    setVoices({});
  }, [setLocalProfile]);

  const addMedicine = useCallback(
    async (input: CreateMedicineInput, media: { photo?: string | null; voice?: string | null } = {}) => {
      if (!user) throw new Error('Please sign in first.');
      const { medicine } = await createMedicineLocally(input, {
        userId: user.id,
        timezone: user.timezone,
      });

      if (media.photo) {
        await photoStore.save(medicine.id, media.photo);
        setPhotos(await photoStore.read());
      }
      if (media.voice) {
        await voiceStore.save(medicine.id, media.voice);
        setVoices(await voiceStore.read());
      }

      // Generate today's doses for it at once, so it appears on Today and its
      // reminders are scheduled before any sync happens.
      setCache(await withLocalDoses(deviceZone()));
      void runSync();
      return medicine;
    },
    [user, runSync],
  );

  const actOnDose = useCallback(
    async (doseId: string, action: DoseAction, snoozeMinutes?: number) => {
      const { cache: nextCache, dose } = await actOnDoseLocally(doseId, action, {
        ...(snoozeMinutes !== undefined ? { snoozeMinutes } : {}),
      });
      setCache(nextCache);

      if (action === 'snooze' && snoozeMinutes !== undefined) {
        await scheduleSnooze(doseId, dose.medicineName, snoozeMinutes, locale);
      } else {
        // Taken, skipped or undone: a pending follow-up would nag about a dose
        // that is already dealt with.
        await cancelSnooze(doseId);
      }

      // Fire and forget — the change is already durable in the outbox, so the
      // UI must not wait on the network to feel responsive.
      void runSync();
      return dose;
    },
    [runSync, locale],
  );

  const updateAppointment = useCallback(
    async (appointmentId: string, patch: Partial<Appointment>) => {
      const { cache: nextCache, appointment } = await updateAppointmentLocally(appointmentId, patch);
      setCache(nextCache);
      void runSync();
      return appointment;
    },
    [runSync],
  );

  const updatePrefs = useCallback(
    async (patch: Partial<Prefs>) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      await writePrefs(next);
    },
    [prefs],
  );

  const value = useMemo(
    () => ({
      user,
      isLocal,
      startLocally,
      wantsSignIn,
      setWantsSignIn,
      loading,
      cache,
      syncing,
      lastSyncError,
      signIn,
      signOut,
      actOnDose,
      updateAppointment,
      refresh: runSync,
      rescheduleNow,
      health,
      refreshHealth,
      addMedicine,
      photos,
      voices,
      prefs,
      updatePrefs,
      announceDoseId,
      setAnnounceDoseId,
    }),
    [
      user,
      isLocal,
      startLocally,
      wantsSignIn,
      loading,
      cache,
      syncing,
      lastSyncError,
      signIn,
      signOut,
      actOnDose,
      updateAppointment,
      runSync,
      rescheduleNow,
      health,
      refreshHealth,
      addMedicine,
      photos,
      voices,
      prefs,
      updatePrefs,
      announceDoseId,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}
