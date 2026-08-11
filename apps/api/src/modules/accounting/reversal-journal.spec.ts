/**
 * Pengujian jurnal pembalik.
 *
 * Yang diputuskan modul ini menentukan apakah buku besar ikut kembali ketika
 * sebuah dokumen dibatalkan. Kesalahannya tidak memunculkan galat: neraca tetap
 * seimbang, jurnalnya tetap ada, hanya angkanya yang tidak pernah benar lagi.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REVERSAL_POSTING_KEY_PREFIX,
  decideReversal,
  reversalJournalNumber,
  reversalPostingKey,
  reverseLines,
  totalsOf,
  type PostedJournalLine,
  type ReversalCandidate,
} from './reversal-journal';

const EVENT = '9f8e7d6c-5b4a-4392-8180-7f6e5d4c3b2a';
const JURNAL = '11111111-2222-4333-8444-555555555555';

/** Peristiwa yang sudah terjurnal dan wajar untuk dibalik. */
const SIAP: ReversalCandidate = {
  eventStatus: 'POSTED',
  journalEntryId: JURNAL,
  journalStatus: 'POSTED',
  journalIsReversal: false,
  existingReversalId: null,
  lineCount: 2,
};

/** Jurnal penerimaan barang yang khas: persediaan didebit, hutang dikredit. */
const BARIS: PostedJournalLine[] = [
  { accountId: 'akun-persediaan', lineNo: 1, debit: 1_500_000, credit: 0, description: 'Persediaan' },
  { accountId: 'akun-hutang', lineNo: 2, debit: 0, credit: 1_500_000, description: 'Hutang dagang' },
];

describe('memutuskan pembalikan', () => {
  it('peristiwa yang sudah terjurnal dibalik', () => {
    expect(decideReversal(SIAP)).toEqual({ action: 'REVERSE' });
  });

  it('yang sudah pernah dibalik TIDAK dibalik lagi', () => {
    /*
     * Idempotensi adalah alasan `posting_key` pembalik dibuat deterministik.
     * Pembalik kedua atas jurnal yang sama akan menggandakan koreksinya —
     * angkanya melewati nol dan berbalik arah, dan neracanya tetap seimbang
     * sehingga tidak ada yang menandainya.
     */
    const hasil = decideReversal({ ...SIAP, existingReversalId: 'jurnal-pembalik-lama' });
    expect(hasil).toEqual({
      action: 'ALREADY_REVERSED',
      journalEntryId: 'jurnal-pembalik-lama',
    });
  });

  it('yang sudah pernah dibalik diperiksa PALING DAHULU', () => {
    // Walau keadaan lainnya sudah berubah dan tidak lagi memenuhi syarat,
    // jawabannya tetap "sudah pernah" — bukan tiba-tiba boleh dibalik lagi.
    const hasil = decideReversal({
      eventStatus: 'SKIPPED',
      journalEntryId: null,
      journalStatus: null,
      journalIsReversal: true,
      existingReversalId: 'jurnal-pembalik-lama',
      lineCount: 0,
    });
    expect(hasil.action).toBe('ALREADY_REVERSED');
  });

  describe('tidak ada yang perlu dibalik', () => {
    const kasus: { nama: string; ubah: Partial<ReversalCandidate>; alasan: string }[] = [
      {
        nama: 'peristiwa masih PENDING — cukup SKIPPED',
        ubah: { eventStatus: 'PENDING' },
        alasan: 'EVENT_NOT_POSTED',
      },
      {
        nama: 'peristiwa FAILED',
        ubah: { eventStatus: 'FAILED' },
        alasan: 'EVENT_NOT_POSTED',
      },
      {
        nama: 'POSTED tetapi tidak menunjuk jurnal',
        ubah: { journalEntryId: null },
        alasan: 'NO_JOURNAL',
      },
      {
        nama: 'jurnalnya sendiri belum POSTED',
        ubah: { journalStatus: 'DRAFT' },
        alasan: 'JOURNAL_NOT_POSTED',
      },
      {
        nama: 'jurnalnya sudah merupakan pembalik',
        ubah: { journalIsReversal: true },
        alasan: 'JOURNAL_IS_ITSELF_A_REVERSAL',
      },
      {
        nama: 'jurnalnya tanpa baris',
        ubah: { lineCount: 0 },
        alasan: 'NO_LINES',
      },
    ];

    for (const k of kasus) {
      it(k.nama, () => {
        expect(decideReversal({ ...SIAP, ...k.ubah })).toEqual({
          action: 'SKIP',
          reason: k.alasan,
        });
      });
    }
  });
});

