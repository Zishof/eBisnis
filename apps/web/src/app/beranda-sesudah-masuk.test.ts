import { describe, expect, it } from 'vitest';
import {
  BERANDA_BAWAAN,
  BERANDA_STAF_PLATFORM,
  berandaSesudahMasuk,
} from './beranda-sesudah-masuk';

const penyewa = (verticalCode: string | null) => ({
  isPlatformStaff: false,
  tenant: { verticalCode },
});

describe('beranda sesudah masuk', () => {
  it('penyewa pesantren menuju berandanya sendiri', () => {
    expect(berandaSesudahMasuk(penyewa('PESANTREN'))).toBe('/pesantren');
  });

  it('penyewa tanpa vertikal memakai beranda bawaan', () => {
    // Penyewa yang lahir sebelum kolomnya ada. Beranda bawaan memang perilaku
    // yang benar bagi mereka — bukan halaman kosong dan bukan galat.
    expect(berandaSesudahMasuk(penyewa(null))).toBe(BERANDA_BAWAAN);
  });

  it('vertikal yang belum punya beranda jatuh ke bawaan', () => {
    /*
     * `HEALTH` sah pada basis data tetapi belum punya berandanya sendiri.
     * Jatuh ke bawaan, bukan ke alamat yang belum ada — alamat yang belum ada
     * menghasilkan halaman kosong tepat sesudah masuk berhasil.
     */
    expect(berandaSesudahMasuk(penyewa('HEALTH'))).toBe(BERANDA_BAWAAN);
  });

  it('sesi tanpa penyewa memakai beranda bawaan', () => {
    expect(berandaSesudahMasuk({ isPlatformStaff: false, tenant: null })).toBe(BERANDA_BAWAAN);
  });

  it('staf platform menang atas vertikal', () => {
    /*
     * Staf yang kebetulan juga anggota sebuah pondok tetap harus mendarat di
     * konsol platform. Kalau vertikal menang, staf yang sedang menolong satu
     * pondok kehilangan konsolnya sampai keanggotaannya dicabut.
     */
    expect(berandaSesudahMasuk({ isPlatformStaff: true, tenant: { verticalCode: 'PESANTREN' } })).toBe(
      BERANDA_STAF_PLATFORM,
    );
  });

  it('tujuan yang tadinya hendak dibuka menang atas beranda', () => {
    // Orang yang menekan tautan menuju halaman tertentu bermaksud membukanya.
    expect(berandaSesudahMasuk(penyewa('PESANTREN'), '/pesantren/santri')).toBe(
      '/pesantren/santri',
    );
    expect(berandaSesudahMasuk({ isPlatformStaff: true, tenant: null }, '/app/laporan')).toBe(
      '/app/laporan',
    );
  });

  it('tujuan kosong tidak dianggap tujuan', () => {
    expect(berandaSesudahMasuk(penyewa('PESANTREN'), '')).toBe('/pesantren');
    expect(berandaSesudahMasuk(penyewa('PESANTREN'), null)).toBe('/pesantren');
    expect(berandaSesudahMasuk(penyewa('PESANTREN'), undefined)).toBe('/pesantren');
  });
});
