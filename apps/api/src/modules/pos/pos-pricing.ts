/**
 * Mesin kuotasi harga kasir.
 *
 * Dibangun baru, dan itu keputusan yang perlu dijelaskan: sudah ada
 * `PricingEngineService` pada `modules/pricing`, tetapi mesin itu menghitung
 * **tagihan langganan SaaS** — masukannya `planCode`, `billingInterval`, dan
 * `deviceIds`. Ia menghitung berapa yang harus dibayar penyewa kepada kita,
 * bukan berapa yang harus dibayar pembeli kepada penyewa. Tidak ada `productId`
 * di dalamnya, tidak ada `outletId`, tidak ada kategori pajak.
 *
 * Yang dipakai ulang darinya adalah `DiscountEvaluatorService` — evaluator pohon
 * kondisi tanpa `eval` — dan konvensi pembulatannya.
 *
 * Berkas ini murni: masuk angka, keluar angka. Tanpa basis data, tanpa NestJS.
 * Harga adalah tempat kesalahan paling mahal dan paling sulit ditemukan
 * belakangan, jadi ia harus dapat diuji tanpa menyiapkan apa pun.
 */

import Decimal from 'decimal.js';

/** Pembulatan mata uang. IDR secara praktik tidak memakai sen. */
export function bulatkan(nilai: Decimal, currencyCode: string): Decimal {
  const desimal = currencyCode === 'IDR' ? 0 : 2;
  return nilai.toDecimalPlaces(desimal, Decimal.ROUND_HALF_UP);
}

export interface TarifPajak {
  taxRateId: string;
  code: string;
  /** Persen, misal 11 untuk 11%. */
  rate: number;
  isInclusive: boolean;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
}

export interface BarisBukuHarga {
  priceBookId: string;
  priceBookItemId: string;
  productId: string;
  uomId: string;
  price: number;
  minimumQty: number;
  validFrom?: string | null;
  validUntil?: string | null;
  /** Prioritas penugasan buku harga ke outlet; angka kecil menang. */
  priority: number;
  scopeType: 'TENANT' | 'BRAND' | 'OUTLET' | 'CUSTOMER_GROUP' | 'CHANNEL';
}

export type JenisDiskon = 'PERCENT' | 'AMOUNT';

export interface DiskonTerpakai {
  sourceType: 'PROMOTION' | 'MANUAL_LINE' | 'MANUAL_CART' | 'CUSTOMER_GROUP';
  sourceId: string | null;
  label: string;
  discountType: JenisDiskon;
  discountValue: number;
  /** Batas atas nilai diskon; nol atau tidak diisi berarti tanpa batas. */
  maxAmount?: number | null;
  requiresApproval?: boolean;
}

export interface PermintaanKuotasi {
  productId: string;
  uomId: string;
  quantity: number;
  currencyCode: string;
  /** Tanggal usaha, `YYYY-MM-DD`. */
  businessDate: string;
  priceBookLines: BarisBukuHarga[];
  taxRates: TarifPajak[];
  discounts?: DiskonTerpakai[];
  /** Harga yang diketik kasir; hanya sah bila ia memiliki PRICE_OVERRIDE. */
  priceOverride?: number | null;
  /** Ambang persetujuan diskon, dalam persen dari harga kotor. */
  discountApprovalPct?: number;
}

export interface RincianPajak {
  taxRateId: string;
  code: string;
  rate: number;
  isInclusive: boolean;
  taxableBase: string;
  taxAmount: string;
}

export interface RincianDiskon {
  sourceType: DiskonTerpakai['sourceType'];
  sourceId: string | null;
  label: string;
  discountType: JenisDiskon;
  discountValue: number;
  discountAmount: string;
  requiresApproval: boolean;
}

export type KodePeringatan =
  | 'NO_PRICE'
  | 'PRICE_OVERRIDDEN'
  | 'DISCOUNT_CAPPED'
  | 'DISCOUNT_NEEDS_APPROVAL'
  | 'DISCOUNT_EXCEEDS_PRICE'
  | 'NO_TAX_RATE';

export interface Peringatan {
  code: KodePeringatan;
  message: string;
}

