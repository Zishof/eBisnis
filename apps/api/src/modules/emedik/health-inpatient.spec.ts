/**
 * Pengujian aturan rawat inap.
 *
 * Yang dijaga paling ketat: satu tempat tidur satu pasien, dan tempat tidur
 * yang baru ditinggalkan tidak dapat langsung ditempati orang lain.
 */

import {
  bolehPindah,
  bolehPulangkan,
  bolehTempati,
  bolehUbahStatusTempatTidur,
  lamaRawat,
  pengamatanTerlambat,
  pilihTempatTidur,
  skorPeringatanDini,
  type KebutuhanPasien,
  type TempatTidur,
} from './health-inpatient';

const bed = (over: Partial<TempatTidur> = {}): TempatTidur => ({
  id: 'B1',
  code: 'K101-1',
  roomId: 'R1',
  status: 'AVAILABLE',
  roomSex: null,
  roomCapacity: 2,
  roomOccupied: 0,
  isolationCapability: ['NONE'],
  classCode: 'KELAS_2',
  ...over,
});

const pasien = (over: Partial<KebutuhanPasien> = {}): KebutuhanPasien => ({
  sex: 'MALE',
  isolation: 'NONE',
  classCode: 'KELAS_2',
  ageYears: 40,
  ...over,
});

describe('penempatan tempat tidur', () => {
  it('tempat tidur kosong dan sesuai boleh ditempati', () => {
    expect(bolehTempati(bed(), pasien()).allowed).toBe(true);
  });

  it('SATU TEMPAT TIDUR SATU PASIEN — yang terisi ditolak', () => {
    const v = bolehTempati(bed({ status: 'OCCUPIED' }), pasien());
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('OCCUPIED');
  });

  it('tempat tidur yang BELUM DIBERSIHKAN ditolak', () => {
    /*
     * Menempatkan pasien baru di tempat tidur yang belum dibersihkan adalah
     * cara paling langsung memindahkan infeksi dari pasien yang sudah pulang
     * kepada pasien yang baru masuk — dan yang kedua tidak akan pernah tahu
     * dari mana ia mendapatkannya.
     */
    const v = bolehTempati(bed({ status: 'CLEANING' }), pasien());
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('CLEANING');
    expect(v.message).toContain('bersih');
  });

  it('tempat tidur dalam perbaikan atau diblokir ditolak', () => {
    expect(bolehTempati(bed({ status: 'MAINTENANCE' }), pasien()).allowed).toBe(false);
    expect(bolehTempati(bed({ status: 'CLOSED' }), pasien()).allowed).toBe(false);
  });

  it('pesan penolakannya menyebut kode tempat tidurnya', () => {
    // Perawat yang membaca "tempat tidur sedang ditempati" tanpa tahu yang mana
    // akan memeriksa satu per satu.
    expect(bolehTempati(bed({ status: 'OCCUPIED' }), pasien()).message).toContain('K101-1');
  });
});

describe('isolasi', () => {
  it('kamar tanpa kemampuan isolasi menolak pasien yang membutuhkannya', () => {
    const v = bolehTempati(bed(), pasien({ isolation: 'CONTACT' }));
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('ISOLATION_MISMATCH');
  });

  it('kamar dengan kemampuan yang sesuai menerimanya', () => {
    expect(
      bolehTempati(bed({ isolationCapability: ['CONTACT'] }), pasien({ isolation: 'CONTACT' }))
        .allowed,
    ).toBe(true);
  });

  it('isolasi udara menuntut kamar tanpa penghuni lain', () => {
    const v = bolehTempati(
      bed({ isolationCapability: ['AIRBORNE'], roomOccupied: 1 }),
      pasien({ isolation: 'AIRBORNE' }),
    );
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('ISOLATION_NEEDS_SINGLE_ROOM');
  });

  it('isolasi udara pada kamar kosong diterima', () => {
    expect(
      bolehTempati(
        bed({ isolationCapability: ['AIRBORNE'], roomOccupied: 0 }),
        pasien({ isolation: 'AIRBORNE' }),
      ).allowed,
    ).toBe(true);
  });

  it('isolasi diperiksa SEBELUM jenis kelamin', () => {
    // Bila keduanya bermasalah, yang disebut haruslah yang membahayakan pasien
    // lain, bukan yang membuat tidak nyaman.
    const v = bolehTempati(
      bed({ roomOccupied: 1, roomSex: 'FEMALE' }),
      pasien({ sex: 'MALE', isolation: 'CONTACT' }),
    );
    expect(v.reason).toBe('ISOLATION_MISMATCH');
  });
});

