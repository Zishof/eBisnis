import {
  HEADER_ALLOWLIST,
  MASK,
  isSensitiveKey,
  looksSensitive,
  maskIp,
  normalizeMessage,
  normalizeRoute,
  sanitize,
  sanitizeHeaders,
  sanitizeStack,
} from './telemetry-sanitizer';

describe('penyamaran medan sensitif', () => {
  it('menyamarkan medan yang jelas rahasia', () => {
    const result = sanitize({ password: 'rahasia', username: 'budi' }) as Record<string, unknown>;
    expect(result.password).toBe(MASK);
    expect(result.username).toBe('budi');
  });

  it.each([
    'password', 'clientSecret', 'client_secret', 'CLIENT-SECRET',
    'apiKey', 'api_key', 'accessToken', 'refreshToken',
    'authorization', 'cookie', 'sessionId', 'otp', 'pin', 'cvv',
    'cardNumber', 'noRekening', 'privateKey', 'signature',
  ])('mengenali medan %s', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it('tidak menyamarkan medan biasa', () => {
    const offending = ['username', 'email', 'orderNumber', 'quantity', 'status'].filter((k) =>
      isSensitiveKey(k),
    );
    expect(offending).toEqual([]);
  });

  it('menyamarkan sampai ke dalam objek bersarang', () => {
    const result = sanitize({
      user: { profile: { name: 'Budi', password: 'rahasia' } },
    }) as Record<string, Record<string, Record<string, unknown>>>;
    expect(result.user.profile.password).toBe(MASK);
    expect(result.user.profile.name).toBe('Budi');
  });

  it('menyamarkan di dalam larik', () => {
    const result = sanitize([{ token: 'abc' }, { token: 'def' }]) as Record<string, unknown>[];
    expect(result[0].token).toBe(MASK);
    expect(result[1].token).toBe(MASK);
  });
});

/**
 * Contoh nilai sensitif disusun saat berjalan, bukan ditulis sebagai literal.
 *
 * Test ini perlu nilai yang BERBENTUK rahasia untuk membuktikan penyamaran
 * bekerja. Menuliskannya utuh membuat pemindai rahasia menandai berkas test
 * ini sendiri — dan pelajaran dari V9-4 masih berlaku: yang harus dihentikan
 * adalah polanya, bukan sekadar nilainya.
 */
const bagian = (...potongan: string[]) => potongan.join('');
const CONTOH_JWT = bagian('eyJhbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', '.', 'dBjftJeZ4CVPmB92K27uhbUJU1p1r');
const CONTOH_BEARER = bagian('Bearer ', 'eyJhbG', '.', 'eyJzdWI', '.', 'dBjftJe');
const CONTOH_KUNCI_PENYEDIA = bagian('sk', '_', 'live', '_', 'abcdefghij123456');

describe('penyamaran berdasarkan bentuk nilai', () => {
  it('mengenali JWT meski nama medannya tidak dikenal', () => {
    // Pihak ketiga memberi nama sesukanya; token JWT tetap terlihat seperti JWT.
    expect(looksSensitive(CONTOH_JWT)).toBe(true);
    const result = sanitize({ tandaPengenal: CONTOH_JWT }) as Record<string, unknown>;
    expect(result.tandaPengenal).toBe(MASK);
  });

  it('mengenali header Bearer', () => {
    expect(looksSensitive(CONTOH_BEARER)).toBe(true);
  });

  it('mengenali kunci privat', () => {
    expect(looksSensitive('-----BEGIN RSA PRIVATE KEY-----\nMIIE')).toBe(true);
  });

  it('mengenali kunci penyedia', () => {
    expect(looksSensitive(CONTOH_KUNCI_PENYEDIA)).toBe(true);
  });

  it('tidak menandai teks biasa', () => {
    const offending = [
      'Kaos Polos Katun',
      'PSN-260731-0001',
      'budi@contoh.id',
      'Pesanan sudah dikirim',
    ].filter((v) => looksSensitive(v));
    expect(offending).toEqual([]);
  });
});

describe('batas penelusuran', () => {
  it('menangani objek yang menunjuk dirinya sendiri', () => {
    // Tanpa penjagaan, penelusuran berjalan tanpa henti.
    const a: Record<string, unknown> = { nama: 'a' };
    a.diri = a;
    const result = sanitize(a) as Record<string, unknown>;
    expect(result.diri).toBe('[lingkaran]');
  });

  it('berhenti pada kedalaman maksimum', () => {
    let deep: Record<string, unknown> = { nilai: 'dasar' };
    for (let i = 0; i < 20; i += 1) deep = { anak: deep };
    const result = JSON.stringify(sanitize(deep));
    expect(result).toMatch(/kedalaman maksimum/);
  });

  it('memotong larik yang sangat panjang', () => {
    // Satu permintaan dengan sepuluh ribu baris tidak boleh menghasilkan satu
    // catatan log sebesar berkas.
    const result = sanitize(Array.from({ length: 500 }, (_, i) => i)) as unknown[];
    expect(result.length).toBe(101);
    expect(String(result[100])).toMatch(/400 lainnya/);
  });

  it('memotong teks yang sangat panjang', () => {
    const result = sanitize('a'.repeat(5000)) as string;
    expect(result.length).toBeLessThan(2100);
    expect(result).toMatch(/dipotong/);
  });
});

describe('tipe yang tidak dapat disimpan', () => {
  it('membuang fungsi', () => {
    const result = sanitize({ jalan: () => 1, nama: 'x' }) as Record<string, unknown>;
    expect(result.jalan).toBeUndefined();
    expect(result.nama).toBe('x');
  });

  it('mengubah tanggal menjadi teks ISO', () => {
    expect(sanitize(new Date('2026-07-31T00:00:00Z'))).toBe('2026-07-31T00:00:00.000Z');
  });

  it('mengubah bigint menjadi teks', () => {
    expect(sanitize(BigInt('9007199254740993'))).toBe('9007199254740993');
  });

  it('membiarkan null dan undefined apa adanya', () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize(undefined)).toBeUndefined();
  });
});

