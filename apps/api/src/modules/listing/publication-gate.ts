/**
 * Gerbang publikasi listing.
 *
 * Blueprint Versi 9 bagian 8.1 mencantumkan enam belas syarat sebelum sebuah
 * produk boleh tampil di marketplace. Syarat yang paling sering disebut —
 * minimal tiga gambar — hanyalah satu di antaranya.
 *
 * Ditulis sebagai fungsi murni tanpa akses basis data supaya seluruh
 * kombinasinya dapat diuji, dan supaya aturan yang sama dapat dipakai UI untuk
 * menampilkan apa yang masih kurang sebelum penjual menekan tombol terbit.
 */

/** Jumlah gambar aktif minimum. Berasal dari MarketplaceProgram, bukan konstanta. */
export const DEFAULT_MINIMUM_IMAGES = 3;

export interface ListingSnapshot {
  sellerStatus: string;
  productIsActive: boolean;
  title: string | null;
  description: string | null;
  marketplaceCategoryId: string | null;
  condition: string | null;
  /** Varian beserta harga dan stoknya. */
  variants: Array<{
    sku: string | null;
    priceMinor: string | null;
    stockQty: number | null;
    allowPreorder: boolean;
    weightGram: number | null;
    lengthMm: number | null;
    widthMm: number | null;
    heightMm: number | null;
  }>;
  /** Media yang sudah lolos validasi dan masih aktif. */
  media: Array<{ id: string; isActive: boolean; isPrimary: boolean; moderationStatus: string }>;
  shippingOriginRef: string | null;
  returnPolicyPublished: boolean;
  taxCategoryId: string | null;
  /** Hasil pemeriksaan produk terlarang; null berarti belum diperiksa. */
  complianceStatus: string | null;
  youtubeVideoId: string | null;
}

export type GateCode =
  | 'SELLER_ACTIVE'
  | 'PRODUCT_ACTIVE'
  | 'TITLE'
  | 'DESCRIPTION'
  | 'CATEGORY'
  | 'CONDITION'
  | 'VARIANT'
  | 'SKU'
  | 'PRICE'
  | 'STOCK_OR_PREORDER'
  | 'WEIGHT'
  | 'DIMENSION'
  | 'SHIPPING_ORIGIN'
  | 'TAX_POLICY'
  | 'RETURN_POLICY'
  | 'MINIMUM_IMAGES'
  | 'PRIMARY_IMAGE'
  | 'MEDIA_MODERATION'
  | 'COMPLIANCE';

export interface GateCheck {
  code: GateCode;
  passed: boolean;
  /** Keterangan yang menyebut apa yang harus diperbaiki. */
  detail: string;
}

export interface GateResult {
  canPublish: boolean;
  checks: GateCheck[];
  /** Hanya yang belum lolos, untuk ditampilkan ringkas. */
  blocking: GateCheck[];
}

/**
 * Memeriksa apakah listing boleh diterbitkan.
 *
 * Seluruh syarat diperiksa, bukan berhenti pada yang pertama gagal. Penjual
 * yang memperbaiki satu hal lalu ditolak karena hal berikutnya akan menyerah;
 * daftar lengkap membuatnya dapat menyelesaikan semuanya sekaligus.
 */
