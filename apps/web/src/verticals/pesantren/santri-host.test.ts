/**
 * Pengujian pengenalan host santri.info.
 *
 * Yang dijaga di sini: apex adalah PORTAL, subdomain adalah PONDOK. Menyamakan
 * keduanya berarti setiap pondok yang mendaftar kehilangan situsnya sendiri dan
 * hanya melihat halaman jualan platform — tanpa satu pun galat.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import {
  LABEL_TERPESAN_SANTRI,
  isSantriHost,
  isSantriPortalHost,
  slugPondokDariHost,
} from './santri-host';

describe('host portal', () => {
  it('apex dan www adalah portal', () => {
    expect(isSantriPortalHost('santri.info')).toBe(true);
    expect(isSantriPortalHost('www.santri.info')).toBe(true);
    expect(isSantriPortalHost('SANTRI.INFO')).toBe(true);
    expect(isSantriPortalHost('santri.info:443')).toBe(true);
    expect(isSantriPortalHost('santri.info.')).toBe(true);
  });

  it('subdomain pondok BUKAN portal', () => {
    expect(isSantriPortalHost('raudlatul-ulum.santri.info')).toBe(false);
  });

  it('domain lain bukan portal', () => {
    for (const h of ['ebisnis.id', 'santri.info.evil.com', 'notsantri.info', 'santri.infomedia.id']) {
      expect(isSantriPortalHost(h)).toBe(false);
    }
  });
});

describe('slug pondok', () => {
  it('subdomain satu tingkat menjadi slug', () => {
    expect(slugPondokDariHost('raudlatul-ulum.santri.info')).toBe('raudlatul-ulum');
    expect(slugPondokDariHost('Al-Hikam.SANTRI.INFO')).toBe('al-hikam');
  });

  it('apex dan www bukan pondok', () => {
    expect(slugPondokDariHost('santri.info')).toBeNull();
    expect(slugPondokDariHost('www.santri.info')).toBeNull();
  });

  it('label terpesan platform bukan pondok', () => {
    /*
     * `app.santri.info` benar-benar terdaftar sebagai pintu aplikasi. Bila ia
     * dibaca sebagai pondok bernama "app", halaman aplikasi berganti menjadi
     * pencarian penyewa yang tidak akan pernah ketemu — tanpa satu pun galat.
     */
    for (const label of LABEL_TERPESAN_SANTRI) {
      expect(slugPondokDariHost(`${label}.santri.info`)).toBeNull();
    }
  });

  it('label terpesan sisi peramban tidak berselisih dengan sisi API', () => {
    /*
     * Daftarnya ada di dua tempat karena keduanya memang dua program. Yang tidak
     * boleh adalah keduanya berbeda: label yang dilarang API tetapi diterima
     * peramban menghasilkan host platform yang tampak seperti pondok.
     *
     * Yang diperiksa hanya satu arah — setiap label API ada juga di sini. Sisi
     * peramban boleh lebih ketat; yang berbahaya adalah lebih longgar.
     */
    let sumber: string;
    try {
      sumber = readFileSync('../api/src/infrastructure/portal/portal-host.ts', 'utf8');
    } catch {
      return; // Dijalankan di luar monorepo; bukan urusan uji ini.
    }

    const blok = sumber.match(/LABEL_TERPESAN\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
    expect(blok, 'LABEL_TERPESAN tidak ditemukan di sisi API').not.toBeNull();

    const labelApi = [...blok![1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
    expect(labelApi.length).toBeGreaterThan(5);

    const hilang = labelApi.filter((l) => !LABEL_TERPESAN_SANTRI.has(l));
    expect(hilang).toEqual([]);
  });

  it('subdomain bertingkat ditolak', () => {
    /*
     * Bentuk `a.b.santri.info` tidak pernah dibuat pendaftaran, jadi
     * kemunculannya berarti seseorang sedang mencoba sesuatu. Menerimanya
     * sebagai slug `a.b` akan membuat pencarian penyewa memakai nilai yang tidak
     * pernah ada bentuknya di basis data.
     */
    expect(slugPondokDariHost('a.b.santri.info')).toBeNull();
  });

  it('slug berbentuk bukan label DNS ditolak', () => {
    expect(slugPondokDariHost('-awal.santri.info')).toBeNull();
    expect(slugPondokDariHost('akhir-.santri.info')).toBeNull();
    expect(slugPondokDariHost(`${'a'.repeat(64)}.santri.info`)).toBeNull();
  });

  it('domain yang sekadar MEMUAT santri.info ditolak', () => {
    // `santri.info.evil.com` berakhir dengan `evil.com`, bukan `santri.info`.
    expect(slugPondokDariHost('pondok.santri.info.evil.com')).toBeNull();
  });
});

describe('milik ekosistem santri.info', () => {
  it('portal dan pondok keduanya masuk', () => {
    expect(isSantriHost('santri.info')).toBe(true);
    expect(isSantriHost('raudlatul-ulum.santri.info')).toBe(true);
  });

  it('domain sendiri milik pondok TIDAK dikenali dari sini', () => {
    /*
     * Pondok boleh memakai domainnya sendiri (`raudlatul-ulum.com`). Host itu
     * tidak dapat dikenali dari bentuknya — hanya registry yang tahu. Karena itu
     * fungsi ini menjawab false, dan yang memutuskannya adalah API.
     *
     * Menebaknya di peramban berarti setiap domain yang belum terdaftar tampak
     * seperti pondok yang sah.
     */
    expect(isSantriHost('raudlatul-ulum.com')).toBe(false);
  });

  it('domain lain di luar ekosistem', () => {
    expect(isSantriHost('ebisnis.id')).toBe(false);
  });
});
