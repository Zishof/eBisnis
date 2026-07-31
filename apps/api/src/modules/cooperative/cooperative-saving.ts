/**
 * Aturan simpanan koperasi — fungsi murni.
 *
 * Tiga hal yang menentukan bentuk berkas ini:
 *
 * 1. **Simpanan pokok dan wajib tidak dapat ditarik selama keanggotaan
 *    berjalan.** Keduanya modal koperasi, bukan tabungan. Menariknya berarti
 *    keluar dari keanggotaan, dan itu melewati jalur pemberhentian.
 * 2. **Saldo adalah proyeksi dari buku transaksinya**, bukan kolom yang
 *    disunting. Kolom saldo yang dapat ditulis langsung adalah kolom yang cepat
 *    atau lambat tidak lagi cocok dengan mutasinya.
 * 3. **Lunasnya simpanan pokok mengaktifkan keanggotaan.** Itulah penghubung
 *    K-2 dan K-3, dan satu-satunya jalan seseorang menjadi anggota penuh.
 */

// ------------------------------------------------------------- Jenis simpanan

export const SAVING_KINDS = ['PRINCIPAL', 'MANDATORY', 'VOLUNTARY', 'TIME_DEPOSIT'] as const;
export type SavingKind = (typeof SAVING_KINDS)[number];

/**
 * Sifat tiap jenis simpanan.
 *
 * Dinyatakan sebagai data, bukan tersebar sebagai `if` di banyak tempat.
 * Menambah jenis simpanan baru kelak berarti menambah satu entri di sini, dan
 * seluruh aturan ikut berlaku tanpa ada yang terlewat.
 */
export interface SifatSimpanan {
  /** Dapat ditarik selama keanggotaan berjalan. */
  withdrawable: boolean;
  /** Termasuk modal koperasi (ekuitas), bukan kewajiban. */
  isEquity: boolean;
  /** Disetor berkala. */
  periodic: boolean;
  /** Ikut menentukan jasa modal pada perhitungan SHU. */
  countsForCapitalService: boolean;
}

export const SIFAT: Record<SavingKind, SifatSimpanan> = {
  // Sekali bayar saat masuk. Modal koperasi; kembalinya hanya saat berhenti.
  PRINCIPAL: { withdrawable: false, isEquity: true, periodic: false, countsForCapitalService: true },
  // Berkala. Modal koperasi pula.
  MANDATORY: { withdrawable: false, isEquity: true, periodic: true, countsForCapitalService: true },
  // Dapat ditarik sewaktu-waktu. Kewajiban koperasi kepada anggota, bukan modal.
  VOLUNTARY: { withdrawable: true, isEquity: false, periodic: false, countsForCapitalService: false },
  // Berjangka; dapat ditarik setelah jatuh tempo.
  TIME_DEPOSIT: { withdrawable: true, isEquity: false, periodic: false, countsForCapitalService: false },
};

export interface Verdict {
  allowed: boolean;
  message?: string;
}

// ----------------------------------------------------------------- Transaksi

export const SAVING_TRANSACTION_TYPES = [
  'DEPOSIT',
  'WITHDRAWAL',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'PROFIT_SHARING',
  'ADMIN_FEE',
  'CORRECTION_IN',
  'CORRECTION_OUT',
  'CLOSING_PAYOUT',
] as const;
export type SavingTransactionType = (typeof SAVING_TRANSACTION_TYPES)[number];

/** Arah tiap jenis transaksi terhadap saldo. */
export const ARAH: Record<SavingTransactionType, 1 | -1> = {
  DEPOSIT: 1,
  WITHDRAWAL: -1,
  TRANSFER_IN: 1,
  TRANSFER_OUT: -1,
  PROFIT_SHARING: 1,
  ADMIN_FEE: -1,
  CORRECTION_IN: 1,
  CORRECTION_OUT: -1,
  CLOSING_PAYOUT: -1,
};

export interface Mutasi {
  transactionType: SavingTransactionType;
  amount: number;
}

/**
 * Saldo dari rangkaian mutasinya.
 *
 * Inilah kebenarannya. Kolom saldo pada basis data adalah cache yang dapat
 * dibangun ulang dari fungsi ini kapan saja — dan uji rekonsiliasi pada K-8
 * membangunnya ulang untuk membuktikan keduanya cocok.
 */
export function saldoDari(mutasi: Mutasi[]): number {
  return mutasi.reduce((n, m) => n + ARAH[m.transactionType] * m.amount, 0);
}

// -------------------------------------------------------------- Penyetoran

export interface SetorInput {
  kind: SavingKind;
  amount: number;
  accountStatus: string;
  memberStatus: string;
}