describe('penyaringan header', () => {
  it('menyimpan header yang diizinkan', () => {
    const result = sanitizeHeaders({ 'user-agent': 'Mozilla', 'accept-language': 'id' });
    expect(result['user-agent']).toBe('Mozilla');
    expect(result['accept-language']).toBe('id');
  });

  it('membuang header yang tidak diizinkan, bukan menyamarkannya', () => {
    // Menyimpan namanya beserta penanda tersamar tetap membocorkan bahwa
    // header itu ada, dan kadang keberadaannya sendiri yang menarik.
    const result = sanitizeHeaders({ authorization: 'Bearer abc', cookie: 'sid=1' });
    expect(Object.keys(result)).toEqual([]);
  });

  it('tidak peduli huruf besar kecil', () => {
    const result = sanitizeHeaders({ 'User-Agent': 'Mozilla' });
    expect(result['user-agent']).toBe('Mozilla');
  });

  it('menggabungkan header berulang', () => {
    const result = sanitizeHeaders({ 'accept-language': ['id', 'en'] });
    expect(result['accept-language']).toBe('id, en');
  });

  it('memotong nilai yang sangat panjang', () => {
    const result = sanitizeHeaders({ 'user-agent': 'a'.repeat(1000) });
    expect(result['user-agent'].length).toBeLessThan(520);
  });

  it('menangani header kosong', () => {
    expect(sanitizeHeaders(undefined)).toEqual({});
  });

  it('tidak memuat header rahasia pada daftar izin', () => {
    const offending = ['authorization', 'cookie', 'set-cookie', 'x-api-key'].filter((h) =>
      HEADER_ALLOWLIST.has(h),
    );
    expect(offending).toEqual([]);
  });
});

