import {
  MARKETPLACE_CATEGORIES,
  ROOT_CATEGORY_CODES,
  buildPath,
  computeParentCodes,
  type CategorySeed,
} from './marketplace-category.seed';

describe('katalog kategori marketplace', () => {
  describe('bentuk data', () => {
    it('memberi setiap kategori kode yang unik', () => {
      const seen = new Map<string, number>();
      for (const category of MARKETPLACE_CATEGORIES) {
        seen.set(category.code, (seen.get(category.code) ?? 0) + 1);
      }
      const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([code]) => code);
      expect(duplicates).toEqual([]);
    });

    it('memberi setiap kategori alamat yang unik', () => {
      // Alamat yang bertabrakan membuat satu kategori tidak pernah dapat
      // dibuka, dan basis data akan menolaknya saat penanaman.
      const seen = new Map<string, number>();
      for (const category of MARKETPLACE_CATEGORIES) {
        seen.set(category.slug, (seen.get(category.slug) ?? 0) + 1);
      }
      const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);
      expect(duplicates).toEqual([]);
    });

    it('memakai alamat yang aman untuk URL', () => {
      const offending = MARKETPLACE_CATEGORIES.filter((c) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug)).map(
        (c) => `${c.code}: ${c.slug}`,
      );
      expect(offending).toEqual([]);
    });

    it('menunjuk induk yang benar-benar ada', () => {
      const codes = new Set(MARKETPLACE_CATEGORIES.map((c) => c.code));
      const orphans = MARKETPLACE_CATEGORIES.filter(
        (c) => c.parentCode !== null && !codes.has(c.parentCode),
      ).map((c) => `${c.code} -> ${c.parentCode}`);
      expect(orphans).toEqual([]);
    });

    it('menyediakan lebih dari satu akar', () => {
      expect(ROOT_CATEGORY_CODES.length).toBeGreaterThan(5);
    });
  });

  describe('daun dan induk', () => {
    it('menandai kategori yang punya anak sebagai bukan daun', () => {
      const parents = computeParentCodes();
      for (const root of ROOT_CATEGORY_CODES) {
        expect(parents.has(root)).toBe(true);
      }
    });

    it('meninggalkan kategori tanpa anak sebagai daun', () => {
      const parents = computeParentCodes();
      const leaves = MARKETPLACE_CATEGORIES.filter((c) => !parents.has(c.code));
      expect(leaves.length).toBeGreaterThan(30);
    });

    it('menghitung ulang saat anak baru ditambahkan', () => {
      // Inilah alasan daun dihitung dari data, bukan ditulis tangan: satu
      // baris baru mengubah status induknya tanpa ada yang perlu diingat.
      const extended: CategorySeed[] = [
        { code: 'A', name: 'A', slug: 'a', parentCode: null, sortOrder: 1 },
        { code: 'B', name: 'B', slug: 'b', parentCode: 'A', sortOrder: 1 },
      ];
      expect(computeParentCodes(extended).has('A')).toBe(true);
      expect(computeParentCodes(extended).has('B')).toBe(false);
    });

    it('memastikan setiap akar punya sedikitnya satu anak', () => {
      // Akar tanpa anak tidak dapat dipilih maupun ditelusuri: ia bukan daun
      // (karena akar), tetapi tidak menuntun ke mana pun.
      const parents = computeParentCodes();
      const barren = ROOT_CATEGORY_CODES.filter((code) => !parents.has(code));
      expect(barren).toEqual([]);
    });
  });

  describe('jalur materialized', () => {
    it('menyusun jalur dari akar sampai simpul', () => {
      expect(buildPath('FASHION_PRIA')).toBe('/FASHION/FASHION_PRIA');
    });

    it('menyusun jalur akar tanpa induk', () => {
      expect(buildPath('FASHION')).toBe('/FASHION');
    });

    it('membuat jalur anak selalu berawalan jalur induknya', () => {
      // Sifat inilah yang membuat pencarian seluruh keturunan menjadi satu
      // perbandingan awalan alih-alih kueri rekursif.
      const offending = MARKETPLACE_CATEGORIES.filter((c) => c.parentCode !== null)
        .filter((c) => !buildPath(c.code).startsWith(`${buildPath(c.parentCode!)}/`))
        .map((c) => c.code);
      expect(offending).toEqual([]);
    });

    it('berhenti pada data yang membentuk lingkaran', () => {
      // Tanpa batas kedalaman, satu baris salah membuat penanaman berjalan
      // tanpa henti alih-alih gagal dengan jelas.
      const cyclic: CategorySeed[] = [
        { code: 'X', name: 'X', slug: 'x', parentCode: 'Y', sortOrder: 1 },
        { code: 'Y', name: 'Y', slug: 'y', parentCode: 'X', sortOrder: 1 },
      ];
      const path = buildPath('X', cyclic);
      expect(path.length).toBeLessThan(200);
    });
  });

  describe('kategori terbatas', () => {
    it('menyertakan alasan pada setiap kategori terbatas', () => {
      const missing = MARKETPLACE_CATEGORIES.filter((c) => c.isRestricted && !c.restrictionNote).map(
        (c) => c.code,
      );
      expect(missing).toEqual([]);
    });

    it('menandai suplemen dan alat kesehatan sebagai terbatas', () => {
      const restricted = new Set(
        MARKETPLACE_CATEGORIES.filter((c) => c.isRestricted).map((c) => c.code),
      );
      expect(restricted.has('KESEHATAN_SUPLEMEN')).toBe(true);
      expect(restricted.has('KESEHATAN_ALKES')).toBe(true);
    });

    it('tidak menandai kategori umum sebagai terbatas', () => {
      const fashion = MARKETPLACE_CATEGORIES.find((c) => c.code === 'FASHION_PRIA');
      expect(fashion?.isRestricted ?? false).toBe(false);
    });
  });
});
