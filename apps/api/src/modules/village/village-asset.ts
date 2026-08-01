/**
 * Aturan aset desa — fungsi murni, tanpa basis data.
 *
 * ## Aset desa tidak disusutkan
 *
 * Penyusutan adalah gagasan akuntansi komersial: membebankan harga perolehan
 * kepada periode-periode yang menikmati manfaatnya, supaya laba tiap periode
 * terukur. Balai desa tidak menghasilkan pendapatan yang perlu dilawankan
 * dengan beban apa pun, sehingga angka nilai buku balai desa tidak menjawab
 * pertanyaan siapa pun.
 *
 * Yang ditanyakan pada Musyawarah Desa adalah pertanyaan lain: **mana yang
 * rusak dan perlu diperbaiki tahun ini.** Karena itu yang dicatat di sini
 * adalah `kondisi` — bukan nilai buku. Sebuah traktor berumur sepuluh tahun
 * yang terawat lebih berguna daripada traktor berumur dua tahun yang rusak
 * berat, dan penyusutan garis lurus akan menyatakan sebaliknya.
 *
 * ## Aset yang dibeli dari APBDes wajib menunjuk transaksi anggarannya
 *
 * Uang desa yang berubah menjadi barang tetapi barangnya tidak masuk register
 * adalah temuan pemeriksaan yang paling sering muncul: uangnya
 * dipertanggungjawabkan, barangnya tidak. Tautan ke `village_budget_transaction`
 * membuat kedua sisi dapat dipertemukan tanpa menebak.
 *
 * ## Kelurahan tidak memiliki aset desa
 *
 * Kelurahan adalah perangkat daerah. Barang yang dipakainya milik pemerintah
 * daerah dan tercatat pada KIB daerah. Ia tetap perlu mencatat apa yang ada di
 * kantornya — untuk peminjaman dan pemeliharaan — tetapi mencatatnya sebagai
 * milik sendiri berarti mengaku memiliki barang yang bukan miliknya.
 */

export type Putusan = {
  boleh: boolean;
  alasan?: string;
};

// --- Penggolongan ------------------------------------------------------------

/**
 * Kartu Inventaris Barang, enam golongan.
 *
 * Mengikuti penggolongan yang sudah dipakai pemerintahan, bukan penggolongan
 * baru yang lebih rapi. Petugas yang menyusun laporan ke kecamatan menyalin
 * dari daftar ini; daftar yang berbeda memaksanya memetakan ulang setiap kali.
 */
export const GOLONGAN_KIB = {
  A: 'Tanah',
  B: 'Peralatan dan Mesin',
  C: 'Gedung dan Bangunan',
  D: 'Jalan, Irigasi, dan Jaringan',
  E: 'Aset Tetap Lainnya',
  F: 'Konstruksi dalam Pengerjaan',
} as const;

export type GolonganKib = keyof typeof GOLONGAN_KIB;

export function adalahGolonganKib(kode: string): kode is GolonganKib {
  return Object.prototype.hasOwnProperty.call(GOLONGAN_KIB, kode);
}

export type KepemilikanAset = 'DESA' | 'DAERAH' | 'PIHAK_KETIGA';

export type ProfilPemerintahan = 'DESA' | 'KELURAHAN';

/**
 * Bolehkah profil ini mencatat aset dengan kepemilikan tersebut?
 *
 * Kelurahan tidak dapat mencatat aset bertanda `DESA`. Bukan pembatasan
 * teknis: kelurahan tidak memiliki kekayaan sendiri, dan daftar aset kelurahan
 * yang menyatakan kepemilikan desa akan berselisih dengan KIB daerah pada
 * pemeriksaan berikutnya.
 */
export function bolehCatatKepemilikan(
  profil: ProfilPemerintahan,
  kepemilikan: KepemilikanAset,
): Putusan {
  if (profil === 'KELURAHAN' && kepemilikan === 'DESA') {
    return {
      boleh: false,
      alasan:
        'Kelurahan tidak memiliki aset desa. Barang yang dipakai kelurahan milik pemerintah ' +
        'daerah dan tercatat pada KIB daerah; catat sebagai kepemilikan DAERAH.',
    };
  }
  return { boleh: true };
}

// --- Kondisi dan status ------------------------------------------------------

export type KondisiAset = 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_BERAT';

export type StatusAset = 'AKTIF' | 'DIPINJAM' | 'DIPELIHARA' | 'DIHAPUS';

