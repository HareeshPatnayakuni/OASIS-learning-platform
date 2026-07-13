import { NotesService } from '../../../src/modules/content-management/notes.service';
import { createFakeContentManagementRepository } from './fakeContentManagementRepository';
import * as ownershipLib from '../../../src/lib/ownership';
import * as r2Lib from '../../../src/lib/r2';

jest.mock('../../../src/lib/ownership', () => ({
  isCourseOwnedByTeacher: jest.fn(),
  getCourseIdForContentModule: jest.fn(),
  getCourseIdForNote: jest.fn(),
}));

jest.mock('../../../src/lib/r2', () => ({
  generatePrivateObjectKey: jest.fn((kind: string, courseId: string) => `${kind}/${courseId}/generated-key`),
  getNoteUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: 'https://upload.example.com/note', expiresInSeconds: 900 }),
}));

const mockedIsCourseOwnedByTeacher = ownershipLib.isCourseOwnedByTeacher as jest.MockedFunction<
  typeof ownershipLib.isCourseOwnedByTeacher
>;
const mockedGetCourseIdForContentModule = ownershipLib.getCourseIdForContentModule as jest.MockedFunction<
  typeof ownershipLib.getCourseIdForContentModule
>;
const mockedGetCourseIdForNote = ownershipLib.getCourseIdForNote as jest.MockedFunction<
  typeof ownershipLib.getCourseIdForNote
>;
const mockedGetNoteUploadUrl = r2Lib.getNoteUploadUrl as jest.MockedFunction<typeof r2Lib.getNoteUploadUrl>;

const MODULE_ID = 'module-1';
const COURSE_ID = 'course-1';
const TEACHER_ID = 'teacher-1';

beforeEach(() => {
  mockedGetCourseIdForContentModule.mockResolvedValue(COURSE_ID);
  mockedGetCourseIdForNote.mockResolvedValue(COURSE_ID);
});

describe('NotesService.createNote', () => {
  it('creates a note and returns a signed upload URL', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new NotesService(repo);

    const result = await service.createNote(MODULE_ID, TEACHER_ID, { title: 'Chapter Notes' }, 'application/pdf');

    expect(result.note.title).toBe('Chapter Notes');
    expect(result.uploadUrl).toBe('https://upload.example.com/note');
  });

  it('rejects a non-PDF content type', async () => {
    const { repo } = createFakeContentManagementRepository();
    const service = new NotesService(repo);

    await expect(
      service.createNote(MODULE_ID, TEACHER_ID, { title: 'X' }, 'image/jpeg'),
    ).rejects.toMatchObject({ code: 'INVALID_CONTENT_TYPE', statusCode: 400 });
  });

  it('assigns increasing order values to successive notes in the same module', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new NotesService(repo);

    const first = await service.createNote(MODULE_ID, TEACHER_ID, { title: 'Note 1' }, 'application/pdf');
    const second = await service.createNote(MODULE_ID, TEACHER_ID, { title: 'Note 2' }, 'application/pdf');

    expect(first.note.order).toBe(1);
    expect(second.note.order).toBe(2);
  });

  it('rejects creation for a course the teacher does not own', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(false);
    const { repo } = createFakeContentManagementRepository();
    const service = new NotesService(repo);

    await expect(
      service.createNote(MODULE_ID, TEACHER_ID, { title: 'X' }, 'application/pdf'),
    ).rejects.toMatchObject({ code: 'NOT_COURSE_OWNER', statusCode: 403 });
  });
});

describe('NotesService.getReuploadUrl', () => {
  it('issues a fresh upload URL for the existing object key', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new NotesService(repo);
    const { note } = await service.createNote(MODULE_ID, TEACHER_ID, { title: 'X' }, 'application/pdf');

    mockedGetNoteUploadUrl.mockClear();
    await service.getReuploadUrl(note.id, TEACHER_ID, 'application/pdf');

    expect(mockedGetNoteUploadUrl).toHaveBeenCalledWith(note.r2ObjectKey, 'application/pdf');
  });
});

describe('NotesService.deleteNote / updateNote', () => {
  it('updates a note title', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new NotesService(repo);
    const { note } = await service.createNote(MODULE_ID, TEACHER_ID, { title: 'Old' }, 'application/pdf');

    const updated = await service.updateNote(note.id, TEACHER_ID, { title: 'New' });
    expect(updated.title).toBe('New');
  });

  it('soft-deletes a note', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo, notes } = createFakeContentManagementRepository();
    const service = new NotesService(repo);
    const { note } = await service.createNote(MODULE_ID, TEACHER_ID, { title: 'X' }, 'application/pdf');

    await service.deleteNote(note.id, TEACHER_ID);
    expect(notes.has(note.id)).toBe(false);
  });

  it('404s for a note that does not exist', async () => {
    const { repo } = createFakeContentManagementRepository();
    const service = new NotesService(repo);

    await expect(service.updateNote('nope', TEACHER_ID, { title: 'X' })).rejects.toMatchObject({
      code: 'NOTE_NOT_FOUND',
      statusCode: 404,
    });
  });
});
