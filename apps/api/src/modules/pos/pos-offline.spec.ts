/**
 * Pengujian keputusan penerimaan transaksi luring.
 *
 * Yang dijaga paling ketat: **tidak ada transaksi yang hilang, dan tidak ada
 * yang dibukukan diam-diam dengan angka yang berbeda dari struk pembeli.**
 *
 * Setiap transaksi luring berakhir dibukukan atau ditahan. Tidak ada jalan
 * ketiga — menolak berarti uang yang sudah berpindah tangan tidak muncul di
 * pembukuan, dan itu kebalikan dari gunanya pembukuan.
 */

import {
  angkaStruk,
  putuskan,
  rentangJatah,
  samaNilai,
  type KeadaanServer,
  type TransaksiLuringMasuk,
} from './pos-offline';

const SEKARANG = Date.parse('2026-08-01T10:00:00.000Z');

const masuk = (over: Partial<TransaksiLuringMasuk> = {}): TransaksiLuringMasuk => ({
  offlineId: 'off-1',
  outletId: 'O1',
  terminalId: 'REG1',
  shiftId: 'S1',
  businessDate: '2026-08-01',
  receiptNumber: 'INV-001005',
  occurredAt: '2026-08-01T09:00:00.000Z',
  currencyCode: 'IDR',
  subtotal: '36000',
  taxTotal: '0',
  grandTotal: '36000',
  changeTotal: '14000',
  catalogSyncedAt: '2026-08-01T06:00:00.000Z',
  localHash: 'a'.repeat(64),
  lines: [
    {
      productId: 'P1',
      uomId: 'U1',
      quantity: 2,
      unitPrice: '18000',
      lineSubtotal: '36000',
      taxAmount: '0',
      lineTotal: '36000',
      taxRateId: null,
    },
  ],
  payments: [
    { paymentMethodId: 'TUNAI', amount: '36000', tenderedAmount: '50000', reference: null },
  ],
  ...over,
});

const server = (over: Partial<KeadaanServer> = {}): KeadaanServer => ({
  block: { blockId: 'B1', terminalId: 'REG1', fromNumber: 1000, toNumber: 1199 },
  shiftStatus: 'OPEN',
  inactiveProductIds: [],
  shortProductIds: [],
  serverGrandTotal: '36000',
  now: SEKARANG,
  maxAgeHours: 72,
  ...over,
});

describe('angka pada nomor struk', () => {
  it('mengambil digit di ujung, mengabaikan awalan', () => {
    expect(angkaStruk('INV-001005')).toBe(1005);
    expect(angkaStruk('001005')).toBe(1005);
  });

  it('awalan yang mengandung angka tidak mengacaukan pembacaan', () => {
    // Awalan seperti "TOKO2-" lazim dipakai. Memotong sepanjang awalan yang
    // tersimpan akan mengiris digit bila awalannya sempat berubah.
    expect(angkaStruk('TOKO2-000042')).toBe(42);
  });

  it('nomor tanpa angka menghasilkan null, bukan NaN', () => {
    expect(angkaStruk('INV-')).toBeNull();
    expect(angkaStruk('')).toBeNull();
  });
});

describe('perbandingan nilai uang', () => {
  it('teks berbeda dengan nilai sama dianggap sama', () => {
    // Peladen mengirim numeric sebagai "36000.0000"; melaporkannya berselisih
    // akan membuat seluruh karantina penuh oleh selisih yang tidak ada.
    expect(samaNilai('36000', '36000.0000')).toBe(true);
  });

  it('selisih sekecil apa pun tetap selisih', () => {
    expect(samaNilai('36000', '36000.01')).toBe(false);
  });

  it('nilai yang tidak dapat dibaca dianggap tidak sama', () => {
    // Lebih aman ditahan daripada dibukukan dengan angka yang tidak jelas.
    expect(samaNilai('36000', 'abc')).toBe(false);
  });
});

