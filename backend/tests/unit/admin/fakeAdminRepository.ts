import { randomUUID } from 'node:crypto';
import type { CourseStatus } from '@prisma/client';
import type {
  AdminAnnouncementSummary,
  AdminCourseRecord,
  AdminRepository,
  AdminStudentRecord,
  AdminTeacherRecord,
  AdminUserSummary,
  CreateTeacherInput,
  PlatformAnnouncementInput,
  PlatformSettings,
  UpdatePlatformSettingsInput,
  UpdateTeacherInput,
} from '../../../src/modules/admin/admin.types';

export function createFakeAdminRepository(seed: {
  teachers?: AdminTeacherRecord[];
  students?: AdminStudentRecord[];
  courses?: AdminCourseRecord[];
  announcements?: AdminAnnouncementSummary[];
  settings?: PlatformSettings;
  activeSessionCount?: number;
} = {}) {
  const teachers = new Map((seed.teachers ?? []).map((t) => [t.id, t]));
  const students = new Map((seed.students ?? []).map((s) => [s.id, s]));
  const courses = new Map((seed.courses ?? []).map((c) => [c.id, c]));
  const announcements = new Map((seed.announcements ?? []).map((a) => [a.id, a]));
  let settings: PlatformSettings =
    seed.settings ??
    ({
      academyName: 'OASIS',
      academyFullName: null,
      tagline: null,
      contactEmail: 'contact@oasis.example.com',
      contactPhone: null,
      address: null,
      socialLinks: null,
      logoUrl: null,
      faviconUrl: null,
      updatedAt: new Date(),
    } satisfies PlatformSettings);
  const activeSessionCount = seed.activeSessionCount ?? 0;

  const repo: AdminRepository = {
    async countUsersByRole(role) {
      return role === 'TEACHER' ? teachers.size : students.size;
    },
    async countCourses() {
      return courses.size;
    },
    async countPublishedCourses() {
      return [...courses.values()].filter((c) => c.status === 'PUBLISHED').length;
    },
    async countEnrollments() {
      return [...courses.values()].reduce((sum, c) => sum + c.enrollmentCount, 0);
    },
    async countActiveSessions() {
      return activeSessionCount;
    },
    async listRecentRegistrations(limit) {
      const all: AdminUserSummary[] = [
        ...[...teachers.values()].map((t) => ({ id: t.id, fullName: t.fullName, email: t.email, role: 'TEACHER' as const, createdAt: t.createdAt })),
        ...[...students.values()].map((s) => ({ id: s.id, fullName: s.fullName, email: s.email, role: 'STUDENT' as const, createdAt: s.createdAt })),
      ];
      return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
    },
    async listRecentAnnouncementsAcrossPlatform(limit) {
      return [...announcements.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
    },

    async listTeachers(query, page, limit) {
      const filtered = [...teachers.values()].filter(
        (t) => !query || t.fullName.toLowerCase().includes(query.toLowerCase()) || t.email.toLowerCase().includes(query.toLowerCase()),
      );
      return { data: filtered.slice((page - 1) * limit, page * limit), total: filtered.length };
    },
    async findTeacherById(id) {
      return teachers.get(id) ?? null;
    },
    async isEmailTaken(email) {
      return [...teachers.values()].some((t) => t.email === email) || [...students.values()].some((s) => s.email === email);
    },
    async createTeacher(input: CreateTeacherInput & { passwordHash: string }) {
      const record: AdminTeacherRecord = {
        id: randomUUID(),
        fullName: input.fullName,
        email: input.email,
        phone: input.phone ?? null,
        isActive: true,
        courseCount: 0,
        createdAt: new Date(),
      };
      teachers.set(record.id, record);
      return record;
    },
    async updateTeacher(id, input: UpdateTeacherInput) {
      const existing = teachers.get(id)!;
      const updated = { ...existing, ...input };
      teachers.set(id, updated);
      return updated;
    },
    async setUserActive(id, isActive) {
      if (teachers.has(id)) teachers.set(id, { ...teachers.get(id)!, isActive });
      if (students.has(id)) students.set(id, { ...students.get(id)!, isActive });
    },
    async findUserEmailById(id) {
      const t = teachers.get(id);
      if (t) return { id: t.id, email: t.email, fullName: t.fullName, role: 'TEACHER' };
      const s = students.get(id);
      if (s) return { id: s.id, email: s.email, fullName: s.fullName, role: 'STUDENT' };
      return null;
    },

    async listStudents(query, page, limit) {
      const filtered = [...students.values()].filter(
        (s) => !query || s.fullName.toLowerCase().includes(query.toLowerCase()) || s.email.toLowerCase().includes(query.toLowerCase()),
      );
      return { data: filtered.slice((page - 1) * limit, page * limit), total: filtered.length };
    },
    async findStudentById(id) {
      return students.get(id) ?? null;
    },

    async listAllCourses(filters: { q?: string; status?: CourseStatus }, page, limit) {
      const filtered = [...courses.values()].filter(
        (c) =>
          (!filters.q || c.title.toLowerCase().includes(filters.q.toLowerCase())) &&
          (!filters.status || c.status === filters.status),
      );
      return { data: filtered.slice((page - 1) * limit, page * limit), total: filtered.length };
    },
    async findCourseById(id) {
      return courses.get(id) ?? null;
    },
    async archiveCourse(id) {
      const updated = { ...courses.get(id)!, status: 'ARCHIVED' as CourseStatus };
      courses.set(id, updated);
      return updated;
    },
    async softDeleteCourse(id) {
      courses.delete(id);
    },

    async listPlatformAnnouncements(page, limit) {
      const all = [...announcements.values()].filter((a) => a.courseId === null);
      return { data: all.slice((page - 1) * limit, page * limit), total: all.length };
    },
    async createPlatformAnnouncement(authorId, input: PlatformAnnouncementInput) {
      const record: AdminAnnouncementSummary = {
        id: randomUUID(),
        title: input.title,
        body: input.body,
        courseId: null,
        authorName: 'Admin',
        createdAt: new Date(),
      };
      announcements.set(record.id, record);
      return record;
    },
    async findPlatformAnnouncementById(id) {
      const a = announcements.get(id);
      return a && a.courseId === null ? a : null;
    },
    async updatePlatformAnnouncement(id, input: Partial<PlatformAnnouncementInput>) {
      const existing = announcements.get(id)!;
      const updated = { ...existing, ...input };
      announcements.set(id, updated);
      return updated;
    },
    async softDeletePlatformAnnouncement(id) {
      announcements.delete(id);
    },

    async getSettings() {
      return settings;
    },
    async updateSettings(_updatedById, input: UpdatePlatformSettingsInput) {
      settings = {
        ...settings,
        ...(input.academyName !== undefined ? { academyName: input.academyName } : {}),
        ...(input.academyFullName !== undefined ? { academyFullName: input.academyFullName } : {}),
        ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
        ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.socialLinks !== undefined ? { socialLinks: input.socialLinks } : {}),
        updatedAt: new Date(),
      };
      return settings;
    },
  };

  return { repo, teachers, students, courses, announcements, getSettingsSnapshot: () => settings };
}
