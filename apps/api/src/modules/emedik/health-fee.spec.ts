/**
 * Pengujian aturan pembagian jasa profesional.
 *
 * Yang dijaga paling ketat: tidak ada satu pun persentase yang tertanam di
 * dalam kode, jasa BPJS dihitung dari klaim yang DIBAYAR, dan yang tidak hadir
 * tidak dibayar.
 */

import {
  DASAR_TAKSIRAN,
  PENERIMA_BERKONTRAK,
  bagiJasa,
  bagiKepadaKontributor,
  bolehAktifkanFeeBerkontrak,
  bolehJadikanFinal,
  bolehPakaiDiProduksi,
  bolehPindahStatus,
  bolehSetujuiKebijakan,
  bolehSetujuiSettlement,
  periksaKebijakan,
  saringKontributor,
  type BarisKebijakan,
  type Kontributor,
  type StatusSettlement,
} from './health-fee';

const baris = (over: Partial<BarisKebijakan> = {}): BarisKebijakan => ({
  recipient: 'DOCTOR_FEE',
  method: 'PERCENTAGE',
  value: 40,
  ...over,
});

const hadir = (over: Partial<Kontributor> = {}): Kontributor => ({
  providerId: 'dr-1',
  contributorRole: 'SURGEON',
  attendanceEvidence: 'ot_checklist.completed_by',
  ...over,
});

describe('kebijakan pembagian jasa', () => {
  it('kebijakan yang sah diterima', () => {
    const h = periksaKebijakan({
      basis: 'PAID_CLAIM',
      lines: [baris({ value: 40 }), baris({ recipient: 'FACILITY_FEE', value: 60 })],
    });
    expect(h.valid).toBe(true);
  });

  it('jumlah persentase yang melebihi 100 DITOLAK', () => {
    // Rumah sakit akan membagikan uang yang tidak dimilikinya.
    const h = periksaKebijakan({
      basis: 'PAID_CLAIM',
      lines: [baris({ value: 60 }), baris({ recipient: 'FACILITY_FEE', value: 60 })],
    });
    expect(h.valid).toBe(false);
    expect(h.problems[0]).toContain('tidak dimilikinya');
  });

  it('jumlah persentase KURANG dari 100 tetap sah', () => {
    // Sisanya menjadi bagian fasilitas, dan banyak kesepakatan berbentuk begitu.
    expect(
      periksaKebijakan({ basis: 'PAID_CLAIM', lines: [baris({ value: 40 })] }).valid,
    ).toBe(true);
  });

  it('nilai negatif ditolak', () => {
    expect(
      periksaKebijakan({ basis: 'PAID_CLAIM', lines: [baris({ value: -1 })] }).valid,
    ).toBe(false);
  });

  it('satu baris yang melebihi 100 persen ditolak', () => {
    expect(
      periksaKebijakan({ basis: 'PAID_CLAIM', lines: [baris({ value: 101 })] }).valid,
    ).toBe(false);
  });

  it('kebijakan tanpa baris ditolak', () => {
    const h = periksaKebijakan({ basis: 'PAID_CLAIM', lines: [] });
    expect(h.valid).toBe(false);
    expect(h.problems[0]).toContain('tidak membagi apa pun');
  });

  it('penerima ganda dengan cara yang sama ditolak', () => {
    const h = periksaKebijakan({
      basis: 'PAID_CLAIM',
      lines: [baris({ value: 20 }), baris({ value: 20 })],
    });
    expect(h.valid).toBe(false);
    expect(h.problems.some((p) => p.includes('dua kali'))).toBe(true);
  });

  it('penerima yang sama untuk pemberi layanan berbeda TIDAK dianggap ganda', () => {
    const h = periksaKebijakan({
      basis: 'PAID_CLAIM',
      lines: [
        baris({ value: 20, providerId: 'dr-1' }),
        baris({ value: 20, providerId: 'dr-2' }),
      ],
    });
    expect(h.valid).toBe(true);
  });

  it('tidak ada satu pun persentase bawaan di dalam kode', () => {
    /*
     * Persentase adalah kesepakatan antara rumah sakit dan tenaga medisnya.
     * Kebijakan kosong menghasilkan pembagian kosong — bukan pembagian bawaan
     * yang tampak resmi.
     */
    const h = bagiJasa({ basisAmount: 1000000, lines: [] });
    expect(h.shares).toEqual([]);
    expect(h.distributed).toBe(0);
    expect(h.remainder).toBe(1000000);
  });
});

