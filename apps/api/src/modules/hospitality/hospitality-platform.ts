export const HOSPITALITY_USAGE_METRICS = [
  'PROPERTY_MONTH',
  'SELLABLE_UNIT_MONTH',
  'ACTIVE_ROOM_MONTH',
  'BED_MONTH',
  'RESERVATION_MONTH',
  'BOOKING_ENGINE_TRANSACTION',
  'CHANNEL_CONNECTION_MONTH',
  'POS_REGISTER_MONTH',
  'MODULE_BUNDLE',
  'CONTRACT_DEFINED',
] as const;
export type HospitalityUsageMetric = (typeof HOSPITALITY_USAGE_METRICS)[number];

export const NON_BILLABLE_USAGE_SOURCES = ['SAMPLE', 'DEMO', 'TEST', 'TRAINING', 'REVERSED'] as const;
export type HospitalityUsageSource = (typeof NON_BILLABLE_USAGE_SOURCES)[number] | 'PRODUCTION';

export interface HospitalityUsageEvent {
  tenantId: string;
  metric: HospitalityUsageMetric;
  quantity: number;
  periodStart: string;
  periodEnd: string;
  source: HospitalityUsageSource;
  idempotencyKey: string;
  propertyId?: string;
  metadata?: Record<string, unknown>;
}

export interface ValidasiUsage {
  valid: boolean;
  billable: boolean;
  errors: string[];
}

/** Contract validation sebelum event dikirim ke shared usage/billing engine. */
export function validasiHospitalityUsage(event: HospitalityUsageEvent): ValidasiUsage {
  const errors: string[] = [];
  if (!event.tenantId) errors.push('tenantId wajib diisi.');
  if (!HOSPITALITY_USAGE_METRICS.includes(event.metric)) errors.push('Metric tidak dikenal.');
  if (!Number.isFinite(event.quantity) || event.quantity < 0) errors.push('Quantity harus angka non-negatif.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(event.periodEnd)) {
    errors.push('Periode wajib memakai format YYYY-MM-DD.');
  } else if (event.periodEnd < event.periodStart) {
    errors.push('periodEnd tidak boleh sebelum periodStart.');
  }
  if (!event.idempotencyKey?.trim()) errors.push('idempotencyKey wajib diisi.');
  return {
    valid: errors.length === 0,
    billable: errors.length === 0 && !NON_BILLABLE_USAGE_SOURCES.includes(event.source as never),
    errors,
  };
}

export function dependencyErrors(modules: Array<{ code: string; dependsOn?: string[] }>): string[] {
  const codes = new Set(modules.map((module) => module.code));
  return modules.flatMap((module) =>
    (module.dependsOn ?? [])
      .filter((dependency) => !codes.has(dependency))
      .map((dependency) => `${module.code} -> ${dependency}`),
  );
}
