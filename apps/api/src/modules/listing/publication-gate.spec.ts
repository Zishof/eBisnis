import { evaluatePublicationGate, type ListingSnapshot } from './publication-gate';

const variant = (over: Partial<ListingSnapshot['variants'][number]> = {}) => ({
  sku: 'SKU-001',
  priceMinor: '150000',
  stockQty: 10,
  allowPreorder: false,
  weightGram: 500,
  lengthMm: 200,
  widthMm: 150,
  heightMm: 100,
  ...over,
});

const media = (count: number, over: Partial<ListingSnapshot['media'][number]> = {}) =>
  Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    isActive: true,
    isPrimary: i === 0,
    moderationStatus: 'APPROVED',
    ...over,
  }));

/** Listing yang memenuhi seluruh syarat. Test mengubah satu hal dari sini. */
const complete = (over: Partial<ListingSnapshot> = {}): ListingSnapshot => ({
  sellerStatus: 'ACTIVE',
  productIsActive: true,
  title: 'Sepatu Lari Ringan Pria',
  description:
    'Sepatu lari dengan bantalan empuk, cocok untuk latihan harian maupun lomba jarak menengah.',
  marketplaceCategoryId: 'cat-1',
  condition: 'NEW',
  variants: [variant()],
  media: media(3),
  shippingOriginRef: 'addr-1',
  returnPolicyPublished: true,
  taxCategoryId: 'tax-1',
  complianceStatus: 'PASSED',
  youtubeVideoId: null,
  ...over,
});

const codes = (listing: ListingSnapshot) =>
  evaluatePublicationGate(listing).blocking.map((c) => c.code);

