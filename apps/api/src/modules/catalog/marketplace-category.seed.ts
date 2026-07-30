/**
 * Katalog kategori marketplace.
 *
 * Dibangun pada V9-5, lebih awal dari yang direncanakan (V9-12), karena tanpa
 * kategori tidak ada satu pun listing yang dapat lolos gerbang publikasi — dan
 * tanpa listing terbit, tidak ada yang dapat diproyeksikan maupun dicari.
 * Seluruh fase ini tidak dapat dibuktikan berjalan tanpanya.
 *
 * Yang dibangun di sini adalah kerangka yang cukup untuk berjualan, bukan
 * taksonomi lengkap. Kategori tambahan menyusul lewat antarmuka platform.
 *
 * Aturan bentuk:
 *
 * - Hanya kategori **daun** yang boleh dipilih listing. Kategori induk ada
 *   untuk menavigasi. Tanpa aturan ini penjual akan menaruh produk pada
 *   "Fashion" dan pembeli tidak pernah menemukannya lewat penelusuran.
 * - Kategori **terbatas** menandai barang yang menuntut pemeriksaan tambahan.
 *   Penandaan ini tidak menghalangi apa pun pada fase ini; ia menyiapkan
 *   tempat bagi moderasi V9-12 agar kategorinya tidak perlu diubah kemudian.
 */

export interface CategorySeed {
  code: string;
  name: string;
  slug: string;
  /** `null` berarti kategori akar. */
  parentCode: string | null;
  iconName?: string;
  sortOrder: number;
  isRestricted?: boolean;
  restrictionNote?: string;
  description?: string;
}

/**
 * Sebelas akar dengan anak-anaknya.
 *
 * Urutan pada berkas ini menentukan urutan tampil; induk selalu didahulukan
 * agar penanaman dapat berjalan sekali lintas tanpa menunda anak yatim.
 */
