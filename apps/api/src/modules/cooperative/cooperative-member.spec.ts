/**
 * Pengujian aturan keanggotaan.
 *
 * Satu aturan dijaga paling ketat, dan ia diperiksa dari beberapa arah:
 *
 *   **Seseorang menjadi anggota hanya setelah simpanan pokoknya lunas.**
 *
 * Anggota yang aktif tanpa simpanan pokok akan memperoleh SHU atas modal yang
 * tidak pernah disetorkannya, dengan mengurangi bagian anggota lain.
 */

import {
  MEMBER_STATUSES,
  MEMBER_TRANSITIONS,
  RANGKAP_TERLARANG,
  USIA_MINIMUM,
  anggotaPenuh,
  bolehDiaktifkan,
  bolehDitutup,
  bolehMenjabat,
  bolehMerangkap,
  bolehPindahStatus,
  hitungPenyelesaian,
  layakMendaftar,
  masihCalon,
  periksaKelayakan,
  susunNomorAnggota,
  tumpangTindih,
  type KelayakanInput,
  type MemberStatus,
} from './cooperative-member';

const layak = (over: Partial<KelayakanInput> = {}): KelayakanInput => ({
  age: 30,
  hasIdentityNumber: true,
  withinServiceArea: true,
  membershipScope: 'OPEN',
  meetsScopeRequirement: true,
  hasActiveMembershipElsewhereInSameCooperative: false,
  hasUnsettledPriorMembership: false,
  ...over,
});

describe('tabel transisi keanggotaan', () => {
  it('setiap status punya entri', () => {
    for (const s of MEMBER_STATUSES) expect(MEMBER_TRANSITIONS[s]).toBeDefined();
  });

  it('tidak menunjuk status yang tidak ada', () => {
    const dikenal = new Set<string>(MEMBER_STATUSES);
    for (const tujuan of Object.values(MEMBER_TRANSITIONS)) {
      for (const t of tujuan) expect(dikenal.has(t)).toBe(true);
    }
  });

  it('setiap status dapat dicapai dari PROSPECT', () => {
    const tercapai = new Set<MemberStatus>(['PROSPECT']);
    let berubah = true;
    while (berubah) {
      berubah = false;
      for (const s of [...tercapai]) {
        for (const t of MEMBER_TRANSITIONS[s]) {
          if (!tercapai.has(t)) {
            tercapai.add(t);
            berubah = true;
          }
        }
      }
    }
    expect(MEMBER_STATUSES.filter((s) => !tercapai.has(s))).toEqual([]);
  });

  it('pemberhentian bersifat akhir', () => {
    expect(MEMBER_TRANSITIONS.TERMINATED).toEqual([]);
    const v = bolehPindahStatus('TERMINATED', 'ACTIVE');
    expect(v.allowed).toBe(false);
    // Pesannya menyebutkan jalan yang benar: mendaftar ulang sebagai calon baru.
    expect(v.message).toContain('calon anggota baru');
  });

  it('setiap status dapat berakhir dengan pemberhentian', () => {
    for (const s of MEMBER_STATUSES) {
      if (s === 'TERMINATED') continue;
      expect(bolehPindahStatus(s, 'TERMINATED').allowed).toBe(true);
    }
  });

  it('pengunduran diri dapat dibatalkan sebelum diproses', () => {
    expect(bolehPindahStatus('RESIGNING', 'ACTIVE').allowed).toBe(true);
  });

  it('menolak lompatan dari calon langsung ke aktif', () => {
    // Melompati PENDING_PRINCIPAL_SAVING berarti melompati pembayaran simpanan
    // pokok — hal yang justru menjadi pembeda anggota dari calon anggota.
    expect(bolehPindahStatus('PENDING_VERIFICATION', 'ACTIVE').allowed).toBe(false);
    expect(bolehPindahStatus('APPROVED', 'ACTIVE').allowed).toBe(false);
  });

  it('pengaktifan tidak menuntut hak akses tersendiri', () => {
    /*
     * Sengaja. Pengaktifan bukan keputusan manusia melainkan akibat lunasnya
     * simpanan pokok. Memberinya hak akses akan membuka jalan bagi petugas
     * untuk mengaktifkan anggota yang belum membayar.
     */
    const v = bolehPindahStatus('PENDING_PRINCIPAL_SAVING', 'ACTIVE');
    expect(v.allowed).toBe(true);
    expect(v.requiresPermission).toBeUndefined();
  });

  it('persetujuan calon anggota menuntut hak akses', () => {
    expect(bolehPindahStatus('PENDING_VERIFICATION', 'APPROVED').requiresPermission).toBe(
      'COOPERATIVE_PROSPECT.APPROVE',
    );
  });
});

