/**
 * Pengujian aturan SHU.
 *
 * Satu sifat diuji paling keras, dan ia menjadi alasan seluruh berkas ini
 * berbentuk demikian:
 *
 *   **Perhitungan SHU harus dapat diulang.**
 *
 * Angka yang berubah saat dihitung ulang berarti tidak ada yang tahu mana yang
 * benar. Anggota yang menerima jumlah berbeda dari yang tercantum pada notulen
 * RAT punya alasan yang sah untuk tidak mempercayai seluruh pembukuan
 * koperasinya.
 */

import {
  KOMPONEN_ANGGOTA,
  PRESISI_FRAKSI,
  SHU_COMPONENTS,
  alokasikanSurplus,
  bagiKomponen,
  bagianMasaKeanggotaan,
  bagikanKeAnggota,
  bolehDibagikan,
  hitungShu,
  periksaKebijakan,
  periksaKeutuhan,
  sidikJari,
  type CuplikanPerhitungan,
  type DasarAnggota,
  type KomponenKebijakan,
} from './cooperative-shu';

const kebijakanBaku: KomponenKebijakan[] = [
  { component: 'RESERVE', ratio: 0.25 },
  { component: 'CAPITAL_SERVICE', ratio: 0.25 },
  { component: 'PATRONAGE_SERVICE', ratio: 0.3 },
  { component: 'EDUCATION_FUND', ratio: 0.1 },
  { component: 'SOCIAL_FUND', ratio: 0.05 },
  { component: 'BOARD_INCENTIVE', ratio: 0.05 },
];

const anggota = (
  id: string,
  simpanan: number,
  transaksi: number,
  over: Partial<DasarAnggota> = {},
): DasarAnggota => ({
  memberId: id,
  averageEquitySaving: simpanan,
  patronageAmount: transaksi,
  membershipFraction: 1,
  receivesShu: true,
  ...over,
});

const cuplikan = (over: Partial<CuplikanPerhitungan> = {}): CuplikanPerhitungan => ({
  fiscalYear: 2026,
  periodStart: '2026-01-01',
  periodEnd: '2026-12-31',
  surplus: 100_000_000,
  policyCode: 'SHU_POLICY',
  policyVersion: 1,
  components: kebijakanBaku,
  members: [
    anggota('M001', 5_000_000, 12_000_000),
    anggota('M002', 3_000_000, 8_000_000),
    anggota('M003', 2_000_000, 20_000_000),
  ],
  ...over,
});

describe('kebijakan SHU', () => {
  it('meloloskan kebijakan yang berjumlah tepat 100%', () => {
    expect(periksaKebijakan(kebijakanBaku).allowed).toBe(true);
  });

  it('MENOLAK kebijakan yang berjumlah kurang dari 100%', () => {
    /*
     * Kurang berarti ada surplus yang tidak diketahui ke mana perginya. Baru
     * ketahuan saat pembayaran gagal — dan saat itu angka SHU sudah diumumkan
     * kepada seluruh anggota.
     */
    const v = periksaKebijakan([
      { component: 'RESERVE', ratio: 0.25 },
      { component: 'CAPITAL_SERVICE', ratio: 0.25 },
    ]);
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('50.00%');
  });

  it('MENOLAK kebijakan yang berjumlah lebih dari 100%', () => {
    // Lebih berarti membagikan uang yang tidak ada.
    const v = periksaKebijakan([
      { component: 'RESERVE', ratio: 0.6 },
      { component: 'CAPITAL_SERVICE', ratio: 0.6 },
    ]);
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('120.00%');
  });

  it('menerima kebijakan yang jumlahnya 100% meski berpecahan biner', () => {
    /*
     * 0.1 + 0.2 tidak menghasilkan tepat 0.3 pada aritmetika pecahan biner.
     * Perbandingan dalam basis per sepuluh ribu mencegah kebijakan yang benar
     * ditolak karena selisih 0,0000000000000002.
     */
    expect(
      periksaKebijakan([
        { component: 'RESERVE', ratio: 0.1 },
        { component: 'CAPITAL_SERVICE', ratio: 0.2 },
        { component: 'PATRONAGE_SERVICE', ratio: 0.3 },
        { component: 'EDUCATION_FUND', ratio: 0.4 },
      ]).allowed,
    ).toBe(true);
  });

  it('menolak komponen yang tercantum dua kali', () => {
    const v = periksaKebijakan([
      { component: 'RESERVE', ratio: 0.5 },
      { component: 'RESERVE', ratio: 0.5 },
    ]);
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('lebih dari sekali');
  });

  it('menolak bagian yang di luar rentang', () => {
    expect(
      periksaKebijakan([
        { component: 'RESERVE', ratio: -0.5 },
        { component: 'CAPITAL_SERVICE', ratio: 1.5 },
      ]).allowed,
    ).toBe(false);
  });

  it('menolak kebijakan kosong', () => {
    expect(periksaKebijakan([]).allowed).toBe(false);
  });

  it('hanya dua komponen yang dibagikan perorangan', () => {
    expect(KOMPONEN_ANGGOTA.sort()).toEqual(['CAPITAL_SERVICE', 'PATRONAGE_SERVICE']);
    for (const k of KOMPONEN_ANGGOTA) expect(SHU_COMPONENTS).toContain(k);
  });
});

