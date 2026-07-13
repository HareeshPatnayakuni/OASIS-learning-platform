import type { CourseStatus } from '@prisma/client';
import type { CatalogRef, TeacherRef } from '../courses/courses.types';

/**
 * Deliberately a SEPARATE set of files from Module 3A's frozen
 * courses.types.ts/courses.repository.ts/courses.service.ts — per your
 * instruction not to modify Module 3A further, this is new, additive
 * capability living alongside it in the same `modules/courses/` directory,
 * not a change to what's already there. Both sides import the shared
 * `CatalogRef`/`TeacherRef` shapes (type-only, zero runtime coupling).
 */

export interface TeacherCourseSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  board: CatalogRef;
  classGrade: CatalogRef;
  subject: CatalogRef;
  teacher: TeacherRef;
  price: number;
  discountPrice: number | null;
  thumbnailUrl: string | null;
  status: CourseStatus;
  createdAt: Date;
  updatedAt: Date;
  /** Basic counts only — Module 3B explicitly excludes "analytics"; this
   * is the "Course statistics (basic)" the Teacher Dashboard asked for,
   * not a dashboard/trends feature. */
  enrollmentCount: number;
  totalLectures: number;
  publishedLectures: number;
}

export interface CreateCourseInput {
  title: string;
  description: string;
  boardId: string;
  classGradeId: string;
  subjectId: string;
  price: number;
  discountPrice?: number | null;
}

export interface UpdateCourseInput {
  title?: string;
  description?: string;
  boardId?: string;
  classGradeId?: string;
  subjectId?: string;
  price?: number;
  discountPrice?: number | null;
  thumbnailId?: string | null;
}

export interface TeacherCourseRepository {
  listCoursesForTeacher(teacherId: string): Promise<TeacherCourseSummary[]>;
  isSlugTaken(slug: string): Promise<boolean>;
  createCourse(
    teacherId: string,
    input: CreateCourseInput & { slug: string },
  ): Promise<TeacherCourseSummary>;
  findCourseSummaryById(courseId: string): Promise<TeacherCourseSummary | null>;
  updateCourse(courseId: string, input: UpdateCourseInput): Promise<TeacherCourseSummary>;
  updateCourseStatus(courseId: string, status: CourseStatus): Promise<TeacherCourseSummary>;
}
