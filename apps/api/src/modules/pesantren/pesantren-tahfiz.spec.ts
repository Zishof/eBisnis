/**
 * Pengujian aturan setoran tahfiz.
 */

import { validasiSetoran } from './pesantren-tahfiz';

const SAH = {
  santriId: 'a0000000-0000-0000-0000-000000000001',
  tanggal: '2026-08-01',
  jenis: 'SETORAN',
  juz: 5,
  predikat: 'LANCAR',
};

describe('validasi setoran tahfiz', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiSetoran(SAH)).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    const galat = validasiSetoran({});
    expect(galat.map((g) => g.field).sort()).toEqual(
      ['jenis', 'juz', 'predikat', 'santriId', 'tanggal'].sort(),
    );
  });

  it('tanggal tidak boleh di masa depan', () => {
    const depan = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(validasiSetoran({ ...SAH, tanggal: depan })[0].code).toBe('DI_MASA_DEPAN');
  });

  it('tanggal yang tidak sah ditolak', () => {
    expect(validasiSetoran({ ...SAH, tanggal: 'bukan-tanggal' })[0].code).toBe('TIDAK_SAH');
  });

  it('jenis dan predikat hanya dari daftar yang dikenali', () => {
    expect(validasiSetoran({ ...SAH, jenis: 'HAFALAN_BARU' })[0].code).toBe('TIDAK_DIKENALI');
    expect(validasiSetoran({ ...SAH, predikat: 'SANGAT_LANCAR' })[0].code).toBe('TIDAK_DIKENALI');
  });

  it('juz harus antara 1 dan 30', () => {
    expect(validasiSetoran({ ...SAH, juz: 0 })[0].code).toBe('TIDAK_SAH');
    expect(validasiSetoran({ ...SAH, juz: 31 })[0].code).toBe('TIDAK_SAH');
    expect(validasiSetoran({ ...SAH, juz: 1 })).toEqual([]);
    expect(validasiSetoran({ ...SAH, juz: 30 })).toEqual([]);
  });
});
