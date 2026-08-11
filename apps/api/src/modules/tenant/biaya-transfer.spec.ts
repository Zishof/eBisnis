/**
 * Pengujian biaya transfer antar-gudang.
 *
 * Yang diputuskan modul ini menentukan nilai persediaan gudang tujuan, dan
 * lewat itu menentukan HPP setiap penjualan dari gudang tersebut. Kesalahannya
 * tidak memunculkan galat — hanya membuat laba terbaca lebih besar daripada
 * yang sebenarnya.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  biayaKirimTertimbang,
  biayaMasukTransfer,
  type AlasanTanpaBiayaTransfer,
} from './biaya-transfer';

describe('menimbang biaya beberapa pengiriman', () => {
  it('satu pengiriman memberi biayanya sendiri', () => {
    expect(biayaKirimTertimbang([{ quantity: 10, unitCost: 1_500 }])).toBe(1_500);
  });

  it('ditimbang kuantitas, bukan dirata-rata biasa', () => {
    /*
     * Perbedaannya nyata: rata-rata biasa dari 1.000 dan 2.000 adalah 1.500,
     * padahal 90 unit berbiaya 1.000 dan 10 unit berbiaya 2.000 bernilai 1.100
     * per unit. Salah menimbang berarti nilai yang tiba berbeda dari nilai yang
     * berangkat, dan selisihnya tidak muncul di mana pun.
     */
    const hasil = biayaKirimTertimbang([
      { quantity: 90, unitCost: 1_000 },
      { quantity: 10, unitCost: 2_000 },
    ]);
    expect(hasil).toBe(1_100);
    expect(hasil).not.toBe(1_500);
  });

  it('nilai total kekal: qty x rata-rata = jumlah nilai kiriman', () => {
    // Identitas yang membuat transfer tidak menciptakan atau menghapus nilai.
    const kiriman = [
      { quantity: 7, unitCost: 3_250 },
      { quantity: 13, unitCost: 4_100 },
      { quantity: 5, unitCost: 2_900 },
    ];
    const totalQty = kiriman.reduce((s, k) => s + k.quantity, 0);
    const totalNilai = kiriman.reduce((s, k) => s + k.quantity * k.unitCost, 0);

    expect(biayaKirimTertimbang(kiriman)! * totalQty).toBeCloseTo(totalNilai, 6);
  });

  it('kiriman berkuantitas nol atau negatif diabaikan', () => {
    expect(
      biayaKirimTertimbang([
        { quantity: 10, unitCost: 500 },
        { quantity: 0, unitCost: 999_999 },
        { quantity: -5, unitCost: 999_999 },
      ]),
    ).toBe(500);
  });

  it('angka yang tidak sah diabaikan, bukan mencemari hasilnya', () => {
    expect(
      biayaKirimTertimbang([
        { quantity: 10, unitCost: 500 },
        { quantity: Number.NaN, unitCost: 700 },
        { quantity: 5, unitCost: Number.NaN },
      ]),
    ).toBe(500);
  });

  it('tanpa kuantitas sama sekali memberi null, bukan nol', () => {
    // Nol adalah biaya; null adalah "tidak ada yang dapat ditimbang". Keduanya
    // berbeda, dan membedakannya yang mencegah pencampuran nol ke rata-rata.
    expect(biayaKirimTertimbang([])).toBeNull();
    expect(biayaKirimTertimbang([{ quantity: 0, unitCost: 100 }])).toBeNull();
  });
});

