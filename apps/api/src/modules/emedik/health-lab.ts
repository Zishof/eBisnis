/**
 * Aturan laboratorium dan radiologi.
 *
 * Fungsi murni, tanpa basis data, sehingga dapat diuji dalam puluhan kombinasi.
 *
 * Satu hal menentukan bentuk seluruh berkas ini: **hasil pemeriksaan yang tidak
 * dibaca sama saja dengan pemeriksaan yang tidak pernah dilakukan.** Kalium 7,2
 * yang tersimpan rapi di dalam sistem, terverifikasi, dan tidak dibaca siapa
 * pun sampai keesokan paginya bukan kegagalan laboratorium — ia kegagalan
 * penyampaian, dan pasiennya sama saja meninggal.
 *
 * Karena itu nilai kritis di sini bukan penanda warna pada layar. Ia menuntut
 * penerimaan oleh manusia yang dapat disebut namanya, dengan tenggat, dan
 * dengan eskalasi bila tenggatnya lewat.
 */

// --- Bentuk data -------------------------------------------------------------

export interface Pasien {
  /** Umur dalam tahun. Bayi dinyatakan sebagai pecahan. */
  ageYears: number | null;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN' | null;
}

export interface RentangRujukan {
  /** Batas umur berlakunya, dalam tahun. `null` berarti tanpa batas. */
  minAge?: number | null;
  maxAge?: number | null;
  sex?: 'MALE' | 'FEMALE' | null;
  low?: number | null;
  high?: number | null;
  /** Di luar batas ini, hasilnya kritis. */
  criticalLow?: number | null;
  criticalHigh?: number | null;
  unit: string;
}

export interface PemeriksaanLab {
  code: string;
  name: string;
  resultType: 'NUMERIC' | 'TEXT' | 'CODED';
  unit?: string | null;
  ranges: RentangRujukan[];
  /**
   * Boleh diverifikasi mesin tanpa dibaca analis. Hanya untuk pemeriksaan yang
   * memang dikerjakan alat otomatis.
   */
  allowAutoVerify?: boolean;
  /** Selisih dari hasil sebelumnya yang mencurigakan, dalam persen. */
  deltaCheckPercent?: number | null;
}

export type StatusSpesimen =
  | 'ORDERED'
  | 'COLLECTED'
  | 'RECEIVED'
  | 'REJECTED'
  | 'IN_PROCESS'
  | 'COMPLETED';

export type Penilaian = 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL_LOW' | 'CRITICAL_HIGH' | 'UNKNOWN';

export interface HasilPenilaian {
  flag: Penilaian;
  critical: boolean;
  /** Rentang yang benar-benar dipakai; berguna untuk ditampilkan di samping angkanya. */
  range: RentangRujukan | null;
  message: string;
}

// --- Rentang rujukan ---------------------------------------------------------

/**
 * Memilih rentang rujukan yang berlaku bagi pasien ini.
 *
 * Hemoglobin 11 g/dL wajar pada anak dan menunjukkan anemia pada laki-laki
 * dewasa. Membandingkan seluruh pasien terhadap satu rentang akan menghasilkan
 * dua kekeliruan sekaligus: menandai yang sehat dan melewatkan yang sakit.
 *
 * Rentang yang lebih khusus menang. Yang menyebut jenis kelamin lebih khusus
 * daripada yang tidak; yang batas umurnya lebih sempit lebih khusus daripada
 * yang lebar.
 */
export function pilihRentang(
  pemeriksaan: PemeriksaanLab,
  pasien: Pasien,
): RentangRujukan | null {
  const cocok = pemeriksaan.ranges.filter((r) => {
    if (r.sex && pasien.sex && r.sex !== pasien.sex) return false;
    if (r.sex && !pasien.sex) return false;
    if (pasien.ageYears === null) return r.minAge == null && r.maxAge == null;
    if (r.minAge != null && pasien.ageYears < r.minAge) return false;
    if (r.maxAge != null && pasien.ageYears >= r.maxAge) return false;
    return true;
  });

  if (!cocok.length) return null;

  return cocok.sort((a, b) => kekhususan(b) - kekhususan(a))[0];
}

function kekhususan(r: RentangRujukan): number {
  let nilai = 0;
  if (r.sex) nilai += 100;
  if (r.minAge != null || r.maxAge != null) {
    // Rentang umur yang lebih sempit lebih khusus. Yang tanpa batas atas
    // diperlakukan seolah berakhir pada 150 tahun.
    const lebar = (r.maxAge ?? 150) - (r.minAge ?? 0);
    nilai += Math.max(0, 100 - lebar);
  }
  return nilai;
}

