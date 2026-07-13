'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { PlatformSettings } from '@/types/api';

/**
 * Fetches the public GET /settings endpoint (Module 3C pre-freeze fix —
 * see docs/10-module-3c-notes.md) — the one place academy name/tagline/
 * logo/favicon/contact info should come from, instead of being hardcoded
 * per-component. Returns `null` while loading or if the fetch fails;
 * every caller is expected to fall back to a sensible static default in
 * that case (e.g. "OASIS") rather than showing nothing, so a slow or
 * briefly-down backend never blanks out the page chrome.
 */
export function usePlatformSettings(): PlatformSettings | null {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<PlatformSettings>('/settings')
      .then((result) => {
        if (!cancelled) setSettings(result);
      })
      .catch(() => {
        // Swallow — callers fall back to a static default.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
