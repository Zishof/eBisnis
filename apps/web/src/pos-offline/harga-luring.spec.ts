/**
 * Pengujian aritmetika transaksi luring dan jatah nomor struk.
 *
 * Inilah satu-satunya tempat layar kasir memutuskan sesuatu tentang uang tanpa
 * peladen. Kesalahan di sini tidak menampakkan diri sebagai galat: ia menjadi
 * selisih laci kas yang baru ketahuan saat tutup shift, atau nomor struk kembar
 * yang baru ketahuan berminggu kemudian.
 */

import { describe, expect, it } from 'vitest';
import {
  hitungBarisLuring,
  hitungKembalian,
  hitungKeranjangLuring,
  keDesimal,
  keSatuanTerkecil,
  pecahanMataUang,
  type BarisLuring,
  type TarifLuring,
} from './harga-luring';
import { AMBANG_MENIPIS, ambilNomor, nilaiBlok, sisaBlok, type BlokStruk } from './blok-struk';

const PPN: TarifLuring = { taxRateId: 'T1', code: 'PPN11', rate: 11, isInclusive: false };
const PPN_INKLUSIF: TarifLuring = { taxRateId: 'T2', code: 'PPN11I', rate: 11, isInclusive: true };

const baris = (over: Partial<BarisLuring> = {}): BarisLuring => ({
  productId: 'P1',
  name: 'Kopi Susu',
  uomId: 'U1',
  quantity: 1,
  unitPrice: '18000',
  taxRateId: null,
  ...over,
});

describe('pecahan mata uang', () => {
  it('rupiah tidak memakai sen', () => {
    expect(pecahanMataUang('IDR')).toBe(1);
  });

  it('mata uang bersen memakai seratus', () => {
    expect(pecahanMataUang('USD')).toBe(100);
    expect(pecahanMataUang('usd')).toBe(100);
  });

  it('mata uang tak dikenal dianggap bersen, bukan bulat', () => {
    // Menganggapnya bulat akan MENGHILANGKAN sen pada setiap transaksi. Menganggap
    // yang bulat sebagai bersen hanya menambah dua angka nol yang tidak terpakai.
    expect(pecahanMataUang('XYZ')).toBe(100);
  });
});

describe('perubahan desimal ke satuan terkecil', () => {
  it('rupiah utuh', () => {
    expect(keSatuanTerkecil('18000', 1)).toBe(18000);
  });

  it('sen dibaca sebagai satuan terkecil', () => {
    expect(keSatuanTerkecil('12.34', 100)).toBe(1234);
  });

  it('desimal peladen yang berekor nol tetap sama nilainya', () => {
    // Peladen mengirim `numeric` sebagai "18000.0000"; membacanya sebagai angka
    // lain akan membuat setiap perbandingan dengan peladen tampak berselisih.
    expect(keSatuanTerkecil('18000.0000', 1)).toBe(18000);
    expect(keSatuanTerkecil('12.3400', 100)).toBe(1234);
  });

  it('membulatkan setengah ke atas, sama dengan peladen', () => {
    expect(keSatuanTerkecil('12.345', 100)).toBe(1235);
    expect(keSatuanTerkecil('12.344', 100)).toBe(1234);
  });

  it('1.005 membulat ke atas, tidak terpengaruh galat pecahan biner', () => {
    /*
     * `Math.round(1.005 * 100)` bernilai 100, bukan 101: 1.005 tidak dapat
     * diwakili persis dalam biner dan nilainya sedikit di bawah. Pembulatan
     * lewat teks tidak punya masalah itu.
     */
    expect(keSatuanTerkecil('1.005', 100)).toBe(101);
  });

  it('masukan kosong atau tidak berupa angka menjadi nol, bukan NaN', () => {
    // NaN yang lolos akan merambat ke seluruh total dan menampilkan "Rp NaN"
    // pada layar yang sedang dibaca pembeli.
    expect(keSatuanTerkecil('', 100)).toBe(0);
    expect(keSatuanTerkecil('abc', 100)).toBe(0);
  });

  it('bolak-balik tidak mengubah nilai', () => {
    for (const [teks, pecahan] of [
      ['18000', 1],
      ['12.34', 100],
      ['0.05', 100],
    ] as const) {
      expect(keSatuanTerkecil(keDesimal(keSatuanTerkecil(teks, pecahan), pecahan), pecahan)).toBe(
        keSatuanTerkecil(teks, pecahan),
      );
    }
  });
});

