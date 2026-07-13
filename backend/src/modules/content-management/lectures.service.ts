import type { LectureStatus } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { isCourseOwnedByTeacher, getCourseIdForContentModule, getCourseIdForLecture } from '../../lib/ownership';
import { generatePrivateObjectKey, getLectureUploadUrl } from '../../lib/r2';
import { moveSibling } from './reorder.util';
import type {
  ContentManagementRepository,
  CreateLectureInput,
  LectureRecord,
  MoveDirection,
  UpdateLectureInput,
} from './content-management.types';

const ALLOWED_VIDEO_CONTENT_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const VALID_LECTURE_STATUSES: readonly LectureStatus[] = ['DRAFT', 'PUBLISHED', 'HIDDEN'];

export interface CreateLectureResult {
  lecture: LectureRecord;
  uploadUrl: string;
  expiresInSeconds: number;
}

export class LecturesService {
  constructor(private readonly repo: ContentManagementRepository) {}

  /**
   * Creates the Lecture row with a server-generated object key AND
   * immediately returns a signed upload URL for that key, in one call —
   * the teacher's client uploads the video right after. A lecture starts
   * DRAFT (repository default); "Set Lecture Status" is a separate,
   * explicit action (updateLectureStatus), not implied by creation.
   */
  async createLecture(
    moduleId: string,
    teacherId: string,
    input: CreateLectureInput,
    contentType: string,
  ): Promise<CreateLectureResult> {
    this.assertValidVideoContentType(contentType);
    const courseId = await this.assertModuleOwnershipForCreate(moduleId, teacherId);

    const siblings = await this.repo.listLectureSiblingsOrdered(moduleId);
    const order = siblings.length + 1;
    const objectKey = generatePrivateObjectKey('videos', courseId);

    const lecture = await this.repo.createLecture(moduleId, {
      title: input.title,
      durationSec: input.durationSec ?? null,
      order,
      r2ObjectKey: objectKey,
    });
    const { uploadUrl, expiresInSeconds } = await getLectureUploadUrl(objectKey, contentType);

    return { lecture, uploadUrl, expiresInSeconds };
  }

  /** Issues a fresh upload URL for an EXISTING lecture's already-assigned
   * object key — used to re-upload (replace) the video without recreating
   * the lecture (and losing its title/order/status/progress history). */
  async getReuploadUrl(
    lectureId: string,
    teacherId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; expiresInSeconds: number }> {
    this.assertValidVideoContentType(contentType);
    const lecture = await this.assertLectureOwnership(lectureId, teacherId);
    return getLectureUploadUrl(lecture.r2ObjectKey, contentType);
  }

  async updateLecture(lectureId: string, teacherId: string, input: UpdateLectureInput): Promise<LectureRecord> {
    await this.assertLectureOwnership(lectureId, teacherId);
    return this.repo.updateLecture(lectureId, input);
  }

  async updateLectureStatus(lectureId: string, teacherId: string, status: string): Promise<LectureRecord> {
    if (!VALID_LECTURE_STATUSES.includes(status as LectureStatus)) {
      throw ApiError.badRequest(
        'INVALID_STATUS',
        `status must be one of: ${VALID_LECTURE_STATUSES.join(', ')}`,
      );
    }
    await this.assertLectureOwnership(lectureId, teacherId);
    return this.repo.updateLectureStatus(lectureId, status as LectureStatus);
  }

  async deleteLecture(lectureId: string, teacherId: string): Promise<void> {
    await this.assertLectureOwnership(lectureId, teacherId);
    await this.repo.softDeleteLecture(lectureId);
  }

  async moveLecture(lectureId: string, teacherId: string, direction: MoveDirection): Promise<void> {
    const lecture = await this.assertLectureOwnership(lectureId, teacherId);
    const siblings = await this.repo.listLectureSiblingsOrdered(lecture.moduleId);
    await moveSibling(siblings, lectureId, direction, (aId, aOrder, bId, bOrder) =>
      this.repo.swapLectureOrder(aId, aOrder, bId, bOrder),
    );
  }

  private assertValidVideoContentType(contentType: string): void {
    if (!ALLOWED_VIDEO_CONTENT_TYPES.has(contentType)) {
      throw ApiError.badRequest(
        'INVALID_CONTENT_TYPE',
        `Unsupported video type "${contentType}". Allowed: ${[...ALLOWED_VIDEO_CONTENT_TYPES].join(', ')}`,
      );
    }
  }

  private async assertModuleOwnershipForCreate(moduleId: string, teacherId: string): Promise<string> {
    const courseId = await getCourseIdForContentModule(moduleId);
    if (!courseId) {
      throw ApiError.notFound('MODULE_NOT_FOUND', 'Module not found');
    }
    const owned = await isCourseOwnedByTeacher(courseId, teacherId);
    if (!owned) {
      throw ApiError.forbidden('NOT_COURSE_OWNER', 'You do not own this course');
    }
    return courseId;
  }

  private async assertLectureOwnership(lectureId: string, teacherId: string): Promise<LectureRecord> {
    const lecture = await this.repo.findLectureById(lectureId);
    if (!lecture) {
      throw ApiError.notFound('LECTURE_NOT_FOUND', 'Lecture not found');
    }
    const courseId = await getCourseIdForLecture(lectureId);
    const owned = courseId ? await isCourseOwnedByTeacher(courseId, teacherId) : false;
    if (!owned) {
      throw ApiError.forbidden('NOT_COURSE_OWNER', 'You do not own this course');
    }
    return lecture;
  }
}
