/**
 * Pemetaan akuntansi kesehatan.
 *
 * Fungsi murni, tanpa basis data.
 *
 * **Aturan pertama: jangan membuat buku besar kedua.**
 *
 * Rumah sakit memakai mesin akuntansi bersama milik Core. Membangun buku besar
 * kesehatan tersendiri akan menghasilkan dua neraca yang tidak pernah cocok —
 * dan yang lebih buruk, dua-duanya akan tampak benar.
 *
 * Yang dibangun di sini adalah **pemetaannya**: peristiwa klinis apa menjadi
 * jurnal apa. Jurnalnya sendiri milik Core, dan berkas ini tidak pernah
 * menghitung saldo, tidak pernah menjumlahkan neraca, dan tidak pernah
 * menghasilkan baris jurnal.
 *
 * Dua hal lain yang menentukan bentuknya.
 *
 * 1. **Pemetaan tinggal di data, bukan di kode.** Debit dan kredit tidak pernah
 *    ditulis di dalam controller. Peran akun disebut namanya — `REVENUE_LAB`,
 *    `COGS_REAGENT` — dan peran itu ditautkan ke akun sungguhan per fasilitas.
 *    Rumah sakit yang memakai nomor akun berbeda mengubah tautannya, bukan
 *    kodenya.
 *
 * 2. **Klaim yang disetujui kurang dari yang diajukan menghasilkan BEBAN.**
 *    Selisihnya bukan pendapatan yang hilang begitu saja. Ia harus terlihat,
 *    sebab ia ukuran mutu pengkodean dan kelengkapan berkas — dan yang tidak
 *    terlihat tidak pernah diperbaiki.
 */

// --- Peran akun --------------------------------------------------------------

/**
 * Peran akun kesehatan.
 *
 * Peran, bukan nomor akun. Rumah sakit yang memakai bagan akun berbeda menautkan
 * perannya ke nomor akunnya sendiri; kodenya tidak berubah.
 */
export type PeranAkun =
  // Aset
  | 'AR_PATIENT'
  | 'AR_BPJS'
  | 'AR_INSURER'
  | 'INVENTORY_DRUG'
  | 'INVENTORY_CONSUMABLE'
  | 'INVENTORY_REAGENT'
  | 'INVENTORY_IMPLANT'
  | 'MEDICAL_EQUIPMENT'
  | 'ACCUMULATED_DEPRECIATION'
  | 'CASH'
  // Liabilitas
  | 'PATIENT_DEPOSIT'
  | 'AP_DOCTOR_FEE'
  | 'AP_NURSE_FEE'
  | 'AP_SYSTEM_FEE'
  | 'AP_INVESTOR_DISTRIBUTION'
  // Ekuitas
  | 'RETAINED_EARNINGS'
  // Pendapatan
  | 'REVENUE_OUTPATIENT'
  | 'REVENUE_INPATIENT'
  | 'REVENUE_EMERGENCY'
  | 'REVENUE_SURGERY'
  | 'REVENUE_DELIVERY'
  | 'REVENUE_LAB'
  | 'REVENUE_RADIOLOGY'
  | 'REVENUE_PHARMACY'
  | 'REVENUE_EQUIPMENT'
  | 'REVENUE_BED'
  // Beban
  | 'COGS_DRUG'
  | 'COGS_CONSUMABLE'
  | 'COGS_REAGENT'
  | 'COGS_IMPLANT'
  | 'EXPENSE_DOCTOR_FEE'
  | 'EXPENSE_HEALTH_WORKER_FEE'
  | 'EXPENSE_EQUIPMENT_MAINTENANCE'
  | 'EXPENSE_EQUIPMENT_DEPRECIATION'
  | 'EXPENSE_PLATFORM'
  | 'EXPENSE_CLAIM_ADJUSTMENT';

export type GolonganAkun = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

