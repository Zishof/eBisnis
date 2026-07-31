/**
 * Aturan akuntansi koperasi — fungsi murni.
 *
 * Satu invarian menentukan bentuk berkas ini:
 *
 *   **Jumlah seluruh baris buku pembantu atas satu akun wajib sama dengan
 *   saldo akun itu di buku besar.**
 *
 * Buku pembantu anggota bukan buku besar kedua; ia rincian per anggota atas
 * akun yang sama. Bila keduanya berbeda, salah satunya salah — dan yang paling
 * berbahaya bukan selisihnya melainkan bahwa tidak ada yang tahu mana yang
 * benar. Rekonsiliasi yang dijalankan berkala menemukannya saat penyebabnya
 * masih dapat ditelusuri, bukan setahun kemudian saat RAT mempertanyakannya.
 */

// ------------------------------------------------------------ Rekonsiliasi

export interface BarisBukuPembantu {
  accountId: string;
  memberId: string;
  debit: number;
  credit: number;
}

export interface SaldoBukuBesar {
  accountId: string;
  accountCode: string;
  /** Sifat normal akun: debit untuk aset dan beban, kredit untuk selebihnya. */
  normalBalance: 'DEBIT' | 'CREDIT';
  balance: number;
}

export interface SelisihAkun {
  accountId: string;
  accountCode: string;
  subledgerBalance: number;
  ledgerBalance: number;
  difference: number;
  memberCount: number;
}

export interface HasilRekonsiliasi {
  ok: boolean;
  checkedAccounts: number;
  differences: SelisihAkun[];
  /** Akun buku besar yang tidak punya rincian buku pembantu sama sekali. */
  ledgerOnlyAccounts: string[];
  /** Akun yang punya rincian tetapi tidak ada di buku besar. */
  subledgerOnlyAccounts: string[];
}

/**
 * Membandingkan buku pembantu dengan buku besar.
 *
 * Saldo buku pembantu dihitung menurut sifat normal akunnya. Piutang pinjaman
 * bersifat debit — setoran anggota mengurangi saldonya; simpanan bersifat
 * kredit — setoran menambah. Menjumlahkan tanpa memperhatikan sifatnya akan
 * menghasilkan selisih pada setiap akun, dan laporan rekonsiliasi yang selalu
 * berselisih akan segera diabaikan orang.
 */
export function rekonsiliasi(
  subledger: BarisBukuPembantu[],
  ledger: SaldoBukuBesar[],
): HasilRekonsiliasi {
  const perAkun = new Map<string, { debit: number; credit: number; members: Set<string> }>();

  for (const b of subledger) {
    const k = perAkun.get(b.accountId) ?? { debit: 0, credit: 0, members: new Set<string>() };
    k.debit += b.debit;
    k.credit += b.credit;
    k.members.add(b.memberId);
    perAkun.set(b.accountId, k);
  }

  const petaLedger = new Map(ledger.map((l) => [l.accountId, l]));
  const differences: SelisihAkun[] = [];
  const subledgerOnlyAccounts: string[] = [];

  for (const [accountId, k] of perAkun) {
    const l = petaLedger.get(accountId);
    if (!l) {
      subledgerOnlyAccounts.push(accountId);
      continue;
    }
    const saldoPembantu = l.normalBalance === 'DEBIT' ? k.debit - k.credit : k.credit - k.debit;
    const selisih = saldoPembantu - l.balance;
    if (selisih !== 0) {
      differences.push({
        accountId,
        accountCode: l.accountCode,
        subledgerBalance: saldoPembantu,
        ledgerBalance: l.balance,
        difference: selisih,
        memberCount: k.members.size,
      });
    }
  }

  const ledgerOnlyAccounts = ledger
    .filter((l) => !perAkun.has(l.accountId) && l.balance !== 0)
    .map((l) => l.accountId);

  return {
    ok: differences.length === 0 && subledgerOnlyAccounts.length === 0,
    checkedAccounts: perAkun.size,
    differences,
    ledgerOnlyAccounts,
    subledgerOnlyAccounts,
  };
}

// ------------------------------------------------------------ Neraca saldo

export interface BarisJurnal {
  accountId: string;
  debit: number;
  credit: number;
}

export interface HasilNeracaSaldo {
  balanced: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
}

/**
 * Memeriksa keseimbangan jurnal.
 *
 * Selisih nol adalah syarat, bukan tujuan. Jurnal yang seimbang belum tentu
 * benar — tetapi jurnal yang tidak seimbang pasti salah, dan menemukannya
 * murah.
 */
