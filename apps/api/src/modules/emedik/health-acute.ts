/**
 * Aturan gawat darurat, kamar operasi, dan perawatan intensif.
 *
 * Fungsi murni, tanpa basis data.
 *
 * Tiga hal yang dijaga di sini, dan ketiganya menyangkut kejadian yang tidak
 * dapat diperbaiki setelah terjadi:
 *
 * 1. **Triase yang terlalu rendah lebih berbahaya daripada yang terlalu
 *    tinggi.** Pasien tingkat 2 yang ditriase sebagai tingkat 4 akan menunggu
 *    berjam-jam sementara penyakitnya berjalan terus. Sebaliknya, pasien
 *    tingkat 4 yang ditriase sebagai tingkat 2 hanya membuang waktu petugas.
 *    Karena itu tanda bahaya menaikkan tingkat secara otomatis, dan penurunan
 *    tingkat menuntut alasan.
 *
 * 2. **Jeda sebelum sayatan (time-out) harus benar-benar dilakukan, bukan
 *    dianggap dilakukan.** Ia satu-satunya penahan yang tersisa untuk operasi
 *    salah sisi dan salah pasien, dan seluruh gunanya hilang bila ia dapat
 *    dicentang belakangan.
 *
 * 3. **Hitungan kasa dan instrumen yang tidak cocok menahan penutupan.** Benda
 *    yang tertinggal di dalam tubuh baru ditemukan berbulan-bulan kemudian,
 *    lewat pembedahan kedua.
 */

// --- Triase ------------------------------------------------------------------

/**
 * Tingkat triase, 1 paling gawat.
 *
 * Lima tingkat, bukan tiga. Tiga tingkat memaksa "kuning" menampung pasien yang
 * harus dilihat dalam sepuluh menit bersama pasien yang dapat menunggu satu
 * jam — dan yang pertama akan menunggu selama yang kedua.
 */
export type TingkatTriase = 1 | 2 | 3 | 4 | 5;

/** Batas waktu pasien harus dilihat dokter, dalam menit. */
export const BATAS_TUNGGU_TRIASE: Record<TingkatTriase, number> = {
  1: 0, // segera, tanpa jeda
  2: 10,
  3: 30,
  4: 60,
  5: 120,
};

export const LABEL_TRIASE: Record<TingkatTriase, string> = {
  1: 'Resusitasi',
  2: 'Gawat darurat',
  3: 'Darurat',
  4: 'Kurang darurat',
  5: 'Tidak darurat',
};

export interface TandaVitalTriase {
  respiratoryRate?: number | null;
  spo2?: number | null;
  systolicBp?: number | null;
  heartRate?: number | null;
  temperature?: number | null;
  consciousness?: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE' | null;
  /** Nyeri 0–10. */
  painScore?: number | null;
}

export interface HasilTriase {
  level: TingkatTriase;
  /** Tingkat yang diusulkan petugas sebelum tanda bahaya diterapkan. */
  requestedLevel: TingkatTriase;
  escalated: boolean;
  redFlags: string[];
  maxWaitMinutes: number;
  message: string;
}

/**
 * Menentukan tingkat triase akhir.
 *
 * Tanda bahaya **menaikkan** tingkat, tidak pernah menurunkannya. Petugas boleh
 * menilai lebih gawat daripada tanda vitalnya; ia tidak boleh menilai lebih
 * ringan daripada tanda vital yang mengancam nyawa.
 */
