import type { AdminRepository, PlatformSettings, UpdatePlatformSettingsInput } from './admin.types';

export class AdminSettingsService {
  constructor(private readonly repo: AdminRepository) {}

  async getSettings(): Promise<PlatformSettings> {
    return this.repo.getSettings();
  }

  async updateSettings(updatedById: string, input: UpdatePlatformSettingsInput): Promise<PlatformSettings> {
    return this.repo.updateSettings(updatedById, input);
  }
}
