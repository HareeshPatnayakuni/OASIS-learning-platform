'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { CourseCard } from './CourseCard';
import type { CourseListItem, EnrolledCourseSummary } from '@/types/api';

/**
 * The Browse Courses page is a Server Component (it has no access to the
 * localStorage-held auth token, so it can't know server-side whether the
 * visitor is a logged-in student — see student/layout.tsx's own comment
 * on this same trade-off). This is the minimal client boundary needed to
 * show "Purchased" instead of a price for courses the student already
 * owns: fetch their own enrollments once, client-side, and cross-reference
 * by course ID. Anonymous visitors and non-students just see the
 * unmodified price grid, exactly as before.
 */
export function CourseGrid({ courses }: { courses: CourseListItem[] }) {
  const { authFetch, isAuthenticated, user } = useAuth();
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'STUDENT') {
      return;
    }
    let cancelled = false;
    authFetch<EnrolledCourseSummary[]>('/enrollments/me')
      .then((result) => {
        if (!cancelled) setPurchasedIds(new Set(result.map((enrollment) => enrollment.course.id)));
      })
      .catch(() => {
        // Silent — worst case, a purchased course briefly still shows its
        // price instead of "Purchased"; the course detail page (which
        // re-checks enrollment itself) remains the source of truth.
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, isAuthenticated, user?.role]);

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} isPurchased={purchasedIds.has(course.id)} />
      ))}
    </div>
  );
}
