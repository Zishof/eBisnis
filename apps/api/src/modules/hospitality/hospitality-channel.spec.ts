import {
  BlockedProviderAdapter,
  FakeDistributionAdapter,
  hashPayload,
  sanitasiPayload,
  statusSetelahKirim,
  type AmplopDistribusi,
} from './hospitality-channel';

const AMPlOP: AmplopDistribusi = {
  sourceVersion: '42',
  propertyId: 'property-1',
  channelAccountId: 'account-1',
  type: 'ARI_PUSH',
  idempotencyKey: 'ari:property-1:42',
  correlationId: 'correlation-1',
  payload: { roomTypeCode: 'DLX', amount: 850000 },
};

describe('kontrak distribution provider-neutral', () => {
  it('test double menerima amplop canonical tanpa network call', async () => {
    const adapter = new FakeDistributionAdapter();
    await expect(adapter.kirim(AMPlOP)).resolves.toEqual({ acknowledged: true });
    expect(adapter.received).toEqual([AMPlOP]);
  });

  it('live adapter tetap diblokir bila input provider belum tersedia', async () => {
    const adapter = new BlockedProviderAdapter('OTA_TANPA_KONTRAK');
    await expect(adapter.kirim(AMPlOP)).resolves.toMatchObject({
      acknowledged: false,
      retryable: false,
      errorCode: 'BLOCKED_PROVIDER_INPUT',
    });
  });
});

describe('keamanan payload channel', () => {
  it('menyamarkan credential dan data kartu pada struktur bersarang', () => {
    expect(
      sanitasiPayload({ reservation: { code: 'R-1', card: { pan: '4111', cvv: '123' } }, apiKey: 'secret' }),
    ).toEqual({ reservation: { code: 'R-1', card: '[REDACTED]' }, apiKey: '[REDACTED]' });
  });

  it('hash tidak bergantung urutan key sehingga retry tetap idempotent', () => {
    expect(hashPayload({ b: 2, a: 1 })).toBe(hashPayload({ a: 1, b: 2 }));
  });
});

describe('retry dan dead-letter', () => {
  it('acknowledgement menutup pekerjaan tanpa menambah retry', () => {
    expect(statusSetelahKirim({ acknowledged: true }, 2)).toEqual({ status: 'ACKNOWLEDGED', retryCount: 2 });
  });

  it('kegagalan sementara masuk retry sebelum batas', () => {
    expect(statusSetelahKirim({ acknowledged: false, retryable: true }, 1, 3)).toEqual({
      status: 'RETRY',
      retryCount: 2,
    });
  });

  it('kegagalan permanen dan retry yang habis masuk dead-letter', () => {
    expect(statusSetelahKirim({ acknowledged: false, retryable: false }, 0)).toMatchObject({ status: 'DEAD_LETTER' });
    expect(statusSetelahKirim({ acknowledged: false, retryable: true }, 3, 3)).toEqual({
      status: 'DEAD_LETTER',
      retryCount: 4,
    });
  });
});
