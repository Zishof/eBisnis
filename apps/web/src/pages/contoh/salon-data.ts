export type KategoriSalon =
  | 'Cukur & Styling'
  | 'Hair Treatment'
  | 'Coloring'
  | 'Beard & Shave'
  | 'Spa Kepala'
  | 'Retail';

export interface ProdukSalon {
  id: string;
  nama: string;
  kategori: KategoriSalon;
  durasiMenit: number;
  harga: number;
  hpp: number;
  stok: number | null;
  unggulan: boolean;
}

export interface TransaksiSalon {
  id: string;
  tanggal: string;
  jam: string;
  pelanggan: string;
  produkId: string;
  produkNama: string;
  kategori: KategoriSalon;
  petugas: string;
  kursi: string;
  metode: 'Tunai' | 'QRIS' | 'Kartu' | 'Transfer';
  status: 'Booking' | 'Pasti Dipesan' | 'Sedang Dikerjakan' | 'Selesai';
  omzet: number;
  hpp: number;
  laba: number;
}

export interface HariKerjaSalon {
  hari: string;
  mulai: string;
  selesai: string;
  keterangan: string;
}

export const jamKerjaSalon: HariKerjaSalon[] = [
  { hari: 'Senin', mulai: '09:00', selesai: '21:00', keterangan: 'Normal' },
  { hari: 'Selasa', mulai: '09:00', selesai: '21:00', keterangan: 'Normal' },
  { hari: 'Rabu', mulai: '09:00', selesai: '21:00', keterangan: 'Normal' },
  { hari: 'Kamis', mulai: '09:00', selesai: '21:00', keterangan: 'Normal' },
  { hari: 'Jumat', mulai: '13:00', selesai: '22:00', keterangan: 'Buka setelah salat Jumat' },
  { hari: 'Sabtu', mulai: '08:00', selesai: '22:00', keterangan: 'Jam ramai' },
  { hari: 'Minggu', mulai: '08:00', selesai: '18:00', keterangan: 'Reservasi keluarga' },
];

export const kursiSalon = [
  { nama: 'Kursi 01', petugas: 'Raka', spesialis: 'Cukur rambut pria' },
  { nama: 'Kursi 02', petugas: 'Maya', spesialis: 'Hair spa dan blow dry' },
  { nama: 'Kursi 03', petugas: 'Dimas', spesialis: 'Fade, beard trim' },
  { nama: 'Kursi 04', petugas: 'Nina', spesialis: 'Coloring dan smoothing' },
  { nama: 'Kursi 05', petugas: 'Ari', spesialis: 'Anak dan keluarga' },
  { nama: 'Kursi 06', petugas: 'Salsa', spesialis: 'Creambath dan treatment' },
];

const kategori: KategoriSalon[] = [
  'Cukur & Styling',
  'Hair Treatment',
  'Coloring',
  'Beard & Shave',
  'Spa Kepala',
  'Retail',
];

const layananDasar = [
  'Classic Haircut',
  'Executive Haircut',
  'Kids Haircut',
  'Fade Cut',
  'Undercut Styling',
  'Layer Cut',
  'Blow Dry',
  'Hair Wash',
  'Creambath',
  'Hair Spa',
  'Scalp Detox',
  'Anti Dandruff Treatment',
  'Hair Mask',
  'Keratin Treatment',
  'Smoothing',
  'Hair Coloring',
  'Highlight',
  'Balayage',
  'Root Touch Up',
  'Beard Trim',
  'Clean Shave',
  'Hot Towel Shave',
  'Mustache Styling',
  'Head Massage',
  'Shoulder Massage',
  'Hair Tonic',
  'Pomade Matte',
  'Pomade Shine',
  'Shampoo Retail',
  'Conditioner Retail',
];

const varian = [
  'Reguler',
  'Premium',
  'Express',
  'Signature',
  'Weekend',
  'Student',
  'Family',
  'Member',
  'Senior Stylist',
  'Home Care',
];

