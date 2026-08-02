/**
 * Pengujian aturan dapur dan katering.
 */

import { validasiBahan, validasiKonsumsi, validasiMenu, validasiTransaksiStok } from './pesantren-katering';

describe('validasi menu', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiMenu({ waktuMakan: 'SARAPAN', namaMenu: 'Nasi goreng' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiMenu({}).map((g) => g.field).sort()).toEqual(['waktuMakan', 'namaMenu'].sort());
  });

  it('jumlah porsi harus lebih besar dari nol bila diisi', () => {
    const galat = validasiMenu({ waktuMakan: 'SARAPAN', namaMenu: 'A', jumlahPorsiDisiapkan: 0 });
    expect(galat.some((g) => g.field === 'jumlahPorsiDisiapkan')).toBe(true);
  });
});

describe('validasi konsumsi', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiKonsumsi({ menuId: 'a', jumlahPorsi: 100 })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiKonsumsi({}).map((g) => g.field).sort()).toEqual(['menuId', 'jumlahPorsi'].sort());
  });
});

describe('validasi bahan', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiBahan({ namaBahan: 'Beras', satuan: 'kg' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiBahan({}).map((g) => g.field).sort()).toEqual(['namaBahan', 'satuan'].sort());
  });

  it('stok minimum tidak boleh negatif', () => {
    expect(validasiBahan({ namaBahan: 'A', satuan: 'kg', stokMinimum: -1 }).some((g) => g.field === 'stokMinimum')).toBe(true);
  });
});

describe('validasi transaksi stok', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiTransaksiStok({ bahanId: 'a', jenis: 'MASUK', jumlah: 10 })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiTransaksiStok({}).map((g) => g.field).sort()).toEqual(['bahanId', 'jenis', 'jumlah'].sort());
  });
});