/**
 * Menilai satu hasil numerik terhadap rentang rujukannya.
 *
 * Nilai kritis diperiksa lebih dahulu, dan sengaja: hasil yang kritis tinggi
 * juga tinggi, tetapi menyebutnya "tinggi" saja akan membuatnya masuk ke
 * antrean yang sama dengan seratus hasil tinggi lain hari itu.
 */
export function nilaiHasil(
  pemeriksaan: PemeriksaanLab,
  pasien: Pasien,
  value: number | null,
): HasilPenilaian {
  const rentang = pilihRentang(pemeriksaan, pasien);

  if (value === null || Number.isNaN(value)) {
    return { flag: 'UNKNOWN', critical: false, range: rentang, message: 'Hasil tidak bernilai angka.' };
  }

  if (!rentang) {
    /*
     * Tidak ada rentang yang berlaku. Menandainya "normal" akan berbohong;
     * menandainya "tinggi" juga. Yang jujur adalah mengatakan bahwa kita tidak
     * tahu, supaya yang membacanya menilai sendiri.
     */
    return {
      flag: 'UNKNOWN',
      critical: false,
      range: null,
      message: 'Tidak ada rentang rujukan yang berlaku bagi umur dan jenis kelamin pasien ini.',
    };
  }

  if (rentang.criticalLow != null && value <= rentang.criticalLow) {
    return {
      flag: 'CRITICAL_LOW',
      critical: true,
      range: rentang,
      message: `NILAI KRITIS RENDAH: ${value} ${rentang.unit} (kritis ≤ ${rentang.criticalLow}). Wajib disampaikan kepada dokter dan diterima secara lisan.`,
    };
  }
  if (rentang.criticalHigh != null && value >= rentang.criticalHigh) {
    return {
      flag: 'CRITICAL_HIGH',
      critical: true,
      range: rentang,
      message: `NILAI KRITIS TINGGI: ${value} ${rentang.unit} (kritis ≥ ${rentang.criticalHigh}). Wajib disampaikan kepada dokter dan diterima secara lisan.`,
    };
  }
  if (rentang.low != null && value < rentang.low) {
    return {
      flag: 'LOW',
      critical: false,
      range: rentang,
      message: `Di bawah rentang rujukan (${rentang.low}–${rentang.high ?? '∞'} ${rentang.unit}).`,
    };
  }
  if (rentang.high != null && value > rentang.high) {
    return {
      flag: 'HIGH',
      critical: false,
      range: rentang,
      message: `Di atas rentang rujukan (${rentang.low ?? '0'}–${rentang.high} ${rentang.unit}).`,
    };
  }

  return { flag: 'NORMAL', critical: false, range: rentang, message: 'Dalam rentang rujukan.' };
}

// --- Pemeriksaan delta -------------------------------------------------------

/**
 * Membandingkan hasil dengan hasil sebelumnya milik pasien yang sama.
 *
 * Hemoglobin yang turun dari 14 menjadi 7 dalam empat jam bukan tidak mungkin —
 * tetapi jauh lebih sering ia berarti tabungnya tertukar. Pemeriksaan ini tidak
 * menolak hasilnya; ia meminta analis melihat sekali lagi sebelum dilepas.
 */
export function periksaDelta(
  pemeriksaan: PemeriksaanLab,
  sekarang: number,
  sebelumnya: number | null,
): { suspicious: boolean; changePercent: number | null; message?: string } {
  if (sebelumnya === null || pemeriksaan.deltaCheckPercent == null) {
    return { suspicious: false, changePercent: null };
  }
  if (sebelumnya === 0) return { suspicious: false, changePercent: null };

  const perubahan = ((sekarang - sebelumnya) / Math.abs(sebelumnya)) * 100;
  if (Math.abs(perubahan) < pemeriksaan.deltaCheckPercent) {
    return { suspicious: false, changePercent: perubahan };
  }

  return {
    suspicious: true,
    changePercent: perubahan,
    message:
      `Berubah ${perubahan > 0 ? 'naik' : 'turun'} ${Math.abs(perubahan).toFixed(0)}% dari ` +
      `hasil sebelumnya (${sebelumnya} → ${sekarang}). Periksa kembali identitas spesimen ` +
      'sebelum melepas hasil ini.',
  };
}

// --- Spesimen ----------------------------------------------------------------

