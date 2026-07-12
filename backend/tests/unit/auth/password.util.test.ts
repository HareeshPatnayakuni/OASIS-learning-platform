import { hashPassword, verifyPassword } from '../../../src/modules/auth/password.util';

describe('password.util', () => {
  it('hashes a password to a value that is not the plaintext', async () => {
    const hash = await hashPassword('Str0ngPassw0rd');
    expect(hash).not.toBe('Str0ngPassw0rd');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('produces a different hash each time (unique salt per hash)', async () => {
    const [hash1, hash2] = await Promise.all([
      hashPassword('Str0ngPassw0rd'),
      hashPassword('Str0ngPassw0rd'),
    ]);
    expect(hash1).not.toBe(hash2);
  });

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('Str0ngPassw0rd');
    await expect(verifyPassword('Str0ngPassw0rd', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password against a hash', async () => {
    const hash = await hashPassword('Str0ngPassw0rd');
    await expect(verifyPassword('WrongPassword1', hash)).resolves.toBe(false);
  });

  it('is a bcrypt hash tagged with the configured cost factor (12)', async () => {
    const hash = await hashPassword('Str0ngPassw0rd');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });
});
