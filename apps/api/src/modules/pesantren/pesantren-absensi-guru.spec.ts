/**
 * Pengujian aturan absensi guru dan piket.
 */

import { validasiAbsensiGuru, validasiPiket } from './pesantren-absensi-guru';

describe('validasi absensi guru', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiAbsensiGuru({ guruId: 'a', status: 'HADIR' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiAbsensiGuru({}).map((g) => g.field).sort()).toEqual(['guruId', 'status'].sort());
  });

  it('jam pulang harus setelah jam masuk', () => {
    const galat = validasiAbsensiGuru({ guruId: 'a', status: 'HADIR', jamMasuk: '10:00', jamPulang: '08:00' });
    expect(galat.some((g) => g.code === 'SEBELUM_MASUK')).toBe(true);
  });
});

describe('validasi piket', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiPiket({ guruId: 'a', jenisPiket: 'PIKET_HARIAN' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiPiket({}).map((g) => g.field).sort()).toEqual(['guruId', 'jenisPiket'].sort());
  });
});