/** Sebab-sebab spesimen ditolak. Yang tidak ada di sini bukan sebab yang sah. */
export const SEBAB_TOLAK_SPESIMEN = [
  'UNLABELLED',
  'MISLABELLED',
  'HEMOLYSED',
  'CLOTTED',
  'INSUFFICIENT_VOLUME',
  'WRONG_CONTAINER',
  'CONTAMINATED',
  'EXPIRED_TUBE',
  'DELAYED_TRANSPORT',
  'LEAKED',
] as const;

export type SebabTolak = (typeof SEBAB_TOLAK_SPESIMEN)[number];

/**
 * Boleh atau tidaknya spesimen diterima laboratorium.
 *
 * Spesimen tanpa label TIDAK PERNAH boleh diterima, sekalipun petugas yang
 * mengantarnya yakin betul itu milik siapa. Keyakinan yang salah tentang
 * identitas spesimen menghasilkan hasil yang benar secara analitis, dilaporkan
 * dengan percaya diri, dan tertempel pada orang yang keliru — dan ia akan
 * dipercaya, karena laboratorium jarang salah.
 */
export function bolehTerimaSpesimen(input: {
  labelled: boolean;
  labelMatchesRequest: boolean;
  collectedAt: string | null;
  receivedAt: string;
  /** Batas waktu antara pengambilan dan penerimaan, dalam menit. */
  maxTransportMinutes?: number | null;
  volumeSufficient?: boolean;
  containerCorrect?: boolean;
}): { accepted: boolean; reason?: SebabTolak; message?: string } {
  if (!input.labelled) {
    return {
      accepted: false,
      reason: 'UNLABELLED',
      message:
        'Spesimen tanpa label tidak dapat diterima. Ambil ulang. Menerimanya karena ' +
        'petugas yakin itu milik siapa adalah cara paling langsung menghasilkan hasil ' +
        'yang benar pada orang yang keliru.',
    };
  }
  if (!input.labelMatchesRequest) {
    return {
      accepted: false,
      reason: 'MISLABELLED',
      message: 'Label spesimen tidak cocok dengan permintaan pemeriksaan. Ambil ulang.',
    };
  }
  if (input.volumeSufficient === false) {
    return {
      accepted: false,
      reason: 'INSUFFICIENT_VOLUME',
      message: 'Volume spesimen tidak mencukupi untuk pemeriksaan yang diminta.',
    };
  }
  if (input.containerCorrect === false) {
    return {
      accepted: false,
      reason: 'WRONG_CONTAINER',
      message: 'Jenis tabung tidak sesuai. Antikoagulan yang keliru mengubah hasilnya.',
    };
  }

  if (input.collectedAt && input.maxTransportMinutes) {
    const menit = (Date.parse(input.receivedAt) - Date.parse(input.collectedAt)) / 60_000;
    if (Number.isFinite(menit) && menit > input.maxTransportMinutes) {
      return {
        accepted: false,
        reason: 'DELAYED_TRANSPORT',
        message:
          `Spesimen tiba ${Math.round(menit)} menit setelah pengambilan, melewati batas ` +
          `${input.maxTransportMinutes} menit. Hasilnya tidak lagi menggambarkan keadaan pasien.`,
      };
    }
  }

  return { accepted: true };
}

// --- Verifikasi --------------------------------------------------------------

/**
 * Boleh atau tidaknya hasil diverifikasi mesin tanpa dibaca analis.
 *
 * Verifikasi otomatis memang mempercepat, dan pada laboratorium bervolume besar
 * ia satu-satunya cara mengejar. Tetapi tidak untuk hasil kritis: nilai kritis
 * yang lolos tanpa dilihat siapa pun akan masuk ke rekam medis tanpa ada
 * seorang pun yang tahu ia pernah ada.
 */
export function bolehVerifikasiOtomatis(input: {
  pemeriksaan: PemeriksaanLab;
  penilaian: HasilPenilaian;
  delta: { suspicious: boolean };
}): { allowed: boolean; reason?: string } {
  if (!input.pemeriksaan.allowAutoVerify) {
    return { allowed: false, reason: 'Pemeriksaan ini tidak ditandai boleh diverifikasi otomatis.' };
  }
  if (input.penilaian.critical) {
    return { allowed: false, reason: 'Nilai kritis wajib dilihat analis sebelum dilepas.' };
  }
  if (input.delta.suspicious) {
    return {
      allowed: false,
      reason: 'Selisih dari hasil sebelumnya mencurigakan; kemungkinan tertukar spesimen.',
    };
  }
  if (input.penilaian.flag === 'UNKNOWN') {
    return { allowed: false, reason: 'Hasil tanpa rentang rujukan tidak dapat dinilai mesin.' };
  }
  return { allowed: true };
}

