/**
 * Katalog menu, hak akses, dan peran vertikal info-desa.
 *
 * Modular sesuai panduan koordinasi §9: tidak ada satu pun baris yang
 * ditambahkan ke registri global. Sesi Core mengimpornya lewat kontrak plugin
 * bila dan ketika kontrak itu dibangun — integration request menyusul.
 *
 * Setiap simpul menyatakan **kelayakan profilnya**. Menu yang tidak menyatakan
 * kelayakan akan menggagalkan pengujian; disengaja, supaya tidak ada fitur yang
 * lolos tanpa diputuskan berlaku bagi desa, kelurahan, atau keduanya.
 */

import type { KodeFitur } from '../village-profile';

export interface VillageMenuNode {
  code: string;
  parentCode?: string;
  label: string;
  route?: string;
  icon?: string;
  /** Fitur yang menentukan kelayakan menu ini. */
  feature: KodeFitur;
  actions: string[];
  sortOrder: number;
}

/**
 * Aksi yang dipakai vertikal ini. Seluruhnya sudah ada pada katalog Core.
 *
 * Aturan yang dipegang: **setiap menu yang punya `APPROVE` wajib punya
 * `REJECT`.** Persetujuan yang tidak dapat ditolak bukan persetujuan melainkan
 * formalitas, dan penyetuju yang hanya bisa menyetujui akan menyetujui hal yang
 * seharusnya ditolak. Dijaga oleh pengujian katalog.
 */
export const VILLAGE_ACTIONS = [
  'READ',
  'CREATE',
  'UPDATE',
  'DELETE',
  'APPROVE',
  'REJECT',
  'SUBMIT',
  'CANCEL',
  'PRINT',
  'EXPORT',
  'PUBLISH',
  'UNPUBLISH',
  'ASSIGN',
  'POST',
  'RESTORE',
  'AUDIT_READ',
] as const;

/**
 * Menu vertikal info-desa.
 *
 * Rute frontend berawalan `/info-desa` sesuai panduan koordinasi §4.
 */
