/**
 * Pengujian aturan siklus hidup klaim internal.
 *
 * Yang dijaga paling ketat: tiga angka tidak pernah disamakan, sebab penolakan
 * adalah kode tertutup, selisih yang tidak terjelaskan tidak dapat ditutup, dan
 * penanda anti-fraud tidak pernah menghentikan pengajuan.
 */

import {
  SEBAB_PENOLAKAN,
  bandingkanTigaAngka,
  bolehAjukan,
  bolehCatatKeputusan,
  bolehPindahStatusKlaim,
  rekonsiliasi,
  tandaiUntukTelaah,
  verifikasiInternal,
  type BerkasKlaim,
  type StatusKlaim,
} from './health-claim';

const berkas = (over: Partial<BerkasKlaim> = {}): BerkasKlaim => ({
  principalDiagnosisCount: 1,
  invalidCodeCount: 0,
  procedureCount: 0,
  codedProcedureCount: 0,
  hasDischargeSummary: true,
  dischargeSummarySigned: true,
  referencedResultCount: 0,
  availableResultCount: 0,
  sepNumber: null,
  sepEncounterMatches: true,
  admittedAt: '2026-06-01',
  dischargedAt: '2026-06-05',
  billedClass: null,
  entitledClass: null,
  hasAttendingSignature: true,
  isInpatient: true,
  ...over,
});

describe('status klaim', () => {
  it('urutan sampai siap diajukan', () => {
    for (const [a, b] of [
      ['DRAFT', 'CODED'],
      ['CODED', 'INTERNALLY_VERIFIED'],
      ['INTERNALLY_VERIFIED', 'READY_TO_SUBMIT'],
      ['READY_TO_SUBMIT', 'SUBMITTED'],
    ] as Array<[StatusKlaim, StatusKlaim]>) {
      expect(bolehPindahStatusKlaim({ from: a, to: b }).allowed).toBe(true);
    }
  });

  it('yang sudah DIAJUKAN tidak dibatalkan sepihak', () => {
    /*
     * Pembatalannya urusan penjamin; mencatatnya sebagai batal akan membuat
     * catatan kami berselisih dengan catatan mereka pada rekonsiliasi.
     */
    const h = bolehPindahStatusKlaim({ from: 'SUBMITTED', to: 'CANCELLED' });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('urusan penjamin');
  });

  it('yang belum diajukan boleh dibatalkan', () => {
    expect(bolehPindahStatusKlaim({ from: 'DRAFT', to: 'CANCELLED' }).allowed).toBe(true);
    expect(bolehPindahStatusKlaim({ from: 'CODED', to: 'CANCELLED' }).allowed).toBe(true);
  });

  it('yang ditolak dapat disengketakan atau dikembalikan ke draft', () => {
    expect(bolehPindahStatusKlaim({ from: 'REJECTED', to: 'DISPUTED' }).allowed).toBe(true);
    expect(bolehPindahStatusKlaim({ from: 'REJECTED', to: 'DRAFT' }).allowed).toBe(true);
  });

  it('yang disetujui sebagian dapat disengketakan atau dibayar', () => {
    expect(bolehPindahStatusKlaim({ from: 'PARTIALLY_APPROVED', to: 'DISPUTED' }).allowed).toBe(true);
    expect(bolehPindahStatusKlaim({ from: 'PARTIALLY_APPROVED', to: 'PAID' }).allowed).toBe(true);
  });

  it('rekonsiliasi adalah ujungnya', () => {
    expect(bolehPindahStatusKlaim({ from: 'RECONCILED', to: 'PAID' }).allowed).toBe(false);
  });

  it('melompati verifikasi internal ditolak', () => {
    expect(bolehPindahStatusKlaim({ from: 'CODED', to: 'SUBMITTED' }).allowed).toBe(false);
  });

  it('status yang tidak dikenal ditolak', () => {
    expect(
      bolehPindahStatusKlaim({ from: 'TIDAK_ADA' as StatusKlaim, to: 'PAID' }).allowed,
    ).toBe(false);
  });
});

