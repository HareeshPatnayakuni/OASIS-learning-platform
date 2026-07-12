import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

/** Shared handler so a rate-limit rejection still comes back in the
 * standard error envelope, not express-rate-limit's default plain-text body. */
function rateLimitHandler(_req: Request, res: Response): void {
  const error = ApiError.tooManyRequests(
    'RATE_LIMITED',
    'Too many requests. Please try again later.',
  );
  res.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
}

/** General-purpose API limiter (NFR-SEC-5). Applied globally in app.ts. */
export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Tighter limiter for auth endpoints specifically (register, login,
 * forgot-password, resend-verification) — these are public-facing,
 * unauthenticated, and the natural target of credential-stuffing/enumeration
 * attempts, so they get a stricter budget than the general API default,
 * mirroring the same reasoning already applied to Enquiry submission in
 * docs/06-deployment-and-docker.md.
 */
export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  // Keyed by IP + email (when present) so one user mistyping their password
  // repeatedly doesn't lock out everyone else behind the same NAT/office IP.
  keyGenerator: (req: Request): string => {
    const body = req.body as Record<string, unknown> | undefined;
    const emailField = body?.email;
    const email = typeof emailField === 'string' ? emailField.toLowerCase() : '';
    return `${req.ip ?? 'unknown'}:${email}`;
  },
});
