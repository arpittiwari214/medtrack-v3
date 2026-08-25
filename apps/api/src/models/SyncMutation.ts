/**
 * Idempotency ledger for offline sync.
 *
 * An offline client queues mutations and replays them when it reconnects. Any
 * of those requests can be retried — flaky mobile network, app killed
 * mid-flight, user pulls to refresh — so applying one twice must be harmless.
 *
 * Each mutation carries a client-generated `mutationId`. Recording it under a
 * unique index means a replay is detected in the database rather than by
 * hopeful application logic, and the stored result is replayed back so the
 * client sees the same answer it would have got the first time.
 *
 * Rows expire after 30 days, comfortably longer than any device stays offline.
 */

import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const RETENTION_DAYS = 30;

const syncMutationSchema = new Schema(
  {
    /** Client-generated UUID. The idempotency key. */
    _id: { type: String, required: true },

    userId: { type: String, required: true, ref: 'User', index: true },

    entity: { type: String, required: true, enum: ['medicine', 'dose', 'appointment'] },
    operation: { type: String, required: true, enum: ['create', 'update', 'delete'] },
    entityId: { type: String, required: true },

    /** Outcome replayed verbatim when the same mutation arrives again. */
    result: {
      type: String,
      required: true,
      enum: ['applied', 'conflict_resolved', 'rejected', 'no_op'],
    },
    /** Present when `result` is `rejected`, so the client can surface why. */
    rejectionReason: { type: String, default: null, maxlength: 500 },

    /** When the device made the change, used for conflict resolution. */
    clientUpdatedAt: { type: Date, required: true },
    appliedAt: { type: Date, required: true, default: () => new Date() },

    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true, versionKey: false, _id: false },
);

/** Mongo reaps old entries; nothing to maintain. */
syncMutationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Diagnosing a device's replay history. */
syncMutationSchema.index({ userId: 1, appliedAt: -1 });

export type SyncMutationAttributes = InferSchemaType<typeof syncMutationSchema>;
export type SyncMutationDocument = HydratedDocument<SyncMutationAttributes>;

export const SyncMutation = model('SyncMutation', syncMutationSchema);
