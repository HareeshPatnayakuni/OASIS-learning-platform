import { loginSchema, registerSchema, resetPasswordSchema } from '../../../src/modules/auth/auth.validators';

describe('registerSchema', () => {
  it('accepts a valid registration payload', () => {
    const result = registerSchema.safeParse({
      fullName: 'Aisha Khan',
      email: 'Aisha@Example.com',
      password: 'Str0ngPassw0rd',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Email is lowercased/trimmed by the schema.
      expect(result.data.email).toBe('aisha@example.com');
    }
  });

  it.each([
    ['short', 'Ab1'],
    ['no digit', 'AllLettersNoDigits'],
    ['no letter', '12345678'],
  ])('rejects a password that is %s', (_label, password) => {
    const result = registerSchema.safeParse({
      fullName: 'Aisha Khan',
      email: 'aisha@example.com',
      password,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = registerSchema.safeParse({
      fullName: 'Aisha Khan',
      email: 'not-an-email',
      password: 'Str0ngPassw0rd',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing full name', () => {
    const result = registerSchema.safeParse({
      email: 'aisha@example.com',
      password: 'Str0ngPassw0rd',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional classGradeId/boardId as UUIDs and rejects non-UUIDs', () => {
    const valid = registerSchema.safeParse({
      fullName: 'Aisha Khan',
      email: 'aisha@example.com',
      password: 'Str0ngPassw0rd',
      classGradeId: '11111111-1111-1111-1111-111111111111',
      boardId: '22222222-2222-2222-2222-222222222222',
    });
    expect(valid.success).toBe(true);

    const invalid = registerSchema.safeParse({
      fullName: 'Aisha Khan',
      email: 'aisha@example.com',
      password: 'Str0ngPassw0rd',
      classGradeId: 'not-a-uuid',
    });
    expect(invalid.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires a deviceId', () => {
    const result = loginSchema.safeParse({ email: 'a@example.com', password: 'anything' });
    expect(result.success).toBe(false);
  });

  it('accepts any non-empty password (login does not re-enforce the strength policy)', () => {
    // Deliberate: an existing user's password might predate a policy
    // change. Strength is enforced at registration/reset time, not login.
    const result = loginSchema.safeParse({
      email: 'a@example.com',
      password: 'x',
      deviceId: 'device-abcdefgh',
    });
    expect(result.success).toBe(true);
  });
});

describe('resetPasswordSchema', () => {
  it('enforces the password policy on the new password', () => {
    const result = resetPasswordSchema.safeParse({ token: 'abc', newPassword: 'short' });
    expect(result.success).toBe(false);
  });
});