export function periksaKeseimbangan(baris: BarisJurnal[]): HasilNeracaSaldo {
  const totalDebit = baris.reduce((n, b) => n + b.debit, 0);
  const totalCredit = baris.reduce((n, b) => n + b.credit, 0);
  const difference = totalDebit - totalCredit;
  return { balanced: difference === 0, totalDebit, totalCredit, difference };
}

// -------------------------------------------------------------- Neraca

export const ACCOUNT_NATURES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
] as const;
export type AccountNature = (typeof ACCOUNT_NATURES)[number];

export const SIFAT_NORMAL: Record<AccountNature, 'DEBIT' | 'CREDIT'> = {
  ASSET: 'DEBIT',
  LIABILITY: 'CREDIT',
  EQUITY: 'CREDIT',
  REVENUE: 'CREDIT',
  EXPENSE: 'DEBIT',
};

export interface SaldoBernature extends SaldoBukuBesar {
  nature: AccountNature;
}

export interface Neraca {
  totalAsset: number;
  totalLiability: number;
  totalEquity: number;
  balanced: boolean;
  difference: number;
}

/**
 * Menyusun neraca dan memeriksa persamaannya.
 *
 * Aset = Kewajiban + Ekuitas. Bila tidak seimbang, laporan tidak boleh
 * diterbitkan — bukan diterbitkan dengan catatan kaki.
 */
export function susunNeraca(saldo: SaldoBernature[]): Neraca {
  const jumlah = (n: AccountNature) =>
    saldo.filter((s) => s.nature === n).reduce((a, s) => a + s.balance, 0);

  const totalAsset = jumlah('ASSET');
  const totalLiability = jumlah('LIABILITY');
  const totalEquity = jumlah('EQUITY');
  const difference = totalAsset - (totalLiability + totalEquity);

  return { totalAsset, totalLiability, totalEquity, balanced: difference === 0, difference };
}

export interface LabaRugi {
  totalRevenue: number;
  totalExpense: number;
  surplus: number;
}

export function susunLabaRugi(saldo: SaldoBernature[]): LabaRugi {
  const totalRevenue = saldo
    .filter((s) => s.nature === 'REVENUE')
    .reduce((a, s) => a + s.balance, 0);
  const totalExpense = saldo
    .filter((s) => s.nature === 'EXPENSE')
    .reduce((a, s) => a + s.balance, 0);
  return { totalRevenue, totalExpense, surplus: totalRevenue - totalExpense };
}

// -------------------------------------------------- Modal sendiri koperasi

export interface KomposisiModal {
  principalSaving: number;
  mandatorySaving: number;
  reserve: number;
  grantCapital: number;
  undistributedSurplus: number;
  totalOwnCapital: number;
}

/**
 * Menyusun modal sendiri koperasi.
 *
 * Simpanan pokok dan wajib **termasuk** di sini; simpanan sukarela **tidak**.
 * Yang pertama tidak dapat ditarik selama keanggotaan berjalan sehingga
 * berfungsi sebagai modal; yang kedua dapat ditarik sewaktu-waktu sehingga
 * merupakan kewajiban.
 *
 * Kesalahan menggolongkannya bukan soal penyajian: rasio kesehatan koperasi
 * dihitung atas modal sendiri, dan koperasi yang tampak bermodal kecil akan
 * dinilai tidak sehat padahal sebenarnya tidak demikian.
 */
export function susunModalSendiri(input: Omit<KomposisiModal, 'totalOwnCapital'>): KomposisiModal {
  const totalOwnCapital =
    input.principalSaving +
    input.mandatorySaving +
    input.reserve +
    input.grantCapital +
    input.undistributedSurplus;
  return { ...input, totalOwnCapital };
}

// --------------------------------------------------------- Rasio kesehatan

export interface RasioKesehatan {
  /** Modal sendiri terhadap total aset. */
  capitalAdequacy: number;
  /** Piutang bermasalah terhadap total piutang. */
  nonPerformingRatio: number;
  /** Kewajiban lancar terhadap aset lancar. */
  liquidityRatio: number;
  /** Surplus terhadap total aset. */
  returnOnAsset: number;
}

