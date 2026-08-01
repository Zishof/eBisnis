/**
 * Pengujian situs, portal, kiosk, dan siaran.
 *
 * Empat hal dijaga:
 *
 * 1. **Proyeksi publik adalah daftar izin, bukan daftar larangan** — dan tidak
 *    satu pun ruas pribadi menyelinap ke dalamnya.
 * 2. **Portal warga hanya diri dan keluarga.**
 * 3. **Sesi kiosk berakhir sendiri dan menghapus jejaknya.**
 * 4. **Siaran tanpa kredensial berstatus TERHALANG**, bukan gagal dan bukan
 *    terkirim.
 */

import {
  ENDPOINT_TERLARANG_PORTAL,
  KIOSK_MENGANGGUR_DETIK,
  KIOSK_UMUR_MAKSIMAL_DETIK,
  RUAS_PUBLIK,
  RUAS_TIDAK_PUBLIK,
  TRANSISI_TAYANG,
  bolehLihatDiPortal,
  bolehPindahTayang,
  bolehSiarkan,
  bolehTandaiTerkirim,
  bolehTayang,
  hapusJejakKiosk,
  jejakBersih,
  keadaanKiosk,
  proyeksikan,
  type AksesPortal,
  type JenisPublik,
  type StatusTayang,
} from './village-site';

describe('proyeksi publik', () => {
  it('hanya mengeluarkan ruas yang ada pada daftar izin', () => {
    const baris = {
      id: 'n1',
      slug: 'kerja-bakti',
      title: 'Kerja Bakti Minggu Ini',
      body: 'Isi berita.',
      publishedAt: '2027-03-01',
      // Yang di bawah tidak ada pada daftar izin.
      authorResidentId: 'r1',
      internalNote: 'jangan tampilkan',
      reviewerUserId: 'u9',
    };
    const hasil = proyeksikan('BERITA', baris);
    expect(hasil.title).toBe('Kerja Bakti Minggu Ini');
    expect(hasil).not.toHaveProperty('authorResidentId');
    expect(hasil).not.toHaveProperty('internalNote');
    expect(hasil).not.toHaveProperty('reviewerUserId');
  });

  it('tidak mengarang ruas yang tidak ada pada barisnya', () => {
    const hasil = proyeksikan('BERITA', { title: 'Judul' });
    expect(Object.keys(hasil)).toEqual(['title']);
    expect(hasil).not.toHaveProperty('body');
  });

  it('kolom baru yang lupa didaftarkan hanya tidak tampil, bukan bocor', () => {
    // Inilah sebabnya daftar izin dipilih, bukan daftar larangan: yang lupa
    // diperbarui pada daftar larangan menjadi kebocoran.
    const hasil = proyeksikan('PROFIL', { name: 'Desa Uji', kolomBaruBesok: 'rahasia' });
    expect(hasil).toEqual({ name: 'Desa Uji' });
  });

  it('TIDAK SATU PUN ruas pribadi ada pada daftar izin mana pun', () => {
    const semua = Object.values(RUAS_PUBLIK).flat() as string[];
    for (const terlarang of RUAS_TIDAK_PUBLIK) {
      expect(semua).not.toContain(terlarang);
    }
  });

  it('daftar ruas tidak publik memuat yang paling mungkin diminta kelak', () => {
    for (const wajib of ['nik', 'birthDate', 'motherName', 'monthlyIncome', 'possessorName']) {
      expect(RUAS_TIDAK_PUBLIK as readonly string[]).toContain(wajib);
    }
  });

  it('setiap jenis publik punya daftar izinnya yang tidak kosong', () => {
    for (const jenis of Object.keys(RUAS_PUBLIK) as JenisPublik[]) {
      expect(RUAS_PUBLIK[jenis].length).toBeGreaterThan(0);
    }
  });

  it('tidak meloloskan properti bawaan JavaScript', () => {
    const jahat = Object.create({ title: 'dari prototipe' }) as Record<string, unknown>;
    const hasil = proyeksikan('BERITA', jahat);
    expect(hasil).toEqual({});
  });
});

