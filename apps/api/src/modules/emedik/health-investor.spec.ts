import {
  AMBANG_KOHORT_BAWAAN,
  MEDAN_INVESTOR,
  MEDAN_TERLARANG,
  bagianInvestor,
  bolehBayarDistribusi,
  bolehLihatProyeksi,
  bolehTampilkanTotal,
  hitungWaterfall,
  periksaAmbang,
  periksaMedanTerlarang,
  ringkasPenyamaran,
  samarkan,
  saringMedan,
} from './health-investor';

describe('medan yang boleh dilihat investor', () => {
  it('daftarnya TERTUTUP — yang tidak ada di dalamnya dibuang', () => {
    /*
     * Ditulis sebagai daftar izin, bukan daftar larangan. Daftar larangan
     * menuntut seseorang mengingat untuk menambahkannya setiap kali ada medan
     * baru, dan medan baru ditambahkan oleh orang yang sedang memikirkan hal
     * lain.
     */
    const { data, dibuang } = saringMedan({
      grossRevenue: 1000,
      patientName: 'Sari',
      diagnosis: 'A15.0',
    });
    expect(Object.keys(data)).toEqual(['grossRevenue']);
    expect(dibuang.sort()).toEqual(['diagnosis', 'patientName']);
  });

  it('yang dibuang DILAPORKAN, tidak dibuang diam-diam', () => {
    // Penyaring yang membuang diam-diam tidak dapat diuji: naskah bukti tidak
    // dapat membedakan medan yang dibuang dari medan yang tidak pernah ada.
    const { dibuang } = saringMedan({ nik: '32...' });
    expect(dibuang).toEqual(['nik']);
  });

  it('proyeksi yang seluruhnya sah tidak kehilangan apa pun', () => {
    const isi = Object.fromEntries(MEDAN_INVESTOR.map((m) => [m, 1]));
    const { data, dibuang } = saringMedan(isi);
    expect(dibuang).toEqual([]);
    expect(Object.keys(data)).toHaveLength(MEDAN_INVESTOR.length);
  });

  it('proyeksi kosong tetap kosong', () => {
    expect(saringMedan({})).toEqual({ data: {}, dibuang: [] });
  });

  it('tidak satu pun medan izin berupa medan pasien', () => {
    const terlarang = new Set<string>(MEDAN_TERLARANG);
    expect(MEDAN_INVESTOR.filter((m) => terlarang.has(m))).toEqual([]);
  });
});

describe('medan terlarang', () => {
  it('proyeksi bersih dinyatakan bersih', () => {
    const h = periksaMedanTerlarang({ grossRevenue: 1, netRevenue: 2 });
    expect(h.bersih).toBe(true);
    expect(h.ditemukan).toEqual([]);
  });

  it('medan pasien BUKAN sekadar medan berlebih', () => {
    /*
     * Dipisahkan dari saringMedan dengan sengaja: yang pertama membersihkan,
     * yang kedua berteriak. patientName yang lolos ke proyeksi investor
     * pertanda ada jalur yang salah arah.
     */
    const h = periksaMedanTerlarang({ grossRevenue: 1, patientName: 'Sari' });
    expect(h.bersih).toBe(false);
    expect(h.pesan).toContain('jalur yang salah arah');
  });

  it('menyebutkan medan mana yang ditemukan', () => {
    const h = periksaMedanTerlarang({ nik: 'x', labResult: 'y' });
    expect(h.ditemukan.sort()).toEqual(['labResult', 'nik']);
  });

  it('menyebut investor sebagai pihak luar tanpa hubungan perawatan', () => {
    expect(periksaMedanTerlarang({ diagnosis: 'x' }).pesan).toContain('hubungan perawatan');
  });
});

