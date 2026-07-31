/**
 * Kelayakan fitur menurut profil pemerintahan.
 *
 * Fungsi murni, tanpa basis data. Inilah tumpuan seluruh vertikal: setiap
 * fitur menyatakan kelayakannya di sini, dan penegakannya memakai fungsi yang
 * sama di menu, di layanan, dan di data contoh.
 *
 * ## Mengapa satu berkas, bukan tersebar
 *
 * Desa dan kelurahan berbeda menurut undang-undang, bukan menurut selera.
 * Kelurahan tidak punya APBDes karena ia bagian perangkat daerah, bukan karena
 * fiturnya belum dibuat. Menyodorkan APBDes kepada kelurahan mengundangnya
 * mencatat anggaran pada sistem yang bukan sistem anggarannya — lalu angka itu
 * tidak pernah cocok dengan APBD daerah.
 *
 * Bila aturan seperti itu tersebar di puluhan berkas, satu di antaranya cepat
 * atau lambat akan menyimpang tanpa ketahuan. Di sini ia dapat dibaca sekaligus.
 */

export type ProfilPemerintahan = 'DESA' | 'KELURAHAN';

export type Kelayakan = 'DESA_ONLY' | 'KELURAHAN_ONLY' | 'BOTH' | 'CONFIGURABLE';

/**
 * Katalog kelayakan seluruh fitur village.
 *
 * Kunci memakai gaya `DOMAIN.FITUR` supaya dapat dipetakan langsung ke menu dan
 * hak akses. Menambah fitur tanpa menambahkannya ke sini akan menggagalkan
 * pengujian kelengkapan — disengaja, supaya tidak ada fitur yang lolos tanpa
 * menyatakan kelayakannya.
 */
