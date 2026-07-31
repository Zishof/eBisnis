import {
  ALL_RETURN_STATUSES,
  RETURN_WINDOW_DAYS,
  canAdvanceReturn,
  canCompleteRefund,
  checkReturnEligibility,
  computeRefundAmount,
  isReturnTerminal,
  resolveRefundMethod,
  returnShippingBorneByBuyer,
  type ReturnStatus,
} from './return-rules';

const HARI = 24 * 60 * 60 * 1000;
const now = new Date('2026-07-31T00:00:00Z');

const eligibility = (over = {}) => ({
  orderStatus: 'DELIVERED',
  deliveredAt: new Date(now.getTime() - 2 * HARI),
  now,
  reasonCode: 'DAMAGED',
  hasOpenReturn: false,
  requestedQty: 1,
  orderedQty: 3,
  alreadyReturnedQty: 0,
  ...over,
});

describe('kelayakan retur', () => {
  it('meloloskan retur yang wajar', () => {
    expect(checkReturnEligibility(eligibility()).eligible).toBe(true);
  });

  it('menolak pesanan yang belum sampai', () => {
    // Barang yang belum diterima bukan retur, melainkan pembatalan — dan
    // keduanya menghasilkan akibat yang berbeda.
    const result = checkReturnEligibility(eligibility({ orderStatus: 'SHIPPED' }));
    expect(result.issues.map((i) => i.code)).toContain('ORDER_NOT_ELIGIBLE');
  });

  it('menerima pesanan yang sudah selesai', () => {
    expect(checkReturnEligibility(eligibility({ orderStatus: 'COMPLETED' })).eligible).toBe(true);
  });

  it('menolak setelah batas waktu lewat', () => {
    const result = checkReturnEligibility(
      eligibility({ deliveredAt: new Date(now.getTime() - (RETURN_WINDOW_DAYS + 1) * HARI) }),
    );
    expect(result.issues.map((i) => i.code)).toContain('WINDOW_EXPIRED');
  });

  it('menerima tepat pada hari terakhir', () => {
    const result = checkReturnEligibility(
      eligibility({ deliveredAt: new Date(now.getTime() - RETURN_WINDOW_DAYS * HARI) }),
    );
    expect(result.eligible).toBe(true);
  });

  it('menyebut berapa hari sudah lewat', () => {
    const result = checkReturnEligibility(
      eligibility({ deliveredAt: new Date(now.getTime() - 30 * HARI) }),
    );
    expect(result.issues.find((i) => i.code === 'WINDOW_EXPIRED')?.detail).toMatch(/30 hari/);
  });

  it('menolak bila waktu penerimaan belum tercatat', () => {
    const result = checkReturnEligibility(eligibility({ deliveredAt: null }));
    expect(result.issues.map((i) => i.code)).toContain('NOT_DELIVERED');
  });

  it('menolak pengajuan kedua selagi yang pertama berjalan', () => {
    const result = checkReturnEligibility(eligibility({ hasOpenReturn: true }));
    expect(result.issues.map((i) => i.code)).toContain('DUPLICATE_OPEN_RETURN');
  });

  it('menghitung yang sudah pernah diretur', () => {
    // Tanpa ini pembeli dapat meretur lebih banyak daripada yang dibelinya
    // lewat beberapa pengajuan terpisah.
    const result = checkReturnEligibility(
      eligibility({ orderedQty: 3, alreadyReturnedQty: 2, requestedQty: 2 }),
    );
    expect(result.issues.map((i) => i.code)).toContain('QUANTITY_EXCEEDS_ORDER');
    expect(result.issues[0].detail).toMatch(/Sisa yang dapat diretur 1/);
  });

  it.each([0, -1])('menolak jumlah %p', (requestedQty) => {
    const result = checkReturnEligibility(eligibility({ requestedQty }));
    expect(result.issues.map((i) => i.code)).toContain('QUANTITY_INVALID');
  });

  it('menolak alasan yang tidak dikenal', () => {
    const result = checkReturnEligibility(eligibility({ reasonCode: 'TIDAK_SUKA_WARNANYA' }));
    expect(result.issues.map((i) => i.code)).toContain('UNKNOWN_REASON');
  });

  it('melaporkan seluruh masalah sekaligus', () => {
    // Pembeli yang sudah kecewa tidak perlu ditolak berulang kali karena alasan
    // yang berbeda.
    const result = checkReturnEligibility(
      eligibility({
        orderStatus: 'SHIPPED',
        deliveredAt: null,
        hasOpenReturn: true,
        requestedQty: 0,
        reasonCode: 'X',
      }),
    );
    expect(result.issues.length).toBeGreaterThanOrEqual(5);
  });
});

