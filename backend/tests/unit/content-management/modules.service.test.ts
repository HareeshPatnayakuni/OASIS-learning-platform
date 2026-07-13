import { ContentModulesService } from '../../../src/modules/content-management/modules.service';
import { createFakeContentManagementRepository } from './fakeContentManagementRepository';
import * as ownershipLib from '../../../src/lib/ownership';

jest.mock('../../../src/lib/ownership', () => ({
  isCourseOwnedByTeacher: jest.fn(),
  getCourseIdForChapter: jest.fn(),
  getCourseIdForContentModule: jest.fn(),
}));

const mockedIsCourseOwnedByTeacher = ownershipLib.isCourseOwnedByTeacher as jest.MockedFunction<
  typeof ownershipLib.isCourseOwnedByTeacher
>;
const mockedGetCourseIdForChapter = ownershipLib.getCourseIdForChapter as jest.MockedFunction<
  typeof ownershipLib.getCourseIdForChapter
>;
const mockedGetCourseIdForContentModule = ownershipLib.getCourseIdForContentModule as jest.MockedFunction<
  typeof ownershipLib.getCourseIdForContentModule
>;

const CHAPTER_ID = 'chapter-1';
const COURSE_ID = 'course-1';
const TEACHER_ID = 'teacher-1';

beforeEach(() => {
  mockedGetCourseIdForChapter.mockResolvedValue(COURSE_ID);
  mockedGetCourseIdForContentModule.mockResolvedValue(COURSE_ID);
});

describe('ContentModulesService.createContentModule', () => {
  it('creates a module and appends to the end of its chapter', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new ContentModulesService(repo);

    const first = await service.createContentModule(CHAPTER_ID, TEACHER_ID, { title: 'Intro' });
    const second = await service.createContentModule(CHAPTER_ID, TEACHER_ID, { title: 'Advanced' });

    expect(first.order).toBe(1);
    expect(second.order).toBe(2);
  });

  it('404s when the parent chapter does not exist', async () => {
    mockedGetCourseIdForChapter.mockResolvedValue(null);
    const { repo } = createFakeContentManagementRepository();
    const service = new ContentModulesService(repo);

    await expect(service.createContentModule('nope', TEACHER_ID, { title: 'X' })).rejects.toMatchObject({
      code: 'CHAPTER_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('rejects creation in a chapter belonging to a course the teacher does not own', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(false);
    const { repo } = createFakeContentManagementRepository();
    const service = new ContentModulesService(repo);

    await expect(service.createContentModule(CHAPTER_ID, TEACHER_ID, { title: 'X' })).rejects.toMatchObject({
      code: 'NOT_COURSE_OWNER',
      statusCode: 403,
    });
  });
});

describe('ContentModulesService reordering', () => {
  it('moves a module up within its chapter', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new ContentModulesService(repo);
    const a = await service.createContentModule(CHAPTER_ID, TEACHER_ID, { title: 'A' });
    const b = await service.createContentModule(CHAPTER_ID, TEACHER_ID, { title: 'B' });

    await service.moveContentModule(b.id, TEACHER_ID, 'up');

    const ordered = await repo.listContentModuleSiblingsOrdered(CHAPTER_ID);
    expect(ordered[0]?.id).toBe(b.id);
    expect(ordered[1]?.id).toBe(a.id);
  });

  it('rejects moving the only module in a chapter in either direction', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new ContentModulesService(repo);
    const only = await service.createContentModule(CHAPTER_ID, TEACHER_ID, { title: 'Only' });

    await expect(service.moveContentModule(only.id, TEACHER_ID, 'up')).rejects.toMatchObject({
      code: 'CANNOT_MOVE',
    });
    await expect(service.moveContentModule(only.id, TEACHER_ID, 'down')).rejects.toMatchObject({
      code: 'CANNOT_MOVE',
    });
  });
});

describe('ContentModulesService.deleteContentModule', () => {
  it('rejects deletion by a non-owning teacher', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValueOnce(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new ContentModulesService(repo);
    const contentModule = await service.createContentModule(CHAPTER_ID, TEACHER_ID, { title: 'X' });

    mockedIsCourseOwnedByTeacher.mockResolvedValueOnce(false);
    await expect(service.deleteContentModule(contentModule.id, 'teacher-2')).rejects.toMatchObject({
      code: 'NOT_COURSE_OWNER',
      statusCode: 403,
    });
  });
});
