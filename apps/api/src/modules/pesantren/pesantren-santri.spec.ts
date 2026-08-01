/**
 * Pengujian aturan data santri.
 */

import { validasiSantri } from './pesantren-santri';

const SAH = {
  nis: 'S-2026-0001',
  namaLengkap: 'Ahmad Fulan',
  jenisKelamin: 'L',
  statusTinggal: 'MUKIM',
};

describe('validasi santri', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiSantri(SAH)).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    const galat = validasiSantri({});
    expect(galat.map((g) => g.field).sort()).toEqual(
      ['jenisKelamin', 'namaLengkap', 'nis', 'statusTinggal'].sort(),
    );
  });

  it('NIS wajib berbentuk yang sah', () => {
    expect(validasiSantri({ ...SAH, nis: 'a b c' })[0].code).toBe('TIDAK_SAH');
    expect(validasiSantri({ ...SAH, nis: 'ab' })[0].code).toBe('TIDAK_SAH');
    expect(validasiSantri({ ...SAH, nis: 'S.2026/0001-A' })).toEqual([]);
  });

  it('jenis kelamin dan status tinggal hanya dari daftar yang dikenali', () => {
    expect(validasiSantri({ ...SAH, jenisKelamin: 'X' })[0].code).toBe('TIDAK_DIKENALI');
    expect(validasiSantri({ ...SAH, statusTinggal: 'ASRAMA' })[0].code).toBe('TIDAK_DIKENALI');
  });

  it('tanggal lahir tidak boleh di masa depan', () => {
    const depan = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect(validasiSantri({ ...SAH, tanggalLahir: depan })[0].code).toBe('DI_MASA_DEPAN');
    expect(validasiSantri({ ...SAH, tanggalLahir: '2015-05-01' })).toEqual([]);
  });

  it('tanggal lahir yang tidak sah ditolak', () => {
    expect(validasiSantri({ ...SAH, tanggalLahir: 'bukan-tanggal' })[0].code).toBe('TIDAK_SAH');
  });

  it('golongan darah diperiksa bila diisi, dan boleh kosong', () => {
    expect(validasiSantri({ ...SAH, golonganDarah: 'O+' })).toEqual([]);
    expect(validasiSantri({ ...SAH, golonganDarah: 'Z' })[0].code).toBe('TIDAK_DIKENALI');
    expect(validasiSantri({ ...SAH, golonganDarah: '' })).toEqual([]);
  });

  it('nama lengkap tidak boleh melebihi batas', () => {
    expect(validasiSantri({ ...SAH, namaLengkap: 'A'.repeat(161) })[0].code).toBe(
      'TERLALU_PANJANG',
    );
  });
});
