/**
 * Sync orchestration.
 *
 * One call does both directions: push the outbox, pull everything changed since
 * the cursor. Doing them together means the device cannot end up in the state
 * where it has pushed but not pulled, which is what produces visible flicker
 * and phantom conflicts.
 *
 * Sync is best-effort by design. Failing offline is normal, not exceptional —
 * the outbox survives, the cache stays usable, and the next attempt picks up
 * where this one stopped.
 */

import type { Appointment, DoseEvent, Medicine } from '@medtrack/shared';
import { api, OfflineError } from '../api/client';
import {
  acknowledge,
  mergeServerChanges,
  readCursor,
  readOutbox,
  writeCursor,
  type CachedData,
} from '../storage/offline';

interface SyncResponse {
  results: { mutationId: string; outcome: string; reason?: string }[];
  changes: {
    medicines: Medicine[];
    doses: DoseEvent[];
    appointments: Appointment[];
  };
  cursor: string;
  hasMore: boolean;
  serverTime: string;
}

export interface SyncOutcome {
  ok: boolean;
  offline: boolean;
  pushed: number;
  pulled: number;
  rejected: { mutationId: string; reason?: string }[];
  cache: CachedData | null;
}

/** Guards against two syncs overlapping — the second would re-send the outbox. */
let inFlight: Promise<SyncOutcome> | null = null;

export async function sync(): Promise<SyncOutcome> {
  inFlight ??= runSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSync(): Promise<SyncOutcome> {
  const [outbox, cursor] = await Promise.all([readOutbox(), readCursor()]);

  try {
    const response = await api.post<SyncResponse>('/sync', {
      ...(cursor ? { since: cursor } : {}),
      mutations: outbox.slice(0, 500),
      timezone: currentTimeZone(),
    });

    // Acknowledged means the server has durably recorded the mutation id, so
    // replaying it would be a no-op. Safe to drop from the queue.
    await acknowledge(response.results.map((result) => result.mutationId));

    const cache = await mergeServerChanges(response.changes);
    await writeCursor(response.cursor);

    // Reminders are deliberately not rescheduled here. That used to sit after
    // the network call, so an offline device never extended its reminders —
    // the app that works without signal stopped reminding without signal.
    // AppContext reschedules on every cache change, online or not.

    const rejected = response.results
      .filter((result) => result.outcome === 'rejected')
      .map((result) => ({
        mutationId: result.mutationId,
        ...(result.reason ? { reason: result.reason } : {}),
      }));

    return {
      ok: true,
      offline: false,
      pushed: outbox.length,
      pulled:
        response.changes.medicines.length +
        response.changes.doses.length +
        response.changes.appointments.length,
      rejected,
      cache,
    };
  } catch (error) {
    if (error instanceof OfflineError) {
      // Entirely expected. The outbox persists and the cache is untouched.
      return { ok: false, offline: true, pushed: 0, pulled: 0, rejected: [], cache: null };
    }
    return { ok: false, offline: false, pushed: 0, pulled: 0, rejected: [], cache: null };
  }
}

function currentTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}
