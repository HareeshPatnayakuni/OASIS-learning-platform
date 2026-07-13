import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p className="text-sm font-medium text-brand-600 uppercase">404</p>
      <h1 className="text-2xl font-semibold text-neutral-900">Page not found</h1>
      <p className="max-w-sm text-neutral-500">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link href="/">
        <Button variant="primary">Back to home</Button>
      </Link>
    </main>
  );
}
