import { ChaptersService } from '../../../src/modules/content-management/chapters.service';
import { createFakeContentManagementRepository } from './fakeContentManagementRepository';
import * as ownershipLib from '../../../src/lib/ownership';

jest.mock('../../../src/lib/ownership', () => ({
  isCourseOwnedByTeacher: jest.fn(),
  getCourseIdForChapter: jest.fn(),
}));

const mockedIsCourseOwnedByTeacher = ownershipLib.isCourseOwnedByTeacher as jest.MockedFunction<
  typeof ownershipLib.isCourseOwnedByTeacher
>;

const COURSE_ID = 'course-1';
const TEACHER_ID = 'teacher-1';

describe('ChaptersService.getFullContentTree', () => {
  it('returns the ordered chapter/module tree for the owning teacher', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);
    await service.createChapter(COURSE_ID, TEACHER_ID, { title: 'Chapter One' });
    await service.createChapter(COURSE_ID, TEACHER_ID, { title: 'Chapter Two' });

    const tree = await service.getFullContentTree(COURSE_ID, TEACHER_ID);

    expect(tree).toHaveLength(2);
    expect(tree[0]?.title).toBe('Chapter One');
    expect(tree[0]?.modules).toEqual([]);
  });

  it('rejects fetching the tree for a course the teacher does not own', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(false);
    const { repo } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);

    await expect(service.getFullContentTree(COURSE_ID, TEACHER_ID)).rejects.toMatchObject({
      code: 'NOT_COURSE_OWNER',
      statusCode: 403,
    });
  });
});

describe('ChaptersService.createChapter', () => {
  it('creates a chapter with an auto-generated slug and appends to the end', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);

    const chapter = await service.createChapter(COURSE_ID, TEACHER_ID, { title: 'Algebra Basics' });

    expect(chapter.slug).toBe('algebra-basics');
    expect(chapter.order).toBe(1);
  });

  it('assigns increasing order values to successive chapters', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);

    const first = await service.createChapter(COURSE_ID, TEACHER_ID, { title: 'Chapter One' });
    const second = await service.createChapter(COURSE_ID, TEACHER_ID, { title: 'Chapter Two' });

    expect(first.order).toBe(1);
    expect(second.order).toBe(2);
  });

  it('rejects creation for a course the teacher does not own', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(false);
    const { repo } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);

    await expect(service.createChapter(COURSE_ID, TEACHER_ID, { title: 'X' })).rejects.toMatchObject({
      code: 'NOT_COURSE_OWNER',
      statusCode: 403,
    });
  });
});

describe('ChaptersService.updateChapter / deleteChapter', () => {
  it('updates a chapter in a course the teacher owns', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);
    const chapter = await service.createChapter(COURSE_ID, TEACHER_ID, { title: 'Original' });

    const updated = await service.updateChapter(chapter.id, TEACHER_ID, { title: 'Renamed' });
    expect(updated.title).toBe('Renamed');
  });

  it('rejects updating a chapter belonging to another teacher', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValueOnce(true); // for creation
    const { repo } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);
    const chapter = await service.createChapter(COURSE_ID, TEACHER_ID, { title: 'Original' });

    mockedIsCourseOwnedByTeacher.mockResolvedValueOnce(false); // for the update attempt
    await expect(service.updateChapter(chapter.id, 'teacher-2', { title: 'Hijacked' })).rejects.toMatchObject({
      code: 'NOT_COURSE_OWNER',
      statusCode: 403,
    });
  });

  it('404s when editing a chapter that does not exist', async () => {
    const { repo } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);

    await expect(service.updateChapter('nope', TEACHER_ID, { title: 'X' })).rejects.toMatchObject({
      code: 'CHAPTER_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('soft-deletes a chapter (removed from listings)', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo, chapters } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);
    const chapter = await service.createChapter(COURSE_ID, TEACHER_ID, { title: 'To delete' });

    await service.deleteChapter(chapter.id, TEACHER_ID);
    expect(chapters.has(chapter.id)).toBe(false);
  });
});

describe('ChaptersService.moveChapter', () => {
  async function createThreeChapters(service: ChaptersService) {
    const a = await service.createChapter(COURSE_ID, TEACHER_ID, { title: 'A' });
    const b = await service.createChapter(COURSE_ID, TEACHER_ID, { title: 'B' });
    const c = await service.createChapter(COURSE_ID, TEACHER_ID, { title: 'C' });
    return { a, b, c };
  }

  it('moving the middle chapter up swaps it with the first', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);
    const { a, b } = await createThreeChapters(service);

    await service.moveChapter(b.id, TEACHER_ID, 'up');

    const ordered = await repo.listChapterSiblingsOrdered(COURSE_ID);
    expect(ordered[0]?.id).toBe(b.id);
    expect(ordered[1]?.id).toBe(a.id);
  });

  it('moving the middle chapter down swaps it with the last', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);
    const { b, c } = await createThreeChapters(service);

    await service.moveChapter(b.id, TEACHER_ID, 'down');

    const ordered = await repo.listChapterSiblingsOrdered(COURSE_ID);
    expect(ordered[1]?.id).toBe(c.id);
    expect(ordered[2]?.id).toBe(b.id);
  });

  it('rejects moving the first chapter up', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);
    const { a } = await createThreeChapters(service);

    await expect(service.moveChapter(a.id, TEACHER_ID, 'up')).rejects.toMatchObject({
      code: 'CANNOT_MOVE',
      statusCode: 400,
    });
  });

  it('rejects moving the last chapter down', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);
    const { c } = await createThreeChapters(service);

    await expect(service.moveChapter(c.id, TEACHER_ID, 'down')).rejects.toMatchObject({
      code: 'CANNOT_MOVE',
      statusCode: 400,
    });
  });

  it("does not affect a third, uninvolved chapter's order", async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeContentManagementRepository();
    const service = new ChaptersService(repo);
    const { a, c } = await createThreeChapters(service);

    await service.moveChapter(a.id, TEACHER_ID, 'down'); // swaps A and B only

    const cAfter = await repo.findChapterById(c.id);
    expect(cAfter?.order).toBe(3); // unchanged
  });
});
