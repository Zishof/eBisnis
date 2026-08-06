/**
 * Pengujian aturan profil tamu, consent, do-not-rent, penggabungan, dan
 * permintaan privasi (MI-7).
 */

import {
  validasiDoNotRent,
  validasiGabung,
  validasiPermintaanPrivasi,
  validasiProsesPermintaanPrivasi,
  validasiTamu,
} from './hospitality-guest';

describe('validasi tamu', () => {
  it('masukan minimal (hanya nama) tidak menghasilkan galat', () => {
    expect(validasiTamu({ namaLengkap: 'Budi Santoso' })).toEqual([]);
  });

  it('nama lengkap wajib diisi', () => {
    const galat = validasiTamu({});
    expect(galat.some((g) => g.field === 'namaLengkap')).toBe(true);
  });

  it('email harus format yang sah bila diisi', () => {
    const galat = validasiTamu({ namaLengkap: 'A', email: 'bukan-email' });
    expect(galat.some((g) => g.field === 'email' && g.code === 'TIDAK_SAH')).toBe(true);
  });

  it('jenis identitas tanpa nomor identitas ditolak', () => {
    const galat = validasiTamu({ namaLengkap: 'A', jenisIdentitas: 'KTP' });
    expect(galat.some((g) => g.field === 'nomorIdentitas')).toBe(true);
  });

  it('nomor identitas tanpa jenis identitas ditolak', () => {
    const galat = validasiTamu({ namaLengkap: 'A', nomorIdentitas: '1234' });
    expect(galat.some((g) => g.field === 'jenisIdentitas')).toBe(true);
  });

  it('jenis identitas dan nomor identitas berpasangan lengkap tidak menghasilkan galat', () => {
    expect(
      validasiTamu({ namaLengkap: 'Budi', jenisIdentitas: 'KTP', nomorIdentitas: '3171011234567890' }),
    ).toEqual([]);
  });

  it('jenis identitas yang tidak dikenali ditolak', () => {
    const galat = validasiTamu({ namaLengkap: 'A', jenisIdentitas: 'SURAT_SAKTI', nomorIdentitas: '1' });
    expect(galat.some((g) => g.field === 'jenisIdentitas' && g.code === 'TIDAK_DIKENALI')).toBe(true);
  });
});

describe('validasi do-not-rent', () => {
  it('mengaktifkan do-not-rent tanpa alasan ditolak', () => {
    const galat = validasiDoNotRent({ doNotRent: true });
    expect(galat.some((g) => g.field === 'alasan')).toBe(true);
  });

  it('mengaktifkan do-not-rent dengan alasan tidak menghasilkan galat', () => {
    expect(validasiDoNotRent({ doNotRent: true, alasan: 'Kerusakan properti berulang' })).toEqual([]);
  });

  it('menonaktifkan do-not-rent tidak butuh alasan', () => {
    expect(validasiDoNotRent({ doNotRent: false })).toEqual([]);
  });
});

describe('validasi gabung', () => {
  it('tujuan penggabungan wajib diisi', () => {
    expect(validasiGabung({})[0].field).toBe('intoGuestId');
  });

  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiGabung({ intoGuestId: 'x' })).toEqual([]);
  });
});

describe('validasi permintaan privasi', () => {
  it('jenis wajib dari daftar yang dikenali', () => {
    expect(validasiPermintaanPrivasi({})[0].code).toBe('TIDAK_DIKENALI');
    expect(validasiPermintaanPrivasi({ jenis: 'LAINNYA' })[0].code).toBe('TIDAK_DIKENALI');
  });

  it('EXPORT dan ERASURE diterima', () => {
    expect(validasiPermintaanPrivasi({ jenis: 'EXPORT' })).toEqual([]);
    expect(validasiPermintaanPrivasi({ jenis: 'ERASURE' })).toEqual([]);
  });
});

describe('validasi proses permintaan privasi', () => {
  it('status wajib dari daftar yang dikenali', () => {
    expect(validasiProsesPermintaanPrivasi({})[0].code).toBe('TIDAK_DIKENALI');
  });

  it('COMPLETED dan REJECTED diterima', () => {
    expect(validasiProsesPermintaanPrivasi({ status: 'COMPLETED' })).toEqual([]);
    expect(validasiProsesPermintaanPrivasi({ status: 'REJECTED' })).toEqual([]);
  });

  it('PENDING ditolak sebagai status penyelesaian (bukan status akhir)', () => {
    expect(validasiProsesPermintaanPrivasi({ status: 'PENDING' })[0].code).toBe('TIDAK_DIKENALI');
  });
});
