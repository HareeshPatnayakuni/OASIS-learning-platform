import { CourseService } from '../../../src/modules/courses/courses.service';
import { buildTestCourse, createFakeCourseRepository } from './fakeCourseRepository';
import type { LectureProgressEntry } from '../../../src/modules/courses/courses.types';

describe('CourseService.listCourses', () => {
  it('returns only published courses, paginated', async () => {
    const published = buildTestCourse({ id: 'c1', slug: 'c1' });
    const draft = buildTestCourse({ id: 'c2', slug: 'c2', status: 'DRAFT' });
    const { repo } = createFakeCourseRepository({ courses: [published, draft] });
    const service = new CourseService(repo);

    const result = await service.listCourses({});

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('c1');
    expect(result.meta.total).toBe(1);
  });

  it('filters by boardId/classGradeId/subjectId', async () => {
    const cbseMath = buildTestCourse({ id: 'c1', slug: 'c1' });
    const icseScience = buildTestCourse({
      id: 'c2',
      slug: 'c2',
      board: { id: 'board-icse', name: 'ICSE', slug: 'icse' },
      subject: { id: 'subject-science', name: 'Science', slug: 'science' },
    });
    const { repo } = createFakeCourseRepository({ courses: [cbseMath, icseScience] });
    const service = new CourseService(repo);

    const result = await service.listCourses({ boardId: 'board-icse' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('c2');
  });

  it('filters by a case-insensitive title search', async () => {
    const course = buildTestCourse({ id: 'c1', slug: 'c1', title: 'CBSE Class 8 Mathematics' });
    const { repo } = createFakeCourseRepository({ courses: [course] });
    const service = new CourseService(repo);

    await expect(service.listCourses({ q: 'mathematics' })).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'c1' })],
    });
    await expect(service.listCourses({ q: 'nonexistent-subject' })).resolves.toMatchObject({
      data: [],
    });
  });

  it('defaults to page 1, limit 20, and caps limit at 50', async () => {
    const courses = Array.from({ length: 5 }, (_, i) => buildTestCourse({ id: `c${i}`, slug: `c${i}` }));
    const { repo } = createFakeCourseRepository({ courses });
    const service = new CourseService(repo);

    const defaultResult = await service.listCourses({});
    expect(defaultResult.meta.page).toBe(1);
    expect(defaultResult.meta.limit).toBe(20);

    const cappedResult = await service.listCourses({ limit: 500 });
    expect(cappedResult.meta.limit).toBe(50);
  });
});

describe('CourseService.getCourseDetail', () => {
  it('throws COURSE_NOT_FOUND for an unknown slug', async () => {
    const { repo } = createFakeCourseRepository({});
    const service = new CourseService(repo);

    await expect(service.getCourseDetail('does-not-exist')).rejects.toMatchObject({
      code: 'COURSE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('throws COURSE_NOT_FOUND for a course that exists but is not published', async () => {
    const draft = buildTestCourse({ status: 'DRAFT' });
    const { repo } = createFakeCourseRepository({ courses: [draft] });
    const service = new CourseService(repo);

    await expect(service.getCourseDetail(draft.slug)).rejects.toMatchObject({
      code: 'COURSE_NOT_FOUND',
    });
  });

  it('returns the full syllabus with isEnrolled=false and no progress for an anonymous request', async () => {
    const course = buildTestCourse();
    const { repo } = createFakeCourseRepository({ courses: [course] });
    const service = new CourseService(repo);

    const result = await service.getCourseDetail(course.slug);

    expect(result.isEnrolled).toBe(false);
    expect(result.chapters[0]?.modules[0]?.lectures[0]?.progress).toBeNull();
    // Structure (titles, order, duration) is still fully visible.
    expect(result.chapters[0]?.modules[0]?.lectures).toHaveLength(2);
  });

  it('returns isEnrolled=false for a logged-in student who is not enrolled in this course', async () => {
    const course = buildTestCourse();
    const { repo } = createFakeCourseRepository({ courses: [course] });
    const service = new CourseService(repo);

    const result = await service.getCourseDetail(course.slug, 'student-not-enrolled');
    expect(result.isEnrolled).toBe(false);
  });

  it('merges per-lecture progress for an enrolled student', async () => {
    const course = buildTestCourse();
    const progressMap = new Map<string, LectureProgressEntry>([
      ['student-1:lecture-1', { lastPositionSec: 300, isCompleted: false }],
    ]);
    const { repo } = createFakeCourseRepository({
      courses: [course],
      enrollments: new Set(['student-1:course-1']),
      progress: progressMap,
    });
    const service = new CourseService(repo);

    const result = await service.getCourseDetail(course.slug, 'student-1');

    expect(result.isEnrolled).toBe(true);
    const [lecture1, lecture2] = result.chapters[0]!.modules[0]!.lectures;
    expect(lecture1?.progress).toEqual({ lastPositionSec: 300, isCompleted: false });
    // A lecture with no progress row yet defaults to "not started", not null,
    // once the student is enrolled — null specifically means "not enrolled".
    expect(lecture2?.progress).toEqual({ lastPositionSec: 0, isCompleted: false });
  });
});
