'use client';

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest, apiRequestPaginated, ApiClientError, type PaginatedResponse } from '@/lib/api-client';
import { clearStoredTokens, getDeviceId, getStoredTokens, setStoredTokens } from '@/lib/auth-storage';
import type { LoginResult, PublicUser } from '@/types/api';

/**
 * The frontend's session layer. Per docs/02-architecture.md §10, this file
 * still does no business logic of its own — it calls the real
 * /auth/login, /auth/register, /auth/refresh, /auth/logout endpoints and
 * persists whatever they return. The one deliberate UX choice made here
 * (not a business rule): after a successful registration, we immediately
 * call the real login endpoint with the same credentials rather than
 * bouncing the user back to a login form — registration itself still
 * never issues tokens server-side (docs/07-module-2-notes.md), this just
 * chains two real, fully-verified calls together.
 */

interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  classGradeId?: string;
  boardId?: string;
}

interface AuthFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

interface AuthContextValue {
  user: PublicUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Authenticated fetch for a single-object `{ data }` response, with one
   * automatic refresh-and-retry on a 401. */
  authFetch: <T>(path: string, options?: AuthFetchOptions) => Promise<T>;
  /** Same, for a paginated `{ data: [...], meta }` response. */
  authFetchPaginated: <T>(path: string, options?: AuthFetchOptions) => Promise<PaginatedResponse<T>>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    clearStoredTokens();
    setUser(null);
    setAccessToken(null);
  }, []);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const { refreshToken } = getStoredTokens();
    if (!refreshToken) return null;
    try {
      const tokens = await apiRequest<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken, deviceId: getDeviceId() },
      });
      setStoredTokens(tokens);
      setAccessToken(tokens.accessToken);
      return tokens.accessToken;
    } catch {
      clearSession();
      return null;
    }
  }, [clearSession]);

  // On mount: if a session exists in storage, validate it and load the
  // profile. A stale/expired access token is refreshed once; if that also
  // fails, the stored session is discarded — same as never having logged in.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession(): Promise<void> {
      const { accessToken: storedAccessToken } = getStoredTokens();
      if (!storedAccessToken) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await apiRequest<PublicUser>('/users/me', { accessToken: storedAccessToken });
        if (cancelled) return;
        setAccessToken(storedAccessToken);
        setUser(profile);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          const refreshed = await refreshSession();
          if (refreshed && !cancelled) {
            const profile = await apiRequest<PublicUser>('/users/me', { accessToken: refreshed });
            if (!cancelled) setUser(profile);
          }
        } else {
          clearSession();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const result = await apiRequest<LoginResult>('/auth/login', {
      method: 'POST',
      body: { email, password, deviceId: getDeviceId() },
    });
    setStoredTokens(result.tokens);
    setAccessToken(result.tokens.accessToken);
    setUser(result.user);
  }, []);

  const register = useCallback(
    async (input: RegisterInput): Promise<void> => {
      await apiRequest('/auth/register', { method: 'POST', body: input });
      await login(input.email, input.password);
    },
    [login],
  );

  const logout = useCallback(async (): Promise<void> => {
    const { refreshToken } = getStoredTokens();
    if (refreshToken) {
      try {
        await apiRequest('/auth/logout', { method: 'POST', body: { refreshToken } });
      } catch {
        // Best-effort — the session is cleared client-side regardless.
      }
    }
    clearSession();
  }, [clearSession]);

  const authFetch = useCallback(
    async <T,>(path: string, options: AuthFetchOptions = {}): Promise<T> => {
      try {
        return await apiRequest<T>(path, { ...options, accessToken: accessToken ?? undefined });
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          const refreshed = await refreshSession();
          if (refreshed) {
            return apiRequest<T>(path, { ...options, accessToken: refreshed });
          }
        }
        throw err;
      }
    },
    [accessToken, refreshSession],
  );

  const authFetchPaginated = useCallback(
    async <T,>(path: string, options: AuthFetchOptions = {}): Promise<PaginatedResponse<T>> => {
      try {
        return await apiRequestPaginated<T>(path, { ...options, accessToken: accessToken ?? undefined });
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          const refreshed = await refreshSession();
          if (refreshed) {
            return apiRequestPaginated<T>(path, { ...options, accessToken: refreshed });
          }
        }
        throw err;
      }
    },
    [accessToken, refreshSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      register,
      logout,
      authFetch,
      authFetchPaginated,
    }),
    [user, isLoading, login, register, logout, authFetch, authFetchPaginated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
