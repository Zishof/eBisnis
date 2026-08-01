import {
  FAKTOR_RISIKO,
  PENAHAN_PENGGANTI,
  bolehKembaliMelayani,
  jatuhTempoPemeliharaan,
  keputusanWajib,
  langkahPenahanan,
  nilaiRisikoSiber,
  penerimaanMasihBerlaku,
  periksaCatatanKalibrasi,
  periksaPemeliharaan,
  periksaPenerimaanRisiko,
  tingkatRisiko,
  urutkanPerhatian,
  wajibLaporKeselamatan,
  wajibTautInsiden,
} from './health-device-maintenance';

describe('pemeliharaan', () => {
  describe('jatuh tempo', () => {
    it('dihitung dari pekerjaan terakhir', () => {
      expect(
        jatuhTempoPemeliharaan({ intervalHari: 180, terakhirDikerjakan: '2026-01-01' }, '2026-08-01'),
      ).toBe('2026-06-30');
    });

    it('alat yang belum pernah dipelihara jatuh tempo SEKARANG', () => {
      /*
       * Bukan satu selang dari sekarang. Menghitungnya dari tanggal
       * pendaftaran akan memberi alat bekas yang baru masuk registri satu
       * tahun tenggang yang tidak pernah diberikan siapa pun.
       */
      expect(
        jatuhTempoPemeliharaan({ intervalHari: 365, terakhirDikerjakan: null }, '2026-08-01'),
      ).toBe('2026-08-01');
    });
  });

  describe('status', () => {
    it('yang belum jatuh tempo tidak terlambat', () => {
      const h = periksaPemeliharaan(
        { intervalHari: 180, terakhirDikerjakan: '2026-07-01' },
        '2026-08-01',
      );
      expect(h.terlambat).toBe(false);
      expect(h.terlambatHari).toBe(0);
    });

    it('yang lewat dihitung keterlambatannya', () => {
      const h = periksaPemeliharaan(
        { intervalHari: 30, terakhirDikerjakan: '2026-06-01' },
        '2026-08-01',
      );
      expect(h.terlambat).toBe(true);
      expect(h.terlambatHari).toBe(31);
    });

    it('KETERLAMBATAN TIDAK PERNAH MENGHENTIKAN LAYANAN', () => {
      const h = periksaPemeliharaan(
        { intervalHari: 30, terakhirDikerjakan: '2020-01-01' },
        '2026-08-01',
      );
      expect(h.terlambat).toBe(true);
      expect(h.menghentikanLayanan).toBe(false);
    });

    it('dan alasannya disebutkan', () => {
      const h = periksaPemeliharaan(
        { intervalHari: 30, terakhirDikerjakan: '2020-01-01' },
        '2026-08-01',
      );
      expect(h.keterangan).toContain('dipilih kalender');
    });
  });

  describe('kembali melayani', () => {
    it('pekerjaan yang masih terbuka menahan', () => {
      const h = bolehKembaliMelayani({ status: 'OPEN', jenis: 'PREVENTIVE' });
      expect(h.boleh).toBe(false);
      expect(h.alasan).toContain('dilupakan seseorang');
    });

    it('pekerjaan yang sedang dikerjakan pun menahan', () => {
      expect(bolehKembaliMelayani({ status: 'IN_PROGRESS', jenis: 'CORRECTIVE' }).boleh).toBe(false);
    });

    it('pekerjaan yang selesai melepas', () => {
      expect(bolehKembaliMelayani({ status: 'COMPLETED', jenis: 'PREVENTIVE' }).boleh).toBe(true);
    });

    it('pekerjaan yang dibatalkan pun melepas', () => {
      expect(bolehKembaliMelayani({ status: 'CANCELLED', jenis: 'PREVENTIVE' }).boleh).toBe(true);
    });

    it('UJI KESELAMATAN LISTRIK YANG GAGAL MENAHAN, sekalipun pekerjaannya selesai', () => {
      const h = bolehKembaliMelayani({
        status: 'COMPLETED',
        jenis: 'SAFETY_INSPECTION',
        hasilInspeksi: 'FAIL',
      });
      expect(h.boleh).toBe(false);
    });

    it('dan perbedaannya dari kalibrasi dijelaskan', () => {
      const h = bolehKembaliMelayani({
        status: 'COMPLETED',
        jenis: 'SAFETY_INSPECTION',
        hasilInspeksi: 'FAIL',
      });
      expect(h.alasan).toContain('menyetrum');
    });

    it('uji keselamatan yang lulus dengan catatan tetap melepas', () => {
      expect(
        bolehKembaliMelayani({
          status: 'COMPLETED',
          jenis: 'SAFETY_INSPECTION',
          hasilInspeksi: 'PASS_WITH_NOTE',
        }).boleh,
      ).toBe(true);
    });

    it('kalibrasi yang gagal TIDAK menahan — ia menandai', () => {
      /*
       * Perbedaan yang disengaja. Kalibrasi yang lewat berarti hasilnya
       * mungkin menyimpang; uji listrik yang gagal berarti alatnya mungkin
       * menyetrum orang.
       */
      expect(
        bolehKembaliMelayani({
          status: 'COMPLETED',
          jenis: 'CALIBRATION',
          hasilInspeksi: 'FAIL',
        }).boleh,
      ).toBe(true);
    });
  });

  describe('tautan insiden', () => {
    it('pekerjaan korektif yang mengenai pasien wajib menunjuk insidennya', () => {
      const h = wajibTautInsiden({
        jenis: 'CORRECTIVE',
        mengenaiPasien: true,
        safetyIncidentId: null,
      });
      expect(h.sah).toBe(false);
      expect(h.alasan).toContain('sudah tiga kali');
    });

    it('yang tertaut sah', () => {
      expect(
        wajibTautInsiden({
          jenis: 'CORRECTIVE',
          mengenaiPasien: true,
          safetyIncidentId: 'x',
        }).sah,
      ).toBe(true);
    });

    it('pekerjaan korektif yang tidak mengenai pasien tidak menuntut', () => {
      expect(
        wajibTautInsiden({
          jenis: 'CORRECTIVE',
          mengenaiPasien: false,
          safetyIncidentId: null,
        }).sah,
      ).toBe(true);
    });

    it('pemeliharaan pencegahan tidak menuntut', () => {
      expect(
        wajibTautInsiden({
          jenis: 'PREVENTIVE',
          mengenaiPasien: true,
          safetyIncidentId: null,
        }).sah,
      ).toBe(true);
    });
  });
});

