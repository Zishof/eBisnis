import {
  MAX_QUANTITY_PER_LINE,
  computeTotals,
  validateCheckout,
  type CheckoutLineInput,
  type CheckoutSellerInput,
} from './checkout-validation';

const line = (over: Partial<CheckoutLineInput> = {}): CheckoutLineInput => ({
  ref: 'L1',
  sellerId: 'S1',
  title: 'Kaos Polos',
  priceAtAdd: 75000,
  currentPrice: 75000,
  quantity: 1,
  availability: 'IN_STOCK',
  stockQty: null,
  weightGram: 220,
  listingVisible: true,
  ...over,
});

const seller = (over: Partial<CheckoutSellerInput> = {}): CheckoutSellerInput => ({
  sellerId: 'S1',
  sellerStatus: 'ACTIVE',
  storeStatus: 'PUBLISHED',
  paymentAccountActive: true,
  shippingMethodCode: 'REGULER',
  ...over,
});

const address = {
  recipientName: 'Budi',
  phone: '08123456789',
  addressLine: 'Jalan Merdeka 10',
  city: 'Samarinda',
  province: 'Kalimantan Timur',
  postalCode: '75111',
};

const codes = (result: { checks: { code: string }[] }) => result.checks.map((c) => c.code);

describe('validateCheckout', () => {
  describe('keadaan yang seharusnya lolos', () => {
    it('meloloskan checkout yang lengkap', () => {
      const result = validateCheckout({ lines: [line()], sellers: [seller()], address });
      expect(result.blocking).toEqual([]);
      expect(result.canConfirm).toBe(true);
    });

    it('meloloskan beberapa penjual sekaligus', () => {
      const result = validateCheckout({
        lines: [line(), line({ ref: 'L2', sellerId: 'S2' })],
        sellers: [seller(), seller({ sellerId: 'S2' })],
        address,
      });
      expect(result.canConfirm).toBe(true);
    });
  });

  describe('penjual dan toko', () => {
    it('menolak penjual yang ditangguhkan', () => {
      const result = validateCheckout({
        lines: [line()],
        sellers: [seller({ sellerStatus: 'SUSPENDED' })],
        address,
      });
      expect(codes(result)).toContain('SELLER_INACTIVE');
      expect(result.canConfirm).toBe(false);
    });

    it('menolak toko yang belum terbit', () => {
      const result = validateCheckout({
        lines: [line()],
        sellers: [seller({ storeStatus: 'VERIFIED' })],
        address,
      });
      expect(codes(result)).toContain('STORE_INACTIVE');
    });

    it('menolak penjual tanpa rekening pembayaran aktif', () => {
      // Inilah gerbang V9-2: tanpa rekening aktif, pembeli membayar ke tempat
      // yang tidak ada.
      const result = validateCheckout({
        lines: [line()],
        sellers: [seller({ paymentAccountActive: false })],
        address,
      });
      expect(codes(result)).toContain('PAYMENT_ACCOUNT_INACTIVE');
      expect(result.canConfirm).toBe(false);
    });

    it('menolak bila layanan kirim belum dipilih', () => {
      const result = validateCheckout({
        lines: [line()],
        sellers: [seller({ shippingMethodCode: null })],
        address,
      });
      expect(codes(result)).toContain('SHIPPING_METHOD_MISSING');
    });

    it('menolak baris yang penjualnya tidak dikenal', () => {
      const result = validateCheckout({
        lines: [line({ sellerId: 'TIDAK_ADA' })],
        sellers: [seller()],
        address,
      });
      expect(codes(result)).toContain('SELLER_INACTIVE');
    });
  });

  describe('ketersediaan dan jumlah', () => {
    it('menolak barang yang habis', () => {
      const result = validateCheckout({
        lines: [line({ availability: 'OUT_OF_STOCK' })],
        sellers: [seller()],
        address,
      });
      expect(codes(result)).toContain('OUT_OF_STOCK');
    });

    it('menerima barang pesan-dahulu', () => {
      const result = validateCheckout({
        lines: [line({ availability: 'PREORDER', stockQty: 0, quantity: 3 })],
        sellers: [seller()],
        address,
      });
      // Stok nol dengan izin pre-order memang boleh dipesan; menolaknya akan
      // membuat pre-order tidak berarti apa-apa.
      expect(result.canConfirm).toBe(true);
    });

    it('menolak jumlah melebihi stok yang diketahui', () => {
      const result = validateCheckout({
        lines: [line({ stockQty: 2, quantity: 5 })],
        sellers: [seller()],
        address,
      });
      expect(codes(result)).toContain('QUANTITY_EXCEEDS_STOCK');
    });

    it('tidak menolak ketika stok tidak diketahui pasti', () => {
      // Katalog menyimpan ketersediaan, bukan jumlah pasti. Menolak berdasarkan
      // angka yang tidak diketahui akan menolak pesanan yang sebenarnya sah.
      const result = validateCheckout({
        lines: [line({ stockQty: null, quantity: 50 })],
        sellers: [seller()],
        address,
      });
      expect(codes(result)).not.toContain('QUANTITY_EXCEEDS_STOCK');
    });

    it.each([0, -1, 1.5, MAX_QUANTITY_PER_LINE + 1])('menolak jumlah %p', (quantity) => {
      const result = validateCheckout({
        lines: [line({ quantity })],
        sellers: [seller()],
        address,
      });
      expect(codes(result)).toContain('QUANTITY_INVALID');
    });

    it('menolak keranjang kosong', () => {
      const result = validateCheckout({ lines: [], sellers: [], address });
      expect(codes(result)).toContain('CART_EMPTY');
    });
  });

  describe('barang yang sudah tidak dijual', () => {
    it('menolaknya', () => {
      const result = validateCheckout({
        lines: [line({ listingVisible: false })],
        sellers: [seller()],
        address,
      });
      expect(codes(result)).toContain('LISTING_UNAVAILABLE');
    });

    it('tidak memeriksa harga dan stoknya lebih jauh', () => {
      // Barang yang sudah tidak dijual tidak perlu dikeluhkan berkali-kali;
      // satu alasan sudah cukup untuk menghapusnya dari keranjang.
      const result = validateCheckout({
        lines: [line({ listingVisible: false, currentPrice: 999999, availability: 'OUT_OF_STOCK' })],
        sellers: [seller()],
        address,
      });
      expect(codes(result)).not.toContain('PRICE_CHANGED');
      expect(codes(result)).not.toContain('OUT_OF_STOCK');
    });
  });

  describe('perubahan harga', () => {
    it('tidak menghalangi, tetapi menuntut persetujuan', () => {
      // Menolak sama sekali akan membuang keranjang karena satu barang berubah
      // seratus rupiah.
      const result = validateCheckout({
        lines: [line({ priceAtAdd: 75000, currentPrice: 80000 })],
        sellers: [seller()],
        address,
      });
      expect(result.canConfirm).toBe(true);
      expect(result.needsConfirmation.map((i) => i.code)).toContain('PRICE_CHANGED');
    });

    it('memberi tahu arah perubahannya', () => {
      const naik = validateCheckout({
        lines: [line({ priceAtAdd: 75000, currentPrice: 80000 })],
        sellers: [seller()],
        address,
      });
      const turun = validateCheckout({
        lines: [line({ priceAtAdd: 80000, currentPrice: 75000 })],
        sellers: [seller()],
        address,
      });
      expect(naik.needsConfirmation[0].detail).toMatch(/naik/);
      expect(turun.needsConfirmation[0].detail).toMatch(/turun/);
    });

    it('tidak mengeluh ketika harga tetap', () => {
      const result = validateCheckout({ lines: [line()], sellers: [seller()], address });
      expect(result.needsConfirmation).toEqual([]);
    });
  });

  describe('berat dan ongkos kirim', () => {
    it('menolak barang tanpa berat', () => {
      const result = validateCheckout({
        lines: [line({ weightGram: 0 })],
        sellers: [seller()],
        address,
      });
      expect(codes(result)).toContain('WEIGHT_MISSING');
    });
  });

  describe('alamat', () => {
    it('menolak checkout tanpa alamat', () => {
      const result = validateCheckout({ lines: [line()], sellers: [seller()], address: null });
      expect(codes(result)).toContain('ADDRESS_MISSING');
    });

    it.each(['recipientName', 'phone', 'addressLine', 'city', 'province', 'postalCode'] as const)(
      'menolak alamat tanpa %s',
      (field) => {
        const result = validateCheckout({
          lines: [line()],
          sellers: [seller()],
          address: { ...address, [field]: '' },
        });
        expect(codes(result)).toContain('ADDRESS_INCOMPLETE');
      },
    );

    it('menyebut medan yang kurang pada alasannya', () => {
      const result = validateCheckout({
        lines: [line()],
        sellers: [seller()],
        address: { ...address, city: '', postalCode: '' },
      });
      const issue = result.blocking.find((i) => i.code === 'ADDRESS_INCOMPLETE');
      expect(issue?.detail).toMatch(/city/);
      expect(issue?.detail).toMatch(/postalCode/);
    });
  });

  describe('seluruh syarat diperiksa, bukan berhenti pada yang pertama', () => {
    it('melaporkan banyak masalah sekaligus', () => {
      // Pembeli yang memperbaiki satu hal lalu ditolak karena hal berikutnya
      // akan meninggalkan keranjangnya.
      const result = validateCheckout({
        lines: [line({ availability: 'OUT_OF_STOCK', weightGram: 0 })],
        sellers: [seller({ paymentAccountActive: false, shippingMethodCode: null })],
        address: null,
      });
      expect(result.blocking.length).toBeGreaterThanOrEqual(5);
    });
  });
});

