/**
 * Pengujian aturan Puskesmas dan Posyandu.
 *
 * Dua hal dijaga paling ketat:
 *
 * - **Angka rujukan tidak boleh dikarang.** Tanpa baris rujukan yang berlaku,
 *   jawabannya "belum dapat dinilai" — bukan "normal". Klasifikasi stunting
 *   dipakai menentukan siapa menerima bantuan pangan.
 * - **Vaksin yang terlalu cepat ditolak, bukan diperingatkan.** Anak yang
 *   tercatat lengkap tetapi tidak terlindungi tidak akan dikejar siapa pun.
 */

import {
  beratTidakNaik,
  betulkanTinggi,
  bolehImunisasi,
  caraUkurTinggi,
  hitungCakupan,
  hitungZ,
  imunisasiTertunggak,
  nilaiPertumbuhan,
  pilihRujukan,
  urutkanKunjunganRumah,
  type JadwalImunisasi,
  type RujukanLms,
} from './health-community';

/**
 * Baris rujukan untuk pengujian.
 *
 * Sengaja hanya beberapa baris, dan sengaja TIDAK berpura-pura menjadi tabel
 * WHO lengkap. Yang diuji di sini adalah rumus dan penjagaannya, bukan isi
 * tabelnya — tabelnya disemai sebagai data.
 */
const RUJUKAN: RujukanLms[] = [
  { indicator: 'HEIGHT_FOR_AGE', sex: 'MALE', x: 24, l: 1, m: 87.1, s: 0.0378 },
  { indicator: 'HEIGHT_FOR_AGE', sex: 'FEMALE', x: 24, l: 1, m: 85.7, s: 0.0388 },
  { indicator: 'WEIGHT_FOR_AGE', sex: 'MALE', x: 24, l: -0.1733, m: 12.15, s: 0.1074 },
  { indicator: 'WEIGHT_FOR_HEIGHT', sex: 'MALE', x: 87, l: -0.3833, m: 12.2, s: 0.0871 },
];

describe('perhitungan z-score', () => {
  it('nilai tepat median menghasilkan z nol', () => {
    expect(hitungZ(87.1, { l: 1, m: 87.1, s: 0.0378 })).toBeCloseTo(0, 6);
  });

  it('nilai di bawah median menghasilkan z negatif', () => {
    expect(hitungZ(80, { l: 1, m: 87.1, s: 0.0378 })).toBeLessThan(0);
  });

  it('cabang L = 0 memakai logaritma, bukan pangkat', () => {
    /*
     * Bukan kehalusan matematika: rumus pangkat membagi dengan L, dan L = 0
     * akan menghasilkan pembagian dengan nol. Tinggi menurut umur — indikator
     * stunting — sering punya L mendekati atau sama dengan nol.
     */
    const z = hitungZ(90, { l: 0, m: 87.1, s: 0.0378 });
    expect(z).toBeCloseTo(Math.log(90 / 87.1) / 0.0378, 6);
  });

  it('nilai nol atau negatif tidak dihitung', () => {
    expect(hitungZ(0, { l: 1, m: 87.1, s: 0.0378 })).toBeNull();
    expect(hitungZ(-5, { l: 1, m: 87.1, s: 0.0378 })).toBeNull();
  });

  it('median atau simpangan nol tidak dihitung', () => {
    expect(hitungZ(87, { l: 1, m: 0, s: 0.0378 })).toBeNull();
    expect(hitungZ(87, { l: 1, m: 87.1, s: 0 })).toBeNull();
  });
});