export const MARKETPLACE_CATEGORIES: CategorySeed[] = [
  // --- Fashion -------------------------------------------------------------
  { code: 'FASHION', name: 'Fashion', slug: 'fashion', parentCode: null, iconName: 'shirt', sortOrder: 10 },
  { code: 'FASHION_PRIA', name: 'Fashion Pria', slug: 'fashion-pria', parentCode: 'FASHION', sortOrder: 1 },
  { code: 'FASHION_WANITA', name: 'Fashion Wanita', slug: 'fashion-wanita', parentCode: 'FASHION', sortOrder: 2 },
  { code: 'FASHION_ANAK', name: 'Fashion Anak', slug: 'fashion-anak', parentCode: 'FASHION', sortOrder: 3 },
  { code: 'FASHION_MUSLIM', name: 'Fashion Muslim', slug: 'fashion-muslim', parentCode: 'FASHION', sortOrder: 4 },
  { code: 'FASHION_SEPATU', name: 'Sepatu', slug: 'sepatu', parentCode: 'FASHION', sortOrder: 5 },
  { code: 'FASHION_TAS', name: 'Tas', slug: 'tas', parentCode: 'FASHION', sortOrder: 6 },
  { code: 'FASHION_AKSESORIS', name: 'Aksesoris Fashion', slug: 'aksesoris-fashion', parentCode: 'FASHION', sortOrder: 7 },

  // --- Elektronik ----------------------------------------------------------
  { code: 'ELEKTRONIK', name: 'Elektronik', slug: 'elektronik', parentCode: null, iconName: 'plug', sortOrder: 20 },
  { code: 'ELEKTRONIK_RUMAH', name: 'Elektronik Rumah Tangga', slug: 'elektronik-rumah-tangga', parentCode: 'ELEKTRONIK', sortOrder: 1 },
  { code: 'ELEKTRONIK_AUDIO', name: 'Audio dan Video', slug: 'audio-video', parentCode: 'ELEKTRONIK', sortOrder: 2 },
  { code: 'ELEKTRONIK_KAMERA', name: 'Kamera', slug: 'kamera', parentCode: 'ELEKTRONIK', sortOrder: 3 },
  { code: 'ELEKTRONIK_LAMPU', name: 'Lampu dan Kelistrikan', slug: 'lampu-kelistrikan', parentCode: 'ELEKTRONIK', sortOrder: 4 },

  // --- Handphone dan komputer ---------------------------------------------
  { code: 'GADGET', name: 'Handphone dan Komputer', slug: 'handphone-komputer', parentCode: null, iconName: 'smartphone', sortOrder: 30 },
  { code: 'GADGET_HP', name: 'Handphone', slug: 'handphone', parentCode: 'GADGET', sortOrder: 1 },
  { code: 'GADGET_TABLET', name: 'Tablet', slug: 'tablet', parentCode: 'GADGET', sortOrder: 2 },
  { code: 'GADGET_LAPTOP', name: 'Laptop', slug: 'laptop', parentCode: 'GADGET', sortOrder: 3 },
  { code: 'GADGET_KOMPUTER', name: 'Komputer dan Komponen', slug: 'komputer-komponen', parentCode: 'GADGET', sortOrder: 4 },
  { code: 'GADGET_AKSESORIS', name: 'Aksesoris Gadget', slug: 'aksesoris-gadget', parentCode: 'GADGET', sortOrder: 5 },

  // --- Makanan dan minuman -------------------------------------------------
  {
    code: 'MAKANAN', name: 'Makanan dan Minuman', slug: 'makanan-minuman', parentCode: null,
    iconName: 'utensils', sortOrder: 40,
  },
  { code: 'MAKANAN_RINGAN', name: 'Makanan Ringan', slug: 'makanan-ringan', parentCode: 'MAKANAN', sortOrder: 1 },
  { code: 'MAKANAN_SIAP', name: 'Makanan Siap Saji', slug: 'makanan-siap-saji', parentCode: 'MAKANAN', sortOrder: 2 },
  { code: 'MAKANAN_BAHAN', name: 'Bahan Makanan', slug: 'bahan-makanan', parentCode: 'MAKANAN', sortOrder: 3 },
  { code: 'MAKANAN_MINUMAN', name: 'Minuman', slug: 'minuman', parentCode: 'MAKANAN', sortOrder: 4 },
  { code: 'MAKANAN_KOPI', name: 'Kopi dan Teh', slug: 'kopi-teh', parentCode: 'MAKANAN', sortOrder: 5 },

  // --- Kesehatan dan kecantikan -------------------------------------------
  { code: 'KESEHATAN', name: 'Kesehatan dan Kecantikan', slug: 'kesehatan-kecantikan', parentCode: null, iconName: 'heart-pulse', sortOrder: 50 },
  { code: 'KESEHATAN_SKINCARE', name: 'Perawatan Kulit', slug: 'perawatan-kulit', parentCode: 'KESEHATAN', sortOrder: 1 },
  { code: 'KESEHATAN_MAKEUP', name: 'Riasan', slug: 'riasan', parentCode: 'KESEHATAN', sortOrder: 2 },
  { code: 'KESEHATAN_RAMBUT', name: 'Perawatan Rambut', slug: 'perawatan-rambut', parentCode: 'KESEHATAN', sortOrder: 3 },
  {
    code: 'KESEHATAN_SUPLEMEN', name: 'Suplemen dan Vitamin', slug: 'suplemen-vitamin', parentCode: 'KESEHATAN',
    sortOrder: 4, isRestricted: true,
    restrictionNote: 'Menuntut izin edar BPOM. Klaim khasiat diperiksa sebelum terbit.',
  },
  {
    code: 'KESEHATAN_ALKES', name: 'Alat Kesehatan', slug: 'alat-kesehatan', parentCode: 'KESEHATAN',
    sortOrder: 5, isRestricted: true,
    restrictionNote: 'Menuntut izin distribusi alat kesehatan.',
  },

  // --- Rumah tangga --------------------------------------------------------
  { code: 'RUMAH', name: 'Rumah Tangga', slug: 'rumah-tangga', parentCode: null, iconName: 'house', sortOrder: 60 },
  { code: 'RUMAH_DAPUR', name: 'Peralatan Dapur', slug: 'peralatan-dapur', parentCode: 'RUMAH', sortOrder: 1 },
  { code: 'RUMAH_FURNITUR', name: 'Furnitur', slug: 'furnitur', parentCode: 'RUMAH', sortOrder: 2 },
  { code: 'RUMAH_DEKORASI', name: 'Dekorasi', slug: 'dekorasi', parentCode: 'RUMAH', sortOrder: 3 },
  { code: 'RUMAH_KEBERSIHAN', name: 'Kebersihan Rumah', slug: 'kebersihan-rumah', parentCode: 'RUMAH', sortOrder: 4 },
  { code: 'RUMAH_TAMAN', name: 'Taman dan Luar Ruang', slug: 'taman-luar-ruang', parentCode: 'RUMAH', sortOrder: 5 },

  // --- Ibu dan bayi --------------------------------------------------------
  { code: 'IBU_BAYI', name: 'Ibu dan Bayi', slug: 'ibu-bayi', parentCode: null, iconName: 'baby', sortOrder: 70 },
  { code: 'IBU_PERLENGKAPAN', name: 'Perlengkapan Bayi', slug: 'perlengkapan-bayi', parentCode: 'IBU_BAYI', sortOrder: 1 },
  {
    code: 'IBU_SUSU', name: 'Susu dan Makanan Bayi', slug: 'susu-makanan-bayi', parentCode: 'IBU_BAYI',
    sortOrder: 2, isRestricted: true,
    restrictionNote: 'Susu formula bayi di bawah 1 tahun tunduk pada pembatasan promosi.',
  },
  { code: 'IBU_MAINAN', name: 'Mainan Anak', slug: 'mainan-anak', parentCode: 'IBU_BAYI', sortOrder: 3 },

  // --- Olahraga ------------------------------------------------------------
  { code: 'OLAHRAGA', name: 'Olahraga dan Luar Ruang', slug: 'olahraga', parentCode: null, iconName: 'dumbbell', sortOrder: 80 },
  { code: 'OLAHRAGA_ALAT', name: 'Alat Olahraga', slug: 'alat-olahraga', parentCode: 'OLAHRAGA', sortOrder: 1 },
  { code: 'OLAHRAGA_PAKAIAN', name: 'Pakaian Olahraga', slug: 'pakaian-olahraga', parentCode: 'OLAHRAGA', sortOrder: 2 },
  { code: 'OLAHRAGA_SEPEDA', name: 'Sepeda', slug: 'sepeda', parentCode: 'OLAHRAGA', sortOrder: 3 },

  // --- Otomotif ------------------------------------------------------------
  { code: 'OTOMOTIF', name: 'Otomotif', slug: 'otomotif', parentCode: null, iconName: 'car', sortOrder: 90 },
  { code: 'OTOMOTIF_MOTOR', name: 'Suku Cadang Motor', slug: 'suku-cadang-motor', parentCode: 'OTOMOTIF', sortOrder: 1 },
  { code: 'OTOMOTIF_MOBIL', name: 'Suku Cadang Mobil', slug: 'suku-cadang-mobil', parentCode: 'OTOMOTIF', sortOrder: 2 },
  { code: 'OTOMOTIF_AKSESORIS', name: 'Aksesoris Kendaraan', slug: 'aksesoris-kendaraan', parentCode: 'OTOMOTIF', sortOrder: 3 },

  // --- Kantor dan industri -------------------------------------------------
  { code: 'KANTOR', name: 'Kantor dan Industri', slug: 'kantor-industri', parentCode: null, iconName: 'briefcase', sortOrder: 100 },
  { code: 'KANTOR_ATK', name: 'Alat Tulis Kantor', slug: 'alat-tulis-kantor', parentCode: 'KANTOR', sortOrder: 1 },
  { code: 'KANTOR_MESIN', name: 'Mesin dan Peralatan', slug: 'mesin-peralatan', parentCode: 'KANTOR', sortOrder: 2 },
  { code: 'KANTOR_KEMASAN', name: 'Kemasan dan Pengiriman', slug: 'kemasan-pengiriman', parentCode: 'KANTOR', sortOrder: 3 },
  { code: 'KANTOR_SAFETY', name: 'Alat Keselamatan Kerja', slug: 'alat-keselamatan-kerja', parentCode: 'KANTOR', sortOrder: 4 },

  // --- Hobi ----------------------------------------------------------------
  { code: 'HOBI', name: 'Hobi dan Koleksi', slug: 'hobi-koleksi', parentCode: null, iconName: 'palette', sortOrder: 110 },
  { code: 'HOBI_BUKU', name: 'Buku', slug: 'buku', parentCode: 'HOBI', sortOrder: 1 },
  { code: 'HOBI_MUSIK', name: 'Alat Musik', slug: 'alat-musik', parentCode: 'HOBI', sortOrder: 2 },
  { code: 'HOBI_KERAJINAN', name: 'Kerajinan Tangan', slug: 'kerajinan-tangan', parentCode: 'HOBI', sortOrder: 3 },
  { code: 'HOBI_KOLEKSI', name: 'Barang Koleksi', slug: 'barang-koleksi', parentCode: 'HOBI', sortOrder: 4 },
];