describe('evaluatePublicationGate', () => {
  it('meloloskan listing yang memenuhi seluruh syarat', () => {
    const result = evaluatePublicationGate(complete());
    expect(result.canPublish).toBe(true);
    expect(result.blocking).toEqual([]);
  });

  it('memeriksa seluruh syarat, bukan berhenti pada yang pertama gagal', () => {
    // Penjual yang memperbaiki satu hal lalu ditolak karena hal berikutnya akan
    // menyerah; daftar lengkap membuatnya dapat menyelesaikan semuanya sekaligus.
    const kosong = complete({
      title: null,
      description: null,
      marketplaceCategoryId: null,
      media: [],
    });
    const result = evaluatePublicationGate(kosong);
    expect(result.blocking.length).toBeGreaterThan(3);
    expect(result.checks.length).toBeGreaterThan(result.blocking.length);
  });

  describe('gerbang tiga gambar', () => {
    it.each([0, 1, 2])('menolak listing dengan %i gambar', (count) => {
      expect(codes(complete({ media: media(count) }))).toContain('MINIMUM_IMAGES');
    });

    it('menerima listing dengan tepat tiga gambar', () => {
      expect(codes(complete({ media: media(3) }))).not.toContain('MINIMUM_IMAGES');
    });

    it('menerima lebih dari tiga gambar', () => {
      expect(codes(complete({ media: media(6) }))).not.toContain('MINIMUM_IMAGES');
    });

    it('tidak menghitung gambar yang tidak aktif', () => {
      // Empat gambar tetapi dua di antaranya nonaktif berarti dua yang berlaku.
      const campuran = [...media(2), ...media(2).map((m) => ({ ...m, isActive: false, isPrimary: false }))];
      expect(codes(complete({ media: campuran }))).toContain('MINIMUM_IMAGES');
    });

    it('menghormati batas yang berbeda dari program', () => {
      const result = evaluatePublicationGate(complete({ media: media(5) }), { minimumImages: 6 });
      expect(result.blocking.map((c) => c.code)).toContain('MINIMUM_IMAGES');
    });

    it('menyebut berapa yang ada dan berapa yang dibutuhkan', () => {
      const check = evaluatePublicationGate(complete({ media: media(1) })).blocking.find(
        (c) => c.code === 'MINIMUM_IMAGES',
      );
      expect(check?.detail).toMatch(/Perlu 3 gambar aktif; saat ini 1/);
    });
  });

  describe('gambar utama', () => {
    it('menolak bila tidak ada gambar utama', () => {
      const tanpaUtama = media(3).map((m) => ({ ...m, isPrimary: false }));
      expect(codes(complete({ media: tanpaUtama }))).toContain('PRIMARY_IMAGE');
    });

    it('menolak bila ada lebih dari satu gambar utama', () => {
      const duaUtama = media(3).map((m) => ({ ...m, isPrimary: true }));
      const check = evaluatePublicationGate(complete({ media: duaUtama })).blocking.find(
        (c) => c.code === 'PRIMARY_IMAGE',
      );
      expect(check?.detail).toMatch(/Ada 3 gambar utama/);
    });

    it('menolak gambar yang ditolak moderasi', () => {
      const ditolak = media(3).map((m, i) =>
        i === 1 ? { ...m, moderationStatus: 'REJECTED' } : m,
      );
      expect(codes(complete({ media: ditolak }))).toContain('MEDIA_MODERATION');
    });
  });

  describe('penjual dan produk', () => {
    it.each(['PENDING_APPROVAL', 'SUSPENDED', 'REJECTED', 'PROSPECT'])(
      'menolak penjual berstatus %s',
      (status) => {
        expect(codes(complete({ sellerStatus: status }))).toContain('SELLER_ACTIVE');
      },
    );

    it('menolak produk yang tidak aktif', () => {
      expect(codes(complete({ productIsActive: false }))).toContain('PRODUCT_ACTIVE');
    });
  });

  describe('isi listing', () => {
    it('menolak judul terlalu pendek', () => {
      expect(codes(complete({ title: 'Sepatu' }))).toContain('TITLE');
    });

    it('menolak judul yang hanya berisi spasi', () => {
      expect(codes(complete({ title: '              ' }))).toContain('TITLE');
    });

    it('menolak deskripsi terlalu pendek', () => {
      expect(codes(complete({ description: 'Bagus.' }))).toContain('DESCRIPTION');
    });

    it('menolak tanpa kategori', () => {
      expect(codes(complete({ marketplaceCategoryId: null }))).toContain('CATEGORY');
    });

    it('menolak tanpa kondisi barang', () => {
      expect(codes(complete({ condition: null }))).toContain('CONDITION');
    });
  });

  describe('varian', () => {
    it('menolak listing tanpa varian', () => {
      const blocking = codes(complete({ variants: [] }));
      expect(blocking).toContain('VARIANT');
      // Tanpa varian, syarat yang bergantung padanya juga tidak terpenuhi.
      expect(blocking).toContain('SKU');
      expect(blocking).toContain('PRICE');
    });

    it('menolak varian tanpa SKU', () => {
      expect(codes(complete({ variants: [variant({ sku: null })] }))).toContain('SKU');
    });

    it('menolak harga nol', () => {
      // Harga nol membuat pembeli dapat memesan tanpa membayar.
      expect(codes(complete({ variants: [variant({ priceMinor: '0' })] }))).toContain('PRICE');
    });

    it('menolak harga negatif', () => {
      expect(codes(complete({ variants: [variant({ priceMinor: '-5000' })] }))).toContain('PRICE');
    });

    it('menolak harga yang bukan angka', () => {
      expect(codes(complete({ variants: [variant({ priceMinor: 'gratis' })] }))).toContain('PRICE');
    });

    it('menolak varian tanpa stok dan tanpa pre-order', () => {
      expect(codes(complete({ variants: [variant({ stockQty: 0, allowPreorder: false })] }))).toContain(
        'STOCK_OR_PREORDER',
      );
    });

    it('menerima stok nol bila pre-order diizinkan', () => {
      expect(
        codes(complete({ variants: [variant({ stockQty: 0, allowPreorder: true })] })),
      ).not.toContain('STOCK_OR_PREORDER');
    });

    it('menghitung berapa varian yang bermasalah', () => {
      const check = evaluatePublicationGate(
        complete({ variants: [variant(), variant({ sku: null }), variant({ sku: '' })] }),
      ).blocking.find((c) => c.code === 'SKU');
      expect(check?.detail).toMatch(/2 varian belum punya SKU/);
    });
  });

  describe('pengiriman', () => {
    it('menolak varian tanpa berat', () => {
      expect(codes(complete({ variants: [variant({ weightGram: null })] }))).toContain('WEIGHT');
    });

    it('menolak berat nol', () => {
      expect(codes(complete({ variants: [variant({ weightGram: 0 })] }))).toContain('WEIGHT');
    });

    it('menolak dimensi yang tidak lengkap', () => {
      expect(codes(complete({ variants: [variant({ heightMm: null })] }))).toContain('DIMENSION');
    });

    it('menolak tanpa alamat asal pengiriman', () => {
      expect(codes(complete({ shippingOriginRef: null }))).toContain('SHIPPING_ORIGIN');
    });
  });

  describe('kebijakan', () => {
    it('menolak tanpa kategori pajak', () => {
      expect(codes(complete({ taxCategoryId: null }))).toContain('TAX_POLICY');
    });

    it('menolak bila kebijakan retur belum terbit', () => {
      expect(codes(complete({ returnPolicyPublished: false }))).toContain('RETURN_POLICY');
    });
  });

  describe('kepatuhan', () => {
    it('menolak bila pemeriksaan belum dijalankan', () => {
      // Belum diperiksa BUKAN berarti lolos. Produk terlarang yang belum sempat
      // diperiksa tidak boleh tampil hanya karena antrean moderasi menumpuk.
      const check = evaluatePublicationGate(complete({ complianceStatus: null })).blocking.find(
        (c) => c.code === 'COMPLIANCE',
      );
      expect(check?.detail).toMatch(/belum dijalankan/);
    });

    it('menolak bila pemeriksaan gagal', () => {
      expect(codes(complete({ complianceStatus: 'FAILED' }))).toContain('COMPLIANCE');
    });

    it('meloloskan hanya bila PASSED', () => {
      expect(codes(complete({ complianceStatus: 'PASSED' }))).not.toContain('COMPLIANCE');
    });
  });

  describe('keterangan yang dapat ditindaklanjuti', () => {
    it('setiap syarat yang gagal punya keterangan', () => {
      const tanpaKeterangan = evaluatePublicationGate(
        complete({ title: null, media: [], shippingOriginRef: null }),
      ).blocking.filter((c) => !c.detail || c.detail.length < 10);
      expect(tanpaKeterangan).toEqual([]);
    });

    it('mengarahkan ke tempat memperbaikinya', () => {
      const check = evaluatePublicationGate(complete({ shippingOriginRef: null })).blocking.find(
        (c) => c.code === 'SHIPPING_ORIGIN',
      );
      expect(check?.detail).toMatch(/pengaturan toko/);
    });
  });
});
