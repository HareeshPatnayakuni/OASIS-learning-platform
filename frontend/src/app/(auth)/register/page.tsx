'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { Button } from '@/components/ui/Button';
import { apiRequest, ApiClientError } from '@/lib/api-client';
import type { CatalogRef, ClassGrade } from '@/types/api';

export default function RegisterPage() {
  const { register } = useAuth();
  const settings = usePlatformSettings();
  const academyName = settings?.academyName ?? 'OASIS';
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [classGradeId, setClassGradeId] = useState('');
  const [boardId, setBoardId] = useState('');
  const [boards, setBoards] = useState<CatalogRef[]>([]);
  const [classGrades, setClassGrades] = useState<ClassGrade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Public catalog reads — no auth needed, and a failure here shouldn't
    // block registration itself (the fields are optional), so errors are
    // swallowed rather than surfaced as a blocking page error.
    apiRequest<CatalogRef[]>('/boards').then(setBoards).catch(() => undefined);
    apiRequest<ClassGrade[]>('/class-grades').then(setClassGrades).catch(() => undefined);
  }, []);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register({
        fullName,
        email,
        password,
        classGradeId: classGradeId || undefined,
        boardId: boardId || undefined,
      });
      router.push('/student/dashboard');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.details ? formatDetails(err) : err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatDetails(err: ApiClientError): string {
    if (Array.isArray(err.details)) {
      const messages = (err.details as Array<{ message?: string }>)
        .map((d) => d.message)
        .filter(Boolean);
      if (messages.length > 0) return messages.join(' ');
    }
    return err.message;
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote/static logo URL, domain not known at build time */}
          <img
            src={settings?.logoUrl ?? '/brand/oasis-logo-icon-wordmark-light.png'}
            alt={academyName}
            className="h-10 w-auto"
          />
        </Link>
        <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Create your account</h1>
        <p className="mb-6 text-sm text-neutral-500">Start learning with {academyName} today.</p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-neutral-700">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-neutral-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-neutral-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-neutral-400">At least 8 characters, with a letter and a number.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="board" className="mb-1 block text-sm font-medium text-neutral-700">
                Board <span className="text-neutral-400">(optional)</span>
              </label>
              <select
                id="board"
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">—</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="classGrade" className="mb-1 block text-sm font-medium text-neutral-700">
                Class <span className="text-neutral-400">(optional)</span>
              </label>
              <select
                id="classGrade"
                value={classGradeId}
                onChange={(e) => setClassGradeId(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">—</option>
                {classGrades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
