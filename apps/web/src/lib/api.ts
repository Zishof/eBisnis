/**
 * Klien API eBisnis.id.
 *
 * Strategi token (didokumentasikan pada docs/architecture/ADR-006-token-strategy.md):
 *   - access token disimpan di memory saja;
 *   - refresh token disimpan di sessionStorage, TIDAK di localStorage,
 *     dan dirotasi setiap kali dipakai;
 *   - reuse refresh token mencabut seluruh family di sisi server.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const REFRESH_STORAGE_KEY = 'ebisnis.refresh';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: PageMeta;
  requestId?: string;
  error?: { code: string; message: string; params?: Record<string, unknown>; details?: unknown };
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly params: Record<string, unknown> = {},
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
let currentLocale = 'id';
const listeners = new Set<(token: string | null) => void>();

export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const listener of listeners) listener(token);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function onAuthChange(listener: (token: string | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setRefreshToken(token: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  if (token) sessionStorage.setItem(REFRESH_STORAGE_KEY, token);
  else sessionStorage.removeItem(REFRESH_STORAGE_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(REFRESH_STORAGE_KEY);
}

export function setApiLocale(locale: string): void {
  currentLocale = locale;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Lewati refresh otomatis (dipakai endpoint auth). */
  skipRefresh?: boolean;
  signal?: AbortSignal;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  // Hindari beberapa refresh bersamaan — token rotation menolak pemakaian ganda.
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        setAccessToken(null);
        setRefreshToken(null);
        return false;
      }
      const payload = (await response.json()) as ApiEnvelope<{
        accessToken: string;
        refreshToken: string;
      }>;
      setAccessToken(payload.data.accessToken);
      setRefreshToken(payload.data.refreshToken);
      return true;
    } catch {
      setAccessToken(null);
      setRefreshToken(null);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const execute = async (): Promise<Response> =>
    fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': currentLocale,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });

  let response = await execute();

  if (response.status === 401 && !options.skipRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await execute();
  }

  const text = await response.text();
  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = text ? (JSON.parse(text) as ApiEnvelope<T>) : null;
  } catch {
    if (!response.ok) {
      throw new ApiError('INTERNAL_ERROR', text.slice(0, 200) || 'Terjadi kesalahan.', response.status);
    }
    return text as unknown as T;
  }

  if (!response.ok || payload?.success === false) {
    const error = payload?.error;
    throw new ApiError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Terjadi kesalahan pada server.',
      response.status,
      error?.params ?? {},
      error?.details,
    );
  }

  return payload?.data as T;
}

/** Varian yang juga mengembalikan metadata pagination. */
export async function apiRequestPaged<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta?: PageMeta }> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': currentLocale,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || payload.success === false) {
    throw new ApiError(
      payload.error?.code ?? 'INTERNAL_ERROR',
      payload.error?.message ?? 'Terjadi kesalahan.',
      response.status,
      payload.error?.params ?? {},
    );
  }
  return { data: payload.data, meta: payload.meta };
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE', body }),
};

/** Format uang. Nilai dari API selalu string decimal. */
export function formatMoney(value: string | number | null | undefined, currency = 'IDR', locale = 'id-ID'): string {
  const numeric = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!Number.isFinite(numeric)) return '-';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(numeric);
}

export function formatNumber(value: string | number | null | undefined, locale = 'id-ID'): string {
  const numeric = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!Number.isFinite(numeric)) return '-';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(numeric);
}

export function formatDate(value: string | Date | null | undefined, locale = 'id-ID'): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined, locale = 'id-ID'): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
