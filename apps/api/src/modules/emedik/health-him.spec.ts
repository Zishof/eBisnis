/**
 * Pengujian aturan rekam medis, pengkodean, mutu, dan keselamatan.
 *
 * Yang dijaga paling ketat: kekurangan berkas dilaporkan namanya, kode yang
 * dicabut tetap terbaca pada rekam lama, dan penahanan hukum menahan perubahan
 * — bukan hanya penghapusan.
 */

import {
  bolehKode,
  bolehLepasInformasi,
  bolehPakaiKode,
  bolehTutupInsiden,
  bolehUbahSaatDitahan,
  bolehVerifikasiKoding,
  hitungIndikator,
  klasifikasiInsiden,
  periksaKelengkapan,
  skorKelengkapan,
  urutkanInsiden,
  type BerkasRekamMedis,
  type KodeTerminologi,
} from './health-him';

const lengkap = (over: Partial<BerkasRekamMedis> = {}): BerkasRekamMedis => ({
  encounterType: 'OUTPATIENT',
  hasPrincipalDiagnosis: true,
  principalDiagnosisCount: 1,
  diagnosisCount: 2,
  codedDiagnosisCount: 2,
  procedureCount: 0,
  codedProcedureCount: 0,
  unsignedNoteCount: 0,
  hasDischargeSummary: false,
  dischargeSummarySigned: false,
  hasConsent: true,
  hasOperativeNote: false,
  hasAnaesthesiaRecord: false,
  unacknowledgedCriticalCount: 0,
  hasAttendingProvider: true,
  ...over,
});

