/**
 * Pengujian katalog portal.
 *
 * Katalog ini menentukan host mana melayani merek mana. Kesalahannya tidak
 * menghasilkan galat: ia menghasilkan portal yang tidak pernah dapat dibuka,
 * atau dua portal yang saling merebut satu host.
 */

import {
  HOST_AUTH_KANONIK,
  KATALOG_PORTAL,
  seluruhHost,
} from './portal.catalog';
import { LABEL_TERPESAN, bolehMencariPortal } from './portal-host';
import { normalkanHost } from '../tenant/public-host';

describe('katalog portal', () => {
  it('memuat tepat portal yang diminta', () => {
    expect(KATALOG_PORTAL.map((p) => p.code)).toEqual([
      'EBISNIS',
      'ENTERPRISE_EDUCATION',
      'SANTRI_INFO',
      'EMEDIK',
      'EKOPERASI',
      'INFO_DESA',
    ]);
  });

  it('urutan tampil tidak kembar', () => {
    /*
     * `sortOrder` menentukan urutan portal pada footer ekosistem. Dua portal
     * dengan angka sama membuat urutannya bergantung pada urutan baca basis
     * data — dan itu berubah sendiri seiring tabelnya ditulis ulang.
     */
    const urutan = KATALOG_PORTAL.map((p) => p.sortOrder);
    expect(new Set(urutan).size).toBe(urutan.length);
  });

  it('portal boleh berbagi vertical, tetapi vertical harus dikenali', () => {
    /*
     * `SANTRI_INFO` sengaja memakai vertical yang sama dengan
     * `ENTERPRISE_EDUCATION`: merek berbeda, modul dan entitlement sama. Yang
     * dijaga di sini adalah kebalikannya — jangan sampai merek baru diam-diam
     * memperkenalkan vertical baru yang tidak punya modul, tidak punya harga,
     * dan tidak punya siapa pun yang menyediakannya.
     */
    const VERTICAL_DIKENALI = new Set([
      'CORE_ERP',
      'ENTERPRISE_EDUCATION',
      'HEALTH',
      'COOPERATIVE',
      'VILLAGE_GOVERNMENT',
    ]);
    for (const p of KATALOG_PORTAL) {
      expect(VERTICAL_DIKENALI.has(p.verticalCode)).toBe(true);
    }
  });

  it('setiap host sudah dalam bentuk ternormalkan', () => {
    /*
     * Basis data menolak host yang tidak ternormalkan lewat CHECK. Bila katalog
     * memuat satu saja yang tidak, seed gagal di tengah — dan yang gagal di
     * tengah meninggalkan sebagian portal terdaftar dan sebagian tidak.
     */
    for (const p of KATALOG_PORTAL) {
      for (const d of p.domains) {
        expect(normalkanHost(d.host)).toBe(d.host);
      }
    }
  });

  it('tidak ada host yang dipakai dua portal', () => {
    // Dua baris yang mengklaim host sama membuat jawaban bergantung pada urutan
    // baca — dan basis data akan menolaknya, di tengah seed.
    const semua = KATALOG_PORTAL.flatMap((p) => p.domains.map((d) => d.host));
    expect(new Set(semua).size).toBe(semua.length);
  });

  it('setiap portal punya tepat satu host kanonik per peran', () => {
    for (const p of KATALOG_PORTAL) {
      const perPeran = new Map<string, number>();
      for (const d of p.domains.filter((x) => x.isCanonical)) {
        perPeran.set(d.kind, (perPeran.get(d.kind) ?? 0) + 1);
      }
      expect([...perPeran.values()]).toEqual(perPeran.size === 0 ? [] : Array(perPeran.size).fill(1));
    }
  });

  it('setiap portal punya host publik dan pintu aplikasi', () => {
    for (const p of KATALOG_PORTAL) {
      expect(p.domains.some((d) => d.kind === 'PUBLIC' && d.isCanonical)).toBe(true);
      expect(p.domains.some((d) => d.kind === 'APP' && d.isCanonical)).toBe(true);
    }
  });

  it('penerbit identitas HANYA SATU untuk seluruh ekosistem', () => {
    /*
     * §521: hanya ada satu penerbit yang berwenang. Lima penerbit berarti lima
     * sumber kebenaran tentang siapa yang sedang masuk — dan sesi yang sah di
     * salah satunya tidak dapat dipercaya oleh yang lain.
     */
    const auth = KATALOG_PORTAL.flatMap((p) =>
      p.domains.filter((d) => d.kind === 'AUTH').map((d) => d.host),
    );
    expect(auth).toEqual([HOST_AUTH_KANONIK]);
  });

  it('seluruh host lolos pemeriksaan sebelum kueri', () => {
    for (const h of seluruhHost()) {
      expect(bolehMencariPortal(h).boleh).toBe(true);
    }
  });

  it('host aplikasi dan identitas memakai label terpesan', () => {
    /*
     * `app` dan `auth` memang harus terpesan — itulah sebabnya penyewa dilarang
     * memakainya. Uji ini mengikat kedua daftar: bila label dihapus dari daftar
     * terpesan, host platform sendiri menjadi dapat direbut penyewa.
     */
    for (const h of seluruhHost('APP')) {
      expect(LABEL_TERPESAN.has(h.split('.')[0])).toBe(true);
    }
    for (const h of seluruhHost('AUTH')) {
      expect(LABEL_TERPESAN.has(h.split('.')[0])).toBe(true);
    }
  });

  it('kode portal berbentuk huruf kapital dengan garis bawah', () => {
    // Basis data menolak bentuk lain lewat CHECK.
    for (const p of KATALOG_PORTAL) {
      expect(p.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('setiap portal punya keterangan untuk ditautkan portal lain', () => {
    // Tanpa ini, footer ekosistem hanya berisi nama tanpa keterangan — dan §487
    // meminta keterangannya.
    for (const p of KATALOG_PORTAL) {
      expect(p.crossLinkDescription.length).toBeGreaterThan(3);
      expect(p.tagline.length).toBeGreaterThan(10);
    }
  });

  it('seluruhHost menyaring menurut peran', () => {
    expect(seluruhHost('AUTH')).toEqual([HOST_AUTH_KANONIK]);
    expect(seluruhHost('APP')).toHaveLength(KATALOG_PORTAL.length);
    expect(seluruhHost()).toHaveLength(
      KATALOG_PORTAL.reduce((n, p) => n + p.domains.length, 0),
    );
  });
});
