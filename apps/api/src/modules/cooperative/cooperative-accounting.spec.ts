/**
 * Pengujian aturan akuntansi koperasi dan katalog peristiwanya.
 *
 * Dua hal dijaga paling ketat:
 *
 * 1. **Jumlah buku pembantu = saldo buku besar.** Bila keduanya berbeda, salah
 *    satunya salah — dan yang berbahaya bukan selisihnya melainkan bahwa tidak
 *    ada yang tahu mana yang benar.
 * 2. **Simpanan pokok dan wajib adalah EKUITAS.** Rasio kesehatan koperasi
 *    dihitung atas modal sendiri; menggolongkannya sebagai kewajiban membuat
 *    koperasi tampak tidak sehat padahal tidak demikian.
 */

import {
  ACCOUNT_NATURES,
  SIFAT_NORMAL,
  bolehTutupPeriode,
  hitungPajakShu,
  hitungRasio,
  periksaKeseimbangan,
  periksaPenutupan,
  rekonsiliasi,
  susunLabaRugi,
  susunModalSendiri,
  susunNeraca,
  type BarisBukuPembantu,
  type SaldoBernature,
  type SyaratPenutupan,
} from './cooperative-accounting';
import {
  COOPERATIVE_EVENTS,
  COOPERATIVE_EVENT_CATALOG,
  PERISTIWA_EKUITAS,
  PERISTIWA_SYARIAH,
  isCooperativeEvent,
  periksaNilai,
} from './accounting/cooperative-events.catalog';

describe('katalog peristiwa akuntansi koperasi', () => {
  const requiredMappings = COOPERATIVE_EVENT_CATALOG.requiredMappings ?? {};

  it('setiap peristiwa berawalan COOPERATIVE_', () => {
    for (const e of COOPERATIVE_EVENTS) {
      expect(e.startsWith(COOPERATIVE_EVENT_CATALOG.prefix)).toBe(true);
    }
  });

  it('setiap peristiwa punya daftar nilai wajib yang tidak kosong', () => {
    /*
     * Sifat yang dijaga `posting-engine.spec.ts` milik Core. Kode yang
     * ditambahkan tanpa aturan akan menggagalkan pengujian, bukan diam-diam
     * menghasilkan jurnal kosong.
     */
    for (const e of COOPERATIVE_EVENTS) {
      const wajib = COOPERATIVE_EVENT_CATALOG.requiredAmounts[e];
      expect(wajib).toBeDefined();
      expect(wajib.length).toBeGreaterThan(0);
    }
  });

  it('setiap peristiwa punya kode pemetaan akun', () => {
    for (const e of COOPERATIVE_EVENTS) {
      expect(requiredMappings[e]?.length).toBeGreaterThan(0);
    }
  });

  it('sekurang-kurangnya dua puluh lima peristiwa terdaftar', () => {
    expect(COOPERATIVE_EVENTS.length).toBeGreaterThanOrEqual(25);
  });

  it('kode peristiwa tidak kembar', () => {
    expect(new Set(COOPERATIVE_EVENTS).size).toBe(COOPERATIVE_EVENTS.length);
  });

  it('angsuran menuntut pokok dan jasa TERPISAH', () => {
    /*
     * Keduanya masuk akun berbeda — pokok mengurangi piutang, jasa menjadi
     * pendapatan — dan membelah totalnya kemudian berarti menebak berapa
     * pendapatan koperasi.
     */
    const wajib = COOPERATIVE_EVENT_CATALOG.requiredAmounts.COOPERATIVE_INSTALLMENT_RECEIVED;
    expect(wajib).toContain('principalPortion');
    expect(wajib).toContain('interestPortion');
  });

  it('murabahah memakai kode tersendiri, bukan kode pinjaman', () => {
    /*
     * Memakai COOPERATIVE_LOAN_DISBURSED untuk murabahah akan menyajikan
     * jual-beli sebagai pinjaman berbunga — cacat serius bagi koperasi syariah
     * dan bagi Dewan Pengawas Syariahnya.
     */
    expect(PERISTIWA_SYARIAH).toContain('COOPERATIVE_MURABAHA_DISBURSED');
    const wajib = COOPERATIVE_EVENT_CATALOG.requiredAmounts.COOPERATIVE_MURABAHA_DISBURSED;
    expect(wajib).toContain('margin');
    expect(wajib).not.toContain('interest');
  });

  it('tidak ada peristiwa syariah yang menuntut nilai bunga', () => {
    for (const e of PERISTIWA_SYARIAH) {
      for (const n of COOPERATIVE_EVENT_CATALOG.requiredAmounts[e]) {
        expect(n.toLowerCase()).not.toContain('interest');
      }
    }
  });

  it('simpanan pokok dan wajib dipetakan ke akun EKUITAS', () => {
    for (const e of PERISTIWA_EKUITAS) {
      const peta = requiredMappings[e] ?? [];
      expect(peta.some((m) => m.includes('EQUITY'))).toBe(true);
    }
  });

  it('simpanan sukarela dipetakan ke akun KEWAJIBAN, bukan ekuitas', () => {
    const peta = requiredMappings.COOPERATIVE_VOLUNTARY_SAVING_DEPOSIT ?? [];
    expect(peta.some((m) => m.includes('LIABILITY'))).toBe(true);
    expect(peta.some((m) => m.includes('EQUITY'))).toBe(false);
  });

  it('pembayaran dompet TIDAK menjurnal penjualannya', () => {
    /*
     * Penjualan di unit toko sudah dijurnal mesin POS lewat POS_SALE. Yang
     * dijurnal di sini hanya perpindahan dari kewajiban dompet ke kas.
     */
    const peta = requiredMappings.COOPERATIVE_WALLET_PAYMENT ?? [];
    expect(peta).toEqual(['MEMBER_WALLET_LIABILITY', 'CASH']);
    expect(peta.some((m) => m.includes('REVENUE') || m.includes('SALES'))).toBe(false);
  });

  it('memeriksa kelengkapan nilai sebelum peristiwa diterbitkan', () => {
    const kurang = periksaNilai('COOPERATIVE_INSTALLMENT_RECEIVED', { total: 1_120_000 });
    expect(kurang.ok).toBe(false);
    expect(kurang.missing.sort()).toEqual(['interestPortion', 'principalPortion']);
  });

  it('meloloskan peristiwa yang lengkap', () => {
    expect(
      periksaNilai('COOPERATIVE_INSTALLMENT_RECEIVED', {
        principalPortion: 1_000_000,
        interestPortion: 120_000,
        total: 1_120_000,
      }).ok,
    ).toBe(true);
  });

  it('menolak kode yang tidak dikenal katalog', () => {
    expect(periksaNilai('COOPERATIVE_ENTAH_APA', {}).ok).toBe(false);
    expect(isCooperativeEvent('POS_SALE')).toBe(false);
  });
});