describe('pemilihan baris rujukan', () => {
  it('memilih baris yang cocok umur dan jenis kelamin', () => {
    const r = pilihRujukan(RUJUKAN, { indicator: 'HEIGHT_FOR_AGE', sex: 'FEMALE', x: 24 });
    expect(r?.m).toBe(85.7);
  });

  it('jenis kelamin yang berbeda memakai baris yang berbeda', () => {
    // Menerapkan rujukan anak laki-laki pada anak perempuan akan salah
    // mengklasifikasi, dan salahnya tidak akan terlihat karena hasilnya tetap
    // berupa angka yang masuk akal.
    const l = pilihRujukan(RUJUKAN, { indicator: 'HEIGHT_FOR_AGE', sex: 'MALE', x: 24 });
    const p = pilihRujukan(RUJUKAN, { indicator: 'HEIGHT_FOR_AGE', sex: 'FEMALE', x: 24 });
    expect(l?.m).not.toBe(p?.m);
  });

  it('umur yang tidak ada di tabel mengembalikan null, BUKAN baris terdekat', () => {
    /*
     * Rujukan umur 24 bulan yang dipakaikan pada anak 30 bulan akan menggeser
     * klasifikasinya, dan pergeseran itu tidak akan terlihat siapa pun.
     */
    expect(pilihRujukan(RUJUKAN, { indicator: 'HEIGHT_FOR_AGE', sex: 'MALE', x: 30 })).toBeNull();
  });

  it('umur pecahan dibulatkan ke bulan terdekat', () => {
    expect(pilihRujukan(RUJUKAN, { indicator: 'HEIGHT_FOR_AGE', sex: 'MALE', x: 24.3 })?.m).toBe(87.1);
  });

  it('indikator yang berbeda tidak tertukar', () => {
    expect(pilihRujukan(RUJUKAN, { indicator: 'BMI_FOR_AGE', sex: 'MALE', x: 24 })).toBeNull();
  });
});

describe('penilaian pertumbuhan', () => {
  it('tanpa rujukan, hasilnya BELUM DAPAT DINILAI — bukan normal', () => {
    /*
     * Menyebutnya normal akan berbohong, dan kebohongan itu akan dipakai
     * menentukan siapa menerima bantuan pangan.
     */
    const h = nilaiPertumbuhan('HEIGHT_FOR_AGE', null);
    expect(h.status).toBe('UNKNOWN');
    expect(h.message).toContain('berbohong');
    expect(h.actionable).toBe(false);
  });

  it('tinggi menurut umur di bawah −2 dinyatakan stunting', () => {
    const h = nilaiPertumbuhan('HEIGHT_FOR_AGE', -2.4);
    expect(h.status).toBe('STUNTED');
    expect(h.actionable).toBe(true);
  });

  it('di bawah −3 dinyatakan stunting berat', () => {
    expect(nilaiPertumbuhan('HEIGHT_FOR_AGE', -3.5).status).toBe('SEVERELY_STUNTED');
  });

  it('pesan stunting menyebut keadaan MENAHUN', () => {
    /*
     * Stunting itu menahun, wasting itu akut. Anak pendek karena kurang gizi
     * bertahun-tahun menuntut perbaikan pangan keluarga; anak kurus karena
     * sakit pekan lalu menuntut pengobatan sekarang. Menukar keduanya berarti
     * mengirim bantuan yang keliru kepada anak yang keliru.
     */
    expect(nilaiPertumbuhan('HEIGHT_FOR_AGE', -2.4).message).toContain('MENAHUN');
  });

  it('pesan gizi buruk menyebut keadaan AKUT dan menolak penyuluhan', () => {
    const h = nilaiPertumbuhan('WEIGHT_FOR_HEIGHT', -3.2);
    expect(h.status).toBe('SEVERELY_WASTED');
    expect(h.message).toContain('AKUT');
    expect(h.message).toContain('bukan penyuluhan');
  });

  it('berat menurut tinggi di atas +2 dinyatakan gizi lebih', () => {
    expect(nilaiPertumbuhan('WEIGHT_FOR_HEIGHT', 2.5).status).toBe('OVERWEIGHT');
    expect(nilaiPertumbuhan('WEIGHT_FOR_HEIGHT', 3.4).status).toBe('OBESE');
  });

  it('berisiko gizi lebih tidak menuntut tindakan segera', () => {
    const h = nilaiPertumbuhan('WEIGHT_FOR_HEIGHT', 1.5);
    expect(h.status).toBe('RISK_OVERWEIGHT');
    expect(h.actionable).toBe(false);
  });

  it('berat menurut umur memakai istilahnya sendiri, bukan istilah stunting', () => {
    // "Berat badan kurang" bukan "pendek". Indikatornya berbeda dan tindak
    // lanjutnya berbeda.
    const h = nilaiPertumbuhan('WEIGHT_FOR_AGE', -2.3);
    expect(h.status).toBe('UNDERWEIGHT');
    expect(h.message).toContain('Berat badan kurang');
  });

  it('z dalam batas dinyatakan normal pada seluruh indikator', () => {
    for (const i of ['HEIGHT_FOR_AGE', 'WEIGHT_FOR_AGE', 'WEIGHT_FOR_HEIGHT'] as const) {
      expect(nilaiPertumbuhan(i, 0.4).status).toBe('NORMAL');
    }
  });
});

