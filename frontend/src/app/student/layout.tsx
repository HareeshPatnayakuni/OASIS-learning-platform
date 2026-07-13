'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';

/**
 * Every page under student/ requires a logged-in STUDENT. This is a
 * client-side guard (session lives in localStorage, not a cookie a Server
 * Component could read — see docs/09-module-3a-notes.md for why that
 * trade-off was made). It's still not a security boundary by itself: the
 * backend independently enforces `requireRole('STUDENT')` on every
 * student-scoped endpoint regardless of what this layout does — this guard
 * only exists for UX (don't show a broken dashboard; redirect cleanly).
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
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
    return null; // redirect effect above is already in flight
  }

  if (user && user.role !== 'STUDENT') {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <p className="text-neutral-600">This area is only available to student accounts.</p>
      </main>
    );
  }

  return <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</div>;
}
