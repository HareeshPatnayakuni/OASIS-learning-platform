/**
 * The frontend's single point of contact with the backend REST API.
 *
 * Per docs/02-architecture.md §10 (Architectural Invariant: All Business
 * Logic Lives in the Backend), this file does exactly one thing: make HTTP
 * calls and parse responses/errors into a consistent shape. It never
 * decides whether a user is entitled to something, never validates business
 * rules, and never talks to Postgres/R2/Razorpay directly — all of that
 * stays server-side, reachable only through this client.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = 'ApiClientError';
    this.code = body.error.code;
    this.status = status;
    this.details = body.error.details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  accessToken?: string;
  signal?: AbortSignal;
  /** Next.js server-side fetch cache lifetime in seconds, for data that
   * changes occasionally and shouldn't be baked in at build time (e.g.
   * Platform Settings — see docs/10-module-3c-notes.md). Omitted by
   * every existing caller, which keeps Next's default fetch caching
   * behavior exactly as it was. */
  revalidate?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

/**
 * Every response the backend sends follows one of two shapes (per
 * docs/04-api-design.md §1): `{ data: ... }` on success, or
 * `{ error: { code, message, details? } }` on failure. This function
 * normalizes both into either a resolved value or a thrown ApiClientError,
 * so callers never need to check `response.ok` themselves.
 */
export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const json = await apiRequestEnvelope<{ data: TResponse }>(path, options);
  return json.data;
}

/** For paginated list endpoints, which return `{ data: [...], meta: {...} }`
 * — callers need `meta` too, not just the array. */
export async function apiRequestPaginated<TItem>(
  path: string,
  options: RequestOptions = {},
): Promise<PaginatedResponse<TItem>> {
  return apiRequestEnvelope<PaginatedResponse<TItem>>(path, options);
}

async function apiRequestEnvelope<TEnvelope>(
  path: string,
  options: RequestOptions,
): Promise<TEnvelope> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    ...(options.revalidate !== undefined ? { next: { revalidate: options.revalidate } } : {}),
  });

  if (response.status === 204) {
    return undefined as TEnvelope;
  }

  const json: unknown = await response.json();

  if (!response.ok) {
    throw new ApiClientError(response.status, json as ApiErrorBody);
  }

  return json as TEnvelope;
}