describe('anggota penuh versus calon anggota', () => {
  it('hanya ACTIVE yang merupakan anggota penuh', () => {
    for (const s of MEMBER_STATUSES) {
      expect(anggotaPenuh(s)).toBe(s === 'ACTIVE');
    }
  });

  it('yang sudah disetujui pengurus MASIH calon anggota', () => {
    /*
     * Keadaan yang paling mudah disalahpahami. APPROVED berarti pengurus
     * menyetujui, bukan berarti simpanan pokoknya sudah dibayar — dan yang
     * menentukan adalah pembayarannya.
     */
    expect(masihCalon('APPROVED')).toBe(true);
    expect(masihCalon('PENDING_PRINCIPAL_SAVING')).toBe(true);
    expect(anggotaPenuh('APPROVED')).toBe(false);
  });

  it('anggota tidak aktif bukan calon anggota', () => {
    // Ia pernah menjadi anggota penuh; haknya berbeda dari calon anggota.
    expect(masihCalon('INACTIVE')).toBe(false);
    expect(anggotaPenuh('INACTIVE')).toBe(false);
  });

  it('tidak ada status yang sekaligus anggota penuh dan calon', () => {
    for (const s of MEMBER_STATUSES) {
      expect(anggotaPenuh(s) && masihCalon(s)).toBe(false);
    }
  });
});

describe('pengaktifan menuntut simpanan pokok lunas', () => {
  it('mengizinkan bila lunas', () => {
    expect(
      bolehDiaktifkan({
        status: 'PENDING_PRINCIPAL_SAVING',
        principalSavingRequired: 500000,
        principalSavingPaid: 500000,
      }).allowed,
    ).toBe(true);
  });

  it('mengizinkan bila lebih dari cukup', () => {
    expect(
      bolehDiaktifkan({
        status: 'PENDING_PRINCIPAL_SAVING',
        principalSavingRequired: 500000,
        principalSavingPaid: 600000,
      }).allowed,
    ).toBe(true);
  });

  it('MENOLAK bila kurang, dan menyebutkan kekurangannya', () => {
    const v = bolehDiaktifkan({
      status: 'PENDING_PRINCIPAL_SAVING',
      principalSavingRequired: 500000,
      principalSavingPaid: 300000,
    });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('200000');
  });

  it('MENOLAK bila belum membayar sama sekali', () => {
    expect(
      bolehDiaktifkan({
        status: 'APPROVED',
        principalSavingRequired: 500000,
        principalSavingPaid: 0,
      }).allowed,
    ).toBe(false);
  });

  it('menolak pengaktifan dari status yang belum sampai tahapnya', () => {
    for (const s of ['PROSPECT', 'PENDING_VERIFICATION'] as MemberStatus[]) {
      expect(
        bolehDiaktifkan({ status: s, principalSavingRequired: 0, principalSavingPaid: 0 }).allowed,
      ).toBe(false);
    }
  });

  it('menolak pengaktifan ulang atas anggota yang sudah aktif', () => {
    expect(
      bolehDiaktifkan({
        status: 'ACTIVE',
        principalSavingRequired: 500000,
        principalSavingPaid: 500000,
      }).allowed,
    ).toBe(false);
  });

  it('tidak ada jalan memaksa aktif tanpa membayar', () => {
    // Fungsi ini adalah satu-satunya jalan menuju ACTIVE, dan ia tidak menerima
    // parameter "paksa" apa pun. Uji ini menjaga sifat itu tetap ada.
    const kombinasi: MemberStatus[] = ['APPROVED', 'PENDING_PRINCIPAL_SAVING'];
    for (const s of kombinasi) {
      for (const dibayar of [0, 1, 499999]) {
        expect(
          bolehDiaktifkan({
            status: s,
            principalSavingRequired: 500000,
            principalSavingPaid: dibayar,
          }).allowed,
        ).toBe(false);
      }
    }
  });
});

