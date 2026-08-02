/**
 * Pengujian aturan mata pelajaran, komponen nilai, skala huruf, dan nilai.
 */

import {
  cariHurufMutu,
  validasiKomponenNilai,
  validasiMataPelajaran,
  validasiNilai,
  validasiSkalaHuruf,
} from './pesantren-nilai';

describe('validasi mata pelajaran', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiMataPelajaran({ code: 'FIQH', nama: 'Fikih' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiMataPelajaran({}).map((g) => g.field).sort()).toEqual(['code', 'nama'].sort());
  });
});

describe('validasi komponen nilai', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiKomponenNilai({ kode: 'UTS', nama: 'UTS', bobotPersen: 30 })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiKomponenNilai({}).map((g) => g.field).sort()).toEqual(['bobotPersen', 'kode', 'nama'].sort());
  });

  it('bobot harus antara 1 dan 100', () => {
    expect(validasiKomponenNilai({ kode: 'A', nama: 'A', bobotPersen: 0 })[0].code).toBe('TIDAK_SAH');
    expect(validasiKomponenNilai({ kode: 'A', nama: 'A', bobotPersen: 101 })[0].code).toBe('TIDAK_SAH');
  });
});

describe('validasi skala huruf', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiSkalaHuruf({ huruf: 'A', nilaiMinimum: 90, nilaiMaksimum: 100 })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiSkalaHuruf({}).map((g) => g.field).sort()).toEqual(
      ['huruf', 'nilaiMinimum', 'nilaiMaksimum'].sort(),
    );
  });

  it('nilai maksimum tidak boleh lebih kecil dari minimum', () => {
    const galat = validasiSkalaHuruf({ huruf: 'A', nilaiMinimum: 90, nilaiMaksimum: 80 });
    expect(galat.some((g) => g.code === 'SEBELUM_MINIMUM')).toBe(true);
  });
});

describe('validasi nilai', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(
      validasiNilai({ santriId: 'a', komponenId: 'b', tahunAjaranId: 'c', nilaiAngka: 85 }),
    ).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiNilai({}).map((g) => g.field).sort()).toEqual(
      ['komponenId', 'nilaiAngka', 'santriId', 'tahunAjaranId'].sort(),
    );
  });

  it('nilai harus antara 0 dan 100', () => {
    expect(
      validasiNilai({ santriId: 'a', komponenId: 'b', tahunAjaranId: 'c', nilaiAngka: -1 })[0].code,
    ).toBe('TIDAK_SAH');
    expect(
      validasiNilai({ santriId: 'a', komponenId: 'b', tahunAjaranId: 'c', nilaiAngka: 101 })[0].code,
    ).toBe('TIDAK_SAH');
  });
});

describe('cariHurufMutu', () => {
  const skala = [
    { huruf: 'A', nilai_minimum: '90', nilai_maksimum: '100' },
    { huruf: 'B', nilai_minimum: '80', nilai_maksimum: '89.99' },
    { huruf: 'C', nilai_minimum: '70', nilai_maksimum: '79.99' },
  ];

  it('menemukan huruf yang tepat untuk nilai di dalam rentang', () => {
    expect(cariHurufMutu(95, skala)).toBe('A');
    expect(cariHurufMutu(85, skala)).toBe('B');
    expect(cariHurufMutu(70, skala)).toBe('C');
  });

  it('mengembalikan null bila tidak ada skala yang cocok', () => {
    expect(cariHurufMutu(50, skala)).toBeNull();
  });
});
