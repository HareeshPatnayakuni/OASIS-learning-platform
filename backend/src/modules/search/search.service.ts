import type { SearchRepository, SearchResults } from './search.types';

const DEFAULT_LIMIT_PER_CATEGORY = 10;

export class SearchService {
  constructor(private readonly repo: SearchRepository) {}

  async search(query: string, limitPerCategory: number = DEFAULT_LIMIT_PER_CATEGORY): Promise<SearchResults> {
    const [courses, chapters, modules] = await Promise.all([
      this.repo.searchCourses(query, limitPerCategory),
      this.repo.searchChapters(query, limitPerCategory),
      this.repo.searchModules(query, limitPerCategory),
    ]);

    return { courses, chapters, modules };
  }
}