/** Kode akar, untuk pemeriksaan bentuk dan tampilan beranda. */
export const ROOT_CATEGORY_CODES = MARKETPLACE_CATEGORIES.filter((c) => c.parentCode === null).map(
  (c) => c.code,
);

/**
 * Kode kategori yang punya anak. Kategori ini **tidak boleh** dipilih listing.
 *
 * Dihitung dari data, bukan ditulis tangan, agar penambahan anak baru otomatis
 * mengubah induknya menjadi bukan-daun tanpa ada yang perlu diingat.
 */
export function computeParentCodes(seeds: CategorySeed[] = MARKETPLACE_CATEGORIES): Set<string> {
  const parents = new Set<string>();
  for (const seed of seeds) {
    if (seed.parentCode) parents.add(seed.parentCode);
  }
  return parents;
}

/** Menyusun jalur materialized, mis. `/FASHION/FASHION_PRIA`. */
export function buildPath(code: string, seeds: CategorySeed[] = MARKETPLACE_CATEGORIES): string {
  const byCode = new Map(seeds.map((s) => [s.code, s]));
  const segments: string[] = [];
  let cursor: string | null = code;
  // Batas iterasi menjaga dari data yang membentuk lingkaran; tanpanya satu
  // baris salah membuat penanaman berjalan tanpa henti.
  for (let depth = 0; cursor && depth < 16; depth += 1) {
    segments.unshift(cursor);
    cursor = byCode.get(cursor)?.parentCode ?? null;
  }
  return `/${segments.join('/')}`;
}