export function bolehSetor(input: SetorInput): Verdict {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { allowed: false, message: 'Nilai setoran harus lebih besar dari nol.' };
  }
  if (input.accountStatus === 'CLOSED') {
    return { allowed: false, message: 'Rekening sudah ditutup.' };
  }
  if (input.memberStatus === 'TERMINATED') {
    return {
      allowed: false,
      message: 'Keanggotaan sudah berakhir. Setoran tidak dapat diterima.',
    };
  }
  /*
   * Simpanan pokok justru DISETOR saat masih calon anggota — itulah yang
   * mengaktifkan keanggotaannya. Jenis lain menunggu sampai ia anggota penuh.
   */
  if (input.kind !== 'PRINCIPAL' && input.memberStatus !== 'ACTIVE') {
    return {
      allowed: false,
      message:
        'Hanya simpanan pokok yang dapat disetor sebelum keanggotaan aktif. Lunasi simpanan pokok terlebih dahulu.',
    };
  }
  return { allowed: true };
}

// -------------------------------------------------------------- Penarikan

export interface TarikInput {
  kind: SavingKind;
  amount: number;
  balance: number;
  minimumBalance: number;
  accountStatus: string;
  memberStatus: string;
  /** Untuk simpanan berjangka. */
  maturityDate?: string | null;
  today?: string;
  /** Benar bila penarikan adalah bagian dari penutupan keanggotaan. */
  partOfTermination?: boolean;
}

/**
 * Bolehkah menarik?
 *
 * Aturan yang paling sering ditanyakan anggota, dan paling sering
 * disalahpahami: simpanan pokok dan wajib **tidak** dapat ditarik. Keduanya
 * modal koperasi. Uang itu kembali saat ia berhenti menjadi anggota, bukan
 * sebelumnya.
 */
export function bolehTarik(input: TarikInput): Verdict {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { allowed: false, message: 'Nilai penarikan harus lebih besar dari nol.' };
  }
  if (input.accountStatus === 'CLOSED') {
    return { allowed: false, message: 'Rekening sudah ditutup.' };
  }

  const sifat = SIFAT[input.kind];

  if (!sifat.withdrawable && !input.partOfTermination) {
    return {
      allowed: false,
      // Menerangkan sebabnya, bukan sekadar menolak. Anggota yang mengerti
      // bahwa itu modalnya tidak akan merasa uangnya ditahan sewenang-wenang.
      message:
        input.kind === 'PRINCIPAL'
          ? 'Simpanan pokok adalah modal keanggotaan dan tidak dapat ditarik selama Anda masih menjadi anggota. Nilainya dikembalikan saat keanggotaan berakhir.'
          : 'Simpanan wajib adalah modal koperasi dan tidak dapat ditarik selama keanggotaan berjalan. Nilainya diperhitungkan saat keanggotaan berakhir.',
    };
  }

  if (input.memberStatus === 'SUSPENDED') {
    return { allowed: false, message: 'Keanggotaan sedang dibekukan; penarikan ditahan.' };
  }

  if (input.kind === 'TIME_DEPOSIT' && input.maturityDate && input.today) {
    if (input.today < input.maturityDate) {
      return {
        allowed: false,
        message: `Simpanan berjangka baru dapat dicairkan pada ${input.maturityDate}.`,
      };
    }
  }

  const sesudah = input.balance - input.amount;
  const batas = input.partOfTermination ? 0 : input.minimumBalance;
  if (sesudah < batas) {
    return {
      allowed: false,
      message:
        batas > 0
          ? `Saldo tersisa akan menjadi ${sesudah}, di bawah saldo minimum ${batas}. Maksimal yang dapat ditarik ${input.balance - batas}.`
          : `Saldo tidak mencukupi. Tersedia ${input.balance}, diminta ${input.amount}.`,
    };
  }

  return { allowed: true };
}

// ------------------------------------------------ Pengaktifan dari simpanan pokok

export interface KemajuanPokok {
  required: number;
  paid: number;
}

export interface HasilPokok {
  lunas: boolean;
  kurang: number;
  /** Benar bila setoran ini yang membuatnya lunas — pemicu pengaktifan. */
  baruSajaLunas: boolean;
}

/**
 * Kemajuan pembayaran simpanan pokok.
 *
 * `baruSajaLunas` yang dipakai layanan sebagai pemicu pengaktifan keanggotaan.
 * Dibedakan dari `lunas` supaya setoran berikutnya pada rekening yang sudah
 * lunas tidak memicu pengaktifan berulang.
 */
export function kemajuanPokok(sebelum: number, setoran: number, required: number): HasilPokok {
  const sesudah = sebelum + setoran;
  return {
    lunas: sesudah >= required,
    kurang: Math.max(0, required - sesudah),
    baruSajaLunas: sebelum < required && sesudah >= required,
  };
}

// ------------------------------------------------------ Simpanan wajib berkala

export interface TunggakanInput {
  /** Periode yang seharusnya sudah disetor, format YYYY-MM. */
  expectedPeriods: string[];
  paidPeriods: string[];
  amountPerPeriod: number;
}

export interface Tunggakan {
  missingPeriods: string[];
  totalArrears: number;
}

