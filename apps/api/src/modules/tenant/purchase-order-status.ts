/**
 * Status pesanan pembelian yang mengikuti jumlah barang yang benar-benar diterima.
 *
 * ## Mengapa terpisah dan murni
 *
 * Aturan ini dipakai DUA jalur yang berlawanan arah: validasi penerimaan barang
 * menaikkan `received_qty`, dan pembalikan validasi menurunkannya kembali. Bila
 * masing-masing menghitung statusnya sendiri, keduanya cepat atau lambat
 * berbeda — dan yang terlihat bukan galat, melainkan pesanan pembelian yang
 * berstatus salah.
 *
 * ## Cacat yang diperbaiki berkas ini
 *
 * Pembalikan validasi penerimaan membalik stok, hutang dagang, dan peristiwa
 * akuntansi — tetapi **tidak pernah** menyentuh `purchase_order_line.received_qty`
 * maupun `purchase_order.status`. Akibatnya PO tetap `RECEIVED` padahal
 * penerimaannya sudah dibatalkan:
 *
 * - tidak ada yang menagih pemasok atas barang yang sebenarnya tidak jadi masuk;
 * - `received_qty` tetap menggelembung, sehingga sisa pesanan salah dihitung dan
 *   penerimaan berikutnya untuk PO yang sama langsung tampak lunas;
 * - laporan sisa pesanan dan backorder ikut salah.
 *
 * Tidak ada satu pun galat yang muncul untuk memberi tahu. Tercatat pada
 * `docs/pos-inventory-parity/evidence/screen-20/uat.md`.
 */

import Decimal from 'decimal.js';

/**
 * Status yang TIDAK boleh disentuh perhitungan ini.
 *
 * Pesanan yang sudah dibatalkan atau ditutup adalah keputusan manusia. Membalik
 * satu penerimaan tidak boleh menghidupkannya kembali — pembatalan yang batal
 * sendiri adalah kejutan yang tidak dapat dijelaskan kepada siapa pun.
 */
export const STATUS_PO_TERKUNCI: readonly string[] = ['CANCELLED', 'CLOSED'];

/**
 * Status yang menandakan PO sudah pernah menerima barang.
 *
 * Hanya dari status inilah PO boleh turun kembali ke `APPROVED`. Tanpa penjaga
 * ini, PO yang masih `DRAFT` atau `SUBMITTED` akan ikut **dinaikkan** menjadi
 * `APPROVED` oleh perhitungan ini — persetujuan yang terbit dari perhitungan
 * kuantitas, bukan dari orang.
 */
const STATUS_SESUDAH_TERIMA: readonly string[] = [
  'RECEIVED',
  'PARTIALLY_RECEIVED',
  'BACKORDERED',
];

export interface JumlahPo {
  /** Status PO saat ini. */
  statusSekarang: string;
  /** Total `ordered_qty` seluruh baris. */
  dipesan: Decimal | string | number;
  /** Total `received_qty` seluruh baris, SESUDAH perubahan diterapkan. */
  diterima: Decimal | string | number;
  /** Total `cancelled_qty` seluruh baris. */
  dibatalkan: Decimal | string | number;
}

/**
 * Status baru untuk sebuah PO, atau **null bila tidak boleh diubah**.
 *
 * Mengembalikan null — bukan status sekarang — supaya pemanggilnya dapat
 * melewatkan `UPDATE` sama sekali. Menulis ulang nilai yang sama tetap menaikkan
 * `version` dan tetap menghasilkan satu baris jejak audit, sehingga riwayat
 * perubahan penuh oleh baris yang tidak mengubah apa pun.
 */
export function statusPoDariPenerimaan(jumlah: JumlahPo): string | null {
  if (STATUS_PO_TERKUNCI.includes(jumlah.statusSekarang)) return null;

  const dipesan = new Decimal(jumlah.dipesan.toString());
  const diterima = new Decimal(jumlah.diterima.toString());
  const dibatalkan = new Decimal(jumlah.dibatalkan.toString());

  const sisa = dipesan.minus(diterima).minus(dibatalkan);

  /*
   * Sisa nol atau kurang berarti lunas.
   *
   * "Kurang" ikut dihitung lunas dengan sengaja: penerimaan berlebih memang
   * terjadi di gudang (pemasok mengirim lebih), dan pesanannya tetap selesai.
   * Kelebihannya persoalan lain, bukan persoalan status.
   */
  if (sisa.lessThanOrEqualTo(0)) {
    return jumlah.statusSekarang === 'RECEIVED' ? null : 'RECEIVED';
  }

  if (diterima.greaterThan(0)) {
    return jumlah.statusSekarang === 'PARTIALLY_RECEIVED' ? null : 'PARTIALLY_RECEIVED';
  }

  /*
   * Tidak ada satu pun barang yang diterima.
   *
   * Ini jalur yang hanya tercapai lewat pembalikan. PO dikembalikan ke
   * `APPROVED` — pesanan yang hidup dan menunggu barang, yang memang keadaan
   * sebenarnya sesudah seluruh penerimaannya dibatalkan.
   *
   * Hanya dari status sesudah-terima. PO yang belum pernah disetujui tidak
   * boleh naik ke `APPROVED` karena perhitungan kuantitas.
   */
  if (STATUS_SESUDAH_TERIMA.includes(jumlah.statusSekarang)) return 'APPROVED';

  return null;
}
