import bcrypt from 'bcrypt';
import { BCRYPT_COST_FACTOR } from '../../config/constants';

/**
 * NFR-SEC-2: bcrypt, cost >= 12. See docs/07-module-2-notes.md for the
 * bcrypt-vs-argon2id trade-off. Isolated behind these two functions
 * specifically so swapping the algorithm later (if ever) is a one-file
 * change — nothing else in the codebase imports `bcrypt` directly.
 */

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, BCRYPT_COST_FACTOR);
}

export async function verifyPassword(
  plainTextPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, passwordHash);
}
