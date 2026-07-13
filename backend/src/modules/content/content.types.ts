import type { LectureStatus } from '@prisma/client';

export interface LectureForAccess {
  id: string;
  r2ObjectKey: string;
  courseId: string;
  status: LectureStatus;
}

export interface NoteForAccess {
  id: string;
  r2ObjectKey: string;
  courseId: string;
}

export interface LectureProgressResult {
  lastPositionSec: number;
  isCompleted: boolean;
}

export interface UpdateLectureProgressInput {
  lastPositionSec?: number;
  isCompleted?: boolean;
}

export interface ContentRepository {
  findLectureForAccess(lectureId: string): Promise<LectureForAccess | null>;
  findNoteForAccess(noteId: string): Promise<NoteForAccess | null>;
  isStudentEnrolled(studentId: string, courseId: string): Promise<boolean>;
  upsertLectureProgress(
    studentId: string,
    lectureId: string,
    input: UpdateLectureProgressInput,
  ): Promise<LectureProgressResult>;
}
