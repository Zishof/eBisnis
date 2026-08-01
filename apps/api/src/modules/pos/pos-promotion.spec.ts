/**
 * Pengujian pemilihan promosi.
 *
 * Seluruh aturan di sini memutuskan berapa uang yang dilepas gerai, dan tak satu
 * pun kesalahannya menghasilkan galat: promosi yang salah berlaku hanya tampak
 * sebagai harga yang lebih murah, dan promosi yang salah tidak berlaku hanya
 * tampak sebagai pembeli yang mengeluh.
 */

import {
  type BarisPromosi,
  type KonteksPromosi,
  dalamJendelaJam,
  keMenit,
  pilihPromosi,
  promosiBerlaku,
  waktuSetempat,
} from './pos-promotion';

const promosiDasar: BarisPromosi = {
  id: 'p1',
  name: 'Diskon Kopi',
  benefitType: 'PERCENT',
  benefitValue: 10,
  maxDiscountAmount: null,
  minimumPurchase: null,
  minimumQuantity: null,
  scopeType: 'TENANT',
  scopeId: null,
  validFrom: null,
  validUntil: null,
  validDays: null,
  validTimeFrom: null,
  validTimeTo: null,
  usageLimit: null,
  usageCount: 0,
  requiresApproval: false,
  priority: 100,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  target: [],
};

const ctxDasar: KonteksPromosi = {
  // 06.00 Senin di Jakarta = 23.00 Minggu di UTC. Sengaja dipilih: inilah
  // instan yang membedakan perhitungan zona tenant dari perhitungan UTC.
  saat: new Date('2026-06-14T23:00:00Z'),
  timezone: 'Asia/Jakarta',
  outletId: 'outlet-1',
  brandId: 'brand-1',
  productId: 'produk-1',
  productCategoryId: 'kategori-1',
  quantity: 1,
  lineSubtotal: 50_000,
};

describe('waktu setempat tenant', () => {
  it('membaca hari dan jam pada zona tenant, bukan UTC', () => {
    /*
     * Cacat yang diperbaiki. Semula hari dan jam dibaca dari cap waktu UTC:
     * untuk gerai Indonesia itu meleset tujuh jam, sehingga promosi "Senin saja"
     * tidak berlaku pada Senin pagi — yang di UTC masih Minggu.
     */
    const { isoDay, menit } = waktuSetempat(ctxDasar.saat, 'Asia/Jakarta');
    expect(isoDay).toBe(1); // Senin
    expect(menit).toBe(6 * 60); // 06.00

    const utc = waktuSetempat(ctxDasar.saat, 'UTC');
    expect(utc.isoDay).toBe(7); // Minggu
    expect(utc.menit).toBe(23 * 60);
  });

  it('tengah malam setempat terbaca sebagai menit nol', () => {
    const { menit } = waktuSetempat(new Date('2026-06-14T17:00:00Z'), 'Asia/Jakarta');
    expect(menit).toBe(0);
  });
});

