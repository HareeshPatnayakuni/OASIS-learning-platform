'use client';

/**
 * Session persistence mechanics only — no business logic. The backend's
 * login/refresh endpoints require a stable, client-generated `deviceId`
 * (docs/02-architecture.md §6.2, the 2-device login limit); this is where
 * that ID is generated once and persisted, and where the token pair lives
 * between page loads.
 *
 * Deliberately localStorage, not cookies — per docs/02-architecture.md §3,
 * OASIS's API is JWT-in-headers only, no cookie-based auth, so a future
 * mobile app can use the exact same endpoints.
 */

const ACCESS_TOKEN_KEY = 'oasis.accessToken';
const REFRESH_TOKEN_KEY = 'oasis.refreshToken';
const DEVICE_ID_KEY = 'oasis.deviceId';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function getDeviceId(): string {
  if (!isBrowser()) return '';
  let deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function getStoredTokens(): { accessToken: string | null; refreshToken: string | null } {
  if (!isBrowser()) return { accessToken: null, refreshToken: null };
  return {
    accessToken: window.localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: window.localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

export function setStoredTokens(tokens: { accessToken: string; refreshToken: string }): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearStoredTokens(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}
