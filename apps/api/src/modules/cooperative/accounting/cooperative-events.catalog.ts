/**
 * Katalog peristiwa akuntansi koperasi.
 *
 * Ditulis penuh di sini, **belum didaftarkan ke mesin Core** — menunggu
 * [IR-003](../../../../../docs/integration-requests/cooperative/003-katalog-peristiwa-akuntansi-modular.md)
 * yang mengusulkan registri katalog per modul.
 *
 * Bentuknya sengaja mengikuti usulan pada IR itu, sehingga saat disetujui yang
 * diperlukan hanya satu baris `registry.register(COOPERATIVE_EVENT_CATALOG)`.
 *
 * **Sampai saat itu, peristiwa koperasi tercatat pada `accounting_event` tetapi
 * belum dijurnal** — `isKnownEvent()` milik Core menolaknya. Buku pembantu
 * anggota berjalan; buku besarnya belum. Disebutkan apa adanya supaya tidak ada
 * yang mengira pembukuan koperasi sudah lengkap.
 */

export interface AccountingEventCatalog {
  readonly prefix: string;
  readonly events: readonly string[];
  readonly requiredAmounts: Readonly<Record<string, readonly string[]>>;
  /** Kode pemetaan akun yang dituntut tiap peristiwa. */
  readonly requiredMappings: Readonly<Record<string, readonly string[]>>;
}

// ------------------------------------------------------------------ Simpanan

const SIMPANAN = {
  /*
   * Simpanan pokok dan wajib masuk EKUITAS, bukan kewajiban. Keduanya tidak
   * dapat ditarik selama keanggotaan berjalan. Menyamakannya dengan simpanan
   * sukarela membuat neraca menyatakan modal sendiri jauh lebih kecil daripada
   * sebenarnya — dan rasio kesehatan yang dihitung di atasnya ikut salah.
   */
  COOPERATIVE_PRINCIPAL_SAVING_RECEIVED: {
    amounts: ['amount'],
    mappings: ['CASH', 'PRINCIPAL_SAVING_EQUITY'],
  },
  COOPERATIVE_MANDATORY_SAVING_RECEIVED: {
    amounts: ['amount', 'period'],
    mappings: ['CASH', 'MANDATORY_SAVING_EQUITY'],
  },
  COOPERATIVE_VOLUNTARY_SAVING_DEPOSIT: {
    amounts: ['amount'],
    mappings: ['CASH', 'VOLUNTARY_SAVING_LIABILITY'],
  },
  COOPERATIVE_VOLUNTARY_SAVING_WITHDRAWAL: {
    amounts: ['amount'],
    mappings: ['VOLUNTARY_SAVING_LIABILITY', 'CASH'],
  },
  COOPERATIVE_SAVING_PROFIT_SHARING: {
    amounts: ['amount', 'basis'],
    mappings: ['SAVING_PROFIT_SHARING_EXPENSE', 'VOLUNTARY_SAVING_LIABILITY'],
  },
  COOPERATIVE_SAVING_CLOSED: {
    amounts: ['amount'],
    mappings: ['VOLUNTARY_SAVING_LIABILITY', 'CASH'],
  },
} as const;

// ------------------------------------------------------------------ Pinjaman