describe('computeTotals', () => {
  it('menjumlahkan baris dan ongkos kirim', () => {
    const totals = computeTotals(
      [
        { currentPrice: 75000, quantity: 2 },
        { currentPrice: 68000, quantity: 1 },
      ],
      [20000, 20000],
    );
    expect(totals.subtotal).toBe(218000);
    expect(totals.shippingTotal).toBe(40000);
    expect(totals.grandTotal).toBe(258000);
  });

  it('membulatkan harga ke rupiah utuh', () => {
    // Perhitungan uang dengan bilangan pecahan menghasilkan selisih satu rupiah
    // yang tidak dapat dijelaskan kepada pembeli maupun kepada akuntan.
    const totals = computeTotals([{ currentPrice: 33333.33, quantity: 3 }]);
    expect(Number.isInteger(totals.subtotal)).toBe(true);
    expect(totals.subtotal).toBe(99999);
  });

  it('tidak pernah menghasilkan total negatif', () => {
    // Pembeli tidak menerima uang dari pesanan.
    const totals = computeTotals([{ currentPrice: 10000, quantity: 1 }], [], 999999);
    expect(totals.grandTotal).toBe(0);
  });

  it('membatasi diskon sampai sebesar subtotal', () => {
    const totals = computeTotals([{ currentPrice: 10000, quantity: 1 }], [5000], 50000);
    expect(totals.discountTotal).toBe(10000);
    expect(totals.grandTotal).toBe(5000);
  });

  it('menghasilkan nol untuk keranjang kosong', () => {
    expect(computeTotals([]).grandTotal).toBe(0);
  });
});
