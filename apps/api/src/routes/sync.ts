/**
 * Offline sync endpoint.
 *
 * One round trip does both directions: the client pushes its queued mutations
 * and receives everything that changed server-side since its cursor. Doing it
 * in a single call means the client cannot end up having pushed but not pulled,
 * which is the state that produces visible flicker and phantom conflicts.
 */

import { Router } from 'express';
import { syncRequestSchema } from '@medtrack/shared';
import { auth, requireAuth } from '../middleware/auth.js';
import { syncLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { User } from '../models/User.js';
import { applyMutations, pullChanges } from '../services/sync.js';
import { materialiseForUser } from '../services/scheduler.js';

const router = Router();
router.use(requireAuth);

router.post('/', syncLimiter, validate(syncRequestSchema), async (req, res, next) => {
  try {
    const { userId } = auth(req);
    const input = syncRequestSchema.parse(req.body);

    // A device that has travelled reports its zone; keeping the account in step
    // means future doses land at the right local time.
    if (input.timezone) {
      await User.updateOne(
        { _id: userId, timezone: { $ne: input.timezone } },
        { $set: { timezone: input.timezone } },
      );
    }

    // Push first, so the pull that follows already reflects the client's own
    // changes and it does not receive a stale view of what it just sent.
    const results = await applyMutations(userId, input.mutations);

    // Top up the agenda before pulling, so a device that has been offline for
    // a while receives a full forward schedule in the same response.
    await materialiseForUser(userId);

    const { changes, cursor, hasMore } = await pullChanges(userId, input.since);

    res.json({ results, changes, cursor, hasMore, serverTime: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

export default router;
