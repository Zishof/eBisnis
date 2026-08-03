/**
 * Pengujian aturan laboratorium.
 *
 * Yang dijaga paling ketat adalah rantai penyampaian nilai kritis. Hasil yang
 * benar, terverifikasi, dan tidak dibaca siapa pun sampai keesokan paginya
 * bukan kegagalan laboratorium — ia kegagalan penyampaian, dan bagi pasiennya
 * tidak ada bedanya.
 */

import {
  bolehAmandemenHasil,
  bolehLepasHasil,
  bolehTerimaKritis,
  bolehTerimaSpesimen,
  bolehVerifikasiOtomatis,
  lewatTenggat,
  nilaiHasil,
  periksaDelta,
  pilihRentang,
  statusPenyampaianKritis,
  TENGGAT_TERIMA_KRITIS_MENIT,
  urutkanKerja,
  type BarisKerja,
  type PemeriksaanLab,
} from './health-lab';

const hb: PemeriksaanLab = {
  code: 'HB',
  name: 'Hemoglobin',
  resultType: 'NUMERIC',
  unit: 'g/dL',
  allowAutoVerify: true,
  deltaCheckPercent: 25,
  ranges: [
    { unit: 'g/dL', low: 12, high: 16, criticalLow: 7, criticalHigh: 20 },
    { sex: 'MALE', minAge: 18, unit: 'g/dL', low: 13.5, high: 17.5, criticalLow: 7, criticalHigh: 20 },
    { sex: 'FEMALE', minAge: 18, unit: 'g/dL', low: 12, high: 15.5, criticalLow: 7, criticalHigh: 20 },
    { minAge: 0, maxAge: 1, unit: 'g/dL', low: 13.5, high: 21.5, criticalLow: 9, criticalHigh: 24 },
  ],
};

const dewasaPria = { ageYears: 40, sex: 'MALE' as const };
const dewasaWanita = { ageYears: 30, sex: 'FEMALE' as const };
const bayi = { ageYears: 0.5, sex: 'MALE' as const };

describe('pemilihan rentang rujukan', () => {
  it('laki-laki dewasa memakai rentang laki-laki dewasa', () => {
    expect(pilihRentang(hb, dewasaPria)?.low).toBe(13.5);
  });

  it('perempuan dewasa memakai rentang perempuan dewasa', () => {
    expect(pilihRentang(hb, dewasaWanita)?.low).toBe(12);
  });

  it('bayi memakai rentang bayi, bukan rentang dewasa', () => {
    /*
     * Hemoglobin bayi memang jauh lebih tinggi. Menerapkan rentang dewasa
     * kepadanya akan menandai bayi sehat sebagai polisitemia — dan menandai
     * semua bayi akan membuat penandaan itu diabaikan.
     */
    expect(pilihRentang(hb, bayi)?.high).toBe(21.5);
  });

  it('rentang yang menyebut jenis kelamin lebih diutamakan', () => {
    expect(pilihRentang(hb, dewasaPria)?.sex).toBe('MALE');
  });

  it('pasien tanpa jenis kelamin tidak dipaksakan ke rentang berjenis kelamin', () => {
    // Menebak jenis kelamin demi memperoleh rentang akan menandai orang dengan
    // batas yang bukan miliknya.
    const r = pilihRentang(hb, { ageYears: 40, sex: null });
    expect(r?.sex).toBeUndefined();
  });

  it('pemeriksaan tanpa rentang yang cocok mengembalikan null', () => {
    const kosong: PemeriksaanLab = { ...hb, ranges: [{ sex: 'FEMALE', unit: 'g/dL', low: 1, high: 2 }] };
    expect(pilihRentang(kosong, dewasaPria)).toBeNull();
  });
});

