import { LecturesService } from '../../../src/modules/content-management/lectures.service';
import { createFakeContentManagementRepository } from './fakeContentManagementRepository';
import * as ownershipLib from '../../../src/lib/ownership';
import * as r2Lib from '../../../src/lib/r2';

jest.mock('../../../src/lib/ownership', () => ({
  isCourseOwnedByTeacher: jest.fn(),
  getCourseIdForContentModule: jest.fn(),
  getCourseIdForLecture: jest.fn(),
}));

jest.mock('../../../src/lib/r2', () => ({
  generatePrivateObjectKey: jest.fn((kind: string, courseId: string) => `${kind}/${courseId}/generated-key`),
  getLectureUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: 'https://upload.example.com/video', expiresInSeconds: 900 }),
}));

const mockedIsCourseOwnedByTeacher = ownershipLib.isCourseOwnedByTeacher as jest.MockedFunction<
  typeof ownershipLib.isCourseOwnedByTeacher
>;
const mockedGetCourseIdForContentModule = ownershipLib.getCourseIdForContentModule as jest.MockedFunction<
  typeof ownershipLib.getCourseIdForContentModule
>;
const mockedGetCourseIdForLecture = ownershipLib.getCourseIdForLecture as jest.MockedFunction<
  typeof ownershipLib.getCourseIdForLecture
>;
const mockedGetLectureUploadUrl = r2Lib.getLectureUploadUrl as jest.MockedFunction<typeof r2Lib.getLectureUploadUrl>;

const MODULE_ID = 'module-1';
const COURSE_ID = 'course-1';
const TEACHER_ID = 'teacher-1';

beforeEach(() => {
  mockedGetCourseIdForContentModule.mockResolvedValue(COURSE_ID);
  mockedGetCourseIdForLecture.mockResolvedValue(COURSE_ID);
});

describe('LecturesService.createLecture', () => {
  it('creates a DRAFT lecture and returns a signed upload URL', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new LecturesService(repo);

    const result = await service.createLecture(MODULE_ID, TEACHER_ID, { title: 'Intro' }, 'video/mp4');

    expect(result.lecture.status).toBe('DRAFT');
    expect(result.uploadUrl).toBe('https://upload.example.com/video');
    expect(mockedGetLectureUploadUrl).toHaveBeenCalledWith('videos/course-1/generated-key', 'video/mp4');
  });

  it('rejects an unsupported content type', async () => {
    const { repo } = createFakeContentManagementRepository();
    const service = new LecturesService(repo);

    await expect(
      service.createLecture(MODULE_ID, TEACHER_ID, { title: 'Intro' }, 'application/pdf'),
    ).rejects.toMatchObject({ code: 'INVALID_CONTENT_TYPE', statusCode: 400 });
  });

  it('rejects creation for a module in a course the teacher does not own', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(false);
    const { repo } = createFakeContentManagementRepository();
    const service = new LecturesService(repo);

    await expect(
      service.createLecture(MODULE_ID, TEACHER_ID, { title: 'Intro' }, 'video/mp4'),
    ).rejects.toMatchObject({ code: 'NOT_COURSE_OWNER', statusCode: 403 });
  });
});

describe('LecturesService.updateLectureStatus', () => {
  it('transitions DRAFT -> PUBLISHED -> HIDDEN freely (no restricted state machine)', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new LecturesService(repo);
    const { lecture } = await service.createLecture(MODULE_ID, TEACHER_ID, { title: 'X' }, 'video/mp4');

    const published = await service.updateLectureStatus(lecture.id, TEACHER_ID, 'PUBLISHED');
    expect(published.status).toBe('PUBLISHED');

    const hidden = await service.updateLectureStatus(lecture.id, TEACHER_ID, 'HIDDEN');
    expect(hidden.status).toBe('HIDDEN');
  });

  it('rejects an invalid status value', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new LecturesService(repo);
    const { lecture } = await service.createLecture(MODULE_ID, TEACHER_ID, { title: 'X' }, 'video/mp4');

    await expect(service.updateLectureStatus(lecture.id, TEACHER_ID, 'ARCHIVED')).rejects.toMatchObject({
      code: 'INVALID_STATUS',
      statusCode: 400,
    });
  });
});

describe('LecturesService.getReuploadUrl', () => {
  it('issues a fresh upload URL for the SAME object key (video replacement, not a new lecture)', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new LecturesService(repo);
    const { lecture } = await service.createLecture(MODULE_ID, TEACHER_ID, { title: 'X' }, 'video/mp4');

    mockedGetLectureUploadUrl.mockClear();
    await service.getReuploadUrl(lecture.id, TEACHER_ID, 'video/webm');

    expect(mockedGetLectureUploadUrl).toHaveBeenCalledWith(lecture.r2ObjectKey, 'video/webm');
  });
});

describe('LecturesService reordering', () => {
  it('moves a lecture down within its module', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new LecturesService(repo);
    const { lecture: a } = await service.createLecture(MODULE_ID, TEACHER_ID, { title: 'A' }, 'video/mp4');
    const { lecture: b } = await service.createLecture(MODULE_ID, TEACHER_ID, { title: 'B' }, 'video/mp4');

    await service.moveLecture(a.id, TEACHER_ID, 'down');

    const ordered = await repo.listLectureSiblingsOrdered(MODULE_ID);
    expect(ordered[0]?.id).toBe(b.id);
    expect(ordered[1]?.id).toBe(a.id);
  });
});

describe('LecturesService.deleteLecture', () => {
  it('soft-deletes a lecture', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo, lectures } = createFakeContentManagementRepository();
    const service = new LecturesService(repo);
    const { lecture } = await service.createLecture(MODULE_ID, TEACHER_ID, { title: 'X' }, 'video/mp4');

    await service.deleteLecture(lecture.id, TEACHER_ID);
    expect(lectures.has(lecture.id)).toBe(false);
  });
});
