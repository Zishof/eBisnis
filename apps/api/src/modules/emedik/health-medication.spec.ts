/**
 * Pengujian keselamatan obat.
 *
 * Dua hal dijaga paling ketat, dan keduanya menyangkut nyawa:
 *
 * 1. **Alergi berat memblokir.** Tidak ada keadaan yang membuatnya boleh
 *    dilewati lewat satu klik.
 * 2. **Peringatan yang tidak berbahaya TIDAK memblokir.** Sistem yang
 *    memblokir segalanya sama tidak amannya dengan yang tidak memblokir apa
 *    pun — bedanya, yang pertama merasa aman sampai orang berhenti membacanya.
 */

import {
  bolehLewati,
  bolehSerahkan,
  cocokAlergi,
  normalkanZat,
  periksaAlergi,
  periksaDosis,
  periksaEnamBenar,
  periksaInteraksi,
  periksaPenandaan,
  periksaResep,
  periksaTerapiGanda,
  TOLERANSI_WAKTU_MENIT,
  type AlergiPasien,
  type Interaksi,
  type Obat,
} from './health-medication';

const obat = (over: Partial<Obat> = {}): Obat => ({
  id: 'D1',
  code: 'AMOX500',
  genericName: 'Amoksisilin 500 mg',
  activeIngredient: 'Amoksisilin',
  drugClass: 'PRESCRIPTION',
  isControlled: false,
  isHighAlert: false,
  isLasa: false,
  doseUnit: 'mg',
  ...over,
});

const alergi = (over: Partial<AlergiPasien> = {}): AlergiPasien => ({
  allergenName: 'Amoksisilin',
  allergenType: 'DRUG',
  severity: 'SEVERE',
  certainty: 'CONFIRMED',
  ...over,
});

describe('pencocokan zat aktif', () => {
  it('nama yang sama cocok apa pun huruf besar-kecilnya', () => {
    expect(cocokAlergi('Amoksisilin', 'amoksisilin')).toBe(true);
  });

  it('mencocokkan zat, bukan nama dagang', () => {
    /*
     * Pasien yang alergi amoksisilin alergi terhadap SELURUH merek yang
     * mengandungnya. Mencocokkan nama dagang akan melewatkan hampir semuanya.
     */
    const o = obat({ genericName: 'Amoxsan', activeIngredient: 'Amoksisilin' });
    expect(periksaAlergi(o, [alergi()])).toHaveLength(1);
  });

  it('turunan yang sama golongan ikut tercocokkan', () => {
    // Amoksisilin-klavulanat mengandung amoksisilin. Melewatkannya berbahaya.
    expect(cocokAlergi('Amoksisilin-klavulanat', 'Amoksisilin')).toBe(true);
  });

  it('zat yang berbeda tidak tercocokkan', () => {
    expect(cocokAlergi('Parasetamol', 'Amoksisilin')).toBe(false);
  });

  it('potongan pendek tidak mencocoki segalanya', () => {
    // Tanpa panjang minimum, "al" akan cocok dengan hampir seluruh nama obat
    // dan setiap resep akan memunculkan peringatan alergi palsu.
    expect(cocokAlergi('Parasetamol', 'al')).toBe(false);
  });

  it('nama kosong tidak pernah cocok', () => {
    expect(cocokAlergi('', 'Amoksisilin')).toBe(false);
    expect(cocokAlergi('Amoksisilin', '')).toBe(false);
  });

  it('normalisasi membuang tanda baca dan spasi', () => {
    expect(normalkanZat('Amoksisilin-Klavulanat')).toBe('amoksisilinklavulanat');
  });
});

