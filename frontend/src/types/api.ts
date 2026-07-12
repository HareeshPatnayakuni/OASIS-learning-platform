/**
 * Types that mirror the backend's public API contracts
 * (backend/src/modules/auth/auth.types.ts, docs/04-api-design.md). Kept in
 * sync by hand for now — if this ever drifts enough to hurt, generating
 * these from the OpenAPI spec at /api/v1/docs.json is the natural next
 * step, not a rewrite.
 */

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  emailVerifiedAt: string | null;
  classGradeId: string | null;
  boardId: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  user: PublicUser;
  tokens: AuthTokens;
}
