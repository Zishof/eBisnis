/**
 * Pengujian aturan kontrak fee sistem dan fee investor.
 *
 * Yang dijaga paling ketat: bawaannya NONE, tiga orang berbeda, batas maksimum
 * ditegakkan saat menghitung, kontrak yang habis menghentikan fee-nya sendiri,
 * dan investor tidak pernah melihat data pasien.
 */

import {
  MEDAN_BOLEH_INVESTOR,
  bolehAktifkanKontrak,
  bolehDilihatInvestor,
  bolehPindahStatusKontrak,
  hitungFeeKontrak,
  periksaRantai,
  saringUntukInvestor,
  type KontrakFee,
  type StatusKontrak,
} from './health-fee-contract';

const kontrak = (over: Partial<KontrakFee> = {}): KontrakFee => ({
  contractType: 'SYSTEM_PLATFORM_FEE',
  contractReference: 'PKS-001/2026',
  legalReviewNote: 'Ditelaah bagian hukum; tidak ada klausul yang bertentangan.',
  taxTreatment: 'PPh 23 dipotong rumah sakit.',
  maximumPercent: 5,
  effectiveFrom: '2026-02-01',
  effectiveTo: null,
  legalReviewedAt: '2026-01-15',
  chain: { preparedBy: 'a', reviewedBy: 'b', approvedBy: 'c' },
  ...over,
});

const aktif = (over: Record<string, unknown> = {}) => ({
  contractType: 'SYSTEM_PLATFORM_FEE' as const,
  status: 'ACTIVE' as StatusKontrak,
  maximumPercent: 5,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  excludedServiceIds: [],
  ...over,
});

describe('status kontrak', () => {
  it('draft masuk telaah hukum', () => {
    expect(bolehPindahStatusKontrak({ from: 'DRAFT', to: 'LEGAL_REVIEW' }).allowed).toBe(true);
  });

  it('urutan penuh sampai aktif', () => {
    for (const [a, b] of [
      ['DRAFT', 'LEGAL_REVIEW'],
      ['LEGAL_REVIEW', 'MANAGEMENT_APPROVAL'],
      ['MANAGEMENT_APPROVAL', 'ACTIVE'],
    ] as Array<[StatusKontrak, StatusKontrak]>) {
      expect(bolehPindahStatusKontrak({ from: a, to: b }).allowed).toBe(true);
    }
  });

  it('draft TIDAK dapat langsung menjadi aktif', () => {
    expect(bolehPindahStatusKontrak({ from: 'DRAFT', to: 'ACTIVE' }).allowed).toBe(false);
  });

  it('telaah hukum dapat dikembalikan ke draft', () => {
    expect(bolehPindahStatusKontrak({ from: 'LEGAL_REVIEW', to: 'DRAFT' }).allowed).toBe(true);
  });

  it('yang aktif dapat ditangguhkan dan dihidupkan lagi', () => {
    expect(bolehPindahStatusKontrak({ from: 'ACTIVE', to: 'SUSPENDED' }).allowed).toBe(true);
    expect(bolehPindahStatusKontrak({ from: 'SUSPENDED', to: 'ACTIVE' }).allowed).toBe(true);
  });

  it('yang sudah DIAKHIRI tidak dihidupkan kembali', () => {
    /*
     * Kontrak baru menuntut telaah hukum baru — keadaan yang membuatnya
     * diakhiri mungkin masih ada.
     */
    const h = bolehPindahStatusKontrak({ from: 'TERMINATED', to: 'ACTIVE' });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('telaah hukum baru');
  });

  it('yang sudah kedaluwarsa hanya dapat diakhiri', () => {
    expect(bolehPindahStatusKontrak({ from: 'EXPIRED', to: 'ACTIVE' }).allowed).toBe(false);
    expect(bolehPindahStatusKontrak({ from: 'EXPIRED', to: 'TERMINATED' }).allowed).toBe(true);
  });

  it('status yang tidak dikenal ditolak', () => {
    expect(
      bolehPindahStatusKontrak({ from: 'TIDAK_ADA' as StatusKontrak, to: 'ACTIVE' }).allowed,
    ).toBe(false);
  });
});

describe('rantai tiga orang', () => {
  it('tiga orang berbeda diterima', () => {
    expect(periksaRantai({ preparedBy: 'a', reviewedBy: 'b', approvedBy: 'c' }).valid).toBe(true);
  });

  it('penyusun yang juga pemeriksa DITOLAK', () => {
    const h = periksaRantai({ preparedBy: 'a', reviewedBy: 'a', approvedBy: 'c' });
    expect(h.valid).toBe(false);
    expect(h.message).toContain('tidak duduk di ruangan itu');
  });

  it('pemeriksa yang juga penyetuju ditolak', () => {
    expect(periksaRantai({ preparedBy: 'a', reviewedBy: 'b', approvedBy: 'b' }).valid).toBe(false);
  });

  it('satu orang memegang ketiganya ditolak', () => {
    expect(periksaRantai({ preparedBy: 'a', reviewedBy: 'a', approvedBy: 'a' }).valid).toBe(false);
  });

  it('rantai yang belum lengkap menyebut yang kurang satu per satu', () => {
    const h = periksaRantai({ preparedBy: 'a' });
    expect(h.valid).toBe(false);
    expect(h.missing).toEqual(['pemeriksa hukum', 'penyetuju manajemen']);
  });
});