export function hitungRasio(input: {
  ownCapital: number;
  totalAsset: number;
  nonPerformingLoan: number;
  totalLoan: number;
  currentAsset: number;
  currentLiability: number;
  surplus: number;
}): RasioKesehatan {
  // Pembagian nol menghasilkan nol, bukan Infinity maupun NaN. Rasio bernilai
  // Infinity pada laporan akan tampak seperti cacat sistem, dan pembacanya
  // berhenti mempercayai seluruh laporannya.
  const bagi = (a: number, b: number) => (b > 0 ? a / b : 0);
  return {
    capitalAdequacy: bagi(input.ownCapital, input.totalAsset),
    nonPerformingRatio: bagi(input.nonPerformingLoan, input.totalLoan),
    liquidityRatio: bagi(input.currentAsset, input.currentLiability),
    returnOnAsset: bagi(input.surplus, input.totalAsset),
  };
}

// -------------------------------------------------------------------- Pajak

export interface PerhitunganPajak {
  taxableBase: number;
  rate: number;
  taxAmount: number;
  note: string;
}

/**
 * Pajak penghasilan atas SHU.
 *
 * Perlakuan pajak koperasi berbeda dari perseroan dan berubah menurut
 * peraturan yang berlaku, sehingga tarifnya **tidak dikunci di dalam program**
 * melainkan diambil dari kebijakan koperasi. Fungsi ini hanya menghitung, dan
 * keterangannya ikut dikembalikan supaya laporan dapat menyebutkan dasar
 * hukumnya.
 *
 * Bagian SHU yang dibagikan kepada anggota berdasarkan jasa usaha lazimnya
 * diperlakukan berbeda dari bagian jasa modal. Pemisahan itu diserahkan kepada
 * pemanggil — bukan diputuskan di sini — sebab ia bergantung pada peraturan
 * yang berlaku saat periode buku itu berjalan.
 */
export function hitungPajakShu(input: {
  taxableBase: number;
  rate: number;
  basis: string;
}): PerhitunganPajak {
  const dasar = Math.max(0, Math.round(input.taxableBase));
  const taxAmount = Math.round(dasar * Math.max(0, input.rate));
  return {
    taxableBase: dasar,
    rate: input.rate,
    taxAmount,
    note: `Dihitung atas ${input.basis} dengan tarif ${(input.rate * 100).toFixed(2)}%.`,
  };
}

// --------------------------------------------------------- Penutupan periode

export interface SyaratPenutupan {
  allJournalsPosted: boolean;
  reconciliationOk: boolean;
  balanceSheetBalanced: boolean;
  pendingAccountingEvents: number;
  unapprovedAdjustments: number;
}

export interface Kekurangan {
  code: string;
  message: string;
}

/**
 * Apa yang masih menghalangi penutupan periode buku.
 *
 * Menutup periode adalah perbuatan yang tidak dapat dibatalkan tanpa jejak:
 * saldo dipindahkan, buku dikunci, dan angka itulah yang dibawa ke RAT. Karena
 * itu syaratnya diperiksa seluruhnya sekaligus dan disebutkan apa adanya.
 */
export function periksaPenutupan(s: SyaratPenutupan): Kekurangan[] {
  const kurang: Kekurangan[] = [];

  if (!s.allJournalsPosted) {
    kurang.push({
      code: 'UNPOSTED_JOURNALS',
      message: 'Masih ada jurnal yang belum diposting ke buku besar.',
    });
  }
  if (s.pendingAccountingEvents > 0) {
    kurang.push({
      code: 'PENDING_EVENTS',
      message: `${s.pendingAccountingEvents} peristiwa akuntansi belum terbentuk jurnalnya.`,
    });
  }
  if (!s.reconciliationOk) {
    kurang.push({
      code: 'RECONCILIATION_FAILED',
      message:
        'Jumlah buku pembantu anggota belum sama dengan saldo buku besarnya. Selesaikan selisihnya sebelum periode ditutup.',
    });
  }
  if (!s.balanceSheetBalanced) {
    kurang.push({
      code: 'BALANCE_SHEET_UNBALANCED',
      message: 'Neraca belum seimbang: aset tidak sama dengan kewajiban ditambah ekuitas.',
    });
  }
  if (s.unapprovedAdjustments > 0) {
    kurang.push({
      code: 'UNAPPROVED_ADJUSTMENTS',
      message: `${s.unapprovedAdjustments} jurnal penyesuaian belum disetujui.`,
    });
  }

  return kurang;
}

export function bolehTutupPeriode(s: SyaratPenutupan): boolean {
  return periksaPenutupan(s).length === 0;
}
