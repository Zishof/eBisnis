/**
 * Katalog luring — aturan murni tentang kapan salinan lokal boleh dipakai.
 *
 * ## Masalah yang sesungguhnya
 *
 * Menyalin produk dan harga ke mesin kasir itu mudah. Yang sulit adalah
 * memutuskan **kapan salinan itu tidak boleh lagi dipercaya**.
 *
 * Harga yang basi tidak menimbulkan galat apa pun. Kasir menjual, pembeli
 * membayar, struk tercetak — dan baru berminggu-minggu kemudian ketahuan bahwa
 * seluruh transaksi hari itu memakai harga bulan lalu. Tidak ada yang gagal;
 * yang terjadi hanyalah salah, diam-diam.
 *
 * Karena itu setiap salinan membawa umur, dan umur itu punya batas yang
 * berbeda menurut jenis datanya. Nama produk boleh basi seminggu; harga tidak.
 */

/** Jenis data katalog yang disalin ke mesin kasir. */
export type JenisKatalog = 'PRODUK' | 'BARCODE' | 'HARGA' | 'PAJAK' | 'METODE_BAYAR';

/**
 * Berapa lama tiap jenis boleh dipakai tanpa disegarkan.
 *
 * Angkanya dipilih menurut akibat bila salah, bukan menurut seberapa sering
 * datanya berubah:
 *
 * - **Harga dan pajak** langsung menentukan uang yang diterima. Salah sedikit,
 *   salah pada setiap transaksi sesudahnya.
 * - **Produk dan barcode** paling buruk membuat satu barang tidak ditemukan —
 *   kasir tahu seketika dan dapat mencarinya menurut nama.
 * - **Metode pembayaran** jarang berubah, dan perubahannya tidak diam-diam.
 */
export const BATAS_UMUR_MS: Record<JenisKatalog, number> = {
  HARGA: 12 * 60 * 60 * 1000, // 12 jam
  PAJAK: 12 * 60 * 60 * 1000,
  PRODUK: 7 * 24 * 60 * 60 * 1000, // 7 hari
  BARCODE: 7 * 24 * 60 * 60 * 1000,
  METODE_BAYAR: 7 * 24 * 60 * 60 * 1000,
};

export interface UmurSalinan {
  jenis: JenisKatalog;
  /** Kapan salinan ini diambil dari peladen; null bila belum pernah. */
  syncedAt: number | null;
  now: number;
}

export type TingkatKesegaran = 'SEGAR' | 'MENUA' | 'BASI' | 'KOSONG';

export interface PenilaianKatalog {
  level: TingkatKesegaran;
  ageMs: number | null;
  /** Boleh dipakai berjualan? */
  usable: boolean;
  message: string;
}

/** Sesudah berapa bagian dari batasnya, salinan mulai disebut menua. */
const AMBANG_MENUA = 0.5;

export function nilaiKesegaran(u: UmurSalinan): PenilaianKatalog {
  const batas = BATAS_UMUR_MS[u.jenis];

  if (u.syncedAt === null) {
    return {
      level: 'KOSONG',
      ageMs: null,
      usable: false,
      message: `${labelJenis(u.jenis)} belum pernah disalin ke mesin ini. Sambungkan ke peladen sekali sebelum berjualan luring.`,
    };
  }

  const umur = Math.max(0, u.now - u.syncedAt);

  if (umur > batas) {
    return {
      level: 'BASI',
      ageMs: umur,
      // Sengaja TIDAK boleh dipakai. Menjual dengan harga yang mungkin sudah
      // berubah tidak menimbulkan galat apa pun — dan itulah yang membuatnya
      // berbahaya.
      usable: false,
      message:
        `${labelJenis(u.jenis)} terakhir disalin ${jam(umur)} lalu, melewati batas ${jam(batas)}. ` +
        'Sambungkan ke peladen untuk menyegarkannya sebelum melanjutkan.',
    };
  }

  if (umur > batas * AMBANG_MENUA) {
    return {
      level: 'MENUA',
      ageMs: umur,
      usable: true,
      message: `${labelJenis(u.jenis)} disalin ${jam(umur)} lalu. Masih dipakai, tetapi sebaiknya disegarkan.`,
    };
  }

  return {
    level: 'SEGAR',
    ageMs: umur,
    usable: true,
    message: `${labelJenis(u.jenis)} disalin ${jam(umur)} lalu.`,
  };
}