/** Golongan dan saldo normal tiap peran. */
export const GOLONGAN_PERAN: Record<PeranAkun, { golongan: GolonganAkun; normal: 'DEBIT' | 'CREDIT' }> = {
  AR_PATIENT: { golongan: 'ASSET', normal: 'DEBIT' },
  AR_BPJS: { golongan: 'ASSET', normal: 'DEBIT' },
  AR_INSURER: { golongan: 'ASSET', normal: 'DEBIT' },
  INVENTORY_DRUG: { golongan: 'ASSET', normal: 'DEBIT' },
  INVENTORY_CONSUMABLE: { golongan: 'ASSET', normal: 'DEBIT' },
  INVENTORY_REAGENT: { golongan: 'ASSET', normal: 'DEBIT' },
  INVENTORY_IMPLANT: { golongan: 'ASSET', normal: 'DEBIT' },
  MEDICAL_EQUIPMENT: { golongan: 'ASSET', normal: 'DEBIT' },
  ACCUMULATED_DEPRECIATION: { golongan: 'ASSET', normal: 'CREDIT' },
  CASH: { golongan: 'ASSET', normal: 'DEBIT' },
  PATIENT_DEPOSIT: { golongan: 'LIABILITY', normal: 'CREDIT' },
  AP_DOCTOR_FEE: { golongan: 'LIABILITY', normal: 'CREDIT' },
  AP_NURSE_FEE: { golongan: 'LIABILITY', normal: 'CREDIT' },
  AP_SYSTEM_FEE: { golongan: 'LIABILITY', normal: 'CREDIT' },
  AP_INVESTOR_DISTRIBUTION: { golongan: 'LIABILITY', normal: 'CREDIT' },
  RETAINED_EARNINGS: { golongan: 'EQUITY', normal: 'CREDIT' },
  REVENUE_OUTPATIENT: { golongan: 'REVENUE', normal: 'CREDIT' },
  REVENUE_INPATIENT: { golongan: 'REVENUE', normal: 'CREDIT' },
  REVENUE_EMERGENCY: { golongan: 'REVENUE', normal: 'CREDIT' },
  REVENUE_SURGERY: { golongan: 'REVENUE', normal: 'CREDIT' },
  REVENUE_DELIVERY: { golongan: 'REVENUE', normal: 'CREDIT' },
  REVENUE_LAB: { golongan: 'REVENUE', normal: 'CREDIT' },
  REVENUE_RADIOLOGY: { golongan: 'REVENUE', normal: 'CREDIT' },
  REVENUE_PHARMACY: { golongan: 'REVENUE', normal: 'CREDIT' },
  REVENUE_EQUIPMENT: { golongan: 'REVENUE', normal: 'CREDIT' },
  REVENUE_BED: { golongan: 'REVENUE', normal: 'CREDIT' },
  COGS_DRUG: { golongan: 'EXPENSE', normal: 'DEBIT' },
  COGS_CONSUMABLE: { golongan: 'EXPENSE', normal: 'DEBIT' },
  COGS_REAGENT: { golongan: 'EXPENSE', normal: 'DEBIT' },
  COGS_IMPLANT: { golongan: 'EXPENSE', normal: 'DEBIT' },
  EXPENSE_DOCTOR_FEE: { golongan: 'EXPENSE', normal: 'DEBIT' },
  EXPENSE_HEALTH_WORKER_FEE: { golongan: 'EXPENSE', normal: 'DEBIT' },
  EXPENSE_EQUIPMENT_MAINTENANCE: { golongan: 'EXPENSE', normal: 'DEBIT' },
  EXPENSE_EQUIPMENT_DEPRECIATION: { golongan: 'EXPENSE', normal: 'DEBIT' },
  EXPENSE_PLATFORM: { golongan: 'EXPENSE', normal: 'DEBIT' },
  EXPENSE_CLAIM_ADJUSTMENT: { golongan: 'EXPENSE', normal: 'DEBIT' },
};

