/**
 * Values that encode a business rule from Module 1's design docs. Kept in
 * one place so the rule and its rationale are easy to find and change
 * deliberately, rather than scattered as magic numbers.
 */

/** FR-AUTH-5 / docs/02-architecture.md §6.2 — max active devices per account. */
export const MAX_ACTIVE_DEVICES = 2;

/** NFR-SEC-2 — bcrypt cost factor. See docs/07-module-2-notes.md for the
 * bcrypt-vs-argon2id trade-off discussion. */
export const BCRYPT_COST_FACTOR = 12;

/** Password policy enforced in auth.validators.ts. */
export const PASSWORD_MIN_LENGTH = 8;

/** Email verification tokens are valid for this long. */
export const EMAIL_VERIFICATION_TOKEN_TTL_HOURS = 24;

/** Password reset tokens are shorter-lived than email verification tokens —
 * a reset link grants the ability to take over the account, so it carries a
 * tighter blast radius if leaked (e.g. via a forwarded email or shared inbox). */
export const PASSWORD_RESET_TOKEN_TTL_HOURS = 1;
