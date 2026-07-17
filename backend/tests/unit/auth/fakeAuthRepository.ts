import { randomUUID } from 'node:crypto';
import type { UserRole, VerificationTokenType } from '@prisma/client';
import type {
  AuthRepository,
  CreateUserInput,
  DeviceSessionRecord,
  RefreshTokenRecord,
  UserRecord,
  VerificationTokenRecord,
} from '../../../src/modules/auth/auth.types';

/**
 * A plain in-memory implementation of AuthRepository. This is what makes
 * auth.service.test.ts able to exercise real business logic (device-limit
 * enforcement, token rotation, expiry, invalidation-on-password-reset)
 * end-to-end through AuthService, without a database — and without needing
 * a generated Prisma client, which this sandbox can't produce (see
 * docs/07-module-2-notes.md for why).
 *
 * This file is test infrastructure only; it never ships as part of the
 * application.
 */
export function createFakeAuthRepository() {
  const users = new Map<string, UserRecord>();
  const deviceSessions = new Map<string, DeviceSessionRecord>(); // key: `${userId}:${deviceId}`
  const refreshTokens = new Map<string, RefreshTokenRecord>(); // key: tokenHash
  const verificationTokens = new Map<string, VerificationTokenRecord>(); // key: tokenHash

  const deviceKey = (userId: string, deviceId: string): string => `${userId}:${deviceId}`;

  function getValidDeviceIds(userId: string): Set<string> {
    const valid = new Set<string>();
    const now = Date.now();
    for (const token of refreshTokens.values()) {
      if (token.userId === userId && !token.revokedAt && token.expiresAt.getTime() > now) {
        valid.add(token.deviceId);
      }
    }
    return valid;
  }

  const repo: AuthRepository = {
    async findUserByEmail(email) {
      for (const user of users.values()) {
        if (user.email === email && !user.deletedAt) return user;
      }
      return null;
    },

    async findUserById(id) {
      const user = users.get(id);
      return user && !user.deletedAt ? user : null;
    },

    async createUser(input: CreateUserInput) {
      const now = new Date();
      const user: UserRecord = {
        id: randomUUID(),
        fullName: input.fullName,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
        emailVerifiedAt: null,
        classGradeId: input.classGradeId ?? null,
        boardId: input.boardId ?? null,
        isActive: true,
        deletedAt: null,
        createdAt: now,
      };
      users.set(user.id, user);
      return user;
    },

    async updateUserPassword(userId, passwordHash) {
      const user = users.get(userId);
      if (user) user.passwordHash = passwordHash;
    },

    async markEmailVerified(userId) {
      const user = users.get(userId);
      if (user) user.emailVerifiedAt = new Date();
    },

    async countDeviceSessions(userId) {
      return getValidDeviceIds(userId).size;
    },

    async findDeviceSession(userId, deviceId) {
      return deviceSessions.get(deviceKey(userId, deviceId)) ?? null;
    },

    async upsertDeviceSession(userId, deviceId, info) {
      const key = deviceKey(userId, deviceId);
      const existing = deviceSessions.get(key);
      const session: DeviceSessionRecord = existing
        ? { ...existing, deviceLabel: info.label, browser: info.browser, operatingSystem: info.operatingSystem, lastActiveAt: new Date() }
        : {
            id: randomUUID(),
            userId,
            deviceId,
            deviceLabel: info.label,
            browser: info.browser,
            operatingSystem: info.operatingSystem,
            lastActiveAt: new Date(),
          };
      deviceSessions.set(key, session);
      return session;
    },

    async touchDeviceSession(userId, deviceId) {
      const session = deviceSessions.get(deviceKey(userId, deviceId));
      if (session) session.lastActiveAt = new Date();
    },

    async deleteDeviceSession(userId, deviceId) {
      deviceSessions.delete(deviceKey(userId, deviceId));
    },

    async deleteAllDeviceSessions(userId) {
      for (const [key, session] of deviceSessions.entries()) {
        if (session.userId === userId) deviceSessions.delete(key);
      }
    },

    async listActiveDeviceSessions(userId) {
      const validDeviceIds = getValidDeviceIds(userId);
      const stale: string[] = [];
      const active: DeviceSessionRecord[] = [];
      for (const [key, session] of deviceSessions.entries()) {
        if (session.userId !== userId) continue;
        if (validDeviceIds.has(session.deviceId)) active.push(session);
        else stale.push(key);
      }
      for (const key of stale) deviceSessions.delete(key);
      return active.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
    },

    async revokeRefreshTokensForDevice(userId, deviceId) {
      for (const token of refreshTokens.values()) {
        if (token.userId === userId && token.deviceId === deviceId && !token.revokedAt) {
          token.revokedAt = new Date();
        }
      }
    },

    async createRefreshToken(input) {
      const record: RefreshTokenRecord = {
        id: randomUUID(),
        userId: input.userId,
        deviceId: input.deviceId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        revokedAt: null,
      };
      refreshTokens.set(input.tokenHash, record);
      return record;
    },

    async findRefreshTokenByHash(tokenHash) {
      return refreshTokens.get(tokenHash) ?? null;
    },

    async revokeRefreshToken(id) {
      for (const token of refreshTokens.values()) {
        if (token.id === id) token.revokedAt = new Date();
      }
    },

    async revokeAllRefreshTokens(userId) {
      for (const token of refreshTokens.values()) {
        if (token.userId === userId && !token.revokedAt) token.revokedAt = new Date();
      }
    },

    async createVerificationToken(input) {
      const record: VerificationTokenRecord = {
        id: randomUUID(),
        userId: input.userId,
        type: input.type,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        usedAt: null,
      };
      verificationTokens.set(input.tokenHash, record);
      return record;
    },

    async findValidVerificationTokenByHash(tokenHash, type: VerificationTokenType) {
      const token = verificationTokens.get(tokenHash);
      if (!token) return null;
      if (token.type !== type) return null;
      if (token.usedAt) return null;
      if (token.expiresAt.getTime() < Date.now()) return null;
      return token;
    },

    async invalidateUnusedVerificationTokens(userId, type) {
      for (const token of verificationTokens.values()) {
        if (token.userId === userId && token.type === type && !token.usedAt) {
          token.usedAt = new Date();
        }
      }
    },

    async markVerificationTokenUsed(id) {
      for (const token of verificationTokens.values()) {
        if (token.id === id) token.usedAt = new Date();
      }
    },
  };

  return {
    repo,
    // Test-only inspection helpers, not part of the AuthRepository interface.
    _debug: { users, deviceSessions, refreshTokens, verificationTokens },
  };
}

export type Role = UserRole;
