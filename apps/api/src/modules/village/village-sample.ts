/**
 * Rencana data contoh — fungsi murni, tanpa basis data.
 *
 * ## Data contoh mengikuti kelayakan profil, bukan mengabaikannya
 *
 * Penyewa berprofil kelurahan yang menemukan APBDes contoh pada ruang kerjanya
 * akan menyimpulkan fitur itu tersedia baginya. Ia lalu menyusun anggaran, dan
 * kekeliruannya baru ketahuan pada penetapan — setelah pekerjaannya terlanjur
 * dilakukan. Data contoh yang melanggar kelayakan bukan sekadar salah; ia
 * mengajarkan hal yang salah.
 *
 * ## Peran dan hak akses BUKAN data contoh
 *
 * Peran adalah data acuan: ia disemai saat penyewa dibuat dan tetap ada setelah
 * data contoh dibersihkan. Menandainya sebagai contoh berarti pembersihan akan
 * menghapus seluruh hak akses penyewa, dan penyewa itu terkunci dari sistemnya
 * sendiri karena menekan tombol yang menjanjikan kebalikannya.
 */

import { layak, type KodeFitur, type ProfilPemerintahan } from './village-profile';

export type Putusan = {
  boleh: boolean;
  alasan?: string;
};

/** Satu jenis isi yang dapat disemai. */
export interface BagianContoh {
  kode: string;
  label: string;
  /** Fitur yang menentukan kelayakannya. Kosong berarti selalu layak. */
  fitur?: KodeFitur;
  /**
   * Fitur yang berbeda menurut profil.
   *
   * Musrenbang ada pada desa maupun kelurahan, tetapi kode fiturnya berbeda —
   * dan memakai satu kode saja akan membuat kelurahan kehilangan musrenbang
   * contohnya, padahal ia menyelenggarakannya.
   */
  fiturPerProfil?: Record<ProfilPemerintahan, KodeFitur>;
  /** Perkiraan jumlah baris, untuk keterangan sebelum disemai. */
  perkiraanBaris: number;
}

/**
 * Seluruh bagian data contoh.
 *
 * Yang bertanda `fitur` disaring menurut profil penyewa. Yang tidak bertanda
 * berlaku bagi keduanya — penduduk, keluarga, dan layanan warga ada pada desa
 * maupun kelurahan.
 */
export const BAGIAN_CONTOH: BagianContoh[] = [
  { kode: 'WILAYAH', label: 'Dusun/lingkungan, RW, dan RT', perkiraanBaris: 24 },
  { kode: 'PENDUDUK', label: 'Keluarga dan penduduk', perkiraanBaris: 120 },
  { kode: 'APARATUR', label: 'Perangkat desa/kelurahan', perkiraanBaris: 8 },
  { kode: 'BPD', label: 'Badan Permusyawaratan Desa', fitur: 'APARATUR.BPD', perkiraanBaris: 7 },
  { kode: 'LAYANAN', label: 'Katalog layanan dan permohonan', perkiraanBaris: 30 },
  { kode: 'PENGADUAN', label: 'Pengaduan dan aspirasi', perkiraanBaris: 12 },
  {
    kode: 'MUSRENBANG',
    label: 'Musrenbang dan usulan',
    fiturPerProfil: {
      DESA: 'PARTISIPASI.MUSRENBANG_DESA',
      KELURAHAN: 'PARTISIPASI.MUSRENBANG_KELURAHAN',
    },
    perkiraanBaris: 10,
  },
  { kode: 'APBDES', label: 'RKP dan APBDes', fitur: 'KEUANGAN.APBDES', perkiraanBaris: 40 },
  { kode: 'ASET', label: 'Register aset dan peminjaman', perkiraanBaris: 20 },
  { kode: 'BANTUAN', label: 'Program bantuan dan penerima', fitur: 'BANTUAN.PROGRAM', perkiraanBaris: 25 },
  { kode: 'BUMDES', label: 'BUMDes dan unit usahanya', fitur: 'USAHA.BUMDES', perkiraanBaris: 6 },
  { kode: 'UMKM', label: 'UMKM dan produknya', fitur: 'USAHA.UMKM', perkiraanBaris: 15 },
  { kode: 'WISATA', label: 'Destinasi wisata', fitur: 'USAHA.WISATA', perkiraanBaris: 4 },
  { kode: 'KEAMANAN', label: 'Poskamling, Linmas, dan insiden', fitur: 'KEAMANAN.LINMAS', perkiraanBaris: 14 },
  { kode: 'TANAH', label: 'Bidang tanah administratif', fitur: 'TANAH.ADMINISTRATIF', perkiraanBaris: 12 },
  { kode: 'SITUS', label: 'Halaman, berita, dan agenda', fitur: 'SITUS.BERITA', perkiraanBaris: 12 },
  { kode: 'PPID', label: 'Daftar Informasi Publik', fitur: 'TRANSPARANSI.PPID', perkiraanBaris: 8 },
];

