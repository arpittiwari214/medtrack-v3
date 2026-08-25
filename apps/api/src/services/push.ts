/**
 * Expo push notifications.
 *
 * Division of labour, which is what makes reminders actually reliable:
 *
 *  - **Dose reminders are scheduled *on the device*** as local notifications by
 *    the mobile app. They fire with the app closed, the phone locked, and no
 *    network — none of which server push can guarantee.
 *  - **Server push carries what the device cannot know**: caregiver alerts, SOS,
 *    and a nudge to re-sync when a schedule changed elsewhere.
 *
 * Expo tickets are asynchronous: a successful send returns a ticket, and the
 * real delivery verdict arrives later from the receipts endpoint. Tokens that
 * come back `DeviceNotRegistered` are disabled so a stale token is not retried
 * forever.
 */

import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { env } from '../config/env.js';
import { childLogger } from '../config/logger.js';
import { Device } from '../models/Device.js';

const log = childLogger('push');

/** Expo rejects a device after repeated failures; stop trying well before that. */
const MAX_FAILURES = 5;

let client: Expo | null = null;

function getClient(): Expo {
  if (!client) {
    client = new Expo(
      env.EXPO_ACCESS_TOKEN ? { accessToken: env.EXPO_ACCESS_TOKEN } : {},
    );
  }
  return client;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Routed by the app to open the right screen. */
  data?: Record<string, unknown>;
  /** `critical` maps to a high-priority, sound-on notification. */
  priority?: 'default' | 'high';
  /** Unread badge count for iOS. */
  badge?: number;
}

export interface PushResult {
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Send to every active device belonging to a user.
 *
 * Returns counts rather than throwing: a caregiver alert must still be recorded
 * in-app when push fails, so callers treat delivery as best-effort and log the
 * outcome against the alert.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  const devices = await Device.find({ userId, disabledAt: null })
    .select({ pushToken: 1 })
    .lean();

  if (devices.length === 0) return { sent: 0, failed: 0, skipped: 0 };

  const valid: string[] = [];
  let skipped = 0;

  for (const device of devices) {
    const token = String(device.pushToken);
    if (Expo.isExpoPushToken(token)) valid.push(token);
    else {
      skipped++;
      // A token that is not even well-formed will never work — retire it.
      await disableDevice(token, 'malformed token');
    }
  }

  if (valid.length === 0) return { sent: 0, failed: 0, skipped };

  const messages: ExpoPushMessage[] = valid.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: payload.priority === 'high' ? 'default' : null,
    priority: payload.priority === 'high' ? 'high' : 'default',
    ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
    // Android needs a channel that the app has registered for the heads-up
    // treatment a medication alert warrants.
    channelId: payload.priority === 'high' ? 'alerts' : 'default',
  }));

  return deliver(messages, valid);
}

async function deliver(messages: ExpoPushMessage[], tokens: string[]): Promise<PushResult> {
  const expo = getClient();
  const chunks = expo.chunkPushNotifications(messages);

  let sent = 0;
  let failed = 0;
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    try {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...chunkTickets);
    } catch (error) {
      // A whole chunk failing is a transport problem, not a per-token one.
      failed += chunk.length;
      log.error({ err: (error as Error).message, count: chunk.length }, 'Push chunk failed');
    }
  }

  for (const [index, ticket] of tickets.entries()) {
    if (ticket.status === 'ok') {
      sent++;
      continue;
    }
    failed++;
    const token = tokens[index];
    const reason = ticket.details?.error;
    log.warn({ reason, message: ticket.message }, 'Push ticket rejected');

    if (token && reason === 'DeviceNotRegistered') {
      await disableDevice(token, 'DeviceNotRegistered');
    } else if (token) {
      await recordFailure(token);
    }
  }

  return { sent, failed, skipped: 0 };
}

/** Retire a token permanently — the app was uninstalled or the token is invalid. */
async function disableDevice(pushToken: string, reason: string): Promise<void> {
  await Device.updateOne(
    { pushToken },
    { $set: { disabledAt: new Date() }, $inc: { failureCount: 1 } },
  );
  log.info({ reason }, 'Device push token disabled');
}

/** Count a transient failure; disable once it stops looking transient. */
async function recordFailure(pushToken: string): Promise<void> {
  const device = await Device.findOneAndUpdate(
    { pushToken },
    { $inc: { failureCount: 1 } },
    { new: true, projection: { failureCount: 1 } },
  ).lean();

  if (device && device.failureCount >= MAX_FAILURES) {
    await disableDevice(pushToken, `${MAX_FAILURES} consecutive failures`);
  }
}

/** Clear the failure counter after a device checks in successfully. */
export async function markDeviceHealthy(pushToken: string): Promise<void> {
  await Device.updateOne(
    { pushToken },
    { $set: { failureCount: 0, disabledAt: null, lastSeenAt: new Date() } },
  );
}

/** Ask a user's devices to pull fresh data, without showing a notification. */
export async function pushSyncHint(userId: string): Promise<PushResult> {
  return pushToUser(userId, {
    title: '',
    body: '',
    data: { type: 'sync_hint' },
    priority: 'default',
  });
}
