/**
 * Medicine CRUD and refills.
 *
 * Every query is scoped by `userId` from the session, never from the request
 * body — that is what makes IDOR structurally impossible rather than something
 * each handler has to remember.
 */

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
  createMedicineSchema,
  dosesRemainingInStock,
  projectedRunOutDate,
  refillSchema,
  updateMedicineSchema,
} from '@medtrack/shared';
import { auth, requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { Medicine } from '../models/Medicine.js';
import { User } from '../models/User.js';
import {
  MATERIALISE_AHEAD_DAYS,
  generateDosesForMedicine,
  regenerateFutureDoses,
  toDomainMedicine,
  type MedicineSource,
} from '../services/doses.js';
import { addDays, todayIn } from '@medtrack/shared';

const router = Router();
router.use(requireAuth);

/** Fields whose change alters *when* doses fall, and so require regeneration. */
const SCHEDULE_FIELDS = ['schedule', 'missedAfterMinutes'] as const;

/* ─────────────────────────────── Read ──────────────────────────────────── */

router.get('/', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const includeArchived = req.query['includeArchived'] === 'true';

    const medicines = await Medicine.find({
      userId,
      ...(includeArchived ? {} : { archivedAt: null }),
    })
      .sort({ createdAt: -1 })
      .lean();

    // Supply projections are derived, not stored, so they cannot go stale.
    const enriched = medicines.map((doc) => {
      const domain = toDomainMedicine(doc as unknown as MedicineSource);
      return {
        ...withId(doc),
        dosesRemaining: dosesRemainingInStock(domain),
        projectedRunOut: projectedRunOutDate(domain),
      };
    });

    res.json({ medicines: enriched });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const medicine = await Medicine.findOne({ _id: req.params['id'], userId }).lean();
    if (!medicine) throw AppError.notFound('That medicine could not be found.');

    const domain = toDomainMedicine(medicine as unknown as MedicineSource);
    res.json({
      medicine: {
        ...withId(medicine),
        dosesRemaining: dosesRemainingInStock(domain),
        projectedRunOut: projectedRunOutDate(domain),
      },
    });
  } catch (error) {
    next(error);
  }
});

/* ─────────────────────────────── Create ────────────────────────────────── */

router.post('/', validate(createMedicineSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const input = createMedicineSchema.parse(req.body);

    const user = await User.findById(userId).select({ timezone: 1 }).lean();
    if (!user) throw AppError.unauthenticated('Please sign in again.');

    const medicine = await Medicine.create({
      // Accepting a client id lets an offline device create without waiting.
      _id: input.id ?? randomUUID(),
      userId,
      name: input.name,
      strength: input.strength,
      form: input.form,
      schedule: input.schedule,
      timezone: user.timezone,
      instructions: input.instructions ?? '',
      prescribedBy: input.prescribedBy ?? null,
      isCritical: input.isCritical,
      stock: input.stock ?? null,
      missedAfterMinutes: input.missedAfterMinutes ?? null,
    });

    // Materialise this medicine's doses only — v3 rebuilt every user's agenda
    // on every create, which made one write cost work proportional to the
    // whole platform.
    const today = todayIn(user.timezone);
    await generateDosesForMedicine(
      toDomainMedicine(medicine as unknown as MedicineSource),
      today,
      addDays(today, MATERIALISE_AHEAD_DAYS),
    );

    res.status(201).json({ medicine: medicine.toJSON() });
  } catch (error) {
    next(error);
  }
});

/* ─────────────────────────────── Update ────────────────────────────────── */

router.patch('/:id', validate(updateMedicineSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const input = updateMedicineSchema.parse(req.body);

    const medicine = await Medicine.findOne({ _id: req.params['id'], userId });
    if (!medicine) throw AppError.notFound('That medicine could not be found.');

    const scheduleChanged = SCHEDULE_FIELDS.some((field) => input[field] !== undefined);

    if (input.name !== undefined) medicine.name = input.name;
    if (input.strength !== undefined) medicine.strength = input.strength;
    if (input.form !== undefined) medicine.form = input.form;
    if (input.schedule !== undefined) medicine.schedule = input.schedule;
    if (input.instructions !== undefined) medicine.instructions = input.instructions;
    if (input.prescribedBy !== undefined) medicine.prescribedBy = input.prescribedBy ?? null;
    if (input.isCritical !== undefined) medicine.isCritical = input.isCritical;
    if (input.missedAfterMinutes !== undefined) {
      medicine.missedAfterMinutes = input.missedAfterMinutes ?? null;
    }
    if (input.stock !== undefined) {
      medicine.stock = input.stock ?? null;
      // Editing the supply re-arms the low-stock warning.
      medicine.lowStockNotifiedAt = null;
    }

    medicine.rev += 1;
    await medicine.save();

    if (scheduleChanged) {
      await regenerateFutureDoses(toDomainMedicine(medicine as unknown as MedicineSource));
    }

    res.json({ medicine: medicine.toJSON() });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────── Refill ─────────────────────────────────── */

router.post('/:id/refill', validate(refillSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const { units } = refillSchema.parse(req.body);

    const medicine = await Medicine.findOne({ _id: req.params['id'], userId });
    if (!medicine) throw AppError.notFound('That medicine could not be found.');
    if (!medicine.stock) {
      throw AppError.badRequest('Turn on supply tracking for this medicine first.');
    }

    medicine.stock.unitsRemaining += units;
    medicine.stock.lastRefillAt = new Date();
    medicine.stock.lastRefillUnits = units;
    // Clear the latch so the next genuine low point warns again.
    medicine.lowStockNotifiedAt = null;
    medicine.rev += 1;
    await medicine.save();

    const domain = toDomainMedicine(medicine as unknown as MedicineSource);
    res.json({
      medicine: medicine.toJSON(),
      dosesRemaining: dosesRemainingInStock(domain),
      projectedRunOut: projectedRunOutDate(domain),
    });
  } catch (error) {
    next(error);
  }
});

/* ────────────────────────────── Archive ────────────────────────────────── */

/**
 * Archive rather than delete.
 *
 * v3's delete removed the medicine *and* every dose log for it, silently
 * rewriting the patient's adherence history. Archiving keeps the record and
 * stops future doses being generated.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const medicine = await Medicine.findOne({ _id: req.params['id'], userId });
    if (!medicine) throw AppError.notFound('That medicine could not be found.');

    if (!medicine.archivedAt) {
      medicine.archivedAt = new Date();
      medicine.rev += 1;
      await medicine.save();
      // Drop only unresolved future doses; history is untouched.
      await regenerateFutureDoses(toDomainMedicine(medicine as unknown as MedicineSource));
    }

    res.json({ message: 'Medicine archived. Your history has been kept.' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const medicine = await Medicine.findOne({ _id: req.params['id'], userId });
    if (!medicine) throw AppError.notFound('That medicine could not be found.');

    medicine.archivedAt = null;
    medicine.rev += 1;
    await medicine.save();

    const domain = toDomainMedicine(medicine as unknown as MedicineSource);
    const today = todayIn(domain.timezone);
    await generateDosesForMedicine(domain, today, addDays(today, MATERIALISE_AHEAD_DAYS));

    res.json({ medicine: medicine.toJSON() });
  } catch (error) {
    next(error);
  }
});

function withId(row: Record<string, unknown>): Record<string, unknown> {
  const { _id, ...rest } = row;
  return { id: String(_id), ...rest };
}

export default router;
