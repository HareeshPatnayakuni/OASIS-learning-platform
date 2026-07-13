'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { TeacherCourseSummary } from '@/types/api';

function statusTone(status: TeacherCourseSummary['status']): 'success' | 'neutral' | 'locked' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'ARCHIVED') return 'locked';
  return 'neutral';
}

export default function TeacherCoursesPage() {
  const { authFetch } = useAuth();
  const [courses, setCourses] = useState<TeacherCourseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch<TeacherCourseSummary[]>('/courses/mine')
      .then((result) => {
        if (!cancelled) setCourses(result);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your courses right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-neutral-900">My Courses</h1>
          <p className="text-sm text-neutral-500">Every course you own, regardless of status.</p>
        </div>
        <Link href="/teacher/courses/new">
          <Button variant="primary">Create Course</Button>
        </Link>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : !courses ? (
        <Spinner label="Loading your courses…" />
      ) : courses.length === 0 ? (
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
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              <tr>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Lectures</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {courses.map((course) => (
                <tr key={course.id}>
                  <td className="max-w-xs px-4 py-3">
                    <p className="truncate font-medium text-neutral-900">{course.title}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {course.board.name} · {course.classGrade.name} · {course.subject.name}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(course.status)}>{course.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{course.enrollmentCount}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {course.publishedLectures}/{course.totalLectures}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/teacher/courses/${course.id}/content`}>
                        <Button variant="ghost" size="sm">
                          Content
                        </Button>
                      </Link>
                      <Link href={`/teacher/courses/${course.id}/edit`}>
                        <Button variant="secondary" size="sm">
                          Edit
                        </Button>
                      </Link>
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