describe('membalik baris', () => {
  it('debit menjadi kredit, dan sebaliknya', () => {
    expect(reverseLines(BARIS)).toEqual([
      { accountId: 'akun-persediaan', lineNo: 1, debit: 0, credit: 1_500_000, description: 'Persediaan' },
      { accountId: 'akun-hutang', lineNo: 2, debit: 1_500_000, credit: 0, description: 'Hutang dagang' },
    ]);
  });

  it('setiap akun BERSIH NOL bila asli dan pembaliknya dijumlahkan', () => {
    /*
     * Identitas yang membuat pembalik ini benar menurut konstruksi. Diuji per
     * akun, bukan hanya pada totalnya: total yang nol masih mungkin menyembunyikan
     * dua akun yang saling menutup padahal seharusnya berdiri sendiri.
     */
    const gabungan = [...BARIS, ...reverseLines(BARIS)];
    const perAkun = new Map<string, number>();
    for (const b of gabungan) {
      perAkun.set(b.accountId, (perAkun.get(b.accountId) ?? 0) + b.debit - b.credit);
    }
    expect([...perAkun.values()]).toEqual([0, 0]);
  });

  it('pembaliknya tetap seimbang', () => {
    // `ck_journal_balanced` menolak jurnal POSTED yang debit dan kreditnya
    // berbeda; pembalik yang tidak seimbang akan ditolak basis data.
    const t = totalsOf(reverseLines(BARIS));
    expect(t.totalDebit).toBe(t.totalCredit);
  });

  it('total asli dan pembaliknya bertukar', () => {
    const asli = totalsOf(BARIS);
    const balik = totalsOf(reverseLines(BARIS));
    expect(balik.totalDebit).toBe(asli.totalCredit);
    expect(balik.totalCredit).toBe(asli.totalDebit);
  });

  it('nomor baris dipertahankan agar dapat disandingkan', () => {
    expect(reverseLines(BARIS).map((b) => b.lineNo)).toEqual([1, 2]);
  });

  it('baris dengan debit dan kredit sekaligus tetap tertukar utuh', () => {
    // Tidak lazim, tetapi tidak dilarang skema. Membalik hanya salah satunya
    // akan menghasilkan selisih yang tidak dapat dijelaskan.
    const aneh: PostedJournalLine[] = [
      { accountId: 'a', lineNo: 1, debit: 300, credit: 100, description: null },
    ];
    expect(reverseLines(aneh)[0]).toEqual({
      accountId: 'a',
      lineNo: 1,
      debit: 100,
      credit: 300,
      description: null,
    });
  });

  it('jurnal kosong tidak meledak', () => {
    expect(reverseLines([])).toEqual([]);
    expect(totalsOf([])).toEqual({ totalDebit: 0, totalCredit: 0 });
  });
});