describe('alokasi surplus ke komponen', () => {
  it('jumlah alokasi persis sama dengan surplusnya', () => {
    const a = alokasikanSurplus(100_000_000, kebijakanBaku);
    expect(a.reduce((n, x) => n + x.amount, 0)).toBe(100_000_000);
  });

  it('setiap alokasi berupa bilangan bulat rupiah', () => {
    for (const x of alokasikanSurplus(99_999_999, kebijakanBaku)) {
      expect(Number.isInteger(x.amount)).toBe(true);
    }
  });

  it('selisih pembulatan dibebankan pada CADANGAN', () => {
    /*
     * Cadangan milik koperasi, bukan milik anggota perorangan, jadi selisih
     * beberapa rupiah di sana tidak mengubah hak siapa pun. Membebankannya pada
     * jasa usaha akan mengubah bagian seorang anggota tanpa sebab yang dapat
     * dijelaskan kepadanya.
     */
    const a = alokasikanSurplus(1_000_003, kebijakanBaku);
    const cadangan = a.find((x) => x.component === 'RESERVE')!;
    const tepat = Math.floor(1_000_003 * 0.25);
    expect(cadangan.amount).toBeGreaterThan(tepat);
    expect(a.reduce((n, x) => n + x.amount, 0)).toBe(1_000_003);
  });

  it('jumlah selalu tepat pada berbagai nilai surplus', () => {
    for (const s of [1, 7, 999, 1_000_000, 33_333_333, 99_999_999, 123_456_789]) {
      expect(alokasikanSurplus(s, kebijakanBaku).reduce((n, x) => n + x.amount, 0)).toBe(s);
    }
  });

  it('surplus nol menghasilkan seluruh komponen nol', () => {
    for (const x of alokasikanSurplus(0, kebijakanBaku)) expect(x.amount).toBe(0);
  });
});

describe('pembagian satu komponen kepada anggota', () => {
  it('sebanding dengan dasarnya', () => {
    const h = bagiKomponen(1_000_000, [
      { memberId: 'A', basis: 500 },
      { memberId: 'B', basis: 300 },
      { memberId: 'C', basis: 200 },
    ]);
    expect(h.get('A')).toBe(500_000);
    expect(h.get('B')).toBe(300_000);
    expect(h.get('C')).toBe(200_000);
  });

  it('jumlah bagian persis sama dengan totalnya, apa pun pembulatannya', () => {
    // Kasus yang membuat pembagian rata mustahil tanpa sisa.
    const h = bagiKomponen(100, [
      { memberId: 'A', basis: 1 },
      { memberId: 'B', basis: 1 },
      { memberId: 'C', basis: 1 },
    ]);
    expect([...h.values()].reduce((n, v) => n + v, 0)).toBe(100);
  });

  it('sisa dibagikan kepada yang pecahannya terbesar', () => {
    const h = bagiKomponen(10, [
      { memberId: 'A', basis: 7 },
      { memberId: 'B', basis: 2 },
      { memberId: 'C', basis: 1 },
    ]);
    expect([...h.values()].reduce((n, v) => n + v, 0)).toBe(10);
    expect(h.get('A')).toBe(7);
  });

  it('pembagian sisa DETERMINISTIK saat pecahannya seri', () => {
    /*
     * Tanpa pemutus seri yang pasti, dua pemanggilan atas data yang sama dapat
     * menghasilkan pembagian sisa yang berbeda — dan perhitungan SHU tidak lagi
     * dapat diulang.
     */
    const dasar = [
      { memberId: 'C', basis: 1 },
      { memberId: 'A', basis: 1 },
      { memberId: 'B', basis: 1 },
    ];
    const pertama = bagiKomponen(100, dasar);
    // Urutan masukan diubah; hasilnya harus tetap sama.
    const kedua = bagiKomponen(100, [...dasar].reverse());
    for (const id of ['A', 'B', 'C']) {
      expect(pertama.get(id)).toBe(kedua.get(id));
    }
  });

  it('dasar nol menghasilkan bagian nol bagi seluruhnya', () => {
    const h = bagiKomponen(1_000_000, [
      { memberId: 'A', basis: 0 },
      { memberId: 'B', basis: 0 },
    ]);
    expect(h.get('A')).toBe(0);
    expect(h.get('B')).toBe(0);
  });

  it('dasar negatif diperlakukan sebagai nol', () => {
    const h = bagiKomponen(1_000, [
      { memberId: 'A', basis: -100 },
      { memberId: 'B', basis: 100 },
    ]);
    expect(h.get('A')).toBe(0);
    expect(h.get('B')).toBe(1_000);
  });
});

