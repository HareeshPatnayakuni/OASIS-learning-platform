import type { CourseStatus, PaymentStatus } from '@prisma/client';

/**
 * Module 3C — Admin Dashboard & Platform Management. Deliberately one
 * module covering several sub-areas (dashboard, teacher/student
 * management, course oversight, platform announcements, settings) rather
 * than six separate modules — they're all thin, mostly-independent Admin
 * reads/writes over existing models, not a cohesive domain the way
 * content-management's chapter/module/lecture nesting is. Organized
 * internally the same way content-management was: one repository
 * interface, one Prisma implementation, several focused service files
 * (one per sub-area), one controller composing them, one routes file with
 * clear section comments.
 *
 * Explicit MVP scope per your instructions: no audit logs, no CSV export,
 * no charts — every list here is a simple paginated table, every stat is
 * a plain count.
 */

// ── Dashboard & Analytics ────────────────────────────────────────────

export interface AdminUserSummary {
  id: string;
  fullName: string;
  email: string;
  role: 'TEACHER' | 'STUDENT';
  createdAt: Date;
}

export interface AdminAnnouncementSummary {
  id: string;
  title: string;
  body: string;
  courseId: string | null;
  authorName: string;
  createdAt: Date;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalEnrollments: number;
  recentRegistrations: AdminUserSummary[];
  recentAnnouncements: AdminAnnouncementSummary[];
}

export interface AnalyticsStats {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalEnrollments: number;
  /** Distinct users holding at least one currently-valid (non-revoked,
   * unexpired) refresh token — i.e. logged in on at least one device
   * right now. A simple, defensible "active" definition that needs zero
   * schema changes (no lastLoginAt field exists, and adding one wasn't
   * warranted for this one number) — see docs/10-module-3c-notes.md. */
  activeUsers: number;
  publishedCourses: number;
}

// ── Teacher management ───────────────────────────────────────────────

export interface AdminTeacherRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  courseCount: number;
  createdAt: Date;
}

export interface CreateTeacherInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface UpdateTeacherInput {
  fullName?: string;
  email?: string;
  phone?: string | null;
}

// ── Student management ───────────────────────────────────────────────

export interface AdminStudentRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  enrollmentCount: number;
  createdAt: Date;
}

// ── Course oversight ─────────────────────────────────────────────────

export interface AdminCourseRecord {
  id: string;
  title: string;
  slug: string;
  status: CourseStatus;
  teacher: { id: string; fullName: string; email: string };
  enrollmentCount: number;
  createdAt: Date;
}

// ── Payment oversight (Module 4B — read-only) ─────────────────────────

export interface AdminPaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
  student: { id: string; fullName: string; email: string };
  course: { id: string; title: string; slug: string };
}

export interface AdminPaymentDetail extends AdminPaymentRecord {
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
}

export interface AdminPaymentFilters {
  student?: string;
  course?: string;
  status?: PaymentStatus;
}

// ── Platform announcements ──────────────────────────────────────────

export interface PlatformAnnouncementInput {
  title: string;
  body: string;
}

// ── Platform settings ────────────────────────────────────────────────

export interface PlatformSettings {
  academyName: string;
  academyFullName: string | null;
  tagline: string | null;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  socialLinks: Record<string, string> | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  updatedAt: Date;
}

export interface UpdatePlatformSettingsInput {
  academyName?: string;
  academyFullName?: string | null;
  tagline?: string | null;
  contactEmail?: string;
  contactPhone?: string | null;
  address?: string | null;
  socialLinks?: Record<string, string> | null;
  logoId?: string | null;
  faviconId?: string | null;
}

// ── Repository ───────────────────────────────────────────────────────

export interface AdminRepository {
  // Dashboard / analytics
  countUsersByRole(role: 'STUDENT' | 'TEACHER'): Promise<number>;
  countCourses(): Promise<number>;
  countPublishedCourses(): Promise<number>;
  countEnrollments(): Promise<number>;
  countActiveSessions(): Promise<number>;
  listRecentRegistrations(limit: number): Promise<AdminUserSummary[]>;
  listRecentAnnouncementsAcrossPlatform(limit: number): Promise<AdminAnnouncementSummary[]>;

  // Teachers
  listTeachers(query: string | undefined, page: number, limit: number): Promise<{ data: AdminTeacherRecord[]; total: number }>;
  findTeacherById(id: string): Promise<AdminTeacherRecord | null>;
  isEmailTaken(email: string): Promise<boolean>;
  createTeacher(input: CreateTeacherInput & { passwordHash: string }): Promise<AdminTeacherRecord>;
  updateTeacher(id: string, input: UpdateTeacherInput): Promise<AdminTeacherRecord>;
  setUserActive(id: string, isActive: boolean): Promise<void>;
  findUserEmailById(id: string): Promise<{ id: string; email: string; fullName: string; role: string } | null>;

  // Students
  listStudents(query: string | undefined, page: number, limit: number): Promise<{ data: AdminStudentRecord[]; total: number }>;
  findStudentById(id: string): Promise<AdminStudentRecord | null>;

  // Courses
  listAllCourses(
    filters: { q?: string; status?: CourseStatus },
    page: number,
    limit: number,
  ): Promise<{ data: AdminCourseRecord[]; total: number }>;
  findCourseById(id: string): Promise<AdminCourseRecord | null>;
  archiveCourse(id: string): Promise<AdminCourseRecord>;
  restoreCourse(id: string): Promise<AdminCourseRecord>;
  softDeleteCourse(id: string): Promise<void>;

  // Payment oversight (Module 4B)
  listAllPayments(
    filters: AdminPaymentFilters,
    page: number,
    limit: number,
  ): Promise<{ data: AdminPaymentRecord[]; total: number }>;
  findPaymentDetail(id: string): Promise<AdminPaymentDetail | null>;

  // Platform announcements
  listPlatformAnnouncements(page: number, limit: number): Promise<{ data: AdminAnnouncementSummary[]; total: number }>;
  createPlatformAnnouncement(authorId: string, input: PlatformAnnouncementInput): Promise<AdminAnnouncementSummary>;
  findPlatformAnnouncementById(id: string): Promise<AdminAnnouncementSummary | null>;
  updatePlatformAnnouncement(id: string, input: Partial<PlatformAnnouncementInput>): Promise<AdminAnnouncementSummary>;
  softDeletePlatformAnnouncement(id: string): Promise<void>;

  // Settings
  getSettings(): Promise<PlatformSettings>;
  updateSettings(updatedById: string, input: UpdatePlatformSettingsInput): Promise<PlatformSettings>;
}