export const TRANSISI_ASET: Record<StatusAset, StatusAset[]> = {
  AKTIF: ['DIPINJAM', 'DIPELIHARA', 'DIHAPUS'],
  DIPINJAM: ['AKTIF'],
  DIPELIHARA: ['AKTIF', 'DIHAPUS'],
  // Aset yang sudah dihapus tidak kembali. Bila ternyata ditemukan, ia dicatat
  // sebagai perolehan baru dengan keputusan tersendiri — sehingga jejak
  // penghapusan yang keliru tetap terbaca.
  DIHAPUS: [],
};

export function bolehPindahAset(dari: StatusAset, ke: StatusAset): Putusan {
  if (dari === ke) return { boleh: false, alasan: `Aset sudah berstatus ${dari}.` };
  if (!TRANSISI_ASET[dari].length) {
    return {
      boleh: false,
      alasan:
        'Aset yang sudah dihapus tidak dapat diaktifkan kembali. Bila barangnya ditemukan, ' +
        'catat sebagai perolehan baru agar penghapusan yang keliru tetap terbaca.',
    };
  }
  if (!TRANSISI_ASET[dari].includes(ke)) {
    return { boleh: false, alasan: `Aset berstatus ${dari} tidak dapat langsung menjadi ${ke}.` };
  }
  return { boleh: true };
}

// --- Peminjaman --------------------------------------------------------------

/**
 * Bolehkah aset ini dipinjam?
 *
 * Hanya yang berstatus `AKTIF`. Aset yang sedang dipinjam tidak dapat dipinjam
 * lagi — bukan aturan administrasi melainkan kenyataan: proyektornya hanya
 * satu, dan yang datang kedua akan pulang dengan tangan kosong entah sistemnya
 * mencatat atau tidak. Yang dapat dipilih sistem hanyalah apakah orang itu
 * mengetahuinya sekarang atau setelah menempuh perjalanan ke balai desa.
 */
export function bolehPinjam(status: StatusAset, kondisi: KondisiAset): Putusan {
  if (status === 'DIPINJAM') {
    return { boleh: false, alasan: 'Aset ini sedang dipinjam dan belum dikembalikan.' };
  }
  if (status === 'DIPELIHARA') {
    return { boleh: false, alasan: 'Aset ini sedang dalam pemeliharaan.' };
  }
  if (status === 'DIHAPUS') {
    return { boleh: false, alasan: 'Aset ini sudah dihapus dari register.' };
  }
  if (kondisi === 'RUSAK_BERAT') {
    return {
      boleh: false,
      alasan:
        'Aset berkondisi rusak berat tidak dipinjamkan. Ajukan pemeliharaan atau penghapusan ' +
        'terlebih dahulu.',
    };
  }
  return { boleh: true };
}

export interface RencanaPinjam {
  /** ISO `YYYY-MM-DD`. */
  mulai: string;
  /** ISO `YYYY-MM-DD`. Wajib — peminjaman tanpa batas waktu tidak pernah kembali. */
  rencanaKembali: string;
}

/**
 * Memeriksa jangka peminjaman.
 *
 * Tanggal rencana kembali wajib. Peminjaman tanpa batas waktu bukan peminjaman
 * melainkan pemberian, dan register aset akan menyimpan barang yang sudah lama
 * tidak ada di tempatnya tanpa seorang pun merasa perlu menanyakannya.
 */
export function periksaJangkaPinjam(r: RencanaPinjam, maksimalHari = 90): Putusan {
  if (!ISO_TANGGAL.test(r.mulai) || !ISO_TANGGAL.test(r.rencanaKembali)) {
    return { boleh: false, alasan: 'Tanggal peminjaman harus berformat YYYY-MM-DD.' };
  }
  if (r.rencanaKembali < r.mulai) {
    return { boleh: false, alasan: 'Tanggal rencana kembali mendahului tanggal pinjam.' };
  }
  const hari = selisihHari(r.mulai, r.rencanaKembali);
  if (hari > maksimalHari) {
    return {
      boleh: false,
      alasan:
        `Peminjaman ${hari} hari melampaui batas ${maksimalHari} hari. ` +
        'Peminjaman yang lebih lama diajukan sebagai pemakaian dengan perjanjian tersendiri.',
    };
  }
  return { boleh: true };
}

/** Terlambat berapa hari, dilihat dari tanggal tertentu. */
export function keterlambatan(rencanaKembali: string, pada: string): number {
  const n = selisihHari(rencanaKembali, pada);
  return n > 0 ? n : 0;
}

// --- Penghapusan -------------------------------------------------------------

export type CaraPenghapusan = 'DIJUAL' | 'DIHIBAHKAN' | 'DIMUSNAHKAN' | 'HILANG' | 'TERTIMPA_BENCANA';

