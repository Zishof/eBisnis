/**
 * Pengujian keadaan sambungan dan kesegaran katalog luring.
 *
 * Dua hal dijaga paling ketat, dan keduanya soal kejujuran layar kepada kasir:
 *
 * 1. **"Ada Wi-Fi" bukan "peladen menjawab".** Membedakan keduanya menentukan
 *    apakah kasir menghabiskan waktu mencabut-colok router atau tidak.
 * 2. **Harga basi tidak boleh dipakai.** Ia tidak menimbulkan galat apa pun —
 *    kasir menjual, pembeli membayar, dan salahnya baru ketahuan berminggu
 *    kemudian.
 */

import { describe, expect, it } from 'vitest';
import {
  AMBANG_DIAM_MS,
  JEDA_MAKS_MS,
  jedaPercobaan,
  nilaiKoneksi,
  warnaKoneksi,
  type MasukanKoneksi,
} from './koneksi';
import {
  BATAS_UMUR_MS,
  cariBarcode,
  cariProduk,
  jam,
  nilaiKesegaran,
  siapLuring,
  type ProdukLokal,
} from './katalog';

const SEKARANG = 1_800_000_000_000;

const koneksi = (over: Partial<MasukanKoneksi> = {}): MasukanKoneksi => ({
  browserOnline: true,
  lastReachableAt: SEKARANG - 1_000,
  lastAttemptAt: SEKARANG - 1_000,
  lastAttemptOk: true,
  now: SEKARANG,
  ...over,
});

describe('keadaan sambungan', () => {
  it('peladen menjawab berarti daring', () => {
    const h = nilaiKoneksi(koneksi());
    expect(h.state).toBe('DARING');
    expect(h.queueing).toBe(false);
  });

  it('belum pernah mencoba berarti sedang memeriksa, bukan luring', () => {
    // Melaporkan "luring" sebelum sempat mencoba akan membuat kasir mengira
    // ada masalah padahal layarnya baru terbuka.
    const h = nilaiKoneksi(koneksi({ lastAttemptOk: null, lastReachableAt: null }));
    expect(h.state).toBe('MEMERIKSA');
    expect(h.queueing).toBe(false);
  });

  it('tidak ada jaringan berarti luring dan transaksi diantre', () => {
    const h = nilaiKoneksi(koneksi({ browserOnline: false }));
    expect(h.state).toBe('LURING');
    expect(h.queueing).toBe(true);
    expect(h.message).toContain('disimpan di mesin ini');
  });

  it('ada jaringan tetapi peladen tidak menjawab dibedakan sebagai TERBATAS', () => {
    /*
     * Inilah keadaan yang paling menyesatkan bila tidak dibedakan: router
     * menyala, langganan internetnya yang mati. Kasir perlu tahu masalahnya
     * bukan pada kabel di mejanya.
     */
    const h = nilaiKoneksi(koneksi({ browserOnline: true, lastAttemptOk: false }));
    expect(h.state).toBe('TERBATAS');
    expect(h.queueing).toBe(true);
    expect(h.message).toContain('peladen tidak menjawab');
  });

  it('peladen yang lama diam dianggap tidak stabil meski percobaan terakhir berhasil', () => {
    const h = nilaiKoneksi(
      koneksi({ lastReachableAt: SEKARANG - (AMBANG_DIAM_MS + 5_000) }),
    );
    expect(h.state).toBe('TERBATAS');
    expect(h.queueing).toBe(true);
  });

  it('tepat pada ambang diam masih dianggap daring', () => {
    const h = nilaiKoneksi(koneksi({ lastReachableAt: SEKARANG - AMBANG_DIAM_MS }));
    expect(h.state).toBe('DARING');
  });

  it('setiap keadaan punya kalimat yang menyebutkan akibatnya', () => {
    // Lencana berwarna tanpa kalimat tidak memberitahu kasir apa yang harus
    // dilakukannya.
    for (const m of [
      koneksi(),
      koneksi({ browserOnline: false }),
      koneksi({ lastAttemptOk: false }),
      koneksi({ lastAttemptOk: null }),
    ]) {
      expect(nilaiKoneksi(m).message.length).toBeGreaterThan(15);
    }
  });

  it('warna lencana berbeda untuk tiap keadaan', () => {
    expect(warnaKoneksi('DARING')).toBe('hijau');
    expect(warnaKoneksi('TERBATAS')).toBe('kuning');
    expect(warnaKoneksi('LURING')).toBe('merah');
    expect(warnaKoneksi('MEMERIKSA')).toBe('kelabu');
  });
});

