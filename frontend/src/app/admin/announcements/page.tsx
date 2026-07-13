'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { ApiClientError } from '@/lib/api-client';
import type { AdminAnnouncementSummary } from '@/types/api';

const inputClass =
  'w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminAnnouncementsPage() {
  const { authFetch, authFetchPaginated } = useAuth();
  const [announcements, setAnnouncements] = useState<AdminAnnouncementSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refetch(): Promise<void> {
    try {
      const page = await authFetchPaginated<AdminAnnouncementSummary>('/admin/announcements?limit=50');
      setAnnouncements(page.data);
    } catch {
      setError("Couldn't load announcements right now.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    authFetchPaginated<AdminAnnouncementSummary>('/admin/announcements?limit=50')
      .then((page) => {
        if (!cancelled) setAnnouncements(page.data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load announcements right now.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Platform Announcements</h1>
          <p className="text-sm text-neutral-500">Visible to every user across the platform.</p>
        </div>
        {!isComposing ? (
          <Button variant="primary" onClick={() => setIsComposing(true)}>
            New Announcement
          </Button>
        ) : null}
      </div>

      {isComposing ? (
        <AnnouncementForm
          onCancel={() => setIsComposing(false)}
          onSubmit={async (input) => {
            await authFetch('/admin/announcements', { method: 'POST', body: input });
            setIsComposing(false);
            await refetch();
          }}
        />
      ) : null}

      {!announcements ? (
        <Spinner label="Loading announcements…" />
      ) : announcements.length === 0 && !isComposing ? (
        <EmptyState title="No platform announcements yet" description="Post one to reach every user." />
      ) : (
        <ul className="mt-4 space-y-3">
          {announcements.map((announcement) => (
            <li key={announcement.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              {editingId === announcement.id ? (
                <EditAnnouncementForm
                  announcement={announcement}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (input) => {
                    await authFetch(`/admin/announcements/${announcement.id}`, { method: 'PATCH', body: input });
                    setEditingId(null);
                    await refetch();
                  }}
                />
              ) : (
                <>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-medium text-neutral-900">{announcement.title}</p>
                    <span className="shrink-0 text-xs text-neutral-400">{formatDate(announcement.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-neutral-600">{announcement.body}</p>
                  <div className="mt-2 flex justify-end gap-3">
                    <button
                      onClick={() => setEditingId(announcement.id)}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm('Delete this platform announcement?')) return;
                        void authFetch(`/admin/announcements/${announcement.id}`, { method: 'DELETE' }).then(refetch);
                      }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AnnouncementForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: { title: string; body: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({ title, body });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mb-6 space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Title</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Message</label>
        <textarea required rows={4} value={body} onChange={(e) => setBody(e.target.value)} className={inputClass} />
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Posting…' : 'Post to everyone'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function EditAnnouncementForm({
  announcement,
  onSubmit,
  onCancel,
}: {
  announcement: AdminAnnouncementSummary;
  onSubmit: (input: { title: string; body: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(announcement.title);
  const [body, setBody] = useState(announcement.body);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({ title, body });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} className={inputClass} />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