describe('pembagian kepada anggota', () => {
  it('jasa modal memakai simpanan, jasa usaha memakai transaksi', () => {
    const h = bagikanKeAnggota({
      capitalServiceTotal: 1_000_000,
      patronageServiceTotal: 1_000_000,
      members: [anggota('A', 800, 200), anggota('B', 200, 800)],
    });
    const a = h.perMember.find((m) => m.memberId === 'A')!;
    const b = h.perMember.find((m) => m.memberId === 'B')!;
    // A bersimpanan besar, B bertransaksi besar — keduanya memperoleh dari
    // komponen yang berbeda.
    expect(a.capitalService).toBeGreaterThan(b.capitalService);
    expect(b.patronageService).toBeGreaterThan(a.patronageService);
  });

  it('anggota tanpa hak SHU tidak memperoleh bagian', () => {
    const h = bagikanKeAnggota({
      capitalServiceTotal: 1_000_000,
      patronageServiceTotal: 0,
      members: [anggota('A', 100, 0), anggota('B', 100, 0, { receivesShu: false })],
    });
    expect(h.perMember).toHaveLength(1);
    expect(h.excludedCount).toBe(1);
    expect(h.perMember[0].capitalService).toBe(1_000_000);
  });

  it('anggota yang masuk di tengah periode memperoleh bagian sebanding', () => {
    /*
     * Memberinya bagian penuh berarti mengambil dari anggota yang menjalani
     * setahun penuh dengan simpanan yang sama.
     */
    const h = bagikanKeAnggota({
      capitalServiceTotal: 1_000_000,
      patronageServiceTotal: 0,
      members: [
        anggota('A', 1_000, 0, { membershipFraction: 1 }),
        anggota('B', 1_000, 0, { membershipFraction: 0.5 }),
      ],
    });
    const a = h.perMember.find((m) => m.memberId === 'A')!;
    const b = h.perMember.find((m) => m.memberId === 'B')!;
    expect(a.capitalService).toBeGreaterThan(b.capitalService);
    expect(a.capitalService + b.capitalService).toBe(1_000_000);
  });

  it('seluruh bagian berjumlah sama dengan alokasinya', () => {
    const h = bagikanKeAnggota({
      capitalServiceTotal: 3_333_333,
      patronageServiceTotal: 7_777_777,
      members: Array.from({ length: 37 }, (_, i) =>
        anggota(`M${String(i).padStart(3, '0')}`, 1_000 + i * 37, 5_000 + i * 91),
      ),
    });
    expect(h.totalCapitalService).toBe(3_333_333);
    expect(h.totalPatronageService).toBe(7_777_777);
    expect(h.totalDistributed).toBe(3_333_333 + 7_777_777);
  });

  it('hasil diurutkan menurut memberId supaya keluarannya pasti', () => {
    const h = bagikanKeAnggota({
      capitalServiceTotal: 100,
      patronageServiceTotal: 0,
      members: [anggota('C', 1, 0), anggota('A', 1, 0), anggota('B', 1, 0)],
    });
    expect(h.perMember.map((m) => m.memberId)).toEqual(['A', 'B', 'C']);
  });
});

