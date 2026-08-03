/**
 * Produk contoh untuk katalog marketplace.
 *
 * Lima puluh produk yang tersebar pada sepuluh kategori, dengan harga,
 * berat, dan stok yang masuk akal. Tujuannya membuat katalog dapat dicoba
 * sungguhan — mencari, menyaring harga, mengurutkan, membuka halaman produk —
 * yang tidak dapat dilakukan dengan tiga produk contoh.
 *
 * ## Produknya dibuat sendiri, tidak meminjam produk ERP
 *
 * Versi pertama seeder mengambil produk yang sudah ada di schema tenant. Itu
 * keliru: produk contoh marketplace memakan produk ERP sungguhan, jumlahnya
 * dibatasi oleh isi tenant, dan menghapus contoh berarti menyentuh data yang
 * bukan miliknya. Kini seluruh produk dibuat sendiri dan ditandai `is_sample`.
 *
 * ## Variasi yang disengaja
 *
 * Beberapa produk sengaja dibuat berbeda dari yang lain agar keadaan yang
 * jarang muncul tetap dapat diuji tanpa menyiapkan data khusus:
 *
 * - stok nol dengan pre-order diizinkan → tampil "Pesan dahulu"
 * - kondisi bekas dan rekondisi → menguji label kondisi
 * - rentang harga antar varian → menguji tampilan "Rp x – Rp y"
 * - judul yang sengaja mirip → menguji peringkat pencarian
 */

