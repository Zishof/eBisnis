/**
 * Pengujian aturan rapat anggota.
 *
 * Satu prinsip dijaga paling ketat, sebab ia pembeda koperasi dari perseroan:
 *
 *   **Satu anggota satu suara, berapa pun besar simpanannya.**
 *
 * Diuji secara tegas supaya seseorang tidak dapat kelak menambahkan pembobotan
 * suara berdasarkan modal — perubahan yang tampak masuk akal bagi orang yang
 * terbiasa dengan perseroan, dan yang menghapus sifat koperasi dari sistemnya.
 */

import {
  AMBANG,
  ATURAN_PER_AGENDA,
  DECISION_RULES,
  MEETING_STATUSES,
  MEETING_TRANSITIONS,
  aturanUntukAgenda,
  bolehMemilih,
  bolehPindahStatusRapat,
  hitungKuorum,
  hitungVoting,
  keabsahanKeputusan,
  saringKuasa,
  type Kehadiran,
  type Suara,
} from './cooperative-meeting';

const hadir = (id: string, mode: Kehadiran['mode'] = 'IN_PERSON', pemberi?: string): Kehadiran => ({
  memberId: id,
  mode,
  proxyHolderMemberId: pemberi ?? null,
  hasVotingRight: true,
});

const batasBiasa = { maxProxyPerHolder: 2, proxyCountsForQuorum: true };

describe('status rapat', () => {
  it('setiap status punya entri transisi', () => {
    for (const s of MEETING_STATUSES) expect(MEETING_TRANSITIONS[s]).toBeDefined();
  });

  it('rapat yang ditunda dapat dibuka kembali', () => {
    // Rapat kedua dengan syarat kuorum yang lebih ringan, sesuai AD/ART
    // kebanyakan koperasi.
    expect(bolehPindahStatusRapat('ADJOURNED', 'OPEN').allowed).toBe(true);
  });

  it('rapat yang ditutup bersifat final', () => {
    expect(MEETING_TRANSITIONS.CLOSED).toEqual([]);
    expect(bolehPindahStatusRapat('CLOSED', 'OPEN').allowed).toBe(false);
  });

  it('menolak lompatan dari terencana langsung ke terbuka', () => {
    // Rapat tanpa undangan adalah rapat yang tidak diketahui anggotanya.
    expect(bolehPindahStatusRapat('PLANNED', 'OPEN').allowed).toBe(false);
  });
});

describe('kuasa', () => {
  it('menerima kuasa dalam batasnya', () => {
    const h = saringKuasa(
      [hadir('A'), hadir('B', 'PROXY', 'A'), hadir('C', 'PROXY', 'A')],
      batasBiasa,
    );
    expect(h.valid).toHaveLength(3);
    expect(h.rejected).toHaveLength(0);
  });

  it('MENOLAK kuasa yang melebihi batas per pemegang', () => {
    /*
     * Tanpa batas, seseorang dapat mengumpulkan kuasa dari puluhan anggota dan
     * memutuskan sendiri hal yang seharusnya diputuskan bersama — cara tercepat
     * mengubah rapat anggota menjadi rapat satu orang.
     */
    const h = saringKuasa(
      [hadir('A'), hadir('B', 'PROXY', 'A'), hadir('C', 'PROXY', 'A'), hadir('D', 'PROXY', 'A')],
      batasBiasa,
    );
    expect(h.valid).toHaveLength(3);
    expect(h.rejected).toEqual([{ memberId: 'D', reason: 'PROXY_LIMIT_EXCEEDED' }]);
  });

  it('menolak seluruh kuasa bila AD/ART melarangnya', () => {
    const h = saringKuasa([hadir('A'), hadir('B', 'PROXY', 'A')], {
      maxProxyPerHolder: 0,
      proxyCountsForQuorum: false,
    });
    expect(h.valid).toHaveLength(1);
    expect(h.rejected[0].reason).toBe('PROXY_NOT_ALLOWED');
  });

  it('menolak kuasa kepada diri sendiri', () => {
    const h = saringKuasa([hadir('B', 'PROXY', 'B')], batasBiasa);
    expect(h.rejected[0].reason).toBe('PROXY_SELF');
  });

  it('menolak kuasa tanpa pemegangnya', () => {
    const h = saringKuasa([{ memberId: 'B', mode: 'PROXY', hasVotingRight: true }], batasBiasa);
    expect(h.rejected[0].reason).toBe('PROXY_HOLDER_MISSING');
  });

  it('yang hadir sendiri tidak dihitung dua kali lewat kuasa', () => {
    const h = saringKuasa([hadir('A'), hadir('A', 'PROXY', 'B'), hadir('B')], batasBiasa);
    expect(h.valid.filter((v) => v.memberId === 'A')).toHaveLength(1);
    expect(h.rejected[0].reason).toBe('ALREADY_PRESENT');
  });

  it('kuasa dari pemegang berbeda dihitung terpisah', () => {
    const h = saringKuasa(
      [
        hadir('A'), hadir('B'),
        hadir('C', 'PROXY', 'A'), hadir('D', 'PROXY', 'A'),
        hadir('E', 'PROXY', 'B'), hadir('F', 'PROXY', 'B'),
      ],
      batasBiasa,
    );
    expect(h.valid).toHaveLength(6);
    expect(h.rejected).toHaveLength(0);
  });
});

