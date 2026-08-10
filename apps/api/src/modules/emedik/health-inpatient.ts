/**
 * Aturan rawat inap: penerimaan, perpindahan, pemulangan, dan tempat tidur.
 *
 * Fungsi murni, tanpa basis data.
 *
 * Satu invarian berdiri di atas segalanya: **satu tempat tidur, satu pasien.**
 * Ia terdengar sepele sampai seseorang menempatkan pasien kedua di tempat tidur
 * yang menurut sistem kosong — lalu obat, hasil laboratorium, dan tanda vital
 * milik dua orang bercampur di bawah satu nomor kamar. Karena itu invarian ini
 * ditegakkan di TIGA lapisan: di sini, di layanan, dan oleh indeks unik parsial
 * pada basis data.
 *
 * Yang kedua, dan hampir sama pentingnya: **tempat tidur yang baru ditinggalkan
 * bukan tempat tidur yang kosong.** Ia kotor sampai ada yang membersihkannya
 * dan menyatakannya bersih.
 */

// --- Bentuk data -------------------------------------------------------------

export type StatusTempatTidur =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'CLEANING'
  | 'MAINTENANCE'
  | 'CLOSED';

export type JenisIsolasi = 'NONE' | 'CONTACT' | 'DROPLET' | 'AIRBORNE' | 'PROTECTIVE';

export interface TempatTidur {
  id: string;
  code: string;
  roomId: string;
  status: StatusTempatTidur;
  /** Jenis kelamin yang sedang menempati kamarnya, bila kamar bersama. */
  roomSex?: 'MALE' | 'FEMALE' | null;
  roomCapacity: number;
  roomOccupied: number;
  /** Kemampuan isolasi kamarnya. */
  isolationCapability?: JenisIsolasi[] | null;
  classCode?: string | null;
}

export interface KebutuhanPasien {
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN' | null;
  isolation: JenisIsolasi;
  classCode?: string | null;
  /** Umur dalam tahun; anak dan dewasa tidak dicampur di kamar bersama. */
  ageYears?: number | null;
}

export interface Putusan {
  allowed: boolean;
  reason?: string;
  message?: string;
}

// --- Penempatan tempat tidur -------------------------------------------------

/**
 * Boleh atau tidaknya satu tempat tidur ditempati pasien ini.
 *
 * Urutan pemeriksaannya disengaja: yang paling berbahaya lebih dahulu, supaya
 * pesan yang muncul menyebut sebab yang paling penting, bukan sebab pertama
 * yang kebetulan ditemukan.
 */
