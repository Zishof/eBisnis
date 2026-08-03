/**
 * Aturan kontrak fee sistem dan fee investor.
 *
 * Fungsi murni, tanpa basis data.
 *
 * **Bawaannya NONE.** Tanpa kontrak yang aktif, fee sistem dan bagian investor
 * bernilai nol — bukan nilai bawaan yang kecil, bukan taksiran, nol.
 *
 * Lima hal menentukan bentuk seluruh berkas ini.
 *
 * 1. **Tiga orang berbeda.** Penyusun, pemeriksa, dan penyetuju. Dua orang
 *    cukup untuk sebagian besar keputusan; kontrak yang mengambil bagian dari
 *    kumpulan jasa tenaga medis menuntut tiga, sebab yang dirugikannya tidak
 *    duduk di ruangan itu.
 *
 * 2. **Batas maksimum ditegakkan saat MENGHITUNG, bukan sekadar dicatat.**
 *    Batas yang hanya tertulis pada kontrak akan dilampaui oleh perhitungan
 *    yang tidak pernah membacanya, dan pelampauannya baru ketahuan ketika
 *    seseorang menjumlahkan setahun.
 *
 * 3. **Kontrak yang habis masa berlakunya menghentikan fee-nya sendiri.**
 *    Bukan menunggu seseorang ingat. Yang mengingat akhir masa kontrak adalah
 *    pihak yang menerima uangnya, dan ia tidak akan mengingatkan siapa pun.
 *
 * 4. **Investor tidak pernah memperoleh akses data pasien.** Kontrak investor
 *    mengatur pembagian hasil, bukan pembukaan rekam medis — dan tidak ada
 *    medan pada berkas ini yang dapat dipakai memberikannya.
 *
 * 5. **Kontrak tidak berlaku surut melampaui telaah hukumnya.** Kontrak yang
 *    berlaku sejak sebelum diperiksa berarti pemeriksaannya tidak pernah
 *    menahan apa pun.
 */

// --- Jenis dan status --------------------------------------------------------

export type JenisKontrakFee = 'SYSTEM_PLATFORM_FEE' | 'INVESTOR_SHARE';

export type StatusKontrak =
  | 'DRAFT'
  | 'LEGAL_REVIEW'
  | 'MANAGEMENT_APPROVAL'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'TERMINATED';

const URUTAN: Record<StatusKontrak, StatusKontrak[]> = {
  DRAFT: ['LEGAL_REVIEW', 'TERMINATED'],
  LEGAL_REVIEW: ['DRAFT', 'MANAGEMENT_APPROVAL', 'TERMINATED'],
  MANAGEMENT_APPROVAL: ['LEGAL_REVIEW', 'ACTIVE', 'TERMINATED'],
  ACTIVE: ['SUSPENDED', 'EXPIRED', 'TERMINATED'],
  SUSPENDED: ['ACTIVE', 'TERMINATED'],
  EXPIRED: ['TERMINATED'],
  TERMINATED: [],
};

/**
 * Perpindahan status kontrak.
 *
 * Tidak ada jalan kembali dari `TERMINATED`. Kontrak yang dihidupkan kembali
 * setelah diakhiri adalah kontrak baru, dan kontrak baru menuntut telaah hukum
 * baru — keadaan yang membuatnya diakhiri mungkin masih ada.
 */
export function bolehPindahStatusKontrak(input: {
  from: StatusKontrak;
  to: StatusKontrak;
}): { allowed: boolean; message?: string } {
  const berikut = URUTAN[input.from];
  if (!berikut) return { allowed: false, message: `Status ${input.from} tidak dikenal.` };
  if (!berikut.includes(input.to)) {
    return {
      allowed: false,
      message:
        `Kontrak berstatus ${input.from} tidak dapat berpindah ke ${input.to}. ` +
        (input.from === 'TERMINATED'
          ? 'Kontrak yang sudah diakhiri tidak dihidupkan kembali; buat kontrak baru, dan ' +
            'kontrak baru menuntut telaah hukum baru — keadaan yang membuatnya diakhiri ' +
            'mungkin masih ada.'
          : `Yang mungkin dari sini: ${berikut.join(', ')}.`),
    };
  }
  return { allowed: true };
}

