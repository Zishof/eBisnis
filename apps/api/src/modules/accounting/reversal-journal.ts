/**
 * Jurnal pembalik untuk peristiwa akuntansi yang sudah terjurnal.
 *
 * ## Mengapa membalik, bukan menghapus atau menyunting
 *
 * Ketika penerimaan barang dibatalkan, peristiwa akuntansinya yang masih
 * `PENDING` cukup disetel `SKIPPED` — ia belum pernah menjadi angka di buku.
 * Yang sudah `POSTED` lain persoalannya: jurnalnya sudah masuk buku besar,
 * mungkin sudah ikut dalam laporan yang dicetak dan ditandatangani.
 *
 * Menghapus atau menyunting jurnal itu menghilangkan bukti bahwa angkanya
 * pernah ada — dan laporan yang sudah tercetak menjadi tidak dapat dijelaskan
 * dari basis data. Karena itu koreksinya berupa jurnal BARU yang membalik,
 * ditautkan lewat `journal_entry.reversal_of_id`.
 *
 * ## Mengapa membaca baris jurnalnya, bukan menghitung ulang dari aturan
 *
 * Jurnal aslinya dibentuk `accounting_posting_rule` yang dapat diubah tanpa
 * rilis. Menghitung ulang pembaliknya dari aturan hari ini akan menghasilkan
 * angka yang berbeda begitu aturannya pernah disunting — dan pembalik yang
 * tidak persis membalikkan justru meninggalkan selisih yang tidak dapat
 * ditelusuri siapa pun.
 *
 * Membalik dari baris jurnal yang benar-benar tercatat membuat hasilnya benar
 * menurut konstruksi: apa pun yang dahulu didebit, kini dikredit, sebesar
 * angka yang sama persis.
 *
 * ## Yang tidak diputuskan di sini
 *
 * Periode fiskal. Pembalik TIDAK BOLEH masuk ke periode yang sudah tertutup —
 * menutup periode berarti angkanya sudah dilaporkan. Pemilihan periode
 * terbuka dilakukan pemanggil terhadap basis data; berkas ini hanya memastikan
 * angkanya benar dan kuncinya tidak pernah kembar.
 */

/** Baris jurnal sebagaimana tersimpan, bukan sebagaimana dihitung aturan. */
export interface PostedJournalLine {
  accountId: string;
  lineNo: number;
  debit: number;
  credit: number;
  description: string | null;
}

/** Mengapa sebuah peristiwa tidak dibalik. */
export type ReversalRefusal =
  /** Belum pernah terjurnal — cukup `SKIPPED`, tidak perlu pembalik. */
  | 'EVENT_NOT_POSTED'
  /** Berstatus POSTED tetapi tidak menunjuk jurnal; data tidak konsisten. */
  | 'NO_JOURNAL'
  /** Jurnalnya sendiri belum POSTED, jadi belum menjadi angka di buku. */
  | 'JOURNAL_NOT_POSTED'
  /** Jurnalnya sudah merupakan pembalik; membalik pembalik memulihkan angkanya. */
  | 'JOURNAL_IS_ITSELF_A_REVERSAL'
  /** Tidak ada baris untuk dibalik. */
  | 'NO_LINES';

export type ReversalDecision =
  | { action: 'REVERSE' }
  /** Sudah pernah dibalik. Idempoten: kembalikan yang lama, jangan buat lagi. */
  | { action: 'ALREADY_REVERSED'; journalEntryId: string }
  | { action: 'SKIP'; reason: ReversalRefusal };

export interface ReversalCandidate {
  /** `accounting_event.status`. */
  eventStatus: string;
  /** `accounting_event.journal_entry_id`. */
  journalEntryId: string | null;
  /** `journal_entry.status` dari jurnal itu. */
  journalStatus: string | null;
  /** Benar bila jurnal itu sendiri punya `reversal_of_id`. */
  journalIsReversal: boolean;
  /** Id jurnal pembalik yang sudah ada, bila pernah dibuat. */
  existingReversalId: string | null;
  /** Jumlah baris jurnal aslinya. */
  lineCount: number;
}

