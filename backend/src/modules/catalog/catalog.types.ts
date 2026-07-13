/**
 * Read-only catalog data (Boards, Class Grades, Subjects) — the filter
 * options for Browse Courses and the building blocks of the
 * Board → Class → Subject → Chapter → Module hierarchy
 * (docs/03-database-design.md §2.1). No mutation endpoints exist yet —
 * that's Admin functionality, explicitly out of scope for Module 3A.
 */

export interface BoardSummary {
  id: string;
  name: string;
  slug: string;
}

export interface ClassGradeSummary {
  id: string;
  name: string;
  slug: string;
  order: number;
}

export interface SubjectSummary {
  id: string;
  name: string;
  slug: string;
}

export interface CatalogRepository {
  listBoards(): Promise<BoardSummary[]>;
  listClassGrades(): Promise<ClassGradeSummary[]>;
  listSubjects(): Promise<SubjectSummary[]>;
}