// --- Rantai tiga orang -------------------------------------------------------

export interface RantaiPersetujuan {
  preparedBy?: string | null;
  reviewedBy?: string | null;
  approvedBy?: string | null;
}

/**
 * Memeriksa rantai maker–checker–approver.
 *
 * **Ketiganya harus orang yang berbeda.** Dua orang cukup untuk sebagian besar
 * keputusan; kontrak yang mengambil bagian dari kumpulan jasa tenaga medis
 * menuntut tiga, sebab yang dirugikannya tidak duduk di ruangan itu — dan
 * satu-satunya pengganti kehadirannya adalah jumlah mata yang melihat.
 */
export function periksaRantai(rantai: RantaiPersetujuan): {
  valid: boolean;
  message?: string;
  missing?: string[];
} {
  const kurang: string[] = [];
  if (!rantai.preparedBy) kurang.push('penyusun');
  if (!rantai.reviewedBy) kurang.push('pemeriksa hukum');
  if (!rantai.approvedBy) kurang.push('penyetuju manajemen');

  if (kurang.length) {
    return {
      valid: false,
      missing: kurang,
      message: `Rantai persetujuan belum lengkap; yang kurang: ${kurang.join(', ')}.`,
    };
  }

  const orang = [rantai.preparedBy, rantai.reviewedBy, rantai.approvedBy];
  if (new Set(orang).size !== 3) {
    return {
      valid: false,
      message:
        'Penyusun, pemeriksa hukum, dan penyetuju manajemen harus tiga orang yang berbeda. ' +
        'Kontrak ini mengambil bagian dari kumpulan yang sama dengan jasa tenaga medis, dan ' +
        'yang dirugikannya tidak duduk di ruangan itu — satu-satunya pengganti kehadirannya ' +
        'adalah jumlah mata yang melihat.',
    };
  }

  return { valid: true };
}

// --- Kelayakan aktivasi ------------------------------------------------------

export interface KontrakFee {
  contractType: JenisKontrakFee;
  contractReference?: string | null;
  legalReviewNote?: string | null;
  taxTreatment?: string | null;
  maximumPercent?: number | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  legalReviewedAt?: string | null;
  chain: RantaiPersetujuan;
}

/**
 * Boleh atau tidaknya satu kontrak fee diaktifkan.
 *
 * Yang kurang disebutkan **satu per satu**. Daftar syarat yang hanya berkata
 * "belum lengkap" akan diisi seadanya sampai tombolnya menyala.
 */
