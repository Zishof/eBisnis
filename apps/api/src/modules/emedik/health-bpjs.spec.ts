import {
  ADAPTER_BPJS,
  MASA_BERLAKU_KEPESERTAAN_JAM,
  MEDAN_TERLARANG_PER_ITEM,
  METODE_BAYAR,
  adapterDikenal,
  bolehPanggil,
  hitungSelisihKelas,
  kebijakanBerlaku,
  kelompokkanInacbg,
  kepesertaanMasihBerlaku,
  periksaItemKlaim,
  periksaNomorSep,
  ringkasKesiapan,
  statusPenjaminan,
  tujuanDataPerItem,
} from './health-bpjs';

describe('matriks adapter', () => {
  it('tujuh adapter tercatat', () => {
    expect(ADAPTER_BPJS).toHaveLength(7);
  });

  it('setiap adapter menyebut penghalangnya', () => {
    for (const a of ADAPTER_BPJS) {
      expect(a.penghalang.length).toBeGreaterThan(15);
    }
  });

  it('kodenya unik', () => {
    const kode = ADAPTER_BPJS.map((a) => a.kode);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('adapter yang tidak tercatat tidak dikenal', () => {
    expect(adapterDikenal('VCLAIM')).toBe(true);
    expect(adapterDikenal('BPJS_APA_SAJA')).toBe(false);
  });
});

describe('gerbang adapter', () => {
  const dasar = {
    adapter: 'VCLAIM',
    status: 'VERIFIED' as const,
    adaAkun: true,
    adaRujukanKredensial: true,
  };

  it('adapter terverifikasi boleh dipanggil', () => {
    expect(bolehPanggil(dasar).boleh).toBe(true);
  });

  it('YANG BELUM VERIFIED MENOLAK BERJALAN', () => {
    for (const status of ['BLOCKED', 'CONFIGURED', 'SANDBOX_TESTED'] as const) {
      const h = bolehPanggil({ ...dasar, status });
      expect(h.boleh).toBe(false);
      expect(h.alasan).toContain('MENOLAK');
    }
  });

  it('PENOLAKANNYA MENYEBUT APA YANG MASIH DAPAT DIKERJAKAN', () => {
    /*
     * Hampir seluruh siklus klaim di dalam rumah sakit tidak menuntut adapter
     * mana pun. Penolakan yang tidak menyebutkannya akan dibaca sebagai
     * "seluruh klaim berhenti", dan itu keliru.
     */
    const h = bolehPanggil({ ...dasar, status: 'BLOCKED' });
    expect(h.yangMasihBisa).toContain('verifikasi internal');
    expect(h.yangMasihBisa).toContain('dua ujungnya');
  });

  it('penolakan EKLAIM menyebut grouper secara khusus', () => {
    const h = bolehPanggil({ ...dasar, adapter: 'EKLAIM', status: 'BLOCKED' });
    expect(h.alasan).toContain('tarif karangan');
    expect(h.yangMasihBisa).toContain('tidak menuntut grouper');
  });

  it('tanpa akun ditolak', () => {
    expect(bolehPanggil({ ...dasar, adaAkun: false }).boleh).toBe(false);
  });

  it('tanpa rujukan kredensial ditolak', () => {
    const h = bolehPanggil({ ...dasar, adaRujukanKredensial: false });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('rujukan ke brankas');
  });

  it('adapter yang tidak dikenal ditolak', () => {
    expect(bolehPanggil({ ...dasar, adapter: 'ENTAH' }).boleh).toBe(false);
  });
});

describe('aturan paket kasus', () => {
  it('baris item tanpa nilai penggantian sah', () => {
    const h = periksaItemKlaim({ itemCode: 'OBAT-1', quantity: 2, actualCost: 2_000_000 });
    expect(h.sah).toBe(true);
  });

  it('NILAI PENGGANTIAN PER ITEM DITOLAK', () => {
    /*
     * Pasien yang menerima obat senilai dua juta pada paket senilai lima juta
     * tidak membuat BPJS mengganti dua juta untuk obat itu — yang diganti
     * adalah paketnya.
     */
    const h = periksaItemKlaim({ itemCode: 'OBAT-1', bpjsReimbursement: 2_000_000 });
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('PAKET KASUS');
  });

  it('dan alasannya menyebut jasa dokter', () => {
    // Inilah akibat yang sesungguhnya: angka yang tidak pernah ada dijumlahkan
    // laporan, dan jumlah itu dipakai membagi jasa.
    const h = periksaItemKlaim({ inacbgItemAmount: 1 });
    expect(h.alasan).toContain('jasa dokter');
  });

  it('seluruh medan terlarang dikenali', () => {
    for (const medan of MEDAN_TERLARANG_PER_ITEM) {
      expect(periksaItemKlaim({ [medan]: 1 }).sah).toBe(false);
    }
  });

  it('menyebutkan medan mana yang ditemukan', () => {
    const h = periksaItemKlaim({ bpjsPaidAmount: 1, inacbgAmount: 2 });
    expect(h.ditemukan.sort()).toEqual(['bpjsPaidAmount', 'inacbgAmount']);
  });

  it('baris kosong sah', () => {
    expect(periksaItemKlaim({}).sah).toBe(true);
  });

  it('data per item punya tujuh tujuan yang sah', () => {
    const h = tujuanDataPerItem();
    expect(h.bolehUntuk).toHaveLength(7);
    expect(h.penggantianResmiAda).toHaveLength(7);
  });

  it('dan penggantian resminya berada pada tingkat paket', () => {
    expect(tujuanDataPerItem().penggantianResmiAda).toContain('Claim Package');
    expect(tujuanDataPerItem().keterangan).toContain('bukan pada baris item');
  });
});

describe('masa berlaku kepesertaan', () => {
  const sekarang = '2026-08-01T12:00:00Z';

  it('yang baru diperiksa berlaku', () => {
    const h = kepesertaanMasihBerlaku('2026-08-01T09:00:00Z', sekarang);
    expect(h.berlaku).toBe(true);
    expect(h.umurJam).toBe(3);
  });

  it('yang melampaui masanya tidak berlaku', () => {
    const h = kepesertaanMasihBerlaku('2026-07-28T12:00:00Z', sekarang);
    expect(h.berlaku).toBe(false);
    expect(h.keterangan).toContain('berhenti bekerja');
  });

  it('YANG BELUM PERNAH DIPERIKSA BUKAN BERARTI SAH', () => {
    const h = kepesertaanMasihBerlaku(null, sekarang);
    expect(h.berlaku).toBe(false);
    expect(h.keterangan).toContain('belum diketahui');
  });

  it('masa bawaannya tidak nol', () => {
    expect(MASA_BERLAKU_KEPESERTAAN_JAM).toBeGreaterThan(0);
  });

  it('masanya dapat diatur', () => {
    expect(kepesertaanMasihBerlaku('2026-08-01T09:00:00Z', sekarang, 1).berlaku).toBe(false);
  });
});

describe('status penjaminan', () => {
  it('kepesertaan aktif ditagihkan ke BPJS', () => {
    const h = statusPenjaminan({ kepesertaanBerlaku: true, statusPeserta: 'ACTIVE' });
    expect(h.dijamin).toBe(true);
    expect(h.tagihanKe).toBe('BPJS');
  });

  it('PASIEN SELALU BOLEH DILAYANI', () => {
    /*
     * Yang diputuskan di sini bukan pelayanannya melainkan penjaminannya.
     * Menolak melayani karena kepesertaan tidak aktif adalah keputusan yang
     * bukan milik perangkat lunak.
     */
    for (const s of ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'UNKNOWN'] as const) {
      for (const berlaku of [true, false]) {
        expect(statusPenjaminan({ kepesertaanBerlaku: berlaku, statusPeserta: s }).bolehDilayani)
          .toBe(true);
      }
    }
  });

  it('yang belum diperiksa ditahan tagihannya, bukan pelayanannya', () => {
    const h = statusPenjaminan({ kepesertaanBerlaku: false, statusPeserta: 'UNKNOWN' });
    expect(h.tagihanKe).toBe('PENDING');
    expect(h.keterangan).toContain('berhak ditolong');
  });

  it('kepesertaan tidak aktif ditagihkan ke pasien', () => {
    const h = statusPenjaminan({ kepesertaanBerlaku: true, statusPeserta: 'INACTIVE' });
    expect(h.dijamin).toBe(false);
    expect(h.tagihanKe).toBe('PATIENT');
  });

  it('dan penolakannya menyebut keputusan yang bukan milik perangkat lunak', () => {
    const h = statusPenjaminan({ kepesertaanBerlaku: true, statusPeserta: 'SUSPENDED' });
    expect(h.keterangan).toContain('bukan milik perangkat lunak');
  });
});

describe('nomor SEP', () => {
  it('nomor sungguhan diterima apa adanya', () => {
    /*
     * Formatnya milik BPJS dan kami tidak memiliki spesifikasinya. Menuliskan
     * pola yang ditebak dari beberapa contoh akan menolak nomor sah dari
     * fasilitas yang kodenya berbeda — dan penolakan itu datang pada saat
     * pasien sedang menunggu.
     */
    expect(periksaNomorSep('0301R0010126V000123').sah).toBe(true);
  });

  it('bentuk lain yang tidak kami kenali pun diterima', () => {
    // Yang berwenang menyatakan ia sah adalah BPJS, bukan berkas ini.
    expect(periksaNomorSep('1234A5678901234567890').sah).toBe(true);
  });

  it('dan jawabannya menyatakan siapa yang berwenang', () => {
    expect(periksaNomorSep('0301R0010126V000123').alasan).toContain(
      'bukan perangkat lunak ini',
    );
  });

  it('NOMOR YANG JELAS DIBUAT SENDIRI DITOLAK', () => {
    for (const n of ['SEP-001', 'TEST', 'dummy', '-', '000000']) {
      expect(periksaNomorSep(n).sah).toBe(false);
    }
  });

  it('penolakannya menyebut sesudah pelayanannya diberikan', () => {
    expect(periksaNomorSep('SEP-001').alasan).toContain('sesudah pelayanannya diberikan');
  });

  it('dan menegaskan bahwa yang diperiksa hanya bentuk yang jelas buatan sendiri', () => {
    expect(periksaNomorSep('SEP-001').alasan).toContain('menebaknya akan menolak nomor sah');
  });

  it('kosong ditolak dengan menyebut kami tidak berwenang menerbitkannya', () => {
    const h = periksaNomorSep(null);
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('tidak punya wewenang menerbitkannya');
  });

  it('nomor yang terlalu pendek ditolak', () => {
    expect(periksaNomorSep('0301R001').sah).toBe(false);
  });
});

describe('kebijakan berversi', () => {
  const kebijakan = [
    { kode: 'LAMA', effectiveFrom: '2024-01-01', effectiveTo: '2025-12-31' },
    { kode: 'BARU', effectiveFrom: '2026-01-01', effectiveTo: null },
  ];

  it('kebijakan yang berlaku pada tanggalnya ditemukan', () => {
    expect(kebijakanBerlaku(kebijakan, '2026-08-01')?.kode).toBe('BARU');
    expect(kebijakanBerlaku(kebijakan, '2025-06-01')?.kode).toBe('LAMA');
  });

  it('tanggal di antara dua masa tidak menemukan apa pun', () => {
    expect(kebijakanBerlaku(kebijakan, '2026-01-01')?.kode).toBe('BARU');
    expect(kebijakanBerlaku([], '2026-08-01')).toBeNull();
  });

  it('yang terbaru menang bila bertumpang tindih', () => {
    const tumpang = [
      { kode: 'A', effectiveFrom: '2026-01-01', effectiveTo: null },
      { kode: 'B', effectiveFrom: '2026-06-01', effectiveTo: null },
    ];
    expect(kebijakanBerlaku(tumpang, '2026-08-01')?.kode).toBe('B');
  });

  it('lima metode pembayaran didukung berdampingan', () => {
    expect(METODE_BAYAR).toHaveLength(5);
    expect(METODE_BAYAR.find((m) => m.kode === 'CAPITATION')?.catatan).toContain(
      'BUKAN per kunjungan',
    );
  });
});

describe('selisih kelas', () => {
  const dasar = {
    kelasHak: 3,
    kelasDitempati: 1,
    tarifKelasHak: 3_000_000,
    tarifKelasDitempati: 5_000_000,
    atasPermintaanPasien: true,
  };

  it('naik kelas atas permintaan pasien ditagihkan kepada pasien', () => {
    const h = hitungSelisihKelas(dasar);
    expect(h.naikKelas).toBe(true);
    expect(h.selisih).toBe(2_000_000);
    expect(h.ditagihkanKe).toBe('PATIENT');
  });

  it('NAIK KELAS TIDAK MENAHAN KLAIM', () => {
    /*
     * Pelajaran H-9C: menahannya akan membuat verifikasi internal dimatikan
     * oleh orang pertama yang klaimnya tertahan karena hal yang memang sah.
     */
    expect(hitungSelisihKelas(dasar).menahanKlaim).toBe(false);
    expect(hitungSelisihKelas({ ...dasar, atasPermintaanPasien: false }).menahanKlaim).toBe(false);
  });

  it('naik kelas BUKAN atas permintaan pasien ditanggung fasilitas', () => {
    const h = hitungSelisihKelas({ ...dasar, atasPermintaanPasien: false });
    expect(h.ditagihkanKe).toBe('FACILITY');
    expect(h.keterangan).toContain('tidak boleh ditagihkan kepada pasien maupun BPJS');
  });

  it('kelas yang sesuai hak tidak berselisih', () => {
    const h = hitungSelisihKelas({ ...dasar, kelasDitempati: 3 });
    expect(h.naikKelas).toBe(false);
    expect(h.selisih).toBe(0);
  });

  it('turun kelas tidak menghasilkan selisih negatif', () => {
    const h = hitungSelisihKelas({ ...dasar, kelasHak: 1, kelasDitempati: 3 });
    expect(h.selisih).toBe(0);
  });
});

describe('grouper INA-CBG sengaja tidak ada', () => {
  it('PENGELOMPOKAN MELEMPAR, DAN ITU DISENGAJA', () => {
    expect(() => kelompokkanInacbg()).toThrow('GROUPER_NOT_AVAILABLE');
  });

  it('dan menjelaskan mengapa tarif karangan berbahaya', () => {
    expect(() => kelompokkanInacbg()).toThrow(/membagi jasa medis/);
  });
});

describe('ringkasan kesiapan', () => {
  it('tanpa satu pun terverifikasi, dikatakan apa adanya', () => {
    const h = ringkasKesiapan([]);
    expect(h.terverifikasi).toBe(0);
    expect(h.total).toBe(ADAPTER_BPJS.length);
  });

  it('DAN DITEGASKAN BAHWA ITU TIDAK MENGHENTIKAN APA PUN YANG PENTING', () => {
    expect(ringkasKesiapan([]).keterangan).toContain('tidak menghentikan apa pun yang penting');
  });

  it('yang terverifikasi dihitung', () => {
    expect(ringkasKesiapan([{ adapter: 'VCLAIM', status: 'VERIFIED' }]).terverifikasi).toBe(1);
  });
});