/**
 * Boleh atau tidaknya hasil dilepas kepada klinisi.
 *
 * Pemeriksaan verifikator terpisah dari analis yang memasukkan hasilnya, dengan
 * alasan yang sama seperti telaah apoteker: orang yang mengetik angkanya adalah
 * orang yang paling sulit melihat kekeliruannya.
 */
export function bolehLepasHasil(input: {
  status: string;
  enteredBy: string | null;
  verifiedBy: string | null;
  specimenStatus: StatusSpesimen;
}): { allowed: boolean; message?: string } {
  if (input.specimenStatus === 'REJECTED') {
    return {
      allowed: false,
      message: 'Spesimennya ditolak. Hasil dari spesimen yang ditolak tidak boleh dilaporkan.',
    };
  }
  if (!input.verifiedBy) {
    return { allowed: false, message: 'Hasil belum diverifikasi.' };
  }
  if (input.enteredBy && input.verifiedBy === input.enteredBy) {
    return {
      allowed: false,
      message:
        'Verifikator tidak boleh sama dengan yang memasukkan hasil. Orang yang mengetik ' +
        'angkanya adalah orang yang paling sulit melihat kekeliruannya.',
    };
  }
  return { allowed: true };
}

// --- Nilai kritis ------------------------------------------------------------

/** Tenggat penerimaan nilai kritis oleh klinisi, dalam menit. */
export const TENGGAT_TERIMA_KRITIS_MENIT = 30;

/**
 * Apakah penyampaian nilai kritis sudah lewat tenggat.
 *
 * Tenggatnya pendek dengan sengaja. Nilai kritis yang menunggu satu jam bukan
 * lagi nilai kritis — ia riwayat.
 */
export function statusPenyampaianKritis(input: {
  criticalAt: string;
  acknowledgedAt: string | null;
  now: string;
}): {
  state: 'ACKNOWLEDGED' | 'PENDING' | 'OVERDUE';
  minutesElapsed: number;
  message: string;
} {
  const berlalu = Math.max(0, (Date.parse(input.now) - Date.parse(input.criticalAt)) / 60_000);

  if (input.acknowledgedAt) {
    const sampai = (Date.parse(input.acknowledgedAt) - Date.parse(input.criticalAt)) / 60_000;
    return {
      state: 'ACKNOWLEDGED',
      minutesElapsed: Math.round(sampai),
      message: `Diterima klinisi ${Math.round(sampai)} menit setelah hasil keluar.`,
    };
  }

  if (berlalu > TENGGAT_TERIMA_KRITIS_MENIT) {
    return {
      state: 'OVERDUE',
      minutesElapsed: Math.round(berlalu),
      message:
        `LEWAT TENGGAT: ${Math.round(berlalu)} menit tanpa penerimaan (batas ` +
        `${TENGGAT_TERIMA_KRITIS_MENIT} menit). Eskalasikan kepada dokter penanggung jawab.`,
    };
  }

  return {
    state: 'PENDING',
    minutesElapsed: Math.round(berlalu),
    message: `Menunggu penerimaan klinisi — ${Math.round(berlalu)} menit berlalu.`,
  };
}

/**
 * Sahkah penerimaan nilai kritis ini.
 *
 * Penerimaan menuntut nama penerima DAN bacaan ulang. Bacaan ulang — penerima
 * mengulang angkanya kepada penyampai — adalah satu-satunya cara mengetahui
 * bahwa yang terdengar sama dengan yang diucapkan. "Sudah saya sampaikan" tanpa
 * itu hanya mencatat bahwa telepon berdering.
 */
export function bolehTerimaKritis(input: {
  acknowledgedBy: string | null;
  readBackValue: string | null;
  actualValue: string;
}): { accepted: boolean; message?: string } {
  if (!input.acknowledgedBy) {
    return { accepted: false, message: 'Penerimaan nilai kritis harus menyebut siapa yang menerima.' };
  }
  if (!input.readBackValue?.trim()) {
    return {
      accepted: false,
      message:
        'Bacaan ulang wajib. Penerima mengulang angkanya kepada penyampai — itulah ' +
        'satu-satunya cara mengetahui bahwa yang terdengar sama dengan yang diucapkan.',
    };
  }
  if (!samaNilainya(input.readBackValue, input.actualValue)) {
    return {
      accepted: false,
      message:
        `Bacaan ulang "${input.readBackValue}" tidak cocok dengan hasilnya "${rapikan(input.actualValue)}". ` +
        'Ulangi penyampaian.',
    };
  }
  return { accepted: true };
}

