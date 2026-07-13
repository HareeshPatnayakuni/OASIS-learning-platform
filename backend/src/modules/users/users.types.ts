import type { UserRole } from '@prisma/client';
import type { CatalogRef } from '../courses/courses.types';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  phone: string | null;
  avatarUrl: string | null;
  classGrade: CatalogRef | null;
  board: CatalogRef | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string | null;
  classGradeId?: string | null;
  boardId?: string | null;
}

export interface ContinueWatchingItem {
  lecture: { id: string; title: string; durationSec: number | null };
  lastPositionSec: number;
  module: { id: string; title: string };
  chapter: { id: string; title: string; slug: string };
  course: { id: string; title: string; slug: string; thumbnailUrl: string | null };
  updatedAt: Date;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  course: { id: string; title: string; slug: string };
  author: { id: string; fullName: string };
}

export interface UsersRepository {
  findProfileById(userId: string): Promise<UserProfile | null>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile>;
  listContinueWatching(studentId: string, limit: number): Promise<ContinueWatchingItem[]>;
  listAnnouncementsForStudent(
    studentId: string,
    page: number,
    limit: number,
  ): Promise<{ data: AnnouncementItem[]; total: number }>;
}
