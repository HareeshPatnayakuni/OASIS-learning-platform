import type { VerificationTokenType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  AuthRepository,
  CreateUserInput,
  DeviceSessionRecord,
  RefreshTokenRecord,
  UserRecord,
  VerificationTokenRecord,
} from './auth.types';

/**
 * Concrete implementation of AuthRepository against Prisma/PostgreSQL. This
 * is the ONLY file in the Auth module that imports the Prisma client
 * directly — auth.service.ts talks to the `AuthRepository` interface, per
 * docs/02-architecture.md §2's Clean Architecture layering.
 *
 * Every read here filters `deletedAt: null` explicitly, implementing the
 * soft-delete convention described in docs/03-database-design.md §2.6
 * ("the repository layer will apply a deletedAt: null filter by default").
 */
export class PrismaAuthRepository implements AuthRepository {
  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return await prisma.user.findFirst({ where: { email, deletedAt: null } });
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return await prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    return await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
        classGradeId: input.classGradeId ?? null,
        boardId: input.boardId ?? null,
      },
    });
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async markEmailVerified(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  }

  /**
   * Single source of truth for "which of this user's devices are still
   * genuinely active" — a device only counts if it has at least one
   * refresh token that hasn't expired or been revoked. Used by both
   * `countDeviceSessions` (login-time limit enforcement) and
   * `listActiveDeviceSessions` (the My Devices page), so the two can
   * never disagree about what's active — see auth.service.ts's
   * enforceDeviceLimit and Module 5's "expired sessions no longer count"
   * requirement.
   */
  private async getValidDeviceIds(userId: string): Promise<Set<string>> {
    const validTokens = await prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { deviceId: true },
      distinct: ['deviceId'],
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
    return new Set((validTokens as any[]).map((t) => t.deviceId as string));
  }

  async countDeviceSessions(userId: string): Promise<number> {
    const validDeviceIds = await this.getValidDeviceIds(userId);
    return validDeviceIds.size;
  }

  async findDeviceSession(userId: string, deviceId: string): Promise<DeviceSessionRecord | null> {
    return await prisma.deviceSession.findUnique({
      where: { userId_deviceId: { userId, deviceId } },
    });
  }

  async upsertDeviceSession(
    userId: string,
    deviceId: string,
    info: { label: string | null; browser: string | null; operatingSystem: string | null },
  ): Promise<DeviceSessionRecord> {
    return await prisma.deviceSession.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: { userId, deviceId, deviceLabel: info.label, browser: info.browser, operatingSystem: info.operatingSystem },
      update: {
        deviceLabel: info.label,
        browser: info.browser,
        operatingSystem: info.operatingSystem,
        lastActiveAt: new Date(),
      },
    });
  }

  async touchDeviceSession(userId: string, deviceId: string): Promise<void> {
    await prisma.deviceSession.updateMany({
      where: { userId, deviceId },
      data: { lastActiveAt: new Date() },
    });
  }

  async deleteDeviceSession(userId: string, deviceId: string): Promise<void> {
    // deleteMany (not delete) so logging out a device that's already gone
    // is a no-op rather than a thrown "record not found" — logout should be
    // idempotent from the client's perspective.
    await prisma.deviceSession.deleteMany({ where: { userId, deviceId } });
  }

  async deleteAllDeviceSessions(userId: string): Promise<void> {
    await prisma.deviceSession.deleteMany({ where: { userId } });
  }

  async listActiveDeviceSessions(userId: string): Promise<DeviceSessionRecord[]> {
    const validDeviceIds = await this.getValidDeviceIds(userId);
    const allSessions = await prisma.deviceSession.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessions = allSessions as any[];
    const stale = sessions.filter((s) => !validDeviceIds.has(s.deviceId as string));
    if (stale.length > 0) {
      // Opportunistic cleanup — no separate scheduled job (explicitly out
      // of scope for Module 5); a session with no valid refresh token
      // left is simply cleaned up the next time anyone looks at the list.
      await prisma.deviceSession.deleteMany({
        where: { id: { in: stale.map((s) => s.id as string) } },
      });
    }
    return sessions.filter((s) => validDeviceIds.has(s.deviceId as string)) as DeviceSessionRecord[];
  }

  async revokeRefreshTokensForDevice(userId: string, deviceId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async createRefreshToken(input: {
    userId: string;
    deviceId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    const created = await prisma.refreshToken.create({
      data: {
        userId: input.userId,
        deviceId: input.deviceId,
        token: input.tokenHash, // see docs/07-module-2-notes.md — this column stores a hash, not the raw token
        expiresAt: input.expiresAt,
      },
    });
    return { ...created, tokenHash: created.token };
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const found = await prisma.refreshToken.findUnique({ where: { token: tokenHash } });
    if (!found) return null;
    return { ...found, tokenHash: found.token };
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async createVerificationToken(input: {
    userId: string;
    type: VerificationTokenType;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<VerificationTokenRecord> {
    return await prisma.verificationToken.create({ data: input });
  }

  async findValidVerificationTokenByHash(
    tokenHash: string,
    type: VerificationTokenType,
  ): Promise<VerificationTokenRecord | null> {
    const token = await prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (!token) return null;
    if (token.type !== type) return null;
    if (token.usedAt) return null;
    if (token.expiresAt.getTime() < Date.now()) return null;
    return token;
  }

  async invalidateUnusedVerificationTokens(
    userId: string,
    type: VerificationTokenType,
  ): Promise<void> {
    // "Invalidating" a token that was never actually consumed by marking
    // usedAt is a deliberate reuse of the one flag the schema provides,
    // rather than adding a separate `revokedAt` column for what is, in
    // practice, the same concept: "this token can no longer be redeemed."
    await prisma.verificationToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async markVerificationTokenUsed(id: string): Promise<void> {
    await prisma.verificationToken.update({ where: { id }, data: { usedAt: new Date() } });
  }
}
