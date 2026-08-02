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