export const SELURUH_PERAN = Object.keys(GOLONGAN_PERAN) as PeranAkun[];

// --- Peristiwa ---------------------------------------------------------------

export type PeristiwaKesehatan =
  | 'HEALTH_SERVICE_RENDERED_CASH'
  | 'HEALTH_SERVICE_RENDERED_BPJS'
  | 'HEALTH_DRUG_DISPENSED'
  | 'HEALTH_REAGENT_CONSUMED'
  | 'HEALTH_IMPLANT_USED'
  | 'HEALTH_CLAIM_UNDERPAID'
  | 'HEALTH_CLAIM_PAID'
  | 'HEALTH_FEE_ACCRUED'
  | 'HEALTH_FEE_PAID'
  | 'HEALTH_SYSTEM_FEE_ACCRUED'
  | 'HEALTH_INVESTOR_DISTRIBUTION_APPROVED'
  | 'HEALTH_DEPOSIT_RECEIVED'
  | 'HEALTH_DEPOSIT_APPLIED';

export interface DefinisiPeristiwa {
  event: PeristiwaKesehatan;
  label: string;
  /** Peran akun sisi debit. Null berarti ditentukan pemetaan layanan. */
  debit: PeranAkun | 'BY_SERVICE';
  credit: PeranAkun | 'BY_SERVICE';
  /** Medan nilai pada `amounts`. Bukan rumus — rumus bebas pada data dilarang. */
  amountKey: string;
  /** Mengapa peristiwa ini ada, bagi yang membaca petanya kelak. */
  note?: string;
}

/**
 * Peristiwa kesehatan yang wajib terpetakan.
 *
 * Urutannya mengikuti urutan terjadinya di rumah sakit, bukan abjad — yang
 * membaca peta ini biasanya sedang menelusuri satu kunjungan dari awal.
 */
export const PERISTIWA: DefinisiPeristiwa[] = [
  {
    event: 'HEALTH_SERVICE_RENDERED_CASH',
    label: 'Layanan diberikan (pasien tunai)',
    debit: 'AR_PATIENT',
    credit: 'BY_SERVICE',
    amountKey: 'serviceAmount',
    note: 'Akun pendapatannya ditentukan pemetaan layanan, bukan satu akun untuk semua.',
  },
  {
    event: 'HEALTH_SERVICE_RENDERED_BPJS',
    label: 'Layanan diberikan (penjamin BPJS)',
    debit: 'AR_BPJS',
    credit: 'BY_SERVICE',
    amountKey: 'serviceAmount',
  },
  {
    event: 'HEALTH_DRUG_DISPENSED',
    label: 'Obat diserahkan',
    debit: 'COGS_DRUG',
    credit: 'INVENTORY_DRUG',
    amountKey: 'costAmount',
    note: 'Harga pokoknya, bukan harga jualnya.',
  },
  {
    event: 'HEALTH_REAGENT_CONSUMED',
    label: 'Reagen dipakai',
    debit: 'COGS_REAGENT',
    credit: 'INVENTORY_REAGENT',
    amountKey: 'costAmount',
    note: 'Pemeriksaan laboratorium punya dua sisi: pendapatannya dan harga pokok reagennya.',
  },
  {
    event: 'HEALTH_IMPLANT_USED',
    label: 'Implan dipasang',
    debit: 'COGS_IMPLANT',
    credit: 'INVENTORY_IMPLANT',
    amountKey: 'costAmount',
  },
  {
    event: 'HEALTH_CLAIM_UNDERPAID',
    label: 'Klaim disetujui kurang dari yang diajukan',
    debit: 'EXPENSE_CLAIM_ADJUSTMENT',
    credit: 'AR_BPJS',
    amountKey: 'adjustmentAmount',
    note:
      'Yang paling sering terlupa. Selisihnya bukan pendapatan yang hilang begitu saja; ia ' +
      'beban yang harus terlihat, sebab ia ukuran mutu pengkodean dan kelengkapan berkas.',
  },
  {
    event: 'HEALTH_CLAIM_PAID',
    label: 'Klaim dibayar',
    debit: 'CASH',
    credit: 'AR_BPJS',
    amountKey: 'paidAmount',
  },
  {
    event: 'HEALTH_FEE_ACCRUED',
    label: 'Jasa profesional dihitung',
    debit: 'EXPENSE_DOCTOR_FEE',
    credit: 'AP_DOCTOR_FEE',
    amountKey: 'feeAmount',
  },
  {
    event: 'HEALTH_FEE_PAID',
    label: 'Jasa profesional dibayarkan',
    debit: 'AP_DOCTOR_FEE',
    credit: 'CASH',
    amountKey: 'feeAmount',
  },
  {
    event: 'HEALTH_SYSTEM_FEE_ACCRUED',
    label: 'Fee sistem terhitung',
    debit: 'EXPENSE_PLATFORM',
    credit: 'AP_SYSTEM_FEE',
    amountKey: 'systemFeeAmount',
    note: 'Hanya bila kontraknya ada. Bawaan fee sistem adalah NONE.',
  },
  {
    event: 'HEALTH_INVESTOR_DISTRIBUTION_APPROVED',
    label: 'Distribusi investor disetujui',
    debit: 'RETAINED_EARNINGS',
    credit: 'AP_INVESTOR_DISTRIBUTION',
    amountKey: 'distributionAmount',
    note: 'Hanya bila kontraknya ada. Bawaan distribusi investor adalah NONE.',
  },
  {
    event: 'HEALTH_DEPOSIT_RECEIVED',
    label: 'Deposit pasien diterima',
    debit: 'CASH',
    credit: 'PATIENT_DEPOSIT',
    amountKey: 'depositAmount',
    note: 'Deposit adalah utang kepada pasien, bukan pendapatan.',
  },
  {
    event: 'HEALTH_DEPOSIT_APPLIED',
    label: 'Deposit dipakai',
    debit: 'PATIENT_DEPOSIT',
    credit: 'AR_PATIENT',
    amountKey: 'appliedAmount',
  },
];

