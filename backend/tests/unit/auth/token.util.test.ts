import { createHmac } from 'node:crypto';
import { generateRawToken, hashToken } from '../../../src/modules/auth/token.util';
import { env } from '../../../src/config/env';

describe('token.util', () => {
  it('generates a hex-encoded token of the expected length', () => {
    const token = generateRawToken();
    expect(token).toMatch(/^[a-f0-9]+$/);
    expect(token.length).toBe(96); // 48 bytes -> 96 hex chars
  });

  it('generates a different token on every call', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateRawToken()));
    expect(tokens.size).toBe(20);
  });

  it('hashToken is deterministic for the same input', () => {
    const token = generateRawToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('hashToken matches an HMAC-SHA256 digest keyed with JWT_REFRESH_SECRET', () => {
    const token = 'fixed-value-for-this-test';
    const expected = createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
    expect(hashToken(token)).toBe(expected);
  });

  it('is a keyed hash, not a plain digest — a different key changes the output', () => {
    const token = 'fixed-value-for-this-test';
    const withRealKey = hashToken(token);
    const withDifferentKey = createHmac('sha256', 'a-totally-different-key-value-000000').update(token).digest('hex');
    expect(withRealKey).not.toBe(withDifferentKey);
  });

  it('hashToken output never equals its input (not reversible/identity)', () => {
    const token = generateRawToken();
    expect(hashToken(token)).not.toBe(token);
  });
});
