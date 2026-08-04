/**
 * Aturan rekam medis, pengkodean, mutu, dan keselamatan pasien.
 *
 * Fungsi murni, tanpa basis data.
 *
 * Tiga hal menentukan bentuk seluruh berkas ini.
 *
 * 1. **Kekurangan berkas dilaporkan NAMANYA, bukan jumlahnya.** "Kelengkapan
 *    82%" tidak memberi tahu siapa pun apa yang harus dikerjakan. Dokter yang
 *    membaca "resume medis belum ditandatangani" akan menandatanganinya; dokter
 *    yang membaca "82%" akan menutup layarnya.
 *
 * 2. **Kode yang sudah dicabut tetap terbaca, tetapi tidak dapat dipilih.**
 *    Rekam medis lama dikode dengan terminologi yang berlaku saat itu.
 *    Menyembunyikannya membuat rekam lama tidak terbaca; mengizinkannya dipilih
 *    membuat klaim baru ditolak.
 *
 * 3. **Penahanan hukum menahan perubahan, bukan hanya penghapusan.** Rekam medis
 *    yang sedang diperkarakan lalu "diperbaiki" adalah bukti yang rusak — dan
 *    perbaikan yang niatnya baik pun akan terbaca sebagai penghilangan bukti.
 */

// --- Kelengkapan rekam medis -------------------------------------------------

export type JenisKekurangan =
  | 'MISSING_PRINCIPAL_DIAGNOSIS'
  | 'MULTIPLE_PRINCIPAL_DIAGNOSIS'
  | 'UNSIGNED_NOTE'
  | 'MISSING_DISCHARGE_SUMMARY'
  | 'UNSIGNED_DISCHARGE_SUMMARY'
  | 'MISSING_PROCEDURE_CODE'
  | 'MISSING_DIAGNOSIS_CODE'
  | 'MISSING_CONSENT'
  | 'MISSING_OPERATIVE_NOTE'
  | 'MISSING_ANAESTHESIA_RECORD'
  | 'UNACKNOWLEDGED_CRITICAL_RESULT'
  | 'MISSING_ATTENDING_PROVIDER';

export interface Kekurangan {
  type: JenisKekurangan;
  message: string;
  /** Peran yang dapat memperbaikinya. Kekurangan tanpa pemilik tidak akan diperbaiki. */
  responsibleRole: string;
  /** Menahan pengkodean dan pengajuan klaim. */
  blocksCoding: boolean;
}

export interface BerkasRekamMedis {
  encounterType: 'OUTPATIENT' | 'INPATIENT' | 'EMERGENCY' | 'SURGERY';
  hasPrincipalDiagnosis: boolean;
  principalDiagnosisCount: number;
  diagnosisCount: number;
  codedDiagnosisCount: number;
  procedureCount: number;
  codedProcedureCount: number;
  unsignedNoteCount: number;
  hasDischargeSummary: boolean;
  dischargeSummarySigned: boolean;
  hasConsent: boolean;
  hasOperativeNote: boolean;
  hasAnaesthesiaRecord: boolean;
  unacknowledgedCriticalCount: number;
  hasAttendingProvider: boolean;
}

/**
 * Memeriksa kelengkapan satu berkas rekam medis.
 *
 * Yang wajib berbeda menurut jenis kunjungannya. Menuntut resume pulang pada
 * kunjungan rawat jalan akan menghasilkan ribuan kekurangan palsu — dan daftar
 * kekurangan yang sebagian besar palsu akan diabaikan seluruhnya, termasuk yang
 * benar.
 */
