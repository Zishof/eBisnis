/**
 * H-10 — Portal pasien dan website fasilitas.
 *
 * Aturan sebagai fungsi murni. Tidak menyentuh basis data.
 *
 * ## Invarian yang menentukan seluruh fase ini
 *
 * > **Pasien hanya melihat datanya sendiri; identitas dari token, tidak pernah
 * > dari parameter.**
 *
 * Kalimat kedua itu yang paling penting, dan ia paling mudah dilanggar tanpa
 * sadar. Jalur yang menerima `patientId` dari kueri akan bekerja sempurna pada
 * pengujian — sebab yang mengujinya mengirim id-nya sendiri — lalu membocorkan
 * seluruh rekam medis rumah sakit pada hari pertama seseorang mengganti satu
 * angka pada bilah alamat.
 *
 * Karena itu tidak ada satu pun fungsi pada berkas ini yang menerima
 * `patientId` sebagai masukan bebas. Yang ada menerima **identitas terverifikasi**
 * dan memutuskan apa yang boleh dilihatnya.
 *
 * ## Invarian kedua, dan ia menyangkut keselamatan
 *
 * **Hasil yang belum dibaca klinisi tidak muncul di portal.** Pasien yang
 * membaca "kalium 6,8" pada telepon genggamnya tengah malam, tanpa seorang pun
 * yang menjelaskan, akan melakukan salah satu dari dua hal: panik, atau
 * mengabaikannya. Keduanya lebih buruk daripada menunggu enam jam sampai
 * dokternya menelepon.
 */

// --- Identitas ---------------------------------------------------------------

/**
 * Identitas yang sudah diverifikasi dari token.
 *
 * Tipe ini sengaja **tidak punya** medan `patientId` yang dapat diisi
 * pemanggilnya: ia diisi oleh lapisan yang membaca token, dan fungsi-fungsi di
 * bawah hanya menerimanya apa adanya.
 */
export interface IdentitasPortal {
  /** Pasien pemilik akun ini. Dari token, bukan dari parameter. */
  readonly selfPatientId: string;
  /** Pasien lain yang boleh dilihatnya sebagai wali, beserta batasnya. */
  readonly proxies: readonly { patientId: string; accessLevel: TingkatAksesWali }[];
}

export type TingkatAksesWali = 'FULL' | 'SUMMARY_ONLY' | 'APPOINTMENT_ONLY';

export type JenisData =
  | 'APPOINTMENT'
  | 'QUEUE'
  | 'VISIT_SUMMARY'
  | 'LAB_RESULT'
  | 'PRESCRIPTION'
  | 'DIAGNOSIS'
  | 'CLINICAL_NOTE';

/**
 * Apa yang boleh dilihat tiap tingkat akses wali.
 *
 * Daftar TERTUTUP, dan `FULL` pun **tidak** memuat catatan klinis. Catatan
 * klinis memuat dugaan, pertimbangan, dan kemungkinan yang belum dipastikan —
 * kalimat "curiga keganasan, singkirkan dulu" ditulis untuk dibaca dokter
 * berikutnya, bukan untuk dibaca pasiennya sendiri pada pukul dua pagi.
 */
export const AKSES_WALI: Record<TingkatAksesWali, readonly JenisData[]> = {
  FULL: ['APPOINTMENT', 'QUEUE', 'VISIT_SUMMARY', 'LAB_RESULT', 'PRESCRIPTION', 'DIAGNOSIS'],
  SUMMARY_ONLY: ['APPOINTMENT', 'QUEUE', 'VISIT_SUMMARY'],
  APPOINTMENT_ONLY: ['APPOINTMENT', 'QUEUE'],
};

/** Yang boleh dilihat pasien atas dirinya sendiri. */
export const AKSES_DIRI: readonly JenisData[] = [
  'APPOINTMENT',
  'QUEUE',
  'VISIT_SUMMARY',
  'LAB_RESULT',
  'PRESCRIPTION',
  'DIAGNOSIS',
];

