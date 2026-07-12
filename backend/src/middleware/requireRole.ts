import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

/**
 * RBAC enforcement per docs/02-architecture.md §5. Must run AFTER
 * `authenticate` — it reads `req.user`, which `authenticate` populates.
 *
 * No route in the Auth module itself is role-restricted (registration and
 * login are necessarily public; refresh/logout/forgot-password work the
 * same for every role) — this middleware exists and is fully tested in
 * Module 2 so it's ready the moment Module 3 introduces the first
 * role-gated route (e.g. `POST /courses` restricted to TEACHER), per
 * docs/05-roadmap-and-milestones.md.
 *
 * Usage: `router.post('/courses', authenticate, requireRole('TEACHER'), ...)`
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Programmer error if this fires — requireRole was wired up without
      // authenticate running first. Treated as a 401, not a 500, since from
      // the caller's perspective it's still "you're not authenticated."
      return next(ApiError.unauthorized('MISSING_TOKEN', 'Authentication token is required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          'INSUFFICIENT_ROLE',
          `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        ),
      );
    }

    next();
  };
}
