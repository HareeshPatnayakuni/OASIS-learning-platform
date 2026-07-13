import { prisma } from '../../lib/prisma';
import type { EnrollmentRepository, RawEnrollment } from './enrollments.types';

const courseSummarySelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  price: true,
  discountPrice: true,
  status: true,
  board: { select: { id: true, name: true, slug: true } },
  classGrade: { select: { id: true, name: true, slug: true } },
  subject: { select: { id: true, name: true, slug: true } },
  teacher: { select: { id: true, fullName: true } },
  thumbnail: { select: { publicUrl: true } },
} as const;

export class PrismaEnrollmentRepository implements EnrollmentRepository {
  async listEnrollmentsForStudent(studentId: string): Promise<RawEnrollment[]> {
    const rows = await prisma.enrollment.findMany({
      where: { studentId },
      orderBy: { enrolledAt: 'desc' },
      select: {
        id: true,
        enrolledAt: true,
        course: { select: courseSummarySelect },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map((row) => ({
      id: row.id,
      enrolledAt: row.enrolledAt,
      course: {
        id: row.course.id,
        title: row.course.title,
        slug: row.course.slug,
        description: row.course.description,
        board: row.course.board,
        classGrade: row.course.classGrade,
        subject: row.course.subject,
        teacher: row.course.teacher,
        price: Number(row.course.price),
        discountPrice: row.course.discountPrice === null ? null : Number(row.course.discountPrice),
        thumbnailUrl: row.course.thumbnail?.publicUrl ?? null,
        status: row.course.status,
      },
    }));
  }

  async countPublishedLecturesInCourse(courseId: string): Promise<number> {
    return await prisma.lecture.count({
      where: {
        deletedAt: null,
        status: 'PUBLISHED',
        module: { deletedAt: null, chapter: { deletedAt: null, courseId } },
      },
    });
  }

  async countCompletedLecturesForStudentInCourse(studentId: string, courseId: string): Promise<number> {
    return await prisma.lectureProgress.count({
      where: {
        studentId,
        isCompleted: true,
        lecture: {
          deletedAt: null,
          status: 'PUBLISHED',
          module: { deletedAt: null, chapter: { deletedAt: null, courseId } },
        },
      },
    });
  }
}