describe('kelayakan mendaftar', () => {
  it('meloloskan calon yang memenuhi syarat', () => {
    expect(periksaKelayakan(layak())).toEqual([]);
    expect(layakMendaftar(layak())).toBe(true);
  });

  it('menolak di bawah usia minimum', () => {
    const kurang = periksaKelayakan(layak({ age: 16 }));
    expect(kurang.map((k) => k.code)).toContain('AGE_BELOW_MINIMUM');
    expect(kurang[0].message).toContain(String(USIA_MINIMUM));
  });

  it('menolak tanpa nomor identitas', () => {
    expect(periksaKelayakan(layak({ hasIdentityNumber: false })).map((k) => k.code)).toContain(
      'IDENTITY_MISSING',
    );
  });

  it('menolak di luar wilayah kerja', () => {
    expect(periksaKelayakan(layak({ withinServiceArea: false })).map((k) => k.code)).toContain(
      'OUTSIDE_SERVICE_AREA',
    );
  });

  it('koperasi terbuka tidak menuntut syarat lingkup', () => {
    expect(
      periksaKelayakan(layak({ membershipScope: 'OPEN', meetsScopeRequirement: false })),
    ).toEqual([]);
  });

  it('koperasi karyawan menuntut syarat lingkup', () => {
    const kurang = periksaKelayakan(
      layak({ membershipScope: 'EMPLOYEE', meetsScopeRequirement: false }),
    );
    expect(kurang.map((k) => k.code)).toContain('SCOPE_REQUIREMENT_UNMET');
    expect(kurang.find((k) => k.code === 'SCOPE_REQUIREMENT_UNMET')?.message).toContain('karyawan');
  });

  it('menolak yang sudah menjadi anggota aktif', () => {
    expect(
      periksaKelayakan(layak({ hasActiveMembershipElsewhereInSameCooperative: true })).map(
        (k) => k.code,
      ),
    ).toContain('ALREADY_MEMBER');
  });

  it('menolak bekas anggota yang meninggalkan tunggakan', () => {
    /*
     * Tanpa aturan ini, seseorang dapat menghapus tunggakannya dengan keluar
     * lalu mendaftar kembali sebagai orang baru.
     */
    const kurang = periksaKelayakan(layak({ hasUnsettledPriorMembership: true }));
    expect(kurang.map((k) => k.code)).toContain('PRIOR_MEMBERSHIP_UNSETTLED');
  });

  it('melaporkan seluruh kekurangan sekaligus', () => {
    const kurang = periksaKelayakan({
      age: 15,
      hasIdentityNumber: false,
      withinServiceArea: false,
      membershipScope: 'EMPLOYEE',
      meetsScopeRequirement: false,
      hasActiveMembershipElsewhereInSameCooperative: true,
      hasUnsettledPriorMembership: true,
    });
    expect(kurang.length).toBe(6);
    const kode = kurang.map((k) => k.code);
    expect(new Set(kode).size).toBe(kode.length);
  });
});

describe('kepengurusan', () => {
  const jabatan = (over: Partial<Parameters<typeof bolehMenjabat>[1]> = {}) => ({
    positionCode: 'CHAIRPERSON',
    memberId: 'M1',
    termStart: '2026-01-01',
    termEnd: '2029-12-31',
    ...over,
  });

  it('mengizinkan jabatan yang belum dipangku siapa pun', () => {
    expect(bolehMenjabat([], jabatan()).allowed).toBe(true);
  });

  it('menolak jabatan yang masih dipangku orang lain', () => {
    /*
     * Jabatan Ketua menentukan siapa yang sah menandatangani perjanjian
     * pinjaman. Dua ketua pada satu tanggal berarti dua tanda tangan yang
     * sama-sama tampak sah.
     */
    const ada = [jabatan({ memberId: 'M1' })];
    const v = bolehMenjabat(ada, jabatan({ memberId: 'M2', termStart: '2027-01-01' }));
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('CHAIRPERSON');
  });

  it('mengizinkan penggantian setelah periode sebelumnya berakhir', () => {
    const ada = [jabatan({ memberId: 'M1', termStart: '2023-01-01', termEnd: '2025-12-31' })];
    expect(bolehMenjabat(ada, jabatan({ memberId: 'M2', termStart: '2026-01-01' })).allowed).toBe(
      true,
    );
  });

  it('mengizinkan orang yang sama memperbarui jabatannya', () => {
    const ada = [jabatan({ memberId: 'M1' })];
    expect(bolehMenjabat(ada, jabatan({ memberId: 'M1' })).allowed).toBe(true);
  });

  it('jabatan berbeda tidak saling menghalangi', () => {
    const ada = [jabatan({ positionCode: 'CHAIRPERSON', memberId: 'M1' })];
    expect(
      bolehMenjabat(ada, jabatan({ positionCode: 'SECRETARY', memberId: 'M2' })).allowed,
    ).toBe(true);
  });

  it('periode tanpa tanggal akhir dianggap berlaku selamanya', () => {
    const a = jabatan({ termEnd: null });
    const b = jabatan({ memberId: 'M2', termStart: '2099-01-01' });
    expect(tumpangTindih(a, b)).toBe(true);
  });

  it('menolak rangkap jabatan pengurus dan pengawas', () => {
    // Pengawas yang merangkap pengurus mengawasi dirinya sendiri.
    const v = bolehMerangkap(['CHAIRPERSON'], 'SUPERVISOR');
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('SUPERVISOR');
  });

  it('menolak rangkap ketua dan bendahara', () => {
    // Memegang uang sekaligus memutuskan pengeluarannya.
    expect(bolehMerangkap(['TREASURER'], 'CHAIRPERSON').allowed).toBe(false);
  });

  it('aturan rangkap berlaku dua arah', () => {
    for (const [a, b] of RANGKAP_TERLARANG) {
      expect(bolehMerangkap([a], b).allowed).toBe(false);
      expect(bolehMerangkap([b], a).allowed).toBe(false);
    }
  });

  it('mengizinkan rangkap yang tidak dilarang', () => {
    expect(bolehMerangkap(['SECRETARY'], 'MANAGER').allowed).toBe(true);
  });
});