describe('perhitungan SHU dapat diulang', () => {
  it('masukan yang sama menghasilkan keluaran yang PERSIS sama', () => {
    const c = cuplikan();
    const pertama = hitungShu(c);
    const kedua = hitungShu(c);
    expect(JSON.stringify(kedua)).toBe(JSON.stringify(pertama));
  });

  it('urutan anggota pada masukan tidak memengaruhi hasilnya', () => {
    /*
     * Urutan baris yang dikembalikan basis data dapat berbeda antar
     * pemanggilan. Bila urutannya memengaruhi hasil, perhitungan ulang akan
     * menghasilkan angka berbeda tanpa ada yang mengubah apa pun.
     */
    const c = cuplikan();
    const terbalik = cuplikan({ members: [...c.members].reverse() });
    expect(JSON.stringify(hitungShu(terbalik).distribution)).toBe(
      JSON.stringify(hitungShu(c).distribution),
    );
  });

  it('urutan komponen pada kebijakan tidak memengaruhi sidik jarinya', () => {
    const c = cuplikan();
    const acak = cuplikan({ components: [...kebijakanBaku].reverse() });
    expect(sidikJari(acak)).toBe(sidikJari(c));
  });

  it('sidik jari BERUBAH bila surplusnya berubah', () => {
    expect(sidikJari(cuplikan({ surplus: 100_000_001 }))).not.toBe(sidikJari(cuplikan()));
  });

  it('sidik jari BERUBAH bila kebijakannya berubah', () => {
    const lain = cuplikan({
      components: [
        { component: 'RESERVE', ratio: 0.3 },
        { component: 'CAPITAL_SERVICE', ratio: 0.2 },
        { component: 'PATRONAGE_SERVICE', ratio: 0.3 },
        { component: 'EDUCATION_FUND', ratio: 0.1 },
        { component: 'SOCIAL_FUND', ratio: 0.05 },
        { component: 'BOARD_INCENTIVE', ratio: 0.05 },
      ],
    });
    expect(sidikJari(lain)).not.toBe(sidikJari(cuplikan()));
  });

  it('sidik jari BERUBAH bila dasar seorang anggota berubah', () => {
    const c = cuplikan();
    const lain = cuplikan({
      members: [anggota('M001', 5_000_001, 12_000_000), c.members[1], c.members[2]],
    });
    expect(sidikJari(lain)).not.toBe(sidikJari(c));
  });

  it('sidik jari BERUBAH bila versi kebijakannya berubah', () => {
    expect(sidikJari(cuplikan({ policyVersion: 2 }))).not.toBe(sidikJari(cuplikan()));
  });

  it('menghasilkan sidik jari yang sama pada pemanggilan berulang', () => {
    const c = cuplikan();
    const jari = Array.from({ length: 10 }, () => sidikJari(c));
    expect(new Set(jari).size).toBe(1);
  });

  it('dapat diulang pada berbagai ukuran koperasi', () => {
    for (const jumlah of [1, 2, 7, 50, 137]) {
      const c = cuplikan({
        members: Array.from({ length: jumlah }, (_, i) =>
          anggota(`M${String(i).padStart(4, '0')}`, 1_000 + i * 13, 3_000 + i * 71),
        ),
      });
      const a = hitungShu(c);
      const b = hitungShu(c);
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
      expect(a.integrity.ok).toBe(true);
    }
  });
});

