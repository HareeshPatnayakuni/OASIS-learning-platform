'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ApiClientError } from '@/lib/api-client';
import type { AdminTeacherRecord } from '@/types/api';

const inputClass =
  'w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

export default function AdminTeachersPage() {
  const { authFetch } = useAuth();
  const [teachers, setTeachers] = useState<AdminTeacherRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function refetch(q?: string): Promise<void> {
    try {
      const query = q !== undefined ? q : searchInput;
      const result = await authFetch<AdminTeacherRecord[]>(
        `/admin/teachers${query ? `?q=${encodeURIComponent(query)}` : ''}`,
      );
      setTeachers(result);
    } catch {
      setError("Couldn't load teachers right now.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    authFetch<AdminTeacherRecord[]>('/admin/teachers')
      .then((result) => {
        if (!cancelled) setTeachers(result);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load teachers right now.");
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

  async function handleToggleActive(teacher: AdminTeacherRecord): Promise<void> {
    try {
      await authFetch(`/admin/teachers/${teacher.id}/status`, {
        method: 'PATCH',
        body: { isActive: !teacher.isActive },
      });
      await refetch();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not update status.');
    }
  }

  async function handleResetPassword(teacher: AdminTeacherRecord): Promise<void> {
    if (!confirm(`Send a password reset email to ${teacher.email}?`)) return;
    try {
      await authFetch(`/admin/teachers/${teacher.id}/reset-password`, { method: 'POST' });
      setActionMessage(`Password reset email sent to ${teacher.email}.`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not send reset email.');
    }
  }

  if (error) return <ErrorState message={error} onRetry={() => setError(null)} />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Teachers</h1>
          <p className="text-sm text-neutral-500">View, search, and manage teacher accounts.</p>
        </div>
        {!isAdding ? (
          <Button variant="primary" onClick={() => setIsAdding(true)}>
            Add Teacher
          </Button>
        ) : null}
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
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-success-600">{actionMessage}</p>
      ) : null}

      {isAdding ? (
        <AddTeacherForm
          onCancel={() => setIsAdding(false)}
          onSubmit={async (input) => {
            await authFetch('/admin/teachers', { method: 'POST', body: input });
            setIsAdding(false);
            await refetch();
          }}
        />
      ) : null}

      {!teachers ? (
        <Spinner label="Loading teachers…" />
      ) : teachers.length === 0 ? (
        <EmptyState title="No teachers found" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Courses</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {teachers.map((teacher) =>
                editingId === teacher.id ? (
                  <tr key={teacher.id}>
                    <td colSpan={5} className="px-4 py-3">
                      <EditTeacherForm
                        teacher={teacher}
                        onCancel={() => setEditingId(null)}
                        onSubmit={async (input) => {
                          await authFetch(`/admin/teachers/${teacher.id}`, { method: 'PATCH', body: input });
                          setEditingId(null);
                          await refetch();
                        }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={teacher.id}>
                    <td className="px-4 py-3 font-medium text-neutral-900">{teacher.fullName}</td>
                    <td className="px-4 py-3 text-neutral-600">{teacher.email}</td>
                    <td className="px-4 py-3 text-neutral-600">{teacher.courseCount}</td>
                    <td className="px-4 py-3">
                      <Badge tone={teacher.isActive ? 'success' : 'locked'}>
                        {teacher.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(teacher.id)}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void handleToggleActive(teacher)}
                          className="text-xs text-neutral-500 hover:underline"
                        >
                          {teacher.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => void handleResetPassword(teacher)}
                          className="text-xs text-neutral-500 hover:underline"
                        >
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AddTeacherForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: { fullName: string; email: string; password: string; phone?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({ fullName, email, password, phone: phone || undefined });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not create teacher.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mb-6 space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Full name</label>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Password</label>
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Phone (optional)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create teacher'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function EditTeacherForm({
  teacher,
  onSubmit,
  onCancel,
}: {
  teacher: AdminTeacherRecord;
  onSubmit: (input: { fullName?: string; email?: string; phone?: string | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(teacher.fullName);
  const [email, setEmail] = useState(teacher.email);
  const [phone, setPhone] = useState(teacher.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({ fullName, email, phone: phone || null });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not update teacher.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-wrap items-end gap-2">
      <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className={inputClass} />
      {error ? <p className="w-full text-sm text-red-700">{error}</p> : null}
      <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
        Save
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
