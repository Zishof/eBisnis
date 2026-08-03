import {
  LAPORAN,
  PENGHALANG,
  PROFIL_CONTOH,
  bolehBersihkan,
  laporanDikenal,
  periksaBenih,
  periksaHasilPembersihan,
  periksaJumlahBaris,
  periksaPenghalang,
  periksaRentang,
  seluruhnyaAgregat,
} from './health-sample';

describe('profil data contoh', () => {
  it('tiga profil tercatat', () => {
    expect(Object.keys(PROFIL_CONTOH)).toHaveLength(3);
  });

  it('setiap profil berada dalam batas 50 sampai 100', () => {
    for (const p of Object.values(PROFIL_CONTOH)) {
      expect(p.min).toBeGreaterThanOrEqual(50);
      expect(p.max).toBeLessThanOrEqual(100);
      expect(p.max).toBeGreaterThanOrEqual(p.min);
    }
  });

  it('jumlah dalam batas diterima', () => {
    expect(periksaJumlahBaris('STANDARD', 60).sah).toBe(true);
  });

  it('TERLALU SEDIKIT DITOLAK', () => {
    const h = periksaJumlahBaris('STANDARD', 10);
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('sistemnya yang rusak');
  });

  it('TERLALU BANYAK PUN DITOLAK', () => {
    // Data contoh yang terlalu banyak membuat demo lambat, dan demo yang
    // lambat membuat orang menyimpulkan sistemnya lambat.
    const h = periksaJumlahBaris('STANDARD', 500);
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('sistemnya lambat');
  });

  it('profil yang tidak dikenal ditolak', () => {
    expect(periksaJumlahBaris('BESAR' as never, 60).sah).toBe(false);
  });
});

describe('benih penyemaian', () => {
  it('benih tercatat diterima', () => {
    expect(periksaBenih('demo-2026').sah).toBe(true);
  });

  it('BENIH KOSONG DITOLAK', () => {
    const h = periksaBenih(null);
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('mendemonstrasikan apa pun dua kali');
  });

  it('benih terlalu pendek ditolak', () => {
    expect(periksaBenih('a').sah).toBe(false);
  });
});

describe('pembersihan data contoh', () => {
  const diizinkan = ['patient', 'health_encounter', 'lab_result'] as const;
  const hitungan = [
    { tabel: 'patient', contoh: 60, sungguhan: 1200 },
    { tabel: 'health_encounter', contoh: 80, sungguhan: 5400 },
    { tabel: 'lab_result', contoh: 70, sungguhan: 9800 },
  ];

  it('pembersihan atas tabel yang diizinkan berjalan', () => {
    const h = bolehBersihkan({
      tabelDiminta: ['patient'],
      tabelDiizinkan: diizinkan,
      hitungan,
      batchTercatat: true,
    });
    expect(h.boleh).toBe(true);
    expect(h.barisContoh).toBe(60);
  });

  it('CARANYA SELALU MENYEMBUNYIKAN, BUKAN MENGHAPUS', () => {
    /*
     * Penghapusan keras menghilangkan pula jejak audit yang menunjuknya, dan
     * ketika seseorang bertanya "dari mana angka ini datang" enam bulan
     * kemudian, yang tersisa hanyalah baris audit yang menunjuk ketiadaan.
     */
    const h = bolehBersihkan({
      tabelDiminta: ['patient'],
      tabelDiizinkan: diizinkan,
      hitungan,
      batchTercatat: true,
    });
    expect(h.caraPembersihan).toBe('HIDE');
    expect(h.alasan).toContain('DISEMBUNYIKAN, bukan dihapus');
  });

  it('BARIS SUNGGUHAN YANG DISENTUH SELALU NOL', () => {
    const h = bolehBersihkan({
      tabelDiminta: [...diizinkan],
      tabelDiizinkan: diizinkan,
      hitungan,
      batchTercatat: true,
    });
    expect(h.barisSungguhanDisentuh).toBe(0);
  });

  it('TABEL DI LUAR DAFTAR IZIN DITOLAK', () => {
    /*
     * Tabel yang tidak tercatat berarti belum ditelaah apakah penanda
     * contohnya benar-benar dipasang di sana.
     */
    const h = bolehBersihkan({
      tabelDiminta: ['patient', 'audit_log'],
      tabelDiizinkan: diizinkan,
      hitungan,
      batchTercatat: true,
    });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('audit_log');
    expect(h.alasan).toContain('belum ditelaah');
  });

  it('PEMBERSIHAN TANPA KUMPULAN TERCATAT DITOLAK', () => {
    // "Hapus semua yang tampak seperti contoh" — dan yang tampak seperti
    // contoh bagi program tidak sama dengan yang memang contoh.
    const h = bolehBersihkan({
      tabelDiminta: ['patient'],
      tabelDiizinkan: diizinkan,
      hitungan,
      batchTercatat: false,
    });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tidak sama dengan yang memang contoh');
  });

  it('daftar kosong tidak menyentuh apa pun', () => {
    const h = bolehBersihkan({
      tabelDiminta: [],
      tabelDiizinkan: diizinkan,
      hitungan,
      batchTercatat: true,
    });
    expect(h.tabelDisentuh).toEqual([]);
    expect(h.barisContoh).toBe(0);
  });
});

