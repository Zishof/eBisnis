/**
 * Pengujian aturan gawat darurat, kamar operasi, dan perawatan intensif.
 *
 * Yang dijaga paling ketat: triase tidak dapat diturunkan diam-diam, jeda
 * sebelum sayatan tidak dapat dilewati, dan hitungan kasa yang tidak cocok
 * menahan pasien di kamar operasi.
 */

import {
  BATAS_TUNGGU_TRIASE,
  BUTIR_DAFTAR_PERIKSA,
  bertumpangTindih,
  bolehDisposisi,
  bolehJadwalkan,
  bolehKeluarKamarOperasi,
  bolehMulaiSayatan,
  bolehTurunkanTriase,
  lewatBatasTunggu,
  periksaDaftarPeriksa,
  periksaHitungan,
  skorIntensif,
  tentukanTriase,
  urutkanTriase,
  type SlotOperasi,
  type TingkatTriase,
} from './health-acute';

const vitalNormal = {
  respiratoryRate: 16,
  spo2: 98,
  systolicBp: 120,
  heartRate: 78,
  temperature: 36.8,
  consciousness: 'ALERT' as const,
  painScore: 2,
};

describe('penentuan triase', () => {
  it('tanda vital normal mempertahankan tingkat yang diusulkan', () => {
    const h = tentukanTriase({ requestedLevel: 4, vitals: vitalNormal });
    expect(h.level).toBe(4);
    expect(h.escalated).toBe(false);
  });

  it('pasien tidak sadar langsung menjadi tingkat 1', () => {
    const h = tentukanTriase({
      requestedLevel: 4,
      vitals: { ...vitalNormal, consciousness: 'UNRESPONSIVE' },
    });
    expect(h.level).toBe(1);
    expect(h.escalated).toBe(true);
  });

  it('saturasi di bawah 90 menaikkan ke tingkat 1', () => {
    expect(tentukanTriase({ requestedLevel: 5, vitals: { ...vitalNormal, spo2: 86 } }).level).toBe(1);
  });

  it('tekanan darah rendah menaikkan tingkat', () => {
    expect(tentukanTriase({ requestedLevel: 4, vitals: { ...vitalNormal, systolicBp: 78 } }).level)
      .toBe(1);
    expect(tentukanTriase({ requestedLevel: 4, vitals: { ...vitalNormal, systolicBp: 85 } }).level)
      .toBe(2);
  });

  it('tanda bahaya HANYA menaikkan, tidak pernah menurunkan', () => {
    /*
     * Petugas boleh menilai lebih gawat daripada tanda vitalnya — ia melihat
     * pasiennya, sistem tidak. Yang tidak boleh adalah menilai lebih ringan
     * daripada tanda vital yang mengancam nyawa.
     */
    const h = tentukanTriase({ requestedLevel: 1, vitals: vitalNormal });
    expect(h.level).toBe(1);
    expect(h.escalated).toBe(false);
  });

  it('sebab kenaikannya dilaporkan satu per satu', () => {
    const h = tentukanTriase({
      requestedLevel: 5,
      vitals: { ...vitalNormal, spo2: 88, systolicBp: 85 },
    });
    expect(h.redFlags.length).toBe(2);
    expect(h.message).toContain('Saturasi oksigen 88%');
  });

  it('keluhan berbahaya menaikkan tingkat tanpa perlu tanda vital', () => {
    const h = tentukanTriase({
      requestedLevel: 4,
      vitals: vitalNormal,
      redFlagComplaints: ['Nyeri dada menjalar'],
    });
    expect(h.level).toBe(2);
    expect(h.redFlags).toContain('Nyeri dada menjalar');
  });

  it('nyeri hebat menaikkan ke tingkat 3, bukan tingkat 1', () => {
    // Nyeri hebat tidak mengancam nyawa, tetapi pasien yang dibiarkan kesakitan
    // dua jam adalah kegagalan pelayanan yang nyata.
    expect(tentukanTriase({ requestedLevel: 5, vitals: { ...vitalNormal, painScore: 9 } }).level)
      .toBe(3);
  });

  it('tanda vital yang tidak diukur tidak menaikkan tingkat secara diam-diam', () => {
    const h = tentukanTriase({
      requestedLevel: 4,
      vitals: { consciousness: 'ALERT' },
    });
    expect(h.level).toBe(4);
    expect(h.redFlags).toEqual([]);
  });

  it('batas tunggu mengikuti tingkat akhir, bukan yang diusulkan', () => {
    const h = tentukanTriase({ requestedLevel: 5, vitals: { ...vitalNormal, spo2: 86 } });
    expect(h.maxWaitMinutes).toBe(BATAS_TUNGGU_TRIASE[1]);
    expect(h.maxWaitMinutes).toBe(0);
  });

  it('lima tingkat, dan batas tunggunya menaik', () => {
    // Tiga tingkat memaksa "kuning" menampung pasien yang harus dilihat dalam
    // sepuluh menit bersama pasien yang dapat menunggu satu jam.
    const batas = ([1, 2, 3, 4, 5] as TingkatTriase[]).map((t) => BATAS_TUNGGU_TRIASE[t]);
    expect(batas).toEqual([...batas].sort((a, b) => a - b));
    expect(new Set(batas).size).toBe(5);
  });
});

