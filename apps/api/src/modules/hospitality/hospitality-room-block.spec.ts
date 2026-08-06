/**
 * Pengujian aturan blokir kamar dan ketersediaan (MI-6).
 */

import { daftarMalam, validasiBlokir, validasiRentangTanggal } from './hospitality-room-block';

describe('validasi rentang tanggal', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiRentangTanggal({ checkin: '2026-09-01', checkout: '2026-09-03' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    const galat = validasiRentangTanggal({});
    expect(galat.map((g) => g.field).sort()).toEqual(['checkin', 'checkout'].sort());
  });

  it('menolak format tanggal yang bukan YYYY-MM-DD', () => {
    expect(validasiRentangTanggal({ checkin: '01-09-2026', checkout: '2026-09-03' })[0].field).toBe('checkin');
  });

  it('checkout harus setelah checkin', () => {
    const galat = validasiRentangTanggal({ checkin: '2026-09-03', checkout: '2026-09-01' });
    expect(galat.some((g) => g.field === 'checkout')).toBe(true);
  });

  it('checkout sama dengan checkin ditolak (rentang kosong)', () => {
    const galat = validasiRentangTanggal({ checkin: '2026-09-01', checkout: '2026-09-01' });
    expect(galat.some((g) => g.field === 'checkout')).toBe(true);
  });
});

describe('validasi blokir', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(
      validasiBlokir({ checkin: '2026-09-01', checkout: '2026-09-03', status: 'OUT_OF_ORDER' }),
    ).toEqual([]);
  });

  it('status harus dari daftar yang dikenali', () => {
    const galat = validasiBlokir({ checkin: '2026-09-01', checkout: '2026-09-03', status: 'RUSAK' });
    expect(galat.some((g) => g.field === 'status' && g.code === 'TIDAK_DIKENALI')).toBe(true);
  });

  it('status kosong ditolak', () => {
    const galat = validasiBlokir({ checkin: '2026-09-01', checkout: '2026-09-03' });
    expect(galat.some((g) => g.field === 'status')).toBe(true);
  });
});

describe('daftar malam', () => {
  it('checkout TIDAK termasuk malam yang diblokir', () => {
    expect(daftarMalam('2026-09-01', '2026-09-04')).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });

  it('satu malam', () => {
    expect(daftarMalam('2026-09-01', '2026-09-02')).toEqual(['2026-09-01']);
  });

  it('rentang yang melewati pergantian bulan', () => {
    expect(daftarMalam('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
  });
});
