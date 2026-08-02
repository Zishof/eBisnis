/**
 * Pengujian aturan prestasi dan penghargaan santri.
 */

import { validasiPenghargaan, validasiPrestasi } from './pesantren-prestasi';

describe('validasi prestasi', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(
      validasiPrestasi({
        santriId: 'a',
        cabang: 'Olimpiade Matematika',
        namaKompetisi: 'OSN Kabupaten',
        tingkat: 'KABUPATEN',
        peringkat: 'JUARA_1',
      }),
    ).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiPrestasi({}).map((g) => g.field).sort()).toEqual(
      ['santriId', 'cabang', 'namaKompetisi', 'tingkat', 'peringkat'].sort(),
    );
  });

  it('menolak tingkat dan peringkat yang tidak dikenali', () => {
    const galat = validasiPrestasi({
      santriId: 'a',
      cabang: 'A',
      namaKompetisi: 'B',
      tingkat: 'GALAKSI',
      peringkat: 'JUARA_UMUM',
    });
    expect(galat.some((g) => g.field === 'tingkat')).toBe(true);
    expect(galat.some((g) => g.field === 'peringkat')).toBe(true);
  });
});

describe('validasi penghargaan', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiPenghargaan({ santriId: 'a', judul: 'Santri Teladan', jenis: 'APRESIASI' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiPenghargaan({}).map((g) => g.field).sort()).toEqual(['santriId', 'judul', 'jenis'].sort());
  });
});