/**
 * Yang **tidak pernah** menjadi data contoh.
 *
 * Dijaga pengujian. Setiap nama di sini adalah data acuan yang harus tetap ada
 * setelah pembersihan; menandainya sebagai contoh akan menghapusnya.
 */
export const BUKAN_DATA_CONTOH = [
  'role',
  'permission',
  'menu',
  'user_role_assignment',
  'village_scope_assignment',
  'schema_migration',
] as const;

export interface RencanaSemai {
  profil: ProfilPemerintahan;
  bagian: Array<BagianContoh & { disemai: boolean; alasanDilewati?: string }>;
  totalPerkiraan: number;
}

/**
 * Menyusun rencana semai untuk satu profil.
 *
 * Bagian yang tidak layak **dilewati beserta alasannya**, bukan dihilangkan
 * diam-diam. Petugas yang melihat "APBDes — dilewati: kelurahan menerima pagu
 * dari daerah" belajar sesuatu tentang sistemnya; yang melihat daftar yang
 * lebih pendek tanpa keterangan hanya mengira ada yang tidak berjalan.
 */
export function rencanakan(
  profil: ProfilPemerintahan,
  sakelar?: { aktif: ReadonlySet<string> },
): RencanaSemai {
  const bagian = BAGIAN_CONTOH.map((b) => {
    const fitur = b.fiturPerProfil ? b.fiturPerProfil[profil] : b.fitur;
    if (!fitur) return { ...b, disemai: true };
    const h = layak(fitur, profil, sakelar);
    return h.layak
      ? { ...b, disemai: true }
      : { ...b, disemai: false, alasanDilewati: h.alasan ?? `Fitur ${fitur} tidak berlaku.` };
  });

  return {
    profil,
    bagian,
    totalPerkiraan: bagian.filter((b) => b.disemai).reduce((n, b) => n + b.perkiraanBaris, 0),
  };
}

/**
 * Bolehkah data contoh disemai?
 *
 * Ditolak bila sudah ada batch yang aktif. Menyemai dua kali menghasilkan dua
 * salinan penduduk contoh dengan NIK yang sama, dan penyewa yang membersihkan
 * salah satunya akan mengira sisanya adalah data sungguhan.
 */
export function bolehSemai(batchAktif: number): Putusan {
  if (batchAktif > 0) {
    return {
      boleh: false,
      alasan:
        'Data contoh sudah ada pada ruang kerja ini. Bersihkan yang lama terlebih dahulu — ' +
        'menyemai dua kali menghasilkan dua salinan penduduk contoh dengan NIK yang sama.',
    };
  }
  return { boleh: true };
}

export interface RingkasanBersih {
  batchId: string;
  /** Jumlah baris bertanda contoh yang akan dihapus. */
  barisContoh: number;
  /** Jumlah baris sungguhan pada tabel yang sama. Tidak disentuh. */
  barisSungguhan: number;
}

/**
 * Bolehkah pembersihan dijalankan?
 *
 * Ditolak bila tidak ada `batchId`. Pembersihan tanpa batch akan menghapus
 * seluruh baris bertanda contoh dari batch mana pun — termasuk batch yang
 * sengaja disimpan penyewa lain pada ruang kerja yang sama. Batch adalah
 * satu-satunya hal yang membedakan "data contoh saya" dari "data contoh".
 */
export function bolehBersihkan(batchId: string | null | undefined): Putusan {
  if (!batchId?.trim()) {
    return {
      boleh: false,
      alasan:
        'Pembersihan wajib menyebut batch yang hendak dibersihkan. Tanpa itu, seluruh data ' +
        'contoh dari batch mana pun ikut terhapus.',
    };
  }
  return { boleh: true };
}

/**
 * Memeriksa bahwa pembersihan tidak menyentuh data sungguhan.
 *
 * Dipanggil sebelum penghapusan, dengan cacah yang dihitung basis data. Bila
 * jumlah baris yang akan terhapus melampaui jumlah baris bertanda contoh, ada
 * yang salah pada kondisi penghapusannya — dan yang salah pada kondisi
 * penghapusan tidak boleh dijalankan lalu diperbaiki.
 */
export function periksaCakupanBersih(r: RingkasanBersih, akanTerhapus: number): Putusan {
  if (akanTerhapus > r.barisContoh) {
    return {
      boleh: false,
      alasan:
        `Pembersihan akan menghapus ${akanTerhapus} baris padahal hanya ${r.barisContoh} yang ` +
        'bertanda contoh. Penghapusan dihentikan.',
    };
  }
  return { boleh: true };
}
