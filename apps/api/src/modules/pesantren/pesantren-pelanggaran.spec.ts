/**
 * Pengujian aturan pelanggaran dan hukuman santri.
 */

import { validasiHukuman, validasiJenisPelanggaran, validasiPelanggaran } from './pesantren-pelanggaran';

describe('validasi jenis pelanggaran', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiJenisPelanggaran({ code: 'TL01', nama: 'Terlambat', kategori: 'RINGAN', poin: 5 })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiJenisPelanggaran({}).map((g) => g.field).sort()).toEqual(
      ['code', 'nama', 'kategori', 'poin'].sort(),
    );
  });

  it('poin harus lebih besar dari nol', () => {
    expect(
      validasiJenisPelanggaran({ code: 'A', nama: 'A', kategori: 'RINGAN', poin: 0 }).some((g) => g.field === 'poin'),
    ).toBe(true);
  });
});

describe('validasi pelanggaran', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiPelanggaran({ santriId: 'a', jenisPelanggaranId: 'b' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiPelanggaran({}).map((g) => g.field).sort()).toEqual(['santriId', 'jenisPelanggaranId'].sort());
  });

  it('tanggal tidak boleh di masa depan', () => {
    const tahunDepan = new Date();
    tahunDepan.setFullYear(tahunDepan.getFullYear() + 1);
    const galat = validasiPelanggaran({ santriId: 'a', jenisPelanggaranId: 'b', tanggal: tahunDepan.toISOString() });
    expect(galat.some((g) => g.code === 'DI_MASA_DEPAN')).toBe(true);
  });
});

describe('validasi hukuman', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiHukuman({ pelanggaranId: 'a', jenisHukuman: 'TEGURAN_LISAN' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiHukuman({}).map((g) => g.field).sort()).toEqual(['pelanggaranId', 'jenisHukuman'].sort());
  });

  it('tanggal selesai tidak boleh sebelum tanggal mulai', () => {
    const galat = validasiHukuman({
      pelanggaranId: 'a',
      jenisHukuman: 'SKORSING',
      tanggalMulai: '2026-02-01',
      tanggalSelesai: '2026-01-01',
    });
    expect(galat.some((g) => g.code === 'SEBELUM_MULAI')).toBe(true);
  });
});
