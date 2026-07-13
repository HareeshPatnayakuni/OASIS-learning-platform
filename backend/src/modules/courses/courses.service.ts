import { ApiError } from '../../utils/ApiError';
import type {
  CourseDetail,
  CourseListFilters,
  CourseRepository,
  LectureSummary,
  PaginatedResult,
  CourseListItem,
} from './courses.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export class CourseService {
  constructor(private readonly repo: CourseRepository) {}

  async listCourses(rawFilters: {
    boardId?: string;
    classGradeId?: string;
    subjectId?: string;
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<CourseListItem>> {
    const filters: CourseListFilters = {
      boardId: rawFilters.boardId,
      classGradeId: rawFilters.classGradeId,
      subjectId: rawFilters.subjectId,
      q: rawFilters.q,
      page: rawFilters.page && rawFilters.page > 0 ? rawFilters.page : DEFAULT_PAGE,
      limit: rawFilters.limit && rawFilters.limit > 0 ? Math.min(rawFilters.limit, MAX_LIMIT) : DEFAULT_LIMIT,
    };
    return this.repo.listPublishedCourses(filters);
  }

  /**
   * Public Course Details page and the authenticated Course Player are the
   * same call — `studentId` is optional. Anonymous/non-enrolled requests
   * get the full syllabus structure (titles, order, durations — enough to
   * show locked lectures and sell the course) with `isEnrolled: false` and
   * no per-lecture progress. Enrolled students additionally get their own
   * progress merged in. Nothing here ever returns a signed video/note URL
   * — that's a separate, explicitly enrollment-gated call
   * (modules/content), never bundled into this one.
   */
  async getCourseDetail(slug: string, studentId?: string): Promise<CourseDetail> {
    const course = await this.repo.findPublishedCourseBySlugWithContent(slug);
    if (!course) {
      throw ApiError.notFound('COURSE_NOT_FOUND', 'Course not found');
    }

    let isEnrolled = false;
    if (studentId) {
      isEnrolled = await this.repo.isStudentEnrolled(studentId, course.id);
    }

    if (!isEnrolled) {
      return { ...course, isEnrolled: false };
    }

    const lectureIds = course.chapters.flatMap((chapter) =>
      chapter.modules.flatMap((mod) => mod.lectures.map((lecture) => lecture.id)),
    );
    const progressMap = await this.repo.getLectureProgressForStudent(studentId!, lectureIds);

    return {
      ...course,
      isEnrolled: true,
      chapters: course.chapters.map((chapter) => ({
        ...chapter,
        modules: chapter.modules.map((mod) => ({
          ...mod,
          lectures: mod.lectures.map(
            (lecture): LectureSummary => ({
              ...lecture,
              progress: progressMap.get(lecture.id) ?? { lastPositionSec: 0, isCompleted: false },
            }),
          ),
        })),
      })),
    };
  }
}