const PINJAMAN = {
  COOPERATIVE_LOAN_DISBURSED: {
    amounts: ['principal'],
    mappings: ['LOAN_RECEIVABLE', 'CASH'],
  },
  /*
   * Angsuran menuntut pokok dan jasa TERPISAH, bukan hanya totalnya. Keduanya
   * masuk akun berbeda — pokok mengurangi piutang, jasa menjadi pendapatan —
   * dan membelah totalnya kemudian berarti menebak berapa pendapatan koperasi.
   */
  COOPERATIVE_INSTALLMENT_RECEIVED: {
    amounts: ['principalPortion', 'interestPortion', 'total'],
    mappings: ['CASH', 'LOAN_RECEIVABLE', 'LOAN_INTEREST_INCOME'],
  },
  COOPERATIVE_LOAN_PENALTY_ACCRUED: {
    amounts: ['amount'],
    mappings: ['PENALTY_RECEIVABLE', 'PENALTY_INCOME'],
  },
  COOPERATIVE_LOAN_PENALTY_RECEIVED: {
    amounts: ['amount'],
    mappings: ['CASH', 'PENALTY_RECEIVABLE'],
  },
  COOPERATIVE_LOAN_PROVISION: {
    amounts: ['amount', 'riskClass'],
    mappings: ['PROVISION_EXPENSE', 'LOAN_PROVISION'],
  },
  COOPERATIVE_LOAN_WRITE_OFF: {
    amounts: ['principal', 'provisionUsed'],
    mappings: ['LOAN_PROVISION', 'LOAN_RECEIVABLE'],
  },
  /*
   * Penerimaan atas pinjaman yang sudah dihapusbukukan dicatat sebagai
   * PEMULIHAN, bukan dengan menghidupkan kembali pinjamannya. Penghapusbukuan
   * tidak menghapus kewajiban anggota; ia hanya mengeluarkan piutangnya dari
   * neraca.
   */
  COOPERATIVE_LOAN_RECOVERY: {
    amounts: ['amount'],
    mappings: ['CASH', 'RECOVERY_INCOME'],
  },
  COOPERATIVE_LOAN_RESTRUCTURED: {
    amounts: ['oldBalance', 'newBalance'],
    mappings: ['LOAN_RECEIVABLE'],
  },
} as const;

// ------------------------------------------------------------------- Syariah

/*
 * Kode terpisah, bukan kode yang sama bernama lain.
 *
 * Memakai `COOPERATIVE_LOAN_DISBURSED` untuk murabahah akan menyajikan
 * jual-beli sebagai pinjaman berbunga — cacat yang serius bagi koperasi
 * syariah dan bagi Dewan Pengawas Syariahnya. Laporan keuangan syariah pun
 * menuntut penyajian tersendiri.
 */
const SYARIAH = {
  COOPERATIVE_MURABAHA_DISBURSED: {
    amounts: ['costPrice', 'margin', 'sellingPrice'],
    mappings: ['MURABAHA_RECEIVABLE', 'DEFERRED_MARGIN', 'CASH'],
  },
  COOPERATIVE_MURABAHA_INSTALLMENT: {
    amounts: ['principalPortion', 'marginPortion', 'total'],
    mappings: ['CASH', 'MURABAHA_RECEIVABLE', 'DEFERRED_MARGIN', 'MARGIN_INCOME'],
  },
  COOPERATIVE_MUDHARABAH_PLACED: {
    amounts: ['capital'],
    mappings: ['MUDHARABAH_FINANCING', 'CASH'],
  },
  COOPERATIVE_MUDHARABAH_PROFIT_SHARE: {
    amounts: ['grossProfit', 'cooperativeShare', 'memberShare', 'nisbah'],
    mappings: ['CASH', 'MUDHARABAH_PROFIT_INCOME'],
  },
  COOPERATIVE_IJARAH_RENTAL: {
    amounts: ['rentalAmount'],
    mappings: ['CASH', 'IJARAH_INCOME'],
  },
  COOPERATIVE_QARDH_DISBURSED: {
    amounts: ['principal'],
    mappings: ['QARDH_RECEIVABLE', 'CASH'],
  },
} as const;

// ----------------------------------------------------------------------- SHU

