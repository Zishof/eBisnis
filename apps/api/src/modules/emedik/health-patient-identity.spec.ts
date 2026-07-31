/**
 * Pengujian aturan identitas pasien.
 *
 * Satu hal dijaga lebih ketat daripada yang lain: **melewatkan penggandaan
 * jauh lebih berbahaya daripada menanyakannya.** Petugas yang ditanya
 * kehilangan sepuluh detik; petugas yang tidak ditanya membuat rekam medis
 * kedua yang alerginya tidak terlihat selamanya.
 */

import {
  AMBANG_DUGAAN,
  AMBANG_TAHAN,
  arahGabung,
  bolehGabung,
  kemiripanNama,
  keyakinanIdentitas,
  nikSahBentuknya,
  normalkanNama,
  normalkanTelepon,
  skorPenggandaan,
  susunNomorRekamMedis,
} from './health-patient-identity';

describe('normalisasi nama', () => {
  it('membuang gelar dan sapaan', () => {
    expect(normalkanNama('Dr. Siti Aminah')).toBe('siti aminah');
    expect(normalkanNama('Hj. Fatimah')).toBe('fatimah');
    expect(normalkanNama('Ny. Sri Wahyuni')).toBe('sri wahyuni');
  });

  it('tidak memotong huruf di tengah nama', () => {
    /*
     * Gelar dibuang sebagai kata utuh. Bila dibuang sebagai potongan huruf,
     * "Harry" kehilangan "h"-nya dan "Ahmad" kehilangan "h" di tengah —
     * lalu dua nama yang berbeda menjadi tampak sama.
     */
    expect(normalkanNama('Harry Sutanto')).toBe('harry sutanto');
    expect(normalkanNama('Ahmad Dahlan')).toBe('ahmad dahlan');
    expect(normalkanNama('Ir. Iryanto')).toBe('iryanto');
  });

  it('merapikan spasi dan tanda baca', () => {
    expect(normalkanNama('  Siti   Aminah  ')).toBe('siti aminah');
    expect(normalkanNama("Siti'Aminah")).toBe('siti aminah');
  });
});

describe('normalisasi telepon', () => {
  it('menyatukan bentuk 62, +62, dan 0', () => {
    const bentuk = ['081234567890', '+6281234567890', '6281234567890', '81234567890'];
    const hasil = new Set(bentuk.map(normalkanTelepon));
    expect(hasil.size).toBe(1);
    expect([...hasil][0]).toBe('081234567890');
  });

  it('membuang pemisah', () => {
    expect(normalkanTelepon('0812-3456-7890')).toBe('081234567890');
    expect(normalkanTelepon('(021) 555 1234')).toBe('0215551234');
  });
});

describe('bentuk NIK', () => {
  it('menerima NIK yang bentuknya sah', () => {
    // 3201 01 150385 0001 — laki-laki lahir 15 Maret 1985
    expect(nikSahBentuknya('3201011503850001')).toBe(true);
  });

  it('menerima NIK perempuan yang harinya ditambah 40', () => {
    expect(nikSahBentuknya('3201015503850001')).toBe(true);
  });

  it('menolak yang bukan 16 angka', () => {
    expect(nikSahBentuknya('320101150385000')).toBe(false);
    expect(nikSahBentuknya('32010115038500012')).toBe(false);
    expect(nikSahBentuknya('320101150385000a')).toBe(false);
  });

  it('menolak tanggal yang mustahil', () => {
    expect(nikSahBentuknya('3201019903850001')).toBe(false); // hari 99
    expect(nikSahBentuknya('3201011513850001')).toBe(false); // bulan 13
  });

  it('menolak kode wilayah nol', () => {
    expect(nikSahBentuknya('0000001503850001')).toBe(false);
  });

  it('hanya memeriksa bentuk, bukan keberadaan', () => {
    // NIK yang bentuknya sah belum tentu ada. Membedakan keduanya penting:
    // yang lolos di sini tetap berkeyakinan rendah sampai tercocokkan.
    expect(nikSahBentuknya('9999011503850001')).toBe(true);
  });
});

describe('kemiripan nama', () => {
  it('nama sama persis bernilai satu', () => {
    expect(kemiripanNama('Siti Aminah', 'Siti Aminah')).toBe(1);
    expect(kemiripanNama('Siti Aminah', 'SITI AMINAH')).toBe(1);
  });

  it('urutan nama yang tertukar tetap sangat mirip', () => {
    /*
     * Urutan nama depan dan belakang tidak konsisten di Indonesia; satu berkas
     * menulis "Siti Aminah", berkas lain "Aminah Siti", dan keduanya orang
     * yang sama.
     */
    expect(kemiripanNama('Siti Aminah', 'Aminah Siti')).toBeGreaterThanOrEqual(0.9);
  });

  it('salah ketik satu huruf tetap mirip', () => {
    expect(kemiripanNama('Muhammad', 'Muhamad')).toBeGreaterThanOrEqual(0.8);
  });

  it('nama berbeda tidak mirip', () => {
    expect(kemiripanNama('Siti Aminah', 'Budi Santoso')).toBeLessThan(0.5);
  });

  it('nama kosong tidak pernah mirip', () => {
    expect(kemiripanNama('', 'Siti')).toBe(0);
  });
});

