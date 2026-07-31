/**
 * Pengujian aturan unit usaha dan batas kewenangan adapter POS.
 *
 * Dua hal dijaga paling ketat:
 *
 * 1. **Koperasi tidak menulis ke tabel POS dan tidak menerbitkan peristiwa
 *    POS.** Penjualan di unit toko sudah dijurnal mesin POS; menjurnalnya ulang
 *    akan mencatat pendapatan dua kali dan membelah persediaan.
 * 2. **Satu outlet hanya dimiliki satu unit usaha.** Dua pemilik akan
 *    menghitung patronage penjualan yang sama dua kali — dan SHU dibagikan atas
 *    angka itu.
 */

import {
  PERISTIWA_POS_TERLARANG,
  STATUS_DIHITUNG,
  TABEL_POS_TERLARANG,
  UNIT_BERKASIR,
  UNIT_BUSINESS_TYPES,
  alokasikanOverhead,
  bolehMenerbitkanPeristiwa,
  bolehTautkanKelompokPelanggan,
  bolehTautkanOutlet,
  hitungLabaUnit,
  perluTautanPos,
  rasioTerAtribusi,
  ringkasPatronage,
  type PenjualanUnit,
} from './cooperative-unit';

const jual = (
  id: string,
  total: number,
  customerId: string | null = null,
  status = 'COMPLETED',
): PenjualanUnit => ({
  saleId: id,
  outletId: 'O1',
  customerId,
  businessDate: '2026-06-15',
  grandTotal: String(total),
  status,
});

describe('jenis unit usaha', () => {
  it('hanya toko dan kantin yang menjual lewat kasir', () => {
    expect(UNIT_BERKASIR.sort()).toEqual(['CANTEEN', 'RETAIL_STORE']);
    for (const t of UNIT_BUSINESS_TYPES) {
      expect(perluTautanPos(t)).toBe(UNIT_BERKASIR.includes(t));
    }
  });

  it('unit simpan pinjam tidak memerlukan tautan POS', () => {
    expect(perluTautanPos('SAVINGS_LOAN')).toBe(false);
  });
});

describe('tautan outlet', () => {
  it('mengizinkan toko menautkan outlet yang belum dimiliki', () => {
    expect(
      bolehTautkanOutlet({
        unitType: 'RETAIL_STORE',
        outletAlreadyLinkedToUnitId: null,
        thisUnitId: 'U1',
      }).allowed,
    ).toBe(true);
  });

  it('MENOLAK outlet yang sudah dimiliki unit lain', () => {
    /*
     * Dua unit yang mengaku memiliki outlet yang sama akan menghitung patronage
     * penjualan yang sama dua kali — dan SHU dibagikan atas angka itu.
     */
    const v = bolehTautkanOutlet({
      unitType: 'RETAIL_STORE',
      outletAlreadyLinkedToUnitId: 'U2',
      thisUnitId: 'U1',
    });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('dua kali');
  });

  it('mengizinkan unit yang sama memperbarui tautannya', () => {
    expect(
      bolehTautkanOutlet({
        unitType: 'CANTEEN',
        outletAlreadyLinkedToUnitId: 'U1',
        thisUnitId: 'U1',
      }).allowed,
    ).toBe(true);
  });

  it('menolak tautan outlet bagi unit yang tidak berkasir', () => {
    const v = bolehTautkanOutlet({
      unitType: 'SAVINGS_LOAN',
      outletAlreadyLinkedToUnitId: null,
      thisUnitId: 'U1',
    });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('tidak menjual lewat kasir');
  });
});

