export type BusinessVerticalCode =
  | 'barbershop'
  | 'salon'
  | 'bengkelmotor'
  | 'bengkelmobil'
  | 'bengkelsepeda'
  | 'restoran'
  | 'cafe'
  | 'kuliner'
  | 'fashion'
  | 'toko'
  | 'warteg'
  | 'jasa'
  | 'tokopertanian'
  | 'olahanpertanian'
  | 'fitnes'
  | 'spa'
  | 'katering'
  | 'minimarket'
  | 'kosmetik'
  | 'kerajinan'
  | 'agribisnis'
  | 'laundry'
  | 'cucimobil'
  | 'cucimotor'
  | 'rentalkendaraan'
  | 'inventory'
  | 'rentalsepeda'
  | 'tokoelektronik'
  | 'tokobangunan'
  | 'percetakan'
  | 'optik'
  | 'eventorganizer'
  | 'rentalalat'
  | 'jasakebersihan';

export interface BusinessVertical {
  code: BusinessVerticalCode;
  aliases: string[];
  title: string;
  tenantSuffix: string;
  category: string;
  audience: string;
  headline: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  color: string;
  metrics: Array<{ label: string; value: string; note: string }>;
  workflows: string[];
  features: string[];
  sampleData: Array<{ label: string; count: string }>;
}

