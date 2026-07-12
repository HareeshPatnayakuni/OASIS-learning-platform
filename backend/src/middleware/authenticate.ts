import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { InvalidAccessTokenError, verifyAccessToken } from '../lib/jwt';
import { ApiError } from '../utils/ApiError';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by `authenticate` after successful JWT verification.
       * Absent on public routes. */
      user?: {
        id: string;
        role: UserRole;
      };
    }
  }
}

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches the
 * decoded identity to `req.user`. This is intentionally stateless — it does
 * NOT hit the database to re-check `isActive`/`deletedAt` on every request
 * (that would defeat NFR-SCALE-1's statelessness goal for very little
 * benefit, since access tokens are short-lived — 15 minutes by default).
 *
 * Trade-off, stated plainly: if an Admin deactivates a user mid-session,
 * that user's still-valid access token keeps working until it expires (at
 * most JWT_ACCESS_EXPIRY). This is a deliberate, bounded staleness window,
 * not an oversight — closing it completely would require a token
 * blocklist/revocation check on every request, adding a DB round trip to
 * every authenticated call for a scenario that's rare and already
 * self-heals within minutes. Refresh-token rotation (auth.service.ts) DOES
 * check the database, so a deactivated user is blocked at their next token
 * refresh at the latest.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('MISSING_TOKEN', 'Authentication token is required'));
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return next(ApiError.unauthorized('MISSING_TOKEN', 'Authentication token is required'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    if (err instanceof InvalidAccessTokenError) {
      return next(ApiError.unauthorized('INVALID_TOKEN', err.message));
    }
    next(err);
  }
}
