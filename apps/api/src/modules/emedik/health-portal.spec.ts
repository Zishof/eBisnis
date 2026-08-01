import {
  AKSES_DIRI,
  AKSES_WALI,
  MEDAN_TERLARANG_PUBLIK,
  bolehBatalkanJanji,
  bolehBuatJanji,
  bolehTampilHasil,
  bolehTampilKonten,
  bolehTautkanAkun,
  periksaKontenPublik,
  putuskanAkses,
  ringkasAntrean,
  saringHasil,
  type IdentitasPortal,
} from './health-portal';

const SAYA = 'pasien-saya';
const ANAK = 'pasien-anak';
const ORANG_LAIN = 'pasien-orang-lain';

const identitas = (
  proxies: { patientId: string; accessLevel: 'FULL' | 'SUMMARY_ONLY' | 'APPOINTMENT_ONLY' }[] = [],
): IdentitasPortal => ({ selfPatientId: SAYA, proxies });

describe('identitas dari token, bukan dari parameter', () => {
  it('tanpa parameter, yang dibaca adalah dirinya sendiri', () => {
    const h = putuskanAkses(identitas(), null, 'LAB_RESULT');
    expect(h.boleh).toBe(true);
    expect(h.patientId).toBe(SAYA);
    expect(h.sebagai).toBe('SELF');
  });

  it('PARAMETER PASIEN LAIN DITOLAK', () => {
    /*
     * Jalur yang menerima patientId dari kueri akan bekerja sempurna pada
     * pengujian — sebab yang mengujinya mengirim id-nya sendiri — lalu
     * membocorkan seluruh rekam medis rumah sakit pada hari pertama seseorang
     * mengganti satu angka pada bilah alamat.
     */
    const h = putuskanAkses(identitas(), ORANG_LAIN, 'LAB_RESULT');
    expect(h.boleh).toBe(false);
    expect(h.patientId).toBeNull();
  });

  it('dan penolakannya menjelaskan mengapa parameter bukan jawaban', () => {
    const h = putuskanAkses(identitas(), ORANG_LAIN, 'APPOINTMENT');
    expect(h.alasan).toContain('tidak pernah menjadi jawaban dengan sendirinya');
  });

  it('parameter yang menyebut dirinya sendiri diterima', () => {
    const h = putuskanAkses(identitas(), SAYA, 'LAB_RESULT');
    expect(h.boleh).toBe(true);
    expect(h.sebagai).toBe('SELF');
  });

  it('PATIENT ID YANG DIKEMBALIKAN SELALU BERASAL DARI IDENTITASNYA', () => {
    // Bukan dari parameternya. Pada setiap jalur yang lulus, yang dikembalikan
    // adalah id yang memang dimiliki tokennya.
    for (const diminta of [null, SAYA, ANAK, ORANG_LAIN, 'sembarang']) {
      const h = putuskanAkses(identitas([{ patientId: ANAK, accessLevel: 'FULL' }]), diminta, 'APPOINTMENT');
      if (h.boleh) {
        expect([SAYA, ANAK]).toContain(h.patientId);
      } else {
        expect(h.patientId).toBeNull();
      }
    }
  });

  it('catatan klinis tidak dibuka bahkan untuk dirinya sendiri', () => {
    const h = putuskanAkses(identitas(), null, 'CLINICAL_NOTE');
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('pukul dua pagi');
  });

  it('akses diri tidak memuat catatan klinis', () => {
    expect(AKSES_DIRI).not.toContain('CLINICAL_NOTE');
  });
});

describe('akses wali', () => {
  it('wali FULL melihat hasil laboratorium anaknya', () => {
    const h = putuskanAkses(
      identitas([{ patientId: ANAK, accessLevel: 'FULL' }]),
      ANAK,
      'LAB_RESULT',
    );
    expect(h.boleh).toBe(true);
    expect(h.sebagai).toBe('PROXY');
    expect(h.patientId).toBe(ANAK);
  });

  it('wali SUMMARY_ONLY tidak melihat hasil laboratorium', () => {
    const h = putuskanAkses(
      identitas([{ patientId: ANAK, accessLevel: 'SUMMARY_ONLY' }]),
      ANAK,
      'LAB_RESULT',
    );
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tidak berhak atas seluruhnya');
  });

  it('wali APPOINTMENT_ONLY hanya melihat janji dan antrean', () => {
    const id = identitas([{ patientId: ANAK, accessLevel: 'APPOINTMENT_ONLY' }]);
    expect(putuskanAkses(id, ANAK, 'APPOINTMENT').boleh).toBe(true);
    expect(putuskanAkses(id, ANAK, 'QUEUE').boleh).toBe(true);
    expect(putuskanAkses(id, ANAK, 'VISIT_SUMMARY').boleh).toBe(false);
  });

  it('TIDAK SATU PUN tingkat wali melihat catatan klinis', () => {
    for (const tingkat of ['FULL', 'SUMMARY_ONLY', 'APPOINTMENT_ONLY'] as const) {
      expect(AKSES_WALI[tingkat]).not.toContain('CLINICAL_NOTE');
    }
  });

  it('wali atas satu pasien tidak melihat pasien lain', () => {
    const h = putuskanAkses(
      identitas([{ patientId: ANAK, accessLevel: 'FULL' }]),
      ORANG_LAIN,
      'APPOINTMENT',
    );
    expect(h.boleh).toBe(false);
  });

  it('tingkat FULL pun lebih sempit daripada akses diri sendiri? Tidak — keduanya sama luas', () => {
    // Yang membedakan bukan luasnya melainkan tercatatnya: wali tetap dirinya
    // sendiri pada jejak akses.
    expect([...AKSES_WALI.FULL].sort()).toEqual([...AKSES_DIRI].sort());
  });
});

