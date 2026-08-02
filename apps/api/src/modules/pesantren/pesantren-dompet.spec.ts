/**
 * Pengujian aturan dompet santri.
 */

import { validasiDompet, validasiTransaksi } from './pesantren-dompet';

describe('validasi dompet', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiDompet({ santriId: 'a' })).toEqual([]);
    expect(validasiDompet({ santriId: 'a', batasHarian: 20000 })).toEqual([]);
  });

  it('santriId wajib diisi', () => {
    expect(validasiDompet({})[0].code).toBe('WAJIB');
  });

  it('batas harian, bila diisi, harus lebih besar dari nol', () => {
    expect(validasiDompet({ santriId: 'a', batasHarian: 0 })[0].code).toBe('TIDAK_SAH');
    expect(validasiDompet({ santriId: 'a', batasHarian: -5 })[0].code).toBe('TIDAK_SAH');
  });
});

describe('validasi transaksi dompet', () => {
  it('jumlah harus lebih besar dari nol', () => {
    expect(validasiTransaksi({ jumlah: 0 })[0].code).toBe('TIDAK_SAH');
    expect(validasiTransaksi({ jumlah: -1 })[0].code).toBe('TIDAK_SAH');
    expect(validasiTransaksi({ jumlah: 10000 })).toEqual([]);
  });
});
