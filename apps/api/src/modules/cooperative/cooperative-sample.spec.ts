/**
 * Pengujian data awal koperasi.
 *
 * Satu sifat dijaga di atas yang lain:
 *
 *   **Peran dan hak akses TIDAK PERNAH ikut terhapus saat pembersihan data
 *   contoh.**
 *
 * Menghapusnya mengunci pengurus keluar dari koperasinya sendiri, dan tidak
 * ada yang tersisa untuk memulihkannya. Pengujian ini adalah penjaga terakhir
 * sebelum keadaan itu mungkin terjadi.
 */

import {
  AWALAN_CONTOH,
  KELOMPOK_DATA_KOPERASI,
  URUTAN_PEMBERSIHAN,
  barisBolehDihapus,
  bolehDibersihkan,
  rencanaPembersihan,
} from './cooperative-sample';

describe('peran dan hak akses bukan data contoh', () => {
  const rbac = KELOMPOK_DATA_KOPERASI.find((k) => k.code === 'COOPERATIVE_RBAC')!;

  it('bersifat REFERENCE', () => {
    expect(rbac.sifat).toBe('REFERENCE');
  });

  it('TIDAK boleh dibersihkan', () => {
    const v = bolehDibersihkan(rbac);
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('REFERENCE_NOT_REMOVABLE');
  });

  it('penolakannya menyebutkan akibatnya', () => {
    expect(bolehDibersihkan(rbac).message).toContain('mengunci pengurus keluar');
  });

  it('tidak muncul pada rencana penghapusan', () => {
    expect(rencanaPembersihan().kelompokDihapus).not.toContain('COOPERATIVE_RBAC');
    expect(rencanaPembersihan().kelompokDipertahankan).toContain('COOPERATIVE_RBAC');
  });

  it('tidak muncul pada urutan pembersihan', () => {
    expect(URUTAN_PEMBERSIHAN).not.toContain('COOPERATIVE_RBAC');
  });
});

describe('data acuan lain juga bertahan', () => {
  const acuan = KELOMPOK_DATA_KOPERASI.filter((k) => k.sifat === 'REFERENCE');

  it('ada lebih dari satu kelompok acuan', () => {
    expect(acuan.length).toBeGreaterThan(1);
  });

  it('tidak satu pun boleh dibersihkan', () => {
    for (const k of acuan) expect(bolehDibersihkan(k).allowed).toBe(false);
  });

  it('jenis koperasi termasuk acuan', () => {
    // Profil koperasi tidak dapat dibuat tanpa jenisnya.
    expect(KELOMPOK_DATA_KOPERASI.find((k) => k.code === 'COOPERATIVE_TYPE')?.sifat).toBe(
      'REFERENCE',
    );
  });

  it('komponen SHU termasuk acuan', () => {
    // Enam komponen yang disebut Undang-Undang Koperasi, bukan pilihan penyewa.
    expect(
      KELOMPOK_DATA_KOPERASI.find((k) => k.code === 'COOPERATIVE_SHU_COMPONENT')?.sifat,
    ).toBe('REFERENCE');
  });

  it('pemetaan akun termasuk acuan', () => {
    expect(
      KELOMPOK_DATA_KOPERASI.find((k) => k.code === 'COOPERATIVE_ACCOUNT_MAPPING')?.sifat,
    ).toBe('REFERENCE');
  });
});