/**
 * Memutuskan apa yang harus dilakukan terhadap satu peristiwa saat dokumennya
 * dibalik.
 *
 * Urutannya disengaja: yang sudah pernah dibalik diperiksa lebih dahulu,
 * supaya pemanggilan kedua atas pembalikan yang sama tidak pernah membentuk
 * jurnal pembalik kedua — dan pemeriksaan itu tidak bergantung pada keadaan
 * lain yang mungkin sudah berubah.
 */
export function decideReversal(candidate: ReversalCandidate): ReversalDecision {
  if (candidate.existingReversalId) {
    return { action: 'ALREADY_REVERSED', journalEntryId: candidate.existingReversalId };
  }
  if (candidate.eventStatus !== 'POSTED') return { action: 'SKIP', reason: 'EVENT_NOT_POSTED' };
  if (!candidate.journalEntryId) return { action: 'SKIP', reason: 'NO_JOURNAL' };
  if (candidate.journalStatus !== 'POSTED') {
    return { action: 'SKIP', reason: 'JOURNAL_NOT_POSTED' };
  }
  if (candidate.journalIsReversal) {
    return { action: 'SKIP', reason: 'JOURNAL_IS_ITSELF_A_REVERSAL' };
  }
  if (candidate.lineCount <= 0) return { action: 'SKIP', reason: 'NO_LINES' };
  return { action: 'REVERSE' };
}

/**
 * Membalik baris jurnal: yang didebit menjadi dikredit, dan sebaliknya.
 *
 * Nomor barisnya dipertahankan supaya pembalik dapat disandingkan baris per
 * baris dengan aslinya saat diperiksa.
 */
export function reverseLines(lines: PostedJournalLine[]): PostedJournalLine[] {
  return lines.map((line) => ({
    accountId: line.accountId,
    lineNo: line.lineNo,
    debit: line.credit,
    credit: line.debit,
    description: line.description,
  }));
}

export interface JournalTotals {
  totalDebit: number;
  totalCredit: number;
}

export function totalsOf(lines: PostedJournalLine[]): JournalTotals {
  return lines.reduce<JournalTotals>(
    (acc, line) => ({
      totalDebit: acc.totalDebit + line.debit,
      totalCredit: acc.totalCredit + line.credit,
    }),
    { totalDebit: 0, totalCredit: 0 },
  );
}

/*
 * Kunci pembalik.
 *
 * Keduanya diturunkan dari id peristiwa, bukan dari waktu atau nomor urut:
 * `ux_journal_posting_key` dan `ux_journal_number` adalah indeks unik, jadi
 * kunci yang deterministik membuat percobaan kedua tertolak basis data alih
 * alih membentuk pembalik kedua — bahkan bila dua permintaan berjalan
 * bersamaan.
 *
 * Berpasangan dengan kunci aslinya: `ACCOUNTING_EVENT:<id>` menjadi
 * `ACCOUNTING_EVENT_REVERSAL:<id>`, dan `AE-<tanggal>-<hex>` menjadi
 * `AER-<tanggal>-<hex>`.
 */
export const REVERSAL_POSTING_KEY_PREFIX = 'ACCOUNTING_EVENT_REVERSAL:';

export function reversalPostingKey(eventId: string): string {
  return `${REVERSAL_POSTING_KEY_PREFIX}${eventId}`;
}

/**
 * Nomor jurnal pembalik.
 *
 * `journal_number` bertipe VARCHAR(48); bentuk ini memakai 25 karakter, jadi
 * tanggal maupun id sepanjang apa pun tidak akan memotongnya.
 */
export function reversalJournalNumber(reversalDate: string, eventId: string): string {
  const hex = eventId.replace(/-/g, '').slice(0, 12).toUpperCase();
  return `AER-${reversalDate.replace(/-/g, '')}-${hex}`;
}