describe('perhitungan baris', () => {
  it('tanpa pajak, baris adalah jumlah dikali harga', () => {
    const h = hitungBarisLuring(baris({ quantity: 3 }), [], 'IDR');
    expect(h.lineSubtotal).toBe('54000');
    expect(h.taxAmount).toBe('0');
    expect(h.lineTotal).toBe('54000');
  });

  it('pajak eksklusif ditambahkan di atas harga', () => {
    const h = hitungBarisLuring(baris({ taxRateId: 'T1' }), [PPN], 'IDR');
    expect(h.lineSubtotal).toBe('18000');
    expect(h.taxAmount).toBe('1980');
    expect(h.lineTotal).toBe('19980');
  });

  it('pajak inklusif DIKELUARKAN dari harga, tidak ditambahkan lagi', () => {
    /*
     * Kalau pajak inklusif diperlakukan seperti eksklusif, pembeli ditagih dua
     * kali untuk pajak yang sama — dan angkanya cukup dekat dengan yang benar
     * sehingga tidak ada yang curiga sampai ada yang menjumlahkan sendiri.
     */
    const h = hitungBarisLuring(baris({ unitPrice: '19980', taxRateId: 'T2' }), [PPN_INKLUSIF], 'IDR');
    expect(h.lineTotal).toBe('19980');
    expect(h.taxAmount).toBe('1980');
    expect(h.lineSubtotal).toBe('18000');
  });

  it('tarif yang tidak ditemukan diperlakukan tanpa pajak, bukan gagal', () => {
    // Tarif hilang dari salinan tidak boleh menghentikan antrean kasir; selisihnya
    // akan tertangkap saat transaksi diterima peladen.
    const h = hitungBarisLuring(baris({ taxRateId: 'TIDAK_ADA' }), [PPN], 'IDR');
    expect(h.taxAmount).toBe('0');
    expect(h.lineTotal).toBe('18000');
  });

  it('tarif nol persen tidak mengubah apa pun', () => {
    const nol: TarifLuring = { taxRateId: 'T0', code: 'NOL', rate: 0, isInclusive: false };
    const h = hitungBarisLuring(baris({ taxRateId: 'T0' }), [nol], 'IDR');
    expect(h.lineTotal).toBe('18000');
  });
});

describe('total keranjang', () => {
  it('menjumlahkan seluruh baris', () => {
    const h = hitungKeranjangLuring(
      [baris({ quantity: 2 }), baris({ productId: 'P2', unitPrice: '8000', quantity: 1 })],
      [],
      'IDR',
    );
    expect(h.subtotal).toBe('44000');
    expect(h.grandTotal).toBe('44000');
    expect(h.itemCount).toBe(3);
  });

  it('total sama dengan penjumlahan baris yang tercetak pada struk', () => {
    /*
     * Dijumlahkan dari nilai baris yang SUDAH dibulatkan. Kalau dijumlahkan dari
     * nilai mentah lalu dibulatkan sekali di akhir, pembeli yang menjumlahkan
     * sendiri baris-baris pada struknya bisa mendapat angka yang berbeda satu
     * rupiah dari totalnya — dan tidak ada penjelasan yang memuaskan untuk itu.
     */
    const daftar = [
      baris({ productId: 'A', unitPrice: '3333', taxRateId: 'T1' }),
      baris({ productId: 'B', unitPrice: '3333', taxRateId: 'T1' }),
      baris({ productId: 'C', unitPrice: '3333', taxRateId: 'T1' }),
    ];
    const h = hitungKeranjangLuring(daftar, [PPN], 'IDR');
    const jumlahBaris = h.lines.reduce((a, b) => a + Number(b.lineTotal), 0);
    expect(Number(h.grandTotal)).toBe(jumlahBaris);
  });

  it('keranjang kosong menghasilkan nol, bukan NaN', () => {
    const h = hitungKeranjangLuring([], [], 'IDR');
    expect(h.grandTotal).toBe('0');
    expect(h.itemCount).toBe(0);
  });
});

