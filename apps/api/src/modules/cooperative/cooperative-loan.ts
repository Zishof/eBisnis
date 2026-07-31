/**
 * Aturan pinjaman dan pembiayaan koperasi — fungsi murni.
 *
 * Berkas ini menghitung uang. Setiap fungsi di sini menentukan berapa yang
 * harus dibayar anggota, dan kesalahan sekecil apa pun di sini terbawa ke
 * setiap angsuran selama bertahun-tahun. Karena itu:
 *
 * - seluruh perhitungan **dibulatkan ke rupiah penuh** pada saat pembentukan
 *   jadwal, bukan dibiarkan berpecahan lalu dibulatkan saat ditampilkan;
 * - **selisih pembulatan dibebankan pada angsuran terakhir**, sehingga jumlah
 *   seluruh angsuran selalu persis sama dengan kewajibannya;
 * - **jadwal dibekukan saat pencairan.** Perubahan sesudahnya selalu berupa
 *   restrukturisasi yang membentuk jadwal baru, bukan penyuntingan jadwal lama.
 *   Jadwal yang disunting diam-diam membuat riwayat tunggakan anggota tidak
 *   dapat dipertanggungjawabkan.
 */

// ------------------------------------------------------------ Jenis produk

export const LOAN_METHODS = [
  'FLAT',
  'EFFECTIVE',
  'ANNUITY',
  'MURABAHA',
  'MUDHARABAH',
  'IJARAH',
  'QARDH',
] as const;
export type LoanMethod = (typeof LOAN_METHODS)[number];

/** Metode yang memakai akad syariah — tidak mengenal bunga sama sekali. */
export const METODE_SYARIAH: LoanMethod[] = ['MURABAHA', 'MUDHARABAH', 'IJARAH', 'QARDH'];

export function isSyariah(method: LoanMethod): boolean {
  return METODE_SYARIAH.includes(method);
}

export interface Verdict {
  allowed: boolean;
  message?: string;
}

/**
 * Kesesuaian produk dengan jenis koperasi.
 *
 * Koperasi syariah tidak memakai bunga — bukan memakai istilah lain untuk hal
 * yang sama. Dan koperasi konvensional yang memakai akad murabahah tanpa Dewan
 * Pengawas Syariah menjual sesuatu yang tidak dapat dipertanggungjawabkan
 * kesyariahannya.
 */
export function metodeSesuai(method: LoanMethod, koperasiSyariah: boolean): Verdict {
  if (koperasiSyariah && !isSyariah(method)) {
    return {
      allowed: false,
      message:
        'Koperasi syariah tidak memakai produk berbunga. Gunakan akad murabahah, mudharabah, ijarah, atau qardh.',
    };
  }
  if (!koperasiSyariah && isSyariah(method)) {
    return {
      allowed: false,
      message:
        'Akad syariah menuntut koperasi berjenis syariah beserta Dewan Pengawas Syariahnya.',
    };
  }
  return { allowed: true };
}

// ------------------------------------------------------------- Kelayakan

export interface KelayakanPinjamanInput {
  memberStatus: string;
  memberSince: string | null;
  today: string;
  /** Bulan minimum menjadi anggota sebelum boleh meminjam. */
  minimumMembershipMonths: number;
  mandatorySavingBalance: number;
  minimumMandatorySaving: number;
  /** Rasio maksimum pinjaman terhadap simpanan. Nol berarti tanpa batas. */
  maxLoanToSavingRatio: number;
  totalSavingBalance: number;
  requestedAmount: number;
  productMinAmount: number;
  productMaxAmount: number;
  activeLoanCount: number;
  productMaxActiveLoans: number;
  outstandingArrears: number;
  hasWriteOffHistory: boolean;
}

export interface Kekurangan {
  code: string;
  message: string;
}

/**
 * Syarat yang belum terpenuhi untuk mengajukan pinjaman.
 *
 * Mengembalikan **seluruh** kekurangan sekaligus, seperti pada K-1 dan K-2.
 */
