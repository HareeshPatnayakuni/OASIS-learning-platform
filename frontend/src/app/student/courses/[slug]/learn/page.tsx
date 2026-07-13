'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { CourseSyllabus } from '@/components/course/CourseSyllabus';
import { VideoPlayer } from '@/components/course/VideoPlayer';
import { ApiClientError } from '@/lib/api-client';
import type { CourseDetail, LectureSummary, SignedUrlResult } from '@/types/api';

function findLecture(course: CourseDetail, lectureId: string): LectureSummary | null {
  for (const chapter of course.chapters) {
    for (const mod of chapter.modules) {
      const found = mod.lectures.find((l) => l.id === lectureId);
      if (found) return found;
    }
  }
  return null;
}

function firstIncompleteLectureId(course: CourseDetail): string | null {
  for (const chapter of course.chapters) {
    for (const mod of chapter.modules) {
      for (const lecture of mod.lectures) {
        if (!lecture.progress?.isCompleted) return lecture.id;
      }
    }
  }
  return course.chapters[0]?.modules[0]?.lectures[0]?.id ?? null;
}

export default function CoursePlayerPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const { authFetch } = useAuth();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [activeLectureId, setActiveLectureId] = useState<string | null>(null);
  const [streamUrlState, setStreamUrlState] = useState<{ lectureId: string; result: SignedUrlResult } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notFoundOrLocked, setNotFoundOrLocked] = useState<'not-enrolled' | null>(null);

  // Load the course + syllabus once.
  useEffect(() => {
    let cancelled = false;
    authFetch<CourseDetail>(`/courses/${slug}`)
      .then((result) => {
        if (cancelled) return;
        if (!result.isEnrolled) {
          setNotFoundOrLocked('not-enrolled');
          return;
        }
        setCourse(result);
        const requestedLectureId = searchParams.get('lectureId');
        const initialId =
          (requestedLectureId && findLecture(result, requestedLectureId) ? requestedLectureId : null) ??
          firstIncompleteLectureId(result);
        setActiveLectureId(initialId);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this course right now.");
      });
    return () => {
      cancelled = true;
    };
    // Only re-run if the course slug changes — lectureId switches are
    // handled by selecting within the already-loaded course, not a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Fetch a fresh signed URL whenever the active lecture changes.
  useEffect(() => {
    if (!activeLectureId) return;
    let cancelled = false;
    authFetch<SignedUrlResult>(`/lectures/${activeLectureId}/stream-url`)
      .then((result) => {
        if (!cancelled) setStreamUrlState({ lectureId: activeLectureId, result });
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this video right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [activeLectureId, authFetch]);

  // The fetched URL is only valid for the lecture it was fetched for — if
  // activeLectureId has since changed and a new fetch hasn't resolved yet,
  // this naturally reads as "no URL yet" (loading) rather than requiring a
  // separate effect to eagerly clear the old one.
  const streamUrl = streamUrlState?.lectureId === activeLectureId ? streamUrlState.result : null;

  const activeLecture = useMemo(
    () => (course && activeLectureId ? findLecture(course, activeLectureId) : null),
    [course, activeLectureId],
  );

  const updateLectureLocally = useCallback(
    (lectureId: string, patch: Partial<LectureSummary['progress']>) => {
      setCourse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          chapters: prev.chapters.map((chapter) => ({
            ...chapter,
            modules: chapter.modules.map((mod) => ({
              ...mod,
              lectures: mod.lectures.map((lecture) =>
                lecture.id === lectureId
                  ? {
                      ...lecture,
                      progress: {
                        lastPositionSec: lecture.progress?.lastPositionSec ?? 0,
                        isCompleted: lecture.progress?.isCompleted ?? false,
                        ...patch,
                      },
                    }
                  : lecture,
              ),
            })),
          })),
        };
      });
    },
    [],
  );

  const saveProgress = useCallback(
    (lectureId: string, body: { lastPositionSec?: number; isCompleted?: boolean }) => {
      updateLectureLocally(lectureId, body);
      authFetch(`/lectures/${lectureId}/progress`, { method: 'PUT', body }).catch(() => undefined);
    },
    [authFetch, updateLectureLocally],
  );

  async function handleDownloadNote(noteId: string): Promise<void> {
    try {
      const result = await authFetch<SignedUrlResult>(`/notes/${noteId}/download-url`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't download this note right now.");
    }
  }

  if (notFoundOrLocked === 'not-enrolled') {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <EmptyState
          title="You're not enrolled in this course"
          description="Enroll to access the full course player."
          action={
            <Link href={`/courses/${slug}`}>
              <Button variant="primary">View course details</Button>
            </Link>
          }
        />
      </main>
    );
  }

  if (error) return <ErrorState message={error} onRetry={() => setError(null)} />;
  if (!course) return <Spinner label="Loading course…" />;

  const activeModule = course.chapters
    .flatMap((c) => c.modules)
    .find((m) => m.lectures.some((l) => l.id === activeLectureId));
  const activeNotes = activeModule?.notes ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
      <Link href={`/courses/${course.slug}`} className="mb-4 inline-block text-sm text-neutral-500 hover:text-brand-600">
        ← {course.title}
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {activeLecture ? (
            <>
              {streamUrl ? (
                <VideoPlayer
                  key={activeLecture.id}
                  src={streamUrl.url}
                  title={activeLecture.title}
                  startAtSec={activeLecture.progress?.lastPositionSec ?? 0}
                  onProgress={(positionSec) => saveProgress(activeLecture.id, { lastPositionSec: positionSec })}
                  onCompleted={() => saveProgress(activeLecture.id, { isCompleted: true })}
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-neutral-900">
                  <Spinner label="Loading video…" />
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-3">
                <h1 className="text-lg font-semibold text-neutral-900">{activeLecture.title}</h1>
                <Button
                  variant={activeLecture.progress?.isCompleted ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => saveProgress(activeLecture.id, { isCompleted: !activeLecture.progress?.isCompleted })}
                >
                  {activeLecture.progress?.isCompleted ? '✓ Completed' : 'Mark as completed'}
                </Button>
              </div>

              {activeNotes.length > 0 ? (
                <div className="mt-6">
                  <h2 className="mb-2 text-sm font-semibold tracking-wide text-neutral-500 uppercase">Notes</h2>
                  <ul className="space-y-2">
                    {activeNotes.map((note) => (
                      <li key={note.id}>
                        <button
                          onClick={() => void handleDownloadNote(note.id)}
                          className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-left text-sm hover:border-brand-300 hover:bg-brand-50"
                        >
                          <span>{note.title}</span>
                          <span className="text-xs text-brand-600">Download</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState title="No lectures yet" description="This course doesn't have any published lectures yet." />
          )}
        </div>

        <div className="lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-neutral-500 uppercase">Course content</h2>
          <CourseSyllabus
            chapters={course.chapters}
            isEnrolled={course.isEnrolled}
            activeLectureId={activeLectureId ?? undefined}
            onSelectLecture={setActiveLectureId}
          />
        </div>
      </div>
    </main>
  );
}
