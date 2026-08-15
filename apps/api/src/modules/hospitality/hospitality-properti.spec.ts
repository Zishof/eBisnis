/**
 * Pengujian aturan properti, tipe kamar, dan kamar (MI-5).
 */

import { validasiKamar, validasiProperti, validasiTipeKamar } from './hospitality-properti';

describe('validasi properti', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiProperti({ code: 'PROP-01', nama: 'Hotel Merdeka' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    const galat = validasiProperti({});
    expect(galat.map((g) => g.field).sort()).toEqual(['code', 'nama'].sort());
  });

  it('kode dan nama punya batas panjang', () => {
    expect(validasiProperti({ code: 'a'.repeat(33), nama: 'X' })[0].code).toBe('TERLALU_PANJANG');
    expect(validasiProperti({ code: 'X', nama: 'a'.repeat(121) })[0].code).toBe('TERLALU_PANJANG');
  });
});

describe('validasi tipe kamar', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiTipeKamar({ code: 'DLX', nama: 'Deluxe', okupansiMaks: 2 })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    const galat = validasiTipeKamar({});
    expect(galat.map((g) => g.field).sort()).toEqual(['code', 'nama', 'okupansiMaks'].sort());
  });

  it('okupansi maksimum harus bilangan bulat positif', () => {
    expect(validasiTipeKamar({ code: 'A', nama: 'A', okupansiMaks: 0 })[0].code).toBe('TIDAK_SAH');
    expect(validasiTipeKamar({ code: 'A', nama: 'A', okupansiMaks: -1 })[0].code).toBe('TIDAK_SAH');
    expect(validasiTipeKamar({ code: 'A', nama: 'A', okupansiMaks: 1.5 })[0].code).toBe('TIDAK_SAH');
  });
});

describe('validasi kamar', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiKamar({ roomTypeId: 'x', nomorKamar: '101' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    const galat = validasiKamar({});
    expect(galat.map((g) => g.field).sort()).toEqual(['nomorKamar', 'roomTypeId'].sort());
  });

  it('nomor kamar punya batas panjang', () => {
    expect(validasiKamar({ roomTypeId: 'x', nomorKamar: 'a'.repeat(17) })[0].code).toBe('TERLALU_PANJANG');
  });
});
