import type { LectureStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  ChapterRecord,
  ChapterWithFullContent,
  ContentManagementRepository,
  ContentModuleRecord,
  CreateChapterInput,
  CreateContentModuleInput,
  CreateLectureInput,
  CreateNoteInput,
  LectureRecord,
  NoteRecord,
  UpdateChapterInput,
  UpdateContentModuleInput,
  UpdateLectureInput,
  UpdateNoteInput,
} from './content-management.types';

const chapterSelect = { id: true, courseId: true, title: true, slug: true, order: true } as const;
const contentModuleSelect = { id: true, chapterId: true, title: true, order: true } as const;
const lectureSelect = {
  id: true,
  moduleId: true,
  title: true,
  order: true,
  durationSec: true,
  status: true,
  r2ObjectKey: true,
} as const;
const noteSelect = { id: true, moduleId: true, title: true, order: true, r2ObjectKey: true } as const;

export class PrismaContentManagementRepository implements ContentManagementRepository {
  // ── Chapters ─────────────────────────────────────────────────────

  async createChapter(
    courseId: string,
    input: CreateChapterInput & { slug: string; order: number },
  ): Promise<ChapterRecord> {
    return await prisma.chapter.create({
      data: { courseId, title: input.title, slug: input.slug, order: input.order },
      select: chapterSelect,
    });
  }

  async findChapterById(id: string): Promise<ChapterRecord | null> {
    return await prisma.chapter.findFirst({ where: { id, deletedAt: null }, select: chapterSelect });
  }