describe('aktivasi kontrak', () => {
  it('kontrak lengkap dapat diaktifkan', () => {
    expect(bolehAktifkanKontrak(kontrak()).allowed).toBe(true);
  });

  it('kontrak kosong menyebut SELURUH yang kurang', () => {
    /*
     * Daftar syarat yang hanya berkata "belum lengkap" akan diisi seadanya
     * sampai tombolnya menyala.
     */
    const h = bolehAktifkanKontrak(
      kontrak({
        contractReference: null,
        legalReviewNote: null,
        taxTreatment: null,
        maximumPercent: null,
        effectiveFrom: null,
        chain: {},
      }),
    );
    expect(h.allowed).toBe(false);
    expect(h.missing.length).toBeGreaterThanOrEqual(8);
  });

  it('pesannya menegaskan bawaannya NONE', () => {
    const h = bolehAktifkanKontrak(kontrak({ contractReference: null }));
    expect(h.message).toContain('bukan taksiran, nol');
  });

  it('kurang satu syarat pun tetap ditolak', () => {
    expect(bolehAktifkanKontrak(kontrak({ taxTreatment: null })).missing).toEqual([
      'perlakuan pajak',
    ]);
  });

  it('batas maksimum nol dianggap ada, bukan kosong', () => {
    expect(bolehAktifkanKontrak(kontrak({ maximumPercent: 0 })).allowed).toBe(true);
  });

  it('kontrak yang berlaku SEBELUM telaah hukumnya DITOLAK', () => {
    // Pemeriksaannya tidak pernah menahan apa pun.
    const h = bolehAktifkanKontrak(
      kontrak({ effectiveFrom: '2026-01-01', legalReviewedAt: '2026-01-15' }),
    );
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('tidak pernah menahan apa pun');
  });

  it('kontrak yang berlaku tepat pada hari telaahnya diterima', () => {
    expect(
      bolehAktifkanKontrak(kontrak({ effectiveFrom: '2026-01-15', legalReviewedAt: '2026-01-15' }))
        .allowed,
    ).toBe(true);
  });

  it('tanggal berakhir yang mendahului tanggal berlaku ditolak', () => {
    const h = bolehAktifkanKontrak(
      kontrak({ effectiveFrom: '2026-06-01', effectiveTo: '2026-01-01' }),
    );
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('mendahului');
  });

  it('rantai yang tidak berbeda orangnya ikut dilaporkan sebagai kurang', () => {
    const h = bolehAktifkanKontrak(
      kontrak({ chain: { preparedBy: 'a', reviewedBy: 'a', approvedBy: 'a' } }),
    );
    expect(h.allowed).toBe(false);
  });
});

