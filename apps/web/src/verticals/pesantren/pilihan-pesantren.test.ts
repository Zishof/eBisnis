/**
 * Pengujian pilihan formulir pendaftaran pesantren.
 *
 * Dua hal yang dijaga:
 *
 * 1. Formulir tetap dapat diisi ketika peladen tidak menjawab. Cacat yang
 *    diperbaiki: tiga pertanyaan wajib tergambar sebagai judul kosong, tanpa
 *    galat, pada langkah yang tidak dapat dilewati.
 * 2. Kode di sini tidak berselisih dengan katalog peladen. Kode yang berbeda
 *    tidak menghasilkan galat saat digambar — ia menghasilkan kiriman yang
 *    ditolak "tidak dikenali", sesudah lima langkah diisi.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import {
  AFILIASI_BAWAAN,
  DOMAIN_SITUS_BAWAAN,
  JENJANG_BAWAAN,
  SANTRI_DILAYANI_BAWAAN,
  TIPE_PESANTREN_BAWAAN,
  pilihanDipakai,
  rapikanNamaPengguna,
  rapikanSlug,
} from './pilihan-pesantren';

const SUMBER_API = '../api/src/modules/public/pesantren-registration.ts';

function bacaSumberApi(): string | null {
  try {
    return readFileSync(SUMBER_API, 'utf8');
  } catch {
    return null; // Dijalankan di luar monorepo; bukan urusan uji ini.
  }
}

describe('pilihan bawaan', () => {
  it('tidak ada daftar yang kosong', () => {
    /*
     * Inilah bentuk cacatnya: daftar kosong tergambar sebagai judul tanpa isi.
     * Uji ini menyala sebelum halamannya sempat menampilkannya.
     */
    expect(TIPE_PESANTREN_BAWAAN.length).toBeGreaterThan(0);
    expect(SANTRI_DILAYANI_BAWAAN.length).toBeGreaterThan(0);
    expect(JENJANG_BAWAAN.length).toBeGreaterThan(0);
    expect(AFILIASI_BAWAAN.length).toBeGreaterThan(0);
  });

  it('setiap pilihan punya kode dan label yang terbaca', () => {
    const semua = [...TIPE_PESANTREN_BAWAAN, ...SANTRI_DILAYANI_BAWAAN, ...JENJANG_BAWAAN];
    const cacat = semua.filter((p) => !p.code.trim() || p.label.trim().length < 2);
    expect(cacat).toEqual([]);
  });

  it('kode tidak kembar', () => {
    for (const daftar of [TIPE_PESANTREN_BAWAAN, SANTRI_DILAYANI_BAWAAN, JENJANG_BAWAAN]) {
      const kode = daftar.map((p) => p.code);
      expect(new Set(kode).size).toBe(kode.length);
    }
  });
});

describe('pilihanDipakai', () => {
  const bawaan = [{ code: 'A', label: 'A' }];
  const peladen = [{ code: 'B', label: 'B' }];

  it('jawaban peladen menang bila ada isinya', () => {
    expect(pilihanDipakai(peladen, bawaan)).toBe(peladen);
  });

  it('tidak ada jawaban jatuh ke bawaan', () => {
    expect(pilihanDipakai(undefined, bawaan)).toBe(bawaan);
  });

  it('larik KOSONG dari peladen juga jatuh ke bawaan', () => {
    /*
     * Peladen yang menjawab `[]` menghasilkan layar yang persis sama dengan
     * peladen yang tidak menjawab: judul tanpa pilihan. Karena tidak dapat
     * dibedakan pengurus pondok, keduanya diperlakukan sama.
     */
    expect(pilihanDipakai([], bawaan)).toBe(bawaan);
  });
});

