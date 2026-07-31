/**
 * Pengujian aturan simpanan.
 *
 * Dua hal dijaga paling ketat:
 *
 * 1. **Simpanan pokok dan wajib tidak dapat ditarik selama keanggotaan
 *    berjalan.** Keduanya modal koperasi, bukan tabungan.
 * 2. **Saldo selalu sama dengan jumlah mutasinya.** Kolom saldo pada basis data
 *    hanyalah cache; bila keduanya berbeda, yang benar adalah mutasinya.
 */

import {
  ARAH,
  SAVING_KINDS,
  SAVING_TRANSACTION_TYPES,
  SIFAT,
  bagiHasil,
  bolehSetor,
  bolehTarik,
  bolehTutupRekening,
  hitungTunggakan,
  kemajuanPokok,
  layakDormant,
  periodeBulanan,
  saldoDari,
  saldoRataRataHarian,
  type SavingKind,
  type TarikInput,
} from './cooperative-saving';

const tarik = (over: Partial<TarikInput> = {}): TarikInput => ({
  kind: 'VOLUNTARY',
  amount: 100_000,
  balance: 500_000,
  minimumBalance: 0,
  accountStatus: 'ACTIVE',
  memberStatus: 'ACTIVE',
  ...over,
});

describe('sifat jenis simpanan', () => {
  it('setiap jenis punya sifat yang ditetapkan', () => {
    for (const k of SAVING_KINDS) expect(SIFAT[k]).toBeDefined();
  });

  it('pokok dan wajib adalah ekuitas dan tidak dapat ditarik', () => {
    /*
     * Inilah pembeda koperasi dari bank. Simpanan pokok dan wajib adalah MODAL
     * anggota pada koperasi, bukan titipan. Memperlakukannya sebagai kewajiban
     * membuat neraca menyatakan modal sendiri jauh lebih kecil daripada
     * sebenarnya, dan rasio kesehatan yang dihitung di atasnya ikut salah.
     */
    for (const k of ['PRINCIPAL', 'MANDATORY'] as SavingKind[]) {
      expect(SIFAT[k].isEquity).toBe(true);
      expect(SIFAT[k].withdrawable).toBe(false);
    }
  });

  it('sukarela dan berjangka adalah kewajiban dan dapat ditarik', () => {
    for (const k of ['VOLUNTARY', 'TIME_DEPOSIT'] as SavingKind[]) {
      expect(SIFAT[k].isEquity).toBe(false);
      expect(SIFAT[k].withdrawable).toBe(true);
    }
  });

  it('yang tidak dapat ditarik selalu ekuitas, dan sebaliknya', () => {
    // Invarian yang menjaga tabel sifat tetap masuk akal bila kelak ditambah
    // jenis simpanan baru.
    for (const k of SAVING_KINDS) {
      expect(SIFAT[k].isEquity).toBe(!SIFAT[k].withdrawable);
    }
  });

  it('hanya ekuitas yang menentukan jasa modal', () => {
    for (const k of SAVING_KINDS) {
      if (SIFAT[k].countsForCapitalService) expect(SIFAT[k].isEquity).toBe(true);
    }
  });
});

describe('saldo sebagai proyeksi mutasi', () => {
  it('setiap jenis transaksi punya arah', () => {
    for (const t of SAVING_TRANSACTION_TYPES) {
      expect([1, -1]).toContain(ARAH[t]);
    }
  });

  it('menjumlahkan mutasi menurut arahnya', () => {
    expect(
      saldoDari([
        { transactionType: 'DEPOSIT', amount: 500_000 },
        { transactionType: 'DEPOSIT', amount: 300_000 },
        { transactionType: 'WITHDRAWAL', amount: 200_000 },
      ]),
    ).toBe(600_000);
  });

  it('bagi hasil menambah, biaya administrasi mengurangi', () => {
    expect(
      saldoDari([
        { transactionType: 'DEPOSIT', amount: 1_000_000 },
        { transactionType: 'PROFIT_SHARING', amount: 25_000 },
        { transactionType: 'ADMIN_FEE', amount: 5_000 },
      ]),
    ).toBe(1_020_000);
  });

  it('koreksi dua arah saling meniadakan', () => {
    // Koreksi dicatat sebagai mutasi, bukan dengan menyunting mutasi lama.
    // Mutasi yang disunting menghapus jejak kesalahannya.
    expect(
      saldoDari([
        { transactionType: 'DEPOSIT', amount: 100_000 },
        { transactionType: 'CORRECTION_IN', amount: 50_000 },
        { transactionType: 'CORRECTION_OUT', amount: 50_000 },
      ]),
    ).toBe(100_000);
  });

  it('tanpa mutasi, saldo nol', () => {
    expect(saldoDari([])).toBe(0);
  });
});

