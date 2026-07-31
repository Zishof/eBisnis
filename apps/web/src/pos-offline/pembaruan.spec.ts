/**
 * Pengujian aturan penerapan pembaruan pada mesin kasir.
 *
 * Yang dijaga di sini bukan soal versi, melainkan soal pembeli yang sedang
 * berdiri di depan meja. Memuat ulang di tengah transaksi menghapus keranjang
 * yang barangnya sudah dipindai satu per satu — tidak ada yang berbuat salah,
 * dan semuanya hilang.
 */

import { describe, expect, it } from 'vitest';
import { nilaiPembaruan } from './pembaruan';

const dasar = { adaPembaruan: true, keranjangTerbuka: false, antreanBelumTerkirim: 0 };

describe('penerapan pembaruan', () => {
  it('tanpa pembaruan tidak menampilkan apa pun', () => {
    const h = nilaiPembaruan({ ...dasar, adaPembaruan: false });
    expect(h.state).toBe('TIDAK_ADA');
    expect(h.bolehTerapkan).toBe(false);
    // Kosong, bukan "aplikasi mutakhir": kasir tidak perlu diberi tahu bahwa
    // tidak ada yang terjadi.
    expect(h.message).toBe('');
  });

  it('keranjang terbuka menunda pembaruan', () => {
    const h = nilaiPembaruan({ ...dasar, keranjangTerbuka: true });
    expect(h.state).toBe('TERTUNDA');
    expect(h.bolehTerapkan).toBe(false);
    expect(h.message).toContain('menghapusnya');
  });

  it('antrean yang belum terkirim menunda pembaruan', () => {
    /*
     * Antrean tersimpan di mesin ini, dan yang tahu cara membacanya adalah versi
     * yang menulisnya. Menunggu antrean kosong menghapus seluruh golongan
     * masalah bentuk-catatan-berubah, bukan menambal satu kasusnya.
     */
    const h = nilaiPembaruan({ ...dasar, antreanBelumTerkirim: 3 });
    expect(h.state).toBe('TERTUNDA');
    expect(h.bolehTerapkan).toBe(false);
    expect(h.message).toContain('3 transaksi');
  });

  it('keranjang terbuka didahulukan sebagai alasan penundaan', () => {
    // Keduanya menunda; yang disebut adalah yang sedang dilihat kasir.
    const h = nilaiPembaruan({ adaPembaruan: true, keranjangTerbuka: true, antreanBelumTerkirim: 5 });
    expect(h.message).toContain('keranjang');
  });

  it('tanpa keranjang dan tanpa antrean baru boleh diterapkan', () => {
    const h = nilaiPembaruan(dasar);
    expect(h.state).toBe('SIAP');
    expect(h.bolehTerapkan).toBe(true);
  });

  it('tidak pernah boleh diterapkan saat keranjang terbuka, berapa pun antreannya', () => {
    for (const antrean of [0, 1, 99]) {
      expect(
        nilaiPembaruan({ adaPembaruan: true, keranjangTerbuka: true, antreanBelumTerkirim: antrean })
          .bolehTerapkan,
      ).toBe(false);
    }
  });
});
