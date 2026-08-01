/**
 * Aturan pemilihan promosi kasir.
 *
 * ## Mengapa dipindah dari SQL ke sini
 *
 * Pemilihan promosi memutuskan berapa uang yang dilepas gerai. Selama ia hidup
 * sebagai satu klausa `WHERE` sepanjang tiga puluh baris, ia hanya dapat
 * dibuktikan dengan menyiapkan basis data, menanam data, dan menjalankan
 * penjualan — sehingga pada praktiknya ia tidak pernah dibuktikan sama sekali.
 *
 * Berkas ini murni: masuk baris promosi dan konteks, keluar daftar diskon.
 * Tanpa basis data, tanpa NestJS. SQL-nya menyusut menjadi "ambil yang aktif".
 *
 * ## Tiga hal yang diperbaiki saat memindahkannya
 *
 * 1. **Hari dan jam dihitung pada zona waktu tenant.** Semula keduanya dibaca
 *    dari cap waktu UTC. Untuk gerai di Indonesia itu meleset tujuh jam: promosi
 *    "Senin saja" tidak berlaku pada Senin pagi (yang masih Minggu di UTC), dan
 *    promosi jam 17.00–19.00 menyala pada tengah malam.
 * 2. **Jendela jam yang melewati tengah malam.** `dari <= t AND t <= sampai`
 *    tidak pernah benar untuk 22.00–02.00, sehingga promosi shift malam tidak
 *    pernah berlaku sekali pun.
 * 3. **`minimum_purchase` benar-benar diperiksa.** Kolomnya sudah ada sejak
 *    awal, tetapi tidak pernah dibaca — promosi "potong Rp 10.000 untuk
 *    pembelian di atas Rp 100.000" berlaku juga pada pembelian Rp 5.000.
 *
 * Ketiganya melepas atau menahan uang tanpa satu pun galat.
 */

import type { DiskonTerpakai } from './pos-pricing';

/** Satu baris promosi sebagaimana tersimpan. */
export interface BarisPromosi {
  id: string;
  name: string;
  benefitType: 'PERCENT' | 'AMOUNT';
  benefitValue: number;
  maxDiscountAmount: number | null;
  minimumPurchase: number | null;
  minimumQuantity: number | null;
  scopeType: 'TENANT' | 'OUTLET' | 'BRAND' | string;
  scopeId: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  /** Hari ISO 1..7 (Senin..Minggu). Kosong atau null berarti setiap hari. */
  validDays: number[] | null;
  /** Jam dinding `HH:MM` atau `HH:MM:SS` pada zona waktu tenant. */
  validTimeFrom: string | null;
  validTimeTo: string | null;
  usageLimit: number | null;
  usageCount: number;
  requiresApproval: boolean;
  priority: number;
  createdAt: Date;
  /** Produk dan kategori yang disebut promosi ini. */
  target: TargetPromosi[];
}

export interface TargetPromosi {
  productId: string | null;
  productCategoryId: string | null;
  isExclusion: boolean;
}

export interface KonteksPromosi {
  /** Saat transaksi, sebagai instan. */
  saat: Date;
  /** Zona waktu tenant, misalnya `Asia/Jakarta`. */
  timezone: string;
  outletId: string;
  brandId: string | null;
  productId: string;
  productCategoryId: string | null;
  quantity: number;
  /** Nilai baris sebelum diskon, dipakai memeriksa `minimumPurchase`. */
  lineSubtotal: number;
}

/** Hari ISO (1=Senin..7=Minggu) dan jam dinding pada sebuah zona waktu. */
export function waktuSetempat(saat: Date, timezone: string): { isoDay: number; menit: number } {
  /*
   * `Intl` dipakai, bukan penambahan offset tetap: offset sebuah zona berubah
   * menurut tanggal pada wilayah yang memakai waktu musim panas. Menambahkan
   * tujuh jam bekerja untuk Indonesia dan diam-diam salah di tempat lain — dan
   * yang salah adalah harga.
   */
  const bagian = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(saat);

  const ambil = (jenis: string) => bagian.find((b) => b.type === jenis)?.value ?? '';
  const peta: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

  const jam = Number(ambil('hour'));
  return {
    isoDay: peta[ambil('weekday')] ?? 1,
    // `hour12: false` dapat menghasilkan 24 untuk tengah malam pada sebagian
    // runtime; 24.00 dan 00.00 adalah menit yang sama.
    menit: (jam % 24) * 60 + Number(ambil('minute')),
  };
}

