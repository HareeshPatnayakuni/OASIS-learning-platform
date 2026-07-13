import { ApiError } from '../../utils/ApiError';
import { isCourseOwnedByTeacher, getCourseIdForChapter, getCourseIdForContentModule } from '../../lib/ownership';
import { moveSibling } from './reorder.util';
import type {
  ContentManagementRepository,
  ContentModuleRecord,
  CreateContentModuleInput,
  MoveDirection,
  UpdateContentModuleInput,
} from './content-management.types';

export class ContentModulesService {
  constructor(private readonly repo: ContentManagementRepository) {}

  async createContentModule(
    chapterId: string,
    teacherId: string,
    input: CreateContentModuleInput,
  ): Promise<ContentModuleRecord> {
    await this.assertChapterOwnership(chapterId, teacherId);

    const siblings = await this.repo.listContentModuleSiblingsOrdered(chapterId);
    const order = siblings.length + 1;
    return this.repo.createContentModule(chapterId, { title: input.title, order });
  }

  async updateContentModule(
    moduleId: string,
    teacherId: string,
    input: UpdateContentModuleInput,
  ): Promise<ContentModuleRecord> {
    await this.assertModuleOwnership(moduleId, teacherId);
    return this.repo.updateContentModule(moduleId, input);
  }

  async deleteContentModule(moduleId: string, teacherId: string): Promise<void> {
    await this.assertModuleOwnership(moduleId, teacherId);
    await this.repo.softDeleteContentModule(moduleId);
  }

  async moveContentModule(moduleId: string, teacherId: string, direction: MoveDirection): Promise<void> {
    const contentModule = await this.assertModuleOwnership(moduleId, teacherId);
    const siblings = await this.repo.listContentModuleSiblingsOrdered(contentModule.chapterId);
    await moveSibling(siblings, moduleId, direction, (aId, aOrder, bId, bOrder) =>
      this.repo.swapContentModuleOrder(aId, aOrder, bId, bOrder),
    );
  }

  private async assertChapterOwnership(chapterId: string, teacherId: string): Promise<void> {
    const courseId = await getCourseIdForChapter(chapterId);
    if (!courseId) {
      throw ApiError.notFound('CHAPTER_NOT_FOUND', 'Chapter not found');
    }
    const owned = await isCourseOwnedByTeacher(courseId, teacherId);
    if (!owned) {
      throw ApiError.forbidden('NOT_COURSE_OWNER', 'You do not own this course');
    }
  }

  private async assertModuleOwnership(moduleId: string, teacherId: string): Promise<ContentModuleRecord> {
    const contentModule = await this.repo.findContentModuleById(moduleId);
    if (!contentModule) {
      throw ApiError.notFound('MODULE_NOT_FOUND', 'Module not found');
    }
    const courseId = await getCourseIdForContentModule(moduleId);
    const owned = courseId ? await isCourseOwnedByTeacher(courseId, teacherId) : false;
    if (!owned) {
      throw ApiError.forbidden('NOT_COURSE_OWNER', 'You do not own this course');
    }
    return contentModule;
  }
}
