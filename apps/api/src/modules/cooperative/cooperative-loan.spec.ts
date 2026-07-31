/**
 * Pengujian aturan pinjaman.
 *
 * Berkas yang diuji di sini menghitung uang, jadi pengujiannya menuntut angka
 * yang dapat dihitung tangan — bukan sekadar "hasilnya tidak kosong".
 *
 * Tiga hal dijaga paling ketat:
 *
 * 1. **Jumlah seluruh angsuran persis sama dengan kewajibannya.** Selisih
 *    sekecil satu rupiah, dikalikan ribuan pinjaman, menjadi selisih pembukuan
 *    yang tidak dapat dijelaskan.
 * 2. **Pembayaran dialokasikan denda → jasa → pokok.** Mendahulukan pokok
 *    membuat tunggakan terus bertambah meskipun anggota membayar tiap bulan.
 * 3. **Yang menganalisis tidak menyetujui, yang menyetujui tidak mencairkan.**
 */

import {
  BATAS_RISIKO,
  LOAN_STATUSES,
  LOAN_TRANSITIONS,
  RISK_CLASSES,
  alokasikanPembayaran,
  bentukJadwal,
  bolehPindahStatusPinjaman,
  golonganRisiko,
  hitungDenda,
  hitungPar,
  hitungPelunasan,
  hitungPenyisihan,
  isSyariah,
  layakMeminjam,
  metodeSesuai,
  periksaKelayakanPinjaman,
  periksaPemisahanWewenang,
  selisihBulan,
  tambahBulan,
  totalJadwal,
  type KelayakanPinjamanInput,
  type LoanStatus,
} from './cooperative-loan';

const layak = (over: Partial<KelayakanPinjamanInput> = {}): KelayakanPinjamanInput => ({
  memberStatus: 'ACTIVE',
  memberSince: '2024-01-01',
  today: '2026-07-31',
  minimumMembershipMonths: 6,
  mandatorySavingBalance: 1_200_000,
  minimumMandatorySaving: 500_000,
  maxLoanToSavingRatio: 3,
  totalSavingBalance: 2_000_000,
  requestedAmount: 5_000_000,
  productMinAmount: 500_000,
  productMaxAmount: 20_000_000,
  activeLoanCount: 0,
  productMaxActiveLoans: 1,
  outstandingArrears: 0,
  hasWriteOffHistory: false,
  ...over,
});

describe('kesesuaian metode dengan jenis koperasi', () => {
  it('koperasi syariah menolak metode berbunga', () => {
    for (const m of ['FLAT', 'EFFECTIVE', 'ANNUITY'] as const) {
      const v = metodeSesuai(m, true);
      expect(v.allowed).toBe(false);
      expect(v.message).toContain('murabahah');
    }
  });

  it('koperasi syariah menerima akad syariah', () => {
    for (const m of ['MURABAHA', 'MUDHARABAH', 'IJARAH', 'QARDH'] as const) {
      expect(metodeSesuai(m, true).allowed).toBe(true);
      expect(isSyariah(m)).toBe(true);
    }
  });

  it('koperasi konvensional menolak akad syariah', () => {
    // Menjual murabahah tanpa Dewan Pengawas Syariah berarti menjual sesuatu
    // yang tidak dapat dipertanggungjawabkan kesyariahannya.
    const v = metodeSesuai('MURABAHA', false);
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('Dewan Pengawas Syariah');
  });
});

