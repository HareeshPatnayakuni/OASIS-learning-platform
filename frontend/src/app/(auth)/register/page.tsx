/** See src/app/(auth)/login/page.tsx for the placeholder rationale. */
export default function RegisterPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
        Create your account
      </h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Coming soon — wired to{' '}
        <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-800">
          POST /api/v1/auth/register
        </code>
        .
      </p>
    </main>
  );
}
