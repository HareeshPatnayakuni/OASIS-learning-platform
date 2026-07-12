/**
 * Login — real form + API wiring lands in Module 5/6 (Teacher/Student
 * dashboards) per docs/05-roadmap-and-milestones.md. This placeholder
 * exists so the (auth) route group's structure is real and buildable from
 * Module 2 onward, per the frozen folder structure in
 * docs/02-architecture.md §3.
 */
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Log in</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Coming soon — wired to <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-800">POST /api/v1/auth/login</code>.
      </p>
    </main>
  );
}