describe('ringkasan patronage', () => {
  const peta = {
    customerToMember: new Map([
      ['C1', 'M1'],
      ['C2', 'M2'],
    ]),
  };

  it('menjumlahkan penjualan per anggota', () => {
    const r = ringkasPatronage(
      [jual('S1', 100_000, 'C1'), jual('S2', 250_000, 'C1'), jual('S3', 75_000, 'C2')],
      peta,
    );
    expect(r.perMember.get('M1')).toBe(350_000);
    expect(r.perMember.get('M2')).toBe(75_000);
  });

  it('MELAPORKAN penjualan yang tidak dapat ditautkan, bukan membuangnya', () => {
    /*
     * Unit toko yang sebagian besar penjualannya tidak teratribusi berarti
     * kartu anggotanya jarang dipakai — keadaan yang perlu diketahui pengurus
     * SEBELUM SHU dihitung, bukan sesudahnya.
     */
    const r = ringkasPatronage(
      [jual('S1', 100_000, 'C1'), jual('S2', 400_000, null), jual('S3', 200_000, 'C9')],
      peta,
    );
    expect(r.unattributedAmount).toBe(600_000);
    expect(r.unattributedCount).toBe(2);
    expect(r.totalSalesAmount).toBe(700_000);
  });

  it('menghitung bagian penjualan yang teratribusi', () => {
    const r = ringkasPatronage([jual('S1', 300_000, 'C1'), jual('S2', 700_000, null)], peta);
    expect(rasioTerAtribusi(r)).toBeCloseTo(0.3);
  });

  it('hanya penjualan selesai yang dihitung', () => {
    const r = ringkasPatronage(
      [
        jual('S1', 100_000, 'C1', 'COMPLETED'),
        jual('S2', 999_999, 'C1', 'DRAFT'),
        jual('S3', 888_888, 'C1', 'VOIDED'),
        jual('S4', 777_777, 'C1', 'CANCELLED'),
      ],
      peta,
    );
    expect(r.perMember.get('M1')).toBe(100_000);
    expect(r.countedSaleIds).toEqual(['S1']);
  });

  it('penjualan yang diretur sebagian tetap dihitung', () => {
    // Nilainya sudah berkurang pada sisi POS; pengurangannya ditangani
    // tersendiri, bukan dengan membuang penjualannya.
    expect(STATUS_DIHITUNG).toContain('RETURNED_PARTIAL');
  });

  it('mengabaikan nilai nol dan negatif', () => {
    const r = ringkasPatronage(
      [jual('S1', 0, 'C1'), jual('S2', -5_000, 'C1'), jual('S3', 50_000, 'C1')],
      peta,
    );
    expect(r.perMember.get('M1')).toBe(50_000);
    expect(r.countedSaleIds).toHaveLength(1);
  });

  it('tanpa penjualan menghasilkan ringkasan kosong, bukan galat', () => {
    const r = ringkasPatronage([], peta);
    expect(r.totalSalesAmount).toBe(0);
    expect(rasioTerAtribusi(r)).toBe(0);
  });
});

describe('laba rugi unit usaha', () => {
  it('menghitung laba kotor, usaha, dan bersih', () => {
    const l = hitungLabaUnit({
      unitBusinessId: 'U1',
      revenue: 100_000_000,
      cogs: 70_000_000,
      operatingExpense: 15_000_000,
      allocatedOverhead: 5_000_000,
    });
    expect(l.grossProfit).toBe(30_000_000);
    expect(l.operatingProfit).toBe(15_000_000);
    expect(l.netProfit).toBe(10_000_000);
    expect(l.grossMarginRatio).toBeCloseTo(0.3);
  });

  it('beban umum menurunkan laba bersih', () => {
    /*
     * Tanpa alokasi beban umum, unit tampak jauh lebih untung daripada
     * sebenarnya — dan pengurus mengambil keputusan membuka unit baru
     * berdasarkan angka yang belum menanggung bagiannya atas gaji, listrik, dan
     * sewa kantor koperasi.
     */
    const dasar = { unitBusinessId: 'U1', revenue: 100_000_000, cogs: 70_000_000, operatingExpense: 15_000_000 };
    const tanpa = hitungLabaUnit({ ...dasar, allocatedOverhead: 0 });
    const dengan = hitungLabaUnit({ ...dasar, allocatedOverhead: 20_000_000 });
    expect(tanpa.netProfit).toBe(15_000_000);
    expect(dengan.netProfit).toBe(-5_000_000);
  });

  it('pendapatan nol tidak menghasilkan pembagian nol', () => {
    const l = hitungLabaUnit({
      unitBusinessId: 'U1', revenue: 0, cogs: 0, operatingExpense: 1_000, allocatedOverhead: 0,
    });
    expect(l.grossMarginRatio).toBe(0);
    expect(l.netProfit).toBe(-1_000);
  });
});

