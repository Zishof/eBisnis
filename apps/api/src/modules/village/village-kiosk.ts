/**
 * Aturan Anjungan Mandiri Desa — fungsi murni, tanpa basis data.
 *
 * ## Anjungan tidak pernah mencari warga
 *
 * Ini aturan yang menentukan seluruh bentuk berkas ini. Anjungan adalah layar
 * sentuh di ruang tunggu kantor desa: siapa pun dapat berdiri di depannya, dan
 * tidak ada seorang pun yang menjaganya sepanjang hari.
 *
 * Karena itu ia **tidak menerima nama, tidak menerima NIK, dan tidak memiliki
 * pencarian.** Ia hanya dapat membuka **satu** berkas, dan hanya bila
 * pengunjung memegang **kode ambil** yang diberikan saat berkasnya diajukan.
 *
 * Anjungan yang dapat dicari berdasarkan nama bukan anjungan layanan; ia
 * terminal kependudukan yang diletakkan di ruang publik.
 *
 * ## Kode ambil dibuat untuk dibaca orang, bukan untuk mesin
 *
 * Warga membacanya dari secarik kertas lalu mengetiknya pada papan ketik layar
 * sentuh, sering sambil berdiri dan membawa map. Karena itu:
 *
 * - Hurufnya **tanpa `0`, `O`, `1`, `I`, `L`** — pasangan yang paling sering
 *   tertukar pada cetakan kecil.
 * - Panjangnya delapan, dikelompokkan empat-empat.
 * - Seluruhnya huruf besar; papan ketik anjungan tidak menyediakan huruf kecil.
 *
 * ## Percobaan dibatasi, sebab anjungan pasti dicoba-coba
 *
 * Terminal di ruang publik akan ditekan-tekan orang yang menunggu. Tanpa batas
 * percobaan, kode delapan huruf dapat ditebak oleh orang yang cukup sabar —
 * dan orang yang menunggu di kantor desa punya banyak waktu.
 */

export type Putusan = {
  boleh: boolean;
  alasan?: string;
};

// --- Kode ambil --------------------------------------------------------------

/** Tanpa 0, O, 1, I, L — pasangan yang paling sering tertukar pada cetakan kecil. */
export const HURUF_KODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const PANJANG_KODE = 8;

/** Ditampilkan berkelompok empat: `A7K2-9MPQ`. */
export function formatKode(kode: string): string {
  const b = bersihkanKode(kode);
  return b.length === PANJANG_KODE ? `${b.slice(0, 4)}-${b.slice(4)}` : b;
}

/**
 * Membersihkan masukan pengunjung.
 *
 * Tanda hubung, spasi, dan huruf kecil dimaafkan — warga mengetik apa yang
 * dilihatnya, dan yang dilihatnya bertanda hubung. Menolak masukan hanya karena
 * tanda hubungnya ikut terketik adalah cara membuat orang menyerah pada
 * langkah pertama.
 */
