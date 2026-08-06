/**
 * Pengujian aturan rate plan dan kalender harga/restriksi (MI-10).
 */

import {
  daftarMalam,
  validasiHargaKalender,
  validasiRatePlan,
  validasiRentangTanggal,
} from './hospitality-rate';

describe('validasi rentang tanggal', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiRentangTanggal({ checkin: '2026-10-01', checkout: '2026-10-31' })).toEqual([]);
  });

  it('checkout harus setelah checkin', () => {
    const galat = validasiRentangTanggal({ checkin: '2026-10-31', checkout: '2026-10-01' });
    expect(galat.some((g) => g.field === 'checkout')).toBe(true);
  });
});

describe('validasi rate plan', () => {
  it('masukan minimal tidak menghasilkan galat', () => {
    expect(validasiRatePlan({ code: 'BAR', nama: 'Best Flexible Rate' })).toEqual([]);
  });

  it('kode dan nama wajib diisi', () => {
    const galat = validasiRatePlan({});
    expect(galat.map((g) => g.field).sort()).toEqual(['code', 'nama'].sort());
  });

  it('extraPersonAmount tidak boleh negatif', () => {
    const galat = validasiRatePlan({ code: 'A', nama: 'A', extraPersonAmount: -1 });
    expect(galat.some((g) => g.field === 'extraPersonAmount')).toBe(true);
  });

  it('defaultMinLos harus lebih dari nol', () => {
    const galat = validasiRatePlan({ code: 'A', nama: 'A', defaultMinLos: 0 });
    expect(galat.some((g) => g.field === 'defaultMinLos')).toBe(true);
  });

  it('defaultMaxLos tidak boleh kurang dari defaultMinLos', () => {
    const galat = validasiRatePlan({ code: 'A', nama: 'A', defaultMinLos: 3, defaultMaxLos: 2 });
    expect(galat.some((g) => g.field === 'defaultMaxLos')).toBe(true);
  });

  it('defaultMaxLos sama dengan defaultMinLos diterima', () => {
    expect(validasiRatePlan({ code: 'A', nama: 'A', defaultMinLos: 2, defaultMaxLos: 2 })).toEqual([]);
  });
});

describe('validasi harga kalender', () => {
  const RENTANG = { checkin: '2026-10-01', checkout: '2026-10-31' };

  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiHargaKalender({ ...RENTANG, amount: 850000 })).toEqual([]);
  });

  it('harga wajib diisi dan tidak boleh negatif', () => {
    expect(validasiHargaKalender({ ...RENTANG })[0].field).toBe('amount');
    expect(validasiHargaKalender({ ...RENTANG, amount: -1 })[0].field).toBe('amount');
  });

  it('minLos harus lebih dari nol bila diisi', () => {
    const galat = validasiHargaKalender({ ...RENTANG, amount: 100, minLos: 0 });
    expect(galat.some((g) => g.field === 'minLos')).toBe(true);
  });

  it('maxLos tidak boleh kurang dari minLos', () => {
    const galat = validasiHargaKalender({ ...RENTANG, amount: 100, minLos: 3, maxLos: 2 });
    expect(galat.some((g) => g.field === 'maxLos')).toBe(true);
  });
});

describe('daftar malam', () => {
  it('checkout TIDAK termasuk', () => {
    expect(daftarMalam('2026-10-01', '2026-10-04')).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });
});
