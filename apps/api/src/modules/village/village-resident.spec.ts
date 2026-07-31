/**
 * Pengujian aturan kependudukan.
 *
 * Dua sikap yang dijaga paling ketat, dan keduanya berlawanan dengan naluri
 * "sistem harus ketat":
 *
 * - **NIK yang janggal ditandai, bukan ditolak.** Warga yang NIK-nya tercetak
 *   keliru tetap berhak dilayani desanya.
 * - **Duplikat ditandai, bukan diputuskan.** Sistem tidak tahu apakah NIK
 *   kembar itu salah ketik atau pemalsuan; manusia yang menelusuri.
 */

import {
  AMBANG_AGREGAT,
  bolehSimpanNik,
  bolehSuntingPenduduk,
  cariDuplikat,
  kelompokUsia,
  normalkanNama,
  periksaNik,
  periksaSusunanKeluarga,
  sajikanAgregat,
  statusSesudahPeristiwa,
  usia,
  wajibKtp,
  type AnggotaKeluarga,
} from './village-resident';

describe('pemeriksaan NIK', () => {
  it('membaca tanggal lahir dan jenis kelamin laki-laki', () => {
    // 3507 12 | 17 08 90 | 0001  -> 17 Agustus 1990, laki-laki
    const h = periksaNik('3507121708900001');
    expect(h.valid).toBe(true);
    expect(h.tanggalLahirTersirat).toBe('1990-08-17');
    expect(h.jenisKelaminTersirat).toBe('L');
  });

  it('membaca perempuan dari komponen hari ditambah 40', () => {
    const h = periksaNik('3507125708900001');
    expect(h.jenisKelaminTersirat).toBe('P');
    expect(h.tanggalLahirTersirat).toBe('1990-08-17');
  });

  it('menandai kode wilayah nol tanpa menolaknya', () => {
    const h = periksaNik('0000001708900001');
    expect(h.valid).toBe(false);
    expect(h.peringatan.join(' ')).toContain('wilayah');
    // Yang penting: tetap boleh disimpan.
    expect(bolehSimpanNik('0000001708900001').boleh).toBe(true);
  });

  it('menandai nomor urut nol', () => {
    expect(periksaNik('3507121708900000').peringatan.join(' ')).toContain('urut');
  });

  it('menandai tanggal lahir yang tidak dapat dibaca', () => {
    const h = periksaNik('3507129999900001');
    expect(h.tanggalLahirTersirat).toBeUndefined();
    expect(h.peringatan.join(' ')).toContain('tanggal lahir');
  });

  it('menolak yang bukan enam belas digit', () => {
    expect(periksaNik('12345').valid).toBe(false);
    expect(periksaNik('35071217089000012').valid).toBe(false);
  });

  it('menolak yang mengandung huruf', () => {
    expect(periksaNik('35071217089000AB').valid).toBe(false);
  });
});

describe('NIK boleh disimpan meski janggal', () => {
  it('NIK berformat benar boleh disimpan', () => {
    expect(bolehSimpanNik('3507121708900001').boleh).toBe(true);
  });

  it('NIK yang janggal TETAP boleh disimpan', () => {
    /*
     * Ini sikap yang disengaja. NIK yang tercetak keliru pada KTP sungguhan
     * ada, dan warga pemiliknya tetap berhak memperoleh layanan desa.
     * Menolaknya berarti memaksa petugas mengarang NIK lain agar datanya dapat
     * masuk — dan data karangan lebih buruk daripada data yang ditandai janggal.
     */
    expect(bolehSimpanNik('0000000000000000').boleh).toBe(true);
  });

  it('yang bukan enam belas digit tetap ditolak', () => {
    const h = bolehSimpanNik('123');
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('enam belas');
  });

  it('spasi tidak menggagalkan penyimpanan', () => {
    expect(bolehSimpanNik('3507 1217 0890 0001').boleh).toBe(true);
  });
});

