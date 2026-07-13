import { UserService } from '../../../src/modules/users/users.service';
import type {
  AnnouncementItem,
  ContinueWatchingItem,
  UpdateProfileInput,
  UserProfile,
  UsersRepository,
} from '../../../src/modules/users/users.types';
import type { CatalogRepository } from '../../../src/modules/catalog/catalog.types';

function buildProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    fullName: 'Aisha Khan',
    email: 'aisha@example.com',
    role: 'STUDENT',
    phone: null,
    avatarUrl: null,
    classGrade: null,
    board: null,
    emailVerifiedAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function createFakeUsersRepository(initialProfile: UserProfile): UsersRepository {
  let profile = initialProfile;
  return {
    async findProfileById(userId: string) {
      return userId === profile.id ? profile : null;
    },
    async updateProfile(userId: string, input: UpdateProfileInput) {
      profile = {
        ...profile,
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.classGradeId !== undefined
          ? { classGrade: input.classGradeId ? { id: input.classGradeId, name: 'Class 8', slug: 'class-8' } : null }
          : {}),
        ...(input.boardId !== undefined
          ? { board: input.boardId ? { id: input.boardId, name: 'CBSE', slug: 'cbse' } : null }
          : {}),
      };
      return profile;
    },
    async listContinueWatching(): Promise<ContinueWatchingItem[]> {
      return [];
    },
    async listAnnouncementsForStudent(): Promise<{ data: AnnouncementItem[]; total: number }> {
      return { data: [], total: 0 };
    },
  };
}

function createFakeCatalogRepository(options: {
  classGradeIds?: string[];
  boardIds?: string[];
}): CatalogRepository {
  const classGradeIds = options.classGradeIds ?? ['class-8-id'];
  const boardIds = options.boardIds ?? ['cbse-id'];
  return {
    async listBoards() {
      return boardIds.map((id) => ({ id, name: 'Board', slug: id }));
    },
    async listClassGrades() {
      return classGradeIds.map((id) => ({ id, name: 'Class', slug: id, order: 8 }));
    },
    async listSubjects() {
      return [];
    },
  };
}

describe('UserService.getProfile', () => {
  it('returns the profile for a known user', async () => {
    const profile = buildProfile();
    const service = new UserService(createFakeUsersRepository(profile), createFakeCatalogRepository({}));
    await expect(service.getProfile('user-1')).resolves.toEqual(profile);
  });

  it('throws USER_NOT_FOUND for an unknown user', async () => {
    const service = new UserService(createFakeUsersRepository(buildProfile()), createFakeCatalogRepository({}));
    await expect(service.getProfile('nobody')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('UserService.updateProfile', () => {
  it('updates fullName and phone without touching catalog references', async () => {
    const service = new UserService(
      createFakeUsersRepository(buildProfile()),
      createFakeCatalogRepository({}),
    );
    const result = await service.updateProfile('user-1', { fullName: 'New Name', phone: '9999999999' });
    expect(result.fullName).toBe('New Name');
    expect(result.phone).toBe('9999999999');
  });

  it('accepts a classGradeId that exists in the catalog', async () => {
    const service = new UserService(
      createFakeUsersRepository(buildProfile()),
      createFakeCatalogRepository({ classGradeIds: ['class-8-id'] }),
    );
    const result = await service.updateProfile('user-1', { classGradeId: 'class-8-id' });
    expect(result.classGrade?.id).toBe('class-8-id');
  });

  it('rejects a classGradeId that does not exist in the catalog', async () => {
    const service = new UserService(
      createFakeUsersRepository(buildProfile()),
      createFakeCatalogRepository({ classGradeIds: ['class-8-id'] }),
    );
    await expect(service.updateProfile('user-1', { classGradeId: 'bogus-id' })).rejects.toMatchObject({
      code: 'INVALID_CLASS_GRADE',
      statusCode: 400,
    });
  });

  it('rejects a boardId that does not exist in the catalog', async () => {
    const service = new UserService(
      createFakeUsersRepository(buildProfile()),
      createFakeCatalogRepository({ boardIds: ['cbse-id'] }),
    );
    await expect(service.updateProfile('user-1', { boardId: 'bogus-board' })).rejects.toMatchObject({
      code: 'INVALID_BOARD',
      statusCode: 400,
    });
  });
});

describe('UserService.listAnnouncements', () => {
  it('returns paginated results with default page/limit', async () => {
    const service = new UserService(createFakeUsersRepository(buildProfile()), createFakeCatalogRepository({}));
    const result = await service.listAnnouncements('user-1');
    expect(result.meta).toEqual({ page: 1, limit: 10, total: 0 });
  });
});
