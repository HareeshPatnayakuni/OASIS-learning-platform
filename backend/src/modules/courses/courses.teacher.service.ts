import type { CourseStatus } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { slugify, ensureUniqueSlug } from '../../lib/slug';
import { isCourseOwnedByTeacher } from '../../lib/ownership';
import type {
  CreateCourseInput,
  TeacherCourseRepository,
  TeacherCourseSummary,
  UpdateCourseInput,
} from './courses.teacher.types';

const VALID_STATUSES: readonly CourseStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

export class TeacherCourseService {
  constructor(private readonly repo: TeacherCourseRepository) {}

  async listMyCourses(teacherId: string): Promise<TeacherCourseSummary[]> {
    return this.repo.listCoursesForTeacher(teacherId);
  }

  async getMyCourseById(courseId: string, teacherId: string): Promise<TeacherCourseSummary> {
    const summary = await this.assertOwnership(courseId, teacherId);
    return summary;
  }

  async createCourse(teacherId: string, input: CreateCourseInput): Promise<TeacherCourseSummary> {
    const baseSlug = slugify(input.title);
    const slug = await ensureUniqueSlug(baseSlug, (candidate) => this.repo.isSlugTaken(candidate));
    return this.repo.createCourse(teacherId, { ...input, slug });
  }

  async updateCourse(
    courseId: string,
    teacherId: string,
    input: UpdateCourseInput,
  ): Promise<TeacherCourseSummary> {
    await this.assertOwnership(courseId, teacherId);
    return this.repo.updateCourse(courseId, input);
  }

  /**
   * Draft/Publish/Archive — Module 3B's brief names these three states as
   * simple teacher actions ("Save as Draft", "Publish Course", "Archive
   * Course"), not a restricted state machine, so any-to-any transitions
   * between the three are allowed (e.g. un-archiving back to Draft to fix
   * something). If a real workflow need for restricted transitions shows
   * up later, this is the one place to add it.
   */
  async updateCourseStatus(
    courseId: string,
    teacherId: string,
    status: string,
  ): Promise<TeacherCourseSummary> {
    if (!VALID_STATUSES.includes(status as CourseStatus)) {
      throw ApiError.badRequest('INVALID_STATUS', `status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    await this.assertOwnership(courseId, teacherId);
    return this.repo.updateCourseStatus(courseId, status as CourseStatus);
  }

  private async assertOwnership(courseId: string, teacherId: string): Promise<TeacherCourseSummary> {
    const summary = await this.repo.findCourseSummaryById(courseId);
    if (!summary) {
      throw ApiError.notFound('COURSE_NOT_FOUND', 'Course not found');
    }
    const owned = await isCourseOwnedByTeacher(courseId, teacherId);
    if (!owned) {
      throw ApiError.forbidden('NOT_COURSE_OWNER', 'You do not own this course');
    }
    return summary;
  }
}
