/**
 * Membangkitkan vektor konformansi aturan kasir luring.
 *
 * ## Mengapa berkas ini ada
 *
 * Klien kasir kedua (Flutter, lihat ADR-012) memerlukan seluruh aturan luring
 * dalam Dart: aritmetika uang, jatah nomor struk, batas umur salinan, keadaan
 * sambungan, dan bahan hash buku transaksi. Itu berarti aturan uang punya dua
 * implementasi dalam dua bahasa.
 *
 * Duplikasinya tidak terhindarkan. Yang dapat dihindari adalah **menyimpangnya
 * diam-diam** — dan penyimpangan aturan uang tidak menampakkan diri sebagai
 * galat, melainkan sebagai pembeli yang ditagih berbeda dari struk sebelumnya.
 *
 * Karena itu keluaran naskah ini menjadi kontraknya: satu berkas JSON berisi
 * masukan dan keluaran yang **wajib dihasilkan sama** oleh kedua implementasi.
 * Penyimpangan berubah dari perbedaan yang baru ketahuan di kasir menjadi uji
 * yang merah pada CI.
 *
 * ## Mengapa dibangkitkan, bukan ditulis tangan
 *
 * Daftar yang disalin dengan tangan akan tertinggal pada perubahan pertama yang
 * terburu-buru, dan kontrak yang tertinggal lebih buruk daripada tidak ada
 * kontrak: ia memberi rasa aman tanpa menjaga apa pun.
 *
 * Yang menjaga kebenaran nilainya tetap uji satuan TypeScript-nya sendiri
 * (`harga-luring.spec.ts`, `ledger.spec.ts`, `koneksi-katalog.spec.ts`), yang
 * ditulis tangan terhadap harapan yang dipikirkan orang. Naskah ini hanya
 * memindahkan hasil yang sudah dijaga itu ke bentuk yang dapat dibaca Dart.
 *
 * Pemakaian:
 *   npx tsx scripts/buat-vektor-aturan.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as harga from '../src/pos-offline/harga-luring';
import * as blok from '../src/pos-offline/blok-struk';
import * as katalog from '../src/pos-offline/katalog';
import * as koneksi from '../src/pos-offline/koneksi';
import * as ledger from '../src/pos-offline/ledger';

const KELUARAN = fileURLToPath(new URL('../../../packages/pos-rules-vectors/', import.meta.url));

const SEKARANG = 1_800_000_000_000;

const PPN = { taxRateId: 'T1', code: 'PPN11', rate: 11, isInclusive: false };
const PPN_INKLUSIF = { taxRateId: 'T2', code: 'PPN11I', rate: 11, isInclusive: true };
const TARIF = [PPN, PPN_INKLUSIF];

/** Kasus baris yang mencakup ketiga bentuk pajak dan pembulatan yang sulit. */
const BARIS = [
  { productId: 'P1', name: 'Tanpa pajak', uomId: 'U1', quantity: 3, unitPrice: '18000', taxRateId: null },
  { productId: 'P2', name: 'Pajak eksklusif', uomId: 'U1', quantity: 1, unitPrice: '18000', taxRateId: 'T1' },
  { productId: 'P3', name: 'Pajak inklusif', uomId: 'U1', quantity: 1, unitPrice: '19980', taxRateId: 'T2' },
  { productId: 'P4', name: 'Pembulatan ganjil', uomId: 'U1', quantity: 3, unitPrice: '3333', taxRateId: 'T1' },
  { productId: 'P5', name: 'Tarif tak dikenal', uomId: 'U1', quantity: 2, unitPrice: '5000', taxRateId: 'HILANG' },
];

