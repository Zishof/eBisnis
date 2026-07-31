/**
 * Pengujian aturan laporan kasir.
 *
 * Yang dijaga paling ketat: **kasir tidak melihat angka biaya.** Aturan itu
 * ditulis sekali dan dipakai seluruh laporan; uji di bawah memastikan ia
 * benar-benar menghapus, bukan sekadar tidak menampilkan.
 */

import {
  AMBANG_BAWAAN,
  KOLOM_BIAYA,
  LAPORAN_POS,
  MAKS_HARI_LAPORAN,
  laporanDikenal,
  periksaRentang,
  persen,
  sembunyikanBiaya,
  sorotanKasir,
} from './pos-report';

describe('rentang laporan', () => {
  it('menerima rentang wajar', () => {
    const h = periksaRentang('2026-07-01', '2026-07-31');
    expect(h.ok).toBe(true);
    expect(h.range).toEqual({ from: '2026-07-01', to: '2026-07-31', days: 31 });
  });

  it('satu hari dihitung satu, bukan nol', () => {
    // Laporan "hari ini" adalah permintaan yang paling sering. Menghitungnya
    // nol hari akan membuat batas rentang dan pesan galatnya salah semua.
    expect(periksaRentang('2026-07-15', '2026-07-15').range?.days).toBe(1);
  });

  it('memakai hari ini bila tanggal tidak disebut', () => {
    const h = periksaRentang(undefined, undefined, '2026-07-31');
    expect(h.ok).toBe(true);
    expect(h.range).toEqual({ from: '2026-07-31', to: '2026-07-31', days: 1 });
  });

  it('tanggal mulai saja berarti sampai hari ini', () => {
    const h = periksaRentang('2026-07-01', undefined, '2026-07-10');
    expect(h.range).toEqual({ from: '2026-07-01', to: '2026-07-10', days: 10 });
  });

  it('menolak bentuk tanggal yang bukan YYYY-MM-DD', () => {
    for (const t of ['31-07-2026', '2026/07/31', 'kemarin', '2026-7-1']) {
      expect(periksaRentang(t, '2026-07-31').reason).toBe('INVALID_DATE');
    }
  });

  it('menolak tanggal terbalik dan menyebut keduanya', () => {
    const h = periksaRentang('2026-07-31', '2026-07-01');
    expect(h.reason).toBe('REVERSED');
    expect(h.message).toContain('2026-07-31');
    expect(h.message).toContain('2026-07-01');
  });

  it('menolak rentang yang terlalu lebar', () => {
    /*
     * Laporan tanpa batas akan memindai seluruh riwayat penjualan begitu sebuah
     * outlet berjalan setahun, dan yang menanggungnya adalah kasir yang sedang
     * melayani antrean pada basis data yang sama.
     */
    const h = periksaRentang('2026-01-01', '2026-12-31');
    expect(h.reason).toBe('TOO_WIDE');
    expect(h.message).toContain(String(MAKS_HARI_LAPORAN));
  });

  it('menerima tepat pada batas', () => {
    const h = periksaRentang('2026-01-01', '2026-04-01'); // 91 hari
    expect(h.ok).toBe(true);
  });

  it('melewati batas satu hari sudah ditolak', () => {
    // 2026-01-01 sampai 2026-04-03 = 93 hari.
    expect(periksaRentang('2026-01-01', '2026-04-03').reason).toBe('TOO_WIDE');
  });

  it('rentang yang melintasi pergantian tahun tetap dihitung benar', () => {
    const h = periksaRentang('2025-12-25', '2026-01-05');
    expect(h.range?.days).toBe(12);
  });
});

describe('penyembunyian angka biaya', () => {
  const baris = [
    { productName: 'Kopi', qty: 10, revenue: 100000, cost: 40000, margin: 60000 },
    { productName: 'Teh', qty: 5, revenue: 25000, cost: 10000, margin: 15000 },
  ];

  it('menampilkan biaya bagi yang berhak', () => {
    const h = sembunyikanBiaya(baris, true);
    expect(h[0].cost).toBe(40000);
    expect(h[0].margin).toBe(60000);
  });

  it('MENGHAPUS biaya bagi yang tidak berhak, bukan menolkannya', () => {
    /*
     * Menolkan akan membuat laporan tampak seolah untungnya nol — angka yang
     * salah lebih buruk daripada angka yang tidak ada. Kolomnya harus benar-
     * benar hilang.
     */
    const h = sembunyikanBiaya(baris, false);
    expect('cost' in h[0]).toBe(false);
    expect('margin' in h[0]).toBe(false);
  });

  it('kolom yang boleh dilihat tetap utuh', () => {
    const h = sembunyikanBiaya(baris, false);
    expect(h[0].productName).toBe('Kopi');
    expect(h[0].revenue).toBe(100000);
    expect(h[0].qty).toBe(10);
  });

  it('tidak mengubah baris aslinya', () => {
    // Baris yang sama dipakai untuk menghitung ringkasan sesudahnya; menyunting
    // di tempat akan membuat ringkasannya kehilangan biaya juga.
    const salinan = JSON.parse(JSON.stringify(baris));
    sembunyikanBiaya(baris, false);
    expect(baris).toEqual(salinan);
  });

  it('seluruh kolom biaya yang terdaftar benar-benar dihapus', () => {
    const penuh = [
      Object.fromEntries([...KOLOM_BIAYA.map((k) => [k, 1]), ['revenue', 9]]) as Record<
        string,
        number
      >,
    ];
    const h = sembunyikanBiaya(penuh, false);
    for (const k of KOLOM_BIAYA) expect(k in h[0]).toBe(false);
    expect(h[0].revenue).toBe(9);
  });

  it('daftar kosong tidak menimbulkan galat', () => {
    expect(sembunyikanBiaya([], false)).toEqual([]);
  });
});

