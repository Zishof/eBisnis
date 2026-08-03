/**
 * Aturan siklus hidup klaim internal.
 *
 * Fungsi murni, tanpa basis data.
 *
 * **Sembilan dari lima belas tahap** siklus klaim dapat berjalan tanpa
 * kredensial siapa pun, dan sembilan itulah yang paling banyak menghabiskan
 * waktu petugas rumah sakit. Penghalang kredensial menahan ujung-ujungnya,
 * bukan tengahnya.
 *
 * Empat hal menentukan bentuk seluruh berkas ini.
 *
 * 1. **Tiga angka yang tidak boleh disamakan:** diajukan, disetujui, dibayar.
 *    Menyamakan yang pertama dengan yang ketiga adalah cara paling langsung
 *    membuat rumah sakit mengira dirinya punya uang yang tidak ada — lalu
 *    membagikannya sebagai jasa medis.
 *
 * 2. **Verifikasi internal menemukan kekurangan sebelum penjamin
 *    menemukannya.** Bagian yang paling sepele secara teknis dan paling
 *    berharga secara nyata: klaim yang dikembalikan karena berkasnya kurang
 *    menghabiskan waktu berminggu-minggu, sedangkan seluruh kekurangannya dapat
 *    diperiksa mesin dalam hitungan detik.
 *
 * 3. **Sebab penolakan adalah KODE TERTUTUP, bukan teks bebas.** Laporan yang
 *    tidak dapat menghitung sebab penolakan tidak dapat memperbaikinya.
 *
 * 4. **Penanda anti-fraud tidak pernah menghentikan pengajuan.** Ia membuat
 *    klaimnya masuk antrean telaah manusia. Penghentian otomatis pada penanda
 *    statistik akan menahan klaim yang sah dari pasien yang memang sakit berat —
 *    dan rumah sakit yang klaimnya tertahan akan berhenti memakai penandanya.
 */

// --- Status ------------------------------------------------------------------

export type StatusKlaim =
  | 'DRAFT'
  | 'CODED'
  | 'INTERNALLY_VERIFIED'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTED'
  | 'PENDING'
  | 'DISPUTED'
  | 'APPROVED'
  | 'PARTIALLY_APPROVED'
  | 'REJECTED'
  | 'PAID'
  | 'RECONCILED'
  | 'CANCELLED';

