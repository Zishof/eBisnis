import {
  DEFAULT_PAGE_SIZE,
  MAX_OFFSET,
  MAX_PAGE_SIZE,
  clamp,
  normalizeTerm,
} from './catalog-search.service';
import { slugify } from './listing-projection.service';

describe('batas terhadap pengambilan katalog massal (R26)', () => {
  describe('ukuran halaman', () => {
    it('memangkas permintaan yang melebihi batas alih-alih menolaknya', () => {
      // Dipangkas, bukan ditolak: pengunjung yang salah menulis angka tetap
      // mendapat hasil, sedangkan penyalin katalog tetap terbatas.
      expect(clamp(1000, 1, MAX_PAGE_SIZE)).toBe(MAX_PAGE_SIZE);
      expect(clamp(100000, 1, MAX_PAGE_SIZE)).toBe(MAX_PAGE_SIZE);
    });

    it('menaikkan angka nol dan negatif ke satu', () => {
      expect(clamp(0, 1, MAX_PAGE_SIZE)).toBe(1);
      expect(clamp(-50, 1, MAX_PAGE_SIZE)).toBe(1);
    });

    it('menerima angka yang wajar apa adanya', () => {
      expect(clamp(24, 1, MAX_PAGE_SIZE)).toBe(24);
      expect(clamp(DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE)).toBe(DEFAULT_PAGE_SIZE);
    });

    it('memakai batas bawah untuk nilai yang bukan angka', () => {
      expect(clamp(Number.NaN, 1, MAX_PAGE_SIZE)).toBe(1);
      expect(clamp(Number.POSITIVE_INFINITY, 1, MAX_PAGE_SIZE)).toBe(1);
    });

    it('membulatkan pecahan ke bawah', () => {
      expect(clamp(24.9, 1, MAX_PAGE_SIZE)).toBe(24);
    });

    it('menjaga batas tetap masuk akal untuk satu halaman', () => {
      // Batas yang terlalu besar membuat satu permintaan cukup untuk menyalin
      // sebagian besar katalog kecil.
      expect(MAX_PAGE_SIZE).toBeLessThanOrEqual(100);
      expect(MAX_OFFSET).toBeLessThanOrEqual(5000);
    });
  });

  describe('kata kunci', () => {
    it('menolak kata kunci yang terlalu pendek', () => {
      // Satu huruf cocok dengan hampir segalanya dan bukan pencarian.
      expect(normalizeTerm('a')).toBeNull();
      expect(normalizeTerm('')).toBeNull();
      expect(normalizeTerm('  ')).toBeNull();
    });

    it('menerima kata kunci dua huruf ke atas', () => {
      expect(normalizeTerm('hp')).toBe('hp');
      expect(normalizeTerm('kaos polos')).toBe('kaos polos');
    });

    it('memotong kata kunci yang sangat panjang', () => {
      const result = normalizeTerm('a'.repeat(5000));
      expect(result).not.toBeNull();
      expect(result!.length).toBeLessThanOrEqual(120);
    });

    it('merapikan spasi berlebih', () => {
      expect(normalizeTerm('  kaos    polos   hitam ')).toBe('kaos polos hitam');
    });

    it('menolak nilai yang bukan teks', () => {
      expect(normalizeTerm(null)).toBeNull();
      expect(normalizeTerm(undefined)).toBeNull();
      expect(normalizeTerm(42 as unknown as string)).toBeNull();
    });
  });
});

describe('slugify', () => {
  it('mengubah judul menjadi alamat yang aman', () => {
    expect(slugify('Kaos Polos Hitam')).toBe('kaos-polos-hitam');
  });

  it('membuang karakter yang tidak aman untuk URL', () => {
    const offending = ['Kaos <script>', 'Produk #1 @ 50%', 'A/B/C', 'Tanda "kutip"'].filter((title) =>
      /[^a-z0-9-]/.test(slugify(title)),
    );
    expect(offending).toEqual([]);
  });

  it('menyatukan bentuk berdiakritik dengan bentuk polosnya', () => {
    expect(slugify('Kopi Árabika')).toBe(slugify('Kopi Arabika'));
  });

  it('tidak meninggalkan tanda hubung di ujung', () => {
    const offending = ['  Kaos  ', '---Produk---', '!!!', 'A - B - '].filter((title) =>
      /^-|-$/.test(slugify(title)),
    );
    expect(offending).toEqual([]);
  });

  it('memberi nilai cadangan saat judul tidak menyisakan apa pun', () => {
    // Judul yang seluruhnya berupa tanda baca menghasilkan string kosong, dan
    // alamat kosong akan menabrak alamat kosong lainnya.
    expect(slugify('!!!')).toBe('produk');
    expect(slugify('')).toBe('produk');
    expect(slugify('中文标题')).toBe('produk');
  });

  it('membatasi panjang alamat', () => {
    expect(slugify('kata '.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});
