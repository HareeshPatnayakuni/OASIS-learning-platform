'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AnnouncementList } from '@/components/student/AnnouncementList';
import type { AnnouncementItem, TeacherCourseSummary } from '@/types/api';

interface DashboardData {
  courses: TeacherCourseSummary[];
  announcements: AnnouncementItem[];
}

function statusTone(status: TeacherCourseSummary['status']): 'success' | 'neutral' | 'locked' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'ARCHIVED') return 'locked';
  return 'neutral';
}

export default function TeacherDashboardPage() {
  const { user, authFetch, authFetchPaginated } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const [courses, announcementsPage] = await Promise.all([
          authFetch<TeacherCourseSummary[]>('/courses/mine'),
          authFetchPaginated<AnnouncementItem>('/announcements/mine?limit=5'),
        ]);
        if (!cancelled) setData({ courses, announcements: announcementsPage.data });
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

  const totalStudents = data.courses.reduce((sum, c) => sum + c.enrollmentCount, 0);
  const publishedCount = data.courses.filter((c) => c.status === 'PUBLISHED').length;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Welcome back{user ? `, ${user.fullName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-neutral-500">Here&apos;s how your courses are doing.</p>
        </div>
        <Link href="/teacher/courses/new">
          <Button variant="primary">Create Course</Button>
        </Link>
      </div>

      {/* Course statistics (basic) — counts only, not a trends/analytics
          dashboard (explicitly out of scope for Module 3B). */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Courses" value={data.courses.length} />
        <StatCard label="Published" value={publishedCount} />
        <StatCard label="Total Students" value={totalStudents} />
        <StatCard
          label="Total Lectures"
          value={data.courses.reduce((sum, c) => sum + c.totalLectures, 0)}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">My Courses</h2>
          <Link href="/teacher/courses">
            <Button variant="ghost" size="sm">
              View all
            </Button>
          </Link>
        </div>
        {data.courses.length === 0 ? (
          <EmptyState
            title="No courses yet"
            description="Create your first course to get started."
            action={
              <Link href="/teacher/courses/new">
                <Button variant="primary">Create Course</Button>
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {data.courses.slice(0, 5).map((course) => (
              <li key={course.id}>
                <Link
                  href={`/teacher/courses/${course.id}/edit`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 hover:border-brand-300 hover:bg-brand-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900">{course.title}</p>
                    <p className="text-xs text-neutral-500">
                      {course.enrollmentCount} student{course.enrollmentCount === 1 ? '' : 's'} ·{' '}
                      {course.publishedLectures}/{course.totalLectures} lectures published
                    </p>
                  </div>
                  <Badge tone={statusTone(course.status)}>{course.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase">
            Recent Announcements
          </h2>
          <Link href="/teacher/announcements">
            <Button variant="ghost" size="sm">
              Manage
            </Button>
          </Link>
        </div>
        <AnnouncementList announcements={data.announcements} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-2xl font-semibold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
