import { prisma } from './prisma';

/**
 * "Does this course belong to this teacher?" is needed by every Module 3B
 * write path (course editing, chapters/modules/lectures/notes, quizzes,
 * announcements) — centralized here rather than duplicated per-repository,
 * the same way lib/prisma.ts centralizes the client itself. Repositories
 * call this directly (it's a thin Prisma read, consistent with
 * repositories being the only layer that touches Prisma) rather than
 * routing through another module's service.
 */
export async function isCourseOwnedByTeacher(courseId: string, teacherId: string): Promise<boolean> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, teacherId, deletedAt: null },
    select: { id: true },
  });
  return course !== null;
}

/** Resolves a chapter's parent courseId — used to check ownership one level
 * removed (e.g. "can this teacher edit this content-module, which belongs
 * to a chapter, which belongs to a course they may or may not own"). */
export async function getCourseIdForChapter(chapterId: string): Promise<string | null> {
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, deletedAt: null },
    select: { courseId: true },
  });
  return chapter?.courseId ?? null;
}

export async function getCourseIdForContentModule(contentModuleId: string): Promise<string | null> {
  const contentModule = await prisma.contentModule.findFirst({
    where: { id: contentModuleId, deletedAt: null },
    select: { chapter: { select: { courseId: true } } },
  });
  return contentModule?.chapter.courseId ?? null;
}

export async function getCourseIdForLecture(lectureId: string): Promise<string | null> {
  const lecture = await prisma.lecture.findFirst({
    where: { id: lectureId, deletedAt: null },
    select: { module: { select: { chapter: { select: { courseId: true } } } } },
  });
  return lecture?.module.chapter.courseId ?? null;
}

export async function getCourseIdForNote(noteId: string): Promise<string | null> {
  const note = await prisma.note.findFirst({
    where: { id: noteId, deletedAt: null },
    select: { module: { select: { chapter: { select: { courseId: true } } } } },
  });
  return note?.module.chapter.courseId ?? null;
}

export async function getCourseIdForQuiz(quizId: string): Promise<string | null> {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, deletedAt: null },
    select: { module: { select: { chapter: { select: { courseId: true } } } } },
  });
  return quiz?.module.chapter.courseId ?? null;
}