export const BUSINESS_VERTICALS: BusinessVertical[] = [
  {
    code: 'barbershop',
    aliases: ['barbershop', 'barber', 'barbershot'],
    title: 'Barbershop',
    tenantSuffix: 'barbershop',
    category: 'Jasa grooming pria',
    audience: 'Barbershop, pangkas rambut, dan grooming pria',
    headline: 'Booking kursi, kasir, membership, dan komisi barber dalam satu layar kerja.',
    description:
      'Dirancang untuk antrean cepat, paket cukur, treatment, produk pomade, jadwal barber, komisi, dan riwayat pelanggan.',
    imageUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1400&q=82',
    imageAlt: 'Kursi dan alat barbershop profesional',
    color: 'slate',
    metrics: [
      { label: 'Kursi aktif', value: '6', note: 'booking per jam' },
      { label: 'Layanan demo', value: '120', note: 'paket cukur dan grooming' },
      { label: 'Transaksi contoh', value: '1.000', note: 'selalu siap untuk demo' },
    ],
    workflows: ['Booking kursi', 'Kasir cepat', 'Komisi barber', 'Membership pelanggan'],
    features: ['Jadwal barber', 'Paket layanan', 'Produk retail', 'Riwayat kunjungan', 'Promo ulang tahun', 'Laporan komisi'],
    sampleData: [
      { label: 'Layanan dan produk', count: '120' },
      { label: 'Pelanggan', count: '250' },
      { label: 'Transaksi', count: '1.000' },
    ],
  },
  {
    code: 'salon',
    aliases: ['salon'],
    title: 'Salon',
    tenantSuffix: 'salon',
    category: 'Kecantikan dan perawatan',
    audience: 'Salon wanita, beauty studio, nail art, dan treatment kecantikan',
    headline: 'Website booking, katalog layanan, invoice, dashboard, dan aplikasi pelanggan salon.',
    description:
      'Menggabungkan alur booking, kursi/petugas, paket treatment, produk kecantikan, membership, dan pengumuman promo toko.',
    imageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=82',
    imageAlt: 'Aktivitas salon kecantikan modern',
    color: 'rose',
    metrics: [
      { label: 'Produk/layanan', value: '120+', note: 'siap katalog' },
      { label: 'Transaksi contoh', value: '1.000', note: 'dashboard realistik' },
      { label: 'Omzet selesai', value: 'Rp 125 jt', note: 'contoh periode demo' },
    ],
    workflows: ['Booking online', 'Kursi dan petugas', 'Invoice layanan', 'Portal pelanggan'],
    features: ['Pengumuman promo', 'APK pelanggan', 'Katalog layanan', 'Paket treatment', 'Komisi stylist', 'Laporan member'],
    sampleData: [
      { label: 'Layanan dan produk', count: '120' },
      { label: 'Booking', count: '500' },
      { label: 'Transaksi', count: '1.000' },
    ],
  },
  {
    code: 'inventory',
    aliases: ['inventory', 'sales'],
    title: 'Sales dan Inventory',
    tenantSuffix: 'inventory',
    category: 'Distribusi dan sales lapangan',
    audience: 'Distributor obat, sales lapangan, gudang, dan pemilik usaha',
    headline: 'Inventory obat terintegrasi dari sales lapangan sampai dashboard pemilik.',
    description:
      'Cocok untuk master obat, customer, supplier, batch-expiry, piutang, hutang, harga per pelanggan, dan laporan per sales.',
    imageUrl: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1400&q=82',
    imageAlt: 'Rak obat dan pengelolaan inventory farmasi',
    color: 'teal',
    metrics: [
      { label: 'Master barang', value: '626', note: 'contoh CMN' },
      { label: 'Customer aktif', value: '334', note: 'warung/toko pelanggan' },
      { label: 'Transaksi legacy', value: '94.072', note: 'penjualan historis' },
    ],
    workflows: ['Order sales', 'Cek stok', 'Batch dan expiry', 'Piutang per pelanggan'],
    features: ['Dashboard owner', 'Laporan per sales', 'Harga khusus customer', 'Supplier dan pembelian', 'Stok opname', 'Aging piutang'],
    sampleData: [
      { label: 'Produk obat', count: '626' },
      { label: 'Customer', count: '334' },
      { label: 'Penjualan', count: '94.072' },
    ],
  },
  {
    code: 'bengkelmotor',
    aliases: ['bengkelmotor', 'bengkel-motor'],
    title: 'Bengkel Motor',
    tenantSuffix: 'bengkelmotor',
    category: 'Servis dan sparepart',
    audience: 'Bengkel motor, toko sparepart, dan servis berkala',
    headline: 'Work order servis motor, sparepart, mekanik, dan invoice pelanggan.',
    description:
      'Kelola antrean servis, diagnosa, estimasi biaya, sparepart, jasa mekanik, garansi, dan reminder servis berikutnya.',
    imageUrl: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1400&q=82',
    imageAlt: 'Motor sedang diperiksa di bengkel',
    color: 'amber',
    metrics: [
      { label: 'WO aktif', value: '38', note: 'servis hari ini' },
      { label: 'SKU sparepart', value: '850', note: 'demo stok' },
      { label: 'Mekanik', value: '8', note: 'jadwal dan komisi' },
    ],
    workflows: ['Check-in kendaraan', 'Estimasi servis', 'Picking sparepart', 'Invoice dan garansi'],
    features: ['Riwayat kendaraan', 'Reminder servis', 'Komisi mekanik', 'Pembelian sparepart', 'Stok minimum', 'Laporan margin jasa'],
    sampleData: [
      { label: 'Sparepart', count: '850' },
      { label: 'Pelanggan', count: '600' },
      { label: 'Work order', count: '1.000' },
    ],
  },
  {
    code: 'bengkelmobil',
    aliases: ['bengkelmobil', 'bengkel-mobil'],
    title: 'Bengkel Mobil',
    tenantSuffix: 'bengkelmobil',
    category: 'Servis kendaraan',
    audience: 'Bengkel mobil, detailing, body repair, dan toko onderdil',
    headline: 'Estimasi, work order, part, teknisi, dan progress servis mobil.',
    description:
      'Mendukung booking servis, inspeksi kendaraan, estimasi, approval pelanggan, penggunaan part, dan tagihan bertahap.',
    imageUrl: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=1400&q=82',
    imageAlt: 'Mekanik memeriksa mobil di bengkel',
    color: 'blue',
    metrics: [
      { label: 'Unit masuk', value: '24', note: 'hari ini' },
      { label: 'Part aktif', value: '1.200', note: 'stok dan vendor' },
      { label: 'SLA selesai', value: '92%', note: 'bulan ini' },
    ],
    workflows: ['Booking servis', 'Inspeksi awal', 'Approval estimasi', 'Serah terima kendaraan'],
    features: ['Foto kondisi kendaraan', 'Estimasi bertahap', 'Part dan jasa', 'Garansi pekerjaan', 'Teknisi dan bay', 'Laporan produktivitas'],
    sampleData: [
      { label: 'Part dan jasa', count: '1.200' },
      { label: 'Customer', count: '500' },
      { label: 'Work order', count: '1.000' },
    ],
  },
  {
    code: 'bengkelsepeda',
    aliases: ['bengkelsepeda', 'bengkel-sepeda'],
    title: 'Bengkel Sepeda',
    tenantSuffix: 'bengkelsepeda',
    category: 'Sepeda dan aksesoris',
    audience: 'Bengkel sepeda, toko part, dan rental komunitas',
    headline: 'Servis sepeda, part, booking teknisi, dan katalog aksesoris.',
    description:
      'Untuk tune-up, sparepart, wheelset, aksesoris, membership komunitas, dan jadwal servis sepeda pelanggan.',
    imageUrl: 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1400&q=82',
    imageAlt: 'Sepeda di area servis bengkel',
    color: 'cyan',
    metrics: [
      { label: 'Booking', value: '19', note: 'minggu ini' },
      { label: 'Part', value: '420', note: 'stok demo' },
      { label: 'Komunitas', value: '12', note: 'segmen pelanggan' },
    ],
    workflows: ['Booking servis', 'Cek kondisi', 'Pasang part', 'Notifikasi selesai'],
    features: ['Riwayat sepeda', 'Paket tune-up', 'Stok part', 'Membership', 'Komunitas', 'Laporan jasa'],
    sampleData: [
      { label: 'Part dan jasa', count: '420' },
      { label: 'Pelanggan', count: '280' },
      { label: 'Transaksi', count: '1.000' },
    ],
  },
  {
    code: 'restoran',
    aliases: ['restoran', 'restaurant'],
    title: 'Restoran',
    tenantSuffix: 'restoran',
    category: 'F&B dine-in dan delivery',
    audience: 'Restoran, rumah makan, dan dapur pesanan',
    headline: 'Meja, order dapur, kasir, bahan baku, dan laporan menu terlaris.',
    description:
      'POS F&B dengan dine-in, take away, delivery, kitchen display, resep/HPP, promo, dan stok bahan.',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1400&q=82',
    imageAlt: 'Dapur restoran menyiapkan pesanan',
    color: 'orange',
    metrics: [
      { label: 'Meja aktif', value: '32', note: 'floor plan demo' },
      { label: 'Menu', value: '180', note: 'makanan dan minuman' },
      { label: 'Order contoh', value: '1.000', note: 'dine-in/delivery' },
    ],
    workflows: ['Pesan meja', 'Order dapur', 'Split bill', 'Rekap shift'],
    features: ['Kitchen display', 'Resep HPP', 'Promo paket', 'Inventory bahan', 'Waiter mobile', 'Laporan jam sibuk'],
    sampleData: [
      { label: 'Menu', count: '180' },
      { label: 'Customer', count: '350' },
      { label: 'Transaksi', count: '1.000' },
    ],
  },
  {
    code: 'cafe',
    aliases: ['cafe', 'kafe'],
    title: 'Cafe',
    tenantSuffix: 'cafe',
    category: 'Coffee shop dan snack',
    audience: 'Kafe, coffee shop, dessert bar, dan kedai minuman',
    headline: 'Kasir cepat, meja, member, resep kopi, dan promo pelanggan setia.',
    description:
      'Didesain untuk transaksi cepat, varian menu, topping, resep bahan, shift barista, voucher, dan loyalti.',
    imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1400&q=82',
    imageAlt: 'Area kafe dengan meja dan barista',
    color: 'stone',
    metrics: [
      { label: 'Menu aktif', value: '95', note: 'kopi, non-kopi, dessert' },
      { label: 'Member', value: '430', note: 'loyalti demo' },
      { label: 'Jam sibuk', value: '19:00', note: 'berdasarkan transaksi' },
    ],
    workflows: ['Kasir cepat', 'Topping dan varian', 'Loyalti member', 'Shift barista'],
    features: ['Resep bahan', 'Promo bundling', 'QRIS', 'Stok bahan', 'Member point', 'Dashboard jam sibuk'],
    sampleData: [
      { label: 'Menu', count: '95' },
      { label: 'Member', count: '430' },
      { label: 'Transaksi', count: '1.000' },
    ],
  },
];

