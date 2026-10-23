/**
 * The one place medicines and appointments are written from client input.
 *
 * REST routes and offline sync used to each do this themselves, and they had
 * drifted apart: sync wrote its payload straight into the database with no
 * validation at all, so anything a client queued offline bypassed every rule
 * the REST routes enforce — dose limits, length caps, the colour list — and
 * could set server-owned fields such as `lowStockNotifiedAt` or `archivedAt`.
 * Both paths now parse with the same shared schemas and write through these
 * functions, so there is one definition of a valid write.
 */

import {
  toInstant,
  updateAppointmentSchema,
  type CreateAppointmentInput,
  type CreateMedicineInput,
  type UpdateMedicineInput,
} from '@medtrack/shared';
import type { z } from 'zod';
import type { Appointment } from '../models/Appointment.js';
import type { Medicine } from '../models/Medicine.js';

type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

/** Fields that move doses, so changing them must regenerate future doses. */
const SCHEDULE_FIELDS = ['schedule', 'missedAfterMinutes'] as const;

/* ───────────────────────────────── Medicines ────────────────────────────── */

/**
 * Document fields for a new medicine. `timezone` is the owner's, never the
 * client's — the schedule's wall-clock times are anchored to it.
 */
export function medicineFields(input: CreateMedicineInput, timezone: string) {
  return {
    name: input.name,
    strength: input.strength,
    form: input.form,
    schedule: input.schedule,
    timezone,
    instructions: input.instructions ?? '',
    prescribedBy: input.prescribedBy ?? null,
    isCritical: input.isCritical,
    pillColor: input.pillColor ?? null,
    stripColor: input.stripColor ?? null,
    purpose: input.purpose ?? null,
    person: input.person ?? null,
    stock: input.stock ?? null,
    missedAfterMinutes: input.missedAfterMinutes ?? null,
  };
}

/** Apply a validated update. Returns whether future doses must be regenerated. */
export function applyMedicineUpdate(
  medicine: InstanceType<typeof Medicine>,
  input: UpdateMedicineInput,
): { scheduleChanged: boolean } {
  const scheduleChanged = SCHEDULE_FIELDS.some((field) => input[field] !== undefined);

  if (input.name !== undefined) medicine.name = input.name;
  if (input.strength !== undefined) medicine.strength = input.strength;
  if (input.form !== undefined) medicine.form = input.form;
  if (input.schedule !== undefined) medicine.schedule = input.schedule;
  if (input.instructions !== undefined) medicine.instructions = input.instructions;
  if (input.prescribedBy !== undefined) medicine.prescribedBy = input.prescribedBy ?? null;
  if (input.isCritical !== undefined) medicine.isCritical = input.isCritical;
  if (input.pillColor !== undefined) medicine.pillColor = input.pillColor ?? null;
  if (input.stripColor !== undefined) medicine.stripColor = input.stripColor ?? null;
  if (input.purpose !== undefined) medicine.purpose = input.purpose ?? null;
  if (input.person !== undefined) medicine.person = input.person ?? null;
  if (input.missedAfterMinutes !== undefined) {
    medicine.missedAfterMinutes = input.missedAfterMinutes ?? null;
  }
  if (input.stock !== undefined) {
    medicine.stock = input.stock ?? null;
    // Editing the supply re-arms the low-stock warning.
    medicine.lowStockNotifiedAt = null;
  }

  medicine.rev += 1;
  return { scheduleChanged };
}

/* ─────────────────────────────── Appointments ───────────────────────────── */

export function appointmentFields(input: CreateAppointmentInput, timezone: string) {
  return {
    kind: input.kind,
    title: input.title,
    // The single source of truth for when this actually happens.
    scheduledAt: toInstant(input.localDate, input.localTime, timezone),
    localDate: input.localDate,
    localTime: input.localTime,
    timezone,
    durationMinutes: input.durationMinutes,
    provider: input.provider ?? null,
    location: input.location ?? null,
    notes: input.notes ?? null,
    reminderOffsetsMinutes: input.reminderOffsetsMinutes,
    requiresFasting: input.requiresFasting,
  };
}

export function applyAppointmentUpdate(
  appointment: InstanceType<typeof Appointment>,
  input: UpdateAppointmentInput,
  timezone: string,
): void {
  if (input.title !== undefined) appointment.title = input.title;
  if (input.kind !== undefined) appointment.kind = input.kind;
  if (input.provider !== undefined) appointment.provider = input.provider ?? null;
  if (input.location !== undefined) appointment.location = input.location ?? null;
  if (input.notes !== undefined) appointment.notes = input.notes ?? null;
  if (input.durationMinutes !== undefined) appointment.durationMinutes = input.durationMinutes;
  if (input.requiresFasting !== undefined) appointment.requiresFasting = input.requiresFasting;
  if (input.reminderOffsetsMinutes !== undefined) {
    appointment.reminderOffsetsMinutes = input.reminderOffsetsMinutes;
    appointment.remindersSentMinutes = [];
  }

  if (input.localDate !== undefined || input.localTime !== undefined) {
    const localDate = input.localDate ?? appointment.localDate;
    const localTime = input.localTime ?? appointment.localTime;
    appointment.localDate = localDate;
    appointment.localTime = localTime;
    appointment.timezone = timezone;
    appointment.scheduledAt = toInstant(localDate, localTime, timezone);
    // Moving the appointment re-arms every reminder.
    appointment.remindersSentMinutes = [];
  }

  if (input.status !== undefined) {
    appointment.status = input.status;
    // Server-set, not taken from the client, which could backdate it.
    appointment.completedAt = input.status === 'completed' ? new Date() : null;
  }

  appointment.rev += 1;
}