describe('penilaian hasil', () => {
  it('hasil dalam rentang dinyatakan normal', () => {
    expect(nilaiHasil(hb, dewasaPria, 15).flag).toBe('NORMAL');
  });

  it('hasil di bawah rentang ditandai rendah', () => {
    expect(nilaiHasil(hb, dewasaPria, 12).flag).toBe('LOW');
  });

  it('hasil di atas rentang ditandai tinggi', () => {
    expect(nilaiHasil(hb, dewasaPria, 19).flag).toBe('HIGH');
  });

  it('nilai kritis rendah ditandai kritis, bukan sekadar rendah', () => {
    /*
     * Menyebutnya "rendah" saja akan menempatkannya dalam antrean yang sama
     * dengan seratus hasil rendah lain hari itu — dan yang ini tidak dapat
     * menunggu antrean.
     */
    const h = nilaiHasil(hb, dewasaPria, 6.2);
    expect(h.flag).toBe('CRITICAL_LOW');
    expect(h.critical).toBe(true);
  });

  it('nilai kritis tinggi ditandai kritis', () => {
    expect(nilaiHasil(hb, dewasaPria, 21).critical).toBe(true);
  });

  it('pesannya menyebut angka dan batasnya', () => {
    expect(nilaiHasil(hb, dewasaPria, 6.2).message).toContain('6.2');
    expect(nilaiHasil(hb, dewasaPria, 6.2).message).toContain('7');
  });

  it('yang sama pada bayi belum tentu kritis', () => {
    // Batas kritis bayi berbeda; menyamakannya akan menghasilkan panggilan
    // telepon tengah malam untuk bayi yang baik-baik saja.
    expect(nilaiHasil(hb, bayi, 10).critical).toBe(false);
    expect(nilaiHasil(hb, bayi, 8.5).critical).toBe(true);
  });

  it('tanpa rentang yang berlaku, hasilnya TIDAK dinyatakan normal', () => {
    /*
     * Menandainya normal adalah berbohong; menandainya tinggi juga. Yang jujur
     * adalah mengatakan tidak tahu, supaya yang membacanya menilai sendiri.
     */
    const kosong: PemeriksaanLab = { ...hb, ranges: [] };
    const h = nilaiHasil(kosong, dewasaPria, 15);
    expect(h.flag).toBe('UNKNOWN');
    expect(h.message).toContain('Tidak ada rentang rujukan');
  });

  it('hasil bukan angka tidak dinilai', () => {
    expect(nilaiHasil(hb, dewasaPria, null).flag).toBe('UNKNOWN');
    expect(nilaiHasil(hb, dewasaPria, Number.NaN).flag).toBe('UNKNOWN');
  });
});

describe('pemeriksaan delta', () => {
  it('perubahan wajar tidak mencurigakan', () => {
    expect(periksaDelta(hb, 14.2, 14.8).suspicious).toBe(false);
  });

  it('perubahan besar mencurigakan', () => {
    // Hemoglobin turun dari 14 ke 7 dalam beberapa jam jauh lebih sering
    // berarti tabungnya tertukar daripada pasiennya berdarah sebanyak itu.
    const d = periksaDelta(hb, 7, 14);
    expect(d.suspicious).toBe(true);
    expect(d.message).toContain('identitas spesimen');
  });

  it('tanpa hasil sebelumnya, tidak ada yang dibandingkan', () => {
    expect(periksaDelta(hb, 7, null).suspicious).toBe(false);
  });

  it('pemeriksaan tanpa ambang delta tidak diperiksa', () => {
    expect(periksaDelta({ ...hb, deltaCheckPercent: null }, 7, 14).suspicious).toBe(false);
  });

  it('hasil sebelumnya nol tidak dibagi', () => {
    expect(periksaDelta(hb, 7, 0).changePercent).toBeNull();
  });

  it('persentasenya dilaporkan agar analis dapat menilai sendiri', () => {
    expect(Math.round(periksaDelta(hb, 7, 14).changePercent as number)).toBe(-50);
  });
});

