/**
 * Request validation.
 *
 * Every route parses its input through a Zod schema from `@medtrack/shared`,
 * and the *parsed* value replaces the raw one. That matters for more than
 * tidiness: the parsed value is a plain object of known types, so a caller
 * cannot smuggle `{$ne: null}` into a query. v3's routes read `req.body`
 * directly and were protected from NoSQL injection only by accident — a stray
 * `.toLowerCase()` throwing on a non-string.
 */

import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { AppError } from './error.js';

type Source = 'body' | 'query' | 'params';

/**
 * Validate one part of the request and replace it with the parsed result.
 *
 * `query` and `params` are getter-only on Express 5, so the parsed value is
 * stashed on `res.locals` for those and read back via `validated()`.
 */
export function validate<S extends ZodTypeAny>(schema: S, source: Source = 'body'): RequestHandler {
  return (req, res, next) => {
    const raw = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
    const result = schema.safeParse(raw ?? {});

    if (!result.success) {
      next(
        AppError.badRequest(
          'Some of the details you entered need fixing.',
          result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        ),
      );
      return;
    }

    if (source === 'body') {
      req.body = result.data;
    }
    res.locals[`validated_${source}`] = result.data;
    next();
  };
}

/**
 * Read a validated payload with its inferred type.
 *
 * Pass the same schema used in the `validate()` call so the return type is
 * inferred rather than asserted.
 */
export function validated<S extends ZodTypeAny>(
  res: { locals: Record<string, unknown> },
  _schema: S,
  source: Source = 'body',
): z.infer<S> {
  return res.locals[`validated_${source}`] as z.infer<S>;
}