describe('kelengkapan rekam medis', () => {
  it('berkas rawat jalan yang lengkap tidak menghasilkan kekurangan', () => {
    const h = periksaKelengkapan(lengkap());
    expect(h.complete).toBe(true);
    expect(h.deficiencies).toEqual([]);
  });

  it('rawat jalan TIDAK dituntut resume pulang', () => {
    /*
     * Menuntutnya akan menghasilkan ribuan kekurangan palsu — dan daftar
     * kekurangan yang sebagian besar palsu akan diabaikan seluruhnya, termasuk
     * yang benar.
     */
    const h = periksaKelengkapan(lengkap({ hasDischargeSummary: false }));
    expect(h.deficiencies.some((d) => d.type === 'MISSING_DISCHARGE_SUMMARY')).toBe(false);
  });

  it('rawat inap dituntut resume pulang', () => {
    const h = periksaKelengkapan(lengkap({ encounterType: 'INPATIENT' }));
    expect(h.deficiencies.some((d) => d.type === 'MISSING_DISCHARGE_SUMMARY')).toBe(true);
  });

  it('resume pulang yang ada tetapi belum ditandatangani dilaporkan berbeda', () => {
    // "Belum ada" dan "belum ditandatangani" menuntut tindakan yang berbeda,
    // dan kadang dari orang yang berbeda.
    const h = periksaKelengkapan(
      lengkap({ encounterType: 'INPATIENT', hasDischargeSummary: true, dischargeSummarySigned: false }),
    );
    expect(h.deficiencies.some((d) => d.type === 'UNSIGNED_DISCHARGE_SUMMARY')).toBe(true);
    expect(h.deficiencies.some((d) => d.type === 'MISSING_DISCHARGE_SUMMARY')).toBe(false);
  });

  it('diagnosis utama LEBIH DARI SATU adalah kekurangan', () => {
    /*
     * Pengelompokan casemix memilih satu; bila ada dua, yang dipilih ditentukan
     * urutan baris — dan urutan baris bukan keputusan klinis.
     */
    const h = periksaKelengkapan(lengkap({ principalDiagnosisCount: 2 }));
    const k = h.deficiencies.find((d) => d.type === 'MULTIPLE_PRINCIPAL_DIAGNOSIS');
    expect(k).toBeTruthy();
    expect(k?.blocksCoding).toBe(true);
    expect(k?.message).toContain('urutan baris');
  });

  it('diagnosis utama yang tidak ada juga kekurangan', () => {
    expect(
      periksaKelengkapan(lengkap({ hasPrincipalDiagnosis: false })).deficiencies.some(
        (d) => d.type === 'MISSING_PRINCIPAL_DIAGNOSIS',
      ),
    ).toBe(true);
  });

  it('setiap kekurangan menyebut siapa yang dapat memperbaikinya', () => {
    // Kekurangan tanpa pemilik tidak akan diperbaiki oleh siapa pun.
    const h = periksaKelengkapan(lengkap({ hasPrincipalDiagnosis: false, unsignedNoteCount: 2 }));
    expect(h.deficiencies.every((d) => Boolean(d.responsibleRole))).toBe(true);
  });

  it('kekurangan dilaporkan NAMANYA, dengan jumlah yang jelas', () => {
    const h = periksaKelengkapan(lengkap({ unsignedNoteCount: 3 }));
    expect(h.deficiencies[0].message).toContain('3 catatan klinis');
  });

  it('diagnosis yang belum berkode dihitung selisihnya', () => {
    const h = periksaKelengkapan(lengkap({ diagnosisCount: 5, codedDiagnosisCount: 2 }));
    expect(h.deficiencies.find((d) => d.type === 'MISSING_DIAGNOSIS_CODE')?.message)
      .toContain('3 diagnosis');
  });

  it('diagnosis yang belum berkode TIDAK menahan pengkodean', () => {
    /*
     * Kalau ia menahan, berkas terkunci selamanya: pengkodean ditolak karena
     * belum berkode, dan ia tidak akan pernah berkode karena pengkodeannya
     * ditolak. Yang ditahannya adalah pengajuan klaim, bukan pengkodeannya.
     */
    const h = periksaKelengkapan(lengkap({ diagnosisCount: 1, codedDiagnosisCount: 0 }));
    expect(h.deficiencies.find((d) => d.type === 'MISSING_DIAGNOSIS_CODE')?.blocksCoding)
      .toBe(false);
    expect(h.blockingCount).toBe(0);
    expect(bolehKode({ kelengkapan: h, status: 'PENDING' }).allowed).toBe(true);
  });

  it('tindakan yang belum berkode pun tidak menahan pengkodean', () => {
    const h = periksaKelengkapan(lengkap({ procedureCount: 2, codedProcedureCount: 0 }));
    expect(h.deficiencies.find((d) => d.type === 'MISSING_PROCEDURE_CODE')?.blocksCoding)
      .toBe(false);
    expect(bolehKode({ kelengkapan: h, status: 'PENDING' }).allowed).toBe(true);
  });

  it('berkas yang belum berkode tetap dinyatakan BELUM lengkap', () => {
    // Tidak menahan koder bukan berarti sudah selesai.
    expect(periksaKelengkapan(lengkap({ diagnosisCount: 1, codedDiagnosisCount: 0 })).complete)
      .toBe(false);
  });

  it('operasi menuntut laporan operasi dan persetujuan tindakan', () => {
    const h = periksaKelengkapan(lengkap({ encounterType: 'SURGERY', hasConsent: false }));
    expect(h.deficiencies.some((d) => d.type === 'MISSING_OPERATIVE_NOTE')).toBe(true);
    expect(h.deficiencies.some((d) => d.type === 'MISSING_CONSENT')).toBe(true);
  });

  it('rekam anestesi yang kurang TIDAK menahan pengkodean', () => {
    // Ia kekurangan mutu, bukan kekurangan yang membuat klaimnya ditolak.
    const h = periksaKelengkapan(
      lengkap({ encounterType: 'SURGERY', hasOperativeNote: true, hasAnaesthesiaRecord: false }),
    );
    const k = h.deficiencies.find((d) => d.type === 'MISSING_ANAESTHESIA_RECORD');
    expect(k?.blocksCoding).toBe(false);
  });

  it('NILAI KRITIS yang belum diterima menahan pengkodean', () => {
    /*
     * Berkas yang dikode dan diklaim sementara hasil kritisnya belum pernah
     * dibaca berarti rumah sakit menagihkan pelayanan yang belum selesai.
     */
    const h = periksaKelengkapan(lengkap({ unacknowledgedCriticalCount: 1 }));
    const k = h.deficiencies.find((d) => d.type === 'UNACKNOWLEDGED_CRITICAL_RESULT');
    expect(k?.blocksCoding).toBe(true);
  });

  it('jumlah penahan dihitung terpisah dari jumlah kekurangan', () => {
    const h = periksaKelengkapan(
      lengkap({ encounterType: 'SURGERY', hasOperativeNote: true, hasAnaesthesiaRecord: false }),
    );
    expect(h.deficiencies.length).toBeGreaterThan(h.blockingCount);
  });
});

