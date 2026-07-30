import { Injectable, Logger } from '@nestjs/common';

/**
 * Klien HTTP Esmartlink.
 *
 * Autentikasi dikarakterisasi dari `VirtualAccountBank.curlSmartlink` /
 * `curlSmartlinkGet` pada source legacy: HTTP Basic Authentication dengan
 * header `Content-Type: application/json` dan `Accept: application/json`.
 * Signature TIDAK dikarang — bila Esmartlink kelak menyediakan skema tanda
 * tangan, tambahkan di sini berdasarkan dokumentasi resmi.
 *
 * Legacy memanggil `curl`/`ssh` sebagai proses eksternal; implementasi baru
 * memakai fetch bawaan Node tanpa menjalankan perintah shell.
 */

export interface EsmartlinkCredentials {
  username: string;
  password: string;
}

export interface EsmartlinkResponse<T = Record<string, unknown>> {
  ok: boolean;
  httpStatus: number;
  durationMs: number;
  /** `code === 0` menandakan sukses pada kontrak legacy. */
  code: string | null;
  message: string | null;
  data: T | null;
  raw: unknown;
  error?: string;
}

@Injectable()
export class EsmartlinkClient {
  private readonly logger = new Logger(EsmartlinkClient.name);
  private readonly timeoutMs = 20_000;

  async createOrder(
    baseUrl: string,
    path: string,
    credentials: EsmartlinkCredentials,
    payload: Record<string, unknown>,
  ): Promise<EsmartlinkResponse> {
    return this.request('POST', joinUrl(baseUrl, path), credentials, payload);
  }

  async inquiryOrder(
    baseUrl: string,
    path: string,
    credentials: EsmartlinkCredentials,
    transactionId: string,
  ): Promise<EsmartlinkResponse> {
    return this.request('GET', joinUrl(baseUrl, path) + encodeURIComponent(transactionId), credentials);
  }

  private async request(
    method: 'GET' | 'POST',
    url: string,
    credentials: EsmartlinkCredentials,
    body?: Record<string, unknown>,
  ): Promise<EsmartlinkResponse> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Basic ${basicAuth(credentials)}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        return {
          ok: false,
          httpStatus: response.status,
          durationMs: Date.now() - startedAt,
          code: null,
          message: 'INVALID_JSON',
          data: null,
          raw: text.slice(0, 4000),
          error: 'Provider mengembalikan payload yang bukan JSON valid.',
        };
      }

      const envelope = (parsed ?? {}) as Record<string, unknown>;
      const code = envelope.code !== undefined && envelope.code !== null ? String(envelope.code) : null;

      return {
        ok: response.ok && code === '0',
        httpStatus: response.status,
        durationMs: Date.now() - startedAt,
        code,
        message: typeof envelope.message === 'string' ? envelope.message : null,
        data: (envelope.data as Record<string, unknown> | undefined) ?? null,
        raw: parsed,
      };
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      return {
        ok: false,
        httpStatus: 0,
        durationMs: Date.now() - startedAt,
        code: null,
        message: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        data: null,
        raw: null,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function basicAuth(credentials: EsmartlinkCredentials): string {
  return Buffer.from(`${credentials.username}:${credentials.password}`, 'utf8').toString('base64');
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const suffix = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${suffix}`;
}

/** Masking payload sebelum disimpan atau ditulis ke log. */
export function maskPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const sensitive = new Set([
    'password',
    'client_secret',
    'clientSecret',
    'secret',
    'authorization',
    'token',
    'api_key',
    'apiKey',
    'card_number',
    'cvv',
    'pin',
  ]);
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        out[key] = sensitive.has(key.toLowerCase()) ? '***MASKED***' : walk(item);
      }
      return out;
    }
    if (typeof value === 'string' && value.length > 2000) return `${value.slice(0, 2000)}…`;
    return value;
  };
  return walk(payload) as Record<string, unknown>;
}
