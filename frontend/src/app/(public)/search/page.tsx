import type { Metadata } from 'next';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';
import { EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import type { SearchResults } from '@/types/api';

export const metadata: Metadata = { title: 'Search' };

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  let results: SearchResults = { courses: [], chapters: [], modules: [] };
  if (query) {
    try {
      results = await apiRequest<SearchResults>(`/search?q=${encodeURIComponent(query)}`);
    } catch {
      // Fall through to the empty-results view below.
    }
  }

  const totalHits = results.courses.length + results.chapters.length + results.modules.length;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">
        {query ? `Results for "${query}"` : 'Search'}
      </h1>
      <p className="mb-6 text-sm text-neutral-500">{totalHits} result{totalHits === 1 ? '' : 's'}</p>

      {!query ? (
        <EmptyState title="Enter a search term" description="Search across courses, chapters, and modules." />
      ) : totalHits === 0 ? (
        <EmptyState title="No results found" description="Try a different search term." />
      ) : (
        <div className="space-y-8">
          {results.courses.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-neutral-500 uppercase">Courses</h2>
              <ul className="space-y-2">
                {results.courses.map((hit) => (
                  <li key={hit.id}>
                    <Link
                      href={`/courses/${hit.slug}`}
                      className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-brand-300 hover:bg-brand-50"
                    >
                      <span className="font-medium text-neutral-900">{hit.title}</span>
                      <Badge tone="brand">Course</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {results.chapters.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-neutral-500 uppercase">Chapters</h2>
              <ul className="space-y-2">
                {results.chapters.map((hit) => (
                  <li key={hit.id}>
                    <Link
                      href={`/courses/${hit.course.slug}`}
                      className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-brand-300 hover:bg-brand-50"
                    >
                      <span>
                        <span className="font-medium text-neutral-900">{hit.title}</span>
                        <span className="ml-2 text-sm text-neutral-500">in {hit.course.title}</span>
                      </span>
                      <Badge tone="neutral">Chapter</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {results.modules.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-neutral-500 uppercase">Modules</h2>
              <ul className="space-y-2">
                {results.modules.map((hit) => (
                  <li key={hit.id}>
                    <Link
                      href={`/courses/${hit.course.slug}`}
                      className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-brand-300 hover:bg-brand-50"
                    >
                      <span>
                        <span className="font-medium text-neutral-900">{hit.title}</span>
                        <span className="ml-2 text-sm text-neutral-500">
                          in {hit.course.title} · {hit.chapter.title}
                        </span>
                      </span>
                      <Badge tone="neutral">Module</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
