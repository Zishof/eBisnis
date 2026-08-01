/**
 * Pengujian registri modul pendidikan.
 *
 * Yang diuji di sini seluruhnya bersifat **permanen bila salah**: username tenant
 * tidak dapat diubah setelah provisioning, dan schema yang sudah dibuat berisi
 * data. Tidak ada satu pun cacat di berkas ini yang dapat diperbaiki belakangan
 * dengan menyunting satu baris.
 */

import {
  EDUCATION_COMMON_MODULE,
  EDUCATION_VERTICAL_CODES,
  MAX_TENANT_USERNAME_LENGTH,
  PAKET_PENDIDIKAN,
  PG_IDENTIFIER_MAX_BYTES,
  bacaKodeVertical,
  bangunNamaSchema,
  modulUntukPaket,
  pastikanUsernameTenant,
  periksaUsernameTenant,
} from './education-module.registry';

describe('kode modul pendidikan', () => {
  it('menerima ejaan canonical', () => {
    for (const kode of EDUCATION_VERTICAL_CODES) {
      expect(bacaKodeVertical(kode)).toEqual({ valid: true, code: kode });
    }
  });

  it('MENOLAK salah eja, dan tidak memperbaikinya diam-diam', () => {
    /*
     * Aturan terpenting pada berkas ini.
     *
     * Memperbaiki `escholl` menjadi `eschool` secara diam-diam menyembunyikan
     * salah ketik pada dokumen kontrak: yang tertulis satu, yang terbentuk lain,
     * dan tidak ada yang menyadarinya sampai seseorang mencocokkan lampiran
     * kontrak dengan tagihan.
     */
    const hasil = bacaKodeVertical('escholl');
    expect(hasil.valid).toBe(false);
    expect(hasil.code).toBeUndefined();
    // Maksudnya tetap disebut, supaya yang salah dapat diperbaiki di sumbernya.
    expect(hasil.maksudnya).toBe('eschool');
    expect(hasil.message).toContain('eschool');
  });

  it('seluruh salah eja yang dikenal ditolak', () => {
    for (const salah of ['escholl', 'eschol', 'e_school', 'epeantren', 'epesantrean', 'ekampus']) {
      expect(bacaKodeVertical(salah).valid).toBe(false);
    }
  });

  it('kode yang sama sekali asing ditolak dengan menyebut yang tersedia', () => {
    const hasil = bacaKodeVertical('emadrasah');
    expect(hasil.valid).toBe(false);
    expect(hasil.maksudnya).toBeUndefined();
    expect(hasil.message).toContain('ecampus');
  });

  it('spasi dan huruf besar dinormalisasi, sebab keduanya bukan salah eja', () => {
    expect(bacaKodeVertical('  ESCHOOL  ')).toEqual({ valid: true, code: 'eschool' });
  });

  it('kosong ditolak', () => {
    expect(bacaKodeVertical('').valid).toBe(false);
  });
});

describe('pembentukan nama schema', () => {
  it('modul inti memakai username apa adanya', () => {
    /*
     * Schema inti tenant yang sudah berjalan bernama `{username}` saja sejak
     * Versi 5. Menambahkan `_core` berarti mengganti nama schema berisi data
     * pada setiap tenant yang hidup — bukan migration additive.
     */
    const hasil = bangunNamaSchema('joniutama', 'core');
    expect(hasil.schemaName).toBe('joniutama');
    expect(hasil.auditSchemaName).toBe('joniutama__audit');
  });

  it('modul pendidikan memakai akhiran', () => {
    expect(bangunNamaSchema('joniutama', 'eschool').schemaName).toBe('joniutama_eschool');
    expect(bangunNamaSchema('joniutama', 'ecampus').schemaName).toBe('joniutama_ecampus');
    expect(bangunNamaSchema('joniutama', 'epesantren').schemaName).toBe('joniutama_epesantren');
    expect(bangunNamaSchema('joniutama', 'education').schemaName).toBe('joniutama_education');
  });

  it('nama AUDIT yang diperiksa terhadap batas, bukan nama schema-nya', () => {
    /*
     * Nama audit selalu tujuh karakter lebih panjang, sehingga ialah yang lebih
     * dahulu menabrak batas 63. Memeriksa nama schema saja meloloskan pasangan
     * yang schema-nya muat tetapi audit-nya terpotong — dan PostgreSQL memotong
     * TANPA GALAT, sehingga dua tenant dapat berakhir pada schema audit yang sama.
     */
    // 46 huruf + '_epesantren' (11) = 57 → muat; + '__audit' (7) = 64 → TIDAK muat.
    const username = 'a'.repeat(46);
    const hasil = bangunNamaSchema(username, 'epesantren');

    expect(hasil.schemaName).toBeUndefined();
    expect(hasil.valid).toBe(false);
    expect(hasil.message).toContain('63');
  });

  it('username sepanjang batas resmi muat untuk modul terpanjang', () => {
    const username = 'a'.repeat(MAX_TENANT_USERNAME_LENGTH);
    const hasil = bangunNamaSchema(username, 'epesantren');

    expect(hasil.valid).toBe(true);
    expect(Buffer.byteLength(hasil.auditSchemaName!, 'utf8')).toBeLessThanOrEqual(
      PG_IDENTIFIER_MAX_BYTES,
    );
  });

  it('nama yang dicadangkan sistem ditolak', () => {
    expect(bangunNamaSchema('public', 'core').valid).toBe(false);
    expect(bangunNamaSchema('platform', 'core').valid).toBe(false);
  });
});