describe('kunci pembalik', () => {
  it('deterministik — dua panggilan memberi kunci yang sama', () => {
    expect(reversalPostingKey(EVENT)).toBe(reversalPostingKey(EVENT));
    expect(reversalPostingKey(EVENT)).toBe(`${REVERSAL_POSTING_KEY_PREFIX}${EVENT}`);
  });

  it('tidak pernah bentrok dengan kunci jurnal aslinya', () => {
    // Jurnal asli memakai `ACCOUNTING_EVENT:<id>`. Bentrok berarti pembaliknya
    // ditolak indeks unik dan pembalikan gagal seluruhnya.
    expect(reversalPostingKey(EVENT)).not.toBe(`ACCOUNTING_EVENT:${EVENT}`);
  });

  it('nomor jurnal muat pada VARCHAR(48)', () => {
    const nomor = reversalJournalNumber('2026-08-11', EVENT);
    expect(nomor).toBe('AER-20260811-9F8E7D6C5B4A');
    expect(nomor.length).toBeLessThanOrEqual(48);
  });

  it('nomor jurnal berbeda dari pola jurnal aslinya', () => {
    // Asli: `AE-<tanggal>-<hex>`. Awalan yang sama akan bentrok pada
    // `ux_journal_number` ketika tanggalnya kebetulan sama.
    expect(reversalJournalNumber('2026-08-11', EVENT)).not.toBe(
      `AE-20260811-${EVENT.replace(/-/g, '').slice(0, 12).toUpperCase()}`,
    );
  });

  it('peristiwa berbeda memberi nomor berbeda pada tanggal yang sama', () => {
    const lain = '00000000-1111-4222-8333-444444444444';
    expect(reversalJournalNumber('2026-08-11', EVENT)).not.toBe(
      reversalJournalNumber('2026-08-11', lain),
    );
  });
});

describe('penjaga: layanan harus memakai modul murni', () => {
  const sumber = readFileSync(join(__dirname, 'accounting-posting.service.ts'), 'utf8');

  it('pembalikan memakai keputusan modul murni', () => {
    expect(sumber).toContain('decideReversal(');
    expect(sumber).toContain('reverseLines(');
  });

  it('jurnal pembalik menulis reversal_of_id', () => {
    /*
     * `[^(]*` menahan pencocokan di dalam SATU pernyataan INSERT: tanpa itu
     * polanya sempat cocok lintas metode — `INSERT INTO ... journal_entry` milik
     * posting biasa, lalu `reversal_of_id` dari SELECT di metode lain — sehingga
     * penjaga ini tetap hijau padahal tautannya sudah dilepas.
     */
    expect(sumber).toMatch(/INSERT INTO[^(]*journal_entry[^(]*\([^)]*reversal_of_id[^)]*\)/);
  });

  it('periode pembalik wajib TERBUKA', () => {
    /*
     * Pembalik tidak boleh masuk ke periode yang sudah ditutup: angkanya sudah
     * dilaporkan, dan menyisipkan jurnal ke dalamnya membuat laporan yang sudah
     * tercetak tidak lagi cocok dengan basis data.
     */
    expect(sumber).toMatch(/fiscal_period[\s\S]*?status = 'OPEN'[\s\S]*?CURRENT_DATE BETWEEN/);
  });

  it('peristiwa aslinya TIDAK diubah menjadi SKIPPED', () => {
    // Ia memang pernah terjurnal; itu riwayat yang tidak boleh dihapus. Yang
    // ditulis hanya metadata dan tautan pembaliknya.
    expect(sumber).not.toMatch(/reverseOneEvent[\s\S]*?SET status = 'SKIPPED'/);
  });
});

describe('penjaga: pembatalan penerimaan barang memanggilnya', () => {
  const sumber = readFileSync(
    join(__dirname, '..', 'tenant', 'erp-purchasing.service.ts'),
    'utf8',
  );

  it('reverseGoodsReceiptValidation membalik peristiwa yang sudah POSTED', () => {
    // Tanpa panggilan ini, stok dan hutang kembali sementara jurnalnya tetap
    // berdiri — dan tidak ada satu pun uji lain di sini yang gagal.
    expect(sumber).toContain('reversePostedEvents(');
  });

  it('yang masih PENDING tetap disetel SKIPPED', () => {
    expect(sumber).toMatch(/SET status = 'SKIPPED'[\s\S]*?status = 'PENDING'/);
  });
});