describe('persetujuan kebijakan', () => {
  it('kebijakan disetujui orang kedua', () => {
    expect(
      bolehSetujuiKebijakan({ createdBy: 'a', approverId: 'b', lines: [baris()] }).allowed,
    ).toBe(true);
  });

  it('pembuat kebijakan TIDAK menyetujuinya sendiri', () => {
    const h = bolehSetujuiKebijakan({ createdBy: 'a', approverId: 'a', lines: [baris()] });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('bukan kesepakatan');
  });

  it('penerima jasa TIDAK menyetujui aturan yang membayar dirinya', () => {
    /*
     * Paling sering dilanggar dan paling sulit dilihat: dokter yang juga
     * administrator dapat menaikkan persentasenya sendiri.
     */
    const h = bolehSetujuiKebijakan({
      createdBy: 'a',
      approverId: 'b',
      approverProviderId: 'dr-1',
      lines: [baris({ providerId: 'dr-1' })],
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('dua bulan berturut-turut');
  });

  it('penyetuju yang bukan penerima diterima', () => {
    expect(
      bolehSetujuiKebijakan({
        createdBy: 'a',
        approverId: 'b',
        approverProviderId: 'dr-2',
        lines: [baris({ providerId: 'dr-1' })],
      }).allowed,
    ).toBe(true);
  });
});

describe('kontributor dan bukti kehadiran', () => {
  it('kontributor dengan bukti kehadiran diterima', () => {
    expect(saringKontributor([hadir()]).eligible).toHaveLength(1);
  });

  it('kontributor TANPA bukti kehadiran disaring', () => {
    // Tanpa buktinya, daftar kontributor menjadi daftar keinginan.
    const h = saringKontributor([hadir({ attendanceEvidence: null })]);
    expect(h.eligible).toHaveLength(0);
    expect(h.rejected[0].reason).toContain('daftar keinginan');
  });

  it('yang tersaring dikembalikan, bukan dihapus diam-diam', () => {
    /*
     * Menghapus diam-diam akan menghasilkan pertanyaan "mengapa jasa saya tidak
     * ada" yang tidak dapat dijawab siapa pun.
     */
    const h = saringKontributor([hadir({ providerId: 'dr-9', attendanceEvidence: '  ' })]);
    expect(h.rejected[0].contributor.providerId).toBe('dr-9');
  });

  it('campuran hadir dan tidak dipisahkan dengan benar', () => {
    const h = saringKontributor([
      hadir({ providerId: 'a' }),
      hadir({ providerId: 'b', attendanceEvidence: null }),
      hadir({ providerId: 'c' }),
    ]);
    expect(h.eligible.map((k) => k.providerId)).toEqual(['a', 'c']);
    expect(h.rejected).toHaveLength(1);
  });
});

describe('dasar perhitungan settlement final', () => {
  it('PAID_CLAIM boleh menjadi settlement final', () => {
    expect(
      bolehJadikanFinal({ basis: 'PAID_CLAIM', payerPaysByClaim: true, isSimulation: false })
        .allowed,
    ).toBe(true);
  });

  it('GROSS_CHARGE TIDAK boleh menjadi settlement final pada penjamin klaim', () => {
    /*
     * Diajukan sepuluh juta, dibayar tujuh. Membagi dari sepuluh berarti rumah
     * sakit membayarkan uang yang tidak pernah diterimanya.
     */
    const h = bolehJadikanFinal({
      basis: 'GROSS_CHARGE',
      payerPaysByClaim: true,
      isSimulation: false,
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('tidak pernah diterimanya');
  });

  it('VERIFIED_CLAIM pun ditolak untuk settlement final', () => {
    // Diverifikasi bukan dibayar.
    expect(
      bolehJadikanFinal({ basis: 'VERIFIED_CLAIM', payerPaysByClaim: true, isSimulation: false })
        .allowed,
    ).toBe(false);
  });

  it('taksiran boleh dipakai untuk SIMULASI', () => {
    expect(
      bolehJadikanFinal({ basis: 'GROSS_CHARGE', payerPaysByClaim: true, isSimulation: true })
        .allowed,
    ).toBe(true);
  });

  it('penjamin yang tidak membayar lewat klaim boleh memakai tagihan kotor', () => {
    expect(
      bolehJadikanFinal({ basis: 'GROSS_CHARGE', payerPaysByClaim: false, isSimulation: false })
        .allowed,
    ).toBe(true);
  });

  it('daftar dasar taksiran memuat ketiganya', () => {
    expect(DASAR_TAKSIRAN).toEqual(['GROSS_CHARGE', 'NET_CHARGE', 'VERIFIED_CLAIM']);
  });
});

describe('pembagian jasa', () => {
  it('persentase dibagi sesuai kebijakan', () => {
    const h = bagiJasa({
      basisAmount: 1000000,
      lines: [baris({ value: 40 }), baris({ recipient: 'FACILITY_FEE', value: 60 })],
    });
    expect(h.shares.map((s) => s.amount)).toEqual([400000, 600000]);
    expect(h.remainder).toBe(0);
  });

  it('sisa pembulatan diberikan kepada baris persentase TERAKHIR', () => {
    /*
     * Membuangnya berarti jumlah bagian tidak pernah sama dengan nilai yang
     * dibagi, dan selisih beberapa rupiah dikalikan ribuan tindakan menjadi
     * selisih yang harus dijelaskan seseorang pada akhir tahun.
     */
    const h = bagiJasa({
      basisAmount: 1000,
      lines: [
        baris({ value: 33 }),
        baris({ recipient: 'NURSE_FEE', value: 33 }),
        baris({ recipient: 'FACILITY_FEE', value: 34 }),
      ],
    });
    expect(h.shares.reduce((n, s) => n + s.amount, 0)).toBe(1000);
    expect(h.remainder).toBe(0);
  });

  it('kebijakan yang tidak membagi habis MENINGGALKAN sisa, bukan mengarangnya', () => {
    const h = bagiJasa({ basisAmount: 1000000, lines: [baris({ value: 40 })] });
    expect(h.remainder).toBe(600000);
    expect(h.message).toContain('bagian fasilitas');
  });

  it('nominal tetap tidak melebihi nilai dasarnya', () => {
    const h = bagiJasa({
      basisAmount: 100000,
      lines: [baris({ method: 'FIXED_AMOUNT', value: 500000 })],
    });
    expect(h.shares[0].amount).toBe(100000);
  });

  it('cara berbasis poin tanpa kontributor menghasilkan NOL, bukan taksiran', () => {
    // Taksiran itu akan tampak masuk akal dan salah.
    const h = bagiJasa({
      basisAmount: 1000000,
      lines: [baris({ method: 'POINT_BASED', value: 40 })],
      contributors: [],
    });
    expect(h.shares[0].amount).toBe(0);
  });

  it('nilai dasar negatif ditolak', () => {
    expect(() => bagiJasa({ basisAmount: -1, lines: [baris()] })).toThrow();
  });

  it('nilai dasar nol tidak menghasilkan bagian negatif', () => {
    const h = bagiJasa({ basisAmount: 0, lines: [baris({ value: 40 })] });
    expect(h.shares[0].amount).toBe(0);
  });
});

describe('pembagian kepada kontributor', () => {
  it('dibagi menurut bobot poin', () => {
    const h = bagiKepadaKontributor({
      poolAmount: 1000000,
      method: 'POINT_BASED',
      contributors: [
        hadir({ providerId: 'a', point: 3 }),
        hadir({ providerId: 'b', point: 1 }),
      ],
    });
    expect(h.shares.find((s) => s.providerId === 'a')?.amount).toBe(750000);
    expect(h.shares.find((s) => s.providerId === 'b')?.amount).toBe(250000);
  });

  it('sisa pembulatan diberikan kepada bobot TERBESAR, bukan yang pertama', () => {
    // Urutan daftar tidak berarti apa-apa; bobot berarti sesuatu.
    const h = bagiKepadaKontributor({
      poolAmount: 100,
      method: 'POINT_BASED',
      contributors: [
        hadir({ providerId: 'kecil', point: 1 }),
        hadir({ providerId: 'besar', point: 2 }),
      ],
    });
    expect(h.shares.reduce((n, s) => n + s.amount, 0)).toBe(100);
    expect(h.shares.find((s) => s.providerId === 'besar')?.amount).toBe(67);
  });

  it('dibagi menurut waktu bila caranya berbasis waktu', () => {
    const h = bagiKepadaKontributor({
      poolAmount: 900000,
      method: 'TIME_BASED',
      contributors: [
        hadir({ providerId: 'a', durationMinutes: 120 }),
        hadir({ providerId: 'b', durationMinutes: 60 }),
      ],
    });
    expect(h.shares.find((s) => s.providerId === 'a')?.amount).toBe(600000);
  });

  it('berbasis satuan membagi rata', () => {
    const h = bagiKepadaKontributor({
      poolAmount: 900000,
      method: 'UNIT_BASED',
      contributors: [hadir({ providerId: 'a' }), hadir({ providerId: 'b' })],
    });
    expect(h.shares[0].amount).toBe(450000);
  });

  it('tanpa kontributor berbobot, kumpulan TIDAK dibagi rata', () => {
    const h = bagiKepadaKontributor({
      poolAmount: 900000,
      method: 'POINT_BASED',
      contributors: [hadir({ providerId: 'a', point: 0 })],
    });
    expect(h.shares).toEqual([]);
    expect(h.message).toContain('tampak masuk akal dan salah');
  });

  it('nilai kumpulan negatif ditolak', () => {
    expect(() =>
      bagiKepadaKontributor({ poolAmount: -1, method: 'POINT_BASED', contributors: [] }),
    ).toThrow();
  });
});

describe('fee sistem dan investor', () => {
  it('keduanya menuntut kontrak', () => {
    expect(PENERIMA_BERKONTRAK).toEqual(['SYSTEM_PLATFORM_FEE', 'INVESTOR_SHARE']);
  });

  it('penerima biasa tidak menuntut kontrak', () => {
    expect(
      bolehAktifkanFeeBerkontrak({
        recipient: 'DOCTOR_FEE',
        syarat: {
          hasContract: false,
          hasLegalReview: false,
          hasManagementApproval: false,
          hasTaxTreatment: false,
        },
      }).allowed,
    ).toBe(true);
  });

  it('fee sistem tanpa syarat apa pun DITOLAK, dan yang kurang disebut satu per satu', () => {
    const h = bolehAktifkanFeeBerkontrak({
      recipient: 'SYSTEM_PLATFORM_FEE',
      syarat: {
        hasContract: false,
        hasLegalReview: false,
        hasManagementApproval: false,
        hasTaxTreatment: false,
      },
    });
    expect(h.allowed).toBe(false);
    expect(h.missing).toHaveLength(6);
  });

  it('kurang satu syarat pun tetap ditolak', () => {
    const h = bolehAktifkanFeeBerkontrak({
      recipient: 'INVESTOR_SHARE',
      syarat: {
        hasContract: true,
        hasLegalReview: true,
        hasManagementApproval: true,
        hasTaxTreatment: true,
        effectiveFrom: '2026-01-01',
        maximumPercent: null,
      },
    });
    expect(h.allowed).toBe(false);
    expect(h.missing).toEqual(['batas maksimum']);
  });

  it('penolakannya menyebut bahwa fee itu mengambil dari kumpulan jasa tenaga medis', () => {
    const h = bolehAktifkanFeeBerkontrak({
      recipient: 'SYSTEM_PLATFORM_FEE',
      syarat: {
        hasContract: false,
        hasLegalReview: true,
        hasManagementApproval: true,
        hasTaxTreatment: true,
        effectiveFrom: '2026-01-01',
        maximumPercent: 5,
      },
    });
    expect(h.message).toContain('jasa tenaga medis');
  });

  it('seluruh syarat lengkap diterima', () => {
    expect(
      bolehAktifkanFeeBerkontrak({
        recipient: 'SYSTEM_PLATFORM_FEE',
        syarat: {
          hasContract: true,
          hasLegalReview: true,
          hasManagementApproval: true,
          hasTaxTreatment: true,
          effectiveFrom: '2026-01-01',
          maximumPercent: 5,
        },
      }).allowed,
    ).toBe(true);
  });

  it('batas maksimum nol dianggap ada, bukan kosong', () => {
    expect(
      bolehAktifkanFeeBerkontrak({
        recipient: 'INVESTOR_SHARE',
        syarat: {
          hasContract: true,
          hasLegalReview: true,
          hasManagementApproval: true,
          hasTaxTreatment: true,
          effectiveFrom: '2026-01-01',
          maximumPercent: 0,
        },
      }).allowed,
    ).toBe(true);
  });
});

describe('templat contoh', () => {
  it('templat contoh yang belum disetujui TIDAK dapat dipakai di produksi', () => {
    const h = bolehPakaiDiProduksi({ isSampleData: true, productionApproved: false });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('bukan saran hukum');
  });

  it('dan pesannya menyatakan persentase produksi ditentukan fasilitas sendiri', () => {
    const h = bolehPakaiDiProduksi({ isSampleData: true, productionApproved: false });
    expect(h.message).toContain('bersama');
  });

  it('templat contoh yang sudah disetujui boleh dipakai', () => {
    expect(bolehPakaiDiProduksi({ isSampleData: true, productionApproved: true }).allowed).toBe(
      true,
    );
  });

  it('kebijakan yang bukan contoh boleh dipakai', () => {
    expect(bolehPakaiDiProduksi({ isSampleData: false, productionApproved: false }).allowed).toBe(
      true,
    );
  });
});

describe('status settlement', () => {
  it('dihitung lalu disimulasikan', () => {
    expect(bolehPindahStatus({ from: 'CALCULATED', to: 'SIMULATED' }).allowed).toBe(true);
  });

  it('disetujui lalu dikunci lalu dibayarkan lalu dinyatakan', () => {
    for (const [a, b] of [
      ['APPROVED', 'LOCKED'],
      ['LOCKED', 'PAID'],
      ['PAID', 'STATED'],
    ] as Array<[StatusSettlement, StatusSettlement]>) {
      expect(bolehPindahStatus({ from: a, to: b }).allowed).toBe(true);
    }
  });

  it('yang sudah DIKUNCI tidak dapat kembali', () => {
    /*
     * Menghapusnya akan membuat pernyataan yang sudah diterima dokter tidak
     * lagi cocok dengan catatan rumah sakit — dan yang dipegang dokter adalah
     * kertas yang sudah dicetak.
     */
    const h = bolehPindahStatus({ from: 'LOCKED', to: 'CALCULATED' });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('penyesuaian atau pembalikan');
  });

  it('yang sudah dibayarkan tidak dapat dibatalkan', () => {
    expect(bolehPindahStatus({ from: 'PAID', to: 'APPROVED' }).allowed).toBe(false);
  });

  it('yang sudah dinyatakan adalah ujungnya', () => {
    expect(bolehPindahStatus({ from: 'STATED', to: 'PAID' }).allowed).toBe(false);
  });

  it('melompati pengunciannya ditolak', () => {
    expect(bolehPindahStatus({ from: 'APPROVED', to: 'PAID' }).allowed).toBe(false);
  });

  it('status yang tidak dikenal ditolak', () => {
    expect(
      bolehPindahStatus({ from: 'TIDAK_ADA' as StatusSettlement, to: 'PAID' }).allowed,
    ).toBe(false);
  });
});

describe('persetujuan settlement', () => {
  it('disetujui orang kedua', () => {
    expect(bolehSetujuiSettlement({ calculatedBy: 'a', approverId: 'b' }).allowed).toBe(true);
  });

  it('yang menghitung TIDAK menyetujuinya sendiri', () => {
    const h = bolehSetujuiSettlement({ calculatedBy: 'a', approverId: 'a' });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('bukan pemeriksaan');
  });
});
