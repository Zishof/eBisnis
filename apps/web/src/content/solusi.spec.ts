/**
 * Pengujian isi naskah penawaran.
 *
 * Yang dijaga di sini bukan gaya bahasa, melainkan dua hal yang bila salah akan
 * terbawa keluar ke calon penyewa:
 *
 * 1. **Angka harus konsisten.** Beranda, Presentasi, Proposal, PKS, dan Surat
 *    Penawaran menyebut nominal yang sama karena mengambil dari berkas yang sama.
 *    Simulasi biaya harus benar-benar merupakan hasil penjumlahan komponennya —
 *    bukan angka yang diketik terpisah dan lambat laun tertinggal.
 * 2. **Janji harus jujur.** Setiap kemampuan wajib menyatakan tahapnya. Yang
 *    belum ada tidak boleh kehilangan penandanya lalu terbaca seolah sudah ada.
 */

import { describe, expect, it } from 'vitest';
import {
  APLIKASI_KLIEN,
  DOKUMEN,
  KELOMPOK_KEMAMPUAN,
  LABEL_TAHAP,
  PAKET_PUSAT,
  PEMBANDING,
  PETA_JALAN,
  SIMULASI,
  TARIF_POS,
} from './solusi';

describe('naskah penawaran', () => {
  it('tarif POS menurun seiring bertambahnya outlet', () => {
    // Janji "makin banyak outlet, makin hemat" harus benar-benar terbukti pada
    // angkanya, bukan hanya pada kalimat pemasarannya.
    for (let i = 1; i < TARIF_POS.length; i += 1) {
      expect(TARIF_POS[i].pertama).toBeLessThan(TARIF_POS[i - 1].pertama);
      expect(TARIF_POS[i].tambahan).toBeLessThan(TARIF_POS[i - 1].tambahan);
    }
  });

  it('POS tambahan selalu lebih murah daripada POS pertama', () => {
    for (const t of TARIF_POS) {
      expect(t.tambahan).toBeLessThan(t.pertama);
    }
  });

  it('simulasi biaya benar-benar merupakan penjumlahan komponennya', () => {
    for (const s of SIMULASI) {
      expect(s.pos + s.pusat).toBe(s.total);
    }
  });

  it('simulasi memakai harga paket pusat yang sungguh ada', () => {
    const full = PAKET_PUSAT.find((p) => p.kode === 'FULL');
    expect(full).toBeDefined();
    for (const s of SIMULASI) {
      expect(s.pusat).toBe(full?.harga);
    }
  });

  it('simulasi POS cocok dengan tarif berjenjang, asumsi dua unit per outlet', () => {
    /*
     * Pemeriksaan inilah yang paling mudah luput saat harga disunting: seseorang
     * menurunkan tarif POS tetapi lupa menghitung ulang simulasinya, dan calon
     * penyewa membaca dua angka yang tidak saling cocok pada halaman yang sama.
     */
    const jenjang = (outlet: number) => {
      if (outlet <= 5) return TARIF_POS[0];
      if (outlet <= 20) return TARIF_POS[1];
      if (outlet <= 50) return TARIF_POS[2];
      return TARIF_POS[3];
    };
    for (const s of SIMULASI) {
      const t = jenjang(s.outlet);
      // Dua unit per outlet: satu POS pertama + satu POS tambahan.
      expect(s.pos).toBe(s.outlet * (t.pertama + t.tambahan));
    }
  });

  it('paket pusat tersusun dari yang termurah ke termahal', () => {
    for (let i = 1; i < PAKET_PUSAT.length; i += 1) {
      expect(PAKET_PUSAT[i].harga).toBeGreaterThan(PAKET_PUSAT[i - 1].harga);
    }
  });

  it('hanya satu paket yang ditandai unggulan', () => {
    expect(PAKET_PUSAT.filter((p) => p.unggulan)).toHaveLength(1);
  });

  it('setiap kemampuan menyatakan tahapnya', () => {
    for (const k of KELOMPOK_KEMAMPUAN) {
      expect(k.butir.length).toBeGreaterThan(0);
      for (const b of k.butir) {
        expect(Object.keys(LABEL_TAHAP)).toContain(b.tahap);
        expect(b.isi.length).toBeGreaterThan(30);
      }
    }
  });

  it('ada kemampuan yang masih dibangun atau direncanakan', () => {
    /*
     * Bila suatu hari SELURUH butir bertanda "sudah berjalan", kemungkinan
     * besar yang terjadi bukan semuanya selesai, melainkan penandanya yang
     * diseragamkan tanpa dipikirkan. Uji ini memaksa perubahan seperti itu
     * dilakukan secara sadar.
     */
    const semua = KELOMPOK_KEMAMPUAN.flatMap((k) => k.butir);
    expect(semua.some((b) => b.tahap !== 'BERJALAN')).toBe(true);
  });

  it('peta jalan menyebutkan setidaknya satu fase yang sudah berjalan', () => {
    expect(PETA_JALAN.some((f) => f.tahap === 'BERJALAN')).toBe(true);
    expect(PETA_JALAN.some((f) => f.tahap === 'DIBANGUN')).toBe(true);
  });

  it('setiap baris perbandingan menyertakan alasannya', () => {
    // Perbandingan tanpa alasan hanyalah klaim. Alasannya yang membuatnya dapat
    // dipertanggungjawabkan bila calon penyewa bertanya "buktinya mana?".
    for (const p of PEMBANDING) {
      expect(p.umum.length).toBeGreaterThan(10);
      expect(p.kami.length).toBeGreaterThan(10);
      expect(p.mengapa.length).toBeGreaterThan(40);
    }
  });

  it('empat dokumen penawaran menunjuk ke rute yang berbeda', () => {
    const url = DOKUMEN.map((d) => d.url);
    expect(new Set(url).size).toBe(url.length);
    expect(url).toEqual(['/presentasi', '/proposal', '/pks', '/penawaran']);
  });

  it('tiga aplikasi klien menyebut repositorinya', () => {
    expect(APLIKASI_KLIEN).toHaveLength(3);
    for (const a of APLIKASI_KLIEN) {
      expect(a.repo).toMatch(/^ais-/);
    }
  });
});
