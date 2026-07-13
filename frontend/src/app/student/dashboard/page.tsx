'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { StreakBadge } from '@/components/student/StreakBadge';
import { AnnouncementList } from '@/components/student/AnnouncementList';
import { CourseCard } from '@/components/course/CourseCard';
import { Button } from '@/components/ui/Button';
import type {
  AnnouncementItem,
  ContinueWatchingItem,
  EnrolledCourseSummary,
  StreakSnapshot,
} from '@/types/api';

interface DashboardData {
  streak: StreakSnapshot;
  continueWatching: ContinueWatchingItem[];
  myCourses: EnrolledCourseSummary[];
  announcements: AnnouncementItem[];
}

function formatDuration(sec: number | null): string {
  if (!sec) return '';
  const minutes = Math.round(sec / 60);
  return `${minutes} min`;
}

export default function StudentDashboardPage() {
  const { user, authFetch, authFetchPaginated } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [streak, continueWatching, myCourses, announcementsPage] = await Promise.all([
          authFetch<StreakSnapshot>('/users/me/streak'),
          authFetch<ContinueWatchingItem[]>('/users/me/continue-watching'),
          authFetch<EnrolledCourseSummary[]>('/enrollments/me'),
          authFetchPaginated<AnnouncementItem>('/users/me/announcements?limit=5'),
        ]);
        if (cancelled) return;
        setData({ streak, continueWatching, myCourses, announcements: announcementsPage.data });
      } catch {
        if (!cancelled) setError("Couldn't load your dashboard right now.");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch, authFetchPaginated]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <Spinner label="Loading your dashboard…" />;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          Welcome back{user ? `, ${user.fullName.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-neutral-500">Here&apos;s where you left off.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <StreakBadge streak={data.streak} />
        </div>

        <div className="md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-neutral-500 uppercase">
            Continue Watching
          </h2>
          {data.continueWatching.length === 0 ? (
            <EmptyState
              title="Nothing in progress"
              description="Start a lecture from one of your courses and it'll show up here."
            />
          ) : (
            <ul className="space-y-2">
              {data.continueWatching.map((item) => (
                <li key={item.lecture.id}>
                  <Link
                    href={`/student/courses/${item.course.slug}/learn?lectureId=${item.lecture.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-brand-300 hover:bg-brand-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-neutral-900">{item.lecture.title}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {item.course.title} · {item.chapter.title}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {formatDuration(item.lecture.durationSec)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">My Courses</h2>
          {data.myCourses.length > 0 ? (
            <Link href="/student/courses">
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          ) : null}
        </div>
        {data.myCourses.length === 0 ? (
          <EmptyState
            title="No courses yet"
            description="Once you're enrolled in a course, it'll show up here with your progress."
            action={
              <Link href="/courses">
                <Button variant="primary">Browse Courses</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.myCourses.slice(0, 3).map((enrollment) => (
              <CourseCard
                key={enrollment.enrollmentId}
                course={enrollment.course}
                progressPercent={enrollment.progressPercent}
                href={`/student/courses/${enrollment.course.slug}/learn`}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-neutral-500 uppercase">Announcements</h2>
        <AnnouncementList announcements={data.announcements} />
      </div>
    </div>
  );
}
