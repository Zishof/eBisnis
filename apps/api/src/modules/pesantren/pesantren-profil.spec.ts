/**
 * Pengujian aturan pengaturan situs publik pondok.
 */

import { validasiProfil } from './pesantren-profil';

describe('validasi profil situs', () => {
  it('masukan kosong tidak menghasilkan galat bila belum diterbitkan', () => {
    expect(validasiProfil({})).toEqual([]);
  });

  it('tema harus dari daftar yang dikenali', () => {
    expect(validasiProfil({ themeCode: 'HIJAU_ISLAMI' })).toEqual([]);
    expect(validasiProfil({ themeCode: 'PELANGI' })[0].code).toBe('TIDAK_DIKENALI');
  });

  it('tahun berdiri diperiksa masuk akal', () => {
    expect(validasiProfil({ tahunBerdiri: 2006 })).toEqual([]);
    expect(validasiProfil({ tahunBerdiri: 1800 })[0].code).toBe('TIDAK_SAH');
    expect(validasiProfil({ tahunBerdiri: new Date().getFullYear() + 1 })[0].code).toBe('TIDAK_SAH');
  });

  it('surel kontak diperiksa bila diisi', () => {
    expect(validasiProfil({ kontakEmail: 'info@contoh.sch.id' })).toEqual([]);
    expect(validasiProfil({ kontakEmail: 'bukan-email' })[0].code).toBe('TIDAK_SAH');
  });

  it('nama tampilan wajib diisi sebelum situs diterbitkan', () => {
    expect(validasiProfil({ isPublished: true, namaTampilan: 'Pondok Uji' })).toEqual([]);
    expect(validasiProfil({ isPublished: true })[0]).toMatchObject({ field: 'namaTampilan', code: 'WAJIB' });
  });
});
