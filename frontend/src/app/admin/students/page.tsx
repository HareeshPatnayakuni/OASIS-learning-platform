'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { ApiClientError } from '@/lib/api-client';
import type { AdminStudentRecord } from '@/types/api';

const inputClass =
  'w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

export default function AdminStudentsPage() {
  const { authFetch } = useAuth();
  const [students, setStudents] = useState<AdminStudentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function refetch(q?: string): Promise<void> {
    try {
      const query = q !== undefined ? q : searchInput;
      const result = await authFetch<AdminStudentRecord[]>(
        `/admin/students${query ? `?q=${encodeURIComponent(query)}` : ''}`,
      );
      setStudents(result);
    } catch {
      setError("Couldn't load students right now.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    authFetch<AdminStudentRecord[]>('/admin/students')
      .then((result) => {
        if (!cancelled) setStudents(result);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load students right now.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearchSubmit(event: FormEvent): void {
    event.preventDefault();
    void refetch(searchInput);
  }

  async function handleToggleActive(student: AdminStudentRecord): Promise<void> {
    try {
      await authFetch(`/admin/students/${student.id}/status`, {
        method: 'PATCH',
        body: { isActive: !student.isActive },
      });
      await refetch();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not update status.');
    }
  }

  async function handleResetPassword(student: AdminStudentRecord): Promise<void> {
    if (!confirm(`Send a password reset email to ${student.email}?`)) return;
    try {
      await authFetch(`/admin/students/${student.id}/reset-password`, { method: 'POST' });
      setActionMessage(`Password reset email sent to ${student.email}.`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not send reset email.');
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => setError(null)} />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Students</h1>
        <p className="text-sm text-neutral-500">View, search, and manage student accounts.</p>
      </div>

      <form onSubmit={handleSearchSubmit} className="mb-4 max-w-sm">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or email…"
          className={inputClass}
        />
      </form>

      {actionMessage ? (
        <p className="mb-4 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-600">{actionMessage}</p>
      ) : null}

      {!students ? (
        <Spinner label="Loading students…" />
      ) : students.length === 0 ? (
        <EmptyState title="No students found" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Enrollments</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="px-4 py-3 font-medium text-neutral-900">{student.fullName}</td>
                  <td className="px-4 py-3 text-neutral-600">{student.email}</td>
                  <td className="px-4 py-3 text-neutral-600">{student.enrollmentCount}</td>
                  <td className="px-4 py-3">
                    <Badge tone={student.isActive ? 'success' : 'locked'}>
                      {student.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => void handleToggleActive(student)}
                        className="text-xs text-neutral-500 hover:underline"
                      >
                        {student.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => void handleResetPassword(student)}
                        className="text-xs text-neutral-500 hover:underline"
                      >
                        Reset password
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