/**
 * Kesiapan berjualan luring secara keseluruhan.
 *
 * Satu jenis yang basi sudah cukup untuk menghentikan penjualan luring —
 * bukan karena kaku, tetapi karena tidak ada gunanya menjual dengan harga
 * yang tidak dapat dipertanggungjawabkan.
 */
export function siapLuring(penilaian: PenilaianKatalog[]): {
  ready: boolean;
  blockers: PenilaianKatalog[];
  warnings: PenilaianKatalog[];
} {
  const penghalang = penilaian.filter((p) => !p.usable);
  const peringatan = penilaian.filter((p) => p.usable && p.level === 'MENUA');
  return { ready: penghalang.length === 0, blockers: penghalang, warnings: peringatan };
}

function labelJenis(j: JenisKatalog): string {
  switch (j) {
    case 'HARGA':
      return 'Harga';
    case 'PAJAK':
      return 'Tarif pajak';
    case 'PRODUK':
      return 'Daftar produk';
    case 'BARCODE':
      return 'Barcode';
    case 'METODE_BAYAR':
      return 'Metode pembayaran';
    default:
      return j;
  }
}

/** Umur dalam kalimat yang wajar dibaca, bukan dalam milidetik. */
export function jam(ms: number): string {
  /*
   * Diperiksa dalam milidetik, bukan setelah dibulatkan ke menit.
   * `Math.round(30_000 / 60_000)` bernilai 1 — pembulatan setengah ke atas —
   * sehingga tiga puluh detik terbaca "1 menit". Salah kecil, tetapi pada
   * layar yang dipakai menilai apakah salinan masih segar, angka yang
   * dilebihkan justru menyesatkan ke arah yang salah.
   */
  if (ms < 60_000) return 'kurang dari semenit';
  const menit = Math.round(ms / 60_000);
  if (menit < 60) return `${menit} menit`;
  const j = Math.round(menit / 60);
  if (j < 24) return `${j} jam`;
  const h = Math.round(j / 24);
  return `${h} hari`;
}

// --- Bentuk data yang disalin ----------------------------------------------

export interface ProdukLokal {
  productId: string;
  code: string;
  name: string;
  sku: string | null;
  uomId: string | null;
  /** Harga saat disalin. Bukan sumber kebenaran; peladen tetap menghitung ulang. */
  price: string | null;
  currencyCode: string | null;
  /** Barcode utama dan alternatif, supaya pencarian luring memakai satu tempat. */
  barcodes: string[];
}

/**
 * Mencari produk dari barcode pada salinan lokal.
 *
 * Barcode utama dan alternatif diperlakukan sama — pemindai tidak tahu bedanya,
 * dan kasir tidak seharusnya perlu tahu.
 */
export function cariBarcode(produk: ProdukLokal[], kode: string): ProdukLokal | null {
  const bersih = kode.trim();
  if (!bersih) return null;
  return produk.find((p) => p.barcodes.includes(bersih)) ?? null;
}

/**
 * Mencari produk menurut nama atau SKU pada salinan lokal.
 *
 * Pencocokan tidak peka huruf besar-kecil dan mencocokkan bagian mana pun —
 * kasir yang mengetik "susu" harus menemukan "Kopi Susu".
 */
export function cariProduk(produk: ProdukLokal[], kunci: string, batas = 24): ProdukLokal[] {
  const k = kunci.trim().toLowerCase();
  if (k.length < 2) return [];
  return produk
    .filter(
      (p) =>
        p.name.toLowerCase().includes(k) ||
        (p.sku ?? '').toLowerCase().includes(k) ||
        p.code.toLowerCase().includes(k),
    )
    .slice(0, batas);
}