describe('persentase', () => {
  it('menghitung dua angka di belakang koma', () => {
    expect(persen(1, 3)).toBe(33.33);
  });

  it('pembagi nol menghasilkan nol, bukan NaN', () => {
    // Outlet yang belum menjual apa pun hari itu. NaN pada laporan akan tampil
    // sebagai "NaN%" di layar pimpinan.
    expect(persen(5, 0)).toBe(0);
  });

  it('bagian sama dengan keseluruhan adalah seratus', () => {
    expect(persen(250, 250)).toBe(100);
  });
});

describe('sorotan kasir', () => {
  const dasar = {
    cashierName: 'Ani',
    totalSales: 1_000_000,
    voidValue: 0,
    discountValue: 0,
    cashVariance: 0,
  };

  it('kasir yang wajar tidak disoroti sama sekali', () => {
    expect(sorotanKasir(dasar)).toEqual([]);
  });

  it('menyoroti pembatalan yang tinggi', () => {
    const s = sorotanKasir({ ...dasar, voidValue: 80_000 });
    expect(s).toHaveLength(1);
    expect(s[0].kind).toBe('VOID_TINGGI');
    expect(s[0].value).toBe(8);
  });

  it('sorotan berbunyi mengajak memeriksa, bukan menuduh', () => {
    /*
     * Angka yang menonjol pada laporan kasir hampir selalu punya penjelasan
     * biasa. Kalimat yang menuduh membuat laporan ini dipakai untuk memarahi
     * orang, dan alat yang dipakai memarahi orang akan dihindari orang.
     */
    const s = sorotanKasir({ ...dasar, voidValue: 80_000 });
    expect(s[0].message).toMatch(/belum tentu bermasalah|Perlu ditanyakan/);
  });

  it('menyoroti diskon yang tinggi', () => {
    const s = sorotanKasir({ ...dasar, discountValue: 200_000 });
    expect(s[0].kind).toBe('DISKON_TINGGI');
    expect(s[0].value).toBe(20);
  });

  it('menyoroti selisih kas ke dua arah', () => {
    const kurang = sorotanKasir({ ...dasar, cashVariance: -75_000 });
    const lebih = sorotanKasir({ ...dasar, cashVariance: 75_000 });
    expect(kurang[0].kind).toBe('SELISIH_KAS');
    expect(kurang[0].message).toContain('kurang');
    expect(lebih[0].message).toContain('lebih');
  });

  it('kas lebih pun disoroti, bukan hanya kas kurang', () => {
    // Kas berlebih berarti ada transaksi yang tidak tercatat — sama perlunya
    // diperiksa dengan kas yang kurang.
    expect(sorotanKasir({ ...dasar, cashVariance: 90_000 })).toHaveLength(1);
  });

  it('tepat pada ambang belum disoroti', () => {
    expect(sorotanKasir({ ...dasar, cashVariance: AMBANG_BAWAAN.selisihKas })).toEqual([]);
  });

  it('beberapa hal sekaligus menghasilkan beberapa sorotan', () => {
    const s = sorotanKasir({
      ...dasar,
      voidValue: 100_000,
      discountValue: 200_000,
      cashVariance: -60_000,
    });
    expect(s.map((x) => x.kind).sort()).toEqual(['DISKON_TINGGI', 'SELISIH_KAS', 'VOID_TINGGI']);
  });

  it('kasir tanpa penjualan tidak disoroti karena pembagian nol', () => {
    const s = sorotanKasir({ ...dasar, totalSales: 0, voidValue: 0 });
    expect(s).toEqual([]);
  });
});

describe('katalog laporan', () => {
  it('lima belas laporan terdaftar', () => {
    expect(LAPORAN_POS).toHaveLength(15);
  });

  it('kodenya unik', () => {
    const kode = LAPORAN_POS.map((l) => l.code);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('mengenali kode yang terdaftar dan menolak yang tidak', () => {
    expect(laporanDikenal('SALES_SUMMARY')).toBe(true);
    expect(laporanDikenal('SALES_SUMMARIES')).toBe(false);
    expect(laporanDikenal('')).toBe(false);
  });

  it('laporan yang menampilkan biaya ditandai', () => {
    // Penanda inilah yang dipakai layanan untuk memutuskan apakah hak
    // VIEW_COST perlu diperiksa. Laporan yang lupa ditandai akan membocorkan
    // HPP kepada kasir.
    const berbiaya = LAPORAN_POS.filter((l) => l.needsCost).map((l) => l.code);
    expect(berbiaya.sort()).toEqual(['BY_CATEGORY', 'BY_PRODUCT']);
  });
});
