/**
 * Pengujian layanan warga dan persuratan.
 *
 * Empat aturan dijaga paling ketat, dan seluruhnya berasal dari keadaan nyata
 * di kantor desa:
 *
 * - Penolakan dan pengembalian berkas **wajib beralasan**.
 * - SLA dihitung **sejak berkas lengkap**, bukan sejak permohonan masuk.
 * - Pemohon **tidak dapat memproses** permohonannya sendiri.
 * - Alur yang tidak dapat diselesaikan ketahuan **saat dikonfigurasi**, bukan
 *   saat warga sudah mengantre.
 */

import {
  STATUS_PERMOHONAN,
  TRANSISI_PERMOHONAN,
  alurDapatDiselesaikan,
  bolehMemproses,
  bolehPindahPermohonan,
  hitungSla,
  langkahEfektif,
  nomorAntreanBerikutnya,
  periksaKelengkapan,
  selisihHariKerja,
  statusAkhir,
  susunNomorSurat,
  tambahHariKerja,
  type StatusPermohonan,
} from './village-service';
import type { LangkahWorkflow } from './ports/workflow.port';

const lk = (over: Partial<LangkahWorkflow> = {}): LangkahWorkflow => ({
  sequence: 1,
  code: 'VERIFIKASI',
  name: 'Verifikasi berkas',
  roleCode: 'VILLAGE_OP_SERVICE',
  skippable: false,
  ...over,
});

describe('kelengkapan tabel transisi', () => {
  it('setiap status punya entri', () => {
    for (const s of STATUS_PERMOHONAN) expect(TRANSISI_PERMOHONAN[s]).toBeDefined();
  });

  it('tidak menunjuk status yang tidak ada', () => {
    const dikenal = new Set<string>(STATUS_PERMOHONAN);
    for (const tujuan of Object.values(TRANSISI_PERMOHONAN)) {
      for (const t of tujuan) expect(dikenal.has(t)).toBe(true);
    }
  });

  it('setiap status dapat dicapai dari DRAF', () => {
    // Status yang tidak dapat dicapai adalah status yang kodenya tidak pernah
    // dijalankan, sehingga cacatnya tidak pernah ketahuan.
    const tercapai = new Set<StatusPermohonan>(['DRAF']);
    let berubah = true;
    while (berubah) {
      berubah = false;
      for (const s of [...tercapai]) {
        for (const t of TRANSISI_PERMOHONAN[s]) {
          if (!tercapai.has(t)) {
            tercapai.add(t);
            berubah = true;
          }
        }
      }
    }
    expect(STATUS_PERMOHONAN.filter((s) => !tercapai.has(s))).toEqual([]);
  });

  it('tiga status bersifat akhir', () => {
    expect(STATUS_PERMOHONAN.filter(statusAkhir).sort()).toEqual(
      ['DIBATALKAN', 'DISERAHKAN', 'DITOLAK'].sort(),
    );
  });
});

describe('perpindahan status permohonan', () => {
  it('mengizinkan alur pelayanan yang biasa', () => {
    const alur: Array<[StatusPermohonan, StatusPermohonan]> = [
      ['DRAF', 'DIAJUKAN'],
      ['DIAJUKAN', 'DIVERIFIKASI'],
      ['DIVERIFIKASI', 'MENUNGGU_PERSETUJUAN'],
      ['MENUNGGU_PERSETUJUAN', 'DISETUJUI'],
      ['DISETUJUI', 'DITERBITKAN'],
      ['DITERBITKAN', 'DISERAHKAN'],
    ];
    for (const [a, b] of alur) expect(bolehPindahPermohonan(a, b).boleh).toBe(true);
  });

  it('berkas kurang kembali ke DIAJUKAN, bukan ke DRAF', () => {
    /*
     * Warga melengkapi berkasnya, bukan mengajukan ulang dari nol. Nomor
     * antreannya tetap, dan riwayatnya tidak terputus.
     */
    expect(bolehPindahPermohonan('BERKAS_KURANG', 'DIAJUKAN').boleh).toBe(true);
    expect(bolehPindahPermohonan('BERKAS_KURANG', 'DRAF').boleh).toBe(false);
  });

  it('menolak lompatan dari diajukan langsung ke diterbitkan', () => {
    expect(bolehPindahPermohonan('DIAJUKAN', 'DITERBITKAN').boleh).toBe(false);
  });

  it('menolak perpindahan dari status akhir', () => {
    for (const s of ['DITOLAK', 'DISERAHKAN', 'DIBATALKAN'] as StatusPermohonan[]) {
      const v = bolehPindahPermohonan(s, 'DIAJUKAN');
      expect(v.boleh).toBe(false);
      expect(v.alasan).toContain('selesai');
    }
  });

  it('surat yang sudah diterbitkan tidak dapat dibatalkan', () => {
    // Surat yang sudah tercetak dan dibawa pulang warga tidak dapat ditarik
    // dengan mengubah status. Pembatalannya prosedur tersendiri.
    expect(bolehPindahPermohonan('DITERBITKAN', 'DIBATALKAN').boleh).toBe(false);
  });
});

