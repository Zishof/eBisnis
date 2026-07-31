/**
 * Menu portal anggota, dan aturan tampilannya.
 *
 * Dipisahkan dari komponennya supaya dapat diuji: menu portal menentukan apa
 * yang dilihat ratusan anggota, dan satu entri yang lolos ke tempat yang salah
 * lebih baik ditangkap pengujian daripada oleh anggota yang membukanya.
 */

export interface EntriMenu {
  /** Jalur relatif di bawah /ekoperasi/portal. */
  path: string;
  label: string;
  ikon: string;
  /** Ditampilkan pada portal anggota? */
  untukAnggota: boolean;
  /**
   * Menampilkan angka belum-dibaca di sebelah label.
   */
  lencana?: 'pemberitahuan' | 'pengaduan';
}

export const MENU_PORTAL: EntriMenu[] = [
  { path: '', label: 'Ringkasan', ikon: 'LayoutDashboard', untukAnggota: true },
  { path: 'simpanan', label: 'Simpanan Saya', ikon: 'PiggyBank', untukAnggota: true },
  { path: 'pinjaman', label: 'Pinjaman Saya', ikon: 'HandCoins', untukAnggota: true },
  { path: 'shu', label: 'SHU Saya', ikon: 'Coins', untukAnggota: true },
  { path: 'rat', label: 'Rapat Anggota', ikon: 'Users', untukAnggota: true },
  {
    path: 'pengaduan',
    label: 'Pengaduan',
    ikon: 'MessageSquareWarning',
    untukAnggota: true,
    lencana: 'pengaduan',
  },
  {
    path: 'pemberitahuan',
    label: 'Pemberitahuan',
    ikon: 'Bell',
    untukAnggota: true,
    lencana: 'pemberitahuan',
  },
];

/**
 * Menu yang TIDAK boleh muncul di portal anggota.
 *
 * Daftar ini ada supaya pengujian dapat memeriksanya, bukan sekadar
 * mengandalkan bahwa tidak ada yang menambahkannya. Portal anggota bukan versi
 * kecil dari layar pengurus; ia permukaan yang berbeda dengan pembaca yang
 * berbeda.
 */
export const TERLARANG_DI_PORTAL = [
  'anggota', // daftar seluruh anggota
  'pengurus',
  'simpanan-semua',
  'pinjaman-semua',
  'analisis-kredit',
  'penagihan',
  'akuntansi',
  'jurnal',
  'laporan-keuangan',
  'pengaturan',
  'hak-akses',
  'pengguna',
  'unit-usaha',
  'pin', // PIN diatur anggota lewat layar khusus, tidak dari menu pengurus
];

export type StatusKeanggotaan = 'PROSPECT' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED';

/**
 * Menu yang tampak bagi seorang anggota, menurut status keanggotaannya.
 *
 * Calon anggota belum punya simpanan, pinjaman, SHU, maupun hak suara — ia
 * baru punya pengaduan dan pemberitahuan. Menampilkan menu yang seluruhnya
 * kosong membuat portal terasa rusak, bukan terasa lengkap.
 */
export function menuUntuk(status: StatusKeanggotaan): EntriMenu[] {
  if (status === 'TERMINATED') return [];
  if (status === 'PROSPECT') {
    return MENU_PORTAL.filter((m) => ['', 'pengaduan', 'pemberitahuan'].includes(m.path));
  }
  if (status === 'SUSPENDED') {
    /*
     * Anggota yang dibekukan tetap dapat MELIHAT datanya dan tetap dapat
     * mengadu — justru pembekuan adalah saat ia paling mungkin ingin
     * menyatakan keberatan. Yang hilang adalah hak suaranya.
     */
    return MENU_PORTAL.filter((m) => m.path !== 'rat');
  }
  return MENU_PORTAL;
}

export function formatRupiah(nilai: string | number | null | undefined): string {
  const n = typeof nilai === 'string' ? Number(nilai) : (nilai ?? 0);
  if (!Number.isFinite(n)) return 'Rp0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatTanggal(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export const LABEL_STATUS_PENGADUAN: Record<string, string> = {
  SUBMITTED: 'Terkirim',
  ACKNOWLEDGED: 'Diterima pengurus',
  IN_PROGRESS: 'Sedang ditangani',
  RESOLVED: 'Selesai',
  REJECTED: 'Ditolak',
  CLOSED: 'Ditutup',
};

export const LABEL_KATEGORI_PENGADUAN: Record<string, string> = {
  SERVICE: 'Pelayanan',
  SAVING: 'Simpanan',
  LOAN: 'Pinjaman',
  SHU: 'SHU',
  GOVERNANCE: 'Tata kelola',
  STAFF: 'Petugas',
  UNIT_BUSINESS: 'Unit usaha',
  OTHER: 'Lainnya',
};

export const LABEL_JENIS_SIMPANAN: Record<string, string> = {
  PRINCIPAL: 'Simpanan Pokok',
  MANDATORY: 'Simpanan Wajib',
  VOLUNTARY: 'Simpanan Sukarela',
  TIME_DEPOSIT: 'Simpanan Berjangka',
  SPECIAL: 'Simpanan Khusus',
};