describe('ambang kohort', () => {
  it('bawaannya tidak nol', () => {
    expect(AMBANG_KOHORT_BAWAAN).toBeGreaterThan(0);
  });

  it('AMBANG NOL DITOLAK', () => {
    const h = periksaAmbang(0);
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('Poliklinik Kulit');
  });

  it('ambang negatif ditolak', () => {
    expect(periksaAmbang(-3).sah).toBe(false);
  });

  it('ambang pecahan ditolak', () => {
    expect(periksaAmbang(2.5).sah).toBe(false);
  });

  it('ambang satu diterima, sekalipun longgar', () => {
    // Longgar bukan urusan fungsi ini; yang dilarangnya adalah ketiadaan
    // penyamaran sama sekali.
    expect(periksaAmbang(1).sah).toBe(true);
  });
});

describe('penyamaran sel', () => {
  const ambang = 5;

  it('sel di bawah ambang disembunyikan', () => {
    const h = samarkan(
      [
        { kunci: 'Poli Kulit', kohort: 2, nilai: 1_000_000 },
        { kunci: 'Poli Umum', kohort: 40, nilai: 9_000_000 },
        { kunci: 'Poli Gigi', kohort: 30, nilai: 7_000_000 },
      ],
      ambang,
    );
    expect(h[0].tersamar).toBe(true);
    expect(h[0].alasan).toBe('BELOW_THRESHOLD');
  });

  it('YANG DISEMBUNYIKAN TIDAK MENJADI NOL', () => {
    /*
     * Menampilkan nol akan membuat investor menyimpulkan tidak ada pasiennya,
     * dan itu kebohongan yang berbeda dari kerahasiaan.
     */
    const h = samarkan(
      [
        { kunci: 'a', kohort: 1, nilai: 500 },
        { kunci: 'b', kohort: 50, nilai: 900 },
        { kunci: 'c', kohort: 60, nilai: 800 },
      ],
      ambang,
    );
    expect(h[0].nilai).toBeNull();
    expect(h[0].nilai).not.toBe(0);
    expect(h[0].keterangan).toContain('BUKAN nol');
  });

  it('kohortnya ikut disembunyikan', () => {
    // Menyembunyikan nilainya tetapi menampilkan "n = 2" tidak menyembunyikan
    // apa pun yang penting: yang berbahaya justru penyebutnya.
    const h = samarkan(
      [
        { kunci: 'a', kohort: 2, nilai: 5 },
        { kunci: 'b', kohort: 30, nilai: 9 },
        { kunci: 'c', kohort: 40, nilai: 8 },
      ],
      ambang,
    );
    expect(h[0].kohort).toBeNull();
  });

  it('sel di atas ambang ditampilkan apa adanya', () => {
    const h = samarkan(
      [
        { kunci: 'a', kohort: 30, nilai: 100 },
        { kunci: 'b', kohort: 40, nilai: 200 },
      ],
      ambang,
    );
    expect(h.every((s) => !s.tersamar)).toBe(true);
    expect(h[0].nilai).toBe(100);
  });

  it('SATU SEL TERSAMAR MENYERET SEL TERKECIL IKUT TERSAMAR', () => {
    /*
     * Penyamaran pelengkap. Bila hanya satu sel yang tersamar sedangkan
     * totalnya diketahui, sel itu dapat dihitung kembali dengan pengurangan —
     * dan penyamarannya menjadi hiasan.
     */
    const h = samarkan(
      [
        { kunci: 'a', kohort: 2, nilai: 100 },
        { kunci: 'b', kohort: 10, nilai: 200 },
        { kunci: 'c', kohort: 90, nilai: 300 },
      ],
      ambang,
    );
    expect(h.filter((s) => s.tersamar)).toHaveLength(2);
    expect(h[1].alasan).toBe('COMPLEMENT_DISCLOSURE');
  });

  it('dan yang diseret adalah yang TERKECIL, bukan sembarang', () => {
    const h = samarkan(
      [
        { kunci: 'kecil', kohort: 1, nilai: 10 },
        { kunci: 'besar', kohort: 900, nilai: 20 },
        { kunci: 'sedang', kohort: 8, nilai: 30 },
      ],
      ambang,
    );
    expect(h.find((s) => s.kunci === 'sedang')?.tersamar).toBe(true);
    expect(h.find((s) => s.kunci === 'besar')?.tersamar).toBe(false);
  });

  it('dua sel tersamar tidak menyeret sel ketiga', () => {
    const h = samarkan(
      [
        { kunci: 'a', kohort: 1, nilai: 1 },
        { kunci: 'b', kohort: 2, nilai: 2 },
        { kunci: 'c', kohort: 90, nilai: 3 },
      ],
      ambang,
    );
    expect(h.filter((s) => s.tersamar)).toHaveLength(2);
    expect(h[2].tersamar).toBe(false);
  });

  it('seluruh sel tersamar tidak menimbulkan galat', () => {
    const h = samarkan(
      [
        { kunci: 'a', kohort: 1, nilai: 1 },
        { kunci: 'b', kohort: 2, nilai: 2 },
      ],
      ambang,
    );
    expect(h.every((s) => s.tersamar)).toBe(true);
  });

  it('satu sel tersamar tanpa sel terbuka tidak menyeret apa pun', () => {
    const h = samarkan([{ kunci: 'a', kohort: 1, nilai: 1 }], ambang);
    expect(h).toHaveLength(1);
    expect(h[0].alasan).toBe('BELOW_THRESHOLD');
  });

  it('daftar kosong tetap kosong', () => {
    expect(samarkan([], ambang)).toEqual([]);
  });

  it('ambang yang tidak sah menimbulkan galat, bukan penyamaran tanpa ambang', () => {
    expect(() => samarkan([{ kunci: 'a', kohort: 1, nilai: 1 }], 0)).toThrow();
  });

  it('sel tepat pada ambang ditampilkan', () => {
    const h = samarkan(
      [
        { kunci: 'a', kohort: 5, nilai: 1 },
        { kunci: 'b', kohort: 6, nilai: 2 },
      ],
      5,
    );
    expect(h.every((s) => !s.tersamar)).toBe(true);
  });
});

