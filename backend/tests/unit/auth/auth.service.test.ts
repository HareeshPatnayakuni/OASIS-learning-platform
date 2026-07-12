import { AuthService } from '../../../src/modules/auth/auth.service';
import { createFakeAuthRepository } from './fakeAuthRepository';
import * as emailLib from '../../../src/lib/email';

// Only the actual I/O (`sendEmail`) is mocked. `buildVerificationEmail`,
// `buildPasswordResetEmail`, and `withRecipient` are pure functions — using
// the real implementations means the emailed text genuinely contains the
// raw token the service generated, which several tests below need to
// recover (the DB only ever stores a hash of it, by design — see
// token.util.ts — so the email is the only place the raw value appears).
jest.mock('../../../src/lib/email', () => {
  // jest.requireActual returns `any` by design (it's a raw CommonJS
  // require under the hood) — asserting a concrete type resolves
  // no-unsafe-assignment/-return below, but typescript-eslint's
  // no-unnecessary-type-assertion rule then (incorrectly, for `any`
  // specifically) flags that same assertion as redundant. The two rules
  // disagree with each other here, not with the code — the assertion is
  // genuinely load-bearing, so it stays.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const actual = jest.requireActual('../../../src/lib/email') as typeof emailLib;
  return {
    ...actual,
    sendEmail: jest.fn().mockResolvedValue(undefined),
  };
});

const mockedSendEmail = emailLib.sendEmail as jest.MockedFunction<typeof emailLib.sendEmail>;

const VALID_PASSWORD = 'Str0ngPassw0rd';

function buildService() {
  const { repo, _debug } = createFakeAuthRepository();
  const service = new AuthService(repo);
  return { service, repo, _debug };
}

/** Recovers the raw token embedded in the emailed link — the only place it
 * exists outside the few milliseconds it was generated server-side. */
function extractTokenFromLastEmail(): string {
  const lastCall = mockedSendEmail.mock.calls[mockedSendEmail.mock.calls.length - 1];
  if (!lastCall) throw new Error('sendEmail was never called');
  const text = lastCall[0].text;
  const match = /token=([a-f0-9]+)/.exec(text);
  if (!match) throw new Error(`Could not find a token in email text: ${text}`);
  return match[1]!;
}

