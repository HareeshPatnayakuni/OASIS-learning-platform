import { AdminSettingsService } from '../../../src/modules/admin/settings.service';
import { createFakeAdminRepository } from './fakeAdminRepository';

describe('AdminSettingsService.getSettings', () => {
  it('returns the current platform settings', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminSettingsService(repo);

    const settings = await service.getSettings();
    expect(settings.academyName).toBe('OASIS');
  });
});

describe('AdminSettingsService.updateSettings', () => {
  it('updates only the provided fields, leaving others untouched', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminSettingsService(repo);

    const updated = await service.updateSettings('admin-1', { tagline: 'Learn From Home' });
    expect(updated.tagline).toBe('Learn From Home');
    expect(updated.academyName).toBe('OASIS'); // unchanged
  });

  it('allows updating social links', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminSettingsService(repo);

    const updated = await service.updateSettings('admin-1', {
      socialLinks: { instagram: 'https://instagram.com/oasis' },
    });
    expect(updated.socialLinks).toEqual({ instagram: 'https://instagram.com/oasis' });
  });

  it('allows clearing a field back to null', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminSettingsService(repo);
    await service.updateSettings('admin-1', { tagline: 'Something' });

    const cleared = await service.updateSettings('admin-1', { tagline: null });
    expect(cleared.tagline).toBeNull();
  });
});