describe('penerimaan spesimen', () => {
  const dasar = {
    labelled: true,
    labelMatchesRequest: true,
    collectedAt: '2026-08-01T08:00:00Z',
    receivedAt: '2026-08-01T08:20:00Z',
    maxTransportMinutes: 60,
    volumeSufficient: true,
    containerCorrect: true,
  };

  it('spesimen yang baik diterima', () => {
    expect(bolehTerimaSpesimen(dasar).accepted).toBe(true);
  });

  it('spesimen TANPA LABEL tidak pernah diterima', () => {
    /*
     * Sekalipun petugas yang mengantarnya yakin betul itu milik siapa.
     * Keyakinan yang salah tentang identitas spesimen menghasilkan hasil yang
     * benar secara analitis, dilaporkan dengan percaya diri, dan tertempel pada
     * orang yang keliru — dan ia akan dipercaya, karena laboratorium jarang
     * salah.
     */
    const v = bolehTerimaSpesimen({ ...dasar, labelled: false });
    expect(v.accepted).toBe(false);
    expect(v.reason).toBe('UNLABELLED');
  });

  it('label yang tidak cocok dengan permintaan ditolak', () => {
    expect(bolehTerimaSpesimen({ ...dasar, labelMatchesRequest: false }).reason).toBe('MISLABELLED');
  });

  it('volume yang kurang ditolak', () => {
    expect(bolehTerimaSpesimen({ ...dasar, volumeSufficient: false }).reason).toBe(
      'INSUFFICIENT_VOLUME',
    );
  });

  it('tabung yang keliru ditolak — antikoagulannya mengubah hasil', () => {
    expect(bolehTerimaSpesimen({ ...dasar, containerCorrect: false }).reason).toBe('WRONG_CONTAINER');
  });

  it('spesimen yang terlalu lama di jalan ditolak', () => {
    const v = bolehTerimaSpesimen({ ...dasar, receivedAt: '2026-08-01T10:30:00Z' });
    expect(v.reason).toBe('DELAYED_TRANSPORT');
    expect(v.message).toContain('150 menit');
  });

  it('tanpa batas waktu pengiriman, keterlambatan tidak diperiksa', () => {
    expect(
      bolehTerimaSpesimen({ ...dasar, maxTransportMinutes: null, receivedAt: '2026-08-02T10:00:00Z' })
        .accepted,
    ).toBe(true);
  });

  it('tanpa waktu pengambilan, keterlambatan tidak ditebak', () => {
    expect(bolehTerimaSpesimen({ ...dasar, collectedAt: null }).accepted).toBe(true);
  });
});

describe('verifikasi otomatis', () => {
  const normal = nilaiHasil(hb, dewasaPria, 15);
  const kritis = nilaiHasil(hb, dewasaPria, 6);

  it('hasil normal pada pemeriksaan otomatis boleh lolos', () => {
    expect(
      bolehVerifikasiOtomatis({ pemeriksaan: hb, penilaian: normal, delta: { suspicious: false } })
        .allowed,
    ).toBe(true);
  });

  it('NILAI KRITIS tidak pernah lolos otomatis', () => {
    /*
     * Nilai kritis yang lolos tanpa dilihat siapa pun akan masuk ke rekam medis
     * tanpa ada seorang pun yang tahu ia pernah ada.
     */
    const v = bolehVerifikasiOtomatis({
      pemeriksaan: hb,
      penilaian: kritis,
      delta: { suspicious: false },
    });
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain('kritis');
  });

  it('delta yang mencurigakan menahan verifikasi otomatis', () => {
    expect(
      bolehVerifikasiOtomatis({ pemeriksaan: hb, penilaian: normal, delta: { suspicious: true } })
        .allowed,
    ).toBe(false);
  });

  it('pemeriksaan yang tidak ditandai otomatis tidak pernah lolos', () => {
    expect(
      bolehVerifikasiOtomatis({
        pemeriksaan: { ...hb, allowAutoVerify: false },
        penilaian: normal,
        delta: { suspicious: false },
      }).allowed,
    ).toBe(false);
  });

  it('hasil tanpa rentang rujukan tidak dapat dinilai mesin', () => {
    const tanpa = nilaiHasil({ ...hb, ranges: [] }, dewasaPria, 15);
    expect(
      bolehVerifikasiOtomatis({ pemeriksaan: hb, penilaian: tanpa, delta: { suspicious: false } })
        .allowed,
    ).toBe(false);
  });
});

describe('pelepasan hasil', () => {
  const dasar = {
    status: 'VERIFIED',
    enteredBy: 'A1',
    verifiedBy: 'A2',
    specimenStatus: 'COMPLETED' as const,
  };

  it('hasil terverifikasi oleh orang lain boleh dilepas', () => {
    expect(bolehLepasHasil(dasar).allowed).toBe(true);
  });

  it('hasil yang belum diverifikasi tidak dilepas', () => {
    expect(bolehLepasHasil({ ...dasar, verifiedBy: null }).allowed).toBe(false);
  });

  it('verifikator tidak boleh sama dengan yang memasukkan hasil', () => {
    // Alasan yang sama seperti telaah apoteker: orang yang mengetik angkanya
    // adalah orang yang paling sulit melihat kekeliruannya.
    const v = bolehLepasHasil({ ...dasar, verifiedBy: 'A1' });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('Verifikator');
  });

  it('hasil dari spesimen yang DITOLAK tidak pernah dilaporkan', () => {
    expect(bolehLepasHasil({ ...dasar, specimenStatus: 'REJECTED' }).allowed).toBe(false);
  });
});