/**
 * Apakah dua tulisan menyebut nilai yang sama.
 *
 * Dibandingkan sebagai ANGKA bila keduanya angka, bukan sebagai teks. Basis
 * data menyimpan `NUMERIC(18,6)` dan mengembalikannya sebagai "7.200000";
 * dokter yang mengulang "7,2" di telepon sedang menyebut angka yang persis
 * sama. Membandingkan teksnya akan menolak setiap penerimaan nilai kritis yang
 * sah — dan penolakan yang selalu terjadi akan membuat orang mencari jalan
 * memutar, tepat pada langkah yang paling tidak boleh dilewati.
 *
 * Ditemukan naskah bukti H-5; pengujian unitnya lolos karena membandingkan
 * "6.2" dengan "6.2".
 */
function samaNilainya(a: string, b: string): boolean {
  const pa = Number(normalkanAngka(a));
  const pb = Number(normalkanAngka(b));
  if (Number.isFinite(pa) && Number.isFinite(pb)) return pa === pb;
  return normalkanAngka(a) === normalkanAngka(b);
}

function normalkanAngka(s: string): string {
  return s.trim().replace(',', '.').replace(/\s+/g, '').toLowerCase();
}

/** Membuang nol berekor supaya pesan galatnya terbaca seperti yang diucapkan. */
function rapikan(s: string): string {
  const n = Number(normalkanAngka(s));
  return Number.isFinite(n) ? String(n) : s;
}

// --- Amandemen ---------------------------------------------------------------

/**
 * Boleh atau tidaknya hasil yang sudah dilepas diperbaiki.
 *
 * Diperbaiki, bukan ditimpa. Hasil yang sudah dilepas mungkin sudah dipakai
 * mengambil keputusan — obat sudah diberikan, pasien sudah dipulangkan. Yang
 * salah harus tetap terlihat beserta penggantinya, supaya keputusan yang
 * terlanjur diambil dapat dipahami kelak.
 */
export function bolehAmandemenHasil(input: {
  released: boolean;
  reason: string | null;
  amendedBy: string | null;
}): { allowed: boolean; message?: string } {
  if (!input.released) {
    return {
      allowed: false,
      message: 'Hasil yang belum dilepas cukup disunting biasa; amandemen tidak diperlukan.',
    };
  }
  if ((input.reason ?? '').trim().length < 10) {
    return {
      allowed: false,
      message:
        'Amandemen hasil wajib menyebutkan alasannya sekurang-kurangnya sepuluh huruf. ' +
        'Hasil yang sudah dilepas mungkin sudah dipakai mengambil keputusan.',
    };
  }
  if (!input.amendedBy) {
    return { allowed: false, message: 'Amandemen harus menyebut siapa yang melakukannya.' };
  }
  return { allowed: true };
}

// --- Daftar kerja ------------------------------------------------------------

export interface BarisKerja {
  id: string;
  priority: 'STAT' | 'URGENT' | 'ROUTINE';
  orderedAt: string;
  status: string;
  isCritical?: boolean;
}

/**
 * Mengurutkan daftar kerja laboratorium.
 *
 * Nilai kritis yang belum diterima klinisi berada paling atas — di atas STAT
 * sekalipun. Pemeriksaan STAT yang belum dikerjakan masih menunggu; nilai
 * kritis yang belum tersampaikan sudah menjadi bahaya.
 */
export function urutkanKerja<T extends BarisKerja>(baris: T[]): T[] {
  const bobot: Record<string, number> = { STAT: 2, URGENT: 1, ROUTINE: 0 };
  return [...baris].sort((a, b) => {
    if (Boolean(a.isCritical) !== Boolean(b.isCritical)) return a.isCritical ? -1 : 1;
    const p = (bobot[b.priority] ?? 0) - (bobot[a.priority] ?? 0);
    if (p !== 0) return p;
    return Date.parse(a.orderedAt) - Date.parse(b.orderedAt);
  });
}

/** Batas waktu penyelesaian menurut tingkat kegawatan, dalam menit. */
export const TENGGAT_KERJA_MENIT: Record<string, number> = {
  STAT: 60,
  URGENT: 240,
  ROUTINE: 1440,
};

export function lewatTenggat(baris: BarisKerja, now: string): boolean {
  const batas = TENGGAT_KERJA_MENIT[baris.priority];
  if (!batas) return false;
  return (Date.parse(now) - Date.parse(baris.orderedAt)) / 60_000 > batas;
}