export interface HasilKeputusanAkses {
  boleh: boolean;
  /** Pasien yang benar-benar akan dibaca. Selalu berasal dari identitasnya. */
  patientId: string | null;
  sebagai: 'SELF' | 'PROXY' | null;
  alasan: string;
}

/**
 * Memutuskan pasien mana yang boleh dibaca identitas ini.
 *
 * `diminta` boleh kosong — dan itu keadaan yang paling lazim: pasien membuka
 * portalnya sendiri. Bila diisi, ia **hanya dipakai untuk memilih di antara
 * wali yang memang sudah dimiliki identitas ini**; ia tidak pernah menjadi
 * jawaban dengan sendirinya.
 *
 * Perbedaannya menentukan: `patientId` yang datang dari parameter dan dipakai
 * apa adanya adalah kebocoran; `patientId` yang datang dari parameter lalu
 * dicocokkan dengan daftar yang dimiliki tokennya adalah penyaring.
 */
export function putuskanAkses(
  identitas: IdentitasPortal,
  diminta: string | null,
  jenis: JenisData,
): HasilKeputusanAkses {
  if (!diminta || diminta === identitas.selfPatientId) {
    if (!AKSES_DIRI.includes(jenis)) {
      return {
        boleh: false,
        patientId: null,
        sebagai: null,
        alasan:
          `Jenis data ${jenis} tidak dibuka pada portal pasien. Catatan klinis memuat dugaan ` +
          'dan kemungkinan yang belum dipastikan — kalimat "curiga keganasan, singkirkan dulu" ' +
          'ditulis untuk dibaca dokter berikutnya, bukan untuk dibaca pasiennya sendiri pada ' +
          'pukul dua pagi.',
      };
    }
    return {
      boleh: true,
      patientId: identitas.selfPatientId,
      sebagai: 'SELF',
      alasan: 'Data miliknya sendiri.',
    };
  }

  const wali = identitas.proxies.find((p) => p.patientId === diminta);
  if (!wali) {
    return {
      boleh: false,
      patientId: null,
      sebagai: null,
      alasan:
        'Tidak ada hubungan perwalian yang berlaku antara akun ini dan pasien yang diminta. ' +
        'Identitas datang dari token; parameter hanya memilih di antara yang sudah dimiliki ' +
        'token itu, dan tidak pernah menjadi jawaban dengan sendirinya.',
    };
  }

  if (!AKSES_WALI[wali.accessLevel].includes(jenis)) {
    return {
      boleh: false,
      patientId: null,
      sebagai: null,
      alasan:
        `Perwalian bertingkat ${wali.accessLevel} tidak mencakup ${jenis}. Wali yang ditunjuk ` +
        'untuk satu keperluan tidak berhak atas seluruhnya.',
    };
  }

  return {
    boleh: true,
    patientId: diminta,
    sebagai: 'PROXY',
    alasan: `Diakses sebagai wali bertingkat ${wali.accessLevel}.`,
  };
}

// --- Pelepasan hasil ---------------------------------------------------------

export interface HasilLab {
  id: string;
  status: string;
  releasedAt: string | null;
  verifiedAt: string | null;
  isCritical: boolean;
  flag: string | null;
}

export interface KeputusanTampil {
  tampil: boolean;
  alasan: string;
  /** Ditampilkan kepada pasien apa adanya bila hasilnya ditahan. */
  pesanUntukPasien: string | null;
}

/**
 * Bolehkah satu hasil laboratorium tampil di portal?
 *
 * Tiga aturan, dan urutannya penting:
 *
 * 1. **Yang belum diverifikasi tidak tampil.** Hasil yang belum diverifikasi
 *    masih dapat berubah — dan angka yang berubah sesudah dibaca pasien lebih
 *    buruk daripada angka yang datang terlambat.
 *
 * 2. **Yang KRITIS tidak tampil sampai dilepas dengan sengaja.** Pasien yang
 *    membaca "kalium 6,8" tengah malam tanpa seorang pun yang menjelaskan akan
 *    panik atau mengabaikannya; keduanya lebih buruk daripada menunggu sampai
 *    dokternya menelepon.
 *
 * 3. **Selebihnya tampil begitu dilepas.** Menahan hasil normal tidak
 *    melindungi siapa pun — ia hanya membuat pasien menelepon.
 */