export function bersihkanKode(masukan: string): string {
  return (masukan ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function periksaBentukKode(masukan: string): Putusan {
  const k = bersihkanKode(masukan);
  if (k.length !== PANJANG_KODE) {
    return {
      boleh: false,
      alasan: `Kode ambil terdiri dari ${PANJANG_KODE} huruf. Periksa kembali kertas Anda.`,
    };
  }
  for (const huruf of k) {
    if (!HURUF_KODE.includes(huruf)) {
      // Huruf yang mirip disebutkan secara khusus: warga yang mengetik "O"
      // padahal seharusnya "Q" tidak akan menemukan kesalahannya sendiri.
      const saran = SARAN_HURUF[huruf];
      return {
        boleh: false,
        alasan: saran
          ? `Huruf "${huruf}" tidak dipakai pada kode ambil. ${saran}`
          : `Huruf "${huruf}" tidak dipakai pada kode ambil.`,
      };
    }
  }
  return { boleh: true };
}

const SARAN_HURUF: Record<string, string> = {
  '0': 'Mungkin yang dimaksud angka 8 atau huruf Q.',
  O: 'Mungkin yang dimaksud angka 8 atau huruf Q.',
  '1': 'Mungkin yang dimaksud angka 7 atau huruf J.',
  I: 'Mungkin yang dimaksud angka 7 atau huruf J.',
  L: 'Mungkin yang dimaksud angka 7 atau huruf J.',
};

// --- Pembatasan percobaan ----------------------------------------------------

/** Percobaan salah sebelum kode dikunci. */
export const PERCOBAAN_MAKSIMAL = 5;

/** Lama kunci, dalam menit. Cukup lama untuk memutus penebakan, cukup pendek untuk warga yang benar-benar salah ketik. */
export const KUNCI_MENIT = 15;

export interface KeadaanKode {
  percobaanGagal: number;
  terkunciSampai?: string | null;
}

export interface HasilPeriksaPercobaan {
  boleh: boolean;
  sisaPercobaan: number;
  alasan?: string;
}

export function bolehMencoba(k: KeadaanKode, sekarang: string): HasilPeriksaPercobaan {
  if (k.terkunciSampai && k.terkunciSampai > sekarang) {
    return {
      boleh: false,
      sisaPercobaan: 0,
      alasan:
        `Kode ini terkunci sementara karena terlalu banyak percobaan. Coba lagi beberapa menit ` +
        'lagi, atau mintakan bantuan kepada petugas loket.',
    };
  }
  const sisa = PERCOBAAN_MAKSIMAL - k.percobaanGagal;
  if (sisa <= 0) {
    return {
      boleh: false,
      sisaPercobaan: 0,
      alasan: 'Kode ini terkunci sementara. Mintakan bantuan kepada petugas loket.',
    };
  }
  return { boleh: true, sisaPercobaan: sisa };
}

/**
 * Pesan setelah percobaan yang gagal.
 *
 * Tidak menyebutkan apakah kodenya ada atau tidak. Membedakan "kode tidak
 * ditemukan" dari "kode salah" memberi tahu penebak bahwa tebakannya sudah
 * mendekati — dan pada terminal publik, itu satu-satunya petunjuk yang ia
 * butuhkan.
 */
export function pesanGagal(sisaSesudah: number): string {
  if (sisaSesudah <= 0) {
    return `Kode tidak dikenali. Kode terkunci ${KUNCI_MENIT} menit; mintakan bantuan petugas loket.`;
  }
  if (sisaSesudah === 1) {
    return 'Kode tidak dikenali. Tersisa satu percobaan lagi sebelum kode terkunci sementara.';
  }
  return `Kode tidak dikenali. Tersisa ${sisaSesudah} percobaan.`;
}

// --- Apa yang boleh tampil di anjungan ---------------------------------------

/**
 * Ruas yang boleh tampil pada layar anjungan.
 *
 * Daftar izin, sama seperti proyeksi situs publik pada D-10 — dan alasannya
 * lebih kuat di sini: layar anjungan terlihat oleh orang yang mengantre di
 * belakang. NIK yang tercetak di layar dibaca orang lain sebelum pemiliknya
 * sempat menutupinya.
 */
export const RUAS_ANJUNGAN = {
  PERMOHONAN: ['requestNumber', 'serviceName', 'status', 'statusLabel', 'submittedAt', 'dueDate'],
  ANTREAN: ['ticketNumber', 'counterName', 'status', 'aheadCount', 'estimatedWaitMinutes'],
  PENGUMUMAN: ['title', 'summary', 'publishedAt'],
  BANTUAN: ['programName', 'aidCategory', 'periodStart', 'periodEnd', 'quota'],
} as const;

export type JenisTampilan = keyof typeof RUAS_ANJUNGAN;

/**
 * Ruas yang **tidak pernah** tampil di anjungan.
 *
 * Nama pemohon termasuk. Warga yang memasukkan kode ambil sudah tahu namanya
 * sendiri; yang mengantre di belakangnya tidak perlu ikut tahu.
 */
export const RUAS_TIDAK_DI_ANJUNGAN = [
  'nik',
  'nationalId',
  'applicantNik',
  'applicantName',
  'applicantPhone',
  'birthDate',
  'address',
  'familyCardNo',
  'residentId',
  'bodyText',
] as const;

export function proyeksikanAnjungan<T extends Record<string, unknown>>(
  jenis: JenisTampilan,
  baris: T,
): Record<string, unknown> {
  const izin = RUAS_ANJUNGAN[jenis] as readonly string[];
  const keluar: Record<string, unknown> = {};
  for (const ruas of izin) {
    if (Object.prototype.hasOwnProperty.call(baris, ruas)) keluar[ruas] = baris[ruas];
  }
  return keluar;
}

// --- Pencetakan mandiri ------------------------------------------------------

export type StatusPermohonan = string;

export interface KelayakanCetak {
  status: StatusPermohonan;
  adaSurat: boolean;
  suratDicabut: boolean;
  sudahDicetak: number;
}

/** Batas cetak mandiri. Lebih dari ini, warga diarahkan ke loket. */
export const CETAK_MANDIRI_MAKSIMAL = 3;

/**
 * Bolehkah surat dicetak mandiri di anjungan?
 *
 * Batas cetaknya bukan pelit: surat keterangan yang beredar dalam sepuluh
 * salinan asli tidak lagi dapat dipakai membuktikan apa pun, sebab tidak ada
 * yang tahu berapa yang masih berlaku. Yang memerlukan lebih diarahkan ke
 * loket, dan di sana ada petugas yang mencatat alasannya.
 */
export function bolehCetakMandiri(k: KelayakanCetak): Putusan {
  if (k.suratDicabut) {
    return {
      boleh: false,
      alasan: 'Surat ini sudah dicabut dan tidak dapat dicetak. Silakan menghubungi petugas loket.',
    };
  }
  if (!k.adaSurat || (k.status !== 'DITERBITKAN' && k.status !== 'DISERAHKAN')) {
    return {
      boleh: false,
      alasan:
        'Surat Anda belum terbit. Anda dapat memeriksa perkembangannya di sini, dan mencetak ' +
        'setelah statusnya menjadi "Sudah terbit".',
    };
  }
  if (k.sudahDicetak >= CETAK_MANDIRI_MAKSIMAL) {
    return {
      boleh: false,
      alasan:
        `Surat ini sudah dicetak ${k.sudahDicetak} kali dari anjungan. Untuk salinan berikutnya, ` +
        'silakan ke loket agar keperluannya dapat dicatat.',
    };
  }
  return { boleh: true };
}

// --- Buku tamu ---------------------------------------------------------------

export type KeperluanTamu =
  | 'LAYANAN_SURAT'
  | 'PENGADUAN'
  | 'KONSULTASI'
  | 'PEMBAYARAN'
  | 'BERTAMU'
  | 'LAINNYA';

export interface IsianBukuTamu {
  nama: string;
  keperluan: KeperluanTamu;
  /** Nomor telepon. Boleh kosong. */
  telepon?: string | null;
  /** Instansi, bila datang mewakili lembaga. */
  instansi?: string | null;
  keterangan?: string | null;
}

/**
 * Bolehkah isian buku tamu disimpan?
 *
 * Yang diwajibkan hanya **nama dan keperluan**. NIK tidak diminta, alamat tidak
 * diminta, dan nomor telepon tidak diwajibkan.
 *
 * Buku tamu adalah catatan siapa yang datang hari ini, bukan pendaftaran
 * kependudukan. Meminta NIK pada layar terbuka di ruang tunggu berarti
 * mengumpulkan nomor induk warga di tempat yang paling mudah dilihat orang
 * lain, untuk keperluan yang tidak memerlukannya.
 */
export function bolehIsiBukuTamu(i: IsianBukuTamu): Putusan {
  if (!i.nama?.trim() || i.nama.trim().length < 2) {
    return { boleh: false, alasan: 'Nama wajib diisi.' };
  }
  if (i.nama.trim().length > 120) {
    return { boleh: false, alasan: 'Nama terlalu panjang.' };
  }
  if (!i.keperluan) {
    return { boleh: false, alasan: 'Pilih keperluan kunjungan Anda.' };
  }
  if (i.telepon && !/^[0-9+\-\s]{6,20}$/.test(i.telepon)) {
    return { boleh: false, alasan: 'Nomor telepon tidak dikenali. Kosongkan bila tidak ingin diisi.' };
  }
  return { boleh: true };
}

// --- Panduan langkah demi langkah --------------------------------------------

export interface LangkahPanduan {
  nomor: number;
  judul: string;
  uraian: string;
}

export interface Panduan {
  kode: string;
  judul: string;
  ringkas: string;
  langkah: LangkahPanduan[];
}

/**
 * Panduan yang ditampilkan anjungan.
 *
 * Ditulis untuk dibaca sambil berdiri: kalimat pendek, satu perintah per
 * langkah, dan tidak ada istilah yang hanya dimengerti perangkat desa. Warga
 * yang membaca "unggah dokumen persyaratan" akan berhenti; yang membaca "bawa
 * fotokopi KTP dan KK" tidak.
 */
export const PANDUAN: Panduan[] = [
  {
    kode: 'CETAK_SURAT',
    judul: 'Cara mencetak surat sendiri',
    ringkas: 'Untuk surat yang sudah selesai diproses.',
    langkah: [
      { nomor: 1, judul: 'Siapkan kode ambil', uraian: 'Kode delapan huruf yang Anda terima saat mengajukan surat. Ada di kertas atau pesan WhatsApp Anda.' },
      { nomor: 2, judul: 'Pilih "Cetak Surat"', uraian: 'Tekan tombol besar bertuliskan Cetak Surat pada layar utama.' },
      { nomor: 3, judul: 'Ketik kode ambil', uraian: 'Ketik delapan huruf tanpa spasi. Tanda hubung boleh ikut diketik.' },
      { nomor: 4, judul: 'Periksa surat di layar', uraian: 'Pastikan nomor surat dan tanggalnya benar sebelum mencetak.' },
      { nomor: 5, judul: 'Tekan Cetak', uraian: 'Ambil surat dari mesin cetak di samping anjungan. Tunggu sampai selesai keluar.' },
    ],
  },
  {
    kode: 'CEK_STATUS',
    judul: 'Cara memeriksa status pengajuan',
    ringkas: 'Melihat sampai mana surat Anda diproses.',
    langkah: [
      { nomor: 1, judul: 'Siapkan kode ambil', uraian: 'Kode delapan huruf dari kertas pengajuan Anda.' },
      { nomor: 2, judul: 'Pilih "Cek Status"', uraian: 'Tekan tombol Cek Status pada layar utama.' },
      { nomor: 3, judul: 'Ketik kode ambil', uraian: 'Layar akan menampilkan tahap yang sedang berjalan.' },
      { nomor: 4, judul: 'Baca perkiraan selesainya', uraian: 'Bila sudah lewat perkiraan, tanyakan kepada petugas loket dengan menyebut nomor permohonan.' },
    ],
  },
  {
    kode: 'ANTREAN',
    judul: 'Cara mengambil nomor antrean',
    ringkas: 'Untuk dilayani di loket.',
    langkah: [
      { nomor: 1, judul: 'Pilih "Ambil Antrean"', uraian: 'Tekan tombol Ambil Antrean pada layar utama.' },
      { nomor: 2, judul: 'Pilih keperluan', uraian: 'Pilih jenis layanan yang Anda perlukan.' },
      { nomor: 3, judul: 'Ambil kertas antrean', uraian: 'Nomor Anda tercetak. Tunggu nomor dipanggil pada layar antrean.' },
    ],
  },
  {
    kode: 'ADUAN',
    judul: 'Cara menyampaikan pengaduan',
    ringkas: 'Melaporkan jalan rusak, sampah, lampu mati, dan lainnya.',
    langkah: [
      { nomor: 1, judul: 'Pilih "Lapor"', uraian: 'Tekan tombol Lapor pada layar utama.' },
      { nomor: 2, judul: 'Pilih jenis laporan', uraian: 'Misalnya jalan, kebersihan, penerangan, atau keamanan.' },
      { nomor: 3, judul: 'Tulis laporan Anda', uraian: 'Sebutkan tempatnya sejelas mungkin, misalnya "depan masjid RT 03".' },
      { nomor: 4, judul: 'Pilih ingin disebut nama atau tidak', uraian: 'Laporan tanpa nama tetap diproses. Bila tanpa nama, kami tidak dapat mengabari perkembangannya.' },
      { nomor: 5, judul: 'Simpan nomor tiket', uraian: 'Catat atau foto nomor tiket di layar untuk memantau tindak lanjutnya.' },
    ],
  },
  {
    kode: 'BUKU_TAMU',
    judul: 'Cara mengisi buku tamu',
    ringkas: 'Cukup nama dan keperluan.',
    langkah: [
      { nomor: 1, judul: 'Pilih "Buku Tamu"', uraian: 'Tekan tombol Buku Tamu pada layar utama.' },
      { nomor: 2, judul: 'Ketik nama Anda', uraian: 'Nama panggilan sehari-hari sudah cukup.' },
      { nomor: 3, judul: 'Pilih keperluan', uraian: 'Pilih salah satu dari daftar yang tersedia.' },
      { nomor: 4, judul: 'Selesai', uraian: 'Nomor induk kependudukan tidak diminta di sini.' },
    ],
  },
];

export function panduan(kode: string): Panduan | null {
  return PANDUAN.find((p) => p.kode === kode) ?? null;
}

// --- Menu anjungan -----------------------------------------------------------

export interface MenuAnjungan {
  kode: string;
  label: string;
  keterangan: string;
  ikon: string;
  /** Fitur yang harus layak agar menu ini tampil. */
  fitur?: string;
  /** Menu yang memerlukan kode ambil. */
  perluKode: boolean;
}

/**
 * Menu anjungan, persis lima fungsi yang dijanjikan presentasi, ditambah tiga
 * yang disebut pada slide lain: mengajukan surat, melapor, dan absensi ronda.
 */
export const MENU_ANJUNGAN: MenuAnjungan[] = [
  { kode: 'CETAK_SURAT', label: 'Cetak Surat', keterangan: 'Cetak sendiri surat yang sudah terbit', ikon: 'printer', fitur: 'LAYANAN.PERMOHONAN', perluKode: true },
  { kode: 'CEK_STATUS', label: 'Cek Status', keterangan: 'Lihat sampai mana pengajuan Anda', ikon: 'search', fitur: 'LAYANAN.PERMOHONAN', perluKode: true },
  { kode: 'ANTREAN', label: 'Ambil Antrean', keterangan: 'Nomor antrean loket pelayanan', ikon: 'ticket', fitur: 'LAYANAN.ANTREAN', perluKode: false },
  { kode: 'AJUKAN_SURAT', label: 'Ajukan Surat', keterangan: 'Mulai pengajuan surat baru', ikon: 'file-plus', fitur: 'LAYANAN.PERMOHONAN', perluKode: false },
  { kode: 'PENGUMUMAN', label: 'Pengumuman', keterangan: 'Berita, agenda, dan info bantuan', ikon: 'megaphone', perluKode: false },
  { kode: 'LAPOR', label: 'Lapor', keterangan: 'Sampaikan pengaduan atau usulan', ikon: 'message-square-warning', fitur: 'PARTISIPASI.PENGADUAN', perluKode: false },
  { kode: 'BUKU_TAMU', label: 'Buku Tamu', keterangan: 'Isi kunjungan Anda hari ini', ikon: 'book-open', perluKode: false },
  { kode: 'RONDA', label: 'Absensi Ronda', keterangan: 'Untuk anggota Linmas yang bertugas', ikon: 'shield', fitur: 'KEAMANAN.LINMAS', perluKode: false },
  { kode: 'PANDUAN', label: 'Panduan', keterangan: 'Cara memakai anjungan, langkah demi langkah', ikon: 'help-circle', perluKode: false },
];
