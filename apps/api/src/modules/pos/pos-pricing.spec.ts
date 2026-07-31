/**
 * Pengujian mesin kuotasi harga kasir.
 *
 * Delapan keadaan yang disebut perintah prioritas POS-2 ada di sini — barcode,
 * barcode alternatif, harga outlet, tanggal berlaku, pajak inklusif,
 * pembulatan, promosi, dan produk nonaktif — ditambah beberapa yang muncul saat
 * aturannya ditulis.
 *
 * Angka pada berkas ini dihitung tangan lebih dahulu, bukan disalin dari
 * keluaran program. Pengujian harga yang harapannya diambil dari keluaran hanya
 * membuktikan bahwa program tidak berubah, bukan bahwa ia benar.
 */

import {
  bulatkan,
  cariBarcode,
  hitungBaris,
  pilihHarga,
  pilihPajak,
  totalKeranjang,
  type BarisBukuHarga,
  type PermintaanKuotasi,
  type TarifPajak,
} from './pos-pricing';
import Decimal from 'decimal.js';

const HARI = '2026-07-31';

const harga = (over: Partial<BarisBukuHarga> = {}): BarisBukuHarga => ({
  priceBookId: 'PB1',
  priceBookItemId: 'I1',
  productId: 'P1',
  uomId: 'PCS',
  price: 10000,
  minimumQty: 1,
  validFrom: null,
  validUntil: null,
  priority: 100,
  scopeType: 'TENANT',
  ...over,
});

const pajak = (over: Partial<TarifPajak> = {}): TarifPajak => ({
  taxRateId: 'TR1',
  code: 'PPN_11',
  rate: 11,
  isInclusive: false,
  effectiveFrom: null,
  effectiveUntil: null,
  ...over,
});

const minta = (over: Partial<PermintaanKuotasi> = {}): PermintaanKuotasi => ({
  productId: 'P1',
  uomId: 'PCS',
  quantity: 1,
  currencyCode: 'IDR',
  businessDate: HARI,
  priceBookLines: [harga()],
  taxRates: [],
  ...over,
});

describe('pembulatan mata uang', () => {
  it('IDR tanpa sen', () => {
    expect(bulatkan(new Decimal('1234.56'), 'IDR').toString()).toBe('1235');
  });

  it('USD dua desimal', () => {
    expect(bulatkan(new Decimal('1234.567'), 'USD').toString()).toBe('1234.57');
  });

  it('membulatkan setengah ke atas', () => {
    expect(bulatkan(new Decimal('0.5'), 'IDR').toString()).toBe('1');
    expect(bulatkan(new Decimal('1.5'), 'IDR').toString()).toBe('2');
  });
});

describe('pemilihan buku harga', () => {
  it('memakai harga khusus outlet daripada harga tenant', () => {
    const pilih = pilihHarga(
      [
        harga({ priceBookId: 'TENANT', price: 10000, priority: 100, scopeType: 'TENANT' }),
        harga({ priceBookId: 'OUTLET', price: 9000, priority: 10, scopeType: 'OUTLET' }),
      ],
      1,
      HARI,
    );
    expect(pilih?.priceBookId).toBe('OUTLET');
  });

  it('kekhususan menang lebih dahulu daripada jumlah minimum', () => {
    /*
     * Bila urutannya terbalik, harga grosir tingkat tenant akan mengalahkan
     * harga eceran khusus outlet, dan outlet kehilangan kendali atas harganya.
     * Di sini outlet menang meskipun minimumnya lebih kecil.
     */
    const pilih = pilihHarga(
      [
        harga({ priceBookId: 'TENANT_GROSIR', price: 8000, minimumQty: 10, priority: 100 }),
        harga({ priceBookId: 'OUTLET_ECER', price: 9500, minimumQty: 1, priority: 10 }),
      ],
      12,
      HARI,
    );
    expect(pilih?.priceBookId).toBe('OUTLET_ECER');
  });

  it('di antara yang sama khususnya, jumlah minimum terbesar menang', () => {
    const pilih = pilihHarga(
      [
        harga({ priceBookId: 'ECER', price: 10000, minimumQty: 1, priority: 10 }),
        harga({ priceBookId: 'GROSIR', price: 8000, minimumQty: 10, priority: 10 }),
      ],
      12,
      HARI,
    );
    expect(pilih?.priceBookId).toBe('GROSIR');
  });

  it('jumlah minimum yang belum terpenuhi tidak dipakai', () => {
    const pilih = pilihHarga(
      [
        harga({ priceBookId: 'ECER', price: 10000, minimumQty: 1 }),
        harga({ priceBookId: 'GROSIR', price: 8000, minimumQty: 10 }),
      ],
      3,
      HARI,
    );
    expect(pilih?.priceBookId).toBe('ECER');
  });

  it('menghormati tanggal berlaku', () => {
    const pilih = pilihHarga(
      [
        harga({ priceBookId: 'LAMA', price: 10000, validUntil: '2026-07-30' }),
        harga({ priceBookId: 'BARU', price: 11000, validFrom: '2026-07-31' }),
      ],
      1,
      HARI,
    );
    expect(pilih?.priceBookId).toBe('BARU');
  });

  it('harga yang belum mulai berlaku tidak dipakai', () => {
    expect(pilihHarga([harga({ validFrom: '2026-08-01' })], 1, HARI)).toBeNull();
  });

  it('seri sempurna dimenangkan harga terendah', () => {
    // Konfigurasi yang ambigu tidak boleh merugikan pembeli.
    const pilih = pilihHarga(
      [harga({ priceBookId: 'A', price: 10000 }), harga({ priceBookId: 'B', price: 9000 })],
      1,
      HARI,
    );
    expect(pilih?.priceBookId).toBe('B');
  });

  it('mengembalikan null bila tidak ada yang berlaku', () => {
    expect(pilihHarga([], 1, HARI)).toBeNull();
  });
});

