'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CourseSyllabus } from '@/components/course/CourseSyllabus';
import { ApiClientError } from '@/lib/api-client';
import { loadRazorpayCheckoutScript, type RazorpaySuccessResponse } from '@/lib/razorpay';
import type { CourseDetail, PurchaseResult, VerifyPaymentResult } from '@/types/api';

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

            <EnrollmentCta
              course={course}
              isAuthenticated={isAuthenticated}
              isStudent={user?.role === 'STUDENT'}
              authFetch={authFetch}
              onEnrolled={() => setCourse((prev) => ({ ...prev, isEnrolled: true }))}
            />
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
  authFetch,
  onEnrolled,
}: {
  course: CourseDetail;
  isAuthenticated: boolean;
  isStudent: boolean;
  authFetch: <T>(path: string, options?: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; body?: unknown }) => Promise<T>;
  onEnrolled: () => void;
}) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'error' | 'cancelled'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const effectivePrice = course.discountPrice ?? course.price;
  const isFree = effectivePrice <= 0;

  async function verifyAndEnroll(response: RazorpaySuccessResponse): Promise<void> {
    try {
      await authFetch<VerifyPaymentResult>('/payments/verify', {
        method: 'POST',
        body: {
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        },
      });
      setStatus('idle');
      onEnrolled();
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Payment verification failed. If an amount was deducted, please contact support.',
      );
    }
  }

  async function handlePurchase(): Promise<void> {
    setStatus('processing');
    setErrorMessage(null);
    try {
      const result = await authFetch<PurchaseResult>(`/courses/${course.id}/purchase`, { method: 'POST' });

      if (result.type === 'ALREADY_ENROLLED' || result.type === 'ENROLLED') {
        setStatus('idle');
        onEnrolled();
        return;
      }

      // CHECKOUT_REQUIRED — open Razorpay Checkout with the order the
      // backend just created. Never trust anything this modal reports
      // as "success" on its own; verifyAndEnroll re-checks with the
      // backend before the student gets access.
      await loadRazorpayCheckoutScript();
      if (!window.Razorpay) {
        throw new Error('Could not load the payment window. Please check your connection and try again.');
      }

      const checkout = new window.Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency,
        order_id: result.razorpayOrderId,
        name: 'OASIS',
        description: course.title,
        theme: { color: '#1E5BFF' },
        handler: (response) => {
          setStatus('processing');
          void verifyAndEnroll(response);
        },
        modal: {
          ondismiss: () => setStatus('cancelled'),
        },
      });

      checkout.on('payment.failed', (failure) => {
        setStatus('error');
        setErrorMessage(failure.error?.description ?? 'Payment failed. Please try again.');
      });

      checkout.open();
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof ApiClientError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <>
      {priceDisplay}
      {status === 'error' && errorMessage ? (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
      ) : null}
      {status === 'cancelled' ? (
        <p className="mb-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-600">
          Checkout was cancelled — you haven&apos;t been charged. You can try again anytime.
        </p>
      ) : null}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={status === 'processing'}
        onClick={() => void handlePurchase()}
      >
        {status === 'processing' ? 'Processing…' : isFree ? 'Enroll for free' : 'Buy Now'}
      </Button>
    </>
  );
}