describe('kuorum', () => {
  it('tercapai bila kehadiran memenuhi bagiannya', () => {
    const k = hitungKuorum({
      totalActiveMembers: 100,
      attendance: Array.from({ length: 51 }, (_, i) => hadir(`M${i}`)),
      batasKuasa: batasBiasa,
      requiredRatio: 0.5,
    });
    expect(k.reached).toBe(true);
    expect(k.requiredCount).toBe(50);
    expect(k.countedForQuorum).toBe(51);
  });

  it('tidak tercapai bila kurang', () => {
    const k = hitungKuorum({
      totalActiveMembers: 100,
      attendance: Array.from({ length: 30 }, (_, i) => hadir(`M${i}`)),
      batasKuasa: batasBiasa,
      requiredRatio: 0.5,
    });
    expect(k.reached).toBe(false);
    expect(k.countedForQuorum).toBe(30);
  });

  it('membulatkan syarat kehadiran ke atas', () => {
    // 33 anggota, syarat separuh -> 17, bukan 16,5.
    const k = hitungKuorum({
      totalActiveMembers: 33,
      attendance: Array.from({ length: 17 }, (_, i) => hadir(`M${i}`)),
      batasKuasa: batasBiasa,
      requiredRatio: 0.5,
    });
    expect(k.requiredCount).toBe(17);
    expect(k.reached).toBe(true);
  });

  it('rapat kedua memakai syarat yang lebih ringan', () => {
    const arg = {
      totalActiveMembers: 100,
      attendance: Array.from({ length: 30 }, (_, i) => hadir(`M${i}`)),
      batasKuasa: batasBiasa,
      requiredRatio: 0.5,
      secondCallRatio: 0.25,
    };
    expect(hitungKuorum(arg).reached).toBe(false);
    expect(hitungKuorum({ ...arg, isSecondCall: true }).reached).toBe(true);
  });

  it('kehadiran daring dihitung sama dengan hadir langsung', () => {
    const k = hitungKuorum({
      totalActiveMembers: 10,
      attendance: [
        hadir('A'), hadir('B'), hadir('C', 'ONLINE'), hadir('D', 'ONLINE'), hadir('E', 'ONLINE'),
      ],
      batasKuasa: batasBiasa,
      requiredRatio: 0.5,
    });
    expect(k.inPersonCount).toBe(2);
    expect(k.onlineCount).toBe(3);
    expect(k.reached).toBe(true);
  });

  it('kuasa dapat dikecualikan dari perhitungan kuorum', () => {
    const attendance = [hadir('A'), hadir('B'), hadir('C', 'PROXY', 'A'), hadir('D', 'PROXY', 'A')];
    const dengan = hitungKuorum({
      totalActiveMembers: 4, attendance,
      batasKuasa: { maxProxyPerHolder: 2, proxyCountsForQuorum: true },
      requiredRatio: 0.75,
    });
    const tanpa = hitungKuorum({
      totalActiveMembers: 4, attendance,
      batasKuasa: { maxProxyPerHolder: 2, proxyCountsForQuorum: false },
      requiredRatio: 0.75,
    });
    expect(dengan.reached).toBe(true);
    expect(tanpa.reached).toBe(false);
  });

  it('yang tidak berhak suara tidak dihitung untuk kuorum', () => {
    const k = hitungKuorum({
      totalActiveMembers: 10,
      attendance: [
        hadir('A'), hadir('B'), hadir('C'), hadir('D'), hadir('E'),
        { memberId: 'X', mode: 'IN_PERSON', hasVotingRight: false },
        { memberId: 'Y', mode: 'IN_PERSON', hasVotingRight: false },
      ],
      batasKuasa: batasBiasa,
      requiredRatio: 0.5,
    });
    expect(k.countedForQuorum).toBe(5);
    expect(k.reached).toBe(true);
  });

  it('koperasi tanpa anggota aktif tidak pernah mencapai kuorum', () => {
    const k = hitungKuorum({
      totalActiveMembers: 0, attendance: [], batasKuasa: batasBiasa, requiredRatio: 0.5,
    });
    expect(k.reached).toBe(false);
    expect(k.ratio).toBe(0);
  });
});