describe('kalibrasi', () => {
  it('wajib menyebut standar acuannya', () => {
    const h = periksaCatatanKalibrasi({
      dilakukanPada: '2026-01-01',
      berlakuSampai: '2027-01-01',
      hasil: 'PASS',
      standarAcuan: null,
    });
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('menekan tombol');
  });

  it('yang berstandar sah', () => {
    expect(
      periksaCatatanKalibrasi({
        dilakukanPada: '2026-01-01',
        berlakuSampai: '2027-01-01',
        hasil: 'PASS',
        standarAcuan: 'Kementerian Kesehatan — sertifikat 12/2026',
      }).sah,
    ).toBe(true);
  });

  it('kalibrasi yang GAGAL tidak menuntut standar acuan', () => {
    // Yang gagal justru sering gagal sebelum sampai ke pembandingnya.
    expect(
      periksaCatatanKalibrasi({
        dilakukanPada: '2026-01-01',
        berlakuSampai: '2026-01-01',
        hasil: 'FAIL',
        standarAcuan: null,
      }).sah,
    ).toBe(true);
  });

  it('masa berlaku tidak boleh mendahului pelaksanaannya', () => {
    expect(
      periksaCatatanKalibrasi({
        dilakukanPada: '2026-06-01',
        berlakuSampai: '2026-01-01',
        hasil: 'PASS',
        standarAcuan: 'x',
      }).sah,
    ).toBe(false);
  });
});

