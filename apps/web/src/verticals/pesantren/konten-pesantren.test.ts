/**
 * Pengujian sumber isi dokumen ePesantren.
 *
 * Presentasi, Proposal, Draft PKS, dan Surat Penawaran membaca berkas yang sama.
 * Yang dijaga di sini adalah hal-hal yang, bila salah, muncul pada dokumen yang
 * sudah terlanjur dikirim ke pondok — bukan pada layar pengembang.
 */

import { describe, expect, it } from 'vitest';
import {
  DI_LUAR_BIAYA,
  HARGA_PER_SANTRI,
  INDIKATOR,
  KANAL,
  KECERDASAN_BUATAN,
  KESIAPAN_BERTAHAP,
  KESIAPAN_SEKARANG,
  KETENTUAN_HARGA,
  KEUNGGULAN,
  KOLABORASI_BMT,
  MASALAH,
  MITRA_BMT,
  OPEN_API,
  PENYEDIA,
  PILAR,
  SIFAT_SOLUSI,
  TAHAPAN,
  type Butir,
} from './konten-pesantren';

const SELURUH_BUTIR: Array<[string, Butir[]]> = [
  ['INDIKATOR', INDIKATOR],
  ['MASALAH', MASALAH],
  ['SIFAT_SOLUSI', SIFAT_SOLUSI],
  ['KECERDASAN_BUATAN', KECERDASAN_BUATAN],
  ['OPEN_API', OPEN_API],
  ['KEUNGGULAN', KEUNGGULAN],
  ['KOLABORASI_BMT', KOLABORASI_BMT],
];

describe('kelengkapan isi', () => {
  it.each(SELURUH_BUTIR)('%s tidak memuat butir kosong', (_nama, daftar) => {
    /*
     * Butir kosong tidak menghasilkan galat: ia menghasilkan kartu kosong pada
     * slide di depan pengurus pondok, atau baris kosong pada proposal yang
     * sudah dicetak.
     */
    expect(daftar.length).toBeGreaterThan(0);
    const cacat = daftar.filter((b) => b.judul.trim().length < 2 || b.isi.trim().length < 10);
    expect(cacat).toEqual([]);
  });

  it('delapan pilar, bernomor 1 sampai 8 tanpa kembar', () => {
    expect(PILAR).toHaveLength(8);
    expect([...PILAR.map((p) => p.nomor)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('setiap pilar punya ringkasan dan butir yang terisi', () => {
    const cacat = PILAR.filter(
      (p) => p.nama.trim().length < 5 || p.ringkas.trim().length < 30 || p.butir.length < 3,
    );
    expect(cacat.map((p) => p.nama)).toEqual([]);
  });

  it('butir di dalam pilar tidak ada yang kosong', () => {
    const cacat = PILAR.flatMap((p) =>
      p.butir
        .filter((b) => b.judul.trim().length < 2 || b.isi.trim().length < 10)
        .map((b) => `${p.nama}: ${b.judul}`),
    );
    expect(cacat).toEqual([]);
  });

  it('enam tahapan berurutan', () => {
    expect(TAHAPAN.map((t) => t.nomor)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('kanal dan mitra terisi', () => {
    expect(KANAL.length).toBeGreaterThan(3);
    expect(MITRA_BMT.profil.length).toBeGreaterThan(0);
    expect(MITRA_BMT.produk.length).toBeGreaterThan(0);
    expect(MITRA_BMT.unitUsaha.length).toBeGreaterThan(0);
  });
});

describe('harga', () => {
  it('harga dasar Rp 2.000', () => {
    expect(HARGA_PER_SANTRI).toBe(2000);
  });

  it('ketentuan harga menyebut bahwa harga dapat berubah', () => {
    /*
     * Kalimat itu bukan basa-basi: harga sebenarnya hidup di katalog harga
     * berversi, dan kontrak tiap pondok dapat menimpanya. Dokumen yang tidak
     * mengatakannya membuat angka di sini tampak final.
     */
    const gabung = KETENTUAN_HARGA.join(' ').toLowerCase();
    expect(gabung).toContain('kesepakatan');
  });

  it('ketentuan harga menyebut penagihan per pondok, bukan per santri', () => {
    expect(KETENTUAN_HARGA.join(' ').toLowerCase()).toContain('per pondok');
  });

  it('ketentuan harga menyebut data contoh tidak ditagihkan', () => {
    expect(KETENTUAN_HARGA.join(' ').toLowerCase()).toContain('contoh');
  });

  it('yang di luar biaya disebutkan, bukan didiamkan', () => {
    // Biaya yang tidak disebut di penawaran adalah biaya yang menjadi keberatan
    // saat ditagihkan.
    expect(DI_LUAR_BIAYA.length).toBeGreaterThan(3);
    expect(DI_LUAR_BIAYA.join(' ').toLowerCase()).toContain('perangkat keras');
  });
});

describe('kejujuran kesiapan', () => {
  it('dua daftar kesiapan terisi', () => {
    expect(KESIAPAN_SEKARANG.length).toBeGreaterThan(3);
    expect(KESIAPAN_BERTAHAP.length).toBeGreaterThan(3);
  });

  it('tidak ada butir yang mengaku siap sekaligus bertahap', () => {
    /*
     * Butir yang muncul di kedua daftar membuat dokumen menjawab dua hal
     * berbeda tentang hal yang sama, tergantung bagian mana yang dibaca.
     */
    const kembar = KESIAPAN_SEKARANG.filter((s) => KESIAPAN_BERTAHAP.includes(s));
    expect(kembar).toEqual([]);
  });

  it('modul yang belum dibangun ada di daftar bertahap, bukan daftar siap', () => {
    // Ketiganya memang belum ada. Menaruhnya di daftar "siap" adalah janji yang
    // ditemukan pondok pada minggu pertama.
    const siap = KESIAPAN_SEKARANG.join(' ').toLowerCase();
    for (const belum of ['tahfiz', 'asrama', 'anjungan']) {
      expect(siap).not.toContain(belum);
    }
    const bertahap = KESIAPAN_BERTAHAP.join(' ').toLowerCase();
    for (const belum of ['tahfiz', 'asrama', 'anjungan']) {
      expect(bertahap).toContain(belum);
    }
  });
});

describe('identitas penyedia', () => {
  it('terisi dan dapat dihubungi', () => {
    expect(PENYEDIA.nama.length).toBeGreaterThan(3);
    expect(PENYEDIA.alamat.length).toBeGreaterThan(20);
    expect(PENYEDIA.surel).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    expect(PENYEDIA.telepon.length).toBeGreaterThan(6);
    expect(PENYEDIA.portal).toBe('santri.info');
  });
});