describe('tarif pajak', () => {
  it('menyaring menurut tanggal berlaku', () => {
    const hasil = pilihPajak(
      [
        pajak({ code: 'LAMA', rate: 10, effectiveUntil: '2026-03-31' }),
        pajak({ code: 'BARU', rate: 11, effectiveFrom: '2026-04-01' }),
      ],
      HARI,
    );
    expect(hasil.map((r) => r.code)).toEqual(['BARU']);
  });
});

describe('perhitungan baris', () => {
  it('menghitung baris sederhana tanpa pajak dan tanpa diskon', () => {
    const h = hitungBaris(minta({ quantity: 3, priceBookLines: [harga({ price: 10000 })] }));
    expect(h.grossAmount).toBe('30000');
    expect(h.discountAmount).toBe('0');
    expect(h.netAmount).toBe('30000');
    expect(h.taxAmount).toBe('0');
    expect(h.lineTotal).toBe('30000');
  });

  it('menambahkan pajak eksklusif di atas harga', () => {
    // 10.000 × 11% = 1.100; total 11.100.
    const h = hitungBaris(minta({ taxRates: [pajak({ rate: 11 })] }));
    expect(h.netAmount).toBe('10000');
    expect(h.taxAmount).toBe('1100');
    expect(h.lineTotal).toBe('11100');
  });

  it('mengeluarkan pajak inklusif dari dalam harga', () => {
    /*
     * Harga 11.100 sudah memuat PPN 11%.
     * Dasar = 11.100 / 1,11 = 10.000. Pajak = 1.100. Total tetap 11.100.
     *
     * Menghitungnya sebagai 11.100 × 11% akan menghasilkan pajak 1.221 —
     * terlalu besar 121 rupiah per baris. Kesalahan sebesar itu tidak pernah
     * terlihat pada satu struk, tetapi menggerus angka penjualan bersih setiap
     * hari sepanjang tahun.
     */
    const h = hitungBaris(
      minta({ priceBookLines: [harga({ price: 11100 })], taxRates: [pajak({ isInclusive: true })] }),
    );
    expect(h.netAmount).toBe('10000');
    expect(h.taxAmount).toBe('1100');
    expect(h.lineTotal).toBe('11100');
  });

  it('pajak inklusif tidak mengubah yang dibayar pembeli', () => {
    const tanpa = hitungBaris(minta({ priceBookLines: [harga({ price: 11100 })] }));
    const dengan = hitungBaris(
      minta({ priceBookLines: [harga({ price: 11100 })], taxRates: [pajak({ isInclusive: true })] }),
    );
    expect(dengan.lineTotal).toBe(tanpa.lineTotal);
  });

  it('menghitung pajak pada nilai sesudah diskon, bukan sebelumnya', () => {
    /*
     * 10.000 − diskon 10% = 9.000. Pajak 11% × 9.000 = 990. Total 9.990.
     *
     * Menghitung pajak atas bruto membuat penyewa membayar pajak atas uang yang
     * tidak pernah diterimanya.
     */
    const h = hitungBaris(
      minta({
        taxRates: [pajak({ rate: 11 })],
        discounts: [
          {
            sourceType: 'PROMOTION',
            sourceId: 'PR1',
            label: 'Diskon 10%',
            discountType: 'PERCENT',
            discountValue: 10,
          },
        ],
      }),
    );
    expect(h.discountAmount).toBe('1000');
    expect(h.netAmount).toBe('9000');
    expect(h.taxAmount).toBe('990');
    expect(h.lineTotal).toBe('9990');
  });

  it('diskon nominal dipakai apa adanya', () => {
    const h = hitungBaris(
      minta({
        discounts: [
          {
            sourceType: 'MANUAL_LINE',
            sourceId: null,
            label: 'Potongan',
            discountType: 'AMOUNT',
            discountValue: 2500,
          },
        ],
      }),
    );
    expect(h.discountAmount).toBe('2500');
    expect(h.lineTotal).toBe('7500');
  });

  it('membatasi diskon pada nilai maksimumnya', () => {
    const h = hitungBaris(
      minta({
        quantity: 10, // bruto 100.000
        discounts: [
          {
            sourceType: 'PROMOTION',
            sourceId: 'PR1',
            label: 'Diskon 20% maks 5.000',
            discountType: 'PERCENT',
            discountValue: 20,
            maxAmount: 5000,
          },
        ],
      }),
    );
    expect(h.discountAmount).toBe('5000');
    expect(h.warnings.map((w) => w.code)).toContain('DISCOUNT_CAPPED');
  });

  it('tidak pernah menghasilkan baris bernilai negatif', () => {
    /*
     * Baris negatif berarti kasir menyerahkan uang kepada pembeli. Itu bukan
     * diskon melainkan pengeluaran kas, yang punya alur, hak akses, dan
     * pencatatannya sendiri.
     */
    const h = hitungBaris(
      minta({
        discounts: [
          {
            sourceType: 'MANUAL_LINE',
            sourceId: null,
            label: 'Salah ketik',
            discountType: 'AMOUNT',
            discountValue: 999999,
          },
        ],
      }),
    );
    expect(h.discountAmount).toBe('10000');
    expect(h.lineTotal).toBe('0');
    expect(h.warnings.map((w) => w.code)).toContain('DISCOUNT_EXCEEDS_PRICE');
  });

  it('menandai diskon yang melampaui ambang persetujuan', () => {
    const h = hitungBaris(
      minta({
        discountApprovalPct: 10,
        discounts: [
          {
            sourceType: 'MANUAL_LINE',
            sourceId: null,
            label: 'Diskon 15%',
            discountType: 'PERCENT',
            discountValue: 15,
          },
        ],
      }),
    );
    expect(h.requiresApproval).toBe(true);
    expect(h.warnings.map((w) => w.code)).toContain('DISCOUNT_NEEDS_APPROVAL');
  });

  it('diskon tepat pada ambang belum memerlukan persetujuan', () => {
    const h = hitungBaris(
      minta({
        discountApprovalPct: 10,
        discounts: [
          {
            sourceType: 'MANUAL_LINE',
            sourceId: null,
            label: 'Diskon 10%',
            discountType: 'PERCENT',
            discountValue: 10,
          },
        ],
      }),
    );
    expect(h.requiresApproval).toBe(false);
  });

  it('penggantian harga selalu memerlukan persetujuan dan tercatat', () => {
    const h = hitungBaris(minta({ priceOverride: 5000 }));
    expect(h.unitPrice).toBe('5000');
    expect(h.requiresApproval).toBe(true);
    expect(h.warnings.map((w) => w.code)).toContain('PRICE_OVERRIDDEN');
  });

  it('memperingatkan bila produk belum berharga, tanpa menghentikan perhitungan', () => {
    const h = hitungBaris(minta({ priceBookLines: [] }));
    expect(h.unitPrice).toBe('0');
    expect(h.warnings.map((w) => w.code)).toContain('NO_PRICE');
  });

  it('memperingatkan bila seluruh tarif pajak sudah kedaluwarsa', () => {
    const h = hitungBaris(minta({ taxRates: [pajak({ effectiveUntil: '2026-01-01' })] }));
    expect(h.taxAmount).toBe('0');
    expect(h.warnings.map((w) => w.code)).toContain('NO_TAX_RATE');
  });

  it('mencatat rincian pajak, bukan hanya jumlahnya', () => {
    // Yang menjawab "tarif mana yang dipakai" saat pemeriksaan pajak.
    const h = hitungBaris(minta({ taxRates: [pajak({ rate: 11, code: 'PPN_11' })] }));
    expect(h.taxes).toHaveLength(1);
    expect(h.taxes[0]).toMatchObject({ code: 'PPN_11', rate: 11, taxableBase: '10000' });
  });

  it('mencatat asal-usul diskon, bukan hanya jumlahnya', () => {
    const h = hitungBaris(
      minta({
        discounts: [
          {
            sourceType: 'PROMOTION',
            sourceId: 'PR9',
            label: 'Promo Kemerdekaan',
            discountType: 'PERCENT',
            discountValue: 17,
          },
        ],
      }),
    );
    expect(h.discounts[0]).toMatchObject({ sourceType: 'PROMOTION', sourceId: 'PR9' });
  });

  it('pembulatan dilakukan pada nilai baris, bukan pada harga satuan', () => {
    // 3.333 × 3 = 9.999 — bukan 3.333 dibulatkan dulu lalu dikali.
    const h = hitungBaris(minta({ quantity: 3, priceBookLines: [harga({ price: 3333 })] }));
    expect(h.grossAmount).toBe('9999');
  });
});