describe('penilaian risiko siber', () => {
  const buktiLengkap = (kode: keyof typeof PENAHAN_PENGGANTI) => ({
    kode,
    buktiRef: `DOK-${kode}`,
  });

  it('alat tanpa faktor risiko berskor nol dan bertingkat LOW', () => {
    const h = nilaiRisikoSiber({ faktor: {}, penahan: [] });
    expect(h.skorBawaan).toBe(0);
    expect(h.skorSisa).toBe(0);
    expect(h.tingkat).toBe('LOW');
  });

  it('setiap faktor menyebut alasannya', () => {
    const h = nilaiRisikoSiber({
      faktor: { OS_END_OF_LIFE: true, DEFAULT_CREDENTIALS: true },
      penahan: [],
    });
    expect(h.faktor).toHaveLength(2);
    expect(h.faktor.every((f) => f.alasan.length > 20)).toBe(true);
  });

  it('bobot faktor dijumlahkan', () => {
    const h = nilaiRisikoSiber({
      faktor: { OS_END_OF_LIFE: true, INTERNET_REACHABLE: true },
      penahan: [],
    });
    expect(h.skorBawaan).toBe(
      FAKTOR_RISIKO.OS_END_OF_LIFE.bobot + FAKTOR_RISIKO.INTERNET_REACHABLE.bobot,
    );
  });

  it('dapat dijangkau dari internet adalah faktor tunggal terberat', () => {
    const bobot = Object.values(FAKTOR_RISIKO).map((f) => f.bobot);
    expect(FAKTOR_RISIKO.INTERNET_REACHABLE.bobot).toBe(Math.max(...bobot));
  });

  it('penahan berbukti mengurangi', () => {
    const h = nilaiRisikoSiber({
      faktor: { OS_END_OF_LIFE: true, VENDOR_SUPPORT_ENDED: true, STORES_PHI: true },
      penahan: [buktiLengkap('NETWORK_SEGMENTED')],
    });
    expect(h.pengurang).toBe(PENAHAN_PENGGANTI.NETWORK_SEGMENTED.pengurang);
    expect(h.skorSisa).toBeLessThan(h.skorBawaan);
  });

  it('PENAHAN TANPA BUKTI TIDAK DIHITUNG', () => {
    const h = nilaiRisikoSiber({
      faktor: { OS_END_OF_LIFE: true },
      penahan: [{ kode: 'NETWORK_SEGMENTED', buktiRef: null }],
    });
    expect(h.pengurang).toBe(0);
    expect(h.penahan).toHaveLength(0);
    expect(h.penahanDitolak[0].alasan).toContain('kotak yang dicentang');
  });

  it('penahan yang sama diakui dua kali hanya dihitung sekali', () => {
    const h = nilaiRisikoSiber({
      faktor: { OS_END_OF_LIFE: true, VENDOR_SUPPORT_ENDED: true },
      penahan: [buktiLengkap('NETWORK_SEGMENTED'), buktiLengkap('NETWORK_SEGMENTED')],
    });
    expect(h.penahan).toHaveLength(1);
    expect(h.penahanDitolak).toHaveLength(1);
  });

  it('PENAHAN TIDAK PERNAH MENGHILANGKAN RISIKO — ada lantai sisa', () => {
    /*
     * Segmentasi yang sempurna pun tidak membuat alat ber-OS kedaluwarsa
     * menjadi alat yang aman. Skor nol berarti "tidak perlu ditinjau lagi",
     * dan itu persis kebalikan dari yang benar.
     */
    const h = nilaiRisikoSiber({
      faktor: { OS_END_OF_LIFE: true, DEFAULT_CREDENTIALS: true },
      penahan: (Object.keys(PENAHAN_PENGGANTI) as (keyof typeof PENAHAN_PENGGANTI)[]).map(
        buktiLengkap,
      ),
    });
    expect(h.pengurang).toBeGreaterThan(h.skorBawaan);
    expect(h.skorSisa).toBeGreaterThan(0);
    expect(h.skorSisa).toBe(Math.ceil(h.skorBawaan / 3));
  });

  it('dan lantai itu diberitahukan, bukan disembunyikan', () => {
    const h = nilaiRisikoSiber({
      faktor: { OS_END_OF_LIFE: true, DEFAULT_CREDENTIALS: true },
      penahan: (Object.keys(PENAHAN_PENGGANTI) as (keyof typeof PENAHAN_PENGGANTI)[]).map(
        buktiLengkap,
      ),
    });
    expect(h.catatan.some((c) => c.includes('dapat ditanggung'))).toBe(true);
  });

  it('alat tanpa faktor apa pun tidak diberi lantai', () => {
    const h = nilaiRisikoSiber({
      faktor: {},
      penahan: [buktiLengkap('NETWORK_SEGMENTED')],
    });
    expect(h.skorSisa).toBe(0);
  });

  it('internet ditambah kata sandi bawaan diberi catatan tersendiri', () => {
    const h = nilaiRisikoSiber({
      faktor: { INTERNET_REACHABLE: true, DEFAULT_CREDENTIALS: true },
      penahan: [],
    });
    expect(h.catatan.some((c) => c.includes('membaca manual'))).toBe(true);
  });

  it('kendali jarak jauh pada alat tanpa dukungan pabrikan diberi catatan', () => {
    const h = nilaiRisikoSiber({
      faktor: { REMOTE_CONTROL: true, VENDOR_SUPPORT_ENDED: true },
      penahan: [],
    });
    expect(h.catatan.some((c) => c.includes('tidak akan pernah diperbaiki'))).toBe(true);
  });

  it('PENILAIAN TIDAK PERNAH MEMUTUS ALAT', () => {
    const h = nilaiRisikoSiber({
      faktor: {
        OS_END_OF_LIFE: true,
        VENDOR_SUPPORT_ENDED: true,
        DEFAULT_CREDENTIALS: true,
        INTERNET_REACHABLE: true,
        REMOTE_CONTROL: true,
        PATIENT_CONNECTED: true,
      },
      penahan: [],
    });
    expect(h.tingkat).toBe('CRITICAL');
    expect(h.memutusAlatOtomatis).toBe(false);
  });

  it('penahan yang tidak dikenal ditolak, bukan diabaikan diam-diam', () => {
    const h = nilaiRisikoSiber({
      faktor: { OS_END_OF_LIFE: true },
      penahan: [{ kode: 'ANTIVIRUS' as never, buktiRef: 'x' }],
    });
    expect(h.penahanDitolak[0].kode).toBe('ANTIVIRUS');
  });
});

