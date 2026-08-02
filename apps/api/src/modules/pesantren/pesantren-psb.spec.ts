/**
 * Pengujian aturan PSB/PPDB (gelombang, pendaftar, jadwal, nomor pendaftaran).
 */

import {
  bentukNomorPendaftaran,
  validasiGelombang,
  validasiHasilJadwal,
  validasiJadwal,
  validasiPendaftar,
} from './pesantren-psb';

describe('validasi gelombang', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(
      validasiGelombang({
        tahunAjaranId: 'a',
        kode: 'G1',
        nama: 'Gelombang 1',
        tanggalBuka: '2026-01-01',
        tanggalTutup: '2026-02-01',
      }),
    ).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiGelombang({}).map((g) => g.field).sort()).toEqual(
      ['tahunAjaranId', 'kode', 'nama', 'tanggalBuka', 'tanggalTutup'].sort(),
    );
  });

  it('tanggal tutup harus setelah tanggal buka', () => {
    const galat = validasiGelombang({
      tahunAjaranId: 'a',
      kode: 'G1',
      nama: 'Gelombang 1',
      tanggalBuka: '2026-02-01',
      tanggalTutup: '2026-01-01',
    });
    expect(galat.some((g) => g.code === 'SEBELUM_BUKA')).toBe(true);
  });

  it('kuota harus lebih besar dari nol bila diisi', () => {
    const galat = validasiGelombang({
      tahunAjaranId: 'a',
      kode: 'G1',
      nama: 'Gelombang 1',
      tanggalBuka: '2026-01-01',
      tanggalTutup: '2026-02-01',
      kuota: 0,
    });
    expect(galat.some((g) => g.field === 'kuota')).toBe(true);
  });
});

describe('validasi pendaftar', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(
      validasiPendaftar({ gelombangId: 'a', namaLengkap: 'Fulan', jenisKelamin: 'L' }),
    ).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiPendaftar({}).map((g) => g.field).sort()).toEqual(
      ['gelombangId', 'namaLengkap', 'jenisKelamin'].sort(),
    );
  });

  it('tanggal lahir tidak boleh di masa depan', () => {
    const tahunDepan = new Date();
    tahunDepan.setFullYear(tahunDepan.getFullYear() + 1);
    const galat = validasiPendaftar({
      gelombangId: 'a',
      namaLengkap: 'Fulan',
      jenisKelamin: 'L',
      tanggalLahir: tahunDepan.toISOString(),
    });
    expect(galat.some((g) => g.code === 'DI_MASA_DEPAN')).toBe(true);
  });

  // -- Kelengkapan setara Dapodik (sama persis dengan pesantren-santri.ts) --

  const SAH_PENDAFTAR = { gelombangId: 'a', namaLengkap: 'Fulan', jenisKelamin: 'L' };

  it('NIK harus 16 digit angka bila diisi, dan boleh kosong', () => {
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, nik: '3201234567890123' })).toEqual([]);
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, nik: '123' })[0].code).toBe('TIDAK_SAH');
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, nik: '' })).toEqual([]);
  });

  it('NISN harus 10 digit angka bila diisi', () => {
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, nisn: '0012345678' })).toEqual([]);
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, nisn: '12345' })[0].code).toBe('TIDAK_SAH');
  });

  it('nomor Kartu Keluarga harus 16 digit angka bila diisi', () => {
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, nomorKk: '3201234567890000' })).toEqual([]);
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, nomorKk: 'KK-001' })[0].code).toBe('TIDAK_SAH');
  });

  it('kebutuhan khusus hanya dari daftar yang dikenali', () => {
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, kebutuhanKhusus: 'NETRA' })).toEqual([]);
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, kebutuhanKhusus: 'ENTAH' })[0].code).toBe('TIDAK_DIKENALI');
  });

  it('email diperiksa bila diisi', () => {
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, email: 'wali@contoh.sch.id' })).toEqual([]);
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, email: 'bukan-email' })[0].code).toBe('TIDAK_SAH');
  });

  it('NIK dan tahun lahir ayah/ibu/wali diperiksa masing-masing', () => {
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, ayah: { nik: '3201234567890000', tahunLahir: 1985 } })).toEqual([]);
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, ayah: { nik: '123' } })[0]).toMatchObject({
      field: 'ayah.nik',
      code: 'TIDAK_SAH',
    });
    expect(validasiPendaftar({ ...SAH_PENDAFTAR, ibu: { tahunLahir: 1800 } })[0]).toMatchObject({
      field: 'ibu.tahunLahir',
      code: 'TIDAK_SAH',
    });
  });
});

describe('validasi jadwal', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(
      validasiJadwal({ pendaftarId: 'a', jenis: 'WAWANCARA', tanggal: '2026-01-10' }),
    ).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiJadwal({}).map((g) => g.field).sort()).toEqual(
      ['pendaftarId', 'jenis', 'tanggal'].sort(),
    );
  });

  it('waktu selesai harus setelah waktu mulai', () => {
    const galat = validasiJadwal({
      pendaftarId: 'a',
      jenis: 'WAWANCARA',
      tanggal: '2026-01-10',
      waktuMulai: '10:00',
      waktuSelesai: '09:00',
    });
    expect(galat.some((g) => g.code === 'SEBELUM_MULAI')).toBe(true);
  });
});

describe('validasi hasil jadwal', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiHasilJadwal({ status: 'SELESAI', nilai: 80 })).toEqual([]);
  });

  it('nilai harus antara 0 dan 100', () => {
    expect(validasiHasilJadwal({ status: 'SELESAI', nilai: 101 })[0].field).toBe('nilai');
  });

  it('status tidak dikenali menghasilkan galat', () => {
    expect(validasiHasilJadwal({ status: 'TIDAK_ADA' }).some((g) => g.field === 'status')).toBe(true);
  });
});

describe('bentukNomorPendaftaran', () => {
  it('membentuk nomor dengan urutan berpadding lima digit', () => {
    expect(bentukNomorPendaftaran('2026', 'G1', 1)).toBe('PSB-2026-G1-00001');
    expect(bentukNomorPendaftaran('2026', 'G1', 42)).toBe('PSB-2026-G1-00042');
  });
});