export function bolehTampilHasil(h: HasilLab): KeputusanTampil {
  if (!h.verifiedAt) {
    return {
      tampil: false,
      alasan: 'Hasil belum diverifikasi.',
      pesanUntukPasien:
        'Hasil pemeriksaan Anda sedang diperiksa petugas laboratorium. Ia akan muncul di sini ' +
        'setelah selesai.',
    };
  }
  if (h.isCritical && !h.releasedAt) {
    return {
      tampil: false,
      alasan:
        'Hasil bertanda KRITIS dan belum dilepas dengan sengaja. Pasien yang membaca angka ' +
        'kritis tanpa seorang pun yang menjelaskan akan panik atau mengabaikannya, dan keduanya ' +
        'lebih buruk daripada menunggu sampai dokternya menelepon.',
      pesanUntukPasien:
        'Hasil pemeriksaan Anda sudah selesai dan sedang ditinjau dokter. Dokter atau petugas ' +
        'kami akan menghubungi Anda. Bila Anda merasa tidak enak badan, jangan menunggu — ' +
        'segera hubungi fasilitas kami.',
    };
  }
  if (!h.releasedAt) {
    return {
      tampil: false,
      alasan: 'Hasil belum dilepas ke portal.',
      pesanUntukPasien: 'Hasil pemeriksaan Anda sedang disiapkan.',
    };
  }
  return { tampil: true, alasan: 'Hasil sudah diverifikasi dan dilepas.', pesanUntukPasien: null };
}

/**
 * Menyaring daftar hasil untuk portal.
 *
 * Yang ditahan **tetap muncul sebagai baris**, dengan pesannya sendiri dan
 * tanpa angkanya. Menyembunyikan barisnya sama sekali akan membuat pasien
 * mengira pemeriksaannya belum dikerjakan, lalu datang menanyakannya — dan
 * itulah yang justru hendak dihindari.
 */
export function saringHasil(daftar: HasilLab[]): {
  ditampilkan: number;
  ditahan: number;
  items: (HasilLab & { tampil: boolean; pesan: string | null })[];
} {
  const items = daftar.map((h) => {
    const k = bolehTampilHasil(h);
    return {
      ...h,
      tampil: k.tampil,
      pesan: k.pesanUntukPasien,
    };
  });
  return {
    ditampilkan: items.filter((i) => i.tampil).length,
    ditahan: items.filter((i) => !i.tampil).length,
    items,
  };
}

// --- Janji temu --------------------------------------------------------------

export type StatusJanji = 'BOOKED' | 'CONFIRMED' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

/**
 * Bolehkah pasien membatalkan janji temunya sendiri?
 *
 * **Selalu boleh, sampai ia dimulai.** Portal yang menyulitkan pembatalan
 * menghasilkan bangku kosong yang tidak diketahui siapa pun — dan bangku kosong
 * yang tidak diketahui lebih merugikan daripada pembatalan mendadak, sebab ia
 * tidak dapat diisi orang lain.
 */
export function bolehBatalkanJanji(input: {
  status: StatusJanji;
  jadwalPada: string;
  sekarang: string;
}): { boleh: boolean; alasan: string } {
  if (input.status === 'CANCELLED') {
    return { boleh: false, alasan: 'Janji temu ini sudah dibatalkan.' };
  }
  if (input.status === 'ARRIVED' || input.status === 'COMPLETED') {
    return {
      boleh: false,
      alasan:
        'Kunjungannya sudah dimulai. Pembatalan sesudah pasien tiba dicatat petugas, bukan ' +
        'lewat portal.',
    };
  }
  if (input.status === 'NO_SHOW') {
    return { boleh: false, alasan: 'Janji temu ini sudah lewat.' };
  }
  return {
    boleh: true,
    alasan:
      'Boleh dibatalkan. Portal yang menyulitkan pembatalan menghasilkan bangku kosong yang ' +
      'tidak diketahui siapa pun — dan bangku kosong yang tidak diketahui lebih merugikan ' +
      'daripada pembatalan mendadak, sebab ia tidak dapat diisi orang lain.',
  };
}

