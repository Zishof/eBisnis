import {
  SUMBER_DATA,
  TERMINOLOGI,
  bolehKlaimResmi,
  bolehPakaiTanpaKfa,
  bolehTerapkan,
  nilaiTanpaKatalog,
  periksaBerkasImpor,
  periksaPemetaanKfa,
  ringkasKatalog,
  terminologiDikenal,
} from './health-kfa';

describe('sumber data', () => {
  it('empat sumber tercatat', () => {
    expect(SUMBER_DATA).toHaveLength(4);
  });

  it('HANYA SATU yang boleh diklaim resmi', () => {
    const resmi = SUMBER_DATA.filter((s) => s.bolehDiklaimResmi).map((s) => s.kode);
    expect(resmi).toEqual(['OFFICIAL_REFERENCE']);
  });
});

describe('klaim rujukan resmi', () => {
  const dasar = {
    sumber: 'OFFICIAL_REFERENCE' as const,
    terbitanRef: 'KFA Kemenkes edisi 2026-07',
    terbitanTanggal: '2026-07-01',
  };

  it('rujukan resmi berterbitan diterima', () => {
    expect(bolehKlaimResmi(dasar).boleh).toBe(true);
  });

  it('DATA CONTOH TIDAK BOLEH DIKLAIM RESMI', () => {
    /*
     * Harga sintetis yang tampak resmi akan dipakai seseorang menagih pasien —
     * dan ketika ketahuan, tidak ada cara membedakan mana yang contoh dan mana
     * yang sungguhan.
     */
    const h = bolehKlaimResmi({ ...dasar, sumber: 'SYNTHETIC_DEMO' });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('menagih pasien');
  });

  it('data milik fasilitas pun tidak', () => {
    expect(bolehKlaimResmi({ ...dasar, sumber: 'FACILITY_IMPORT' }).boleh).toBe(false);
  });

  it('pemetaan lokal pun tidak', () => {
    expect(bolehKlaimResmi({ ...dasar, sumber: 'LOCAL_MAPPING' }).boleh).toBe(false);
  });

  it('RUJUKAN RESMI TANPA NAMA TERBITAN DITOLAK', () => {
    const h = bolehKlaimResmi({ ...dasar, terbitanRef: null });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('yang tidak dapat diperiksa akan dipercaya');
  });

  it('tanpa tanggal terbitan pun ditolak', () => {
    expect(bolehKlaimResmi({ ...dasar, terbitanTanggal: null }).boleh).toBe(false);
  });

  it('sumber yang tidak dikenal ditolak', () => {
    expect(bolehKlaimResmi({ ...dasar, sumber: 'ENTAH' as never }).boleh).toBe(false);
  });
});

describe('terminologi', () => {
  it('enam terminologi tercatat', () => {
    expect(TERMINOLOGI).toHaveLength(6);
  });

  it('setiap terminologi menyebut penghalangnya', () => {
    for (const t of TERMINOLOGI) {
      expect(t.penghalang.length).toBeGreaterThan(15);
    }
  });

  it('yang tidak tercatat tidak dikenal', () => {
    expect(terminologiDikenal('KFA')).toBe(true);
    expect(terminologiDikenal('KATALOG_SENDIRI')).toBe(false);
  });
});

describe('penilaian tanpa katalog', () => {
  it('MENJAWAB "BELUM DAPAT DINILAI", BUKAN "TIDAK ADA MASALAH"', () => {
    /*
     * "Tidak ada interaksi obat" pada sistem yang belum punya katalog
     * interaksinya adalah kebohongan yang berbeda dari "belum dapat dinilai",
     * dan yang membacanya bertindak berbeda pula.
     */
    const h = nilaiTanpaKatalog('KFA');
    expect(h.dapatDinilai).toBe(false);
    expect(h.jawaban).toBe('NOT_ASSESSABLE');
    expect(h.keterangan).toContain('bukan "tidak ada masalah"');
  });

  it('dan menyebut penghalang terminologinya', () => {
    expect(nilaiTanpaKatalog('LOINC').keterangan).toContain('berlisensi');
  });

  it('terminologi yang tidak dikenal pun dijawab, bukan melempar', () => {
    expect(() => nilaiTanpaKatalog('ENTAH')).not.toThrow();
    expect(nilaiTanpaKatalog('ENTAH').jawaban).toBe('NOT_ASSESSABLE');
  });
});

describe('obat tanpa pemetaan KFA', () => {
  it('TETAP DAPAT DIPAKAI DI DALAM RUMAH SAKIT', () => {
    /*
     * Menahan seluruh farmasi sampai pemetaannya selesai akan menghentikan
     * pelayanan demi kerapian data — dan pelayanan yang berhenti demi kerapian
     * data akan dijalankan di luar sistem.
     */
    const h = bolehPakaiTanpaKfa();
    expect(h.bolehDipakai).toBe(true);
  });

  it('tetapi tidak dapat dikirim ke SATUSEHAT', () => {
    expect(bolehPakaiTanpaKfa().bolehDikirimSatusehat).toBe(false);
  });

  it('dan alasannya menyebut dijalankan di luar sistem', () => {
    expect(bolehPakaiTanpaKfa().keterangan).toContain('di luar sistem');
  });
});

