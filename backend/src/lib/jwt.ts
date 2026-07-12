import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env';

/**
 * Access tokens are the ONLY thing the JWT library touches. Refresh tokens
 * are deliberately opaque random strings, not JWTs — see
 * src/modules/auth/token.util.ts for why (short version: we need to store
 * and revoke them server-side anyway, so a signed-but-unverifiable-without-
 * a-DB-lookup JWT would add complexity with no benefit).
 */

export interface AccessTokenPayload {
  sub: string; // userId
  role: UserRole;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    // env.JWT_ACCESS_EXPIRY is a plain, admin-configured string (e.g. "15m")
    // validated by Zod at startup; jsonwebtoken's types want its own
    // branded `StringValue` type from the `ms` package, which a generic
    // `string` doesn't structurally satisfy. The cast is safe: an invalid
    // value fails loudly at sign-time (jsonwebtoken throws), which is the
    // right behavior for a misconfigured environment variable.
    expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
    issuer: 'oasis-backend',
  });
}

export class InvalidAccessTokenError extends Error {
  constructor(message = 'Invalid or expired access token') {
    super(message);
    this.name = 'InvalidAccessTokenError';
  }
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'oasis-backend',
    });
    if (typeof decoded === 'string' || !('sub' in decoded) || !('role' in decoded)) {
      throw new InvalidAccessTokenError();
    }
    return { sub: decoded.sub as string, role: decoded.role as UserRole };
  } catch (err) {
    if (err instanceof InvalidAccessTokenError) throw err;
    throw new InvalidAccessTokenError();
  }
}