export function periksaKelengkapan(berkas: BerkasRekamMedis): {
  complete: boolean;
  deficiencies: Kekurangan[];
  blockingCount: number;
} {
  const kurang: Kekurangan[] = [];
  const rawatInap = berkas.encounterType === 'INPATIENT';
  const bedah = berkas.encounterType === 'SURGERY';

  if (!berkas.hasPrincipalDiagnosis) {
    kurang.push({
      type: 'MISSING_PRINCIPAL_DIAGNOSIS',
      message: 'Diagnosis utama belum ditetapkan.',
      responsibleRole: 'HEALTH_DOCTOR',
      blocksCoding: true,
    });
  }

  /*
   * Diagnosis utama LEBIH DARI SATU adalah kekurangan tersendiri, bukan
   * kelebihan. Pengelompokan casemix memilih satu; bila ada dua, yang dipilih
   * ditentukan urutan baris — dan urutan baris bukan keputusan klinis.
   */
  if (berkas.principalDiagnosisCount > 1) {
    kurang.push({
      type: 'MULTIPLE_PRINCIPAL_DIAGNOSIS',
      message:
        `Ada ${berkas.principalDiagnosisCount} diagnosis utama. Hanya boleh satu — ` +
        'pengelompokan casemix akan memilih salah satunya menurut urutan baris, dan ' +
        'urutan baris bukan keputusan klinis.',
      responsibleRole: 'HEALTH_DOCTOR',
      blocksCoding: true,
    });
  }

  if (berkas.unsignedNoteCount > 0) {
    kurang.push({
      type: 'UNSIGNED_NOTE',
      message: `${berkas.unsignedNoteCount} catatan klinis belum ditandatangani.`,
      responsibleRole: 'HEALTH_DOCTOR',
      blocksCoding: true,
    });
  }

  if (rawatInap || bedah) {
    if (!berkas.hasDischargeSummary) {
      kurang.push({
        type: 'MISSING_DISCHARGE_SUMMARY',
        message: 'Resume pulang belum ditulis.',
        responsibleRole: 'HEALTH_DOCTOR',
        blocksCoding: true,
      });
    } else if (!berkas.dischargeSummarySigned) {
      kurang.push({
        type: 'UNSIGNED_DISCHARGE_SUMMARY',
        message: 'Resume pulang belum ditandatangani.',
        responsibleRole: 'HEALTH_DOCTOR',
        blocksCoding: true,
      });
    }
  }

  if (bedah) {
    if (!berkas.hasOperativeNote) {
      kurang.push({
        type: 'MISSING_OPERATIVE_NOTE',
        message: 'Laporan operasi belum ditulis.',
        responsibleRole: 'HEALTH_SURGEON',
        blocksCoding: true,
      });
    }
    if (!berkas.hasAnaesthesiaRecord) {
      kurang.push({
        type: 'MISSING_ANAESTHESIA_RECORD',
        message: 'Rekam anestesi belum lengkap.',
        responsibleRole: 'HEALTH_DOCTOR',
        blocksCoding: false,
      });
    }
    if (!berkas.hasConsent) {
      kurang.push({
        type: 'MISSING_CONSENT',
        message: 'Persetujuan tindakan belum tercatat.',
        responsibleRole: 'HEALTH_REGISTRATION_CLERK',
        blocksCoding: true,
      });
    }
  }

  /*
   * Diagnosis dan tindakan yang belum berkode TIDAK menahan pengkodean.
   *
   * Menahannya akan mengunci berkas selamanya: pengkodean ditolak karena belum
   * berkode, dan ia tidak akan pernah berkode karena pengkodeannya ditolak.
   *
   * Keduanya kekurangan yang nyata — tetapi ia pekerjaan KODER, bukan penahan
   * bagi koder. Yang ditahannya adalah pengajuan klaim; berkas yang diklaim
   * tanpa kode lengkap akan dikembalikan penjamin.
   */
  if (berkas.diagnosisCount > berkas.codedDiagnosisCount) {
    kurang.push({
      type: 'MISSING_DIAGNOSIS_CODE',
      message: `${berkas.diagnosisCount - berkas.codedDiagnosisCount} diagnosis belum berkode.`,
      responsibleRole: 'HEALTH_CODER',
      blocksCoding: false,
    });
  }

  if (berkas.procedureCount > berkas.codedProcedureCount) {
    kurang.push({
      type: 'MISSING_PROCEDURE_CODE',
      message: `${berkas.procedureCount - berkas.codedProcedureCount} tindakan belum berkode.`,
      responsibleRole: 'HEALTH_CODER',
      blocksCoding: false,
    });
  }

  /*
   * Nilai kritis yang belum diterima klinisi menahan pengkodean pula, bukan
   * hanya pemulangan. Berkas yang dikode dan diklaim sementara hasil kritisnya
   * belum pernah dibaca berarti rumah sakit menagihkan pelayanan yang belum
   * selesai.
   */
  if (berkas.unacknowledgedCriticalCount > 0) {
    kurang.push({
      type: 'UNACKNOWLEDGED_CRITICAL_RESULT',
      message:
        `${berkas.unacknowledgedCriticalCount} nilai kritis belum diterima klinisi mana pun.`,
      responsibleRole: 'HEALTH_DOCTOR',
      blocksCoding: true,
    });
  }

  if (!berkas.hasAttendingProvider) {
    kurang.push({
      type: 'MISSING_ATTENDING_PROVIDER',
      message: 'Dokter penanggung jawab belum ditetapkan.',
      responsibleRole: 'HEALTH_MEDICAL_RECORD_OFFICER',
      blocksCoding: true,
    });
  }

  return {
    complete: kurang.length === 0,
    deficiencies: kurang,
    blockingCount: kurang.filter((k) => k.blocksCoding).length,
  };
}