describe('pemetaan KFA', () => {
  const dasar = {
    jenis: 'PRODUCT' as const,
    kodeKfa: '93000123',
    produkLokalId: 'p1',
    dipetakanOleh: 'apoteker',
    caraPemetaan: 'MANUAL' as const,
  };

  it('pemetaan lengkap sah', () => {
    expect(periksaPemetaanKfa(dasar).sah).toBe(true);
  });

  it('PEMETAAN BERDASARKAN KEMIRIPAN NAMA DITOLAK', () => {
    /*
     * "Amlodipine 5 mg" dan "Amlodipine 10 mg" berbeda satu karakter dan
     * berbeda dua kali lipat dosisnya.
     */
    const h = periksaPemetaanKfa({ ...dasar, caraPemetaan: 'NAME_SIMILARITY' });
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('dua kali lipat dosisnya');
  });

  it('dan penolakannya menyebut akan dikirim sebagai obat yang bukan diberikan', () => {
    expect(periksaPemetaanKfa({ ...dasar, caraPemetaan: 'NAME_SIMILARITY' }).alasan).toContain(
      'bukan diberikan',
    );
  });

  it('pemetaan tanpa nama pemetanya ditolak', () => {
    const h = periksaPemetaanKfa({ ...dasar, dipetakanOleh: null });
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('dipercaya selamanya');
  });

  it('tanpa kode KFA ditolak', () => {
    expect(periksaPemetaanKfa({ ...dasar, kodeKfa: null }).sah).toBe(false);
  });

  it('tanpa produk lokal ditolak', () => {
    expect(periksaPemetaanKfa({ ...dasar, produkLokalId: null }).sah).toBe(false);
  });

  it('tanpa cara pemetaan ditolak', () => {
    expect(periksaPemetaanKfa({ ...dasar, caraPemetaan: null }).sah).toBe(false);
  });

  it('pemetaan hasil impor sah', () => {
    expect(periksaPemetaanKfa({ ...dasar, caraPemetaan: 'IMPORTED' }).sah).toBe(true);
  });
});

describe('berkas impor', () => {
  const dasar = {
    namaBerkas: 'kfa-2026-07.csv',
    sidikJari: 'sha256:abc',
    sumber: 'OFFICIAL_REFERENCE' as const,
    terbitanRef: 'KFA Kemenkes edisi 2026-07',
    terbitanTanggal: '2026-07-01',
  };

  it('berkas lengkap sah', () => {
    expect(periksaBerkasImpor(dasar).sah).toBe(true);
  });

  it('BERKAS TANPA SIDIK JARI DITOLAK', () => {
    const h = periksaBerkasImpor({ ...dasar, sidikJari: null });
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('hanya dapat dijawab dengan dugaan');
  });

  it('berkas resmi tanpa terbitan ditolak', () => {
    expect(periksaBerkasImpor({ ...dasar, terbitanRef: null }).sah).toBe(false);
  });

  it('berkas contoh tidak menuntut terbitan', () => {
    // Ia memang tidak resmi, dan tidak berpura-pura resmi.
    expect(
      periksaBerkasImpor({
        ...dasar,
        sumber: 'SYNTHETIC_DEMO',
        terbitanRef: null,
        terbitanTanggal: null,
      }).sah,
    ).toBe(true);
  });
});

describe('penerapan impor', () => {
  const dasar = {
    status: 'VALIDATED' as const,
    jumlahBaris: 2000,
    jumlahGalat: 0,
    divalidasiOleh: 'apoteker',
    diterapkanOleh: 'kepala-farmasi',
  };

  it('impor yang lengkap boleh diterapkan', () => {
    expect(bolehTerapkan(dasar).boleh).toBe(true);
  });

  it('IMPOR YANG BELUM DIVALIDASI TIDAK DITERAPKAN', () => {
    const h = bolehTerapkan({ ...dasar, status: 'RECEIVED' });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('belum dibaca siapa pun');
  });

  it('yang ditolak pun tidak', () => {
    expect(bolehTerapkan({ ...dasar, status: 'REJECTED' }).boleh).toBe(false);
  });

  it('IMPOR SEBAGIAN DITOLAK', () => {
    /*
     * Impor sebagian akan menghasilkan katalog yang separuhnya baru dan
     * separuhnya lama, dan tidak ada yang tahu baris mana yang mana.
     */
    const h = bolehTerapkan({ ...dasar, jumlahGalat: 3 });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('baris mana yang mana');
  });

  it('yang memvalidasi tidak menerapkannya sendiri', () => {
    const h = bolehTerapkan({ ...dasar, diterapkanOleh: 'apoteker' });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('membaca ulang keyakinannya');
  });

  it('validasi tanpa nama ditolak', () => {
    expect(bolehTerapkan({ ...dasar, divalidasiOleh: null }).boleh).toBe(false);
  });
});

describe('ringkasan katalog', () => {
  it('katalog kosong dikatakan apa adanya', () => {
    const h = ringkasKatalog([]);
    expect(h.terisi).toBe(0);
    expect(h.kosong).toHaveLength(TERMINOLOGI.length);
  });

  it('DAN DITEGASKAN OBAT TETAP DAPAT DIPAKAI', () => {
    // Sistem yang berkata "katalog siap" ketika isinya kosong akan membuat
    // orang menyimpulkan obat yang dicarinya memang tidak ada.
    expect(ringkasKatalog([]).keterangan).toContain('TETAP dapat dipakai');
  });

  it('yang terisi dihitung', () => {
    const h = ringkasKatalog([{ kode: 'KFA', jumlahBaris: 5000 }]);
    expect(h.terisi).toBe(1);
    expect(h.kosong).not.toContain('KFA');
  });

  it('yang berisi nol baris dihitung kosong', () => {
    expect(ringkasKatalog([{ kode: 'KFA', jumlahBaris: 0 }]).kosong).toContain('KFA');
  });

  it('totalnya dihitung dari daftarnya', () => {
    expect(ringkasKatalog([]).total).toBe(TERMINOLOGI.length);
  });
});
