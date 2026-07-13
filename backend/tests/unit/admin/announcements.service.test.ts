import { AdminAnnouncementService } from '../../../src/modules/admin/announcements.service';
import { createFakeAdminRepository } from './fakeAdminRepository';

describe('AdminAnnouncementService.createAnnouncement', () => {
  it('creates a platform-wide announcement (courseId is always null)', async () => {
    const { repo, announcements } = createFakeAdminRepository({});
    const service = new AdminAnnouncementService(repo);

    const announcement = await service.createAnnouncement('admin-1', {
      title: 'Platform maintenance',
      body: 'The site will be down for maintenance this weekend.',
    });

    expect(announcement.courseId).toBeNull();
    expect(announcements.has(announcement.id)).toBe(true);
  });
});

describe('AdminAnnouncementService.listAnnouncements', () => {
  it('paginates platform announcements', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminAnnouncementService(repo);
    await service.createAnnouncement('admin-1', { title: 'A', body: 'X' });
    await service.createAnnouncement('admin-1', { title: 'B', body: 'Y' });

    const result = await service.listAnnouncements(1, 1);
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(2);
  });
});

describe('AdminAnnouncementService.updateAnnouncement / deleteAnnouncement', () => {
  it('updates a platform announcement', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminAnnouncementService(repo);
    const announcement = await service.createAnnouncement('admin-1', { title: 'Old', body: 'X' });

    const updated = await service.updateAnnouncement(announcement.id, { title: 'New' });
    expect(updated.title).toBe('New');
  });

  it('404s when editing an announcement that does not exist', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminAnnouncementService(repo);

    await expect(service.updateAnnouncement('nope', { title: 'X' })).rejects.toMatchObject({
      code: 'ANNOUNCEMENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('deletes a platform announcement', async () => {
    const { repo, announcements } = createFakeAdminRepository({});
    const service = new AdminAnnouncementService(repo);
    const announcement = await service.createAnnouncement('admin-1', { title: 'X', body: 'Y' });

    await service.deleteAnnouncement(announcement.id);
    expect(announcements.has(announcement.id)).toBe(false);
  });
});