export function tentukanTriase(input: {
  requestedLevel: TingkatTriase;
  vitals: TandaVitalTriase;
  /** Keluhan yang dengan sendirinya menuntut tingkat tinggi. */
  redFlagComplaints?: string[];
}): HasilTriase {
  const tanda: string[] = [];
  let minimum: TingkatTriase = 5;

  const naikkan = (ke: TingkatTriase, sebab: string) => {
    tanda.push(sebab);
    if (ke < minimum) minimum = ke;
  };

  const v = input.vitals;

  if (v.consciousness === 'UNRESPONSIVE') naikkan(1, 'Tidak sadar');
  else if (v.consciousness === 'PAIN') naikkan(2, 'Hanya merespons nyeri');
  else if (v.consciousness === 'VOICE') naikkan(3, 'Hanya merespons suara');

  if (v.spo2 != null) {
    if (v.spo2 < 90) naikkan(1, `Saturasi oksigen ${v.spo2}%`);
    else if (v.spo2 < 94) naikkan(2, `Saturasi oksigen ${v.spo2}%`);
  }

  if (v.respiratoryRate != null) {
    if (v.respiratoryRate < 8 || v.respiratoryRate > 30) {
      naikkan(1, `Laju napas ${v.respiratoryRate} per menit`);
    } else if (v.respiratoryRate > 24) {
      naikkan(2, `Laju napas ${v.respiratoryRate} per menit`);
    }
  }

  if (v.systolicBp != null) {
    if (v.systolicBp < 80) naikkan(1, `Tekanan darah sistolik ${v.systolicBp}`);
    else if (v.systolicBp < 90) naikkan(2, `Tekanan darah sistolik ${v.systolicBp}`);
  }

  if (v.heartRate != null) {
    if (v.heartRate < 40 || v.heartRate > 140) naikkan(1, `Nadi ${v.heartRate} per menit`);
    else if (v.heartRate > 120) naikkan(2, `Nadi ${v.heartRate} per menit`);
  }

  if (v.temperature != null && v.temperature < 35) naikkan(2, `Suhu ${v.temperature} derajat`);

  // Nyeri hebat tidak mengancam nyawa, tetapi pasien yang dibiarkan kesakitan
  // dua jam adalah kegagalan pelayanan yang nyata.
  if (v.painScore != null && v.painScore >= 8) naikkan(3, `Nyeri ${v.painScore} dari 10`);

  for (const k of input.redFlagComplaints ?? []) naikkan(2, k);

  const akhir = (Math.min(input.requestedLevel, minimum) as TingkatTriase);
  const naik = akhir < input.requestedLevel;

  return {
    level: akhir,
    requestedLevel: input.requestedLevel,
    escalated: naik,
    redFlags: tanda,
    maxWaitMinutes: BATAS_TUNGGU_TRIASE[akhir],
    message: naik
      ? `Tingkat dinaikkan dari ${input.requestedLevel} ke ${akhir} karena: ${tanda.join('; ')}.`
      : `Tingkat ${akhir} — ${LABEL_TRIASE[akhir]}. Harus dilihat dalam ${BATAS_TUNGGU_TRIASE[akhir]} menit.`,
  };
}

/**
 * Boleh atau tidaknya tingkat triase diturunkan.
 *
 * Diturunkan, bukan dinaikkan. Menaikkan tingkat selalu boleh — keadaan pasien
 * memang dapat memburuk sambil menunggu. Menurunkannya menuntut alasan, karena
 * ialah yang membuat pasien menunggu lebih lama, dan karena penurunan tingkat
 * adalah tempat tekanan antrean paling mudah menyusup.
 */
export function bolehTurunkanTriase(input: {
  from: TingkatTriase;
  to: TingkatTriase;
  reason: string | null;
}): { allowed: boolean; message?: string } {
  if (input.to <= input.from) return { allowed: true };
  if ((input.reason ?? '').trim().length < 10) {
    return {
      allowed: false,
      message:
        `Menurunkan tingkat triase dari ${input.from} ke ${input.to} menuntut alasan ` +
        'sekurang-kurangnya sepuluh huruf. Penurunan tingkatlah yang membuat pasien menunggu ' +
        'lebih lama.',
    };
  }
  return { allowed: true };
}