export function buatProdukSalon(jumlah = 120): ProdukSalon[] {
  return Array.from({ length: jumlah }, (_, index) => {
    const kategoriProduk = kategori[index % kategori.length];
    const dasar = layananDasar[index % layananDasar.length];
    const nama = `${dasar} ${varian[Math.floor(index / layananDasar.length) % varian.length]}`;
    const layanan = kategoriProduk !== 'Retail';
    const hargaDasar = layanan ? 35000 + (index % 17) * 8500 : 45000 + (index % 13) * 12000;
    const harga = hargaDasar + Math.floor(index / 6) * 2500;
    const hpp = Math.round(harga * (layanan ? 0.38 + (index % 5) * 0.025 : 0.62));
    return {
      id: `SLN-${String(index + 1).padStart(3, '0')}`,
      nama,
      kategori: kategoriProduk,
      durasiMenit: layanan ? 25 + (index % 6) * 15 : 0,
      harga,
      hpp,
      stok: layanan ? null : 12 + ((index * 7) % 70),
      unggulan: index % 11 === 0 || index < 8,
    };
  });
}

const namaPelanggan = [
  'Andi',
  'Budi',
  'Citra',
  'Dewi',
  'Eka',
  'Fajar',
  'Gita',
  'Hendra',
  'Intan',
  'Joko',
  'Kirana',
  'Laras',
  'Mila',
  'Nadia',
  'Oscar',
  'Putri',
  'Rama',
  'Santi',
  'Tono',
  'Vina',
];

const metodeBayar: TransaksiSalon['metode'][] = ['Tunai', 'QRIS', 'Kartu', 'Transfer'];

function tanggalISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function jamLayanan(index: number): string {
  const jam = 9 + (index % 12);
  const menit = (index * 15) % 60;
  return `${String(jam).padStart(2, '0')}:${String(menit).padStart(2, '0')}`;
}

export function buatTransaksiSalon(
  produk: ProdukSalon[] = buatProdukSalon(),
  jumlah = 1000,
  hariIni = new Date(),
): TransaksiSalon[] {
  const awal = new Date(hariIni);
  awal.setHours(12, 0, 0, 0);

  return Array.from({ length: jumlah }, (_, index) => {
    const mundur = jumlah - index - 1;
    const tanggal = new Date(awal);
    tanggal.setDate(awal.getDate() - (mundur % 150));

    const produkDipilih = produk[(index * 37 + tanggal.getDate()) % produk.length];
    const kursi = kursiSalon[(index + tanggal.getDay()) % kursiSalon.length];
    const diskon = index % 19 === 0 ? 0.88 : index % 23 === 0 ? 0.92 : 1;
    const omzet = Math.round(produkDipilih.harga * diskon);
    const hpp = Math.round(produkDipilih.hpp * (produkDipilih.kategori === 'Retail' ? 1 : 0.96));
    const status: TransaksiSalon['status'] =
      index > jumlah - 12
        ? index % 3 === 0
          ? 'Booking'
          : index % 3 === 1
            ? 'Pasti Dipesan'
            : 'Sedang Dikerjakan'
        : 'Selesai';

    return {
      id: `TRX-SLN-${tanggalISO(tanggal).replaceAll('-', '')}-${String(index + 1).padStart(4, '0')}`,
      tanggal: tanggalISO(tanggal),
      jam: jamLayanan(index),
      pelanggan: `${namaPelanggan[index % namaPelanggan.length]} ${String(1000 + index).slice(1)}`,
      produkId: produkDipilih.id,
      produkNama: produkDipilih.nama,
      kategori: produkDipilih.kategori,
      petugas: kursi.petugas,
      kursi: kursi.nama,
      metode: metodeBayar[index % metodeBayar.length],
      status,
      omzet,
      hpp,
      laba: omzet - hpp,
    };
  });
}

export function ringkasTransaksi(transaksi: TransaksiSalon[]) {
  const selesai = transaksi.filter((item) => item.status === 'Selesai');
  const omzet = selesai.reduce((total, item) => total + item.omzet, 0);
  const laba = selesai.reduce((total, item) => total + item.laba, 0);
  const jumlah = selesai.length;
  const rataNota = jumlah === 0 ? 0 : omzet / jumlah;
  return { selesai, omzet, laba, jumlah, rataNota };
}