/**
 * Bolehkah pasien membuat janji temu pada waktu ini?
 *
 * Yang ditolak hanyalah yang **tidak mungkin**: waktu yang sudah lewat. Sisanya
 * — kuota, jam praktik, cuti dokter — diperiksa penjadwal yang sudah ada sejak
 * H-2, dan menduplikasinya di sini akan menghasilkan dua aturan yang berbeda
 * dalam waktu enam bulan.
 */
export function bolehBuatJanji(input: {
  jadwalPada: string;
  sekarang: string;
  batasHariKeDepan: number;
}): { boleh: boolean; alasan: string } {
  const jadwal = Date.parse(input.jadwalPada);
  const kini = Date.parse(input.sekarang);
  if (Number.isNaN(jadwal)) {
    return { boleh: false, alasan: 'Waktu janji temu tidak dapat dibaca.' };
  }
  if (jadwal <= kini) {
    return { boleh: false, alasan: 'Waktu janji temu sudah lewat.' };
  }
  const selisihHari = (jadwal - kini) / 86_400_000;
  if (selisihHari > input.batasHariKeDepan) {
    return {
      boleh: false,
      alasan:
        `Janji temu hanya dapat dibuat sampai ${input.batasHariKeDepan} hari ke depan. Jadwal ` +
        'yang lebih jauh belum tentu ada — dokternya dapat cuti, dan pasien yang sudah memegang ' +
        'nomor antrean untuk enam bulan lagi akan merasa dibatalkan sepihak.',
    };
  }
  return { boleh: true, alasan: 'Waktu janji temu dapat diterima.' };
}

// --- Isi website -------------------------------------------------------------

export type JenisKonten = 'FACILITY_PROFILE' | 'DOCTOR' | 'SERVICE' | 'SCHEDULE' | 'ARTICLE' | 'ANNOUNCEMENT';

/**
 * Medan yang **tidak boleh** muncul pada konten website mana pun.
 *
 * Website bersifat publik: ia dibaca tanpa masuk sama sekali. Satu nama pasien
 * yang lolos ke halaman "kisah sukses" adalah pelanggaran kerahasiaan medis
 * yang tidak dapat ditarik kembali — mesin pencari sudah menyalinnya sebelum
 * ada yang menyadarinya.
 */
export const MEDAN_TERLARANG_PUBLIK = [
  'patientId',
  'patientName',
  'nik',
  'medicalRecordNumber',
  'diagnosis',
  'labResult',
  'prescription',
  'birthDate',
  'patientPhone',
  'patientAddress',
] as const;

const TERLARANG_PUBLIK = new Set<string>(MEDAN_TERLARANG_PUBLIK);

export function periksaKontenPublik(konten: Record<string, unknown>): {
  bersih: boolean;
  ditemukan: string[];
  alasan: string;
} {
  const ditemukan = Object.keys(konten).filter((k) => TERLARANG_PUBLIK.has(k));
  return {
    bersih: ditemukan.length === 0,
    ditemukan,
    alasan:
      ditemukan.length === 0
        ? 'Konten tidak memuat data pasien.'
        : `Konten publik memuat data pasien: ${ditemukan.join(', ')}. Website dibaca tanpa ` +
          'masuk sama sekali; satu nama pasien yang lolos adalah pelanggaran kerahasiaan medis ' +
          'yang tidak dapat ditarik kembali — mesin pencari sudah menyalinnya sebelum ada yang ' +
          'menyadarinya.',
  };
}

/**
 * Konten yang belum diterbitkan tidak tampil, dan yang ditarik pun tidak.
 *
 * Penarikan adalah kemampuan yang harus ada sebelum dibutuhkan: yang
 * membutuhkannya sedang tergesa.
 */