describe('keutuhan perhitungan', () => {
  it('perhitungan yang benar lolos pemeriksaan', () => {
    expect(hitungShu(cuplikan()).integrity.ok).toBe(true);
  });

  it('menangkap alokasi yang tidak berjumlah surplus', () => {
    const h = periksaKeutuhan({
      surplus: 1_000_000,
      allocations: [{ component: 'RESERVE', ratio: 0.5, amount: 400_000 }],
      distribution: {
        perMember: [], totalCapitalService: 0, totalPatronageService: 0,
        totalDistributed: 0, eligibleCount: 0, excludedCount: 0,
      },
    });
    expect(h.ok).toBe(false);
    expect(h.issues[0]).toContain('tidak sama dengan surplus');
  });

  it('menangkap jasa modal yang dibagikan tidak sesuai alokasinya', () => {
    const h = periksaKeutuhan({
      surplus: 1_000_000,
      allocations: [
        { component: 'RESERVE', ratio: 0.5, amount: 500_000 },
        { component: 'CAPITAL_SERVICE', ratio: 0.5, amount: 500_000 },
      ],
      distribution: {
        perMember: [{ memberId: 'A', capitalService: 400_000, patronageService: 0, total: 400_000 }],
        totalCapitalService: 400_000, totalPatronageService: 0,
        totalDistributed: 400_000, eligibleCount: 1, excludedCount: 0,
      },
    });
    expect(h.ok).toBe(false);
    expect(h.issues.some((i) => i.includes('Jasa modal'))).toBe(true);
  });

  it('utuh pada berbagai surplus dan jumlah anggota', () => {
    for (const surplus of [1, 999, 1_000_000, 87_654_321]) {
      for (const jumlah of [1, 3, 11, 40]) {
        const h = hitungShu(
          cuplikan({
            surplus,
            members: Array.from({ length: jumlah }, (_, i) =>
              anggota(`M${String(i).padStart(3, '0')}`, 500 + i * 7, 900 + i * 23),
            ),
          }),
        );
        expect(h.integrity.ok).toBe(true);
      }
    }
  });
});

describe('presisi cuplikan — cacat yang ditemukan pada K-6', () => {
  /*
   * Cacat sungguhan yang ditemukan saat bukti K-6 dijalankan pertama kali:
   * sidik jari menyatakan masukannya sama, sementara bagian delapan dari
   * sebelas anggota berbeda saat dihitung ulang.
   *
   * Sebabnya, bagian masa keanggotaan dihitung pada presisi penuh tetapi
   * disimpan sebagai NUMERIC(9,6). Perhitungan ulang dari data tersimpan
   * memakai angka yang sedikit berbeda, dan pada metode sisa terbesar selisih
   * sekecil apa pun dapat memindahkan satu rupiah dari seorang anggota ke
   * anggota lain.
   *
   * Yang membuatnya berbahaya bukan selisih satu rupiahnya, melainkan sidik
   * jarinya: ia membulatkan ke empat angka di belakang koma, sehingga
   * menyatakan "masukan sama" atas masukan yang sesungguhnya berbeda. Sidik
   * jari yang memberi keyakinan palsu lebih buruk daripada tidak ada sidik
   * jari sama sekali.
   */

  it('bagian masa keanggotaan dibulatkan ke presisi penyimpanan', () => {
    const f = bagianMasaKeanggotaan('2026-07-01', null, '2026-01-01', '2026-12-31');
    // NUMERIC(9,6) menyimpan enam angka di belakang koma.
    expect(f).toBe(Math.round(f * PRESISI_FRAKSI) / PRESISI_FRAKSI);
  });

  it('menghitung ulang dari nilai yang sudah dibulatkan menghasilkan angka SAMA', () => {
    const anggotaBerpecahan = [
      anggota('M001', 1_337_117, 2_911_733, {
        membershipFraction: bagianMasaKeanggotaan('2026-07-01', null, '2026-01-01', '2026-12-31'),
      }),
      anggota('M002', 1_674_234, 3_823_466, {
        membershipFraction: bagianMasaKeanggotaan('2026-03-17', null, '2026-01-01', '2026-12-31'),
      }),
      anggota('M003', 2_011_351, 4_735_199, { membershipFraction: 1 }),
    ];
    const c = cuplikan({ surplus: 87_654_321, members: anggotaBerpecahan });
    const pertama = hitungShu(c);

    // Meniru perjalanan lewat basis data: nilai dibulatkan ke NUMERIC(9,6).
    const lewatBasisData = cuplikan({
      surplus: 87_654_321,
      members: anggotaBerpecahan.map((m) => ({
        ...m,
        membershipFraction:
          Math.round(m.membershipFraction * PRESISI_FRAKSI) / PRESISI_FRAKSI,
      })),
    });
    const kedua = hitungShu(lewatBasisData);

    expect(kedua.inputFingerprint).toBe(pertama.inputFingerprint);
    expect(JSON.stringify(kedua.distribution)).toBe(JSON.stringify(pertama.distribution));
  });

  it('sidik jari BERUBAH bila fraksi berbeda pada digit keenam', () => {
    /*
     * Sidik jari harus sepeka presisi penyimpanannya. Bila ia hanya peka
     * sampai digit keempat, ia akan menyatakan dua masukan berbeda sebagai
     * sama — persis cacat yang ditemukan pada K-6.
     */
    const a = cuplikan({ members: [anggota('M001', 1_000_000, 1_000_000, { membershipFraction: 0.500001 })] });
    const b = cuplikan({ members: [anggota('M001', 1_000_000, 1_000_000, { membershipFraction: 0.500002 })] });
    expect(sidikJari(a)).not.toBe(sidikJari(b));
  });
});

