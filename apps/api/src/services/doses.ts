/**
 * Dose materialisation and state changes.
 *
 * Occurrences are derived from a medicine's recurrence rule by
 * `@medtrack/shared`, then written with the deterministic id that rule
 * produces. Because the id is a pure function of `(medicineId, instant)`, the
 * write is an idempotent upsert: regenerating a window that already exists
 * changes nothing, and no read-then-create race is possible.
 *
 * v3 regenerated *every user's* doses on every medicine write
 * (`Medicine.find({active: true})` with no user filter) and issued one query
 * per dose slot. Everything here is scoped to one user and batched.
 */

import {
  DEFAULT_MISSED_AFTER_MINUTES,
  addDays,
  applyDoseAction,
  expandMedicine,
  isLowStock,
  plannedDoseFor,
  todayIn,
  type DoseAction,
  type DoseEvent as DoseEventShape,
  type Medicine as MedicineShape,
  type PlannedDose,
} from '@medtrack/shared';
import type { AnyBulkWriteOperation } from 'mongoose';
import { childLogger } from '../config/logger.js';
import { AppError } from '../middleware/error.js';
import { DoseEvent, type DoseEventAttributes } from '../models/DoseEvent.js';
import { Medicine, type MedicineDocument } from '../models/Medicine.js';

const log = childLogger('doses');

/**
 * How far ahead doses are materialised.
 *
 * Long enough that a device syncing weekly always has a full agenda, short
 * enough that a schedule change does not rewrite months of rows.
 */
export const MATERIALISE_AHEAD_DAYS = 30;

/* ──────────────────────── Model ⇄ domain conversion ─────────────────────── */

/**
 * The fields `toDomainMedicine` reads.
 *
 * Declared structurally rather than as a Mongoose-derived type: hydrated
 * documents, `.lean()` results and `.toObject()` output all satisfy this, and
 * it does not break when Mongoose's inference changes shape between versions.
 */
export interface MedicineSource {
  _id: unknown;
  userId: unknown;
  name: string;
  strength: string;
  form: string;
  timezone: string;
  isCritical: boolean;
  instructions?: string | null | undefined;
  prescribedBy?: string | null | undefined;
  missedAfterMinutes?: number | null | undefined;
  archivedAt?: Date | string | null | undefined;
  createdAt: Date | string;
  updatedAt: Date | string;
  rev: number;
  stock?: {
    unitsRemaining: number;
    unitsPerDose: number;
    lowThreshold: number;
    lastRefillAt?: Date | string | null | undefined;
    lastRefillUnits?: number | null | undefined;
  } | null | undefined;
  schedule: {
    kind: string;
    times: string[];
    startDate: string;
    endDate?: string | null | undefined;
    intervalDays?: number | null | undefined;
    weekdays?: number[] | null | undefined;
    cycleOnDays?: number | null | undefined;
    cycleOffDays?: number | null | undefined;
  };
}

/** Convert a stored medicine to the plain shape the scheduling engine expects. */
export function toDomainMedicine(doc: MedicineSource): MedicineShape {
  return {
    id: String(doc._id),
    userId: String(doc.userId),
    name: doc.name,
    strength: doc.strength,
    form: doc.form as MedicineShape['form'],
    timezone: doc.timezone,
    isCritical: doc.isCritical,
    instructions: doc.instructions ?? '',
    prescribedBy: doc.prescribedBy ?? null,
    missedAfterMinutes: doc.missedAfterMinutes ?? null,
    archivedAt: doc.archivedAt ? new Date(doc.archivedAt).toISOString() : null,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
    rev: doc.rev,
    stock: doc.stock
      ? {
          unitsRemaining: doc.stock.unitsRemaining,
          unitsPerDose: doc.stock.unitsPerDose,
          lowThreshold: doc.stock.lowThreshold,
          lastRefillAt: doc.stock.lastRefillAt ? new Date(doc.stock.lastRefillAt).toISOString() : null,
          lastRefillUnits: doc.stock.lastRefillUnits ?? null,
        }
      : null,
    schedule: {
      kind: doc.schedule.kind as MedicineShape['schedule']['kind'],
      times: doc.schedule.times,
      startDate: doc.schedule.startDate,
      endDate: doc.schedule.endDate ?? null,
      intervalDays: doc.schedule.intervalDays ?? null,
      weekdays: (doc.schedule.weekdays ?? null) as MedicineShape['schedule']['weekdays'],
      cycleOnDays: doc.schedule.cycleOnDays ?? null,
      cycleOffDays: doc.schedule.cycleOffDays ?? null,
    },
  };
}

/** Convert a stored dose to the plain shape the state machine expects. */
export function toDomainDose(doc: DoseEventAttributes): DoseEventShape {
  return {
    id: String(doc._id),
    userId: String(doc.userId),
    medicineId: String(doc.medicineId),
    scheduledAt: new Date(doc.scheduledAt).toISOString(),
    localDate: doc.localDate,
    localTime: doc.localTime,
    timezone: doc.timezone,
    status: doc.status as DoseEventShape['status'],
    takenAt: doc.takenAt ? new Date(doc.takenAt).toISOString() : null,
    snoozedUntil: doc.snoozedUntil ? new Date(doc.snoozedUntil).toISOString() : null,
    snoozeCount: doc.snoozeCount,
    skipReason: doc.skipReason ?? null,
    medicineName: doc.medicineName,
    medicineStrength: doc.medicineStrength ?? '',
    isCritical: doc.isCritical,
    isAdHoc: doc.isAdHoc,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
    rev: doc.rev,
  };
}