describe('pemeriksaan alergi', () => {
  it('alergi BERAT memblokir', () => {
    const [p] = periksaAlergi(obat(), [alergi({ severity: 'SEVERE' })]);
    expect(p.blocking).toBe(true);
    expect(p.severity).toBe('BLOCKING');
  });

  it('alergi FATAL memblokir', () => {
    const [p] = periksaAlergi(obat(), [alergi({ severity: 'FATAL' })]);
    expect(p.blocking).toBe(true);
    expect(p.message).toContain('TIDAK BOLEH');
  });

  it('alergi ringan memperingatkan tetapi TIDAK memblokir', () => {
    /*
     * Ruam ringan bertahun-tahun lalu tidak boleh menghalangi antibiotik yang
     * dibutuhkan hari ini. Yang perlu adalah dokter mengetahuinya, bukan sistem
     * memutuskannya.
     */
    const [p] = periksaAlergi(obat(), [alergi({ severity: 'MILD' })]);
    expect(p.blocking).toBe(false);
    expect(p.severity).toBe('CRITICAL');
  });

  it('alergi makanan tidak memicu peringatan obat', () => {
    const hasil = periksaAlergi(obat(), [
      alergi({ allergenType: 'FOOD', allergenName: 'Udang' }),
    ]);
    expect(hasil).toHaveLength(0);
  });

  it('pasien tanpa alergi tidak menghasilkan peringatan', () => {
    expect(periksaAlergi(obat(), [])).toHaveLength(0);
  });

  it('pesannya menyebut zat dan alergennya sekaligus', () => {
    // Dokter yang membaca peringatan perlu tahu MENGAPA sistem menduga, bukan
    // hanya bahwa ia menduga.
    const [p] = periksaAlergi(obat(), [alergi()]);
    expect(p.message).toContain('Amoksisilin');
    expect(p.detail?.allergen).toBe('Amoksisilin');
  });
});

describe('pemeriksaan dosis', () => {
  const o = obat({ minSingleDose: 250, maxSingleDose: 1000, maxDailyDose: 3000, doseUnit: 'mg' });

  it('dosis dalam batas tidak menghasilkan peringatan', () => {
    expect(periksaDosis(o, { value: 500, unit: 'mg' })).toHaveLength(0);
  });

  it('sedikit di atas batas memperingatkan tanpa memblokir', () => {
    const [p] = periksaDosis(o, { value: 1200, unit: 'mg' });
    expect(p.blocking).toBe(false);
    expect(p.severity).toBe('CRITICAL');
  });

  it('dua kali lipat batas MEMBLOKIR — hampir selalu salah ketik', () => {
    // Koma yang tergeser, atau satuan yang tertukar.
    const [p] = periksaDosis(o, { value: 5000, unit: 'mg' });
    expect(p.blocking).toBe(true);
    expect(p.message).toContain('Periksa kembali');
  });

  it('di bawah batas lazim hanya memperingatkan', () => {
    // Dosis kecil sering disengaja pada anak dan lansia.
    const [p] = periksaDosis(o, { value: 100, unit: 'mg' });
    expect(p.blocking).toBe(false);
    expect(p.severity).toBe('WARNING');
  });

  it('total harian yang berlebih diperingatkan', () => {
    const hasil = periksaDosis(o, { value: 1000, unit: 'mg', perDay: 4 });
    expect(hasil.some((p) => p.message.includes('harian'))).toBe(true);
  });

  it('obat tanpa batas tercatat TIDAK diperiksa', () => {
    /*
     * Memeriksa dengan angka yang dikarang menghasilkan peringatan palsu, dan
     * peringatan palsu adalah cara tercepat membuat orang berhenti membaca
     * peringatan.
     */
    expect(periksaDosis(obat({ maxSingleDose: null }), { value: 99999, unit: 'mg' })).toHaveLength(0);
  });

  it('satuan yang berbeda tidak dibandingkan', () => {
    // 1 gram bukan seribu kali terlalu besar dibanding batas 1000 mg — ia sama.
    // Membandingkannya begitu saja menghasilkan peringatan yang salah.
    expect(periksaDosis(o, { value: 1, unit: 'g' })).toHaveLength(0);
  });

  it('dosis nol dan negatif memblokir', () => {
    for (const v of [0, -5, Number.NaN]) {
      const [p] = periksaDosis(o, { value: v, unit: 'mg' });
      expect(p.blocking).toBe(true);
    }
  });
});

