import type { LectureStatus } from '@prisma/client';

/**
 * Teacher-authoring CRUD for the content tree (Course → Chapter →
 * ContentModule → {Lecture, Note}). Deliberately a separate module from
 * Module 3A's frozen `content` module (which only ever handles
 * student-facing signed URLs + progress) — this one handles teacher
 * writes. Neither module imports from the other; they share the schema,
 * not code.
 *
 * Reordering is "move up / move down" (swap with the adjacent sibling by
 * `order`), not drag-and-drop or arbitrary position — per your explicit
 * instruction to keep this simple for now.
 */

export type MoveDirection = 'up' | 'down';

// ── Chapters ─────────────────────────────────────────────────────────

export interface ChapterRecord {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  order: number;
}

export interface CreateChapterInput {
  title: string;
}

export interface UpdateChapterInput {
  title?: string;
}

// ── Content Modules ──────────────────────────────────────────────────

export interface ContentModuleRecord {
  id: string;
  chapterId: string;
  title: string;
  order: number;
}

export interface CreateContentModuleInput {
  title: string;
}

export interface UpdateContentModuleInput {
  title?: string;
}

// ── Lectures ─────────────────────────────────────────────────────────

export interface LectureRecord {
  id: string;
  moduleId: string;
  title: string;
  order: number;
  durationSec: number | null;
  status: LectureStatus;
  r2ObjectKey: string;
}

export interface CreateLectureInput {
  title: string;
  durationSec?: number | null;
}

export interface UpdateLectureInput {
  title?: string;
  durationSec?: number | null;
}

// ── Notes ────────────────────────────────────────────────────────────

export interface NoteRecord {
  id: string;
  moduleId: string;
  title: string;
  order: number;
  r2ObjectKey: string;
}

export interface CreateNoteInput {
  title: string;
}

export interface UpdateNoteInput {
  title?: string;
}

// ── Full tree (Course Builder read model) ───────────────────────────

export interface QuizSummaryForBuilder {
  id: string;
  title: string;
  questionCount: number;
}

export interface ModuleWithFullContent extends ContentModuleRecord {
  lectures: LectureRecord[];
  notes: NoteRecord[];
  quizzes: QuizSummaryForBuilder[];
}

export interface ChapterWithFullContent extends ChapterRecord {
  modules: ModuleWithFullContent[];
}

// ── Repository ───────────────────────────────────────────────────────

export interface ContentManagementRepository {
  // Chapters
  createChapter(courseId: string, input: CreateChapterInput & { slug: string; order: number }): Promise<ChapterRecord>;
  findChapterById(id: string): Promise<ChapterRecord | null>;
  updateChapter(id: string, input: UpdateChapterInput): Promise<ChapterRecord>;
  softDeleteChapter(id: string): Promise<void>;
  listChapterSiblingsOrdered(courseId: string): Promise<ChapterRecord[]>;
  swapChapterOrder(aId: string, aOrder: number, bId: string, bOrder: number): Promise<void>;
  isChapterSlugTakenInCourse(courseId: string, slug: string): Promise<boolean>;

  // Content Modules
  createContentModule(
    chapterId: string,
    input: CreateContentModuleInput & { order: number },
  ): Promise<ContentModuleRecord>;
  findContentModuleById(id: string): Promise<ContentModuleRecord | null>;
  updateContentModule(id: string, input: UpdateContentModuleInput): Promise<ContentModuleRecord>;
  softDeleteContentModule(id: string): Promise<void>;
  listContentModuleSiblingsOrdered(chapterId: string): Promise<ContentModuleRecord[]>;
  swapContentModuleOrder(aId: string, aOrder: number, bId: string, bOrder: number): Promise<void>;

  // Lectures
  createLecture(
    moduleId: string,
    input: CreateLectureInput & { order: number; r2ObjectKey: string },
  ): Promise<LectureRecord>;
  findLectureById(id: string): Promise<LectureRecord | null>;
  updateLecture(id: string, input: UpdateLectureInput): Promise<LectureRecord>;
  updateLectureStatus(id: string, status: LectureStatus): Promise<LectureRecord>;
  softDeleteLecture(id: string): Promise<void>;
  listLectureSiblingsOrdered(moduleId: string): Promise<LectureRecord[]>;
  swapLectureOrder(aId: string, aOrder: number, bId: string, bOrder: number): Promise<void>;

  // Notes
  createNote(moduleId: string, input: CreateNoteInput & { order: number; r2ObjectKey: string }): Promise<NoteRecord>;
  findNoteById(id: string): Promise<NoteRecord | null>;
  updateNote(id: string, input: UpdateNoteInput): Promise<NoteRecord>;
  softDeleteNote(id: string): Promise<void>;
  countNotesInModule(moduleId: string): Promise<number>;

  // Full tree (Course Builder) — every status, not just PUBLISHED; this is
  // what makes it a Teacher-only read, distinct from Module 3A's public
  // GET /courses/:slug (which deliberately filters to PUBLISHED lectures).
  getFullContentTree(courseId: string): Promise<ChapterWithFullContent[]>;
}
