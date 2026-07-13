/**
 * FR-SRCH-1 (frozen) plus the Module 3A instruction to search courses,
 * chapters, AND modules — three parallel searches, each scoped to
 * published/non-deleted content, combined into one response so the
 * frontend can render a single unified results view.
 */

export interface CourseSearchHit {
  type: 'course';
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
}

export interface ChapterSearchHit {
  type: 'chapter';
  id: string;
  title: string;
  course: { id: string; title: string; slug: string };
}

export interface ModuleSearchHit {
  type: 'module';
  id: string;
  title: string;
  chapter: { id: string; title: string };
  course: { id: string; title: string; slug: string };
}

export interface SearchResults {
  courses: CourseSearchHit[];
  chapters: ChapterSearchHit[];
  modules: ModuleSearchHit[];
}

export interface SearchRepository {
  searchCourses(query: string, limit: number): Promise<CourseSearchHit[]>;
  searchChapters(query: string, limit: number): Promise<ChapterSearchHit[]>;
  searchModules(query: string, limit: number): Promise<ModuleSearchHit[]>;
}