/**
 * Skor kelengkapan, untuk laporan mutu saja.
 *
 * Sengaja dipisahkan dari `periksaKelengkapan`. Skor berguna bagi manajemen yang
 * membandingkan bulan; ia tidak berguna bagi dokter yang harus memperbaiki
 * berkasnya. Menyatukan keduanya membuat layar dokter menampilkan angka
 * alih-alih daftar pekerjaan.
 */
export function skorKelengkapan(input: { total: number; complete: number }): {
  score: number;
  message: string;
} {
  if (!(input.total > 0)) {
    return { score: 0, message: 'Belum ada berkas pada periode ini.' };
  }
  const persen = (input.complete / input.total) * 100;
  return {
    score: Number(persen.toFixed(1)),
    message: `${input.complete} dari ${input.total} berkas lengkap (${persen.toFixed(1)}%).`,
  };
}

// --- Pengkodean --------------------------------------------------------------

export interface KodeTerminologi {
  code: string;
  system: 'ICD10' | 'ICD9CM' | 'LOINC' | 'SNOMED' | 'LOCAL';
  version: string;
  display: string;
  /** Tanggal kode dicabut. Null berarti masih berlaku. */
  deprecatedAt?: string | null;
  /** Kode pengganti bila dicabut. */
  replacedBy?: string | null;
}

/**
 * Boleh atau tidaknya satu kode dipakai pada rekam medis baru.
 *
 * Kode yang dicabut **tetap terbaca** pada rekam lama — menyembunyikannya
 * membuat rekam lama tidak dapat dibaca sama sekali. Yang dilarang adalah
 * memilihnya untuk rekam baru, sebab klaim yang memakainya akan ditolak.
 */
export function bolehPakaiKode(input: {
  kode: KodeTerminologi;
  serviceDate: string;
}): { allowed: boolean; message?: string; replacedBy?: string | null } {
  if (!input.kode.deprecatedAt) return { allowed: true };

  const dicabut = Date.parse(input.kode.deprecatedAt);
  const layanan = Date.parse(input.serviceDate);
  if (!Number.isFinite(dicabut) || !Number.isFinite(layanan)) return { allowed: true };

  /*
   * Dibandingkan dengan TANGGAL LAYANAN, bukan tanggal pengkodean. Berkas dari
   * Maret yang dikode pada Juni tetap memakai terminologi Maret — memaksanya
   * memakai terminologi Juni akan mengubah arti diagnosis yang sudah ditegakkan.
   */
  if (layanan < dicabut) return { allowed: true };

  return {
    allowed: false,
    replacedBy: input.kode.replacedBy ?? null,
    message:
      `Kode ${input.kode.code} sudah dicabut pada ${input.kode.deprecatedAt.slice(0, 10)}` +
      (input.kode.replacedBy ? `; penggantinya ${input.kode.replacedBy}.` : '.'),
  };
}

/**
 * Boleh atau tidaknya kunjungan dikode.
 *
 * Menahan pengkodean pada berkas yang belum lengkap bukan birokrasi. Berkas yang
 * dikode lalu diklaim lalu dikembalikan karena tidak lengkap akan dikerjakan dua
 * kali — dan yang kedua kalinya, dokternya sudah lupa pasiennya.
 */
export function bolehKode(input: {
  kelengkapan: { blockingCount: number; deficiencies: Kekurangan[] };
  status: string;
}): { allowed: boolean; message?: string; blockers?: string[] } {
  if (input.status === 'CODED' || input.status === 'VERIFIED') {
    return { allowed: false, message: `Kunjungan ini sudah berstatus ${input.status}.` };
  }
  if (input.kelengkapan.blockingCount > 0) {
    const penahan = input.kelengkapan.deficiencies
      .filter((d) => d.blocksCoding)
      .map((d) => d.message);
    return {
      allowed: false,
      blockers: penahan,
      message: `Berkas belum dapat dikode: ${penahan.join(' ')}`,
    };
  }
  return { allowed: true };
}