describe('pelepasan hasil laboratorium', () => {
  const dasar = {
    id: 'h1',
    status: 'FINAL',
    releasedAt: '2026-08-01T10:00:00Z',
    verifiedAt: '2026-08-01T09:00:00Z',
    isCritical: false,
    flag: null,
  };

  it('hasil terverifikasi dan terlepas tampil', () => {
    expect(bolehTampilHasil(dasar).tampil).toBe(true);
  });

  it('yang belum diverifikasi TIDAK tampil', () => {
    const h = bolehTampilHasil({ ...dasar, verifiedAt: null });
    expect(h.tampil).toBe(false);
    expect(h.pesanUntukPasien).toContain('sedang diperiksa petugas laboratorium');
  });

  it('HASIL KRITIS TIDAK TAMPIL SEBELUM DILEPAS DENGAN SENGAJA', () => {
    /*
     * Pasien yang membaca "kalium 6,8" tengah malam tanpa seorang pun yang
     * menjelaskan akan panik atau mengabaikannya; keduanya lebih buruk
     * daripada menunggu sampai dokternya menelepon.
     */
    const h = bolehTampilHasil({ ...dasar, isCritical: true, releasedAt: null });
    expect(h.tampil).toBe(false);
    expect(h.alasan).toContain('dokternya menelepon');
  });

  it('dan pesannya menyuruh pasien jangan menunggu bila merasa tidak enak badan', () => {
    const h = bolehTampilHasil({ ...dasar, isCritical: true, releasedAt: null });
    expect(h.pesanUntukPasien).toContain('jangan menunggu');
  });

  it('hasil kritis yang SUDAH dilepas tampil', () => {
    // Sesudah dokternya menjelaskan, menahannya tidak melindungi siapa pun.
    expect(bolehTampilHasil({ ...dasar, isCritical: true }).tampil).toBe(true);
  });

  it('hasil biasa yang belum dilepas tidak tampil', () => {
    expect(bolehTampilHasil({ ...dasar, releasedAt: null }).tampil).toBe(false);
  });

  it('yang belum diverifikasi ditolak lebih dahulu daripada yang kritis', () => {
    // Urutannya penting: hasil yang belum diverifikasi masih dapat berubah.
    const h = bolehTampilHasil({ ...dasar, verifiedAt: null, isCritical: true });
    expect(h.alasan).toContain('belum diverifikasi');
  });
});

describe('penyaringan daftar hasil', () => {
  const buat = (id: string, o: Partial<Parameters<typeof bolehTampilHasil>[0]> = {}) => ({
    id,
    status: 'FINAL',
    releasedAt: '2026-08-01T10:00:00Z',
    verifiedAt: '2026-08-01T09:00:00Z',
    isCritical: false,
    flag: null,
    ...o,
  });

  it('YANG DITAHAN TETAP MUNCUL SEBAGAI BARIS, tanpa angkanya', () => {
    /*
     * Menyembunyikan barisnya sama sekali akan membuat pasien mengira
     * pemeriksaannya belum dikerjakan, lalu datang menanyakannya — dan itulah
     * yang justru hendak dihindari.
     */
    const h = saringHasil([buat('a'), buat('b', { isCritical: true, releasedAt: null })]);
    expect(h.items).toHaveLength(2);
    expect(h.ditampilkan).toBe(1);
    expect(h.ditahan).toBe(1);
  });

  it('yang ditahan membawa pesannya sendiri', () => {
    const h = saringHasil([buat('b', { verifiedAt: null })]);
    expect(h.items[0].tampil).toBe(false);
    expect(h.items[0].pesan).toBeTruthy();
  });

  it('yang tampil tidak membawa pesan penahan', () => {
    const h = saringHasil([buat('a')]);
    expect(h.items[0].pesan).toBeNull();
  });

  it('daftar kosong tetap kosong', () => {
    const h = saringHasil([]);
    expect(h.items).toEqual([]);
    expect(h.ditampilkan).toBe(0);
  });
});

