'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { Button } from '@/components/ui/Button';

export function Navbar() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const settings = usePlatformSettings();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState('');

  function handleSearchSubmit(event: React.FormEvent): void {
    event.preventDefault();
    const query = searchValue.trim();
    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  }

  async function handleLogout(): Promise<void> {
    await logout();
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote/static logo URL, domain not known at build time */}
          <img
            src={settings?.logoUrl ?? '/brand/oasis-logo-icon-wordmark-light.png'}
            alt={settings?.academyName ?? 'OASIS'}
            className="h-8 w-auto sm:h-9"
          />
        </Link>

        <Link href="/courses" className="hidden shrink-0 text-sm font-medium text-neutral-600 hover:text-brand-600 sm:inline">
          Browse Courses
        </Link>

        <form onSubmit={handleSearchSubmit} className="ml-auto hidden max-w-xs flex-1 md:block">
          <label htmlFor="nav-search" className="sr-only">
            Search
          </label>
          <input
            id="nav-search"
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search courses, chapters…"
            className="w-full rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </form>

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          {isLoading ? null : isAuthenticated ? (
            <>
              <Link
                href={
                  user?.role === 'TEACHER'
                    ? '/teacher/dashboard'
                    : user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
                      ? '/admin/dashboard'
                      : '/student/dashboard'
                }
                className="hidden text-sm font-medium text-neutral-600 hover:text-brand-600 sm:inline"
              >
                Dashboard
              </Link>
              {user?.role === 'STUDENT' ? (
                <>
                  <Link
                    href="/student/payments"
                    className="hidden text-sm font-medium text-neutral-600 hover:text-brand-600 sm:inline"
                  >
                    My Payments
                  </Link>
                  <Link
                    href="/student/devices"
                    className="hidden text-sm font-medium text-neutral-600 hover:text-brand-600 sm:inline"
                  >
                    My Devices
                  </Link>
                  <Link
                    href="/student/profile"
                    className="hidden text-sm font-medium text-neutral-600 hover:text-brand-600 sm:inline"
                  >
                    {user?.fullName.split(' ')[0]}
                  </Link>
                </>
              ) : (
                <span className="hidden text-sm font-medium text-neutral-500 sm:inline">
                  {user?.fullName.split(' ')[0]}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