describe('penurunan tingkat triase', () => {
  it('menaikkan tingkat selalu boleh tanpa alasan', () => {
    // Keadaan pasien memang dapat memburuk sambil menunggu.
    expect(bolehTurunkanTriase({ from: 4, to: 2, reason: null }).allowed).toBe(true);
  });

  it('menurunkan tingkat tanpa alasan ditolak', () => {
    const v = bolehTurunkanTriase({ from: 2, to: 4, reason: null });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('menunggu lebih lama');
  });

  it('menurunkan tingkat dengan alasan diizinkan', () => {
    expect(
      bolehTurunkanTriase({
        from: 2, to: 4, reason: 'Tanda vital diulang, seluruhnya dalam batas normal.',
      }).allowed,
    ).toBe(true);
  });

  it('tingkat yang tidak berubah selalu boleh', () => {
    expect(bolehTurunkanTriase({ from: 3, to: 3, reason: null }).allowed).toBe(true);
  });
});

describe('batas waktu tunggu', () => {
  it('pasien yang belum dilihat dan lewat batas ditandai', () => {
    const h = lewatBatasTunggu({
      level: 2, arrivedAt: '2026-08-01T08:00:00Z', seenAt: null, now: '2026-08-01T08:45:00Z',
    });
    expect(h.overdue).toBe(true);
    expect(h.lateMinutes).toBe(35);
  });

  it('pasien yang sudah dilihat tidak lagi ditandai terlambat', () => {
    // Ia tetap dilaporkan berapa lama menunggu, untuk laporan mutu — tetapi ia
    // bukan lagi orang yang harus dicari sekarang.
    const h = lewatBatasTunggu({
      level: 2, arrivedAt: '2026-08-01T08:00:00Z',
      seenAt: '2026-08-01T08:45:00Z', now: '2026-08-01T09:00:00Z',
    });
    expect(h.overdue).toBe(false);
    expect(h.waitedMinutes).toBe(45);
  });

  it('pasien dalam batas tidak ditandai', () => {
    expect(lewatBatasTunggu({
      level: 4, arrivedAt: '2026-08-01T08:00:00Z', seenAt: null, now: '2026-08-01T08:30:00Z',
    }).overdue).toBe(false);
  });
});

describe('urutan antrean gawat darurat', () => {
  const b = (id: string, level: TingkatTriase, arrivedAt: string, seenAt: string | null = null) =>
    ({ id, level, arrivedAt, seenAt });

  it('tingkat lebih gawat mendahului yang datang lebih dahulu', () => {
    /*
     * Pasien tingkat 1 yang baru tiba mendahului pasien tingkat 4 yang sudah
     * menunggu dua jam, dan memang harus begitu.
     */
    const h = urutkanTriase([
      b('lama', 4, '2026-08-01T06:00:00Z'),
      b('baru', 1, '2026-08-01T08:00:00Z'),
    ]);
    expect(h[0].id).toBe('baru');
  });

  it('pada tingkat yang sama, yang lebih lama menunggu didahulukan', () => {
    const h = urutkanTriase([
      b('baru', 3, '2026-08-01T08:00:00Z'),
      b('lama', 3, '2026-08-01T07:00:00Z'),
    ]);
    expect(h.map((x) => x.id)).toEqual(['lama', 'baru']);
  });

  it('yang sudah dilihat dokter turun ke bawah', () => {
    const h = urutkanTriase([
      b('sudah', 1, '2026-08-01T06:00:00Z', '2026-08-01T06:05:00Z'),
      b('belum', 5, '2026-08-01T08:00:00Z'),
    ]);
    expect(h[0].id).toBe('belum');
  });

  it('pengurutan tidak mengubah daftar aslinya', () => {
    const asli = [b('a', 4, '2026-08-01T08:00:00Z'), b('b', 1, '2026-08-01T09:00:00Z')];
    urutkanTriase(asli);
    expect(asli[0].id).toBe('a');
  });
});

