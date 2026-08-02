/**
 * Pengujian aturan presensi santri.
 */

import { validasiPresensi } from './pesantren-presensi';

const SAH = {
  santriId: 'a0000000-0000-0000-0000-000000000001',
  tanggal: '2026-08-01',
  jenis: 'IBADAH',
  status: 'HADIR',
};

describe('validasi presensi', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiPresensi(SAH)).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    const galat = validasiPresensi({});
    expect(galat.map((g) => g.field).sort()).toEqual(
      ['jenis', 'santriId', 'status', 'tanggal'].sort(),
    );
  });

  it('tanggal tidak boleh di masa depan', () => {
    const depan = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(validasiPresensi({ ...SAH, tanggal: depan })[0].code).toBe('DI_MASA_DEPAN');
  });

  it('tanggal yang tidak sah ditolak', () => {
    expect(validasiPresensi({ ...SAH, tanggal: 'bukan-tanggal' })[0].code).toBe('TIDAK_SAH');
  });

  it('jenis dan status hanya dari daftar yang dikenali', () => {
    expect(validasiPresensi({ ...SAH, jenis: 'OLAHRAGA' })[0].code).toBe('TIDAK_DIKENALI');
    expect(validasiPresensi({ ...SAH, status: 'BOLOS' })[0].code).toBe('TIDAK_DIKENALI');
  });

  it('keterangan wajib diisi untuk status selain hadir', () => {
    const galat = validasiPresensi({ ...SAH, status: 'IZIN' });
    expect(galat.map((g) => g.field)).toContain('keterangan');
    expect(validasiPresensi({ ...SAH, status: 'IZIN', keterangan: 'Sakit demam' })).toEqual([]);
  });

  it('keterangan tidak wajib untuk status hadir', () => {
    expect(validasiPresensi({ ...SAH, status: 'HADIR' })).toEqual([]);
  });
});
