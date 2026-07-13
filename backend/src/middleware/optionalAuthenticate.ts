import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt';

/**
 * A sibling to `authenticate`, not a replacement — `authenticate` still
 * rejects unauthenticated requests wherever a token is genuinely required
 * (signed URLs, progress updates, profile). This middleware is for the
 * narrower case of a route that behaves correctly either way, but
 * personalizes when it can — e.g. the public Course Details page shows the
 * full syllabus to anyone, but adds `isEnrolled`/progress if the requester
 * happens to be logged in and enrolled.
 *
 * A missing or invalid token is never an error here — it just means
 * `req.user` stays undefined, same as an anonymous request.
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
  } catch {
    // Invalid/expired token on an optional-auth route: treat as anonymous
    // rather than rejecting the request.
  }
  next();
}