export const VILLAGE_MENUS: VillageMenuNode[] = [
  // --- D-1 Wilayah ---------------------------------------------------------
  { code: 'VILLAGE', label: 'Desa/Kelurahan', icon: 'landmark', feature: 'WILAYAH.UNIT', actions: ['READ'], sortOrder: 1 },
  { code: 'VILLAGE_UNIT', parentCode: 'VILLAGE', label: 'Profil Wilayah', route: '/info-desa/profil', icon: 'map-pin', feature: 'WILAYAH.UNIT', actions: ['READ', 'UPDATE'], sortOrder: 1 },
  { code: 'VILLAGE_REGION', parentCode: 'VILLAGE', label: 'Dusun, RW, dan RT', route: '/info-desa/wilayah', icon: 'map', feature: 'WILAYAH.RW', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'], sortOrder: 2 },
  { code: 'VILLAGE_DOMAIN', parentCode: 'VILLAGE', label: 'Domain Situs', route: '/info-desa/domain', icon: 'globe', feature: 'WILAYAH.DOMAIN', actions: ['READ', 'CREATE', 'DELETE'], sortOrder: 3 },
  { code: 'VILLAGE_POTENTIAL', parentCode: 'VILLAGE', label: 'Potensi Wilayah', route: '/info-desa/potensi', icon: 'sprout', feature: 'WILAYAH.POTENSI', actions: ['READ', 'CREATE', 'UPDATE', 'PUBLISH'], sortOrder: 4 },

  // --- D-2 Kependudukan ----------------------------------------------------
  { code: 'VILLAGE_POPULATION', label: 'Kependudukan', icon: 'users', feature: 'PENDUDUK.WARGA', actions: ['READ'], sortOrder: 2 },
  { code: 'VILLAGE_RESIDENT', parentCode: 'VILLAGE_POPULATION', label: 'Data Penduduk', route: '/info-desa/penduduk', icon: 'user', feature: 'PENDUDUK.WARGA', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'AUDIT_READ'], sortOrder: 1 },
  { code: 'VILLAGE_FAMILY', parentCode: 'VILLAGE_POPULATION', label: 'Kartu Keluarga', route: '/info-desa/keluarga', icon: 'users-round', feature: 'PENDUDUK.KELUARGA', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 2 },
  { code: 'VILLAGE_VITAL_EVENT', parentCode: 'VILLAGE_POPULATION', label: 'Kelahiran, Kematian, Mutasi', route: '/info-desa/peristiwa', icon: 'baby', feature: 'PENDUDUK.MUTASI', actions: ['READ', 'CREATE', 'APPROVE', 'REJECT'], sortOrder: 3 },
  { code: 'VILLAGE_VULNERABLE', parentCode: 'VILLAGE_POPULATION', label: 'Penduduk Rentan', route: '/info-desa/rentan', icon: 'heart-handshake', feature: 'PENDUDUK.RENTAN', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 4 },

  // --- D-3 Aparatur --------------------------------------------------------
  { code: 'VILLAGE_GOVERNMENT', label: 'Pemerintahan', icon: 'building-2', feature: 'APARATUR.STRUKTUR', actions: ['READ'], sortOrder: 3 },
  { code: 'VILLAGE_OFFICER', parentCode: 'VILLAGE_GOVERNMENT', label: 'Aparatur', route: '/info-desa/aparatur', icon: 'id-card', feature: 'APARATUR.STRUKTUR', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 1 },
  { code: 'VILLAGE_BPD', parentCode: 'VILLAGE_GOVERNMENT', label: 'BPD', route: '/info-desa/bpd', icon: 'gavel', feature: 'APARATUR.BPD', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 2 },
  { code: 'VILLAGE_REGISTER', parentCode: 'VILLAGE_GOVERNMENT', label: 'Buku Register', route: '/info-desa/register', icon: 'book', feature: 'REGISTER.UMUM', actions: ['READ', 'CREATE', 'EXPORT'], sortOrder: 3 },

  // --- D-4 Layanan ---------------------------------------------------------
  { code: 'VILLAGE_SERVICE', label: 'Pelayanan Warga', icon: 'file-text', feature: 'LAYANAN.KATALOG', actions: ['READ'], sortOrder: 4 },
  { code: 'VILLAGE_SERVICE_CATALOG', parentCode: 'VILLAGE_SERVICE', label: 'Jenis Layanan', route: '/info-desa/layanan/jenis', icon: 'list', feature: 'LAYANAN.KATALOG', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 1 },
  { code: 'VILLAGE_SERVICE_REQUEST', parentCode: 'VILLAGE_SERVICE', label: 'Permohonan', route: '/info-desa/layanan/permohonan', icon: 'inbox', feature: 'LAYANAN.PERMOHONAN', actions: ['READ', 'CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'PRINT'], sortOrder: 2 },
  { code: 'VILLAGE_QUEUE', parentCode: 'VILLAGE_SERVICE', label: 'Antrean Loket', route: '/info-desa/layanan/antrean', icon: 'ticket', feature: 'LAYANAN.ANTREAN', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 3 },

  // --- D-5 Partisipasi -----------------------------------------------------
  { code: 'VILLAGE_PARTICIPATION', label: 'Pengaduan dan Partisipasi', icon: 'megaphone', feature: 'PARTISIPASI.PENGADUAN', actions: ['READ'], sortOrder: 5 },
  { code: 'VILLAGE_COMPLAINT', parentCode: 'VILLAGE_PARTICIPATION', label: 'Pengaduan Warga', route: '/info-desa/pengaduan', icon: 'message-square-warning', feature: 'PARTISIPASI.PENGADUAN', actions: ['READ', 'CREATE', 'UPDATE', 'ASSIGN'], sortOrder: 1 },
  { code: 'VILLAGE_ASPIRATION', parentCode: 'VILLAGE_PARTICIPATION', label: 'Aspirasi', route: '/info-desa/aspirasi', icon: 'lightbulb', feature: 'PARTISIPASI.ASPIRASI', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 2 },
  { code: 'VILLAGE_MUSRENBANG', parentCode: 'VILLAGE_PARTICIPATION', label: 'Musrenbang Desa', route: '/info-desa/musrenbang', icon: 'users', feature: 'PARTISIPASI.MUSRENBANG_DESA', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'REJECT'], sortOrder: 3 },
  { code: 'VILLAGE_MUSRENBANG_KEL', parentCode: 'VILLAGE_PARTICIPATION', label: 'Musrenbang Kelurahan', route: '/info-desa/musrenbang-kelurahan', icon: 'users', feature: 'PARTISIPASI.MUSRENBANG_KELURAHAN', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'REJECT'], sortOrder: 4 },

  // --- D-6 Perencanaan dan keuangan ---------------------------------------
  { code: 'VILLAGE_PLANNING', label: 'Perencanaan', icon: 'target', feature: 'PERENCANAAN.RPJMDES', actions: ['READ'], sortOrder: 6 },
  { code: 'VILLAGE_RPJMDES', parentCode: 'VILLAGE_PLANNING', label: 'RPJM Desa', route: '/info-desa/rpjmdes', icon: 'calendar-range', feature: 'PERENCANAAN.RPJMDES', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'REJECT'], sortOrder: 1 },
  { code: 'VILLAGE_RKPDES', parentCode: 'VILLAGE_PLANNING', label: 'RKP Desa', route: '/info-desa/rkpdes', icon: 'calendar-check', feature: 'PERENCANAAN.RKPDES', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'REJECT'], sortOrder: 2 },
  { code: 'VILLAGE_FINANCE', label: 'Keuangan Desa', icon: 'wallet', feature: 'KEUANGAN.APBDES', actions: ['READ'], sortOrder: 7 },
  { code: 'VILLAGE_APBDES', parentCode: 'VILLAGE_FINANCE', label: 'APBDes', route: '/info-desa/apbdes', icon: 'receipt', feature: 'KEUANGAN.APBDES', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'POST', 'REJECT'], sortOrder: 1 },
  { code: 'VILLAGE_REALIZATION', parentCode: 'VILLAGE_FINANCE', label: 'Realisasi', route: '/info-desa/realisasi', icon: 'trending-up', feature: 'KEUANGAN.REALISASI', actions: ['READ', 'CREATE', 'POST'], sortOrder: 2 },
  { code: 'VILLAGE_CASHBOOK', parentCode: 'VILLAGE_FINANCE', label: 'Buku Kas', route: '/info-desa/buku-kas', icon: 'book-open', feature: 'KEUANGAN.BUKU_KAS', actions: ['READ', 'EXPORT'], sortOrder: 3 },

  // --- D-7 Aset dan bantuan ------------------------------------------------
  { code: 'VILLAGE_ASSET', label: 'Aset dan Bantuan', icon: 'package', feature: 'ASET.PEMINJAMAN', actions: ['READ'], sortOrder: 8 },
  { code: 'VILLAGE_ASSET_LIST', parentCode: 'VILLAGE_ASSET', label: 'Aset Desa', route: '/info-desa/aset', icon: 'box', feature: 'ASET.ASET_DESA', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'], sortOrder: 1 },
  { code: 'VILLAGE_AID_PROGRAM', parentCode: 'VILLAGE_ASSET', label: 'Program Bantuan', route: '/info-desa/bantuan', icon: 'hand-heart', feature: 'BANTUAN.PROGRAM', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 2 },
  { code: 'VILLAGE_BENEFICIARY', parentCode: 'VILLAGE_ASSET', label: 'Penerima Bantuan', route: '/info-desa/penerima', icon: 'user-check', feature: 'BANTUAN.PENERIMA', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'REJECT'], sortOrder: 3 },

  // --- D-8 Usaha -----------------------------------------------------------
  { code: 'VILLAGE_BUSINESS', label: 'Usaha Desa', icon: 'store', feature: 'USAHA.UMKM', actions: ['READ'], sortOrder: 9 },
  { code: 'VILLAGE_BUMDES', parentCode: 'VILLAGE_BUSINESS', label: 'BUMDes', route: '/info-desa/bumdes', icon: 'briefcase', feature: 'USAHA.BUMDES', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 1 },
  { code: 'VILLAGE_UMKM', parentCode: 'VILLAGE_BUSINESS', label: 'UMKM', route: '/info-desa/umkm', icon: 'shopping-bag', feature: 'USAHA.UMKM', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 2 },
  { code: 'VILLAGE_TOURISM', parentCode: 'VILLAGE_BUSINESS', label: 'Wisata', route: '/info-desa/wisata', icon: 'palmtree', feature: 'USAHA.WISATA', actions: ['READ', 'CREATE', 'UPDATE', 'PUBLISH'], sortOrder: 3 },

  // --- D-9 Keamanan dan lingkungan ----------------------------------------
  { code: 'VILLAGE_SAFETY', label: 'Keamanan dan Lingkungan', icon: 'shield', feature: 'KEAMANAN.LINMAS', actions: ['READ'], sortOrder: 10 },
  { code: 'VILLAGE_LINMAS', parentCode: 'VILLAGE_SAFETY', label: 'Linmas dan Insiden', route: '/info-desa/keamanan', icon: 'shield-alert', feature: 'KEAMANAN.INSIDEN', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 1 },
  { code: 'VILLAGE_DISASTER', parentCode: 'VILLAGE_SAFETY', label: 'Kebencanaan', route: '/info-desa/bencana', icon: 'siren', feature: 'BENCANA.KEJADIAN', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 2 },
  { code: 'VILLAGE_ENVIRONMENT', parentCode: 'VILLAGE_SAFETY', label: 'Infrastruktur dan Lingkungan', route: '/info-desa/lingkungan', icon: 'trees', feature: 'LINGKUNGAN.INFRASTRUKTUR', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 3 },
  { code: 'VILLAGE_LAND', parentCode: 'VILLAGE_SAFETY', label: 'Pertanahan Administratif', route: '/info-desa/tanah', icon: 'land-plot', feature: 'TANAH.ADMINISTRATIF', actions: ['READ', 'CREATE', 'UPDATE'], sortOrder: 4 },

  // --- D-10 Situs ----------------------------------------------------------
  { code: 'VILLAGE_SITE', label: 'Situs dan Portal', icon: 'monitor', feature: 'SITUS.HALAMAN', actions: ['READ'], sortOrder: 11 },
  { code: 'VILLAGE_SITE_PAGE', parentCode: 'VILLAGE_SITE', label: 'Halaman Situs', route: '/info-desa/situs/halaman', icon: 'layout', feature: 'SITUS.HALAMAN', actions: ['READ', 'CREATE', 'UPDATE', 'PUBLISH', 'UNPUBLISH'], sortOrder: 1 },
  { code: 'VILLAGE_NEWS', parentCode: 'VILLAGE_SITE', label: 'Berita dan Agenda', route: '/info-desa/situs/berita', icon: 'newspaper', feature: 'SITUS.BERITA', actions: ['READ', 'CREATE', 'UPDATE', 'PUBLISH'], sortOrder: 2 },
  { code: 'VILLAGE_BROADCAST', parentCode: 'VILLAGE_SITE', label: 'Siaran Informasi', route: '/info-desa/situs/siaran', icon: 'radio', feature: 'PORTAL.SIARAN', actions: ['READ', 'CREATE'], sortOrder: 3 },

  // --- D-11 Transparansi ---------------------------------------------------
  { code: 'VILLAGE_TRANSPARENCY', label: 'Transparansi dan Laporan', icon: 'eye', feature: 'TRANSPARANSI.LAPORAN', actions: ['READ'], sortOrder: 12 },
  { code: 'VILLAGE_PPID', parentCode: 'VILLAGE_TRANSPARENCY', label: 'PPID', route: '/info-desa/ppid', icon: 'file-search', feature: 'TRANSPARANSI.PPID', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'REJECT'], sortOrder: 1 },
  { code: 'VILLAGE_REPORT', parentCode: 'VILLAGE_TRANSPARENCY', label: 'Laporan', route: '/info-desa/laporan', icon: 'bar-chart', feature: 'TRANSPARANSI.LAPORAN', actions: ['READ', 'EXPORT'], sortOrder: 2 },
];

/** Seluruh hak akses vertikal, berbentuk `MENU.ACTION`. */
export function villagePermissions(): string[] {
  return VILLAGE_MENUS.flatMap((m) => m.actions.map((a) => `${m.code}.${a}`));
}
