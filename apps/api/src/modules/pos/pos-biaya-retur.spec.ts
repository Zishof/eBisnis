/**
 * Pengujian biaya persediaan saat barang kembali dari retur atau pembatalan.
 *
 * Yang diputuskan modul ini menentukan dua angka yang dibaca orang: nilai
 * persediaan pada laporan stok, dan HPP penjualan berikutnya yang dijurnal
 * sebagai COGS. Kesalahannya tidak memunculkan galat apa pun — ia hanya membuat
 * nilai stok makin melenceng setiap kali ada retur.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  biayaMasukRetur,
  rataRataSesudahRetur,
  type AlasanTanpaBiaya,
} from './pos-biaya-retur';

const GUDANG = '33333333-3333-4333-8333-333333333333';

/** Retur yang sah dan biasa, dipakai sebagai dasar lalu diubah per pengujian. */
const WAJAR = {
  ember: 'AVAILABLE',
  quantity: 2,
  costSnapshot: 15_000,
  warehouseId: GUDANG,
};

describe('memutuskan biaya masuk', () => {
  it('barang layak jual dengan biaya nyata mengubah rata-rata', () => {
    expect(biayaMasukRetur(WAJAR)).toEqual({ inboundCost: 15_000, alasan: null });
  });

  describe('menolak menyentuh rata-rata', () => {
    const kasus: { nama: string; masukan: typeof WAJAR; alasan: AlasanTanpaBiaya }[] = [
      {
        nama: 'barang rusak tidak masuk stok jual',
        masukan: { ...WAJAR, ember: 'DAMAGED' },
        alasan: 'TIDAK_MASUK_STOK_JUAL',
      },
      {
        nama: 'barang dimusnahkan tidak kembali ke ember mana pun',
        masukan: { ...WAJAR, ember: null as unknown as string },
        alasan: 'TIDAK_MASUK_STOK_JUAL',
      },
      {
        nama: 'retur tanpa gudang tujuan',
        masukan: { ...WAJAR, warehouseId: null as unknown as string },
        alasan: 'TANPA_GUDANG',
      },
      {
        nama: 'jumlah nol',
        masukan: { ...WAJAR, quantity: 0 },
        alasan: 'JUMLAH_TIDAK_SAH',
      },
      {
        nama: 'jumlah negatif',
        masukan: { ...WAJAR, quantity: -3 },
        alasan: 'JUMLAH_TIDAK_SAH',
      },
      {
        nama: 'jumlah bukan angka',
        masukan: { ...WAJAR, quantity: Number.NaN },
        alasan: 'JUMLAH_TIDAK_SAH',
      },
      {
        nama: 'biaya negatif',
        masukan: { ...WAJAR, costSnapshot: -1 },
        alasan: 'BIAYA_TIDAK_SAH',
      },
      {
        nama: 'biaya kosong',
        masukan: { ...WAJAR, costSnapshot: null as unknown as number },
        alasan: 'BIAYA_TIDAK_DIKETAHUI',
      },
      {
        nama: 'biaya bukan angka',
        masukan: { ...WAJAR, costSnapshot: Number.NaN },
        alasan: 'BIAYA_TIDAK_DIKETAHUI',
      },
    ];

    for (const k of kasus) {
      it(k.nama, () => {
        expect(biayaMasukRetur(k.masukan)).toEqual({
          inboundCost: null,
          alasan: k.alasan,
        });
      });
    }
  });

  it('BIAYA NOL diperlakukan sebagai tidak diketahui, bukan gratis', () => {
    /*
     * Pengujian terpenting berkas ini.
     *
     * `cost_snapshot` bertipe NOT NULL DEFAULT 0 dan diisi dari
     * COALESCE(average_cost, 0). Sampai 10 Agustus 2026 `average_cost` tidak
     * pernah ditulis jalur transaksi mana pun, jadi seluruh penjualan sebelum
     * tanggal itu menyimpan nol. Bila nol ikut dicampur, satu retur lama sudah
     * cukup menarik nilai persediaan produk itu ke bawah selamanya — diam-diam,
     * dan justru pada produk yang datanya paling lemah.
     */
    expect(biayaMasukRetur({ ...WAJAR, costSnapshot: 0 })).toEqual({
      inboundCost: null,
      alasan: 'BIAYA_TIDAK_DIKETAHUI',
    });
  });

  it('ember diperiksa lebih dahulu daripada biaya', () => {
    // Barang rusak dengan biaya nol tetap dilaporkan sebagai soal ember, supaya
    // alasannya menunjuk sebab yang sebenarnya saat ditelusuri.
    expect(biayaMasukRetur({ ...WAJAR, ember: 'DAMAGED', costSnapshot: 0 }).alasan).toBe(
      'TIDAK_MASUK_STOK_JUAL',
    );
  });
});