export function bolehTempati(bed: TempatTidur, pasien: KebutuhanPasien): Putusan {
  // 1. Satu tempat tidur, satu pasien.
  if (bed.status === 'OCCUPIED') {
    return {
      allowed: false,
      reason: 'OCCUPIED',
      message: `Tempat tidur ${bed.code} sedang ditempati pasien lain.`,
    };
  }

  /*
   * 2. Tempat tidur yang baru ditinggalkan BUKAN tempat tidur yang kosong.
   *
   * Menempatkan pasien baru di tempat tidur yang belum dibersihkan adalah cara
   * paling langsung memindahkan infeksi dari pasien yang sudah pulang kepada
   * pasien yang baru masuk — dan yang kedua tidak akan pernah tahu dari mana
   * ia mendapatkannya.
   */
  if (bed.status === 'CLEANING') {
    return {
      allowed: false,
      reason: 'CLEANING',
      message: `Tempat tidur ${bed.code} belum dinyatakan bersih setelah pasien sebelumnya.`,
    };
  }

  if (bed.status === 'MAINTENANCE' || bed.status === 'CLOSED') {
    return {
      allowed: false,
      reason: bed.status,
      message: `Tempat tidur ${bed.code} sedang tidak dapat dipakai (${bed.status}).`,
    };
  }

  // 3. Isolasi. Kamar yang tidak mampu menampung isolasi yang dibutuhkan tidak
  //    boleh dipakai, sekalipun kosong dan sekalipun sedang penuh di tempat lain.
  if (pasien.isolation !== 'NONE') {
    const mampu = bed.isolationCapability ?? [];
    if (!mampu.includes(pasien.isolation)) {
      return {
        allowed: false,
        reason: 'ISOLATION_MISMATCH',
        message:
          `Pasien memerlukan isolasi ${pasien.isolation}, dan kamar tempat tidur ${bed.code} ` +
          'tidak memilikinya. Menempatkannya di sini membahayakan pasien lain di kamar yang sama.',
      };
    }
    // Isolasi udara menuntut kamar sendiri.
    if (pasien.isolation === 'AIRBORNE' && bed.roomOccupied > 0) {
      return {
        allowed: false,
        reason: 'ISOLATION_NEEDS_SINGLE_ROOM',
        message: 'Isolasi udara menuntut kamar tanpa penghuni lain.',
      };
    }
  }

  /*
   * 4. Jenis kelamin pada kamar bersama.
   *
   * Bukan kesopanan semata: pasien yang menolak dirawat karena kamarnya
   * bercampur akan pulang paksa, dan pulang paksa adalah hasil klinis yang
   * buruk. Kamar berkapasitas satu tidak diperiksa.
   */
  if (bed.roomCapacity > 1 && bed.roomOccupied > 0 && bed.roomSex && pasien.sex) {
    if (bed.roomSex !== pasien.sex) {
      return {
        allowed: false,
        reason: 'SEX_MISMATCH',
        message: `Kamar ini sedang ditempati pasien berjenis kelamin lain.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Memilih tempat tidur terbaik di antara yang boleh ditempati.
 *
 * Kelas yang sesuai lebih dahulu, lalu kamar yang sudah berpenghuni — bukan
 * yang kosong. Menyebar pasien ke kamar-kamar kosong terdengar ramah, tetapi ia
 * menghabiskan kamar kosong yang esok hari dibutuhkan pasien isolasi, dan
 * pasien isolasi yang tidak memperoleh kamar akan ditolak masuk.
 */
export function pilihTempatTidur(
  kandidat: TempatTidur[],
  pasien: KebutuhanPasien,
): { bed: TempatTidur | null; rejected: Array<{ bed: TempatTidur; reason: string }> } {
  const ditolak: Array<{ bed: TempatTidur; reason: string }> = [];
  const layak: TempatTidur[] = [];

  for (const b of kandidat) {
    const p = bolehTempati(b, pasien);
    if (p.allowed) layak.push(b);
    else ditolak.push({ bed: b, reason: p.reason ?? 'UNKNOWN' });
  }

  if (!layak.length) return { bed: null, rejected: ditolak };

  const skor = (b: TempatTidur) => {
    let n = 0;
    if (pasien.classCode && b.classCode === pasien.classCode) n += 1000;
    // Pasien isolasi justru diberi kamar kosong; yang lain mengisi kamar
    // berpenghuni supaya kamar kosong tetap tersedia.
    if (pasien.isolation !== 'NONE') n += b.roomOccupied === 0 ? 100 : 0;
    else n += b.roomOccupied > 0 ? 100 : 0;
    return n;
  };

  return { bed: [...layak].sort((a, b) => skor(b) - skor(a))[0], rejected: ditolak };
}

/**
 * Perpindahan status tempat tidur yang sah.
 *
 * Dituliskan sebagai peta, bukan rangkaian `if`. Perpindahan yang tidak
 * tercantum tidak sah — termasuk `OCCUPIED → AVAILABLE`, yang melewatkan
 * pembersihan.
 */
export const PERPINDAHAN_TEMPAT_TIDUR: Record<StatusTempatTidur, StatusTempatTidur[]> = {
  AVAILABLE: ['OCCUPIED', 'RESERVED', 'CLEANING', 'MAINTENANCE', 'CLOSED'],
  RESERVED: ['OCCUPIED', 'AVAILABLE', 'CLOSED'],
  // Sengaja TIDAK ada jalan langsung ke AVAILABLE. Tempat tidur yang baru
  // ditinggalkan harus melewati pembersihan.
  OCCUPIED: ['CLEANING', 'MAINTENANCE', 'CLOSED'],
  CLEANING: ['AVAILABLE', 'MAINTENANCE', 'CLOSED'],
  MAINTENANCE: ['CLEANING', 'AVAILABLE', 'CLOSED'],
  CLOSED: ['CLEANING', 'AVAILABLE', 'MAINTENANCE'],
};

export function bolehUbahStatusTempatTidur(
  dari: StatusTempatTidur,
  ke: StatusTempatTidur,
): Putusan {
  if (dari === ke) return { allowed: true };
  if (PERPINDAHAN_TEMPAT_TIDUR[dari]?.includes(ke)) return { allowed: true };

  if (dari === 'OCCUPIED' && ke === 'AVAILABLE') {
    return {
      allowed: false,
      reason: 'SKIPS_CLEANING',
      message:
        'Tempat tidur yang baru ditinggalkan tidak dapat langsung dinyatakan kosong. ' +
        'Ia harus melewati pembersihan lebih dahulu.',
    };
  }
  return {
    allowed: false,
    reason: 'INVALID_TRANSITION',
    message: `Perpindahan status ${dari} → ${ke} tidak sah.`,
  };
}

// --- Perawatan inap ----------------------------------------------------------

export type StatusRawatInap =
  | 'PENDING'
  | 'ADMITTED'
  | 'TRANSFERRED'
  | 'DISCHARGE_PLANNED'
  | 'DISCHARGED'
  | 'DECEASED'
  | 'CANCELLED';

export type CaraPulang =
  | 'ROUTINE'
  | 'TRANSFER_OUT'
  | 'AGAINST_MEDICAL_ADVICE'
  | 'ABSCONDED'
  | 'DECEASED';

/**
 * Boleh atau tidaknya pasien dipulangkan.
 *
 * Yang menahan pemulangan bukan urusan administrasi. Ia dua hal yang benar-benar
 * membahayakan bila dilewati.
 */
export function bolehPulangkan(input: {
  status: StatusRawatInap;
  disposition: CaraPulang;
  /** Nilai kritis yang belum diterima klinisi mana pun. */
  unacknowledgedCriticalCount: number;
  /** Ringkasan pulang sudah ditulis. */
  hasDischargeSummary: boolean;
  /** Alasan, wajib untuk pulang paksa dan kematian. */
  reason?: string | null;
  /** Waktu kematian, wajib bila caranya DECEASED. */
  deathAt?: string | null;
}): Putusan {
  if (input.status === 'DISCHARGED' || input.status === 'DECEASED') {
    return {
      allowed: false,
      reason: 'ALREADY_CLOSED',
      message: 'Perawatan ini sudah ditutup.',
    };
  }
  if (input.status !== 'ADMITTED' && input.status !== 'DISCHARGE_PLANNED') {
    return {
      allowed: false,
      reason: 'NOT_ADMITTED',
      message: `Pemulangan memerlukan pasien berstatus dirawat, saat ini ${input.status}.`,
    };
  }

  /*
   * Nilai kritis yang belum diterima siapa pun menahan pemulangan — kecuali
   * pada kematian, di mana menahannya tidak lagi menolong siapa pun dan hanya
   * akan membuat keluarga menunggu.
   *
   * Pasien yang pulang membawa kalium 7,2 yang belum pernah dibaca adalah
   * kejadian yang berakhir di ruang gawat darurat pada malam yang sama.
   */
  if (input.disposition !== 'DECEASED' && input.unacknowledgedCriticalCount > 0) {
    return {
      allowed: false,
      reason: 'CRITICAL_PENDING',
      message:
        `Masih ada ${input.unacknowledgedCriticalCount} nilai kritis yang belum diterima ` +
        'klinisi. Pasien tidak dapat dipulangkan sebelum hasilnya dibaca dan ditindaklanjuti.',
    };
  }

  if (input.disposition === 'DECEASED' && !input.deathAt) {
    return {
      allowed: false,
      reason: 'DEATH_TIME_REQUIRED',
      message: 'Waktu kematian wajib dicatat.',
    };
  }

  /*
   * Pulang paksa TIDAK ditolak — menolaknya berarti menahan orang di rumah
   * sakit di luar kehendaknya, dan itu bukan wewenang sistem. Yang dituntut
   * adalah alasannya tercatat, supaya kelak dapat dibedakan dari pasien yang
   * pulang karena sudah sembuh.
   */
  if (
    (input.disposition === 'AGAINST_MEDICAL_ADVICE' || input.disposition === 'ABSCONDED') &&
    (input.reason ?? '').trim().length < 5
  ) {
    return {
      allowed: false,
      reason: 'REASON_REQUIRED',
      message: 'Pulang paksa dan pasien menghilang wajib menyebutkan keterangannya.',
    };
  }

  if (
    !input.hasDischargeSummary &&
    input.disposition !== 'ABSCONDED' &&
    input.disposition !== 'DECEASED'
  ) {
    return {
      allowed: false,
      reason: 'SUMMARY_REQUIRED',
      message:
        'Ringkasan pulang belum ditulis. Pasien yang pulang tanpa ringkasan membawa riwayat ' +
        'perawatannya hanya di dalam ingatannya sendiri, dan dokter berikutnya akan memulai ' +
        'dari nol.',
    };
  }

  return { allowed: true };
}

/** Berapa hari perawatan ditagihkan. */
export function lamaRawat(admitAt: string, dischargeAt: string): number {
  const masuk = Date.parse(admitAt);
  const keluar = Date.parse(dischargeAt);
  if (!Number.isFinite(masuk) || !Number.isFinite(keluar) || keluar < masuk) return 0;

  /*
   * Dihitung per hari kalender yang dilewati, bukan per 24 jam.
   *
   * Pasien yang masuk pukul 23.00 dan pulang pukul 08.00 keesokan harinya
   * memakai tempat tidur pada dua hari, dan dua hari itulah yang tidak dapat
   * dijual kepada orang lain. Menghitungnya sebagai "kurang dari sehari" akan
   * membuat rumah sakit menanggung biayanya diam-diam.
   */
  const hariMasuk = new Date(masuk); hariMasuk.setHours(0, 0, 0, 0);
  const hariKeluar = new Date(keluar); hariKeluar.setHours(0, 0, 0, 0);
  const selisih = Math.round((hariKeluar.getTime() - hariMasuk.getTime()) / 86_400_000);

  // Hari yang DILEWATI, bukan selisih tanggalnya: masuk dan pulang di tanggal
  // yang sama tetap satu hari, dan 1 → 3 Agustus adalah tiga hari.
  return Math.max(1, selisih + 1);
}

/**
 * Boleh atau tidaknya pasien dipindahkan.
 *
 * Perpindahan tempat tidur adalah dua peristiwa yang harus terjadi bersamaan:
 * yang lama ditinggalkan, yang baru ditempati. Bila hanya salah satunya
 * tercatat, ada tempat tidur yang tampak terisi pasien hantu atau pasien yang
 * tampak berada di dua tempat sekaligus.
 */
export function bolehPindah(input: {
  status: StatusRawatInap;
  bedTujuan: TempatTidur;
  pasien: KebutuhanPasien;
  bedAsalId: string | null;
}): Putusan {
  if (input.status !== 'ADMITTED' && input.status !== 'DISCHARGE_PLANNED') {
    return {
      allowed: false,
      reason: 'NOT_ADMITTED',
      message: `Perpindahan memerlukan pasien berstatus dirawat, saat ini ${input.status}.`,
    };
  }
  if (input.bedAsalId && input.bedAsalId === input.bedTujuan.id) {
    return {
      allowed: false,
      reason: 'SAME_BED',
      message: 'Tempat tidur tujuan sama dengan tempat tidur sekarang.',
    };
  }
  return bolehTempati(input.bedTujuan, input.pasien);
}

// --- Keperawatan -------------------------------------------------------------

/**
 * Skor peringatan dini menurut tanda vital.
 *
 * Bentuk sederhana dari NEWS: satu angka yang dapat dibaca sekilas, karena
 * perawat yang harus menafsirkan enam angka sekaligus pada pukul tiga pagi akan
 * menafsirkannya dengan cara yang berbeda-beda.
 *
 * Angkanya BUKAN diagnosis. Ia penentu seberapa sering pasien harus dilihat
 * lagi, dan kapan dokter harus dipanggil.
 */
export function skorPeringatanDini(v: {
  respiratoryRate?: number | null;
  spo2?: number | null;
  systolicBp?: number | null;
  heartRate?: number | null;
  temperature?: number | null;
  consciousness?: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE' | null;
}): { score: number; risk: 'LOW' | 'MEDIUM' | 'HIGH'; observationMinutes: number; missing: string[] } {
  let skor = 0;
  const hilang: string[] = [];

  const nilai = (
    nama: string,
    x: number | null | undefined,
    batas: Array<[number, number, number]>,
  ) => {
    if (x === null || x === undefined || Number.isNaN(x)) {
      hilang.push(nama);
      return;
    }
    for (const [bawah, atas, poin] of batas) {
      if (x >= bawah && x <= atas) {
        skor += poin;
        return;
      }
    }
  };

  nilai('respiratoryRate', v.respiratoryRate, [
    [-Infinity, 8, 3], [9, 11, 1], [12, 20, 0], [21, 24, 2], [25, Infinity, 3],
  ]);
  nilai('spo2', v.spo2, [
    [-Infinity, 91, 3], [92, 93, 2], [94, 95, 1], [96, Infinity, 0],
  ]);
  nilai('systolicBp', v.systolicBp, [
    [-Infinity, 90, 3], [91, 100, 2], [101, 110, 1], [111, 219, 0], [220, Infinity, 3],
  ]);
  nilai('heartRate', v.heartRate, [
    [-Infinity, 40, 3], [41, 50, 1], [51, 90, 0], [91, 110, 1], [111, 130, 2], [131, Infinity, 3],
  ]);
  nilai('temperature', v.temperature, [
    [-Infinity, 35, 3], [35.1, 36, 1], [36.1, 38, 0], [38.1, 39, 1], [39.1, Infinity, 2],
  ]);

  if (!v.consciousness) hilang.push('consciousness');
  else if (v.consciousness !== 'ALERT') skor += 3;

  const risiko = skor >= 7 ? 'HIGH' : skor >= 5 ? 'MEDIUM' : 'LOW';
  const pengamatan = risiko === 'HIGH' ? 30 : risiko === 'MEDIUM' ? 60 : 240;

  return { score: skor, risk: risiko, observationMinutes: pengamatan, missing: hilang };
}

/**
 * Apakah tanda vital berikutnya sudah lewat waktunya.
 *
 * Pengamatan yang terlambat pada pasien berisiko tinggi adalah cara paling
 * sering perburukan luput — bukan karena tidak ada yang peduli, melainkan
 * karena tidak ada yang mengingatkan.
 */
export function pengamatanTerlambat(input: {
  lastObservationAt: string | null;
  observationMinutes: number;
  now: string;
}): { overdue: boolean; minutesLate: number } {
  if (!input.lastObservationAt) return { overdue: true, minutesLate: 0 };
  const berlalu = (Date.parse(input.now) - Date.parse(input.lastObservationAt)) / 60_000;
  if (!Number.isFinite(berlalu)) return { overdue: false, minutesLate: 0 };
  const telat = berlalu - input.observationMinutes;
  return { overdue: telat > 0, minutesLate: Math.max(0, Math.round(telat)) };
}

/**
 * Membuang identitas penghuni dari daftar tempat tidur.
 *
 * Daftar tempat tidur menjawab dua pertanyaan yang berbeda kepada dua orang
 * yang berbeda. Pengurus sarana bertanya "tempat tidur mana yang siap dipakai";
 * perawat bertanya "siapa yang ada di tempat tidur ini". Hanya pertanyaan kedua
 * yang menuntut nama.
 *
 * UAT persona memperlihatkan akibat menjawab keduanya sekaligus: administrator
 * eMedik menerima 403 pada indeks pasien dan pada papan bangsal, lalu
 * memperoleh nama lengkap beserta nomor rawat inap dari daftar tempat tidur —
 * salah satunya di kamar isolasi, yang dengan sendirinya sudah menyatakan
 * sesuatu yang klinis tentang orang itu.
 *
 * Yang dibuang hanya nama dan nomor rawat inapnya. Keadaan tempat tidur tetap
 * utuh, sebab menyembunyikannya tidak melindungi siapa pun dan justru
 * melumpuhkan pengurus sarana.
 */
export function samarkanPenghuniTempatTidur<T extends { patient_name?: unknown; admission_number?: unknown }>(
  baris: readonly T[],
  bolehLihatPenghuni: boolean,
): T[] {
  if (bolehLihatPenghuni) return [...baris];
  return baris.map((b) => ({ ...b, patient_name: null, admission_number: null }));
}