describe('transisi yang wajib beralasan', () => {
  it('penolakan wajib beralasan', () => {
    /*
     * Warga yang permohonannya ditolak tanpa keterangan akan datang lagi
     * menanyakan hal yang sama, dan petugas berikutnya tidak tahu apa yang
     * harus dijawab.
     */
    for (const dari of ['DIAJUKAN', 'DIVERIFIKASI', 'MENUNGGU_PERSETUJUAN'] as StatusPermohonan[]) {
      expect(bolehPindahPermohonan(dari, 'DITOLAK').wajibBeralasan).toBe(true);
    }
  });

  it('pengembalian berkas wajib beralasan', () => {
    expect(bolehPindahPermohonan('DIAJUKAN', 'BERKAS_KURANG').wajibBeralasan).toBe(true);
  });

  it('pembatalan wajib beralasan', () => {
    expect(bolehPindahPermohonan('DIAJUKAN', 'DIBATALKAN').wajibBeralasan).toBe(true);
  });

  it('penerbitan TIDAK wajib beralasan', () => {
    // Yang menguntungkan warga tidak perlu dijelaskan.
    expect(bolehPindahPermohonan('DISETUJUI', 'DITERBITKAN').wajibBeralasan).toBeFalsy();
  });

  it('setiap transisi yang merugikan warga wajib beralasan', () => {
    const merugikan: StatusPermohonan[] = ['DITOLAK', 'BERKAS_KURANG', 'DIBATALKAN'];
    for (const dari of STATUS_PERMOHONAN) {
      for (const ke of TRANSISI_PERMOHONAN[dari]) {
        if (merugikan.includes(ke)) {
          expect(bolehPindahPermohonan(dari, ke).wajibBeralasan).toBe(true);
        }
      }
    }
  });
});

describe('pemisahan wewenang pelayanan', () => {
  it('pemohon tidak dapat memproses permohonannya sendiri', () => {
    const v = bolehMemproses('U1', 'U1');
    expect(v.boleh).toBe(false);
    expect(v.alasan).toContain('sendiri');
  });

  it('petugas lain boleh memproses', () => {
    expect(bolehMemproses('U1', 'U2').boleh).toBe(true);
  });

  it('permohonan tanpa pemohon tercatat tidak menghalangi', () => {
    // Permohonan yang masuk lewat loket atas nama warga yang belum punya akun.
    expect(bolehMemproses(null, 'U2').boleh).toBe(true);
  });
});

describe('kelengkapan berkas', () => {
  const syarat = [
    { code: 'KTP', name: 'Fotokopi KTP', mandatory: true },
    { code: 'KK', name: 'Fotokopi Kartu Keluarga', mandatory: true },
    { code: 'SURAT_RT', name: 'Surat pengantar RT', mandatory: true },
    { code: 'FOTO', name: 'Pas foto', mandatory: false },
  ];

  it('menyatakan lengkap bila seluruh yang wajib ada', () => {
    const h = periksaKelengkapan(syarat, [
      { requirementCode: 'KTP' },
      { requirementCode: 'KK' },
      { requirementCode: 'SURAT_RT' },
    ]);
    expect(h.lengkap).toBe(true);
  });

  it('berkas tidak wajib tidak menghalangi', () => {
    const h = periksaKelengkapan(syarat, [
      { requirementCode: 'KTP' },
      { requirementCode: 'KK' },
      { requirementCode: 'SURAT_RT' },
    ]);
    expect(h.kurang.map((k) => k.code)).not.toContain('FOTO');
  });

  it('menyebutkan APA yang kurang, bukan sekadar "belum lengkap"', () => {
    /*
     * Warga yang harus menebak apa yang kurang akan datang berkali-kali membawa
     * berkas yang salah.
     */
    const h = periksaKelengkapan(syarat, [{ requirementCode: 'KTP' }]);
    expect(h.lengkap).toBe(false);
    expect(h.pesan).toContain('Kartu Keluarga');
    expect(h.pesan).toContain('Surat pengantar RT');
  });

  it('menyebut satu berkas dengan kalimat tunggal', () => {
    const h = periksaKelengkapan(syarat, [
      { requirementCode: 'KTP' },
      { requirementCode: 'KK' },
    ]);
    expect(h.kurang).toHaveLength(1);
    expect(h.pesan).toBe('Berkas yang masih kurang: Surat pengantar RT.');
  });

  it('layanan tanpa persyaratan langsung lengkap', () => {
    expect(periksaKelengkapan([], []).lengkap).toBe(true);
  });
});

