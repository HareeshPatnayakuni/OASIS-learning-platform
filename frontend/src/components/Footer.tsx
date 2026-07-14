'use client';

import Link from 'next/link';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

const FALLBACK_ACADEMY_NAME = 'OASIS';
const FALLBACK_TAGLINE = 'Learn from Home. Excel Everywhere.';

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
};

/**
 * Module 3D — mounted once in the root layout, below the page content,
 * mirroring how PlatformAnnouncementsBanner (Module 3C) mounts once above
 * it. Every value here is read from the public GET /settings endpoint,
 * never hardcoded — academy name/tagline/contact email/social links all
 * come from whatever Admin has configured in Platform Settings. Falls
 * back to the same static defaults used elsewhere (Navbar, page
 * metadata) only if the fetch fails.
 */
export function Footer() {
  const settings = usePlatformSettings();
  const academyName = settings?.academyName ?? FALLBACK_ACADEMY_NAME;
  const tagline = settings?.tagline ?? FALLBACK_TAGLINE;
  const socialLinks = settings?.socialLinks ?? null;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 bg-brand-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- remote/static logo URL, domain not known at build time */}
          <img
            src={settings?.logoUrl ?? '/brand/oasis-logo-icon-wordmark-dark.png'}
            alt={academyName}
            className="mb-1 h-7 w-auto"
          />
          <p className="text-sm text-white/70">{tagline}</p>
        </div>

        <div className="flex flex-col gap-2 text-sm text-white/70 sm:items-end">
          {settings?.contactEmail ? (
            <a href={`mailto:${settings.contactEmail}`} className="hover:text-white hover:underline">
              {settings.contactEmail}
            </a>
          ) : null}
          {settings?.contactPhone ? <p>{settings.contactPhone}</p> : null}
          {socialLinks && Object.keys(socialLinks).length > 0 ? (
            <div className="flex gap-3">
              {Object.entries(socialLinks).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white hover:underline"
                >
                  {SOCIAL_LABELS[platform.toLowerCase()] ?? platform}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-3 text-center text-xs text-white/50 sm:px-6">
        © {year} {academyName}. All rights reserved.{' '}
        <Link href="/" className="hover:text-white hover:underline">
          {academyName}
        </Link>
      </div>
    </footer>
  );
}