export interface SampleProduct {
  /** Kode stabil. Dipakai mengenali baris contoh saat penanaman diulang. */
  code: string;
  title: string;
  description: string;
  categoryCode: string;
  price: number;
  /** Bila diisi, produk punya varian kedua dengan harga ini. */
  priceHigh?: number;
  stock: number;
  weightGram: number;
  condition?: 'NEW' | 'USED' | 'REFURBISHED';
  allowPreorder?: boolean;
}

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  // --- Fashion pria --------------------------------------------------------
  {
    code: 'KAOS-COMBED-30S',
    title: 'Kaos Polos Katun Combed 30s',
    description:
      'Kaos polos berbahan katun combed 30s. Jahitan rantai pada bagian bahu dan ' +
      'kelim, sablon tidak mudah retak setelah dicuci berulang. Tersedia ukuran S ' +
      'sampai XXL. Cocok untuk seragam komunitas maupun pemakaian harian.',
    categoryCode: 'FASHION_PRIA',
    price: 75000,
    priceHigh: 89000,
    stock: 120,
    weightGram: 220,
  },
  {
    code: 'KAOS-OVERSIZE',
    title: 'Kaos Oversize Katun Combed 24s',
    description:
      'Potongan oversize dengan bahan katun combed 24s yang lebih tebal. Bahu ' +
      'turun, badan longgar, panjang menutup pinggul. Tidak melar setelah dicuci.',
    categoryCode: 'FASHION_PRIA',
    price: 95000,
    stock: 64,
    weightGram: 280,
  },
  {
    code: 'KEMEJA-FLANEL',
    title: 'Kemeja Flanel Lengan Panjang',
    description:
      'Kemeja flanel motif kotak dengan bahan tebal namun tetap lembut. Kancing ' +
      'kuat, saku dada kiri, potongan reguler yang tidak menyempit di bahu. ' +
      'Dapat dipakai terbuka sebagai luaran.',
    categoryCode: 'FASHION_PRIA',
    price: 165000,
    stock: 38,
    weightGram: 380,
  },
  {
    code: 'CELANA-CHINO',
    title: 'Celana Chino Pria Slim Fit',
    description:
      'Celana chino berbahan katun stretch sehingga nyaman untuk duduk lama. ' +
      'Potongan slim tanpa mengetat di paha, dilengkapi empat saku dan ikat ' +
      'pinggang berkualitas.',
    categoryCode: 'FASHION_PRIA',
    price: 189000,
    stock: 45,
    weightGram: 420,
  },
  {
    code: 'JAKET-BOMBER',
    title: 'Jaket Bomber Taslan Anti Air',
    description:
      'Jaket bomber berbahan taslan dengan lapisan dalam berjaring. Menahan ' +
      'gerimis dan angin, ringan dibawa, dan dapat dilipat masuk tas.',
    categoryCode: 'FASHION_PRIA',
    price: 245000,
    stock: 22,
    weightGram: 560,
  },

  // --- Fashion wanita ------------------------------------------------------
  {
    code: 'BLOUSE-KATUN',
    title: 'Blouse Katun Lengan Balon',
    description:
      'Blouse berbahan katun rayon yang jatuh dan adem. Lengan balon dengan ' +
      'karet di pergelangan, kerah bulat, panjang menutup pinggul.',
    categoryCode: 'FASHION_WANITA',
    price: 135000,
    stock: 52,
    weightGram: 250,
  },
  {
    code: 'ROK-PLISKET',
    title: 'Rok Plisket Panjang',
    description:
      'Rok plisket berbahan ceruty babydoll dengan pinggang karet penuh. ' +
      'Lipatan tetap rapi setelah dicuci, panjang di bawah mata kaki.',
    categoryCode: 'FASHION_WANITA',
    price: 118000,
    stock: 70,
    weightGram: 300,
  },
  {
    code: 'GAMIS-KATUN',
    title: 'Gamis Katun Toyobo Polos',
    description:
      'Gamis berbahan katun toyobo yang tidak menerawang dan tidak panas. ' +
      'Resleting menyusui di depan, saku samping, dan lengan berkaret.',
    categoryCode: 'FASHION_MUSLIM',
    price: 225000,
    stock: 34,
    weightGram: 480,
  },

  // --- Sepatu dan tas ------------------------------------------------------
  {
    code: 'SEPATU-LARI',
    title: 'Sepatu Lari Ringan Pria',
    description:
      'Sepatu lari dengan bagian atas berbahan jaring yang lapang dan sol karet ' +
      'beralur. Ringan, tidak kaku pada tekukan depan, dan tidak licin di aspal ' +
      'basah. Sol tengah meredam benturan tanpa membuat langkah terasa mengambang.',
    categoryCode: 'FASHION_SEPATU',
    price: 320000,
    stock: 0,
    weightGram: 620,
    allowPreorder: true,
  },
  {
    code: 'SEPATU-KULIT',
    title: 'Sepatu Pantofel Kulit Sapi',
    description:
      'Sepatu formal berbahan kulit sapi asli dengan jahitan Goodyear welt, ' +
      'sehingga sol dapat diganti tanpa merusak bagian atas. Sol karet, bukan ' +
      'kulit, agar tidak licin di lantai keramik.',
    categoryCode: 'FASHION_SEPATU',
    price: 485000,
    stock: 16,
    weightGram: 850,
  },
  {
    code: 'TAS-RANSEL-LAPTOP',
    title: 'Tas Ransel Laptop 15 Inci',
    description:
      'Ransel dengan sekat laptop berlapis busa, bahan luar tahan air, dan tali ' +
      'bahu yang empuk. Terdapat lubang kabel, kantong botol di kedua sisi, dan ' +
      'saku tersembunyi di punggung untuk dompet.',
    categoryCode: 'FASHION_TAS',
    price: 249000,
    stock: 41,
    weightGram: 750,
  },
  {
    code: 'TAS-SELEMPANG',
    title: 'Tas Selempang Kanvas',
    description:
      'Tas selempang berbahan kanvas tebal dengan tali yang dapat disetel. ' +
      'Muat tablet 10 inci, buku catatan, dan botol minum kecil.',
    categoryCode: 'FASHION_TAS',
    price: 129000,
    stock: 58,
    weightGram: 420,
  },

  // --- Makanan dan minuman -------------------------------------------------
  {
    code: 'KOPI-GAYO',
    title: 'Kopi Arabika Gayo 200 Gram',
    description:
      'Biji kopi arabika dari dataran tinggi Gayo, sangrai medium. Dikemas dalam ' +
      'kantong berkatup satu arah agar aroma bertahan. Dapat dipesan dalam bentuk ' +
      'biji utuh atau bubuk sesuai alat seduh.',
    categoryCode: 'MAKANAN_KOPI',
    price: 68000,
    priceHigh: 75000,
    stock: 180,
    weightGram: 220,
  },
  {
    code: 'KOPI-TORAJA',
    title: 'Kopi Arabika Toraja 200 Gram',
    description:
      'Arabika Toraja dengan sangrai medium-dark. Rasa lebih pekat dan pahit ' +
      'terkendali, cocok untuk kopi susu. Digiling saat pesanan masuk.',
    categoryCode: 'MAKANAN_KOPI',
    price: 72000,
    stock: 145,
    weightGram: 220,
  },
  {
    code: 'TEH-HIJAU',
    title: 'Teh Hijau Kering 100 Gram',
    description:
      'Daun teh hijau kering yang dipetik dari kebun di dataran tinggi. Diseduh ' +
      'pada suhu 80 derajat agar tidak pahit.',
    categoryCode: 'MAKANAN_KOPI',
    price: 45000,
    stock: 96,
    weightGram: 120,
  },
  {
    code: 'KERIPIK-SINGKONG',
    title: 'Keripik Singkong Pedas 250 Gram',
    description:
      'Keripik singkong iris tipis dengan bumbu balado. Digoreng dengan minyak ' +
      'yang diganti berkala, dikemas dalam kantong aluminium agar tetap renyah.',
    categoryCode: 'MAKANAN_RINGAN',
    price: 28000,
    stock: 220,
    weightGram: 270,
  },
  {
    code: 'MADU-HUTAN',
    title: 'Madu Hutan Murni 500 ml',
    description:
      'Madu hutan yang dipanen dari sarang liar, tanpa campuran gula maupun air. ' +
      'Kekentalan dan warna dapat berbeda antar panen karena sumber bunganya ' +
      'berubah menurut musim.',
    categoryCode: 'MAKANAN_BAHAN',
    price: 135000,
    stock: 62,
    weightGram: 700,
  },

  // --- Elektronik dan gadget ----------------------------------------------
  {
    code: 'POWERBANK-10K',
    title: 'Powerbank 10000 mAh Fast Charging',
    description:
      'Powerbank kapasitas 10000 mAh dengan dua keluaran USB dan satu USB-C ' +
      'dua arah. Mendukung pengisian cepat 22,5 watt, dilengkapi indikator daya ' +
      'empat tingkat dan pengaman terhadap panas berlebih.',
    categoryCode: 'GADGET_AKSESORIS',
    price: 189000,
    stock: 88,
    weightGram: 240,
  },
  {
    code: 'KABEL-USBC',
    title: 'Kabel USB-C 100W Panjang 2 Meter',
    description:
      'Kabel USB-C ke USB-C berlapis serat nilon dengan inti tembaga penuh. ' +
      'Mendukung daya sampai 100 watt dan pemindahan data. Ujungnya diperkuat ' +
      'agar tidak patah pada titik tekuk.',
    categoryCode: 'GADGET_AKSESORIS',
    price: 59000,
    stock: 250,
    weightGram: 80,
  },
  {
    code: 'EARBUDS-TWS',
    title: 'Earbuds Nirkabel dengan Peredam Bising',
    description:
      'Earbuds Bluetooth 5.3 dengan peredam bising aktif. Tahan empat jam ' +
      'sekali isi, dan kotaknya menambah tiga kali pengisian. Tahan percikan ' +
      'keringat, bukan untuk berenang.',
    categoryCode: 'ELEKTRONIK_AUDIO',
    price: 279000,
    stock: 47,
    weightGram: 180,
  },
  {
    code: 'LAMPU-LED-9W',
    title: 'Lampu LED 9 Watt Putih (Isi 4)',
    description:
      'Empat bohlam LED 9 watt setara 75 watt pijar, cahaya putih 6500K. ' +
      'Fitting E27 standar, tidak berkedip, dan tidak panas saat menyala lama.',
    categoryCode: 'ELEKTRONIK_LAMPU',
    price: 92000,
    stock: 130,
    weightGram: 320,
  },
  {
    code: 'LAPTOP-REKONDISI',
    title: 'Laptop Bisnis 14 Inci Rekondisi',
    description:
      'Laptop bekas pakai kantor yang telah diperiksa menyeluruh: baterai dan ' +
      'penyimpanan diganti baru, badan dibersihkan, sistem dipasang ulang. ' +
      'Goresan halus pada penutup masih ada dan tidak disembunyikan.',
    categoryCode: 'GADGET_LAPTOP',
    price: 3450000,
    stock: 6,
    weightGram: 1600,
    condition: 'REFURBISHED',
  },

  // --- Rumah tangga --------------------------------------------------------
  {
    code: 'PANCI-STAINLESS',
    title: 'Panci Stainless 24 cm Dasar Tebal',
    description:
      'Panci stainless 304 dengan dasar tiga lapis sehingga panas menyebar rata ' +
      'dan tidak gosong di tengah. Aman untuk kompor induksi maupun api langsung.',
    categoryCode: 'RUMAH_DAPUR',
    price: 215000,
    stock: 39,
    weightGram: 1200,
  },
  {
    code: 'PISAU-DAPUR-SET',
    title: 'Set Pisau Dapur 5 Buah dengan Blok Kayu',
    description:
      'Lima pisau baja tahan karat dengan gagang kayu dan blok penyimpan. ' +
      'Ketajaman bertahan lama, tetapi tetap perlu diasah berkala.',
    categoryCode: 'RUMAH_DAPUR',
    price: 178000,
    stock: 28,
    weightGram: 1450,
  },
  {
    code: 'RAK-BUKU-KAYU',
    title: 'Rak Buku Kayu Tiga Tingkat',
    description:
      'Rak buku dari kayu olahan berlapis melamin. Dikirim terurai beserta ' +
      'kunci L dan petunjuk pemasangan. Setiap tingkat menahan sampai 15 kilogram.',
    categoryCode: 'RUMAH_FURNITUR',
    price: 385000,
    stock: 14,
    weightGram: 8500,
  },
];

