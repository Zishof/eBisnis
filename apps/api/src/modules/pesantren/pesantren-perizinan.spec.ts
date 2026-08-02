/**
 * Pengujian aturan izin dan lintasan gerbang.
 */

import { validasiIzin, validasiLintasan } from './pesantren-perizinan';

const SAH = {
  santriId: 'a0000000-0000-0000-0000-000000000001',
  jenis: 'PULANG',
  alasan: 'Ada acara keluarga',
  tanggalMulai: '2026-08-02',
  tanggalSelesaiRencana: '2026-08-03',
};

describe('validasi izin', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiIzin(SAH)).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    const galat = validasiIzin({});
    expect(galat.map((g) => g.field).sort()).toEqual(
      ['alasan', 'jenis', 'santriId', 'tanggalMulai', 'tanggalSelesaiRencana'].sort(),
    );
  });

  it('jenis hanya dari daftar yang dikenali', () => {
    expect(validasiIzin({ ...SAH, jenis: 'LIBUR' })[0].code).toBe('TIDAK_DIKENALI');
  });

  it('tanggal rencana selesai tidak boleh sebelum tanggal mulai', () => {
    const galat = validasiIzin({ ...SAH, tanggalMulai: '2026-08-05', tanggalSelesaiRencana: '2026-08-01' });
    expect(galat.some((g) => g.code === 'SEBELUM_MULAI')).toBe(true);
  });
});

describe('validasi lintasan gerbang', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiLintasan({ izinId: 'a', arah: 'KELUAR' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiLintasan({}).map((g) => g.field).sort()).toEqual(['arah', 'izinId'].sort());
  });

  it('arah hanya KELUAR atau MASUK', () => {
    expect(validasiLintasan({ izinId: 'a', arah: 'SAMPING' })[0].code).toBe('TIDAK_DIKENALI');
  });
});
