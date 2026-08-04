/**
 * Pengujian validasi aturan diskon.
 *
 * Aturan diskon disunting pengguna tenant, dan yang tersimpan salah tidak
 * menghasilkan galat: ia hanya menjadi harga yang lebih murah pada setiap
 * transaksi sampai seseorang menyadarinya dari laporan — atau tidak menyadarinya
 * sama sekali.
 */

import { validasiAturanDiskon, type MasukanAturanDiskon } from './pos-promotion-validasi';

const OUTLET = '11111111-1111-4111-8111-111111111111';
const PRODUK = '22222222-2222-4222-8222-222222222222';
const KATEGORI = '33333333-3333-4333-8333-333333333333';

const sah: MasukanAturanDiskon = {
  code: 'KOPI10',
  name: 'Diskon Kopi 10%',
  benefitType: 'PERCENT',
  benefitValue: 10,
};

function galatDari(ubah: Partial<MasukanAturanDiskon>): string[] {
  return validasiAturanDiskon({ ...sah, ...ubah }).galat;
}

describe('aturan yang sah', () => {
  it('masukan minimum diterima dan dibersihkan', () => {
    const { galat, bersih } = validasiAturanDiskon(sah);
    expect(galat).toEqual([]);
    expect(bersih).toMatchObject({
      code: 'KOPI10',
      name: 'Diskon Kopi 10%',
      benefitType: 'PERCENT',
      benefitValue: 10,
      scopeType: 'TENANT',
      scopeId: null,
      priority: 100,
      isActive: true,
    });
  });

  it('kode dirapikan menjadi huruf kapital, nama dirapikan spasinya', () => {
    const { bersih } = validasiAturanDiskon({ ...sah, code: ' kopi10 ', name: 'Diskon   Kopi' });
    expect(bersih!.code).toBe('KOPI10');
    expect(bersih!.name).toBe('Diskon Kopi');
  });
});

describe('nilai potongan', () => {
  it('persen di atas 100 DITOLAK', () => {
    // Menyerahkan uang kepada pembeli.
    expect(galatDari({ benefitValue: 101 })).toContainEqual(
      expect.stringContaining('tidak boleh melebihi 100%'),
    );
  });

  it('persen tepat 100 diterima', () => {
    // Barang gratis memang ada — "beli satu gratis satu" ditulis begitu.
    expect(galatDari({ benefitValue: 100 })).toEqual([]);
  });

  it('persen nol ditolak dengan saran menonaktifkan', () => {
    expect(galatDari({ benefitValue: 0 })).toContainEqual(
      expect.stringContaining('Nonaktifkan aturannya'),
    );
  });

  it('nilai negatif ditolak', () => {
    expect(galatDari({ benefitValue: -5 })).toContainEqual(
      expect.stringContaining('tidak boleh negatif'),
    );
  });

  it('nominal tetap boleh melebihi 100', () => {
    // Rp 100.000 bukan 100%.
    expect(galatDari({ benefitType: 'AMOUNT', benefitValue: 100_000 })).toEqual([]);
  });

  it('batas potongan pada nominal tetap ditolak', () => {
    /*
     * Bukan sekadar mubazir: dua angka yang menyatakan hal yang sama akan
     * berselisih cepat atau lambat, dan yang menang bukan yang diharapkan.
     */
    expect(
      galatDari({ benefitType: 'AMOUNT', benefitValue: 5000, maxDiscountAmount: 3000 }),
    ).toContainEqual(expect.stringContaining('hanya berlaku untuk diskon persen'));
  });

  it('batas potongan pada persen diterima', () => {
    expect(galatDari({ maxDiscountAmount: 25_000 })).toEqual([]);
  });
});

describe('lingkup', () => {
  it('lingkup outlet TANPA id ditolak', () => {
    /*
     * Aturan seperti itu tersimpan, tampak aktif pada daftar, dan tidak pernah
     * berlaku sekali pun. Tidak ada galat yang muncul; yang muncul hanya
     * pertanyaan "kenapa promosinya tidak jalan".
     */
    expect(galatDari({ scopeType: 'OUTLET' })).toContainEqual(
      expect.stringContaining('wajib menyebut outlet atau brand'),
    );
    expect(galatDari({ scopeType: 'OUTLET', scopeId: 'bukan-uuid' })).toHaveLength(1);
  });

  it('lingkup outlet dengan id diterima', () => {
    const { galat, bersih } = validasiAturanDiskon({
      ...sah,
      scopeType: 'OUTLET',
      scopeId: OUTLET,
    });
    expect(galat).toEqual([]);
    expect(bersih!.scopeId).toBe(OUTLET);
  });

  it('id pada lingkup tenant DIKOSONGKAN, bukan ditolak', () => {
    // Lingkup tenant memang berlaku di mana pun; id yang tertinggal hanya
    // membingungkan siapa pun yang membaca barisnya.
    const { galat, bersih } = validasiAturanDiskon({ ...sah, scopeType: 'TENANT', scopeId: OUTLET });
    expect(galat).toEqual([]);
    expect(bersih!.scopeId).toBeNull();
  });

  it('lingkup yang tidak dikenal ditolak', () => {
    expect(galatDari({ scopeType: 'WILAYAH' })).toContainEqual(
      expect.stringContaining('harus TENANT, OUTLET, atau BRAND'),
    );
  });
});