describe('putusan transaksi luring', () => {
  it('transaksi yang seluruhnya cocok dibukukan', () => {
    const p = putuskan(masuk(), server());
    expect(p.action).toBe('BOOK');
    expect(p.reasonCode).toBeNull();
  });

  it('tidak pernah menghasilkan penolakan — hanya dibukukan atau ditahan', () => {
    /*
     * Aturan terpenting pada berkas ini. Pembeli sudah membayar dan pulang;
     * menolak transaksinya tidak membuatnya tidak pernah terjadi, hanya membuat
     * pembukuan tidak menunjukkannya.
     */
    const keadaan: Array<Partial<KeadaanServer>> = [
      {},
      { block: null },
      { shiftStatus: 'CLOSED' },
      { shiftStatus: 'MISSING' },
      { inactiveProductIds: ['P1'] },
      { shortProductIds: ['P1'] },
      { serverGrandTotal: '40000' },
    ];
    for (const k of keadaan) {
      expect(['BOOK', 'QUARANTINE']).toContain(putuskan(masuk(), server(k)).action);
    }
  });

  it('harga yang berbeda ditahan, TIDAK dibukukan dengan angka peladen', () => {
    /*
     * Membukukan angka peladen membuat catatan tidak sesuai kertas yang dipegang
     * pembeli. Tidak ada galat, tidak ada yang tahu, dan selisihnya muncul
     * belakangan sebagai kas yang tidak cocok tanpa sebab yang dapat ditelusuri.
     */
    const p = putuskan(masuk(), server({ serverGrandTotal: '40000' }));
    expect(p.action).toBe('QUARANTINE');
    expect(p.reasonCode).toBe('PRICE_MISMATCH');
    // Kedua angka wajib disebut; "tidak cocok" saja memaksa pemeriksa mencari
    // sendiri angka pembandingnya.
    expect(p.reason).toContain('36000');
    expect(p.reason).toContain('40000');
    expect(p.localTotal).toBe('36000');
    expect(p.serverTotal).toBe('40000');
  });

  it('alasan selisih harga menyebutkan salinan katalog tanggal berapa', () => {
    // Tanpa itu, pertanyaan "harga versi kapan yang dipakai" hanya bisa dijawab
    // dengan dugaan.
    const p = putuskan(masuk(), server({ serverGrandTotal: '40000' }));
    expect(p.reason).toContain('2026-08-01T06:00:00.000Z');
  });

  it('nomor struk di luar jatah ditahan', () => {
    const p = putuskan(masuk({ receiptNumber: 'INV-009999' }), server());
    expect(p.reasonCode).toBe('RECEIPT_OUT_OF_BLOCK');
  });

  it('nomor struk dari jatah register lain ditahan', () => {
    const p = putuskan(
      masuk(),
      server({ block: { blockId: 'B2', terminalId: 'REG2', fromNumber: 1000, toNumber: 1199 } }),
    );
    expect(p.reasonCode).toBe('RECEIPT_OUT_OF_BLOCK');
  });

  it('register tanpa jatah ditahan', () => {
    expect(putuskan(masuk(), server({ block: null })).reasonCode).toBe('RECEIPT_OUT_OF_BLOCK');
  });

  it('nomor tepat di kedua ujung jatah diterima', () => {
    // Rentangnya inklusif. Salah di sini membuang satu nomor tiap jatah, atau
    // menerima satu nomor yang bukan miliknya.
    expect(putuskan(masuk({ receiptNumber: 'INV-001000' }), server()).action).toBe('BOOK');
    expect(putuskan(masuk({ receiptNumber: 'INV-001199' }), server()).action).toBe('BOOK');
  });

  it('nomor di luar jatah didahulukan meski harganya juga berbeda', () => {
    /*
     * Nomor kembar merusak DUA transaksi; selisih harga hanya menyangkut satu.
     * Melaporkan yang lebih ringan lebih dahulu akan mengirim pemeriksa ke arah
     * yang salah.
     */
    const p = putuskan(masuk({ receiptNumber: 'INV-009999' }), server({ serverGrandTotal: '40000' }));
    expect(p.reasonCode).toBe('RECEIPT_OUT_OF_BLOCK');
  });

  it('pembayaran yang tidak menutup total pada struk ditahan', () => {
    const p = putuskan(
      masuk({
        payments: [
          { paymentMethodId: 'TUNAI', amount: '30000', tenderedAmount: '30000', reference: null },
        ],
      }),
      server(),
    );
    expect(p.reasonCode).toBe('PAYMENT_MISMATCH');
  });

  it('pembayaran diadu dengan total STRUK, bukan total peladen', () => {
    // Yang dibayar pembeli adalah angka yang tercetak. Mengadunya dengan angka
    // peladen akan menuduh mesin kasir tidak konsisten padahal ia konsisten.
    const p = putuskan(masuk(), server({ serverGrandTotal: '40000' }));
    expect(p.reasonCode).toBe('PRICE_MISMATCH');
  });

  it('shift yang sudah ditutup ditahan, dengan sebab yang menyebut kasnya', () => {
    const p = putuskan(masuk(), server({ shiftStatus: 'CLOSED' }));
    expect(p.reasonCode).toBe('SHIFT_CLOSED');
    expect(p.reason).toMatch(/kas/i);
  });

  it('produk yang sudah dinonaktifkan ditahan', () => {
    expect(putuskan(masuk(), server({ inactiveProductIds: ['P1'] })).reasonCode).toBe(
      'PRODUCT_INACTIVE',
    );
  });

  it('stok kurang ditahan, bukan dipaksa minus', () => {
    const p = putuskan(masuk(), server({ shortProductIds: ['P1'] }));
    expect(p.reasonCode).toBe('STOCK_SHORT');
    expect(p.reason).toContain('sudah keluar dari rak');
  });

  it('produk nonaktif didahulukan daripada selisih harga', () => {
    // Produk yang dinonaktifkan MENJELASKAN mengapa harganya berbeda; melaporkan
    // harganya saja menyembunyikan sebabnya.
    const p = putuskan(masuk(), server({ inactiveProductIds: ['P1'], serverGrandTotal: '40000' }));
    expect(p.reasonCode).toBe('PRODUCT_INACTIVE');
  });

  it('transaksi yang sangat terlambat ditahan meski seluruhnya cocok', () => {
    const p = putuskan(
      masuk({ occurredAt: '2026-07-20T09:00:00.000Z' }),
      server(),
    );
    expect(p.action).toBe('QUARANTINE');
    expect(p.reasonCode).toBe('REPLAY_FAILED');
  });

  it('transaksi tepat pada batas umur masih dibukukan', () => {
    const p = putuskan(
      masuk({ occurredAt: new Date(SEKARANG - 72 * 3_600_000).toISOString() }),
      server(),
    );
    expect(p.action).toBe('BOOK');
  });

  it('waktu transaksi yang tidak terbaca tidak menghentikan pembukuan', () => {
    // Jam mesin kasir bisa salah setel. Menahan seluruh transaksinya karena itu
    // akan menumpuk karantina tanpa menolong siapa pun.
    expect(putuskan(masuk({ occurredAt: 'bukan-tanggal' }), server()).action).toBe('BOOK');
  });
});