describe('tingkat risiko', () => {
  it.each([
    [0, 'LOW'],
    [2, 'LOW'],
    [3, 'MEDIUM'],
    [5, 'MEDIUM'],
    [6, 'HIGH'],
    [9, 'HIGH'],
    [10, 'CRITICAL'],
    [30, 'CRITICAL'],
  ])('skor %i -> %s', (skor, tingkat) => {
    expect(tingkatRisiko(skor as number)).toBe(tingkat);
  });
});

describe('keputusan yang dituntut', () => {
  it('CRITICAL menuntut keputusan dalam 7 hari', () => {
    const h = keputusanWajib('CRITICAL');
    expect(h.wajibKeputusan).toBe(true);
    expect(h.tenggatHari).toBe(7);
  });

  it('TIDAK ADA TINGKAT YANG MEMUTUS ALAT OTOMATIS', () => {
    for (const t of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const) {
      expect(keputusanWajib(t).memutusAlatOtomatis).toBe(false);
    }
  });

  it('CRITICAL pun boleh DITERIMA', () => {
    /*
     * Rumah sakit yang tidak dapat menerima risiko apa pun akan mematikan
     * alat yang dibutuhkan pasiennya. Yang dituntut bukan larangan, melainkan
     * penerimaan yang bernama dan bertenggat.
     */
    expect(keputusanWajib('CRITICAL').bolehDiterima).toBe(true);
    expect(keputusanWajib('CRITICAL').keterangan).toContain('dapat ditanyakan kembali');
  });

  it('LOW tidak menuntut keputusan', () => {
    expect(keputusanWajib('LOW').wajibKeputusan).toBe(false);
    expect(keputusanWajib('LOW').tenggatHari).toBeNull();
  });

  it('tenggatnya makin pendek makin tinggi tingkatnya', () => {
    expect(keputusanWajib('MEDIUM').tenggatHari).toBeGreaterThan(
      keputusanWajib('HIGH').tenggatHari as number,
    );
    expect(keputusanWajib('HIGH').tenggatHari).toBeGreaterThan(
      keputusanWajib('CRITICAL').tenggatHari as number,
    );
  });
});