describe('jendela jam', () => {
  it('jendela biasa', () => {
    const dari = keMenit('09:00')!;
    const sampai = keMenit('17:00')!;
    expect(dalamJendelaJam(keMenit('12:00')!, dari, sampai)).toBe(true);
    expect(dalamJendelaJam(keMenit('08:59')!, dari, sampai)).toBe(false);
    expect(dalamJendelaJam(keMenit('17:00')!, dari, sampai)).toBe(true);
  });

  it('jendela yang MELEWATI tengah malam', () => {
    /*
     * `dari <= t AND t <= sampai` tidak pernah benar untuk 22.00–02.00, sehingga
     * promosi shift malam tidak pernah berlaku sekali pun — dan tidak ada galat
     * yang menyebutkannya. Yang mengeluh adalah pembeli, kepada kasir yang tidak
     * dapat menjelaskannya.
     */
    const dari = keMenit('22:00')!;
    const sampai = keMenit('02:00')!;
    expect(dalamJendelaJam(keMenit('23:30')!, dari, sampai)).toBe(true);
    expect(dalamJendelaJam(keMenit('01:00')!, dari, sampai)).toBe(true);
    expect(dalamJendelaJam(keMenit('12:00')!, dari, sampai)).toBe(false);
  });

  it('batas yang kosong berarti tanpa batas di sisi itu', () => {
    // Ditulis dengan jam, bukan angka menit mentah: percobaan pertama uji ini
    // memakai 500 dan mengharapkannya di dalam jendela mulai 09.00 — padahal
    // 500 menit adalah pukul 08.20. Yang salah ujinya, bukan kodenya.
    expect(dalamJendelaJam(keMenit('08:20')!, null, null)).toBe(true);
    expect(dalamJendelaJam(keMenit('10:00')!, keMenit('09:00'), null)).toBe(true);
    expect(dalamJendelaJam(keMenit('08:20')!, keMenit('09:00'), null)).toBe(false);
    expect(dalamJendelaJam(keMenit('08:20')!, null, keMenit('09:00'))).toBe(true);
    expect(dalamJendelaJam(keMenit('10:00')!, null, keMenit('09:00'))).toBe(false);
  });

  it('jam yang tidak terbaca dianggap tanpa batas, bukan menutup semuanya', () => {
    // Nilai rusak yang menutup promosi akan tampak seperti promosi yang tidak
    // pernah berlaku, dan sebabnya tidak akan pernah dicari di kolom jam.
    expect(keMenit('bukan jam')).toBeNull();
    expect(keMenit('25:00')).toBeNull();
    expect(keMenit('09:70')).toBeNull();
  });
});

describe('promosi berlaku', () => {
  it('promosi polos berlaku', () => {
    expect(promosiBerlaku(promosiDasar, ctxDasar)).toBe(true);
  });

  it('minimum pembelian BENAR-BENAR diperiksa', () => {
    /*
     * Kolomnya sudah ada sejak awal tetapi tidak pernah dibaca: promosi "potong
     * Rp 10.000 untuk pembelian di atas Rp 100.000" berlaku juga pada pembelian
     * Rp 5.000. Uang yang dilepas, tanpa satu pun galat.
     */
    const p = { ...promosiDasar, minimumPurchase: 100_000 };
    expect(promosiBerlaku(p, { ...ctxDasar, lineSubtotal: 50_000 })).toBe(false);
    expect(promosiBerlaku(p, { ...ctxDasar, lineSubtotal: 100_000 })).toBe(true);
  });

  it('minimum jumlah diperiksa', () => {
    const p = { ...promosiDasar, minimumQuantity: 3 };
    expect(promosiBerlaku(p, { ...ctxDasar, quantity: 2 })).toBe(false);
    expect(promosiBerlaku(p, { ...ctxDasar, quantity: 3 })).toBe(true);
  });

  it('masa berlaku dihormati', () => {
    expect(
      promosiBerlaku({ ...promosiDasar, validUntil: new Date('2026-01-01T00:00:00Z') }, ctxDasar),
    ).toBe(false);
    expect(
      promosiBerlaku({ ...promosiDasar, validFrom: new Date('2027-01-01T00:00:00Z') }, ctxDasar),
    ).toBe(false);
  });

  it('hari berlaku dihitung pada zona tenant', () => {
    // Senin di Jakarta, Minggu di UTC. Promosi "Senin saja" HARUS berlaku.
    expect(promosiBerlaku({ ...promosiDasar, validDays: [1] }, ctxDasar)).toBe(true);
    expect(promosiBerlaku({ ...promosiDasar, validDays: [7] }, ctxDasar)).toBe(false);
  });

  it('kuota pemakaian dihormati', () => {
    expect(
      promosiBerlaku({ ...promosiDasar, usageLimit: 10, usageCount: 10 }, ctxDasar),
    ).toBe(false);
    expect(promosiBerlaku({ ...promosiDasar, usageLimit: 10, usageCount: 9 }, ctxDasar)).toBe(true);
  });

  describe('lingkup', () => {
    it('lingkup outlet hanya mengenai outletnya', () => {
      const p = { ...promosiDasar, scopeType: 'OUTLET', scopeId: 'outlet-1' };
      expect(promosiBerlaku(p, ctxDasar)).toBe(true);
      expect(promosiBerlaku({ ...p, scopeId: 'outlet-lain' }, ctxDasar)).toBe(false);
    });

    it('lingkup brand hanya mengenai brandnya', () => {
      const p = { ...promosiDasar, scopeType: 'BRAND', scopeId: 'brand-1' };
      expect(promosiBerlaku(p, ctxDasar)).toBe(true);
      expect(promosiBerlaku(p, { ...ctxDasar, brandId: null })).toBe(false);
    });

    it('lingkup yang TIDAK dikenal tidak berlaku', () => {
      /*
       * Kebalikannya — menganggapnya berlaku untuk semua — berarti lingkup baru
       * yang ditambahkan kelak, sebelum kode ini tahu artinya, membagikan diskon
       * ke seluruh gerai.
       */
      expect(
        promosiBerlaku({ ...promosiDasar, scopeType: 'WILAYAH', scopeId: 'x' }, ctxDasar),
      ).toBe(false);
    });
  });

  describe('cakupan produk', () => {
    it('tanpa daftar produk berlaku untuk semua', () => {
      expect(promosiBerlaku(promosiDasar, ctxDasar)).toBe(true);
    });

    it('daftar produk membatasi', () => {
      const p = {
        ...promosiDasar,
        target: [{ productId: 'produk-lain', productCategoryId: null, isExclusion: false }],
      };
      expect(promosiBerlaku(p, ctxDasar)).toBe(false);
      expect(promosiBerlaku(p, { ...ctxDasar, productId: 'produk-lain' })).toBe(true);
    });

    it('kategori mencakup produknya', () => {
      const p = {
        ...promosiDasar,
        target: [{ productId: null, productCategoryId: 'kategori-1', isExclusion: false }],
      };
      expect(promosiBerlaku(p, ctxDasar)).toBe(true);
      expect(promosiBerlaku(p, { ...ctxDasar, productCategoryId: 'kategori-lain' })).toBe(false);
    });

    it('pengecualian MENANG atas pencakupan', () => {
      // Promosi "semua kopi kecuali kopi impor" harus menolak kopi impor meski
      // kategorinya tercakup.
      const p = {
        ...promosiDasar,
        target: [
          { productId: null, productCategoryId: 'kategori-1', isExclusion: false },
          { productId: 'produk-1', productCategoryId: null, isExclusion: true },
        ],
      };
      expect(promosiBerlaku(p, ctxDasar)).toBe(false);
    });

    it('pengecualian tanpa daftar cakup tetap mengecualikan', () => {
      const p = {
        ...promosiDasar,
        target: [{ productId: 'produk-1', productCategoryId: null, isExclusion: true }],
      };
      expect(promosiBerlaku(p, ctxDasar)).toBe(false);
      expect(promosiBerlaku(p, { ...ctxDasar, productId: 'produk-2' })).toBe(true);
    });
  });
});

