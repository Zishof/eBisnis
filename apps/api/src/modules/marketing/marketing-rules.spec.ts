import {
  computeDiscount,
  evaluateVoucher,
  isExhausted,
  normalizeVoucherCode,
  type VoucherContext,
  type VoucherSnapshot,
} from './voucher-rules';
import {
  MESSAGE_MAX_LENGTH,
  REVIEW_BODY_MIN,
  REVIEW_WINDOW_DAYS,
  checkReviewEligibility,
  previewOf,
  screenMessage,
  summarizeRatings,
  validateMessage,
} from './review-rules';

const HARI = 24 * 60 * 60 * 1000;
const now = new Date('2026-07-31T00:00:00Z');

const voucher = (over: Partial<VoucherSnapshot> = {}): VoucherSnapshot => ({
  code: 'HEMAT10',
  status: 'ACTIVE',
  fundedBy: 'SELLER',
  sellerId: 'S1',
  benefitType: 'PERCENT',
  benefitValue: 10,
  maxDiscountAmount: 50000,
  minimumSpend: 0,
  budgetAmount: null,
  budgetUsed: 0,
  maxRedemptions: null,
  maxPerBuyer: 1,
  redemptionCount: 0,
  validFrom: new Date(now.getTime() - HARI),
  validUntil: new Date(now.getTime() + 30 * HARI),
  stackable: false,
  ...over,
});

const context = (over: Partial<VoucherContext> = {}): VoucherContext => ({
  now,
  subtotal: 200000,
  sellerId: 'S1',
  buyerRedemptionCount: 0,
  otherVoucherApplied: false,
  ...over,
});

const codes = (v: { issues: { code: string }[] }) => v.issues.map((i) => i.code);