describe('penyampaian nilai kritis', () => {
  const keluar = '2026-08-01T08:00:00Z';

  it('yang sudah diterima dilaporkan beserta lamanya', () => {
    const s = statusPenyampaianKritis({
      criticalAt: keluar,
      acknowledgedAt: '2026-08-01T08:12:00Z',
      now: '2026-08-01T09:00:00Z',
    });
    expect(s.state).toBe('ACKNOWLEDGED');
    expect(s.minutesElapsed).toBe(12);
  });

  it('yang belum diterima dalam tenggat berstatus menunggu', () => {
    const s = statusPenyampaianKritis({
      criticalAt: keluar,
      acknowledgedAt: null,
      now: '2026-08-01T08:10:00Z',
    });
    expect(s.state).toBe('PENDING');
  });

  it('yang melewati tenggat berstatus LEWAT TENGGAT dan meminta eskalasi', () => {
    /*
     * Tenggatnya pendek dengan sengaja. Nilai kritis yang menunggu satu jam
     * bukan lagi nilai kritis — ia riwayat.
     */
    const s = statusPenyampaianKritis({
      criticalAt: keluar,
      acknowledgedAt: null,
      now: '2026-08-01T09:00:00Z',
    });
    expect(s.state).toBe('OVERDUE');
    expect(s.message).toContain('Eskalasikan');
  });

  it('tenggatnya tiga puluh menit', () => {
    expect(TENGGAT_TERIMA_KRITIS_MENIT).toBe(30);
  });
});

describe('penerimaan nilai kritis', () => {
  const dasar = { acknowledgedBy: 'D1', readBackValue: '6.2', actualValue: '6.2' };

  it('penerimaan dengan bacaan ulang yang cocok diterima', () => {
    expect(bolehTerimaKritis(dasar).accepted).toBe(true);
  });

  it('tanpa nama penerima ditolak', () => {
    expect(bolehTerimaKritis({ ...dasar, acknowledgedBy: null }).accepted).toBe(false);
  });

  it('TANPA BACAAN ULANG ditolak', () => {
    /*
     * "Sudah saya sampaikan" tanpa bacaan ulang hanya mencatat bahwa telepon
     * berdering. Bacaan ulang adalah satu-satunya cara mengetahui bahwa yang
     * terdengar sama dengan yang diucapkan.
     */
    const v = bolehTerimaKritis({ ...dasar, readBackValue: null });
    expect(v.accepted).toBe(false);
    expect(v.message).toContain('Bacaan ulang');
  });

  it('bacaan ulang yang tidak cocok ditolak, dan itu justru gunanya', () => {
    const v = bolehTerimaKritis({ ...dasar, readBackValue: '2.6' });
    expect(v.accepted).toBe(false);
    expect(v.message).toContain('Ulangi penyampaian');
  });

  it('koma dan titik desimal dianggap sama', () => {
    // Penerima yang mengetik "6,2" tidak sedang keliru; ia sedang menulis
    // dengan kebiasaan Indonesia.
    expect(bolehTerimaKritis({ ...dasar, readBackValue: '6,2' }).accepted).toBe(true);
  });

  it('spasi berlebih tidak dianggap ketidakcocokan', () => {
    expect(bolehTerimaKritis({ ...dasar, readBackValue: ' 6.2 ' }).accepted).toBe(true);
  });

  it('nol berekor dari basis data tidak dianggap ketidakcocokan', () => {
    /*
     * Basis data menyimpan NUMERIC(18,6) dan mengembalikannya sebagai
     * "6.200000". Dokter yang mengulang "6,2" di telepon menyebut angka yang
     * persis sama. Membandingkan teksnya akan menolak SETIAP penerimaan nilai
     * kritis yang sah — dan penolakan yang selalu terjadi membuat orang mencari
     * jalan memutar, tepat pada langkah yang paling tidak boleh dilewati.
     *
     * Ditemukan naskah bukti H-5. Pengujian sebelumnya lolos karena
     * membandingkan "6.2" dengan "6.2".
     */
    expect(bolehTerimaKritis({ ...dasar, actualValue: '6.200000' }).accepted).toBe(true);
    expect(
      bolehTerimaKritis({ ...dasar, readBackValue: '6,2', actualValue: '6.200000' }).accepted,
    ).toBe(true);
  });

  it('angka yang benar-benar berbeda tetap ditolak meski selisihnya kecil', () => {
    expect(bolehTerimaKritis({ ...dasar, readBackValue: '6.21', actualValue: '6.200000' }).accepted)
      .toBe(false);
  });

  it('pesan galatnya menyebut angka seperti yang diucapkan, bukan seperti disimpan', () => {
    // "tidak cocok dengan hasilnya 6.200000" akan membuat penerima mengira
    // dirinya salah dengar, padahal yang berbeda hanya cara menuliskannya.
    const v = bolehTerimaKritis({ ...dasar, readBackValue: '2.6', actualValue: '6.200000' });
    expect(v.message).toContain('"6.2"');
    expect(v.message).not.toContain('6.200000');
  });

  it('hasil berupa teks tetap dibandingkan sebagai teks', () => {
    // Sebagian hasil memang bukan angka: "Positif", "Tidak terdeteksi".
    expect(
      bolehTerimaKritis({ ...dasar, readBackValue: 'Positif', actualValue: 'positif' }).accepted,
    ).toBe(true);
    expect(
      bolehTerimaKritis({ ...dasar, readBackValue: 'Negatif', actualValue: 'Positif' }).accepted,
    ).toBe(false);
  });
});

