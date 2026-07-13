import type {
  ContentRepository,
  LectureForAccess,
  LectureProgressResult,
  NoteForAccess,
  UpdateLectureProgressInput,
} from '../../../src/modules/content/content.types';

export function createFakeContentRepository(options: {
  lectures?: LectureForAccess[];
  notes?: NoteForAccess[];
  enrollments?: Set<string>; // `${studentId}:${courseId}`
}) {
  const lectures = options.lectures ?? [];
  const notes = options.notes ?? [];
  const enrollments = options.enrollments ?? new Set<string>();
  const progressStore = new Map<string, LectureProgressResult>(); // `${studentId}:${lectureId}`

  const repo: ContentRepository = {
    async findLectureForAccess(lectureId: string): Promise<LectureForAccess | null> {
      return lectures.find((l) => l.id === lectureId) ?? null;
    },
    async findNoteForAccess(noteId: string): Promise<NoteForAccess | null> {
      return notes.find((n) => n.id === noteId) ?? null;
    },
    async isStudentEnrolled(studentId: string, courseId: string): Promise<boolean> {
      return enrollments.has(`${studentId}:${courseId}`);
    },
    async upsertLectureProgress(
      studentId: string,
      lectureId: string,
      input: UpdateLectureProgressInput,
    ): Promise<LectureProgressResult> {
      const key = `${studentId}:${lectureId}`;
      const existing = progressStore.get(key);
      const result: LectureProgressResult = {
        lastPositionSec: input.lastPositionSec ?? existing?.lastPositionSec ?? 0,
        isCompleted: input.isCompleted ?? existing?.isCompleted ?? false,
      };
      progressStore.set(key, result);
      return result;
    },
  };

  return { repo, progressStore };
}