export function periksaKelayakanPinjaman(input: KelayakanPinjamanInput): Kekurangan[] {
  const kurang: Kekurangan[] = [];

  /*
   * Calon anggota tidak boleh meminjam. Aturan ini muncul untuk kelima kalinya
   * pada modul koperasi — di sinilah akibatnya paling nyata: meminjamkan uang
   * kepada orang yang bukan anggota adalah usaha simpan pinjam kepada umum,
   * yang memerlukan izin berbeda sama sekali.
   */
  if (input.memberStatus !== 'ACTIVE') {
    kurang.push({
      code: 'NOT_ACTIVE_MEMBER',
      message:
        input.memberStatus === 'PENDING_PRINCIPAL_SAVING' || input.memberStatus === 'APPROVED'
          ? 'Simpanan pokok belum lunas. Hanya anggota penuh yang dapat mengajukan pinjaman.'
          : `Keanggotaan berstatus ${input.memberStatus} tidak dapat mengajukan pinjaman.`,
    });
  }

  if (input.minimumMembershipMonths > 0) {
    if (!input.memberSince) {
      kurang.push({ code: 'MEMBER_SINCE_UNKNOWN', message: 'Tanggal keanggotaan belum tercatat.' });
    } else {
      const bulan = selisihBulan(input.memberSince, input.today);
      if (bulan < input.minimumMembershipMonths) {
        kurang.push({
          code: 'MEMBERSHIP_TOO_SHORT',
          message: `Masa keanggotaan baru ${bulan} bulan; produk ini menuntut sekurang-kurangnya ${input.minimumMembershipMonths} bulan.`,
        });
      }
    }
  }

  if (input.mandatorySavingBalance < input.minimumMandatorySaving) {
    kurang.push({
      code: 'MANDATORY_SAVING_INSUFFICIENT',
      message: `Simpanan wajib baru ${input.mandatorySavingBalance}; produk ini menuntut sekurang-kurangnya ${input.minimumMandatorySaving}.`,
    });
  }

  if (input.requestedAmount < input.productMinAmount) {
    kurang.push({
      code: 'BELOW_MINIMUM',
      message: `Nilai pengajuan di bawah batas minimum ${input.productMinAmount}.`,
    });
  }
  if (input.productMaxAmount > 0 && input.requestedAmount > input.productMaxAmount) {
    kurang.push({
      code: 'ABOVE_MAXIMUM',
      message: `Nilai pengajuan melebihi plafon produk ${input.productMaxAmount}.`,
    });
  }

  if (input.maxLoanToSavingRatio > 0) {
    const batas = input.totalSavingBalance * input.maxLoanToSavingRatio;
    if (input.requestedAmount > batas) {
      kurang.push({
        code: 'ABOVE_SAVING_RATIO',
        message: `Pengajuan melebihi ${input.maxLoanToSavingRatio}× simpanan. Maksimal yang dapat diajukan ${Math.floor(batas)}.`,
      });
    }
  }

  if (input.productMaxActiveLoans > 0 && input.activeLoanCount >= input.productMaxActiveLoans) {
    kurang.push({
      code: 'TOO_MANY_ACTIVE_LOANS',
      message: `Sudah ada ${input.activeLoanCount} pinjaman berjalan; produk ini membatasi ${input.productMaxActiveLoans}.`,
    });
  }

  if (input.outstandingArrears > 0) {
    kurang.push({
      code: 'HAS_ARREARS',
      message: `Masih ada tunggakan ${input.outstandingArrears} pada pinjaman berjalan.`,
    });
  }

  if (input.hasWriteOffHistory) {
    kurang.push({
      code: 'WRITE_OFF_HISTORY',
      message:
        'Pernah memiliki pinjaman yang dihapusbukukan. Pengajuan baru memerlukan persetujuan khusus pengurus.',
    });
  }

  return kurang;
}

export function layakMeminjam(input: KelayakanPinjamanInput): boolean {
  return periksaKelayakanPinjaman(input).length === 0;
}

export function selisihBulan(dari: string, sampai: string): number {
  const [t1, b1, h1] = dari.slice(0, 10).split('-').map(Number);
  const [t2, b2, h2] = sampai.slice(0, 10).split('-').map(Number);
  let bulan = (t2 - t1) * 12 + (b2 - b1);
  if (h2 < h1) bulan -= 1;
  return Math.max(0, bulan);
}

