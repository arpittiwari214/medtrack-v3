/**
 * Offline sync.
 *
 * The contract with a client:
 *
 *   1. It queues mutations locally while offline, each tagged with a
 *      client-generated `mutationId` and the instant it was made on the device.
 *   2. On reconnect it POSTs the queue plus a `since` cursor.
 *   3. The server applies each mutation **at most once** — the `SyncMutation`
 *      ledger is keyed by `mutationId` under a unique index, so a retried
 *      request replays the recorded outcome instead of re-applying it.
 *   4. The server returns everything changed since the cursor, plus a new one.
 *
 * Conflicts are resolved by `mergeDoseConflict` from `@medtrack/shared`, which
 * both the server and the client run — so a device can predict the outcome
 * locally and does not flicker when the authoritative answer arrives.
 */

import {
  addDays,
  createAppointmentSchema,
  createMedicineSchema,
  idSchema,
  mergeDoseConflict,
  syncDosePayloadSchema,
  todayIn,
  updateAppointmentSchema,
  updateMedicineSchema,
  type SyncMutationInput,
} from '@medtrack/shared';
import { MongoServerError } from 'mongodb';
import { childLogger } from '../config/logger.js';
import { Appointment } from '../models/Appointment.js';
import { DoseEvent } from '../models/DoseEvent.js';
import { Medicine } from '../models/Medicine.js';
import { SyncMutation } from '../models/SyncMutation.js';
import { User } from '../models/User.js';
import {
  MATERIALISE_AHEAD_DAYS,
  generateDosesForMedicine,
  materialiseDose,
  regenerateFutureDoses,
  toDomainDose,
  toDomainMedicine,
  type MedicineSource,
} from './doses.js';
import {
  applyAppointmentUpdate,
  applyMedicineUpdate,
  appointmentFields,
  medicineFields,
} from './writes.js';

const log = childLogger('sync');

/** Cap on rows returned per pull, so a long-offline device syncs in pages. */
const PULL_PAGE_SIZE = 1000;

export type MutationOutcome = 'applied' | 'conflict_resolved' | 'rejected' | 'no_op';

export interface MutationResult {
  mutationId: string;
  outcome: MutationOutcome;
  reason?: string;
  /** Present when the server's version differs from what the client sent. */
  serverState?: unknown;
}

export interface SyncResponse {
  results: MutationResult[];
  changes: {
    medicines: unknown[];
    doses: unknown[];
    appointments: unknown[];
  };
  /** Pass back as `since` on the next sync. */
  cursor: string;
  /** True when more changes remain beyond this page. */
  hasMore: boolean;
}

/* ────────────────────────────── Push phase ──────────────────────────────── */

export async function applyMutations(
  userId: string,
  mutations: SyncMutationInput[],
): Promise<MutationResult[]> {
  const results: MutationResult[] = [];

  // Sequential on purpose: two queued mutations can touch the same row, and
  // applying them concurrently would make the result depend on scheduling.
  for (const mutation of mutations) {
    results.push(await applyOne(userId, mutation));
  }
  return results;
}

async function applyOne(userId: string, mutation: SyncMutationInput): Promise<MutationResult> {
  // Replay check first — cheapest path, and the one a flaky network hits most.
  const existing = await SyncMutation.findById(mutation.mutationId).lean();
  if (existing) {
    return {
      mutationId: mutation.mutationId,
      outcome: existing.result as MutationOutcome,
      ...(existing.rejectionReason ? { reason: existing.rejectionReason } : {}),
    };
  }

  let outcome: MutationOutcome = 'applied';
  let reason: string | undefined;
  let serverState: unknown;

  try {
    switch (mutation.entity) {
      case 'dose': {
        const applied = await applyDoseMutation(userId, mutation);
        outcome = applied.outcome;
        serverState = applied.serverState;
        break;
      }
      case 'medicine': {
        outcome = await applyMedicineMutation(userId, mutation);
        break;
      }
      case 'appointment': {
        outcome = await applyAppointmentMutation(userId, mutation);
        break;
      }
      default: {
        outcome = 'rejected';
        reason = 'Unknown entity type.';
      }
    }
  } catch (error) {
    outcome = 'rejected';
    reason = error instanceof Error ? error.message.slice(0, 500) : 'Could not apply this change.';
    log.warn(
      { mutationId: mutation.mutationId, entity: mutation.entity, err: reason },
      'Sync mutation rejected',
    );
  }

  await recordMutation(userId, mutation, outcome, reason);

  return {
    mutationId: mutation.mutationId,
    outcome,
    ...(reason ? { reason } : {}),
    ...(serverState ? { serverState } : {}),
  };
}

