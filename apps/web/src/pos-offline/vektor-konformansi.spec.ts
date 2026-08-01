/**
 * Konformansi terhadap vektor aturan bersama.
 *
 * Klien kasir kedua (Flutter, ADR-012) mengimplementasikan seluruh aturan luring
 * dalam Dart. Aturan uang lalu punya dua implementasi dalam dua bahasa, dan
 * penyimpangannya tidak menampakkan diri sebagai galat — melainkan sebagai
 * pembeli yang ditagih berbeda dari struk sebelumnya.
 *
 * `packages/pos-rules-vectors/vectors.json` adalah kontraknya: masukan beserta
 * keluaran yang wajib dihasilkan sama oleh setiap implementasi.
 *
 * Berkas ini menjaga sisi TypeScript-nya. Yang dijaganya bukan kebenaran nilai —
 * itu tugas uji satuan masing-masing modul, yang ditulis tangan terhadap harapan
 * yang dipikirkan orang. Yang dijaganya adalah bahwa **vektornya masih
 * menggambarkan kode yang sekarang**: aturan yang diubah tanpa membangkitkan
 * ulang vektornya akan merah di sini, bukan diam-diam menyimpang dari Dart.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hitungBarisLuring,
  hitungKembalian,
  hitungKeranjangLuring,
  keDesimal,
  keSatuanTerkecil,
  pecahanMataUang,
  type TarifLuring,
} from './harga-luring';
import { ambilNomor, nilaiBlok, sisaBlok } from './blok-struk';
import { nilaiKesegaran } from './katalog';
import { jedaPercobaan, nilaiKoneksi, warnaKoneksi } from './koneksi';
import { HASH_AWAL, bahanHash, bahanMuatan } from './ledger';

/*
 * Dipetakan dari direktori kerja, bukan `import.meta.url`.
 *
 * Vitest menjalankan berkas uji pada lingkungan jsdom, dan di sana
 * `import.meta.url` bukan URL berskema `file:` — `readFileSync` menolaknya.
 * Direktori kerjanya selalu `apps/web`, sebab di situlah konfigurasinya berada.
 */
const BERKAS_VEKTOR = resolve(process.cwd(), '../../packages/pos-rules-vectors/vectors.json');
const BERKAS_LEDGER = resolve(process.cwd(), 'src/pos-offline/ledger.ts');

interface Vektor {
  now: number;
  satuanTerkecil: Array<{ teks: string; pecahan: number; satuan: number; kembali: string }>;
  pecahanMataUang: Array<{ kode: string; pecahan: number }>;
  baris: Array<{ masukan: never; currencyCode: string; hasil: unknown }>;
  keranjang: Array<{ lines: never[]; currencyCode: string; hasil: unknown }>;
  kembalian: Array<{ total: string; diserahkan: string; currencyCode: string; hasil: unknown }>;
  nomorStruk: Array<{
    blok: never;
    sisa: number;
    nomor: string | null;
    nextSesudah: number | null;
    penilaian: { state: string; remaining: number };
    penilaianRegisterLain: string;
  }>;
  kesegaranKatalog: Array<{
    jenis: never;
    bagianUmur: number | null;
    level: string;
    usable: boolean;
    ageMs: number | null;
  }>;
  keadaanKoneksi: Array<{ masukan: never; state: string; queueing: boolean; warna: string }>;
  jedaPercobaan: Array<{ gagal: number; jedaMs: number }>;
  bahanHash: {
    hashAwal: string;
    muatan: never;
    bahanMuatan: string;
    barisTanpaMuatan: never;
    bahanTanpaMuatan: string;
    bahanDenganMuatan: string;
    barisReceiptNull: string;
  };
}

const v = JSON.parse(readFileSync(BERKAS_VEKTOR, 'utf8')) as Vektor;

const TARIF: TarifLuring[] = [
  { taxRateId: 'T1', code: 'PPN11', rate: 11, isInclusive: false },
  { taxRateId: 'T2', code: 'PPN11I', rate: 11, isInclusive: true },
];

