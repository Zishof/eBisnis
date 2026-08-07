/**
 * Pengujian mesin transisi status penjualan.
 *
 * Satu aturan dijaga paling ketat: **transaksi yang sudah dibayar tidak dapat
 * disunting, dan pembatalannya tidak dapat disetujui pemohonnya sendiri.**
 */

import {
  POS_SALE_STATUSES,
  POS_SALE_TRANSITIONS,
  bolehMenyetujui,
  bolehPindah,
  bolehSuntingBaris,
  isTerminal,
  statusRefund,
  statusRetur,
  sudahDibayar,
  type PosSaleStatus,
} from './pos-sale-state';

describe('kelengkapan tabel transisi', () => {
  it('setiap status punya entri', () => {
    for (const s of POS_SALE_STATUSES) {
      expect(POS_SALE_TRANSITIONS[s]).toBeDefined();
    }
  });

  it('tidak menunjuk status yang tidak ada', () => {
    const dikenal = new Set<string>(POS_SALE_STATUSES);
    for (const [dari, tujuan] of Object.entries(POS_SALE_TRANSITIONS)) {
      for (const t of tujuan) {
        expect(dikenal.has(t)).toBe(true);
      }
      expect(dikenal.has(dari)).toBe(true);
    }
  });

  it('tiga status bersifat final', () => {
    const final = POS_SALE_STATUSES.filter(isTerminal);
    expect(final.sort()).toEqual(['CANCELLED', 'REFUNDED_FULL', 'VOIDED'].sort());
  });

  it('setiap status dapat dicapai dari DRAFT, kecuali DRAFT sendiri', () => {
    /*
     * Status yang tidak dapat dicapai adalah status yang tidak pernah terjadi —
     * dan kode yang menanganinya tidak pernah dijalankan, sehingga cacatnya
     * tidak pernah ketahuan.
     */
    const tercapai = new Set<PosSaleStatus>(['DRAFT']);
    let berubah = true;
    while (berubah) {
      berubah = false;
      for (const s of [...tercapai]) {
        for (const t of POS_SALE_TRANSITIONS[s]) {
          if (!tercapai.has(t)) {
            tercapai.add(t);
            berubah = true;
          }
        }
      }
    }
    const tidakTercapai = POS_SALE_STATUSES.filter((s) => !tercapai.has(s));
    expect(tidakTercapai).toEqual([]);
  });
});

describe('perpindahan status', () => {
  it('mengizinkan alur penjualan yang biasa', () => {
    expect(bolehPindah('DRAFT', 'PAYMENT_PENDING').allowed).toBe(true);
    expect(bolehPindah('PAYMENT_PENDING', 'PAID').allowed).toBe(true);
    expect(bolehPindah('PAID', 'COMPLETED').allowed).toBe(true);
  });

  it('menolak lompatan dari draf langsung ke selesai', () => {
    // Melompati PAID berarti melompati penerimaan uang.
    const v = bolehPindah('DRAFT', 'COMPLETED');
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('DRAFT');
  });

  it('PAID hanya boleh maju ke COMPLETED', () => {
    /*
     * PAID adalah keadaan sesaat: uang sudah diterima tetapi stok dan jurnal
     * belum terbentuk. Membiarkannya kembali ke DRAFT atau menjadi CANCELLED
     * berarti uang yang sudah masuk tidak punya transaksi yang menaunginya.
     */
    expect(POS_SALE_TRANSITIONS.PAID).toEqual(['COMPLETED']);
    expect(bolehPindah('PAID', 'CANCELLED').allowed).toBe(false);
    expect(bolehPindah('PAID', 'DRAFT').allowed).toBe(false);
  });

  it('menolak perpindahan dari status final', () => {
    for (const s of ['VOIDED', 'CANCELLED', 'REFUNDED_FULL'] as PosSaleStatus[]) {
      const v = bolehPindah(s, 'COMPLETED');
      expect(v.allowed).toBe(false);
      expect(v.message).toContain('final');
    }
  });

  it('menolak perpindahan ke status yang sama', () => {
    expect(bolehPindah('DRAFT', 'DRAFT').allowed).toBe(false);
  });

  it('pembatalan transaksi selesai selalu melewati permintaan lebih dahulu', () => {
    expect(bolehPindah('COMPLETED', 'VOIDED').allowed).toBe(false);
    expect(bolehPindah('COMPLETED', 'VOID_REQUESTED').allowed).toBe(true);
    expect(bolehPindah('VOID_REQUESTED', 'VOIDED').allowed).toBe(true);
  });

  it('permintaan pembatalan dapat ditarik kembali', () => {
    // Supervisor yang menolak permintaan mengembalikannya ke COMPLETED, bukan
    // membiarkannya menggantung selamanya.
    expect(bolehPindah('VOID_REQUESTED', 'COMPLETED').allowed).toBe(true);
  });

  it('keranjang yang ditahan dapat dilanjutkan atau dibatalkan', () => {
    expect(bolehPindah('HELD', 'DRAFT').allowed).toBe(true);
    expect(bolehPindah('HELD', 'CANCELLED').allowed).toBe(true);
    expect(bolehPindah('HELD', 'PAID').allowed).toBe(false);
  });

  it('retur sebagian dapat berlanjut menjadi retur penuh', () => {
    expect(bolehPindah('RETURNED_PARTIAL', 'RETURNED_FULL').allowed).toBe(true);
    expect(bolehPindah('RETURNED_PARTIAL', 'RETURNED_PARTIAL').allowed).toBe(false);
  });
});