describe('satu anggota satu suara', () => {
  it('hasil voting tidak bergantung pada apa pun selain jumlah suaranya', () => {
    /*
     * Inilah pembeda koperasi dari perseroan. Fungsi penghitung suara tidak
     * menerima parameter simpanan, modal, maupun bobot — dan tidak boleh
     * menerimanya. Uji ini menjaga sifat itu tetap ada.
     */
    const suara: Suara[] = [
      { memberId: 'kaya', choice: 'NO' },
      { memberId: 'sedang', choice: 'YES' },
      { memberId: 'kecil', choice: 'YES' },
    ];
    const hasil = hitungVoting(suara, 'SIMPLE_MAJORITY');
    // Dua suara setuju mengalahkan satu penolak, tanpa memandang siapa mereka.
    expect(hasil.passed).toBe(true);
    expect(hasil.yes).toBe(2);
  });

  it('setiap anggota menyumbang tepat satu suara', () => {
    const suara: Suara[] = Array.from({ length: 7 }, (_, i) => ({
      memberId: `M${i}`,
      choice: 'YES' as const,
    }));
    expect(hitungVoting(suara, 'SIMPLE_MAJORITY').yes).toBe(7);
  });
});

describe('penghitungan suara', () => {
  it('mayoritas sederhana menuntut LEBIH dari separuh', () => {
    // 4 setuju, 4 tidak setuju -> tidak lolos. Seimbang bukan mayoritas.
    expect(
      hitungVoting(
        [
          ...Array.from({ length: 4 }, (_, i) => ({ memberId: `Y${i}`, choice: 'YES' as const })),
          ...Array.from({ length: 4 }, (_, i) => ({ memberId: `N${i}`, choice: 'NO' as const })),
        ],
        'SIMPLE_MAJORITY',
      ).passed,
    ).toBe(false);

    expect(
      hitungVoting(
        [
          ...Array.from({ length: 5 }, (_, i) => ({ memberId: `Y${i}`, choice: 'YES' as const })),
          ...Array.from({ length: 4 }, (_, i) => ({ memberId: `N${i}`, choice: 'NO' as const })),
        ],
        'SIMPLE_MAJORITY',
      ).passed,
    ).toBe(true);
  });

  it('ABSTAIN tidak dihitung sebagai penolak', () => {
    /*
     * Anggota yang abstain menyatakan dirinya tidak mengambil sikap.
     * Memperlakukannya sebagai penolak berarti memberinya sikap yang tidak
     * dinyatakannya.
     */
    const hasil = hitungVoting(
      [
        { memberId: 'A', choice: 'YES' },
        { memberId: 'B', choice: 'YES' },
        { memberId: 'C', choice: 'NO' },
        { memberId: 'D', choice: 'ABSTAIN' },
        { memberId: 'E', choice: 'ABSTAIN' },
      ],
      'SIMPLE_MAJORITY',
    );
    expect(hasil.validVotes).toBe(3);
    expect(hasil.abstain).toBe(2);
    expect(hasil.totalCast).toBe(5);
    expect(hasil.passed).toBe(true);
  });

  it('dua per tiga menuntut ambang yang lebih tinggi', () => {
    const suara: Suara[] = [
      ...Array.from({ length: 6 }, (_, i) => ({ memberId: `Y${i}`, choice: 'YES' as const })),
      ...Array.from({ length: 3 }, (_, i) => ({ memberId: `N${i}`, choice: 'NO' as const })),
    ];
    expect(hitungVoting(suara, 'SIMPLE_MAJORITY').passed).toBe(true);
    expect(hitungVoting(suara, 'TWO_THIRDS').passed).toBe(true);
    expect(hitungVoting(suara, 'THREE_QUARTERS').passed).toBe(false);
  });

  it('bulat menuntut seluruh yang memilih menyetujui', () => {
    expect(
      hitungVoting(
        [
          { memberId: 'A', choice: 'YES' },
          { memberId: 'B', choice: 'YES' },
        ],
        'UNANIMOUS',
      ).passed,
    ).toBe(true);
  });

  it('pada keputusan bulat, ABSTAIN menggagalkan kebulatan', () => {
    // Bulat berarti seluruh yang hadir menyetujui — bukan sekadar tidak ada
    // yang menolak.
    expect(
      hitungVoting(
        [
          { memberId: 'A', choice: 'YES' },
          { memberId: 'B', choice: 'ABSTAIN' },
        ],
        'UNANIMOUS',
      ).passed,
    ).toBe(false);
  });

  it('tanpa suara sah tidak ada keputusan yang lolos', () => {
    for (const rule of DECISION_RULES) {
      expect(hitungVoting([], rule).passed).toBe(false);
    }
    // Seluruhnya abstain: tidak ada suara sah.
    expect(
      hitungVoting([{ memberId: 'A', choice: 'ABSTAIN' }], 'SIMPLE_MAJORITY').passed,
    ).toBe(false);
  });

  it('ambang setiap aturan berurutan naik', () => {
    expect(AMBANG.SIMPLE_MAJORITY).toBeLessThan(AMBANG.TWO_THIRDS);
    expect(AMBANG.TWO_THIRDS).toBeLessThan(AMBANG.THREE_QUARTERS);
    expect(AMBANG.THREE_QUARTERS).toBeLessThan(AMBANG.UNANIMOUS);
  });
});

