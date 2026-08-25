/**
 * Authentication and authorisation.
 *
 * `requireAuth` establishes *who* is calling. `requireCareAccess` establishes
 * *what they may see* when that is someone else's data — the only path by which
 * one account reads another's health record.
 *
 * v3 had no equivalent of the second: caregivers were an embedded blob with no
 * account, so the question never arose. Introducing caregiver logins makes
 * authorisation the highest-risk surface in the system, so it lives in one
 * place and every caregiver route goes through it.
 */

import type { RequestHandler } from 'express';
import type { CarePermissions } from '@medtrack/shared';
import { CareLink } from '../models/CareLink.js';
import { Session } from '../models/Session.js';
import { AppError } from './error.js';
import { verifyAccessToken } from '../services/tokens.js';

/**
 * Require a valid access token.
 *
 * The token's session is checked against the database, so signing out or
 * changing a password takes effect immediately rather than at token expiry.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw AppError.unauthenticated('Sign in to continue.');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw AppError.unauthenticated('Sign in to continue.');

    const claims = verifyAccessToken(token);

    // A revoked session must stop working at once. This is one indexed read.
    const session = await Session.findById(claims.sessionId)
      .select({ revokedAt: 1, expiresAt: 1 })
      .lean();

    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw AppError.unauthenticated('Your session has ended. Please sign in again.');
    }

    req.auth = {
      userId: claims.sub,
      email: claims.email,
      roles: claims.roles,
      sessionId: claims.sessionId,
    };
    next();
  } catch (error) {
    next(error);
  }
};

/** Narrow `req.auth` for handlers that run behind `requireAuth`. */
export function auth(req: { auth?: Express.AuthContext }): Express.AuthContext {
  if (!req.auth) {
    // A programming error, not a client one — the route is missing requireAuth.
    throw new AppError(500, 'INTERNAL', 'Route is missing authentication middleware.');
  }
  return req.auth;
}

/**
 * Authorise access to a patient's data.
 *
 * Resolves `:patientId` from the route. The caller is allowed through when they
 * are the patient, or when an **active** care link grants them the required
 * permission. Anything else is a 404 rather than a 403, so the endpoint cannot
 * be used to discover which patient ids exist.
 */
export function requireCareAccess(permission: keyof CarePermissions): RequestHandler {
  return async (req, _res, next) => {
    try {
      const { userId } = auth(req);
      // Express 5 types a route param as `string | string[]`, since a pattern
      // can bind it more than once. Only a single value is meaningful here.
      const rawPatientId = req.params['patientId'];
      const patientId = typeof rawPatientId === 'string' ? rawPatientId : undefined;

      if (!patientId) {
        throw AppError.badRequest('A patient must be specified.');
      }

      // Patients always have full access to their own record.
      if (patientId === userId) {
        req.careContext = {
          patientId,
          careLinkId: 'self',
          permissions: {
            viewMedicines: true,
            viewAdherence: true,
            viewAppointments: true,
            receiveAlerts: true,
            manageAlerts: true,
          },
        };
        next();
        return;
      }

      const link = await CareLink.findOne({
        patientId,
        caregiverId: userId,
        status: 'active',
      }).lean();

      // Deliberately indistinguishable from "no such patient".
      if (!link) throw AppError.notFound('Not found.');

      if (!link.permissions[permission]) {
        throw AppError.forbidden('Your access to this patient does not include that.');
      }

      req.careContext = {
        patientId,
        careLinkId: String(link._id),
        permissions: link.permissions,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Narrow `req.careContext` for handlers behind `requireCareAccess`. */
export function careContext(req: {
  careContext?: { patientId: string; careLinkId: string; permissions: CarePermissions };
}): { patientId: string; careLinkId: string; permissions: CarePermissions } {
  if (!req.careContext) {
    throw new AppError(500, 'INTERNAL', 'Route is missing care-access middleware.');
  }
  return req.careContext;
}