describe('kembalian', () => {
  it('uang pas tidak memberi kembalian', () => {
    const h = hitungKembalian('50000', '50000', 'IDR');
    expect(h.cukup).toBe(true);
    expect(h.change).toBe('0');
  });

  it('uang lebih memberi kembalian sebesar selisihnya', () => {
    const h = hitungKembalian('47500', '50000', 'IDR');
    expect(h.change).toBe('2500');
  });

  it('uang kurang ditolak dan menyebutkan kurangnya berapa', () => {
    // "Pembayaran kurang" tanpa angka memaksa kasir menghitung sendiri di depan
    // antrean, dan hitungan tergesa itulah yang menjadi selisih laci kas.
    const h = hitungKembalian('50000', '45000', 'IDR');
    expect(h.cukup).toBe(false);
    expect(h.kurang).toBe('5000');
    expect(h.change).toBe('0');
  });
});

// --- Jatah nomor struk ------------------------------------------------------

const blok = (over: Partial<BlokStruk> = {}): BlokStruk => ({
  blockId: 'B1',
  terminalId: 'REG1',
  outletId: 'O1',
  prefix: 'INV-',
  padding: 6,
  fromNumber: 1000,
  toNumber: 1099,
  nextNumber: 1000,
  allocatedAt: '2026-08-01T00:00:00.000Z',
  businessDate: null,
  ...over,
});

describe('jatah nomor struk', () => {
  it('nomor diterbitkan dengan awalan dan padding yang sama seperti daring', () => {
    const h = ambilNomor(blok());
    expect(h?.nomor).toBe('INV-001000');
  });

  it('jatah termaju satu setiap pengambilan', () => {
    const a = ambilNomor(blok())!;
    const b = ambilNomor(a.blok)!;
    expect(b.nomor).toBe('INV-001001');
    expect(sisaBlok(b.blok)).toBe(98);
  });

  it('nomor terakhir pada rentang masih boleh dipakai', () => {
    // Rentangnya inklusif di kedua ujung. Salah di sini berarti satu nomor
    // terbuang setiap jatah, atau satu nomor terpakai dua kali.
    const h = ambilNomor(blok({ nextNumber: 1099 }));
    expect(h?.nomor).toBe('INV-001099');
    expect(sisaBlok(h!.blok)).toBe(0);
  });

  it('tidak pernah menerbitkan nomor di luar rentang', () => {
    /*
     * Aturan terpenting pada berkas ini. Nomor di luar jatah adalah nomor yang
     * mungkin sudah dipakai register lain, dan benturannya baru ketahuan ketika
     * kedua struk sudah di tangan dua pembeli berbeda.
     */
    expect(ambilNomor(blok({ nextNumber: 1100 }))).toBeNull();
  });

  it('tanpa jatah, penjualan luring tidak boleh jalan', () => {
    const h = nilaiBlok(null, 'REG1');
    expect(h.state).toBe('TIDAK_ADA');
    expect(h.usable).toBe(false);
  });

  it('jatah milik register lain ditolak meski ada di mesin ini', () => {
    // Terjadi ketika satu komputer dipakai bergantian sebagai dua register.
    const h = nilaiBlok(blok({ terminalId: 'REG2' }), 'REG1');
    expect(h.state).toBe('SALAH_REGISTER');
    expect(h.usable).toBe(false);
  });

  it('jatah habis menghentikan penjualan luring', () => {
    const h = nilaiBlok(blok({ nextNumber: 1100 }), 'REG1');
    expect(h.state).toBe('HABIS');
    expect(h.usable).toBe(false);
  });

  it('memperingatkan sebelum habis, bukan pada saat habis', () => {
    // Peringatannya supaya kasir sempat menyambung ke peladen. Yang muncul saat
    // sisa satu tidak menolong siapa pun.
    const h = nilaiBlok(blok({ nextNumber: 1100 - AMBANG_MENIPIS }), 'REG1');
    expect(h.state).toBe('MENIPIS');
    expect(h.usable).toBe(true);
    expect(h.message).toContain(String(AMBANG_MENIPIS));
  });

  it('jatah yang masih banyak tidak mengganggu kasir', () => {
    expect(nilaiBlok(blok(), 'REG1').state).toBe('CUKUP');
  });
});