describe('janji temu', () => {
  const sekarang = '2026-08-01T08:00:00Z';

  it('janji yang belum dimulai boleh dibatalkan', () => {
    const h = bolehBatalkanJanji({ status: 'BOOKED', jadwalPada: '2026-08-02T08:00:00Z', sekarang });
    expect(h.boleh).toBe(true);
  });

  it('dan alasannya menyebut bangku kosong yang tidak diketahui', () => {
    const h = bolehBatalkanJanji({ status: 'CONFIRMED', jadwalPada: '2026-08-02T08:00:00Z', sekarang });
    expect(h.alasan).toContain('bangku kosong yang tidak diketahui');
  });

  it('yang pasiennya sudah tiba tidak dibatalkan lewat portal', () => {
    const h = bolehBatalkanJanji({ status: 'ARRIVED', jadwalPada: sekarang, sekarang });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('dicatat petugas');
  });

  it('yang sudah dibatalkan tidak dibatalkan lagi', () => {
    expect(
      bolehBatalkanJanji({ status: 'CANCELLED', jadwalPada: sekarang, sekarang }).boleh,
    ).toBe(false);
  });

  it('yang sudah selesai tidak dibatalkan', () => {
    expect(
      bolehBatalkanJanji({ status: 'COMPLETED', jadwalPada: sekarang, sekarang }).boleh,
    ).toBe(false);
  });

  it('janji pada waktu yang sudah lewat ditolak', () => {
    const h = bolehBuatJanji({
      jadwalPada: '2026-07-01T08:00:00Z',
      sekarang,
      batasHariKeDepan: 90,
    });
    expect(h.boleh).toBe(false);
  });

  it('janji dalam batas hari diterima', () => {
    expect(
      bolehBuatJanji({ jadwalPada: '2026-08-15T08:00:00Z', sekarang, batasHariKeDepan: 90 }).boleh,
    ).toBe(true);
  });

  it('janji terlalu jauh ke depan ditolak beserta alasannya', () => {
    const h = bolehBuatJanji({
      jadwalPada: '2027-08-01T08:00:00Z',
      sekarang,
      batasHariKeDepan: 90,
    });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('dibatalkan sepihak');
  });

  it('waktu yang tidak terbaca ditolak, bukan melempar', () => {
    expect(() =>
      bolehBuatJanji({ jadwalPada: 'besok pagi', sekarang, batasHariKeDepan: 90 }),
    ).not.toThrow();
    expect(
      bolehBuatJanji({ jadwalPada: 'besok pagi', sekarang, batasHariKeDepan: 90 }).boleh,
    ).toBe(false);
  });
});

describe('konten publik', () => {
  it('konten bersih dinyatakan bersih', () => {
    expect(periksaKontenPublik({ title: 'Poliklinik Anak', body: 'Buka setiap hari.' }).bersih)
      .toBe(true);
  });

  it('SATU NAMA PASIEN YANG LOLOS ADALAH PELANGGARAN', () => {
    const h = periksaKontenPublik({ title: 'Kisah', patientName: 'Tono' });
    expect(h.bersih).toBe(false);
    expect(h.alasan).toContain('mesin pencari sudah menyalinnya');
  });

  it('seluruh medan terlarang dikenali', () => {
    for (const medan of MEDAN_TERLARANG_PUBLIK) {
      expect(periksaKontenPublik({ [medan]: 'x' }).bersih).toBe(false);
    }
  });

  it('menyebutkan medan mana yang ditemukan', () => {
    const h = periksaKontenPublik({ nik: '32', diagnosis: 'A15' });
    expect(h.ditemukan.sort()).toEqual(['diagnosis', 'nik']);
  });

  it('konten kosong bersih', () => {
    expect(periksaKontenPublik({}).bersih).toBe(true);
  });
});