export interface HasilKuotasi {
  productId: string;
  uomId: string;
  quantity: number;
  currencyCode: string;
  /** Harga satuan sebelum diskon dan sebelum pajak dikeluarkan. */
  unitPrice: string;
  /** unitPrice × quantity. */
  grossAmount: string;
  discountAmount: string;
  /** Dasar pengenaan pajak: bruto dikurangi diskon, tanpa pajak di dalamnya. */
  netAmount: string;
  taxAmount: string;
  /** Yang dibayar pembeli. */
  lineTotal: string;
  priceBookId: string | null;
  discounts: RincianDiskon[];
  taxes: RincianPajak[];
  warnings: Peringatan[];
  requiresApproval: boolean;
}

const NOL = new Decimal(0);

/** Apakah rentang tanggal mencakup tanggal usaha. Perbandingan teks, bukan Date. */
function berlaku(dari: string | null | undefined, sampai: string | null | undefined, tanggal: string): boolean {
  if (dari && dari > tanggal) return false;
  if (sampai && sampai < tanggal) return false;
  return true;
}

/**
 * Memilih satu baris buku harga.
 *
 * Aturannya, berurutan: hanya yang berlaku pada tanggal itu, hanya yang jumlah
 * minimumnya terpenuhi, lalu prioritas terkecil menang, lalu jumlah minimum
 * terbesar menang.
 *
 * Urutan dua kriteria terakhir penting dan mudah tertukar. Prioritas mewakili
 * kekhususan penugasan — harga khusus outlet mengalahkan harga tingkat tenant,
 * dan itu harus menang lebih dahulu. Baru sesudah itu, di antara baris yang
 * sama khususnya, harga grosir untuk jumlah besar mengalahkan harga eceran.
 * Membalik urutannya membuat harga grosir tingkat tenant mengalahkan harga
 * eceran khusus outlet — dan outlet kehilangan kendali atas harganya sendiri.
 */
export function pilihHarga(
  lines: BarisBukuHarga[],
  quantity: number,
  businessDate: string,
): BarisBukuHarga | null {
  const layak = lines.filter(
    (l) => berlaku(l.validFrom, l.validUntil, businessDate) && quantity >= l.minimumQty,
  );
  if (!layak.length) return null;

  return layak.reduce((terbaik, kini) => {
    if (kini.priority !== terbaik.priority) return kini.priority < terbaik.priority ? kini : terbaik;
    if (kini.minimumQty !== terbaik.minimumQty) {
      return kini.minimumQty > terbaik.minimumQty ? kini : terbaik;
    }
    // Seri sempurna: harga terendah menang. Pembeli tidak boleh dirugikan oleh
    // konfigurasi yang ambigu.
    return kini.price < terbaik.price ? kini : terbaik;
  });
}

/** Tarif pajak yang berlaku pada tanggal usaha. */
export function pilihPajak(rates: TarifPajak[], businessDate: string): TarifPajak[] {
  return rates.filter((r) => berlaku(r.effectiveFrom, r.effectiveUntil, businessDate));
}

/**
 * Menghitung satu baris keranjang.
 *
 * Urutannya: harga satuan → bruto → diskon → neto → pajak → total.
 *
 * Pajak dihitung pada neto, bukan bruto. Diskon mengurangi dasar pengenaan
 * pajak, dan menghitungnya terbalik membuat penyewa membayar pajak atas uang
 * yang tidak pernah diterimanya.
 */