describe('sepadan dengan katalog peladen', () => {
  function kodeDariLarik(sumber: string, nama: string): string[] {
    const cocok = sumber.match(new RegExp(`${nama}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`));
    if (!cocok) return [];
    return [...cocok[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
  }

  it('tipe pesantren sepadan', () => {
    const sumber = bacaSumberApi();
    if (!sumber) return;
    const api = kodeDariLarik(sumber, 'TIPE_PESANTREN');
    expect(api.length).toBeGreaterThan(0);
    expect(TIPE_PESANTREN_BAWAAN.map((p) => p.code)).toEqual(api);
  });

  it('santri dilayani sepadan', () => {
    const sumber = bacaSumberApi();
    if (!sumber) return;
    const api = kodeDariLarik(sumber, 'SANTRI_DILAYANI');
    expect(api.length).toBeGreaterThan(0);
    expect(SANTRI_DILAYANI_BAWAAN.map((p) => p.code)).toEqual(api);
  });

  it('jenjang sepadan', () => {
    const sumber = bacaSumberApi();
    if (!sumber) return;

    const blok = sumber.match(/JENJANG_PESANTREN\s*=\s*\[([\s\S]*?)\]\s*as const/);
    expect(blok, 'JENJANG_PESANTREN tidak ditemukan di sisi API').not.toBeNull();

    const api = [...blok![1].matchAll(/code:\s*'([A-Z_]+)'/g)].map((m) => m[1]);
    expect(api.length).toBeGreaterThan(5);
    expect(JENJANG_BAWAAN.map((p) => p.code)).toEqual(api);
  });

  it('afiliasi sepadan', () => {
    const sumber = bacaSumberApi();
    if (!sumber) return;

    const blok = sumber.match(/AFILIASI_PESANTREN\s*=\s*\[([\s\S]*?)\]\s*as const/);
    if (!blok) return;

    const api = [...blok[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(AFILIASI_BAWAAN).toEqual(api);
  });

  it('domain situs sepadan', () => {
    const sumber = bacaSumberApi();
    if (!sumber) return;
    const cocok = sumber.match(/DOMAIN_PESANTREN\s*=\s*'([^']+)'/);
    expect(cocok?.[1]).toBe(DOMAIN_SITUS_BAWAAN);
  });
});

describe('merapikan ketikan alamat situs', () => {
  it('huruf besar dan spasi dibetulkan', () => {
    // Persis yang diketik orang: "Raudlatul Ulum" dan "RaudlatulUlum".
    expect(rapikanSlug('Raudlatul Ulum')).toBe('raudlatul-ulum');
    expect(rapikanSlug('RaudlatulUlum')).toBe('raudlatululum');
  });

  it('garis bawah menjadi tanda hubung', () => {
    // Alamat situs adalah label DNS; garis bawah tidak pernah sah di sana.
    expect(rapikanSlug('raudlatul_ulum')).toBe('raudlatul-ulum');
  });

  it('karakter yang tidak pernah sah dibuang', () => {
    expect(rapikanSlug('PP. Nurul Jadid!')).toBe('pp-nurul-jadid');
  });

  it('tanda hubung di ujung TIDAK dibuang', () => {
    /*
     * Orang yang baru mengetik "raudlatul-" sedang menuju "raudlatul-ulum".
     * Membuangnya membuat tanda hubung mustahil diketik.
     */
    expect(rapikanSlug('raudlatul-')).toBe('raudlatul-');
  });

  it('tanda hubung di awal dibuang, dan yang berlipat dirapatkan', () => {
    expect(rapikanSlug('--raudlatul--ulum')).toBe('raudlatul-ulum');
  });

  it('hasilnya tidak pernah melebihi batas label DNS', () => {
    expect(rapikanSlug('a'.repeat(200)).length).toBe(63);
  });
});

describe('merapikan ketikan nama pengguna', () => {
  it('huruf besar dan spasi menjadi garis bawah', () => {
    expect(rapikanNamaPengguna('Raudlatul Ulum')).toBe('raudlatul_ulum');
    expect(rapikanNamaPengguna('RaudlatulUlum')).toBe('raudlatululum');
  });

  it('tanda hubung menjadi garis bawah', () => {
    // Nama pengguna menjadi nama schema PostgreSQL; tanda hubung tidak sah.
    expect(rapikanNamaPengguna('raudlatul-ulum')).toBe('raudlatul_ulum');
  });

  it('angka di awal dibiarkan, bukan diberi awalan huruf', () => {
    /*
     * Membubuhkan huruf sambil orang mengetik memindahkan kursornya dan mengubah
     * apa yang baru saja ia ketik. Yang tersisa salah tetap ditangkap pemeriksa,
     * dengan pesan yang menjelaskan.
     */
    expect(rapikanNamaPengguna('3 Muhammadiyah')).toBe('3_muhammadiyah');
  });

  it('bentuk kedua kolom memang berbeda', () => {
    // Bila suatu hari salah satunya disalin dari yang lain, uji ini menyala.
    const ketikan = 'Raudlatul Ulum';
    expect(rapikanSlug(ketikan)).not.toBe(rapikanNamaPengguna(ketikan));
    expect(rapikanSlug(ketikan)).toContain('-');
    expect(rapikanNamaPengguna(ketikan)).toContain('_');
  });

  it('hasilnya tidak pernah melebihi batas nama schema', () => {
    expect(rapikanNamaPengguna('a'.repeat(200)).length).toBe(48);
  });
});
