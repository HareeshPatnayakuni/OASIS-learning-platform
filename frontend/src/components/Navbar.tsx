'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';

export function Navbar() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
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
        <Link href="/" className="shrink-0 text-lg font-bold tracking-tight text-brand-700">
          OASIS
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
                href="/student/dashboard"
                className="hidden text-sm font-medium text-neutral-600 hover:text-brand-600 sm:inline"
              >
                Dashboard
              </Link>
              <Link
                href="/student/profile"
                className="hidden text-sm font-medium text-neutral-600 hover:text-brand-600 sm:inline"
              >
                {user?.fullName.split(' ')[0]}
              </Link>
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