describe('penilaian penggandaan', () => {
  it('NIK sama berarti orang yang sama, tanpa pertimbangan lain', () => {
    /*
     * Bahkan bila namanya sama sekali berbeda. Satu NIK memang hanya milik
     * satu orang; nama yang berbeda berarti salah satu berkas salah tulis,
     * bukan berarti dua orang.
     */
    const hasil = skorPenggandaan(
      { fullName: 'Siti Aminah', nik: '3201011503850001' },
      { fullName: 'Budi Santoso', nik: '3201011503850001' },
    );
    expect(hasil.score).toBe(100);
    expect(hasil.blocking).toBe(true);
  });

  it('nama sama dan tanggal lahir sama menahan pendaftaran', () => {
    const hasil = skorPenggandaan(
      { fullName: 'Siti Aminah', birthDate: '1985-03-15' },
      { fullName: 'Siti Aminah', birthDate: '1985-03-15' },
    );
    expect(hasil.score).toBeGreaterThanOrEqual(AMBANG_TAHAN);
    expect(hasil.blocking).toBe(true);
  });

  it('nama mirip saja hanya menimbulkan dugaan, tidak menahan', () => {
    const hasil = skorPenggandaan(
      { fullName: 'Siti Aminah' },
      { fullName: 'Siti Aminat' },
    );
    expect(hasil.blocking).toBe(false);
  });

  it('nama ibu yang sama menaikkan keyakinan tajam', () => {
    // Pembeda terkuat sesudah NIK, dan justru itulah gunanya ditanyakan.
    const tanpa = skorPenggandaan(
      { fullName: 'Siti Aminah', birthDate: '1985-03-15' },
      { fullName: 'Siti Aminah', birthDate: '1985-03-15' },
    );
    const dengan = skorPenggandaan(
      { fullName: 'Siti Aminah', birthDate: '1985-03-15', motherName: 'Fatimah' },
      { fullName: 'Siti Aminah', birthDate: '1985-03-15', motherName: 'Fatimah' },
    );
    expect(dengan.score).toBeGreaterThan(tanpa.score);
  });

  it('nomor telepon sama menaikkan keyakinan', () => {
    const hasil = skorPenggandaan(
      { fullName: 'Siti Aminah', phone: '081234567890' },
      { fullName: 'Siti Aminah', phone: '+6281234567890' },
    );
    expect(hasil.reasons.some((r) => r.field === 'phone')).toBe(true);
  });

  it('orang berbeda tidak menimbulkan dugaan', () => {
    const hasil = skorPenggandaan(
      { fullName: 'Siti Aminah', birthDate: '1985-03-15', gender: 'FEMALE' },
      { fullName: 'Budi Santoso', birthDate: '1990-11-02', gender: 'MALE' },
    );
    expect(hasil.score).toBeLessThan(AMBANG_DUGAAN);
    expect(hasil.blocking).toBe(false);
  });

  it('skor tidak pernah melebihi seratus', () => {
    const hasil = skorPenggandaan(
      {
        fullName: 'Siti Aminah',
        birthDate: '1985-03-15',
        gender: 'FEMALE',
        phone: '081234567890',
        motherName: 'Fatimah',
      },
      {
        fullName: 'Siti Aminah',
        birthDate: '1985-03-15',
        gender: 'FEMALE',
        phone: '081234567890',
        motherName: 'Fatimah',
      },
    );
    expect(hasil.score).toBeLessThanOrEqual(100);
  });

  it('setiap alasan menyebut medan dan bobotnya', () => {
    // Petugas yang menilai perlu tahu MENGAPA sistem menduga. "Nama dan
    // tanggal lahir sama persis" berbeda jauh dari "nama mirip".
    const hasil = skorPenggandaan(
      { fullName: 'Siti Aminah', birthDate: '1985-03-15' },
      { fullName: 'Siti Aminah', birthDate: '1985-03-15' },
    );
    for (const r of hasil.reasons) {
      expect(r.field).toBeTruthy();
      expect(r.weight).toBeGreaterThan(0);
      expect(r.detail.length).toBeGreaterThan(5);
    }
  });

  it('penilaian setangkup — urutannya tidak mengubah hasil', () => {
    const a = { fullName: 'Siti Aminah', birthDate: '1985-03-15', phone: '081234567890' };
    const b = { fullName: 'Siti Aminat', birthDate: '1985-03-15' };
    expect(skorPenggandaan(a, b).score).toBe(skorPenggandaan(b, a).score);
  });
});