describe('tayang konten', () => {
  const sekarang = '2026-08-01T08:00:00Z';

  it('yang terbit dan dalam masanya tampil', () => {
    expect(
      bolehTampilKonten({
        status: 'PUBLISHED',
        publishedFrom: '2026-07-01T00:00:00Z',
        publishedUntil: null,
        sekarang,
      }).tampil,
    ).toBe(true);
  });

  it('draf tidak tampil', () => {
    expect(
      bolehTampilKonten({ status: 'DRAFT', publishedFrom: null, publishedUntil: null, sekarang })
        .tampil,
    ).toBe(false);
  });

  it('YANG DITARIK TIDAK TAMPIL', () => {
    // Penarikan adalah kemampuan yang harus ada sebelum dibutuhkan: yang
    // membutuhkannya sedang tergesa.
    expect(
      bolehTampilKonten({
        status: 'UNPUBLISHED',
        publishedFrom: null,
        publishedUntil: null,
        sekarang,
      }).tampil,
    ).toBe(false);
  });

  it('yang belum memasuki masanya tidak tampil', () => {
    expect(
      bolehTampilKonten({
        status: 'PUBLISHED',
        publishedFrom: '2026-09-01T00:00:00Z',
        publishedUntil: null,
        sekarang,
      }).tampil,
    ).toBe(false);
  });

  it('yang masanya lewat tidak tampil', () => {
    expect(
      bolehTampilKonten({
        status: 'PUBLISHED',
        publishedFrom: null,
        publishedUntil: '2026-07-01T00:00:00Z',
        sekarang,
      }).tampil,
    ).toBe(false);
  });
});

describe('ringkasan antrean', () => {
  it('sisa antrean dihitung', () => {
    const h = ringkasAntrean({
      nomorSaya: 25,
      nomorDipanggil: 18,
      jumlahMenunggu: 7,
      rerataMenitPerPasien: 6,
    });
    expect(h.sisaAntrean).toBe(7);
    expect(h.perkiraanMenit).toBe(42);
  });

  it('nomor yang sudah lewat tidak menghasilkan sisa negatif', () => {
    const h = ringkasAntrean({
      nomorSaya: 10,
      nomorDipanggil: 18,
      jumlahMenunggu: 0,
      rerataMenitPerPasien: 6,
    });
    expect(h.sisaAntrean).toBe(0);
  });

  it('tanpa nomor, dikatakan belum punya antrean', () => {
    const h = ringkasAntrean({
      nomorSaya: null,
      nomorDipanggil: 18,
      jumlahMenunggu: 5,
      rerataMenitPerPasien: 6,
    });
    expect(h.sisaAntrean).toBeNull();
    expect(h.keterangan).toContain('belum memiliki nomor antrean');
  });

  it('PERKIRAAN DISEBUT PERKIRAAN', () => {
    const h = ringkasAntrean({
      nomorSaya: 25,
      nomorDipanggil: 18,
      jumlahMenunggu: 7,
      rerataMenitPerPasien: 6,
    });
    expect(h.keterangan).toContain('bukan kesalahan siapa pun');
  });

  it('tanpa rerata, perkiraan waktunya kosong — bukan ditebak', () => {
    const h = ringkasAntrean({
      nomorSaya: 25,
      nomorDipanggil: 18,
      jumlahMenunggu: 7,
      rerataMenitPerPasien: null,
    });
    expect(h.perkiraanMenit).toBeNull();
  });

  it('ringkasannya tidak memuat nama siapa pun', () => {
    // Layar antrean di ruang tunggu memang menampilkan nama; portal yang
    // dibuka dari rumah adalah hal yang berbeda.
    const h = ringkasAntrean({
      nomorSaya: 25,
      nomorDipanggil: 18,
      jumlahMenunggu: 7,
      rerataMenitPerPasien: 6,
    });
    expect(Object.keys(h)).not.toContain('nama');
    expect(JSON.stringify(h)).not.toMatch(/name|nama[A-Z]/);
  });
});

describe('penautan akun portal', () => {
  const dasar = {
    akunSudahTertaut: false,
    pasienSudahPunyaAkun: false,
    identitasTerverifikasi: true,
  };

  it('akun baru dapat ditautkan', () => {
    expect(bolehTautkanAkun(dasar).boleh).toBe(true);
  });

  it('IDENTITAS YANG BELUM DIVERIFIKASI DITOLAK', () => {
    const h = bolehTautkanAkun({ ...dasar, identitasTerverifikasi: false });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('mengetahui tanggal lahir seseorang');
  });

  it('SATU AKUN, SATU PASIEN', () => {
    const h = bolehTautkanAkun({ ...dasar, akunSudahTertaut: true });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('siapa yang membukanya, tidak terjawab');
  });

  it('dan wali diselesaikan lewat perwalian, bukan akun ganda', () => {
    expect(bolehTautkanAkun({ ...dasar, akunSudahTertaut: true }).alasan).toContain(
      'bukan lewat akun ganda',
    );
  });

  it('pasien yang sudah punya akun tidak ditautkan dua kali', () => {
    expect(bolehTautkanAkun({ ...dasar, pasienSudahPunyaAkun: true }).boleh).toBe(false);
  });
});