export function bolehAktifkanKontrak(kontrak: KontrakFee): {
  allowed: boolean;
  missing: string[];
  message: string;
} {
  const kurang: string[] = [];

  if (!kontrak.contractReference?.trim()) kurang.push('nomor kontrak');
  if (!kontrak.legalReviewNote?.trim()) kurang.push('catatan telaah hukum');
  if (!kontrak.taxTreatment?.trim()) kurang.push('perlakuan pajak');
  if (kontrak.maximumPercent == null) kurang.push('batas maksimum');
  if (!kontrak.effectiveFrom?.trim()) kurang.push('tanggal berlaku');

  const rantai = periksaRantai(kontrak.chain);
  if (!rantai.valid) {
    kurang.push(...(rantai.missing ?? ['rantai persetujuan tiga orang']));
  }

  if (kurang.length) {
    return {
      allowed: false,
      missing: kurang,
      message:
        `Kontrak ${kontrak.contractType} belum dapat diaktifkan; yang kurang: ` +
        `${kurang.join(', ')}. Bawaan fee ini NONE, dan tanpa kontrak yang lengkap ia tetap ` +
        'nol — bukan nilai kecil, bukan taksiran, nol.',
    };
  }

  if (!rantai.valid) {
    return { allowed: false, missing: [], message: rantai.message ?? 'Rantai tidak sah.' };
  }

  /*
   * Kontrak tidak berlaku surut melampaui telaah hukumnya. Kontrak yang berlaku
   * sejak sebelum diperiksa berarti pemeriksaannya tidak pernah menahan apa pun.
   */
  if (kontrak.legalReviewedAt && kontrak.effectiveFrom) {
    const telaah = Date.parse(kontrak.legalReviewedAt.slice(0, 10));
    const berlaku = Date.parse(kontrak.effectiveFrom);
    if (Number.isFinite(telaah) && Number.isFinite(berlaku) && berlaku < telaah) {
      return {
        allowed: false,
        missing: [],
        message:
          `Kontrak berlaku sejak ${kontrak.effectiveFrom}, sedangkan telaah hukumnya baru ` +
          `${kontrak.legalReviewedAt.slice(0, 10)}. Kontrak yang berlaku sejak sebelum ` +
          'diperiksa berarti pemeriksaannya tidak pernah menahan apa pun.',
      };
    }
  }

  if (
    kontrak.effectiveTo &&
    kontrak.effectiveFrom &&
    Date.parse(kontrak.effectiveTo) < Date.parse(kontrak.effectiveFrom)
  ) {
    return {
      allowed: false,
      missing: [],
      message: 'Tanggal berakhir mendahului tanggal berlaku.',
    };
  }

  return { allowed: true, missing: [], message: `Kontrak ${kontrak.contractType} dapat diaktifkan.` };
}

// --- Penerapan ---------------------------------------------------------------

/**
 * Menghitung fee yang boleh diambil satu kontrak.
 *
 * **Batas maksimum ditegakkan di sini**, bukan sekadar dicatat pada kontraknya.
 * Batas yang hanya tertulis akan dilampaui oleh perhitungan yang tidak pernah
 * membacanya.
 *
 * Tanpa kontrak yang aktif, jawabannya nol — dan sebabnya disebutkan, supaya
 * yang membacanya tidak menyangka perhitungannya gagal.
 */
export function hitungFeeKontrak(input: {
  contract?: {
    contractType: JenisKontrakFee;
    status: StatusKontrak;
    maximumPercent: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
    excludedServiceIds?: string[];
  } | null;
  requestedPercent: number;
  baseAmount: number;
  serviceId?: string | null;
  /** Tanggal yang menentukan berlaku tidaknya kontrak. */
  onDate: string;
}): {
  feeAmount: number;
  appliedPercent: number;
  capped: boolean;
  message: string;
} {
  if (input.baseAmount < 0) throw new Error('Nilai dasar tidak boleh negatif.');
  if (input.requestedPercent < 0) throw new Error('Persentase tidak boleh negatif.');

  if (!input.contract) {
    return {
      feeAmount: 0,
      appliedPercent: 0,
      capped: false,
      message:
        'Tidak ada kontrak untuk fee ini, sehingga nilainya nol. Bawaannya memang NONE — bukan ' +
        'nilai kecil, bukan taksiran, nol.',
    };
  }

  const k = input.contract;

  if (k.status !== 'ACTIVE') {
    return {
      feeAmount: 0,
      appliedPercent: 0,
      capped: false,
      message: `Kontrak ${k.contractType} berstatus ${k.status}, bukan ACTIVE; fee-nya nol.`,
    };
  }

  const hari = Date.parse(input.onDate);
  const mulai = Date.parse(k.effectiveFrom);
  if (Number.isFinite(hari) && Number.isFinite(mulai) && hari < mulai) {
    return {
      feeAmount: 0,
      appliedPercent: 0,
      capped: false,
      message: `Kontrak baru berlaku sejak ${k.effectiveFrom}; pada ${input.onDate} fee-nya nol.`,
    };
  }

  /*
   * Kontrak yang habis masa berlakunya menghentikan fee-nya SENDIRI. Yang
   * mengingat akhir masa kontrak adalah pihak yang menerima uangnya, dan ia
   * tidak akan mengingatkan siapa pun.
   */
  if (k.effectiveTo) {
    const selesai = Date.parse(k.effectiveTo);
    if (Number.isFinite(selesai) && Number.isFinite(hari) && hari > selesai) {
      return {
        feeAmount: 0,
        appliedPercent: 0,
        capped: false,
        message:
          `Kontrak ${k.contractType} habis masa berlakunya pada ${k.effectiveTo}; sejak itu ` +
          'fee-nya nol. Kontrak yang habis menghentikan fee-nya sendiri, tanpa menunggu ' +
          'seseorang ingat.',
      };
    }
  }

  if (input.serviceId && (k.excludedServiceIds ?? []).includes(input.serviceId)) {
    return {
      feeAmount: 0,
      appliedPercent: 0,
      capped: false,
      message: 'Layanan ini dikecualikan dari fee menurut kontraknya.',
    };
  }

  const terpakai = Math.min(input.requestedPercent, k.maximumPercent);
  const dibatasi = terpakai < input.requestedPercent;
  const nilai = Math.floor((input.baseAmount * terpakai) / 100);

  return {
    feeAmount: nilai,
    appliedPercent: terpakai,
    capped: dibatasi,
    message: dibatasi
      ? `Persentase yang diminta ${input.requestedPercent}% melebihi batas kontrak ` +
        `${k.maximumPercent}%; yang dipakai batasnya. Batas yang hanya tertulis pada kontrak ` +
        'akan dilampaui oleh perhitungan yang tidak pernah membacanya.'
      : `Fee ${nilai} pada ${terpakai}% menurut kontrak ${k.contractType}.`,
  };
}

