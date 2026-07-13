'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Loading';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/teachers', label: 'Teachers' },
  { href: '/admin/students', label: 'Students' },
  { href: '/admin/courses', label: 'Courses' },
  { href: '/admin/announcements', label: 'Announcements' },
  { href: '/admin/settings', label: 'Settings' },
];

/**
 * Mirrors student/layout.tsx and teacher/layout.tsx's guard pattern
 * exactly (Modules 3A/3B) — same caveat: a UX convenience, not a
 * security boundary. The backend independently enforces
 * `requireRole('ADMIN', 'SUPER_ADMIN')` on every admin-scoped endpoint.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Spinner label="Loading admin dashboard…" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <p className="text-neutral-600">This area is only available to admin accounts.</p>
      </main>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-neutral-200 pb-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              pathname === item.href ? 'bg-brand-50 text-brand-700' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