describe('jeda percobaan ulang', () => {
  it('membesar bertahap', () => {
    expect(jedaPercobaan(1)).toBeLessThan(jedaPercobaan(3));
    expect(jedaPercobaan(3)).toBeLessThan(jedaPercobaan(5));
  });

  it('dibatasi supaya kasir tidak menunggu lama setelah peladen pulih', () => {
    // Tanpa batas, kegagalan berturut-turut semalaman membuat percobaan
    // berikutnya baru terjadi berjam-jam kemudian — padahal peladen sudah hidup.
    expect(jedaPercobaan(50)).toBe(JEDA_MAKS_MS);
  });

  it('tanpa kegagalan memakai jeda wajar, bukan nol', () => {
    expect(jedaPercobaan(0)).toBeGreaterThan(1_000);
  });
});

describe('kesegaran katalog', () => {
  it('salinan baru dianggap segar', () => {
    const h = nilaiKesegaran({ jenis: 'HARGA', syncedAt: SEKARANG - 60_000, now: SEKARANG });
    expect(h.level).toBe('SEGAR');
    expect(h.usable).toBe(true);
  });

  it('belum pernah disalin berarti tidak dapat dipakai', () => {
    const h = nilaiKesegaran({ jenis: 'PRODUK', syncedAt: null, now: SEKARANG });
    expect(h.level).toBe('KOSONG');
    expect(h.usable).toBe(false);
    expect(h.message).toContain('belum pernah disalin');
  });

  it('harga yang melewati batas TIDAK boleh dipakai', () => {
    /*
     * Aturan terpenting pada berkas ini. Harga basi tidak menimbulkan galat:
     * kasir menjual, pembeli membayar, struk tercetak — dan baru berminggu
     * kemudian ketahuan seluruh transaksi memakai harga bulan lalu.
     */
    const h = nilaiKesegaran({
      jenis: 'HARGA',
      syncedAt: SEKARANG - (BATAS_UMUR_MS.HARGA + 60_000),
      now: SEKARANG,
    });
    expect(h.level).toBe('BASI');
    expect(h.usable).toBe(false);
  });

  it('harga punya batas jauh lebih ketat daripada nama produk', () => {
    // Salah harga salah pada setiap transaksi; produk yang tidak ketemu
    // langsung disadari kasir dan dapat dicari menurut nama.
    expect(BATAS_UMUR_MS.HARGA).toBeLessThan(BATAS_UMUR_MS.PRODUK);
  });

  it('salinan setengah umur ditandai menua tetapi tetap dipakai', () => {
    const h = nilaiKesegaran({
      jenis: 'PRODUK',
      syncedAt: SEKARANG - BATAS_UMUR_MS.PRODUK * 0.7,
      now: SEKARANG,
    });
    expect(h.level).toBe('MENUA');
    expect(h.usable).toBe(true);
  });

  it('waktu salin di masa depan tidak menghasilkan umur negatif', () => {
    // Jam mesin kasir bisa salah setel. Umur negatif akan membuat salinan
    // tampak selalu segar.
    const h = nilaiKesegaran({ jenis: 'HARGA', syncedAt: SEKARANG + 60_000, now: SEKARANG });
    expect(h.ageMs).toBe(0);
    expect(h.usable).toBe(true);
  });

  it('satu jenis yang basi menghentikan kesiapan luring', () => {
    const h = siapLuring([
      nilaiKesegaran({ jenis: 'PRODUK', syncedAt: SEKARANG - 1000, now: SEKARANG }),
      nilaiKesegaran({
        jenis: 'HARGA',
        syncedAt: SEKARANG - (BATAS_UMUR_MS.HARGA + 1),
        now: SEKARANG,
      }),
    ]);
    expect(h.ready).toBe(false);
    expect(h.blockers).toHaveLength(1);
    expect(h.blockers[0].message).toContain('Harga');
  });

  it('seluruhnya segar berarti siap', () => {
    const h = siapLuring(
      (['PRODUK', 'HARGA', 'PAJAK'] as const).map((j) =>
        nilaiKesegaran({ jenis: j, syncedAt: SEKARANG - 1000, now: SEKARANG }),
      ),
    );
    expect(h.ready).toBe(true);
    expect(h.warnings).toEqual([]);
  });
});