describe('bagian masa keanggotaan', () => {
  it('setahun penuh menghasilkan satu', () => {
    expect(bagianMasaKeanggotaan('2025-01-01', null, '2026-01-01', '2026-12-31')).toBe(1);
  });

  it('masuk pertengahan tahun menghasilkan sekitar separuh', () => {
    const f = bagianMasaKeanggotaan('2026-07-01', null, '2026-01-01', '2026-12-31');
    expect(f).toBeGreaterThan(0.49);
    expect(f).toBeLessThan(0.52);
  });

  it('keluar pertengahan tahun menghasilkan sekitar separuh', () => {
    const f = bagianMasaKeanggotaan('2020-01-01', '2026-06-30', '2026-01-01', '2026-12-31');
    expect(f).toBeGreaterThan(0.48);
    expect(f).toBeLessThan(0.51);
  });

  it('dihitung dari HARI, bukan dari bulan', () => {
    /*
     * Anggota yang masuk pada 20 Januari memperoleh bagian berbeda dari yang
     * masuk pada 1 Januari. Pembulatan ke bulan akan menyamakan keduanya.
     */
    const awalBulan = bagianMasaKeanggotaan('2026-01-01', null, '2026-01-01', '2026-12-31');
    const tengahBulan = bagianMasaKeanggotaan('2026-01-20', null, '2026-01-01', '2026-12-31');
    expect(tengahBulan).toBeLessThan(awalBulan);
  });

  it('masuk setelah periode berakhir menghasilkan nol', () => {
    expect(bagianMasaKeanggotaan('2027-01-01', null, '2026-01-01', '2026-12-31')).toBe(0);
  });

  it('keluar sebelum periode dimulai menghasilkan nol', () => {
    expect(bagianMasaKeanggotaan('2020-01-01', '2025-12-31', '2026-01-01', '2026-12-31')).toBe(0);
  });

  it('tidak pernah melebihi satu', () => {
    expect(bagianMasaKeanggotaan('2000-01-01', '2099-12-31', '2026-01-01', '2026-12-31')).toBe(1);
  });
});

describe('gerbang pembagian SHU', () => {
  const dasar = {
    calculationStatus: 'APPROVED',
    meetingDecisionId: 'D1',
    decisionValidity: 'VALID',
    integrityOk: true,
  };

  it('mengizinkan bila seluruh syarat terpenuhi', () => {
    expect(bolehDibagikan(dasar).allowed).toBe(true);
  });

  it('MENOLAK tanpa keputusan RAT', () => {
    /*
     * Pembagian SHU tanpa keputusan RAT yang sah adalah pengurus membagikan
     * uang anggota atas keputusannya sendiri.
     */
    const v = bolehDibagikan({ ...dasar, meetingDecisionId: null });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('Rapat Anggota');
  });

  it('MENOLAK bila keputusan RAT-nya tidak sah', () => {
    const v = bolehDibagikan({ ...dasar, decisionValidity: 'INVALID_NO_QUORUM' });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('INVALID_NO_QUORUM');
  });

  it('MENOLAK bila perhitungannya belum utuh', () => {
    expect(bolehDibagikan({ ...dasar, integrityOk: false }).allowed).toBe(false);
  });

  it('menolak perhitungan yang belum disetujui', () => {
    expect(bolehDibagikan({ ...dasar, calculationStatus: 'DRAFT' }).allowed).toBe(false);
  });

  it('keutuhan diperiksa LEBIH DAHULU daripada keputusan RAT', () => {
    // Perhitungan yang tidak utuh tidak seharusnya dibawa ke RAT sama sekali.
    const v = bolehDibagikan({ ...dasar, integrityOk: false, meetingDecisionId: null });
    expect(v.message).toContain('belum utuh');
  });
});