export const KATALOG_KELAYAKAN = {
  // --- D-1 Wilayah dan profil ---------------------------------------------
  'WILAYAH.UNIT': 'BOTH',
  'WILAYAH.PROFIL_DESA': 'DESA_ONLY',
  'WILAYAH.PROFIL_KELURAHAN': 'KELURAHAN_ONLY',
  'WILAYAH.KODE_ADMINISTRATIF': 'BOTH',
  'WILAYAH.DUSUN': 'DESA_ONLY',
  'WILAYAH.LINGKUNGAN': 'KELURAHAN_ONLY',
  'WILAYAH.RW': 'BOTH',
  'WILAYAH.RT': 'BOTH',
  'WILAYAH.BATAS': 'BOTH',
  'WILAYAH.POTENSI': 'CONFIGURABLE',
  'WILAYAH.INDIKATOR': 'CONFIGURABLE',
  'WILAYAH.DOMAIN': 'BOTH',

  // --- D-2 Kependudukan ----------------------------------------------------
  // Kependudukan adalah urusan keduanya, tanpa perbedaan. Kesamaan pun perlu
  // dinyatakan agar tidak ada yang "berjaga-jaga" membedakannya tanpa alasan.
  'PENDUDUK.WARGA': 'BOTH',
  'PENDUDUK.KELUARGA': 'BOTH',
  'PENDUDUK.MUTASI': 'BOTH',
  'PENDUDUK.RENTAN': 'BOTH',
  'PENDUDUK.DOKUMEN': 'BOTH',
  'PENDUDUK.RIWAYAT': 'BOTH',

  // --- D-3 Aparatur --------------------------------------------------------
  'APARATUR.KEPALA_DESA': 'DESA_ONLY',
  'APARATUR.LURAH': 'KELURAHAN_ONLY',
  'APARATUR.SEKRETARIS': 'BOTH',
  'APARATUR.KASI_KAUR': 'BOTH',
  'APARATUR.BPD': 'DESA_ONLY',
  'APARATUR.KEPALA_DUSUN': 'DESA_ONLY',
  'APARATUR.KETUA_RT_RW': 'BOTH',
  'APARATUR.LINMAS': 'BOTH',
  'APARATUR.MASA_JABATAN': 'DESA_ONLY',
  'APARATUR.STRUKTUR': 'BOTH',
  'REGISTER.UMUM': 'BOTH',

  // --- D-4 Layanan warga ---------------------------------------------------
  'LAYANAN.KATALOG': 'BOTH',
  'LAYANAN.PERMOHONAN': 'BOTH',
  'LAYANAN.VERIFIKASI': 'BOTH',
  'LAYANAN.PENERBITAN': 'BOTH',
  'LAYANAN.ANTREAN': 'BOTH',
  'LAYANAN.SLA': 'BOTH',
  'LAYANAN.TTD_KEPALA_DESA': 'DESA_ONLY',
  'LAYANAN.TTD_LURAH': 'KELURAHAN_ONLY',
  'LAYANAN.PENGANTAR_KECAMATAN': 'CONFIGURABLE',

  // --- D-5 Partisipasi -----------------------------------------------------
  'PARTISIPASI.PENGADUAN': 'BOTH',
  'PARTISIPASI.ASPIRASI': 'BOTH',
  'PARTISIPASI.MUSRENBANG_DESA': 'DESA_ONLY',
  'PARTISIPASI.MUSRENBANG_KELURAHAN': 'KELURAHAN_ONLY',
  'PARTISIPASI.KONSULTASI': 'BOTH',
  'PARTISIPASI.SURVEI': 'BOTH',

  // --- D-6 Perencanaan dan keuangan ---------------------------------------
  'PERENCANAAN.RPJMDES': 'DESA_ONLY',
  'PERENCANAAN.RKPDES': 'DESA_ONLY',
  'PERENCANAAN.RENCANA_KELURAHAN': 'KELURAHAN_ONLY',
  'KEUANGAN.APBDES': 'DESA_ONLY',
  'KEUANGAN.REALISASI': 'DESA_ONLY',
  'KEUANGAN.BUKU_KAS': 'DESA_ONLY',
  'KEUANGAN.LPJ': 'DESA_ONLY',
  'KEUANGAN.PAGU_KELURAHAN': 'KELURAHAN_ONLY',
  'KEUANGAN.TRANSPARANSI': 'BOTH',

  // --- D-7 Aset dan bantuan ------------------------------------------------
  'ASET.ASET_DESA': 'DESA_ONLY',
  'ASET.ASET_DAERAH': 'KELURAHAN_ONLY',
  'ASET.PEMINJAMAN': 'BOTH',
  'ASET.PEMELIHARAAN': 'BOTH',
  'PENGADAAN.RENCANA': 'CONFIGURABLE',
  'BANTUAN.PROGRAM': 'BOTH',
  'BANTUAN.PENERIMA': 'BOTH',
  'BANTUAN.PENYALURAN': 'BOTH',

  // --- D-8 Usaha -----------------------------------------------------------
  'USAHA.BUMDES': 'DESA_ONLY',
  'USAHA.UMKM': 'BOTH',
  'USAHA.WISATA': 'BOTH',
  'USAHA.INVESTASI': 'DESA_ONLY',

  // --- D-9 Keamanan, bencana, lingkungan, tanah ---------------------------
  'KEAMANAN.LINMAS': 'BOTH',
  'KEAMANAN.INSIDEN': 'BOTH',
  'BENCANA.KEJADIAN': 'BOTH',
  'BENCANA.LOGISTIK': 'BOTH',
  'LINGKUNGAN.INFRASTRUKTUR': 'BOTH',
  'LINGKUNGAN.PENGADUAN': 'BOTH',
  'TANAH.ADMINISTRATIF': 'BOTH',
  'TANAH.SURAT_KETERANGAN': 'CONFIGURABLE',

  // --- D-10 Situs dan portal ----------------------------------------------
  'SITUS.HALAMAN': 'BOTH',
  'SITUS.BERITA': 'BOTH',
  'SITUS.AGENDA': 'BOTH',
  'PORTAL.WARGA': 'BOTH',
  'PORTAL.KIOSK': 'BOTH',
  'PORTAL.SIARAN': 'BOTH',

  // --- D-11 Transparansi ---------------------------------------------------
  'TRANSPARANSI.PPID': 'BOTH',
  'TRANSPARANSI.APBDES': 'DESA_ONLY',
  'TRANSPARANSI.PENGAWASAN_BPD': 'DESA_ONLY',
  'TRANSPARANSI.LAPORAN': 'BOTH',
} as const satisfies Record<string, Kelayakan>;