const EXTRA_VERTICALS: BusinessVertical[] = [
  simpleVertical('kuliner', ['kuliner'], 'Kuliner', 'Warung, jajanan, cloud kitchen, dan usaha makanan rumahan', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('fashion', ['fashion', 'fasion', 'butik'], 'Fashion', 'Butik, toko pakaian, konveksi kecil, ukuran, warna, dan katalog online', 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('toko', ['toko', 'kelontong', 'tokokelontong'], 'Toko Kelontong', 'Retail harian, grosir kecil, barcode, stok rak, dan utang pelanggan', 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('warteg', ['warteg', 'warungtegal'], 'Warteg', 'Menu harian, lauk matang, paket makan, kasir cepat, dan kontrol bahan', 'https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('jasa', ['jasa', 'jasaumum'], 'Jasa Umum', 'Jadwal teknisi, quotation, work order, invoice, dan pembayaran termin', 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('tokopertanian', ['tokopertanian', 'toko-pertanian'], 'Toko Pertanian', 'Pupuk, benih, pestisida, alat tani, pelanggan petani, dan jatuh tempo', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('olahanpertanian', ['olahanpertanian', 'olahan-pertanian'], 'Olahan Pertanian', 'Batch produksi, bahan baku panen, expiry, distribusi, dan reseller', 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('fitnes', ['fitnes', 'fitness', 'gym'], 'Fitness', 'Member gym, paket kelas, trainer, jadwal, dan pembayaran langganan', 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('spa', ['spa'], 'Spa', 'Booking therapist, room, paket treatment, komisi, dan membership relaksasi', 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('katering', ['katering', 'catering'], 'Katering', 'Paket acara, produksi dapur, bahan baku, pengiriman, dan termin pembayaran', 'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('minimarket', ['minimarket'], 'Minimarket', 'Barcode, promo rak, stok cabang, kasir shift, supplier, dan laporan margin', 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('kosmetik', ['kosmetik', 'skincare'], 'Kosmetik dan Kecantikan', 'Batch, expiry, varian shade, member, promo, dan katalog produk kecantikan', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('kerajinan', ['kerajinan', 'craft'], 'Kerajinan', 'Produksi kecil, bahan, katalog, konsinyasi, reseller, dan order custom', 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('agribisnis', ['agribisnis'], 'Agribisnis', 'Panen, input produksi, pembelian hasil, grading, batch, dan distribusi', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('laundry', ['laundry', 'laundy', 'laundri'], 'Laundry', 'Kiloan, satuan, antar jemput, tag cucian, status proses, dan komplain', 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('cucimobil', ['cucimobil', 'cuci-mobil', 'carwash'], 'Cuci Mobil', 'Booking slot, paket cuci, membership, add-on coating, dan kasir cepat', 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('cucimotor', ['cucimotor', 'cuci-motor'], 'Cuci Motor', 'Antrean motor, paket cuci, membership, kasir, dan riwayat pelanggan', 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('rentalkendaraan', ['rentalkendaraan', 'rental-kendaraan'], 'Rental Kendaraan', 'Armada, kalender sewa, deposit, kontrak, denda, dan pengembalian', 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('rentalsepeda', ['rentalsepeda', 'rental-sepeda'], 'Rental Sepeda', 'Sewa harian, paket wisata, deposit, jadwal kembali, dan maintenance unit', 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('tokoelektronik', ['tokoelektronik', 'elektronik'], 'Toko Elektronik', 'Serial number, garansi, cicilan, bundling, dan servis purna jual', 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('tokobangunan', ['tokobangunan', 'toko-bangunan'], 'Toko Bangunan', 'Material, satuan besar, proyek pelanggan, pengiriman, dan harga grosir', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('percetakan', ['percetakan', 'printing'], 'Percetakan', 'Order desain, produksi, finishing, revisi, invoice, dan jadwal ambil', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('optik', ['optik'], 'Optik', 'Frame, lensa, resep, garansi, customer, dan reminder pemeriksaan ulang', 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('eventorganizer', ['eventorganizer', 'event-organizer', 'eo'], 'Event Organizer', 'Paket acara, vendor, timeline, termin, dan laporan margin proyek', 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('rentalalat', ['rentalalat', 'rental-alat'], 'Rental Alat', 'Stok alat, jadwal sewa, deposit, maintenance, dan denda keterlambatan', 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1400&q=82'),
  simpleVertical('jasakebersihan', ['jasakebersihan', 'cleaning'], 'Jasa Kebersihan', 'Tim lapangan, jadwal kunjungan, checklist, langganan, dan invoice', 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=82'),
];

export const ALL_BUSINESS_VERTICALS = [...BUSINESS_VERTICALS, ...EXTRA_VERTICALS];

function simpleVertical(
  code: BusinessVerticalCode,
  aliases: string[],
  title: string,
  audience: string,
  imageUrl: string,
): BusinessVertical {
  return {
    code,
    aliases,
    title,
    tenantSuffix: aliases[0],
    category: 'Unit usaha eBisnis',
    audience,
    headline: `${title} siap demo dengan POS, stok, pelanggan, laporan, dan dashboard pemilik.`,
    description:
      'Landing ini disiapkan untuk calon tenant melihat alur kerja usaha secara realistis: transaksi, data master, laporan, promo, pelanggan, dan kontrol operasional.',
    imageUrl,
    imageAlt: `Aktivitas usaha ${title}`,
    color: 'teal',
    metrics: [
      { label: 'Produk/layanan', value: '100+', note: 'minimal data demo' },
      { label: 'Pelanggan', value: '250+', note: 'contoh segmentasi' },
      { label: 'Transaksi', value: '1.000', note: 'dashboard realistik' },
    ],
    workflows: ['Website tenant', 'POS dan order', 'Stok dan layanan', 'Laporan pemilik'],
    features: ['Kasir/POS', 'Upload/download produk', 'Membership/CRM', 'Promo', 'Shift dan kas', 'Dashboard penjualan'],
    sampleData: [
      { label: 'Produk/layanan', count: '100' },
      { label: 'Pelanggan', count: '250' },
      { label: 'Transaksi', count: '1.000' },
    ],
  };
}

function cleanHost(hostname: string): string {
  return hostname.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

export function businessVerticalByCode(code: string | undefined): BusinessVertical | null {
  if (!code) return null;
  const normalized = code.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return ALL_BUSINESS_VERTICALS.find((vertical) => vertical.code === normalized || vertical.aliases.includes(normalized)) ?? null;
}

export function businessVerticalFromHost(hostname: string = window.location.hostname): BusinessVertical | null {
  const host = cleanHost(hostname);
  if (!host.endsWith('.ebisnis.id')) return null;
  const subdomain = host.slice(0, -'.ebisnis.id'.length);
  if (!subdomain || subdomain.includes('.')) return null;

  for (const vertical of ALL_BUSINESS_VERTICALS) {
    if (vertical.aliases.includes(subdomain)) return vertical;
    if (vertical.aliases.some((alias) => subdomain.endsWith(`-${alias}`))) return vertical;
  }
  return null;
}

export function businessTenantNameFromHost(hostname: string = window.location.hostname): string | null {
  const host = cleanHost(hostname);
  const vertical = businessVerticalFromHost(host);
  if (!vertical || !host.endsWith('.ebisnis.id')) return null;
  const subdomain = host.slice(0, -'.ebisnis.id'.length);
  const alias = vertical.aliases.find((item) => subdomain === item || subdomain.endsWith(`-${item}`));
  if (!alias || subdomain === alias) return null;
  const slug = subdomain.slice(0, -`-${alias}`.length);
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function businessVerticalRootRedirectFor(
  hostname: string = window.location.hostname,
  pathname = '/',
): string | null {
  const vertical = businessVerticalFromHost(hostname);
  if (!vertical) return null;
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === '/' || path === '/a' || path === '/ebisnis/a' ? `/contoh-usaha/${vertical.code}` : null;
}
