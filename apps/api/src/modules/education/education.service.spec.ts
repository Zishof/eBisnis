import { EducationService } from './education.service';

describe('EducationService', () => {
  const service = new EducationService();

  it('memisahkan modul menurut produk', () => {
    const eschool = service.modules('eschool');

    expect(eschool.length).toBeGreaterThan(0);
    expect(eschool.every((module) => module.product === 'eschool')).toBe(true);
  });

  it('menyediakan dataset nasional untuk DAPODIK dan Feeder', () => {
    const datasets = service.datasets();

    expect(datasets.some((dataset) => dataset.standard === 'DAPODIK')).toBe(true);
    expect(datasets.some((dataset) => dataset.standard === 'FEEDER')).toBe(true);
  });

  it('menyesuaikan endpoint DAPODIK untuk facade eSchool', () => {
    const siswa = service.datasets('eschool').find((dataset) => dataset.code === 'dapodik-siswa');

    expect(siswa?.importEndpoint).toBe('/eschool/dapodik/santri/import');
    expect(siswa?.exportEndpoint).toBe('/eschool/dapodik/santri/export');
    expect(siswa?.templateEndpoint).toBe('/eschool/dapodik/santri/template');
  });

  it('mengembalikan salinan data supaya katalog tidak termutasi dari luar', () => {
    const first = service.datasets('epesantren')[0];
    expect(first).toBeDefined();

    first!.requiredFields.push('kolom palsu');

    expect(service.datasets('epesantren')[0]!.requiredFields).not.toContain('kolom palsu');
  });
});
