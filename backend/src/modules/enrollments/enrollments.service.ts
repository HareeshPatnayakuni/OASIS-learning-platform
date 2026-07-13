import type { EnrolledCourseSummary, EnrollmentRepository } from './enrollments.types';

export class EnrollmentService {
  constructor(private readonly repo: EnrollmentRepository) {}

  async listMyCourses(studentId: string): Promise<EnrolledCourseSummary[]> {
    const enrollments = await this.repo.listEnrollmentsForStudent(studentId);

    return Promise.all(
      enrollments.map(async (enrollment): Promise<EnrolledCourseSummary> => {
        const [totalLectures, completedLectures] = await Promise.all([
          this.repo.countPublishedLecturesInCourse(enrollment.course.id),
          this.repo.countCompletedLecturesForStudentInCourse(studentId, enrollment.course.id),
        ]);

        const progressPercent = calculateProgressPercent(completedLectures, totalLectures);

        return {
          enrollmentId: enrollment.id,
          enrolledAt: enrollment.enrolledAt,
          course: enrollment.course,
          totalLectures,
          completedLectures,
          progressPercent,
        };
      }),
    );
  }
}

/**
 * `completedLectures` and `totalLectures` are counted by two separate
 * queries using matching filters (published, non-deleted lectures in the
 * course), and a `LectureProgress` row can only be marked complete for a
 * lecture that was PUBLISHED at write time (`ContentService.
 * updateLectureProgress`) — so `completedLectures <= totalLectures` holds
 * by construction today. The `Math.min(100, ...)` clamp below is a
 * deliberate belt-and-suspenders guarantee anyway: a publicly-displayed
 * progress percentage should be structurally incapable of showing over
 * 100%, rather than depending on that invariant never being broken by a
 * future change to either counting query (e.g., once Teacher/Admin
 * modules can edit content or bulk-mark completion).
 */
function calculateProgressPercent(completedLectures: number, totalLectures: number): number {
  if (totalLectures <= 0) return 0;
  const raw = Math.round((completedLectures / totalLectures) * 100);
  return Math.max(0, Math.min(100, raw));
}