describe('penyetoran', () => {
  it('menerima setoran sukarela dari anggota aktif', () => {
    expect(
      bolehSetor({ kind: 'VOLUNTARY', amount: 100_000, accountStatus: 'ACTIVE', memberStatus: 'ACTIVE' })
        .allowed,
    ).toBe(true);
  });

  it('menerima simpanan pokok dari CALON anggota', () => {
    /*
     * Justru inilah yang mengaktifkan keanggotaannya. Menolaknya karena "belum
     * anggota" akan membuat tidak seorang pun dapat menjadi anggota.
     */
    expect(
      bolehSetor({
        kind: 'PRINCIPAL',
        amount: 500_000,
        accountStatus: 'ACTIVE',
        memberStatus: 'PENDING_PRINCIPAL_SAVING',
      }).allowed,
    ).toBe(true);
  });

  it('menolak simpanan sukarela dari calon anggota', () => {
    const v = bolehSetor({
      kind: 'VOLUNTARY',
      amount: 100_000,
      accountStatus: 'ACTIVE',
      memberStatus: 'APPROVED',
    });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('simpanan pokok');
  });

  it('menolak setoran nol dan negatif', () => {
    for (const n of [0, -1, Number.NaN]) {
      expect(
        bolehSetor({ kind: 'VOLUNTARY', amount: n, accountStatus: 'ACTIVE', memberStatus: 'ACTIVE' })
          .allowed,
      ).toBe(false);
    }
  });

  it('menolak setoran pada rekening yang sudah ditutup', () => {
    expect(
      bolehSetor({ kind: 'VOLUNTARY', amount: 100, accountStatus: 'CLOSED', memberStatus: 'ACTIVE' })
        .allowed,
    ).toBe(false);
  });

  it('menolak setoran dari bekas anggota', () => {
    expect(
      bolehSetor({ kind: 'PRINCIPAL', amount: 100, accountStatus: 'ACTIVE', memberStatus: 'TERMINATED' })
        .allowed,
    ).toBe(false);
  });
});

describe('penarikan', () => {
  it('mengizinkan penarikan sukarela', () => {
    expect(bolehTarik(tarik()).allowed).toBe(true);
  });

  it('MENOLAK penarikan simpanan pokok', () => {
    const v = bolehTarik(tarik({ kind: 'PRINCIPAL' }));
    expect(v.allowed).toBe(false);
    // Pesannya menerangkan sebabnya. Anggota yang mengerti bahwa itu modalnya
    // tidak akan merasa uangnya ditahan sewenang-wenang.
    expect(v.message).toContain('modal');
    expect(v.message).toContain('keanggotaan berakhir');
  });

  it('MENOLAK penarikan simpanan wajib', () => {
    const v = bolehTarik(tarik({ kind: 'MANDATORY' }));
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('modal');
  });

  it('mengizinkan penarikan pokok dan wajib saat keanggotaan berakhir', () => {
    for (const k of ['PRINCIPAL', 'MANDATORY'] as SavingKind[]) {
      expect(bolehTarik(tarik({ kind: k, partOfTermination: true })).allowed).toBe(true);
    }
  });

  it('menolak penarikan melebihi saldo', () => {
    const v = bolehTarik(tarik({ amount: 600_000, balance: 500_000 }));
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('500000');
  });

  it('menghormati saldo minimum dan menyebut maksimal yang dapat ditarik', () => {
    const v = bolehTarik(tarik({ amount: 480_000, balance: 500_000, minimumBalance: 50_000 }));
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('450000');
  });

  it('saldo minimum diabaikan saat penutupan keanggotaan', () => {
    expect(
      bolehTarik(
        tarik({ amount: 500_000, balance: 500_000, minimumBalance: 50_000, partOfTermination: true }),
      ).allowed,
    ).toBe(true);
  });

  it('menolak penarikan simpanan berjangka sebelum jatuh tempo', () => {
    const v = bolehTarik(
      tarik({ kind: 'TIME_DEPOSIT', maturityDate: '2027-01-01', today: '2026-07-31' }),
    );
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('2027-01-01');
  });

  it('mengizinkan pencairan simpanan berjangka pada hari jatuh temponya', () => {
    expect(
      bolehTarik(tarik({ kind: 'TIME_DEPOSIT', maturityDate: '2026-07-31', today: '2026-07-31' }))
        .allowed,
    ).toBe(true);
  });

  it('menolak penarikan saat keanggotaan dibekukan', () => {
    expect(bolehTarik(tarik({ memberStatus: 'SUSPENDED' })).allowed).toBe(false);
  });

  it('penarikan tepat sebesar saldo diizinkan bila tanpa saldo minimum', () => {
    expect(bolehTarik(tarik({ amount: 500_000, balance: 500_000 })).allowed).toBe(true);
  });
});

