import type { UserRole, VerificationTokenType } from '@prisma/client';

/**
 * `AuthRepository` is the boundary between business logic (auth.service.ts)
 * and data access (auth.repository.ts, which implements this against
 * Prisma). The service depends on this interface, not on PrismaClient
 * directly.
 *
 * This is a deliberate Clean Architecture choice (docs/02-architecture.md
 * §2: "Repositories wrap Prisma so business logic stays testable without a
 * real DB"), not incidental — it's what lets tests/unit/auth/auth.service.test.ts
 * test every business rule (device-limit enforcement, token expiry,
 * password-reset invalidation) with a plain in-memory fake, no database or
 * generated Prisma client required at all.
 */

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  emailVerifiedAt: Date | null;
  classGradeId: string | null;
  boardId: string | null;
  createdAt: Date;
}

export interface UserRecord extends PublicUser {
  passwordHash: string;
  isActive: boolean;
  deletedAt: Date | null;
}

export interface CreateUserInput {
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  classGradeId?: string | null;
  boardId?: string | null;
}

export interface DeviceSessionRecord {
  id: string;
  userId: string;
  deviceId: string;
  deviceLabel: string | null;
  browser: string | null;
  operatingSystem: string | null;
  lastActiveAt: Date;
}

/** The shape returned to the frontend by GET /devices — a thinner,
 * purpose-built view of DeviceSessionRecord (no internal `id`/`userId`),
 * with `isCurrentDevice` computed per-request rather than stored. */
export interface DeviceSummary {
  deviceId: string;
  deviceLabel: string | null;
  browser: string | null;
  operatingSystem: string | null;
  lastActiveAt: Date;
  isCurrentDevice: boolean;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  deviceId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface VerificationTokenRecord {
  id: string;
  userId: string;
  type: VerificationTokenType;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  markEmailVerified(userId: string): Promise<void>;

  countDeviceSessions(userId: string): Promise<number>;
  findDeviceSession(userId: string, deviceId: string): Promise<DeviceSessionRecord | null>;
  upsertDeviceSession(
    userId: string,
    deviceId: string,
    info: { label: string | null; browser: string | null; operatingSystem: string | null },
  ): Promise<DeviceSessionRecord>;
  /** Updates lastActiveAt only — used on refresh, where we want to record
   * activity without overwriting an already-known deviceLabel. */
  touchDeviceSession(userId: string, deviceId: string): Promise<void>;
  deleteDeviceSession(userId: string, deviceId: string): Promise<void>;
  deleteAllDeviceSessions(userId: string): Promise<void>;
  /**
   * Every session whose device has no unexpired, unrevoked refresh token
   * left is excluded from the result (Module 5's "expired sessions no
   * longer count as active" requirement) and opportunistically deleted —
   * no separate scheduled cleanup job (explicitly out of scope); a stale
   * row is simply cleaned up the next time anyone looks. Newest-active-first.
   */
  listActiveDeviceSessions(userId: string): Promise<DeviceSessionRecord[]>;
  /** Revokes every refresh token — current and any not-yet-rotated-out
   * historical ones — for one specific device, without touching the
   * user's other devices. Used by "remove device"; deliberately separate
   * from revokeAllRefreshTokens (all devices) and revokeRefreshToken (one
   * token by its own id) rather than reusing either. */
  revokeRefreshTokensForDevice(userId: string, deviceId: string): Promise<void>;

  createRefreshToken(input: {
    userId: string;
    deviceId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord>;
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(id: string): Promise<void>;
  revokeAllRefreshTokens(userId: string): Promise<void>;

  createVerificationToken(input: {
    userId: string;
    type: VerificationTokenType;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<VerificationTokenRecord>;
  findValidVerificationTokenByHash(
    tokenHash: string,
    type: VerificationTokenType,
  ): Promise<VerificationTokenRecord | null>;
  invalidateUnusedVerificationTokens(userId: string, type: VerificationTokenType): Promise<void>;
  markVerificationTokenUsed(id: string): Promise<void>;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
    classGradeId: user.classGradeId,
    boardId: user.boardId,
    createdAt: user.createdAt,
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}
