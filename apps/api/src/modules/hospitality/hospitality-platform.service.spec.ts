import { HospitalityPlatformService } from './hospitality-platform.service';

describe('HospitalityPlatformService health', () => {
  it('melaporkan katalog siap, tanpa harga rekaan, dan schema lengkap', async () => {
    const prisma = {
      subscriptionProduct: { findUnique: jest.fn().mockResolvedValue({ code: 'MITRAINAP', status: 'ACTIVE' }) },
      subscriptionPlan: {
        findUnique: jest.fn().mockResolvedValue({
          metadata: { priceStatus: 'PRICE_CONFIGURATION_REQUIRED' },
          versions: [{ modules: new Array(7).fill({}), features: new Array(4).fill({}), prices: [] }],
        }),
      },
      packageAssignment: { count: jest.fn().mockResolvedValue(1) },
    };
    const required = [
      'hospitality_property', 'hospitality_room_type', 'hospitality_room', 'hospitality_room_block',
      'hospitality_guest', 'hospitality_reservation', 'hospitality_rate_plan', 'hospitality_channel_account',
    ];
    const tenantDb = { queryAdmin: jest.fn().mockResolvedValue(required.map((table_name) => ({ table_name }))) };
    const service = new HospitalityPlatformService(prisma as never, tenantDb as never);

    await expect(service.health('tenant_a', 'tenant-id')).resolves.toMatchObject({
      status: 'ok',
      product: {
        catalogReady: true,
        priceStatus: 'PRICE_CONFIGURATION_REQUIRED',
        configuredPriceCount: 0,
        moduleCount: 7,
        featureCount: 4,
      },
      entitlement: { activePackageAssignments: 1 },
      provisioning: { missingTables: [] },
    });
  });

  it('degraded bila tabel wajib belum diprovision', async () => {
    const prisma = {
      subscriptionProduct: { findUnique: jest.fn().mockResolvedValue({ code: 'MITRAINAP' }) },
      subscriptionPlan: { findUnique: jest.fn().mockResolvedValue({ metadata: {}, versions: [{ modules: [], features: [], prices: [] }] }) },
      packageAssignment: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = new HospitalityPlatformService(
      prisma as never,
      { queryAdmin: jest.fn().mockResolvedValue([]) } as never,
    );
    const result = await service.health('tenant_a', 'tenant-id');
    expect(result.status).toBe('degraded');
    expect(result.provisioning.missingTables.length).toBeGreaterThan(0);
  });
});
