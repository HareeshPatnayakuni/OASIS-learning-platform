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

  async countDeviceSessions(userId: string): Promise<number> {
    return await prisma.deviceSession.count({ where: { userId } });
  }

  async findDeviceSession(userId: string, deviceId: string): Promise<DeviceSessionRecord | null> {
    return await prisma.deviceSession.findUnique({
      where: { userId_deviceId: { userId, deviceId } },
    });
  }

  async upsertDeviceSession(
    userId: string,
    deviceId: string,
    deviceLabel: string | null,
  ): Promise<DeviceSessionRecord> {
    return await prisma.deviceSession.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: { userId, deviceId, deviceLabel },
      update: { deviceLabel, lastActiveAt: new Date() },
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