describe('voucher marketplace', () => {
  describe('yang seharusnya berlaku', () => {
    it('meloloskan voucher yang wajar', () => {
      const result = evaluateVoucher(voucher(), context());
      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(20000);
    });

    it('meloloskan voucher platform pada penjual mana pun', () => {
      const result = evaluateVoucher(
        voucher({ fundedBy: 'PLATFORM', sellerId: null }),
        context({ sellerId: 'S9' }),
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('kode yang tidak ada', () => {
    it('menjawab sama dengan kode yang tidak berlaku', () => {
      // Membedakan jawabannya memungkinkan seseorang menebak kode yang berlaku
      // dengan mencoba satu per satu.
      const result = evaluateVoucher(null, context());
      expect(codes(result)).toEqual(['NOT_FOUND']);
      expect(result.issues[0].detail).toBe('Kode voucher tidak berlaku.');
    });
  });

  describe('masa berlaku', () => {
    it('menolak yang belum mulai', () => {
      const result = evaluateVoucher(
        voucher({ validFrom: new Date(now.getTime() + HARI) }),
        context(),
      );
      expect(codes(result)).toContain('NOT_STARTED');
    });

    it('menolak yang sudah lewat', () => {
      const result = evaluateVoucher(
        voucher({ validUntil: new Date(now.getTime() - HARI) }),
        context(),
      );
      expect(codes(result)).toContain('EXPIRED');
    });

    it('menerima yang tanpa batas akhir', () => {
      expect(evaluateVoucher(voucher({ validUntil: null }), context()).valid).toBe(true);
    });

    it('menolak yang tidak aktif', () => {
      expect(codes(evaluateVoucher(voucher({ status: 'PAUSED' }), context()))).toContain('NOT_ACTIVE');
    });
  });

  describe('kecocokan penjual', () => {
    it('menolak voucher penjual pada barang penjual lain', () => {
      // Tanpa ini, voucher yang didanai satu penjual memotong pendapatan
      // penjual lain.
      const result = evaluateVoucher(voucher({ sellerId: 'S1' }), context({ sellerId: 'S2' }));
      expect(codes(result)).toContain('SELLER_MISMATCH');
    });
  });

  describe('batas pemakaian', () => {
    it('menolak bila kuota keseluruhan habis', () => {
      const result = evaluateVoucher(
        voucher({ maxRedemptions: 100, redemptionCount: 100 }),
        context(),
      );
      expect(codes(result)).toContain('REDEMPTION_LIMIT_REACHED');
    });

    it('menolak bila pembeli sudah memakai batasnya', () => {
      const result = evaluateVoucher(voucher({ maxPerBuyer: 1 }), context({ buyerRedemptionCount: 1 }));
      expect(codes(result)).toContain('BUYER_LIMIT_REACHED');
    });

    it('mengizinkan pemakaian kedua bila batasnya dua', () => {
      const result = evaluateVoucher(voucher({ maxPerBuyer: 2 }), context({ buyerRedemptionCount: 1 }));
      expect(result.valid).toBe(true);
    });
  });

  describe('anggaran', () => {
    it('menolak bila anggaran habis', () => {
      const result = evaluateVoucher(
        voucher({ budgetAmount: 1000000, budgetUsed: 1000000 }),
        context(),
      );
      expect(codes(result)).toContain('BUDGET_EXHAUSTED');
    });

    it('menolak bila sisa anggaran tidak cukup untuk pesanan ini', () => {
      // Memotong sebagian akan memberi pembeli diskon yang tidak dijanjikan.
      const result = evaluateVoucher(
        voucher({ budgetAmount: 1000000, budgetUsed: 995000 }),
        context({ subtotal: 200000 }),
      );
      expect(codes(result)).toContain('BUDGET_EXHAUSTED');
    });

    it('menerima bila sisa anggaran mencukupi', () => {
      const result = evaluateVoucher(
        voucher({ budgetAmount: 1000000, budgetUsed: 900000 }),
        context({ subtotal: 200000 }),
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('belanja minimum', () => {
    it('menolak di bawah minimum', () => {
      const result = evaluateVoucher(voucher({ minimumSpend: 300000 }), context({ subtotal: 200000 }));
      expect(codes(result)).toContain('MINIMUM_SPEND_NOT_MET');
    });

    it('menerima tepat pada minimum', () => {
      expect(
        evaluateVoucher(voucher({ minimumSpend: 200000 }), context({ subtotal: 200000 })).valid,
      ).toBe(true);
    });
  });

  describe('penumpukan', () => {
    it('menolak voucher tak bertumpuk bila sudah ada yang lain', () => {
      const result = evaluateVoucher(voucher({ stackable: false }), context({ otherVoucherApplied: true }));
      expect(codes(result)).toContain('NOT_STACKABLE');
    });

    it('menerima voucher bertumpuk', () => {
      expect(
        evaluateVoucher(voucher({ stackable: true }), context({ otherVoucherApplied: true })).valid,
      ).toBe(true);
    });
  });

  describe('melaporkan seluruh masalah sekaligus', () => {
    it('tidak berhenti pada yang pertama', () => {
      const result = evaluateVoucher(
        voucher({ status: 'PAUSED', minimumSpend: 999999, maxPerBuyer: 1 }),
        context({ sellerId: 'LAIN', buyerRedemptionCount: 5 }),
      );
      expect(result.issues.length).toBeGreaterThanOrEqual(4);
    });

    it('tidak memberi potongan bila ada masalah', () => {
      const result = evaluateVoucher(voucher({ status: 'PAUSED' }), context());
      expect(result.discountAmount).toBe(0);
    });
  });
});

describe('perhitungan potongan', () => {
  it('menghitung persen', () => {
    expect(computeDiscount({ benefitType: 'PERCENT', benefitValue: 10, maxDiscountAmount: null }, 200000)).toBe(20000);
  });

  it('membatasi potongan persen pada batas maksimum', () => {
    // Inilah yang mencegah diskon 50% pada pesanan sepuluh juta memotong lima
    // juta dari kantong penjual.
    expect(
      computeDiscount({ benefitType: 'PERCENT', benefitValue: 50, maxDiscountAmount: 100000 }, 10_000_000),
    ).toBe(100000);
  });

  it('menghitung nominal tetap', () => {
    expect(computeDiscount({ benefitType: 'FIXED', benefitValue: 25000, maxDiscountAmount: null }, 200000)).toBe(25000);
  });

  it('tidak pernah melebihi subtotal', () => {
    // Pembeli tidak menerima uang dari voucher.
    expect(computeDiscount({ benefitType: 'FIXED', benefitValue: 999999, maxDiscountAmount: null }, 50000)).toBe(50000);
  });

  it('menghasilkan nol untuk subtotal nol', () => {
    expect(computeDiscount({ benefitType: 'PERCENT', benefitValue: 10, maxDiscountAmount: null }, 0)).toBe(0);
  });

  it('membatasi persen pada 0 sampai 100', () => {
    expect(computeDiscount({ benefitType: 'PERCENT', benefitValue: 150, maxDiscountAmount: null }, 200000)).toBe(200000);
    expect(computeDiscount({ benefitType: 'PERCENT', benefitValue: -10, maxDiscountAmount: null }, 200000)).toBe(0);
  });

  it('menghasilkan rupiah utuh', () => {
    expect(Number.isInteger(computeDiscount({ benefitType: 'PERCENT', benefitValue: 33, maxDiscountAmount: null }, 99999))).toBe(true);
  });
});

describe('voucher habis', () => {
  it('menandai kuota habis', () => {
    expect(isExhausted(voucher({ maxRedemptions: 10, redemptionCount: 10 }))).toBe(true);
  });

  it('menandai anggaran habis', () => {
    expect(isExhausted(voucher({ budgetAmount: 100000, budgetUsed: 100000 }))).toBe(true);
  });

  it('tidak menandai yang masih tersisa', () => {
    expect(isExhausted(voucher({ maxRedemptions: 10, redemptionCount: 3 }))).toBe(false);
  });
});

describe('normalisasi kode voucher', () => {
  it('membesarkan huruf dan membuang spasi', () => {
    expect(normalizeVoucherCode('  hemat 10  ')).toBe('HEMAT10');
  });

  it('membatasi panjang', () => {
    expect(normalizeVoucherCode('A'.repeat(100)).length).toBe(32);
  });
});

// ---------------------------------------------------------------------------

const review = (over = {}) => ({
  orderStatus: 'DELIVERED',
  orderBuyerId: 'B1',
  requesterBuyerId: 'B1',
  deliveredAt: new Date(now.getTime() - 3 * HARI),
  now,
  itemBelongsToOrder: true,
  alreadyReviewed: false,
  rating: 5,
  body: 'Barangnya sesuai deskripsi dan pengirimannya cepat.',
  ...over,
});

describe('kelayakan ulasan', () => {
  it('meloloskan ulasan yang wajar', () => {
    expect(checkReviewEligibility(review()).eligible).toBe(true);
  });

  it('menolak ulasan atas pesanan orang lain', () => {
    // Tanpa ini, id pesanan yang ditebak memungkinkan siapa pun menulis ulasan
    // atas pembelian orang lain.
    const result = checkReviewEligibility(review({ requesterBuyerId: 'B2' }));
    expect(codes(result as never)).toContain('NOT_ORDER_OWNER');
  });

  it('menolak sebelum barang sampai', () => {
    const result = checkReviewEligibility(review({ orderStatus: 'SHIPPED' }));
    expect(codes(result as never)).toContain('ORDER_NOT_DELIVERED');
  });

  it('menolak produk yang tidak ada pada pesanan', () => {
    const result = checkReviewEligibility(review({ itemBelongsToOrder: false }));
    expect(codes(result as never)).toContain('ITEM_NOT_IN_ORDER');
  });

  it('menolak ulasan kedua untuk produk yang sama', () => {
    const result = checkReviewEligibility(review({ alreadyReviewed: true }));
    expect(codes(result as never)).toContain('ALREADY_REVIEWED');
  });

  it('menolak setelah batas waktu lewat', () => {
    const result = checkReviewEligibility(
      review({ deliveredAt: new Date(now.getTime() - (REVIEW_WINDOW_DAYS + 1) * HARI) }),
    );
    expect(codes(result as never)).toContain('WINDOW_EXPIRED');
  });

  it.each([0, 6, 3.5, -1])('menolak nilai %p', (rating) => {
    expect(codes(checkReviewEligibility(review({ rating })) as never)).toContain('RATING_INVALID');
  });

  it('menerima ulasan tanpa isi', () => {
    // Nilai bintang saja sudah bermakna.
    expect(checkReviewEligibility(review({ body: null })).eligible).toBe(true);
    expect(checkReviewEligibility(review({ body: '' })).eligible).toBe(true);
  });

  it('menolak isi yang terlalu pendek tetapi bukan kosong', () => {
    const result = checkReviewEligibility(review({ body: 'ok' }));
    expect(codes(result as never)).toContain('BODY_TOO_SHORT');
    expect(result.issues[0].detail).toMatch(String(REVIEW_BODY_MIN));
  });

  it('menolak isi yang terlalu panjang', () => {
    const result = checkReviewEligibility(review({ body: 'a'.repeat(5000) }));
    expect(codes(result as never)).toContain('BODY_TOO_LONG');
  });
});

describe('ringkasan nilai', () => {
  it('menghitung rata-rata dari yang terbit saja', () => {
    // Ulasan yang menunggu moderasi belum boleh memengaruhi angka yang dilihat
    // pembeli.
    const result = summarizeRatings([
      { rating: 5, moderationStatus: 'PUBLISHED' },
      { rating: 3, moderationStatus: 'PUBLISHED' },
      { rating: 1, moderationStatus: 'PENDING' },
    ]);
    expect(result.average).toBe(4);
    expect(result.count).toBe(2);
  });

  it('membulatkan satu angka di belakang koma', () => {
    const result = summarizeRatings([
      { rating: 5, moderationStatus: 'PUBLISHED' },
      { rating: 4, moderationStatus: 'PUBLISHED' },
      { rating: 4, moderationStatus: 'PUBLISHED' },
    ]);
    expect(result.average).toBe(4.3);
  });

  it('menghasilkan nol tanpa ulasan terbit', () => {
    const result = summarizeRatings([{ rating: 5, moderationStatus: 'PENDING' }]);
    expect(result.average).toBe(0);
    expect(result.count).toBe(0);
  });

  it('menghitung sebaran bintang', () => {
    const result = summarizeRatings([
      { rating: 5, moderationStatus: 'PUBLISHED' },
      { rating: 5, moderationStatus: 'PUBLISHED' },
      { rating: 1, moderationStatus: 'PUBLISHED' },
    ]);
    expect(result.distribution[5]).toBe(2);
    expect(result.distribution[1]).toBe(1);
    expect(result.distribution[3]).toBe(0);
  });
});

describe('penyaringan pesan', () => {
  it('menandai yang menyerupai nomor rekening', () => {
    expect(screenMessage('transfer ke 1234567890123').flagged).toBe(true);
  });

  it('menandai kontak luar', () => {
    expect(screenMessage('WA saya 08123456789').flagged).toBe(true);
  });

  it('menandai ajakan transaksi di luar', () => {
    expect(screenMessage('transfer langsung saja ya').flagged).toBe(true);
  });

  it('tidak menandai percakapan biasa', () => {
    expect(screenMessage('Apakah ukuran L masih ada?').flagged).toBe(false);
    expect(screenMessage('Terima kasih, barangnya bagus').flagged).toBe(false);
  });

  it('menyertakan alasan agar peninjau tahu apa yang dicurigai', () => {
    expect(screenMessage('rekening 1234567890123').reason).toBeTruthy();
  });
});

describe('bentuk pesan', () => {
  it('menolak pesan kosong', () => {
    expect(validateMessage('   ').ok).toBe(false);
  });

  it('menolak pesan terlalu panjang', () => {
    expect(validateMessage('a'.repeat(MESSAGE_MAX_LENGTH + 1)).ok).toBe(false);
  });

  it('menerima pesan wajar', () => {
    expect(validateMessage('Halo, stoknya masih ada?').ok).toBe(true);
  });
});

describe('cuplikan percakapan', () => {
  it('merapikan spasi berlebih', () => {
    expect(previewOf('  halo   apa   kabar  ')).toBe('halo apa kabar');
  });

  it('memotong pada batas', () => {
    expect(previewOf('a'.repeat(500)).length).toBe(200);
  });
});
