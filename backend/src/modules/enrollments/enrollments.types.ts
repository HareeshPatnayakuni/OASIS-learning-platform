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
}
