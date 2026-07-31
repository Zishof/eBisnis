/**
 * Kapan pembaruan aplikasi boleh diterapkan pada mesin kasir.
 *
 * ## Mengapa ini tidak otomatis
 *
 * Pilihan bawaan pada aplikasi web biasa adalah memasang versi baru lalu memuat
 * ulang halaman begitu tersedia. Pada layar kasir pilihan itu salah, dan salahnya
 * mahal: memuat ulang di tengah transaksi menghapus keranjang yang sedang
 * dilayani. Pembeli sudah berdiri di depan meja dengan barangnya dipindai satu
 * per satu, dan semuanya hilang tanpa ada yang melakukan kesalahan apa pun.
 *
 * Karena itu `registerType` pada konfigurasi PWA disetel `'prompt'`, dan
 * keputusan kapan boleh menerapkannya ditulis di sini — sebagai aturan murni,
 * supaya dapat diuji tanpa service worker dan tanpa peramban.
 *
 * ## Yang menunda pembaruan
 *
 * 1. **Keranjang terbuka.** Alasannya di atas.
 * 2. **Masih ada transaksi yang belum terkirim ke peladen.** Antrean itu tersimpan
 *    di mesin ini, dan yang tahu cara membacanya adalah versi yang menulisnya.
 *    Versi baru boleh saja mengubah bentuk catatannya. Menunggu antrean kosong
 *    menghapus seluruh golongan masalah itu, bukan menambal satu kasusnya.
 */

export type KeadaanPembaruan = 'TIDAK_ADA' | 'TERTUNDA' | 'SIAP';

export interface MasukanPembaruan {
  /** Service worker melaporkan ada versi baru yang menunggu. */
  adaPembaruan: boolean;
  /** Ada keranjang yang sedang dilayani. */
  keranjangTerbuka: boolean;
  /** Banyaknya transaksi lokal yang belum diterima peladen. */
  antreanBelumTerkirim: number;
}

export interface RingkasanPembaruan {
  state: KeadaanPembaruan;
  /** Benar bila aman memuat ulang sekarang. */
  bolehTerapkan: boolean;
  /** Kalimat untuk kasir. Kosong bila tidak ada yang perlu dikatakan. */
  message: string;
}

export function nilaiPembaruan(m: MasukanPembaruan): RingkasanPembaruan {
  if (!m.adaPembaruan) {
    return { state: 'TIDAK_ADA', bolehTerapkan: false, message: '' };
  }

  if (m.keranjangTerbuka) {
    return {
      state: 'TERTUNDA',
      bolehTerapkan: false,
      message:
        'Pembaruan aplikasi sudah siap. Akan dipasang setelah keranjang ini selesai — ' +
        'memuat ulang sekarang akan menghapusnya.',
    };
  }

  if (m.antreanBelumTerkirim > 0) {
    return {
      state: 'TERTUNDA',
      bolehTerapkan: false,
      message:
        `Pembaruan aplikasi sudah siap, tetapi masih ada ${m.antreanBelumTerkirim} transaksi ` +
        'yang belum terkirim ke peladen. Pembaruan dipasang setelah antrean kosong.',
    };
  }

  return {
    state: 'SIAP',
    bolehTerapkan: true,
    message: 'Versi baru tersedia. Muat ulang sekarang untuk memakainya.',
  };
}