/* ─────────────────────────── Materialisation ────────────────────────────── */

function plannedToUpsert(planned: PlannedDose, graceMinutes: number): AnyBulkWriteOperation {
  return {
    updateOne: {
      filter: { _id: planned.id },
      update: {
        // Only set on insert: an existing dose may already be taken, and
        // regeneration must never overwrite the patient's own record.
        $setOnInsert: {
          _id: planned.id,
          userId: planned.userId,
          medicineId: planned.medicineId,
          scheduledAt: new Date(planned.scheduledAt),
          localDate: planned.localDate,
          localTime: planned.localTime,
          timezone: planned.timezone,
          missedAt: new Date(planned.missedAt),
          graceMinutes,
          medicineName: planned.medicineName,
          medicineStrength: planned.medicineStrength,
          isCritical: planned.isCritical,
          status: 'scheduled',
          takenAt: null,
          snoozedUntil: null,
          snoozeCount: 0,
          skipReason: null,
          isAdHoc: false,
          missAlertedAt: null,
          rev: 1,
        },
      },
      upsert: true,
    },
  };
}

/** Materialise one medicine's doses over a window. Safe to call repeatedly. */
export async function generateDosesForMedicine(
  medicine: MedicineShape,
  from: string,
  to: string,
): Promise<number> {
  const planned = expandMedicine(medicine, { from, to });
  if (planned.length === 0) return 0;

  const grace = graceMinutesFor(medicine);
  const result = await DoseEvent.bulkWrite(
    planned.map((dose) => plannedToUpsert(dose, grace)),
    { ordered: false },
  );
  return result.upsertedCount;
}

/**
 * Materialise one specific dose by its deterministic id, if it names a real
 * occurrence of `medicine`. Returns whether the dose now exists.
 *
 * Used when a client acts on a dose the server has not generated yet — most
 * often a medicine created offline, or a reminder further ahead than the
 * materialisation window. Uses the same insert-only upsert as the batch path,
 * so it can never overwrite a dose the patient already acted on.
 */
export async function materialiseDose(medicine: MedicineShape, doseId: string): Promise<boolean> {
  const planned = plannedDoseFor(medicine, doseId);
  if (!planned) return false;
  await DoseEvent.bulkWrite([plannedToUpsert(planned, graceMinutesFor(medicine))]);
  return true;
}

/**
 * Materialise every active medicine for one user.
 *
 * Scoped to the user, unlike v3, so adding a medicine costs work proportional
 * to that person's regimen rather than to the whole platform's.
 */
export async function generateDosesForUser(
  userId: string,
  timezone: string,
  aheadDays = MATERIALISE_AHEAD_DAYS,
): Promise<number> {
  const medicines = await Medicine.find({ userId, archivedAt: null }).lean();
  if (medicines.length === 0) return 0;

  const today = todayIn(timezone);
  const to = addDays(today, aheadDays);

  const planned = medicines.flatMap((doc) => {
    const domain = toDomainMedicine(doc as unknown as MedicineSource);
    const grace = graceMinutesFor(domain);
    return expandMedicine(domain, { from: today, to }).map((dose) => ({ dose, grace }));
  });
  if (planned.length === 0) return 0;

  const result = await DoseEvent.bulkWrite(
    planned.map(({ dose, grace }) => plannedToUpsert(dose, grace)),
    { ordered: false },
  );
  if (result.upsertedCount > 0) {
    log.debug({ userId, created: result.upsertedCount }, 'Doses materialised');
  }
  return result.upsertedCount;
}

/**
 * Rebuild future doses after a schedule change.
 *
 * Only *unresolved future* doses are removed. Anything the patient already
 * acted on, and anything in the past, is history and stays — deleting it would
 * silently rewrite their adherence record.
 */
export async function regenerateFutureDoses(medicine: MedicineShape): Promise<{
  removed: number;
  created: number;
}> {
  const now = new Date();

  const removal = await DoseEvent.deleteMany({
    medicineId: medicine.id,
    scheduledAt: { $gt: now },
    status: { $in: ['scheduled', 'snoozed'] },
  });

  const today = todayIn(medicine.timezone);
  const created = await generateDosesForMedicine(
    medicine,
    today,
    addDays(today, MATERIALISE_AHEAD_DAYS),
  );

  log.info(
    { medicineId: medicine.id, removed: removal.deletedCount, created },
    'Future doses regenerated after schedule change',
  );
  return { removed: removal.deletedCount, created };
}

/* ──────────────────────────── State changes ─────────────────────────────── */

export interface ActionOptions {
  at?: Date;
  snoozeMinutes?: number;
  skipReason?: string | null;
}