describe('hari kerja', () => {
  it('menambah hari kerja melewati akhir pekan', () => {
    // 2026-07-31 Jumat; + 1 hari kerja = Senin 2026-08-03.
    expect(tambahHariKerja('2026-07-31', 1)).toBe('2026-08-03');
  });

  it('melewati hari libur yang disebutkan', () => {
    expect(tambahHariKerja('2026-07-31', 1, ['2026-08-03'])).toBe('2026-08-04');
  });

  it('menghitung selisih hari kerja', () => {
    // Jumat ke Senin = 1 hari kerja.
    expect(selisihHariKerja('2026-07-31', '2026-08-03')).toBe(1);
    // Jumat ke Jumat berikutnya = 5 hari kerja.
    expect(selisihHariKerja('2026-07-31', '2026-08-07')).toBe(5);
  });

  it('selisih ke belakang bernilai nol', () => {
    expect(selisihHariKerja('2026-08-07', '2026-07-31')).toBe(0);
  });
});

describe('perhitungan SLA', () => {
  it('belum dimulai selama berkas belum lengkap', () => {
    /*
     * Inilah sikap yang menentukan. Menghitung sejak permohonan masuk membuat
     * angka SLA menyalahkan warga yang lambat melengkapi berkas — dan angka
     * yang menyalahkan pihak yang salah tidak akan dipakai siapa pun untuk
     * memperbaiki apa pun.
     */
    const h = hitungSla(
      { completedAt: null, finishedAt: null, slaWorkingDays: 3 },
      '2026-08-10',
    );
    expect(h.status).toBe('BELUM_MULAI');
    expect(h.dueDate).toBeNull();
    expect(h.keterangan).toContain('berkas dinyatakan lengkap');
  });

  it('menghitung batas waktu sejak berkas lengkap', () => {
    const h = hitungSla(
      { completedAt: '2026-07-31', finishedAt: null, slaWorkingDays: 3 },
      '2026-08-03',
    );
    // Jumat + 3 hari kerja = Rabu 2026-08-05.
    expect(h.dueDate).toBe('2026-08-05');
    expect(h.status).toBe('DALAM_TENGGAT');
  });

  it('menandai terlambat setelah melewati batas', () => {
    const h = hitungSla(
      { completedAt: '2026-07-31', finishedAt: null, slaWorkingDays: 3 },
      '2026-08-10',
    );
    expect(h.status).toBe('TERLAMBAT');
    expect(h.keterangan).toContain('2026-08-05');
  });

  it('menilai penyelesaian tepat waktu', () => {
    const h = hitungSla(
      { completedAt: '2026-07-31', finishedAt: '2026-08-04', slaWorkingDays: 3 },
      '2026-08-10',
    );
    expect(h.status).toBe('SELESAI_TEPAT');
    expect(h.elapsedWorkingDays).toBe(2);
  });

  it('menilai penyelesaian yang melampaui janji', () => {
    const h = hitungSla(
      { completedAt: '2026-07-31', finishedAt: '2026-08-11', slaWorkingDays: 3 },
      '2026-08-12',
    );
    expect(h.status).toBe('SELESAI_TERLAMBAT');
    expect(h.keterangan).toContain('melampaui');
  });

  it('hari libur memperpanjang batas waktu', () => {
    const h = hitungSla(
      {
        completedAt: '2026-07-31',
        finishedAt: null,
        slaWorkingDays: 3,
        holidays: ['2026-08-03', '2026-08-04'],
      },
      '2026-08-03',
    );
    expect(h.dueDate).toBe('2026-08-07');
  });
});

