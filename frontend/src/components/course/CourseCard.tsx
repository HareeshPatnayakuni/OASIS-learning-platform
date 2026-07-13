import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { CourseListItem } from '@/types/api';

interface CourseCardProps {
  course: CourseListItem;
  /** When provided, renders a progress bar instead of the price — used on
   * "My Courses" for a course the student is already enrolled in. */
  progressPercent?: number;
  href?: string;
}

export function CourseCard({ course, progressPercent, href }: CourseCardProps) {
  const link = href ?? `/courses/${course.slug}`;

  return (
    <Link
      href={link}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-brand-50">
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote R2/CDN URLs, domain not known at build time
          <img
            src={course.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-300">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="brand">{course.board.name}</Badge>
          <Badge tone="neutral">{course.classGrade.name}</Badge>
          <Badge tone="neutral">{course.subject.name}</Badge>
        </div>

        <h3 className="line-clamp-2 font-semibold text-neutral-900">{course.title}</h3>
        <p className="text-sm text-neutral-500">{course.teacher.fullName}</p>

        <div className="mt-auto pt-2">
          {progressPercent !== undefined ? (
            <ProgressBar percent={progressPercent} label="Course progress" />
          ) : (
            <div className="flex items-baseline gap-2">
              {course.discountPrice !== null ? (
                <>
                  <span className="text-lg font-semibold text-neutral-900">
                    ₹{course.discountPrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-sm text-neutral-400 line-through">
                    ₹{course.price.toLocaleString('en-IN')}
                  </span>
                </>
              ) : (
                <span className="text-lg font-semibold text-neutral-900">
                  ₹{course.price.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