describe('cara mengukur tinggi badan', () => {
  it('di bawah 24 bulan diukur berbaring', () => {
    expect(caraUkurTinggi(18)).toBe('RECUMBENT');
  });

  it('24 bulan ke atas diukur berdiri', () => {
    expect(caraUkurTinggi(24)).toBe('STANDING');
    expect(caraUkurTinggi(36)).toBe('STANDING');
  });

  it('pengukuran yang sudah sesuai tidak diubah', () => {
    const h = betulkanTinggi({ value: 87.0, measuredAs: 'STANDING', ageMonths: 30 });
    expect(h.adjusted).toBe(false);
    expect(h.value).toBe(87.0);
  });

  it('berbaring pada anak besar dikurangi 0,7 cm', () => {
    /*
     * Selisihnya kecil, tetapi cukup untuk memindahkan anak melintasi ambang
     * −2 simpangan baku — dan ambang itulah yang menentukan ia masuk hitungan
     * stunting atau tidak.
     */
    const h = betulkanTinggi({ value: 87.7, measuredAs: 'RECUMBENT', ageMonths: 30 });
    expect(h.value).toBe(87.0);
    expect(h.adjusted).toBe(true);
  });

  it('berdiri pada bayi ditambah 0,7 cm', () => {
    const h = betulkanTinggi({ value: 80.0, measuredAs: 'STANDING', ageMonths: 18 });
    expect(h.value).toBe(80.7);
  });

  it('pembetulan DILAPORKAN, bukan diam-diam', () => {
    // Kader yang mencatat 87,7 lalu melihat 87,0 di layar tanpa penjelasan
    // akan menyimpulkan sistemnya rusak.
    expect(betulkanTinggi({ value: 87.7, measuredAs: 'RECUMBENT', ageMonths: 30 }).note)
      .toContain('WHO');
  });

  it('pengukuran dibetulkan, BUKAN ditolak', () => {
    /*
     * Menolaknya akan membuat kader mengulang pengukuran pada bayi yang sudah
     * menangis — dan yang lebih sering terjadi, membuat kader mengubah umurnya
     * supaya lewat.
     */
    expect(betulkanTinggi({ value: 87.7, measuredAs: 'RECUMBENT', ageMonths: 30 }).value)
      .toBeGreaterThan(0);
  });
});

describe('berat badan tidak naik', () => {
  const t = (tanggal: string, kg: number) => ({ measuredAt: tanggal, weightKg: kg });

  it('berat yang naik terus tidak ditandai', () => {
    expect(beratTidakNaik([t('2026-05-01', 8), t('2026-06-01', 8.3), t('2026-07-01', 8.6)]).flat)
      .toBe(false);
  });

  it('tidak naik dua kali berturut-turut ditandai', () => {
    const h = beratTidakNaik([t('2026-05-01', 8.6), t('2026-06-01', 8.6), t('2026-07-01', 8.5)]);
    expect(h.flat).toBe(true);
    expect(h.consecutive).toBe(2);
  });

  it('tidak naik satu kali belum ditandai', () => {
    // Satu kali tidak naik lazim terjadi setelah sakit ringan; menandainya akan
    // membanjiri kader dengan rujukan yang tidak perlu.
    expect(beratTidakNaik([t('2026-05-01', 8), t('2026-06-01', 8.3), t('2026-07-01', 8.3)]).flat)
      .toBe(false);
  });

  it('urutan masukan yang acak tetap dinilai menurut tanggalnya', () => {
    const h = beratTidakNaik([t('2026-07-01', 8.5), t('2026-05-01', 8.6), t('2026-06-01', 8.6)]);
    expect(h.flat).toBe(true);
  });

  it('penandanya menyebut bahwa ia tidak menuntut tabel rujukan', () => {
    // Itulah gunanya: kader dapat melihatnya dari buku KMS di tangannya.
    expect(beratTidakNaik([t('2026-05-01', 9), t('2026-06-01', 9), t('2026-07-01', 8.9)]).message)
      .toContain('tanpa tabel rujukan');
  });

  it('riwayat kosong tidak menimbulkan galat', () => {
    expect(beratTidakNaik([]).flat).toBe(false);
  });
});