describe('skor kelengkapan', () => {
  it('dihitung terhadap jumlah berkas', () => {
    expect(skorKelengkapan({ total: 200, complete: 164 }).score).toBe(82);
  });

  it('tanpa berkas, skornya nol dan disebutkan sebabnya', () => {
    expect(skorKelengkapan({ total: 0, complete: 0 }).message).toContain('Belum ada berkas');
  });

  it('pesannya menyebut jumlahnya, bukan hanya persentasenya', () => {
    // Manajemen membandingkan persen; petugas mengerjakan jumlah.
    expect(skorKelengkapan({ total: 200, complete: 164 }).message).toContain('164 dari 200');
  });
});

describe('kode terminologi', () => {
  const kode = (over: Partial<KodeTerminologi> = {}): KodeTerminologi => ({
    code: 'A00.0',
    system: 'ICD10',
    version: '2016',
    display: 'Kolera',
    deprecatedAt: null,
    replacedBy: null,
    ...over,
  });

  it('kode yang masih berlaku boleh dipakai', () => {
    expect(bolehPakaiKode({ kode: kode(), serviceDate: '2026-08-01' }).allowed).toBe(true);
  });

  it('kode yang dicabut tidak boleh dipakai pada layanan sesudah pencabutannya', () => {
    const v = bolehPakaiKode({
      kode: kode({ deprecatedAt: '2025-01-01', replacedBy: 'A00.9' }),
      serviceDate: '2026-08-01',
    });
    expect(v.allowed).toBe(false);
    expect(v.replacedBy).toBe('A00.9');
  });

  it('kode yang dicabut TETAP boleh pada layanan sebelum pencabutannya', () => {
    /*
     * Dibandingkan dengan TANGGAL LAYANAN, bukan tanggal pengkodean. Berkas dari
     * Maret yang dikode pada Juni tetap memakai terminologi Maret — memaksanya
     * memakai terminologi Juni akan mengubah arti diagnosis yang sudah
     * ditegakkan.
     */
    expect(
      bolehPakaiKode({ kode: kode({ deprecatedAt: '2025-01-01' }), serviceDate: '2024-06-01' })
        .allowed,
    ).toBe(true);
  });

  it('penolakannya menyebut penggantinya bila ada', () => {
    expect(
      bolehPakaiKode({
        kode: kode({ deprecatedAt: '2025-01-01', replacedBy: 'A00.9' }),
        serviceDate: '2026-01-01',
      }).message,
    ).toContain('A00.9');
  });

  it('kode dicabut tanpa pengganti tetap ditolak, tanpa mengarang penggantinya', () => {
    const v = bolehPakaiKode({
      kode: kode({ deprecatedAt: '2025-01-01', replacedBy: null }),
      serviceDate: '2026-01-01',
    });
    expect(v.allowed).toBe(false);
    expect(v.replacedBy).toBeNull();
  });

  it('tanggal yang tidak sah tidak menolak kode yang sah', () => {
    expect(
      bolehPakaiKode({ kode: kode({ deprecatedAt: 'bukan tanggal' }), serviceDate: '2026-01-01' })
        .allowed,
    ).toBe(true);
  });
});

describe('izin mengode', () => {
  it('berkas lengkap boleh dikode', () => {
    expect(
      bolehKode({ kelengkapan: { blockingCount: 0, deficiencies: [] }, status: 'OPEN' }).allowed,
    ).toBe(true);
  });

  it('berkas dengan penahan tidak boleh dikode, dan penahannya disebutkan', () => {
    const v = bolehKode({
      kelengkapan: {
        blockingCount: 1,
        deficiencies: [
          {
            type: 'MISSING_PRINCIPAL_DIAGNOSIS',
            message: 'Diagnosis utama belum ditetapkan.',
            responsibleRole: 'HEALTH_DOCTOR',
            blocksCoding: true,
          },
        ],
      },
      status: 'OPEN',
    });
    expect(v.allowed).toBe(false);
    expect(v.blockers).toContain('Diagnosis utama belum ditetapkan.');
  });

  it('berkas yang sudah dikode tidak dikode lagi', () => {
    expect(
      bolehKode({ kelengkapan: { blockingCount: 0, deficiencies: [] }, status: 'CODED' }).allowed,
    ).toBe(false);
  });
});