describe('menghitung rata-rata sesudah retur', () => {
  it('retur pada biaya yang sama tidak menggeser rata-rata', () => {
    // Barang keluar tidak mengubah rata-rata; barang yang sama kembali pada
    // biaya yang sama harus mengembalikan keadaan persis seperti semula.
    const sesudah = rataRataSesudahRetur(
      { onHand: 40, averageCost: 100 },
      { quantity: 10, unitCost: 100 },
    );
    expect(sesudah).toBe(100);
  });

  it('nilai persediaan bertambah PERSIS sebesar COGS yang dibalik', () => {
    /*
     * Identitas yang membuat retur tidak pernah menciptakan atau memusnahkan
     * nilai: debit persediaan = kredit COGS.
     *
     * Di sini pembelian baru sempat menaikkan rata-rata menjadi 155,56 sebelum
     * returnya masuk. Barang yang kembali tetap dinilai pada biaya saat dijual
     * (100), bukan rata-rata hari ini.
     */
    const onHand = 90;
    const averageCost = (40 * 100 + 50 * 200) / 90;
    const nilaiSebelum = onHand * averageCost;

    const sesudah = rataRataSesudahRetur(
      { onHand, averageCost },
      { quantity: 10, unitCost: 100 },
    );

    const nilaiSesudah = (onHand + 10) * sesudah;
    expect(nilaiSesudah - nilaiSebelum).toBeCloseTo(10 * 100, 6);
    expect(sesudah).toBeCloseTo(150, 6);
  });

  it('saldo kosong: biaya barang yang masuk menjadi rata-rata baru', () => {
    // Tidak ada apa pun untuk ditimbang. Sama seperti perilaku baris pertama
    // pada applyBalanceDelta().
    expect(
      rataRataSesudahRetur({ onHand: 0, averageCost: 0 }, { quantity: 5, unitCost: 7_500 }),
    ).toBe(7_500);
  });

  it('saldo minus: rata-rata lama tidak dipakai menimbang', () => {
    /*
     * Saldo negatif berarti barang terjual melebihi yang tercatat ada. Menimbang
     * terhadap saldo negatif menghasilkan rata-rata negatif atau meledak — dua
     * duanya lebih buruk daripada memakai biaya barang yang baru masuk.
     */
    expect(
      rataRataSesudahRetur({ onHand: -5, averageCost: 900 }, { quantity: 2, unitCost: 400 }),
    ).toBe(400);
  });

  it('tidak pernah menghasilkan rata-rata negatif', () => {
    expect(
      rataRataSesudahRetur({ onHand: 10, averageCost: -50 }, { quantity: 1, unitCost: 0 }),
    ).toBe(0);
  });
});

describe('penjaga: SQL harus mengikuti modul murni', () => {
  const sumber = readFileSync(join(__dirname, 'pos-return.service.ts'), 'utf8');

  it('kembalikanStok memakai keputusan modul murni', () => {
    // Bila pemanggilan ini hilang, biaya kembali tidak pernah dihitung dan tidak
    // ada satu pun uji lain di sini yang gagal.
    expect(sumber).toContain('biayaMasukRetur(');
  });

  it('UPDATE stock_balance ikut menulis average_cost', () => {
    expect(sumber).toMatch(/UPDATE[\s\S]*?stock_balance[\s\S]*?average_cost = CASE/);
  });

  it('rata-rata hanya disentuh ketika barang masuk stok jual', () => {
    // Cerminan `NOT $4::boolean` -- penjaga kedua di dalam SQL, supaya ekspresi
    // itu tetap benar walau suatu saat dipanggil dengan ember rusak.
    expect(sumber).toContain('$5::numeric IS NULL OR NOT $4::boolean');
  });
});