describe('daftar periksa keselamatan bedah', () => {
  it('tiga tahap, masing-masing berbutir', () => {
    for (const t of ['SIGN_IN', 'TIME_OUT', 'SIGN_OUT'] as const) {
      expect(BUTIR_DAFTAR_PERIKSA[t].length).toBeGreaterThan(0);
    }
  });

  it('butir yang terlewat dilaporkan NAMANYA, bukan sekadar dihitung', () => {
    // "Enam dari tujuh" tidak memberi tahu siapa pun butir mana yang terlewat.
    const h = periksaDaftarPeriksa('TIME_OUT', ['TEAM_INTRODUCED', 'PATIENT_NAME_STATED']);
    expect(h.complete).toBe(false);
    expect(h.missing).toContain('SITE_STATED');
  });

  it('seluruh butir tercentang berarti lengkap', () => {
    expect(periksaDaftarPeriksa('SIGN_OUT', BUTIR_DAFTAR_PERIKSA.SIGN_OUT).complete).toBe(true);
  });

  it('butir asing tidak membuat tahapnya lengkap', () => {
    expect(periksaDaftarPeriksa('TIME_OUT', ['SESUATU_YANG_LAIN']).complete).toBe(false);
  });

  it('jeda sebelum sayatan memuat penyebutan sisi operasi', () => {
    // Inilah butir yang menahan operasi salah sisi.
    expect(BUTIR_DAFTAR_PERIKSA.TIME_OUT).toContain('SITE_STATED');
  });
});

describe('izin memulai sayatan', () => {
  const dasar = {
    signInCompletedAt: '2026-08-01T08:00:00Z',
    timeOutCompletedAt: '2026-08-01T08:20:00Z',
    timeOutItems: BUTIR_DAFTAR_PERIKSA.TIME_OUT,
    markedSite: 'KIRI',
    consentSite: 'KIRI',
    requiresSiteMarking: true,
  };

  it('seluruhnya lengkap dan cocok diizinkan', () => {
    expect(bolehMulaiSayatan(dasar).allowed).toBe(true);
  });

  it('TANPA jeda sebelum sayatan ditolak', () => {
    const v = bolehMulaiSayatan({ ...dasar, timeOutCompletedAt: null });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('TIME_OUT_NOT_DONE');
    expect(v.message).toContain('salah sisi');
  });

  it('jeda yang belum lengkap ditolak beserta butir yang kurang', () => {
    const v = bolehMulaiSayatan({ ...dasar, timeOutItems: ['TEAM_INTRODUCED'] });
    expect(v.reason).toBe('TIME_OUT_INCOMPLETE');
    expect(v.message).toContain('SITE_STATED');
  });

  it('tahap sebelum pembiusan yang belum selesai ditolak', () => {
    expect(bolehMulaiSayatan({ ...dasar, signInCompletedAt: null }).reason).toBe('SIGN_IN_INCOMPLETE');
  });

  it('sisi yang belum ditandai ditolak', () => {
    expect(bolehMulaiSayatan({ ...dasar, markedSite: null }).reason).toBe('SITE_NOT_MARKED');
  });

  it('SISI YANG BERBEDA dari persetujuan tindakan MENGHENTIKAN operasi', () => {
    /*
     * Bila keduanya berbeda, salah satunya keliru — dan tidak ada seorang pun
     * di kamar operasi yang dapat memastikan yang mana tanpa bertanya kepada
     * pasien, yang sudah terbius.
     */
    const v = bolehMulaiSayatan({ ...dasar, markedSite: 'KANAN', consentSite: 'KIRI' });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('SITE_MISMATCH');
    expect(v.message).toContain('HENTIKAN');
  });

  it('perbedaan huruf besar-kecil bukan ketidakcocokan', () => {
    expect(bolehMulaiSayatan({ ...dasar, markedSite: 'kiri', consentSite: 'KIRI' }).allowed)
      .toBe(true);
  });

  it('prosedur tanpa sisi tidak menuntut penandaan', () => {
    // Menuntutnya pada apendektomi hanya akan membuat orang menandai apa saja
    // demi lewat, dan penandaan yang asal justru merusak gunanya pada prosedur
    // yang benar-benar bersisi.
    expect(
      bolehMulaiSayatan({ ...dasar, requiresSiteMarking: false, markedSite: null }).allowed,
    ).toBe(true);
  });
});

