import { normalizeHost, normalizeStoreSlug, RESERVED_SLUGS } from './host.util';

const accept = (raw: string, expected: string) => {
  const result = normalizeHost(raw);
  expect(result.ok).toBe(true);
  expect(result.host).toBe(expected);
};

const reject = (raw: string | string[] | undefined) => {
  const result = normalizeHost(raw);
  expect(result.ok).toBe(false);
  expect(result.reason).toBeTruthy();
};

describe('normalizeHost', () => {
  describe('bentuk yang diterima', () => {
    it('menerima host biasa', () => accept('tokojoni.com', 'tokojoni.com'));
    it('menyeragamkan huruf besar', () => accept('TokoJoni.COM', 'tokojoni.com'));
    it('membuang spasi di ujung', () => accept('  tokojoni.com  ', 'tokojoni.com'));
    it('membuang port', () => accept('tokojoni.com:8443', 'tokojoni.com'));
    it('membuang titik akhir DNS', () => accept('tokojoni.com.', 'tokojoni.com'));
    it('membuang skema yang ikut terkirim', () => accept('https://tokojoni.com', 'tokojoni.com'));
    it('menerima subdomain berlapis', () => accept('a.b.c.tokojoni.co.id', 'a.b.c.tokojoni.co.id'));
    it('menerima tanda hubung di tengah label', () => accept('toko-joni.com', 'toko-joni.com'));

    it('menyeragamkan bentuk yang berbeda menjadi satu', () => {
      // Tanpa normalisasi, "Toko.com." dan "toko.com:443" menjadi tiga entri
      // berbeda pada registry, dan hanya satu di antaranya yang cocok.
      const bentuk = ['Toko.com', 'toko.com.', 'toko.com:443', 'HTTPS://TOKO.COM'];
      const hasil = new Set(bentuk.map((b) => normalizeHost(b).host));
      expect([...hasil]).toEqual(['toko.com']);
    });
  });

  describe('penolakan yang menutup host spoofing', () => {
    it('menolak header ganda', () => reject(['a.com', 'b.com']));
    it('menolak host kosong', () => reject(''));
    it('menolak undefined', () => reject(undefined));
    it('menolak host tanpa titik', () => reject('localhost'));
    it('menolak label kosong', () => reject('toko..com'));
    it('menolak titik di awal', () => reject('.tokojoni.com'));

    it('menolak host yang memuat kredensial', () => {
      // "evil.com@tokojoni.com" dibaca berbeda oleh pengurai yang berbeda.
      reject('evil.com@tokojoni.com');
    });

    it('menolak host yang memuat jalur', () => reject('tokojoni.com/../admin'));
    it('menolak host yang memuat kueri', () => reject('tokojoni.com?x=1'));
    it('menolak host yang memuat fragmen', () => reject('tokojoni.com#x'));
    it('menolak garis miring terbalik', () => reject('tokojoni.com\\evil.com'));

    it('menolak alamat IPv4', () => reject('192.168.1.1'));
    it('menolak alamat IPv6 berkurung siku', () => reject('[::1]'));
    it('menolak alamat IPv6 telanjang', () => reject('fe80::1'));

    it('menolak port yang bukan angka', () => reject('tokojoni.com:abc'));
    it('menolak karakter unicode yang menyamar', () => reject('tokojonı.com'));
    it('menolak garis bawah', () => reject('toko_joni.com'));
    it('menolak tanda hubung di awal label', () => reject('-toko.com'));
    it('menolak tanda hubung di akhir label', () => reject('toko-.com'));

    it('menolak host melebihi 253 karakter', () => {
      reject(`${'a'.repeat(60)}.${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.${'e'.repeat(20)}.com`);
    });

    it('menolak label melebihi 63 karakter', () => reject(`${'a'.repeat(64)}.com`));
  });

  describe('alasan penolakan selalu ada', () => {
    it('menyertakan alasan yang dapat dicatat', () => {
      // Alasan dicatat untuk penyelidikan, bukan ditampilkan ke pengunjung —
      // memberi tahu penyerang mengapa tebakannya gagal mempermudah tebakan
      // berikutnya.
      expect(normalizeHost('192.168.1.1').reason).toMatch(/Alamat IP/);
      expect(normalizeHost('toko..com').reason).toMatch(/label kosong/);
    });
  });
});

describe('normalizeStoreSlug', () => {
  it('menerima slug biasa', () => {
    expect(normalizeStoreSlug('toko-joni')).toMatchObject({ ok: true, host: 'toko-joni' });
  });

  it('menyeragamkan huruf besar', () => {
    expect(normalizeStoreSlug('TokoJoni').host).toBe('tokojoni');
  });

  it('menolak slug terlalu pendek', () => {
    expect(normalizeStoreSlug('ab').ok).toBe(false);
  });

  it('menolak slug terlalu panjang', () => {
    expect(normalizeStoreSlug('a'.repeat(65)).ok).toBe(false);
  });

  it('menolak karakter di luar huruf, angka, dan tanda hubung', () => {
    const diterima = ['toko joni', 'toko.joni', 'toko/joni', 'toko_joni', 'toko@joni'].filter(
      (slug) => normalizeStoreSlug(slug).ok,
    );
    expect(diterima).toEqual([]);
  });

  it('menolak tanda hubung di ujung', () => {
    expect(normalizeStoreSlug('-toko').ok).toBe(false);
    expect(normalizeStoreSlug('toko-').ok).toBe(false);
  });

  describe('slug yang dicadangkan', () => {
    it('menolak jalur platform agar tidak bertabrakan', () => {
      const diterima = ['admin', 'api', 'checkout', 'keranjang', 'platform'].filter(
        (slug) => normalizeStoreSlug(slug).ok,
      );
      expect(diterima).toEqual([]);
    });

    it('menolak nama yang dapat dipakai menyamar sebagai halaman resmi', () => {
      const diterima = ['ebisnis', 'belanja', 'support', 'dukungan'].filter(
        (slug) => normalizeStoreSlug(slug).ok,
      );
      expect(diterima).toEqual([]);
    });

    it('memuat seluruh jalur yang benar-benar dipakai aplikasi', () => {
      const hilang = ['app', 'auth', 'masuk', 'daftar', 'toko'].filter(
        (slug) => !RESERVED_SLUGS.has(slug),
      );
      expect(hilang).toEqual([]);
    });
  });
});