describe('hak akses yang dituntut transisi', () => {
  it('penjualan menuntut hak SELL', () => {
    expect(bolehPindah('DRAFT', 'PAYMENT_PENDING').requiresPermission).toBe('POS_SALE.SELL');
  });

  it('menahan dan melanjutkan menuntut haknya masing-masing', () => {
    expect(bolehPindah('DRAFT', 'HELD').requiresPermission).toBe('POS_SALE.HOLD');
    expect(bolehPindah('HELD', 'DRAFT').requiresPermission).toBe('POS_SALE.RESUME');
  });

  it('persetujuan pembatalan menuntut hak APPROVE dan ditandai butuh persetujuan', () => {
    const v = bolehPindah('VOID_REQUESTED', 'VOIDED');
    expect(v.requiresPermission).toBe('POS_SALE.APPROVE');
    expect(v.requiresApproval).toBe(true);
  });

  it('penolakan pembatalan menuntut hak yang sama dengan menyetujuinya', () => {
    // Menolak permintaan pembatalan adalah keputusan supervisor yang sama
    // beratnya dengan menyetujuinya -- keduanya menutup VOID_REQUESTED.
    // Sebelum baris ini ada, transisi ini tidak menuntut hak akses apa pun.
    const v = bolehPindah('VOID_REQUESTED', 'COMPLETED');
    expect(v.requiresPermission).toBe('POS_SALE.APPROVE');
    expect(v.requiresApproval).toBe(true);
  });

  it('refund menuntut hak REFUND_APPROVE', () => {
    for (const ke of ['REFUNDED_PARTIAL', 'REFUNDED_FULL'] as PosSaleStatus[]) {
      const v = bolehPindah('REFUND_PENDING', ke);
      expect(v.requiresPermission).toBe('POS_RETURN.REFUND_APPROVE');
      expect(v.requiresApproval).toBe(true);
    }
  });

  it('setiap transisi yang butuh persetujuan juga menuntut hak akses', () => {
    // Persetujuan tanpa hak akses adalah pemeriksaan yang tidak menahan apa pun.
    for (const dari of POS_SALE_STATUSES) {
      for (const ke of POS_SALE_TRANSITIONS[dari]) {
        const v = bolehPindah(dari, ke);
        if (v.requiresApproval) expect(v.requiresPermission).toBeTruthy();
      }
    }
  });
});

describe('penyuntingan baris', () => {
  it('draf dan keranjang tertahan boleh disunting', () => {
    expect(bolehSuntingBaris('DRAFT').allowed).toBe(true);
    expect(bolehSuntingBaris('HELD').allowed).toBe(true);
  });

  it('transaksi yang sudah dibayar tidak dapat disunting', () => {
    for (const s of ['PAID', 'COMPLETED', 'RETURNED_PARTIAL'] as PosSaleStatus[]) {
      const v = bolehSuntingBaris(s);
      expect(v.allowed).toBe(false);
      // Pesannya mengarahkan ke jalan yang benar, bukan sekadar menolak.
      expect(v.message).toContain('retur');
    }
  });

  it('menunggu pembayaran pun tidak dapat disunting', () => {
    // Mengubah keranjang sementara mesin EDC sedang memproses akan membuat
    // yang dibayar berbeda dari yang tercatat.
    expect(bolehSuntingBaris('PAYMENT_PENDING').allowed).toBe(false);
  });

  it('setiap status yang sudah dibayar tidak dapat disunting', () => {
    for (const s of POS_SALE_STATUSES) {
      if (sudahDibayar(s)) expect(bolehSuntingBaris(s).allowed).toBe(false);
    }
  });
});

describe('pemisahan wewenang', () => {
  it('menolak penyetujuan atas permintaan sendiri', () => {
    const v = bolehMenyetujui('U1', 'U1');
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('sendiri');
  });

  it('mengizinkan penyetujuan oleh orang lain', () => {
    expect(bolehMenyetujui('U1', 'U2').allowed).toBe(true);
  });

  it('permintaan tanpa pemohon tercatat tidak menghalangi', () => {
    // Terjadi pada data lama sebelum pemohon dicatat. Menolaknya akan membuat
    // transaksi lama tidak dapat diselesaikan sama sekali.
    expect(bolehMenyetujui(null, 'U2').allowed).toBe(true);
  });
});

describe('status turunan retur dan refund', () => {
  it('retur sebagian dan penuh dibedakan dari jumlahnya', () => {
    expect(statusRetur(10, 0)).toBe('COMPLETED');
    expect(statusRetur(10, 4)).toBe('RETURNED_PARTIAL');
    expect(statusRetur(10, 10)).toBe('RETURNED_FULL');
  });

  it('retur melebihi jumlah baris tetap dianggap penuh', () => {
    // Tidak dapat lebih dari penuh, dan angka yang janggal tidak boleh
    // menghasilkan status yang tidak dikenal.
    expect(statusRetur(10, 12)).toBe('RETURNED_FULL');
  });

  it('refund sebagian dan penuh dibedakan dari nilainya', () => {
    expect(statusRefund(100000, 0)).toBe('REFUND_PENDING');
    expect(statusRefund(100000, 40000)).toBe('REFUNDED_PARTIAL');
    expect(statusRefund(100000, 100000)).toBe('REFUNDED_FULL');
  });
});