describe('verifikasi internal', () => {
  it('berkas bersih tidak menghasilkan temuan', () => {
    const h = verifikasiInternal(berkas());
    expect(h.clean).toBe(true);
    expect(h.blockingCount).toBe(0);
  });

  it('diagnosis utama yang tidak ada ditemukan', () => {
    const h = verifikasiInternal(berkas({ principalDiagnosisCount: 0 }));
    expect(h.findings.some((t) => t.type === 'MISSING_PRINCIPAL_DIAGNOSIS')).toBe(true);
  });

  it('diagnosis utama lebih dari satu ditemukan', () => {
    const h = verifikasiInternal(berkas({ principalDiagnosisCount: 2 }));
    expect(h.findings.find((t) => t.type === 'MULTIPLE_PRINCIPAL_DIAGNOSIS')?.message)
      .toContain('urutan baris');
  });

  it('kode yang tidak sah pada versi terminologinya ditemukan', () => {
    const h = verifikasiInternal(berkas({ invalidCodeCount: 2 }));
    expect(h.findings.find((t) => t.type === 'INVALID_DIAGNOSIS_CODE')?.message)
      .toContain('tanggal layanannya');
  });

  it('tindakan yang belum berkode ditemukan', () => {
    const h = verifikasiInternal(berkas({ procedureCount: 3, codedProcedureCount: 1 }));
    expect(h.findings.find((t) => t.type === 'UNCODED_PROCEDURE')?.message)
      .toContain('2 tindakan');
  });

  it('resume pulang yang belum ditandatangani ditemukan', () => {
    const h = verifikasiInternal(berkas({ dischargeSummarySigned: false }));
    expect(h.findings.some((t) => t.type === 'UNSIGNED_DISCHARGE_SUMMARY')).toBe(true);
  });

  it('rawat jalan TIDAK dituntut resume pulang', () => {
    const h = verifikasiInternal(
      berkas({ isInpatient: false, hasDischargeSummary: false, dischargeSummarySigned: false }),
    );
    expect(h.findings.some((t) => t.type === 'UNSIGNED_DISCHARGE_SUMMARY')).toBe(false);
  });

  it('hasil penunjang yang dirujuk tetapi tidak ada ditemukan', () => {
    /*
     * Yang pertama menemukannya biasanya verifikator penjamin, dan ketika ia
     * menemukannya seluruh klaim dikembalikan — bukan satu barisnya.
     */
    const h = verifikasiInternal(berkas({ referencedResultCount: 3, availableResultCount: 1 }));
    expect(h.findings.find((t) => t.type === 'MISSING_SUPPORTING_RESULT')?.message)
      .toContain('2 hasil penunjang');
  });

  it('SEP yang tidak sesuai kunjungannya ditemukan', () => {
    const h = verifikasiInternal(berkas({ sepNumber: 'SEP-1', sepEncounterMatches: false }));
    expect(h.findings.some((t) => t.type === 'SEP_MISMATCH')).toBe(true);
  });

  it('klaim tanpa SEP tidak diperiksa kesesuaiannya', () => {
    const h = verifikasiInternal(berkas({ sepNumber: null, sepEncounterMatches: false }));
    expect(h.findings.some((t) => t.type === 'SEP_MISMATCH')).toBe(false);
  });

  it('tanggal pulang yang mendahului tanggal masuk ditemukan', () => {
    const h = verifikasiInternal(
      berkas({ admittedAt: '2026-06-05', dischargedAt: '2026-06-01' }),
    );
    expect(h.findings.some((t) => t.type === 'IMPLAUSIBLE_DATES')).toBe(true);
  });

  it('tanda tangan dokter penanggung jawab yang tidak ada ditemukan', () => {
    const h = verifikasiInternal(berkas({ hasAttendingSignature: false }));
    expect(h.findings.some((t) => t.type === 'MISSING_ATTENDING_SIGNATURE')).toBe(true);
  });

  it('kelas yang melebihi hak peserta DILAPORKAN tetapi TIDAK menahan', () => {
    /*
     * Naik kelas atas permintaan pasien sah, dan selisihnya ditagihkan kepada
     * pasien. Menahannya akan membuat verifikasi internal dimatikan oleh orang
     * pertama yang klaimnya tertahan karena hal yang memang sah.
     */
    const h = verifikasiInternal(berkas({ billedClass: 'CLASS_1', entitledClass: 'CLASS_3' }));
    const temuan = h.findings.find((t) => t.type === 'CLASS_EXCEEDS_ENTITLEMENT');
    expect(temuan?.blocksSubmission).toBe(false);
    expect(temuan?.message).toContain('bukan kepada penjamin');
    expect(h.blockingCount).toBe(0);
  });

  it('kelas yang sama atau lebih rendah tidak dilaporkan', () => {
    const h = verifikasiInternal(berkas({ billedClass: 'CLASS_3', entitledClass: 'CLASS_1' }));
    expect(h.findings.some((t) => t.type === 'CLASS_EXCEEDS_ENTITLEMENT')).toBe(false);
  });

  it('setiap temuan menyebut siapa yang memperbaikinya', () => {
    const h = verifikasiInternal(
      berkas({ principalDiagnosisCount: 0, invalidCodeCount: 1, hasAttendingSignature: false }),
    );
    expect(h.findings.every((t) => Boolean(t.responsibleRole))).toBe(true);
  });
});

