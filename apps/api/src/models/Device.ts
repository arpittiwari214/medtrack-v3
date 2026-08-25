/**
 * A registered device and its push token.
 *
 * The mobile app schedules its own local notifications, which is what makes
 * reminders fire offline and on time. Server push is used for the things the
 * device cannot know about on its own — caregiver alerts, SOS, and a backstop
 * when a device has been out of contact.
 */

import { randomUUID } from 'node:crypto';
import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const deviceSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    userId: { type: String, required: true, ref: 'User', index: true },

    platform: { type: String, required: true, enum: ['ios', 'android', 'web'] },
    /** Expo push token, or a Web Push endpoint. Unique across all users. */
    pushToken: { type: String, required: true },

    /** The device's own zone, which can differ from the account's when travelling. */
    timezone: { type: String, required: true },
    appVersion: { type: String, default: null, maxlength: 50 },

    lastSeenAt: { type: Date, required: true, default: () => new Date() },

    /**
     * Set when Expo reports the token as unregistered (app uninstalled). Kept
     * rather than deleted so repeated failures do not retry forever.
     */
    disabledAt: { type: Date, default: null },
    failureCount: { type: Number, default: 0 },
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

/**
 * A push token identifies one installation. Re-registering the same token —
 * which happens on every app launch — updates the existing row instead of
 * accumulating duplicates that would push the same alert several times.
 */
deviceSchema.index({ pushToken: 1 }, { unique: true });

/** Fan-out lookup when sending to a user's active devices. */
deviceSchema.index({ userId: 1, disabledAt: 1 });

export type DeviceAttributes = InferSchemaType<typeof deviceSchema>;
export type DeviceDocument = HydratedDocument<DeviceAttributes>;

export const Device = model('Device', deviceSchema);
