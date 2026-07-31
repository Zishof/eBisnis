/**
 * Aturan ketersediaan stok kasir — fungsi murni, tanpa basis data.
 *
 * Dibangun tersendiri, bukan memakai `StockReservationService` yang sudah ada.
 * Audit POS-0 sempat menyatakan layanan itu dapat dipakai langsung; itu keliru,
 * dan kekeliruannya berasal dari membaca nama metodenya (`hold`, `commit`,
 * `release`) alih-alih kuerinya. Layanan itu bekerja seluruhnya pada
 * `online_listing_variant` — stok etalase marketplace — sementara kasir bekerja
 * pada `stock_balance` per gudang. Keduanya menyimpan angka yang berbeda pada
 * tabel yang berbeda; menyatukannya akan membuat penjualan kasir mengurangi
 * stok etalase daring, dan sebaliknya.
 */

export type EmberStok = 'AVAILABLE' | 'RESERVED' | 'ON_HAND' | 'DAMAGED' | 'QUARANTINE';

export interface SaldoStok {
  warehouseId: string;
  productId: string;
  onHand: number;
  reserved: number;
  available: number;
}

export type AlasanTolak =
  | 'NO_BALANCE'
  | 'INSUFFICIENT'
  | 'INVALID_QUANTITY';

export interface KeputusanStok {
  allowed: boolean;
  reason?: AlasanTolak;
  message?: string;
  /** Jumlah yang benar-benar dapat dilayani sekarang. */
  availableQty: number;
  /** Benar bila diizinkan hanya karena kebijakan stok negatif. */
  negativeAllowed: boolean;
}

/**
 * Bolehkah menjual sejumlah ini?
 *
 * Kebijakan stok negatif adalah keputusan tenant, bukan bawaan. Warung yang
 * stoknya belum pernah diopname akan berhenti total tanpa itu; toko yang
 * persediaannya tertib justru ingin ditolak. Keduanya sah, dan keduanya harus
 * dapat dipilih.
 */
export function bolehJual(input: {
  saldo: SaldoStok | null;
  quantity: number;
  allowNegative: boolean;
}): KeputusanStok {
  const { saldo, quantity, allowNegative } = input;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return {
      allowed: false,
      reason: 'INVALID_QUANTITY',
      message: 'Jumlah harus lebih besar dari nol.',
      availableQty: 0,
      negativeAllowed: false,
    };
  }

  const tersedia = saldo?.available ?? 0;

  if (!saldo) {
    /*
     * Tidak ada baris saldo sama sekali. Berbeda dari saldo nol: yang ini
     * berarti produk belum pernah masuk ke gudang itu, dan pesannya harus
     * mengatakan demikian supaya petugas gudang tahu harus berbuat apa.
     */
    if (allowNegative) {
      return {
        allowed: true,
        availableQty: 0,
        negativeAllowed: true,
        message: 'Produk ini belum memiliki catatan stok pada gudang ini.',
      };
    }
    return {
      allowed: false,
      reason: 'NO_BALANCE',
      message: 'Produk ini belum memiliki catatan stok pada gudang outlet ini.',
      availableQty: 0,
      negativeAllowed: false,
    };
  }

  if (tersedia >= quantity) {
    return { allowed: true, availableQty: tersedia, negativeAllowed: false };
  }

  if (allowNegative) {
    return {
      allowed: true,
      availableQty: tersedia,
      negativeAllowed: true,
      message: `Stok tercatat tinggal ${tersedia}. Penjualan tetap dilanjutkan sesuai kebijakan tenant.`,
    };
  }

  return {
    allowed: false,
    reason: 'INSUFFICIENT',
    // Menyebutkan jumlah yang tersedia, bukan sekadar "stok tidak cukup".
    // Kasir yang tahu angkanya dapat menawarkan jumlah itu kepada pembeli
    // alih-alih membatalkan seluruh transaksi.
    message: `Stok tidak mencukupi. Tersedia ${tersedia}, diminta ${quantity}.`,
    availableQty: tersedia,
    negativeAllowed: false,
  };
}

/**
 * Saldo sesudah sebuah reservasi diterapkan.
 *
 * `available` sengaja dihitung, bukan diasumsikan sama dengan
 * `on_hand − reserved`. Basis data menyimpan ketiganya sebagai kolom terpisah,
 * dan kolom yang seharusnya turunan tetapi disimpan terpisah adalah kolom yang
 * cepat atau lambat tidak lagi cocok.
 */
export function saldoSesudahTahan(saldo: SaldoStok, quantity: number): SaldoStok {
  const reserved = saldo.reserved + quantity;
  return {
    ...saldo,
    reserved,
    available: saldo.onHand - reserved,
  };
}

/** Saldo sesudah reservasi dilepas. */
export function saldoSesudahLepas(saldo: SaldoStok, quantity: number): SaldoStok {
  // Tidak pernah turun di bawah nol: reservasi yang dilepas dua kali tidak boleh
  // menciptakan stok dari ketiadaan.
  const reserved = Math.max(0, saldo.reserved - quantity);
  return {
    ...saldo,
    reserved,
    available: saldo.onHand - reserved,
  };
}

/**
 * Saldo sesudah reservasi diwujudkan menjadi penjualan.
 *
 * Barang keluar dari gudang: `on_hand` berkurang, dan `reserved` ikut berkurang
 * karena penahanannya sudah terpakai. `available` tidak berubah — barang itu
 * memang sudah tidak tersedia sejak ditahan.
 */
export function saldoSesudahKeluar(saldo: SaldoStok, quantity: number): SaldoStok {
  const reserved = Math.max(0, saldo.reserved - quantity);
  const onHand = saldo.onHand - quantity;
  return { ...saldo, onHand, reserved, available: onHand - reserved };
}

/** Saldo sesudah barang kembali dari retur. */
export function saldoSesudahMasuk(saldo: SaldoStok, quantity: number): SaldoStok {
  const onHand = saldo.onHand + quantity;
  return { ...saldo, onHand, available: onHand - saldo.reserved };
}

/**
 * Ke mana barang retur dikembalikan.
 *
 * Mengembalikan seluruh barang retur ke stok jual adalah cara tercepat membuat
 * catatan stok berbeda dari kenyataan di rak.
 */
export type Disposisi = 'RESTOCK' | 'DAMAGED' | 'DISPOSED';

export function emberTujuanRetur(disposisi: Disposisi): EmberStok | null {
  switch (disposisi) {
    case 'RESTOCK':
      return 'AVAILABLE';
    case 'DAMAGED':
      return 'DAMAGED';
    case 'DISPOSED':
      // Tidak kembali ke mana pun. Pergerakannya tetap dicatat sebagai keluar
      // permanen supaya selisihnya dapat dijelaskan.
      return null;
    default:
      return null;
  }
}