describe('rekonsiliasi buku pembantu dengan buku besar', () => {
  const sub = (accountId: string, memberId: string, debit: number, credit: number): BarisBukuPembantu => ({
    accountId, memberId, debit, credit,
  });

  it('cocok bila jumlahnya sama', () => {
    const h = rekonsiliasi(
      [sub('A1', 'M1', 0, 500_000), sub('A1', 'M2', 0, 300_000)],
      [{ accountId: 'A1', accountCode: '2101', normalBalance: 'CREDIT', balance: 800_000 }],
    );
    expect(h.ok).toBe(true);
    expect(h.differences).toEqual([]);
  });

  it('MENANGKAP selisih, dan menyebutkan angkanya', () => {
    const h = rekonsiliasi(
      [sub('A1', 'M1', 0, 500_000)],
      [{ accountId: 'A1', accountCode: '2101', normalBalance: 'CREDIT', balance: 750_000 }],
    );
    expect(h.ok).toBe(false);
    expect(h.differences[0].difference).toBe(-250_000);
    expect(h.differences[0].subledgerBalance).toBe(500_000);
    expect(h.differences[0].ledgerBalance).toBe(750_000);
  });

  it('memperhatikan sifat normal akun', () => {
    /*
     * Piutang pinjaman bersifat debit — setoran anggota menguranginya;
     * simpanan bersifat kredit — setoran menambah. Menjumlahkan tanpa
     * memperhatikan sifatnya akan berselisih pada setiap akun, dan laporan
     * rekonsiliasi yang selalu berselisih akan segera diabaikan orang.
     */
    const barisan = [sub('A1', 'M1', 1_000_000, 200_000)];
    const debit = rekonsiliasi(barisan, [
      { accountId: 'A1', accountCode: '1201', normalBalance: 'DEBIT', balance: 800_000 },
    ]);
    const kredit = rekonsiliasi(barisan, [
      { accountId: 'A1', accountCode: '2101', normalBalance: 'CREDIT', balance: -800_000 },
    ]);
    expect(debit.ok).toBe(true);
    expect(kredit.ok).toBe(true);
  });

  it('melaporkan akun yang hanya ada pada buku pembantu', () => {
    // Rincian atas akun yang tidak ada di buku besar berarti jurnalnya tidak
    // pernah terbentuk — persis keadaan yang berlaku sampai IR-003 disetujui.
    const h = rekonsiliasi([sub('A9', 'M1', 0, 100_000)], []);
    expect(h.ok).toBe(false);
    expect(h.subledgerOnlyAccounts).toEqual(['A9']);
  });

  it('melaporkan akun buku besar bersaldo yang tanpa rincian', () => {
    const h = rekonsiliasi([], [
      { accountId: 'A1', accountCode: '1101', normalBalance: 'DEBIT', balance: 5_000_000 },
    ]);
    expect(h.ledgerOnlyAccounts).toEqual(['A1']);
  });

  it('akun buku besar bersaldo nol tanpa rincian bukan masalah', () => {
    const h = rekonsiliasi([], [
      { accountId: 'A1', accountCode: '1101', normalBalance: 'DEBIT', balance: 0 },
    ]);
    expect(h.ledgerOnlyAccounts).toEqual([]);
  });

  it('menghitung jumlah anggota pada akun yang berselisih', () => {
    const h = rekonsiliasi(
      [sub('A1', 'M1', 0, 100), sub('A1', 'M2', 0, 100), sub('A1', 'M3', 0, 100)],
      [{ accountId: 'A1', accountCode: '2101', normalBalance: 'CREDIT', balance: 999 }],
    );
    expect(h.differences[0].memberCount).toBe(3);
  });
});