describe('masa berlaku', () => {
  it('selesai mendahului mulai ditolak', () => {
    expect(
      galatDari({ validFrom: '2026-06-01T00:00:00Z', validUntil: '2026-05-01T00:00:00Z' }),
    ).toContainEqual(expect.stringContaining('mendahului'));
  });

  it('tanggal yang tidak terbaca ditolak', () => {
    expect(galatDari({ validFrom: 'kemarin' })).toContainEqual(
      expect.stringContaining('tidak dapat dibaca'),
    );
  });

  it('kosong berarti permanen', () => {
    expect(galatDari({ validFrom: null, validUntil: '' })).toEqual([]);
  });
});

describe('hari dan jam', () => {
  it('hari di luar 1..7 ditolak', () => {
    expect(galatDari({ validDays: [0] })).toContainEqual(expect.stringContaining('1 (Senin)'));
    expect(galatDari({ validDays: [8] })).toHaveLength(1);
  });

  it('hari kembar dirapikan dan diurutkan', () => {
    const { bersih } = validasiAturanDiskon({ ...sah, validDays: [3, 1, 3] });
    expect(bersih!.validDays).toEqual([1, 3]);
  });

  it('daftar hari kosong berarti setiap hari', () => {
    const { bersih } = validasiAturanDiskon({ ...sah, validDays: [] });
    expect(bersih!.validDays).toBeNull();
  });

  it('jam harus HH:MM', () => {
    expect(galatDari({ validTimeFrom: '25:00', validTimeTo: '26:00' })).toHaveLength(2);
  });

  it('jam mulai tanpa jam selesai ditolak', () => {
    /*
     * Mesinnya dapat menjalankannya, tetapi hampir selalu bukan yang dimaksud:
     * "mulai 17.00" tanpa jam selesai berarti berlaku sampai tengah malam, dan
     * itu perlu ditulis tegas, bukan disimpulkan.
     */
    expect(galatDari({ validTimeFrom: '17:00' })).toContainEqual(
      expect.stringContaining('berdua'),
    );
  });

  it('jam yang melewati tengah malam diterima', () => {
    // Shift malam. Mesin pemilihnya memang menangani jendela yang membalik.
    expect(galatDari({ validTimeFrom: '22:00', validTimeTo: '02:00' })).toEqual([]);
  });

  it('jam dilengkapi menjadi HH:MM:SS', () => {
    const { bersih } = validasiAturanDiskon({ ...sah, validTimeFrom: '09:00', validTimeTo: '17:00' });
    expect(bersih!.validTimeFrom).toBe('09:00:00');
  });
});

describe('target produk', () => {
  it('produk dan kategori sekaligus ditolak', () => {
    expect(
      galatDari({ targets: [{ productId: PRODUK, productCategoryId: KATEGORI }] }),
    ).toContainEqual(expect.stringContaining('produk ATAU kategori'));
  });

  it('baris kosong ditolak', () => {
    expect(galatDari({ targets: [{}] })).toHaveLength(1);
  });

  it('id yang bukan uuid ditolak', () => {
    expect(galatDari({ targets: [{ productId: 'kopi' }] })).toContainEqual(
      expect.stringContaining('tidak sah'),
    );
  });

  it('daftar yang HANYA berisi pengecualian ditolak', () => {
    /*
     * Mesinnya memperlakukan "tanpa daftar cakup" sebagai berlaku untuk semua,
     * lalu setiap pengecualian menguranginya — sehingga aturan seperti ini
     * sebenarnya berarti "semua KECUALI ini". Mungkin memang dimaksud, tetapi
     * lebih sering salah paham, jadi dinyatakan tegas alih-alih ditebak.
     */
    expect(
      galatDari({ targets: [{ productId: PRODUK, isExclusion: true }] }),
    ).toContainEqual(expect.stringContaining('hanya berisi pengecualian'));
  });

  it('cakupan beserta pengecualiannya diterima', () => {
    expect(
      galatDari({
        targets: [
          { productCategoryId: KATEGORI },
          { productId: PRODUK, isExclusion: true },
        ],
      }),
    ).toEqual([]);
  });
});

describe('kode dan nama', () => {
  it('kode wajib dan berpola', () => {
    expect(galatDari({ code: '' })).toContainEqual(expect.stringContaining('Kode aturan'));
    expect(galatDari({ code: 'a b' })).toHaveLength(1);
    expect(galatDari({ code: 'K' })).toHaveLength(1);
  });

  it('nama terlalu pendek ditolak', () => {
    expect(galatDari({ name: 'ab' })).toContainEqual(expect.stringContaining('3–160'));
  });
});

describe('kuota dan prioritas', () => {
  it('kuota harus bilangan bulat minimal satu', () => {
    expect(galatDari({ usageLimit: 0 })).toHaveLength(1);
    expect(galatDari({ usageLimit: 1.5 })).toHaveLength(1);
    expect(galatDari({ usageLimit: 10 })).toEqual([]);
  });

  it('prioritas negatif ditolak', () => {
    expect(galatDari({ priority: -1 })).toHaveLength(1);
  });
});

describe('mengumpulkan galat', () => {
  it('seluruh masalah dilaporkan sekaligus, bukan satu per satu', () => {
    /*
     * Penyunting yang memperbaiki satu galat lalu menemukan galat berikutnya
     * akan menyerah pada percobaan ketiga — dan aturan diskon yang tidak jadi
     * disimpan berarti promosi yang tidak jadi berjalan.
     */
    const galat = galatDari({ code: '', name: 'x', benefitValue: 200, scopeType: 'OUTLET' });
    expect(galat.length).toBeGreaterThanOrEqual(4);
  });
});
