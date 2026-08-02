/**
 * Pengujian aturan berita/kabar pondok.
 */

import { validasiBerita } from './pesantren-berita';

describe('validasi berita', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiBerita({ judul: 'Kabar Pondok' })).toEqual([]);
  });

  it('judul wajib diisi dan dibatasi panjangnya', () => {
    expect(validasiBerita({})[0]).toMatchObject({ field: 'judul', code: 'WAJIB' });
    expect(validasiBerita({ judul: 'A'.repeat(256) })[0]).toMatchObject({
      field: 'judul',
      code: 'TERLALU_PANJANG',
    });
  });

  it('tanggal terbit diperiksa bila diisi', () => {
    expect(validasiBerita({ judul: 'Kabar', tanggalTerbit: '2026-08-01' })).toEqual([]);
    expect(validasiBerita({ judul: 'Kabar', tanggalTerbit: 'bukan-tanggal' })[0].code).toBe('TIDAK_SAH');
  });
});