/**
 * Tunggakan simpanan wajib.
 *
 * Dihitung dari periode, bukan dari selisih nilai. Anggota yang menyetor dua
 * kali lipat pada satu bulan tidak dengan sendirinya melunasi bulan yang
 * terlewat — keduanya periode yang berbeda, dan SHU jasa modal dihitung per
 * periode.
 */
export function hitungTunggakan(input: TunggakanInput): Tunggakan {
  const dibayar = new Set(input.paidPeriods);
  const missingPeriods = input.expectedPeriods.filter((p) => !dibayar.has(p));
  return {
    missingPeriods,
    totalArrears: missingPeriods.length * input.amountPerPeriod,
  };
}

/** Daftar periode bulanan antara dua tanggal, inklusif. */
export function periodeBulanan(dari: string, sampai: string): string[] {
  const hasil: string[] = [];
  let [th, bl] = dari.slice(0, 7).split('-').map(Number);
  const [thAkhir, blAkhir] = sampai.slice(0, 7).split('-').map(Number);
  while (th < thAkhir || (th === thAkhir && bl <= blAkhir)) {
    hasil.push(`${th}-${String(bl).padStart(2, '0')}`);
    bl += 1;
    if (bl > 12) {
      bl = 1;
      th += 1;
    }
  }
  return hasil;
}

// ---------------------------------------------------------------- Dormansi

/**
 * Apakah rekening layak ditandai tidak aktif?
 *
 * Rekening sukarela yang lama tidak bergerak ditandai dormant supaya tidak ikut
 * terhitung sebagai dana aktif pada laporan likuiditas. Simpanan pokok dan
 * wajib **tidak pernah** dormant — keduanya memang tidak bergerak menurut
 * sifatnya, dan menandainya dormant akan menyatakan seluruh anggota tidak aktif.
 */
export function layakDormant(
  kind: SavingKind,
  lastMovementAt: string | null,
  today: string,
  dormantAfterDays: number,
): boolean {
  if (SIFAT[kind].isEquity) return false;
  if (!lastMovementAt) return false;
  const selisih =
    (Date.parse(today) - Date.parse(lastMovementAt)) / (1000 * 60 * 60 * 24);
  return selisih >= dormantAfterDays;
}

// ------------------------------------------------------------------ Penutupan

export interface TutupInput {
  kind: SavingKind;
  balance: number;
  memberStatus: string;
}

export function bolehTutupRekening(input: TutupInput): Verdict {
  if (SIFAT[input.kind].isEquity && input.memberStatus !== 'TERMINATED') {
    return {
      allowed: false,
      message:
        'Rekening simpanan pokok dan wajib hanya dapat ditutup bersamaan dengan berakhirnya keanggotaan.',
    };
  }
  if (input.balance < 0) {
    return { allowed: false, message: 'Saldo rekening negatif; selesaikan lebih dahulu.' };
  }
  return { allowed: true };
}

// -------------------------------------------------------------- Bagi hasil

/**
 * Bagi hasil simpanan berjangka.
 *
 * Memakai saldo rata-rata harian, bukan saldo akhir. Saldo akhir memungkinkan
 * seseorang menyetor besar pada hari terakhir dan memperoleh bagi hasil sebulan
 * penuh atasnya.
 */
export function bagiHasil(
  saldoRataRata: number,
  nisbahAtauRateTahunan: number,
  hari: number,
): number {
  if (saldoRataRata <= 0 || nisbahAtauRateTahunan <= 0 || hari <= 0) return 0;
  // Dibulatkan ke rupiah penuh; pecahan rupiah tidak dapat dibayarkan.
  return Math.round((saldoRataRata * nisbahAtauRateTahunan * hari) / 365);
}

/**
 * Saldo rata-rata harian dari rangkaian mutasi bertanggal.
 *
 * Ditulis tersendiri supaya dapat diuji terhadap contoh yang dihitung tangan.
 */
export function saldoRataRataHarian(
  mutasi: Array<{ date: string; transactionType: SavingTransactionType; amount: number }>,
  dari: string,
  sampai: string,
): number {
  const hariTotal = Math.round((Date.parse(sampai) - Date.parse(dari)) / 86_400_000) + 1;
  if (hariTotal <= 0) return 0;

  const urut = [...mutasi].sort((a, b) => a.date.localeCompare(b.date));
  let saldo = 0;
  let tanggal = dari;
  let jumlahTertimbang = 0;

  for (const m of urut) {
    if (m.date > sampai) break;
    if (m.date > tanggal) {
      const hari = Math.round((Date.parse(m.date) - Date.parse(tanggal)) / 86_400_000);
      jumlahTertimbang += saldo * hari;
      tanggal = m.date;
    }
    saldo += ARAH[m.transactionType] * m.amount;
  }

  const sisaHari = Math.round((Date.parse(sampai) - Date.parse(tanggal)) / 86_400_000) + 1;
  jumlahTertimbang += saldo * Math.max(0, sisaHari);

  return jumlahTertimbang / hariTotal;
}