describe('nomor surat', () => {
  it('menyusun dari pola', () => {
    const n = susunNomorSurat(
      { pattern: '{urut}/{kode}/{bulanRomawi}/{tahun}', padding: 3 },
      { urut: 7, kode: 'SKD', tanggal: '2026-08-01' },
    );
    expect(n).toBe('007/SKD/VIII/2026');
  });

  it('mendukung pola yang memuat kode desa', () => {
    const n = susunNomorSurat(
      { pattern: '{kode}/{unit}/{urut}/{bulan}/{tahun2}', padding: 4 },
      { urut: 12, kode: 'SKTM', tanggal: '2026-01-15', unitCode: 'SKA' },
    );
    expect(n).toBe('SKTM/SKA/0012/01/26');
  });

  it('pola tersimpan sebagai data, bukan di kode', () => {
    // Setiap desa punya kebiasaan penomoran sendiri. Yang di kode berarti
    // setiap desa memerlukan pemasangan tersendiri.
    const a = susunNomorSurat({ pattern: '{urut}-{tahun}', padding: 1 }, { urut: 5, kode: 'X', tanggal: '2026-08-01' });
    const b = susunNomorSurat({ pattern: '{tahun}/{urut}', padding: 2 }, { urut: 5, kode: 'X', tanggal: '2026-08-01' });
    expect(a).toBe('5-2026');
    expect(b).toBe('2026/05');
  });
});

describe('antrean', () => {
  it('menyusun nomor antrean berimbuhan loket', () => {
    expect(nomorAntreanBerikutnya('A', 0)).toBe('A-001');
    expect(nomorAntreanBerikutnya('B', 41)).toBe('B-042');
  });
});

describe('langkah alur', () => {
  const peran = new Set(['VILLAGE_OP_SERVICE', 'VILLAGE_HEAD']);

  it('melewati langkah yang perannya tidak ada dan boleh dilewati', () => {
    /*
     * Desa kecil kerap tidak punya seluruh jabatan. Alur yang menuntut Kasi
     * Pelayanan pada desa yang tidak punya Kasi Pelayanan akan menggantung
     * selamanya, dan warganya tidak pernah memperoleh suratnya.
     */
    const { steps, dilewati } = langkahEfektif(
      [
        lk({ sequence: 1, roleCode: 'VILLAGE_OP_SERVICE' }),
        lk({ sequence: 2, roleCode: 'VILLAGE_KASI_SERVICE', skippable: true }),
        lk({ sequence: 3, roleCode: 'VILLAGE_HEAD' }),
      ],
      peran,
    );
    expect(steps.map((s) => s.sequence)).toEqual([1, 3]);
    expect(dilewati.map((s) => s.sequence)).toEqual([2]);
  });

  it('langkah yang TIDAK boleh dilewati tetap menunggu', () => {
    // Disengaja: persetujuan yang wajib tidak boleh hilang hanya karena
    // jabatannya sedang kosong. Yang terjadi adalah permohonan menunggu, dan
    // itu keadaan yang benar untuk ditampilkan.
    const { steps } = langkahEfektif(
      [lk({ sequence: 1, roleCode: 'VILLAGE_TREASURER', skippable: false })],
      peran,
    );
    expect(steps).toHaveLength(1);
  });

  it('mendeteksi alur buntu saat dikonfigurasi', () => {
    const h = alurDapatDiselesaikan(
      [
        lk({ sequence: 1, roleCode: 'VILLAGE_OP_SERVICE' }),
        lk({ sequence: 2, roleCode: 'VILLAGE_TREASURER', skippable: false }),
      ],
      peran,
    );
    expect(h.dapat).toBe(false);
    expect(h.buntu.map((b) => b.roleCode)).toEqual(['VILLAGE_TREASURER']);
  });

  it('alur yang seluruh perannya ada dapat diselesaikan', () => {
    expect(
      alurDapatDiselesaikan(
        [lk({ sequence: 1, roleCode: 'VILLAGE_OP_SERVICE' }), lk({ sequence: 2, roleCode: 'VILLAGE_HEAD' })],
        peran,
      ).dapat,
    ).toBe(true);
  });

  it('langkah yang boleh dilewati tidak membuat alur buntu', () => {
    expect(
      alurDapatDiselesaikan([lk({ roleCode: 'VILLAGE_KASI_SERVICE', skippable: true })], peran).dapat,
    ).toBe(true);
  });
});
