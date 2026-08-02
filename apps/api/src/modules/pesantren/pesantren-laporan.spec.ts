/**
 * Pengujian aturan laporan (rentang tanggal, katalog, persen).
 */

import { laporanDikenal, LAPORAN_PESANTREN, MAKS_HARI_LAPORAN, periksaRentang, persen } from './pesantren-laporan';

describe('periksaRentang', () => {
  it('memakai bawaan 30 hari terakhir bila from/to tidak diisi', () => {
    const hasil = periksaRentang(undefined, undefined, '2026-02-01');
    expect(hasil.ok).toBe(true);
    expect(hasil.range).toEqual({ from: '2026-01-03', to: '2026-02-01', days: 30 });
  });

  it('menolak tanggal yang formatnya salah', () => {
    expect(periksaRentang('01-01-2026', '2026-01-31').reason).toBe('INVALID_DATE');
  });

  it('menolak tanggal mulai setelah tanggal akhir', () => {
    expect(periksaRentang('2026-02-01', '2026-01-01').reason).toBe('REVERSED');
  });

  it(`menolak rentang lebih dari ${MAKS_HARI_LAPORAN} hari`, () => {
    expect(periksaRentang('2026-01-01', '2026-12-31').reason).toBe('TOO_WIDE');
  });

  it('menerima rentang yang sah', () => {
    const hasil = periksaRentang('2026-01-01', '2026-01-31');
    expect(hasil.ok).toBe(true);
    expect(hasil.range?.days).toBe(31);
  });
});

describe('persen', () => {
  it('aman terhadap pembagi nol', () => {
    expect(persen(5, 0)).toBe(0);
  });

  it('menghitung dengan pembulatan dua desimal', () => {
    expect(persen(1, 3)).toBe(33.33);
  });
});

describe('katalog laporan', () => {
  it('laporanDikenal mengenali kode yang ada di katalog', () => {
    for (const l of LAPORAN_PESANTREN) {
      expect(laporanDikenal(l.code)).toBe(true);
    }
  });

  it('laporanDikenal menolak kode yang tidak ada', () => {
    expect(laporanDikenal('TIDAK_ADA')).toBe(false);
  });
});