describe('pemisahan koder dan verifikator', () => {
  it('verifikator yang berbeda diizinkan', () => {
    expect(
      bolehVerifikasiKoding({ codedBy: 'A', verifierId: 'B', requireSeparation: true }).allowed,
    ).toBe(true);
  });

  it('koder tidak memverifikasi pengkodeannya sendiri bila pemisahan aktif', () => {
    const v = bolehVerifikasiKoding({ codedBy: 'A', verifierId: 'A', requireSeparation: true });
    expect(v.allowed).toBe(false);
  });

  it('pemisahan dapat dimatikan lewat kebijakan, dan itu disengaja', () => {
    /*
     * Rumah sakit kecil kadang hanya punya satu koder. Aturan yang menghentikan
     * pekerjaan akan dimatikan seluruhnya, bukan disiasati — jadi lebih baik
     * ia dapat dimatikan secara sah dan tercatat.
     */
    expect(
      bolehVerifikasiKoding({ codedBy: 'A', verifierId: 'A', requireSeparation: false }).allowed,
    ).toBe(true);
  });

  it('pesannya menyarankan mematikan kebijakan, bukan menyiasatinya', () => {
    expect(
      bolehVerifikasiKoding({ codedBy: 'A', verifierId: 'A', requireSeparation: true }).message,
    ).toContain('jangan disiasati');
  });
});

describe('penahanan hukum', () => {
  const tahan = [{ id: 'H1', reason: 'Perkara perdata nomor 123' }];

  it('tanpa penahanan, seluruh tindakan diizinkan', () => {
    expect(bolehUbahSaatDitahan({ legalHolds: [], action: 'AMEND' }).allowed).toBe(true);
  });

  it('penahanan menghalangi amandemen', () => {
    expect(bolehUbahSaatDitahan({ legalHolds: tahan, action: 'AMEND' }).allowed).toBe(false);
  });

  it('penahanan menghalangi penghapusan', () => {
    expect(bolehUbahSaatDitahan({ legalHolds: tahan, action: 'DELETE' }).allowed).toBe(false);
    expect(bolehUbahSaatDitahan({ legalHolds: tahan, action: 'PURGE' }).allowed).toBe(false);
  });

  it('penahanan TIDAK menghalangi pembacaan', () => {
    /*
     * Menahan pembacaan akan menghentikan perawatan pasien yang rekamnya
     * kebetulan sedang diperkarakan — dan pasien itu tetap sakit.
     */
    expect(bolehUbahSaatDitahan({ legalHolds: tahan, action: 'READ' }).allowed).toBe(true);
  });

  it('penahanan yang sudah dicabut tidak lagi menghalangi', () => {
    expect(
      bolehUbahSaatDitahan({
        legalHolds: [{ id: 'H1', reason: 'x', releasedAt: '2026-01-01' }],
        action: 'AMEND',
      }).allowed,
    ).toBe(true);
  });

  it('alasan penahanannya disebutkan', () => {
    const v = bolehUbahSaatDitahan({ legalHolds: tahan, action: 'AMEND' });
    expect(v.holds).toContain('Perkara perdata nomor 123');
  });
});

describe('pelepasan informasi', () => {
  const dasar = {
    requester: 'INSURER' as const,
    hasPatientConsent: true,
    hasLegalBasis: false,
    legalBasisDocument: null,
    scope: ['resume medis'],
  };

  it('pasien berhak atas rekamnya sendiri tanpa syarat tambahan', () => {
    expect(
      bolehLepasInformasi({ ...dasar, requester: 'PATIENT', hasPatientConsent: false }).allowed,
    ).toBe(true);
  });

  it('wali sah diperlakukan sama dengan pasien', () => {
    expect(
      bolehLepasInformasi({ ...dasar, requester: 'LEGAL_GUARDIAN', hasPatientConsent: false })
        .allowed,
    ).toBe(true);
  });

  it('asuransi menuntut persetujuan pasien', () => {
    expect(bolehLepasInformasi({ ...dasar, hasPatientConsent: false }).allowed).toBe(false);
    expect(bolehLepasInformasi(dasar).allowed).toBe(true);
  });

  it('KEPOLISIAN menuntut nomor surat resmi, bukan sekadar penanda', () => {
    /*
     * Tanpa nomor surat yang tercatat, permintaan lisan tidak dapat dibedakan
     * dari permintaan yang dikarang — dan yang melepas rekamnya yang akan
     * menanggungnya.
     */
    expect(
      bolehLepasInformasi({ ...dasar, requester: 'POLICE', hasLegalBasis: true }).allowed,
    ).toBe(false);
    expect(
      bolehLepasInformasi({
        ...dasar, requester: 'POLICE', hasLegalBasis: true, legalBasisDocument: 'SP/123/VIII/2026',
      }).allowed,
    ).toBe(true);
  });

  it('pengadilan diperlakukan sama dengan kepolisian', () => {
    expect(
      bolehLepasInformasi({ ...dasar, requester: 'COURT', hasLegalBasis: true }).allowed,
    ).toBe(false);
  });

  it('peneliti menuntut persetujuan komite etik dan menerima data tersamarkan', () => {
    const v = bolehLepasInformasi({ ...dasar, requester: 'RESEARCHER', hasLegalBasis: true });
    expect(v.allowed).toBe(true);
    expect(v.requiresRedaction).toBe(true);
  });

  it('pemberi kerja menerima seperlunya, sekalipun pasien menyetujui', () => {
    const v = bolehLepasInformasi({ ...dasar, requester: 'EMPLOYER' });
    expect(v.allowed).toBe(true);
    expect(v.requiresRedaction).toBe(true);
  });

  it('permintaan tanpa menyebut bagian yang diminta ditolak', () => {
    // "Kirimkan rekam medisnya" bukan permintaan; ia jaring.
    expect(bolehLepasInformasi({ ...dasar, scope: [] }).allowed).toBe(false);
  });
});