/**
 * Peran yang wajib tertaut supaya satu peristiwa dapat dijurnal.
 *
 * `BY_SERVICE` tidak menuntut peran tetap — akunnya datang dari pemetaan
 * layanan, dan kelengkapannya diperiksa H-9L.
 */
export function peranDibutuhkan(event: PeristiwaKesehatan): PeranAkun[] {
  const def = PERISTIWA.find((p) => p.event === event);
  if (!def) return [];
  return [def.debit, def.credit].filter((r): r is PeranAkun => r !== 'BY_SERVICE');
}

// --- Kelengkapan profil ------------------------------------------------------

export interface KekuranganAkun {
  role: PeranAkun;
  message: string;
  /** Peristiwa yang tidak dapat dijurnal tanpanya. */
  blocksEvents: PeristiwaKesehatan[];
}

/**
 * Memeriksa kelengkapan profil akuntansi satu fasilitas.
 *
 * Melaporkan peran yang belum tertaut **satu per satu**, beserta peristiwa apa
 * yang menjadi buntu karenanya. "Profil belum lengkap" tidak memberi tahu siapa
 * pun apa yang harus dikerjakan.
 *
 * Peristiwa yang memang dimatikan kebijakan — fee sistem dan distribusi
 * investor yang bawaannya NONE — tidak dihitung sebagai kekurangan. Menuntut
 * penautan akun bagi peristiwa yang tidak akan pernah terjadi akan membuat
 * seluruh daftar diabaikan.
 */