/** Write the ledger entry, tolerating a concurrent duplicate. */
async function recordMutation(
  userId: string,
  mutation: SyncMutationInput,
  result: MutationOutcome,
  reason?: string,
): Promise<void> {
  try {
    await SyncMutation.create({
      _id: mutation.mutationId,
      userId,
      entity: mutation.entity,
      operation: mutation.operation,
      entityId: mutation.entityId,
      result,
      rejectionReason: reason ?? null,
      clientUpdatedAt: new Date(mutation.clientUpdatedAt),
    });
  } catch (error) {
    // Two in-flight copies of the same request; the other one recorded it.
    if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
  }
}

/* ───────────────────────────── Dose mutations ───────────────────────────── */

/**
 * Merge a dose the client changed offline.
 *
 * This is where the important guarantee lives: a dose the patient marked taken
 * on their phone must not be overwritten by the server's later automatic
 * "missed", even though the server's timestamp is newer. `mergeDoseConflict`
 * encodes that rule.
 */
async function applyDoseMutation(
  userId: string,
  mutation: SyncMutationInput,
): Promise<{ outcome: MutationOutcome; serverState?: unknown }> {
  let doc = await DoseEvent.findOne({ _id: mutation.entityId, userId });

  if (!doc) {
    // Not generated yet — typically a medicine created offline, or a reminder
    // further ahead than the materialisation window. Dropping the mutation here
    // used to lose a "taken" the patient really recorded, so generate the dose
    // if the id names a real occurrence of one of *this user's* medicines.
    const medicineId = mutation.entityId.slice(0, mutation.entityId.lastIndexOf('_'));
    const medicine = await Medicine.findOne({ _id: medicineId, userId }).lean();
    if (
      medicine &&
      (await materialiseDose(toDomainMedicine(medicine as unknown as MedicineSource), mutation.entityId))
    ) {
      doc = await DoseEvent.findOne({ _id: mutation.entityId, userId });
    }
  }

  if (!doc) {
    // Genuinely not a dose of this user's — the medicine was deleted while the
    // device was offline, or the id is not a real occurrence.
    return { outcome: 'no_op' };
  }

  const server = toDomainDose(doc.toObject());
  const payload = syncDosePayloadSchema.parse(mutation.payload);

  const client = {
    ...server,
    ...payload,
    // Trust the client's own clock for when *it* made the change, but never
    // let it rewrite identity or the prescribed time.
    id: server.id,
    userId: server.userId,
    medicineId: server.medicineId,
    scheduledAt: server.scheduledAt,
    updatedAt: mutation.clientUpdatedAt,
  };

  const winner = mergeDoseConflict(server, client);

  if (winner === server) {
    // Server already holds the authoritative version; tell the client.
    return { outcome: 'conflict_resolved', serverState: server };
  }

  doc.set({
    status: winner.status,
    takenAt: winner.takenAt ? new Date(winner.takenAt) : null,
    snoozedUntil: winner.snoozedUntil ? new Date(winner.snoozedUntil) : null,
    snoozeCount: winner.snoozeCount,
    skipReason: winner.skipReason ?? null,
    rev: doc.rev + 1,
  });
  await doc.save();

  return { outcome: 'applied' };
}

/* ─────────────────────────── Medicine mutations ─────────────────────────── */

/**
 * Payloads are validated exactly as the REST routes validate them and written
 * through the same functions (see writes.ts). Until this, sync wrote the raw
 * payload into the database, so anything queued offline skipped validation
 * and could set server-owned fields.
 */
async function applyMedicineMutation(
  userId: string,
  mutation: SyncMutationInput,
): Promise<MutationOutcome> {
  if (mutation.operation === 'delete') {
    const archived = await Medicine.findOneAndUpdate(
      { _id: mutation.entityId, userId, archivedAt: null },
      { $set: { archivedAt: new Date() }, $inc: { rev: 1 } },
      { new: true },
    ).lean();
    if (!archived) return 'no_op';
    // Same as the REST path: clear unresolved future doses, keep history.
    await regenerateFutureDoses(toDomainMedicine(archived as unknown as MedicineSource));
    return 'applied';
  }

  const existing = await Medicine.findOne({ _id: mutation.entityId, userId });

  if (!existing) {
    if (mutation.operation === 'update') return 'no_op';
    // A create queued offline. `userId` comes from the session and the
    // timezone from the account, never the payload.
    const id = idSchema.parse(mutation.entityId);
    const input = createMedicineSchema.parse(mutation.payload);
    const created = await Medicine.create({
      _id: id,
      userId,
      ...medicineFields(input, await timezoneOf(userId)),
    });

    // The REST create materialises doses; the sync create used not to, so
    // every dose of a medicine added offline had nothing to attach to.
    const domain = toDomainMedicine(created.toObject() as unknown as MedicineSource);
    const today = todayIn(domain.timezone);
    await generateDosesForMedicine(domain, today, addDays(today, MATERIALISE_AHEAD_DAYS));
    return 'applied';
  }

  // Last-write-wins by device clock. Unlike doses there is no asymmetry to
  // preserve here — an edit to a medicine is a plain overwrite.
  if (existing.updatedAt.getTime() > new Date(mutation.clientUpdatedAt).getTime()) {
    return 'conflict_resolved';
  }

  const { scheduleChanged } = applyMedicineUpdate(existing, updateMedicineSchema.parse(mutation.payload));
  await existing.save();

  // A schedule edited offline must move future doses, exactly as the REST
  // update does — otherwise reminders follow the new times while the server
  // keeps generating the old ones.
  if (scheduleChanged) {
    await regenerateFutureDoses(toDomainMedicine(existing.toObject() as unknown as MedicineSource));
  }
  return 'applied';
}