/**
 * Apply a patient action to one of their doses.
 *
 * The transition itself is decided by the shared state machine, so the API,
 * the web app and the offline mobile cache all agree on what is legal. Stock is
 * decremented here rather than in the state machine, since only the server owns
 * the running total.
 */
export async function actOnDose(
  userId: string,
  doseId: string,
  action: DoseAction,
  options: ActionOptions = {},
): Promise<DoseEventShape> {
  const doc = await DoseEvent.findOne({ _id: doseId, userId });
  if (!doc) throw AppError.notFound('That dose could not be found.');

  const before = toDomainDose(doc.toObject());
  const patch = applyDoseAction(before, {
    action,
    ...(options.at ? { at: options.at } : {}),
    ...(options.snoozeMinutes !== undefined ? { snoozeMinutes: options.snoozeMinutes } : {}),
    ...(options.skipReason !== undefined ? { skipReason: options.skipReason } : {}),
  });

  const graceMs = doc.graceMinutes * 60_000;

  /**
   * Keep `missedAt` aligned with the dose's *effective* due time.
   *
   * The sweep is an indexed range query over `missedAt`, so if snoozing did not
   * move it the deferred dose would be flagged missed against its original
   * time — reintroducing v3's behaviour by a different route.
   */
  const nextMissedAt = patch.snoozedUntil
    ? new Date(new Date(patch.snoozedUntil).getTime() + graceMs)
    : action === 'undo'
      ? new Date(doc.scheduledAt.getTime() + graceMs)
      : doc.missedAt;

  doc.set({
    ...patch,
    takenAt: patch.takenAt ? new Date(patch.takenAt) : patch.takenAt === null ? null : doc.takenAt,
    snoozedUntil: patch.snoozedUntil
      ? new Date(patch.snoozedUntil)
      : patch.snoozedUntil === null
        ? null
        : doc.snoozedUntil,
    missedAt: nextMissedAt,
    // Undo returns the dose to the reminder queue, so let it alert again.
    ...(action === 'undo' ? { missAlertedAt: null } : {}),
    rev: doc.rev + 1,
  });
  await doc.save();

  await applyStockEffect(before.status, doc.status, String(doc.medicineId), userId);

  return toDomainDose(doc.toObject());
}

/**
 * Keep the supply count in step with dose state.
 *
 * Consumption is tied to the *transition*, not the resulting state, so undoing
 * a dose gives the units back exactly once and re-taking it deducts once.
 */
async function applyStockEffect(
  fromStatus: string,
  toStatus: string,
  medicineId: string,
  userId: string,
): Promise<void> {
  const wasConsumed = fromStatus === 'taken';
  const isConsumed = toStatus === 'taken';
  if (wasConsumed === isConsumed) return;

  const medicine = await Medicine.findOne({ _id: medicineId, userId });
  if (!medicine?.stock) return;

  const delta = isConsumed ? -medicine.stock.unitsPerDose : medicine.stock.unitsPerDose;
  const next = Math.max(0, medicine.stock.unitsRemaining + delta);

  medicine.stock.unitsRemaining = next;
  // Re-arm the low-stock alert once the supply climbs back above the line.
  if (!isLowStock(toDomainMedicine(medicine))) medicine.lowStockNotifiedAt = null;
  await medicine.save();
}

/** Record an unscheduled dose of an `as_needed` medicine. */
export async function logAdHocDose(
  userId: string,
  medicineId: string,
  takenAt: Date,
  id?: string,
): Promise<DoseEventShape> {
  const medicine = await Medicine.findOne({ _id: medicineId, userId, archivedAt: null });
  if (!medicine) throw AppError.notFound('That medicine could not be found.');

  const localDate = todayIn(medicine.timezone, takenAt);
  const doseId = id ?? `${medicineId}_adhoc_${takenAt.getTime()}`;

  const created = await DoseEvent.findOneAndUpdate(
    { _id: doseId },
    {
      $setOnInsert: {
        _id: doseId,
        userId,
        medicineId,
        scheduledAt: takenAt,
        localDate,
        localTime: new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: medicine.timezone,
        }).format(takenAt),
        timezone: medicine.timezone,
        // Ad-hoc doses are taken by definition — they are logged after the fact.
        status: 'taken',
        takenAt,
        snoozedUntil: null,
        snoozeCount: 0,
        skipReason: null,
        medicineName: medicine.name,
        medicineStrength: medicine.strength,
        isCritical: medicine.isCritical,
        isAdHoc: true,
        // Already taken, so it can never become missed; both fields exist only
        // to satisfy the schema and keep the sweep's index shape uniform.
        missedAt: takenAt,
        graceMinutes: graceMinutesFor(medicine),
        missAlertedAt: null,
        rev: 1,
      },
    },
    { upsert: true, new: true },
  );

  await applyStockEffect('scheduled', 'taken', medicineId, userId);
  return toDomainDose(created.toObject());
}

/** Grace period for a medicine, falling back to the platform default. */
export function graceMinutesFor(medicine: { missedAfterMinutes?: number | null }): number {
  return medicine.missedAfterMinutes ?? DEFAULT_MISSED_AFTER_MINUTES;
}
