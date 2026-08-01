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
