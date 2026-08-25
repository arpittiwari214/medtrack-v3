/**
 * Error handling.
 *
 * The contract: an error carries full detail into the log and only a safe,
 * deliberate shape out to the client. v3 returned `error: err.message` from
 * every catch block, which handed callers Mongo index names, schema paths and
 * connection strings.
 *
 * Express 5 forwards rejected promises from async handlers to this middleware
 * automatically, so route code does not need a try/catch just to avoid an
 * unhandled rejection.
 */

import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MongoServerError } from 'mongodb';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { DoseTransitionError, TimeError } from '@medtrack/shared';
import { isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';

/** Machine-readable codes so clients can branch without string-matching prose. */
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INVALID_TRANSITION'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL';

export interface FieldIssue {
  path: string;
  message: string;
}

/** An error the API raises deliberately, safe to show a user verbatim. */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly issues?: FieldIssue[];
  /** Detail for the log only — never serialised into the response. */
  readonly context?: Record<string, unknown>;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    options: { issues?: FieldIssue[]; context?: Record<string, unknown>; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (options.issues) this.issues = options.issues;
    if (options.context) this.context = options.context;
  }

  static badRequest(message: string, issues?: FieldIssue[]): AppError {
    return new AppError(400, 'VALIDATION_FAILED', message, issues ? { issues } : {});
  }
  static unauthenticated(message = 'Sign in to continue.'): AppError {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }
  static forbidden(message = 'You do not have access to this.'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Not found.'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICT', message);
  }
}

/** Body shape every error response uses. */
interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    issues?: FieldIssue[];
    /** Correlates the client's report with the server log. */
    requestId?: string;
  };
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`No route matches ${req.method} ${req.path}`));
};

/**
 * Terminal error middleware. Must keep four parameters — Express identifies
 * error handlers by arity, and dropping `next` silently turns this into a
 * normal middleware that never runs.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    // The response is already streaming; let Express abort the socket.
    next(err);
    return;
  }

  const requestId = typeof req.id === 'string' ? req.id : undefined;
  const normalised = normalise(err);

  const logPayload = {
    requestId,
    code: normalised.code,
    status: normalised.status,
    method: req.method,
    path: req.path,
    userId: req.auth?.userId,
    err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    context: err instanceof AppError ? err.context : undefined,
  };

  if (normalised.status >= 500) logger.error(logPayload, 'Request failed');
  else logger.warn(logPayload, 'Request rejected');

  const body: ErrorBody = {
    error: {
      code: normalised.code,
      message: normalised.message,
      ...(normalised.issues ? { issues: normalised.issues } : {}),
      ...(requestId ? { requestId } : {}),
    },
  };

  res.status(normalised.status).json(body);
};

interface Normalised {
  status: number;
  code: ErrorCode;
  message: string;
  issues?: FieldIssue[];
}

/**
 * Map a thrown value onto a safe client-facing shape.
 *
 * Anything unrecognised becomes a generic 500 in production. The real message
 * is still logged above; it just does not travel to the caller.
 */
function normalise(err: unknown): Normalised {
  if (err instanceof AppError) {
    return {
      status: err.status,
      code: err.code,
      message: err.message,
      ...(err.issues ? { issues: err.issues } : {}),
    };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Some of the details you entered need fixing.',
      issues: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  // Domain errors from @medtrack/shared are written for humans already.
  if (err instanceof DoseTransitionError) {
    const status = err.code === 'INVALID_TRANSITION' ? 409 : 400;
    return { status, code: 'INVALID_TRANSITION', message: err.message };
  }
  if (err instanceof TimeError) {
    return { status: 400, code: 'VALIDATION_FAILED', message: err.message };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return {
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Some of the details you entered need fixing.',
      issues: Object.entries(err.errors).map(([path, detail]) => ({
        path,
        message: detail.message,
      })),
    };
  }

  if (err instanceof mongoose.Error.CastError) {
    // Do not echo the offending value — it is attacker-controlled.
    return { status: 400, code: 'VALIDATION_FAILED', message: `Invalid value for "${err.path}".` };
  }

  if (isDuplicateKeyError(err)) {
    // The index name would disclose the schema, so it stays in the log only.
    return { status: 409, code: 'CONFLICT', message: 'That already exists.' };
  }

  if (isPayloadTooLarge(err)) {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'That request was too large.' };
  }

  return {
    status: 500,
    code: 'INTERNAL',
    message: isProduction
      ? 'Something went wrong on our end. Please try again.'
      : `Unhandled error: ${err instanceof Error ? err.message : String(err)}`,
  };
}

/**
 * Detect a duplicate-key violation.
 *
 * Checked structurally rather than with `instanceof MongoServerError`: Mongoose
 * carries its own copy of the `mongodb` driver, so the error can be an instance
 * of a *different* class object than the one imported here and the `instanceof`
 * silently fails — turning an intended 409 into a 500.
 */
function isDuplicateKeyError(err: unknown): boolean {
  if (err instanceof MongoServerError && err.code === 11000) return true;
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 11000
  );
}

function isPayloadTooLarge(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type?: string }).type === 'entity.too.large'
  );
}
