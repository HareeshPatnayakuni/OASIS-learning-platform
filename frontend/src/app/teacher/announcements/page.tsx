'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { ApiClientError } from '@/lib/api-client';
import type { TeacherAnnouncement, TeacherCourseSummary } from '@/types/api';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TeacherAnnouncementsPage() {
  const { authFetch, authFetchPaginated } = useAuth();
  const [announcements, setAnnouncements] = useState<TeacherAnnouncement[] | null>(null);
  const [courses, setCourses] = useState<TeacherCourseSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refetch(): Promise<void> {
    try {
      const [page, myCourses] = await Promise.all([
        authFetchPaginated<TeacherAnnouncement>('/announcements/mine?limit=50'),
        authFetch<TeacherCourseSummary[]>('/courses/mine'),
      ]);
      setAnnouncements(page.data);
      setCourses(myCourses);
    } catch {
      setError("Couldn't load your announcements right now.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authFetchPaginated<TeacherAnnouncement>('/announcements/mine?limit=50'),
      authFetch<TeacherCourseSummary[]>('/courses/mine'),
    ])
      .then(([page, myCourses]) => {
        if (cancelled) return;
        setAnnouncements(page.data);
        setCourses(myCourses);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your announcements right now.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!announcements) return <Spinner label="Loading announcements…" />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Announcements</h1>
          <p className="text-sm text-neutral-500">
            Post updates to your students. Include a Zoom or Google Meet link here for live classes.
          </p>
        </div>
        {!isComposing ? (
          <Button variant="primary" onClick={() => setIsComposing(true)} disabled={courses.length === 0}>
            New Announcement
          </Button>
        ) : null}
      </div>

      {isComposing ? (
        <AnnouncementForm
          courses={courses}
          onCancel={() => setIsComposing(false)}
          onSubmit={async (input) => {
            await authFetch(`/courses/${input.courseId}/announcements`, {
              method: 'POST',
              body: { title: input.title, body: input.body },
            });
            setIsComposing(false);
            await refetch();
          }}
        />
      ) : null}

      {announcements.length === 0 && !isComposing ? (
        <EmptyState
          title="No announcements yet"
          description={
            courses.length === 0
              ? 'Create a course first, then you can post announcements to it.'
              : 'Post your first announcement to let students know what to expect.'
          }
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {announcements.map((announcement) => {
            const course = courses.find((c) => c.id === announcement.courseId);
            return (
              <li key={announcement.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                {editingId === announcement.id ? (
                  <EditAnnouncementForm
                    announcement={announcement}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (input) => {
                      await authFetch(`/announcements/${announcement.id}`, { method: 'PATCH', body: input });
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
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-neutral-400">{course?.title ?? 'Unknown course'}</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setEditingId(announcement.id)}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (!confirm('Delete this announcement?')) return;
                            void authFetch(`/announcements/${announcement.id}`, { method: 'DELETE' }).then(refetch);
                          }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AnnouncementForm({
  courses,
  onSubmit,
  onCancel,
}: {
  courses: TeacherCourseSummary[];
  onSubmit: (input: { courseId: string; title: string; body: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({ courseId, title, body });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mb-6 space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Course</label>
        <select
          required
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          Message <span className="text-neutral-400">(paste a Zoom/Google Meet link here if needed)</span>
        </label>
        <textarea
          required
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Posting…' : 'Post announcement'}
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
  announcement: TeacherAnnouncement;
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
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <textarea
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
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
