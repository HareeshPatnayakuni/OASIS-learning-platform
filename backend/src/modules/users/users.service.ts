import { ApiError } from '../../utils/ApiError';
import type { CatalogRepository } from '../catalog/catalog.types';
import type {
  AnnouncementItem,
  ContinueWatchingItem,
  UpdateProfileInput,
  UserProfile,
  UsersRepository,
} from './users.types';

const CONTINUE_WATCHING_LIMIT = 5;
const DEFAULT_ANNOUNCEMENTS_LIMIT = 10;

export class UserService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly catalogRepo: CatalogRepository,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const profile = await this.repo.findProfileById(userId);
    if (!profile) {
      throw ApiError.notFound('USER_NOT_FOUND', 'User not found');
    }
    return profile;
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    // classGradeId/boardId are user-editable free-form UUIDs from the
    // client — validate they reference a real, non-deleted catalog row
    // before writing, so a typo'd or stale ID can never end up as an
    // orphaned foreign key on the user's own profile.
    if (input.classGradeId) {
      const grades = await this.catalogRepo.listClassGrades();
      if (!grades.some((g) => g.id === input.classGradeId)) {
        throw ApiError.badRequest('INVALID_CLASS_GRADE', 'classGradeId does not reference a known class grade');
      }
    }
    if (input.boardId) {
      const boards = await this.catalogRepo.listBoards();
      if (!boards.some((b) => b.id === input.boardId)) {
        throw ApiError.badRequest('INVALID_BOARD', 'boardId does not reference a known board');
      }
    }

    return this.repo.updateProfile(userId, input);
  }

  async listContinueWatching(studentId: string, limit: number = CONTINUE_WATCHING_LIMIT): Promise<ContinueWatchingItem[]> {
    return this.repo.listContinueWatching(studentId, limit);
  }

  async listAnnouncements(
    studentId: string,
    page = 1,
    limit: number = DEFAULT_ANNOUNCEMENTS_LIMIT,
  ): Promise<{ data: AnnouncementItem[]; meta: { page: number; limit: number; total: number } }> {
    const { data, total } = await this.repo.listAnnouncementsForStudent(studentId, page, limit);
    return { data, meta: { page, limit, total } };
  }
}