// ------------------------------------------------------------ Jadwal angsuran

export interface BarisAngsuran {
  installmentNo: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  remainingPrincipal: number;
}

export interface JadwalInput {
  method: LoanMethod;
  principal: number;
  /** Tarif per TAHUN untuk EFFECTIVE/ANNUITY; per tahun pula untuk FLAT. */
  annualRate: number;
  /** Untuk murabahah: margin total, bukan tarif. */
  totalMargin?: number;
  tenorMonths: number;
  firstDueDate: string;
}

/**
 * Membentuk jadwal angsuran.
 *
 * Selisih pembulatan dibebankan pada angsuran **terakhir**. Membebankannya di
 * awal akan membuat angsuran pertama berbeda dari yang disebutkan saat akad,
 * dan itulah angka yang diingat anggota.
 */
export function bentukJadwal(input: JadwalInput): BarisAngsuran[] {
  const n = Math.max(1, Math.floor(input.tenorMonths));
  const pokok = Math.round(input.principal);

  switch (input.method) {
    case 'FLAT':
      return jadwalFlat(pokok, input.annualRate, n, input.firstDueDate);
    case 'EFFECTIVE':
      return jadwalEfektif(pokok, input.annualRate, n, input.firstDueDate);
    case 'ANNUITY':
      return jadwalAnuitas(pokok, input.annualRate, n, input.firstDueDate);
    case 'MURABAHA':
    case 'IJARAH':
      // Margin murabahah dan ujrah ijarah ditetapkan sebagai NILAI TOTAL saat
      // akad, bukan sebagai tarif yang berjalan. Keduanya tidak berubah
      // meskipun pelunasan dipercepat — itulah pembedanya dari bunga.
      return jadwalMarginTetap(pokok, Math.round(input.totalMargin ?? 0), n, input.firstDueDate);
    case 'QARDH':
      // Pinjaman kebajikan: tanpa margin sama sekali.
      return jadwalMarginTetap(pokok, 0, n, input.firstDueDate);
    case 'MUDHARABAH':
      // Bagi hasil dihitung dari laba usaha yang belum diketahui saat akad,
      // sehingga jadwalnya hanya memuat pokok. Bagi hasilnya dicatat terpisah
      // setiap kali laba dilaporkan.
      return jadwalMarginTetap(pokok, 0, n, input.firstDueDate);
    default:
      return jadwalFlat(pokok, input.annualRate, n, input.firstDueDate);
  }
}

/** Bunga flat: dihitung dari pokok awal, tetap sepanjang tenor. */
function jadwalFlat(pokok: number, rate: number, n: number, mulai: string): BarisAngsuran[] {
  const bungaTotal = Math.round((pokok * rate * n) / 12);
  return sebarkan(pokok, bungaTotal, n, mulai);
}

/** Margin tetap: murabahah, ijarah, qardh. */
function jadwalMarginTetap(pokok: number, margin: number, n: number, mulai: string): BarisAngsuran[] {
  return sebarkan(pokok, margin, n, mulai);
}

/**
 * Menyebar pokok dan beban ke n angsuran, selisih pembulatan ke angsuran akhir.
 */
function sebarkan(pokok: number, beban: number, n: number, mulai: string): BarisAngsuran[] {
  const pokokPer = Math.floor(pokok / n);
  const bebanPer = Math.floor(beban / n);
  const baris: BarisAngsuran[] = [];
  let sisa = pokok;

  for (let i = 1; i <= n; i += 1) {
    const terakhir = i === n;
    const p = terakhir ? sisa : pokokPer;
    const b = terakhir ? beban - bebanPer * (n - 1) : bebanPer;
    sisa -= p;
    baris.push({
      installmentNo: i,
      dueDate: tambahBulan(mulai, i - 1),
      principalDue: p,
      interestDue: b,
      totalDue: p + b,
      remainingPrincipal: sisa,
    });
  }
  return baris;
}

