import { UserRole, VerificationTokenType } from '@prisma/client';
import { env } from '../../config/env';
import { MAX_ACTIVE_DEVICES, EMAIL_VERIFICATION_TOKEN_TTL_HOURS, PASSWORD_RESET_TOKEN_TTL_HOURS } from '../../config/constants';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../lib/logger';
import { signAccessToken } from '../../lib/jwt';
import {
  sendEmail,
  buildVerificationEmail,
  buildPasswordResetEmail,
  withRecipient,
} from '../../lib/email';
import type { AuthRepository, AuthResult, PublicUser } from './auth.types';
import { toPublicUser } from './auth.types';
import { hashPassword, verifyPassword } from './password.util';
import { generateRawToken, hashToken } from '../../utils/token.util';
import { parseDeviceLabel } from './parseDeviceLabel';
import type {
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from './auth.validators';

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  // ── Registration ────────────────────────────────────────────────────

  async register(input: RegisterInput): Promise<{ user: PublicUser }> {
    const existing = await this.repo.findUserByEmail(input.email);
    if (existing) {
      throw ApiError.conflict(
        'EMAIL_ALREADY_REGISTERED',
        'An account with this email already exists. Try logging in instead.',
      );
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.repo.createUser({
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      role: UserRole.STUDENT, // FR-AUTH-7 — only students self-register; Teacher/Admin are provisioned separately (Users module, later)
      classGradeId: input.classGradeId ?? null,
      boardId: input.boardId ?? null,
    });

    await this.issueAndSendVerificationEmail(user.id, user.fullName, user.email);

    // Deliberately does NOT auto-login (no tokens issued here) — see
    // docs/07-module-2-notes.md for why registration and first login are
    // kept as two separate, explicit steps in V1.
    return { user: toPublicUser(user) };
  }

  private async issueAndSendVerificationEmail(
    userId: string,
    fullName: string,
    email: string,
  ): Promise<void> {
    await this.repo.invalidateUnusedVerificationTokens(userId, VerificationTokenType.EMAIL_VERIFICATION);
    const rawToken = generateRawToken();
    await this.repo.createVerificationToken({
      userId,
      type: VerificationTokenType.EMAIL_VERIFICATION,
      tokenHash: hashToken(rawToken),
      expiresAt: hoursFromNow(EMAIL_VERIFICATION_TOKEN_TTL_HOURS),
    });

    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${rawToken}`;
    try {
      await sendEmail(withRecipient(buildVerificationEmail(fullName, verifyUrl), email));
    } catch (err) {
      // Account creation already succeeded — a delivery failure shouldn't
      // fail registration. The user can request another link via
      // resendVerification. Logged so delivery problems are still visible.
      logger.error({ err, userId }, 'Failed to send verification email');
    }
  }

  // ── Login / Tokens ───────────────────────────────────────────────────

  async login(input: LoginInput, userAgent: string | undefined): Promise<AuthResult> {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user) {
      throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (!user.isActive) {
      throw ApiError.forbidden(
        'ACCOUNT_DEACTIVATED',
        'This account has been deactivated. Contact support for help.',
      );
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password');
    }

    await this.enforceDeviceLimit(user.id, input.deviceId);

    const deviceLabel = parseDeviceLabel(userAgent);
    await this.repo.upsertDeviceSession(user.id, input.deviceId, deviceLabel);

    const tokens = await this.issueTokenPair(user.id, user.role, input.deviceId);

    return { user: toPublicUser(user), tokens };
  }

  /** Strategy A from docs/02-architecture.md §6.2: reject a 3rd distinct
   * device outright rather than silently evicting the oldest session. */
  private async enforceDeviceLimit(userId: string, deviceId: string): Promise<void> {
    const existingSession = await this.repo.findDeviceSession(userId, deviceId);
    if (existingSession) return; // logging in again from an already-known device never counts against the limit

    const activeDeviceCount = await this.repo.countDeviceSessions(userId);
    if (activeDeviceCount >= MAX_ACTIVE_DEVICES) {
      throw ApiError.conflict(
        'DEVICE_LIMIT_REACHED',
        `You're already logged in on ${MAX_ACTIVE_DEVICES} devices. Log out of one to continue, ` +
          'or use "log out everywhere" and log back in on this device.',
        { maxDevices: MAX_ACTIVE_DEVICES },
      );
    }
  }

  private async issueTokenPair(userId: string, role: UserRole, deviceId: string) {
    const accessToken = signAccessToken({ sub: userId, role });
    const rawRefreshToken = generateRawToken();
    await this.repo.createRefreshToken({
      userId,
      deviceId,
      tokenHash: hashToken(rawRefreshToken),
      expiresAt: daysFromNow(env.JWT_REFRESH_EXPIRY_DAYS),
    });
    return { accessToken, refreshToken: rawRefreshToken };
  }

  async refresh(input: RefreshInput) {
    const tokenHash = hashToken(input.refreshToken);
    const record = await this.repo.findRefreshTokenByHash(tokenHash);

    if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
      throw ApiError.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }
    if (record.deviceId !== input.deviceId) {
      // Refresh tokens are scoped to the device they were issued on — a
      // mismatch here is treated the same as an invalid token rather than
      // leaking "this token exists but belongs to a different device."
      throw ApiError.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }

    const user = await this.repo.findUserById(record.userId);
    if (!user || !user.isActive) {
      // Catches an account deactivated after the access token was issued —
      // see the trade-off documented in middleware/authenticate.ts.
      throw ApiError.unauthorized('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }

    // Rotate: the old refresh token is single-use. Rotating on every refresh
    // limits the damage of a leaked-but-not-yet-used refresh token to a
    // single silent-replacement window.
    await this.repo.revokeRefreshToken(record.id);
    await this.repo.touchDeviceSession(user.id, record.deviceId);

    return this.issueTokenPair(user.id, user.role, record.deviceId);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    const record = await this.repo.findRefreshTokenByHash(tokenHash);
    if (!record || record.revokedAt) return; // idempotent — already logged out

    await this.repo.revokeRefreshToken(record.id);
    await this.repo.deleteDeviceSession(record.userId, record.deviceId);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.repo.revokeAllRefreshTokens(userId);
    await this.repo.deleteAllDeviceSessions(userId);
  }

  // ── Password reset ──────────────────────────────────────────────────

  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.repo.findUserByEmail(input.email);
    // Deliberately no branch that reveals whether the email exists — the
    // controller always responds with the same generic message regardless
    // of what happens in here (NFR-SEC territory: no user enumeration).
    if (!user || !user.isActive) return;

    await this.repo.invalidateUnusedVerificationTokens(user.id, VerificationTokenType.PASSWORD_RESET);
    const rawToken = generateRawToken();
    await this.repo.createVerificationToken({
      userId: user.id,
      type: VerificationTokenType.PASSWORD_RESET,
      tokenHash: hashToken(rawToken),
      expiresAt: hoursFromNow(PASSWORD_RESET_TOKEN_TTL_HOURS),
    });

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;
    try {
      await sendEmail(withRecipient(buildPasswordResetEmail(user.fullName, resetUrl), user.email));
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to send password reset email');
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = hashToken(input.token);
    const record = await this.repo.findValidVerificationTokenByHash(
      tokenHash,
      VerificationTokenType.PASSWORD_RESET,
    );
    if (!record) {
      throw ApiError.badRequest('INVALID_RESET_TOKEN', 'Invalid or expired reset token');
    }

    const newHash = await hashPassword(input.newPassword);
    await this.repo.updateUserPassword(record.userId, newHash);
    await this.repo.markVerificationTokenUsed(record.id);

    // Changing the password invalidates every existing session on every
    // device — standard practice: if the password leaked, this is the
    // moment to force whoever has it to be logged out too.
    await this.repo.revokeAllRefreshTokens(record.userId);
    await this.repo.deleteAllDeviceSessions(record.userId);
  }

  // ── Email verification ──────────────────────────────────────────────

  async verifyEmail(input: VerifyEmailInput): Promise<void> {
    const tokenHash = hashToken(input.token);
    const record = await this.repo.findValidVerificationTokenByHash(
      tokenHash,
      VerificationTokenType.EMAIL_VERIFICATION,
    );
    if (!record) {
      throw ApiError.badRequest(
        'INVALID_VERIFICATION_TOKEN',
        'Invalid or expired verification link',
      );
    }

    await this.repo.markEmailVerified(record.userId);
    await this.repo.markVerificationTokenUsed(record.id);
  }

  async resendVerification(input: ResendVerificationInput): Promise<void> {
    const user = await this.repo.findUserByEmail(input.email);
    // Same no-enumeration principle as forgotPassword — always resolves.
    if (!user || !user.isActive || user.emailVerifiedAt) return;

    await this.issueAndSendVerificationEmail(user.id, user.fullName, user.email);
  }
}
