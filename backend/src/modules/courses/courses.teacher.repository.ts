import type { CourseStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  CreateCourseInput,
  TeacherCourseRepository,
  TeacherCourseSummary,
  UpdateCourseInput,
} from './courses.teacher.types';

const teacherCourseSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  price: true,
  discountPrice: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  board: { select: { id: true, name: true, slug: true } },
  classGrade: { select: { id: true, name: true, slug: true } },
  subject: { select: { id: true, name: true, slug: true } },
  teacher: { select: { id: true, fullName: true } },
  thumbnail: { select: { publicUrl: true } },
  _count: { select: { enrollments: true } },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTeacherCourseSummary(row: any, totalLectures: number, publishedLectures: number): TeacherCourseSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    board: row.board,
    classGrade: row.classGrade,
    subject: row.subject,
    teacher: row.teacher,
    price: Number(row.price),
    discountPrice: row.discountPrice === null ? null : Number(row.discountPrice),
    thumbnailUrl: row.thumbnail?.publicUrl ?? null,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    enrollmentCount: row._count.enrollments,
    totalLectures,
    publishedLectures,
  };
}

async function countLectureStats(courseId: string): Promise<{ total: number; published: number }> {
  const where = {
    deletedAt: null,
    module: { deletedAt: null, chapter: { deletedAt: null, courseId } },
  };
  const [total, published] = await Promise.all([
    prisma.lecture.count({ where }),
    prisma.lecture.count({ where: { ...where, status: 'PUBLISHED' } }),
  ]);
  return { total, published };
}

export class PrismaTeacherCourseRepository implements TeacherCourseRepository {
  async listCoursesForTeacher(teacherId: string): Promise<TeacherCourseSummary[]> {
    const rows = await prisma.course.findMany({
      where: { teacherId, deletedAt: null },
      select: teacherCourseSelect,
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (rows as any[]).map(async (row) => {
        const stats = await countLectureStats(row.id);
        return mapTeacherCourseSummary(row, stats.total, stats.published);
      }),
    );
  }

  async isSlugTaken(slug: string): Promise<boolean> {
    const existing = await prisma.course.findUnique({ where: { slug }, select: { id: true } });
    return existing !== null;
  }

  async createCourse(
    teacherId: string,
    input: CreateCourseInput & { slug: string },
  ): Promise<TeacherCourseSummary> {
    const row = await prisma.course.create({
      data: {
        title: input.title,
        slug: input.slug,
        description: input.description,
        boardId: input.boardId,
        classGradeId: input.classGradeId,
        subjectId: input.subjectId,
        teacherId,
        price: input.price,
        discountPrice: input.discountPrice ?? null,
        status: 'DRAFT',
      },
      select: teacherCourseSelect,
    });
    return mapTeacherCourseSummary(row, 0, 0);
  }

  async findCourseSummaryById(courseId: string): Promise<TeacherCourseSummary | null> {
    const row = await prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
      select: teacherCourseSelect,
    });
    if (!row) return null;
    const stats = await countLectureStats(courseId);
    return mapTeacherCourseSummary(row, stats.total, stats.published);
  }

  async updateCourse(courseId: string, input: UpdateCourseInput): Promise<TeacherCourseSummary> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.boardId !== undefined) data.boardId = input.boardId;
    if (input.classGradeId !== undefined) data.classGradeId = input.classGradeId;
    if (input.subjectId !== undefined) data.subjectId = input.subjectId;
    if (input.price !== undefined) data.price = input.price;
    if (input.discountPrice !== undefined) data.discountPrice = input.discountPrice;
    if (input.thumbnailId !== undefined) data.thumbnailId = input.thumbnailId;

    const row = await prisma.course.update({
      where: { id: courseId },
      data,
      select: teacherCourseSelect,
    });
    const stats = await countLectureStats(courseId);
    return mapTeacherCourseSummary(row, stats.total, stats.published);
  }

  async updateCourseStatus(courseId: string, status: CourseStatus): Promise<TeacherCourseSummary> {
    const row = await prisma.course.update({
      where: { id: courseId },
      data: { status },
      select: teacherCourseSelect,
    });
    const stats = await countLectureStats(courseId);
    return mapTeacherCourseSummary(row, stats.total, stats.published);
  }
}
