import { NIGHT_AUDIT_STEPS } from './hospitality-night-audit.service';
describe('hospitality night audit contract', () => {
  it('menjaga urutan step deterministik tanpa duplikasi', () => {
    expect(NIGHT_AUDIT_STEPS).toEqual(['PRECHECK','ROOM_POSTING','INTERFACE_CHECK','BALANCE_RECONCILIATION','REPORT_SNAPSHOT']);
    expect(new Set(NIGHT_AUDIT_STEPS).size).toBe(NIGHT_AUDIT_STEPS.length);
  });
});