describe('keseimbangan jurnal', () => {
  it('seimbang bila debit sama dengan kredit', () => {
    const h = periksaKeseimbangan([
      { accountId: 'A', debit: 1_000_000, credit: 0 },
      { accountId: 'B', debit: 0, credit: 1_000_000 },
    ]);
    expect(h.balanced).toBe(true);
    expect(h.difference).toBe(0);
  });

  it('menangkap jurnal yang tidak seimbang', () => {
    const h = periksaKeseimbangan([
      { accountId: 'A', debit: 1_000_000, credit: 0 },
      { accountId: 'B', debit: 0, credit: 999_999 },
    ]);
    expect(h.balanced).toBe(false);
    expect(h.difference).toBe(1);
  });

  it('jurnal kosong dianggap seimbang', () => {
    expect(periksaKeseimbangan([]).balanced).toBe(true);
  });
});

describe('neraca dan laba rugi', () => {
  const saldo = (nature: SaldoBernature['nature'], balance: number, i = 0): SaldoBernature => ({
    accountId: `${nature}${i}`,
    accountCode: `${nature}${i}`,
    normalBalance: SIFAT_NORMAL[nature],
    nature,
    balance,
  });

  it('setiap sifat akun punya saldo normal', () => {
    for (const n of ACCOUNT_NATURES) expect(SIFAT_NORMAL[n]).toBeDefined();
  });

  it('aset dan beban bersaldo normal debit', () => {
    expect(SIFAT_NORMAL.ASSET).toBe('DEBIT');
    expect(SIFAT_NORMAL.EXPENSE).toBe('DEBIT');
  });

  it('neraca seimbang bila aset sama dengan kewajiban ditambah ekuitas', () => {
    const n = susunNeraca([
      saldo('ASSET', 100_000_000),
      saldo('LIABILITY', 40_000_000),
      saldo('EQUITY', 60_000_000),
    ]);
    expect(n.balanced).toBe(true);
    expect(n.difference).toBe(0);
  });

  it('menangkap neraca yang tidak seimbang', () => {
    const n = susunNeraca([
      saldo('ASSET', 100_000_000),
      saldo('LIABILITY', 40_000_000),
      saldo('EQUITY', 55_000_000),
    ]);
    expect(n.balanced).toBe(false);
    expect(n.difference).toBe(5_000_000);
  });

  it('menghitung surplus dari pendapatan dikurangi beban', () => {
    const l = susunLabaRugi([
      saldo('REVENUE', 120_000_000),
      saldo('EXPENSE', 95_000_000),
    ]);
    expect(l.surplus).toBe(25_000_000);
  });

  it('defisit dinyatakan sebagai surplus negatif, bukan disembunyikan', () => {
    const l = susunLabaRugi([saldo('REVENUE', 80_000_000), saldo('EXPENSE', 95_000_000)]);
    expect(l.surplus).toBe(-15_000_000);
  });
});

describe('modal sendiri koperasi', () => {
  it('simpanan pokok dan wajib termasuk modal sendiri', () => {
    /*
     * Rasio kesehatan koperasi dihitung atas modal sendiri. Menggolongkan
     * simpanan pokok dan wajib sebagai kewajiban membuat koperasi tampak
     * bermodal kecil dan dinilai tidak sehat padahal tidak demikian.
     */
    const m = susunModalSendiri({
      principalSaving: 50_000_000,
      mandatorySaving: 120_000_000,
      reserve: 30_000_000,
      grantCapital: 0,
      undistributedSurplus: 10_000_000,
    });
    expect(m.totalOwnCapital).toBe(210_000_000);
  });

  it('simpanan sukarela TIDAK termasuk — ia kewajiban', () => {
    // Tidak ada medan untuk simpanan sukarela pada komposisi modal sendiri,
    // dan ketiadaannya disengaja.
    const m = susunModalSendiri({
      principalSaving: 1, mandatorySaving: 1, reserve: 1, grantCapital: 1,
      undistributedSurplus: 1,
    });
    expect(Object.keys(m)).not.toContain('voluntarySaving');
  });
});

