'use client';

import { useEffect, useState } from 'react';
import { apiRequestPaginated } from '@/lib/api-client';
import type { AdminAnnouncementSummary } from '@/types/api';

const DISMISSED_KEY_PREFIX = 'oasis.dismissedAnnouncement.';

/**
 * The one display surface for Admin's platform-wide announcements
 * (Module 3C) — "these announcements appear to every user" is satisfied
 * by mounting this once in the root layout (below the Navbar) rather than
 * duplicating it across every dashboard, so it shows for logged-out
 * visitors too, not just students/teachers. Fetches the single most
 * recent platform announcement via the public GET /announcements/platform
 * — no auth required, matching that endpoint's design. Dismissal is
 * per-browser (localStorage-equivalent via sessionStorage isn't used here
 * since this is a real page, not an artifact — plain localStorage is fine
 * in a Next.js app) and per-announcement, so a new announcement always
 * reappears even if an old one was dismissed.
 */
export function PlatformAnnouncementsBanner() {
  const [announcement, setAnnouncement] = useState<AdminAnnouncementSummary | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequestPaginated<AdminAnnouncementSummary>('/announcements/platform?limit=1')
      .then(({ data }) => {
        if (cancelled) return;
        const latest = data[0] ?? null;
        setAnnouncement(latest);
        if (latest && typeof window !== 'undefined') {
          setDismissed(window.localStorage.getItem(`${DISMISSED_KEY_PREFIX}${latest.id}`) === '1');
        }
      })
      .catch(() => {
        // A failure here shouldn't be visible to the user — it's a
        // "nice to have" banner, not a page they came for.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement || dismissed) return null;

  function handleDismiss(): void {
    if (!announcement) return;
    window.localStorage.setItem(`${DISMISSED_KEY_PREFIX}${announcement.id}`, '1');
    setDismissed(true);
  }

  return (
    <div className="border-b border-accent-500/30 bg-accent-400/10 px-4 py-2 text-sm text-brand-900">
      <div className="mx-auto flex max-w-6xl items-center gap-3 sm:px-2">
        <span className="font-medium">{announcement.title}:</span>
        <span className="flex-1 truncate">{announcement.body}</span>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss announcement"
          className="shrink-0 rounded px-1 text-brand-700 hover:bg-brand-900/10"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