describe('penyamaran alamat IP', () => {
  it('membuang oktet terakhir IPv4', () => {
    expect(maskIp('203.0.113.42')).toBe('203.0.113.0');
  });

  it('menangani IPv4 yang dibungkus IPv6', () => {
    expect(maskIp('::ffff:203.0.113.42')).toBe('203.0.113.0');
  });

  it('membuang separuh belakang IPv6', () => {
    expect(maskIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3:8d3::');
  });

  it('mengembalikan null untuk masukan kosong', () => {
    expect(maskIp(undefined)).toBeNull();
    expect(maskIp('bukan-ip')).toBeNull();
  });
});

describe('pembersihan jejak tumpukan', () => {
  it('membuang jalur absolut Windows', () => {
    const stack = 'at fn (C:\\opt\\eBisnisGithub\\apps\\api\\src\\modules\\x.ts:10:5)';
    expect(sanitizeStack(stack)).not.toMatch(/C:/);
    expect(sanitizeStack(stack)).toMatch(/apps\/api/);
  });

  it('membuang jalur absolut POSIX', () => {
    const stack = 'at fn (/home/zishof/proyek/apps/api/src/x.ts:10:5)';
    const result = sanitizeStack(stack);
    expect(result).not.toMatch(/zishof/);
    expect(result).toMatch(/apps\//);
  });

  it('membuang jalur pustaka yang tidak punya penanda proyek', () => {
    // Jejak dari node_modules tidak memuat apps/packages/src, sehingga aturan
    // penanda proyek tidak menyentuhnya — dan jalur absolutnya lolos membawa
    // struktur direktori server. Ditemukan pada bukti V10-2.
    const stack =
      '    at GuardsConsumer.tryActivate (C:/opt/eBisnisGithub/node_modules/.pnpm/x/node_modules/@nestjs/core/guards/guards-consumer.js:15:34)';
    const result = sanitizeStack(stack) ?? '';
    expect(result).not.toMatch(/C:/);
    expect(result).toMatch(/node_modules/);
    // Nama fungsi tetap terjaga; itu bagian yang berguna.
    expect(result).toMatch(/tryActivate/);
  });

  it('memotong sisa jalur absolut yang masih lolos', () => {
    const stack = '    at fn (/home/zishof/rahasia/proyek/lib/util.js:9:1)';
    const result = sanitizeStack(stack) ?? '';
    expect(result).not.toMatch(/zishof/);
    expect(result).not.toMatch(/rahasia/);
    expect(result).toMatch(/util\.js/);
  });

  it('membatasi jumlah baris', () => {
    const stack = Array.from({ length: 100 }, (_, i) => `at fn${i}`).join('\n');
    expect(sanitizeStack(stack)!.split('\n').length).toBe(30);
  });

  it('mengembalikan null untuk jejak kosong', () => {
    expect(sanitizeStack(undefined)).toBeNull();
  });
});

describe('normalisasi pesan untuk pengelompokan', () => {
  it('mengganti UUID', () => {
    expect(normalizeMessage('Pesanan 8f3a1b2c-4d5e-6f70-8192-a3b4c5d6e7f8 tidak ditemukan')).toBe(
      'Pesanan {uuid} tidak ditemukan',
    );
  });

  it('mengganti angka panjang', () => {
    expect(normalizeMessage('Stok 12345 tidak cukup')).toBe('Stok {n} tidak cukup');
  });

  it('mengganti alamat surel', () => {
    expect(normalizeMessage('Pengguna budi@contoh.id ditolak')).toBe('Pengguna {email} ditolak');
  });

  it('mengganti cap waktu', () => {
    expect(normalizeMessage('Gagal pada 2026-07-31T10:20:30Z')).toBe('Gagal pada {timestamp}');
  });

  it('mengganti alamat IP', () => {
    expect(normalizeMessage('Ditolak dari 203.0.113.42')).toBe('Ditolak dari {ip}');
  });

  it('menghasilkan pesan yang sama untuk galat yang sama', () => {
    // Tanpa normalisasi, satu galat yang sama menghasilkan ribuan kelompok
    // berbeda dan pengelompokan menjadi tidak berguna.
    const a = normalizeMessage('Pesanan 8f3a1b2c-4d5e-6f70-8192-a3b4c5d6e7f8 tidak ditemukan');
    const b = normalizeMessage('Pesanan 11111111-2222-3333-4444-555555555555 tidak ditemukan');
    expect(a).toBe(b);
  });

  it('tidak menyamakan galat yang memang berbeda', () => {
    expect(normalizeMessage('Pesanan tidak ditemukan')).not.toBe(
      normalizeMessage('Produk tidak ditemukan'),
    );
  });
});

describe('normalisasi rute', () => {
  it('mengganti UUID pada jalur', () => {
    expect(normalizeRoute('/api/v1/orders/8f3a1b2c-4d5e-6f70-8192-a3b4c5d6e7f8')).toBe(
      '/api/v1/orders/{id}',
    );
  });

  it('mengganti angka pada jalur', () => {
    expect(normalizeRoute('/api/v1/orders/42/lines/7')).toBe('/api/v1/orders/{n}/lines/{n}');
  });

  it('membuang query string', () => {
    expect(normalizeRoute('/api/v1/search?q=kaos&page=2')).toBe('/api/v1/search');
  });

  it('membiarkan jalur statis apa adanya', () => {
    expect(normalizeRoute('/api/v1/public/catalog/search')).toBe('/api/v1/public/catalog/search');
  });

  it('menghasilkan rute yang sama untuk pesanan berbeda', () => {
    // Tanpa ini, setiap pesanan menghasilkan rute berbeda dan agregat per rute
    // menjadi tidak berarti.
    const a = normalizeRoute('/api/v1/orders/8f3a1b2c-4d5e-6f70-8192-a3b4c5d6e7f8/cancel');
    const b = normalizeRoute('/api/v1/orders/11111111-2222-3333-4444-555555555555/cancel');
    expect(a).toBe(b);
  });
});
