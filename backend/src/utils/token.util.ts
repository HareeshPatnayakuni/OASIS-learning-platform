import { randomBytes, createHmac } from 'node:crypto';
import { env } from '../../config/env';

/**
 * Shared by refresh tokens (RefreshToken.token) and email-verification /
 * password-reset tokens (VerificationToken.tokenHash): generate a
 * cryptographically random opaque string, hand the RAW value to the client
 * (in the JSON response or the emailed link), and persist only a keyed hash
 * of it. This means a database leak alone can never be used to impersonate
 * a session or take over an account — the attacker would also need the raw
 * token, which only ever existed in the response body / email.
 *
 * The hash is HMAC-SHA256 keyed with JWT_REFRESH_SECRET, not plain
 * unkeyed SHA-256. This is deliberate, not decorative: it's what makes
 * JWT_REFRESH_SECRET a real, load-bearing secret that's genuinely separate
 * from JWT_ACCESS_SECRET, rather than a config value that exists but does
 * nothing (see the env.ts comment on JWT_REFRESH_SECRET). Reused here for
 * verification/reset tokens too, rather than provisioning a third secret —
 * both are "tokens this app hashes before storing," the same concern.
 *
 * Refresh tokens are opaque random strings rather than JWTs deliberately:
 * we already need a DB round-trip to check revocation/expiry and support
 * rotation, so a signed-but-still-DB-checked JWT would add parsing
 * complexity without removing the DB dependency it's usually chosen to
 * avoid.
 */

const RAW_TOKEN_BYTES = 48;

export function generateRawToken(): string {
  return randomBytes(RAW_TOKEN_BYTES).toString('hex');
}

export function hashToken(rawToken: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(rawToken).digest('hex');
}
