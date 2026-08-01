/**
 * Pengujian aturan kitab, halaqah, dan keanggotaan santri.
 */

import { validasiHalaqah, validasiKeanggotaan, validasiKitab } from './pesantren-diniyah';

describe('validasi kitab', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiKitab({ code: 'FQ-01', judul: 'Safinatun Najah' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiKitab({}).map((g) => g.field).sort()).toEqual(['code', 'judul'].sort());
  });
});

describe('validasi halaqah', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiHalaqah({ code: 'HLQ-01', nama: 'Kajian Fikih' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiHalaqah({}).map((g) => g.field).sort()).toEqual(['code', 'nama'].sort());
  });
});

describe('validasi keanggotaan', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiKeanggotaan({ santriId: 'a' })).toEqual([]);
  });

  it('santriId wajib diisi', () => {
    expect(validasiKeanggotaan({})[0].code).toBe('WAJIB');
  });
});