describe('hak memilih', () => {
  const dasar = {
    memberStatus: 'ACTIVE',
    categoryHasVotingRight: true,
    isPresent: true,
    hasVoted: false,
  };

  it('anggota aktif yang hadir boleh memilih', () => {
    expect(bolehMemilih(dasar).allowed).toBe(true);
  });

  it('CALON ANGGOTA tidak punya hak suara', () => {
    // Aturan yang sama muncul untuk keenam kalinya pada modul koperasi.
    const v = bolehMemilih({ ...dasar, memberStatus: 'PENDING_PRINCIPAL_SAVING' });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('peninjau');
  });

  it('kategori tanpa hak suara ditolak', () => {
    // Anggota luar biasa dan anggota kehormatan lazimnya tanpa hak suara.
    const v = bolehMemilih({ ...dasar, categoryHasVotingRight: false });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('AD/ART');
  });

  it('yang tidak hadir tidak dapat memilih', () => {
    expect(bolehMemilih({ ...dasar, isPresent: false }).allowed).toBe(false);
  });

  it('tidak dapat memilih dua kali pada mata acara yang sama', () => {
    const v = bolehMemilih({ ...dasar, hasVoted: true });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('sudah memberikan suara');
  });
});

describe('keabsahan keputusan', () => {
  const lolos = hitungVoting(
    [
      { memberId: 'A', choice: 'YES' },
      { memberId: 'B', choice: 'YES' },
      { memberId: 'C', choice: 'NO' },
    ],
    'SIMPLE_MAJORITY',
  );

  it('sah bila kuorum tercapai dan suara mencukupi', () => {
    expect(keabsahanKeputusan({ quorumReached: true, voteResult: lolos }).validity).toBe('VALID');
  });

  it('TIDAK SAH bila kuorum tidak tercapai, meskipun suaranya bulat', () => {
    /*
     * Keputusan itu terjadi, tercatat pada notulen, dan mungkin sudah
     * dilaksanakan. Menghilangkannya dari catatan akan membuat pelaksanaannya
     * tidak dapat dijelaskan kemudian; menandainya tidak sah membuatnya
     * terlihat dan dapat diperbaiki lewat rapat berikutnya.
     */
    const h = keabsahanKeputusan({ quorumReached: false, voteResult: lolos });
    expect(h.validity).toBe('INVALID_NO_QUORUM');
    expect(h.message).toContain('Agendakan ulang');
  });

  it('tidak sah bila suara belum mencapai ambangnya', () => {
    const kurang = hitungVoting(
      [
        { memberId: 'A', choice: 'YES' },
        { memberId: 'B', choice: 'NO' },
        { memberId: 'C', choice: 'NO' },
      ],
      'SIMPLE_MAJORITY',
    );
    const h = keabsahanKeputusan({ quorumReached: true, voteResult: kurang });
    expect(h.validity).toBe('INVALID_INSUFFICIENT_VOTE');
    // Pesannya menyebutkan angkanya, supaya notulen dapat mencatat alasannya.
    expect(h.message).toContain('1');
  });

  it('ketiadaan kuorum diperiksa LEBIH DAHULU daripada hasil suara', () => {
    const kurang = hitungVoting([{ memberId: 'A', choice: 'NO' }], 'SIMPLE_MAJORITY');
    expect(keabsahanKeputusan({ quorumReached: false, voteResult: kurang }).validity).toBe(
      'INVALID_NO_QUORUM',
    );
  });
});

