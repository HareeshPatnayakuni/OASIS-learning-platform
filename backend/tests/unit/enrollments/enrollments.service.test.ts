import { EnrollmentService } from '../../../src/modules/enrollments/enrollments.service';
import type { EnrollmentRepository, RawEnrollment } from '../../../src/modules/enrollments/enrollments.types';
import type { CourseListItem } from '../../../src/modules/courses/courses.types';

function buildCourse(overrides: Partial<CourseListItem> = {}): CourseListItem {
  return {
    id: 'course-1',
    title: 'CBSE Class 8 Mathematics',
    slug: 'cbse-class-8-mathematics',
    description: 'desc',
    board: { id: 'b1', name: 'CBSE', slug: 'cbse' },
    classGrade: { id: 'c1', name: 'Class 8', slug: 'class-8' },
    subject: { id: 's1', name: 'Mathematics', slug: 'mathematics' },
    teacher: { id: 't1', fullName: 'Priya Sharma' },
    price: 999,
    discountPrice: null,
    thumbnailUrl: null,
    status: 'PUBLISHED',
    ...overrides,
  };
}

function createFakeEnrollmentRepository(options: {
  enrollments?: RawEnrollment[];
  totalLectures?: Record<string, number>;
  completedLectures?: Record<string, number>;
}): EnrollmentRepository {
  const enrollments = options.enrollments ?? [];
  const totalLectures = options.totalLectures ?? {};
  const completedLectures = options.completedLectures ?? {};

  return {
    async listEnrollmentsForStudent() {
      return enrollments;
    },
    async countPublishedLecturesInCourse(courseId: string) {
      return totalLectures[courseId] ?? 0;
    },
    async countCompletedLecturesForStudentInCourse(_studentId: string, courseId: string) {
      return completedLectures[courseId] ?? 0;
    },
    // Module 4A additions — not exercised by this suite (EnrollmentService's
    // own tests only cover listMyCourses); minimal stubs to satisfy the
    // interface. See tests/unit/payments for real coverage of these.
    async findEnrollment() {
      return null;
    },
    async createEnrollment(studentId: string, courseId: string) {
      return { id: `${studentId}-${courseId}` };
    },
  };
}

describe('EnrollmentService.listMyCourses', () => {
  it('returns an empty list for a student with no enrollments', async () => {
    const service = new EnrollmentService(createFakeEnrollmentRepository({}));
    await expect(service.listMyCourses('student-1')).resolves.toEqual([]);
  });

  it('computes a rounded progress percentage', async () => {
    const repo = createFakeEnrollmentRepository({
      enrollments: [{ id: 'enr-1', enrolledAt: new Date('2026-01-01'), course: buildCourse() }],
      totalLectures: { 'course-1': 3 },
      completedLectures: { 'course-1': 1 }, // 1/3 = 33.33...%
    });
    const service = new EnrollmentService(repo);

    const result = await service.listMyCourses('student-1');
    expect(result[0]?.progressPercent).toBe(33);
    expect(result[0]?.totalLectures).toBe(3);
    expect(result[0]?.completedLectures).toBe(1);
  });

  it('reports 0% (not NaN) for a course with zero published lectures', async () => {
    const repo = createFakeEnrollmentRepository({
      enrollments: [{ id: 'enr-1', enrolledAt: new Date('2026-01-01'), course: buildCourse() }],
      totalLectures: { 'course-1': 0 },
      completedLectures: {},
    });
    const service = new EnrollmentService(repo);

    const result = await service.listMyCourses('student-1');
    expect(result[0]?.progressPercent).toBe(0);
    expect(Number.isNaN(result[0]?.progressPercent)).toBe(false);
  });

  it('reports 100% when every published lecture is completed', async () => {
    const repo = createFakeEnrollmentRepository({
      enrollments: [{ id: 'enr-1', enrolledAt: new Date('2026-01-01'), course: buildCourse() }],
      totalLectures: { 'course-1': 5 },
      completedLectures: { 'course-1': 5 },
    });
    const service = new EnrollmentService(repo);

    const result = await service.listMyCourses('student-1');
    expect(result[0]?.progressPercent).toBe(100);
  });

  it('computes progress independently per course across multiple enrollments', async () => {
    const repo = createFakeEnrollmentRepository({
      enrollments: [
        { id: 'enr-1', enrolledAt: new Date('2026-01-01'), course: buildCourse({ id: 'course-1', slug: 'c1' }) },
        { id: 'enr-2', enrolledAt: new Date('2026-01-02'), course: buildCourse({ id: 'course-2', slug: 'c2' }) },
      ],
      totalLectures: { 'course-1': 10, 'course-2': 4 },
      completedLectures: { 'course-1': 2, 'course-2': 4 },
    });
    const service = new EnrollmentService(repo);

    const result = await service.listMyCourses('student-1');
    const byId = Object.fromEntries(result.map((r) => [r.course.id, r.progressPercent]));
    expect(byId['course-1']).toBe(20);
    expect(byId['course-2']).toBe(100);
  });

  it('clamps progressPercent to 100 even if completedLectures somehow exceeds totalLectures', async () => {
    // Shouldn't happen given the current write path (ContentService only
    // lets a PUBLISHED lecture be marked complete, and both counts share
    // the same published/non-deleted filter) — this test exists precisely
    // so the 100% ceiling holds structurally, not just by that invariant
    // never being broken by a future change. See the comment on
    // calculateProgressPercent in enrollments.service.ts.
    const repo = createFakeEnrollmentRepository({
      enrollments: [{ id: 'enr-1', enrolledAt: new Date('2026-01-01'), course: buildCourse() }],
      totalLectures: { 'course-1': 3 },
      completedLectures: { 'course-1': 7 }, // deliberately inconsistent
    });
    const service = new EnrollmentService(repo);

    const result = await service.listMyCourses('student-1');
    expect(result[0]?.progressPercent).toBe(100);
    expect(result[0]?.progressPercent).toBeLessThanOrEqual(100);
  });

  it('never returns a negative progressPercent', async () => {
    const repo = createFakeEnrollmentRepository({
      enrollments: [{ id: 'enr-1', enrolledAt: new Date('2026-01-01'), course: buildCourse() }],
      totalLectures: { 'course-1': 5 },
      completedLectures: { 'course-1': -1 }, // deliberately invalid
    });
    const service = new EnrollmentService(repo);

    const result = await service.listMyCourses('student-1');
    expect(result[0]?.progressPercent).toBeGreaterThanOrEqual(0);
  });
});