/**
 * Pemisahan koder dan verifikator.
 *
 * Addendum §F: *"Coder tidak menjadi verifier final klaim yang sama bila policy
 * melarang."* Kebijakannya berkonfigurasi karena rumah sakit kecil kadang hanya
 * punya satu koder — dan aturan yang menghentikan pekerjaan akan dimatikan
 * seluruhnya, bukan disiasati.
 */
export function bolehVerifikasiKoding(input: {
  codedBy: string | null;
  verifierId: string;
  requireSeparation: boolean;
}): { allowed: boolean; message?: string } {
  if (!input.requireSeparation) return { allowed: true };
  if (input.codedBy && input.codedBy === input.verifierId) {
    return {
      allowed: false,
      message:
        'Koder tidak dapat memverifikasi pengkodeannya sendiri. Bila fasilitas ini hanya ' +
        'memiliki satu koder, matikan pemisahan itu lewat kebijakan — jangan disiasati.',
    };
  }
  return { allowed: true };
}

// --- Penahanan hukum ---------------------------------------------------------

/**
 * Apakah rekam medis sedang ditahan untuk keperluan hukum.
 *
 * Penahanan menghalangi **perubahan dan penghapusan**, bukan pembacaan. Rekam
 * yang sedang diperkarakan lalu "diperbaiki" adalah bukti yang rusak — dan
 * perbaikan yang niatnya baik pun akan terbaca sebagai penghilangan bukti.
 */
export function bolehUbahSaatDitahan(input: {
  legalHolds: Array<{ id: string; reason: string; releasedAt?: string | null }>;
  action: 'READ' | 'AMEND' | 'DELETE' | 'PURGE';
}): { allowed: boolean; message?: string; holds?: string[] } {
  const aktif = input.legalHolds.filter((h) => !h.releasedAt);
  if (!aktif.length) return { allowed: true };
  if (input.action === 'READ') return { allowed: true };

  return {
    allowed: false,
    holds: aktif.map((h) => h.reason),
    message:
      `Rekam medis ini ditahan untuk keperluan hukum (${aktif.length} penahanan aktif). ` +
      'Perubahan dan penghapusan tidak diizinkan sampai penahanannya dicabut. Pembacaan ' +
      'tetap diizinkan.',
  };
}

// --- Pelepasan informasi -----------------------------------------------------

export type PemintaInformasi =
  | 'PATIENT'
  | 'LEGAL_GUARDIAN'
  | 'INSURER'
  | 'COURT'
  | 'POLICE'
  | 'OTHER_FACILITY'
  | 'RESEARCHER'
  | 'EMPLOYER'
  | 'OTHER';

/**
 * Boleh atau tidaknya rekam medis dilepas kepada peminta.
 *
 * Yang menentukan bukan siapa yang meminta, melainkan **dasar hukumnya**.
 * Polisi yang meminta tanpa surat resmi berkedudukan sama dengan orang asing
 * yang meminta; pemberi kerja yang meminta dengan persetujuan pasien pun tetap
 * hanya boleh menerima yang disetujui pasien.
 */
