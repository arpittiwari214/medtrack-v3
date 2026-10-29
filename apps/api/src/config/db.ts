/**
 * MongoDB connection lifecycle.
 *
 * v3 called `process.exit(1)` the moment the first connect attempt failed,
 * which on a hosted platform produces a crash loop that looks identical to a
 * hung service from the outside — the failure mode that took its backend down.
 * Here the initial connect is retried with backoff, and once connected Mongoose
 * handles reconnection itself, so a brief Atlas blip does not kill the process.
 */

import mongoose from 'mongoose';
import { env, isTest } from './env.js';
import { childLogger } from './logger.js';

const log = childLogger('db');

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

mongoose.set('strictQuery', true);
// Reject unknown fields rather than silently dropping them, so a client typo
// surfaces as an error instead of data that quietly never saved.
mongoose.set('strict', 'throw');

/**
 * Note on `sanitizeFilter`: deliberately NOT enabled.
 *
 * It wraps any `$`-keyed value in `$eq`, which mangles legitimate operator
 * queries written in application code — `{missedAt: {$lte: date}}` becomes
 * `{missedAt: {$eq: {$lte: date}}}` and fails to cast. It is meant for filters
 * assembled directly from request bodies, which this codebase never does:
 * every request is parsed through a Zod schema first, so a value reaching a
 * query is already a known primitive and cannot smuggle an operator in.
 */

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await mongoose.connect(uri, {
        ...(env.MONGODB_DB_NAME ? { dbName: env.MONGODB_DB_NAME } : {}),
        serverSelectionTimeoutMS: 10_000,
        // Bound the pool so a burst cannot exhaust an Atlas shared tier.
        maxPoolSize: 20,
        minPoolSize: 2,
        // Index builds race when several instances boot at once, so they are
        // run deliberately by `ensureIndexes()` instead of on model load.
        autoIndex: false,
      });

      log.info({ host: mongoose.connection.host, db: mongoose.connection.name }, 'MongoDB connected');
      registerConnectionHandlers();
      return;
    } catch (error) {
      const isLast = attempt === MAX_ATTEMPTS;
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      log.error(
        { attempt, maxAttempts: MAX_ATTEMPTS, err: (error as Error).message },
        isLast ? 'MongoDB connection failed, giving up' : `MongoDB connection failed, retrying in ${delay}ms`,
      );
      if (isLast) throw error;
      await sleep(delay);
    }
  }
}

function registerConnectionHandlers(): void {
  const connection = mongoose.connection;

  connection.on('disconnected', () => log.warn('MongoDB disconnected — driver will retry'));
  connection.on('reconnected', () => log.info('MongoDB reconnected'));
  connection.on('error', (error: Error) => log.error({ err: error.message }, 'MongoDB error'));
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  if (!isTest) log.info('MongoDB connection closed');
}

/** True when the driver currently has a usable connection. Backs the health check. */
export function isDatabaseHealthy(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Build every index declared on the registered models.
 *
 * Mongoose's `autoIndex` is disabled in production because it races on
 * multi-instance boots; this runs it deliberately and reports failures rather
 * than letting a missing unique index silently permit duplicates.
 */
export async function ensureIndexes(): Promise<void> {
  const results = await Promise.allSettled(
    Object.values(mongoose.models).map(async (model) => {
      await model.createIndexes();
      return model.modelName;
    }),
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    for (const failure of failed) {
      log.error({ err: (failure as PromiseRejectedResult).reason?.message }, 'Index build failed');
    }
    throw new Error(`${failed.length} index build(s) failed`);
  }
  log.info({ models: results.length }, 'Indexes ensured');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
