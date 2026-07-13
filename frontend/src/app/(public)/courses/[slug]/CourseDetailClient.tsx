'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CourseSyllabus } from '@/components/course/CourseSyllabus';
import type { CourseDetail } from '@/types/api';

export function CourseDetailClient({ initialCourse }: { initialCourse: CourseDetail }) {
  const { isAuthenticated, user, authFetch } = useAuth();
  const [course, setCourse] = useState(initialCourse);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'STUDENT') return;
    let cancelled = false;
    // Re-fetch with the auth token so isEnrolled/progress are personalized
    // — the server-rendered initialCourse is intentionally the anonymous,
    // SEO-friendly view (FR-SEO-1); this is what upgrades it client-side.
    authFetch<CourseDetail>(`/courses/${initialCourse.slug}`)
      .then((personalized) => {
        if (!cancelled) setCourse(personalized);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, authFetch, initialCourse.slug]);

  const totalLectures = course.chapters.reduce(
    (sum, chapter) => sum + chapter.modules.reduce((s, m) => s + m.lectures.length, 0),
    0,
  );

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Badge tone="brand">{course.board.name}</Badge>
            <Badge tone="neutral">{course.classGrade.name}</Badge>
            <Badge tone="neutral">{course.subject.name}</Badge>
          </div>

          <h1 className="mb-2 text-2xl font-semibold text-neutral-900 sm:text-3xl">{course.title}</h1>
          <p className="mb-1 text-sm text-neutral-500">
            Taught by <span className="font-medium text-neutral-700">{course.teacher.fullName}</span>
          </p>
          <p className="mb-6 text-sm text-neutral-500">
            {course.chapters.length} chapter{course.chapters.length === 1 ? '' : 's'} · {totalLectures}{' '}
            lecture{totalLectures === 1 ? '' : 's'}
          </p>

          <p className="mb-8 text-neutral-700">{course.description}</p>

          <h2 className="mb-3 text-lg font-semibold text-neutral-900">Syllabus</h2>
          <CourseSyllabus chapters={course.chapters} isEnrolled={course.isEnrolled} />
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-20 rounded-xl border border-neutral-200 bg-white p-5">
            {course.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.thumbnailUrl} alt="" className="mb-4 aspect-video w-full rounded-lg object-cover" />
            ) : null}

            <EnrollmentCta course={course} isAuthenticated={isAuthenticated} isStudent={user?.role === 'STUDENT'} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function EnrollmentCta({
  course,
  isAuthenticated,
  isStudent,
}: {
  course: CourseDetail;
  isAuthenticated: boolean;
  isStudent: boolean;
}) {
  if (course.isEnrolled) {
    return (
      <Link href={`/student/courses/${course.slug}/learn`}>
        <Button variant="primary" size="lg" className="w-full">
          Continue Learning
        </Button>
      </Link>
    );
  }

  const priceDisplay = (
    <div className="mb-4 flex items-baseline gap-2">
      {course.discountPrice !== null ? (
        <>
          <span className="text-2xl font-semibold text-neutral-900">
            ₹{course.discountPrice.toLocaleString('en-IN')}
          </span>
          <span className="text-base text-neutral-400 line-through">
            ₹{course.price.toLocaleString('en-IN')}
          </span>
        </>
      ) : (
        <span className="text-2xl font-semibold text-neutral-900">₹{course.price.toLocaleString('en-IN')}</span>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <>
        {priceDisplay}
        <Link href="/login">
          <Button variant="primary" size="lg" className="w-full">
            Log in to enroll
          </Button>
        </Link>
      </>
    );
  }

  if (!isStudent) {
    return priceDisplay;
  }

  return (
    <>
      {priceDisplay}
      {/* Payments module isn't built yet (PROJECT_MEMORY.md §8) — this is
          deliberately disabled and honest about that, rather than a
          checkout button that leads nowhere. */}
      <Button variant="secondary" size="lg" className="w-full" disabled title="Checkout is coming soon">
        Enrollment coming soon
      </Button>
    </>
  );
}