describe('nomor anggota', () => {
  it('berpola kode-tahun-urut', () => {
    expect(susunNomorAnggota('KSUALBAHJAH', 2026, 7)).toBe('KSUALBAH-2026-00007');
  });

  it('membuang aksara yang tidak sah dari kode koperasi', () => {
    expect(susunNomorAnggota('KSU Al-Bahjah', 2026, 1)).toBe('KSUALBAH-2026-00001');
  });

  it('memakai kode cadangan bila kode koperasi kosong', () => {
    expect(susunNomorAnggota('---', 2026, 1)).toBe('KOP-2026-00001');
  });

  it('urutan diisi nol di depan supaya terurut secara leksikografis', () => {
    const nomor = [1, 2, 10, 100].map((n) => susunNomorAnggota('KOP', 2026, n));
    expect([...nomor].sort()).toEqual(nomor);
  });
});

describe('penyelesaian saat berhenti', () => {
  it('mengembalikan simpanan setelah dipotong kewajiban', () => {
    const h = hitungPenyelesaian({
      principalSaving: 500000,
      mandatorySaving: 2400000,
      voluntarySaving: 1000000,
      outstandingLoan: 1500000,
      unpaidPenalty: 50000,
      pendingShu: 300000,
    });
    expect(h.totalReceivable).toBe(4200000);
    expect(h.totalPayable).toBe(1550000);
    expect(h.netToMember).toBe(2650000);
    expect(h.memberOwes).toBe(false);
  });

  it('menandai bila kewajiban melebihi simpanan', () => {
    /*
     * Anggota tidak dapat menarik modalnya sambil meninggalkan utangnya.
     * Keanggotaannya tidak dapat ditutup sebelum sisanya dilunasi.
     */
    const h = hitungPenyelesaian({
      principalSaving: 500000,
      mandatorySaving: 200000,
      voluntarySaving: 0,
      outstandingLoan: 3000000,
      unpaidPenalty: 100000,
      pendingShu: 0,
    });
    expect(h.memberOwes).toBe(true);
    expect(h.netToMember).toBe(-2400000);

    const v = bolehDitutup(h);
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('2400000');
  });

  it('mengizinkan penutupan bila tidak ada sisa kewajiban', () => {
    const h = hitungPenyelesaian({
      principalSaving: 500000,
      mandatorySaving: 0,
      voluntarySaving: 0,
      outstandingLoan: 0,
      unpaidPenalty: 0,
      pendingShu: 0,
    });
    expect(bolehDitutup(h).allowed).toBe(true);
  });

  it('kewajiban yang persis sama dengan simpanan tetap dapat ditutup', () => {
    const h = hitungPenyelesaian({
      principalSaving: 1000000,
      mandatorySaving: 0,
      voluntarySaving: 0,
      outstandingLoan: 1000000,
      unpaidPenalty: 0,
      pendingShu: 0,
    });
    expect(h.netToMember).toBe(0);
    expect(h.memberOwes).toBe(false);
    expect(bolehDitutup(h).allowed).toBe(true);
  });

  it('SHU yang belum dibayarkan ikut diperhitungkan', () => {
    const tanpaShu = hitungPenyelesaian({
      principalSaving: 500000, mandatorySaving: 0, voluntarySaving: 0,
      outstandingLoan: 600000, unpaidPenalty: 0, pendingShu: 0,
    });
    const denganShu = hitungPenyelesaian({
      principalSaving: 500000, mandatorySaving: 0, voluntarySaving: 0,
      outstandingLoan: 600000, unpaidPenalty: 0, pendingShu: 200000,
    });
    expect(tanpaShu.memberOwes).toBe(true);
    expect(denganShu.memberOwes).toBe(false);
  });
});
