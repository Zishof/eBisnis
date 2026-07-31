/**
 * Pengujian aturan ketersediaan stok kasir.
 *
 * Tujuh keadaan yang disebut perintah prioritas POS-3 ada di sini, ditambah
 * aritmetika ember stok — yang tampak sepele tetapi menentukan apakah angka di
 * layar cocok dengan barang di rak.
 */

import {
  bolehJual,
  emberTujuanRetur,
  saldoSesudahKeluar,
  saldoSesudahLepas,
  saldoSesudahMasuk,
  saldoSesudahTahan,
  type SaldoStok,
} from './pos-stock';

const saldo = (over: Partial<SaldoStok> = {}): SaldoStok => ({
  warehouseId: 'W1',
  productId: 'P1',
  onHand: 10,
  reserved: 0,
  available: 10,
  ...over,
});

describe('keputusan menjual', () => {
  it('mengizinkan bila stok mencukupi', () => {
    const k = bolehJual({ saldo: saldo(), quantity: 3, allowNegative: false });
    expect(k.allowed).toBe(true);
    expect(k.negativeAllowed).toBe(false);
  });

  it('mengizinkan tepat sejumlah yang tersedia', () => {
    expect(bolehJual({ saldo: saldo({ available: 3 }), quantity: 3, allowNegative: false }).allowed)
      .toBe(true);
  });

  it('menolak bila stok kurang, dan menyebutkan angkanya', () => {
    /*
     * Menyebutkan jumlah yang tersedia, bukan sekadar "stok tidak cukup".
     * Kasir yang tahu angkanya dapat menawarkan jumlah itu kepada pembeli
     * alih-alih membatalkan seluruh transaksi.
     */
    const k = bolehJual({ saldo: saldo({ available: 2 }), quantity: 5, allowNegative: false });
    expect(k.allowed).toBe(false);
    expect(k.reason).toBe('INSUFFICIENT');
    expect(k.message).toContain('2');
    expect(k.message).toContain('5');
    expect(k.availableQty).toBe(2);
  });

  it('mengizinkan stok kurang bila tenant memperbolehkannya', () => {
    const k = bolehJual({ saldo: saldo({ available: 2 }), quantity: 5, allowNegative: true });
    expect(k.allowed).toBe(true);
    expect(k.negativeAllowed).toBe(true);
    expect(k.message).toContain('2');
  });

  it('membedakan tanpa catatan stok dari stok nol', () => {
    /*
     * Keduanya sama-sama tidak dapat dijual, tetapi tindak lanjutnya berbeda:
     * yang satu perlu penerimaan barang, yang lain perlu produk itu didaftarkan
     * ke gudang lebih dahulu.
     */
    const kosong = bolehJual({ saldo: null, quantity: 1, allowNegative: false });
    const nol = bolehJual({ saldo: saldo({ onHand: 0, available: 0 }), quantity: 1, allowNegative: false });
    expect(kosong.reason).toBe('NO_BALANCE');
    expect(nol.reason).toBe('INSUFFICIENT');
  });

  it('tanpa catatan stok tetap boleh bila stok negatif diizinkan', () => {
    const k = bolehJual({ saldo: null, quantity: 1, allowNegative: true });
    expect(k.allowed).toBe(true);
    expect(k.negativeAllowed).toBe(true);
  });

  it('menolak jumlah nol dan negatif', () => {
    for (const q of [0, -1, Number.NaN]) {
      const k = bolehJual({ saldo: saldo(), quantity: q, allowNegative: true });
      expect(k.allowed).toBe(false);
      expect(k.reason).toBe('INVALID_QUANTITY');
    }
  });

  it('kebijakan stok negatif tidak menutupi jumlah yang tidak sah', () => {
    // Stok negatif adalah kelonggaran atas persediaan, bukan atas masukan yang
    // salah. Jumlah nol tetap ditolak.
    expect(bolehJual({ saldo: saldo(), quantity: 0, allowNegative: true }).allowed).toBe(false);
  });

  it('yang sudah ditahan ikut mengurangi ketersediaan', () => {
    // on_hand 10, reserved 8 -> hanya 2 yang benar-benar dapat dijual.
    const k = bolehJual({
      saldo: saldo({ onHand: 10, reserved: 8, available: 2 }),
      quantity: 5,
      allowNegative: false,
    });
    expect(k.allowed).toBe(false);
    expect(k.availableQty).toBe(2);
  });
});