/** Bunga efektif: dihitung dari sisa pokok, pokok dibayar rata. */
function jadwalEfektif(pokok: number, rate: number, n: number, mulai: string): BarisAngsuran[] {
  const pokokPer = Math.floor(pokok / n);
  const bulanan = rate / 12;
  const baris: BarisAngsuran[] = [];
  let sisa = pokok;

  for (let i = 1; i <= n; i += 1) {
    const p = i === n ? sisa : pokokPer;
    const b = Math.round(sisa * bulanan);
    sisa -= p;
    baris.push({
      installmentNo: i,
      dueDate: tambahBulan(mulai, i - 1),
      principalDue: p,
      interestDue: b,
      totalDue: p + b,
      remainingPrincipal: sisa,
    });
  }
  return baris;
}

/** Anuitas: angsuran total tetap, komposisi pokok dan bunga berubah. */
function jadwalAnuitas(pokok: number, rate: number, n: number, mulai: string): BarisAngsuran[] {
  const i = rate / 12;
  if (i === 0) return sebarkan(pokok, 0, n, mulai);

  const faktor = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  const angsuran = Math.round(pokok * faktor);
  const baris: BarisAngsuran[] = [];
  let sisa = pokok;

  for (let k = 1; k <= n; k += 1) {
    const bunga = Math.round(sisa * i);
    let p = angsuran - bunga;
    if (k === n) p = sisa; // angsuran terakhir melunasi sisanya, apa pun pembulatannya
    sisa -= p;
    baris.push({
      installmentNo: k,
      dueDate: tambahBulan(mulai, k - 1),
      principalDue: p,
      interestDue: bunga,
      totalDue: p + bunga,
      remainingPrincipal: sisa,
    });
  }
  return baris;
}

/** Menambah bulan pada tanggal, menjaga akhir bulan tetap sah. */
export function tambahBulan(tanggal: string, bulan: number): string {
  const [t, b, h] = tanggal.slice(0, 10).split('-').map(Number);
  const total = b - 1 + bulan;
  const tahunBaru = t + Math.floor(total / 12);
  const bulanBaru = (total % 12) + 1;
  const hariMaks = new Date(Date.UTC(tahunBaru, bulanBaru, 0)).getUTCDate();
  const hariBaru = Math.min(h, hariMaks);
  return `${tahunBaru}-${String(bulanBaru).padStart(2, '0')}-${String(hariBaru).padStart(2, '0')}`;
}

/** Jumlah seluruh angsuran — dipakai memeriksa keutuhan jadwal. */
export function totalJadwal(jadwal: BarisAngsuran[]): {
  principal: number;
  interest: number;
  total: number;
} {
  return jadwal.reduce(
    (a, b) => ({
      principal: a.principal + b.principalDue,
      interest: a.interest + b.interestDue,
      total: a.total + b.totalDue,
    }),
    { principal: 0, interest: 0, total: 0 },
  );
}

// -------------------------------------------------------- Alokasi pembayaran

export interface AlokasiInput {
  amount: number;
  penaltyDue: number;
  interestDue: number;
  principalDue: number;
}

export interface HasilAlokasi {
  toPenalty: number;
  toInterest: number;
  toPrincipal: number;
  excess: number;
}

/**
 * Membagi pembayaran ke denda, jasa, lalu pokok.
 *
 * Urutannya bukan sembarang: mendahulukan pokok akan membuat denda dan jasa
 * menumpuk tanpa pernah terbayar, dan tunggakan anggota terus bertambah
 * meskipun ia membayar setiap bulan. Urutan denda → jasa → pokok adalah praktik
 * baku, dan menyimpang darinya harus merupakan keputusan sadar pengurus.
 */
export function alokasikanPembayaran(input: AlokasiInput): HasilAlokasi {
  let sisa = Math.max(0, input.amount);

  const toPenalty = Math.min(sisa, Math.max(0, input.penaltyDue));
  sisa -= toPenalty;

  const toInterest = Math.min(sisa, Math.max(0, input.interestDue));
  sisa -= toInterest;

  const toPrincipal = Math.min(sisa, Math.max(0, input.principalDue));
  sisa -= toPrincipal;

  return { toPenalty, toInterest, toPrincipal, excess: sisa };
}

// ------------------------------------------------------------------- Denda

