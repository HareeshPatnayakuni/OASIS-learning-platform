'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { CourseCard } from '@/components/course/CourseCard';
import { Button } from '@/components/ui/Button';
import type { EnrolledCourseSummary } from '@/types/api';

export default function MyCoursesPage() {
  const { authFetch } = useAuth();
  const [courses, setCourses] = useState<EnrolledCourseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch<EnrolledCourseSummary[]>('/enrollments/me')
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
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">My Courses</h1>
      <p className="mb-6 text-sm text-neutral-500">Courses you&apos;re enrolled in, with your progress.</p>

      {error ? (
        <ErrorState message={error} />
      ) : !courses ? (
        <Spinner label="Loading your courses…" />
      ) : courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Once you're enrolled in a course, it'll show up here."
          action={
            <Link href="/courses">
              <Button variant="primary">Browse Courses</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((enrollment) => (
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
  );
}