describe('total keranjang', () => {
  const barisA = hitungBaris(minta({ quantity: 2, taxRates: [pajak({ rate: 11 })] }));
  const barisB = hitungBaris(
    minta({ productId: 'P2', priceBookLines: [harga({ productId: 'P2', price: 5000 })] }),
  );

  it('menjumlahkan dari nilai baris yang sudah dibulatkan', () => {
    /*
     * Total harus benar-benar merupakan jumlah dari baris yang dibaca pembeli
     * pada struk. Menghitung ulang dari angka mentah dapat menghasilkan total
     * yang berbeda satu rupiah dari penjumlahan barisnya — dan yang dipercaya
     * pembeli adalah barisnya.
     */
    const t = totalKeranjang([barisA, barisB], 'IDR');
    expect(t.subtotal).toBe('25000'); // 20.000 + 5.000
    expect(t.taxTotal).toBe('2200'); // pajak baris A saja
    expect(t.grandTotal).toBe('27200');
  });

  it('menerapkan diskon keranjang di atas diskon baris', () => {
    const t = totalKeranjang([barisA, barisB], 'IDR', [
      {
        sourceType: 'MANUAL_CART',
        sourceId: null,
        label: 'Diskon nota 10%',
        discountType: 'PERCENT',
        discountValue: 10,
      },
    ]);
    expect(t.discountTotal).toBe('2500'); // 10% dari 25.000
    expect(t.grandTotal).toBe('24700'); // 25.000 − 2.500 + 2.200
  });

  it('diskon keranjang tidak dapat melebihi subtotal', () => {
    const t = totalKeranjang([barisB], 'IDR', [
      {
        sourceType: 'MANUAL_CART',
        sourceId: null,
        label: 'Salah ketik',
        discountType: 'AMOUNT',
        discountValue: 999999,
      },
    ]);
    expect(t.discountTotal).toBe('5000');
  });

  it('menurunkan penanda persetujuan dari barisnya', () => {
    const perlu = hitungBaris(minta({ priceOverride: 1 }));
    expect(totalKeranjang([perlu], 'IDR').requiresApproval).toBe(true);
    expect(totalKeranjang([barisB], 'IDR').requiresApproval).toBe(false);
  });

  it('keranjang kosong menghasilkan nol, bukan galat', () => {
    const t = totalKeranjang([], 'IDR');
    expect(t.grandTotal).toBe('0');
  });
});

