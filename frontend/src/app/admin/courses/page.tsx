'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { ApiClientError } from '@/lib/api-client';
import type { AdminCourseRecord, CourseStatus } from '@/types/api';

const inputClass =
  'rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

function statusTone(status: CourseStatus): 'success' | 'neutral' | 'locked' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'ARCHIVED') return 'locked';
  return 'neutral';
}

export default function AdminCoursesPage() {
  const { authFetch } = useAuth();
  const [courses, setCourses] = useState<AdminCourseRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function refetch(overrides?: { q?: string; status?: string }): Promise<void> {
    try {
      const q = overrides?.q !== undefined ? overrides.q : searchInput;
      const status = overrides?.status !== undefined ? overrides.status : statusFilter;
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      const result = await authFetch<AdminCourseRecord[]>(`/admin/courses?${params.toString()}`);
      setCourses(result);
    } catch {
      setError("Couldn't load courses right now.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    authFetch<AdminCourseRecord[]>('/admin/courses')
      .then((result) => {
        if (!cancelled) setCourses(result);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load courses right now.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearchSubmit(event: FormEvent): void {
    event.preventDefault();
    void refetch({ q: searchInput });
  }

  function handleStatusChange(value: string): void {
    setStatusFilter(value);
    void refetch({ status: value });
  }

  async function handleArchive(course: AdminCourseRecord): Promise<void> {
    if (!confirm(`Archive "${course.title}"? Students will no longer be able to browse or access it.`)) return;
    try {
      await authFetch(`/admin/courses/${course.id}/archive`, { method: 'PATCH' });
      await refetch();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not archive course.');
    }
  }

  async function handleRestore(course: AdminCourseRecord): Promise<void> {
    if (!confirm(`Restore "${course.title}" to Draft? The teacher can publish it again once ready.`)) return;
    try {
      await authFetch(`/admin/courses/${course.id}/restore`, { method: 'PATCH' });
      await refetch();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not restore course.');
    }
  }

  async function handleDelete(course: AdminCourseRecord): Promise<void> {
    if (
      !confirm(
        `Delete "${course.title}" permanently? This cannot be undone from this screen and will remove student access immediately. Type OK to confirm.`,
      )
    )
      return;
    try {
      await authFetch(`/admin/courses/${course.id}`, { method: 'DELETE' });
      await refetch();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not delete course.');
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => setError(null)} />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Course Oversight</h1>
        <p className="text-sm text-neutral-500">
          Read-only oversight — chapters, lectures, and quizzes stay under Teacher ownership.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <form onSubmit={handleSearchSubmit} className="max-w-sm flex-1">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by course title…"
            className={`w-full ${inputClass}`}
          />
        </form>
        <select value={statusFilter} onChange={(e) => handleStatusChange(e.target.value)} className={inputClass}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      {!courses ? (
        <Spinner label="Loading courses…" />
      ) : courses.length === 0 ? (
        <EmptyState title="No courses found" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {courses.map((course) => (
                <tr key={course.id}>
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate font-medium text-neutral-900">{course.title}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {course.teacher.fullName}
                    <br />
                    <span className="text-xs text-neutral-400">{course.teacher.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(course.status)}>{course.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{course.enrollmentCount}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {course.status !== 'ARCHIVED' ? (
                        <button
                          onClick={() => void handleArchive(course)}
                          className="text-xs text-neutral-500 hover:underline"
                        >
                          Archive
                        </button>
                      ) : (
                        <button
                          onClick={() => void handleRestore(course)}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          Restore
                        </button>
                      )}
                      <button
                        onClick={() => void handleDelete(course)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