describe('username tenant', () => {
  it('batas panjang ditegakkan saat dibuat, bukan saat dipakai', () => {
    /*
     * Sebelumnya yang ada hanyalah batas 48 karakter pada nama schema akhir.
     * Username 40 karakter lolos pada hari pendaftaran, lalu gagal berbulan-bulan
     * kemudian ketika vertical ketiga diprovision — pada username yang sudah
     * tidak dapat diubah.
     */
    expect(periksaUsernameTenant('ab').valid).toBe(false);
    expect(periksaUsernameTenant('abc').valid).toBe(true);
    expect(periksaUsernameTenant('a'.repeat(MAX_TENANT_USERNAME_LENGTH)).valid).toBe(true);
    expect(periksaUsernameTenant('a'.repeat(MAX_TENANT_USERNAME_LENGTH + 1)).valid).toBe(false);
  });

  it('pesan penolakan menyebutkan bahwa username tidak dapat diubah', () => {
    const hasil = periksaUsernameTenant('a'.repeat(40));
    expect(hasil.message).toContain('tidak dapat diubah');
  });

  it('bentuk yang tidak sah ditolak', () => {
    for (const buruk of ['1abc', 'Abc', 'a-b-c', 'a b c', '_abc', 'abc!']) {
      expect(periksaUsernameTenant(buruk).valid).toBe(false);
    }
  });

  it('username yang sama dengan kode modul ditolak', () => {
    // `ecampus` sebagai username membuat schema intinya bernama `ecampus`, yang
    // bertabrakan dengan konvensi penamaan modul.
    for (const kode of [...EDUCATION_VERTICAL_CODES, EDUCATION_COMMON_MODULE]) {
      expect(periksaUsernameTenant(kode).valid).toBe(false);
    }
  });

  it('nama sistem ditolak', () => {
    expect(periksaUsernameTenant('platform').valid).toBe(false);
    expect(periksaUsernameTenant('postgres').valid).toBe(false);
  });

  it('pastikanUsernameTenant melempar untuk yang tidak sah', () => {
    expect(() => pastikanUsernameTenant('a')).toThrow();
    expect(pastikanUsernameTenant('joniutama')).toBe('joniutama');
  });
});

describe('paket pendidikan', () => {
  it('tujuh kombinasi sesuai BRD', () => {
    expect(Object.keys(PAKET_PENDIDIKAN)).toHaveLength(7);
  });

  it('kernel bersama selalu lebih dahulu', () => {
    /*
     * Vertical merujuk tabel kernel. Urutan terbalik membuat migration vertical
     * gagal pada foreign key yang belum ada — kegagalan di tengah provisioning,
     * saat tenant sudah menunggu.
     */
    for (const paket of Object.keys(PAKET_PENDIDIKAN)) {
      expect(modulUntukPaket(paket)[0]).toBe(EDUCATION_COMMON_MODULE);
    }
  });

  it('paket satu vertical menghasilkan dua modul', () => {
    expect(modulUntukPaket('ESCHOOL_ONLY')).toEqual(['education', 'eschool']);
  });

  it('paket lengkap menghasilkan empat modul', () => {
    expect(modulUntukPaket('ALL_EDUCATION_VERTICALS')).toEqual([
      'education',
      'ecampus',
      'eschool',
      'epesantren',
    ]);
  });

  it('paket asing ditolak, bukan menghasilkan daftar kosong', () => {
    // Daftar kosong akan lolos provisioning tanpa membuat schema apa pun, dan
    // tenant berakhir aktif tanpa satu pun layar pendidikan.
    expect(() => modulUntukPaket('ESCHOOL')).toThrow();
    expect(() => modulUntukPaket('')).toThrow();
  });
});