export function bolehLepasInformasi(input: {
  requester: PemintaInformasi;
  hasPatientConsent: boolean;
  hasLegalBasis: boolean;
  legalBasisDocument?: string | null;
  /** Bagian rekam yang diminta. */
  scope: string[];
}): { allowed: boolean; message?: string; requiresRedaction?: boolean } {
  if (!input.scope?.length) {
    return { allowed: false, message: 'Bagian rekam medis yang diminta harus disebutkan.' };
  }

  // Pasien dan walinya berhak atas rekamnya sendiri.
  if (input.requester === 'PATIENT' || input.requester === 'LEGAL_GUARDIAN') {
    return { allowed: true };
  }

  /*
   * Pengadilan dan kepolisian menuntut surat resmi, bukan sekadar penanda
   * "punya dasar hukum". Tanpa nomor surat yang tercatat, permintaan lisan
   * tidak dapat dibedakan dari permintaan yang dikarang — dan yang melepas
   * rekamnya yang akan menanggungnya.
   */
  if (input.requester === 'COURT' || input.requester === 'POLICE') {
    if (!input.hasLegalBasis || !input.legalBasisDocument?.trim()) {
      return {
        allowed: false,
        message:
          'Permintaan dari pengadilan atau kepolisian menuntut nomor surat resmi yang ' +
          'tercatat. Permintaan lisan tidak dapat dibedakan dari permintaan yang dikarang.',
      };
    }
    return { allowed: true };
  }

  if (input.requester === 'RESEARCHER') {
    if (!input.hasLegalBasis) {
      return {
        allowed: false,
        message: 'Penelitian menuntut persetujuan komite etik yang tercatat.',
      };
    }
    // Penelitian menerima data yang sudah disamarkan, bukan rekam utuh.
    return { allowed: true, requiresRedaction: true };
  }

  if (!input.hasPatientConsent) {
    return {
      allowed: false,
      message: `Permintaan dari ${input.requester} menuntut persetujuan pasien.`,
    };
  }

  // Pemberi kerja tetap menerima seperlunya, sekalipun pasien menyetujui.
  if (input.requester === 'EMPLOYER') return { allowed: true, requiresRedaction: true };

  return { allowed: true };
}

// --- Insiden keselamatan pasien ----------------------------------------------

export type TingkatBahaya =
  | 'NEAR_MISS'
  | 'NO_HARM'
  | 'MILD'
  | 'MODERATE'
  | 'SEVERE'
  | 'DEATH';

/**
 * Menentukan tingkat pelaporan dan tenggat telaah satu insiden.
 *
 * Kejadian nyaris cedera **tidak** berarti tidak perlu ditelaah. Ia justru data
 * yang paling berharga: ia menunjukkan celah sebelum ada yang terluka, dan ia
 * jauh lebih sering terjadi daripada cedera — sehingga polanya lebih cepat
 * terlihat.
 *
 * Yang membedakan tenggatnya bukan keberhargaannya, melainkan kemendesakannya.
 */
export function klasifikasiInsiden(input: {
  harmLevel: TingkatBahaya;
  reachedPatient: boolean;
  /** Kejadian yang menurut kebijakan wajib dilaporkan ke luar. */
  isSentinel?: boolean;
}): {
  grade: 'BLUE' | 'GREEN' | 'YELLOW' | 'RED';
  reviewDueHours: number;
  requiresRootCauseAnalysis: boolean;
  requiresExternalReport: boolean;
  message: string;
} {
  const sentinel =
    input.isSentinel === true || input.harmLevel === 'DEATH' || input.harmLevel === 'SEVERE';

  if (sentinel) {
    return {
      grade: 'RED',
      reviewDueHours: 24,
      requiresRootCauseAnalysis: true,
      requiresExternalReport: true,
      message:
        'Kejadian sentinel. Telaah akar masalah wajib dalam 24 jam, dan pelaporan ke luar ' +
        'mengikuti ketentuan yang berlaku.',
    };
  }

  if (input.harmLevel === 'MODERATE') {
    return {
      grade: 'YELLOW',
      reviewDueHours: 72,
      requiresRootCauseAnalysis: true,
      requiresExternalReport: false,
      message: 'Cedera sedang. Telaah akar masalah wajib dalam 72 jam.',
    };
  }

  if (input.harmLevel === 'MILD' || (input.harmLevel === 'NO_HARM' && input.reachedPatient)) {
    return {
      grade: 'GREEN',
      reviewDueHours: 168,
      requiresRootCauseAnalysis: false,
      requiresExternalReport: false,
      message: 'Cedera ringan atau sampai ke pasien tanpa cedera. Telaah dalam sepekan.',
    };
  }

  return {
    grade: 'BLUE',
    reviewDueHours: 336,
    requiresRootCauseAnalysis: false,
    requiresExternalReport: false,
    message:
      'Nyaris cedera. Tetap ditelaah — ia menunjukkan celah sebelum ada yang terluka, dan ' +
      'jauh lebih sering terjadi daripada cedera sehingga polanya lebih cepat terlihat.',
  };
}

/**
 * Boleh atau tidaknya laporan insiden ditutup.
 *
 * Insiden yang ditutup tanpa tindakan perbaikan akan terjadi lagi. Itulah
 * satu-satunya hal yang dapat dikatakan dengan pasti tentangnya.
 */