const SHU = {
  COOPERATIVE_SURPLUS_CLOSED: {
    amounts: ['surplus'],
    mappings: ['INCOME_SUMMARY', 'UNDISTRIBUTED_SURPLUS'],
  },
  COOPERATIVE_RESERVE_ALLOCATED: {
    amounts: ['amount'],
    mappings: ['UNDISTRIBUTED_SURPLUS', 'GENERAL_RESERVE'],
  },
  COOPERATIVE_SHU_ALLOCATED: {
    amounts: ['capitalService', 'patronageService', 'socialFund', 'total'],
    mappings: ['UNDISTRIBUTED_SURPLUS', 'SHU_PAYABLE'],
  },
  COOPERATIVE_SHU_PAID: {
    amounts: ['amount'],
    mappings: ['SHU_PAYABLE', 'CASH'],
  },
} as const;

// -------------------------------------------------------- Dompet dan unit usaha

const DOMPET_UNIT = {
  COOPERATIVE_WALLET_TOPUP: {
    amounts: ['amount'],
    mappings: ['CASH', 'MEMBER_WALLET_LIABILITY'],
  },
  /*
   * Ini TIDAK menjurnal penjualannya. Penjualan di unit toko sudah dijurnal
   * mesin POS lewat `POS_SALE`; yang dijurnal di sini hanya perpindahan dari
   * kewajiban dompet ke kas — hal yang tidak diketahui POS. Bila keduanya
   * sama-sama menjurnal penjualan, pendapatan koperasi tercatat dua kali.
   */
  COOPERATIVE_WALLET_PAYMENT: {
    amounts: ['amount'],
    mappings: ['MEMBER_WALLET_LIABILITY', 'CASH'],
  },
  COOPERATIVE_WALLET_REFUND: {
    amounts: ['amount'],
    mappings: ['CASH', 'MEMBER_WALLET_LIABILITY'],
  },
  COOPERATIVE_UNIT_CAPITAL_INJECTED: {
    amounts: ['amount'],
    mappings: ['UNIT_CAPITAL', 'CASH'],
  },
  COOPERATIVE_UNIT_RESULT_TRANSFERRED: {
    amounts: ['amount'],
    mappings: ['UNIT_RESULT', 'INCOME_SUMMARY'],
  },
} as const;

// ------------------------------------------------------------------- Katalog

const SEMUA = { ...SIMPANAN, ...PINJAMAN, ...SYARIAH, ...SHU, ...DOMPET_UNIT };

export const COOPERATIVE_EVENTS = Object.keys(SEMUA) as Array<keyof typeof SEMUA>;

export const COOPERATIVE_EVENT_CATALOG: AccountingEventCatalog = {
  prefix: 'COOPERATIVE_',
  events: COOPERATIVE_EVENTS,
  requiredAmounts: Object.fromEntries(
    Object.entries(SEMUA).map(([k, v]) => [k, v.amounts]),
  ),
  requiredMappings: Object.fromEntries(
    Object.entries(SEMUA).map(([k, v]) => [k, v.mappings]),
  ),
};

/** Peristiwa yang menyangkut akad syariah. */
export const PERISTIWA_SYARIAH = Object.keys(SYARIAH);

/** Peristiwa yang menyangkut ekuitas anggota, bukan kewajiban. */
export const PERISTIWA_EKUITAS = [
  'COOPERATIVE_PRINCIPAL_SAVING_RECEIVED',
  'COOPERATIVE_MANDATORY_SAVING_RECEIVED',
];

export interface HasilPeriksa {
  ok: boolean;
  missing: string[];
}

/** Memeriksa kelengkapan nilai sebuah peristiwa sebelum diterbitkan. */
export function periksaNilai(
  eventCode: string,
  amounts: Record<string, unknown>,
): HasilPeriksa {
  const wajib = COOPERATIVE_EVENT_CATALOG.requiredAmounts[eventCode];
  if (!wajib) {
    return { ok: false, missing: [`(peristiwa "${eventCode}" tidak dikenal katalog koperasi)`] };
  }
  const missing = wajib.filter((k) => amounts[k] === undefined || amounts[k] === null);
  return { ok: missing.length === 0, missing };
}

export function isCooperativeEvent(code: string): boolean {
  return code in COOPERATIVE_EVENT_CATALOG.requiredAmounts;
}
