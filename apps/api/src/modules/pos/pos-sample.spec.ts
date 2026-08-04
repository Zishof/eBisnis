import { PROFIL_BAWAAN } from './pos-sample.service';

describe('profil data contoh POS', () => {
  it('memenuhi batas demo 50 sampai 1000 untuk data utama', () => {
    const totalTransaksi = PROFIL_BAWAAN.brands * PROFIL_BAWAAN.outletsPerBrand * PROFIL_BAWAAN.salesPerOutlet;

    expect(PROFIL_BAWAAN.products).toBeGreaterThanOrEqual(50);
    expect(PROFIL_BAWAAN.products).toBeLessThanOrEqual(1000);
    expect(PROFIL_BAWAAN.customers).toBeGreaterThanOrEqual(50);
    expect(PROFIL_BAWAAN.customers).toBeLessThanOrEqual(1000);
    expect(totalTransaksi).toBeGreaterThanOrEqual(50);
    expect(totalTransaksi).toBeLessThanOrEqual(1000);
  });
});