describe('alokasi beban umum', () => {
  it('sebanding dengan dasarnya', () => {
    const h = alokasikanOverhead(1_000_000, [
      { unitBusinessId: 'A', basis: 600 },
      { unitBusinessId: 'B', basis: 400 },
    ]);
    expect(h.get('A')).toBe(600_000);
    expect(h.get('B')).toBe(400_000);
  });

  it('jumlah alokasi persis sama dengan bebannya', () => {
    /*
     * Kurang beberapa rupiah berarti ada beban yang menggantung tanpa pemilik,
     * dan laporan laba rugi gabungan tidak akan cocok dengan jumlah unitnya.
     */
    for (const beban of [1, 7, 999, 1_000_000, 33_333_333]) {
      const h = alokasikanOverhead(beban, [
        { unitBusinessId: 'A', basis: 1 },
        { unitBusinessId: 'B', basis: 1 },
        { unitBusinessId: 'C', basis: 1 },
      ]);
      expect([...h.values()].reduce((n, v) => n + v, 0)).toBe(beban);
    }
  });

  it('deterministik saat pecahannya seri', () => {
    const dasar = [
      { unitBusinessId: 'C', basis: 1 },
      { unitBusinessId: 'A', basis: 1 },
      { unitBusinessId: 'B', basis: 1 },
    ];
    const pertama = alokasikanOverhead(100, dasar);
    const kedua = alokasikanOverhead(100, [...dasar].reverse());
    for (const id of ['A', 'B', 'C']) expect(pertama.get(id)).toBe(kedua.get(id));
  });

  it('dasar nol menghasilkan alokasi nol', () => {
    const h = alokasikanOverhead(1_000_000, [
      { unitBusinessId: 'A', basis: 0 },
      { unitBusinessId: 'B', basis: 0 },
    ]);
    expect(h.get('A')).toBe(0);
    expect(h.get('B')).toBe(0);
  });
});

describe('harga khusus anggota lewat kelompok pelanggan', () => {
  it('mengizinkan kelompok yang belum ditautkan', () => {
    expect(
      bolehTautkanKelompokPelanggan({
        customerGroupId: 'G1',
        groupAlreadyLinkedToCategoryId: null,
        thisCategoryId: 'K1',
      }).allowed,
    ).toBe(true);
  });

  it('menolak kelompok yang sudah mewakili kategori lain', () => {
    const v = bolehTautkanKelompokPelanggan({
      customerGroupId: 'G1',
      groupAlreadyLinkedToCategoryId: 'K2',
      thisCategoryId: 'K1',
    });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('harga yang berlaku');
  });
});

describe('batas kewenangan adapter POS', () => {
  it('daftar tabel POS terlarang mencakup penjualan, pembayaran, dan stok', () => {
    for (const t of ['pos_sale', 'pos_payment', 'stock_balance', 'stock_movement']) {
      expect(TABEL_POS_TERLARANG).toContain(t);
    }
  });

  it('MENOLAK penerbitan peristiwa POS oleh koperasi', () => {
    /*
     * Penjualan di unit toko sudah dijurnal mesin POS lewat POS_SALE.
     * Menjurnalnya ulang dari koperasi akan mencatat pendapatan dua kali.
     */
    for (const e of PERISTIWA_POS_TERLARANG) {
      const v = bolehMenerbitkanPeristiwa(e);
      expect(v.allowed).toBe(false);
      expect(v.message).toContain('dua kali');
    }
  });

  it('menolak peristiwa yang tidak berawalan COOPERATIVE_', () => {
    const v = bolehMenerbitkanPeristiwa('MARKETPLACE_SALE_RECOGNIZED');
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('COOPERATIVE_');
  });

  it('mengizinkan peristiwa koperasi', () => {
    for (const e of [
      'COOPERATIVE_PRINCIPAL_SAVING_RECEIVED',
      'COOPERATIVE_LOAN_DISBURSED',
      'COOPERATIVE_SHU_PAID',
      'COOPERATIVE_WALLET_PAYMENT',
    ]) {
      expect(bolehMenerbitkanPeristiwa(e).allowed).toBe(true);
    }
  });

  it('daftar peristiwa terlarang tidak berawalan COOPERATIVE_', () => {
    // Bila kelak ada peristiwa koperasi yang tidak sengaja masuk daftar
    // terlarang, ia akan tertolak selamanya tanpa sebab yang jelas.
    for (const e of PERISTIWA_POS_TERLARANG) {
      expect(e.startsWith('COOPERATIVE_')).toBe(false);
    }
  });
});