describe('hitungan kasa dan instrumen', () => {
  it('hitungan yang cocok dinyatakan benar', () => {
    expect(
      periksaHitungan([
        { itemType: 'KASA', countedIn: 20, countedOut: 20 },
        { itemType: 'JARUM', countedIn: 6, countedOut: 6 },
      ]).correct,
    ).toBe(true);
  });

  it('selisihnya dilaporkan per jenis benda', () => {
    const h = periksaHitungan([
      { itemType: 'KASA', countedIn: 20, countedOut: 19 },
      { itemType: 'JARUM', countedIn: 6, countedOut: 6 },
    ]);
    expect(h.correct).toBe(false);
    expect(h.discrepancies).toEqual([{ itemType: 'KASA', difference: 1 }]);
  });

  it('jumlah keluar yang lebih banyak juga dilaporkan', () => {
    // Kasa yang keluar lebih banyak daripada yang masuk berarti hitungannya
    // salah di salah satu ujung, dan itu sama perlunya diperiksa.
    expect(periksaHitungan([{ itemType: 'KASA', countedIn: 19, countedOut: 20 }]).correct)
      .toBe(false);
  });
});

describe('izin meninggalkan kamar operasi', () => {
  const dasar = {
    signOutItems: BUTIR_DAFTAR_PERIKSA.SIGN_OUT,
    counts: [{ itemType: 'KASA', countedIn: 20, countedOut: 20 }],
    discrepancyResolution: null,
  };

  it('hitungan cocok dan tahap lengkap diizinkan', () => {
    expect(bolehKeluarKamarOperasi(dasar).allowed).toBe(true);
  });

  it('HITUNGAN TIDAK COCOK menahan pasien di kamar operasi', () => {
    const v = bolehKeluarKamarOperasi({
      ...dasar,
      counts: [{ itemType: 'KASA', countedIn: 20, countedOut: 19 }],
    });
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('COUNT_MISMATCH');
    expect(v.discrepancies).toContain('KASA kurang 1');
  });

  it('dengan keterangan pencarian, hitungan tidak cocok tidak lagi menahan', () => {
    /*
     * Menahannya tanpa jalan keluar sama sekali akan membuat orang mematikan
     * sistemnya, dan sistem yang dimatikan tidak menahan apa pun. Yang dituntut
     * adalah pencariannya tercatat.
     */
    expect(
      bolehKeluarKamarOperasi({
        ...dasar,
        counts: [{ itemType: 'KASA', countedIn: 20, countedOut: 19 }],
        discrepancyResolution: 'Foto sinar-X intraoperatif, tidak tampak benda tertinggal.',
      }).allowed,
    ).toBe(true);
  });

  it('tahap sebelum keluar yang belum lengkap ditolak', () => {
    const v = bolehKeluarKamarOperasi({ ...dasar, signOutItems: ['PROCEDURE_RECORDED'] });
    expect(v.reason).toBe('SIGN_OUT_INCOMPLETE');
  });
});

describe('penjadwalan kamar operasi', () => {
  const slot = (over: Partial<SlotOperasi> = {}): SlotOperasi => ({
    theatreId: 'OK1',
    startAt: '2026-08-01T08:00:00Z',
    endAt: '2026-08-01T10:00:00Z',
    ...over,
  });

  it('jadwal yang tidak bertabrakan diizinkan', () => {
    expect(
      bolehJadwalkan(slot({ startAt: '2026-08-01T11:00:00Z', endAt: '2026-08-01T12:00:00Z' }), [slot()])
        .allowed,
    ).toBe(true);
  });

  it('jadwal yang bertumpang tindih ditolak', () => {
    const v = bolehJadwalkan(
      slot({ startAt: '2026-08-01T09:00:00Z', endAt: '2026-08-01T11:00:00Z' }),
      [slot()],
    );
    expect(v.allowed).toBe(false);
    expect(v.conflictWith).toBeTruthy();
  });

  it('bersentuhan ujung ke ujung BUKAN tumpang tindih', () => {
    // Operasi berikutnya boleh dimulai tepat saat yang sebelumnya berakhir.
    expect(
      bolehJadwalkan(slot({ startAt: '2026-08-01T10:00:00Z', endAt: '2026-08-01T12:00:00Z' }), [slot()])
        .allowed,
    ).toBe(true);
  });

  it('kamar operasi berbeda tidak pernah bertabrakan', () => {
    expect(bertumpangTindih(slot(), slot({ theatreId: 'OK2' }))).toBe(false);
  });

  it('jadwal yang sudah dibatalkan tidak menghalangi', () => {
    expect(
      bolehJadwalkan(slot({ startAt: '2026-08-01T09:00:00Z' }), [slot({ status: 'CANCELLED' })])
        .allowed,
    ).toBe(true);
  });

  it('waktu selesai sebelum waktu mulai ditolak', () => {
    expect(
      bolehJadwalkan(slot({ startAt: '2026-08-01T10:00:00Z', endAt: '2026-08-01T08:00:00Z' }), [])
        .allowed,
    ).toBe(false);
  });
});