describe('imunisasi', () => {
  const dpt2: JadwalImunisasi = {
    vaccineCode: 'DPT-HB-Hib',
    doseNumber: 2,
    minAgeDays: 90,
    minIntervalDays: 28,
    recommendedAgeDays: 90,
  };
  const dpt1: JadwalImunisasi = {
    vaccineCode: 'DPT-HB-Hib',
    doseNumber: 1,
    minAgeDays: 60,
    recommendedAgeDays: 60,
  };

  it('dosis pertama pada umur yang cukup diizinkan', () => {
    expect(
      bolehImunisasi({
        jadwal: dpt1, birthDate: '2026-01-01', today: '2026-03-15', previousDoses: [],
      }).allowed,
    ).toBe(true);
  });

  it('vaksin yang TERLALU CEPAT ditolak, bukan diperingatkan', () => {
    /*
     * Vaksin sebelum umur minimum tidak membentuk kekebalan yang cukup — dan
     * yang lebih berbahaya, ia akan tercatat sebagai diberikan. Anak itu lalu
     * tampak lengkap di laporan cakupan dan tidak akan dikejar siapa pun.
     */
    const v = bolehImunisasi({
      jadwal: dpt1, birthDate: '2026-01-01', today: '2026-02-01', previousDoses: [],
    });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('TOO_YOUNG');
    expect(v.message).toContain('tercatat sebagai diberikan');
  });

  it('penolakannya menyebut tanggal paling awal', () => {
    // Petugas yang ditolak tanpa tahu kapan boleh akan menyuruh ibunya
    // "datang lagi nanti", dan nanti tidak pernah tiba.
    const v = bolehImunisasi({
      jadwal: dpt1, birthDate: '2026-01-01', today: '2026-02-01', previousDoses: [],
    });
    expect(v.earliestDate).toBe('2026-03-02');
  });

  it('jarak dari dosis sebelumnya yang terlalu dekat ditolak', () => {
    const v = bolehImunisasi({
      jadwal: dpt2,
      birthDate: '2026-01-01',
      today: '2026-04-10',
      previousDoses: [{ doseNumber: 1, givenAt: '2026-04-01' }],
    });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('INTERVAL_TOO_SHORT');
    expect(v.earliestDate).toBe('2026-04-29');
  });

  it('jarak yang cukup diizinkan', () => {
    expect(
      bolehImunisasi({
        jadwal: dpt2,
        birthDate: '2026-01-01',
        today: '2026-05-05',
        previousDoses: [{ doseNumber: 1, givenAt: '2026-03-05' }],
      }).allowed,
    ).toBe(true);
  });

  it('dosis yang sudah diberikan tidak diberikan lagi', () => {
    const v = bolehImunisasi({
      jadwal: dpt1,
      birthDate: '2026-01-01',
      today: '2026-05-05',
      previousDoses: [{ doseNumber: 1, givenAt: '2026-03-05' }],
    });
    expect(v.reason).toBe('ALREADY_GIVEN');
    expect(v.message).toContain('2026-03-05');
  });

  it('dosis yang melompat urutan ditolak', () => {
    /*
     * Bukan sekadar kacau administrasi: jadwal berikutnya dihitung dari dosis
     * sebelumnya, dan urutan yang kacau membuat seluruh jarak berikutnya salah.
     */
    const v = bolehImunisasi({
      jadwal: dpt2, birthDate: '2026-01-01', today: '2026-06-01', previousDoses: [],
    });
    expect(v.reason).toBe('OUT_OF_ORDER');
  });

  it('tanggal yang tidak sah ditolak, bukan dianggap hari ini', () => {
    expect(
      bolehImunisasi({
        jadwal: dpt1, birthDate: 'bukan tanggal', today: '2026-05-05', previousDoses: [],
      }).allowed,
    ).toBe(false);
  });
});

