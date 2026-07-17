import type {
  CourseListFilters,
  CourseListItem,
  CourseRepository,
  CourseWithSyllabus,
  LectureProgressEntry,
  PaginatedResult,
} from '../../../src/modules/courses/courses.types';

export function createFakeCourseRepository(options: {
  courses?: CourseWithSyllabus[];
  enrollments?: Set<string>; // `${studentId}:${courseId}`
  progress?: Map<string, LectureProgressEntry>; // `${studentId}:${lectureId}`
}) {
  const courses = options.courses ?? [];
  const enrollments = options.enrollments ?? new Set<string>();
  const progress = options.progress ?? new Map<string, LectureProgressEntry>();

  const repo: CourseRepository = {
    async listPublishedCourses(filters: CourseListFilters): Promise<PaginatedResult<CourseListItem>> {
      let filtered = courses.filter((c) => c.status === 'PUBLISHED');
      if (filters.boardId) filtered = filtered.filter((c) => c.board.id === filters.boardId);
      if (filters.classGradeId) filtered = filtered.filter((c) => c.classGrade.id === filters.classGradeId);
      if (filters.subjectId) filtered = filtered.filter((c) => c.subject.id === filters.subjectId);
      if (filters.q) {
        const needle = filters.q.toLowerCase();
        filtered = filtered.filter((c) => c.title.toLowerCase().includes(needle));
      }
      const total = filtered.length;
      const start = (filters.page - 1) * filters.limit;
      const page = filtered.slice(start, start + filters.limit).map(({ chapters: _chapters, ...rest }) => rest);
      return { data: page, meta: { page: filters.page, limit: filters.limit, total } };
    },

    async findPublishedCourseBySlugWithContent(slug: string): Promise<CourseWithSyllabus | null> {
      return courses.find((c) => c.slug === slug && c.status === 'PUBLISHED') ?? null;
    },

    async isStudentEnrolled(studentId: string, courseId: string): Promise<boolean> {
      return enrollments.has(`${studentId}:${courseId}`);
    },

    async getLectureProgressForStudent(
      studentId: string,
      lectureIds: string[],
    ): Promise<Map<string, LectureProgressEntry>> {
      const result = new Map<string, LectureProgressEntry>();
      for (const lectureId of lectureIds) {
        const entry = progress.get(`${studentId}:${lectureId}`);
        if (entry) result.set(lectureId, entry);
      }
      return result;
    },
  };

  return { repo, courses, enrollments, progress };
}

export function buildTestCourse(overrides: Partial<CourseWithSyllabus> = {}): CourseWithSyllabus {
  return {
    id: 'course-1',
    title: 'CBSE Class 8 Mathematics',
    slug: 'cbse-class-8-mathematics',
    description: 'A foundation course.',
    board: { id: 'board-cbse', name: 'CBSE', slug: 'cbse' },
    classGrade: { id: 'class-8', name: 'Class 8', slug: 'class-8' },
    subject: { id: 'subject-math', name: 'Mathematics', slug: 'mathematics' },
    teacher: { id: 'teacher-1', fullName: 'Priya Sharma' },
    price: 999,
    discountPrice: null,
    thumbnailUrl: null,
    status: 'PUBLISHED',
    chapters: [
      {
        id: 'chapter-1',
        title: 'Algebra Basics',
        slug: 'algebra-basics',
        order: 1,
        modules: [
          {
            id: 'module-1',
            title: 'Introduction',
            order: 1,
            lectures: [
              {
                id: 'lecture-1',
                title: 'What is Algebra?',
                order: 1,
                durationSec: 600,
                status: 'PUBLISHED',
                progress: null,
              },
              {
                id: 'lecture-2',
                title: 'Variables and Constants',
                order: 2,
                durationSec: 720,
                status: 'PUBLISHED',
                progress: null,
              },
            ],
            notes: [{ id: 'note-1', title: 'Chapter 1 Notes', order: 1 }],
            quizzes: [],
          },
        ],
      },
    ],
    ...overrides,
  };
}