describe('data contoh memang boleh dihapus', () => {
  const contoh = KELOMPOK_DATA_KOPERASI.filter((k) => k.sifat === 'EXAMPLE');

  it('seluruhnya boleh dibersihkan', () => {
    for (const k of contoh) expect(bolehDibersihkan(k).allowed).toBe(true);
  });

  it('setiap kelompok contoh punya urutan penghapusan', () => {
    for (const k of contoh) expect(URUTAN_PEMBERSIHAN).toContain(k.code);
  });

  it('urutan penghapusan tidak memuat kelompok yang tidak ada', () => {
    const kode = new Set(KELOMPOK_DATA_KOPERASI.map((k) => k.code));
    for (const u of URUTAN_PEMBERSIHAN) expect(kode.has(u)).toBe(true);
  });

  it('SHU dihapus sebelum anggotanya', () => {
    /*
     * Dari yang paling bergantung ke yang paling dirujuk. Menghapus anggota
     * lebih dahulu gagal pada kunci asing, dan kegagalan di tengah pembersihan
     * meninggalkan keadaan separuh bersih yang lebih sulit dipulihkan daripada
     * tidak dibersihkan sama sekali.
     */
    expect(URUTAN_PEMBERSIHAN.indexOf('COOPERATIVE_SAMPLE_SHU')).toBeLessThan(
      URUTAN_PEMBERSIHAN.indexOf('COOPERATIVE_SAMPLE_MEMBER'),
    );
  });

  it('pinjaman dihapus sebelum produk pinjamannya', () => {
    expect(URUTAN_PEMBERSIHAN.indexOf('COOPERATIVE_SAMPLE_LOAN')).toBeLessThan(
      URUTAN_PEMBERSIHAN.indexOf('COOPERATIVE_SAMPLE_LOAN_PRODUCT'),
    );
  });

  it('profil koperasi dihapus paling akhir', () => {
    expect(URUTAN_PEMBERSIHAN[URUTAN_PEMBERSIHAN.length - 1]).toBe(
      'COOPERATIVE_SAMPLE_PROFILE',
    );
  });
});

describe('penyaring baris', () => {
  it('menghapus baris berawalan contoh', () => {
    expect(barisBolehDihapus(`${AWALAN_CONTOH}ANG-001`)).toBe(true);
  });

  it('TIDAK menghapus baris sungguhan', () => {
    expect(barisBolehDihapus('ANG-001')).toBe(false);
    expect(barisBolehDihapus('KSP-2026-0001')).toBe(false);
  });

  it('TIDAK menghapus baris yang hanya memuat kata contoh di tengahnya', () => {
    // "Toko Contoh-Rasa" bukan data contoh.
    expect(barisBolehDihapus(`TOKO-${AWALAN_CONTOH}RASA`)).toBe(false);
  });

  it('baris tanpa kode tidak dihapus', () => {
    // Baris yang tidak dapat dipastikan sifatnya lebih baik dibiarkan.
    expect(barisBolehDihapus(null)).toBe(false);
    expect(barisBolehDihapus(undefined)).toBe(false);
    expect(barisBolehDihapus('')).toBe(false);
  });
});

describe('rencana pembersihan', () => {
  it('memisahkan yang dihapus dari yang dipertahankan tanpa tumpang tindih', () => {
    const r = rencanaPembersihan();
    for (const k of r.kelompokDihapus) expect(r.kelompokDipertahankan).not.toContain(k);
    expect(r.kelompokDihapus.length + r.kelompokDipertahankan.length).toBe(
      KELOMPOK_DATA_KOPERASI.length,
    );
  });

  it('menyebutkan perkiraan jumlah baris', () => {
    expect(rencanaPembersihan().perkiraanBarisDihapus).toBeGreaterThan(0);
  });
});

describe('setiap kelompok beralasan tertulis', () => {
  it('alasannya tidak kosong dan tidak sekadar mengulang labelnya', () => {
    /*
     * Menandai sesuatu REFERENCE berarti "tidak akan pernah dapat dihapus".
     * Pilihan sebesar itu harus beralasan tertulis, bukan sekadar dipilih.
     */
    for (const k of KELOMPOK_DATA_KOPERASI) {
      expect(k.alasan.length).toBeGreaterThan(30);
      expect(k.alasan).not.toBe(k.label);
    }
  });

  it('setiap kode kelompok berbeda', () => {
    const kode = KELOMPOK_DATA_KOPERASI.map((k) => k.code);
    expect(new Set(kode).size).toBe(kode.length);
  });
});