describe('rentang jatah nomor struk', () => {
  it('rentang sebesar ukuran yang diminta', () => {
    const r = rentangJatah(1000, 200);
    expect(r.fromNumber).toBe(1000);
    expect(r.toNumber).toBe(1199);
  });

  it('urutan dimajukan MELEWATI seluruh rentang', () => {
    /*
     * Kalau dimajukan hanya sampai `toNumber`, penjualan daring berikutnya akan
     * menerbitkan nomor terakhir jatah untuk kedua kalinya — dan dua struk
     * bernomor sama adalah persis yang hendak dicegah seluruh rancangan ini.
     */
    const r = rentangJatah(1000, 200);
    expect(r.sequenceSesudah).toBe(1200);
    expect(r.sequenceSesudah).toBe(r.toNumber + 1);
  });

  it('jatah berturut-turut tidak pernah bertumpang tindih', () => {
    const a = rentangJatah(1000, 50);
    const b = rentangJatah(a.sequenceSesudah, 50);
    expect(b.fromNumber).toBeGreaterThan(a.toNumber);
  });

  it('ukuran nol atau negatif tetap menghasilkan satu nomor, bukan rentang terbalik', () => {
    // Rentang terbalik lolos ke basis data akan ditolak CHECK-nya, tetapi
    // menolaknya di sini memberi jatah yang masih dapat dipakai.
    expect(rentangJatah(1000, 0)).toEqual({ fromNumber: 1000, toNumber: 1000, sequenceSesudah: 1001 });
    expect(rentangJatah(1000, -5).toNumber).toBe(1000);
  });
});