export function hitungBaris(req: PermintaanKuotasi): HasilKuotasi {
  const warnings: Peringatan[] = [];
  const qty = new Decimal(req.quantity);
  const mata = req.currencyCode;

  // --- Harga satuan --------------------------------------------------------
  const baris = pilihHarga(req.priceBookLines, req.quantity, req.businessDate);
  let unitPrice: Decimal;
  let priceBookId: string | null = null;

  if (req.priceOverride !== null && req.priceOverride !== undefined) {
    unitPrice = new Decimal(req.priceOverride);
    warnings.push({
      code: 'PRICE_OVERRIDDEN',
      message: 'Harga diubah manual oleh kasir. Perubahan ini tercatat pada jejak audit.',
    });
  } else if (baris) {
    unitPrice = new Decimal(baris.price);
    priceBookId = baris.priceBookId;
  } else {
    unitPrice = NOL;
    warnings.push({
      code: 'NO_PRICE',
      message: 'Produk ini belum memiliki harga yang berlaku. Hubungi supervisor.',
    });
  }

  const gross = bulatkan(unitPrice.times(qty), mata);

  // --- Diskon --------------------------------------------------------------
  const rincianDiskon: RincianDiskon[] = [];
  let totalDiskon = NOL;

  for (const d of req.discounts ?? []) {
    let nilai =
      d.discountType === 'PERCENT'
        ? gross.times(new Decimal(d.discountValue)).dividedBy(100)
        : new Decimal(d.discountValue);

    if (d.maxAmount && d.maxAmount > 0 && nilai.greaterThan(d.maxAmount)) {
      nilai = new Decimal(d.maxAmount);
      warnings.push({
        code: 'DISCOUNT_CAPPED',
        message: `Diskon "${d.label}" dibatasi pada nilai maksimumnya.`,
      });
    }

    nilai = bulatkan(nilai, mata);
    if (nilai.lessThan(0)) nilai = NOL;
    totalDiskon = totalDiskon.plus(nilai);

    rincianDiskon.push({
      sourceType: d.sourceType,
      sourceId: d.sourceId,
      label: d.label,
      discountType: d.discountType,
      discountValue: d.discountValue,
      discountAmount: nilai.toString(),
      requiresApproval: Boolean(d.requiresApproval),
    });
  }

  /*
   * Diskon tidak boleh melebihi harga. Baris bernilai negatif berarti kasir
   * menyerahkan uang kepada pembeli, dan itu bukan diskon melainkan pengeluaran
   * kas — yang punya alur, hak akses, dan pencatatannya sendiri.
   */
  if (totalDiskon.greaterThan(gross)) {
    totalDiskon = gross;
    warnings.push({
      code: 'DISCOUNT_EXCEEDS_PRICE',
      message: 'Jumlah diskon melebihi harga; diskon dipotong hingga harga menjadi nol.',
    });
  }

  const net = bulatkan(gross.minus(totalDiskon), mata);

  // --- Persetujuan ---------------------------------------------------------
  let requiresApproval = rincianDiskon.some((d) => d.requiresApproval);
  const ambang = req.discountApprovalPct ?? 0;
  if (!requiresApproval && ambang > 0 && gross.greaterThan(0)) {
    const persen = totalDiskon.dividedBy(gross).times(100);
    if (persen.greaterThan(ambang)) {
      requiresApproval = true;
      warnings.push({
        code: 'DISCOUNT_NEEDS_APPROVAL',
        message: `Diskon ${persen.toDecimalPlaces(1)}% melampaui ambang ${ambang}% dan memerlukan persetujuan supervisor.`,
      });
    }
  }
  if (req.priceOverride !== null && req.priceOverride !== undefined) requiresApproval = true;

  // --- Pajak ---------------------------------------------------------------
  const tarif = pilihPajak(req.taxRates, req.businessDate);
  const rincianPajak: RincianPajak[] = [];
  let totalPajak = NOL;
  let dasar = net;

  if (!tarif.length && req.taxRates.length > 0) {
    warnings.push({
      code: 'NO_TAX_RATE',
      message: 'Tidak ada tarif pajak yang berlaku pada tanggal transaksi ini.',
    });
  }

  for (const t of tarif) {
    const persen = new Decimal(t.rate);
    let pajak: Decimal;
    let dasarKena: Decimal;

    if (t.isInclusive) {
      /*
       * Harga sudah memuat pajak. Dasar pengenaannya adalah harga dibagi
       * (1 + tarif), dan pajaknya adalah selisihnya.
       *
       * Ini sumber selisih yang paling sering pada sistem kasir: menghitung
       * pajak inklusif sebagai harga × tarif membuat pajaknya terlalu besar,
       * dan angka penjualan bersih yang dilaporkan menjadi terlalu kecil setiap
       * hari, sedikit demi sedikit.
       */
      dasarKena = bulatkan(dasar.dividedBy(persen.dividedBy(100).plus(1)), mata);
      pajak = bulatkan(dasar.minus(dasarKena), mata);
      // Bagi tarif inklusif, dasar untuk tarif berikutnya adalah nilai tanpa pajak.
      dasar = dasarKena;
    } else {
      dasarKena = dasar;
      pajak = bulatkan(dasarKena.times(persen).dividedBy(100), mata);
    }

    totalPajak = totalPajak.plus(pajak);
    rincianPajak.push({
      taxRateId: t.taxRateId,
      code: t.code,
      rate: t.rate,
      isInclusive: t.isInclusive,
      taxableBase: dasarKena.toString(),
      taxAmount: pajak.toString(),
    });
  }

  const adaInklusif = tarif.some((t) => t.isInclusive);
  const netAkhir = adaInklusif ? dasar : net;
  const lineTotal = adaInklusif ? net : bulatkan(net.plus(totalPajak), mata);

  return {
    productId: req.productId,
    uomId: req.uomId,
    quantity: req.quantity,
    currencyCode: mata,
    unitPrice: unitPrice.toString(),
    grossAmount: gross.toString(),
    discountAmount: totalDiskon.toString(),
    netAmount: netAkhir.toString(),
    taxAmount: totalPajak.toString(),
    lineTotal: lineTotal.toString(),
    priceBookId,
    discounts: rincianDiskon,
    taxes: rincianPajak,
    warnings,
    requiresApproval,
  };
}

