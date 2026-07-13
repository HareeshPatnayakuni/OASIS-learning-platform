'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';

/**
 * Mirrors student/layout.tsx's guard pattern exactly (Module 3A) — same
 * caveat applies: this is a UX convenience, not a security boundary. The
 * backend independently enforces `requireRole('TEACHER')` on every
 * teacher-scoped endpoint regardless of what this layout does.
 */
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Spinner label="Loading your dashboard…" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (user && user.role !== 'TEACHER') {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <p className="text-neutral-600">This area is only available to teacher accounts.</p>
      </main>
    );
  }

  return <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</div>;
}