describe('aritmetika ember stok', () => {
  it('menahan memindahkan dari tersedia ke tertahan tanpa mengubah on-hand', () => {
    const s = saldoSesudahTahan(saldo(), 3);
    expect(s.onHand).toBe(10);
    expect(s.reserved).toBe(3);
    expect(s.available).toBe(7);
  });

  it('melepas mengembalikannya', () => {
    const s = saldoSesudahLepas(saldoSesudahTahan(saldo(), 3), 3);
    expect(s).toMatchObject({ onHand: 10, reserved: 0, available: 10 });
  });

  it('melepas dua kali tidak menciptakan stok dari ketiadaan', () => {
    // Terjadi ketika pelepasan terulang karena percobaan ulang. Tanpa penjagaan
    // ini, reserved menjadi negatif dan available melebihi on_hand.
    const sekali = saldoSesudahLepas(saldoSesudahTahan(saldo(), 3), 3);
    const dua = saldoSesudahLepas(sekali, 3);
    expect(dua.reserved).toBe(0);
    expect(dua.available).toBe(10);
  });

  it('mengeluarkan barang mengurangi on-hand dan tertahan bersamaan', () => {
    const s = saldoSesudahKeluar(saldoSesudahTahan(saldo(), 3), 3);
    expect(s.onHand).toBe(7);
    expect(s.reserved).toBe(0);
    expect(s.available).toBe(7);
  });

  it('mengeluarkan tidak mengubah ketersediaan', () => {
    // Barang yang keluar memang sudah tidak tersedia sejak ditahan. Bila
    // available ikut turun lagi di sini, ia turun dua kali untuk satu barang.
    const ditahan = saldoSesudahTahan(saldo(), 3);
    const keluar = saldoSesudahKeluar(ditahan, 3);
    expect(keluar.available).toBe(ditahan.available);
  });

  it('retur menambah on-hand dan ketersediaan', () => {
    const s = saldoSesudahMasuk(saldo({ onHand: 5, available: 5 }), 2);
    expect(s.onHand).toBe(7);
    expect(s.available).toBe(7);
  });

  it('retur saat ada penahanan tidak mengembalikan barang yang tertahan', () => {
    const s = saldoSesudahMasuk(saldo({ onHand: 5, reserved: 2, available: 3 }), 2);
    expect(s.onHand).toBe(7);
    expect(s.reserved).toBe(2);
    expect(s.available).toBe(5);
  });

  it('ketersediaan selalu on-hand dikurangi tertahan', () => {
    // Kolom turunan yang disimpan terpisah adalah kolom yang cepat atau lambat
    // tidak lagi cocok. Invarian ini yang menjaganya.
    const kasus = [
      saldoSesudahTahan(saldo(), 4),
      saldoSesudahLepas(saldo({ reserved: 4, available: 6 }), 2),
      saldoSesudahKeluar(saldo({ reserved: 4, available: 6 }), 2),
      saldoSesudahMasuk(saldo({ reserved: 4, available: 6 }), 3),
    ];
    for (const s of kasus) expect(s.available).toBe(s.onHand - s.reserved);
  });
});

describe('disposisi retur', () => {
  it('barang layak jual kembali ke stok tersedia', () => {
    expect(emberTujuanRetur('RESTOCK')).toBe('AVAILABLE');
  });

  it('barang rusak masuk ember rusak, bukan stok jual', () => {
    // Mengembalikan barang rusak ke stok jual adalah cara tercepat membuat
    // catatan stok berbeda dari kenyataan di rak.
    expect(emberTujuanRetur('DAMAGED')).toBe('DAMAGED');
  });

  it('barang dimusnahkan tidak kembali ke mana pun', () => {
    expect(emberTujuanRetur('DISPOSED')).toBeNull();
  });
});
