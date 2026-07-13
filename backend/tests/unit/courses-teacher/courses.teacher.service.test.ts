import { TeacherCourseService } from '../../../src/modules/courses/courses.teacher.service';
import type {
  CreateCourseInput,
  TeacherCourseRepository,
  TeacherCourseSummary,
  UpdateCourseInput,
} from '../../../src/modules/courses/courses.teacher.types';
import * as ownershipLib from '../../../src/lib/ownership';

jest.mock('../../../src/lib/ownership', () => ({
  isCourseOwnedByTeacher: jest.fn(),
}));

const mockedIsCourseOwnedByTeacher = ownershipLib.isCourseOwnedByTeacher as jest.MockedFunction<
  typeof ownershipLib.isCourseOwnedByTeacher
>;

function buildSummary(overrides: Partial<TeacherCourseSummary> = {}): TeacherCourseSummary {
  return {
    id: 'course-1',
    title: 'CBSE Class 8 Mathematics',
    slug: 'cbse-class-8-mathematics',
    description: 'desc',
    board: { id: 'b1', name: 'CBSE', slug: 'cbse' },
    classGrade: { id: 'c1', name: 'Class 8', slug: 'class-8' },
    subject: { id: 's1', name: 'Mathematics', slug: 'mathematics' },
    teacher: { id: 'teacher-1', fullName: 'Priya Sharma' },
    price: 999,
    discountPrice: null,
    thumbnailUrl: null,
    status: 'DRAFT',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    enrollmentCount: 0,
    totalLectures: 0,
    publishedLectures: 0,
    ...overrides,
  };
}

function createFakeTeacherCourseRepository(options: {
  takenSlugs?: Set<string>;
  courses?: Map<string, TeacherCourseSummary>;
}) {
  const takenSlugs = options.takenSlugs ?? new Set<string>();
  const courses = options.courses ?? new Map<string, TeacherCourseSummary>();

  const repo: TeacherCourseRepository = {
    async listCoursesForTeacher(teacherId: string) {
      return [...courses.values()].filter((c) => c.teacher.id === teacherId);
    },
    async isSlugTaken(slug: string) {
      return takenSlugs.has(slug);
    },
    async createCourse(teacherId: string, input: CreateCourseInput & { slug: string }) {
      const summary = buildSummary({
        id: `course-${courses.size + 1}`,
        title: input.title,
        slug: input.slug,
        description: input.description,
        price: input.price,
        discountPrice: input.discountPrice ?? null,
        teacher: { id: teacherId, fullName: 'Teacher' },
      });
      courses.set(summary.id, summary);
      takenSlugs.add(input.slug);
      return summary;
    },
    async findCourseSummaryById(courseId: string) {
      return courses.get(courseId) ?? null;
    },
    async updateCourse(courseId: string, input: UpdateCourseInput) {
      const existing = courses.get(courseId)!;
      const updated = { ...existing, ...input } as TeacherCourseSummary;
      courses.set(courseId, updated);
      return updated;
    },
    async updateCourseStatus(courseId: string, status) {
      const existing = courses.get(courseId)!;
      const updated = { ...existing, status };
      courses.set(courseId, updated);
      return updated;
    },
  };

  return { repo, courses, takenSlugs };
}

describe('TeacherCourseService.createCourse', () => {
  it('generates a slug from the title', async () => {
    const { repo } = createFakeTeacherCourseRepository({});
    const service = new TeacherCourseService(repo);

    const course = await service.createCourse('teacher-1', {
      title: 'CBSE Class 8 Mathematics Foundation',
      description: 'A great course description here.',
      boardId: 'b1',
      classGradeId: 'c1',
      subjectId: 's1',
      price: 999,
    });

    expect(course.slug).toBe('cbse-class-8-mathematics-foundation');
  });

  it('appends a numeric suffix when the base slug is already taken', async () => {
    const { repo } = createFakeTeacherCourseRepository({
      takenSlugs: new Set(['cbse-class-8-mathematics']),
    });
    const service = new TeacherCourseService(repo);

    const course = await service.createCourse('teacher-1', {
      title: 'CBSE Class 8 Mathematics',
      description: 'A great course description here.',
      boardId: 'b1',
      classGradeId: 'c1',
      subjectId: 's1',
      price: 999,
    });

    expect(course.slug).toBe('cbse-class-8-mathematics-2');
  });
});