describe('memilih promosi', () => {
  it('berurut menurut prioritas lalu waktu dibuat', () => {
    // Urutan yang sama dengan SQL sebelumnya, supaya perpindahan ini tidak
    // mengubah promosi mana yang terpakai pada data yang sudah ada.
    const a = { ...promosiDasar, id: 'a', priority: 200, createdAt: new Date('2026-01-01') };
    const b = { ...promosiDasar, id: 'b', priority: 100, createdAt: new Date('2026-03-01') };
    const c = { ...promosiDasar, id: 'c', priority: 100, createdAt: new Date('2026-02-01') };

    expect(pilihPromosi([a, b, c], ctxDasar).map((d) => d.sourceId)).toEqual(['c', 'b', 'a']);
  });

  it('yang tidak berlaku tidak ikut', () => {
    const a = { ...promosiDasar, id: 'a' };
    const b = { ...promosiDasar, id: 'b', minimumPurchase: 1_000_000 };
    expect(pilihPromosi([a, b], ctxDasar).map((d) => d.sourceId)).toEqual(['a']);
  });

  it('membawa batas potongan dan penanda persetujuan apa adanya', () => {
    const p = { ...promosiDasar, maxDiscountAmount: 25_000, requiresApproval: true };
    const [d] = pilihPromosi([p], ctxDasar);
    expect(d.maxAmount).toBe(25_000);
    expect(d.requiresApproval).toBe(true);
    expect(d.sourceType).toBe('PROMOTION');
  });
});