describe('vektor konformansi masih menggambarkan kode yang sekarang', () => {
  it('perubahan desimal ke satuan terkecil', () => {
    for (const k of v.satuanTerkecil) {
      expect(keSatuanTerkecil(k.teks, k.pecahan), `${k.teks} @${k.pecahan}`).toBe(k.satuan);
      expect(keDesimal(k.satuan, k.pecahan), `kembali ${k.teks}`).toBe(k.kembali);
    }
  });

  it('pecahan mata uang', () => {
    for (const k of v.pecahanMataUang) expect(pecahanMataUang(k.kode)).toBe(k.pecahan);
  });

  it('perhitungan baris', () => {
    for (const k of v.baris) {
      expect(hitungBarisLuring(k.masukan, TARIF, k.currencyCode)).toEqual(k.hasil);
    }
  });

  it('total keranjang', () => {
    for (const k of v.keranjang) {
      expect(hitungKeranjangLuring(k.lines, TARIF, k.currencyCode)).toEqual(k.hasil);
    }
  });

  it('kembalian', () => {
    for (const k of v.kembalian) {
      expect(hitungKembalian(k.total, k.diserahkan, k.currencyCode)).toEqual(k.hasil);
    }
  });

  it('jatah nomor struk', () => {
    for (const k of v.nomorStruk) {
      expect(sisaBlok(k.blok)).toBe(k.sisa);
      const diambil = ambilNomor(k.blok);
      expect(diambil?.nomor ?? null).toBe(k.nomor);
      expect(diambil?.blok.nextNumber ?? null).toBe(k.nextSesudah);
      const p = nilaiBlok(k.blok, 'REG1');
      expect(p.state).toBe(k.penilaian.state);
      expect(p.remaining).toBe(k.penilaian.remaining);
      expect(nilaiBlok(k.blok, 'REG2').state).toBe(k.penilaianRegisterLain);
    }
  });

  it('kesegaran katalog', () => {
    for (const k of v.kesegaranKatalog) {
      const h = nilaiKesegaran({
        jenis: k.jenis,
        syncedAt: k.ageMs === null ? null : v.now - (k.ageMs as number),
        now: v.now,
      });
      expect(h.level, `${k.jenis} @${k.bagianUmur}`).toBe(k.level);
      expect(h.usable).toBe(k.usable);
    }
  });

  it('keadaan sambungan', () => {
    for (const k of v.keadaanKoneksi) {
      const h = nilaiKoneksi({ ...(k.masukan as object), now: v.now } as never);
      expect(h.state).toBe(k.state);
      expect(h.queueing).toBe(k.queueing);
      expect(warnaKoneksi(h.state)).toBe(k.warna);
    }
  });

  it('jeda percobaan ulang', () => {
    for (const k of v.jedaPercobaan) expect(jedaPercobaan(k.gagal)).toBe(k.jedaMs);
  });
});

describe('bahan hash — kontrak paling menentukan', () => {
  /*
   * Rantai hash hanya berguna bila kedua implementasi menyusun teks yang PERSIS
   * sama sebelum menghashnya. Satu pemisah yang berbeda, dan rantai yang dibuat
   * klien Flutter akan dilaporkan rusak ketika diperiksa klien web — atau
   * sebaliknya, kerusakan sungguhan akan lolos.
   */
  it('hash awal', () => {
    expect(HASH_AWAL).toBe(v.bahanHash.hashAwal);
  });

  it('bahan muatan transaksi', () => {
    expect(bahanMuatan(v.bahanHash.muatan)).toBe(v.bahanHash.bahanMuatan);
  });

  it('bahan baris tanpa rincian', () => {
    expect(bahanHash(v.bahanHash.barisTanpaMuatan)).toBe(v.bahanHash.bahanTanpaMuatan);
  });

  it('bahan baris dengan rincian mengawali bahan tanpa rincian', () => {
    // Medan `payloadHash` ditambahkan di UJUNG dengan cadangan string kosong,
    // supaya baris lama menghasilkan teks yang persis sama seperti dahulu.
    expect(bahanHash({ ...(v.bahanHash.barisTanpaMuatan as object), payloadHash: 'a'.repeat(64) } as never))
      .toBe(v.bahanHash.bahanDenganMuatan);
    expect(v.bahanHash.bahanDenganMuatan.startsWith(v.bahanHash.bahanTanpaMuatan)).toBe(true);
  });

  it('nomor struk kosong dan nomor struk null menghasilkan bahan berbeda', () => {
    /*
     * Keduanya harus dapat dibedakan. Tanpa pemisah antar-medan, baris tanpa
     * nomor struk tidak dapat dibedakan dari baris yang medan sesudahnya bergeser
     * satu — dan dua transaksi berbeda akan menghasilkan hash yang sama.
     */
    expect(v.bahanHash.barisReceiptNull).not.toBe(v.bahanHash.bahanTanpaMuatan);
  });

  it('pemisah medan adalah U+001F dan TIDAK ditulis sebagai karakter harfiah', () => {
    /*
     * Penjaga terhadap jebakan yang sungguh terjadi.
     *
     * Pemisahnya semula diketik langsung sebagai karakter U+001F di dalam tanda
     * kutip. Karena tidak dapat dicetak, barisnya terbaca `.join('')` pada
     * editor, diff, dan tinjauan kode mana pun — sehingga siapa pun yang
     * merapikan tanda kutip itu akan mengubah SETIAP hash dan membatalkan
     * seluruh rantai yang sudah tercatat, dengan diff yang tampak tidak berubah.
     *
     * Uji ini menjaga dua hal sekaligus: pemisahnya masih U+001F (nilai yang
     * TIDAK boleh berubah), dan sumbernya tidak lagi mengandung karakter kendali
     * yang tak terlihat.
     */
    expect(v.bahanHash.bahanTanpaMuatan).toContain('\u001F');

    const sumber = readFileSync(BERKAS_LEDGER, 'utf8');
    const kendali = [...sumber].filter((c) => {
      const k = c.charCodeAt(0);
      return k < 32 && k !== 9 && k !== 10 && k !== 13;
    });
    expect(kendali, 'ledger.ts memuat karakter kendali tak terlihat').toEqual([]);
  });
});
