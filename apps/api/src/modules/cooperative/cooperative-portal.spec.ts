/**
 * Pengujian aturan portal anggota.
 *
 * Satu aturan dijaga paling ketat:
 *
 *   **Anggota hanya melihat dirinya sendiri.**
 *
 * Portal adalah satu-satunya bagian sistem yang dibuka kepada ratusan orang
 * yang bukan pengurus. Seorang anggota yang dapat membaca simpanan tetangganya
 * adalah kebocoran yang tidak dapat ditarik kembali — dan tetangga itu tidak
 * akan pernah tahu bahwa datanya pernah terbaca.
 */

import {
  COMPLAINT_STATUSES,
  COMPLAINT_TRANSITIONS,
  MEDAN_TERLARANG,
  PIN_MAKSIMUM_GAGAL,
  PORTAL_RESOURCES,
  SUMBER_DAYA_BERSAMA,
  bersihkan,
  bolehAnggotaMenutup,
  bolehKasirMengaksesPin,
  bolehMembaca,
  bolehMendaftarPublik,
  bolehPindahStatusPengaduan,
  bolehVerifikasiPin,
  samarkanIdentitas,
  samarkanRekening,
  saring,
  setelahPinSalah,
  type AksesInput,
  type ComplaintStatus,
} from './cooperative-portal';

const akses = (over: Partial<AksesInput> = {}): AksesInput => ({
  resource: 'SAVING_ACCOUNT',
  viewerMemberId: 'M1',
  ownerMemberId: 'M1',
  viewerStatus: 'ACTIVE',
  cooperativeIdOfViewer: 'K1',
  cooperativeIdOfRow: 'K1',
  ...over,
});