export interface DendaInput {
  overdueAmount: number;
  daysLate: number;
  /** Tarif denda harian, mis. 0.001 untuk 0,1% per hari. */
  dailyRate: number;
  gracePeriodDays: number;
  /** Batas denda sebagai kelipatan nilai tertunggak. Nol berarti tanpa batas. */
  maxMultiplier: number;
}

/**
 * Denda keterlambatan.
 *
 * Dibatasi kelipatan nilai tertunggak dengan sengaja. Tanpa batas, denda pada
 * pinjaman yang lama menunggak dapat melampaui pokoknya sendiri — dan tagihan
 * yang mustahil dibayar tidak menolong siapa pun: anggotanya menyerah,
 * koperasinya tidak menerima apa-apa.
 */
export function hitungDenda(input: DendaInput): number {
  const hari = input.daysLate - input.gracePeriodDays;
  if (hari <= 0 || input.overdueAmount <= 0 || input.dailyRate <= 0) return 0;
  const denda = Math.round(input.overdueAmount * input.dailyRate * hari);
  if (input.maxMultiplier > 0) {
    return Math.min(denda, Math.round(input.overdueAmount * input.maxMultiplier));
  }
  return denda;
}

// --------------------------------------------------------- Tunggakan dan PAR

export const RISK_CLASSES = ['CURRENT', 'SPECIAL_MENTION', 'SUBSTANDARD', 'DOUBTFUL', 'LOSS'] as const;
export type RiskClass = (typeof RISK_CLASSES)[number];

/**
 * Golongan risiko menurut lamanya menunggak.
 *
 * Mengikuti penggolongan yang lazim dipakai pengawas koperasi Indonesia.
 * Batasnya ditulis sebagai data supaya dapat disesuaikan kebijakan koperasi
 * tanpa mengubah kode.
 */
export const BATAS_RISIKO: Array<{ maxDays: number; kelas: RiskClass; provisionRate: number }> = [
  { maxDays: 0, kelas: 'CURRENT', provisionRate: 0.005 },
  { maxDays: 90, kelas: 'SPECIAL_MENTION', provisionRate: 0.1 },
  { maxDays: 180, kelas: 'SUBSTANDARD', provisionRate: 0.5 },
  { maxDays: 270, kelas: 'DOUBTFUL', provisionRate: 0.75 },
  { maxDays: Infinity, kelas: 'LOSS', provisionRate: 1 },
];

export function golonganRisiko(daysOverdue: number): RiskClass {
  for (const b of BATAS_RISIKO) {
    if (daysOverdue <= b.maxDays) return b.kelas;
  }
  return 'LOSS';
}

/** Penyisihan piutang tak tertagih menurut golongan risikonya. */
export function hitungPenyisihan(outstanding: number, daysOverdue: number): number {
  const kelas = golonganRisiko(daysOverdue);
  const b = BATAS_RISIKO.find((x) => x.kelas === kelas);
  return Math.round(outstanding * (b?.provisionRate ?? 0));
}

export interface PortfolioItem {
  outstanding: number;
  daysOverdue: number;
}

/**
 * Portfolio at Risk — bagian portofolio yang menunggak lebih dari N hari.
 *
 * Dihitung dari **seluruh sisa pinjaman** yang menunggak, bukan hanya dari
 * angsuran yang tertunggak. Anggota yang menunggak satu angsuran dari dua puluh
 * tetap membawa risiko atas seluruh sisa pinjamannya, dan PAR yang menghitung
 * angsurannya saja akan menyatakan portofolio jauh lebih sehat daripada
 * sebenarnya.
 */
export function hitungPar(items: PortfolioItem[], thresholdDays: number): {
  totalPortfolio: number;
  atRisk: number;
  ratio: number;
} {
  const totalPortfolio = items.reduce((n, i) => n + i.outstanding, 0);
  const atRisk = items
    .filter((i) => i.daysOverdue > thresholdDays)
    .reduce((n, i) => n + i.outstanding, 0);
  return {
    totalPortfolio,
    atRisk,
    ratio: totalPortfolio > 0 ? atRisk / totalPortfolio : 0,
  };
}