describe('jenis kelamin pada kamar bersama', () => {
  it('kamar bersama berpenghuni jenis kelamin lain ditolak', () => {
    const v = bolehTempati(bed({ roomOccupied: 1, roomSex: 'FEMALE' }), pasien({ sex: 'MALE' }));
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('SEX_MISMATCH');
  });

  it('kamar bersama berpenghuni jenis kelamin sama diterima', () => {
    expect(
      bolehTempati(bed({ roomOccupied: 1, roomSex: 'MALE' }), pasien({ sex: 'MALE' })).allowed,
    ).toBe(true);
  });

  it('kamar berkapasitas satu tidak diperiksa jenis kelaminnya', () => {
    expect(
      bolehTempati(
        bed({ roomCapacity: 1, roomOccupied: 0, roomSex: 'FEMALE' }),
        pasien({ sex: 'MALE' }),
      ).allowed,
    ).toBe(true);
  });

  it('kamar bersama yang masih kosong tidak diperiksa jenis kelaminnya', () => {
    expect(
      bolehTempati(bed({ roomOccupied: 0, roomSex: 'FEMALE' }), pasien({ sex: 'MALE' })).allowed,
    ).toBe(true);
  });

  it('pasien tanpa jenis kelamin tercatat tidak ditolak karenanya', () => {
    // Menolaknya akan menghentikan penerimaan pasien tidak sadar yang identitasnya
    // belum diketahui — tepat pasien yang paling membutuhkan tempat tidur.
    expect(
      bolehTempati(bed({ roomOccupied: 1, roomSex: 'FEMALE' }), pasien({ sex: null })).allowed,
    ).toBe(true);
  });
});

describe('pemilihan tempat tidur', () => {
  it('memilih yang kelasnya sesuai', () => {
    const hasil = pilihTempatTidur(
      [bed({ id: 'a', classCode: 'KELAS_1' }), bed({ id: 'b', classCode: 'KELAS_2' })],
      pasien({ classCode: 'KELAS_2' }),
    );
    expect(hasil.bed?.id).toBe('b');
  });

  it('pasien biasa mengisi kamar yang sudah berpenghuni', () => {
    /*
     * Menyebar pasien ke kamar-kamar kosong terdengar ramah, tetapi ia
     * menghabiskan kamar kosong yang esok hari dibutuhkan pasien isolasi — dan
     * pasien isolasi yang tidak memperoleh kamar akan ditolak masuk.
     */
    const hasil = pilihTempatTidur(
      [bed({ id: 'kosong', roomOccupied: 0 }), bed({ id: 'isi', roomOccupied: 1, roomSex: 'MALE' })],
      pasien(),
    );
    expect(hasil.bed?.id).toBe('isi');
  });

  it('pasien isolasi justru diberi kamar kosong', () => {
    const hasil = pilihTempatTidur(
      [
        bed({ id: 'isi', roomOccupied: 1, roomSex: 'MALE', isolationCapability: ['CONTACT'] }),
        bed({ id: 'kosong', roomOccupied: 0, isolationCapability: ['CONTACT'] }),
      ],
      pasien({ isolation: 'CONTACT' }),
    );
    expect(hasil.bed?.id).toBe('kosong');
  });

  it('tanpa satu pun yang layak, mengembalikan null beserta sebab tiap penolakan', () => {
    // Perawat yang melihat "tidak ada tempat tidur" tanpa tahu mengapa akan
    // menyimpulkan rumah sakitnya penuh, padahal mungkin semuanya hanya kotor.
    const hasil = pilihTempatTidur(
      [bed({ id: 'a', status: 'CLEANING' }), bed({ id: 'b', status: 'OCCUPIED' })],
      pasien(),
    );
    expect(hasil.bed).toBeNull();
    expect(hasil.rejected.map((r) => r.reason)).toEqual(['CLEANING', 'OCCUPIED']);
  });

  it('daftar kandidat kosong tidak menimbulkan galat', () => {
    expect(pilihTempatTidur([], pasien()).bed).toBeNull();
  });
});

describe('perpindahan status tempat tidur', () => {
  it('kosong boleh menjadi terisi', () => {
    expect(bolehUbahStatusTempatTidur('AVAILABLE', 'OCCUPIED').allowed).toBe(true);
  });

  it('terisi boleh menjadi menunggu pembersihan', () => {
    expect(bolehUbahStatusTempatTidur('OCCUPIED', 'CLEANING').allowed).toBe(true);
  });

  it('terisi TIDAK boleh langsung menjadi kosong', () => {
    const v = bolehUbahStatusTempatTidur('OCCUPIED', 'AVAILABLE');
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('SKIPS_CLEANING');
    expect(v.message).toContain('pembersihan');
  });

  it('setelah dibersihkan boleh menjadi kosong', () => {
    expect(bolehUbahStatusTempatTidur('CLEANING', 'AVAILABLE').allowed).toBe(true);
  });

  it('status yang tidak berubah selalu sah', () => {
    expect(bolehUbahStatusTempatTidur('OCCUPIED', 'OCCUPIED').allowed).toBe(true);
  });

  it('perpindahan yang tidak tercantum ditolak', () => {
    expect(bolehUbahStatusTempatTidur('CLEANING', 'OCCUPIED').allowed).toBe(false);
  });
});