describe('memutuskan biaya masuk gudang tujuan', () => {
  it('barang diterima dengan biaya nyata mengubah rata-rata', () => {
    expect(biayaMasukTransfer({ acceptedQty: 20, unitCost: 8_750 })).toEqual({
      inboundCost: 8_750,
      alasan: null,
    });
  });

  describe('menolak menyentuh rata-rata', () => {
    const kasus: {
      nama: string;
      masukan: { acceptedQty: number; unitCost: number | null };
      alasan: AlasanTanpaBiayaTransfer;
    }[] = [
      {
        nama: 'seluruh kiriman ditolak, tidak ada yang masuk stok jual',
        masukan: { acceptedQty: 0, unitCost: 8_750 },
        alasan: 'TIDAK_ADA_YANG_DITERIMA',
      },
      {
        nama: 'kuantitas negatif',
        masukan: { acceptedQty: -3, unitCost: 8_750 },
        alasan: 'TIDAK_ADA_YANG_DITERIMA',
      },
      {
        nama: 'kuantitas bukan angka',
        masukan: { acceptedQty: Number.NaN, unitCost: 8_750 },
        alasan: 'TIDAK_ADA_YANG_DITERIMA',
      },
      {
        nama: 'biaya kosong',
        masukan: { acceptedQty: 20, unitCost: null },
        alasan: 'BIAYA_TIDAK_DIKETAHUI',
      },
      {
        nama: 'biaya bukan angka',
        masukan: { acceptedQty: 20, unitCost: Number.NaN },
        alasan: 'BIAYA_TIDAK_DIKETAHUI',
      },
      {
        nama: 'biaya negatif',
        masukan: { acceptedQty: 20, unitCost: -1 },
        alasan: 'BIAYA_TIDAK_SAH',
      },
    ];

    for (const k of kasus) {
      it(k.nama, () => {
        expect(biayaMasukTransfer(k.masukan)).toEqual({
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
     * `average_cost` gudang asal masih nol untuk produk yang stoknya tidak
     * pernah lewat penerimaan barang. Mencampurkan nol ke gudang tujuan
     * menyebarkan ketidaktahuan itu ke gudang kedua -- dan makin sulit dilacak
     * setiap kali barangnya dipindahkan lagi.
     */
    expect(biayaMasukTransfer({ acceptedQty: 20, unitCost: 0 })).toEqual({
      inboundCost: null,
      alasan: 'BIAYA_TIDAK_DIKETAHUI',
    });
  });

  it('kuantitas diperiksa lebih dahulu daripada biaya', () => {
    // Kiriman yang seluruhnya ditolak dilaporkan sebagai soal kuantitas, supaya
    // alasannya menunjuk sebab yang sebenarnya saat ditelusuri.
    expect(biayaMasukTransfer({ acceptedQty: 0, unitCost: 0 }).alasan).toBe(
      'TIDAK_ADA_YANG_DITERIMA',
    );
  });
});

describe('penjaga: jalur transfer memakai keputusan modul murni', () => {
  const sumber = readFileSync(join(__dirname, 'erp-inventory.service.ts'), 'utf8');

  it('pengiriman membekukan biaya gudang asal pada movement', () => {
    /*
     * Dibekukan saat kirim, bukan dibaca saat terima: gudang asal dapat
     * menerima pembelian baru selama barang di perjalanan, dan rata-ratanya
     * bergeser ke harga yang tidak pernah melekat pada barang ini.
     */
    // Biaya dibaca dari saldo gudang asal...
    expect(sumber).toContain('FROM ${S}.stock_balance');
    // ...lalu ikut ditulis pada movement pengirimannya.
    expect(sumber).toContain('biayaPerLot.get(allocation.lotId)');
    expect(sumber).toMatch(
      /INSERT INTO[^(]*stock_movement[^(]*\([^)]*unit_cost[^)]*\)[\s\S]{0,200}?TRANSFER_DISPATCH/,
    );
  });

  it('penerimaan membaca biaya kiriman, ditimbang kuantitas', () => {
    expect(sumber).toMatch(/sum\(quantity \* unit_cost\) \/ sum\(quantity\)/);
  });

  it('penerimaan memakai keputusan modul murni', () => {
    // Tanpa panggilan ini, kuantitas tetap masuk tanpa nilainya -- dan tidak
    // ada satu pun uji lain di sini yang gagal.
    expect(sumber).toContain('biayaMasukTransfer({');
  });

  it('rata-rata hanya disentuh ketika biayanya diterima', () => {
    // `inboundCost` tidak pernah dikirim sebagai null: kunci itu dihilangkan
    // sama sekali, supaya `applyBalanceDelta` tidak pernah menimbang nol.
    expect(sumber).toContain("biaya.inboundCost === null ? {} : { inboundCost: biaya.inboundCost }");
  });
});
