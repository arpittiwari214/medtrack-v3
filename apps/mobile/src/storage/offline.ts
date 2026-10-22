/**
 * Offline store.
 *
 * The app is offline-first: every screen reads from this local cache, never
 * directly from the network. A dose can be marked taken on a train with no
 * signal, and the change is queued and replayed when connectivity returns.
 *
 * Two structures:
 *
 *  - **The cache** — the last known server state, plus any local changes
 *    already applied optimistically.
 *  - **The outbox** — an ordered queue of mutations not yet acknowledged. Each
 *    carries a client-generated `mutationId`, which is what makes replay safe:
 *    the server records it under a unique index, so a mutation delivered twice
 *    is applied once.
 *
 * Tokens are deliberately NOT stored here — they live in the OS keychain via
 * `secure.ts`. AsyncStorage is unencrypted at rest.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyDoseAction,
  doseEventFromPlanned,
  expandMedicines,
  mergeDoseConflict,
  plannedDoseFor,
  type DoseAction,
  type DoseEvent,
  type Medicine,
  type Appointment,
} from '@medtrack/shared';

const CACHE_KEY = 'mt.cache.v1';
const OUTBOX_KEY = 'mt.outbox.v1';
const CURSOR_KEY = 'mt.cursor.v1';

export interface CachedData {
  medicines: Medicine[];
  doses: DoseEvent[];
  appointments: Appointment[];
  /** When the cache was last successfully reconciled with the server. */
  syncedAt: string | null;
}

export interface QueuedMutation {
  mutationId: string;
  entity: 'medicine' | 'dose' | 'appointment';
  operation: 'create' | 'update' | 'delete';
  entityId: string;
  clientUpdatedAt: string;
  payload: Record<string, unknown>;
}

const EMPTY: CachedData = { medicines: [], doses: [], appointments: [], syncedAt: null };

/* ────────────────────────────────── Cache ───────────────────────────────── */

export async function readCache(): Promise<CachedData> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<CachedData>) };
  } catch {
    // A corrupt cache is recoverable — the next sync refills it. Losing the
    // app to a parse error is not.
    return EMPTY;
  }
}

export async function writeCache(data: CachedData): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

/**
 * Merge a server response into the cache.
 *
 * Doses go through `mergeDoseConflict` rather than being overwritten, so a
 * dose the patient marked taken offline is not clobbered by a server row that
 * still says "missed". Running the identical merge the server runs means the
 * two converge without a second round trip.
 */
export async function mergeServerChanges(changes: {
  medicines?: Medicine[];
  doses?: DoseEvent[];
  appointments?: Appointment[];
}): Promise<CachedData> {
  const cache = await readCache();

  const merged: CachedData = {
    medicines: upsertById(cache.medicines, changes.medicines ?? []),
    appointments: upsertById(cache.appointments, changes.appointments ?? []),
    doses: mergeDoses(cache.doses, changes.doses ?? []),
    syncedAt: new Date().toISOString(),
  };

  await writeCache(merged);
  return merged;
}

function upsertById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return existing;
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()];
}

function mergeDoses(existing: DoseEvent[], incoming: DoseEvent[]): DoseEvent[] {
  if (incoming.length === 0) return existing;
  const byId = new Map(existing.map((dose) => [dose.id, dose]));

  for (const serverDose of incoming) {
    const localDose = byId.get(serverDose.id);
    byId.set(serverDose.id, localDose ? mergeDoseConflict(localDose, serverDose) : serverDose);
  }
  return [...byId.values()];
}

/* ────────────────────────────────── Outbox ──────────────────────────────── */