describe('umur dalam kalimat', () => {
  it('menyebut menit, jam, dan hari sesuai besarnya', () => {
    expect(jam(30_000)).toContain('kurang dari semenit');
    expect(jam(15 * 60_000)).toBe('15 menit');
    expect(jam(3 * 3_600_000)).toBe('3 jam');
    expect(jam(2 * 86_400_000)).toBe('2 hari');
  });
});

describe('pencarian pada salinan lokal', () => {
  const produk: ProdukLokal[] = [
    {
      productId: 'P1',
      code: 'KOPI-01',
      name: 'Kopi Susu Gula Aren',
      sku: 'KS-001',
      uomId: 'U1',
      price: '18000',
      currencyCode: 'IDR',
      barcodes: ['8991234567890', '8990000000001'],
    },
    {
      productId: 'P2',
      code: 'TEH-01',
      name: 'Teh Manis',
      sku: 'TM-002',
      uomId: 'U1',
      price: '8000',
      currencyCode: 'IDR',
      barcodes: ['8991111111111'],
    },
  ];

  it('barcode utama ditemukan', () => {
    expect(cariBarcode(produk, '8991234567890')?.productId).toBe('P1');
  });

  it('barcode alternatif ditemukan sama saja', () => {
    // Pemindai tidak tahu bedanya, dan kasir tidak seharusnya perlu tahu.
    expect(cariBarcode(produk, '8990000000001')?.productId).toBe('P1');
  });

  it('barcode dengan spasi di ujung tetap ditemukan', () => {
    // Sebagian pemindai menambahkan spasi atau enter di akhir kode.
    expect(cariBarcode(produk, ' 8991111111111 ')?.productId).toBe('P2');
  });

  it('barcode yang tidak dikenal menghasilkan null, bukan produk pertama', () => {
    expect(cariBarcode(produk, '0000000000000')).toBeNull();
  });

  it('barcode kosong menghasilkan null', () => {
    expect(cariBarcode(produk, '   ')).toBeNull();
  });

  it('pencarian nama tidak peka huruf besar-kecil dan mencocokkan bagian', () => {
    expect(cariProduk(produk, 'susu').map((p) => p.productId)).toEqual(['P1']);
    expect(cariProduk(produk, 'KOPI').map((p) => p.productId)).toEqual(['P1']);
  });

  it('pencarian juga mencocokkan SKU dan kode', () => {
    expect(cariProduk(produk, 'TM-002').map((p) => p.productId)).toEqual(['P2']);
    expect(cariProduk(produk, 'teh-01').map((p) => p.productId)).toEqual(['P2']);
  });

  it('kunci terlalu pendek tidak mengembalikan seluruh katalog', () => {
    // Satu huruf akan mencocokkan hampir semuanya dan tidak menolong siapa pun.
    expect(cariProduk(produk, 'k')).toEqual([]);
  });
});