describe('anggota hanya melihat dirinya sendiri', () => {
  it('mengizinkan membaca barisnya sendiri', () => {
    expect(bolehMembaca(akses()).allowed).toBe(true);
  });

  it('MENOLAK membaca baris anggota lain', () => {
    const v = bolehMembaca(akses({ ownerMemberId: 'M2' }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('NOT_OWNER');
  });

  it('penolakan TIDAK menyebutkan bahwa barisnya ada', () => {
    /*
     * "Anda tidak berhak membaca data anggota M2" sudah memberitahu bahwa M2
     * ada dan punya data. Pada portal yang dibuka kepada ratusan orang,
     * keterangan sebanyak itu tidak diperlukan siapa pun kecuali yang sedang
     * mencari tahu.
     */
    for (const kasus of [
      akses({ ownerMemberId: 'M2' }),
      akses({ cooperativeIdOfRow: 'K2' }),
      akses({ ownerMemberId: null }),
    ]) {
      expect(bolehMembaca(kasus).message).toBe('Data tidak ditemukan.');
    }
  });

  it('MENOLAK membaca lintas koperasi', () => {
    const v = bolehMembaca(akses({ cooperativeIdOfRow: 'K2' }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('CROSS_COOPERATIVE');
  });

  it('lintas koperasi diperiksa LEBIH DAHULU daripada kepemilikan', () => {
    // Anggota koperasi lain tidak boleh mengetahui keberadaan barisnya sama
    // sekali, bahkan bila kebetulan id anggotanya sama.
    const v = bolehMembaca(akses({ cooperativeIdOfRow: 'K2', ownerMemberId: 'M1' }));
    expect(v.code).toBe('CROSS_COOPERATIVE');
  });

  it('bekas anggota kehilangan akses portal', () => {
    /*
     * Datanya tidak dihapus — masih diperlukan untuk penyelesaian dan audit.
     * Yang hilang hanyalah kemampuannya membaca lewat portal.
     */
    const v = bolehMembaca(akses({ viewerStatus: 'TERMINATED' }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('MEMBERSHIP_ENDED');
    expect(v.message).toContain('Hubungi pengurus');
  });

  it('rapat anggota dapat dibaca setiap anggota', () => {
    // Milik seluruh anggota: setiap anggota berhak membaca agenda, kuorum, dan
    // keputusannya.
    expect(
      bolehMembaca(akses({ resource: 'MEETING', ownerMemberId: null })).allowed,
    ).toBe(true);
  });

  it('SUARA tetap milik perorangan meski rapatnya bersama', () => {
    expect(SUMBER_DAYA_BERSAMA).not.toContain('VOTE');
    expect(bolehMembaca(akses({ resource: 'VOTE', ownerMemberId: 'M2' })).allowed).toBe(false);
  });

  it('hanya rapat yang bersifat bersama', () => {
    expect(SUMBER_DAYA_BERSAMA).toEqual(['MEETING']);
    for (const r of PORTAL_RESOURCES) {
      if (SUMBER_DAYA_BERSAMA.includes(r)) continue;
      expect(bolehMembaca(akses({ resource: r, ownerMemberId: 'M2' })).allowed).toBe(false);
    }
  });

  it('baris tanpa pemilik ditolak, bukan diloloskan', () => {
    // Baris yang tidak diketahui pemiliknya lebih baik ditolak. Meloloskannya
    // berarti setiap cacat pemetaan menjadi kebocoran.
    expect(bolehMembaca(akses({ ownerMemberId: null })).allowed).toBe(false);
  });
});

describe('penyaringan daftar', () => {
  const baris = [
    { memberId: 'M1', cooperativeId: 'K1', nilai: 1 },
    { memberId: 'M2', cooperativeId: 'K1', nilai: 2 },
    { memberId: 'M1', cooperativeId: 'K2', nilai: 3 },
    { memberId: null, cooperativeId: 'K1', nilai: 4 },
  ];

  it('menyisakan hanya baris milik pembacanya', () => {
    const h = saring(baris, {
      viewerMemberId: 'M1',
      viewerStatus: 'ACTIVE',
      cooperativeId: 'K1',
      resource: 'SAVING_ACCOUNT',
    });
    expect(h).toHaveLength(1);
    expect(h[0].nilai).toBe(1);
  });

  it('bekas anggota tidak melihat apa pun', () => {
    expect(
      saring(baris, {
        viewerMemberId: 'M1',
        viewerStatus: 'TERMINATED',
        cooperativeId: 'K1',
        resource: 'SAVING_ACCOUNT',
      }),
    ).toEqual([]);
  });

  it('sumber daya bersama menyisakan yang sekoperasi saja', () => {
    const h = saring(baris, {
      viewerMemberId: 'M1',
      viewerStatus: 'ACTIVE',
      cooperativeId: 'K1',
      resource: 'MEETING',
    });
    expect(h.map((b) => b.nilai).sort()).toEqual([1, 2, 4]);
  });
});

describe('medan yang tidak pernah dikirim ke portal', () => {
  it('membuang medan terlarang', () => {
    const bersih = bersihkan({
      id: 'X',
      name: 'Siti',
      pin_hash: '$argon2id$...',
      identity_number: '3271010101900001',
      notes: 'Analisis kredit rahasia',
      balance: 500_000,
    });
    expect(bersih.id).toBe('X');
    expect(bersih.balance).toBe(500_000);
    expect(bersih).not.toHaveProperty('pin_hash');
    expect(bersih).not.toHaveProperty('identity_number');
    expect(bersih).not.toHaveProperty('notes');
  });

  it('PIN dan kata sandi selalu termasuk yang dibuang', () => {
    expect(MEDAN_TERLARANG).toContain('pin_hash');
    expect(MEDAN_TERLARANG).toContain('password_hash');
  });

  it('taksiran agunan dan skor analisis termasuk yang dibuang', () => {
    // Anggota tidak perlu tahu bagaimana agunannya ditaksir maupun berapa skor
    // karakternya; keduanya penilaian internal yang mudah disalahpahami.
    for (const m of ['appraised_value', 'estimated_value', 'character_score']) {
      expect(MEDAN_TERLARANG).toContain(m);
    }
  });

  it('objek tanpa medan terlarang tidak berubah', () => {
    const asli = { id: 'X', balance: 1000 };
    expect(bersihkan(asli)).toEqual(asli);
  });
});

describe('penyamaran nomor', () => {
  it('menyisakan empat angka terakhir rekening', () => {
    expect(samarkanRekening('1234567890')).toBe('******7890');
  });

  it('menyisakan dua di depan dan empat di belakang pada identitas', () => {
    expect(samarkanIdentitas('3271010101900001')).toBe('32**********0001');
  });

  it('nomor pendek disamarkan seluruhnya', () => {
    expect(samarkanRekening('123')).toBe('***');
    expect(samarkanIdentitas('12345')).toBe('*****');
  });

  it('nilai kosong tetap kosong', () => {
    expect(samarkanRekening(null)).toBeNull();
    expect(samarkanIdentitas(null)).toBeNull();
  });

  it('spasi diabaikan sebelum disamarkan', () => {
    expect(samarkanRekening('1234 5678 90')).toBe('******7890');
  });
});

describe('PIN anggota', () => {
  const now = '2026-08-01T10:00:00.000Z';

  it('menolak verifikasi bila PIN belum diatur', () => {
    const v = bolehVerifikasiPin({ pinSetAt: null, failedCount: 0, lockedUntil: null, now });
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('PIN_NOT_SET');
  });

  it('mengizinkan verifikasi pada keadaan biasa', () => {
    expect(
      bolehVerifikasiPin({ pinSetAt: '2026-01-01', failedCount: 2, lockedUntil: null, now }).allowed,
    ).toBe(true);
  });

  it('menolak selama masih terkunci', () => {
    const v = bolehVerifikasiPin({
      pinSetAt: '2026-01-01',
      failedCount: 5,
      lockedUntil: '2026-08-01T10:30:00.000Z',
      now,
    });
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('PIN_LOCKED');
  });

  it('mengizinkan lagi setelah kuncinya lewat', () => {
    expect(
      bolehVerifikasiPin({
        pinSetAt: '2026-01-01',
        failedCount: 5,
        lockedUntil: '2026-08-01T09:00:00.000Z',
        now,
      }).allowed,
    ).toBe(true);
  });

  it('mengunci setelah lima percobaan salah', () => {
    /*
     * PIN yang dapat dicoba tanpa batas bukan PIN melainkan tebakan bernomor
     * empat angka.
     */
    let keadaan = { pinSetAt: '2026-01-01', failedCount: 0, lockedUntil: null as string | null, now };
    for (let i = 1; i < PIN_MAKSIMUM_GAGAL; i += 1) {
      const h = setelahPinSalah(keadaan);
      expect(h.locked).toBe(false);
      keadaan = { ...keadaan, failedCount: h.failedCount };
    }
    const terakhir = setelahPinSalah(keadaan);
    expect(terakhir.locked).toBe(true);
    expect(terakhir.lockedUntil).toBeTruthy();
  });

  it('KASIR tidak pernah dapat melihat maupun mengatur PIN', () => {
    // Spesifikasi §14. Kasir yang mengetahui PIN seorang anggota dapat memakai
    // saldonya.
    const v = bolehKasirMengaksesPin();
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('portal');
  });
});

describe('pengaduan', () => {
  it('setiap status punya entri transisi', () => {
    for (const s of COMPLAINT_STATUSES) expect(COMPLAINT_TRANSITIONS[s]).toBeDefined();
  });

  it('pengaduan yang selesai dapat dibuka kembali', () => {
    // Anggota yang merasa penyelesaiannya belum memadai tidak harus membuat
    // pengaduan baru dari nol.
    expect(bolehPindahStatusPengaduan('RESOLVED', 'IN_PROGRESS').allowed).toBe(true);
  });

  it('pengaduan yang ditutup bersifat final', () => {
    expect(COMPLAINT_TRANSITIONS.CLOSED).toEqual([]);
  });

  it('setiap status dapat mencapai penutupan', () => {
    const tercapai = new Set<ComplaintStatus>(['SUBMITTED']);
    let berubah = true;
    while (berubah) {
      berubah = false;
      for (const s of [...tercapai]) {
        for (const t of COMPLAINT_TRANSITIONS[s]) {
          if (!tercapai.has(t)) {
            tercapai.add(t);
            berubah = true;
          }
        }
      }
    }
    expect(tercapai.has('CLOSED')).toBe(true);
  });

  it('ANGGOTA tidak dapat menutup pengaduannya sendiri', () => {
    /*
     * Pengaduan yang dapat ditutup pelapornya sendiri mudah ditutup oleh orang
     * yang ditegur isinya — dengan meminta pelapornya menutupnya.
     */
    const v = bolehAnggotaMenutup();
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('wewenang pengurus');
  });
});

describe('pendaftaran calon anggota lewat situs', () => {
  const dasar = {
    cooperativeStatus: 'ACTIVE',
    membershipScope: 'OPEN',
    acceptsOnlineApplication: true,
  };

  it('mengizinkan pada koperasi aktif yang membuka pendaftaran', () => {
    expect(bolehMendaftarPublik(dasar).allowed).toBe(true);
  });

  it('MENOLAK pada koperasi yang belum berbadan hukum', () => {
    /*
     * Koperasi yang belum aktif belum sah menghimpun simpanan, dan simpanan
     * pokok adalah hal pertama yang diminta dari calon anggota.
     */
    const v = bolehMendaftarPublik({ ...dasar, cooperativeStatus: 'DRAFT' });
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('COOPERATIVE_NOT_ACTIVE');
  });

  it('menolak bila pendaftaran daring ditutup', () => {
    expect(
      bolehMendaftarPublik({ ...dasar, acceptsOnlineApplication: false }).code,
    ).toBe('ONLINE_APPLICATION_CLOSED');
  });

  it('menolak pada koperasi tertutup', () => {
    expect(bolehMendaftarPublik({ ...dasar, membershipScope: 'CLOSED' }).code).toBe(
      'MEMBERSHIP_CLOSED',
    );
  });

  it('koperasi karyawan tetap menerima pendaftaran, syaratnya diperiksa kemudian', () => {
    // Kelayakan lingkupnya diperiksa pada K-2, bukan di gerbang pendaftaran —
    // supaya calon anggota memperoleh keterangan yang tepat tentang syarat mana
    // yang belum ia penuhi.
    expect(bolehMendaftarPublik({ ...dasar, membershipScope: 'EMPLOYEE' }).allowed).toBe(true);
  });
});