export interface TotalKeranjang {
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  requiresApproval: boolean;
}

/**
 * Menjumlahkan baris menjadi total keranjang.
 *
 * Dijumlahkan dari nilai baris yang sudah dibulatkan, bukan dihitung ulang dari
 * angka mentah. Bila keduanya berbeda, yang benar adalah yang tertera pada
 * struk — pembeli membaca baris, dan totalnya harus benar-benar merupakan
 * jumlah dari yang ia baca.
 */
export function totalKeranjang(
  baris: HasilKuotasi[],
  currencyCode: string,
  diskonKeranjang: DiskonTerpakai[] = [],
): TotalKeranjang {
  let subtotal = NOL;
  let diskon = NOL;
  let pajak = NOL;
  let perluPersetujuan = false;

  for (const b of baris) {
    subtotal = subtotal.plus(new Decimal(b.grossAmount));
    diskon = diskon.plus(new Decimal(b.discountAmount));
    pajak = pajak.plus(new Decimal(b.taxAmount));
    if (b.requiresApproval) perluPersetujuan = true;
  }

  // Diskon tingkat keranjang dihitung terhadap subtotal sesudah diskon baris.
  const sesudahBaris = subtotal.minus(diskon);
  for (const d of diskonKeranjang) {
    let nilai =
      d.discountType === 'PERCENT'
        ? sesudahBaris.times(new Decimal(d.discountValue)).dividedBy(100)
        : new Decimal(d.discountValue);
    if (d.maxAmount && d.maxAmount > 0 && nilai.greaterThan(d.maxAmount)) {
      nilai = new Decimal(d.maxAmount);
    }
    nilai = bulatkan(nilai, currencyCode);
    diskon = diskon.plus(nilai);
    if (d.requiresApproval) perluPersetujuan = true;
  }

  if (diskon.greaterThan(subtotal)) diskon = subtotal;

  const grand = bulatkan(subtotal.minus(diskon).plus(pajak), currencyCode);

  return {
    subtotal: bulatkan(subtotal, currencyCode).toString(),
    discountTotal: bulatkan(diskon, currencyCode).toString(),
    taxTotal: bulatkan(pajak, currencyCode).toString(),
    grandTotal: grand.toString(),
    requiresApproval: perluPersetujuan,
  };
}

/**
 * Mencocokkan barcode.
 *
 * Barcode utama dan alternatif diperlakukan sama saat dicari; yang membedakan
 * hanyalah mana yang dicetak pada label. Pemindai tidak tahu bedanya, dan kasir
 * tidak seharusnya perlu tahu.
 */
export interface Barcode {
  productId: string;
  uomId: string;
  barcode: string;
  isPrimary: boolean;
  isActive: boolean;
}

export function cariBarcode(daftar: Barcode[], kode: string): Barcode | null {
  const bersih = kode.trim();
  if (!bersih) return null;
  const cocok = daftar.filter((b) => b.isActive && b.barcode === bersih);
  if (!cocok.length) return null;
  // Bila satu barcode terdaftar pada beberapa satuan, yang utama menang.
  return cocok.find((b) => b.isPrimary) ?? cocok[0];
}
