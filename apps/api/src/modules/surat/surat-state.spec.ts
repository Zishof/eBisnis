import {
  canTransition,
  isEditable,
  nextStatuses,
  requiresNumber,
  statusAfterDecision,
  SURAT_OUTGOING_STATUSES,
  type SuratOutgoingStatus,
} from './surat-state';

describe('canTransition', () => {
  it('konsep dapat diajukan', () => {
    expect(canTransition('KONSEP', 'DIAJUKAN').allowed).toBe(true);
  });

  it('surat yang sudah terbit TIDAK dapat kembali menjadi konsep', () => {
    /*
     * Surat yang sudah bernomor dan keluar tidak dapat ditarik kembali dari
     * penerimanya. Menyuntingnya berarti riwayatnya berbohong: yang tersimpan
     * bukan lagi surat yang benar-benar dikirim. Yang benar adalah membuat
     * surat baru yang menggantikannya.
     */
    const hasil = canTransition('DITERBITKAN', 'KONSEP');
    expect(hasil.allowed).toBe(false);
    expect(hasil.reason).toContain('DITERBITKAN');
  });

  it('pembatalan bersifat akhir', () => {
    for (const tujuan of SURAT_OUTGOING_STATUSES) {
      expect(canTransition('DIBATALKAN', tujuan).allowed).toBe(false);
    }
  });

  it('pengarsipan bersifat akhir', () => {
    for (const tujuan of SURAT_OUTGOING_STATUSES) {
      expect(canTransition('DIARSIPKAN', tujuan).allowed).toBe(false);
    }
  });

  it('surat yang ditolak masih dapat diperbaiki lalu diajukan ulang', () => {
    expect(canTransition('DITOLAK', 'DIREVISI').allowed).toBe(true);
    expect(canTransition('DIREVISI', 'DIAJUKAN').allowed).toBe(true);
  });

  it('pengaju dapat menarik kembali selama belum ada keputusan', () => {
    expect(canTransition('DIAJUKAN', 'KONSEP').allowed).toBe(true);
  });

  it('status yang sama ditolak dengan alasan yang jelas', () => {
    const hasil = canTransition('KONSEP', 'KONSEP');
    expect(hasil.allowed).toBe(false);
    expect(hasil.reason).toContain('sudah berstatus');
  });

  it('alasan penolakan menyebutkan apa yang sebenarnya boleh', () => {
    // "Tidak dapat mengubah status" memaksa penggunanya menebak.
    const hasil = canTransition('KONSEP', 'DITERBITKAN');
    expect(hasil.allowed).toBe(false);
    expect(hasil.reason).toContain('DIAJUKAN');
  });

  it('tidak ada jalan menuju DITERBITKAN selain lewat DISETUJUI', () => {
    // Sifat yang menjaga agar nomor resmi tidak pernah keluar tanpa persetujuan.
    const dariMana = SURAT_OUTGOING_STATUSES.filter(
      (s) => canTransition(s, 'DITERBITKAN').allowed,
    );
    expect(dariMana).toEqual(['DISETUJUI']);
  });

  it('seluruh status dapat mencapai DIBATALKAN atau bersifat akhir', () => {
    const akhir: SuratOutgoingStatus[] = ['DIBATALKAN', 'DIARSIPKAN'];
    for (const status of SURAT_OUTGOING_STATUSES) {
      if (akhir.includes(status)) continue;
      const bisa = nextStatuses(status);
      // Setiap status yang belum akhir harus punya jalan keluar; status buntu
      // berarti surat yang tidak dapat diapa-apakan lagi.
      expect(bisa.length).toBeGreaterThan(0);
    }
  });
});

describe('requiresNumber dan isEditable', () => {
  it('status yang sudah keluar wajib bernomor', () => {
    expect(requiresNumber('DITERBITKAN')).toBe(true);
    expect(requiresNumber('DIKIRIM')).toBe(true);
    expect(requiresNumber('DIARSIPKAN')).toBe(true);
  });

  it('konsep belum wajib bernomor', () => {
    // Nomor yang sudah keluar tidak dapat ditarik kembali bila konsepnya
    // ternyata dibatalkan.
    expect(requiresNumber('KONSEP')).toBe(false);
    expect(requiresNumber('DIAJUKAN')).toBe(false);
    expect(requiresNumber('DISETUJUI')).toBe(false);
  });

  it('surat yang sudah bernomor tidak dapat disunting', () => {
    for (const status of SURAT_OUTGOING_STATUSES) {
      if (requiresNumber(status)) expect(isEditable(status)).toBe(false);
    }
  });

  it('hanya konsep, revisi, dan tertolak yang dapat disunting', () => {
    expect(isEditable('KONSEP')).toBe(true);
    expect(isEditable('DIREVISI')).toBe(true);
    expect(isEditable('DITOLAK')).toBe(true);
    expect(isEditable('DIAJUKAN')).toBe(false);
    expect(isEditable('DISETUJUI')).toBe(false);
  });
});

