'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p className="text-sm font-medium text-red-600 uppercase">Something went wrong</p>
      <h1 className="text-2xl font-semibold text-neutral-900">We couldn&apos;t load this page</h1>
      <p className="max-w-sm text-neutral-500">
        This is usually temporary. Try again, or come back in a moment.
      </p>
      <Button variant="primary" onClick={() => reset()}>
        Try again
      </Button>
    </main>
  );
}