describe('klasifikasi insiden', () => {
  it('kematian dinyatakan sentinel', () => {
    const h = klasifikasiInsiden({ harmLevel: 'DEATH', reachedPatient: true });
    expect(h.grade).toBe('RED');
    expect(h.requiresExternalReport).toBe(true);
    expect(h.reviewDueHours).toBe(24);
  });

  it('cedera berat dinyatakan sentinel pula', () => {
    expect(klasifikasiInsiden({ harmLevel: 'SEVERE', reachedPatient: true }).grade).toBe('RED');
  });

  it('cedera sedang menuntut telaah akar masalah dalam 72 jam', () => {
    const h = klasifikasiInsiden({ harmLevel: 'MODERATE', reachedPatient: true });
    expect(h.grade).toBe('YELLOW');
    expect(h.requiresRootCauseAnalysis).toBe(true);
  });

  it('NYARIS CEDERA tetap ditelaah, dan sebabnya disebutkan', () => {
    /*
     * Ia data yang paling berharga: menunjukkan celah sebelum ada yang terluka,
     * dan jauh lebih sering terjadi daripada cedera sehingga polanya lebih cepat
     * terlihat.
     */
    const h = klasifikasiInsiden({ harmLevel: 'NEAR_MISS', reachedPatient: false });
    expect(h.grade).toBe('BLUE');
    expect(h.reviewDueHours).toBeGreaterThan(0);
    expect(h.message).toContain('sebelum ada yang terluka');
  });

  it('sampai ke pasien tanpa cedera lebih berat daripada nyaris cedera', () => {
    const sampai = klasifikasiInsiden({ harmLevel: 'NO_HARM', reachedPatient: true });
    const nyaris = klasifikasiInsiden({ harmLevel: 'NO_HARM', reachedPatient: false });
    expect(sampai.grade).toBe('GREEN');
    expect(nyaris.grade).toBe('BLUE');
  });

  it('penandaan sentinel manual dihormati apa pun tingkat bahayanya', () => {
    expect(
      klasifikasiInsiden({ harmLevel: 'NO_HARM', reachedPatient: false, isSentinel: true }).grade,
    ).toBe('RED');
  });
});

describe('penutupan insiden', () => {
  const dasar = {
    grade: 'YELLOW' as const,
    requiresRootCauseAnalysis: true,
    hasRootCauseAnalysis: true,
    correctiveActionCount: 2,
    closedBy: 'B',
    reportedBy: 'A',
  };

  it('insiden yang sudah ditelaah dan bertindakan boleh ditutup', () => {
    expect(bolehTutupInsiden(dasar).allowed).toBe(true);
  });

  it('tanpa telaah akar masalah yang diwajibkan, ditolak', () => {
    expect(bolehTutupInsiden({ ...dasar, hasRootCauseAnalysis: false }).allowed).toBe(false);
  });

  it('TANPA TINDAKAN PERBAIKAN ditolak', () => {
    const v = bolehTutupInsiden({ ...dasar, correctiveActionCount: 0 });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('akan terjadi lagi');
  });

  it('nyaris cedera boleh ditutup tanpa tindakan perbaikan', () => {
    // Menuntutnya pada setiap nyaris cedera akan membuat orang berhenti
    // melaporkannya — dan laporan nyaris cedera yang berhenti adalah kerugian
    // terbesar yang dapat dialami program keselamatan pasien.
    expect(
      bolehTutupInsiden({
        ...dasar, grade: 'BLUE', requiresRootCauseAnalysis: false,
        hasRootCauseAnalysis: false, correctiveActionCount: 0,
      }).allowed,
    ).toBe(true);
  });

  it('pelapor tidak menutup laporannya sendiri pada kejadian berat', () => {
    const v = bolehTutupInsiden({ ...dasar, closedBy: 'A' });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('bukan telaah');
  });

  it('pada nyaris cedera, pelapor boleh menutupnya sendiri', () => {
    expect(
      bolehTutupInsiden({
        ...dasar, grade: 'BLUE', requiresRootCauseAnalysis: false, hasRootCauseAnalysis: false,
        correctiveActionCount: 0, closedBy: 'A',
      }).allowed,
    ).toBe(true);
  });
});