export function bolehTutupInsiden(input: {
  grade: 'BLUE' | 'GREEN' | 'YELLOW' | 'RED';
  requiresRootCauseAnalysis: boolean;
  hasRootCauseAnalysis: boolean;
  correctiveActionCount: number;
  closedBy: string;
  reportedBy: string;
}): { allowed: boolean; message?: string } {
  if (input.requiresRootCauseAnalysis && !input.hasRootCauseAnalysis) {
    return {
      allowed: false,
      message: 'Telaah akar masalah belum ada, sedangkan tingkat kejadiannya mewajibkannya.',
    };
  }

  if (input.grade !== 'BLUE' && input.correctiveActionCount === 0) {
    return {
      allowed: false,
      message:
        'Belum ada tindakan perbaikan. Insiden yang ditutup tanpa tindakan perbaikan akan ' +
        'terjadi lagi — itulah satu-satunya hal yang dapat dikatakan dengan pasti tentangnya.',
    };
  }

  /*
   * Pelapor tidak menutup laporannya sendiri pada kejadian berat. Bukan karena
   * ia tidak dapat dipercaya, melainkan karena ia pihak yang terlibat — dan
   * telaah oleh pihak yang terlibat bukan telaah.
   */
  if ((input.grade === 'RED' || input.grade === 'YELLOW') && input.closedBy === input.reportedBy) {
    return {
      allowed: false,
      message:
        'Pelapor tidak menutup laporannya sendiri pada kejadian ini. Telaah oleh pihak yang ' +
        'terlibat bukan telaah.',
    };
  }

  return { allowed: true };
}

/**
 * Mengurutkan insiden untuk papan mutu.
 *
 * Yang belum ditelaah dan sudah lewat tenggat berada paling atas — bukan yang
 * paling berat. Kejadian berat yang sudah ditelaah sudah dikerjakan; kejadian
 * ringan yang terlupa dua pekan adalah pekerjaan yang menumpuk diam-diam.
 */
export function urutkanInsiden<
  T extends { grade: string; reviewDueAt: string | null; closedAt?: string | null },
>(insiden: T[], now: string): T[] {
  const bobot: Record<string, number> = { RED: 3, YELLOW: 2, GREEN: 1, BLUE: 0 };
  const kini = Date.parse(now);

  return [...insiden].sort((a, b) => {
    const tutupA = a.closedAt ? 1 : 0;
    const tutupB = b.closedAt ? 1 : 0;
    if (tutupA !== tutupB) return tutupA - tutupB;

    const lewatA = !a.closedAt && a.reviewDueAt && Date.parse(a.reviewDueAt) < kini ? 1 : 0;
    const lewatB = !b.closedAt && b.reviewDueAt && Date.parse(b.reviewDueAt) < kini ? 1 : 0;
    if (lewatA !== lewatB) return lewatB - lewatA;

    return (bobot[b.grade] ?? 0) - (bobot[a.grade] ?? 0);
  });
}

// --- Indikator mutu ----------------------------------------------------------

/**
 * Menghitung satu indikator mutu.
 *
 * Penyebutnya wajib. Indikator tanpa penyebut adalah jumlah, dan jumlah tidak
 * dapat dibandingkan antar bulan maupun antar rumah sakit — bulan yang lebih
 * ramai akan selalu tampak lebih buruk.
 */
export function hitungIndikator(input: {
  numerator: number;
  denominator: number;
  /** Arah yang lebih baik. */
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  target?: number | null;
}): {
  value: number | null;
  meetsTarget: boolean | null;
  message: string;
} {
  if (!(input.denominator > 0)) {
    return {
      value: null,
      meetsTarget: null,
      message:
        'Penyebut nol; indikator tidak dapat dihitung. Menampilkannya sebagai nol akan ' +
        'terbaca sebagai mutu terburuk, padahal yang benar adalah belum ada datanya.',
    };
  }

  const nilai = Number(((input.numerator / input.denominator) * 100).toFixed(2));
  if (input.target == null) {
    return { value: nilai, meetsTarget: null, message: `${nilai}% (belum ada target).` };
  }

  const tercapai =
    input.direction === 'HIGHER_IS_BETTER' ? nilai >= input.target : nilai <= input.target;

  return {
    value: nilai,
    meetsTarget: tercapai,
    message: `${nilai}% terhadap target ${input.target}% — ${tercapai ? 'tercapai' : 'belum tercapai'}.`,
  };
}
