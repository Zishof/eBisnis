/**
 * Pengujian keamanan, kebencanaan, dan infrastruktur.
 *
 * Dua hal dijaga paling ketat:
 *
 * 1. **Catatan insiden tidak menyimpan tuduhan sebagai fakta.** Daftar ruas
 *    terlarang menggagalkan berkasnya pada hari kolom "nama pelaku"
 *    ditambahkan.
 * 2. **Bantuan bencana tidak menunggu penyaringan kelayakan.** Yang membatasi
 *    hanyalah stok — bukan verifikasi, bukan dasar tertulis, bukan pemeriksaan
 *    bantuan ganda.
 */

import {
  RUAS_TERLARANG_INSIDEN,
  TRANSISI_INSIDEN,
  UMUR_PENILAIAN_KEDALUWARSA_HARI,
  bolehCatatPenyaluran,
  bolehHapusKejadian,
  bolehPindahInsiden,
  bolehRujukInsiden,
  bolehSalurkanLogistik,
  periksaAngkaBencana,
  periksaPenilaian,
  tilikKondisi,
  umurPenilaian,
  type KejadianBencana,
  type StatusInsiden,
} from './village-safety';

describe('transisi insiden', () => {
  it('mengizinkan alur penanganan yang biasa', () => {
    expect(bolehPindahInsiden('DILAPORKAN', 'DITANGANI').boleh).toBe(true);
    expect(bolehPindahInsiden('DITANGANI', 'DIRUJUK').boleh).toBe(true);
    expect(bolehPindahInsiden('DIRUJUK', 'SELESAI').boleh).toBe(true);
  });

  it('mengizinkan laporan ringan langsung selesai', () => {
    expect(bolehPindahInsiden('DILAPORKAN', 'SELESAI').boleh).toBe(true);
  });

  it('tidak membuka kembali laporan yang selesai', () => {
    expect(TRANSISI_INSIDEN.SELESAI).toEqual([]);
    const h = bolehPindahInsiden('SELESAI', 'DITANGANI');
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('laporan baru');
  });

  it('menolak perpindahan ke status yang sama', () => {
    for (const s of Object.keys(TRANSISI_INSIDEN) as StatusInsiden[]) {
      expect(bolehPindahInsiden(s, s).boleh).toBe(false);
    }
  });

  it('setiap status hanya menyebut status yang dikenal', () => {
    const dikenal = new Set(Object.keys(TRANSISI_INSIDEN));
    for (const tujuan of Object.values(TRANSISI_INSIDEN)) {
      for (const t of tujuan) expect(dikenal.has(t)).toBe(true);
    }
  });
});

describe('rujukan insiden', () => {
  it('menerima rujukan yang menyebut nomor laporannya', () => {
    expect(
      bolehRujukInsiden({ dirujukKe: 'Polsek Kecamatan', nomorRujukan: 'LP/45/III/2027' }).boleh,
    ).toBe(true);
  });

  it('MENOLAK rujukan tanpa nomor laporan', () => {
    const h = bolehRujukInsiden({ dirujukKe: 'Polsek Kecamatan', nomorRujukan: '  ' });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('enam bulan kemudian');
    expect(h.alasan).toContain('Polsek Kecamatan');
  });

  it('menolak rujukan tanpa lembaga tujuan', () => {
    expect(bolehRujukInsiden({ dirujukKe: '', nomorRujukan: 'LP/45' }).boleh).toBe(false);
  });
});

describe('catatan insiden tidak menyimpan tuduhan', () => {
  it('daftar ruas terlarang memuat yang paling mungkin diusulkan', () => {
    // Semuanya terdengar wajar ketika diusulkan, dan itulah yang membuat
    // daftarnya perlu ada.
    for (const wajib of ['accused_name', 'suspect_resident_id', 'perpetrator_name', 'nama_pelaku']) {
      expect(RUAS_TERLARANG_INSIDEN as readonly string[]).toContain(wajib);
    }
  });

  it('daftarnya tidak menyusut diam-diam', () => {
    expect(RUAS_TERLARANG_INSIDEN.length).toBeGreaterThanOrEqual(9);
  });
});