/** Apakah pasien sudah melewati batas waktu triasenya. */
export function lewatBatasTunggu(input: {
  level: TingkatTriase;
  arrivedAt: string;
  seenAt: string | null;
  now: string;
}): { overdue: boolean; waitedMinutes: number; lateMinutes: number } {
  const acuan = input.seenAt ? Date.parse(input.seenAt) : Date.parse(input.now);
  const menunggu = (acuan - Date.parse(input.arrivedAt)) / 60_000;
  if (!Number.isFinite(menunggu)) return { overdue: false, waitedMinutes: 0, lateMinutes: 0 };

  const batas = BATAS_TUNGGU_TRIASE[input.level];
  const telat = menunggu - batas;
  return {
    overdue: !input.seenAt && telat > 0,
    waitedMinutes: Math.max(0, Math.round(menunggu)),
    lateMinutes: Math.max(0, Math.round(telat)),
  };
}

/**
 * Mengurutkan antrean gawat darurat.
 *
 * Tingkat lebih dahulu, lalu yang paling lama menunggu. Bukan urutan
 * kedatangan: pasien tingkat 1 yang baru tiba mendahului pasien tingkat 4 yang
 * sudah menunggu dua jam, dan memang harus begitu.
 */
export function urutkanTriase<
  T extends { level: TingkatTriase; arrivedAt: string; seenAt?: string | null },
>(baris: T[]): T[] {
  return [...baris].sort((a, b) => {
    const belumA = a.seenAt ? 1 : 0;
    const belumB = b.seenAt ? 1 : 0;
    if (belumA !== belumB) return belumA - belumB;
    if (a.level !== b.level) return a.level - b.level;
    return Date.parse(a.arrivedAt) - Date.parse(b.arrivedAt);
  });
}

// --- Daftar periksa keselamatan bedah ----------------------------------------

export type TahapDaftarPeriksa = 'SIGN_IN' | 'TIME_OUT' | 'SIGN_OUT';

/** Butir yang wajib pada tiap tahap. Daftar tertutup, bukan teks bebas. */
export const BUTIR_DAFTAR_PERIKSA: Record<TahapDaftarPeriksa, string[]> = {
  // Sebelum pembiusan.
  SIGN_IN: [
    'IDENTITY_CONFIRMED',
    'SITE_MARKED',
    'CONSENT_SIGNED',
    'ALLERGY_CHECKED',
    'AIRWAY_RISK_ASSESSED',
    'BLOOD_LOSS_RISK_ASSESSED',
    'ANAESTHESIA_MACHINE_CHECKED',
    'PULSE_OXIMETER_ON',
  ],
  // Sebelum sayatan. Inilah penahan terakhir untuk operasi salah sisi dan salah
  // pasien, dan seluruhnya harus diucapkan keras-keras oleh tim.
  TIME_OUT: [
    'TEAM_INTRODUCED',
    'PATIENT_NAME_STATED',
    'PROCEDURE_STATED',
    'SITE_STATED',
    'ANTIBIOTIC_GIVEN',
    'IMAGING_DISPLAYED',
    'CRITICAL_STEPS_REVIEWED',
  ],
  // Sebelum pasien meninggalkan kamar operasi.
  SIGN_OUT: [
    'PROCEDURE_RECORDED',
    'COUNTS_CORRECT',
    'SPECIMEN_LABELLED',
    'EQUIPMENT_PROBLEMS_NOTED',
    'RECOVERY_CONCERNS_STATED',
  ],
};

/**
 * Kelengkapan satu tahap daftar periksa.
 *
 * Butir yang tidak dicentang dilaporkan namanya, bukan sekadar dihitung.
 * "Enam dari tujuh" tidak memberi tahu siapa pun butir mana yang terlewat.
 */
export function periksaDaftarPeriksa(
  tahap: TahapDaftarPeriksa,
  dicentang: string[],
): { complete: boolean; missing: string[] } {
  const wajib = BUTIR_DAFTAR_PERIKSA[tahap] ?? [];
  const ada = new Set(dicentang);
  const kurang = wajib.filter((b) => !ada.has(b));
  return { complete: kurang.length === 0, missing: kurang };
}