describe('perpindahan pasien', () => {
  const dasar = {
    status: 'ADMITTED' as const,
    bedTujuan: bed({ id: 'B2' }),
    pasien: pasien(),
    bedAsalId: 'B1',
  };

  it('perpindahan wajar diizinkan', () => {
    expect(bolehPindah(dasar).allowed).toBe(true);
  });

  it('pasien yang belum dirawat tidak dapat dipindahkan', () => {
    expect(bolehPindah({ ...dasar, status: 'PENDING' }).allowed).toBe(false);
  });

  it('pindah ke tempat tidur yang sama ditolak', () => {
    const v = bolehPindah({ ...dasar, bedAsalId: 'B2' });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('SAME_BED');
  });

  it('aturan penempatan tetap berlaku pada perpindahan', () => {
    // Perpindahan bukan celah untuk melewati pemeriksaan yang sama.
    expect(bolehPindah({ ...dasar, bedTujuan: bed({ id: 'B2', status: 'CLEANING' }) }).allowed)
      .toBe(false);
  });
});

describe('pemulangan', () => {
  const dasar = {
    status: 'ADMITTED' as const,
    disposition: 'ROUTINE' as const,
    unacknowledgedCriticalCount: 0,
    hasDischargeSummary: true,
    reason: null,
    deathAt: null,
  };

  it('pemulangan wajar diizinkan', () => {
    expect(bolehPulangkan(dasar).allowed).toBe(true);
  });

  it('NILAI KRITIS yang belum diterima menahan pemulangan', () => {
    /*
     * Pasien yang pulang membawa kalium 7,2 yang belum pernah dibaca adalah
     * kejadian yang berakhir di ruang gawat darurat pada malam yang sama.
     */
    const v = bolehPulangkan({ ...dasar, unacknowledgedCriticalCount: 1 });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('CRITICAL_PENDING');
  });

  it('pada kematian, nilai kritis TIDAK lagi menahan', () => {
    // Menahannya tidak menolong siapa pun dan hanya membuat keluarga menunggu.
    expect(
      bolehPulangkan({
        ...dasar,
        disposition: 'DECEASED',
        unacknowledgedCriticalCount: 3,
        deathAt: '2026-08-01T03:00:00Z',
        hasDischargeSummary: false,
      }).allowed,
    ).toBe(true);
  });

  it('kematian tanpa waktu kematian ditolak', () => {
    expect(
      bolehPulangkan({ ...dasar, disposition: 'DECEASED', deathAt: null }).reason,
    ).toBe('DEATH_TIME_REQUIRED');
  });

  it('pulang paksa TIDAK ditolak, tetapi wajib beralasan', () => {
    /*
     * Menolaknya berarti menahan orang di rumah sakit di luar kehendaknya, dan
     * itu bukan wewenang sistem. Yang dituntut adalah alasannya tercatat.
     */
    expect(
      bolehPulangkan({ ...dasar, disposition: 'AGAINST_MEDICAL_ADVICE', reason: null }).reason,
    ).toBe('REASON_REQUIRED');
    expect(
      bolehPulangkan({
        ...dasar,
        disposition: 'AGAINST_MEDICAL_ADVICE',
        reason: 'Pasien ingin dirawat di rumah.',
      }).allowed,
    ).toBe(true);
  });

  it('tanpa ringkasan pulang ditolak', () => {
    const v = bolehPulangkan({ ...dasar, hasDischargeSummary: false });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('SUMMARY_REQUIRED');
  });

  it('pasien yang menghilang tidak dituntut ringkasan pulang', () => {
    // Ia tidak ada untuk diperiksa; menuntutnya hanya akan membuat berkasnya
    // menggantung selamanya.
    expect(
      bolehPulangkan({
        ...dasar,
        disposition: 'ABSCONDED',
        hasDischargeSummary: false,
        reason: 'Tidak ditemukan sejak ronde malam.',
      }).allowed,
    ).toBe(true);
  });

  it('perawatan yang sudah ditutup tidak dapat ditutup lagi', () => {
    expect(bolehPulangkan({ ...dasar, status: 'DISCHARGED' }).reason).toBe('ALREADY_CLOSED');
    expect(bolehPulangkan({ ...dasar, status: 'DECEASED' }).reason).toBe('ALREADY_CLOSED');
  });

  it('pasien yang belum dirawat tidak dapat dipulangkan', () => {
    expect(bolehPulangkan({ ...dasar, status: 'PENDING' }).reason).toBe('NOT_ADMITTED');
  });
});

