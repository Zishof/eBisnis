/**
 * Pengujian status PO terhadap jumlah yang diterima.
 *
 * Aturan ini dipakai dua jalur berlawanan arah — validasi penerimaan dan
 * pembalikannya. Bila keduanya berbeda, yang terlihat bukan galat melainkan
 * pesanan pembelian berstatus salah: tidak ada yang menagih pemasok atas barang
 * yang sebenarnya tidak jadi masuk.
 */

import { STATUS_PO_TERKUNCI, statusPoDariPenerimaan } from './purchase-order-status';

describe('status PO dari jumlah diterima', () => {
  it('lunas ketika sisa habis', () => {
    expect(
      statusPoDariPenerimaan({
        statusSekarang: 'PARTIALLY_RECEIVED',
        dipesan: 10,
        diterima: 10,
        dibatalkan: 0,
      }),
    ).toBe('RECEIVED');
  });

  it('penerimaan berlebih tetap dihitung lunas', () => {
    /*
     * Pemasok yang mengirim lebih memang terjadi di gudang, dan pesanannya
     * tetap selesai. Kelebihannya persoalan lain, bukan persoalan status.
     */
    expect(
      statusPoDariPenerimaan({
        statusSekarang: 'PARTIALLY_RECEIVED',
        dipesan: 10,
        diterima: 12,
        dibatalkan: 0,
      }),
    ).toBe('RECEIVED');
  });

  it('sebagian diterima', () => {
    expect(
      statusPoDariPenerimaan({
        statusSekarang: 'APPROVED',
        dipesan: 10,
        diterima: 4,
        dibatalkan: 0,
      }),
    ).toBe('PARTIALLY_RECEIVED');
  });

  it('jumlah yang dibatalkan ikut menutup pesanan', () => {
    // Sisa 10 - 4 diterima - 6 dibatalkan = 0. Tidak ada lagi yang ditunggu.
    expect(
      statusPoDariPenerimaan({
        statusSekarang: 'PARTIALLY_RECEIVED',
        dipesan: 10,
        diterima: 4,
        dibatalkan: 6,
      }),
    ).toBe('RECEIVED');
  });

  describe('pembalikan penuh', () => {
    it('PO yang penerimaannya dibalik seluruhnya kembali ke APPROVED', () => {
      /*
       * Inilah cacat yang diperbaiki. Sebelumnya PO tetap `RECEIVED` padahal
       * penerimaannya sudah dibatalkan: tidak ada yang menagih pemasok, dan
       * `received_qty` yang menggelembung membuat penerimaan berikutnya untuk
       * PO yang sama langsung tampak lunas.
       */
      expect(
        statusPoDariPenerimaan({
          statusSekarang: 'RECEIVED',
          dipesan: 10,
          diterima: 0,
          dibatalkan: 0,
        }),
      ).toBe('APPROVED');
    });

    it('dari PARTIALLY_RECEIVED dan BACKORDERED juga kembali ke APPROVED', () => {
      for (const dari of ['PARTIALLY_RECEIVED', 'BACKORDERED']) {
        expect(
          statusPoDariPenerimaan({
            statusSekarang: dari,
            dipesan: 10,
            diterima: 0,
            dibatalkan: 0,
          }),
        ).toBe('APPROVED');
      }
    });

    it('PO yang BELUM pernah disetujui TIDAK dinaikkan menjadi APPROVED', () => {
      /*
       * Tanpa penjaga ini, persetujuan terbit dari perhitungan kuantitas alih-alih
       * dari orang — dan pesanan yang belum disetujui siapa pun tampak siap
       * dikirimkan ke pemasok.
       */
      for (const dari of ['DRAFT', 'SUBMITTED', 'AUTO_GENERATED', 'WAITING_APPROVAL']) {
        expect(
          statusPoDariPenerimaan({
            statusSekarang: dari,
            dipesan: 10,
            diterima: 0,
            dibatalkan: 0,
          }),
        ).toBeNull();
      }
    });
  });

  describe('status yang tidak boleh disentuh', () => {
    it('CANCELLED dan CLOSED dibiarkan apa adanya', () => {
      /*
       * Pesanan yang sudah dibatalkan atau ditutup adalah keputusan manusia.
       * Membalik satu penerimaan tidak boleh menghidupkannya kembali —
       * pembatalan yang batal sendiri adalah kejutan yang tidak dapat
       * dijelaskan kepada siapa pun.
       */
      for (const dari of STATUS_PO_TERKUNCI) {
        expect(
          statusPoDariPenerimaan({ statusSekarang: dari, dipesan: 10, diterima: 10, dibatalkan: 0 }),
        ).toBeNull();
        expect(
          statusPoDariPenerimaan({ statusSekarang: dari, dipesan: 10, diterima: 0, dibatalkan: 0 }),
        ).toBeNull();
      }
    });
  });

  describe('tidak menulis ulang nilai yang sama', () => {
    it('status yang sudah benar menghasilkan null', () => {
      /*
       * Menulis ulang nilai yang sama tetap menaikkan `version` dan tetap
       * menghasilkan satu baris jejak audit. Riwayat perubahan yang penuh oleh
       * baris yang tidak mengubah apa pun tidak dapat dibaca lagi.
       */
      expect(
        statusPoDariPenerimaan({
          statusSekarang: 'RECEIVED',
          dipesan: 10,
          diterima: 10,
          dibatalkan: 0,
        }),
      ).toBeNull();
      expect(
        statusPoDariPenerimaan({
          statusSekarang: 'PARTIALLY_RECEIVED',
          dipesan: 10,
          diterima: 4,
          dibatalkan: 0,
        }),
      ).toBeNull();
    });
  });

  describe('ketelitian angka', () => {
    it('pecahan desimal tidak membuat pesanan tampak lunas', () => {
      /*
       * Kuantitas disimpan NUMERIC(_,6). Perhitungan biner biasa membuat
       * 0.1 + 0.2 tidak sama dengan 0.3, dan sisa 0.0000001 akan membulatkan
       * pesanan menjadi lunas padahal masih ada yang ditunggu.
       */
      expect(
        statusPoDariPenerimaan({
          statusSekarang: 'APPROVED',
          dipesan: '0.3',
          diterima: '0.1',
          dibatalkan: '0.1',
        }),
      ).toBe('PARTIALLY_RECEIVED');
    });

    it('menerima angka dalam bentuk teks dari basis data', () => {
      // `NUMERIC` datang sebagai string dari `pg`; angka JS akan kehilangan
      // ketelitian pada nilai besar.
      expect(
        statusPoDariPenerimaan({
          statusSekarang: 'PARTIALLY_RECEIVED',
          dipesan: '1000000.000000',
          diterima: '1000000.000000',
          dibatalkan: '0.000000',
        }),
      ).toBe('RECEIVED');
    });
  });
});
