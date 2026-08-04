import { SAMPLE_CATEGORY_CODES, SAMPLE_PRODUCTS } from './sample-catalog.data';
import { MARKETPLACE_CATEGORIES, computeParentCodes } from './marketplace-category.seed';

describe('katalog produk contoh', () => {
  describe('jumlah dan sebaran', () => {
    it('menyediakan 50 sampai 1000 produk', () => {
      expect(SAMPLE_PRODUCTS.length).toBeGreaterThanOrEqual(50);
      expect(SAMPLE_PRODUCTS.length).toBeLessThanOrEqual(1000);
    });

    it('menyebar pada banyak kategori', () => {
      // Dua puluh lima produk pada satu kategori tidak membuat penyaringan
      // maupun penelusuran dapat dicoba.
      expect(SAMPLE_CATEGORY_CODES.length).toBeGreaterThanOrEqual(10);
    });

    it('menempatkan seluruh produk pada kategori yang benar-benar ada', () => {
      const known = new Set(MARKETPLACE_CATEGORIES.map((c) => c.code));
      const unknown = SAMPLE_PRODUCTS.filter((p) => !known.has(p.categoryCode)).map(
        (p) => `${p.code} -> ${p.categoryCode}`,
      );
      expect(unknown).toEqual([]);
    });

    it('hanya memakai kategori daun', () => {
      // Kategori induk tidak boleh dipilih listing; produk yang ditaruh di sana
      // tidak akan ditemukan lewat penelusuran normal.
      const parents = computeParentCodes();
      const offending = SAMPLE_PRODUCTS.filter((p) => parents.has(p.categoryCode)).map(
        (p) => p.code,
      );
      expect(offending).toEqual([]);
    });

    it('tidak memakai kategori terbatas', () => {
      // Kategori terbatas menuntut izin edar yang tidak dimiliki produk contoh.
      const restricted = new Set(
        MARKETPLACE_CATEGORIES.filter((c) => c.isRestricted).map((c) => c.code),
      );
      const offending = SAMPLE_PRODUCTS.filter((p) => restricted.has(p.categoryCode)).map(
        (p) => p.code,
      );
      expect(offending).toEqual([]);
    });
  });

  describe('kode dan judul', () => {
    it('memberi setiap produk kode yang unik', () => {
      // Kode yang bertabrakan membuat penanaman ulang menganggap produk kedua
      // sudah ada, sehingga jumlahnya diam-diam kurang dari yang diminta.
      const seen = new Map<string, number>();
      for (const product of SAMPLE_PRODUCTS) {
        seen.set(product.code, (seen.get(product.code) ?? 0) + 1);
      }
      const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([code]) => code);
      expect(duplicates).toEqual([]);
    });

    it('memakai kode yang aman sebagai bagian SKU', () => {
      const offending = SAMPLE_PRODUCTS.filter((p) => !/^[A-Z0-9-]+$/.test(p.code)).map(
        (p) => p.code,
      );
      expect(offending).toEqual([]);
    });

    it('memberi judul yang berbeda satu sama lain', () => {
      const titles = new Set(SAMPLE_PRODUCTS.map((p) => p.title));
      expect(titles.size).toBe(SAMPLE_PRODUCTS.length);
    });
  });

  describe('memenuhi gerbang publikasi', () => {
    it('memberi harga di atas nol', () => {
      // Harga nol memungkinkan pemesanan tanpa membayar, dan gerbang menolaknya.
      const offending = SAMPLE_PRODUCTS.filter((p) => p.price <= 0).map((p) => p.code);
      expect(offending).toEqual([]);
    });

    it('memberi berat di atas nol', () => {
      // Tanpa berat, ongkos kirim tidak dapat dihitung.
      const offending = SAMPLE_PRODUCTS.filter((p) => p.weightGram <= 0).map((p) => p.code);
      expect(offending).toEqual([]);
    });

    it('mengizinkan pre-order pada setiap produk berstok nol', () => {
      // Stok nol tanpa izin pre-order ditolak gerbang, sehingga produk itu
      // tidak akan pernah terbit dan jumlahnya kurang dari batas minimum demo.
      const offending = SAMPLE_PRODUCTS.filter((p) => p.stock === 0 && !p.allowPreorder).map(
        (p) => p.code,
      );
      expect(offending).toEqual([]);
    });

    it('memberi deskripsi yang cukup panjang', () => {
      const tooShort = SAMPLE_PRODUCTS.filter((p) => p.description.length < 60).map((p) => p.code);
      expect(tooShort).toEqual([]);
    });

    it('menjaga varian kedua lebih mahal daripada yang pertama', () => {
      // Rentang harga yang terbalik menghasilkan tampilan "Rp 90.000 – Rp 75.000".
      const offending = SAMPLE_PRODUCTS.filter(
        (p) => p.priceHigh !== undefined && p.priceHigh <= p.price,
      ).map((p) => p.code);
      expect(offending).toEqual([]);
    });
  });

  describe('keadaan yang perlu dapat diuji', () => {
    it('menyertakan produk pesan-dahulu', () => {
      const preorder = SAMPLE_PRODUCTS.filter((p) => p.stock === 0 && p.allowPreorder);
      expect(preorder.length).toBeGreaterThan(0);
    });

    it('menyertakan produk berkondisi selain baru', () => {
      const used = SAMPLE_PRODUCTS.filter((p) => p.condition && p.condition !== 'NEW');
      expect(used.length).toBeGreaterThan(0);
    });

    it('menyertakan produk dengan rentang harga', () => {
      const ranged = SAMPLE_PRODUCTS.filter((p) => p.priceHigh !== undefined);
      expect(ranged.length).toBeGreaterThan(0);
    });

    it('menyebar harga dari puluhan ribu sampai jutaan', () => {
      // Rentang yang lebar membuat penyaringan harga dan pengurutan benar-benar
      // dapat dicoba; harga yang seragam tidak membuktikan apa pun.
      const prices = SAMPLE_PRODUCTS.map((p) => p.price);
      expect(Math.min(...prices)).toBeLessThan(50_000);
      expect(Math.max(...prices)).toBeGreaterThan(1_000_000);
    });

    it('menyertakan judul yang mirip untuk menguji peringkat pencarian', () => {
      const kopi = SAMPLE_PRODUCTS.filter((p) => p.title.toLowerCase().includes('kopi'));
      expect(kopi.length).toBeGreaterThan(1);
    });
  });
});