describe('lama rawat', () => {
  it('masuk dan pulang di hari yang sama dihitung satu hari', () => {
    expect(lamaRawat('2026-08-01T08:00:00', '2026-08-01T18:00:00')).toBe(1);
  });

  it('semalam dihitung dua hari, bukan kurang dari satu', () => {
    /*
     * Pasien yang masuk pukul 23.00 dan pulang pukul 08.00 memakai tempat tidur
     * pada dua hari, dan dua hari itulah yang tidak dapat dijual kepada orang
     * lain.
     */
    expect(lamaRawat('2026-08-01T23:00:00', '2026-08-02T08:00:00')).toBe(2);
  });

  it('tiga hari dihitung tiga', () => {
    expect(lamaRawat('2026-08-01T10:00:00', '2026-08-03T10:00:00')).toBe(3);
  });

  it('tanggal yang tidak masuk akal menghasilkan nol, bukan angka negatif', () => {
    expect(lamaRawat('2026-08-05T10:00:00', '2026-08-01T10:00:00')).toBe(0);
    expect(lamaRawat('bukan tanggal', '2026-08-01T10:00:00')).toBe(0);
  });
});

describe('skor peringatan dini', () => {
  const normal = {
    respiratoryRate: 16,
    spo2: 98,
    systolicBp: 120,
    heartRate: 72,
    temperature: 36.8,
    consciousness: 'ALERT' as const,
  };

  it('tanda vital normal bernilai nol dan berisiko rendah', () => {
    const h = skorPeringatanDini(normal);
    expect(h.score).toBe(0);
    expect(h.risk).toBe('LOW');
  });

  it('pasien memburuk memperoleh skor tinggi', () => {
    const h = skorPeringatanDini({
      ...normal, respiratoryRate: 26, spo2: 90, systolicBp: 88, heartRate: 125,
    });
    expect(h.score).toBeGreaterThanOrEqual(7);
    expect(h.risk).toBe('HIGH');
  });

  it('risiko tinggi memperpendek jarak pengamatan', () => {
    // Angkanya bukan diagnosis; ia penentu seberapa sering pasien dilihat lagi.
    expect(skorPeringatanDini({ ...normal, respiratoryRate: 26, spo2: 90, systolicBp: 88 })
      .observationMinutes).toBeLessThanOrEqual(60);
    expect(skorPeringatanDini(normal).observationMinutes).toBe(240);
  });

  it('kesadaran yang menurun menambah tiga', () => {
    expect(skorPeringatanDini({ ...normal, consciousness: 'VOICE' }).score).toBe(3);
  });

  it('tanda vital yang tidak diukur DILAPORKAN, bukan dianggap normal', () => {
    /*
     * Menganggapnya normal akan menghasilkan skor rendah pada pasien yang
     * justru belum diperiksa — persis kebalikan dari maksudnya.
     */
    const h = skorPeringatanDini({ ...normal, spo2: null, systolicBp: null });
    expect(h.missing).toEqual(['spo2', 'systolicBp']);
  });

  it('skor tetap dihitung dari yang ada meski sebagian hilang', () => {
    expect(skorPeringatanDini({ ...normal, spo2: null, heartRate: 130 }).score).toBe(2);
  });

  it('suhu sangat rendah dinilai sama berbahayanya dengan demam tinggi', () => {
    expect(skorPeringatanDini({ ...normal, temperature: 34.5 }).score).toBe(3);
  });
});

describe('keterlambatan pengamatan', () => {
  it('pengamatan dalam jarak waktunya tidak terlambat', () => {
    expect(
      pengamatanTerlambat({
        lastObservationAt: '2026-08-01T08:00:00Z',
        observationMinutes: 240,
        now: '2026-08-01T10:00:00Z',
      }).overdue,
    ).toBe(false);
  });

  it('pengamatan yang lewat dilaporkan beserta keterlambatannya', () => {
    const h = pengamatanTerlambat({
      lastObservationAt: '2026-08-01T08:00:00Z',
      observationMinutes: 60,
      now: '2026-08-01T10:00:00Z',
    });
    expect(h.overdue).toBe(true);
    expect(h.minutesLate).toBe(60);
  });

  it('pasien yang BELUM PERNAH diamati dianggap terlambat', () => {
    // Tidak adanya pengamatan bukan keadaan aman; ia keadaan yang belum
    // diketahui, dan yang belum diketahui harus dilihat.
    expect(pengamatanTerlambat({
      lastObservationAt: null, observationMinutes: 240, now: '2026-08-01T10:00:00Z',
    }).overdue).toBe(true);
  });
});