const vektor = {
  $comment:
    'Vektor konformansi aturan kasir luring. Dibangkitkan scripts/buat-vektor-aturan.mjs; ' +
    'JANGAN disunting dengan tangan. Setiap implementasi klien kasir wajib menghasilkan ' +
    'keluaran yang sama persis dari masukan yang sama. Lihat ADR-012.',
  generatedFrom: 'apps/web/src/pos-offline',
  now: SEKARANG,

  /*
   * Perubahan desimal ke satuan terkecil.
   *
   * Kasus `1.005` disertakan dengan sengaja: `Math.round(1.005 * 100)` bernilai
   * 100, bukan 101, sebab 1.005 tidak dapat diwakili persis dalam biner. Bahasa
   * lain punya jebakan yang sama dengan bentuk berbeda, dan vektor inilah yang
   * menangkapnya.
   */
  satuanTerkecil: ['18000', '18000.0000', '12.34', '12.3400', '12.345', '12.344', '1.005', '0.05', '', 'abc']
    .flatMap((teks) =>
      [1, 100].map((pecahan) => ({
        teks,
        pecahan,
        satuan: harga.keSatuanTerkecil(teks, pecahan),
        kembali: harga.keDesimal(harga.keSatuanTerkecil(teks, pecahan), pecahan),
      })),
    ),

  pecahanMataUang: ['IDR', 'USD', 'usd', 'XYZ'].map((kode) => ({
    kode,
    pecahan: harga.pecahanMataUang(kode),
  })),

  baris: BARIS.map((b) => ({
    masukan: b,
    currencyCode: 'IDR',
    hasil: harga.hitungBarisLuring(b, TARIF, 'IDR'),
  })),

  keranjang: [
    { lines: [], label: 'kosong' },
    { lines: BARIS.slice(0, 2), label: 'campuran tanpa dan dengan pajak' },
    { lines: [BARIS[3], BARIS[3], BARIS[3]], label: 'tiga baris pembulatan ganjil' },
    { lines: BARIS, label: 'seluruh bentuk' },
  ].map((k) => ({
    label: k.label,
    lines: k.lines,
    currencyCode: 'IDR',
    hasil: harga.hitungKeranjangLuring(k.lines, TARIF, 'IDR'),
  })),

  kembalian: [
    ['50000', '50000'],
    ['47500', '50000'],
    ['50000', '45000'],
    ['0', '0'],
  ].map(([total, diserahkan]) => ({
    total,
    diserahkan,
    currencyCode: 'IDR',
    hasil: harga.hitungKembalian(total, diserahkan, 'IDR'),
  })),

  /*
   * Jatah nomor struk. Ujung rentang disertakan pada keduanya: salah satu
   * langkah di sini berarti satu nomor terbuang tiap jatah, atau — jauh lebih
   * mahal — satu nomor diterbitkan dua kali.
   */
  nomorStruk: [1000, 1001, 1099, 1100].map((nextNumber) => {
    const b = {
      blockId: 'B1',
      terminalId: 'REG1',
      outletId: 'O1',
      prefix: 'INV-',
      padding: 6,
      fromNumber: 1000,
      toNumber: 1099,
      nextNumber,
      allocatedAt: '2026-08-01T00:00:00.000Z',
      businessDate: null,
    };
    const diambil = blok.ambilNomor(b);
    return {
      blok: b,
      sisa: blok.sisaBlok(b),
      nomor: diambil ? diambil.nomor : null,
      nextSesudah: diambil ? diambil.blok.nextNumber : null,
      penilaian: blok.nilaiBlok(b, 'REG1'),
      penilaianRegisterLain: blok.nilaiBlok(b, 'REG2').state,
    };
  }),

  kesegaranKatalog: ['HARGA', 'PAJAK', 'PRODUK', 'BARCODE', 'METODE_BAYAR'].flatMap((jenis) =>
    [null, 0, 0.4, 0.7, 1.5].map((bagian) => {
      const syncedAt = bagian === null ? null : SEKARANG - katalog.BATAS_UMUR_MS[jenis] * bagian;
      const h = katalog.nilaiKesegaran({ jenis, syncedAt, now: SEKARANG });
      return { jenis, bagianUmur: bagian, level: h.level, usable: h.usable, ageMs: h.ageMs };
    }),
  ),

  keadaanKoneksi: [
    { browserOnline: true, lastReachableAt: SEKARANG - 1000, lastAttemptAt: SEKARANG, lastAttemptOk: true },
    { browserOnline: false, lastReachableAt: SEKARANG - 1000, lastAttemptAt: SEKARANG, lastAttemptOk: true },
    { browserOnline: true, lastReachableAt: SEKARANG - 1000, lastAttemptAt: SEKARANG, lastAttemptOk: false },
    { browserOnline: true, lastReachableAt: null, lastAttemptAt: null, lastAttemptOk: null },
    { browserOnline: true, lastReachableAt: SEKARANG - koneksi.AMBANG_DIAM_MS, lastAttemptAt: SEKARANG, lastAttemptOk: true },
    { browserOnline: true, lastReachableAt: SEKARANG - koneksi.AMBANG_DIAM_MS - 1, lastAttemptAt: SEKARANG, lastAttemptOk: true },
  ].map((m) => {
    const h = koneksi.nilaiKoneksi({ ...m, now: SEKARANG });
    return { masukan: m, state: h.state, queueing: h.queueing, warna: koneksi.warnaKoneksi(h.state) };
  }),

  jedaPercobaan: [0, 1, 2, 3, 5, 10, 50].map((gagal) => ({
    gagal,
    jedaMs: koneksi.jedaPercobaan(gagal),
  })),

  /*
   * Bahan hash — vektor paling menentukan pada berkas ini.
   *
   * Rantai hash buku transaksi hanya berguna bila kedua implementasi menyusun
   * teks yang **persis sama** sebelum menghashnya. Satu pemisah yang berbeda,
   * satu medan yang urutannya tertukar, dan rantai yang dibuat klien Flutter
   * akan dilaporkan rusak ketika diperiksa klien web — atau sebaliknya, dan
   * kerusakan sungguhan akan lolos.
   *
   * Yang dibandingkan teksnya, bukan hasil SHA-256-nya: bila teksnya sama,
   * hashnya pasti sama, dan bila berbeda maka teksnyalah yang menunjukkan di
   * mana letak bedanya.
   */
  bahanHash: (() => {
    const muatan = {
      lines: [
        {
          productId: 'P1',
          uomId: 'U1',
          quantity: 2,
          unitPrice: '18000',
          lineSubtotal: '36000',
          taxAmount: '0',
          lineTotal: '36000',
          taxRateId: null,
        },
        {
          productId: 'P2',
          uomId: null,
          quantity: 1,
          unitPrice: '8000',
          lineSubtotal: '8000',
          taxAmount: '880',
          lineTotal: '8880',
          taxRateId: 'T1',
        },
      ],
      payments: [
        { paymentMethodId: 'TUNAI', amount: '44880', tenderedAmount: '50000', reference: null },
      ],
      subtotal: '44000',
      taxTotal: '880',
      changeTotal: '5120',
      currencyCode: 'IDR',
      catalogSyncedAt: '2026-08-01T00:00:00.000Z',
    };

    const barisTanpaMuatan = {
      offlineId: 'off-1',
      sequence: 1,
      outletId: 'O1',
      terminalId: 'T1',
      shiftId: 'S1',
      businessDate: '2026-08-01',
      grandTotal: '44880',
      itemCount: 3,
      occurredAt: '2026-08-01T01:00:00.000Z',
      receiptNumber: 'ST-000001',
      previousHash: ledger.HASH_AWAL,
    };

    return {
      hashAwal: ledger.HASH_AWAL,
      muatan,
      bahanMuatan: ledger.bahanMuatan(muatan),
      // Baris lama tanpa rincian: bahan hashnya WAJIB sama seperti sebelum medan
      // rinciannya ada, supaya rantai yang sudah ada tetap sah.
      barisTanpaMuatan,
      bahanTanpaMuatan: ledger.bahanHash(barisTanpaMuatan),
      bahanDenganMuatan: ledger.bahanHash({ ...barisTanpaMuatan, payloadHash: 'a'.repeat(64) }),
      barisReceiptNull: ledger.bahanHash({ ...barisTanpaMuatan, receiptNumber: null }),
    };
  })(),
};

mkdirSync(KELUARAN, { recursive: true });
writeFileSync(`${KELUARAN}vectors.json`, `${JSON.stringify(vektor, null, 2)}\n`);

const jumlah = Object.entries(vektor)
  .filter(([, v]) => Array.isArray(v))
  .map(([k, v]) => `${k}=${v.length}`)
  .join(', ');
console.log(`packages/pos-rules-vectors/vectors.json ditulis (${jumlah})`);