// --- Batas akses investor ----------------------------------------------------

/**
 * Medan yang boleh dilihat pemegang kontrak investor.
 *
 * Daftar putih, bukan daftar hitam. Daftar hitam melewatkan setiap medan yang
 * ditambahkan kelak oleh orang yang tidak membaca aturan ini.
 */
export const MEDAN_BOLEH_INVESTOR = [
  'periodYear',
  'periodMonth',
  'facilityCount',
  'grossRevenue',
  'netRevenue',
  'distributionAmount',
  'distributionPercent',
  'contractReference',
] as const;

/**
 * Boleh atau tidaknya satu medan dibuka kepada pemegang kontrak investor.
 *
 * **Investor tidak pernah memperoleh akses data pasien.** Kontrak investor
 * mengatur pembagian hasil, bukan pembukaan rekam medis. Yang membedakan
 * keduanya bukan niat, melainkan medan mana yang dikirimkan.
 */
export function bolehDilihatInvestor(field: string): {
  allowed: boolean;
  message?: string;
} {
  if ((MEDAN_BOLEH_INVESTOR as readonly string[]).includes(field)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    message:
      `Medan "${field}" tidak dibuka kepada pemegang kontrak investor. Kontrak investor ` +
      'mengatur pembagian hasil, bukan pembukaan rekam medis — dan yang membedakan keduanya ' +
      'bukan niat, melainkan medan mana yang dikirimkan.',
  };
}

/**
 * Menyaring satu baris menjadi hanya medan yang boleh dilihat investor.
 *
 * Yang tersaring **dilaporkan jumlahnya**, bukan dibuang diam-diam: penyaringan
 * yang tidak terlihat akan dianggap tidak ada, lalu seseorang akan menambahkan
 * medan baru tanpa memeriksanya.
 */
export function saringUntukInvestor(baris: Record<string, unknown>): {
  visible: Record<string, unknown>;
  removedCount: number;
  removedFields: string[];
} {
  const tampak: Record<string, unknown> = {};
  const dibuang: string[] = [];

  for (const [k, v] of Object.entries(baris)) {
    if (bolehDilihatInvestor(k).allowed) tampak[k] = v;
    else dibuang.push(k);
  }

  return { visible: tampak, removedCount: dibuang.length, removedFields: dibuang };
}
