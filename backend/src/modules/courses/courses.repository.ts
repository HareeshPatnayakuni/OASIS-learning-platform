import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  CourseListFilters,
  CourseListItem,
  CourseRepository,
  CourseWithSyllabus,
  LectureProgressEntry,
  PaginatedResult,
} from './courses.types';

/**
 * Shared `select` shape for the catalog/teacher/thumbnail fields every
 * course-list-item needs — defined once so listPublishedCourses and
 * findPublishedCourseBySlugWithContent can't drift from each other.
 */
const courseListItemSelect = {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCourseListItem(row: any): CourseListItem {
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
  };
}

export class PrismaCourseRepository implements CourseRepository {
  async listPublishedCourses(filters: CourseListFilters): Promise<PaginatedResult<CourseListItem>> {
    const where: Prisma.CourseWhereInput = {
      status: 'PUBLISHED',
      deletedAt: null,
      ...(filters.boardId ? { boardId: filters.boardId } : {}),
      ...(filters.classGradeId ? { classGradeId: filters.classGradeId } : {}),
      ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
      ...(filters.q
        ? { title: { contains: filters.q, mode: 'insensitive' as const } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.course.findMany({
        where,
        select: courseListItemSelect,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.course.count({ where }),
    ]);

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      data: rows.map(mapCourseListItem),
      meta: { page: filters.page, limit: filters.limit, total },
    };
  }

  async findPublishedCourseBySlugWithContent(slug: string): Promise<CourseWithSyllabus | null> {
    const row = await prisma.course.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      select: {
        ...courseListItemSelect,
        chapters: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            slug: true,
            order: true,
            modules: {
              where: { deletedAt: null },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                title: true,
                order: true,
                lectures: {
                  // Only PUBLISHED lectures are shown in the syllabus at
                  // all — DRAFT/HIDDEN lectures were previously still
                  // visible here (title, duration, order) even though
                  // GET /lectures/:id/stream-url already correctly 404'd
                  // them. Metadata-only exposure of not-yet-public content
                  // is still a real leak (a draft lecture's working title
                  // might not be meant for anyone to see yet), so this is
                  // filtered at the same query that builds the public
                  // syllabus, not left to the streaming endpoint alone.
                  where: { deletedAt: null, status: 'PUBLISHED' },
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    order: true,
                    durationSec: true,
                    status: true,
                  },
                },
                notes: {
                  where: { deletedAt: null },
                  orderBy: { order: 'asc' },
                  select: { id: true, title: true, order: true },
                },
              },
            },
          },
        },
      },
    });

    if (!row) return null;

    return {
      ...mapCourseListItem(row),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chapters: row.chapters.map((chapter: any) => ({
        id: chapter.id,
        title: chapter.title,
        slug: chapter.slug,
        order: chapter.order,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        modules: chapter.modules.map((mod: any) => ({
          id: mod.id,
          title: mod.title,
          order: mod.order,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lectures: mod.lectures.map((lecture: any) => ({
            id: lecture.id,
            title: lecture.title,
            order: lecture.order,
            durationSec: lecture.durationSec,
            status: lecture.status,
            progress: null, // filled in by the service layer for enrolled students
          })),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          notes: mod.notes.map((note: any) => ({
            id: note.id,
            title: note.title,
            order: note.order,
          })),
        })),
      })),
    };
  }

  async isStudentEnrolled(studentId: string, courseId: string): Promise<boolean> {
    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      select: { id: true },
    });
    return enrollment !== null;
  }

  async getLectureProgressForStudent(
    studentId: string,
    lectureIds: string[],
  ): Promise<Map<string, LectureProgressEntry>> {
    if (lectureIds.length === 0) return new Map();

    const rows = await prisma.lectureProgress.findMany({
      where: { studentId, lectureId: { in: lectureIds } },
      select: { lectureId: true, lastPositionSec: true, isCompleted: true },
    });

    const map = new Map<string, LectureProgressEntry>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of rows as any[]) {
      map.set(row.lectureId, { lastPositionSec: row.lastPositionSec, isCompleted: row.isCompleted });
    }
    return map;
  }
}