// -------------------------------------------------------- Pelunasan dipercepat

export interface PelunasanInput {
  method: LoanMethod;
  remainingPrincipal: number;
  /** Jasa/margin yang belum jatuh tempo. */
  unearnedInterest: number;
  accruedPenalty: number;
  /** Potongan jasa bila dilunasi lebih awal, 0..1. */
  earlySettlementDiscount: number;
}

export interface HasilPelunasan {
  principal: number;
  interest: number;
  penalty: number;
  total: number;
  note: string;
}

/**
 * Nilai pelunasan dipercepat.
 *
 * Pada akad **murabahah**, margin sudah menjadi bagian harga jual yang
 * disepakati saat akad — ia bukan bunga berjalan. Secara syariah margin itu
 * tetap terutang, meskipun koperasi **boleh** memberikan potongan sukarela
 * (muqasah) yang tidak diperjanjikan di muka. Karena itu perhitungannya
 * dibedakan, dan keterangannya ikut dikembalikan supaya dapat ditampilkan
 * kepada anggota.
 */
export function hitungPelunasan(input: PelunasanInput): HasilPelunasan {
  if (input.method === 'MURABAHA' || input.method === 'IJARAH') {
    const potongan = Math.round(input.unearnedInterest * input.earlySettlementDiscount);
    const margin = input.unearnedInterest - potongan;
    return {
      principal: input.remainingPrincipal,
      interest: margin,
      penalty: input.accruedPenalty,
      total: input.remainingPrincipal + margin + input.accruedPenalty,
      note:
        potongan > 0
          ? `Margin akad tetap terutang; koperasi memberikan potongan sukarela (muqasah) sebesar ${potongan}.`
          : 'Margin akad tetap terutang penuh karena telah disepakati saat akad.',
    };
  }

  // Konvensional: jasa yang belum berjalan tidak ditagih.
  return {
    principal: input.remainingPrincipal,
    interest: 0,
    penalty: input.accruedPenalty,
    total: input.remainingPrincipal + input.accruedPenalty,
    note: 'Jasa yang belum jatuh tempo tidak ditagihkan pada pelunasan dipercepat.',
  };
}

// ---------------------------------------------------------- Status pinjaman

export const LOAN_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_SURVEY',
  'UNDER_ANALYSIS',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'DISBURSED',
  'ACTIVE',
  'IN_ARREARS',
  'RESTRUCTURED',
  'SETTLED',
  'WRITTEN_OFF',
  'CANCELLED',
] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const LOAN_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_SURVEY', 'UNDER_ANALYSIS', 'REJECTED', 'CANCELLED'],
  UNDER_SURVEY: ['UNDER_ANALYSIS', 'REJECTED', 'CANCELLED'],
  UNDER_ANALYSIS: ['PENDING_APPROVAL', 'REJECTED', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['DISBURSED', 'CANCELLED'],
  REJECTED: [],
  // Pencairan dan pengaktifan dipisah: uang keluar lebih dahulu, jadwal
  // angsurannya dibekukan sesudahnya.
  DISBURSED: ['ACTIVE'],
  ACTIVE: ['IN_ARREARS', 'RESTRUCTURED', 'SETTLED', 'WRITTEN_OFF'],
  IN_ARREARS: ['ACTIVE', 'RESTRUCTURED', 'SETTLED', 'WRITTEN_OFF'],
  RESTRUCTURED: ['ACTIVE', 'IN_ARREARS', 'SETTLED', 'WRITTEN_OFF'],
  SETTLED: [],
  // Penghapusbukuan tidak menghapus kewajiban anggota; penerimaan sesudahnya
  // dicatat sebagai pemulihan, bukan dengan menghidupkan pinjamannya.
  WRITTEN_OFF: [],
  CANCELLED: [],
};