export function evaluatePublicationGate(
  listing: ListingSnapshot,
  options: { minimumImages?: number } = {},
): GateResult {
  const minimumImages = options.minimumImages ?? DEFAULT_MINIMUM_IMAGES;
  const checks: GateCheck[] = [];

  const add = (code: GateCode, passed: boolean, detail: string) =>
    checks.push({ code, passed, detail });

  // --- Penjual dan produk -------------------------------------------------
  add(
    'SELLER_ACTIVE',
    listing.sellerStatus === 'ACTIVE',
    listing.sellerStatus === 'ACTIVE'
      ? 'Penjual aktif.'
      : `Penjual berstatus ${listing.sellerStatus}; selesaikan aktivasi marketplace.`,
  );
  add(
    'PRODUCT_ACTIVE',
    listing.productIsActive,
    listing.productIsActive ? 'Produk aktif.' : 'Produk sumber tidak aktif.',
  );

  // --- Isi listing ---------------------------------------------------------
  const title = (listing.title ?? '').trim();
  add('TITLE', title.length >= 10, title.length >= 10 ? 'Judul terisi.' : 'Judul minimal 10 karakter.');

  const description = (listing.description ?? '').trim();
  add(
    'DESCRIPTION',
    description.length >= 50,
    description.length >= 50 ? 'Deskripsi terisi.' : 'Deskripsi minimal 50 karakter.',
  );

  add(
    'CATEGORY',
    Boolean(listing.marketplaceCategoryId),
    listing.marketplaceCategoryId ? 'Kategori dipilih.' : 'Pilih kategori marketplace.',
  );
  add(
    'CONDITION',
    Boolean(listing.condition),
    listing.condition ? 'Kondisi ditentukan.' : 'Tentukan kondisi barang (baru atau bekas).',
  );

  // --- Varian --------------------------------------------------------------
  const variants = listing.variants ?? [];
  add(
    'VARIANT',
    variants.length > 0,
    variants.length > 0 ? `${variants.length} varian.` : 'Listing harus punya sedikitnya satu varian.',
  );

  const missingSku = variants.filter((v) => !v.sku || v.sku.trim().length === 0).length;
  add(
    'SKU',
    variants.length > 0 && missingSku === 0,
    missingSku === 0 ? 'Seluruh varian punya SKU.' : `${missingSku} varian belum punya SKU.`,
  );

  // Harga diperiksa sebagai nilai positif, bukan sekadar terisi. Harga nol
  // membuat pembeli dapat memesan tanpa membayar.
  const invalidPrice = variants.filter((v) => !isPositiveAmount(v.priceMinor)).length;
  add(
    'PRICE',
    variants.length > 0 && invalidPrice === 0,
    invalidPrice === 0 ? 'Seluruh varian punya harga.' : `${invalidPrice} varian belum punya harga yang sah.`,
  );

  const noStock = variants.filter((v) => (v.stockQty ?? 0) <= 0 && !v.allowPreorder).length;
  add(
    'STOCK_OR_PREORDER',
    variants.length > 0 && noStock === 0,
    noStock === 0
      ? 'Stok atau pre-order tersedia.'
      : `${noStock} varian tanpa stok dan tanpa kebijakan pre-order.`,
  );

  // --- Pengiriman ----------------------------------------------------------
  const noWeight = variants.filter((v) => (v.weightGram ?? 0) <= 0).length;
  add(
    'WEIGHT',
    variants.length > 0 && noWeight === 0,
    noWeight === 0 ? 'Berat terisi.' : `${noWeight} varian belum punya berat.`,
  );

  const noDimension = variants.filter(
    (v) => (v.lengthMm ?? 0) <= 0 || (v.widthMm ?? 0) <= 0 || (v.heightMm ?? 0) <= 0,
  ).length;
  add(
    'DIMENSION',
    variants.length > 0 && noDimension === 0,
    noDimension === 0 ? 'Dimensi terisi.' : `${noDimension} varian belum punya dimensi lengkap.`,
  );

  add(
    'SHIPPING_ORIGIN',
    Boolean(listing.shippingOriginRef),
    listing.shippingOriginRef
      ? 'Alamat asal pengiriman ditentukan.'
      : 'Tentukan alamat asal pengiriman pada pengaturan toko.',
  );

  // --- Kebijakan -----------------------------------------------------------
  add(
    'TAX_POLICY',
    Boolean(listing.taxCategoryId),
    listing.taxCategoryId ? 'Kategori pajak dipilih.' : 'Pilih kategori pajak produk.',
  );
  add(
    'RETURN_POLICY',
    listing.returnPolicyPublished,
    listing.returnPolicyPublished
      ? 'Kebijakan retur sudah terbit.'
      : 'Terbitkan kebijakan retur toko; pembeli berhak mengetahuinya sebelum memesan.',
  );

  // --- Gambar --------------------------------------------------------------
  const activeMedia = (listing.media ?? []).filter((m) => m.isActive);
  add(
    'MINIMUM_IMAGES',
    activeMedia.length >= minimumImages,
    activeMedia.length >= minimumImages
      ? `${activeMedia.length} gambar aktif.`
      : `Perlu ${minimumImages} gambar aktif; saat ini ${activeMedia.length}.`,
  );

  const primaryCount = activeMedia.filter((m) => m.isPrimary).length;
  add(
    'PRIMARY_IMAGE',
    primaryCount === 1,
    primaryCount === 1
      ? 'Gambar utama dipilih.'
      : primaryCount === 0
        ? 'Pilih satu gambar sebagai gambar utama.'
        : `Ada ${primaryCount} gambar utama; hanya boleh satu.`,
  );

  const unmoderated = activeMedia.filter((m) => m.moderationStatus === 'REJECTED').length;
  add(
    'MEDIA_MODERATION',
    unmoderated === 0,
    unmoderated === 0 ? 'Tidak ada gambar yang ditolak.' : `${unmoderated} gambar ditolak moderasi.`,
  );

  // --- Kepatuhan -----------------------------------------------------------
  // Belum diperiksa BUKAN berarti lolos. Produk terlarang yang belum sempat
  // diperiksa tidak boleh tampil hanya karena antrean moderasi menumpuk.
  add(
    'COMPLIANCE',
    listing.complianceStatus === 'PASSED',
    listing.complianceStatus === 'PASSED'
      ? 'Pemeriksaan kepatuhan lolos.'
      : listing.complianceStatus === null
        ? 'Pemeriksaan kepatuhan belum dijalankan.'
        : `Pemeriksaan kepatuhan berstatus ${listing.complianceStatus}.`,
  );

  const blocking = checks.filter((c) => !c.passed);
  return { canPublish: blocking.length === 0, checks, blocking };
}

/** Benar bila nilai desimal dalam bentuk string bernilai lebih dari nol. */
function isPositiveAmount(value: string | null): boolean {
  if (value === null || value.trim().length === 0) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}
