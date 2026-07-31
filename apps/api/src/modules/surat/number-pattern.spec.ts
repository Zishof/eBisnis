import {
  periodKeyFor,
  previewPattern,
  renderPattern,
  validatePattern,
} from './number-pattern';

const JULI_2026 = new Date('2026-07-15T00:00:00Z');

describe('validatePattern', () => {
  it('menerima pola yang lazim pada surat resmi Indonesia', () => {
    const hasil = validatePattern('{NOMOR}/{KODE_KLASIFIKASI}/{BULAN_ROMAWI}/{TAHUN}');
    expect(hasil.valid).toBe(true);
    expect(hasil.errors).toEqual([]);
  });

  it('menolak penanda salah ketik', () => {
    /*
     * Inilah alasan daftar penanda dibuat tertutup. Penanda salah ketik yang
     * dibiarkan menjadi teks apa adanya akan menghasilkan nomor surat resmi
     * yang memuat "{TAHNU}" — dan nomor itu sudah terlanjur keluar sebelum ada
     * yang menyadarinya.
     */
    const hasil = validatePattern('{NOMOR}/{TAHNU}');
    expect(hasil.valid).toBe(false);
    expect(hasil.errors[0]).toContain('{TAHNU}');
    // Pesannya menyebutkan yang tersedia, supaya penulisnya tidak menebak.
    expect(hasil.errors[0]).toContain('{TAHUN}');
  });

  it('menolak pola tanpa {NOMOR}', () => {
    // Tanpa {NOMOR} setiap surat memperoleh nomor yang sama persis.
    const hasil = validatePattern('SK/{TAHUN}');
    expect(hasil.valid).toBe(false);
    expect(hasil.errors.some((e) => e.includes('{NOMOR}'))).toBe(true);
  });

  it('menolak kurung yang tidak berpasangan', () => {
    expect(validatePattern('{NOMOR}/{TAHUN').valid).toBe(false);
  });

  it('menolak pola kosong', () => {
    expect(validatePattern('   ').valid).toBe(false);
  });

  it('menyebut SELURUH penanda yang salah, bukan hanya yang pertama', () => {
    // Melaporkan satu per satu memaksa penulisnya memperbaiki lalu mencoba
    // lagi berkali-kali.
    const hasil = validatePattern('{NOMOR}/{TAHNU}/{BLN}');
    expect(hasil.errors.filter((e) => e.includes('tidak dikenal')).length).toBe(2);
  });
});

describe('renderPattern', () => {
  it('menyusun nomor lengkap', () => {
    expect(
      renderPattern('{NOMOR}/{KODE_KLASIFIKASI}/{BULAN_ROMAWI}/{TAHUN}', {
        number: 7,
        padding: 3,
        date: JULI_2026,
        classificationCode: 'SK',
      }),
    ).toBe('007/SK/VII/2026');
  });

  it('memakai angka Romawi yang benar untuk setiap bulan', () => {
    const romawi = [
      'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
    ];
    romawi.forEach((diharap, index) => {
      const tanggal = new Date(2026, index, 15);
      expect(renderPattern('{NOMOR}-{BULAN_ROMAWI}', { number: 1, padding: 1, date: tanggal })).toBe(
        `1-${diharap}`,
      );
    });
  });

  it('memadkan nomor menurut padding', () => {
    expect(renderPattern('{NOMOR}', { number: 5, padding: 5, date: JULI_2026 })).toBe('00005');
    expect(renderPattern('{NOMOR}', { number: 5, padding: 1, date: JULI_2026 })).toBe('5');
  });

  it('tidak memotong nomor yang melampaui padding', () => {
    // Padding adalah minimum, bukan maksimum. Memotongnya akan membuat surat
    // ke-10000 bernomor sama dengan surat ke-1.
    expect(renderPattern('{NOMOR}', { number: 12345, padding: 3, date: JULI_2026 })).toBe('12345');
  });

  it('penanda tanpa nilai menjadi kosong, bukan "undefined"', () => {
    // Nomor surat resmi yang memuat kata "undefined" adalah cacat yang terbawa
    // ke luar organisasi.
    const hasil = renderPattern('{NOMOR}/{KODE_UNIT}/{TAHUN}', {
      number: 1,
      padding: 3,
      date: JULI_2026,
    });
    expect(hasil).toBe('001//2026');
    expect(hasil).not.toContain('undefined');
    expect(hasil).not.toContain('null');
  });

  it('TAHUN2 memakai dua angka terakhir', () => {
    expect(renderPattern('{NOMOR}/{TAHUN2}', { number: 1, padding: 1, date: JULI_2026 })).toBe(
      '1/26',
    );
  });

  it('teks di luar penanda dipertahankan apa adanya', () => {
    expect(
      renderPattern('SK-{NOMOR}/DIR/{TAHUN}', { number: 9, padding: 2, date: JULI_2026 }),
    ).toBe('SK-09/DIR/2026');
  });
});

describe('periodKeyFor', () => {
  it('YEARLY berganti kunci tiap tahun', () => {
    expect(periodKeyFor('YEARLY', new Date('2026-12-31T23:00:00'))).toBe('2026');
    expect(periodKeyFor('YEARLY', new Date('2027-01-01T01:00:00'))).toBe('2027');
  });

  it('MONTHLY berganti kunci tiap bulan', () => {
    expect(periodKeyFor('MONTHLY', new Date(2026, 6, 15))).toBe('2026-07');
    expect(periodKeyFor('MONTHLY', new Date(2026, 7, 1))).toBe('2026-08');
  });

  it('MONTHLY memadkan bulan satu angka', () => {
    // Tanpa padding, '2026-1' dan '2026-10' akan berurutan salah bila kelak
    // diurutkan sebagai teks.
    expect(periodKeyFor('MONTHLY', new Date(2026, 0, 5))).toBe('2026-01');
  });

  it('NEVER memakai satu kunci selamanya', () => {
    expect(periodKeyFor('NEVER', new Date(2026, 0, 1))).toBe('ALL');
    expect(periodKeyFor('NEVER', new Date(2030, 11, 31))).toBe('ALL');
  });

  it('nilai tak dikenal diperlakukan seperti NEVER, bukan melempar galat', () => {
    // Menolak menerbitkan nomor karena satu kolom konfigurasi bernilai aneh
    // akan menghentikan pekerjaan orang. Nomor yang berlanjut selamanya tetap
    // nomor yang sah.
    expect(periodKeyFor('ENTAH_APA', JULI_2026)).toBe('ALL');
  });

  it('kunci muat pada kolom varchar(16)', () => {
    for (const periode of ['NEVER', 'YEARLY', 'MONTHLY']) {
      expect(periodKeyFor(periode, JULI_2026).length).toBeLessThanOrEqual(16);
    }
  });
});

describe('previewPattern', () => {
  it('pratinjau sama bentuknya dengan nomor yang kelak terbit', () => {
    const pola = '{NOMOR}/{KODE_KLASIFIKASI}/{BULAN_ROMAWI}/{TAHUN}';
    const pratinjau = previewPattern(pola, 3, JULI_2026, 'SK', 'HO');
    const sebenarnya = renderPattern(pola, {
      number: 1,
      padding: 3,
      date: JULI_2026,
      classificationCode: 'SK',
      unitCode: 'HO',
    });
    expect(pratinjau).toBe(sebenarnya);
  });
});
