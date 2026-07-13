import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { PlatformAnnouncementsBanner } from "@/components/PlatformAnnouncementsBanner";
import { apiRequest } from "@/lib/api-client";
import type { PlatformSettings } from "@/types/api";

/**
 * Deliberately using a system font stack (configured in globals.css via
 * `--font-sans`/`--font-mono`, see @theme inline below) rather than
 * `next/font/google`. Two reasons, not just "it happened to fail in this
 * sandbox":
 *   1. No build-time (or runtime) dependency on Google's font CDN — one
 *      less external network call, and one less third-party origin serving
 *      content to end users, which is relevant given docs/01's NFR-COMP
 *      notes on being deliberate about third-party data flows for a
 *      platform whose users are largely minors.
 *   2. System fonts render instantly with zero layout shift and no
 *      download at all. If a specific brand typeface is wanted later, it's
 *      a self-hosted `next/font/local` addition — a small, contained change.
 */

const FALLBACK_ACADEMY_NAME = "OASIS";
const FALLBACK_DESCRIPTION = "Learn From Home. Excel Everywhere.";

/**
 * Dynamic per Module 3C's pre-freeze fix (docs/10-module-3c-notes.md) —
 * previously a static `export const metadata` hardcoded "OASIS" here,
 * which meant Platform Settings' academyName/tagline had nowhere to
 * actually reach the page `<title>`. Reads the same public GET /settings
 * the Navbar and Home page now use. A fetch failure (backend briefly
 * down, etc.) falls back to the same static strings this file used
 * before, rather than showing a blank title — this is a resilience
 * fallback, not a reintroduction of hardcoding as the source of truth.
 */
export async function generateMetadata(): Promise<Metadata> {
  let settings: PlatformSettings | null = null;
  try {
    settings = await apiRequest<PlatformSettings>("/settings", { revalidate: 60 });
  } catch {
    // Fall back to static defaults below.
  }

  const academyName = settings?.academyName ?? FALLBACK_ACADEMY_NAME;
  const description = settings?.tagline ?? FALLBACK_DESCRIPTION;

  return {
    title: {
      default: settings?.academyFullName ?? `${academyName} — Online Academy for Smart Integrated Studies`,
      template: `%s | ${academyName}`,
    },
    description,
    ...(settings?.faviconUrl ? { icons: { icon: settings.faviconUrl } } : {}),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <Navbar />
          <PlatformAnnouncementsBanner />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
