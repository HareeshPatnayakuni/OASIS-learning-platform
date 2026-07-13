'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import type { CatalogRef, ClassGrade } from '@/types/api';

interface CourseFilterBarProps {
  boards: CatalogRef[];
  classGrades: ClassGrade[];
  subjects: CatalogRef[];
}

/**
 * Reads/writes the URL's search params directly (?boardId=&classGradeId=&subjectId=&q=)
 * rather than component state, so filters survive a page refresh or a
 * shared/bookmarked link — the Browse Courses page (a Server Component)
 * re-fetches from the backend using these same params.
 *
 * The search box is deliberately uncontrolled (`defaultValue` + `key`)
 * rather than local state kept in sync with `searchParams` via an effect —
 * that sync-on-every-external-change pattern is exactly what
 * react-hooks/set-state-in-effect flags as an anti-pattern (see
 * https://react.dev/learn/you-might-not-need-an-effect). Keying the input
 * on the current `q` value makes React remount (and so reset) it whenever
 * the URL changes some other way (e.g. browser back/forward), without an
 * effect at all.
 */
export function CourseFilterBar({ boards, classGrades, subjects }: CourseFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const currentQuery = searchParams.get('q') ?? '';

  function updateParam(key: string, value: string): void {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // any filter change resets pagination
    router.push(`/courses?${params.toString()}`);
  }

  function handleSearchSubmit(event: React.FormEvent): void {
    event.preventDefault();
    updateParam('q', searchInputRef.current?.value.trim() ?? '');
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <form onSubmit={handleSearchSubmit} className="flex-1 sm:min-w-[240px]">
        <label htmlFor="course-search" className="sr-only">
          Search courses
        </label>
        <input
          id="course-search"
          key={currentQuery}
          ref={searchInputRef}
          type="search"
          defaultValue={currentQuery}
          placeholder="Search courses…"
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </form>

      <select
        aria-label="Filter by board"
        value={searchParams.get('boardId') ?? ''}
        onChange={(e) => updateParam('boardId', e.target.value)}
        className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value="">All Boards</option>
        {boards.map((board) => (
          <option key={board.id} value={board.id}>
            {board.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by class"
        value={searchParams.get('classGradeId') ?? ''}
        onChange={(e) => updateParam('classGradeId', e.target.value)}
        className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value="">All Classes</option>
        {classGrades.map((grade) => (
          <option key={grade.id} value={grade.id}>
            {grade.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by subject"
        value={searchParams.get('subjectId') ?? ''}
        onChange={(e) => updateParam('subjectId', e.target.value)}
        className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <option value="">All Subjects</option>
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </select>
    </div>
  );
}