describe('aturan keputusan per mata acara', () => {
  it('perubahan AD/ART menuntut dua per tiga', () => {
    expect(aturanUntukAgenda('BYLAW_AMENDMENT')).toBe('TWO_THIRDS');
  });

  it('pembubaran dan penggabungan menuntut tiga per empat', () => {
    expect(aturanUntukAgenda('DISSOLUTION')).toBe('THREE_QUARTERS');
    expect(aturanUntukAgenda('MERGER')).toBe('THREE_QUARTERS');
  });

  it('pemberhentian pengurus menuntut dua per tiga', () => {
    // Lebih tinggi daripada pemilihannya: memberhentikan orang yang dipilih
    // rapat sebelumnya menuntut kesepakatan yang lebih kuat.
    expect(aturanUntukAgenda('BOARD_DISMISSAL')).toBe('TWO_THIRDS');
    expect(aturanUntukAgenda('BOARD_ELECTION')).toBe('SIMPLE_MAJORITY');
  });

  it('laporan tahunan dan pembagian SHU cukup mayoritas sederhana', () => {
    expect(aturanUntukAgenda('ANNUAL_REPORT')).toBe('SIMPLE_MAJORITY');
    expect(aturanUntukAgenda('SHU_DISTRIBUTION')).toBe('SIMPLE_MAJORITY');
  });

  it('mata acara yang tidak dikenal memakai mayoritas sederhana', () => {
    expect(aturanUntukAgenda('SESUATU_YANG_BARU')).toBe('SIMPLE_MAJORITY');
  });

  it('seluruh aturan pada peta memakai nilai yang dikenal', () => {
    for (const rule of Object.values(ATURAN_PER_AGENDA)) {
      expect(DECISION_RULES).toContain(rule);
    }
  });
});