describe('kemajuan simpanan pokok', () => {
  it('menandai lunas saat mencapai kewajibannya', () => {
    const h = kemajuanPokok(0, 500_000, 500_000);
    expect(h.lunas).toBe(true);
    expect(h.baruSajaLunas).toBe(true);
    expect(h.kurang).toBe(0);
  });

  it('mencicil: belum lunas sampai cicilan terakhir', () => {
    const pertama = kemajuanPokok(0, 200_000, 500_000);
    expect(pertama.lunas).toBe(false);
    expect(pertama.kurang).toBe(300_000);

    const terakhir = kemajuanPokok(200_000, 300_000, 500_000);
    expect(terakhir.lunas).toBe(true);
    expect(terakhir.baruSajaLunas).toBe(true);
  });

  it('setoran pada rekening yang sudah lunas TIDAK memicu pengaktifan ulang', () => {
    /*
     * `baruSajaLunas` dibedakan dari `lunas` justru untuk ini. Tanpa pembedaan
     * itu, setiap setoran berikutnya akan memicu pengaktifan keanggotaan lagi —
     * dan pengaktifan berulang menulis ulang tanggal aktif, yang menentukan
     * masa keanggotaan pada perhitungan SHU.
     */
    const h = kemajuanPokok(500_000, 100_000, 500_000);
    expect(h.lunas).toBe(true);
    expect(h.baruSajaLunas).toBe(false);
  });

  it('setoran berlebih tetap dianggap lunas', () => {
    expect(kemajuanPokok(0, 700_000, 500_000).lunas).toBe(true);
  });
});

describe('tunggakan simpanan wajib', () => {
  it('menghitung periode yang terlewat', () => {
    const t = hitungTunggakan({
      expectedPeriods: ['2026-01', '2026-02', '2026-03', '2026-04'],
      paidPeriods: ['2026-01', '2026-03'],
      amountPerPeriod: 50_000,
    });
    expect(t.missingPeriods).toEqual(['2026-02', '2026-04']);
    expect(t.totalArrears).toBe(100_000);
  });

  it('dihitung dari periode, bukan dari selisih nilai', () => {
    /*
     * Anggota yang menyetor dua kali lipat pada satu bulan tidak dengan
     * sendirinya melunasi bulan yang terlewat — keduanya periode berbeda, dan
     * SHU jasa modal dihitung per periode.
     */
    const t = hitungTunggakan({
      expectedPeriods: ['2026-01', '2026-02'],
      paidPeriods: ['2026-01'],
      amountPerPeriod: 50_000,
    });
    expect(t.missingPeriods).toEqual(['2026-02']);
  });

  it('tanpa tunggakan bila seluruh periode terbayar', () => {
    const t = hitungTunggakan({
      expectedPeriods: ['2026-01', '2026-02'],
      paidPeriods: ['2026-01', '2026-02'],
      amountPerPeriod: 50_000,
    });
    expect(t.totalArrears).toBe(0);
  });

  it('menyusun daftar periode bulanan lintas tahun', () => {
    expect(periodeBulanan('2025-11-05', '2026-02-20')).toEqual([
      '2025-11', '2025-12', '2026-01', '2026-02',
    ]);
  });

  it('satu bulan menghasilkan satu periode', () => {
    expect(periodeBulanan('2026-03-01', '2026-03-31')).toEqual(['2026-03']);
  });
});