export function periksaProfilAkun(input: {
  linked: Partial<Record<PeranAkun, string | null>>;
  /** Peristiwa yang memang dipakai fasilitas ini. */
  enabledEvents: PeristiwaKesehatan[];
}): { complete: boolean; missing: KekuranganAkun[] } {
  const perluPeran = new Map<PeranAkun, PeristiwaKesehatan[]>();

  for (const event of input.enabledEvents) {
    for (const role of peranDibutuhkan(event)) {
      const daftar = perluPeran.get(role) ?? [];
      daftar.push(event);
      perluPeran.set(role, daftar);
    }
  }

  const kurang: KekuranganAkun[] = [];
  for (const [role, events] of perluPeran) {
    if (!input.linked[role]) {
      kurang.push({
        role,
        message:
          `Peran akun ${role} belum ditautkan ke akun mana pun; ` +
          `${events.length} peristiwa tidak dapat dijurnal karenanya.`,
        blocksEvents: events,
      });
    }
  }

  kurang.sort((a, b) => b.blocksEvents.length - a.blocksEvents.length || a.role.localeCompare(b.role));
  return { complete: kurang.length === 0, missing: kurang };
}

/**
 * Boleh atau tidaknya satu peran ditautkan ke satu akun.
 *
 * Saldo normal akunnya harus cocok dengan golongan perannya. Menautkan
 * `REVENUE_LAB` ke akun bersaldo normal debit akan menghasilkan pendapatan
 * bernilai negatif pada setiap laporan — dan yang membacanya akan menyimpulkan
 * laboratoriumnya merugi.
 */
export function bolehTautkanAkun(input: {
  role: PeranAkun;
  accountNormalBalance: 'DEBIT' | 'CREDIT';
  accountAllowsPosting: boolean;
  accountIsActive: boolean;
}): { allowed: boolean; message?: string } {
  if (!input.accountIsActive) {
    return { allowed: false, message: 'Akun ini tidak aktif.' };
  }
  if (!input.accountAllowsPosting) {
    return {
      allowed: false,
      message:
        'Akun ini akun induk dan tidak menerima posting. Tautkan ke akun anaknya — jurnal pada ' +
        'akun induk membuat rincian per unit hilang seluruhnya.',
    };
  }

  const seharusnya = GOLONGAN_PERAN[input.role];
  if (!seharusnya) {
    return { allowed: false, message: `Peran akun ${input.role} tidak dikenal.` };
  }
  if (seharusnya.normal !== input.accountNormalBalance) {
    return {
      allowed: false,
      message:
        `Peran ${input.role} bergolongan ${seharusnya.golongan} dengan saldo normal ` +
        `${seharusnya.normal}, sedangkan akun yang dipilih bersaldo normal ` +
        `${input.accountNormalBalance}. Menautkannya akan membuat nilainya berlawanan tanda ` +
        'pada setiap laporan.',
    };
  }
  return { allowed: true };
}

/**
 * Boleh atau tidaknya satu aturan pemetaan peristiwa disimpan.
 *
 * Debit dan kredit tidak boleh peran yang sama: jurnal yang mendebit dan
 * mengkredit akun yang sama tidak mengubah apa pun, tetapi tampak seperti
 * pekerjaan yang sudah selesai.
 */
export function bolehPasangAturan(input: {
  event: PeristiwaKesehatan;
  debitRole: PeranAkun | 'BY_SERVICE';
  creditRole: PeranAkun | 'BY_SERVICE';
}): { allowed: boolean; message?: string } {
  if (!PERISTIWA.some((p) => p.event === input.event)) {
    return { allowed: false, message: `Peristiwa ${input.event} tidak dikenal.` };
  }
  if (input.debitRole === input.creditRole) {
    return {
      allowed: false,
      message:
        'Sisi debit dan kredit tidak boleh peran yang sama. Jurnal yang mendebit dan mengkredit ' +
        'akun yang sama tidak mengubah apa pun, tetapi tampak seperti pekerjaan yang selesai.',
    };
  }
  for (const role of [input.debitRole, input.creditRole]) {
    if (role !== 'BY_SERVICE' && !GOLONGAN_PERAN[role]) {
      return { allowed: false, message: `Peran akun ${role} tidak dikenal.` };
    }
  }
  return { allowed: true };
}