describe('urutan papan insiden', () => {
  const i = (id: string, grade: string, due: string | null, closed: string | null = null) =>
    ({ id, grade, reviewDueAt: due, closedAt: closed });
  const KINI = '2026-08-01T12:00:00Z';

  it('yang lewat tenggat mendahului yang lebih berat tetapi belum lewat', () => {
    /*
     * Kejadian berat yang masih dalam tenggat sedang dikerjakan; kejadian
     * ringan yang terlupa dua pekan adalah pekerjaan yang menumpuk diam-diam.
     */
    const h = urutkanInsiden(
      [i('berat', 'RED', '2026-08-02T00:00:00Z'), i('lewat', 'GREEN', '2026-07-20T00:00:00Z')],
      KINI,
    );
    expect(h[0].id).toBe('lewat');
  });

  it('yang sudah ditutup turun ke bawah', () => {
    const h = urutkanInsiden(
      [i('tutup', 'RED', '2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z'), i('buka', 'BLUE', null)],
      KINI,
    );
    expect(h[0].id).toBe('buka');
  });

  it('pada keadaan setara, yang lebih berat didahulukan', () => {
    const h = urutkanInsiden(
      [i('ringan', 'BLUE', '2026-08-05T00:00:00Z'), i('berat', 'RED', '2026-08-05T00:00:00Z')],
      KINI,
    );
    expect(h[0].id).toBe('berat');
  });

  it('pengurutan tidak mengubah daftar aslinya', () => {
    const asli = [i('a', 'BLUE', null), i('b', 'RED', null)];
    urutkanInsiden(asli, KINI);
    expect(asli[0].id).toBe('a');
  });
});

describe('indikator mutu', () => {
  it('dihitung sebagai persentase terhadap penyebut', () => {
    expect(
      hitungIndikator({ numerator: 82, denominator: 100, direction: 'HIGHER_IS_BETTER' }).value,
    ).toBe(82);
  });

  it('PENYEBUT NOL tidak menghasilkan nol', () => {
    /*
     * Menampilkannya sebagai nol akan terbaca sebagai mutu terburuk, padahal
     * yang benar adalah belum ada datanya.
     */
    const h = hitungIndikator({ numerator: 0, denominator: 0, direction: 'HIGHER_IS_BETTER' });
    expect(h.value).toBeNull();
    expect(h.message).toContain('belum ada datanya');
  });

  it('arah "lebih tinggi lebih baik" dinilai benar', () => {
    expect(
      hitungIndikator({
        numerator: 90, denominator: 100, direction: 'HIGHER_IS_BETTER', target: 85,
      }).meetsTarget,
    ).toBe(true);
  });

  it('arah "lebih rendah lebih baik" dinilai terbalik', () => {
    // Angka infeksi 2% terhadap target 5% adalah tercapai, bukan gagal.
    expect(
      hitungIndikator({
        numerator: 2, denominator: 100, direction: 'LOWER_IS_BETTER', target: 5,
      }).meetsTarget,
    ).toBe(true);
    expect(
      hitungIndikator({
        numerator: 8, denominator: 100, direction: 'LOWER_IS_BETTER', target: 5,
      }).meetsTarget,
    ).toBe(false);
  });

  it('tanpa target, pencapaiannya tidak dinilai', () => {
    const h = hitungIndikator({ numerator: 50, denominator: 100, direction: 'HIGHER_IS_BETTER' });
    expect(h.meetsTarget).toBeNull();
    expect(h.message).toContain('belum ada target');
  });
});
