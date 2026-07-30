import {
  LEGACY_EXPIRY_OPTIONS,
  parseLegacyChannelConfig,
  parseLegacyChannelEntry,
  resolveExpiryMinutes,
} from './esmartlink-channel.parser';

/**
 * Karakterisasi perilaku legacy dari `docs/input/SmartlinkChannelWindow.java`.
 * Test ini mengunci perilaku lama agar migrasi tidak mengubah semantik.
 */
describe('parseLegacyChannelEntry', () => {
  it('mengurai entri lengkap KODE:BIAYA:LABEL', () => {
    expect(parseLegacyChannelEntry('BCA_VA:4000:BCA Virtual Account')).toEqual({
      code: 'BCA_VA',
      adminFee: 4000,
      label: 'BCA Virtual Account',
    });
  });

  it('memakai kode sebagai label bila label tidak diberikan', () => {
    expect(parseLegacyChannelEntry('BNI_VA:4000')).toEqual({
      code: 'BNI_VA',
      adminFee: 4000,
      label: 'BNI_VA',
    });
  });

  it('memakai kode sebagai label bila label hanya berisi spasi', () => {
    expect(parseLegacyChannelEntry('BRI_VA:4000:   ')?.label).toBe('BRI_VA');
  });

  it('membuang segmen kosong seperti StringUtils.split legacy', () => {
    // "A::B" pada legacy menjadi ["A","B"], sehingga B dibaca sebagai biaya.
    expect(parseLegacyChannelEntry('MANDIRI_VA::5000')).toEqual({
      code: 'MANDIRI_VA',
      adminFee: 5000,
      label: 'MANDIRI_VA',
    });
  });

  it('menerima biaya admin desimal', () => {
    expect(parseLegacyChannelEntry('QRIS:0.7:QRIS')?.adminFee).toBeCloseTo(0.7);
  });

  it('menerima biaya admin nol', () => {
    expect(parseLegacyChannelEntry('GRATIS:0:Tanpa biaya')?.adminFee).toBe(0);
  });

  it('mengabaikan spasi di sekitar segmen', () => {
    expect(parseLegacyChannelEntry('  OVO : 2500 : OVO Wallet  ')).toEqual({
      code: 'OVO',
      adminFee: 2500,
      label: 'OVO Wallet',
    });
  });

  it.each([
    ['string kosong', ''],
    ['hanya spasi', '   '],
    ['tanpa biaya', 'HANYA_KODE'],
    ['biaya bukan angka', 'DANA:gratis:DANA'],
    ['hanya pemisah', ':::'],
  ])('mengembalikan null untuk %s', (_label, input) => {
    expect(parseLegacyChannelEntry(input)).toBeNull();
  });
});

describe('parseLegacyChannelConfig', () => {
  it('mengurai beberapa channel yang dipisah titik koma', () => {
    const result = parseLegacyChannelConfig(
      'BCA_VA:4000:BCA Virtual Account;BNI_VA:4000:BNI Virtual Account;QRIS:0.7:QRIS',
    );
    expect(result.channels.map((channel) => channel.code)).toEqual(['BCA_VA', 'BNI_VA', 'QRIS']);
    expect(result.skipped).toHaveLength(0);
  });

  it('melewati entri tidak valid tanpa menggagalkan seluruh daftar', () => {
    const result = parseLegacyChannelConfig('BCA_VA:4000:BCA;RUSAK;QRIS:0.7:QRIS');
    expect(result.channels.map((channel) => channel.code)).toEqual(['BCA_VA', 'QRIS']);
    expect(result.skipped).toEqual([{ raw: 'RUSAK', reason: 'ENTRI_TIDAK_VALID' }]);
  });

  it('mengabaikan pemisah berlebih dan titik koma di ujung', () => {
    const result = parseLegacyChannelConfig(';;BCA_VA:4000:BCA;;');
    expect(result.channels).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it.each([null, undefined, ''])('mengembalikan hasil kosong untuk konfigurasi %s', (input) => {
    const result = parseLegacyChannelConfig(input);
    expect(result.channels).toEqual([]);
    expect(result.skipped).toEqual([]);
  });
});

describe('resolveExpiryMinutes', () => {
  it('memetakan seluruh pilihan legacy ke menit', () => {
    expect(LEGACY_EXPIRY_OPTIONS).toHaveLength(9);
    expect(resolveExpiryMinutes('MIN_15')).toBe(15);
    expect(resolveExpiryMinutes('HOUR_24')).toBe(1440);
    expect(resolveExpiryMinutes('MONTH_1')).toBe(43200);
  });

  it('memakai nilai bawaan 24 jam bila kode tidak diberikan', () => {
    expect(resolveExpiryMinutes(undefined)).toBe(1440);
  });

  it('memakai nilai bawaan untuk kode yang tidak dikenali', () => {
    expect(resolveExpiryMinutes('TIDAK_ADA')).toBe(1440);
    expect(resolveExpiryMinutes('TIDAK_ADA', 30)).toBe(30);
  });

  it('menaikkan menit secara monoton sesuai urutan pilihan', () => {
    const minutes = LEGACY_EXPIRY_OPTIONS.map((option) => option.minutes);
    for (let i = 1; i < minutes.length; i += 1) {
      expect(minutes[i]).toBeGreaterThan(minutes[i - 1]);
    }
  });
});