export async function readOutbox(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

export async function writeOutbox(queue: QueuedMutation[]): Promise<void> {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
}

export async function enqueue(mutation: QueuedMutation): Promise<void> {
  const queue = await readOutbox();
  queue.push(mutation);
  await writeOutbox(queue);
}

/** Remove mutations the server has acknowledged, by id. */
export async function acknowledge(mutationIds: string[]): Promise<void> {
  if (mutationIds.length === 0) return;
  const done = new Set(mutationIds);
  const queue = await readOutbox();
  await writeOutbox(queue.filter((mutation) => !done.has(mutation.mutationId)));
}

/* ──────────────────────────── Optimistic actions ────────────────────────── */

/**
 * Apply a dose action locally and queue it for the server.
 *
 * The transition itself is decided by the shared state machine, so an offline
 * device enforces exactly the same rules the server would — an illegal action
 * is rejected on the device rather than queued and rejected an hour later when
 * the network returns.
 */
export async function actOnDoseLocally(
  doseId: string,
  action: DoseAction,
  options: { snoozeMinutes?: number; skipReason?: string | null } = {},
): Promise<{ cache: CachedData; dose: DoseEvent }> {
  const cache = await readCache();
  const now = new Date();

  // A reminder can be for a dose this phone has not synced yet — reminders run
  // up to two weeks ahead, and a medicine may have been added offline. Rather
  // than refuse ("not in your offline data") and lose a dose the patient really
  // took, derive it from the medicine's schedule. The server applies the same
  // rule when the mutation arrives, so both sides agree on the record.
  const existing = cache.doses.find((item) => item.id === doseId);
  const dose = existing ?? materialiseFromMedicines(cache.medicines, doseId, now);
  if (!dose) throw new Error('That dose is not in your offline data.');
  const baseDoses = existing ? cache.doses : [...cache.doses, dose];

  const patch = applyDoseAction(dose, {
    action,
    at: now,
    ...(options.snoozeMinutes !== undefined ? { snoozeMinutes: options.snoozeMinutes } : {}),
    ...(options.skipReason !== undefined ? { skipReason: options.skipReason } : {}),
  });

  const updated: DoseEvent = {
    ...dose,
    ...patch,
    rev: dose.rev + 1,
  } as DoseEvent;

  const nextCache: CachedData = {
    ...cache,
    doses: baseDoses.map((item) => (item.id === doseId ? updated : item)),
  };
  await writeCache(nextCache);

  await enqueue({
    mutationId: randomId(),
    entity: 'dose',
    operation: 'update',
    entityId: doseId,
    clientUpdatedAt: now.toISOString(),
    payload: {
      status: updated.status,
      takenAt: updated.takenAt ?? null,
      snoozedUntil: updated.snoozedUntil ?? null,
      snoozeCount: updated.snoozeCount,
      skipReason: updated.skipReason ?? null,
    },
  });

  return { cache: nextCache, dose: updated };
}

function materialiseFromMedicines(
  medicines: Medicine[],
  doseId: string,
  now: Date,
): DoseEvent | null {
  const medicineId = doseId.slice(0, doseId.lastIndexOf('_'));
  const medicine = medicines.find((item) => item.id === medicineId);
  const planned = medicine ? plannedDoseFor(medicine, doseId) : null;
  return planned ? doseEventFromPlanned(planned, now.toISOString()) : null;
}

/**
 * Make sure every scheduled dose in a window exists locally.
 *
 * The phone used to show only doses the server had generated and sent, so a
 * medicine added offline — or a phone that had not synced since midnight —
 * showed an empty or partial "Today". Doses are deterministic, so generating
 * them here produces exactly the ids the server will generate; nothing is
 * queued, because creating an unresolved dose is not something to sync.
 */
export async function ensureLocalDoses(from: string, to: string): Promise<CachedData> {
  const cache = await readCache();
  const have = new Set(cache.doses.map((dose) => dose.id));
  const at = new Date().toISOString();

  const missing = expandMedicines(cache.medicines, { from, to })
    .filter((planned) => !have.has(planned.id))
    .map((planned) => doseEventFromPlanned(planned, at));

  if (missing.length === 0) return cache;

  const next: CachedData = { ...cache, doses: [...cache.doses, ...missing] };
  await writeCache(next);
  return next;
}

/**
 * Apply an appointment change locally and queue it.
 *
 * Simpler than the dose path: an appointment has no state machine and no
 * asymmetry to preserve, so this is a plain field patch with last-write-wins,
 * which is what the server does for appointments too.
 */
export async function updateAppointmentLocally(
  appointmentId: string,
  patch: Partial<Appointment>,
): Promise<{ cache: CachedData; appointment: Appointment }> {
  const cache = await readCache();
  const existing = cache.appointments.find((item) => item.id === appointmentId);
  if (!existing) throw new Error('That appointment is not in your offline data.');

  const now = new Date();
  const updated: Appointment = {
    ...existing,
    ...patch,
    updatedAt: now.toISOString(),
    rev: existing.rev + 1,
  };

  const nextCache: CachedData = {
    ...cache,
    appointments: cache.appointments.map((item) => (item.id === appointmentId ? updated : item)),
  };
  await writeCache(nextCache);

  await enqueue({
    mutationId: randomId(),
    entity: 'appointment',
    operation: 'update',
    entityId: appointmentId,
    clientUpdatedAt: now.toISOString(),
    payload: patch as Record<string, unknown>,
  });

  return { cache: nextCache, appointment: updated };
}

/* ────────────────────────────────── Cursor ──────────────────────────────── */

export async function readCursor(): Promise<string | null> {
  return AsyncStorage.getItem(CURSOR_KEY);
}

export async function writeCursor(cursor: string): Promise<void> {
  await AsyncStorage.setItem(CURSOR_KEY, cursor);
}

/** Wipe everything local. Used on sign-out so a shared device leaks nothing. */
export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove([CACHE_KEY, OUTBOX_KEY, CURSOR_KEY]);
}

/**
 * UUID v4 from `crypto.getRandomValues`, which React Native provides.
 *
 * `Math.random()` would be wrong here: these ids are the idempotency keys the
 * server deduplicates on, so a collision between two devices would silently
 * drop one person's dose record.
 */
export function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