// --- Kesiapan menjurnal ------------------------------------------------------

/**
 * Kesiapan satu fasilitas untuk menjurnal.
 *
 * Menyebut dengan jujur apa yang **kami** belum kerjakan dan apa yang menunggu
 * **Core**. Laporan kesiapan yang menyatukan keduanya akan membuat orang
 * mengerjakan hal yang memang tidak dapat dikerjakannya.
 */
export function kesiapanMenjurnal(input: {
  profile: { complete: boolean; missing: KekuranganAkun[] };
  /** Kode peristiwa HEALTH_* yang sudah diterima Core. */
  coreAcceptedEvents: string[];
  enabledEvents: PeristiwaKesehatan[];
}): {
  ready: boolean;
  ourWork: string[];
  waitingOnCore: PeristiwaKesehatan[];
  message: string;
} {
  const milikKami = input.profile.missing.map((m) => m.message);
  const menungguCore = input.enabledEvents.filter((e) => !input.coreAcceptedEvents.includes(e));

  const siap = milikKami.length === 0 && menungguCore.length === 0;
  const bagian: string[] = [];
  if (milikKami.length) {
    bagian.push(`${milikKami.length} peran akun belum ditautkan.`);
  }
  if (menungguCore.length) {
    bagian.push(
      `${menungguCore.length} kode peristiwa belum diterima mesin akuntansi bersama; ` +
        'permintaannya sudah diajukan dan tidak dapat diselesaikan sesi ini sendiri. ' +
        'Membuat buku besar kedua bukan jalan keluarnya.',
    );
  }

  return {
    ready: siap,
    ourWork: milikKami,
    waitingOnCore: menungguCore,
    message: siap ? 'Seluruh peristiwa siap dijurnal.' : bagian.join(' '),
  };
}

// --- Selisih klaim -----------------------------------------------------------

/**
 * Selisih antara yang diajukan dan yang disetujui.
 *
 * Selisihnya **beban**, bukan pendapatan yang hilang begitu saja. Ia harus
 * terlihat, sebab ia ukuran mutu pengkodean dan kelengkapan berkas — dan yang
 * tidak terlihat tidak pernah diperbaiki.
 *
 * Bila yang disetujui LEBIH BESAR daripada yang diajukan, itu bukan keuntungan
 * melainkan tanda bahwa pengajuannya keliru. Dilaporkan, tidak dijurnal
 * diam-diam.
 */
export function hitungSelisihKlaim(input: {
  submittedAmount: number;
  approvedAmount: number;
}): {
  adjustmentAmount: number;
  event: PeristiwaKesehatan | null;
  needsReview: boolean;
  message: string;
} {
  if (input.submittedAmount < 0 || input.approvedAmount < 0) {
    throw new Error('Nilai klaim tidak boleh negatif.');
  }

  const selisih = input.submittedAmount - input.approvedAmount;

  if (selisih === 0) {
    return {
      adjustmentAmount: 0,
      event: null,
      needsReview: false,
      message: 'Disetujui penuh; tidak ada penyesuaian.',
    };
  }

  if (selisih < 0) {
    return {
      adjustmentAmount: 0,
      event: null,
      needsReview: true,
      message:
        `Disetujui ${Math.abs(selisih)} LEBIH BESAR daripada yang diajukan. Ini bukan ` +
        'keuntungan melainkan tanda pengajuannya keliru — periksa lebih dahulu, jangan ' +
        'dijurnal.',
    };
  }

  return {
    adjustmentAmount: selisih,
    event: 'HEALTH_CLAIM_UNDERPAID',
    needsReview: false,
    message:
      `Selisih ${selisih} dicatat sebagai beban penyesuaian klaim, bukan dihapus dari ` +
      'piutang begitu saja. Ia ukuran mutu pengkodean dan kelengkapan berkas.',
  };
}
