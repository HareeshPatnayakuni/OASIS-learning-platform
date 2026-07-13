import { ApiError } from '../../utils/ApiError';
import type { AdminAnnouncementSummary, AdminRepository, PlatformAnnouncementInput } from './admin.types';

export interface PlatformAnnouncementListResult {
  data: AdminAnnouncementSummary[];
  meta: { page: number; limit: number; total: number };
}

/**
 * Platform-wide announcements are simply Announcement rows with
 * `courseId: null` — the schema already supported this nullable FK before
 * Module 3C (docs/03-database-design.md), it just had no writer. Entirely
 * separate from Module 3B's per-course TeacherAnnouncementService: a
 * teacher can never see/edit these (no course to check ownership
 * against), and this service never touches course-scoped announcements.
 */
export class AdminAnnouncementService {
  constructor(private readonly repo: AdminRepository) {}

  async listAnnouncements(page: number, limit: number): Promise<PlatformAnnouncementListResult> {
    const { data, total } = await this.repo.listPlatformAnnouncements(page, limit);
    return { data, meta: { page, limit, total } };
  }

  async createAnnouncement(authorId: string, input: PlatformAnnouncementInput): Promise<AdminAnnouncementSummary> {
    return this.repo.createPlatformAnnouncement(authorId, input);
  }

  async updateAnnouncement(
    id: string,
    input: Partial<PlatformAnnouncementInput>,
  ): Promise<AdminAnnouncementSummary> {
    await this.assertExists(id);
    return this.repo.updatePlatformAnnouncement(id, input);
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await this.assertExists(id);
    await this.repo.softDeletePlatformAnnouncement(id);
  }

  private async assertExists(id: string): Promise<AdminAnnouncementSummary> {
    const announcement = await this.repo.findPlatformAnnouncementById(id);
    if (!announcement) {
      throw ApiError.notFound('ANNOUNCEMENT_NOT_FOUND', 'Platform announcement not found');
    }
    return announcement;
  }
}