describe('rasio kesehatan', () => {
  it('menghitung keempat rasio', () => {
    const r = hitungRasio({
      ownCapital: 210_000_000,
      totalAsset: 500_000_000,
      nonPerformingLoan: 15_000_000,
      totalLoan: 300_000_000,
      currentAsset: 200_000_000,
      currentLiability: 100_000_000,
      surplus: 25_000_000,
    });
    expect(r.capitalAdequacy).toBeCloseTo(0.42);
    expect(r.nonPerformingRatio).toBeCloseTo(0.05);
    expect(r.liquidityRatio).toBeCloseTo(2);
    expect(r.returnOnAsset).toBeCloseTo(0.05);
  });

  it('pembagian nol menghasilkan nol, bukan Infinity maupun NaN', () => {
    /*
     * Rasio bernilai Infinity pada laporan akan tampak seperti cacat sistem,
     * dan pembacanya berhenti mempercayai seluruh laporannya.
     */
    const r = hitungRasio({
      ownCapital: 1, totalAsset: 0, nonPerformingLoan: 1, totalLoan: 0,
      currentAsset: 1, currentLiability: 0, surplus: 1,
    });
    for (const v of Object.values(r)) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBe(0);
    }
  });
});

describe('pajak SHU', () => {
  it('menghitung dan menyebutkan dasarnya', () => {
    const p = hitungPajakShu({
      taxableBase: 25_000_000,
      rate: 0.005,
      basis: 'peredaran bruto',
    });
    expect(p.taxAmount).toBe(125_000);
    expect(p.note).toContain('peredaran bruto');
    expect(p.note).toContain('0.50%');
  });

  it('dibulatkan ke rupiah penuh', () => {
    expect(Number.isInteger(hitungPajakShu({ taxableBase: 3_333_333, rate: 0.0075, basis: 'x' }).taxAmount)).toBe(true);
  });

  it('dasar negatif diperlakukan sebagai nol', () => {
    expect(hitungPajakShu({ taxableBase: -1_000_000, rate: 0.005, basis: 'x' }).taxAmount).toBe(0);
  });

  it('tarif tidak dikunci di dalam program', () => {
    // Perlakuan pajak koperasi berubah menurut peraturan yang berlaku.
    const a = hitungPajakShu({ taxableBase: 1_000_000, rate: 0.005, basis: 'x' });
    const b = hitungPajakShu({ taxableBase: 1_000_000, rate: 0.011, basis: 'x' });
    expect(a.taxAmount).not.toBe(b.taxAmount);
  });
});

describe('penutupan periode buku', () => {
  const siap: SyaratPenutupan = {
    allJournalsPosted: true,
    reconciliationOk: true,
    balanceSheetBalanced: true,
    pendingAccountingEvents: 0,
    unapprovedAdjustments: 0,
  };

  it('mengizinkan bila seluruh syarat terpenuhi', () => {
    expect(periksaPenutupan(siap)).toEqual([]);
    expect(bolehTutupPeriode(siap)).toBe(true);
  });

  it('MENOLAK bila rekonsiliasi belum cocok', () => {
    const k = periksaPenutupan({ ...siap, reconciliationOk: false });
    expect(k.map((x) => x.code)).toContain('RECONCILIATION_FAILED');
  });

  it('MENOLAK bila neraca belum seimbang', () => {
    expect(
      periksaPenutupan({ ...siap, balanceSheetBalanced: false }).map((x) => x.code),
    ).toContain('BALANCE_SHEET_UNBALANCED');
  });

  it('MENOLAK bila ada peristiwa yang belum berjurnal', () => {
    // Keadaan yang berlaku sampai IR-003 disetujui.
    const k = periksaPenutupan({ ...siap, pendingAccountingEvents: 42 });
    expect(k[0].message).toContain('42');
  });

  it('melaporkan seluruh kekurangan sekaligus', () => {
    const k = periksaPenutupan({
      allJournalsPosted: false,
      reconciliationOk: false,
      balanceSheetBalanced: false,
      pendingAccountingEvents: 3,
      unapprovedAdjustments: 2,
    });
    expect(k).toHaveLength(5);
    const kode = k.map((x) => x.code);
    expect(new Set(kode).size).toBe(kode.length);
  });
});
