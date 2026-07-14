import type { MetadataRoute } from 'next';
import { apiRequest } from '@/lib/api-client';
import type { PlatformSettings } from '@/types/api';

const FALLBACK_ACADEMY_NAME = 'OASIS';
const FALLBACK_FULL_NAME = 'Online Academy for Smart Integrated Studies';
const BRAND_NAVY = '#0B1D3A';

/**
 * Module 3D — didn't exist before this module. Name/short_name are
 * dynamic (same public GET /settings as the Navbar/page metadata), never
 * hardcoded. `icons` points at the real icon files mechanically extracted
 * from the official Branding Package (see docs/11-module-3d-notes.md for
 * the extraction method — precise pixel-boundary detection, not a
 * redrawn/recolored approximation) rather than the pre-existing generic
 * Next.js favicon this pointed at before.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let settings: PlatformSettings | null = null;
  try {
    settings = await apiRequest<PlatformSettings>('/settings', { revalidate: 60 });
  } catch {
    // Fall back to static defaults below.
  }

  const academyName = settings?.academyName ?? FALLBACK_ACADEMY_NAME;
  const fullName = settings?.academyFullName ?? FALLBACK_FULL_NAME;

  return {
    name: fullName,
    short_name: academyName,
    description: settings?.tagline ?? 'Learn from Home. Excel Everywhere.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: BRAND_NAVY,
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