describe('amandemen hasil', () => {
  const dasar = { released: true, reason: 'Salah entri satuan, seharusnya mmol/L.', amendedBy: 'A2' };

  it('amandemen beralasan diizinkan', () => {
    expect(bolehAmandemenHasil(dasar).allowed).toBe(true);
  });

  it('alasan yang terlalu pendek ditolak', () => {
    expect(bolehAmandemenHasil({ ...dasar, reason: 'salah' }).allowed).toBe(false);
  });

  it('tanpa alasan ditolak', () => {
    expect(bolehAmandemenHasil({ ...dasar, reason: null }).allowed).toBe(false);
  });

  it('tanpa nama pengamandemen ditolak', () => {
    expect(bolehAmandemenHasil({ ...dasar, amendedBy: null }).allowed).toBe(false);
  });

  it('hasil yang belum dilepas cukup disunting biasa', () => {
    // Menuntut amandemen formal pada hasil yang belum dilihat siapa pun hanya
    // menambah langkah tanpa menambah keterlacakan.
    const v = bolehAmandemenHasil({ ...dasar, released: false });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('disunting biasa');
  });
});

describe('daftar kerja', () => {
  const baris = (over: Partial<BarisKerja> & { id: string }): BarisKerja => ({
    priority: 'ROUTINE',
    orderedAt: '2026-08-01T08:00:00Z',
    status: 'IN_PROCESS',
    ...over,
  });

  it('STAT didahulukan daripada rutin', () => {
    const hasil = urutkanKerja([baris({ id: 'a' }), baris({ id: 'b', priority: 'STAT' })]);
    expect(hasil[0].id).toBe('b');
  });

  it('nilai kritis mendahului STAT sekalipun', () => {
    /*
     * Pemeriksaan STAT yang belum dikerjakan masih menunggu; nilai kritis yang
     * belum tersampaikan sudah menjadi bahaya.
     */
    const hasil = urutkanKerja([
      baris({ id: 'stat', priority: 'STAT' }),
      baris({ id: 'kritis', isCritical: true }),
    ]);
    expect(hasil[0].id).toBe('kritis');
  });

  it('pada kegawatan yang sama, yang lebih lama menunggu didahulukan', () => {
    const hasil = urutkanKerja([
      baris({ id: 'baru', orderedAt: '2026-08-01T09:00:00Z' }),
      baris({ id: 'lama', orderedAt: '2026-08-01T07:00:00Z' }),
    ]);
    expect(hasil.map((x) => x.id)).toEqual(['lama', 'baru']);
  });

  it('daftar kosong tidak menimbulkan galat', () => {
    expect(urutkanKerja([])).toEqual([]);
  });

  it('pengurutan tidak mengubah daftar aslinya', () => {
    const asli = [baris({ id: 'a' }), baris({ id: 'b', priority: 'STAT' })];
    urutkanKerja(asli);
    expect(asli[0].id).toBe('a');
  });

  it('STAT yang lewat satu jam dinyatakan lewat tenggat', () => {
    expect(lewatTenggat(baris({ id: 'a', priority: 'STAT' }), '2026-08-01T09:30:00Z')).toBe(true);
  });

  it('rutin yang baru beberapa jam belum lewat tenggat', () => {
    expect(lewatTenggat(baris({ id: 'a' }), '2026-08-01T12:00:00Z')).toBe(false);
  });
});
