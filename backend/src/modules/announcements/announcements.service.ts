import { ApiError } from '../../utils/ApiError';
import { isCourseOwnedByTeacher } from '../../lib/ownership';
import type {
  AnnouncementRecord,
  CreateAnnouncementInput,
  TeacherAnnouncementListItem,
  TeacherAnnouncementRepository,
  UpdateAnnouncementInput,
} from './announcements.types';

const DEFAULT_LIMIT = 10;

export class TeacherAnnouncementService {
  constructor(private readonly repo: TeacherAnnouncementRepository) {}

  async createAnnouncement(
    courseId: string,
    teacherId: string,
    input: CreateAnnouncementInput,
  ): Promise<AnnouncementRecord> {
    const owned = await isCourseOwnedByTeacher(courseId, teacherId);
    if (!owned) {
      throw ApiError.forbidden('NOT_COURSE_OWNER', 'Course not found, or you do not own it');
    }

    const announcement = await this.repo.createAnnouncement(courseId, teacherId, input);

    // Fan-out per docs/02-architecture.md §6.1 — see this module's type
    // file doc comment for why this lives here now. Best-effort in the
    // sense that a fan-out failure shouldn't roll back an otherwise
    // successful announcement post, but real errors still surface (not
    // silently swallowed) since there's no legitimate reason for this to
    // fail if the announcement write itself just succeeded.
    const studentIds = await this.repo.listEnrolledStudentIds(courseId);
    if (studentIds.length > 0) {
      await this.repo.createNotificationsForStudents(
        studentIds,
        announcement.id,
        announcement.title,
        announcement.body,
      );
    }

    return announcement;
  }

  async updateAnnouncement(
    announcementId: string,
    teacherId: string,
    input: UpdateAnnouncementInput,
  ): Promise<AnnouncementRecord> {
    await this.assertOwnership(announcementId, teacherId);
    return this.repo.updateAnnouncement(announcementId, input);
  }

  async deleteAnnouncement(announcementId: string, teacherId: string): Promise<void> {
    await this.assertOwnership(announcementId, teacherId);
    await this.repo.softDeleteAnnouncement(announcementId);
  }

  async listMyAnnouncements(
    teacherId: string,
    page = 1,
    limit: number = DEFAULT_LIMIT,
  ): Promise<{ data: TeacherAnnouncementListItem[]; meta: { page: number; limit: number; total: number } }> {
    const { data, total } = await this.repo.listAnnouncementsForTeacher(teacherId, page, limit);
    return { data, meta: { page, limit, total } };
  }

  private async assertOwnership(announcementId: string, teacherId: string): Promise<AnnouncementRecord> {
    const announcement = await this.repo.findAnnouncementById(announcementId);
    if (!announcement) {
      throw ApiError.notFound('ANNOUNCEMENT_NOT_FOUND', 'Announcement not found');
    }
    if (announcement.authorId !== teacherId) {
      throw ApiError.forbidden('NOT_ANNOUNCEMENT_AUTHOR', 'You did not author this announcement');
    }
    return announcement;
  }
}
