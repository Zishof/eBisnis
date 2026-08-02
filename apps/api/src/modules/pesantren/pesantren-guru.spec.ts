/**
 * Pengujian aturan guru dan penugasan mengajar.
 */

import { validasiGuru, validasiPenugasan } from './pesantren-guru';

describe('validasi guru', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiGuru({ nama: 'Ust. Abdullah', jenis: 'TETAP' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiGuru({}).map((g) => g.field).sort()).toEqual(['nama', 'jenis'].sort());
  });

  it('menolak format email yang salah', () => {
    const galat = validasiGuru({ nama: 'A', jenis: 'TETAP', email: 'bukan-email' });
    expect(galat.some((g) => g.field === 'email')).toBe(true);
  });
});

describe('validasi penugasan', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(
      validasiPenugasan({ guruId: 'a', mataPelajaranId: 'b', rombonganId: 'c', tahunAjaranId: 'd', jamPerMinggu: 4 }),
    ).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiPenugasan({}).map((g) => g.field).sort()).toEqual(
      ['guruId', 'mataPelajaranId', 'rombonganId', 'tahunAjaranId', 'jamPerMinggu'].sort(),
    );
  });

  it('jam per minggu harus lebih besar dari nol', () => {
    const galat = validasiPenugasan({
      guruId: 'a',
      mataPelajaranId: 'b',
      rombonganId: 'c',
      tahunAjaranId: 'd',
      jamPerMinggu: 0,
    });
    expect(galat.some((g) => g.field === 'jamPerMinggu')).toBe(true);
  });
});
