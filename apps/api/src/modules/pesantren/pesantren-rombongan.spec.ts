/**
 * Pengujian aturan rombongan belajar/kelas.
 */

import { validasiAnggota, validasiRombongan } from './pesantren-rombongan';

describe('validasi rombongan', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(
      validasiRombongan({ unitPendidikanId: 'a', tahunAjaranId: 'b', tingkat: 'VII', nama: 'VII-A' }),
    ).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiRombongan({}).map((g) => g.field).sort()).toEqual(
      ['unitPendidikanId', 'tahunAjaranId', 'tingkat', 'nama'].sort(),
    );
  });

  it('kapasitas harus lebih besar dari nol bila diisi', () => {
    const galat = validasiRombongan({
      unitPendidikanId: 'a',
      tahunAjaranId: 'b',
      tingkat: 'VII',
      nama: 'VII-A',
      kapasitas: 0,
    });
    expect(galat.some((g) => g.field === 'kapasitas')).toBe(true);
  });
});

describe('validasi anggota', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiAnggota({ rombonganId: 'a', santriId: 'b', tahunAjaranId: 'c' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiAnggota({}).map((g) => g.field).sort()).toEqual(
      ['rombonganId', 'santriId', 'tahunAjaranId'].sort(),
    );
  });
});
