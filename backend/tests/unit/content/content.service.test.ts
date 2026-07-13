import { ContentService } from '../../../src/modules/content/content.service';
import { StreakService } from '../../../src/modules/streak/streak.service';
import { createFakeContentRepository } from './fakeContentRepository';
import type { StreakRepository, StreakSnapshot } from '../../../src/modules/streak/streak.types';
import * as r2Lib from '../../../src/lib/r2';

jest.mock('../../../src/lib/r2', () => ({
  getSignedLectureUrl: jest.fn().mockResolvedValue({ url: 'https://signed.example.com/lecture', expiresInSeconds: 600 }),
  getSignedNoteUrl: jest.fn().mockResolvedValue({ url: 'https://signed.example.com/note', expiresInSeconds: 600 }),
}));

const mockedGetSignedLectureUrl = r2Lib.getSignedLectureUrl as jest.MockedFunction<typeof r2Lib.getSignedLectureUrl>;
const mockedGetSignedNoteUrl = r2Lib.getSignedNoteUrl as jest.MockedFunction<typeof r2Lib.getSignedNoteUrl>;

function createFakeStreakRepository(): StreakRepository & { _state: Map<string, StreakSnapshot> } {
  const state = new Map<string, StreakSnapshot>();
  return {
    _state: state,
    async getStreak(studentId) {
      return state.get(studentId) ?? null;
    },
    async upsertStreak(studentId, data) {
      state.set(studentId, data);
      return data;
    },
  };
}

const STUDENT_ID = 'student-1';
const COURSE_ID = 'course-1';

describe('ContentService.getLectureStreamUrl', () => {
  it('issues a signed URL for an enrolled student', async () => {
    const { repo } = createFakeContentRepository({
      lectures: [{ id: 'lecture-1', r2ObjectKey: 'videos/lecture-1.mp4', courseId: COURSE_ID, status: 'PUBLISHED' }],
      enrollments: new Set([`${STUDENT_ID}:${COURSE_ID}`]),
    });
    const service = new ContentService(repo, new StreakService(createFakeStreakRepository()));

    const result = await service.getLectureStreamUrl('lecture-1', STUDENT_ID);

    expect(result.url).toBe('https://signed.example.com/lecture');
    expect(mockedGetSignedLectureUrl).toHaveBeenCalledWith('videos/lecture-1.mp4');
  });

  it('rejects a student who is not enrolled with 403 NOT_ENROLLED', async () => {
    const { repo } = createFakeContentRepository({
      lectures: [{ id: 'lecture-1', r2ObjectKey: 'videos/lecture-1.mp4', courseId: COURSE_ID, status: 'PUBLISHED' }],
      enrollments: new Set(), // not enrolled
    });
    const service = new ContentService(repo, new StreakService(createFakeStreakRepository()));

    await expect(service.getLectureStreamUrl('lecture-1', STUDENT_ID)).rejects.toMatchObject({
      code: 'NOT_ENROLLED',
      statusCode: 403,
    });
  });

  it('404s for a lecture that does not exist', async () => {
    const { repo } = createFakeContentRepository({});
    const service = new ContentService(repo, new StreakService(createFakeStreakRepository()));

    await expect(service.getLectureStreamUrl('nope', STUDENT_ID)).rejects.toMatchObject({
      code: 'LECTURE_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('404s (not 403) for a DRAFT lecture even if the student is enrolled in the course', async () => {
    const { repo } = createFakeContentRepository({
      lectures: [{ id: 'lecture-1', r2ObjectKey: 'videos/lecture-1.mp4', courseId: COURSE_ID, status: 'DRAFT' }],
      enrollments: new Set([`${STUDENT_ID}:${COURSE_ID}`]),
    });
    const service = new ContentService(repo, new StreakService(createFakeStreakRepository()));

    await expect(service.getLectureStreamUrl('lecture-1', STUDENT_ID)).rejects.toMatchObject({
      code: 'LECTURE_NOT_FOUND',
    });
  });
});

describe('ContentService.getNoteDownloadUrl', () => {
  it('issues a signed URL for an enrolled student', async () => {
    const { repo } = createFakeContentRepository({
      notes: [{ id: 'note-1', r2ObjectKey: 'notes/note-1.pdf', courseId: COURSE_ID }],
      enrollments: new Set([`${STUDENT_ID}:${COURSE_ID}`]),
    });
    const service = new ContentService(repo, new StreakService(createFakeStreakRepository()));

    const result = await service.getNoteDownloadUrl('note-1', STUDENT_ID);
    expect(result.url).toBe('https://signed.example.com/note');
    expect(mockedGetSignedNoteUrl).toHaveBeenCalledWith('notes/note-1.pdf');
  });

  it('rejects a non-enrolled student with 403 NOT_ENROLLED', async () => {
    const { repo } = createFakeContentRepository({
      notes: [{ id: 'note-1', r2ObjectKey: 'notes/note-1.pdf', courseId: COURSE_ID }],
      enrollments: new Set(),
    });
    const service = new ContentService(repo, new StreakService(createFakeStreakRepository()));

    await expect(service.getNoteDownloadUrl('note-1', STUDENT_ID)).rejects.toMatchObject({
      code: 'NOT_ENROLLED',
      statusCode: 403,
    });
  });
});

describe('ContentService.updateLectureProgress', () => {
  it('updates progress for an enrolled student and records streak activity', async () => {
    const { repo, progressStore } = createFakeContentRepository({
      lectures: [{ id: 'lecture-1', r2ObjectKey: 'videos/lecture-1.mp4', courseId: COURSE_ID, status: 'PUBLISHED' }],
      enrollments: new Set([`${STUDENT_ID}:${COURSE_ID}`]),
    });
    const streakRepo = createFakeStreakRepository();
    const service = new ContentService(repo, new StreakService(streakRepo));

    const result = await service.updateLectureProgress('lecture-1', STUDENT_ID, { lastPositionSec: 120 });

    expect(result).toEqual({ lastPositionSec: 120, isCompleted: false });
    expect(progressStore.get(`${STUDENT_ID}:lecture-1`)).toEqual({ lastPositionSec: 120, isCompleted: false });
    expect(streakRepo._state.get(STUDENT_ID)?.currentStreak).toBe(1);
  });

  it('rejects a progress update from a non-enrolled student', async () => {
    const { repo } = createFakeContentRepository({
      lectures: [{ id: 'lecture-1', r2ObjectKey: 'videos/lecture-1.mp4', courseId: COURSE_ID, status: 'PUBLISHED' }],
      enrollments: new Set(),
    });
    const service = new ContentService(repo, new StreakService(createFakeStreakRepository()));

    await expect(
      service.updateLectureProgress('lecture-1', STUDENT_ID, { isCompleted: true }),
    ).rejects.toMatchObject({ code: 'NOT_ENROLLED', statusCode: 403 });
  });

  it('marking a lecture completed preserves a previously recorded position when not resent', async () => {
    const { repo } = createFakeContentRepository({
      lectures: [{ id: 'lecture-1', r2ObjectKey: 'videos/lecture-1.mp4', courseId: COURSE_ID, status: 'PUBLISHED' }],
      enrollments: new Set([`${STUDENT_ID}:${COURSE_ID}`]),
    });
    const service = new ContentService(repo, new StreakService(createFakeStreakRepository()));

    await service.updateLectureProgress('lecture-1', STUDENT_ID, { lastPositionSec: 590 });
    const result = await service.updateLectureProgress('lecture-1', STUDENT_ID, { isCompleted: true });

    expect(result).toEqual({ lastPositionSec: 590, isCompleted: true });
  });
});
