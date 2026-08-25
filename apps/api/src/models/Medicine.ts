/**
 * A medicine and its dosing schedule.
 *
 * The schedule is stored as a recurrence rule rather than an expanded list of
 * times, so changing "every day at 08:00" to "every other day" is a single
 * update instead of a rewrite of every future row. Concrete occurrences are
 * derived by `@medtrack/shared`'s `expandMedicine`.
 */

import { randomUUID } from 'node:crypto';
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const scheduleSchema = new Schema(
  {
    kind: {
      type: String,
      required: true,
      enum: ['daily', 'interval_days', 'days_of_week', 'cyclic', 'as_needed'],
    },
    /** Wall-clock `HH:MM` values, interpreted in the medicine's timezone. */
    times: { type: [String], default: [] },
    startDate: { type: String, required: true },
    endDate: { type: String, default: null },
    intervalDays: { type: Number, default: null, min: 1, max: 365 },
    weekdays: { type: [Number], default: null },
    cycleOnDays: { type: Number, default: null, min: 1, max: 365 },
    cycleOffDays: { type: Number, default: null, min: 0, max: 365 },
  },
  { _id: false },
);

const stockSchema = new Schema(
  {
    unitsRemaining: { type: Number, required: true, min: 0 },
    unitsPerDose: { type: Number, required: true, min: 0.01 },
    lowThreshold: { type: Number, required: true, min: 0 },
    lastRefillAt: { type: Date, default: null },
    lastRefillUnits: { type: Number, default: null },
  },
  { _id: false },
);

const medicineSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    userId: { type: String, required: true, ref: 'User', index: true },

    name: { type: String, required: true, trim: true, maxlength: 200 },
    strength: { type: String, required: true, trim: true, maxlength: 100 },
    form: {
      type: String,
      required: true,
      default: 'tablet',
      enum: ['tablet', 'capsule', 'liquid', 'injection', 'inhaler', 'drops', 'patch', 'cream', 'other'],
    },

    schedule: { type: scheduleSchema, required: true },
    /** Snapshot of the owner's zone at write time, so the schedule stays anchored. */
    timezone: { type: String, required: true },

    instructions: { type: String, default: '', trim: true, maxlength: 1000 },
    prescribedBy: { type: String, default: null, trim: true, maxlength: 200 },
    isCritical: { type: Boolean, default: false },

    stock: { type: stockSchema, default: null },
    missedAfterMinutes: { type: Number, default: null, min: 5, max: 1440 },

    /** Soft delete: dose history stays meaningful after a course ends. */
    archivedAt: { type: Date, default: null },

    /** Bumped on every write; drives offline sync conflict resolution. */
    rev: { type: Number, default: 1 },

    /** Set once a low-stock alert fires, cleared on refill, so it fires once. */
    lowStockNotifiedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        ret['id'] = ret['_id'];
        delete ret['_id'];
        return ret;
      },
    },
  },
);

/** The dashboard query: a user's active medicines, newest first. */
medicineSchema.index({ userId: 1, archivedAt: 1, createdAt: -1 });

/** Backs the scheduler's "which medicines need doses generated" sweep. */
medicineSchema.index({ archivedAt: 1, 'schedule.kind': 1 });

/**
 * Stops the same medicine on the same schedule being added twice.
 *
 * v3 checked for duplicates with a read-then-write, which two concurrent
 * requests could both pass. A partial unique index makes the database enforce
 * it, and it only covers active rows so an archived course can be restarted.
 */
medicineSchema.index(
  { userId: 1, name: 1, 'schedule.startDate': 1 },
  {
    unique: true,
    partialFilterExpression: { archivedAt: null },
    collation: { locale: 'en', strength: 2 }, // case-insensitive
    name: 'uniq_active_medicine_per_user',
  },
);

export type MedicineAttributes = InferSchemaType<typeof medicineSchema>;
export type MedicineDocument = HydratedDocument<MedicineAttributes>;

export const Medicine = model('Medicine', medicineSchema);