  async updateChapter(id: string, input: UpdateChapterInput): Promise<ChapterRecord> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    return await prisma.chapter.update({ where: { id }, data, select: chapterSelect });
  }

  async softDeleteChapter(id: string): Promise<void> {
    await prisma.chapter.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async listChapterSiblingsOrdered(courseId: string): Promise<ChapterRecord[]> {
    return await prisma.chapter.findMany({
      where: { courseId, deletedAt: null },
      select: chapterSelect,
      orderBy: { order: 'asc' },
    });
  }

  async swapChapterOrder(aId: string, aOrder: number, bId: string, bOrder: number): Promise<void> {
    await prisma.$transaction([
      prisma.chapter.update({ where: { id: aId }, data: { order: bOrder } }),
      prisma.chapter.update({ where: { id: bId }, data: { order: aOrder } }),
    ]);
  }

  async isChapterSlugTakenInCourse(courseId: string, slug: string): Promise<boolean> {
    const existing = await prisma.chapter.findUnique({
      where: { courseId_slug: { courseId, slug } },
      select: { id: true },
    });
    return existing !== null;
  }

  // ── Content Modules ──────────────────────────────────────────────

  async createContentModule(
    chapterId: string,
    input: CreateContentModuleInput & { order: number },
  ): Promise<ContentModuleRecord> {
    return await prisma.contentModule.create({
      data: { chapterId, title: input.title, order: input.order },
      select: contentModuleSelect,
    });
  }

  async findContentModuleById(id: string): Promise<ContentModuleRecord | null> {
    return await prisma.contentModule.findFirst({ where: { id, deletedAt: null }, select: contentModuleSelect });
  }

  async updateContentModule(id: string, input: UpdateContentModuleInput): Promise<ContentModuleRecord> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    return await prisma.contentModule.update({ where: { id }, data, select: contentModuleSelect });
  }

  async softDeleteContentModule(id: string): Promise<void> {
    await prisma.contentModule.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async listContentModuleSiblingsOrdered(chapterId: string): Promise<ContentModuleRecord[]> {
    return await prisma.contentModule.findMany({
      where: { chapterId, deletedAt: null },
      select: contentModuleSelect,
      orderBy: { order: 'asc' },
    });
  }

  async swapContentModuleOrder(aId: string, aOrder: number, bId: string, bOrder: number): Promise<void> {
    await prisma.$transaction([
      prisma.contentModule.update({ where: { id: aId }, data: { order: bOrder } }),
      prisma.contentModule.update({ where: { id: bId }, data: { order: aOrder } }),
    ]);
  }

  // ── Lectures ─────────────────────────────────────────────────────

  async createLecture(
    moduleId: string,
    input: CreateLectureInput & { order: number; r2ObjectKey: string },
  ): Promise<LectureRecord> {
    return await prisma.lecture.create({
      data: {
        moduleId,
        title: input.title,
        durationSec: input.durationSec ?? null,
        order: input.order,
        r2ObjectKey: input.r2ObjectKey,
        status: 'DRAFT',
      },
      select: lectureSelect,
    });
  }

  async findLectureById(id: string): Promise<LectureRecord | null> {
    return await prisma.lecture.findFirst({ where: { id, deletedAt: null }, select: lectureSelect });
  }

  async updateLecture(id: string, input: UpdateLectureInput): Promise<LectureRecord> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.durationSec !== undefined) data.durationSec = input.durationSec;
    return await prisma.lecture.update({ where: { id }, data, select: lectureSelect });
  }

  async updateLectureStatus(id: string, status: LectureStatus): Promise<LectureRecord> {
    return await prisma.lecture.update({ where: { id }, data: { status }, select: lectureSelect });
  }

  async softDeleteLecture(id: string): Promise<void> {
    await prisma.lecture.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async listLectureSiblingsOrdered(moduleId: string): Promise<LectureRecord[]> {
    return await prisma.lecture.findMany({
      where: { moduleId, deletedAt: null },
      select: lectureSelect,
      orderBy: { order: 'asc' },
    });
  }

  async swapLectureOrder(aId: string, aOrder: number, bId: string, bOrder: number): Promise<void> {
    await prisma.$transaction([
      prisma.lecture.update({ where: { id: aId }, data: { order: bOrder } }),
      prisma.lecture.update({ where: { id: bId }, data: { order: aOrder } }),
    ]);
  }

  // ── Notes ────────────────────────────────────────────────────────

  async createNote(
    moduleId: string,
    input: CreateNoteInput & { order: number; r2ObjectKey: string },
  ): Promise<NoteRecord> {
    return await prisma.note.create({
      data: { moduleId, title: input.title, order: input.order, r2ObjectKey: input.r2ObjectKey },
      select: noteSelect,
    });
  }

  async findNoteById(id: string): Promise<NoteRecord | null> {
    return await prisma.note.findFirst({ where: { id, deletedAt: null }, select: noteSelect });
  }

  async updateNote(id: string, input: UpdateNoteInput): Promise<NoteRecord> {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    return await prisma.note.update({ where: { id }, data, select: noteSelect });
  }

  async softDeleteNote(id: string): Promise<void> {
    await prisma.note.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async countNotesInModule(moduleId: string): Promise<number> {
    return await prisma.note.count({ where: { moduleId, deletedAt: null } });
  }

  async getFullContentTree(courseId: string): Promise<ChapterWithFullContent[]> {
    const rows = await prisma.chapter.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { order: 'asc' },
      select: {
        ...chapterSelect,
        modules: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
          select: {
            ...contentModuleSelect,
            lectures: { where: { deletedAt: null }, orderBy: { order: 'asc' }, select: lectureSelect },
            notes: { where: { deletedAt: null }, orderBy: { order: 'asc' }, select: noteSelect },
            quizzes: {
              where: { deletedAt: null },
              select: { id: true, title: true, questions: { select: { id: true } } },
            },
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map((chapter) => ({
      id: chapter.id,
      courseId: chapter.courseId,
      title: chapter.title,
      slug: chapter.slug,
      order: chapter.order,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      modules: chapter.modules.map((mod: any) => ({
        id: mod.id,
        chapterId: mod.chapterId,
        title: mod.title,
        order: mod.order,
        lectures: mod.lectures,
        notes: mod.notes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quizzes: mod.quizzes.map((quiz: any) => ({
          id: quiz.id,
          title: quiz.title,
          questionCount: quiz.questions.length,
        })),
      })),
    }));
  }
}
