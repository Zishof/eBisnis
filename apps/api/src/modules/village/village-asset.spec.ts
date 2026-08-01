/**
 * Pengujian aset desa.
 *
 * Dua aturan dijaga paling ketat: **penghapusan wajib berdasar keputusan
 * bernomor**, dan **aset yang sedang dipinjam tidak dapat dihapus**. Keduanya
 * menutup jalan yang sama — aset yang berhenti ada tanpa seorang pun
 * memutuskannya berhenti ada.
 */

import {
  GOLONGAN_KIB,
  TRANSISI_ASET,
  adalahGolonganKib,
  bolehCatatKepemilikan,
  bolehHapusAset,
  bolehPinjam,
  bolehPindahAset,
  bolehTetapkanPengadaan,
  keterlambatan,
  metodePengadaan,
  periksaJangkaPinjam,
  type StatusAset,
  type UsulanPenghapusan,
} from './village-asset';

const usulan = (over: Partial<UsulanPenghapusan> = {}): UsulanPenghapusan => ({
  cara: 'DIMUSNAHKAN',
  nomorKeputusan: 'SK/12/2027',
  alasan: 'Rusak berat dan biaya perbaikannya melampaui nilai barangnya.',
  ...over,
});

describe('penggolongan KIB', () => {
  it('memakai enam golongan yang sudah dipakai pemerintahan', () => {
    expect(Object.keys(GOLONGAN_KIB)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(GOLONGAN_KIB.A).toBe('Tanah');
    expect(GOLONGAN_KIB.F).toBe('Konstruksi dalam Pengerjaan');
  });

  it('menolak golongan di luar daftar', () => {
    expect(adalahGolonganKib('A')).toBe(true);
    expect(adalahGolonganKib('G')).toBe(false);
    expect(adalahGolonganKib('constructor')).toBe(false);
  });
});

describe('kepemilikan menurut profil', () => {
  it('menolak kelurahan mencatat aset milik desa', () => {
    const h = bolehCatatKepemilikan('KELURAHAN', 'DESA');
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('KIB daerah');
  });

  it('mengizinkan kelurahan mencatat aset milik daerah', () => {
    expect(bolehCatatKepemilikan('KELURAHAN', 'DAERAH').boleh).toBe(true);
    expect(bolehCatatKepemilikan('KELURAHAN', 'PIHAK_KETIGA').boleh).toBe(true);
  });

  it('mengizinkan desa mencatat seluruh kepemilikan', () => {
    for (const k of ['DESA', 'DAERAH', 'PIHAK_KETIGA'] as const) {
      expect(bolehCatatKepemilikan('DESA', k).boleh).toBe(true);
    }
  });
});

describe('transisi aset', () => {
  it('mengizinkan pinjam dan kembali', () => {
    expect(bolehPindahAset('AKTIF', 'DIPINJAM').boleh).toBe(true);
    expect(bolehPindahAset('DIPINJAM', 'AKTIF').boleh).toBe(true);
  });

  it('tidak mengembalikan aset yang sudah dihapus', () => {
    expect(TRANSISI_ASET.DIHAPUS).toEqual([]);
    const h = bolehPindahAset('DIHAPUS', 'AKTIF');
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('perolehan baru');
  });

  it('tidak menghapus aset langsung dari keadaan dipinjam', () => {
    expect(bolehPindahAset('DIPINJAM', 'DIHAPUS').boleh).toBe(false);
  });

  it('menolak perpindahan ke status yang sama', () => {
    for (const s of Object.keys(TRANSISI_ASET) as StatusAset[]) {
      expect(bolehPindahAset(s, s).boleh).toBe(false);
    }
  });

  it('setiap status hanya menyebut status yang dikenal', () => {
    const dikenal = new Set(Object.keys(TRANSISI_ASET));
    for (const tujuan of Object.values(TRANSISI_ASET)) {
      for (const t of tujuan) expect(dikenal.has(t)).toBe(true);
    }
  });
});

describe('peminjaman', () => {
  it('hanya meminjamkan aset yang aktif', () => {
    expect(bolehPinjam('AKTIF', 'BAIK').boleh).toBe(true);
    expect(bolehPinjam('DIPINJAM', 'BAIK').boleh).toBe(false);
    expect(bolehPinjam('DIPELIHARA', 'BAIK').boleh).toBe(false);
    expect(bolehPinjam('DIHAPUS', 'BAIK').boleh).toBe(false);
  });

  it('menolak meminjamkan aset rusak berat', () => {
    const h = bolehPinjam('AKTIF', 'RUSAK_BERAT');
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('rusak berat');
  });

  it('mengizinkan aset rusak ringan tetap dipinjam', () => {
    expect(bolehPinjam('AKTIF', 'RUSAK_RINGAN').boleh).toBe(true);
  });

  it('menuntut tanggal kembali yang masuk akal', () => {
    expect(periksaJangkaPinjam({ mulai: '2027-03-01', rencanaKembali: '2027-03-05' }).boleh).toBe(true);
    expect(periksaJangkaPinjam({ mulai: '2027-03-05', rencanaKembali: '2027-03-01' }).boleh).toBe(false);
    expect(periksaJangkaPinjam({ mulai: '2027-03-01', rencanaKembali: '01/03/2027' }).boleh).toBe(false);
  });

  it('menolak peminjaman yang melampaui batas hari', () => {
    const h = periksaJangkaPinjam({ mulai: '2027-01-01', rencanaKembali: '2027-12-31' });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('perjanjian tersendiri');
  });

  it('menghitung keterlambatan, dan tidak pernah negatif', () => {
    expect(keterlambatan('2027-03-05', '2027-03-09')).toBe(4);
    expect(keterlambatan('2027-03-05', '2027-03-05')).toBe(0);
    expect(keterlambatan('2027-03-05', '2027-03-01')).toBe(0);
  });
});

describe('penghapusan aset', () => {
  it('menerima usulan yang lengkap', () => {
    expect(bolehHapusAset('AKTIF', usulan()).boleh).toBe(true);
  });

  it('menolak penghapusan tanpa nomor keputusan', () => {
    const h = bolehHapusAset('AKTIF', usulan({ nomorKeputusan: '   ' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('aset yang hilang');
  });

  it('menolak penghapusan tanpa alasan yang diuraikan', () => {
    expect(bolehHapusAset('AKTIF', usulan({ alasan: 'rusak' })).boleh).toBe(false);
  });

  it('menolak menghapus aset yang sedang dipinjam', () => {
    const h = bolehHapusAset('DIPINJAM', usulan());
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('melepaskan tanggung jawab');
  });

  it('menolak menghapus aset yang sudah dihapus', () => {
    expect(bolehHapusAset('DIHAPUS', usulan()).boleh).toBe(false);
  });

  it('menuntut nilai penjualan bila aset dijual', () => {
    expect(bolehHapusAset('AKTIF', usulan({ cara: 'DIJUAL' })).boleh).toBe(false);
    expect(
      bolehHapusAset('AKTIF', usulan({ cara: 'DIJUAL', nilaiPelepasan: 2_500_000 })).boleh,
    ).toBe(true);
  });

  it('tidak menuntut nilai bila dimusnahkan atau hilang', () => {
    expect(bolehHapusAset('AKTIF', usulan({ cara: 'DIMUSNAHKAN' })).boleh).toBe(true);
    expect(bolehHapusAset('AKTIF', usulan({ cara: 'HILANG' })).boleh).toBe(true);
  });
});

describe('pengadaan', () => {
  it('memilih swakelola untuk nilai di bawah batas', () => {
    expect(metodePengadaan(150_000_000, 200_000_000)).toBe('SWAKELOLA');
    expect(metodePengadaan(200_000_000, 200_000_000)).toBe('SWAKELOLA');
    expect(metodePengadaan(200_000_001, 200_000_000)).toBe('PENYEDIA');
  });

  it('menolak rencana pengadaan tanpa baris anggaran', () => {
    const h = bolehTetapkanPengadaan({ budgetLineId: null, nilai: 10_000_000 });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('telanjur dipesan');
  });

  it('menolak nilai pengadaan yang tidak sah', () => {
    expect(bolehTetapkanPengadaan({ budgetLineId: 'x', nilai: 0 }).boleh).toBe(false);
    expect(bolehTetapkanPengadaan({ budgetLineId: 'x', nilai: Number.NaN }).boleh).toBe(false);
  });

  it('menerima rencana yang menunjuk pagunya', () => {
    expect(bolehTetapkanPengadaan({ budgetLineId: 'x', nilai: 10_000_000 }).boleh).toBe(true);
  });
});
