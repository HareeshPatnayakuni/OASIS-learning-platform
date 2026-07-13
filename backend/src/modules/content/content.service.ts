import { ApiError } from '../../utils/ApiError';
import { getSignedLectureUrl, getSignedNoteUrl, type SignedUrlResult } from '../../lib/r2';
import type { StreakService } from '../streak/streak.service';
import type { ContentRepository, LectureProgressResult, UpdateLectureProgressInput } from './content.types';

/**
 * Every method here follows the same shape: look up the content item,
 * resolve its parent course, check enrollment, THEN act. Enrollment is
 * checked fresh on every call — never cached, never inferred from a prior
 * request — because a signed URL or a progress write is exactly the kind
 * of action that must reflect the student's *current* access, not their
 * access a few requests ago (e.g. immediately after a refund/unenrollment,
 * were that to exist yet).
 */
export class ContentService {
  constructor(
    private readonly repo: ContentRepository,
    private readonly streakService: StreakService,
  ) {}

  async getLectureStreamUrl(lectureId: string, studentId: string): Promise<SignedUrlResult> {
    const lecture = await this.repo.findLectureForAccess(lectureId);
    // A HIDDEN or DRAFT lecture doesn't exist from a student's perspective,
    // regardless of enrollment — same 404 as a missing lecture, not a 403,
    // so a teacher's WIP content never leaks its existence.
    if (!lecture || lecture.status !== 'PUBLISHED') {
      throw ApiError.notFound('LECTURE_NOT_FOUND', 'Lecture not found');
    }

    const enrolled = await this.repo.isStudentEnrolled(studentId, lecture.courseId);
    if (!enrolled) {
      throw ApiError.forbidden('NOT_ENROLLED', 'You are not enrolled in this course');
    }

    return getSignedLectureUrl(lecture.r2ObjectKey);
  }

  async getNoteDownloadUrl(noteId: string, studentId: string): Promise<SignedUrlResult> {
    const note = await this.repo.findNoteForAccess(noteId);
    if (!note) {
      throw ApiError.notFound('NOTE_NOT_FOUND', 'Note not found');
    }

    const enrolled = await this.repo.isStudentEnrolled(studentId, note.courseId);
    if (!enrolled) {
      throw ApiError.forbidden('NOT_ENROLLED', 'You are not enrolled in this course');
    }

    return getSignedNoteUrl(note.r2ObjectKey);
  }

  async updateLectureProgress(
    lectureId: string,
    studentId: string,
    input: UpdateLectureProgressInput,
  ): Promise<LectureProgressResult> {
    const lecture = await this.repo.findLectureForAccess(lectureId);
    if (!lecture || lecture.status !== 'PUBLISHED') {
      throw ApiError.notFound('LECTURE_NOT_FOUND', 'Lecture not found');
    }

    const enrolled = await this.repo.isStudentEnrolled(studentId, lecture.courseId);
    if (!enrolled) {
      throw ApiError.forbidden('NOT_ENROLLED', 'You are not enrolled in this course');
    }

    const result = await this.repo.upsertLectureProgress(studentId, lectureId, input);

    // Progress on a lecture is the one activity signal Module 3A wires up
    // to the Learning Streak — see streak.service.ts for the counting
    // rule. Deliberately fire-and-forget-free (awaited): the streak update
    // should be reflected immediately if the student checks their
    // dashboard right after finishing a lecture, not eventually.
    await this.streakService.recordActivity(studentId);

    return result;
  }
}