const SYARAT_PINJAMAN: Partial<Record<`${LoanStatus}->${LoanStatus}`, {
  requiresPermission?: string;
  requiresApproval?: boolean;
}>> = {
  'DRAFT->SUBMITTED': { requiresPermission: 'COOPERATIVE_LOAN_APPLICATION.SUBMIT' },
  'SUBMITTED->UNDER_SURVEY': { requiresPermission: 'COOPERATIVE_LOAN_APPLICATION.SURVEY' },
  'UNDER_SURVEY->UNDER_ANALYSIS': { requiresPermission: 'COOPERATIVE_LOAN_APPLICATION.ANALYZE' },
  'SUBMITTED->UNDER_ANALYSIS': { requiresPermission: 'COOPERATIVE_LOAN_APPLICATION.ANALYZE' },
  'UNDER_ANALYSIS->PENDING_APPROVAL': { requiresPermission: 'COOPERATIVE_LOAN_APPLICATION.ANALYZE' },
  'PENDING_APPROVAL->APPROVED': {
    requiresPermission: 'COOPERATIVE_LOAN_APPLICATION.APPROVE',
    requiresApproval: true,
  },
  'PENDING_APPROVAL->REJECTED': { requiresPermission: 'COOPERATIVE_LOAN_APPLICATION.REJECT' },
  // Mencairkan menuntut hak akses BERBEDA dari menyetujui. Memisahkan keputusan
  // dari pengeluaran uang adalah aturan pemisahan wewenang nomor 2.
  'APPROVED->DISBURSED': {
    requiresPermission: 'COOPERATIVE_LOAN.DISBURSE',
    requiresApproval: true,
  },
  'ACTIVE->RESTRUCTURED': { requiresPermission: 'COOPERATIVE_LOAN.RESTRUCTURE' },
  'IN_ARREARS->RESTRUCTURED': { requiresPermission: 'COOPERATIVE_LOAN.RESTRUCTURE' },
  'ACTIVE->WRITTEN_OFF': { requiresPermission: 'COOPERATIVE_LOAN.WRITE_OFF', requiresApproval: true },
  'IN_ARREARS->WRITTEN_OFF': {
    requiresPermission: 'COOPERATIVE_LOAN.WRITE_OFF',
    requiresApproval: true,
  },
};

export interface LoanVerdict extends Verdict {
  requiresPermission?: string;
  requiresApproval?: boolean;
}

export function bolehPindahStatusPinjaman(dari: LoanStatus, ke: LoanStatus): LoanVerdict {
  if (dari === ke) return { allowed: false, message: `Pinjaman sudah berstatus ${ke}.` };
  if (LOAN_TRANSITIONS[dari].length === 0) {
    return { allowed: false, message: `Pinjaman berstatus ${dari} sudah final.` };
  }
  if (!LOAN_TRANSITIONS[dari].includes(ke)) {
    return { allowed: false, message: `Pinjaman berstatus ${dari} tidak dapat langsung menjadi ${ke}.` };
  }
  return { allowed: true, ...(SYARAT_PINJAMAN[`${dari}->${ke}`] ?? {}) };
}

/**
 * Pemisahan wewenang pada jalur pinjaman.
 *
 * Tiga aturan sekaligus, sebab ketiganya menyangkut orang yang sama pada tahap
 * berbeda dan mudah terlewat bila diperiksa terpisah.
 */
export function periksaPemisahanWewenang(input: {
  analyzedBy: string | null;
  surveyedBy: string | null;
  approvedBy: string | null;
  disbursedBy: string | null;
  actorId: string;
  action: 'ANALYZE' | 'APPROVE' | 'DISBURSE';
}): Verdict {
  if (input.action === 'ANALYZE' && input.surveyedBy === input.actorId) {
    return {
      allowed: false,
      message: 'Anda tidak dapat menganalisis pengajuan yang Anda survei sendiri.',
    };
  }
  if (input.action === 'APPROVE' && input.analyzedBy === input.actorId) {
    return {
      allowed: false,
      message:
        'Anda tidak dapat menyetujui pengajuan yang Anda analisis sendiri. Analisis yang dibuat untuk membenarkan persetujuan yang sudah diputuskan bukan analisis.',
    };
  }
  if (input.action === 'DISBURSE' && input.approvedBy === input.actorId) {
    return {
      allowed: false,
      message:
        'Anda tidak dapat mencairkan pinjaman yang Anda setujui sendiri. Keputusan dan pengeluaran uang dipisahkan.',
    };
  }
  return { allowed: true };
}