describe('dormansi', () => {
  it('rekening sukarela yang lama diam ditandai dormant', () => {
    expect(layakDormant('VOLUNTARY', '2025-01-01', '2026-07-31', 365)).toBe(true);
  });

  it('rekening sukarela yang baru bergerak tidak dormant', () => {
    expect(layakDormant('VOLUNTARY', '2026-07-01', '2026-07-31', 365)).toBe(false);
  });

  it('simpanan pokok dan wajib TIDAK PERNAH dormant', () => {
    /*
     * Keduanya memang tidak bergerak menurut sifatnya. Menandainya dormant akan
     * menyatakan seluruh anggota tidak aktif.
     */
    for (const k of ['PRINCIPAL', 'MANDATORY'] as SavingKind[]) {
      expect(layakDormant(k, '2020-01-01', '2026-07-31', 365)).toBe(false);
    }
  });

  it('rekening yang belum pernah bergerak tidak dormant', () => {
    expect(layakDormant('VOLUNTARY', null, '2026-07-31', 365)).toBe(false);
  });
});

describe('penutupan rekening', () => {
  it('rekening sukarela dapat ditutup kapan saja', () => {
    expect(bolehTutupRekening({ kind: 'VOLUNTARY', balance: 0, memberStatus: 'ACTIVE' }).allowed).toBe(
      true,
    );
  });

  it('rekening pokok hanya dapat ditutup bersama berakhirnya keanggotaan', () => {
    expect(
      bolehTutupRekening({ kind: 'PRINCIPAL', balance: 0, memberStatus: 'ACTIVE' }).allowed,
    ).toBe(false);
    expect(
      bolehTutupRekening({ kind: 'PRINCIPAL', balance: 0, memberStatus: 'TERMINATED' }).allowed,
    ).toBe(true);
  });

  it('menolak penutupan rekening bersaldo negatif', () => {
    expect(
      bolehTutupRekening({ kind: 'VOLUNTARY', balance: -1000, memberStatus: 'ACTIVE' }).allowed,
    ).toBe(false);
  });
});

describe('bagi hasil', () => {
  it('menghitung menurut saldo rata-rata, tarif, dan jumlah hari', () => {
    // 10.000.000 × 6% × 365/365 = 600.000
    expect(bagiHasil(10_000_000, 0.06, 365)).toBe(600_000);
    // seperempat tahun
    expect(bagiHasil(10_000_000, 0.06, 91)).toBe(Math.round((10_000_000 * 0.06 * 91) / 365));
  });

  it('dibulatkan ke rupiah penuh', () => {
    // Pecahan rupiah tidak dapat dibayarkan.
    expect(Number.isInteger(bagiHasil(1_234_567, 0.0575, 37))).toBe(true);
  });

  it('nol untuk masukan yang tidak masuk akal', () => {
    expect(bagiHasil(0, 0.06, 365)).toBe(0);
    expect(bagiHasil(1_000_000, 0, 365)).toBe(0);
    expect(bagiHasil(1_000_000, 0.06, 0)).toBe(0);
    expect(bagiHasil(-1_000_000, 0.06, 365)).toBe(0);
  });

  it('memakai saldo rata-rata harian, bukan saldo akhir', () => {
    /*
     * Saldo akhir memungkinkan seseorang menyetor besar pada hari terakhir dan
     * memperoleh bagi hasil sebulan penuh atasnya.
     */
    const mutasi = [
      { date: '2026-01-01', transactionType: 'DEPOSIT' as const, amount: 1_000_000 },
      { date: '2026-01-31', transactionType: 'DEPOSIT' as const, amount: 100_000_000 },
    ];
    const rata = saldoRataRataHarian(mutasi, '2026-01-01', '2026-01-31');
    // 30 hari bersaldo 1 juta, 1 hari bersaldo 101 juta -> jauh di bawah 101 juta.
    expect(rata).toBeLessThan(10_000_000);
    expect(rata).toBeGreaterThan(1_000_000);
  });

  it('saldo rata-rata sama dengan saldo tetap bila tidak ada mutasi di tengah', () => {
    const mutasi = [{ date: '2026-01-01', transactionType: 'DEPOSIT' as const, amount: 5_000_000 }];
    expect(saldoRataRataHarian(mutasi, '2026-01-01', '2026-01-31')).toBe(5_000_000);
  });

  it('mutasi setelah rentang tidak ikut dihitung', () => {
    const mutasi = [
      { date: '2026-01-01', transactionType: 'DEPOSIT' as const, amount: 1_000_000 },
      { date: '2026-03-01', transactionType: 'DEPOSIT' as const, amount: 9_000_000 },
    ];
    expect(saldoRataRataHarian(mutasi, '2026-01-01', '2026-01-31')).toBe(1_000_000);
  });
});
