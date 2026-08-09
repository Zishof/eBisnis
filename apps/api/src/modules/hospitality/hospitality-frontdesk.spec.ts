import { BlockedDigitalKeyAdapter, transisiInapDiizinkan, validasiCheckin } from './hospitality-frontdesk';

describe('hospitality frontdesk domain', () => {
  it('menolak check-in yang melewati kontrol identitas, jaminan, consent, dan room readiness', () => {
    expect(validasiCheckin({ adults: 1 }).map((e) => e.field)).toEqual([
      'identityVerified', 'guaranteeConfirmed', 'registrationCardSigned', 'roomReady',
    ]);
  });

  it('mengunci lifecycle sesudah checkout', () => {
    expect(transisiInapDiizinkan('PRE_ARRIVAL', 'IN_HOUSE')).toBe(true);
    expect(transisiInapDiizinkan('IN_HOUSE', 'CHECKED_OUT')).toBe(true);
    expect(transisiInapDiizinkan('CHECKED_OUT', 'IN_HOUSE')).toBe(false);
  });

  it('tidak mengaku punya integrasi digital key tanpa kontrak provider', async () => {
    const adapter = new BlockedDigitalKeyAdapter();
    expect(adapter.live).toBe(false);
    await expect(adapter.grant({ stayId: 's', roomId: 'r', validFrom: 'a', validUntil: 'b', idempotencyKey: 'k' }))
      .resolves.toEqual({ granted: false, errorCode: 'BLOCKED_PROVIDER_INPUT' });
  });
});

