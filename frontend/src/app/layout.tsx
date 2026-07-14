import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { PlatformAnnouncementsBanner } from "@/components/PlatformAnnouncementsBanner";
import { Footer } from "@/components/Footer";
import { apiRequest } from "@/lib/api-client";
import type { PlatformSettings } from "@/types/api";

/**
 * Typography: self-hosted Poppins (headings) + Inter (body) via
 * @fontsource, imported in globals.css — official per the OASIS Branding
 * Package (Module 3D, docs/11-module-3d-notes.md). `next/font/google` was
 * tried first and hard-fails in this sandbox (403 fetching
 * fonts.googleapis.com — no network path to Google's font CDN here);
 * @fontsource sidesteps this by shipping the actual font files as npm
 * package assets, which is also a strictly better fit for this project's
 * original reasoning against `next/font/google` (avoiding any
 * third-party origin serving content to end users) — @fontsource is
 * genuinely self-hosted, not merely build-time-cached from one.
 */

const FALLBACK_ACADEMY_NAME = "OASIS";
const FALLBACK_FULL_NAME = "Online Academy for Smart Integrated Studies";
const FALLBACK_TAGLINE = "Learn from Home. Excel Everywhere.";
const BRAND_NAVY = "#0B1D3A";

/**
 * Dynamic per Module 3C's pre-freeze fix (docs/10-module-3c-notes.md) —
 * previously a static `export const metadata` hardcoded "OASIS" here,
 * which meant Platform Settings' academyName/tagline had nowhere to
 * actually reach the page `<title>`. Reads the same public GET /settings
 * the Navbar and Home page use. A fetch failure (backend briefly down,
 * etc.) falls back to the same static strings this file used before,
 * rather than showing a blank title — a resilience fallback, not a
 * reintroduction of hardcoding as the source of truth. Module 3D adds
 * Open Graph/Twitter Card metadata on top, using the same settings and
 * the same fallback discipline.
 */
export async function generateMetadata(): Promise<Metadata> {
  let settings: PlatformSettings | null = null;
  try {
    settings = await apiRequest<PlatformSettings>("/settings", { revalidate: 60 });
  } catch {
    // Fall back to static defaults below.
  }

  const academyName = settings?.academyName ?? FALLBACK_ACADEMY_NAME;
  const fullName = settings?.academyFullName ?? FALLBACK_FULL_NAME;
  const description = settings?.tagline ?? FALLBACK_TAGLINE;
  const title = { default: fullName, template: `%s | ${academyName}` };

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title,
    description,
    icons: {
      icon: settings?.faviconUrl ?? '/favicon.ico',
      apple: '/brand/apple-touch-icon.png',
    },
    openGraph: {
      title: fullName,
      description,
      siteName: academyName,
      type: "website",
      ...(settings?.logoUrl ? { images: [{ url: settings.logoUrl }] } : { images: [{ url: '/brand/oasis-logo-full-light.png' }] }),
    },
    twitter: {
      card: "summary",
      title: fullName,
      description,
      ...(settings?.logoUrl ? { images: [settings.logoUrl] } : { images: ['/brand/oasis-logo-full-light.png'] }),
    },
  };
}

export const viewport: Viewport = {
  themeColor: BRAND_NAVY,
};

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
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
