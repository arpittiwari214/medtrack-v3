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
import { applyAppointmentUpdate, appointmentFields } from '../services/writes.js';
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
      ...appointmentFields(input, timezone),
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
    applyAppointmentUpdate(appointment, input, timezone);
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
