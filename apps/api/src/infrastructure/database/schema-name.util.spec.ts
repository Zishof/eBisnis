import {
  RESERVED_SCHEMA_NAMES,
  SCHEMA_NAME_REGEX,
  assertValidSchemaName,
  normalizeSchemaName,
  quoteIdentifier,
  validateSchemaName,
} from './schema-name.util';

describe('normalizeSchemaName', () => {
  it('mengubah huruf besar menjadi kecil', () => {
    expect(normalizeSchemaName('TokoMaju')).toBe('tokomaju');
  });

  it('mengganti spasi dan tanda hubung dengan garis bawah', () => {
    expect(normalizeSchemaName('Toko Maju-Jaya')).toBe('toko_maju_jaya');
  });

  it('membuang karakter yang tidak diizinkan', () => {
    expect(normalizeSchemaName('toko!@#maju')).toBe('tokomaju');
  });

  it('menggabungkan garis bawah berulang dan membuang di ujung', () => {
    expect(normalizeSchemaName('__toko___maju__')).toBe('toko_maju');
  });

  it('mentransliterasi huruf beraksen', () => {
    expect(normalizeSchemaName('Café Kopi')).toBe('cafe_kopi');
  });

  it('menghasilkan nama yang lolos pola resmi untuk masukan wajar', () => {
    for (const input of ['Toko Maju', 'PT Sumber Rejeki', 'warung-99', 'Cafe   Kopi']) {
      expect(SCHEMA_NAME_REGEX.test(normalizeSchemaName(input))).toBe(true);
    }
  });

  it('menghasilkan string kosong untuk masukan tanpa karakter valid', () => {
    expect(normalizeSchemaName('!!!')).toBe('');
    expect(normalizeSchemaName('')).toBe('');
  });
});

describe('validateSchemaName', () => {
  it('menerima nama yang valid dan menghasilkan nama schema audit', () => {
    const result = validateSchemaName('toko_maju');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('toko_maju');
    expect(result.auditName).toBe('toko_maju__audit');
  });

  it('menolak nama yang terlalu pendek', () => {
    const result = validateSchemaName('ab');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INVALID_SCHEMA_NAME');
  });

  it('menolak nama yang melebihi 48 karakter setelah normalisasi', () => {
    expect(validateSchemaName('a'.repeat(60)).valid).toBe(false);
  });

  it('menolak nama yang tidak diawali huruf', () => {
    expect(validateSchemaName('123toko').valid).toBe(false);
  });

  it('selalu menolak awalan pg_ meskipun di-whitelist', () => {
    const result = validateSchemaName('pg_catalog', { allowReserved: ['pg_catalog'] });
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('RESERVED_SCHEMA_NAME');
  });

  it('menolak seluruh nama schema yang direservasi', () => {
    for (const reserved of ['public', 'platform', 'demo', 'postgres', 'information_schema']) {
      expect(RESERVED_SCHEMA_NAMES.has(reserved)).toBe(true);
      expect(validateSchemaName(reserved).valid).toBe(false);
    }
  });

  it('mengizinkan nama sistem hanya bila di-whitelist eksplisit', () => {
    // Sandbox `demo` diprovision internal, bukan dari input pengguna.
    expect(validateSchemaName('demo').valid).toBe(false);
    expect(validateSchemaName('demo', { allowReserved: ['demo'] }).valid).toBe(true);
  });

  it('menolak nama yang schema auditnya menabrak nama reserved', () => {
    // `platform` sudah tertutup di atas; kasus ini menguji jalur auditName.
    const result = validateSchemaName('platform');
    expect(result.valid).toBe(false);
  });

  it('memberi saran alternatif ketika nama tidak dapat dipakai', () => {
    const result = validateSchemaName('public');
    expect(result.valid).toBe(false);
    expect(result.suggestions?.length ?? 0).toBeGreaterThan(0);
    for (const suggestion of result.suggestions ?? []) {
      expect(SCHEMA_NAME_REGEX.test(suggestion)).toBe(true);
      expect(RESERVED_SCHEMA_NAMES.has(suggestion)).toBe(false);
    }
  });

  it('menghormati sufiks audit kustom', () => {
    expect(validateSchemaName('toko_maju', '_log').auditName).toBe('toko_maju_log');
  });
});

describe('assertValidSchemaName', () => {
  it('mengembalikan nama ternormalisasi untuk masukan valid', () => {
    expect(assertValidSchemaName('Toko Maju')).toBe('toko_maju');
  });

  it('melempar AppError untuk masukan tidak valid', () => {
    expect(() => assertValidSchemaName('public')).toThrow();
  });
});

describe('quoteIdentifier', () => {
  it('mengapit identifier dengan tanda kutip ganda', () => {
    expect(quoteIdentifier('toko_maju')).toBe('"toko_maju"');
  });

  it('menerima identifier schema audit', () => {
    expect(quoteIdentifier('toko_maju__audit')).toBe('"toko_maju__audit"');
  });

  it('menolak identifier yang mengandung upaya injeksi, bukan meng-escape-nya', () => {
    // Nama schema TIDAK pernah berasal dari request; identifier tak valid
    // adalah kesalahan program sehingga harus gagal keras.
    expect(() => quoteIdentifier('toko"; DROP SCHEMA platform; --')).toThrow();
    expect(() => quoteIdentifier('Toko')).toThrow();
    expect(() => quoteIdentifier('')).toThrow();
  });
});
