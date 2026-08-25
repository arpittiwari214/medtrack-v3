/**
 * Doctor visits, lab tests and procedures.
 *
 * Stored the same way as doses: an authoritative UTC instant plus the
 * wall-clock values it was entered as, so a patient who travels still sees the
 * appointment at the local time it was booked for.
 */

import { randomUUID } from 'node:crypto';
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const appointmentSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    userId: { type: String, required: true, ref: 'User', index: true },

    kind: {
      type: String,
      required: true,
      enum: ['doctor', 'lab_test', 'procedure', 'vaccination', 'other'],
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },

    scheduledAt: { type: Date, required: true },
    localDate: { type: String, required: true },
    localTime: { type: String, required: true },
    timezone: { type: String, required: true },
    durationMinutes: { type: Number, required: true, default: 30, min: 5, max: 1440 },

    provider: { type: String, default: null, trim: true, maxlength: 200 },
    location: { type: String, default: null, trim: true, maxlength: 500 },
    notes: { type: String, default: null, trim: true, maxlength: 2000 },

    /** Minutes before `scheduledAt` to remind. `[1440, 60]` is a day and an hour ahead. */
    reminderOffsetsMinutes: { type: [Number], default: [1440, 60] },
    /** Offsets already delivered, so a restart does not re-send them. */
    remindersSentMinutes: { type: [Number], default: [] },

    status: {
      type: String,
      required: true,
      default: 'scheduled',
      enum: ['scheduled', 'completed', 'cancelled', 'missed'],
    },
    requiresFasting: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },

    rev: { type: Number, default: 1 },
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

/** The agenda query: a user's appointments over a window. */
appointmentSchema.index({ userId: 1, scheduledAt: 1 });

/** Backs the reminder sweep — only appointments that can still fire. */
appointmentSchema.index(
  { scheduledAt: 1 },
  {
    partialFilterExpression: { status: 'scheduled' },
    name: 'upcoming_appointments',
  },
);

appointmentSchema.index({ userId: 1, updatedAt: -1 });

export type AppointmentAttributes = InferSchemaType<typeof appointmentSchema>;
export type AppointmentDocument = HydratedDocument<AppointmentAttributes>;

export const Appointment = model('Appointment', appointmentSchema);
