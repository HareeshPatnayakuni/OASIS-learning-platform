/**
 * Home — the first of the (public) route group's pages
 * (docs/02-architecture.md §3: About, Courses, Course Details, Teacher
 * Profiles, Testimonials, FAQs, Contact all land here in later modules —
 * see docs/05-roadmap-and-milestones.md Module 6 "Student Experience" and
 * Module 8 "Testimonials, Enquiries, Settings").
 *
 * This is intentionally a placeholder: Module 2's scope is frontend project
 * *initialization* (routing structure, tooling, Tailwind), not the landing
 * page design itself. Academy name/tagline are fetched from the public
 * GET /settings endpoint (Module 3C) rather than hardcoded, same pattern
 * as the Browse Courses page's server-side fetch — even a placeholder
 * shouldn't show a hardcoded name that could drift from what Admin
 * actually configured in Platform Settings.
 */
import { apiRequest } from '@/lib/api-client';
import type { PlatformSettings } from '@/types/api';

const FALLBACK_ACADEMY_NAME = 'OASIS';
const FALLBACK_TAGLINE = 'Learn From Home. Excel Everywhere.';

export default async function HomePage() {
  let settings: PlatformSettings | null = null;
  try {
    settings = await apiRequest<PlatformSettings>('/settings', { revalidate: 60 });
  } catch {
    // Fall back to static defaults below.
  }

  const academyName = settings?.academyName ?? FALLBACK_ACADEMY_NAME;
  const tagline = settings?.tagline ?? FALLBACK_TAGLINE;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-sm font-medium tracking-wide text-blue-600 uppercase">{tagline}</p>
      <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl dark:text-neutral-50">
        {academyName}
      </h1>
      <p className="max-w-xl text-neutral-600 dark:text-neutral-400">
        {settings?.academyFullName ?? 'Online Academy for Smart Integrated Studies'}. This landing page is a
        Module 2 placeholder — the real Home page design (Hero, Why {academyName},
        Course Categories, Faculty, Testimonials, FAQs) lands in Module 6 per
        the project roadmap.
      </p>
    </main>
  );
}
