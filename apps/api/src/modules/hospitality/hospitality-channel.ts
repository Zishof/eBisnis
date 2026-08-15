import { createHash } from 'node:crypto';

export const JENIS_PEKERJAAN_DISTRIBUSI = [
  'ARI_PUSH',
  'ARI_PULL',
  'RESERVATION_CREATE',
  'RESERVATION_MODIFY',
  'RESERVATION_CANCEL',
] as const;
export type JenisPekerjaanDistribusi = (typeof JENIS_PEKERJAAN_DISTRIBUSI)[number];

export const STATUS_PEKERJAAN_DISTRIBUSI = [
  'PENDING',
  'PROCESSING',
  'ACKNOWLEDGED',
  'RETRY',
  'DEAD_LETTER',
] as const;
export type StatusPekerjaanDistribusi = (typeof STATUS_PEKERJAAN_DISTRIBUSI)[number];

export interface AmplopDistribusi<T = Record<string, unknown>> {
  sourceVersion: string;
  propertyId: string;
  channelAccountId: string;
  type: JenisPekerjaanDistribusi;
  idempotencyKey: string;
  correlationId: string;
  payload: T;
}

export interface HasilKirimDistribusi {
  acknowledged: boolean;
  providerMessageId?: string;
  retryable?: boolean;
  errorCode?: string;
  sanitizedError?: string;
}

/** Port provider-neutral. Implementasi live dilarang sebelum kontrak provider tersedia. */
export interface HospitalityDistributionAdapter {
  readonly key: string;
  readonly live: boolean;
  kirim(envelope: AmplopDistribusi): Promise<HasilKirimDistribusi>;
}

export class BlockedProviderAdapter implements HospitalityDistributionAdapter {
  readonly live = false;
  constructor(readonly key: string) {}

  async kirim(_envelope: AmplopDistribusi): Promise<HasilKirimDistribusi> {
    return {
      acknowledged: false,
      retryable: false,
      errorCode: 'BLOCKED_PROVIDER_INPUT',
      sanitizedError: 'Dokumentasi, endpoint, dan credential provider belum dikonfigurasi.',
    };
  }
}

/** Test double deterministik untuk contract/integration test; tidak melakukan network call. */
export class FakeDistributionAdapter implements HospitalityDistributionAdapter {
  readonly key = 'TEST';
  readonly live = false;
  readonly received: AmplopDistribusi[] = [];

  constructor(private readonly result: HasilKirimDistribusi = { acknowledged: true }) {}

  async kirim(envelope: AmplopDistribusi): Promise<HasilKirimDistribusi> {
    this.received.push(envelope);
    return this.result;
  }
}

const RAHASIA = /pass(word)?|secret|token|authorization|credential|api[-_]?key|card|cvv|pan/i;

/** Menyimpan raw message tersanitasi tanpa credential atau data kartu. */
export function sanitasiPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitasiPayload);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        RAHASIA.test(key) ? '[REDACTED]' : sanitasiPayload(child),
      ]),
    );
  }
  return value;
}

export function hashPayload(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function statusSetelahKirim(
  hasil: HasilKirimDistribusi,
  retryCount: number,
  maxRetry = 5,
): { status: StatusPekerjaanDistribusi; retryCount: number } {
  if (hasil.acknowledged) return { status: 'ACKNOWLEDGED', retryCount };
  const berikutnya = retryCount + 1;
  if (hasil.retryable === true && berikutnya <= maxRetry) {
    return { status: 'RETRY', retryCount: berikutnya };
  }
  return { status: 'DEAD_LETTER', retryCount: berikutnya };
}