describe('total keseluruhan', () => {
  it('total dengan kohort besar boleh ditampilkan', () => {
    expect(bolehTampilkanTotal(500, 5)).toBe(true);
  });

  it('total dengan kohort kecil pun disamarkan', () => {
    expect(bolehTampilkanTotal(3, 5)).toBe(false);
  });
});

describe('waterfall', () => {
  const lapisan = [
    { jenis: 'OPERATING_COST' as const, urutan: 1, jumlah: 400 },
    { jenis: 'DEBT_SERVICE' as const, urutan: 2, jumlah: 200 },
    { jenis: 'PROFIT_SHARE' as const, urutan: 3, persen: 50 },
  ];

  it('lapisan dipenuhi menurut urutannya', () => {
    const h = hitungWaterfall(1000, lapisan);
    expect(h.lapisan[0].dibayar).toBe(400);
    expect(h.lapisan[1].dibayar).toBe(200);
    expect(h.lapisan[2].dibayar).toBe(200);
    expect(h.sisaAkhir).toBe(200);
  });

  it('urutannya dipatuhi sekalipun daftarnya tidak berurut', () => {
    const acak = [lapisan[2], lapisan[0], lapisan[1]];
    const h = hitungWaterfall(1000, acak);
    expect(h.lapisan.map((l) => l.jenis)).toEqual([
      'OPERATING_COST',
      'DEBT_SERVICE',
      'PROFIT_SHARE',
    ]);
  });

  it('DANA YANG KURANG TIDAK DIBAGI RATA', () => {
    /*
     * Waterfall yang membagi rata ketika dananya kurang bukan waterfall.
     * Lapisan yang lebih dahulu dipenuhi lebih dahulu.
     */
    const h = hitungWaterfall(300, lapisan);
    expect(h.lapisan[0].dibayar).toBe(300);
    expect(h.lapisan[1].dibayar).toBe(0);
    expect(h.lapisan[2].dibayar).toBe(0);
  });

  it('kekurangannya dicatat, bukan menjadi pembayaran negatif', () => {
    const h = hitungWaterfall(300, lapisan);
    expect(h.lapisan[1].kurang).toBe(200);
    expect(h.lapisan[1].dibayar).toBeGreaterThanOrEqual(0);
    expect(h.adaKekurangan).toBe(true);
  });

  it('dan kekurangannya menjelaskan arti urutan', () => {
    const h = hitungWaterfall(300, lapisan);
    expect(h.lapisan[1].keterangan).toContain('arti urutan');
  });

  it('PERSENTASE DIHITUNG TERHADAP SISA, BUKAN NILAI AWAL', () => {
    /*
     * Menghitungnya terhadap nilai awal akan membuat jumlah seluruh lapisan
     * melampaui dana yang ada, dan kelebihannya baru ketahuan ketika uangnya
     * hendak dipindahkan.
     */
    const h = hitungWaterfall(1000, [
      { jenis: 'OPERATING_COST', urutan: 1, jumlah: 600 },
      { jenis: 'PROFIT_SHARE', urutan: 2, persen: 50 },
    ]);
    expect(h.lapisan[1].dibayar).toBe(200);
  });

  it('jumlah seluruh pembayaran tidak pernah melampaui dananya', () => {
    for (const dana of [0, 1, 250, 600, 1000, 5000]) {
      const h = hitungWaterfall(dana, lapisan);
      const total = h.lapisan.reduce((s, l) => s + l.dibayar, 0);
      expect(total).toBeLessThanOrEqual(dana);
      expect(total + h.sisaAkhir).toBeCloseTo(dana, 2);
    }
  });

  it('dana nol menghasilkan seluruh lapisan kurang', () => {
    const h = hitungWaterfall(0, lapisan);
    expect(h.lapisan[0].kurang).toBe(400);
    expect(h.sisaAkhir).toBe(0);
  });

  it('dana negatif ditolak', () => {
    expect(() => hitungWaterfall(-100, lapisan)).toThrow();
  });

  it('tanpa lapisan, seluruh dana tersisa', () => {
    const h = hitungWaterfall(1000, []);
    expect(h.sisaAkhir).toBe(1000);
    expect(h.adaKekurangan).toBe(false);
  });
});