export interface UsulanPenghapusan {
  cara: CaraPenghapusan;
  /** Nomor keputusan yang menjadi dasarnya. */
  nomorKeputusan: string;
  alasan: string;
  /** Hasil penjualan, bila dijual. Masuk sebagai pendapatan desa. */
  nilaiPelepasan?: number;
}

/**
 * Bolehkah aset dihapus dari register?
 *
 * Wajib berdasar keputusan yang bernomor. Aset yang lenyap dari register tanpa
 * dasar keputusan bukanlah aset yang dihapus melainkan aset yang hilang, dan
 * sistem tidak boleh menjadi tempat sebuah barang berhenti ada diam-diam.
 *
 * Aset yang sedang dipinjam tidak dapat dihapus: barangnya masih di tangan
 * orang lain, dan menghapusnya berarti melepaskan tanggung jawab atas barang
 * yang keberadaannya justru sedang diketahui.
 */
export function bolehHapusAset(status: StatusAset, usulan: UsulanPenghapusan): Putusan {
  if (status === 'DIPINJAM') {
    return {
      boleh: false,
      alasan:
        'Aset yang sedang dipinjam tidak dapat dihapus. Tarik kembali terlebih dahulu, ' +
        'agar penghapusan tidak menjadi cara melepaskan tanggung jawab atas barang yang ada.',
    };
  }
  if (status === 'DIHAPUS') {
    return { boleh: false, alasan: 'Aset ini sudah dihapus.' };
  }
  if (!usulan.nomorKeputusan?.trim()) {
    return {
      boleh: false,
      alasan:
        'Nomor keputusan penghapusan wajib disebutkan. Aset yang lenyap dari register tanpa ' +
        'dasar keputusan adalah aset yang hilang, bukan aset yang dihapus.',
    };
  }
  if (!usulan.alasan?.trim() || usulan.alasan.trim().length < 10) {
    return {
      boleh: false,
      alasan: 'Alasan penghapusan wajib diuraikan, sekurang-kurangnya sepuluh huruf.',
    };
  }
  if (usulan.cara === 'DIJUAL' && !(Number(usulan.nilaiPelepasan) > 0)) {
    return {
      boleh: false,
      alasan:
        'Penghapusan dengan cara dijual wajib menyebutkan nilai penjualannya. ' +
        'Hasil penjualan aset desa adalah pendapatan desa dan harus dapat ditelusuri.',
    };
  }
  return { boleh: true };
}

// --- Pengadaan ---------------------------------------------------------------

export type MetodePengadaan = 'SWAKELOLA' | 'PENYEDIA';

/**
 * Menentukan metode pengadaan dari nilainya.
 *
 * Batasnya dapat berbeda antar kabupaten, karena itu ia parameter, bukan angka
 * tetap di dalam kode. Yang tetap adalah kaidahnya: pengadaan yang kecil
 * dikerjakan sendiri oleh masyarakat desa (swakelola), yang besar melalui
 * penyedia. Swakelola bukan kelonggaran melainkan tujuan — uang desa yang
 * berputar di desa itu sendiri.
 */
export function metodePengadaan(nilai: number, batasSwakelola: number): MetodePengadaan {
  return nilai <= batasSwakelola ? 'SWAKELOLA' : 'PENYEDIA';
}

/**
 * Bolehkah rencana pengadaan ditetapkan?
 *
 * Wajib menunjuk baris anggarannya. Rencana pengadaan yang tidak terhubung ke
 * pagu mana pun akan menjadi belanja yang tidak ada anggarannya — dan itu baru
 * ketahuan saat pembayarannya ditolak, ketika barangnya sudah telanjur dipesan.
 */
export function bolehTetapkanPengadaan(input: {
  budgetLineId?: string | null;
  nilai: number;
}): Putusan {
  if (!input.budgetLineId) {
    return {
      boleh: false,
      alasan:
        'Rencana pengadaan wajib menunjuk baris anggarannya. Pengadaan tanpa pagu akan ' +
        'ketahuan saat pembayarannya ditolak, ketika barangnya sudah telanjur dipesan.',
    };
  }
  if (!Number.isFinite(input.nilai) || input.nilai <= 0) {
    return { boleh: false, alasan: 'Nilai rencana pengadaan harus lebih besar dari nol.' };
  }
  return { boleh: true };
}

// --- Bagian dalam ------------------------------------------------------------

const ISO_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

const SEHARI = 86_400_000;

function selisihHari(dari: string, sampai: string): number {
  return Math.round((Date.parse(`${sampai}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) / SEHARI);
}