describe('penandaan duplikat', () => {
  const yangAda = [
    { id: 'A', nik: '3507121708900001', nama: 'Ahmad Fauzi', tanggalLahir: '1990-08-17' },
    { id: 'B', nik: '3507125708920002', nama: 'Siti Aminah', tanggalLahir: '1992-08-17' },
  ];

  it('menandai NIK yang sama dengan keyakinan tinggi', () => {
    const t = cariDuplikat(
      { nik: '3507121708900001', nama: 'Ahmad F', tanggalLahir: '1990-08-17' },
      yangAda,
    );
    expect(t).toHaveLength(1);
    expect(t[0].alasan).toBe('NIK_SAMA');
    expect(t[0].keyakinan).toBe('TINGGI');
  });

  it('menandai nama dan tanggal lahir yang sama dengan keyakinan sedang', () => {
    const t = cariDuplikat(
      { nik: '3507121708900099', nama: 'Ahmad Fauzi', tanggalLahir: '1990-08-17' },
      yangAda,
    );
    expect(t[0].alasan).toBe('NAMA_TANGGAL_LAHIR_SAMA');
    expect(t[0].keyakinan).toBe('SEDANG');
  });

  it('tidak menandai orang yang berbeda', () => {
    expect(
      cariDuplikat({ nik: '3507120101000003', nama: 'Budi Santoso', tanggalLahir: '2000-01-01' }, yangAda),
    ).toEqual([]);
  });

  it('mengembalikan temuan, bukan penolakan', () => {
    /*
     * Perbedaan yang menentukan. NIK kembar bisa berarti salah ketik, bisa
     * berarti pemalsuan, bisa berarti kesalahan penerbitan. Menolaknya otomatis
     * menghalangi pendataan warga yang datanya memang bermasalah — padahal
     * justru merekalah yang paling perlu dibantu mengurusnya.
     */
    const t = cariDuplikat(
      { nik: '3507121708900001', nama: 'Ahmad F', tanggalLahir: '1990-08-17' },
      yangAda,
    );
    expect(t[0]).toHaveProperty('keterangan');
    expect(t[0].keterangan).toContain('Periksa');
  });

  it('gelar tidak menghalangi pengenalan nama', () => {
    const t = cariDuplikat(
      { nik: '3507121708900098', nama: 'H. Ahmad Fauzi, S.Pd', tanggalLahir: '1990-08-17' },
      yangAda,
    );
    expect(t.map((x) => x.alasan)).toContain('NAMA_TANGGAL_LAHIR_SAMA');
  });
});

describe('normalisasi nama', () => {
  it('membuang gelar depan dan belakang', () => {
    expect(normalkanNama('H. Ahmad Fauzi, S.Pd')).toBe('AHMAD FAUZI');
    expect(normalkanNama('Drs. Budi')).toBe('BUDI');
  });

  it('menyeragamkan spasi dan huruf besar', () => {
    expect(normalkanNama('  ahmad   fauzi  ')).toBe('AHMAD FAUZI');
  });
});

describe('susunan kartu keluarga', () => {
  const a = (id: string, hubungan: AnggotaKeluarga['hubungan']): AnggotaKeluarga => ({ id, hubungan });

  it('menerima susunan yang wajar', () => {
    const h = periksaSusunanKeluarga([
      a('1', 'KEPALA_KELUARGA'),
      a('2', 'ISTRI'),
      a('3', 'ANAK'),
      a('4', 'ANAK'),
    ]);
    expect(h.sah).toBe(true);
  });

  it('menolak kartu tanpa kepala keluarga', () => {
    // Kartu keluarga tanpa kepala keluarga tidak dapat dipakai mengurus apa pun.
    const h = periksaSusunanKeluarga([a('1', 'ISTRI'), a('2', 'ANAK')]);
    expect(h.sah).toBe(false);
    expect(h.masalah.join(' ')).toContain('kepala keluarga');
  });

  it('menolak dua kepala keluarga', () => {
    const h = periksaSusunanKeluarga([a('1', 'KEPALA_KELUARGA'), a('2', 'KEPALA_KELUARGA')]);
    expect(h.sah).toBe(false);
    expect(h.masalah.join(' ')).toContain('2 kepala keluarga');
  });

  it('menolak dua istri pada satu kartu', () => {
    const h = periksaSusunanKeluarga([a('1', 'KEPALA_KELUARGA'), a('2', 'ISTRI'), a('3', 'ISTRI')]);
    expect(h.sah).toBe(false);
  });

  it('menolak penduduk yang tercatat dua kali', () => {
    const h = periksaSusunanKeluarga([a('1', 'KEPALA_KELUARGA'), a('1', 'ANAK')]);
    expect(h.sah).toBe(false);
    expect(h.masalah.join(' ')).toContain('dua kali');
  });

  it('kartu berisi satu orang saja tetap sah', () => {
    // Warga lajang yang tinggal sendiri punya kartu keluarganya sendiri.
    expect(periksaSusunanKeluarga([a('1', 'KEPALA_KELUARGA')]).sah).toBe(true);
  });
});