export type KodeFitur = keyof typeof KATALOG_KELAYAKAN;

/** Fitur yang dapat dinyalakan/dimatikan penyewa. */
export interface SakelarFitur {
  /** Fitur `CONFIGURABLE` yang dinyalakan penyewa ini. */
  aktif: ReadonlySet<string>;
}

export interface HasilKelayakan {
  layak: boolean;
  kelayakan: Kelayakan;
  /** Alasan penolakan, dalam bahasa yang dapat dibaca pengguna. */
  alasan?: string;
}

const SEBUTAN: Record<ProfilPemerintahan, string> = {
  DESA: 'desa',
  KELURAHAN: 'kelurahan',
};

/**
 * Apakah fitur ini layak bagi profil tersebut?
 *
 * Fitur `CONFIGURABLE` layak hanya bila penyewa menyalakannya. Bawaannya
 * **mati**: kewenangan yang tidak dinyatakan tidak boleh dianggap ada.
 */
export function layak(
  kode: KodeFitur,
  profil: ProfilPemerintahan,
  sakelar?: SakelarFitur,
): HasilKelayakan {
  const kelayakan = KATALOG_KELAYAKAN[kode] as Kelayakan;

  if (kelayakan === 'BOTH') return { layak: true, kelayakan };

  if (kelayakan === 'CONFIGURABLE') {
    const nyala = sakelar?.aktif.has(kode) ?? false;
    return {
      layak: nyala,
      kelayakan,
      alasan: nyala
        ? undefined
        : `Fitur ini belum diaktifkan untuk ${SEBUTAN[profil]} ini. Kewenangannya berbeda antar daerah, sehingga harus dinyatakan lebih dahulu.`,
    };
  }

  const untuk: ProfilPemerintahan = kelayakan === 'DESA_ONLY' ? 'DESA' : 'KELURAHAN';
  if (profil === untuk) return { layak: true, kelayakan };

  return {
    layak: false,
    kelayakan,
    alasan: `Fitur ini hanya berlaku bagi ${SEBUTAN[untuk]}, sedangkan tenant ini berprofil ${SEBUTAN[profil]}.`,
  };
}

/** Seluruh fitur yang layak bagi sebuah profil. */
export function fiturLayak(
  profil: ProfilPemerintahan,
  sakelar?: SakelarFitur,
): KodeFitur[] {
  return (Object.keys(KATALOG_KELAYAKAN) as KodeFitur[]).filter(
    (k) => layak(k, profil, sakelar).layak,
  );
}

/**
 * Sebutan jabatan tertinggi menurut profil.
 *
 * Dipisahkan karena dipakai di banyak tempat — surat, laporan, situs — dan
 * menyebut "Kepala Desa" pada kelurahan adalah kekeliruan yang langsung
 * terlihat pembacanya.
 */
export function sebutanPimpinan(profil: ProfilPemerintahan): string {
  return profil === 'DESA' ? 'Kepala Desa' : 'Lurah';
}

/** Sebutan unit wilayah setingkat dusun. */
export function sebutanSubWilayah(profil: ProfilPemerintahan): string {
  return profil === 'DESA' ? 'Dusun' : 'Lingkungan';
}

/** Sebutan unit pemerintahan itu sendiri. */
export function sebutanUnit(profil: ProfilPemerintahan): string {
  return profil === 'DESA' ? 'Desa' : 'Kelurahan';
}

/**
 * Fitur yang wajib dimatikan saat profil berubah.
 *
 * Perubahan profil terjadi sungguhan: desa berubah status menjadi kelurahan
 * ketika wilayahnya menjadi perkotaan. Yang tidak boleh terjadi adalah APBDes
 * lama tetap dapat disunting sesudahnya.
 */
export function fiturTidakLagiLayak(
  dari: ProfilPemerintahan,
  ke: ProfilPemerintahan,
): KodeFitur[] {
  if (dari === ke) return [];
  return (Object.keys(KATALOG_KELAYAKAN) as KodeFitur[]).filter(
    (k) => layak(k, dari).layak && !layak(k, ke).layak,
  );
}
