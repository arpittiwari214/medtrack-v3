/**
 * Express request augmentations.
 *
 * Keeping these in one place means `req.auth` is typed everywhere rather than
 * being cast at each call site, so a route cannot quietly read a field the
 * auth middleware never set.
 */

import type { UserRole } from '@medtrack/shared';

declare global {
  namespace Express {
    /** Set by `requireAuth`. Absent on public routes. */
    interface AuthContext {
      userId: string;
      email: string;
      roles: UserRole[];
      /** Session this access token belongs to, so it can be revoked. */
      sessionId: string;
    }

    interface Request {
      /** Correlation id, echoed to the client on errors. */
      id?: string;
      auth?: AuthContext;
      /**
       * Set by `requireCareAccess` on caregiver routes: the patient whose data
       * is being read, and what this caregiver is permitted to see.
       */
      careContext?: {
        patientId: string;
        careLinkId: string;
        permissions: import('@medtrack/shared').CarePermissions;
      };
    }
  }
}

export {};