describe('peristiwa kependudukan', () => {
  it('kematian mengubah status menjadi meninggal', () => {
    const h = statusSesudahPeristiwa('TETAP', 'KEMATIAN');
    expect(h.boleh).toBe(true);
    expect(h.status).toBe('MENINGGAL');
  });

  it('penduduk meninggal tidak dapat dikenai peristiwa lain', () => {
    for (const p of ['PINDAH_KELUAR', 'PERKAWINAN', 'PINDAH_MASUK'] as const) {
      expect(statusSesudahPeristiwa('MENINGGAL', p).boleh).toBe(false);
    }
  });

  it('pindah keluar dua kali ditolak', () => {
    expect(statusSesudahPeristiwa('PINDAH', 'PINDAH_KELUAR').boleh).toBe(false);
  });

  it('pindah masuk mengembalikan status tetap', () => {
    const h = statusSesudahPeristiwa('PINDAH', 'PINDAH_MASUK');
    expect(h.boleh).toBe(true);
    expect(h.status).toBe('TETAP');
  });

  it('perkawinan tidak mengubah status kependudukan', () => {
    // Ia mengubah status kawin, bukan status kependudukan. Keduanya kolom
    // berbeda, dan mencampurnya membuat penduduk yang menikah tampak pindah.
    expect(statusSesudahPeristiwa('TETAP', 'PERKAWINAN').status).toBe('TETAP');
  });
});

describe('penyuntingan data penduduk', () => {
  it('penduduk tetap boleh disunting', () => {
    expect(bolehSuntingPenduduk('TETAP').boleh).toBe(true);
  });

  it('penduduk meninggal tidak dapat disunting, dan diberi tahu jalan yang benar', () => {
    const h = bolehSuntingPenduduk('MENINGGAL');
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('peristiwa kependudukan');
  });

  it('penduduk pindah tidak dapat disunting', () => {
    expect(bolehSuntingPenduduk('PINDAH').boleh).toBe(false);
  });
});

describe('usia dan kelompoknya', () => {
  it('menghitung usia tahun penuh', () => {
    expect(usia('1990-08-17', '2026-08-16')).toBe(35);
    expect(usia('1990-08-17', '2026-08-17')).toBe(36);
  });

  it('mengembalikan null untuk tanggal yang tidak masuk akal', () => {
    expect(usia('bukan-tanggal', '2026-01-01')).toBeNull();
    expect(usia('2030-01-01', '2026-01-01')).toBeNull();
  });

  it('mengelompokkan usia', () => {
    expect(kelompokUsia(3)).toBe('BALITA');
    expect(kelompokUsia(10)).toBe('ANAK');
    expect(kelompokUsia(16)).toBe('REMAJA');
    expect(kelompokUsia(35)).toBe('DEWASA');
    expect(kelompokUsia(65)).toBe('LANSIA');
  });

  it('wajib KTP pada usia tujuh belas atau sudah kawin', () => {
    expect(wajibKtp(16, 'BELUM_KAWIN')).toBe(false);
    expect(wajibKtp(17, 'BELUM_KAWIN')).toBe(true);
    // Yang menikah di bawah tujuh belas tetap wajib.
    expect(wajibKtp(16, 'KAWIN')).toBe(true);
    expect(wajibKtp(16, 'CERAI_HIDUP')).toBe(true);
  });
});

describe('penyajian agregat', () => {
  it('menyembunyikan cacah di bawah ambang', () => {
    /*
     * Jumlah penyandang disabilitas per RT yang isinya satu orang bukan agregat
     * — ia adalah penyebutan orang itu dengan cara lain, dan tetangganya tahu
     * siapa.
     */
    for (let n = 1; n < AMBANG_AGREGAT; n += 1) {
      const h = sajikanAgregat(n);
      expect(h.value).toBeNull();
      expect(h.suppressed).toBe(true);
    }
  });

  it('menampilkan cacah pada atau di atas ambang', () => {
    const h = sajikanAgregat(AMBANG_AGREGAT);
    expect(h.value).toBe(AMBANG_AGREGAT);
    expect(h.suppressed).toBe(false);
  });

  it('nol ditampilkan apa adanya', () => {
    // Nol tidak menunjuk siapa pun, jadi tidak perlu disembunyikan — dan
    // menyembunyikannya justru mengesankan ada yang ditutupi.
    const h = sajikanAgregat(0);
    expect(h.value).toBe(0);
    expect(h.suppressed).toBe(false);
  });
});