describe('keyakinan identitas', () => {
  it('NIK terverifikasi menghasilkan keyakinan tertinggi', () => {
    expect(
      keyakinanIdentitas({ nikVerified: true, hasNik: true, hasBirthDate: true, selfRegistered: false }),
    ).toBe('VERIFIED');
  });

  it('pendaftaran mandiri tidak pernah berkeyakinan tinggi', () => {
    /*
     * Pendaftaran daring tanpa verifikasi bukan cacat — yang berbahaya adalah
     * memperlakukannya seolah terverifikasi, lalu mempercayainya saat
     * mencocokkan pasien di loket.
     */
    const hasil = keyakinanIdentitas({
      nikVerified: false,
      hasNik: true,
      hasBirthDate: true,
      selfRegistered: true,
    });
    expect(['LOW', 'MEDIUM']).toContain(hasil);
    expect(hasil).not.toBe('HIGH');
  });

  it('tanpa tanggal lahir berkeyakinan rendah', () => {
    expect(
      keyakinanIdentitas({ nikVerified: false, hasNik: false, hasBirthDate: false, selfRegistered: false }),
    ).toBe('LOW');
  });
});

describe('nomor rekam medis', () => {
  it('menyertakan awalan fasilitas', () => {
    // Satu pasien punya nomor berbeda di setiap fasilitas; nomor tanpa awalan
    // tidak dapat dibedakan asalnya saat berkas dirujuk antar fasilitas.
    expect(susunNomorRekamMedis('RSMS', 42)).toBe('RSMS-000042');
  });

  it('membersihkan awalan yang mengandung tanda baca', () => {
    expect(susunNomorRekamMedis('RS-Mitra Sehat', 7)).toBe('RSMITRAS-000007');
  });

  it('memberi awalan cadangan bila kosong', () => {
    expect(susunNomorRekamMedis('', 1)).toBe('MRN-000001');
    expect(susunNomorRekamMedis('###', 1)).toBe('MRN-000001');
  });

  it('padding dapat diatur', () => {
    expect(susunNomorRekamMedis('RSMS', 42, 4)).toBe('RSMS-0042');
  });
});

describe('penggabungan rekam medis', () => {
  const dasar = {
    sourceId: 'A',
    targetId: 'B',
    sourceMergedInto: null,
    targetMergedInto: null,
    sourceDeceasedAt: null,
    targetDeceasedAt: null,
    sourceNik: null,
    targetNik: null,
    reason: 'Terbukti orang yang sama setelah dicocokkan dengan KTP.',
  };

  it('mengizinkan penggabungan yang wajar', () => {
    expect(bolehGabung(dasar).allowed).toBe(true);
  });

  it('menolak penggabungan dengan diri sendiri', () => {
    expect(bolehGabung({ ...dasar, targetId: 'A' }).allowed).toBe(false);
  });

  it('menolak bila NIK berbeda', () => {
    /*
     * Dua NIK berbeda berarti dua orang berbeda, apa pun kemiripan namanya.
     * Menggabungkannya menempelkan riwayat medis satu orang kepada orang lain —
     * alergi yang bukan miliknya, golongan darah yang bukan miliknya.
     */
    const v = bolehGabung({
      ...dasar,
      sourceNik: '3201011503850001',
      targetNik: '3201011503850002',
    });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('NIK');
  });

  it('mengizinkan bila hanya salah satu punya NIK', () => {
    // Keadaan yang umum: berkas lama tanpa NIK, berkas baru dengan NIK.
    expect(bolehGabung({ ...dasar, targetNik: '3201011503850001' }).allowed).toBe(true);
  });

  it('menolak sumber yang sudah pernah digabungkan', () => {
    const v = bolehGabung({ ...dasar, sourceMergedInto: 'C' });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('Batalkan');
  });

  it('menolak tujuan yang sendiri sudah digabungkan, dan mengarahkan ke induknya', () => {
    const v = bolehGabung({ ...dasar, targetMergedInto: 'C' });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('induk');
  });

  it('menuntut alasan yang bermakna', () => {
    expect(bolehGabung({ ...dasar, reason: '' }).allowed).toBe(false);
    expect(bolehGabung({ ...dasar, reason: 'ok' }).allowed).toBe(false);
    expect(bolehGabung({ ...dasar, reason: '   sama saja   ' }).allowed).toBe(false);
  });
});

describe('arah penggabungan', () => {
  it('rekam medis dengan riwayat lebih banyak menjadi tujuan', () => {
    // Yang dipindahkan lebih sedikit, sehingga risiko kehilangan lebih kecil.
    const hasil = arahGabung(
      { id: 'A', createdAt: '2024-01-01', recordCount: 3 },
      { id: 'B', createdAt: '2025-01-01', recordCount: 40 },
    );
    expect(hasil.targetId).toBe('B');
    expect(hasil.sourceId).toBe('A');
  });

  it('bila riwayatnya sama banyak, yang lebih dahulu dibuat menjadi tujuan', () => {
    const hasil = arahGabung(
      { id: 'A', createdAt: '2024-01-01', recordCount: 5 },
      { id: 'B', createdAt: '2025-01-01', recordCount: 5 },
    );
    expect(hasil.targetId).toBe('A');
  });

  it('selalu menyebutkan alasan pilihannya', () => {
    const hasil = arahGabung(
      { id: 'A', createdAt: '2024-01-01', recordCount: 3 },
      { id: 'B', createdAt: '2025-01-01', recordCount: 40 },
    );
    expect(hasil.reason.length).toBeGreaterThan(10);
  });
});