describe('kelayakan mengajukan pinjaman', () => {
  it('meloloskan anggota yang memenuhi syarat', () => {
    expect(periksaKelayakanPinjaman(layak())).toEqual([]);
    expect(layakMeminjam(layak())).toBe(true);
  });

  it('MENOLAK calon anggota', () => {
    /*
     * Meminjamkan uang kepada orang yang bukan anggota adalah usaha simpan
     * pinjam kepada umum, yang memerlukan izin berbeda sama sekali.
     */
    const v = periksaKelayakanPinjaman(layak({ memberStatus: 'PENDING_PRINCIPAL_SAVING' }));
    expect(v.map((k) => k.code)).toContain('NOT_ACTIVE_MEMBER');
    expect(v[0].message).toContain('Simpanan pokok belum lunas');
  });

  it('menolak masa keanggotaan yang belum cukup', () => {
    const v = periksaKelayakanPinjaman(
      layak({ memberSince: '2026-05-01', minimumMembershipMonths: 6 }),
    );
    expect(v.map((k) => k.code)).toContain('MEMBERSHIP_TOO_SHORT');
  });

  it('menolak simpanan wajib yang belum cukup', () => {
    expect(
      periksaKelayakanPinjaman(layak({ mandatorySavingBalance: 100_000 })).map((k) => k.code),
    ).toContain('MANDATORY_SAVING_INSUFFICIENT');
  });

  it('menolak pengajuan melebihi plafon produk', () => {
    expect(
      periksaKelayakanPinjaman(layak({ requestedAmount: 50_000_000 })).map((k) => k.code),
    ).toContain('ABOVE_MAXIMUM');
  });

  it('menolak melebihi rasio terhadap simpanan, dan menyebut batasnya', () => {
    const v = periksaKelayakanPinjaman(
      layak({ requestedAmount: 9_000_000, totalSavingBalance: 2_000_000, maxLoanToSavingRatio: 3 }),
    );
    const k = v.find((x) => x.code === 'ABOVE_SAVING_RATIO');
    expect(k).toBeDefined();
    expect(k?.message).toContain('6000000');
  });

  it('menolak pinjaman ganda melebihi batas produk', () => {
    expect(
      periksaKelayakanPinjaman(layak({ activeLoanCount: 1, productMaxActiveLoans: 1 })).map(
        (k) => k.code,
      ),
    ).toContain('TOO_MANY_ACTIVE_LOANS');
  });

  it('menolak yang masih menunggak', () => {
    expect(
      periksaKelayakanPinjaman(layak({ outstandingArrears: 250_000 })).map((k) => k.code),
    ).toContain('HAS_ARREARS');
  });

  it('menandai riwayat penghapusbukuan', () => {
    expect(
      periksaKelayakanPinjaman(layak({ hasWriteOffHistory: true })).map((k) => k.code),
    ).toContain('WRITE_OFF_HISTORY');
  });

  it('melaporkan seluruh kekurangan sekaligus', () => {
    const v = periksaKelayakanPinjaman(
      layak({
        memberStatus: 'INACTIVE',
        mandatorySavingBalance: 0,
        requestedAmount: 100_000_000,
        activeLoanCount: 3,
        outstandingArrears: 1_000,
        hasWriteOffHistory: true,
      }),
    );
    expect(v.length).toBeGreaterThanOrEqual(6);
    const kode = v.map((k) => k.code);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('menghitung selisih bulan dengan memperhatikan tanggalnya', () => {
    expect(selisihBulan('2026-01-15', '2026-07-14')).toBe(5);
    expect(selisihBulan('2026-01-15', '2026-07-15')).toBe(6);
    expect(selisihBulan('2024-01-01', '2026-07-31')).toBe(30);
  });
});

describe('jadwal angsuran — flat', () => {
  const jadwal = bentukJadwal({
    method: 'FLAT',
    principal: 12_000_000,
    annualRate: 0.12,
    tenorMonths: 12,
    firstDueDate: '2026-08-10',
  });

  it('menghasilkan angsuran sebanyak tenornya', () => {
    expect(jadwal).toHaveLength(12);
  });

  it('bunga dihitung dari pokok awal: 12jt × 12% × 1 tahun = 1,44jt', () => {
    expect(totalJadwal(jadwal).interest).toBe(1_440_000);
  });

  it('jumlah pokok seluruh angsuran persis sama dengan pinjamannya', () => {
    expect(totalJadwal(jadwal).principal).toBe(12_000_000);
  });

  it('angsuran bulanan tetap besarnya', () => {
    const awal = jadwal.slice(0, -1).map((b) => b.totalDue);
    expect(new Set(awal).size).toBe(1);
  });

  it('sisa pokok pada angsuran terakhir menjadi nol', () => {
    expect(jadwal[jadwal.length - 1].remainingPrincipal).toBe(0);
  });

  it('tanggal jatuh tempo bergerak sebulan sekali', () => {
    expect(jadwal[0].dueDate).toBe('2026-08-10');
    expect(jadwal[1].dueDate).toBe('2026-09-10');
    expect(jadwal[11].dueDate).toBe('2027-07-10');
  });
});

describe('jadwal angsuran — pembulatan', () => {
  it('selisih pembulatan dibebankan pada angsuran TERAKHIR', () => {
    /*
     * Membebankannya di awal akan membuat angsuran pertama berbeda dari yang
     * disebutkan saat akad — dan itulah angka yang diingat anggota.
     */
    const jadwal = bentukJadwal({
      method: 'FLAT',
      principal: 10_000_000,
      annualRate: 0.1,
      tenorMonths: 7,
      firstDueDate: '2026-08-01',
    });
    const t = totalJadwal(jadwal);
    expect(t.principal).toBe(10_000_000);
    const awal = jadwal.slice(0, -1).map((b) => b.principalDue);
    expect(new Set(awal).size).toBe(1);
    // Angsuran terakhir menyerap sisanya.
    expect(jadwal[6].principalDue).not.toBe(jadwal[0].principalDue);
  });

  it('seluruh nilai angsuran berupa bilangan bulat rupiah', () => {
    const jadwal = bentukJadwal({
      method: 'EFFECTIVE',
      principal: 7_777_777,
      annualRate: 0.1375,
      tenorMonths: 11,
      firstDueDate: '2026-08-01',
    });
    for (const b of jadwal) {
      expect(Number.isInteger(b.principalDue)).toBe(true);
      expect(Number.isInteger(b.interestDue)).toBe(true);
      expect(Number.isInteger(b.totalDue)).toBe(true);
    }
  });

  it('jumlah pokok selalu sama dengan pinjaman, apa pun metode dan tenornya', () => {
    // Invarian yang paling penting pada seluruh berkas ini.
    for (const method of ['FLAT', 'EFFECTIVE', 'ANNUITY'] as const) {
      for (const tenor of [1, 2, 3, 6, 7, 11, 12, 24, 36]) {
        for (const pokok of [1_000_000, 3_333_333, 12_500_000, 99_999_999]) {
          const jadwal = bentukJadwal({
            method,
            principal: pokok,
            annualRate: 0.12,
            tenorMonths: tenor,
            firstDueDate: '2026-08-01',
          });
          expect(totalJadwal(jadwal).principal).toBe(pokok);
          expect(jadwal[jadwal.length - 1].remainingPrincipal).toBe(0);
        }
      }
    }
  });
});

describe('jadwal angsuran — efektif dan anuitas', () => {
  it('bunga efektif menurun karena dihitung dari sisa pokok', () => {
    const jadwal = bentukJadwal({
      method: 'EFFECTIVE',
      principal: 12_000_000,
      annualRate: 0.12,
      tenorMonths: 12,
      firstDueDate: '2026-08-01',
    });
    expect(jadwal[0].interestDue).toBe(120_000); // 12jt × 1%
    expect(jadwal[1].interestDue).toBeLessThan(jadwal[0].interestDue);
    expect(jadwal[11].interestDue).toBeLessThan(jadwal[5].interestDue);
  });

  it('bunga efektif lebih murah daripada flat pada tarif yang sama', () => {
    const arg = { principal: 12_000_000, annualRate: 0.12, tenorMonths: 12, firstDueDate: '2026-08-01' };
    const flat = totalJadwal(bentukJadwal({ ...arg, method: 'FLAT' }));
    const efektif = totalJadwal(bentukJadwal({ ...arg, method: 'EFFECTIVE' }));
    expect(efektif.interest).toBeLessThan(flat.interest);
  });

  it('anuitas menghasilkan angsuran total yang hampir tetap', () => {
    const jadwal = bentukJadwal({
      method: 'ANNUITY',
      principal: 12_000_000,
      annualRate: 0.12,
      tenorMonths: 12,
      firstDueDate: '2026-08-01',
    });
    const awal = jadwal.slice(0, -1).map((b) => b.totalDue);
    expect(Math.max(...awal) - Math.min(...awal)).toBeLessThanOrEqual(1);
  });

  it('anuitas: pokok naik, bunga turun', () => {
    const jadwal = bentukJadwal({
      method: 'ANNUITY',
      principal: 12_000_000,
      annualRate: 0.12,
      tenorMonths: 12,
      firstDueDate: '2026-08-01',
    });
    expect(jadwal[0].principalDue).toBeLessThan(jadwal[10].principalDue);
    expect(jadwal[0].interestDue).toBeGreaterThan(jadwal[10].interestDue);
  });

  it('tarif nol menghasilkan jadwal tanpa bunga', () => {
    const jadwal = bentukJadwal({
      method: 'ANNUITY',
      principal: 6_000_000,
      annualRate: 0,
      tenorMonths: 6,
      firstDueDate: '2026-08-01',
    });
    expect(totalJadwal(jadwal).interest).toBe(0);
    expect(totalJadwal(jadwal).principal).toBe(6_000_000);
  });
});

describe('jadwal angsuran — akad syariah', () => {
  it('murabahah memakai margin total, bukan tarif berjalan', () => {
    const jadwal = bentukJadwal({
      method: 'MURABAHA',
      principal: 10_000_000,
      annualRate: 0,
      totalMargin: 2_000_000,
      tenorMonths: 10,
      firstDueDate: '2026-08-01',
    });
    const t = totalJadwal(jadwal);
    expect(t.principal).toBe(10_000_000);
    expect(t.interest).toBe(2_000_000);
    expect(t.total).toBe(12_000_000);
  });

  it('qardh tanpa margin sama sekali', () => {
    const jadwal = bentukJadwal({
      method: 'QARDH',
      principal: 3_000_000,
      annualRate: 0,
      tenorMonths: 6,
      firstDueDate: '2026-08-01',
    });
    expect(totalJadwal(jadwal).interest).toBe(0);
  });

  it('mudharabah: jadwal hanya memuat pokok', () => {
    // Bagi hasil dihitung dari laba usaha yang belum diketahui saat akad,
    // sehingga tidak dapat dijadwalkan di muka.
    const jadwal = bentukJadwal({
      method: 'MUDHARABAH',
      principal: 5_000_000,
      annualRate: 0,
      tenorMonths: 5,
      firstDueDate: '2026-08-01',
    });
    expect(totalJadwal(jadwal).interest).toBe(0);
    expect(totalJadwal(jadwal).principal).toBe(5_000_000);
  });
});

describe('penambahan bulan pada tanggal', () => {
  it('bergerak lurus pada bulan biasa', () => {
    expect(tambahBulan('2026-01-15', 1)).toBe('2026-02-15');
    expect(tambahBulan('2026-01-15', 12)).toBe('2027-01-15');
  });

  it('tanggal 31 menyesuaikan pada bulan yang lebih pendek', () => {
    // Tanpa penyesuaian ini, 31 Januari + 1 bulan menghasilkan 31 Februari —
    // tanggal yang tidak ada, dan jatuh tempo yang tidak pernah tiba.
    expect(tambahBulan('2026-01-31', 1)).toBe('2026-02-28');
    expect(tambahBulan('2026-03-31', 1)).toBe('2026-04-30');
  });

  it('memperhatikan tahun kabisat', () => {
    expect(tambahBulan('2028-01-31', 1)).toBe('2028-02-29');
  });
});

describe('alokasi pembayaran', () => {
  it('membagi denda dahulu, lalu jasa, lalu pokok', () => {
    /*
     * Mendahulukan pokok akan membuat denda dan jasa menumpuk tanpa pernah
     * terbayar, dan tunggakan terus bertambah meskipun anggota membayar tiap
     * bulan.
     */
    const h = alokasikanPembayaran({
      amount: 1_000_000,
      penaltyDue: 50_000,
      interestDue: 200_000,
      principalDue: 800_000,
    });
    expect(h.toPenalty).toBe(50_000);
    expect(h.toInterest).toBe(200_000);
    expect(h.toPrincipal).toBe(750_000);
    expect(h.excess).toBe(0);
  });

  it('pembayaran kurang tidak sampai ke pokok', () => {
    const h = alokasikanPembayaran({
      amount: 100_000,
      penaltyDue: 50_000,
      interestDue: 200_000,
      principalDue: 800_000,
    });
    expect(h.toPenalty).toBe(50_000);
    expect(h.toInterest).toBe(50_000);
    expect(h.toPrincipal).toBe(0);
  });

  it('kelebihan bayar dilaporkan, bukan diserap diam-diam', () => {
    const h = alokasikanPembayaran({
      amount: 2_000_000,
      penaltyDue: 0,
      interestDue: 200_000,
      principalDue: 800_000,
    });
    expect(h.excess).toBe(1_000_000);
  });

  it('seluruh alokasi berjumlah sama dengan pembayarannya', () => {
    for (const bayar of [0, 1, 99_999, 1_000_000, 5_000_000]) {
      const h = alokasikanPembayaran({
        amount: bayar,
        penaltyDue: 50_000,
        interestDue: 200_000,
        principalDue: 800_000,
      });
      expect(h.toPenalty + h.toInterest + h.toPrincipal + h.excess).toBe(bayar);
    }
  });

  it('nilai negatif diperlakukan sebagai nol', () => {
    const h = alokasikanPembayaran({
      amount: -100,
      penaltyDue: -50,
      interestDue: 100,
      principalDue: 100,
    });
    expect(h.toPenalty).toBe(0);
    expect(h.toInterest).toBe(0);
    expect(h.excess).toBe(0);
  });
});

describe('denda keterlambatan', () => {
  it('tidak ada denda dalam masa tenggang', () => {
    expect(
      hitungDenda({ overdueAmount: 1_000_000, daysLate: 5, dailyRate: 0.001, gracePeriodDays: 7, maxMultiplier: 0 }),
    ).toBe(0);
  });

  it('dihitung setelah masa tenggang lewat', () => {
    // 1jt × 0,1% × (17 − 7) hari = 10.000
    expect(
      hitungDenda({ overdueAmount: 1_000_000, daysLate: 17, dailyRate: 0.001, gracePeriodDays: 7, maxMultiplier: 0 }),
    ).toBe(10_000);
  });

  it('dibatasi kelipatan nilai tertunggak', () => {
    /*
     * Tanpa batas, denda pada pinjaman yang lama menunggak dapat melampaui
     * pokoknya sendiri — dan tagihan yang mustahil dibayar tidak menolong
     * siapa pun.
     */
    const d = hitungDenda({
      overdueAmount: 1_000_000,
      daysLate: 3650,
      dailyRate: 0.001,
      gracePeriodDays: 0,
      maxMultiplier: 0.5,
    });
    expect(d).toBe(500_000);
  });

  it('tanpa tarif denda tidak menghasilkan denda', () => {
    expect(
      hitungDenda({ overdueAmount: 1_000_000, daysLate: 100, dailyRate: 0, gracePeriodDays: 0, maxMultiplier: 0 }),
    ).toBe(0);
  });
});

describe('golongan risiko dan penyisihan', () => {
  it('lancar bila tidak menunggak', () => {
    expect(golonganRisiko(0)).toBe('CURRENT');
  });

  it('naik golongan seiring lamanya menunggak', () => {
    expect(golonganRisiko(30)).toBe('SPECIAL_MENTION');
    expect(golonganRisiko(120)).toBe('SUBSTANDARD');
    expect(golonganRisiko(200)).toBe('DOUBTFUL');
    expect(golonganRisiko(400)).toBe('LOSS');
  });

  it('setiap golongan punya tarif penyisihan', () => {
    for (const k of RISK_CLASSES) {
      const b = BATAS_RISIKO.find((x) => x.kelas === k);
      expect(b).toBeDefined();
      expect(b!.provisionRate).toBeGreaterThan(0);
    }
  });

  it('tarif penyisihan naik seiring golongannya', () => {
    for (let i = 1; i < BATAS_RISIKO.length; i += 1) {
      expect(BATAS_RISIKO[i].provisionRate).toBeGreaterThan(BATAS_RISIKO[i - 1].provisionRate);
    }
  });

  it('golongan macet disisihkan penuh', () => {
    expect(hitungPenyisihan(10_000_000, 400)).toBe(10_000_000);
  });

  it('penyisihan dibulatkan ke rupiah penuh', () => {
    expect(Number.isInteger(hitungPenyisihan(3_333_333, 120))).toBe(true);
  });
});

describe('portfolio at risk', () => {
  it('menghitung dari SELURUH sisa pinjaman yang menunggak', () => {
    /*
     * Anggota yang menunggak satu angsuran dari dua puluh tetap membawa risiko
     * atas seluruh sisa pinjamannya. PAR yang menghitung angsurannya saja akan
     * menyatakan portofolio jauh lebih sehat daripada sebenarnya.
     */
    const par = hitungPar(
      [
        { outstanding: 10_000_000, daysOverdue: 0 },
        { outstanding: 5_000_000, daysOverdue: 45 },
        { outstanding: 5_000_000, daysOverdue: 200 },
      ],
      30,
    );
    expect(par.totalPortfolio).toBe(20_000_000);
    expect(par.atRisk).toBe(10_000_000);
    expect(par.ratio).toBeCloseTo(0.5);
  });

  it('portofolio kosong menghasilkan rasio nol, bukan pembagian nol', () => {
    expect(hitungPar([], 30).ratio).toBe(0);
  });

  it('ambang hari menentukan yang ikut terhitung', () => {
    const items = [{ outstanding: 1_000_000, daysOverdue: 30 }];
    expect(hitungPar(items, 30).atRisk).toBe(0);
    expect(hitungPar(items, 29).atRisk).toBe(1_000_000);
  });
});

describe('pelunasan dipercepat', () => {
  it('konvensional: jasa yang belum berjalan tidak ditagih', () => {
    const h = hitungPelunasan({
      method: 'EFFECTIVE',
      remainingPrincipal: 5_000_000,
      unearnedInterest: 600_000,
      accruedPenalty: 0,
      earlySettlementDiscount: 0,
    });
    expect(h.interest).toBe(0);
    expect(h.total).toBe(5_000_000);
  });

  it('murabahah: margin akad tetap terutang', () => {
    /*
     * Margin murabahah adalah bagian dari harga jual yang disepakati saat akad
     * — ia bukan bunga berjalan. Menghapusnya otomatis pada pelunasan
     * dipercepat akan memperlakukan akad jual-beli sebagai pinjaman berbunga.
     */
    const h = hitungPelunasan({
      method: 'MURABAHA',
      remainingPrincipal: 5_000_000,
      unearnedInterest: 600_000,
      accruedPenalty: 0,
      earlySettlementDiscount: 0,
    });
    expect(h.interest).toBe(600_000);
    expect(h.total).toBe(5_600_000);
    expect(h.note).toContain('tetap terutang');
  });

  it('murabahah dengan potongan sukarela disebut muqasah', () => {
    const h = hitungPelunasan({
      method: 'MURABAHA',
      remainingPrincipal: 5_000_000,
      unearnedInterest: 600_000,
      accruedPenalty: 0,
      earlySettlementDiscount: 0.5,
    });
    expect(h.interest).toBe(300_000);
    expect(h.note).toContain('muqasah');
  });

  it('denda yang sudah timbul tetap ditagih pada kedua jalur', () => {
    for (const m of ['EFFECTIVE', 'MURABAHA'] as const) {
      const h = hitungPelunasan({
        method: m,
        remainingPrincipal: 1_000_000,
        unearnedInterest: 0,
        accruedPenalty: 75_000,
        earlySettlementDiscount: 0,
      });
      expect(h.penalty).toBe(75_000);
    }
  });
});

describe('status pinjaman', () => {
  it('setiap status punya entri transisi', () => {
    for (const s of LOAN_STATUSES) expect(LOAN_TRANSITIONS[s]).toBeDefined();
  });

  it('setiap status dapat dicapai dari DRAFT', () => {
    const tercapai = new Set<LoanStatus>(['DRAFT']);
    let berubah = true;
    while (berubah) {
      berubah = false;
      for (const s of [...tercapai]) {
        for (const t of LOAN_TRANSITIONS[s]) {
          if (!tercapai.has(t)) {
            tercapai.add(t);
            berubah = true;
          }
        }
      }
    }
    expect(LOAN_STATUSES.filter((s) => !tercapai.has(s))).toEqual([]);
  });

  it('pencairan dan pengaktifan dipisah', () => {
    // Uang keluar lebih dahulu; jadwal angsurannya dibekukan sesudahnya.
    expect(LOAN_TRANSITIONS.DISBURSED).toEqual(['ACTIVE']);
  });

  it('penghapusbukuan bersifat akhir', () => {
    /*
     * Penghapusbukuan tidak menghapus kewajiban anggota. Penerimaan sesudahnya
     * dicatat sebagai pemulihan, bukan dengan menghidupkan kembali pinjamannya.
     */
    expect(LOAN_TRANSITIONS.WRITTEN_OFF).toEqual([]);
  });

  it('mencairkan menuntut hak akses BERBEDA dari menyetujui', () => {
    expect(bolehPindahStatusPinjaman('PENDING_APPROVAL', 'APPROVED').requiresPermission).toBe(
      'COOPERATIVE_LOAN_APPLICATION.APPROVE',
    );
    expect(bolehPindahStatusPinjaman('APPROVED', 'DISBURSED').requiresPermission).toBe(
      'COOPERATIVE_LOAN.DISBURSE',
    );
  });

  it('penghapusbukuan menuntut hak akses dan persetujuan', () => {
    const v = bolehPindahStatusPinjaman('IN_ARREARS', 'WRITTEN_OFF');
    expect(v.requiresPermission).toBe('COOPERATIVE_LOAN.WRITE_OFF');
    expect(v.requiresApproval).toBe(true);
  });

  it('pinjaman menunggak dapat kembali lancar setelah dilunasi tunggakannya', () => {
    expect(bolehPindahStatusPinjaman('IN_ARREARS', 'ACTIVE').allowed).toBe(true);
  });
});

describe('pemisahan wewenang jalur pinjaman', () => {
  it('penyurvei tidak menganalisis surveinya sendiri', () => {
    const v = periksaPemisahanWewenang({
      analyzedBy: null, surveyedBy: 'U1', approvedBy: null, disbursedBy: null,
      actorId: 'U1', action: 'ANALYZE',
    });
    expect(v.allowed).toBe(false);
  });

  it('penganalisis tidak menyetujui analisisnya sendiri', () => {
    const v = periksaPemisahanWewenang({
      analyzedBy: 'U2', surveyedBy: null, approvedBy: null, disbursedBy: null,
      actorId: 'U2', action: 'APPROVE',
    });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('bukan analisis');
  });

  it('penyetuju tidak mencairkan yang disetujuinya', () => {
    const v = periksaPemisahanWewenang({
      analyzedBy: 'U2', surveyedBy: null, approvedBy: 'U3', disbursedBy: null,
      actorId: 'U3', action: 'DISBURSE',
    });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('dipisahkan');
  });

  it('orang berbeda pada setiap tahap diizinkan', () => {
    expect(
      periksaPemisahanWewenang({
        analyzedBy: 'U2', surveyedBy: 'U1', approvedBy: 'U3', disbursedBy: null,
        actorId: 'U4', action: 'DISBURSE',
      }).allowed,
    ).toBe(true);
  });

  it('tahap yang belum dilalui tidak menghalangi', () => {
    // Pengajuan yang tidak melalui survei tetap dapat dianalisis.
    expect(
      periksaPemisahanWewenang({
        analyzedBy: null, surveyedBy: null, approvedBy: null, disbursedBy: null,
        actorId: 'U1', action: 'ANALYZE',
      }).allowed,
    ).toBe(true);
  });
});
