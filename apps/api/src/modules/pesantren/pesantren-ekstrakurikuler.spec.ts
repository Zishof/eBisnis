/**
 * Pengujian aturan ekstrakurikuler dan organisasi siswa.
 */

import { validasiAnggotaEkskul, validasiEkstrakurikuler, validasiNilaiPartisipasi } from './pesantren-ekstrakurikuler';

describe('validasi ekstrakurikuler', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiEkstrakurikuler({ code: 'PRAMUKA', nama: 'Pramuka', jenis: 'KLUB' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiEkstrakurikuler({}).map((g) => g.field).sort()).toEqual(['code', 'nama', 'jenis'].sort());
  });
});

describe('validasi anggota ekskul', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiAnggotaEkskul({ ekstrakurikulerId: 'a', santriId: 'b', tahunAjaranId: 'c' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiAnggotaEkskul({}).map((g) => g.field).sort()).toEqual(
      ['ekstrakurikulerId', 'santriId', 'tahunAjaranId'].sort(),
    );
  });

  it('menolak jabatan yang tidak dikenali', () => {
    const galat = validasiAnggotaEkskul({ ekstrakurikulerId: 'a', santriId: 'b', tahunAjaranId: 'c', jabatan: 'PRESIDEN' });
    expect(galat.some((g) => g.field === 'jabatan')).toBe(true);
  });
});

describe('validasi nilai partisipasi', () => {
  it('nilai kosong tidak menghasilkan galat', () => {
    expect(validasiNilaiPartisipasi({})).toEqual([]);
  });

  it('menolak nilai di luar 0-100', () => {
    expect(validasiNilaiPartisipasi({ nilaiPartisipasi: 101 }).length).toBeGreaterThan(0);
    expect(validasiNilaiPartisipasi({ nilaiPartisipasi: -1 }).length).toBeGreaterThan(0);
  });
});