const URUTAN: Record<StatusKlaim, StatusKlaim[]> = {
  DRAFT: ['CODED', 'CANCELLED'],
  CODED: ['DRAFT', 'INTERNALLY_VERIFIED', 'CANCELLED'],
  INTERNALLY_VERIFIED: ['CODED', 'READY_TO_SUBMIT', 'CANCELLED'],
  READY_TO_SUBMIT: ['SUBMITTED', 'INTERNALLY_VERIFIED', 'CANCELLED'],
  SUBMITTED: ['PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'],
  PENDING: ['DISPUTED', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'],
  DISPUTED: ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'],
  APPROVED: ['PAID'],
  PARTIALLY_APPROVED: ['PAID', 'DISPUTED'],
  REJECTED: ['DISPUTED', 'DRAFT'],
  PAID: ['RECONCILED'],
  RECONCILED: [],
  CANCELLED: [],
};

/**
 * Perpindahan status klaim.
 *
 * Yang sudah **diajukan** tidak dapat dibatalkan dari pihak kami — pembatalan
 * setelah pengajuan adalah urusan penjamin, dan mencatatnya sebagai batal
 * sepihak akan membuat catatan kami berselisih dengan catatan mereka pada
 * rekonsiliasi berikutnya.
 */
export function bolehPindahStatusKlaim(input: {
  from: StatusKlaim;
  to: StatusKlaim;
}): { allowed: boolean; message?: string } {
  const berikut = URUTAN[input.from];
  if (!berikut) return { allowed: false, message: `Status ${input.from} tidak dikenal.` };
  if (!berikut.includes(input.to)) {
    const sudahDiajukan = ['SUBMITTED', 'PENDING', 'DISPUTED', 'APPROVED', 'PARTIALLY_APPROVED'];
    return {
      allowed: false,
      message:
        `Klaim berstatus ${input.from} tidak dapat berpindah ke ${input.to}. ` +
        (input.to === 'CANCELLED' && sudahDiajukan.includes(input.from)
          ? 'Klaim yang sudah diajukan tidak dibatalkan sepihak; pembatalannya urusan penjamin, ' +
            'dan mencatatnya sebagai batal akan membuat catatan kami berselisih dengan catatan ' +
            'mereka pada rekonsiliasi berikutnya.'
          : `Yang mungkin dari sini: ${berikut.join(', ') || 'tidak ada'}.`),
    };
  }
  return { allowed: true };
}

// --- Verifikasi internal -----------------------------------------------------

export type JenisTemuan =
  | 'MISSING_PRINCIPAL_DIAGNOSIS'
  | 'MULTIPLE_PRINCIPAL_DIAGNOSIS'
  | 'INVALID_DIAGNOSIS_CODE'
  | 'UNCODED_PROCEDURE'
  | 'UNSIGNED_DISCHARGE_SUMMARY'
  | 'MISSING_SUPPORTING_RESULT'
  | 'SEP_MISMATCH'
  | 'IMPLAUSIBLE_DATES'
  | 'CLASS_EXCEEDS_ENTITLEMENT'
  | 'MISSING_ATTENDING_SIGNATURE';

export interface Temuan {
  type: JenisTemuan;
  message: string;
  /** Menahan pengajuan. Yang tidak menahan tetap dilaporkan. */
  blocksSubmission: boolean;
  responsibleRole: string;
}

export interface BerkasKlaim {
  principalDiagnosisCount: number;
  invalidCodeCount: number;
  procedureCount: number;
  codedProcedureCount: number;
  hasDischargeSummary: boolean;
  dischargeSummarySigned: boolean;
  referencedResultCount: number;
  availableResultCount: number;
  sepNumber?: string | null;
  sepEncounterMatches: boolean;
  admittedAt?: string | null;
  dischargedAt?: string | null;
  billedClass?: string | null;
  entitledClass?: string | null;
  hasAttendingSignature: boolean;
  isInpatient: boolean;
}

const PERINGKAT_KELAS: Record<string, number> = {
  CLASS_3: 1,
  CLASS_2: 2,
  CLASS_1: 3,
  KRIS: 2,
  VIP: 4,
  VVIP: 5,
};

/**
 * Memeriksa satu berkas klaim sebelum diajukan.
 *
 * Setiap kekurangan dilaporkan **namanya**, bukan "berkas tidak lengkap".
 * Petugas yang membaca "berkas tidak lengkap" akan memeriksa seluruhnya satu
 * per satu — dan pemeriksaan satu per satu itulah yang hendak digantikan mesin.
 */
export function verifikasiInternal(berkas: BerkasKlaim): {
  clean: boolean;
  findings: Temuan[];
  blockingCount: number;
} {
  const temuan: Temuan[] = [];

  if (berkas.principalDiagnosisCount === 0) {
    temuan.push({
      type: 'MISSING_PRINCIPAL_DIAGNOSIS',
      message: 'Diagnosis utama belum ditetapkan.',
      blocksSubmission: true,
      responsibleRole: 'HEALTH_DOCTOR',
    });
  } else if (berkas.principalDiagnosisCount > 1) {
    temuan.push({
      type: 'MULTIPLE_PRINCIPAL_DIAGNOSIS',
      message:
        `Ada ${berkas.principalDiagnosisCount} diagnosis utama; hanya boleh satu. ` +
        'Pengelompokan casemix akan memilih salah satunya menurut urutan baris.',
      blocksSubmission: true,
      responsibleRole: 'HEALTH_CODER',
    });
  }

  if (berkas.invalidCodeCount > 0) {
    temuan.push({
      type: 'INVALID_DIAGNOSIS_CODE',
      message:
        `${berkas.invalidCodeCount} kode tidak sah pada versi terminologi yang berlaku pada ` +
        'tanggal layanannya.',
      blocksSubmission: true,
      responsibleRole: 'HEALTH_CODER',
    });
  }

  if (berkas.procedureCount > berkas.codedProcedureCount) {
    temuan.push({
      type: 'UNCODED_PROCEDURE',
      message: `${berkas.procedureCount - berkas.codedProcedureCount} tindakan belum berkode.`,
      blocksSubmission: true,
      responsibleRole: 'HEALTH_CODER',
    });
  }

  if (berkas.isInpatient && (!berkas.hasDischargeSummary || !berkas.dischargeSummarySigned)) {
    temuan.push({
      type: 'UNSIGNED_DISCHARGE_SUMMARY',
      message: berkas.hasDischargeSummary
        ? 'Resume pulang belum ditandatangani.'
        : 'Resume pulang belum ditulis.',
      blocksSubmission: true,
      responsibleRole: 'HEALTH_DOCTOR',
    });
  }

  /*
   * Hasil penunjang yang DIRUJUK resume tetapi tidak ada berkasnya. Yang
   * pertama menemukannya biasanya verifikator penjamin, dan ketika ia
   * menemukannya seluruh klaim dikembalikan — bukan satu barisnya.
   */
  if (berkas.referencedResultCount > berkas.availableResultCount) {
    temuan.push({
      type: 'MISSING_SUPPORTING_RESULT',
      message:
        `${berkas.referencedResultCount - berkas.availableResultCount} hasil penunjang yang ` +
        'dirujuk resume tidak ditemukan berkasnya.',
      blocksSubmission: true,
      responsibleRole: 'HEALTH_MEDICAL_RECORD_OFFICER',
    });
  }

  if (berkas.sepNumber && !berkas.sepEncounterMatches) {
    temuan.push({
      type: 'SEP_MISMATCH',
      message: 'Nomor SEP tidak sesuai dengan kunjungan yang diklaimkan.',
      blocksSubmission: true,
      responsibleRole: 'HEALTH_REGISTRATION_CLERK',
    });
  }

  if (berkas.admittedAt && berkas.dischargedAt) {
    const masuk = Date.parse(berkas.admittedAt);
    const pulang = Date.parse(berkas.dischargedAt);
    if (Number.isFinite(masuk) && Number.isFinite(pulang) && pulang < masuk) {
      temuan.push({
        type: 'IMPLAUSIBLE_DATES',
        message: 'Tanggal pulang mendahului tanggal masuk.',
        blocksSubmission: true,
        responsibleRole: 'HEALTH_WARD_CLERK',
      });
    }
  }

  /*
   * Kelas yang ditagih melebihi hak peserta. TIDAK menahan pengajuan: naik
   * kelas atas permintaan pasien adalah hal yang sah, dan selisihnya ditagihkan
   * kepada pasien. Yang berbahaya adalah menagihkannya kepada penjamin tanpa
   * ada yang menyadarinya — karena itu ia dilaporkan.
   */
  if (berkas.billedClass && berkas.entitledClass) {
    const ditagih = PERINGKAT_KELAS[berkas.billedClass] ?? 0;
    const berhak = PERINGKAT_KELAS[berkas.entitledClass] ?? 0;
    if (ditagih > berhak) {
      temuan.push({
        type: 'CLASS_EXCEEDS_ENTITLEMENT',
        message:
          `Kelas yang ditagih ${berkas.billedClass} melebihi hak peserta ` +
          `${berkas.entitledClass}. Naik kelas atas permintaan pasien sah, tetapi selisihnya ` +
          'ditagihkan kepada pasien — bukan kepada penjamin.',
        blocksSubmission: false,
        responsibleRole: 'HEALTH_REGISTRATION_CLERK',
      });
    }
  }

  if (!berkas.hasAttendingSignature) {
    temuan.push({
      type: 'MISSING_ATTENDING_SIGNATURE',
      message: 'Tanda tangan dokter penanggung jawab belum ada.',
      blocksSubmission: true,
      responsibleRole: 'HEALTH_DOCTOR',
    });
  }

  return {
    clean: temuan.length === 0,
    findings: temuan,
    blockingCount: temuan.filter((t) => t.blocksSubmission).length,
  };
}

/**
 * Boleh atau tidaknya klaim dinyatakan siap diajukan.
 *
 * Temuan yang tidak menahan tetap dilaporkan — tetapi ia tidak menghentikan
 * pengajuan. Menahan seluruhnya akan membuat verifikasi internal dimatikan oleh
 * orang pertama yang klaimnya tertahan karena hal yang memang sah.
 */
export function bolehAjukan(input: {
  verifikasi: { blockingCount: number; findings: Temuan[] };
  status: StatusKlaim;
}): { allowed: boolean; message?: string; blockers?: string[] } {
  if (input.status !== 'INTERNALLY_VERIFIED') {
    return {
      allowed: false,
      message:
        `Pengajuan menuntut klaim berstatus INTERNALLY_VERIFIED, saat ini ${input.status}. ` +
        'Verifikasi internal menemukan kekurangan sebelum penjamin menemukannya — dan yang ' +
        'ditemukan penjamin memakan waktu berminggu-minggu.',
    };
  }

  if (input.verifikasi.blockingCount > 0) {
    const penahan = input.verifikasi.findings
      .filter((t) => t.blocksSubmission)
      .map((t) => t.message);
    return {
      allowed: false,
      blockers: penahan,
      message: `Klaim belum dapat diajukan: ${penahan.join(' ')}`,
    };
  }

  return { allowed: true };
}

// --- Tiga angka --------------------------------------------------------------

export type SebabPenolakan =
  | 'CODING_ERROR'
  | 'DOCUMENTATION_INCOMPLETE'
  | 'MEDICAL_NECESSITY'
  | 'DUPLICATE_CLAIM'
  | 'ELIGIBILITY_ISSUE'
  | 'TARIFF_MISMATCH'
  | 'SERVICE_NOT_COVERED'
  | 'ADMINISTRATIVE'
  | 'OTHER';

export const SEBAB_PENOLAKAN: SebabPenolakan[] = [
  'CODING_ERROR',
  'DOCUMENTATION_INCOMPLETE',
  'MEDICAL_NECESSITY',
  'DUPLICATE_CLAIM',
  'ELIGIBILITY_ISSUE',
  'TARIFF_MISMATCH',
  'SERVICE_NOT_COVERED',
  'ADMINISTRATIVE',
  'OTHER',
];

/**
 * Membandingkan tiga angka klaim.
 *
 * Ketiganya disimpan terpisah dan tidak pernah disamakan. Selisih antara
 * diajukan dan disetujui **wajib bersebab**, dan sebabnya kode tertutup —
 * laporan yang tidak dapat menghitung sebab penolakan tidak dapat
 * memperbaikinya.
 */
export function bandingkanTigaAngka(input: {
  submittedAmount: number;
  approvedAmount?: number | null;
  paidAmount?: number | null;
  rejectionReason?: SebabPenolakan | null;
}): {
  approvalGap: number | null;
  paymentGap: number | null;
  needsReason: boolean;
  needsReview: boolean;
  message: string;
} {
  if (input.submittedAmount < 0) throw new Error('Nilai klaim tidak boleh negatif.');

  const disetujui = input.approvedAmount ?? null;
  const dibayar = input.paidAmount ?? null;

  if (disetujui === null) {
    return {
      approvalGap: null,
      paymentGap: null,
      needsReason: false,
      needsReview: false,
      message: 'Belum ada keputusan penjamin; selisihnya belum dapat dihitung.',
    };
  }

  if (disetujui < 0 || (dibayar !== null && dibayar < 0)) {
    throw new Error('Nilai klaim tidak boleh negatif.');
  }

  const selisihSetuju = input.submittedAmount - disetujui;
  const selisihBayar = dibayar === null ? null : disetujui - dibayar;

  const perluSebab = selisihSetuju > 0 && !input.rejectionReason;

  /*
   * Disetujui LEBIH BESAR daripada diajukan menuntut telaah, bukan kegembiraan.
   * Ia hampir selalu berarti pengajuannya keliru — dan kekeliruan yang
   * menguntungkan adalah kekeliruan yang paling jarang dilaporkan.
   */
  const perluTelaah = selisihSetuju < 0 || (selisihBayar !== null && selisihBayar < 0);

  const bagian: string[] = [];
  if (selisihSetuju > 0) {
    bagian.push(
      `Disetujui ${selisihSetuju} lebih kecil daripada diajukan` +
        (input.rejectionReason ? ` (${input.rejectionReason}).` : ', dan sebabnya belum dicatat.'),
    );
  } else if (selisihSetuju < 0) {
    bagian.push(
      `Disetujui ${Math.abs(selisihSetuju)} LEBIH BESAR daripada diajukan; ini hampir selalu ` +
        'berarti pengajuannya keliru, dan kekeliruan yang menguntungkan adalah kekeliruan yang ' +
        'paling jarang dilaporkan.',
    );
  }
  if (selisihBayar !== null && selisihBayar > 0) {
    bagian.push(`Dibayar ${selisihBayar} lebih kecil daripada disetujui.`);
  } else if (selisihBayar !== null && selisihBayar < 0) {
    bagian.push(`Dibayar ${Math.abs(selisihBayar)} LEBIH BESAR daripada disetujui; periksa.`);
  }

  return {
    approvalGap: selisihSetuju,
    paymentGap: selisihBayar,
    needsReason: perluSebab,
    needsReview: perluTelaah,
    message: bagian.length ? bagian.join(' ') : 'Disetujui dan dibayar penuh.',
  };
}

/**
 * Boleh atau tidaknya keputusan penjamin dicatat.
 *
 * Selisih yang merugikan **wajib bersebab**. Tanpa sebabnya, laporan penolakan
 * tidak dapat dihitung — dan yang tidak dapat dihitung tidak dapat diperbaiki.
 */
export function bolehCatatKeputusan(input: {
  submittedAmount: number;
  approvedAmount: number;
  rejectionReason?: SebabPenolakan | null;
  reasonNote?: string | null;
}): { allowed: boolean; message?: string } {
  if (input.approvedAmount < 0) {
    return { allowed: false, message: 'Nilai yang disetujui tidak boleh negatif.' };
  }

  if (input.approvedAmount < input.submittedAmount && !input.rejectionReason) {
    return {
      allowed: false,
      message:
        'Selisih antara yang diajukan dan yang disetujui wajib bersebab, dan sebabnya kode ' +
        `tertutup: ${SEBAB_PENOLAKAN.join(', ')}. Teks bebas tidak dapat dihitung, dan laporan ` +
        'yang tidak dapat menghitung sebab penolakan tidak dapat memperbaikinya.',
    };
  }

  if (input.rejectionReason === 'OTHER' && !input.reasonNote?.trim()) {
    return {
      allowed: false,
      message:
        'Sebab OTHER wajib disertai keterangan. Tanpa itu, ia menjadi tempat pembuangan yang ' +
        'menampung separuh penolakan dan tidak menjelaskan satu pun.',
    };
  }

  return { allowed: true };
}

// --- Rekonsiliasi ------------------------------------------------------------

/**
 * Rekonsiliasi tiga sisi: catatan kami, catatan penjamin, dan mutasi rekening.
 *
 * Selisih yang tidak terjelaskan **tidak boleh ditutup**. Rekonsiliasi yang
 * dapat ditutup dengan selisih akan selalu ditutup dengan selisih.
 */
export function rekonsiliasi(input: {
  ourPaidAmount: number;
  payerStatedAmount: number;
  bankCreditedAmount: number;
  tolerance?: number;
  explanation?: string | null;
}): {
  balanced: boolean;
  payerGap: number;
  bankGap: number;
  canClose: boolean;
  message: string;
} {
  const toleransi = input.tolerance ?? 0;
  const selisihPenjamin = input.ourPaidAmount - input.payerStatedAmount;
  const selisihBank = input.payerStatedAmount - input.bankCreditedAmount;

  const seimbang =
    Math.abs(selisihPenjamin) <= toleransi && Math.abs(selisihBank) <= toleransi;

  if (seimbang) {
    return {
      balanced: true,
      payerGap: selisihPenjamin,
      bankGap: selisihBank,
      canClose: true,
      message: 'Ketiga sisi cocok.',
    };
  }

  const berkilah = Boolean(input.explanation?.trim());
  const bagian: string[] = [];
  if (Math.abs(selisihPenjamin) > toleransi) {
    bagian.push(`Catatan kami dan catatan penjamin berselisih ${selisihPenjamin}.`);
  }
  if (Math.abs(selisihBank) > toleransi) {
    bagian.push(`Catatan penjamin dan mutasi rekening berselisih ${selisihBank}.`);
  }

  return {
    balanced: false,
    payerGap: selisihPenjamin,
    bankGap: selisihBank,
    canClose: berkilah,
    message:
      `${bagian.join(' ')} ` +
      (berkilah
        ? 'Ditutup dengan penjelasan yang tercatat.'
        : 'Selisih yang tidak terjelaskan tidak boleh ditutup — rekonsiliasi yang dapat ' +
          'ditutup dengan selisih akan selalu ditutup dengan selisih.'),
  };
}

// --- Penanda anti-fraud ------------------------------------------------------

export type JenisPenanda =
  | 'DUPLICATE_MEMBER_DATE'
  | 'LENGTH_OF_STAY_OUTLIER'
  | 'UNUSUAL_PROCEDURE_FOR_DIAGNOSIS'
  | 'CODER_PATTERN_OUTLIER'
  | 'RAPID_READMISSION';

export interface Penanda {
  type: JenisPenanda;
  message: string;
  /** Selalu false. Penanda tidak pernah menghentikan pengajuan. */
  blocksSubmission: false;
}

/**
 * Menandai klaim untuk ditelaah manusia.
 *
 * **Penanda tidak pernah menghentikan pengajuan.** Ia membuat klaimnya masuk
 * antrean telaah. Penghentian otomatis pada penanda statistik akan menahan
 * klaim yang sah dari pasien yang memang sakit berat — dan rumah sakit yang
 * klaimnya tertahan akan berhenti memakai penandanya.
 *
 * Bukan tuduhan. Kata "fraud" sengaja tidak muncul pada pesannya: penanda yang
 * berbunyi seperti tuduhan akan dibantah alih-alih ditelaah.
 */
export function tandaiUntukTelaah(input: {
  duplicateOnSameMemberAndDate: boolean;
  lengthOfStayDays?: number | null;
  typicalLengthOfStayDays?: number | null;
  procedureUnusualForDiagnosis: boolean;
  coderDeviationScore?: number | null;
  daysSincePreviousDischarge?: number | null;
}): { flags: Penanda[]; needsReview: boolean; message: string } {
  const penanda: Penanda[] = [];

  if (input.duplicateOnSameMemberAndDate) {
    penanda.push({
      type: 'DUPLICATE_MEMBER_DATE',
      message: 'Ada klaim lain pada kepesertaan dan tanggal yang sama.',
      blocksSubmission: false,
    });
  }

  if (
    input.lengthOfStayDays != null &&
    input.typicalLengthOfStayDays != null &&
    input.typicalLengthOfStayDays > 0 &&
    input.lengthOfStayDays > input.typicalLengthOfStayDays * 3
  ) {
    penanda.push({
      type: 'LENGTH_OF_STAY_OUTLIER',
      message:
        `Lama rawat ${input.lengthOfStayDays} hari, jauh di atas kebiasaan diagnosisnya ` +
        `(${input.typicalLengthOfStayDays} hari). Dapat benar; perlu dilihat.`,
      blocksSubmission: false,
    });
  }

  if (input.procedureUnusualForDiagnosis) {
    penanda.push({
      type: 'UNUSUAL_PROCEDURE_FOR_DIAGNOSIS',
      message: 'Ada tindakan yang tidak lazim bagi diagnosisnya.',
      blocksSubmission: false,
    });
  }

  if (input.coderDeviationScore != null && input.coderDeviationScore > 3) {
    penanda.push({
      type: 'CODER_PATTERN_OUTLIER',
      message:
        'Pola pengkodean koder ini menyimpang jauh dari koder lain pada diagnosis serupa.',
      blocksSubmission: false,
    });
  }

  if (input.daysSincePreviousDischarge != null && input.daysSincePreviousDischarge <= 3) {
    penanda.push({
      type: 'RAPID_READMISSION',
      message:
        `Pasien masuk kembali ${input.daysSincePreviousDischarge} hari setelah dipulangkan.`,
      blocksSubmission: false,
    });
  }

  return {
    flags: penanda,
    needsReview: penanda.length > 0,
    message: penanda.length
      ? `${penanda.length} hal perlu dilihat manusia sebelum diajukan. Ini BUKAN tuduhan dan ` +
        'tidak menghentikan pengajuan — ia hanya memasukkan klaim ini ke antrean telaah.'
      : 'Tidak ada yang perlu ditelaah khusus.',
  };
}