/* ────────────────────────── Appointment mutations ───────────────────────── */

async function applyAppointmentMutation(
  userId: string,
  mutation: SyncMutationInput,
): Promise<MutationOutcome> {
  if (mutation.operation === 'delete') {
    const result = await Appointment.deleteOne({ _id: mutation.entityId, userId });
    return result.deletedCount > 0 ? 'applied' : 'no_op';
  }

  const existing = await Appointment.findOne({ _id: mutation.entityId, userId });
  const timezone = await timezoneOf(userId);

  if (!existing) {
    if (mutation.operation === 'update') return 'no_op';
    const id = idSchema.parse(mutation.entityId);
    const input = createAppointmentSchema.parse(mutation.payload);
    await Appointment.create({ _id: id, userId, ...appointmentFields(input, timezone) });
    return 'applied';
  }

  if (existing.updatedAt.getTime() > new Date(mutation.clientUpdatedAt).getTime()) {
    return 'conflict_resolved';
  }

  applyAppointmentUpdate(existing, updateAppointmentSchema.parse(mutation.payload), timezone);
  await existing.save();
  return 'applied';
}

async function timezoneOf(userId: string): Promise<string> {
  const user = await User.findById(userId).select({ timezone: 1 }).lean();
  if (!user) throw new Error('Account not found.');
  return user.timezone;
}

/* ────────────────────────────── Pull phase ──────────────────────────────── */

/**
 * Everything changed since the cursor.
 *
 * The cursor is a server timestamp, not a client one, so clock skew on the
 * device cannot cause it to miss changes. It is deliberately rewound by a
 * second to tolerate writes committing out of order within the same millisecond.
 */
export async function pullChanges(
  userId: string,
  since: string | undefined,
): Promise<Omit<SyncResponse, 'results'>> {
  const sinceDate = since ? new Date(new Date(since).getTime() - 1000) : new Date(0);
  const filter = { userId, updatedAt: { $gt: sinceDate } };

  const [medicines, doses, appointments] = await Promise.all([
    Medicine.find(filter).sort({ updatedAt: 1 }).limit(PULL_PAGE_SIZE).lean(),
    DoseEvent.find(filter).sort({ updatedAt: 1 }).limit(PULL_PAGE_SIZE).lean(),
    Appointment.find(filter).sort({ updatedAt: 1 }).limit(PULL_PAGE_SIZE).lean(),
  ]);

  const hasMore =
    medicines.length === PULL_PAGE_SIZE ||
    doses.length === PULL_PAGE_SIZE ||
    appointments.length === PULL_PAGE_SIZE;

  // When a page was truncated, the next cursor is the newest row actually sent,
  // so nothing between that row and "now" is skipped.
  const cursor = hasMore
    ? newestUpdatedAt([medicines, doses, appointments], sinceDate).toISOString()
    : new Date().toISOString();

  return {
    changes: {
      medicines: medicines.map(withId),
      doses: doses.map(withId),
      appointments: appointments.map(withId),
    },
    cursor,
    hasMore,
  };
}

function newestUpdatedAt(
  collections: { updatedAt: Date }[][],
  fallback: Date,
): Date {
  let newest = fallback;
  for (const rows of collections) {
    const last = rows[rows.length - 1];
    if (last && last.updatedAt > newest) newest = last.updatedAt;
  }
  return newest;
}

/** Rename `_id` to `id` so clients see one identifier shape everywhere. */
function withId<T extends { _id: unknown }>(row: T): Record<string, unknown> {
  const { _id, ...rest } = row as T & Record<string, unknown>;
  return { id: String(_id), ...rest };
}
