import { prisma } from '../../lib/prisma';
import type {
  AnnouncementRecord,
  CreateAnnouncementInput,
  TeacherAnnouncementRepository,
  UpdateAnnouncementInput,
} from './announcements.types';

const announcementSelect = {
  id: true,
  courseId: true,
  authorId: true,
  title: true,
  body: true,
  createdAt: true,
} as const;

export class PrismaTeacherAnnouncementRepository implements TeacherAnnouncementRepository {
  async createAnnouncement(
    courseId: string,
    authorId: string,
    input: CreateAnnouncementInput,
  ): Promise<AnnouncementRecord> {
    const row = await prisma.announcement.create({
      data: { courseId, authorId, title: input.title, body: input.body },
      select: announcementSelect,
    });
    return { ...row, courseId: row.courseId! };
  }

  async findAnnouncementById(id: string): Promise<AnnouncementRecord | null> {
    const row = await prisma.announcement.findFirst({
      where: { id, deletedAt: null },
      select: announcementSelect,
    });
    if (!row || !row.courseId) return null;
    return { ...row, courseId: row.courseId };
  }

  async updateAnnouncement(id: string, input: UpdateAnnouncementInput): Promise<AnnouncementRecord> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.body !== undefined) data.body = input.body;
    const row = await prisma.announcement.update({ where: { id }, data, select: announcementSelect });
    return { ...row, courseId: row.courseId! };
  }

  async softDeleteAnnouncement(id: string): Promise<void> {
    await prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async listEnrolledStudentIds(courseId: string): Promise<string[]> {
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId },
      select: { studentId: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (enrollments as any[]).map((e) => e.studentId as string);
  }

  async createNotificationsForStudents(
    studentIds: string[],
    announcementId: string,
    title: string,
    body: string,
  ): Promise<void> {
    if (studentIds.length === 0) return;
    await prisma.notification.createMany({
      data: studentIds.map((studentId) => ({
        userId: studentId,
        type: 'ANNOUNCEMENT',
        title,
        body,
        announcementId,
      })),
    });
  }

  async listAnnouncementsForTeacher(
    teacherId: string,
    page: number,
    limit: number,
  ): Promise<{ data: AnnouncementRecord[]; total: number }> {
    const where = { deletedAt: null, authorId: teacherId };
    const [rows, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        select: announcementSelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.announcement.count({ where }),
    ]);
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: (rows as any[])
        .filter((r) => r.courseId !== null)
        .map((r) => ({ ...r, courseId: r.courseId as string })),
      total,
    };
  }
}