describe('imunisasi tertunggak', () => {
  const jadwal: JadwalImunisasi[] = [
    { vaccineCode: 'HB0', doseNumber: 1, minAgeDays: 0, recommendedAgeDays: 1 },
    { vaccineCode: 'BCG', doseNumber: 1, minAgeDays: 0, recommendedAgeDays: 30 },
    { vaccineCode: 'CAMPAK', doseNumber: 1, minAgeDays: 270, recommendedAgeDays: 270 },
  ];

  it('yang belum diberikan dan sudah lewat umur anjuran dilaporkan', () => {
    const h = imunisasiTertunggak({
      jadwal, birthDate: '2026-01-01', today: '2026-06-01', given: [],
    });
    expect(h.map((x) => x.vaccineCode)).toEqual(['HB0', 'BCG']);
  });

  it('yang belum sampai umur anjurannya tidak dilaporkan tertunggak', () => {
    const h = imunisasiTertunggak({
      jadwal, birthDate: '2026-01-01', today: '2026-06-01', given: [],
    });
    expect(h.some((x) => x.vaccineCode === 'CAMPAK')).toBe(false);
  });

  it('yang sudah diberikan tidak dilaporkan', () => {
    const h = imunisasiTertunggak({
      jadwal, birthDate: '2026-01-01', today: '2026-06-01',
      given: [{ vaccineCode: 'HB0', doseNumber: 1 }],
    });
    expect(h.some((x) => x.vaccineCode === 'HB0')).toBe(false);
  });

  it('diurutkan dari yang paling lama tertunggak', () => {
    const h = imunisasiTertunggak({
      jadwal, birthDate: '2026-01-01', today: '2026-06-01', given: [],
    });
    expect(h[0].overdueDays).toBeGreaterThan(h[1].overdueDays);
  });

  it('dihitung dari umur ANJURAN, bukan umur minimum', () => {
    // Umur minimum adalah batas keamanan; umur anjuran adalah kapan anak
    // seharusnya sudah terlindungi.
    const h = imunisasiTertunggak({
      jadwal: [{ vaccineCode: 'X', doseNumber: 1, minAgeDays: 0, recommendedAgeDays: 100 }],
      birthDate: '2026-01-01', today: '2026-03-01', given: [],
    });
    expect(h).toEqual([]);
  });
});

describe('cakupan program', () => {
  it('cakupan dihitung terhadap sasaran', () => {
    const h = hitungCakupan({ target: 100, achieved: 82 });
    expect(h.coverage).toBe(82);
    expect(h.gap).toBe(18);
  });

  it('sasaran yang belum ditetapkan tidak dihitung', () => {
    /*
     * Menghitung "berapa persen yang datang sudah diimunisasi" akan selalu
     * mendekati seratus persen dan tidak memberi tahu apa pun — yang perlu
     * diketahui justru berapa banyak yang tidak pernah datang.
     */
    const h = hitungCakupan({ target: 0, achieved: 50 });
    expect(h.coverage).toBe(0);
    expect(h.message).toContain('penyebut');
  });

  it('pesannya menyebut berapa yang belum terjangkau', () => {
    expect(hitungCakupan({ target: 100, achieved: 82 }).message).toContain('18 sasaran');
  });

  it('sasaran yang terlampaui tidak menghasilkan kekurangan negatif', () => {
    const h = hitungCakupan({ target: 100, achieved: 110 });
    expect(h.gap).toBe(0);
    expect(h.coverage).toBe(110);
  });
});

describe('urutan kunjungan rumah', () => {
  it('gizi buruk didahulukan di atas segalanya', () => {
    const h = urutkanKunjunganRumah([
      { id: 'a', overdueDays: 900 },
      { id: 'b', severelyWasted: true },
    ] as Array<{ id: string; severelyWasted?: boolean; overdueDays?: number }>);
    expect(h[0].id).toBe('b');
  });

  it('berat tidak naik didahulukan di atas stunting', () => {
    // Berat yang tidak naik adalah keadaan yang sedang berjalan; stunting sudah
    // terjadi dan tidak berubah dalam sepekan.
    const h = urutkanKunjunganRumah([
      { id: 'stunted', stunted: true },
      { id: 'flat', weightFlat: true },
    ] as Array<{ id: string; stunted?: boolean; weightFlat?: boolean }>);
    expect(h[0].id).toBe('flat');
  });

  it('pada keadaan setara, yang imunisasinya paling lama tertunggak didahulukan', () => {
    const h = urutkanKunjunganRumah([
      { id: 'baru', overdueDays: 10 },
      { id: 'lama', overdueDays: 200 },
    ] as Array<{ id: string; overdueDays?: number }>);
    expect(h[0].id).toBe('lama');
  });

  it('pengurutan tidak mengubah daftar aslinya', () => {
    const asli = [{ id: 'a' }, { id: 'b', severelyWasted: true }] as Array<{
      id: string;
      severelyWasted?: boolean;
    }>;
    urutkanKunjunganRumah(asli);
    expect(asli[0].id).toBe('a');
  });

  it('daftar kosong tidak menimbulkan galat', () => {
    expect(urutkanKunjunganRumah([])).toEqual([]);
  });
});
