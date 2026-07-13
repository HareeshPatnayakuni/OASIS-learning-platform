import { prisma } from '../../lib/prisma';
import type {
  ContentRepository,
  LectureForAccess,
  LectureProgressResult,
  NoteForAccess,
  UpdateLectureProgressInput,
} from './content.types';

export class PrismaContentRepository implements ContentRepository {
  async findLectureForAccess(lectureId: string): Promise<LectureForAccess | null> {
    const lecture = await prisma.lecture.findFirst({
      where: { id: lectureId, deletedAt: null },
      select: {
        id: true,
        r2ObjectKey: true,
        status: true,
        module: { select: { chapter: { select: { courseId: true } } } },
      },
    });
    if (!lecture) return null;
    const courseId: string = lecture.module.chapter.courseId;
    return { id: lecture.id, r2ObjectKey: lecture.r2ObjectKey, status: lecture.status, courseId };
  }

  async findNoteForAccess(noteId: string): Promise<NoteForAccess | null> {
    const note = await prisma.note.findFirst({
      where: { id: noteId, deletedAt: null },
      select: {
        id: true,
        r2ObjectKey: true,
        module: { select: { chapter: { select: { courseId: true } } } },
      },
    });
    if (!note) return null;
    const courseId: string = note.module.chapter.courseId;
    return { id: note.id, r2ObjectKey: note.r2ObjectKey, courseId };
  }

  async isStudentEnrolled(studentId: string, courseId: string): Promise<boolean> {
    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      select: { id: true },
    });
    return enrollment !== null;
  }

  async upsertLectureProgress(
    studentId: string,
    lectureId: string,
    input: UpdateLectureProgressInput,
  ): Promise<LectureProgressResult> {
    const existing = await prisma.lectureProgress.findUnique({
      where: { studentId_lectureId: { studentId, lectureId } },
      select: { lastPositionSec: true, isCompleted: true },
    });

    const lastPositionSec = input.lastPositionSec ?? existing?.lastPositionSec ?? 0;
    const isCompleted = input.isCompleted ?? existing?.isCompleted ?? false;

    const row = await prisma.lectureProgress.upsert({
      where: { studentId_lectureId: { studentId, lectureId } },
      create: { studentId, lectureId, lastPositionSec, isCompleted },
      update: { lastPositionSec, isCompleted },
      select: { lastPositionSec: true, isCompleted: true },
    });

    return { lastPositionSec: row.lastPositionSec, isCompleted: row.isCompleted };
  }
}