describe('penanggung ongkos kirim balik', () => {
  it('membebankan kepada pembeli untuk alasan berubah pikiran', () => {
    expect(returnShippingBorneByBuyer('CHANGED_MIND')).toBe(true);
  });

  it.each(['DAMAGED', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'MISSING_PART'])(
    'membebankan kepada penjual untuk %s',
    (reason) => {
      expect(returnShippingBorneByBuyer(reason)).toBe(false);
    },
  );
});

describe('perhitungan pengembalian dana', () => {
  it('mengembalikan nilai barang yang diterima dalam keadaan baik', () => {
    const result = computeRefundAmount({
      lines: [{ unitPrice: 75000, receivedQuantity: 2, inspectionResult: 'GOOD' }],
      originalShipping: 20000,
      reasonCode: 'DAMAGED',
    });
    expect(result.itemsAmount).toBe(150000);
  });

  it('tidak mengembalikan barang yang tidak sampai', () => {
    // Kalau tidak, retur menjadi cara mendapat barang gratis.
    const result = computeRefundAmount({
      lines: [{ unitPrice: 75000, receivedQuantity: 1, inspectionResult: 'NOT_RECEIVED' }],
      originalShipping: 20000,
      reasonCode: 'DAMAGED',
    });
    expect(result.itemsAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it('tidak mengembalikan barang yang sampai dalam keadaan rusak', () => {
    const result = computeRefundAmount({
      lines: [{ unitPrice: 75000, receivedQuantity: 1, inspectionResult: 'DAMAGED' }],
      originalShipping: 20000,
      reasonCode: 'DAMAGED',
    });
    expect(result.itemsAmount).toBe(0);
    expect(result.excluded).toBe(75000);
  });

  it('melaporkan nilai yang dikecualikan agar dapat dijelaskan', () => {
    const result = computeRefundAmount({
      lines: [
        { unitPrice: 75000, receivedQuantity: 1, inspectionResult: 'GOOD' },
        { unitPrice: 68000, receivedQuantity: 1, inspectionResult: 'MISSING' },
      ],
      originalShipping: 20000,
      reasonCode: 'WRONG_ITEM',
    });
    expect(result.itemsAmount).toBe(75000);
    expect(result.excluded).toBe(68000);
  });

  it('mengembalikan ongkos kirim bila kesalahan pada penjual', () => {
    const result = computeRefundAmount({
      lines: [{ unitPrice: 75000, receivedQuantity: 1, inspectionResult: 'GOOD' }],
      originalShipping: 20000,
      reasonCode: 'WRONG_ITEM',
    });
    expect(result.shippingAmount).toBe(20000);
    expect(result.total).toBe(95000);
  });

  it('tidak mengembalikan ongkos kirim bila pembeli berubah pikiran', () => {
    const result = computeRefundAmount({
      lines: [{ unitPrice: 75000, receivedQuantity: 1, inspectionResult: 'GOOD' }],
      originalShipping: 20000,
      reasonCode: 'CHANGED_MIND',
    });
    expect(result.shippingAmount).toBe(0);
    expect(result.total).toBe(75000);
  });

  it('tidak mengembalikan ongkos kirim bila tidak ada barang yang layak', () => {
    const result = computeRefundAmount({
      lines: [{ unitPrice: 75000, receivedQuantity: 1, inspectionResult: 'DAMAGED' }],
      originalShipping: 20000,
      reasonCode: 'WRONG_ITEM',
    });
    expect(result.shippingAmount).toBe(0);
  });

  it('menghasilkan nol untuk daftar kosong', () => {
    expect(computeRefundAmount({ lines: [], originalShipping: 20000, reasonCode: 'DAMAGED' }).total).toBe(0);
  });
});

describe('cara pengembalian dana', () => {
  it('memakai penyedia bila terbukti mendukung', () => {
    const result = resolveRefundMethod({ providerSupportsRefund: true });
    expect(result.method).toBe('PROVIDER');
    expect(result.initialStatus).toBe('PROCESSING');
  });

  it('menyatakan manual bila penyedia belum mendukung', () => {
    // Bukan kegagalan, melainkan kenyataan yang dinyatakan.
    const result = resolveRefundMethod({ providerSupportsRefund: false });
    expect(result.method).toBe('MANUAL');
    expect(result.initialStatus).toBe('MANUAL_REQUIRED');
    expect(result.note).toMatch(/manual/i);
  });
});

describe('penyelesaian pengembalian dana', () => {
  it('menuntut bukti pada metode manual', () => {
    // Tanpa bukti, "sudah dikembalikan" hanya klaim.
    expect(canCompleteRefund('MANUAL', null).ok).toBe(false);
    expect(canCompleteRefund('MANUAL', '').ok).toBe(false);
    expect(canCompleteRefund('MANUAL', '  ').ok).toBe(false);
    expect(canCompleteRefund('MANUAL', 'ab').ok).toBe(false);
  });

  it('menerima bukti yang berisi', () => {
    expect(canCompleteRefund('MANUAL', 'TRF-20260731-0001').ok).toBe(true);
  });

  it('tidak menuntut bukti pada metode penyedia', () => {
    expect(canCompleteRefund('PROVIDER', null).ok).toBe(true);
  });
});

describe('perpindahan status retur', () => {
  it('mengizinkan alur normal', () => {
    const path: ReturnStatus[] = [
      'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'AWAITING_SHIPMENT',
      'IN_TRANSIT', 'RECEIVED', 'INSPECTED', 'REFUND_PENDING', 'COMPLETED',
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canAdvanceReturn(path[i], path[i + 1]).ok).toBe(true);
    }
  });

  it('mengizinkan penolakan disengketakan', () => {
    // Itulah gunanya sengketa: keputusan penjual bukan kata akhir.
    expect(canAdvanceReturn('REJECTED', 'DISPUTED').ok).toBe(true);
  });

  it('mengizinkan sengketa berakhir pada persetujuan maupun penolakan', () => {
    expect(canAdvanceReturn('DISPUTED', 'APPROVED').ok).toBe(true);
    expect(canAdvanceReturn('DISPUTED', 'REJECTED').ok).toBe(true);
  });

  it('menolak melompat langsung ke selesai', () => {
    expect(canAdvanceReturn('REQUESTED', 'COMPLETED').ok).toBe(false);
  });

  it('menandai status akhir', () => {
    expect(isReturnTerminal('COMPLETED')).toBe(true);
    expect(isReturnTerminal('CANCELLED')).toBe(true);
    expect(isReturnTerminal('REQUESTED')).toBe(false);
  });

  it('memberi setiap status berjalan jalan keluar', () => {
    const stuck = ALL_RETURN_STATUSES.filter(
      (s) => !isReturnTerminal(s) && !ALL_RETURN_STATUSES.some((to) => canAdvanceReturn(s, to).ok),
    );
    expect(stuck).toEqual([]);
  });
});
