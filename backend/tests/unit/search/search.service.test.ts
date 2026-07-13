import { SearchService } from '../../../src/modules/search/search.service';
import type { SearchRepository } from '../../../src/modules/search/search.types';

function createFakeSearchRepository(): SearchRepository {
  return {
    async searchCourses(query: string) {
      return query === 'math'
        ? [{ type: 'course', id: 'c1', title: 'Mathematics Foundations', slug: 'math-foundations', thumbnailUrl: null }]
        : [];
    },
    async searchChapters(query: string) {
      return query === 'math'
        ? [{ type: 'chapter', id: 'ch1', title: 'Math Basics', course: { id: 'c1', title: 'Course', slug: 'course' } }]
        : [];
    },
    async searchModules(query: string) {
      return query === 'math'
        ? [
            {
              type: 'module',
              id: 'm1',
              title: 'Math Intro',
              chapter: { id: 'ch1', title: 'Chapter' },
              course: { id: 'c1', title: 'Course', slug: 'course' },
            },
          ]
        : [];
    },
  };
}

describe('SearchService.search', () => {
  it('combines results from all three categories', async () => {
    const service = new SearchService(createFakeSearchRepository());
    const result = await service.search('math');

    expect(result.courses).toHaveLength(1);
    expect(result.chapters).toHaveLength(1);
    expect(result.modules).toHaveLength(1);
  });

  it('returns empty arrays (not an error) for a query with no matches', async () => {
    const service = new SearchService(createFakeSearchRepository());
    const result = await service.search('nonexistent-topic-xyz');

    expect(result).toEqual({ courses: [], chapters: [], modules: [] });
  });
});
