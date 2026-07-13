import { AdminCourseService } from '../../../src/modules/admin/courses.service';
import { createFakeAdminRepository } from './fakeAdminRepository';
import type { AdminCourseRecord } from '../../../src/modules/admin/admin.types';

function buildCourse(overrides: Partial<AdminCourseRecord> = {}): AdminCourseRecord {
  return {
    id: 'course-1',
    title: 'CBSE Class 8 Mathematics',
    slug: 'cbse-class-8-mathematics',
    status: 'PUBLISHED',
    teacher: { id: 'teacher-1', fullName: 'Priya Sharma', email: 'priya@oasis.example.com' },
    enrollmentCount: 3,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('AdminCourseService.listCourses', () => {
  it('lists every course regardless of status', async () => {
    const { repo } = createFakeAdminRepository({
      courses: [
        buildCourse({ id: 'c1', status: 'DRAFT' }),
        buildCourse({ id: 'c2', status: 'PUBLISHED' }),
        buildCourse({ id: 'c3', status: 'ARCHIVED' }),
      ],
    });
    const service = new AdminCourseService(repo);

    const result = await service.listCourses({}, 1, 20);
    expect(result.data).toHaveLength(3);
  });

  it('filters by status when provided', async () => {
    const { repo } = createFakeAdminRepository({
      courses: [buildCourse({ id: 'c1', status: 'DRAFT' }), buildCourse({ id: 'c2', status: 'PUBLISHED' })],
    });
    const service = new AdminCourseService(repo);

    const result = await service.listCourses({ status: 'DRAFT' }, 1, 20);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe('c1');
  });

  it('includes the owning teacher on every course', async () => {
    const { repo } = createFakeAdminRepository({ courses: [buildCourse()] });
    const service = new AdminCourseService(repo);

    const result = await service.listCourses({}, 1, 20);
    expect(result.data[0]?.teacher.fullName).toBe('Priya Sharma');
  });
});

describe('AdminCourseService.archiveCourse', () => {
  it('archives a published course', async () => {
    const { repo } = createFakeAdminRepository({ courses: [buildCourse({ status: 'PUBLISHED' })] });
    const service = new AdminCourseService(repo);

    const archived = await service.archiveCourse('course-1');
    expect(archived.status).toBe('ARCHIVED');
  });

  it('404s for a course that does not exist', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminCourseService(repo);

    await expect(service.archiveCourse('nope')).rejects.toMatchObject({
      code: 'COURSE_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('AdminCourseService.deleteCourse', () => {
  it('soft-deletes a course', async () => {
    const { repo, courses } = createFakeAdminRepository({ courses: [buildCourse()] });
    const service = new AdminCourseService(repo);

    await service.deleteCourse('course-1');
    expect(courses.has('course-1')).toBe(false);
  });

  it('404s for a course that does not exist', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminCourseService(repo);

    await expect(service.deleteCourse('nope')).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' });
  });
});

describe('AdminCourseService structural guarantee', () => {
  it('has no dependency on the content-management repository — cannot touch chapters/modules/lectures/quizzes/notes', () => {
    // This is deliberately a "does the code even have the capability"
    // check, not a behavioral one: AdminCourseService is constructed with
    // only an AdminRepository, which has no chapter/module/lecture/quiz/
    // note methods on its interface at all (see admin.types.ts). There is
    // no method on this service that could reach that content, by
    // construction, not by a runtime permission check.
    const service = new AdminCourseService(createFakeAdminRepository({}).repo);
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(service));
    expect(methodNames).toEqual(
      expect.arrayContaining(['listCourses', 'archiveCourse', 'deleteCourse']),
    );
    expect(methodNames.some((m) => /chapter|module|lecture|quiz|note/i.test(m))).toBe(false);
  });
});
