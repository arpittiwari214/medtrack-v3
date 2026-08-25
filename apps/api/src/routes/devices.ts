/**
 * Device registration for push notifications.
 *
 * Registration is an upsert keyed on the push token, because the mobile app
 * re-registers on every launch. Keying on the token also handles a device
 * changing hands: the row is reassigned to the new user rather than leaving two
 * accounts pointing at one handset.
 */

import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { registerDeviceSchema } from '@medtrack/shared';
import { auth, requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { validate } from '../middleware/validate.js';
import { Device } from '../models/Device.js';

const router = Router();
router.use(requireAuth);

router.post('/', validate(registerDeviceSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const input = registerDeviceSchema.parse(req.body);

    const device = await Device.findOneAndUpdate(
      { pushToken: input.pushToken },
      {
        $set: {
          userId,
          platform: input.platform,
          timezone: input.timezone,
          appVersion: input.appVersion ?? null,
          lastSeenAt: new Date(),
          // A fresh registration clears any prior failure state.
          disabledAt: null,
          failureCount: 0,
        },
        $setOnInsert: { _id: input.id ?? randomUUID() },
      },
      { upsert: true, new: true },
    );

    res.json({ device: device.toJSON() });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const devices = await Device.find({ userId })
      .select({ platform: 1, appVersion: 1, lastSeenAt: 1, disabledAt: 1, timezone: 1 })
      .sort({ lastSeenAt: -1 })
      .lean();

    // Push tokens are deliberately not returned — a client never needs to read
    // one back, and they are credentials of a sort.
    res.json({
      devices: devices.map((d) => ({ ...d, id: String(d._id), _id: undefined })),
    });
  } catch (error) {
    next(error);
  }
});

/** Unregister — used on sign-out so a shared handset stops receiving alerts. */
router.delete('/:id', async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const result = await Device.deleteOne({ _id: req.params['id'], userId });
    if (result.deletedCount === 0) {
      throw AppError.notFound('That device could not be found.');
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