/**
 * Boleh atau tidaknya sayatan dimulai.
 *
 * Jeda sebelum sayatan harus **sudah selesai**, bukan sedang berjalan dan bukan
 * akan dilakukan. Ia satu-satunya penahan yang tersisa untuk operasi salah sisi
 * dan salah pasien, dan seluruh gunanya hilang bila ia dapat dicentang setelah
 * pisau menyentuh kulit.
 */
export function bolehMulaiSayatan(input: {
  signInCompletedAt: string | null;
  timeOutCompletedAt: string | null;
  timeOutItems: string[];
  /** Sisi yang ditandai pada tubuh pasien. */
  markedSite: string | null;
  /** Sisi yang tertulis pada persetujuan tindakan. */
  consentSite: string | null;
  /** Prosedur yang memang punya sisi kiri dan kanan. */
  requiresSiteMarking: boolean;
}): { allowed: boolean; reason?: string; message?: string } {
  if (!input.signInCompletedAt) {
    return {
      allowed: false,
      reason: 'SIGN_IN_INCOMPLETE',
      message: 'Tahap sebelum pembiusan belum diselesaikan.',
    };
  }

  if (!input.timeOutCompletedAt) {
    return {
      allowed: false,
      reason: 'TIME_OUT_NOT_DONE',
      message:
        'Jeda sebelum sayatan belum dilakukan. Ia satu-satunya penahan yang tersisa untuk ' +
        'operasi salah sisi dan salah pasien.',
    };
  }

  const kelengkapan = periksaDaftarPeriksa('TIME_OUT', input.timeOutItems);
  if (!kelengkapan.complete) {
    return {
      allowed: false,
      reason: 'TIME_OUT_INCOMPLETE',
      message: `Jeda sebelum sayatan belum lengkap: ${kelengkapan.missing.join(', ')}.`,
    };
  }

  if (input.requiresSiteMarking) {
    if (!input.markedSite) {
      return {
        allowed: false,
        reason: 'SITE_NOT_MARKED',
        message: 'Sisi operasi belum ditandai pada tubuh pasien.',
      };
    }
    /*
     * Penandaan pada tubuh dibandingkan dengan persetujuan tindakan. Bila
     * keduanya berbeda, salah satunya keliru — dan tidak ada seorang pun di
     * kamar operasi yang dapat memastikan yang mana tanpa bertanya kepada
     * pasien, yang sudah terbius.
     */
    if (
      input.consentSite &&
      input.markedSite.trim().toUpperCase() !== input.consentSite.trim().toUpperCase()
    ) {
      return {
        allowed: false,
        reason: 'SITE_MISMATCH',
        message:
          `Sisi yang ditandai (${input.markedSite}) berbeda dari sisi pada persetujuan ` +
          `tindakan (${input.consentSite}). HENTIKAN dan pastikan lebih dahulu.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Hitungan kasa, jarum, dan instrumen.
 *
 * Yang masuk harus sama dengan yang keluar. Selisihnya berarti ada benda yang
 * masih di dalam tubuh, dan benda yang tertinggal baru ditemukan berbulan-bulan
 * kemudian lewat pembedahan kedua.
 */
export function periksaHitungan(
  hitungan: Array<{ itemType: string; countedIn: number; countedOut: number }>,
): { correct: boolean; discrepancies: Array<{ itemType: string; difference: number }> } {
  const selisih = hitungan
    .map((h) => ({ itemType: h.itemType, difference: h.countedIn - h.countedOut }))
    .filter((h) => h.difference !== 0);
  return { correct: selisih.length === 0, discrepancies: selisih };
}

/**
 * Boleh atau tidaknya pasien meninggalkan kamar operasi.
 *
 * Hitungan yang tidak cocok menahan — kecuali bila ada pernyataan tertulis
 * bahwa pencarian sudah dilakukan (biasanya lewat foto sinar-X). Menahannya
 * tanpa jalan keluar sama sekali akan membuat orang mematikan sistemnya, dan
 * sistem yang dimatikan tidak menahan apa pun.
 */
export function bolehKeluarKamarOperasi(input: {
  signOutItems: string[];
  counts: Array<{ itemType: string; countedIn: number; countedOut: number }>;
  /** Keterangan pencarian bila hitungannya tidak cocok. */
  discrepancyResolution: string | null;
}): { allowed: boolean; reason?: string; message?: string; discrepancies?: string[] } {
  const hitungan = periksaHitungan(input.counts);

  if (!hitungan.correct) {
    const rincian = hitungan.discrepancies.map(
      (d) => `${d.itemType} kurang ${d.difference}`,
    );
    if ((input.discrepancyResolution ?? '').trim().length < 10) {
      return {
        allowed: false,
        reason: 'COUNT_MISMATCH',
        message:
          `Hitungan tidak cocok: ${rincian.join('; ')}. Lakukan pencarian dan tuliskan ` +
          'hasilnya sebelum pasien meninggalkan kamar operasi.',
        discrepancies: rincian,
      };
    }
  }

  const kelengkapan = periksaDaftarPeriksa('SIGN_OUT', input.signOutItems);
  if (!kelengkapan.complete) {
    return {
      allowed: false,
      reason: 'SIGN_OUT_INCOMPLETE',
      message: `Tahap sebelum keluar belum lengkap: ${kelengkapan.missing.join(', ')}.`,
    };
  }

  return { allowed: true };
}

// --- Penjadwalan kamar operasi -----------------------------------------------

export interface SlotOperasi {
  theatreId: string;
  startAt: string;
  endAt: string;
  status?: string;
}

/**
 * Apakah dua jadwal operasi bertumpang tindih pada kamar yang sama.
 *
 * Jadwal yang bertumpang tindih bukan sekadar kekacauan administrasi: tim yang
 * datang menemukan kamarnya terpakai akan menunda pasien yang sudah berpuasa
 * sejak tengah malam.
 */
export function bertumpangTindih(a: SlotOperasi, b: SlotOperasi): boolean {
  if (a.theatreId !== b.theatreId) return false;
  const a1 = Date.parse(a.startAt);
  const a2 = Date.parse(a.endAt);
  const b1 = Date.parse(b.startAt);
  const b2 = Date.parse(b.endAt);
  if (![a1, a2, b1, b2].every(Number.isFinite)) return false;
  // Bersentuhan ujung ke ujung bukan tumpang tindih: operasi berikutnya boleh
  // dimulai tepat saat yang sebelumnya berakhir.
  return a1 < b2 && b1 < a2;
}

export function bolehJadwalkan(
  baru: SlotOperasi,
  terjadwal: SlotOperasi[],
): { allowed: boolean; message?: string; conflictWith?: SlotOperasi } {
  if (Date.parse(baru.endAt) <= Date.parse(baru.startAt)) {
    return { allowed: false, message: 'Waktu selesai harus sesudah waktu mulai.' };
  }
  const bentrok = terjadwal.find(
    (s) => s.status !== 'CANCELLED' && bertumpangTindih(baru, s),
  );
  if (bentrok) {
    return {
      allowed: false,
      message: `Kamar operasi sudah terpakai pada rentang waktu itu.`,
      conflictWith: bentrok,
    };
  }
  return { allowed: true };
}

// --- Perawatan intensif ------------------------------------------------------

/**
 * Skor keparahan sederhana untuk perawatan intensif.
 *
 * Bukan APACHE maupun SOFA — keduanya menuntut data laboratorium yang tidak
 * selalu ada di rumah sakit kecil, dan skor yang tidak dapat dihitung adalah
 * skor yang tidak dipakai. Yang di sini memakai tanda vital dan dukungan organ,
 * yang selalu diketahui.
 */
export function skorIntensif(input: {
  vitals: TandaVitalTriase;
  onVasopressor?: boolean;
  onVentilator?: boolean;
  onDialysis?: boolean;
}): { score: number; organSupport: number; risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' } {
  let skor = 0;
  const v = input.vitals;

  if (v.consciousness === 'UNRESPONSIVE') skor += 4;
  else if (v.consciousness === 'PAIN') skor += 3;
  else if (v.consciousness === 'VOICE') skor += 2;

  if (v.spo2 != null && v.spo2 < 90) skor += 3;
  else if (v.spo2 != null && v.spo2 < 94) skor += 1;

  if (v.systolicBp != null && v.systolicBp < 90) skor += 3;
  else if (v.systolicBp != null && v.systolicBp < 100) skor += 1;

  if (v.respiratoryRate != null && (v.respiratoryRate < 8 || v.respiratoryRate > 30)) skor += 3;
  if (v.heartRate != null && (v.heartRate < 40 || v.heartRate > 130)) skor += 3;

  const dukungan =
    (input.onVasopressor ? 1 : 0) + (input.onVentilator ? 1 : 0) + (input.onDialysis ? 1 : 0);
  skor += dukungan * 3;

  /*
   * Dukungan organ ganda langsung dinyatakan kritis apa pun skornya. Pasien
   * dengan ventilator dan vasopresor sekaligus adalah pasien yang tanda
   * vitalnya tampak baik JUSTRU KARENA mesin yang menahannya — dan skor yang
   * membaca tanda vital saja akan menyimpulkan ia sedang membaik.
   */
  const risiko =
    dukungan >= 2 || skor >= 12
      ? 'CRITICAL'
      : skor >= 8
        ? 'HIGH'
        : skor >= 4
          ? 'MEDIUM'
          : 'LOW';

  return { score: skor, organSupport: dukungan, risk: risiko };
}

// --- Disposisi gawat darurat -------------------------------------------------

export type Disposisi =
  | 'DISCHARGED'
  | 'ADMITTED'
  | 'TRANSFERRED'
  | 'OBSERVATION'
  | 'LEFT_WITHOUT_BEING_SEEN'
  | 'DIED_IN_ED'
  | 'DOA';

/**
 * Boleh atau tidaknya pasien gawat darurat dipulangkan dari IGD.
 *
 * Pasien yang belum pernah dilihat dokter tidak dapat "dipulangkan" — ia pergi
 * tanpa dilihat, dan itu keadaan yang sama sekali berbeda. Menyamakannya akan
 * menyembunyikan angka yang paling penting bagi mutu IGD: berapa banyak orang
 * yang menyerah menunggu.
 */
export function bolehDisposisi(input: {
  disposition: Disposisi;
  seenByDoctorAt: string | null;
  triageLevel: TingkatTriase;
  reason?: string | null;
}): { allowed: boolean; message?: string } {
  if (input.disposition === 'LEFT_WITHOUT_BEING_SEEN') {
    if (input.seenByDoctorAt) {
      return {
        allowed: false,
        message:
          'Pasien ini sudah dilihat dokter, sehingga kepergiannya bukan "pergi tanpa dilihat". ' +
          'Pakai disposisi yang sesuai.',
      };
    }
    return { allowed: true };
  }

  if (input.disposition === 'DOA') return { allowed: true };

  if (!input.seenByDoctorAt) {
    return {
      allowed: false,
      message: 'Pasien belum dilihat dokter; disposisi tidak dapat ditetapkan.',
    };
  }

  /*
   * Pasien tingkat 1 dan 2 yang dipulangkan langsung menuntut alasan. Bukan
   * karena mustahil — kejang yang berhenti sendiri memang boleh pulang —
   * melainkan karena inilah pola yang paling sering mendahului pasien kembali
   * dalam keadaan lebih buruk.
   */
  if (input.disposition === 'DISCHARGED' && input.triageLevel <= 2) {
    if ((input.reason ?? '').trim().length < 10) {
      return {
        allowed: false,
        message:
          `Pasien triase tingkat ${input.triageLevel} yang dipulangkan langsung menuntut ` +
          'keterangan. Inilah pola yang paling sering mendahului pasien kembali dalam keadaan ' +
          'lebih buruk.',
      };
    }
  }

  return { allowed: true };
}
