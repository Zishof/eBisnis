import {
  HOSPITALITY_USAGE_METRICS,
  dependencyErrors,
  validasiHospitalityUsage,
  type HospitalityUsageEvent,
} from './hospitality-platform';
import {
  HOSPITALITY_MODULE_CATALOG_SEED,
  HOSPITALITY_PLAN_SEED,
} from '../master-seed/registry/platform-master-seeds';

const EVENT: HospitalityUsageEvent = {
  tenantId: 'tenant-1',
  metric: 'ACTIVE_ROOM_MONTH',
  quantity: 40,
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
  source: 'PRODUCTION',
  idempotencyKey: 'tenant-1:ACTIVE_ROOM_MONTH:2026-08',
};

describe('MI-4 usage meter contract', () => {
  it('menyediakan seluruh metric konfigurabel dari perintah master', () => {
    expect(HOSPITALITY_USAGE_METRICS).toHaveLength(10);
  });

  it('production usage valid dapat ditagihkan oleh shared billing engine', () => {
    expect(validasiHospitalityUsage(EVENT)).toEqual({ valid: true, billable: true, errors: [] });
  });

  it.each(['SAMPLE', 'DEMO', 'TEST', 'TRAINING', 'REVERSED'] as const)(
    '%s usage tidak billable',
    (source) => expect(validasiHospitalityUsage({ ...EVENT, source })).toMatchObject({ valid: true, billable: false }),
  );

  it('menolak quantity negatif dan periode terbalik', () => {
    const result = validasiHospitalityUsage({ ...EVENT, quantity: -1, periodStart: '2026-09-01', periodEnd: '2026-08-01' });
    expect(result.valid).toBe(false);
    expect(result.billable).toBe(false);
  });
});

describe('MI-4 product dan entitlement manifest', () => {
  it('dependency graph lengkap dan tidak menunjuk modul rekaan', () => {
    expect(dependencyErrors(HOSPITALITY_MODULE_CATALOG_SEED)).toEqual([]);
  });

  it('paket tidak mengandung harga sebelum keputusan komersial', () => {
    expect(HOSPITALITY_PLAN_SEED.priceStatus).toBe('PRICE_CONFIGURATION_REQUIRED');
    expect(HOSPITALITY_PLAN_SEED).not.toHaveProperty('unitPrice');
  });

  it('paket hanya memuat modul yang ada pada manifest', () => {
    const codes = new Set(HOSPITALITY_MODULE_CATALOG_SEED.map((module) => module.code));
    expect(HOSPITALITY_PLAN_SEED.modules.filter((module) => !codes.has(module.code))).toEqual([]);
  });
});
