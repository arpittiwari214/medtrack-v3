/**
 * Express application assembly.
 *
 * Kept separate from `server.ts` so tests can mount the app against an
 * in-memory database without binding a port or starting cron jobs.
 */

import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Express } from 'express';
import compression from 'compression';
import helmet from 'helmet';
// pino-http is CommonJS; under NodeNext the default import resolves to the
// module namespace rather than the function, so take the named export.
import { pinoHttp } from 'pino-http';
import { corsOrigins, env, isProduction } from './config/env.js';
import { isDatabaseHealthy } from './config/db.js';
import { logger } from './config/logger.js';
import { AppError, errorHandler, notFoundHandler } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import accountRoutes from './routes/account.js';
import alertRoutes from './routes/alerts.js';
import appointmentRoutes from './routes/appointments.js';
import authRoutes from './routes/auth.js';
import careRoutes from './routes/care.js';
import deviceRoutes from './routes/devices.js';
import doseRoutes from './routes/doses.js';
import medicineRoutes from './routes/medicines.js';
import syncRoutes from './routes/sync.js';

export function createApp(): Express {
  const app = express();

  /**
   * Behind exactly one proxy on Railway and Fly. Setting a hop count rather
   * than `true` matters: trusting every hop lets a client spoof `X-Forwarded-For`
   * and so defeat every per-IP rate limit.
   */
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');

  /* ── Security headers ── */
  app.use(
    helmet({
      // This is a JSON API; it serves no HTML, so a restrictive CSP costs
      // nothing and blocks a whole class of mistakes if that ever changes.
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      hsts: isProduction ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  /**
   * Explicit CORS allowlist.
   *
   * v3 shipped `origin: true`, which reflects whatever `Origin` the caller
   * sends. The mobile app sends no Origin header at all, so `!origin` is
   * allowed — that is native traffic, not a browser, and it is authorised by
   * bearer token regardless.
   */
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        // A disallowed origin is the *caller* being wrong, not the server
        // failing. Throwing a bare Error here falls through to the generic
        // handler and reports 500, which misattributes a config mistake as an
        // outage — and pages someone for it.
        callback(
          new AppError(403, 'FORBIDDEN', 'This origin is not allowed to call the API.', {
            context: { origin, allowed: corsOrigins },
          }),
        );
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86_400,
    }),
  );

  /* ── Response compression ── */
  // Dose history is repetitive JSON — the 90-day history was 140 KB raw. On
  // Indian mobile data, where connectivity is intermittent rather than
  // expensive, a smaller payload is what gets through before the link drops.
  app.use(compression());

  /* ── Body parsing ── */
  // Bounded: a sync batch is the largest legitimate payload and is nowhere
  // near this. Anything bigger is a mistake or an attack.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  /* ── Request logging with correlation ids ── */
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const existing = req.headers['x-request-id'];
        const id = typeof existing === 'string' ? existing : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      // Health checks every few seconds would otherwise drown the log.
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  /* ── Health ── */
  app.get('/api/health', (_req, res) => {
    const healthy = isDatabaseHealthy();
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      database: healthy ? 'connected' : 'disconnected',
      time: new Date().toISOString(),
      version: '4.0.0',
    });
  });

  /* ── Routes ── */
  app.use('/api/auth', authRoutes);
  app.use('/api/medicines', apiLimiter, medicineRoutes);
  app.use('/api/doses', apiLimiter, doseRoutes);
  app.use('/api/appointments', apiLimiter, appointmentRoutes);
  app.use('/api/care', apiLimiter, careRoutes);
  app.use('/api/alerts', apiLimiter, alertRoutes);
  app.use('/api/devices', apiLimiter, deviceRoutes);
  app.use('/api/sync', syncRoutes);
  app.use('/api/account', apiLimiter, accountRoutes);

  /* ── Terminal handlers ── */
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