describe('pencarian barcode', () => {
  const daftar = [
    { productId: 'P1', uomId: 'PCS', barcode: '8991234567890', isPrimary: true, isActive: true },
    { productId: 'P1', uomId: 'BOX', barcode: '8991234567891', isPrimary: false, isActive: true },
    { productId: 'P2', uomId: 'PCS', barcode: '8990000000000', isPrimary: true, isActive: false },
  ];

  it('menemukan barcode utama', () => {
    expect(cariBarcode(daftar, '8991234567890')?.productId).toBe('P1');
  });

  it('menemukan barcode alternatif', () => {
    // Pemindai tidak tahu bedanya, dan kasir tidak seharusnya perlu tahu.
    expect(cariBarcode(daftar, '8991234567891')?.uomId).toBe('BOX');
  });

  it('mengabaikan spasi di ujung', () => {
    // Pemindai kerap menambahkan spasi atau enter di akhir.
    expect(cariBarcode(daftar, '  8991234567890  ')?.productId).toBe('P1');
  });

  it('tidak menemukan barcode nonaktif', () => {
    expect(cariBarcode(daftar, '8990000000000')).toBeNull();
  });

  it('tidak menemukan barcode yang tidak terdaftar', () => {
    expect(cariBarcode(daftar, '0000000000000')).toBeNull();
  });

  it('masukan kosong tidak menghasilkan apa-apa', () => {
    expect(cariBarcode(daftar, '   ')).toBeNull();
  });

  it('barcode kembar dimenangkan yang utama', () => {
    const kembar = [
      { productId: 'A', uomId: 'PCS', barcode: '111', isPrimary: false, isActive: true },
      { productId: 'B', uomId: 'PCS', barcode: '111', isPrimary: true, isActive: true },
    ];
    expect(cariBarcode(kembar, '111')?.productId).toBe('B');
  });
});
