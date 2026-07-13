import { ApiError } from '../../utils/ApiError';
import { slugify, ensureUniqueSlug } from '../../lib/slug';
import { isCourseOwnedByTeacher } from '../../lib/ownership';
import { moveSibling } from './reorder.util';
import type {
  ChapterRecord,
  ChapterWithFullContent,
  ContentManagementRepository,
  CreateChapterInput,
  MoveDirection,
  UpdateChapterInput,
} from './content-management.types';

export class ChaptersService {
  constructor(private readonly repo: ContentManagementRepository) {}

  /** The Course Builder's read model — full tree, every lecture status,
   * not just PUBLISHED (contrast with Module 3A's public course detail).
   * Ownership-checked the same way every write in this module is. */
  async getFullContentTree(courseId: string, teacherId: string): Promise<ChapterWithFullContent[]> {
    await this.assertCourseOwnership(courseId, teacherId);
    return this.repo.getFullContentTree(courseId);
  }

  async createChapter(courseId: string, teacherId: string, input: CreateChapterInput): Promise<ChapterRecord> {
    await this.assertCourseOwnership(courseId, teacherId);

    const baseSlug = slugify(input.title);
    const slug = await ensureUniqueSlug(baseSlug, (candidate) =>
      this.repo.isChapterSlugTakenInCourse(courseId, candidate),
    );
    const siblings = await this.repo.listChapterSiblingsOrdered(courseId);
    const order = siblings.length + 1;

    return this.repo.createChapter(courseId, { title: input.title, slug, order });
  }

  async updateChapter(chapterId: string, teacherId: string, input: UpdateChapterInput): Promise<ChapterRecord> {
    await this.assertChapterOwnership(chapterId, teacherId);
    return this.repo.updateChapter(chapterId, input);
  }

  async deleteChapter(chapterId: string, teacherId: string): Promise<void> {
    await this.assertChapterOwnership(chapterId, teacherId);
    await this.repo.softDeleteChapter(chapterId);
  }

  async moveChapter(chapterId: string, teacherId: string, direction: MoveDirection): Promise<void> {
    const chapter = await this.assertChapterOwnership(chapterId, teacherId);
    const siblings = await this.repo.listChapterSiblingsOrdered(chapter.courseId);
    await moveSibling(siblings, chapterId, direction, (aId, aOrder, bId, bOrder) =>
      this.repo.swapChapterOrder(aId, aOrder, bId, bOrder),
    );
  }

  private async assertCourseOwnership(courseId: string, teacherId: string): Promise<void> {
    const owned = await isCourseOwnedByTeacher(courseId, teacherId);
    if (!owned) {
      throw ApiError.forbidden('NOT_COURSE_OWNER', 'Course not found, or you do not own it');
    }
  }

  private async assertChapterOwnership(chapterId: string, teacherId: string): Promise<ChapterRecord> {
    const chapter = await this.repo.findChapterById(chapterId);
    if (!chapter) {
      throw ApiError.notFound('CHAPTER_NOT_FOUND', 'Chapter not found');
    }
    const owned = await isCourseOwnedByTeacher(chapter.courseId, teacherId);
    if (!owned) {
      throw ApiError.forbidden('NOT_COURSE_OWNER', 'You do not own this course');
    }
    return chapter;
  }
}