describe('kelayakan pengajuan', () => {
  it('klaim yang sudah diverifikasi dan bersih boleh diajukan', () => {
    const v = verifikasiInternal(berkas());
    expect(bolehAjukan({ verifikasi: v, status: 'INTERNALLY_VERIFIED' }).allowed).toBe(true);
  });

  it('klaim yang belum diverifikasi DITOLAK', () => {
    const v = verifikasiInternal(berkas());
    const h = bolehAjukan({ verifikasi: v, status: 'CODED' });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('berminggu-minggu');
  });

  it('temuan yang menahan menghentikan pengajuan', () => {
    const v = verifikasiInternal(berkas({ principalDiagnosisCount: 0 }));
    const h = bolehAjukan({ verifikasi: v, status: 'INTERNALLY_VERIFIED' });
    expect(h.allowed).toBe(false);
    expect(h.blockers).toHaveLength(1);
  });

  it('temuan yang TIDAK menahan tidak menghentikan pengajuan', () => {
    const v = verifikasiInternal(berkas({ billedClass: 'VIP', entitledClass: 'CLASS_3' }));
    expect(v.clean).toBe(false);
    expect(bolehAjukan({ verifikasi: v, status: 'INTERNALLY_VERIFIED' }).allowed).toBe(true);
  });
});

describe('tiga angka', () => {
  it('belum ada keputusan penjamin tidak menghitung selisih', () => {
    const h = bandingkanTigaAngka({ submittedAmount: 10000000 });
    expect(h.approvalGap).toBeNull();
  });

  it('disetujui penuh dan dibayar penuh tidak berselisih', () => {
    const h = bandingkanTigaAngka({
      submittedAmount: 10000000,
      approvedAmount: 10000000,
      paidAmount: 10000000,
    });
    expect(h.approvalGap).toBe(0);
    expect(h.paymentGap).toBe(0);
    expect(h.message).toContain('penuh');
  });

  it('disetujui kurang menghitung selisihnya', () => {
    const h = bandingkanTigaAngka({
      submittedAmount: 10000000,
      approvedAmount: 7000000,
      rejectionReason: 'CODING_ERROR',
    });
    expect(h.approvalGap).toBe(3000000);
    expect(h.needsReason).toBe(false);
  });

  it('selisih tanpa sebab ditandai perlu sebab', () => {
    const h = bandingkanTigaAngka({ submittedAmount: 10000000, approvedAmount: 7000000 });
    expect(h.needsReason).toBe(true);
    expect(h.message).toContain('sebabnya belum dicatat');
  });

  it('dibayar kurang daripada disetujui dihitung terpisah', () => {
    // Disetujui dan dibayar adalah dua angka yang berbeda.
    const h = bandingkanTigaAngka({
      submittedAmount: 10000000,
      approvedAmount: 10000000,
      paidAmount: 9000000,
    });
    expect(h.approvalGap).toBe(0);
    expect(h.paymentGap).toBe(1000000);
  });

  it('disetujui LEBIH BESAR daripada diajukan menuntut telaah', () => {
    /*
     * Ia hampir selalu berarti pengajuannya keliru, dan kekeliruan yang
     * menguntungkan adalah kekeliruan yang paling jarang dilaporkan.
     */
    const h = bandingkanTigaAngka({ submittedAmount: 7000000, approvedAmount: 10000000 });
    expect(h.needsReview).toBe(true);
    expect(h.message).toContain('paling jarang dilaporkan');
  });

  it('dibayar lebih besar daripada disetujui menuntut telaah pula', () => {
    const h = bandingkanTigaAngka({
      submittedAmount: 10000000,
      approvedAmount: 7000000,
      paidAmount: 9000000,
      rejectionReason: 'TARIFF_MISMATCH',
    });
    expect(h.needsReview).toBe(true);
  });

  it('nilai negatif ditolak', () => {
    expect(() => bandingkanTigaAngka({ submittedAmount: -1 })).toThrow();
    expect(() =>
      bandingkanTigaAngka({ submittedAmount: 1, approvedAmount: -1 }),
    ).toThrow();
  });
});