describe('penayangan', () => {
  it('mengizinkan alur penerbitan yang biasa', () => {
    expect(bolehPindahTayang('DRAF', 'TAYANG').boleh).toBe(true);
    expect(bolehPindahTayang('DRAF', 'TERJADWAL').boleh).toBe(true);
    expect(bolehPindahTayang('TERJADWAL', 'TAYANG').boleh).toBe(true);
    expect(bolehPindahTayang('TAYANG', 'DIARSIPKAN').boleh).toBe(true);
  });

  it('mengizinkan yang diarsipkan tayang kembali', () => {
    // Berita lama kadang relevan lagi, dan menyalinnya menjadi tulisan baru
    // menghapus tanggal aslinya.
    expect(bolehPindahTayang('DIARSIPKAN', 'TAYANG').boleh).toBe(true);
  });

  it('menolak perpindahan ke status yang sama', () => {
    for (const s of Object.keys(TRANSISI_TAYANG) as StatusTayang[]) {
      expect(bolehPindahTayang(s, s).boleh).toBe(false);
    }
  });

  it('menuntut judul dan isi', () => {
    expect(bolehTayang({ judul: 'Ha', isi: 'x'.repeat(30), status: 'TAYANG' }).boleh).toBe(false);
    const h = bolehTayang({ judul: 'Kerja Bakti', isi: 'pendek', status: 'TAYANG' });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('lebih buruk daripada halaman yang belum ada');
  });

  it('menuntut tanggal pada konten terjadwal', () => {
    expect(
      bolehTayang({ judul: 'Kerja Bakti', isi: 'x'.repeat(30), status: 'TERJADWAL' }).boleh,
    ).toBe(false);
    expect(
      bolehTayang({
        judul: 'Kerja Bakti',
        isi: 'x'.repeat(30),
        status: 'TERJADWAL',
        tayangPada: '2027-03-01T00:00:00.000Z',
      }).boleh,
    ).toBe(true);
  });
});