describe('kejadian bencana', () => {
  const kejadian = (over: Partial<KejadianBencana> = {}): KejadianBencana => ({
    jenis: 'BANJIR',
    tanggalKejadian: '2027-01-18',
    jumlahTerdampakKk: 42,
    jumlahMengungsi: 120,
    jumlahKorbanJiwa: 0,
    ...over,
  });

  it('menerima angka yang wajar', () => {
    expect(periksaAngkaBencana(kejadian()).boleh).toBe(true);
  });

  it('menolak angka negatif', () => {
    expect(periksaAngkaBencana(kejadian({ jumlahKorbanJiwa: -1 })).boleh).toBe(false);
    expect(periksaAngkaBencana(kejadian({ jumlahTerdampakKk: -5 })).boleh).toBe(false);
  });

  it('menolak angka pecahan', () => {
    expect(periksaAngkaBencana(kejadian({ jumlahMengungsi: 12.5 })).boleh).toBe(false);
  });

  it('menolak tanggal yang bukan ISO', () => {
    expect(periksaAngkaBencana(kejadian({ tanggalKejadian: '18 Januari 2027' })).boleh).toBe(false);
  });

  it('TIDAK PERNAH mengizinkan penghapusan laporan kejadian', () => {
    const h = bolehHapusKejadian();
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('BPBD');
    expect(h.alasan).toContain('Koreksi');
  });
});

describe('logistik bantuan bencana', () => {
  const stok = { tersedia: 100, satuan: 'paket' };

  it('menyalurkan sebatas stok', () => {
    expect(bolehSalurkanLogistik(stok, 40).boleh).toBe(true);
    expect(bolehSalurkanLogistik(stok, 100).boleh).toBe(true);
  });

  it('menolak melampaui stok, menyebut angkanya', () => {
    const h = bolehSalurkanLogistik(stok, 140);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tersedia 100 paket');
    expect(h.alasan).toContain('diminta 140');
  });

  it('menolak jumlah yang tidak sah', () => {
    expect(bolehSalurkanLogistik(stok, 0).boleh).toBe(false);
    expect(bolehSalurkanLogistik(stok, -1).boleh).toBe(false);
  });

  it('TIDAK menuntut verifikasi kelayakan apa pun', () => {
    // Kebalikan sengaja dari bantuan sosial D-7. Yang membatasi hanya stok;
    // keluarga yang kehilangan rumah pukul tiga pagi bukan berkas yang perlu
    // dinilai kelayakannya. Tanda tangan fungsinya adalah buktinya: ia tidak
    // menerima status penerima, dasar penetapan, maupun hasil penyaringan.
    expect(bolehSalurkanLogistik.length).toBe(2);
    expect(bolehSalurkanLogistik(stok, 1).boleh).toBe(true);
  });

  it('tetap menuntut nama penerima sebagai pertanggungjawaban', () => {
    expect(bolehCatatPenyaluran({ jumlah: 2, namaPenerima: 'Karto' }).boleh).toBe(true);
    const h = bolehCatatPenyaluran({ jumlah: 2, namaPenerima: '   ' });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('bukan syarat sebelum');
  });

  it('menolak jumlah penyaluran yang tidak sah', () => {
    expect(bolehCatatPenyaluran({ jumlah: 0, namaPenerima: 'Karto' }).boleh).toBe(false);
  });
});

describe('kondisi infrastruktur', () => {
  it('menuntut tanggal penilaian', () => {
    const h = periksaPenilaian({ kondisi: 'RUSAK_BERAT', dinilaiPada: '' });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tidak pernah kedaluwarsa');
    expect(periksaPenilaian({ kondisi: 'BAIK', dinilaiPada: '2027-02-01' }).boleh).toBe(true);
  });

  it('menghitung umur penilaian', () => {
    expect(umurPenilaian('2027-01-01', '2027-01-31')).toBe(30);
    expect(umurPenilaian('2027-01-01', '2027-01-01')).toBe(0);
  });

  it('menandai penilaian yang kedaluwarsa', () => {
    const baru = tilikKondisi({ kondisi: 'RUSAK_BERAT', dinilaiPada: '2027-01-01' }, '2027-03-01');
    expect(baru.kedaluwarsa).toBe(false);

    const lama = tilikKondisi({ kondisi: 'RUSAK_BERAT', dinilaiPada: '2024-01-01' }, '2027-03-01');
    expect(lama.kedaluwarsa).toBe(true);
    expect(lama.keterangan).toContain('dasar usulan anggaran');
  });

  it('ambang kedaluwarsa satu tahun', () => {
    expect(UMUR_PENILAIAN_KEDALUWARSA_HARI).toBe(365);
    const tepat = tilikKondisi({ kondisi: 'BAIK', dinilaiPada: '2026-03-01' }, '2027-03-01');
    expect(tepat.umurHari).toBe(365);
    expect(tepat.kedaluwarsa).toBe(false);
  });

  it('menyajikan umur bersama kondisinya, bukan menyimpannya diam-diam', () => {
    const t = tilikKondisi({ kondisi: 'RUSAK_SEDANG', dinilaiPada: '2027-01-01' }, '2027-02-10');
    expect(t.keterangan).toContain('2027-01-01');
    expect(t.keterangan).toContain('40 hari');
  });
});