describe('penerimaan risiko', () => {
  const dasar = {
    keputusan: 'ACCEPT' as const,
    alasan: 'Alat menopang layanan gawat darurat dan penggantinya belum tiba.',
    tinjauUlangPada: '2026-11-01',
    rencanaRef: null,
    diputuskanOleh: 'direktur',
    dinilaiOleh: 'teknisi',
  };

  it('yang lengkap sah', () => {
    expect(periksaPenerimaanRisiko(dasar).sah).toBe(true);
  });

  it('PENERIMAAN TANPA TANGGAL TINJAU DITOLAK', () => {
    const h = periksaPenerimaanRisiko({ ...dasar, tinjauUlangPada: null });
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('sudah pensiun');
  });

  it('keputusan tanpa nama ditolak', () => {
    expect(periksaPenerimaanRisiko({ ...dasar, diputuskanOleh: null }).sah).toBe(false);
  });

  it('yang menilai tidak memutuskan sendiri', () => {
    const h = periksaPenerimaanRisiko({ ...dasar, diputuskanOleh: 'teknisi' });
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('ditanggung rumah sakit');
  });

  it('alasan sepatah kata ditolak', () => {
    expect(periksaPenerimaanRisiko({ ...dasar, alasan: 'perlu' }).sah).toBe(false);
  });

  it('mengurangi tanpa rencana ditolak', () => {
    const h = periksaPenerimaanRisiko({
      ...dasar,
      keputusan: 'MITIGATE',
      tinjauUlangPada: null,
      rencanaRef: null,
    });
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('tidak mau mengakui dirinya');
  });

  it('memensiunkan dengan rencana sah tanpa tanggal tinjau', () => {
    expect(
      periksaPenerimaanRisiko({
        ...dasar,
        keputusan: 'RETIRE',
        tinjauUlangPada: null,
        rencanaRef: 'RENCANA-2026-04',
      }).sah,
    ).toBe(true);
  });

  it('penilai yang tidak diketahui tidak menghalangi', () => {
    expect(periksaPenerimaanRisiko({ ...dasar, dinilaiOleh: null }).sah).toBe(true);
  });
});

describe('masa berlaku penerimaan', () => {
  it('yang belum lewat berlaku', () => {
    expect(penerimaanMasihBerlaku('2026-12-01', '2026-08-01').berlaku).toBe(true);
  });

  it('yang lewat tidak berlaku lagi', () => {
    const h = penerimaanMasihBerlaku('2026-01-01', '2026-08-01');
    expect(h.berlaku).toBe(false);
  });

  it('dan kembali ke daftar menunggu keputusan, bukan daftar yang dimatikan', () => {
    const h = penerimaanMasihBerlaku('2026-01-01', '2026-08-01');
    expect(h.keterangan).toContain('bukan ke daftar yang harus dimatikan');
  });

  it('tanpa tanggal tinjau tidak dianggap berlaku', () => {
    expect(penerimaanMasihBerlaku(null, '2026-08-01').berlaku).toBe(false);
  });
});

describe('insiden siber', () => {
  it('yang mempengaruhi perawatan wajib tertaut keselamatan pasien', () => {
    const h = wajibLaporKeselamatan({
      jenis: 'RANSOMWARE',
      mempengaruhiPerawatan: true,
      safetyIncidentId: null,
    });
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('tidak pernah dihitung');
  });

  it('yang tertaut sah', () => {
    expect(
      wajibLaporKeselamatan({
        jenis: 'RANSOMWARE',
        mempengaruhiPerawatan: true,
        safetyIncidentId: 'x',
      }).sah,
    ).toBe(true);
  });

  it('yang tidak mengenai perawatan tidak menuntut tautan', () => {
    const h = wajibLaporKeselamatan({
      jenis: 'MALWARE',
      mempengaruhiPerawatan: false,
      safetyIncidentId: null,
    });
    expect(h.sah).toBe(true);
    expect(h.wajib).toBe(false);
  });
});

