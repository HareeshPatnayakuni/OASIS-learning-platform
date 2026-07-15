import type { CourseStatus } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import type { AdminCourseRecord, AdminRepository } from './admin.types';

export interface CourseListResult {
  data: AdminCourseRecord[];
  meta: { page: number; limit: number; total: number };
}

/**
 * Deliberately narrow: list, archive, restore, delete. No chapter/
 * module/lecture/quiz/note editing — that stays exclusively under
 * Teacher ownership (Module 3B). This service structurally cannot touch
 * content because it has no dependency on content-management's
 * repository at all.
 */
export class AdminCourseService {
  constructor(private readonly repo: AdminRepository) {}

  async listCourses(
    filters: { q?: string; status?: CourseStatus },
    page: number,
    limit: number,
  ): Promise<CourseListResult> {
    const { data, total } = await this.repo.listAllCourses(filters, page, limit);
    return { data, meta: { page, limit, total } };
  }

  async archiveCourse(id: string): Promise<AdminCourseRecord> {
    await this.assertCourseExists(id);
    return this.repo.archiveCourse(id);
  }

  async restoreCourse(id: string): Promise<AdminCourseRecord> {
    const course = await this.assertCourseExists(id);
    if (course.status !== 'ARCHIVED') {
      throw ApiError.badRequest('COURSE_NOT_ARCHIVED', 'Only an archived course can be restored');
    }
    return this.repo.restoreCourse(id);
  }

  async deleteCourse(id: string): Promise<void> {
    await this.assertCourseExists(id);
    await this.repo.softDeleteCourse(id);
  }

  private async assertCourseExists(id: string): Promise<AdminCourseRecord> {
    const course = await this.repo.findCourseById(id);
    if (!course) {
      throw ApiError.notFound('COURSE_NOT_FOUND', 'Course not found');
    }
    return course;
  }
}
