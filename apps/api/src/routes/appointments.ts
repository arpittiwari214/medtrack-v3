/**
 * Appointments and lab tests.
 *
 * Input arrives as wall-clock date and time; the API resolves it to a UTC
 * instant against the user's zone, and stores both. That way a reminder fires
 * at the right absolute moment while the UI still shows the time the patient
 * booked.
 */

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  createAppointmentSchema,
  toInstant,
  todayIn,
  updateAppointmentSchema,
} from '@medtrack/shared';
import { auth, requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { Appointment } from '../models/Appointment.js';
import { User } from '../models/User.js';

const router = Router();
router.use(requireAuth);

async function timezoneOf(userId: string): Promise<string> {
  const user = await User.findById(userId).select({ timezone: 1 }).lean();
  if (!user) throw AppError.unauthenticated('Please sign in again.');
  return user.timezone;
}

router.get('/', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const timezone = await timezoneOf(userId);
    const scope = req.query['scope'] === 'past' ? 'past' : 'upcoming';

    const appointments = await Appointment.find({
      userId,
      ...(scope === 'upcoming'
        ? { scheduledAt: { $gte: new Date() }, status: { $in: ['scheduled'] } }
        : { scheduledAt: { $lt: new Date() } }),
    })
      .sort({ scheduledAt: scope === 'upcoming' ? 1 : -1 })
      .limit(100)
      .lean();

    res.json({
      appointments: appointments.map(withId),
      today: todayIn(timezone),
      timezone,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', validate(createAppointmentSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const input = createAppointmentSchema.parse(req.body);
    const timezone = await timezoneOf(userId);

    const appointment = await Appointment.create({
      _id: input.id ?? randomUUID(),
      userId,
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
    });

    res.status(201).json({ appointment: appointment.toJSON() });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', validate(updateAppointmentSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const input = updateAppointmentSchema.parse(req.body);

    const appointment = await Appointment.findOne({ _id: req.params['id'], userId });
    if (!appointment) throw AppError.notFound('That appointment could not be found.');

    const timezone = await timezoneOf(userId);
    const rescheduled = input.localDate !== undefined || input.localTime !== undefined;

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

    if (rescheduled) {
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
      appointment.completedAt = input.status === 'completed' ? new Date() : null;
    }

    appointment.rev += 1;
    await appointment.save();

    res.json({ appointment: appointment.toJSON() });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const result = await Appointment.deleteOne({ _id: req.params['id'], userId });
    if (result.deletedCount === 0) {
      throw AppError.notFound('That appointment could not be found.');
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

function withId(row: Record<string, unknown>): Record<string, unknown> {
  const { _id, ...rest } = row;
  return { id: String(_id), ...rest };
}

export default router;