describe('TeacherCourseService.updateCourse', () => {
  it('updates a course the teacher owns', async () => {
    const existing = buildSummary({ id: 'course-1', teacher: { id: 'teacher-1', fullName: 'T' } });
    const { repo } = createFakeTeacherCourseRepository({ courses: new Map([['course-1', existing]]) });
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const service = new TeacherCourseService(repo);

    const result = await service.updateCourse('course-1', 'teacher-1', { title: 'New Title' });
    expect(result.title).toBe('New Title');
  });

  it('rejects updating a course owned by a different teacher', async () => {
    const existing = buildSummary({ id: 'course-1', teacher: { id: 'teacher-1', fullName: 'T' } });
    const { repo } = createFakeTeacherCourseRepository({ courses: new Map([['course-1', existing]]) });
    mockedIsCourseOwnedByTeacher.mockResolvedValue(false);
    const service = new TeacherCourseService(repo);

    await expect(service.updateCourse('course-1', 'teacher-2', { title: 'Hijacked' })).rejects.toMatchObject({
      code: 'NOT_COURSE_OWNER',
      statusCode: 403,
    });
  });

  it('404s for a course that does not exist', async () => {
    const { repo } = createFakeTeacherCourseRepository({});
    const service = new TeacherCourseService(repo);

    await expect(service.updateCourse('nope', 'teacher-1', { title: 'X' })).rejects.toMatchObject({
      code: 'COURSE_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('TeacherCourseService.getMyCourseById', () => {
  it('returns a course the teacher owns', async () => {
    const existing = buildSummary({ id: 'course-1', teacher: { id: 'teacher-1', fullName: 'T' } });
    const { repo } = createFakeTeacherCourseRepository({ courses: new Map([['course-1', existing]]) });
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const service = new TeacherCourseService(repo);

    const result = await service.getMyCourseById('course-1', 'teacher-1');
    expect(result.id).toBe('course-1');
  });

  it('rejects fetching a course owned by a different teacher', async () => {
    const existing = buildSummary({ id: 'course-1', teacher: { id: 'teacher-1', fullName: 'T' } });
    const { repo } = createFakeTeacherCourseRepository({ courses: new Map([['course-1', existing]]) });
    mockedIsCourseOwnedByTeacher.mockResolvedValue(false);
    const service = new TeacherCourseService(repo);

    await expect(service.getMyCourseById('course-1', 'teacher-2')).rejects.toMatchObject({
      code: 'NOT_COURSE_OWNER',
      statusCode: 403,
    });
  });

  it('404s for a course that does not exist', async () => {
    const { repo } = createFakeTeacherCourseRepository({});
    const service = new TeacherCourseService(repo);

    await expect(service.getMyCourseById('nope', 'teacher-1')).rejects.toMatchObject({
      code: 'COURSE_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('TeacherCourseService.updateCourseStatus', () => {
  it('allows a valid status transition for the owning teacher', async () => {
    const existing = buildSummary({ id: 'course-1', teacher: { id: 'teacher-1', fullName: 'T' }, status: 'DRAFT' });
    const { repo } = createFakeTeacherCourseRepository({ courses: new Map([['course-1', existing]]) });
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const service = new TeacherCourseService(repo);

    const result = await service.updateCourseStatus('course-1', 'teacher-1', 'PUBLISHED');
    expect(result.status).toBe('PUBLISHED');
  });

  it('allows reverting from ARCHIVED back to DRAFT (no restricted state machine)', async () => {
    const existing = buildSummary({
      id: 'course-1',
      teacher: { id: 'teacher-1', fullName: 'T' },
      status: 'ARCHIVED',
    });
    const { repo } = createFakeTeacherCourseRepository({ courses: new Map([['course-1', existing]]) });
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const service = new TeacherCourseService(repo);

    const result = await service.updateCourseStatus('course-1', 'teacher-1', 'DRAFT');
    expect(result.status).toBe('DRAFT');
  });

  it('rejects an invalid status value', async () => {
    const existing = buildSummary({ id: 'course-1', teacher: { id: 'teacher-1', fullName: 'T' } });
    const { repo } = createFakeTeacherCourseRepository({ courses: new Map([['course-1', existing]]) });
    const service = new TeacherCourseService(repo);

    await expect(service.updateCourseStatus('course-1', 'teacher-1', 'NOT_A_STATUS')).rejects.toMatchObject({
      code: 'INVALID_STATUS',
      statusCode: 400,
    });
  });

  it('rejects a status change from a non-owning teacher', async () => {
    const existing = buildSummary({ id: 'course-1', teacher: { id: 'teacher-1', fullName: 'T' } });
    const { repo } = createFakeTeacherCourseRepository({ courses: new Map([['course-1', existing]]) });
    mockedIsCourseOwnedByTeacher.mockResolvedValue(false);
    const service = new TeacherCourseService(repo);

    await expect(service.updateCourseStatus('course-1', 'teacher-2', 'PUBLISHED')).rejects.toMatchObject({
      code: 'NOT_COURSE_OWNER',
      statusCode: 403,
    });
  });
});
