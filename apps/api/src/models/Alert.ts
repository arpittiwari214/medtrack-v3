/**
 * Caregiver-facing alerts.
 *
 * Delivery attempts are recorded per care link, including failures. v3 stored a
 * single `emailSent` boolean, so a caregiver who never received an alert looked
 * identical to one who did — the worst possible ambiguity in a system whose job
 * is to escalate.
 */

import { randomUUID } from 'node:crypto';
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const deliverySchema = new Schema(
  {
    careLinkId: { type: String, required: true },
    channel: { type: String, required: true, enum: ['email', 'push'] },
    status: { type: String, required: true, enum: ['sent', 'failed', 'skipped'] },
    error: { type: String, default: null, maxlength: 500 },
    attemptedAt: { type: Date, required: true },
  },
  { _id: false },
);

const alertSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },

    /** The patient the alert concerns. */
    patientId: { type: String, required: true, ref: 'User', index: true },

    kind: {
      type: String,
      required: true,
      enum: [
        'dose_missed',
        'consecutive_misses',
        'critical_dose_missed',
        'low_stock',
        'appointment_upcoming',
        'appointment_missed',
        'sos',
      ],
    },
    severity: { type: String, required: true, enum: ['info', 'warning', 'critical'] },

    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 2000 },

    medicineId: { type: String, default: null, ref: 'Medicine' },
    appointmentId: { type: String, default: null, ref: 'Appointment' },
    doseEventId: { type: String, default: null, ref: 'DoseEvent' },

    deliveries: { type: [deliverySchema], default: [] },

    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: String, default: null, ref: 'User' },

    /**
     * Coalescing key. Alerts that would repeat the same message within the
     * dedupe window share a key, so a caregiver is not notified twelve times
     * about one bad afternoon.
     */
    dedupeKey: { type: String, required: true },
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

/** The alerts list, newest first. */
alertSchema.index({ patientId: 1, createdAt: -1 });

/** Unacknowledged badge count. */
alertSchema.index({ patientId: 1, acknowledgedAt: 1 });

/**
 * Deduplication. A TTL-free unique index would block a legitimate repeat weeks
 * later, so uniqueness is scoped by including a time bucket in `dedupeKey`
 * itself (see `services/alerts.ts`).
 */
alertSchema.index({ dedupeKey: 1 }, { unique: true, name: 'uniq_alert_dedupe' });

export type AlertAttributes = InferSchemaType<typeof alertSchema>;

export const Alert = model('Alert', alertSchema);

/**
 * Derived from the model rather than written as `HydratedDocument<...>`.
 *
 * The schema sets `versionKey: false`, which `HydratedDocument` does not
 * account for, so the hand-written type and the type `Alert.create()` actually
 * returns disagree over `__v`.
 */
export type AlertDocument = ReturnType<(typeof Alert)['hydrate']>;