describe('portal warga', () => {
  const akses = (over: Partial<AksesPortal> = {}): AksesPortal => ({
    residentIdSesi: 'r-diri',
    familyIdSesi: 'kk-1',
    residentIdDiminta: 'r-diri',
    familyIdDiminta: 'kk-1',
    ...over,
  });

  it('menampilkan data diri', () => {
    expect(bolehLihatDiPortal(akses()).boleh).toBe(true);
  });

  it('menampilkan anggota keluarga dalam satu kartu keluarga', () => {
    expect(bolehLihatDiPortal(akses({ residentIdDiminta: 'r-anak' })).boleh).toBe(true);
  });

  it('MENOLAK warga dari keluarga lain', () => {
    const h = bolehLihatDiPortal(akses({ residentIdDiminta: 'r-tetangga', familyIdDiminta: 'kk-9' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('satu kartu keluarga');
  });

  it('menolak bila akun belum tertaut ke data kependudukan', () => {
    const h = bolehLihatDiPortal(akses({ residentIdSesi: null, familyIdSesi: null }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('bukan oleh pemilik akun');
  });

  it('tidak meloloskan keluarga yang sama-sama kosong', () => {
    // Dua nilai null tidak boleh dianggap cocok; itu akan membuka portal bagi
    // seluruh warga yang belum punya kartu keluarga.
    const h = bolehLihatDiPortal(
      akses({ residentIdDiminta: 'r-lain', familyIdSesi: null, familyIdDiminta: null }),
    );
    expect(h.boleh).toBe(false);
  });

  it('daftar endpoint terlarang memuat pencarian warga', () => {
    for (const wajib of ['searchResidents', 'listResidents', 'getResident']) {
      expect(ENDPOINT_TERLARANG_PORTAL as readonly string[]).toContain(wajib);
    }
  });
});

describe('sesi kiosk', () => {
  const T0 = 1_800_000_000_000;

  it('masih berjalan selama disentuh', () => {
    const k = keadaanKiosk({ mulaiPada: T0, sentuhanTerakhir: T0 + 30_000 }, T0 + 60_000);
    expect(k.berakhir).toBe(false);
    expect(k.sebab).toBe('MASIH_BERJALAN');
    expect(k.sisaDetik).toBe(KIOSK_MENGANGGUR_DETIK - 30);
  });

  it('berakhir sendiri setelah menganggur', () => {
    const k = keadaanKiosk({ mulaiPada: T0, sentuhanTerakhir: T0 }, T0 + KIOSK_MENGANGGUR_DETIK * 1000);
    expect(k.berakhir).toBe(true);
    expect(k.sebab).toBe('MENGANGGUR');
  });

  it('berakhir karena umur meski terus disentuh', () => {
    // Antrean di balai desa berdiri rapat, dan layar sentuh tidak dapat
    // membedakan jari yang membaca dari siku yang menunggu.
    const sekarang = T0 + KIOSK_UMUR_MAKSIMAL_DETIK * 1000;
    const k = keadaanKiosk({ mulaiPada: T0, sentuhanTerakhir: sekarang - 1000 }, sekarang);
    expect(k.berakhir).toBe(true);
    expect(k.sebab).toBe('UMUR_MAKSIMAL');
  });

  it('menyebut sisa waktu yang terkecil dari kedua ambang', () => {
    const sekarang = T0 + (KIOSK_UMUR_MAKSIMAL_DETIK - 10) * 1000;
    const k = keadaanKiosk({ mulaiPada: T0, sentuhanTerakhir: sekarang }, sekarang);
    expect(k.sisaDetik).toBe(10);
  });

  it('sesi yang sudah ditutup tetap berakhir', () => {
    const k = keadaanKiosk({ mulaiPada: T0, sentuhanTerakhir: T0, berakhirPada: T0 + 5000 }, T0 + 6000);
    expect(k.berakhir).toBe(true);
    expect(k.sebab).toBe('DITUTUP_PENGGUNA');
  });

  it('ambangnya pendek, sesuai pemakaian bergantian', () => {
    expect(KIOSK_MENGANGGUR_DETIK).toBeLessThanOrEqual(180);
    expect(KIOSK_UMUR_MAKSIMAL_DETIK).toBeLessThanOrEqual(1800);
  });

  it('MENGHAPUS jejak layar, bukan menutupinya', () => {
    const kotor = {
      residentId: 'r-1',
      searchTerm: '3301010101010001',
      lastViewPayload: { nama: 'Sumiati', nik: '3301010101010001' },
      requestId: 'req-9',
    };
    expect(jejakBersih(kotor)).toBe(false);

    const bersih = hapusJejakKiosk(kotor);
    expect(jejakBersih(bersih)).toBe(true);
    expect(bersih.residentId).toBeNull();
    expect(bersih.searchTerm).toBeNull();
    expect(bersih.lastViewPayload).toBeNull();
    expect(bersih.requestId).toBeNull();
  });

  it('jejak yang kosong sebagian tetap dianggap kotor', () => {
    expect(jejakBersih({ residentId: null, searchTerm: 'sumiati' })).toBe(false);
    expect(jejakBersih({})).toBe(true);
  });
});

describe('siaran', () => {
  it('papan informasi selalu siap tanpa penyedia', () => {
    expect(bolehSiarkan({ kanal: 'PAPAN_INFORMASI', adaKredensial: false }).boleh).toBe(true);
  });

  it('kanal tanpa kredensial TERHALANG, bukan gagal dan bukan terkirim', () => {
    for (const kanal of ['WHATSAPP', 'SUREL', 'SMS'] as const) {
      const h = bolehSiarkan({ kanal, adaKredensial: false });
      expect(h.boleh).toBe(false);
      expect(h.alasan).toContain('TERHALANG');
      expect(h.alasan).toContain('bukan terkirim');
    }
  });

  it('kanal yang berkredensial diizinkan', () => {
    expect(bolehSiarkan({ kanal: 'WHATSAPP', adaKredensial: true }).boleh).toBe(true);
  });

  it('TIDAK dapat ditandai terkirim tanpa rujukan penyedia', () => {
    const h = bolehTandaiTerkirim(undefined);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('menyatakan sesuatu yang tidak diketahuinya');
    expect(bolehTandaiTerkirim('   ').boleh).toBe(false);
  });

  it('ditandai terkirim bila penyedianya mengembalikan rujukan', () => {
    expect(bolehTandaiTerkirim('wamid.HBgNNjI4MT').boleh).toBe(true);
  });
});
