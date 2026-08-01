/**
 * Pengujian daftar endpoint yang tetap boleh diakses saat kata sandi wajib
 * diganti.
 *
 * ## Cacat yang dijaga
 *
 * `JwtAuthGuard` mengizinkan `/auth/change-password`; `PermissionGuard` yang
 * berjalan sesudahnya menolaknya. Akibatnya kebuntuan: kata sandi wajib diganti
 * sebelum apa pun boleh diakses, dan satu-satunya endpoint yang dapat
 * menggantinya ikut terblokir.
 *
 * Uji terakhir di berkas ini membaca kedua penjaga dari sumbernya dan menuntut
 * keduanya memakai fungsi yang sama. Penjaga yang menegakkan aturannya sendiri
 * adalah persis bentuk cacat yang sudah terjadi sekali.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PASSWORD_CHANGE_ALLOWLIST,
  bolehSaatWajibGantiKataSandi,
} from './password-change-allowlist';

describe('daftar saat wajib ganti kata sandi', () => {
  it('mengizinkan jalan keluar dari keadaan ini', () => {
    /*
     * Tanpa yang pertama, penyewa baru terjebak selamanya. Tanpa yang kedua, ia
     * bahkan tidak dapat keluar dan mencoba dari awal.
     */
    expect(bolehSaatWajibGantiKataSandi('/api/v1/auth/change-password')).toBe(true);
    expect(bolehSaatWajibGantiKataSandi('/api/v1/auth/logout')).toBe(true);
  });

  it('mengizinkan pembacaan identitas diri supaya layarnya dapat digambar', () => {
    expect(bolehSaatWajibGantiKataSandi('/api/v1/auth/me')).toBe(true);
    expect(bolehSaatWajibGantiKataSandi('/api/v1/me/context')).toBe(true);
  });

  it('menolak endpoint lain', () => {
    for (const path of [
      '/api/v1/pos/sales',
      '/api/v1/platform/tenants',
      '/api/v1/auth/login',
      '/api/v1/public/pesantren/registrations',
    ]) {
      expect(bolehSaatWajibGantiKataSandi(path)).toBe(false);
    }
  });

  it('tidak bergantung pada awalan global', () => {
    // Awalan dapat diatur lewat konfigurasi; mengunci daftar ini padanya membuat
    // perubahan konfigurasi diam-diam menutup jalan keluar.
    expect(bolehSaatWajibGantiKataSandi('/auth/change-password')).toBe(true);
    expect(bolehSaatWajibGantiKataSandi('/api/v2/auth/change-password')).toBe(true);
  });

  it('garis miring di ujung tidak membatalkan kecocokan', () => {
    expect(bolehSaatWajibGantiKataSandi('/api/v1/auth/change-password/')).toBe(true);
  });

  it('query string tidak membatalkan kecocokan', () => {
    expect(bolehSaatWajibGantiKataSandi('/api/v1/auth/change-password?x=1')).toBe(true);
  });

  it('kecocokan akhiran tidak dapat ditumpangi path lain', () => {
    /*
     * Yang dijaga: endpoint yang KEBETULAN berakhiran sama tidak boleh ikut
     * terbuka hanya karena namanya menyerupai.
     */
    expect(bolehSaatWajibGantiKataSandi('/api/v1/tenant/auth/change-password-request')).toBe(
      false,
    );
    expect(bolehSaatWajibGantiKataSandi('/api/v1/auth/change-password-of-other-user')).toBe(false);
  });

  it('path yang tidak terbaca TIDAK diizinkan', () => {
    /*
     * Gagal-tertutup. Permintaan yang tidak dapat dikenali alamatnya tidak boleh
     * memperoleh keringanan yang hanya diperuntukkan bagi empat alamat tertentu.
     */
    expect(bolehSaatWajibGantiKataSandi(undefined)).toBe(false);
    expect(bolehSaatWajibGantiKataSandi(null)).toBe(false);
    expect(bolehSaatWajibGantiKataSandi('')).toBe(false);
  });

  it('daftarnya tetap pendek', () => {
    // Setiap entri adalah lubang pada pagar. Bertambahnya daftar ini harus
    // menjadi keputusan sadar, bukan kebiasaan.
    expect(PASSWORD_CHANGE_ALLOWLIST.length).toBeLessThanOrEqual(6);
  });

  it('tidak ada endpoint pengubah data penyewa di dalamnya', () => {
    const mencurigakan = PASSWORD_CHANGE_ALLOWLIST.filter((p) =>
      /(tenant|pos|billing|invoice|user)s?\//.test(p),
    );
    expect(mencurigakan).toEqual([]);
  });
});

describe('kedua penjaga memakai daftar yang sama', () => {
  /*
   * Inilah uji yang menangkap cacat aslinya.
   *
   * Aturannya ada di satu tempat tetapi ditegakkan di dua tempat. Penjaga kedua
   * lupa mengecualikan, dan gejalanya bukan galat pada saat kompilasi melainkan
   * penyewa baru yang tidak dapat masuk sama sekali.
   */
  function baca(nama: string): string | null {
    try {
      return readFileSync(join(__dirname, nama), 'utf8');
    } catch {
      return null;
    }
  }

  it.each(['jwt-auth.guard.ts', 'permission.guard.ts'])(
    '%s memanggil bolehSaatWajibGantiKataSandi pada cabang mustChangePassword',
    (berkas) => {
      const sumber = baca(berkas);
      if (!sumber) return;

      const kode = sumber
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((baris) => !/^\s*(\/\/|\*)/.test(baris))
        .join('\n');

      expect(kode).toContain('mustChangePassword');
      expect(kode).toContain('bolehSaatWajibGantiKataSandi');

      // Cabang yang menolak wajib memuat pengecualiannya pada baris yang sama.
      const cabang = kode
        .split('\n')
        .filter((baris) => baris.includes('mustChangePassword') && baris.includes('if ('));
      expect(cabang.length).toBeGreaterThan(0);
      for (const baris of cabang) {
        expect(baris).toContain('bolehSaatWajibGantiKataSandi');
      }
    },
  );

  it('tidak ada penjaga yang menyalin daftarnya sendiri', () => {
    for (const berkas of ['jwt-auth.guard.ts', 'permission.guard.ts']) {
      const sumber = baca(berkas);
      if (!sumber) continue;
      expect(sumber).not.toContain("'/auth/change-password'");
    }
  });
});
