import type { CourseListItem } from '../courses/courses.types';

export interface RawEnrollment {
  id: string;
  enrolledAt: Date;
  course: CourseListItem;
}

export interface EnrolledCourseSummary {
  enrollmentId: string;
  enrolledAt: Date;
  course: CourseListItem;
  totalLectures: number;
  completedLectures: number;
  /** 0–100, rounded. 0 for a course with no published lectures yet, never
   * a division-by-zero NaN. */
  progressPercent: number;
}

export interface EnrollmentRepository {
  listEnrollmentsForStudent(studentId: string): Promise<RawEnrollment[]>;
  countPublishedLecturesInCourse(courseId: string): Promise<number>;
  countCompletedLecturesForStudentInCourse(studentId: string, courseId: string): Promise<number>;
  /**
   * Module 4A addition. `paymentId` is omitted entirely for a free-course
   * enrollment (matching the schema's own comment on `Enrollment.paymentId`
   * — nullable because not every enrollment comes from a real payment).
   * Returns the existing row instead of throwing if one already exists
   * for this (studentId, courseId) pair — enrollment creation must be
   * idempotent, since it can be reached both from a fresh purchase and
   * from a retried payment-verification call for one that already
   * succeeded.
   */
  findEnrollment(studentId: string, courseId: string): Promise<{ id: string } | null>;
  createEnrollment(studentId: string, courseId: string, paymentId?: string): Promise<{ id: string }>;
}
