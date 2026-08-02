/**
 * Pengujian aturan kurikulum dan jadwal pelajaran.
 */

import { validasiJadwalPelajaran, validasiKurikulum } from './pesantren-kurikulum';

describe('validasi kurikulum', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(
      validasiKurikulum({
        unitPendidikanId: 'a',
        tahunAjaranId: 'b',
        tingkat: 'VII',
        mataPelajaranId: 'c',
        jamPerMinggu: 4,
      }),
    ).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiKurikulum({}).map((g) => g.field).sort()).toEqual(
      ['unitPendidikanId', 'tahunAjaranId', 'tingkat', 'mataPelajaranId', 'jamPerMinggu'].sort(),
    );
  });

  it('jam per minggu harus lebih besar dari nol', () => {
    const galat = validasiKurikulum({
      unitPendidikanId: 'a',
      tahunAjaranId: 'b',
      tingkat: 'VII',
      mataPelajaranId: 'c',
      jamPerMinggu: 0,
    });
    expect(galat.some((g) => g.field === 'jamPerMinggu')).toBe(true);
  });
});

describe('validasi jadwal pelajaran', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(
      validasiJadwalPelajaran({
        rombonganId: 'a',
        mataPelajaranId: 'b',
        hari: 'SENIN',
        waktuMulai: '07:00',
        waktuSelesai: '08:30',
      }),
    ).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiJadwalPelajaran({}).map((g) => g.field).sort()).toEqual(
      ['rombonganId', 'mataPelajaranId', 'hari', 'waktuMulai', 'waktuSelesai'].sort(),
    );
  });

  it('waktu selesai harus setelah waktu mulai', () => {
    const galat = validasiJadwalPelajaran({
      rombonganId: 'a',
      mataPelajaranId: 'b',
      hari: 'SENIN',
      waktuMulai: '08:30',
      waktuSelesai: '07:00',
    });
    expect(galat.some((g) => g.code === 'SEBELUM_MULAI')).toBe(true);
  });

  it('hari tidak dikenali menghasilkan galat', () => {
    expect(
      validasiJadwalPelajaran({
        rombonganId: 'a',
        mataPelajaranId: 'b',
        hari: 'AHAD',
        waktuMulai: '07:00',
        waktuSelesai: '08:30',
      }).some((g) => g.field === 'hari'),
    ).toBe(true);
  });
});
