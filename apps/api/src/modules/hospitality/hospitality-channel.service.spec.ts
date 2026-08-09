import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { HospitalityChannelService } from './hospitality-channel.service';

describe('HospitalityChannelService property isolation', () => {
  it('menolak mapping bila account dan resource tidak terbukti dalam property yang sama', async () => {
    const db = {
      queryOne: jest.fn().mockResolvedValue(null),
      query: jest.fn(),
    } as unknown as TenantConnectionService;
    const service = new HospitalityChannelService(db);

    await expect(
      service.aturMapping('tenant_a', 'property-a', 'account-b', {
        resourceType: 'ROOM_TYPE',
        localId: 'room-type-b',
        providerCode: 'DLX',
      }),
    ).rejects.toThrow('tidak ditemukan pada properti yang sama');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('menolak pemakaian ulang idempotency key dengan payload berbeda', async () => {
    const db = {
      query: jest.fn().mockResolvedValue([{ id: 'job-1', payload_hash: 'hash-lama', status: 'PENDING' }]),
    } as unknown as TenantConnectionService;
    const service = new HospitalityChannelService(db);

    await expect(
      service.antrekan('tenant_a', 'property-a', 'account-a', {
        type: 'ARI_PUSH',
        sourceVersion: '2',
        idempotencyKey: 'ari-1',
        correlationId: 'corr-1',
        payload: { amount: 900000 },
      }),
    ).rejects.toThrow('payload berbeda');
  });
});
