import type { CourseStatus, LectureStatus } from '@prisma/client';

/**
 * The public Course Details page and the enrolled Course Player share the
 * same underlying data shape — the difference is purely which optional
 * fields are populated (`isEnrolled`, per-lecture `progress`), not a
 * different endpoint or a different repository method. See
 * CourseService.getCourseDetail for how the two cases are merged.
 */

export interface CatalogRef {
  id: string;
  name: string;
  slug: string;
}

export interface TeacherRef {
  id: string;
  fullName: string;
}

export interface CourseListItem {
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
}

export interface LectureSummary {
  id: string;
  title: string;
  order: number;
  durationSec: number | null;
  status: LectureStatus;
  /** null when the requester isn't an enrolled student (public view or
   * not-yet-enrolled); populated only for the enrolled student's own
   * progress. */
  progress: { lastPositionSec: number; isCompleted: boolean } | null;
}

export interface NoteSummary {
  id: string;
  title: string;
  order: number;
}

export interface ModuleWithContent {
  id: string;
  title: string;
  order: number;
  lectures: LectureSummary[];
  notes: NoteSummary[];
}

export interface ChapterWithModules {
  id: string;
  title: string;
  slug: string;
  order: number;
  modules: ModuleWithContent[];
}

export interface CourseWithSyllabus extends CourseListItem {
  chapters: ChapterWithModules[];
}

export interface CourseDetail extends CourseWithSyllabus {
  isEnrolled: boolean;
}

export interface CourseListFilters {
  boardId?: string;
  classGradeId?: string;
  subjectId?: string;
  q?: string;
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

export interface LectureProgressEntry {
  lastPositionSec: number;
  isCompleted: boolean;
}

export interface CourseRepository {
  listPublishedCourses(filters: CourseListFilters): Promise<PaginatedResult<CourseListItem>>;
  findPublishedCourseBySlugWithContent(slug: string): Promise<CourseWithSyllabus | null>;
  isStudentEnrolled(studentId: string, courseId: string): Promise<boolean>;
  getLectureProgressForStudent(
    studentId: string,
    lectureIds: string[],
  ): Promise<Map<string, LectureProgressEntry>>;
}