describe('statusAfterDecision', () => {
  it('persetujuan pada langkah terakhir menyelesaikan alur', () => {
    expect(
      statusAfterDecision({
        decision: 'DISETUJUI',
        stepOrder: 3,
        totalSteps: 3,
        enforceAllSteps: true,
      }),
    ).toEqual({ status: 'DISETUJUI', nextStep: null });
  });

  it('persetujuan di tengah melanjutkan ke langkah berikutnya', () => {
    expect(
      statusAfterDecision({
        decision: 'DISETUJUI',
        stepOrder: 1,
        totalSteps: 3,
        enforceAllSteps: true,
      }),
    ).toEqual({ status: 'DIAJUKAN', nextStep: 2 });
  });

  it('penolakan menghentikan alur di mana pun langkahnya', () => {
    expect(
      statusAfterDecision({
        decision: 'DITOLAK',
        stepOrder: 1,
        totalSteps: 5,
        enforceAllSteps: true,
      }),
    ).toEqual({ status: 'DITOLAK', nextStep: null });
  });

  it('pengembalian memulangkan surat untuk direvisi, bukan menolaknya', () => {
    expect(
      statusAfterDecision({
        decision: 'DIKEMBALIKAN',
        stepOrder: 2,
        totalSteps: 5,
        enforceAllSteps: true,
      }),
    ).toEqual({ status: 'DIREVISI', nextStep: null });
  });

  it('alur wajib TIDAK dapat diselesaikan lebih awal meski diminta', () => {
    // Inilah gunanya enforceAllSteps. Tanpa pemeriksaan ini, penyetuju pertama
    // dapat melewatkan seluruh penyetuju berikutnya.
    expect(
      statusAfterDecision({
        decision: 'DISETUJUI',
        stepOrder: 1,
        totalSteps: 5,
        enforceAllSteps: true,
        finalize: true,
      }),
    ).toEqual({ status: 'DIAJUKAN', nextStep: 2 });
  });

  it('alur tidak wajib dapat diselesaikan lebih awal bila dinyatakan', () => {
    expect(
      statusAfterDecision({
        decision: 'DISETUJUI',
        stepOrder: 2,
        totalSteps: 5,
        enforceAllSteps: false,
        finalize: true,
      }),
    ).toEqual({ status: 'DISETUJUI', nextStep: null });
  });

  it('menyetujui tanpa menyatakan selesai TIDAK melewatkan langkah berikutnya', () => {
    /*
     * Niat menyelesaikan lebih awal harus dinyatakan terpisah dari keputusan
     * menyetujui. Seorang direktur yang menyetujui langkah kedua dari lima
     * belum tentu bermaksud melewatkan tiga langkah sisanya, dan menebakkan
     * maksud itu akan melewatkan penyetuju yang seharusnya ikut membaca.
     */
    expect(
      statusAfterDecision({
        decision: 'DISETUJUI',
        stepOrder: 2,
        totalSteps: 5,
        enforceAllSteps: false,
      }),
    ).toEqual({ status: 'DIAJUKAN', nextStep: 3 });
  });

  it('langkah yang dilewati tetap melanjutkan alur', () => {
    expect(
      statusAfterDecision({
        decision: 'DILEWATI',
        stepOrder: 2,
        totalSteps: 4,
        enforceAllSteps: true,
      }),
    ).toEqual({ status: 'DIAJUKAN', nextStep: 3 });
  });

  it('alur satu langkah selesai begitu disetujui', () => {
    expect(
      statusAfterDecision({
        decision: 'DISETUJUI',
        stepOrder: 1,
        totalSteps: 1,
        enforceAllSteps: true,
      }),
    ).toEqual({ status: 'DISETUJUI', nextStep: null });
  });
});