describe('bagian investor', () => {
  it('TANPA KONTRAK AKTIF, BAGIANNYA NOL', () => {
    const h = bagianInvestor({ adaKontrakAktif: false, persenKontrak: 30, batasMaksimum: null });
    expect(h.persen).toBe(0);
    expect(h.alasan).toContain('Bukan galat');
  });

  it('dengan kontrak aktif, mengikuti kontraknya', () => {
    const h = bagianInvestor({ adaKontrakAktif: true, persenKontrak: 15, batasMaksimum: 30 });
    expect(h.persen).toBe(15);
    expect(h.dibatasi).toBe(false);
  });

  it('yang melampaui batas kontrak DIBATASI', () => {
    const h = bagianInvestor({ adaKontrakAktif: true, persenKontrak: 40, batasMaksimum: 25 });
    expect(h.persen).toBe(25);
    expect(h.dibatasi).toBe(true);
    expect(h.alasan).toContain('tidak pernah membacanya');
  });

  it('kontrak aktif tanpa persentase bernilai nol', () => {
    const h = bagianInvestor({ adaKontrakAktif: true, persenKontrak: null, batasMaksimum: 30 });
    expect(h.persen).toBe(0);
  });
});

describe('pembayaran distribusi', () => {
  const dasar = {
    status: 'APPROVED' as const,
    dihitungOleh: 'akuntan',
    disetujuiOleh: 'direktur',
    dibayarOleh: 'kasir',
    adaKontrakAktif: true,
  };

  it('yang lengkap boleh dibayar', () => {
    expect(bolehBayarDistribusi(dasar).boleh).toBe(true);
  });

  it('TANPA KONTRAK AKTIF tidak boleh dibayar', () => {
    const h = bolehBayarDistribusi({ ...dasar, adaKontrakAktif: false });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tidak dapat dijelaskan');
  });

  it('yang belum disetujui tidak boleh dibayar', () => {
    const h = bolehBayarDistribusi({ ...dasar, status: 'CALCULATED' });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('Tidak ada pembayaran otomatis');
  });

  it('YANG MENGHITUNG TIDAK MENYETUJUINYA SENDIRI', () => {
    const h = bolehBayarDistribusi({ ...dasar, disetujuiOleh: 'akuntan' });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('ia yang membuatnya');
  });

  it('yang menyetujui tidak membayarkannya sendiri', () => {
    const h = bolehBayarDistribusi({ ...dasar, dibayarOleh: 'direktur' });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('jeda terakhir');
  });

  it('persetujuan tanpa nama ditolak', () => {
    expect(bolehBayarDistribusi({ ...dasar, disetujuiOleh: null }).boleh).toBe(false);
  });

  it('yang dibatalkan tidak boleh dibayar', () => {
    expect(bolehBayarDistribusi({ ...dasar, status: 'CANCELLED' }).boleh).toBe(false);
  });

  it('yang sudah dibayar tidak dibayar lagi', () => {
    expect(bolehBayarDistribusi({ ...dasar, status: 'PAID' }).boleh).toBe(false);
  });
});