describe('pencatatan keputusan penjamin', () => {
  it('disetujui penuh diterima tanpa sebab', () => {
    expect(
      bolehCatatKeputusan({ submittedAmount: 1000, approvedAmount: 1000 }).allowed,
    ).toBe(true);
  });

  it('selisih TANPA sebab ditolak', () => {
    const h = bolehCatatKeputusan({ submittedAmount: 1000, approvedAmount: 700 });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('kode tertutup');
  });

  it('penolakannya menyebut mengapa teks bebas tidak cukup', () => {
    const h = bolehCatatKeputusan({ submittedAmount: 1000, approvedAmount: 700 });
    expect(h.message).toContain('tidak dapat memperbaikinya');
  });

  it('selisih dengan sebab kode tertutup diterima', () => {
    expect(
      bolehCatatKeputusan({
        submittedAmount: 1000,
        approvedAmount: 700,
        rejectionReason: 'DOCUMENTATION_INCOMPLETE',
      }).allowed,
    ).toBe(true);
  });

  it('sebab OTHER wajib disertai keterangan', () => {
    /*
     * Tanpa itu, ia menjadi tempat pembuangan yang menampung separuh penolakan
     * dan tidak menjelaskan satu pun.
     */
    const h = bolehCatatKeputusan({
      submittedAmount: 1000,
      approvedAmount: 700,
      rejectionReason: 'OTHER',
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('tempat pembuangan');
  });

  it('sebab OTHER dengan keterangan diterima', () => {
    expect(
      bolehCatatKeputusan({
        submittedAmount: 1000,
        approvedAmount: 700,
        rejectionReason: 'OTHER',
        reasonNote: 'Perbedaan tafsir atas lampiran peraturan; sedang dibicarakan.',
      }).allowed,
    ).toBe(true);
  });

  it('sembilan sebab tertutup tersedia', () => {
    expect(SEBAB_PENOLAKAN).toHaveLength(9);
  });

  it('nilai disetujui negatif ditolak', () => {
    expect(
      bolehCatatKeputusan({ submittedAmount: 1000, approvedAmount: -1 }).allowed,
    ).toBe(false);
  });
});

describe('rekonsiliasi tiga sisi', () => {
  it('ketiga sisi cocok dapat ditutup', () => {
    const h = rekonsiliasi({
      ourPaidAmount: 1000,
      payerStatedAmount: 1000,
      bankCreditedAmount: 1000,
    });
    expect(h.balanced).toBe(true);
    expect(h.canClose).toBe(true);
  });

  it('selisih yang TIDAK terjelaskan tidak boleh ditutup', () => {
    /*
     * Rekonsiliasi yang dapat ditutup dengan selisih akan selalu ditutup dengan
     * selisih.
     */
    const h = rekonsiliasi({
      ourPaidAmount: 1000,
      payerStatedAmount: 900,
      bankCreditedAmount: 900,
    });
    expect(h.balanced).toBe(false);
    expect(h.canClose).toBe(false);
    expect(h.message).toContain('akan selalu ditutup dengan selisih');
  });

  it('selisih dengan penjelasan boleh ditutup', () => {
    const h = rekonsiliasi({
      ourPaidAmount: 1000,
      payerStatedAmount: 900,
      bankCreditedAmount: 900,
      explanation: 'Potongan administrasi bank; bukti transfer nomor 123.',
    });
    expect(h.canClose).toBe(true);
  });

  it('selisih antara penjamin dan bank dihitung terpisah', () => {
    const h = rekonsiliasi({
      ourPaidAmount: 1000,
      payerStatedAmount: 1000,
      bankCreditedAmount: 950,
    });
    expect(h.payerGap).toBe(0);
    expect(h.bankGap).toBe(50);
  });

  it('toleransi kecil tidak dianggap selisih', () => {
    const h = rekonsiliasi({
      ourPaidAmount: 1000,
      payerStatedAmount: 999,
      bankCreditedAmount: 999,
      tolerance: 1,
    });
    expect(h.balanced).toBe(true);
  });

  it('kedua selisih dilaporkan sekaligus', () => {
    const h = rekonsiliasi({
      ourPaidAmount: 1000,
      payerStatedAmount: 900,
      bankCreditedAmount: 800,
    });
    expect(h.payerGap).toBe(100);
    expect(h.bankGap).toBe(100);
  });
});

describe('penanda untuk telaah', () => {
  it('tidak ada yang ditandai bila semuanya biasa', () => {
    const h = tandaiUntukTelaah({
      duplicateOnSameMemberAndDate: false,
      procedureUnusualForDiagnosis: false,
    });
    expect(h.needsReview).toBe(false);
  });

  it('klaim ganda pada kepesertaan dan tanggal yang sama ditandai', () => {
    const h = tandaiUntukTelaah({
      duplicateOnSameMemberAndDate: true,
      procedureUnusualForDiagnosis: false,
    });
    expect(h.flags.some((f) => f.type === 'DUPLICATE_MEMBER_DATE')).toBe(true);
  });

  it('lama rawat jauh di luar kebiasaan ditandai', () => {
    const h = tandaiUntukTelaah({
      duplicateOnSameMemberAndDate: false,
      procedureUnusualForDiagnosis: false,
      lengthOfStayDays: 30,
      typicalLengthOfStayDays: 4,
    });
    expect(h.flags.find((f) => f.type === 'LENGTH_OF_STAY_OUTLIER')?.message)
      .toContain('Dapat benar; perlu dilihat');
  });

  it('lama rawat yang wajar tidak ditandai', () => {
    const h = tandaiUntukTelaah({
      duplicateOnSameMemberAndDate: false,
      procedureUnusualForDiagnosis: false,
      lengthOfStayDays: 6,
      typicalLengthOfStayDays: 4,
    });
    expect(h.needsReview).toBe(false);
  });

  it('pemasukan ulang yang cepat ditandai', () => {
    const h = tandaiUntukTelaah({
      duplicateOnSameMemberAndDate: false,
      procedureUnusualForDiagnosis: false,
      daysSincePreviousDischarge: 2,
    });
    expect(h.flags.some((f) => f.type === 'RAPID_READMISSION')).toBe(true);
  });

  it('pola pengkodean yang menyimpang ditandai', () => {
    const h = tandaiUntukTelaah({
      duplicateOnSameMemberAndDate: false,
      procedureUnusualForDiagnosis: false,
      coderDeviationScore: 5,
    });
    expect(h.flags.some((f) => f.type === 'CODER_PATTERN_OUTLIER')).toBe(true);
  });

  it('TIDAK SATU PUN penanda menghentikan pengajuan', () => {
    /*
     * Penghentian otomatis pada penanda statistik akan menahan klaim yang sah
     * dari pasien yang memang sakit berat — dan rumah sakit yang klaimnya
     * tertahan akan berhenti memakai penandanya.
     */
    const h = tandaiUntukTelaah({
      duplicateOnSameMemberAndDate: true,
      procedureUnusualForDiagnosis: true,
      lengthOfStayDays: 60,
      typicalLengthOfStayDays: 3,
      coderDeviationScore: 9,
      daysSincePreviousDischarge: 1,
    });
    expect(h.flags).toHaveLength(5);
    for (const f of h.flags) expect(f.blocksSubmission).toBe(false);
  });

  it('pesannya menyatakan ini BUKAN tuduhan', () => {
    // Penanda yang berbunyi seperti tuduhan akan dibantah alih-alih ditelaah.
    const h = tandaiUntukTelaah({
      duplicateOnSameMemberAndDate: true,
      procedureUnusualForDiagnosis: false,
    });
    expect(h.message).toContain('BUKAN tuduhan');
    expect(h.message).toContain('tidak menghentikan pengajuan');
  });

  it('kata fraud tidak muncul pada satu pun pesannya', () => {
    const h = tandaiUntukTelaah({
      duplicateOnSameMemberAndDate: true,
      procedureUnusualForDiagnosis: true,
      coderDeviationScore: 9,
    });
    for (const f of h.flags) expect(f.message.toLowerCase()).not.toContain('fraud');
    expect(h.message.toLowerCase()).not.toContain('fraud');
  });
});
