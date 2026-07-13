import type { BoardSummary, CatalogRepository, ClassGradeSummary, SubjectSummary } from './catalog.types';

/**
 * No business logic here today — these are unfiltered public reads. The
 * service layer exists anyway, for the same reason every module gets one
 * (PROJECT_MEMORY.md §4): controllers never talk to a repository directly,
 * so adding real logic later (e.g. caching, board-specific subject
 * filtering) is a change to this one file, not a new architectural layer.
 */
export class CatalogService {
  constructor(private readonly repo: CatalogRepository) {}

  async listBoards(): Promise<BoardSummary[]> {
    return this.repo.listBoards();
  }

  async listClassGrades(): Promise<ClassGradeSummary[]> {
    return this.repo.listClassGrades();
  }

  async listSubjects(): Promise<SubjectSummary[]> {
    return this.repo.listSubjects();
  }
}
