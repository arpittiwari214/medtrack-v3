/**
 * Dose listing and actions.
 *
 * The action endpoints are thin: every transition decision lives in the shared
 * state machine, so the rules cannot drift between the API, the web app and the
 * offline mobile cache.
 */

import { Router } from 'express';
import {
  byMedicine,
  dailySeries,
  insights,
  localeFrom,
  listDosesSchema,
  logAdHocDoseSchema,
  skipDoseSchema,
  snoozeDoseSchema,
  splitToday,
  summarise,
  takeDoseSchema,
  todayIn,
  addDays,
} from '@medtrack/shared';
import { auth, requireAuth } from '../middleware/auth.js';
import { validate, validated } from '../middleware/validate.js';
import { DoseEvent } from '../models/DoseEvent.js';
import { User } from '../models/User.js';
import { AppError } from '../middleware/error.js';
import { actOnDose, logAdHocDose, toDomainDose } from '../services/doses.js';

const router = Router();
router.use(requireAuth);

async function timezoneOf(userId: string): Promise<string> {
  const user = await User.findById(userId).select({ timezone: 1 }).lean();
  if (!user) throw AppError.unauthenticated('Please sign in again.');
  return user.timezone;
}

/* ─────────────────────────────── Listing ───────────────────────────────── */

router.get('/', validate(listDosesSchema, 'query'), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const query = validated(res, listDosesSchema, 'query');
    const timezone = await timezoneOf(userId);

    // Default to a window around today rather than an unbounded scan.
    const today = todayIn(timezone);
    const from = query.from ?? addDays(today, -30);
    const to = query.to ?? addDays(today, 7);

    const doses = await DoseEvent.find({
      userId,
      localDate: { $gte: from, $lte: to },
      ...(query.medicineId ? { medicineId: query.medicineId } : {}),
      ...(query.status ? { status: query.status } : {}),
    })
      .sort({ scheduledAt: 1 })
      .limit(query.limit)
      .lean();

    res.json({
      doses: doses.map((dose) => toDomainDose(dose as never)),
      window: { from, to, timezone },
    });
  } catch (error) {
    next(error);
  }
});

/** Today's agenda, pre-split for the dashboard. */
router.get('/today', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const timezone = await timezoneOf(userId);
    const today = todayIn(timezone);

    const doses = await DoseEvent.find({ userId, localDate: today })
      .sort({ scheduledAt: 1 })
      .lean();

    const domain = doses.map((dose) => toDomainDose(dose as never));
    res.json({ date: today, timezone, ...splitToday(domain, timezone, today) });
  } catch (error) {
    next(error);
  }
});

/* ─────────────────────────────── Analytics ─────────────────────────────── */

router.get('/analytics', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const timezone = await timezoneOf(userId);
    const today = todayIn(timezone);

    const days = Math.min(Number(req.query['days'] ?? 30) || 30, 365);
    const from = addDays(today, -(days - 1));

    const doses = await DoseEvent.find({
      userId,
      localDate: { $gte: from, $lte: today },
    }).lean();

    const domain = doses.map((dose) => toDomainDose(dose as never));
    const context = { timezone, today };

    res.json({
      window: { from, to: today, days, timezone },
      summary: summarise(domain, context),
      perMedicine: byMedicine(domain, context),
      daily: dailySeries(domain, from, today),
      // Tips are written on the server, so they come back in the reader's language.
      insights: insights(domain, context, localeFrom(String(req.query['locale'] ?? ''))),
    });
  } catch (error) {
    next(error);
  }
});

/* ──────────────────────────────── Actions ──────────────────────────────── */

router.post('/:id/take', validate(takeDoseSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const { takenAt } = takeDoseSchema.parse(req.body);
    const dose = await actOnDose(userId, String(req.params['id']), 'take', {
      // An offline client reports when the dose was *actually* taken, which is
      // not when the request arrived.
      ...(takenAt ? { at: new Date(takenAt) } : {}),
    });
    res.json({ dose });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/snooze', validate(snoozeDoseSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const { minutes } = snoozeDoseSchema.parse(req.body);
    const dose = await actOnDose(userId, String(req.params['id']), 'snooze', {
      snoozeMinutes: minutes,
    });
    res.json({ dose });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/skip', validate(skipDoseSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const { reason } = skipDoseSchema.parse(req.body);
    const dose = await actOnDose(userId, String(req.params['id']), 'skip', {
      skipReason: reason ?? null,
    });
    res.json({ dose });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/undo', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const dose = await actOnDose(userId, String(req.params['id']), 'undo');
    res.json({ dose });
  } catch (error) {
    next(error);
  }
});

/** Log an unscheduled dose of an `as_needed` medicine. */
router.post('/ad-hoc', validate(logAdHocDoseSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const input = logAdHocDoseSchema.parse(req.body);
    const dose = await logAdHocDose(
      userId,
      input.medicineId,
      input.takenAt ? new Date(input.takenAt) : new Date(),
      input.id,
    );
    res.status(201).json({ dose });
  } catch (error) {
    next(error);
  }
});

export default router;
