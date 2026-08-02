/**
 * Pengujian aturan asrama, kamar, dan penempatan santri.
 */

import { validasiAsrama, validasiKamar, validasiPenempatan } from './pesantren-asrama';

describe('validasi asrama', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiAsrama({ code: 'ASR-01', nama: 'Asrama Putra', jenis: 'PUTRA' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    const galat = validasiAsrama({});
    expect(galat.map((g) => g.field).sort()).toEqual(['code', 'jenis', 'nama'].sort());
  });

  it('jenis hanya dari daftar yang dikenali', () => {
    expect(validasiAsrama({ code: 'A', nama: 'A', jenis: 'CAMPUR' })[0].code).toBe('TIDAK_DIKENALI');
  });
});

describe('validasi kamar', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiKamar({ nomor: '101', kapasitas: 8 })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    const galat = validasiKamar({});
    expect(galat.map((g) => g.field).sort()).toEqual(['kapasitas', 'nomor'].sort());
  });

  it('kapasitas harus lebih besar dari nol', () => {
    expect(validasiKamar({ nomor: '1', kapasitas: 0 })[0].code).toBe('TIDAK_SAH');
    expect(validasiKamar({ nomor: '1', kapasitas: -1 })[0].code).toBe('TIDAK_SAH');
  });
});

describe('validasi penempatan', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiPenempatan({ santriId: 'a', kamarId: 'b' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    const galat = validasiPenempatan({});
    expect(galat.map((g) => g.field).sort()).toEqual(['kamarId', 'santriId'].sort());
  });
});
