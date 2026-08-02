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

  // -- Kelengkapan setara Dapodik (migrasi 20260802T340000) ------------------

  it('NIK harus 16 digit angka bila diisi, dan boleh kosong', () => {
    expect(validasiSantri({ ...SAH, nik: '3201234567890123' })).toEqual([]);
    expect(validasiSantri({ ...SAH, nik: '123' })[0].code).toBe('TIDAK_SAH');
    expect(validasiSantri({ ...SAH, nik: 'abcd123456789012' })[0].code).toBe('TIDAK_SAH');
    expect(validasiSantri({ ...SAH, nik: '' })).toEqual([]);
  });

  it('NISN harus 10 digit angka bila diisi', () => {
    expect(validasiSantri({ ...SAH, nisn: '0012345678' })).toEqual([]);
    expect(validasiSantri({ ...SAH, nisn: '12345' })[0].code).toBe('TIDAK_SAH');
  });

  it('nomor Kartu Keluarga harus 16 digit angka bila diisi', () => {
    expect(validasiSantri({ ...SAH, nomorKk: '3201234567890000' })).toEqual([]);
    expect(validasiSantri({ ...SAH, nomorKk: 'KK-001' })[0].code).toBe('TIDAK_SAH');
  });

  it('kebutuhan khusus hanya dari daftar yang dikenali', () => {
    expect(validasiSantri({ ...SAH, kebutuhanKhusus: 'NETRA' })).toEqual([]);
    expect(validasiSantri({ ...SAH, kebutuhanKhusus: 'ENTAH' })[0].code).toBe('TIDAK_DIKENALI');
  });

  it('email diperiksa bila diisi', () => {
    expect(validasiSantri({ ...SAH, email: 'wali@contoh.sch.id' })).toEqual([]);
    expect(validasiSantri({ ...SAH, email: 'bukan-email' })[0].code).toBe('TIDAK_SAH');
  });

  it('NIK dan tahun lahir ayah/ibu/wali diperiksa masing-masing', () => {
    expect(validasiSantri({ ...SAH, ayah: { nik: '3201234567890000', tahunLahir: 1985 } })).toEqual([]);
    expect(validasiSantri({ ...SAH, ayah: { nik: '123' } })[0]).toMatchObject({
      field: 'ayah.nik',
      code: 'TIDAK_SAH',
    });
    expect(validasiSantri({ ...SAH, ibu: { tahunLahir: 1800 } })[0]).toMatchObject({
      field: 'ibu.tahunLahir',
      code: 'TIDAK_SAH',
    });
    expect(validasiSantri({ ...SAH, wali: { tahunLahir: new Date().getFullYear() + 1 } })[0]).toMatchObject({
      field: 'wali.tahunLahir',
      code: 'TIDAK_SAH',
    });
  });
});
