export interface PengumumanToko {
  id: string;
  judul: string;
  isi: string;
  label: string;
  tanggal: string;
}

export interface ProdukTokoDemo {
  id: string;
  nama: string;
  kategori: string;
  harga: string;
  stok: string;
  unggulan: boolean;
}

export interface KontenPortalPelanggan {
  namaToko: string;
  slug: string;
  tagline: string;
  deskripsi: string;
  alamat: string;
  jamBuka: string;
  whatsapp: string;
  apkAndroidUrl: string;
  pengumuman: PengumumanToko[];
  produk: ProdukTokoDemo[];
}

export const KUNCI_KONTEN_PORTAL_PELANGGAN = 'ebisnis.portal-pelanggan.demo.v1';

export const kontenPortalPelangganBawaan: KontenPortalPelanggan = {
  namaToko: 'Coffeequ Shoping Center',
  slug: 'demo',
  tagline: 'Belanja kopi, roti, dan camilan favorit dari toko demo eBisnis.',
  deskripsi:
    'Halaman ini menjadi etalase pelanggan: pengumuman toko, promo yang sedang berjalan, produk unggulan, dan tautan unduh aplikasi pelanggan Android.',
  alamat: 'Jl. Demo Retail No. 17, Indonesia',
  jamBuka: 'Setiap hari 08.00 - 22.00',
  whatsapp: '+6281234567890',
  apkAndroidUrl: 'https://ebisnis.id/update/ebisnis-pelanggan-demo.apk',
  pengumuman: [
    {
      id: 'promo-kopi-sore',
      judul: 'Diskon kopi sore 15%',
      isi: 'Mulai pukul 15.00 sampai 18.00, semua menu kopi mendapatkan potongan 15% selama stok tersedia.',
      label: 'Promo',
      tanggal: '2026-08-03',
    },
    {
      id: 'member-awal',
      judul: 'Pendaftaran member pelanggan dibuka',
      isi: 'Pelanggan dapat mulai mendaftar sebagai anggota agar struk digital dan promo khusus tersimpan di aplikasi pelanggan.',
      label: 'Member',
      tanggal: '2026-08-03',
    },
    {
      id: 'paket-sarapan',
      judul: 'Paket sarapan baru',
      isi: 'Tersedia paket roti bakar dan teh manis untuk pelanggan pagi hari.',
      label: 'Info',
      tanggal: '2026-08-03',
    },
  ],
  produk: [
    {
      id: 'kopi-gula-aren',
      nama: 'Es Kopi Gula Aren',
      kategori: 'Kopi',
      harga: 'Rp 28.000',
      stok: 'Stok 32',
      unggulan: true,
    },
    {
      id: 'cappuccino',
      nama: 'Cappuccino',
      kategori: 'Kopi',
      harga: 'Rp 27.000',
      stok: 'Stok 18',
      unggulan: true,
    },
    {
      id: 'teh-manis',
      nama: 'Teh Manis',
      kategori: 'Minuman',
      harga: 'Rp 8.000',
      stok: 'Stok 24',
      unggulan: false,
    },
    {
      id: 'roti-bakar',
      nama: 'Roti Bakar Cokelat',
      kategori: 'Roti',
      harga: 'Rp 15.000',
      stok: 'Stok 8',
      unggulan: true,
    },
    {
      id: 'chicken-sandwich',
      nama: 'Chicken Sandwich',
      kategori: 'Makanan',
      harga: 'Rp 38.000',
      stok: 'Stok 12',
      unggulan: false,
    },
    {
      id: 'cheesecake',
      nama: 'Cheesecake',
      kategori: 'Dessert',
      harga: 'Rp 32.000',
      stok: 'Habis',
      unggulan: false,
    },
  ],
};

export function bacaKontenPortalPelanggan(): KontenPortalPelanggan {
  if (typeof window === 'undefined') return kontenPortalPelangganBawaan;
  const mentah = window.localStorage.getItem(KUNCI_KONTEN_PORTAL_PELANGGAN);
  if (!mentah) return kontenPortalPelangganBawaan;

  try {
    return { ...kontenPortalPelangganBawaan, ...JSON.parse(mentah) };
  } catch {
    return kontenPortalPelangganBawaan;
  }
}

export function simpanKontenPortalPelanggan(konten: KontenPortalPelanggan) {
  window.localStorage.setItem(KUNCI_KONTEN_PORTAL_PELANGGAN, JSON.stringify(konten));
  window.dispatchEvent(new Event('portal-pelanggan-berubah'));
}

export function resetKontenPortalPelanggan() {
  window.localStorage.removeItem(KUNCI_KONTEN_PORTAL_PELANGGAN);
  window.dispatchEvent(new Event('portal-pelanggan-berubah'));
}