describe('pemeriksaan hasil pembersihan', () => {
  const sebelum = [
    { tabel: 'patient', contoh: 60, sungguhan: 1200 },
    { tabel: 'health_encounter', contoh: 80, sungguhan: 5400 },
  ];

  it('baris sungguhan yang tidak berubah dinyatakan aman', () => {
    const sesudah = [
      { tabel: 'patient', contoh: 0, sungguhan: 1200 },
      { tabel: 'health_encounter', contoh: 0, sungguhan: 5400 },
    ];
    const h = periksaHasilPembersihan(sebelum, sesudah);
    expect(h.aman).toBe(true);
    expect(h.pelanggaran).toEqual([]);
  });

  it('SATU BARIS SUNGGUHAN YANG HILANG SUDAH PELANGGARAN', () => {
    /*
     * Bukan "kurang lebih", bukan "tidak jauh berbeda" — sama persis, pada
     * setiap tabel.
     */
    const sesudah = [
      { tabel: 'patient', contoh: 0, sungguhan: 1199 },
      { tabel: 'health_encounter', contoh: 0, sungguhan: 5400 },
    ];
    const h = periksaHasilPembersihan(sebelum, sesudah);
    expect(h.aman).toBe(false);
    expect(h.pelanggaran[0]).toContain('1200 menjadi 1199');
  });

  it('dan alasannya menyebut siapa yang menemukannya', () => {
    const sesudah = [
      { tabel: 'patient', contoh: 0, sungguhan: 0 },
      { tabel: 'health_encounter', contoh: 0, sungguhan: 5400 },
    ];
    expect(periksaHasilPembersihan(sebelum, sesudah).alasan).toContain(
      'perawat yang mencari catatan pasiennya',
    );
  });

  it('baris sungguhan yang BERTAMBAH pun dilaporkan', () => {
    // Bertambah sesudah pembersihan berarti ada yang salah menandai — dan
    // salah menandai ke arah mana pun sama buruknya.
    const sesudah = [
      { tabel: 'patient', contoh: 0, sungguhan: 1260 },
      { tabel: 'health_encounter', contoh: 0, sungguhan: 5400 },
    ];
    expect(periksaHasilPembersihan(sebelum, sesudah).aman).toBe(false);
  });

  it('tabel yang hilang dari hitungan sesudahnya dilaporkan', () => {
    const h = periksaHasilPembersihan(sebelum, [
      { tabel: 'patient', contoh: 0, sungguhan: 1200 },
    ]);
    expect(h.aman).toBe(false);
    expect(h.pelanggaran[0]).toContain('tidak terhitung sesudahnya');
  });
});

describe('laporan', () => {
  it('delapan laporan tercatat', () => {
    expect(LAPORAN).toHaveLength(8);
  });

  it('SELURUHNYA AGREGAT', () => {
    /*
     * Uji ini gagal ketika seseorang menambahkan laporan tingkat pasien — dan
     * kegagalannya memaksa orang itu memikirkan siapa yang boleh membukanya.
     */
    expect(seluruhnyaAgregat()).toBe(true);
  });

  it('kodenya unik', () => {
    const kode = LAPORAN.map((l) => l.kode);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('yang tidak tercatat tidak dikenal', () => {
    expect(laporanDikenal('VISIT_VOLUME')).toBe(true);
    expect(laporanDikenal('LAPORAN_SENDIRI')).toBe(false);
  });
});

describe('rentang laporan', () => {
  it('rentang dalam batas diterima', () => {
    expect(
      periksaRentang({ dari: '2026-07-01', sampai: '2026-07-31', batasHari: 366 }).sah,
    ).toBe(true);
  });

  it('RENTANG TANPA BATAS DITOLAK', () => {
    const h = periksaRentang({ dari: '2010-01-01', sampai: '2026-08-01', batasHari: 366 });
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('jam sibuk');
  });

  it('tanggal akhir yang mendahului mulai ditolak', () => {
    expect(
      periksaRentang({ dari: '2026-08-01', sampai: '2026-07-01', batasHari: 366 }).sah,
    ).toBe(false);
  });

  it('tanggal yang tidak terbaca ditolak, bukan melempar', () => {
    expect(() =>
      periksaRentang({ dari: 'kemarin', sampai: 'besok', batasHari: 366 }),
    ).not.toThrow();
    expect(periksaRentang({ dari: 'kemarin', sampai: 'besok', batasHari: 366 }).sah).toBe(false);
  });
});

describe('penghalang yang dicatat', () => {
  it('tiga penghalang tercatat', () => {
    expect(PENGHALANG).toHaveLength(3);
  });

  it('SETIAP PENGHALANG MENYEBUT JALAN KELUARNYA', () => {
    /*
     * Sistem yang diam tentang apa yang tidak dapat dilakukannya akan
     * ditanyakan berulang kali oleh orang yang berbeda — dan salah satu di
     * antaranya akan membangunnya sendiri dengan cara yang tidak dapat
     * dipelihara siapa pun.
     */
    for (const p of PENGHALANG) {
      expect(p.jalanKeluar.length).toBeGreaterThan(40);
    }
  });

  it('setiap penghalang menyebut sebab dan akibatnya', () => {
    for (const p of PENGHALANG) {
      expect(p.sebab.length).toBeGreaterThan(20);
      expect(p.akibat.length).toBeGreaterThan(15);
    }
  });

  it('penghalang Pusat Bantuan dapat dicari', () => {
    const h = periksaPenghalang('Pusat Bantuan');
    expect(h).not.toBeNull();
    expect(h?.sebab).toContain('V8-1');
  });

  it('penghalang ekspor dapat dicari', () => {
    expect(periksaPenghalang('Ekspor')?.akibat).toContain('di layar');
  });

  it('jalan keluar cetak PDF JUJUR bahwa ia tidak setara', () => {
    // Cetakan peramban tidak berkop dan tidak bernomor — dan itu sebabnya
    // penghalangnya dicatat alih-alih dianggap selesai.
    expect(periksaPenghalang('Cetak PDF')?.jalanKeluar).toContain('bukan pengganti yang setara');
  });

  it('kemampuan yang tidak terhalang menghasilkan null', () => {
    expect(periksaPenghalang('Pendaftaran pasien')).toBeNull();
  });
});