describe('AuthService.register', () => {
  it('creates a new student user and never returns the password hash', async () => {
    const { service } = buildService();

    const { user } = await service.register({
      fullName: 'Aisha Khan',
      email: 'aisha@example.com',
      password: VALID_PASSWORD,
    });

    expect(user.email).toBe('aisha@example.com');
    expect(user.role).toBe('STUDENT');
    expect(user.emailVerifiedAt).toBeNull();
    expect((user as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('rejects registration with an email that is already in use', async () => {
    const { service } = buildService();
    await service.register({ fullName: 'A', email: 'dup@example.com', password: VALID_PASSWORD });

    await expect(
      service.register({ fullName: 'B', email: 'dup@example.com', password: VALID_PASSWORD }),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED', statusCode: 409 });
  });

  it('sends a verification email to the new user', async () => {
    const { service } = buildService();
    await service.register({
      fullName: 'Aisha Khan',
      email: 'aisha@example.com',
      password: VALID_PASSWORD,
    });

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const emailArg = mockedSendEmail.mock.calls[0]?.[0];
    expect(emailArg?.to).toBe('aisha@example.com');
    expect(emailArg?.subject).toContain('Verify');
  });

  it('still creates the account even if the verification email fails to send', async () => {
    mockedSendEmail.mockRejectedValueOnce(new Error('SMTP down'));
    const { service } = buildService();

    const { user } = await service.register({
      fullName: 'Aisha Khan',
      email: 'aisha@example.com',
      password: VALID_PASSWORD,
    });

    expect(user.email).toBe('aisha@example.com');
  });

  it('persists the optional classGradeId/boardId when provided', async () => {
    const { service, _debug } = buildService();
    await service.register({
      fullName: 'Aisha Khan',
      email: 'aisha@example.com',
      password: VALID_PASSWORD,
      classGradeId: 'class-8-id',
      boardId: 'cbse-id',
    });

    const stored = [..._debug.users.values()][0];
    expect(stored?.classGradeId).toBe('class-8-id');
    expect(stored?.boardId).toBe('cbse-id');
  });
});

describe('AuthService.login', () => {
  async function registerUser(service: AuthService) {
    return service.register({
      fullName: 'Aisha Khan',
      email: 'aisha@example.com',
      password: VALID_PASSWORD,
    });
  }

  it('logs in successfully with correct credentials on a new device', async () => {
    const { service } = buildService();
    await registerUser(service);

    const result = await service.login(
      { email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-1' },
      'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
    );

    expect(result.user.email).toBe('aisha@example.com');
    expect(result.tokens.accessToken).toEqual(expect.any(String));
    expect(result.tokens.refreshToken).toEqual(expect.any(String));
  });

  it('rejects an unknown email with a generic INVALID_CREDENTIALS error', async () => {
    const { service } = buildService();
    await expect(
      service.login({ email: 'nobody@example.com', password: VALID_PASSWORD, deviceId: 'd1' }, undefined),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 });
  });

  it('rejects an incorrect password with the same generic error as an unknown email', async () => {
    const { service } = buildService();
    await registerUser(service);

    await expect(
      service.login({ email: 'aisha@example.com', password: 'WrongPassw0rd', deviceId: 'd1' }, undefined),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 });
  });

  it('rejects login for a deactivated account', async () => {
    const { service, _debug } = buildService();
    await registerUser(service);
    const user = [..._debug.users.values()][0]!;
    user.isActive = false;

    await expect(
      service.login({ email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'd1' }, undefined),
    ).rejects.toMatchObject({ code: 'ACCOUNT_DEACTIVATED', statusCode: 403 });
  });

  it('allows exactly 2 distinct devices to be logged in at once', async () => {
    const { service } = buildService();
    await registerUser(service);

    await expect(
      service.login({ email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-1' }, undefined),
    ).resolves.toBeDefined();
    await expect(
      service.login({ email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-2' }, undefined),
    ).resolves.toBeDefined();
  });

  it('rejects a 3rd distinct device once the 2-device limit is reached', async () => {
    const { service } = buildService();
    await registerUser(service);
    await service.login({ email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-1' }, undefined);
    await service.login({ email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-2' }, undefined);

    await expect(
      service.login({ email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-3' }, undefined),
    ).rejects.toMatchObject({ code: 'DEVICE_LIMIT_REACHED', statusCode: 409 });
  });

  it('does not count logging in again on an already-registered device against the limit', async () => {
    const { service } = buildService();
    await registerUser(service);
    await service.login({ email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-1' }, undefined);
    await service.login({ email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-2' }, undefined);

    await expect(
      service.login({ email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-1' }, undefined),
    ).resolves.toBeDefined();
  });

  it('parses a human-readable device label from the User-Agent header', async () => {
    const { service, _debug } = buildService();
    await registerUser(service);
    await service.login(
      { email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-1' },
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
    );

    const session = [..._debug.deviceSessions.values()][0];
    expect(session?.deviceLabel).toBe('Chrome on Windows');
  });
});

describe('AuthService.refresh', () => {
  async function loggedInService() {
    const { service, _debug } = buildService();
    await service.register({ fullName: 'Aisha Khan', email: 'aisha@example.com', password: VALID_PASSWORD });
    const { tokens } = await service.login(
      { email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-1' },
      undefined,
    );
    return { service, _debug, initialRefreshToken: tokens.refreshToken };
  }

  it('issues a new token pair for a valid refresh token', async () => {
    const { service, initialRefreshToken } = await loggedInService();

    const rotated = await service.refresh({ refreshToken: initialRefreshToken, deviceId: 'device-1' });

    expect(rotated.accessToken).toEqual(expect.any(String));
    expect(rotated.refreshToken).not.toBe(initialRefreshToken);
  });

  it('invalidates the old refresh token after rotation (single-use)', async () => {
    const { service, initialRefreshToken } = await loggedInService();
    await service.refresh({ refreshToken: initialRefreshToken, deviceId: 'device-1' });

    await expect(
      service.refresh({ refreshToken: initialRefreshToken, deviceId: 'device-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN', statusCode: 401 });
  });

  it('rejects an unknown refresh token', async () => {
    const { service } = await loggedInService();
    await expect(
      service.refresh({ refreshToken: 'not-a-real-token', deviceId: 'device-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('rejects a refresh token presented with the wrong deviceId', async () => {
    const { service, initialRefreshToken } = await loggedInService();
    await expect(
      service.refresh({ refreshToken: initialRefreshToken, deviceId: 'someone-elses-device' }),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('rejects a refresh token whose expiry has passed', async () => {
    const { service, _debug, initialRefreshToken } = await loggedInService();
    const [record] = [..._debug.refreshTokens.values()];
    record!.expiresAt = new Date(Date.now() - 1000);

    await expect(
      service.refresh({ refreshToken: initialRefreshToken, deviceId: 'device-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('rejects refresh for a deactivated user', async () => {
    const { service, _debug, initialRefreshToken } = await loggedInService();
    const [user] = [..._debug.users.values()];
    user!.isActive = false;

    await expect(
      service.refresh({ refreshToken: initialRefreshToken, deviceId: 'device-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });
});

describe('AuthService.logout / logoutAll', () => {
  it('logout revokes the refresh token and frees the device slot', async () => {
    const { service, repo } = buildService();
    await service.register({ fullName: 'Aisha Khan', email: 'aisha@example.com', password: VALID_PASSWORD });
    const { tokens } = await service.login(
      { email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-1' },
      undefined,
    );
    await service.login({ email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-2' }, undefined);

    await service.logout(tokens.refreshToken);

    const user = await repo.findUserByEmail('aisha@example.com');
    const remainingDevices = await repo.countDeviceSessions(user!.id);
    expect(remainingDevices).toBe(1);

    // The freed slot means a 3rd device can now log in.
    await expect(
      service.login({ email: 'aisha@example.com', password: VALID_PASSWORD, deviceId: 'device-3' }, undefined),
    ).resolves.toBeDefined();
  });

  it('logout is idempotent for an already-revoked token', async () => {
    const { service } = buildService();
    await service.register({ fullName: 'A', email: 'a@example.com', password: VALID_PASSWORD });
    const { tokens } = await service.login(
      { email: 'a@example.com', password: VALID_PASSWORD, deviceId: 'd1' },
      undefined,
    );

    await service.logout(tokens.refreshToken);
    await expect(service.logout(tokens.refreshToken)).resolves.toBeUndefined();
  });

  it('logoutAll revokes every device session for the user', async () => {
    const { service, repo, _debug } = buildService();
    await service.register({ fullName: 'A', email: 'a@example.com', password: VALID_PASSWORD });
    await service.login({ email: 'a@example.com', password: VALID_PASSWORD, deviceId: 'd1' }, undefined);
    await service.login({ email: 'a@example.com', password: VALID_PASSWORD, deviceId: 'd2' }, undefined);
    const user = [..._debug.users.values()][0]!;

    await service.logoutAll(user.id);

    expect(await repo.countDeviceSessions(user.id)).toBe(0);
  });
});

describe('AuthService.forgotPassword / resetPassword', () => {
  it('issues a reset token and emails it for a known, active user', async () => {
    const { service, _debug } = buildService();
    await service.register({ fullName: 'A', email: 'a@example.com', password: VALID_PASSWORD });
    mockedSendEmail.mockClear();

    await service.forgotPassword({ email: 'a@example.com' });

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const resetTokens = [..._debug.verificationTokens.values()].filter((t) => t.type === 'PASSWORD_RESET');
    expect(resetTokens).toHaveLength(1);
  });

  it('resolves silently for an unknown email (no user enumeration) and sends nothing', async () => {
    const { service } = buildService();
    mockedSendEmail.mockClear();

    await expect(service.forgotPassword({ email: 'nobody@example.com' })).resolves.toBeUndefined();
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('a valid reset token changes the password and revokes every existing session', async () => {
    const { service, repo, _debug } = buildService();
    await service.register({ fullName: 'A', email: 'a@example.com', password: VALID_PASSWORD });
    await service.login({ email: 'a@example.com', password: VALID_PASSWORD, deviceId: 'd1' }, undefined);

    await service.forgotPassword({ email: 'a@example.com' });
    const rawToken = extractTokenFromLastEmail();

    await service.resetPassword({ token: rawToken, newPassword: 'NewStr0ngPassw0rd' });

    const user = [..._debug.users.values()][0]!;
    const remainingDevices = await repo.countDeviceSessions(user.id);
    expect(remainingDevices).toBe(0); // all sessions revoked on password change

    // The new password now works; the old one no longer does.
    await expect(
      service.login({ email: 'a@example.com', password: 'NewStr0ngPassw0rd', deviceId: 'd-new' }, undefined),
    ).resolves.toBeDefined();
    await expect(
      service.login({ email: 'a@example.com', password: VALID_PASSWORD, deviceId: 'd-old' }, undefined),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('rejects an invalid or unknown reset token', async () => {
    const { service } = buildService();
    await expect(
      service.resetPassword({ token: 'garbage-token', newPassword: 'NewStr0ngPassw0rd' }),
    ).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN', statusCode: 400 });
  });

  it('a reset token cannot be redeemed twice', async () => {
    const { service } = buildService();
    await service.register({ fullName: 'A', email: 'a@example.com', password: VALID_PASSWORD });
    await service.forgotPassword({ email: 'a@example.com' });
    const rawToken = extractTokenFromLastEmail();

    await service.resetPassword({ token: rawToken, newPassword: 'NewStr0ngPassw0rd' });

    await expect(
      service.resetPassword({ token: rawToken, newPassword: 'AnotherPassw0rd' }),
    ).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
  });

  it('requesting a new reset link invalidates a previously issued, unused one', async () => {
    const { service } = buildService();
    await service.register({ fullName: 'A', email: 'a@example.com', password: VALID_PASSWORD });

    await service.forgotPassword({ email: 'a@example.com' });
    const firstToken = extractTokenFromLastEmail();

    await service.forgotPassword({ email: 'a@example.com' });
    const secondToken = extractTokenFromLastEmail();

    await expect(
      service.resetPassword({ token: firstToken, newPassword: 'NewStr0ngPassw0rd' }),
    ).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });

    await expect(
      service.resetPassword({ token: secondToken, newPassword: 'NewStr0ngPassw0rd' }),
    ).resolves.toBeUndefined();
  });
});

describe('AuthService.verifyEmail / resendVerification', () => {
  it('a valid verification token marks the account verified', async () => {
    const { service, _debug } = buildService();
    await service.register({ fullName: 'A', email: 'a@example.com', password: VALID_PASSWORD });
    const rawToken = extractTokenFromLastEmail();

    await service.verifyEmail({ token: rawToken });

    const user = [..._debug.users.values()][0]!;
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it('rejects an invalid verification token', async () => {
    const { service } = buildService();
    await expect(service.verifyEmail({ token: 'garbage' })).rejects.toMatchObject({
      code: 'INVALID_VERIFICATION_TOKEN',
      statusCode: 400,
    });
  });

  it('a verification token cannot be redeemed twice', async () => {
    const { service } = buildService();
    await service.register({ fullName: 'A', email: 'a@example.com', password: VALID_PASSWORD });
    const rawToken = extractTokenFromLastEmail();

    await service.verifyEmail({ token: rawToken });

    await expect(service.verifyEmail({ token: rawToken })).rejects.toMatchObject({
      code: 'INVALID_VERIFICATION_TOKEN',
    });
  });

  it('resendVerification is a no-op for an already-verified account', async () => {
    const { service } = buildService();
    await service.register({ fullName: 'A', email: 'a@example.com', password: VALID_PASSWORD });
    await service.verifyEmail({ token: extractTokenFromLastEmail() });

    mockedSendEmail.mockClear();
    await service.resendVerification({ email: 'a@example.com' });

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('resendVerification issues a fresh token for an unverified account', async () => {
    const { service } = buildService();
    await service.register({ fullName: 'A', email: 'a@example.com', password: VALID_PASSWORD });
    const firstToken = extractTokenFromLastEmail();

    await service.resendVerification({ email: 'a@example.com' });
    const secondToken = extractTokenFromLastEmail();

    expect(secondToken).not.toBe(firstToken);
    // The first (now superseded) token no longer works.
    await expect(service.verifyEmail({ token: firstToken })).rejects.toMatchObject({
      code: 'INVALID_VERIFICATION_TOKEN',
    });
    // The second one does.
    await expect(service.verifyEmail({ token: secondToken })).resolves.toBeUndefined();
  });

  it('resendVerification resolves silently for an unknown email', async () => {
    const { service } = buildService();
    await expect(service.resendVerification({ email: 'nobody@example.com' })).resolves.toBeUndefined();
  });
});
