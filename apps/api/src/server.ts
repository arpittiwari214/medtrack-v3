/**
 * Process entry point.
 *
 * The boot sequence and shutdown behaviour are the parts v3 got wrong in a way
 * that mattered: it called `process.exit(1)` on the first failed Mongo connect,
 * which on a hosted platform is a crash loop that presents from outside as a
 * hung service. Here the connect retries with backoff, a failed *optional*
 * dependency (email) degrades rather than aborts, and shutdown drains in-flight
 * requests instead of dropping them.
 */

import type { Server } from 'node:http';
import { connectDatabase, disconnectDatabase, ensureIndexes } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { createApp } from './app.js';
import { verifyEmailConnection } from './services/email.js';
import { startScheduler, stopScheduler } from './services/scheduler.js';

/** How long to let in-flight requests finish before forcing the socket closed. */
const SHUTDOWN_TIMEOUT_MS = 15_000;

let server: Server | null = null;
let shuttingDown = false;

async function main(): Promise<void> {
  // Required dependency: without a database there is nothing to serve.
  await connectDatabase();
  await ensureIndexes();

  // Optional dependency: a missing mail transport downgrades alerts to in-app
  // only, which is worse than email but far better than refusing to start.
  await verifyEmailConnection();

  startScheduler();

  const app = createApp();
  server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, origins: env.CORS_ORIGINS },
      `MedTrack API listening on :${env.PORT}`,
    );
  });

  // Slightly above typical proxy keep-alive so the platform closes idle
  // connections first; the reverse causes sporadic 502s on Railway and Fly.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

/**
 * Graceful shutdown.
 *
 * Platforms send SIGTERM on deploy and then SIGKILL shortly after, so the job
 * here is to stop accepting new work, let current work finish, and close the
 * database — within the window, or forcibly at the end of it.
 */
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  const force = setTimeout(() => {
    logger.error('Shutdown timed out — exiting forcefully');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  // Do not let this timer alone keep the process alive.
  force.unref();

  try {
    await stopScheduler();

    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
      logger.info('HTTP server closed');
    }

    await disconnectDatabase();
    clearTimeout(force);
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ err: (error as Error).message }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

/**
 * An unhandled rejection means some path is not awaiting or catching. Log it
 * loudly and keep serving — killing the process over one bad request would turn
 * a localised bug into an outage.
 */
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason instanceof Error ? reason.message : String(reason) }, 'Unhandled rejection');
});

/**
 * An uncaught exception leaves the process in an unknown state, so this one
 * does exit — but gracefully, so the platform restarts a clean instance.
 */
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error.message, stack: error.stack }, 'Uncaught exception');
  void shutdown('uncaughtException');
});

main().catch((error: unknown) => {
  logger.fatal(
    { err: error instanceof Error ? error.message : String(error) },
    'Failed to start',
  );
  process.exit(1);
});