describe('langkah penahanan', () => {
  it('yang pertama adalah isolasi jaringan, bukan mematikan daya', () => {
    const h = langkahPenahanan({ terhubungPasien: true, adaPenggantiTersedia: false });
    expect(h.langkah[0]).toContain('bukan dayanya');
  });

  it('alat yang terhubung pasien TIDAK PERNAH diputus perangkat lunak', () => {
    const h = langkahPenahanan({ terhubungPasien: true, adaPenggantiTersedia: true });
    expect(h.memutusAlatOtomatis).toBe(false);
    expect(h.langkah.some((l) => l.includes('lebih baik daripada alat yang mati'))).toBe(true);
  });

  it('peralihan ke pengganti dilakukan tenaga klinis', () => {
    const h = langkahPenahanan({ terhubungPasien: true, adaPenggantiTersedia: true });
    expect(h.langkah.some((l) => l.includes('bukan teknisi jaringan'))).toBe(true);
  });

  it('tanpa pengganti, prosedur luring dijalankan', () => {
    const h = langkahPenahanan({ terhubungPasien: true, adaPenggantiTersedia: false });
    expect(h.langkah.some((l) => l.includes('prosedur luring'))).toBe(true);
  });

  it('alat yang tidak terhubung pasien boleh dimatikan', () => {
    const h = langkahPenahanan({ terhubungPasien: false, adaPenggantiTersedia: false });
    expect(h.langkah.some((l) => l.includes('boleh dimatikan'))).toBe(true);
  });

  it('keadaan alat dicatat sebelum apa pun diubah', () => {
    const h = langkahPenahanan({ terhubungPasien: false, adaPenggantiTersedia: false });
    expect(h.langkah.some((l) => l.includes('sebelum apa pun diubah'))).toBe(true);
  });
});

describe('urutan daftar perhatian', () => {
  const buat = (
    tingkat: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    skorSisa: number,
    tenggatKeputusan: string | null,
    adaKeputusanBerlaku = false,
  ) => ({ tingkat, skorSisa, tenggatKeputusan, adaKeputusanBerlaku });

  it('YANG LEWAT TENGGAT MENDAHULUI YANG SKORNYA LEBIH TINGGI', () => {
    /*
     * Daftar yang diurut skor saja akan menaruh alat yang sudah dua tahun
     * tanpa keputusan di bawah alat yang baru dinilai kemarin.
     */
    const hasil = urutkanPerhatian(
      [buat('CRITICAL', 14, '2026-12-01'), buat('MEDIUM', 4, '2024-01-01')],
      '2026-08-01',
    );
    expect(hasil[0].tingkat).toBe('MEDIUM');
  });

  it('yang sudah berkeputusan berlaku tidak dihitung lewat tenggat', () => {
    const hasil = urutkanPerhatian(
      [buat('CRITICAL', 14, '2026-12-01'), buat('MEDIUM', 4, '2024-01-01', true)],
      '2026-08-01',
    );
    expect(hasil[0].tingkat).toBe('CRITICAL');
  });

  it('di antara yang sama-sama dalam tenggat, tingkat menentukan', () => {
    const hasil = urutkanPerhatian(
      [buat('LOW', 2, null), buat('HIGH', 7, null), buat('CRITICAL', 11, null)],
      '2026-08-01',
    );
    expect(hasil.map((h) => h.tingkat)).toEqual(['CRITICAL', 'HIGH', 'LOW']);
  });

  it('di antara yang setingkat, skor menentukan', () => {
    const hasil = urutkanPerhatian([buat('HIGH', 6, null), buat('HIGH', 9, null)], '2026-08-01');
    expect(hasil[0].skorSisa).toBe(9);
  });

  it('daftar asal tidak diubah', () => {
    const asal = [buat('LOW', 1, null), buat('CRITICAL', 12, null)];
    urutkanPerhatian(asal, '2026-08-01');
    expect(asal[0].tingkat).toBe('LOW');
  });

  it('daftar kosong tetap kosong', () => {
    expect(urutkanPerhatian([], '2026-08-01')).toEqual([]);
  });
});