describe('skor perawatan intensif', () => {
  it('tanda vital normal tanpa dukungan berisiko rendah', () => {
    const h = skorIntensif({ vitals: vitalNormal });
    expect(h.score).toBe(0);
    expect(h.risk).toBe('LOW');
  });

  it('dukungan organ menambah skor', () => {
    expect(skorIntensif({ vitals: vitalNormal, onVentilator: true }).score).toBe(3);
  });

  it('DUKUNGAN ORGAN GANDA langsung dinyatakan kritis apa pun skornya', () => {
    /*
     * Pasien dengan ventilator dan vasopresor sekaligus adalah pasien yang
     * tanda vitalnya tampak baik JUSTRU KARENA mesin yang menahannya — dan skor
     * yang membaca tanda vital saja akan menyimpulkan ia sedang membaik.
     */
    const h = skorIntensif({ vitals: vitalNormal, onVentilator: true, onVasopressor: true });
    expect(h.risk).toBe('CRITICAL');
    expect(h.organSupport).toBe(2);
  });

  it('tanda vital yang memburuk menaikkan risiko tanpa dukungan organ', () => {
    const h = skorIntensif({
      vitals: { ...vitalNormal, spo2: 88, systolicBp: 82, consciousness: 'PAIN' },
    });
    expect(h.risk).toBe('HIGH');
  });

  it('dukungan tunggal dilaporkan apa adanya', () => {
    expect(skorIntensif({ vitals: vitalNormal, onDialysis: true }).organSupport).toBe(1);
  });
});

describe('disposisi gawat darurat', () => {
  const dasar = {
    disposition: 'DISCHARGED' as const,
    seenByDoctorAt: '2026-08-01T09:00:00Z',
    triageLevel: 4 as TingkatTriase,
    reason: null,
  };

  it('pemulangan biasa setelah dilihat dokter diizinkan', () => {
    expect(bolehDisposisi(dasar).allowed).toBe(true);
  });

  it('disposisi tanpa pernah dilihat dokter ditolak', () => {
    expect(bolehDisposisi({ ...dasar, seenByDoctorAt: null }).allowed).toBe(false);
  });

  it('"pergi tanpa dilihat" TIDAK menuntut pernah dilihat dokter', () => {
    /*
     * Menyamakannya dengan pemulangan biasa akan menyembunyikan angka yang
     * paling penting bagi mutu IGD: berapa banyak orang yang menyerah menunggu.
     */
    expect(
      bolehDisposisi({
        ...dasar, disposition: 'LEFT_WITHOUT_BEING_SEEN', seenByDoctorAt: null,
      }).allowed,
    ).toBe(true);
  });

  it('"pergi tanpa dilihat" pada pasien yang sudah dilihat ditolak', () => {
    const v = bolehDisposisi({ ...dasar, disposition: 'LEFT_WITHOUT_BEING_SEEN' });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('sudah dilihat dokter');
  });

  it('pasien triase tingkat 1 dan 2 yang dipulangkan menuntut keterangan', () => {
    // Bukan karena mustahil — kejang yang berhenti sendiri memang boleh pulang —
    // melainkan karena inilah pola yang paling sering mendahului pasien kembali
    // dalam keadaan lebih buruk.
    expect(bolehDisposisi({ ...dasar, triageLevel: 2 }).allowed).toBe(false);
    expect(
      bolehDisposisi({
        ...dasar, triageLevel: 2, reason: 'Kejang demam sederhana, sudah berhenti, orang tua paham.',
      }).allowed,
    ).toBe(true);
  });

  it('pasien tingkat 2 yang dirawat inap tidak menuntut keterangan tambahan', () => {
    expect(bolehDisposisi({ ...dasar, disposition: 'ADMITTED', triageLevel: 2 }).allowed).toBe(true);
  });

  it('meninggal sebelum tiba tidak menuntut pernah dilihat dokter', () => {
    expect(bolehDisposisi({ ...dasar, disposition: 'DOA', seenByDoctorAt: null }).allowed).toBe(true);
  });
});