export function bolehTampilKonten(input: {
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  publishedFrom: string | null;
  publishedUntil: string | null;
  sekarang: string;
}): { tampil: boolean; alasan: string } {
  if (input.status !== 'PUBLISHED') {
    return { tampil: false, alasan: `Konten berstatus ${input.status}.` };
  }
  const kini = Date.parse(input.sekarang);
  if (input.publishedFrom && Date.parse(input.publishedFrom) > kini) {
    return { tampil: false, alasan: 'Belum memasuki masa tayangnya.' };
  }
  if (input.publishedUntil && Date.parse(input.publishedUntil) < kini) {
    return { tampil: false, alasan: 'Masa tayangnya sudah lewat.' };
  }
  return { tampil: true, alasan: 'Tayang.' };
}

// --- Antrean -----------------------------------------------------------------

/**
 * Apa yang boleh dilihat pasien tentang antrean.
 *
 * **Nomor dan perkiraan waktu, bukan nama orang lain.** Layar antrean di ruang
 * tunggu memang menampilkan nama — itu keputusan fasilitasnya, di ruangan yang
 * orangnya sudah saling melihat. Portal yang dibuka dari rumah adalah hal yang
 * berbeda: ia dapat disalin, disimpan, dan dibagikan.
 */
export function ringkasAntrean(input: {
  nomorSaya: number | null;
  nomorDipanggil: number | null;
  jumlahMenunggu: number;
  rerataMenitPerPasien: number | null;
}): {
  nomorSaya: number | null;
  nomorDipanggil: number | null;
  sisaAntrean: number | null;
  perkiraanMenit: number | null;
  keterangan: string;
} {
  const sisa =
    input.nomorSaya != null && input.nomorDipanggil != null
      ? Math.max(input.nomorSaya - input.nomorDipanggil, 0)
      : null;
  return {
    nomorSaya: input.nomorSaya,
    nomorDipanggil: input.nomorDipanggil,
    sisaAntrean: sisa,
    perkiraanMenit:
      sisa != null && input.rerataMenitPerPasien != null
        ? sisa * input.rerataMenitPerPasien
        : null,
    keterangan:
      sisa == null
        ? 'Anda belum memiliki nomor antrean hari ini.'
        : 'Perkiraan waktu adalah perkiraan. Pemeriksaan yang lebih lama dari biasanya ' +
          'menggeser seluruh antrean, dan itu bukan kesalahan siapa pun.',
  };
}

// --- Akun portal -------------------------------------------------------------

/**
 * Bolehkah akun portal ditautkan kepada pasien ini?
 *
 * Satu akun, satu pasien. Akun yang menaut dua pasien akan membuat jejak akses
 * tidak dapat dibaca: yang tercatat adalah "akun ini membuka rekam medis", dan
 * pertanyaan yang sesungguhnya — *siapa yang membukanya* — tidak terjawab.
 *
 * Wali diselesaikan lewat `patient_proxy`, bukan lewat akun ganda. Orang tua
 * yang membuka rekam medis anaknya **tetap dirinya sendiri** pada jejak akses.
 */
export function bolehTautkanAkun(input: {
  akunSudahTertaut: boolean;
  pasienSudahPunyaAkun: boolean;
  identitasTerverifikasi: boolean;
}): { boleh: boolean; alasan: string } {
  if (!input.identitasTerverifikasi) {
    return {
      boleh: false,
      alasan:
        'Identitas pemohon belum diverifikasi petugas. Akun portal yang dibuat tanpa verifikasi ' +
        'tatap muka adalah rekam medis yang diserahkan kepada siapa pun yang mengetahui tanggal ' +
        'lahir seseorang.',
    };
  }
  if (input.akunSudahTertaut) {
    return {
      boleh: false,
      alasan:
        'Akun ini sudah tertaut pasien lain. Satu akun, satu pasien — akun yang menaut dua ' +
        'pasien membuat jejak akses tidak dapat dibaca: yang tercatat adalah "akun ini ' +
        'membuka rekam medis", dan pertanyaan yang sesungguhnya, siapa yang membukanya, tidak ' +
        'terjawab. Wali diselesaikan lewat perwalian, bukan lewat akun ganda.',
    };
  }
  if (input.pasienSudahPunyaAkun) {
    return {
      boleh: false,
      alasan: 'Pasien ini sudah memiliki akun portal.',
    };
  }
  return { boleh: true, alasan: 'Akun dapat ditautkan.' };
}
