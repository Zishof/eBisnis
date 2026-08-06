/**
 * Pengujian aturan booking engine publik (MI-9).
 */

import { jumlahMalam, validasiPemesananPublik, validasiPencarian } from './hospitality-booking-engine';

describe('validasi pencarian', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    const besok = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const lusa = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect(validasiPencarian({ checkin: besok, checkout: lusa })).toEqual([]);
  });

  it('checkin di masa lalu ditolak', () => {
    const galat = validasiPencarian({ checkin: '2020-01-01', checkout: '2020-01-02' });
    expect(galat.some((g) => g.code === 'SUDAH_LEWAT')).toBe(true);
  });

  it('checkout harus setelah checkin', () => {
    const besok = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const galat = validasiPencarian({ checkin: besok, checkout: besok });
    expect(galat.some((g) => g.field === 'checkout')).toBe(true);
  });
});

describe('validasi pemesanan publik', () => {
  const besok = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const lusa = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  const MASUKAN_SAH = {
    propertyId: 'prop-1',
    roomTypeId: 'rt-1',
    checkin: besok,
    checkout: lusa,
    namaLengkap: 'Budi Santoso',
    email: 'budi@example.com',
  };

  it('masukan lengkap dengan email tidak menghasilkan galat', () => {
    expect(validasiPemesananPublik(MASUKAN_SAH)).toEqual([]);
  });

  it('masukan lengkap dengan telepon (tanpa email) tidak menghasilkan galat', () => {
    expect(validasiPemesananPublik({ ...MASUKAN_SAH, email: undefined, telepon: '081234567890' })).toEqual([]);
  });

  it('tanpa email maupun telepon ditolak', () => {
    const galat = validasiPemesananPublik({ ...MASUKAN_SAH, email: undefined });
    expect(galat.some((g) => g.field === 'email' && g.code === 'WAJIB')).toBe(true);
  });

  it('email format tidak sah ditolak', () => {
    const galat = validasiPemesananPublik({ ...MASUKAN_SAH, email: 'bukan-email' });
    expect(galat.some((g) => g.field === 'email' && g.code === 'TIDAK_SAH')).toBe(true);
  });

  it('properti, tipe kamar, dan nama wajib diisi', () => {
    const galat = validasiPemesananPublik({ checkin: besok, checkout: lusa, email: 'a@b.com' });
    expect(galat.map((g) => g.field).sort()).toEqual(['namaLengkap', 'propertyId', 'roomTypeId'].sort());
  });

  it('metode pembayaran harus dari daftar yang dikenali', () => {
    const galat = validasiPemesananPublik({ ...MASUKAN_SAH, metodePembayaran: 'KARTU_KREDIT' });
    expect(galat.some((g) => g.field === 'metodePembayaran')).toBe(true);
  });

  it('PAY_AT_PROPERTY diterima', () => {
    expect(validasiPemesananPublik({ ...MASUKAN_SAH, metodePembayaran: 'PAY_AT_PROPERTY' })).toEqual([]);
  });
});

describe('jumlah malam', () => {
  it('menghitung selisih hari dengan benar', () => {
    expect(jumlahMalam('2026-09-10', '2026-09-12')).toBe(2);
    expect(jumlahMalam('2026-09-10', '2026-09-11')).toBe(1);
  });

  it('melewati pergantian bulan', () => {
    expect(jumlahMalam('2026-09-29', '2026-10-02')).toBe(3);
  });
});
