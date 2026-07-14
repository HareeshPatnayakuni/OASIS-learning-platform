'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { apiRequest } from '@/lib/api-client';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

export default function ForgotPasswordPage() {
  const settings = usePlatformSettings();
  const academyName = settings?.academyName ?? 'OASIS';
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await apiRequest<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: { email },
      });
      // The backend always returns the same generic message regardless of
      // whether the email exists (no user enumeration — docs/07 §2) — the
      // frontend just displays exactly what it's given, nothing more.
      setMessage(result.message);
    } catch {
      // Even a network/validation error shouldn't reveal anything more
      // specific than the backend's own generic response would.
      setMessage('If an account exists for this email, a reset link has been sent.');
    } finally {
      setIsSubmitting(false);
    }
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
        <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Reset your password</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>

        {message ? (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</p>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
            <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-neutral-500">
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}