describe('akun investor contoh', () => {
  it('akun contoh TIDAK melihat proyeksi nyata', () => {
    const h = bolehLihatProyeksi({ akunContoh: true, proyeksiSintetis: false });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('penyebutnya selalu kecil');
  });

  it('akun contoh melihat proyeksi sintetis', () => {
    expect(bolehLihatProyeksi({ akunContoh: true, proyeksiSintetis: true }).boleh).toBe(true);
  });

  it('akun sungguhan melihat proyeksi nyata', () => {
    expect(bolehLihatProyeksi({ akunContoh: false, proyeksiSintetis: false }).boleh).toBe(true);
  });
});

describe('ringkasan penyamaran', () => {
  it('DASBOR MENGATAKAN BAHWA IA MENYEMBUNYIKAN', () => {
    /*
     * Dasbor yang menyembunyikan tanpa mengatakan bahwa ia menyembunyikan akan
     * dipercaya sebagai gambaran lengkap, dan kesimpulan yang ditarik darinya
     * keliru dengan cara yang tidak disadari siapa pun.
     */
    const sel = samarkan(
      [
        { kunci: 'a', kohort: 1, nilai: 1 },
        { kunci: 'b', kohort: 3, nilai: 2 },
        { kunci: 'c', kohort: 90, nilai: 3 },
      ],
      5,
    );
    const h = ringkasPenyamaran(sel);
    expect(h.tersamar).toBe(2);
    expect(h.ditampilkan).toBe(1);
    expect(h.keterangan).toContain('gambaran lengkap');
  });

  it('tanpa penyamaran, dikatakan tidak ada yang disembunyikan', () => {
    const sel = samarkan(
      [
        { kunci: 'a', kohort: 50, nilai: 1 },
        { kunci: 'b', kohort: 60, nilai: 2 },
      ],
      5,
    );
    expect(ringkasPenyamaran(sel).keterangan).toContain('Tidak ada sel yang disembunyikan');
  });

  it('menghitung totalnya benar', () => {
    const sel = samarkan(
      [
        { kunci: 'a', kohort: 50, nilai: 1 },
        { kunci: 'b', kohort: 60, nilai: 2 },
      ],
      5,
    );
    const h = ringkasPenyamaran(sel);
    expect(h.total).toBe(2);
    expect(h.tersamar + h.ditampilkan).toBe(h.total);
  });
});
