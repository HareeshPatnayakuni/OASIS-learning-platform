import type { CourseStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
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
} from './admin.types';

const userSummarySelect = { id: true, fullName: true, email: true, role: true, createdAt: true } as const;

function mapUserSummary(row: { id: string; fullName: string; email: string; role: string; createdAt: Date }): AdminUserSummary {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    role: row.role as 'TEACHER' | 'STUDENT',
    createdAt: row.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAnnouncementSummary(row: any): AdminAnnouncementSummary {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    courseId: row.courseId,
    authorName: row.author.fullName,
    createdAt: row.createdAt,
  };
}

export class PrismaAdminRepository implements AdminRepository {
  // ── Dashboard / analytics ──────────────────────────────────────

  async countUsersByRole(role: 'STUDENT' | 'TEACHER'): Promise<number> {
    return await prisma.user.count({ where: { role, deletedAt: null } });
  }

  async countCourses(): Promise<number> {
    return await prisma.course.count({ where: { deletedAt: null } });
  }

  async countPublishedCourses(): Promise<number> {
    return await prisma.course.count({ where: { deletedAt: null, status: 'PUBLISHED' } });
  }

  async countEnrollments(): Promise<number> {
    return await prisma.enrollment.count();
  }

  async countActiveSessions(): Promise<number> {
    const rows = await prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      select: { userId: true },
      distinct: ['userId'],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).length;
  }

  async listRecentRegistrations(limit: number): Promise<AdminUserSummary[]> {
    const rows = await prisma.user.findMany({
      where: { deletedAt: null, role: { in: ['STUDENT', 'TEACHER'] } },
      select: userSummarySelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map(mapUserSummary);
  }

  async listRecentAnnouncementsAcrossPlatform(limit: number): Promise<AdminAnnouncementSummary[]> {
    const rows = await prisma.announcement.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        title: true,
        body: true,
        courseId: true,
        createdAt: true,
        author: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map(mapAnnouncementSummary);
  }

  // ── Teachers ─────────────────────────────────────────────────

  async listTeachers(
    query: string | undefined,
    page: number,
    limit: number,
  ): Promise<{ data: AdminTeacherRecord[]; total: number }> {
    const where = {
      role: 'TEACHER' as const,
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { fullName: { contains: query, mode: 'insensitive' as const } },
              { email: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
          _count: { select: { taughtCourses: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: (rows as any[]).map((row) => ({
        id: row.id,
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
        isActive: row.isActive,
        courseCount: row._count.taughtCourses,
        createdAt: row.createdAt,
      })),
      total,
    };
  }

  async findTeacherById(id: string): Promise<AdminTeacherRecord | null> {
    const row = await prisma.user.findFirst({
      where: { id, role: 'TEACHER', deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { taughtCourses: true } },
      },
    });
    if (!row) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row;
    return {
      id: r.id,
      fullName: r.fullName,
      email: r.email,
      phone: r.phone,
      isActive: r.isActive,
      courseCount: r._count.taughtCourses,
      createdAt: r.createdAt,
    };
  }

  async isEmailTaken(email: string): Promise<boolean> {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    return existing !== null;
  }

  async createTeacher(input: CreateTeacherInput & { passwordHash: string }): Promise<AdminTeacherRecord> {
    const row = await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        passwordHash: input.passwordHash,
        phone: input.phone ?? null,
        role: 'TEACHER',
        emailVerifiedAt: new Date(), // Admin-provisioned accounts are trusted immediately — no self-serve verification loop
      },
      select: { id: true, fullName: true, email: true, phone: true, isActive: true, createdAt: true },
    });
    return { ...row, courseCount: 0 };
  }

  async updateTeacher(id: string, input: UpdateTeacherInput): Promise<AdminTeacherRecord> {
    const data: Record<string, unknown> = {};
    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;

    const row = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { taughtCourses: true } },
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row;
    return {
      id: r.id,
      fullName: r.fullName,
      email: r.email,
      phone: r.phone,
      isActive: r.isActive,
      courseCount: r._count.taughtCourses,
      createdAt: r.createdAt,
    };
  }

  async setUserActive(id: string, isActive: boolean): Promise<void> {
    await prisma.user.update({ where: { id }, data: { isActive } });
  }

  async findUserEmailById(id: string): Promise<{ id: string; email: string; fullName: string; role: string } | null> {
    return await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, email: true, fullName: true, role: true },
    });
  }

  // ── Students ─────────────────────────────────────────────────

  async listStudents(
    query: string | undefined,
    page: number,
    limit: number,
  ): Promise<{ data: AdminStudentRecord[]; total: number }> {
    const where = {
      role: 'STUDENT' as const,
      deletedAt: null,
      ...(query
        ? {
            OR: [
              { fullName: { contains: query, mode: 'insensitive' as const } },
              { email: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: (rows as any[]).map((row) => ({
        id: row.id,
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
        isActive: row.isActive,
        enrollmentCount: row._count.enrollments,
        createdAt: row.createdAt,
      })),
      total,
    };
  }

  async findStudentById(id: string): Promise<AdminStudentRecord | null> {
    const row = await prisma.user.findFirst({
      where: { id, role: 'STUDENT', deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { enrollments: true } },
      },
    });
    if (!row) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row;
    return {
      id: r.id,
      fullName: r.fullName,
      email: r.email,
      phone: r.phone,
      isActive: r.isActive,
      enrollmentCount: r._count.enrollments,
      createdAt: r.createdAt,
    };
  }

  // ── Courses ──────────────────────────────────────────────────

  async listAllCourses(
    filters: { q?: string; status?: CourseStatus },
    page: number,
    limit: number,
  ): Promise<{ data: AdminCourseRecord[]; total: number }> {
    const where = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q ? { title: { contains: filters.q, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.course.findMany({
        where,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          createdAt: true,
          teacher: { select: { id: true, fullName: true, email: true } },
          _count: { select: { enrollments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.course.count({ where }),
    ]);

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: (rows as any[]).map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status,
        teacher: row.teacher,
        enrollmentCount: row._count.enrollments,
        createdAt: row.createdAt,
      })),
      total,
    };
  }

  async findCourseById(id: string): Promise<AdminCourseRecord | null> {
    const row = await prisma.course.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        createdAt: true,
        teacher: { select: { id: true, fullName: true, email: true } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!row) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row;
    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      status: r.status,
      teacher: r.teacher,
      enrollmentCount: r._count.enrollments,
      createdAt: r.createdAt,
    };
  }

  async archiveCourse(id: string): Promise<AdminCourseRecord> {
    await prisma.course.update({ where: { id }, data: { status: 'ARCHIVED' } });
    return (await this.findCourseById(id))!;
  }

  async restoreCourse(id: string): Promise<AdminCourseRecord> {
    // Restores to DRAFT, not straight back to PUBLISHED — an archived
    // course becoming publicly visible again should be a conscious
    // decision the teacher makes via their own existing Publish action
    // (Module 3B), not an automatic side effect of an Admin restore.
    await prisma.course.update({ where: { id }, data: { status: 'DRAFT' } });
    return (await this.findCourseById(id))!;
  }

  async softDeleteCourse(id: string): Promise<void> {
    await prisma.course.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ── Platform announcements ───────────────────────────────────

  async listPlatformAnnouncements(
    page: number,
    limit: number,
  ): Promise<{ data: AdminAnnouncementSummary[]; total: number }> {
    const where = { deletedAt: null, courseId: null };
    const [rows, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        select: {
          id: true,
          title: true,
          body: true,
          courseId: true,
          createdAt: true,
          author: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.announcement.count({ where }),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { data: (rows as any[]).map(mapAnnouncementSummary), total };
  }

  async createPlatformAnnouncement(
    authorId: string,
    input: PlatformAnnouncementInput,
  ): Promise<AdminAnnouncementSummary> {
    const row = await prisma.announcement.create({
      data: { authorId, title: input.title, body: input.body, courseId: null },
      select: {
        id: true,
        title: true,
        body: true,
        courseId: true,
        createdAt: true,
        author: { select: { fullName: true } },
      },
    });
    return mapAnnouncementSummary(row);
  }

  async findPlatformAnnouncementById(id: string): Promise<AdminAnnouncementSummary | null> {
    const row = await prisma.announcement.findFirst({
      where: { id, deletedAt: null, courseId: null },
      select: {
        id: true,
        title: true,
        body: true,
        courseId: true,
        createdAt: true,
        author: { select: { fullName: true } },
      },
    });
    if (!row) return null;
    return mapAnnouncementSummary(row);
  }

  async updatePlatformAnnouncement(
    id: string,
    input: Partial<PlatformAnnouncementInput>,
  ): Promise<AdminAnnouncementSummary> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.body !== undefined) data.body = input.body;
    const row = await prisma.announcement.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        body: true,
        courseId: true,
        createdAt: true,
        author: { select: { fullName: true } },
      },
    });
    return mapAnnouncementSummary(row);
  }

  async softDeletePlatformAnnouncement(id: string): Promise<void> {
    await prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ── Settings ─────────────────────────────────────────────────

  async getSettings(): Promise<PlatformSettings> {
    const row = await this.getOrCreateSettingsRow();
    return this.mapSettings(row);
  }

  async updateSettings(updatedById: string, input: UpdatePlatformSettingsInput): Promise<PlatformSettings> {
    const existing = await this.getOrCreateSettingsRow();
    const data: Record<string, unknown> = { updatedById };
    if (input.academyName !== undefined) data.academyName = input.academyName;
    if (input.academyFullName !== undefined) data.academyFullName = input.academyFullName;
    if (input.tagline !== undefined) data.tagline = input.tagline;
    if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail;
    if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone;
    if (input.address !== undefined) data.address = input.address;
    if (input.socialLinks !== undefined) data.socialLinks = input.socialLinks;
    if (input.logoId !== undefined) data.logoId = input.logoId;
    if (input.faviconId !== undefined) data.faviconId = input.faviconId;

    const row = await prisma.academySettings.update({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: { id: existing.id },
      data,
      include: { logo: { select: { publicUrl: true } }, favicon: { select: { publicUrl: true } } },
    });
    return this.mapSettings(row);
  }

  /** AcademySettings is a true singleton (docs/03-database-design.md) — the
   * one row is created lazily on first read/write rather than requiring a
   * seed script to have run, since a fresh environment should still be
   * able to render sensible defaults immediately. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getOrCreateSettingsRow(): Promise<any> {
    const existing = await prisma.academySettings.findFirst({
      include: { logo: { select: { publicUrl: true } }, favicon: { select: { publicUrl: true } } },
    });
    if (existing) return existing;
    return await prisma.academySettings.create({
      data: { academyName: 'OASIS', contactEmail: 'contact@oasis.example.com' },
      include: { logo: { select: { publicUrl: true } }, favicon: { select: { publicUrl: true } } },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapSettings(row: any): PlatformSettings {
    return {
      academyName: row.academyName,
      academyFullName: row.academyFullName,
      tagline: row.tagline,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      address: row.address,
      socialLinks: row.socialLinks,
      logoUrl: row.logo?.publicUrl ?? null,
      faviconUrl: row.favicon?.publicUrl ?? null,
      updatedAt: row.updatedAt,
    };
  }
}