describe('pemeriksaan interaksi', () => {
  const katalog: Interaksi[] = [
    {
      ingredientA: 'Warfarin',
      ingredientB: 'Aspirin',
      severity: 'MAJOR',
      description: 'Meningkatkan risiko perdarahan.',
      management: 'Pantau INR.',
    },
    {
      ingredientA: 'Simvastatin',
      ingredientB: 'Itrakonazol',
      severity: 'CONTRAINDICATED',
      description: 'Risiko rabdomiolisis.',
    },
  ];

  it('interaksi mayor memperingatkan tanpa memblokir', () => {
    const [p] = periksaInteraksi(obat({ activeIngredient: 'Warfarin' }), ['Aspirin'], katalog);
    expect(p.severity).toBe('CRITICAL');
    expect(p.blocking).toBe(false);
  });

  it('kontraindikasi MEMBLOKIR', () => {
    const [p] = periksaInteraksi(obat({ activeIngredient: 'Simvastatin' }), ['Itrakonazol'], katalog);
    expect(p.blocking).toBe(true);
  });

  it('arah pasangan tidak mengubah hasil', () => {
    const a = periksaInteraksi(obat({ activeIngredient: 'Aspirin' }), ['Warfarin'], katalog);
    const b = periksaInteraksi(obat({ activeIngredient: 'Warfarin' }), ['Aspirin'], katalog);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('pesannya menyertakan cara penanganannya bila ada', () => {
    const [p] = periksaInteraksi(obat({ activeIngredient: 'Warfarin' }), ['Aspirin'], katalog);
    expect(p.message).toContain('Pantau INR');
  });

  it('zat yang tidak berinteraksi tidak menghasilkan peringatan', () => {
    expect(periksaInteraksi(obat(), ['Parasetamol'], katalog)).toHaveLength(0);
  });

  it('obat tidak berinteraksi dengan dirinya sendiri', () => {
    expect(periksaInteraksi(obat({ activeIngredient: 'Warfarin' }), ['Warfarin'], katalog)).toHaveLength(0);
  });
});

describe('terapi ganda', () => {
  it('zat yang sama dua kali pada satu resep diperingatkan', () => {
    const [p] = periksaTerapiGanda(obat(), ['Amoksisilin']);
    expect(p.type).toBe('DUPLICATE_THERAPY');
    expect(p.message).toContain('menggandakan');
  });

  it('zat berbeda tidak diperingatkan', () => {
    expect(periksaTerapiGanda(obat(), ['Parasetamol'])).toHaveLength(0);
  });
});

describe('penandaan obat', () => {
  it('obat berisiko tinggi menuntut pemeriksaan ganda', () => {
    const [p] = periksaPenandaan(obat({ isHighAlert: true }));
    expect(p.message).toContain('pemeriksaan ganda');
  });

  it('obat LASA diperingatkan agar dipastikan', () => {
    const p = periksaPenandaan(obat({ isLasa: true }));
    expect(p.some((x) => x.type === 'LASA')).toBe(true);
  });

  it('penandaan tidak pernah memblokir', () => {
    // Ia mengingatkan, bukan melarang. Obat berisiko tinggi memang diresepkan
    // setiap hari; yang perlu adalah kehati-hatian, bukan penolakan.
    const p = periksaPenandaan(
      obat({ isHighAlert: true, isLasa: true, isControlled: true, drugClass: 'NARCOTIC' }),
    );
    expect(p.every((x) => !x.blocking)).toBe(true);
  });
});

describe('pemeriksaan resep menyeluruh', () => {
  const dasar = {
    obat: obat(),
    alergiPasien: [] as AlergiPasien[],
    zatLainDipakai: [] as string[],
    zatLainDiResep: [] as string[],
    katalogInteraksi: [] as Interaksi[],
    dosis: { value: 500, unit: 'mg' },
  };

  it('resep wajar tidak menghasilkan peringatan sama sekali', () => {
    const h = periksaResep(dasar);
    expect(h.alerts).toHaveLength(0);
    expect(h.blocked).toBe(false);
  });

  it('yang paling berbahaya tampil paling atas', () => {
    /*
     * Urutan menentukan apa yang benar-benar dibaca. Peringatan pemblokir yang
     * tampil di baris kelima sama saja dengan tidak ada.
     */
    const h = periksaResep({
      ...dasar,
      obat: obat({ isLasa: true, isHighAlert: true }),
      alergiPasien: [alergi({ severity: 'FATAL' })],
    });
    expect(h.alerts[0].severity).toBe('BLOCKING');
    expect(h.blocked).toBe(true);
  });

  it('satu peringatan pemblokir sudah cukup memblokir seluruhnya', () => {
    const h = periksaResep({ ...dasar, alergiPasien: [alergi({ severity: 'SEVERE' })] });
    expect(h.blocked).toBe(true);
  });

  it('banyak peringatan tidak memblokir bila tidak ada yang berbahaya', () => {
    const h = periksaResep({
      ...dasar,
      obat: obat({ isLasa: true, isHighAlert: true, isControlled: true, drugClass: 'NARCOTIC' }),
      zatLainDiResep: ['Amoksisilin'],
    });
    expect(h.alerts.length).toBeGreaterThan(2);
    expect(h.blocked).toBe(false);
  });
});

describe('penyerahan obat', () => {
  const dasar = {
    obat: obat(),
    expiryDate: '2027-12-31',
    today: '2026-08-01',
    quantityRequested: 10,
    quantityRemaining: 20,
    prescriptionStatus: 'REVIEWED',
    reviewed: true,
  };

  it('penyerahan wajar diizinkan', () => {
    expect(bolehSerahkan(dasar).allowed).toBe(true);
  });

  it('obat KEDALUWARSA ditolak', () => {
    /*
     * Inilah aturan yang tidak dimiliki mesin persediaan umum, dan inilah
     * sebabnya farmasi tidak boleh menulis langsung ke sana.
     */
    const v = bolehSerahkan({ ...dasar, expiryDate: '2026-07-31' });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('kedaluwarsa');
  });

  it('kedaluwarsa hari ini juga ditolak', () => {
    expect(bolehSerahkan({ ...dasar, expiryDate: '2026-08-01' }).allowed).toBe(false);
  });

  it('melebihi sisa resep ditolak, dan menyebutkan sisanya', () => {
    const v = bolehSerahkan({ ...dasar, quantityRequested: 30 });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('20');
  });

  it('resep yang dibatalkan tidak dapat dilayani', () => {
    expect(bolehSerahkan({ ...dasar, prescriptionStatus: 'CANCELLED' }).allowed).toBe(false);
  });

  it('obat terkendali wajib ditelaah apoteker lebih dahulu', () => {
    const v = bolehSerahkan({
      ...dasar,
      obat: obat({ isControlled: true, drugClass: 'NARCOTIC' }),
      reviewed: false,
    });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('ditelaah');
  });

  it('obat biasa yang belum ditelaah TETAP dapat diserahkan', () => {
    /*
     * Menahan seluruhnya akan menghentikan apotek kecil yang apotekernya
     * merangkap penyerah — dan aturan yang menghentikan pekerjaan akan
     * dilanggar, bukan dipatuhi.
     */
    expect(bolehSerahkan({ ...dasar, reviewed: false }).allowed).toBe(true);
  });

  it('obat terkendali dan berisiko tinggi menuntut pemeriksaan ganda', () => {
    expect(bolehSerahkan({ ...dasar, obat: obat({ isControlled: true }) }).requiresDoubleCheck).toBe(true);
    expect(bolehSerahkan({ ...dasar, obat: obat({ isHighAlert: true }) }).requiresDoubleCheck).toBe(true);
    expect(bolehSerahkan(dasar).requiresDoubleCheck).toBe(false);
  });

  it('sediaan tanpa tanggal kedaluwarsa tidak ditolak karenanya', () => {
    // Sebagian sediaan racikan memang tidak punya. Menolaknya akan menghentikan
    // pelayanan tanpa menambah keamanan.
    expect(bolehSerahkan({ ...dasar, expiryDate: null }).allowed).toBe(true);
  });
});

describe('enam benar', () => {
  const benar = {
    scanPatientId: 'P1',
    prescriptionPatientId: 'P1',
    scanDrugId: 'D1',
    prescriptionDrugId: 'D1',
    doseValue: 500,
    prescriptionDose: 500,
    route: 'ORAL',
    prescriptionRoute: 'ORAL',
    scheduledAt: '2026-08-01T08:00:00Z',
    administeredAt: '2026-08-01T08:15:00Z',
    administeredBy: 'N1',
  };

  it('seluruhnya benar lolos', () => {
    expect(periksaEnamBenar(benar).ok).toBe(true);
  });

  it('pasien yang salah gagal', () => {
    const h = periksaEnamBenar({ ...benar, scanPatientId: 'P2' });
    expect(h.failed).toContain('patient');
    expect(h.message).toContain('benar pasien');
  });

  it('TANPA pemindaian pasien dianggap gagal, bukan dilewati', () => {
    /*
     * Identitas tidak boleh dianggap benar hanya karena layar sedang
     * menampilkannya. Memberi obat kepada orang yang salah adalah kekeliruan
     * yang paling sering terjadi dan paling mudah dicegah.
     */
    expect(periksaEnamBenar({ ...benar, scanPatientId: null }).failed).toContain('patient');
  });

  it('obat yang salah gagal', () => {
    expect(periksaEnamBenar({ ...benar, scanDrugId: 'D9' }).failed).toContain('medication');
  });

  it('dosis yang berbeda dari resep gagal', () => {
    expect(periksaEnamBenar({ ...benar, doseValue: 250 }).failed).toContain('dose');
  });

  it('rute yang berbeda gagal', () => {
    expect(periksaEnamBenar({ ...benar, route: 'IV' }).failed).toContain('route');
  });

  it('rute dengan penulisan berbeda tetap lolos', () => {
    expect(periksaEnamBenar({ ...benar, route: 'oral' }).ok).toBe(true);
  });

  it('terlambat dalam toleransi tetap lolos', () => {
    const dalam = new Date(
      new Date(benar.scheduledAt).getTime() + (TOLERANSI_WAKTU_MENIT - 5) * 60_000,
    ).toISOString();
    expect(periksaEnamBenar({ ...benar, administeredAt: dalam }).ok).toBe(true);
  });

  it('terlambat melebihi toleransi gagal pada benar waktu', () => {
    const lewat = new Date(
      new Date(benar.scheduledAt).getTime() + (TOLERANSI_WAKTU_MENIT + 30) * 60_000,
    ).toISOString();
    expect(periksaEnamBenar({ ...benar, administeredAt: lewat }).failed).toContain('time');
  });

  it('tanpa jadwal, benar waktu tidak diperiksa', () => {
    // Obat bila perlu (PRN) tidak punya jadwal, dan menuntutnya akan
    // menggagalkan setiap pemberian yang sah.
    expect(periksaEnamBenar({ ...benar, scheduledAt: null }).ok).toBe(true);
  });

  it('tanpa pemberi tercatat gagal pada benar dokumentasi', () => {
    expect(periksaEnamBenar({ ...benar, administeredBy: null }).failed).toContain('documentation');
  });

  it('beberapa kegagalan dilaporkan sekaligus', () => {
    // Melaporkan satu per satu akan membuat perawat memperbaiki, mencoba lagi,
    // lalu menemui kegagalan berikutnya — berulang kali di depan pasien.
    const h = periksaEnamBenar({ ...benar, scanPatientId: 'P2', doseValue: 250, route: 'IV' });
    expect(h.failed.length).toBe(3);
  });
});

describe('melewati pemberian obat', () => {
  it('tanpa alasan ditolak', () => {
    const v = bolehLewati(null);
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('lupa diberikan');
  });

  it('alasan kosong ditolak', () => {
    expect(bolehLewati('   ').allowed).toBe(false);
  });

  it('dengan alasan diizinkan', () => {
    expect(bolehLewati('Pasien menolak.').allowed).toBe(true);
  });
});