/** `HH:MM` atau `HH:MM:SS` menjadi menit sejak tengah malam, atau null. */
export function keMenit(jam: string | null): number | null {
  if (!jam) return null;
  const cocok = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(jam.trim());
  if (!cocok) return null;
  const j = Number(cocok[1]);
  const m = Number(cocok[2]);
  if (j > 23 || m > 59) return null;
  return j * 60 + m;
}

/**
 * Benar bila `menit` berada di dalam jendela jam.
 *
 * Jendela yang melewati tengah malam (22.00–02.00) ditangani tegas: tanpa itu
 * promosi shift malam tidak pernah berlaku sekali pun, dan tidak ada galat yang
 * menyebutkannya.
 */
export function dalamJendelaJam(menit: number, dari: number | null, sampai: number | null): boolean {
  if (dari === null && sampai === null) return true;
  if (dari === null) return menit <= sampai!;
  if (sampai === null) return menit >= dari;
  if (dari <= sampai) return menit >= dari && menit <= sampai;
  // Melewati tengah malam.
  return menit >= dari || menit <= sampai;
}

/** Benar bila produk pada konteks tercakup promosi dan tidak dikecualikan. */
export function produkTercakup(promosi: BarisPromosi, ctx: KonteksPromosi): boolean {
  const cocok = (t: TargetPromosi) =>
    (t.productId !== null && t.productId === ctx.productId) ||
    (t.productCategoryId !== null && t.productCategoryId === ctx.productCategoryId);

  // Pengecualian menang atas pencakupan mana pun.
  if (promosi.target.some((t) => t.isExclusion && cocok(t))) return false;

  const daftarCakup = promosi.target.filter((t) => !t.isExclusion);
  // Promosi tanpa daftar produk berlaku untuk semua.
  if (daftarCakup.length === 0) return true;
  return daftarCakup.some(cocok);
}

/** Benar bila lingkup promosi mengenai outlet atau brand pada konteks. */
export function lingkupCocok(promosi: BarisPromosi, ctx: KonteksPromosi): boolean {
  switch (promosi.scopeType) {
    case 'TENANT':
      return true;
    case 'OUTLET':
      return promosi.scopeId !== null && promosi.scopeId === ctx.outletId;
    case 'BRAND':
      return promosi.scopeId !== null && ctx.brandId !== null && promosi.scopeId === ctx.brandId;
    default:
      /*
       * Lingkup yang tidak dikenal TIDAK berlaku.
       *
       * Kebalikannya — menganggapnya berlaku untuk semua — berarti lingkup baru
       * yang ditambahkan kelak, sebelum kode ini tahu artinya, membagikan diskon
       * ke seluruh gerai.
       */
      return false;
  }
}

/** Benar bila satu promosi berlaku pada konteks ini. */
export function promosiBerlaku(promosi: BarisPromosi, ctx: KonteksPromosi): boolean {
  if (promosi.validFrom && promosi.validFrom.getTime() > ctx.saat.getTime()) return false;
  if (promosi.validUntil && promosi.validUntil.getTime() < ctx.saat.getTime()) return false;

  if (promosi.usageLimit !== null && promosi.usageCount >= promosi.usageLimit) return false;

  if (promosi.minimumQuantity !== null && ctx.quantity < promosi.minimumQuantity) return false;
  if (promosi.minimumPurchase !== null && ctx.lineSubtotal < promosi.minimumPurchase) return false;

  if (!lingkupCocok(promosi, ctx)) return false;
  if (!produkTercakup(promosi, ctx)) return false;

  const { isoDay, menit } = waktuSetempat(ctx.saat, ctx.timezone);
  if (promosi.validDays && promosi.validDays.length > 0 && !promosi.validDays.includes(isoDay)) {
    return false;
  }
  if (!dalamJendelaJam(menit, keMenit(promosi.validTimeFrom), keMenit(promosi.validTimeTo))) {
    return false;
  }

  return true;
}

/**
 * Memilih promosi yang berlaku, berurut sesuai prioritas.
 *
 * Angka prioritas kecil menang, lalu yang lebih dahulu dibuat — sama dengan
 * urutan yang dipakai SQL sebelumnya, supaya perpindahan ini tidak mengubah
 * promosi mana yang terpakai pada data yang sudah ada.
 */
export function pilihPromosi(baris: BarisPromosi[], ctx: KonteksPromosi): DiskonTerpakai[] {
  return baris
    .filter((p) => promosiBerlaku(p, ctx))
    .sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime())
    .map((p) => ({
      sourceType: 'PROMOTION' as const,
      sourceId: p.id,
      label: p.name,
      discountType: p.benefitType,
      discountValue: p.benefitValue,
      maxAmount: p.maxDiscountAmount,
      requiresApproval: p.requiresApproval,
    }));
}
