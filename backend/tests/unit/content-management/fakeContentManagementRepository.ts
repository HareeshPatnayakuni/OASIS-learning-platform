import { randomUUID } from 'node:crypto';
import type {
  ChapterRecord,
  ContentManagementRepository,
  ContentModuleRecord,
  CreateContentModuleInput,
  CreateLectureInput,
  CreateNoteInput,
  LectureRecord,
  NoteRecord,
  UpdateChapterInput,
  UpdateContentModuleInput,
  UpdateLectureInput,
  UpdateNoteInput,
} from '../../../src/modules/content-management/content-management.types';

/** One in-memory store shared by every test in a file (fresh per
 * `createFakeContentManagementRepository()` call) — realistic enough to
 * exercise ordering/reordering logic genuinely, not just return
 * pre-canned values. */
export function createFakeContentManagementRepository() {
  const chapters = new Map<string, ChapterRecord>();
  const contentModules = new Map<string, ContentModuleRecord>();
  const lectures = new Map<string, LectureRecord>();
  const notes = new Map<string, NoteRecord>();

  function sortedByOrder<T extends { order: number }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.order - b.order);
  }

  const repo: ContentManagementRepository = {
    // Chapters
    async createChapter(courseId, input) {
      const record: ChapterRecord = { id: randomUUID(), courseId, title: input.title, slug: input.slug, order: input.order };
      chapters.set(record.id, record);
      return record;
    },
    async findChapterById(id) {
      return chapters.get(id) ?? null;
    },
    async updateChapter(id, input: UpdateChapterInput) {
      const existing = chapters.get(id)!;
      const updated = { ...existing, ...(input.title !== undefined ? { title: input.title } : {}) };
      chapters.set(id, updated);
      return updated;
    },
    async softDeleteChapter(id) {
      chapters.delete(id);
    },
    async listChapterSiblingsOrdered(courseId) {
      return sortedByOrder([...chapters.values()].filter((c) => c.courseId === courseId));
    },
    async swapChapterOrder(aId, aOrder, bId, bOrder) {
      chapters.set(aId, { ...chapters.get(aId)!, order: bOrder });
      chapters.set(bId, { ...chapters.get(bId)!, order: aOrder });
    },
    async isChapterSlugTakenInCourse(courseId, slug) {
      return [...chapters.values()].some((c) => c.courseId === courseId && c.slug === slug);
    },

    // Content Modules
    async createContentModule(chapterId, input: CreateContentModuleInput & { order: number }) {
      const record: ContentModuleRecord = { id: randomUUID(), chapterId, title: input.title, order: input.order };
      contentModules.set(record.id, record);
      return record;
    },
    async findContentModuleById(id) {
      return contentModules.get(id) ?? null;
    },
    async updateContentModule(id, input: UpdateContentModuleInput) {
      const existing = contentModules.get(id)!;
      const updated = { ...existing, ...(input.title !== undefined ? { title: input.title } : {}) };
      contentModules.set(id, updated);
      return updated;
    },
    async softDeleteContentModule(id) {
      contentModules.delete(id);
    },
    async listContentModuleSiblingsOrdered(chapterId) {
      return sortedByOrder([...contentModules.values()].filter((m) => m.chapterId === chapterId));
    },
    async swapContentModuleOrder(aId, aOrder, bId, bOrder) {
      contentModules.set(aId, { ...contentModules.get(aId)!, order: bOrder });
      contentModules.set(bId, { ...contentModules.get(bId)!, order: aOrder });
    },

    // Lectures
    async createLecture(moduleId, input: CreateLectureInput & { order: number; r2ObjectKey: string }) {
      const record: LectureRecord = {
        id: randomUUID(),
        moduleId,
        title: input.title,
        order: input.order,
        durationSec: input.durationSec ?? null,
        status: 'DRAFT',
        r2ObjectKey: input.r2ObjectKey,
      };
      lectures.set(record.id, record);
      return record;
    },
    async findLectureById(id) {
      return lectures.get(id) ?? null;
    },
    async updateLecture(id, input: UpdateLectureInput) {
      const existing = lectures.get(id)!;
      const updated = {
        ...existing,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.durationSec !== undefined ? { durationSec: input.durationSec } : {}),
      };
      lectures.set(id, updated);
      return updated;
    },
    async updateLectureStatus(id, status) {
      const updated = { ...lectures.get(id)!, status };
      lectures.set(id, updated);
      return updated;
    },
    async softDeleteLecture(id) {
      lectures.delete(id);
    },
    async listLectureSiblingsOrdered(moduleId) {
      return sortedByOrder([...lectures.values()].filter((l) => l.moduleId === moduleId));
    },
    async swapLectureOrder(aId, aOrder, bId, bOrder) {
      lectures.set(aId, { ...lectures.get(aId)!, order: bOrder });
      lectures.set(bId, { ...lectures.get(bId)!, order: aOrder });
    },

    // Notes
    async createNote(moduleId, input: CreateNoteInput & { order: number; r2ObjectKey: string }) {
      const record: NoteRecord = { id: randomUUID(), moduleId, title: input.title, order: input.order, r2ObjectKey: input.r2ObjectKey };
      notes.set(record.id, record);
      return record;
    },
    async findNoteById(id) {
      return notes.get(id) ?? null;
    },
    async updateNote(id, input: UpdateNoteInput) {
      const existing = notes.get(id)!;
      const updated = { ...existing, ...(input.title !== undefined ? { title: input.title } : {}) };
      notes.set(id, updated);
      return updated;
    },
    async softDeleteNote(id) {
      notes.delete(id);
    },
    async countNotesInModule(moduleId) {
      return [...notes.values()].filter((n) => n.moduleId === moduleId).length;
    },

    async getFullContentTree(courseId) {
      const courseChapters = sortedByOrder([...chapters.values()].filter((c) => c.courseId === courseId));
      return courseChapters.map((chapter) => ({
        ...chapter,
        modules: sortedByOrder([...contentModules.values()].filter((m) => m.chapterId === chapter.id)).map(
          (mod) => ({
            ...mod,
            lectures: sortedByOrder([...lectures.values()].filter((l) => l.moduleId === mod.id)),
            notes: sortedByOrder([...notes.values()].filter((n) => n.moduleId === mod.id)),
            quizzes: [],
          }),
        ),
      }));
    },
  };

  return { repo, chapters, contentModules, lectures, notes };
}