const EXTRA_CATEGORIES = [
  'FASHION_PRIA',
  'FASHION_WANITA',
  'FASHION_MUSLIM',
  'FASHION_SEPATU',
  'FASHION_TAS',
  'MAKANAN_KOPI',
  'MAKANAN_RINGAN',
  'MAKANAN_BAHAN',
  'GADGET_AKSESORIS',
  'ELEKTRONIK_AUDIO',
  'ELEKTRONIK_LAMPU',
  'GADGET_LAPTOP',
  'RUMAH_DAPUR',
  'RUMAH_FURNITUR',
];

const EXTRA_TITLES = [
  'Polo Katun Pique Reguler',
  'Cardigan Rajut Ringan',
  'Hijab Voal Motif Harian',
  'Sandal Kulit Casual',
  'Dompet Lipat Kulit Sintetis',
  'Kopi Robusta Temanggung 250 Gram',
  'Granola Cokelat Kacang 300 Gram',
  'Bumbu Rendang Instan Premium',
  'Charger USB-C 65W GaN',
  'Speaker Bluetooth Portabel',
  'Lampu Meja LED Lipat',
  'Mouse Wireless Silent',
  'Wajan Anti Lengket 28 cm',
  'Kursi Kerja Ergonomis',
  'Kemeja Oxford Lengan Pendek',
  'Dress Rayon Motif Bunga',
  'Mukena Travel Parasut',
  'Sepatu Sekolah Hitam',
  'Tote Bag Kanvas Tebal',
  'Kopi Susu Botol Siap Minum',
  'Biskuit Gandum Rendah Gula',
  'Saus Sambal Botol 500 ml',
  'Holder Ponsel Mobil',
  'Headset Kabel Mikrofon',
  'Meja Lipat Serbaguna',
];

SAMPLE_PRODUCTS.push(
  ...EXTRA_TITLES.map((title, i): SampleProduct => {
    const categoryCode = EXTRA_CATEGORIES[i % EXTRA_CATEGORIES.length];
    const price = 42_000 + i * 37_000;
    return {
      code: `DEMO-MKT-${String(i + 26).padStart(3, '0')}`,
      title,
      description:
        `${title} untuk melengkapi katalog demo eBisnis dengan variasi harga, ` +
        'kategori, berat, dan stok yang terasa seperti toko aktif. Data ini sengaja dibuat stabil agar calon tenant dapat mencoba pencarian, filter, dan pengurutan berulang kali.',
      categoryCode,
      price,
      stock: 18 + ((i * 17) % 210),
      weightGram: 120 + ((i * 230) % 6200),
      condition: i === 22 ? 'USED' : 'NEW',
      priceHigh: i % 6 === 0 ? price + 25_000 : undefined,
    };
  }),
);

/** Kategori yang dipakai; berguna untuk memeriksa sebaran. */
export const SAMPLE_CATEGORY_CODES = [...new Set(SAMPLE_PRODUCTS.map((p) => p.categoryCode))];
