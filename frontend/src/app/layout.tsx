import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { PlatformAnnouncementsBanner } from "@/components/PlatformAnnouncementsBanner";
import { Footer } from "@/components/Footer";
import { apiRequest } from "@/lib/api-client";
import type { PlatformSettings } from "@/types/api";

/**
 * Typography: self-hosted Poppins (headings) + Inter (body) — official
 * per the OASIS Branding Package (Module 3D, docs/11-module-3d-notes.md).
 *
 * `next/font/google` was tried first and hard-fails in this sandbox (403
 * fetching fonts.googleapis.com — no network path to Google's font CDN
 * here). `@fontsource`'s plain-CSS `@import` approach was tried second
 * (importing e.g. "@fontsource/poppins/400.css" directly in globals.css)
 * and hard-fails under Next.js 16 + Turbopack specifically: Turbopack's
 * CSS parser doesn't resolve `@import` statements pointing at deep
 * node_modules subpaths the same way Webpack did — a genuine, current
 * Turbopack compatibility gap (confirmed via web search: Turbopack has
 * several open, tracked issues with exactly this class of import, e.g.
 * vercel/next.js#72761), not something wrong with `@fontsource`'s files
 * themselves.
 *
 * Fix: `next/font/local`, Next's own built-in self-hosted-font loader,
 * pointed directly at the real `.woff2` files already shipped inside the
 * already-installed `@fontsource/poppins`/`@fontsource/inter` packages —
 * same actual font files, same "genuinely self-hosted, not merely
 * build-time-cached" property that ruled out `next/font/google`, just
 * loaded through Next's native font pipeline instead of a raw CSS
 * `@import` that Turbopack doesn't handle. `next/font/local` also
 * self-hosts by design (that's its whole purpose), so this doesn't
 * reintroduce any external-CDN dependency.
 */
const poppins = localFont({
  src: [
    { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

const inter = localFont({
  src: [
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

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
    <html lang="en" className={`h-full antialiased ${poppins.variable} ${inter.variable}`}>
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