describe('perhitungan fee kontrak', () => {
  it('TANPA kontrak, fee-nya NOL', () => {
    const h = hitungFeeKontrak({
      contract: null,
      requestedPercent: 5,
      baseAmount: 10000000,
      onDate: '2026-06-01',
    });
    expect(h.feeAmount).toBe(0);
    expect(h.message).toContain('bukan taksiran, nol');
  });

  it('kontrak aktif menghitung fee-nya', () => {
    const h = hitungFeeKontrak({
      contract: aktif(),
      requestedPercent: 5,
      baseAmount: 10000000,
      onDate: '2026-06-01',
    });
    expect(h.feeAmount).toBe(500000);
    expect(h.capped).toBe(false);
  });

  it('BATAS MAKSIMUM ditegakkan saat menghitung', () => {
    /*
     * Batas yang hanya tertulis pada kontrak akan dilampaui oleh perhitungan
     * yang tidak pernah membacanya.
     */
    const h = hitungFeeKontrak({
      contract: aktif({ maximumPercent: 5 }),
      requestedPercent: 20,
      baseAmount: 10000000,
      onDate: '2026-06-01',
    });
    expect(h.appliedPercent).toBe(5);
    expect(h.feeAmount).toBe(500000);
    expect(h.capped).toBe(true);
    expect(h.message).toContain('tidak pernah membacanya');
  });

  it('kontrak yang belum berlaku menghasilkan nol', () => {
    const h = hitungFeeKontrak({
      contract: aktif({ effectiveFrom: '2026-07-01' }),
      requestedPercent: 5,
      baseAmount: 10000000,
      onDate: '2026-06-01',
    });
    expect(h.feeAmount).toBe(0);
  });

  it('kontrak yang HABIS masa berlakunya menghentikan fee-nya SENDIRI', () => {
    /*
     * Yang mengingat akhir masa kontrak adalah pihak yang menerima uangnya, dan
     * ia tidak akan mengingatkan siapa pun.
     */
    const h = hitungFeeKontrak({
      contract: aktif({ effectiveTo: '2026-05-31' }),
      requestedPercent: 5,
      baseAmount: 10000000,
      onDate: '2026-06-01',
    });
    expect(h.feeAmount).toBe(0);
    expect(h.message).toContain('tanpa menunggu seseorang ingat');
  });

  it('hari terakhir masa berlaku masih dikenai fee', () => {
    const h = hitungFeeKontrak({
      contract: aktif({ effectiveTo: '2026-06-01' }),
      requestedPercent: 5,
      baseAmount: 10000000,
      onDate: '2026-06-01',
    });
    expect(h.feeAmount).toBe(500000);
  });

  it('kontrak yang tidak aktif menghasilkan nol', () => {
    for (const status of ['DRAFT', 'LEGAL_REVIEW', 'SUSPENDED', 'EXPIRED', 'TERMINATED']) {
      const h = hitungFeeKontrak({
        contract: aktif({ status: status as StatusKontrak }),
        requestedPercent: 5,
        baseAmount: 10000000,
        onDate: '2026-06-01',
      });
      expect(h.feeAmount).toBe(0);
    }
  });

  it('layanan yang dikecualikan tidak dikenai fee', () => {
    const h = hitungFeeKontrak({
      contract: aktif({ excludedServiceIds: ['svc-1'] }),
      requestedPercent: 5,
      baseAmount: 10000000,
      serviceId: 'svc-1',
      onDate: '2026-06-01',
    });
    expect(h.feeAmount).toBe(0);
    expect(h.message).toContain('dikecualikan');
  });

  it('layanan lain tetap dikenai fee', () => {
    const h = hitungFeeKontrak({
      contract: aktif({ excludedServiceIds: ['svc-1'] }),
      requestedPercent: 5,
      baseAmount: 10000000,
      serviceId: 'svc-2',
      onDate: '2026-06-01',
    });
    expect(h.feeAmount).toBe(500000);
  });

  it('pembulatannya ke bawah, sehingga fee tidak pernah melebihi persentasenya', () => {
    const h = hitungFeeKontrak({
      contract: aktif({ maximumPercent: 50 }),
      requestedPercent: 50,
      baseAmount: 1001,
      onDate: '2026-06-01',
    });
    expect(h.feeAmount).toBe(500);
  });

  it('nilai dasar negatif ditolak', () => {
    expect(() =>
      hitungFeeKontrak({
        contract: aktif(),
        requestedPercent: 5,
        baseAmount: -1,
        onDate: '2026-06-01',
      }),
    ).toThrow();
  });

  it('persentase negatif ditolak', () => {
    expect(() =>
      hitungFeeKontrak({
        contract: aktif(),
        requestedPercent: -1,
        baseAmount: 1000,
        onDate: '2026-06-01',
      }),
    ).toThrow();
  });
});

describe('batas akses investor', () => {
  it('medan hasil usaha boleh dilihat', () => {
    for (const f of MEDAN_BOLEH_INVESTOR) {
      expect(bolehDilihatInvestor(f).allowed).toBe(true);
    }
  });

  it('medan pasien TIDAK boleh dilihat', () => {
    for (const f of ['patientId', 'patientName', 'diagnosis', 'medicalRecordNumber', 'nik']) {
      expect(bolehDilihatInvestor(f).allowed).toBe(false);
    }
  });

  it('penolakannya menyebut apa yang membedakan keduanya', () => {
    // Bukan niat, melainkan medan mana yang dikirimkan.
    const h = bolehDilihatInvestor('diagnosis');
    expect(h.message).toContain('bukan niat');
  });

  it('daftar PUTIH, bukan daftar hitam', () => {
    /*
     * Daftar hitam melewatkan setiap medan yang ditambahkan kelak oleh orang
     * yang tidak membaca aturan ini.
     */
    expect(bolehDilihatInvestor('medanYangBelumAdaSaatIniPunDitolak').allowed).toBe(false);
  });

  it('penyaringan membuang medan yang tidak boleh', () => {
    const h = saringUntukInvestor({
      periodYear: 2026,
      grossRevenue: 1000000,
      patientName: 'Budi',
      diagnosis: 'A09.9',
    });
    expect(Object.keys(h.visible).sort()).toEqual(['grossRevenue', 'periodYear']);
    expect(h.removedCount).toBe(2);
  });

  it('dan MELAPORKAN apa yang dibuangnya, bukan membuang diam-diam', () => {
    /*
     * Penyaringan yang tidak terlihat akan dianggap tidak ada, lalu seseorang
     * akan menambahkan medan baru tanpa memeriksanya.
     */
    const h = saringUntukInvestor({ periodYear: 2026, patientName: 'Budi' });
    expect(h.removedFields).toEqual(['patientName']);
  });

  it('baris yang seluruhnya boleh tidak kehilangan apa pun', () => {
    const h = saringUntukInvestor({ periodYear: 2026, netRevenue: 5 });
    expect(h.removedCount).toBe(0);
  });

  it('baris kosong tidak menimbulkan galat', () => {
    expect(saringUntukInvestor({}).removedCount).toBe(0);
  });
});
