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

/** Kapan token terakhir berhasil disegarkan, dalam milidetik epoch. */
let terakhirSegar = 0;

/**
 * Selama jeda ini, 401 dianggap sisa dari token lama — bukan tanda token baru
 * sudah tidak sah.
 *
 * Permintaan yang sudah terbang ketika token disegarkan kembali membawa 401 yang
 * **sudah basi**: ia dikirim dengan token lama dan dijawab sesudah token itu
 * diganti. Menyegarkan lagi karenanya memutar refresh token untuk kedua kalinya
 * tanpa alasan, dan menggandakan lalu lintas auth — satu kali kedaluwarsa
 * menghasilkan dua `POST /auth/refresh` beserta dua `GET /auth/me` di belakangnya.
 */
const JEDA_SEGAR_MS = 3_000;

async function refreshAccessToken(): Promise<boolean> {
  if (Date.now() - terakhirSegar < JEDA_SEGAR_MS && accessToken) return true;

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
        /*
         * Hanya penolakan yang benar-benar berarti "token ini tidak sah lagi"
         * yang mengakhiri sesi.
         *
         * Semula SETIAP jawaban tidak-OK membuang refresh token — termasuk 429
         * (dibatasi laju) dan 5xx (peladen tersedak). Tak satu pun dari keduanya
         * berarti sesinya tidak sah, tetapi akibatnya sama: tokennya terhapus,
         * tidak dapat dicoba lagi, dan pengguna terlempar ke halaman masuk.
         *
         * Pada layar kasir itu berarti keranjang yang sedang dilayani lenyap
         * karena peladen sesaat sibuk, di depan pembeli yang sudah menunggu.
         * Gangguan sementara harus berakhir sebagai percobaan berikutnya, bukan
         * sebagai sesi yang dibuang.
         */
        if (response.status === 401 || response.status === 403) {
          setAccessToken(null);
          setRefreshToken(null);
        }
        return false;
      }
      const payload = (await response.json()) as ApiEnvelope<{
        accessToken: string;
        refreshToken: string;
      }>;
      setAccessToken(payload.data.accessToken);
      setRefreshToken(payload.data.refreshToken);
      terakhirSegar = Date.now();
      return true;
    } catch {
      /*
       * Galat jaringan. Refresh token TIDAK dibuang: justru ketika jaringan
       * bermasalah ia paling dibutuhkan, dan membuangnya membuat pemulihan
       * mustahil setelah jaringannya kembali.
       */
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Menyegarkan sesi dari refresh token yang tersimpan.
 *
 * ## Mengapa ini satu-satunya pintu
 *
 * Peladen **memutar** refresh token dan mendeteksi pemakaian ulang: token yang
 * sudah dipakai sekali, bila dikirim lagi, membuatnya mencabut **seluruh
 * keluarga token** sesi itu. Itu perilaku yang benar — begitulah pencurian
 * token ketahuan.
 *
 * Akibatnya klien tidak boleh mengirim dua penyegaran serentak dengan token
 * yang sama. Dan itu persis yang terjadi setiap kali halaman dimuat penuh:
 * `auth-context` memulihkan sesi, sementara permintaan halaman lain sudah
 * terbang tanpa access token, menerima 401, lalu ikut menyegarkan. Keduanya
 * membaca refresh token yang sama.
 *
 * Yang menang balapan menentukan hasilnya. Bila yang kedua tiba sebelum yang
 * pertama menandai tokennya terpakai, keduanya dijawab 200 dan tidak ada yang
 * menyadari apa pun. Bila ia tiba sesudahnya, peladen membaca pemakaian ulang,
 * mencabut seluruh keluarga token, dan pengguna terlempar ke halaman masuk —
 * pada mesin kasir, di tengah shift, dengan keranjang yang sedang dilayani.
 *
 * Selisihnya beberapa milidetik, sehingga kegagalannya jarang dan tampak acak.
 * Satu-satunya perbaikan yang benar adalah membuatnya mustahil: seluruh
 * penyegaran melewati fungsi ini, yang berbagi satu janji lewat
 * `refreshPromise`.
 *
 * Mengembalikan false bila gagal. Token hanya dibuang ketika peladen benar-benar
 * menyatakan sesinya tidak sah (401/403); 429 dan 5xx dibiarkan supaya dapat
 * dicoba lagi.
 */
export function segarkanSesi(): Promise<boolean> {
  return refreshAccessToken();
}

/** Mengembalikan keadaan modul ke titik awal. Dipakai pengujian. */
export function _setelUlangUntukUji(): void {
  refreshPromise = null;
  terakhirSegar = 0;
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
