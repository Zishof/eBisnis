/**
 * Pengujian kelayakan profil desa dan kelurahan.
 *
 * Perintah §8 mewajibkan uji kebocoran profil. Berkas ini menguji **aturannya**;
 * penegakan pada endpoint diuji terpisah pada setiap fase, karena menyembunyikan
 * menu tetapi membiarkan endpoint terbuka bukan pembatasan melainkan penyamaran.
 */

import {
  KATALOG_KELAYAKAN,
  fiturLayak,
  fiturTidakLagiLayak,
  layak,
  sebutanPimpinan,
  sebutanSubWilayah,
  sebutanUnit,
  type KodeFitur,
  type ProfilPemerintahan,
} from './village-profile';

const sakelar = (...kode: string[]) => ({ aktif: new Set(kode) });

describe('katalog kelayakan', () => {
  it('setiap fitur menyatakan salah satu dari empat kelayakan', () => {
    const sah = ['DESA_ONLY', 'KELURAHAN_ONLY', 'BOTH', 'CONFIGURABLE'];
    for (const [kode, nilai] of Object.entries(KATALOG_KELAYAKAN)) {
      expect(sah).toContain(nilai);
      expect(kode).toMatch(/^[A-Z_]+\.[A-Z_]+$/);
    }
  });

  it('memuat fitur dari seluruh dua belas fase', () => {
    // Katalog yang hanya memuat sebagian fase berarti ada fase yang fiturnya
    // tidak pernah dinyatakan kelayakannya.
    const domain = new Set(Object.keys(KATALOG_KELAYAKAN).map((k) => k.split('.')[0]));
    for (const d of [
      'WILAYAH',
      'PENDUDUK',
      'APARATUR',
      'LAYANAN',
      'PARTISIPASI',
      'PERENCANAAN',
      'KEUANGAN',
      'ASET',
      'BANTUAN',
      'USAHA',
      'KEAMANAN',
      'BENCANA',
      'LINGKUNGAN',
      'TANAH',
      'SITUS',
      'PORTAL',
      'TRANSPARANSI',
    ]) {
      expect(domain.has(d)).toBe(true);
    }
  });
});

describe('empat contoh yang disebut perintah', () => {
  // Perintah §8 menyebut empat contoh secara harfiah. Diuji apa adanya.
  it('APBDes hanya untuk desa', () => {
    expect(layak('KEUANGAN.APBDES', 'DESA').layak).toBe(true);
    expect(layak('KEUANGAN.APBDES', 'KELURAHAN').layak).toBe(false);
  });

  it('BPD hanya untuk desa', () => {
    expect(layak('APARATUR.BPD', 'DESA').layak).toBe(true);
    expect(layak('APARATUR.BPD', 'KELURAHAN').layak).toBe(false);
  });

  it('Lurah hanya untuk kelurahan', () => {
    expect(layak('APARATUR.LURAH', 'KELURAHAN').layak).toBe(true);
    expect(layak('APARATUR.LURAH', 'DESA').layak).toBe(false);
  });

  it('layanan warga berlaku bagi keduanya', () => {
    expect(layak('LAYANAN.PERMOHONAN', 'DESA').layak).toBe(true);
    expect(layak('LAYANAN.PERMOHONAN', 'KELURAHAN').layak).toBe(true);
  });
});

describe('penolakan menerangkan sebabnya', () => {
  it('menyebut profil yang seharusnya, dan profil yang ada', () => {
    /*
     * Pesan "tidak berwenang" tidak memberi tahu apa pun. Petugas kelurahan
     * yang membuka menu APBDes perlu tahu bahwa itu memang bukan untuknya —
     * bukan mengira sistemnya rusak.
     */
    const h = layak('KEUANGAN.APBDES', 'KELURAHAN');
    expect(h.alasan).toContain('desa');
    expect(h.alasan).toContain('kelurahan');
  });

  it('yang layak tidak membawa alasan penolakan', () => {
    expect(layak('KEUANGAN.APBDES', 'DESA').alasan).toBeUndefined();
  });
});

describe('fitur yang dapat dikonfigurasi', () => {
  it('bawaannya MATI', () => {
    /*
     * Kewenangan yang tidak dinyatakan tidak boleh dianggap ada. Surat
     * keterangan tanah oleh kelurahan berbeda antar daerah; menyalakannya
     * secara bawaan berarti menebak kewenangan orang lain.
     */
    expect(layak('TANAH.SURAT_KETERANGAN', 'DESA').layak).toBe(false);
    expect(layak('TANAH.SURAT_KETERANGAN', 'KELURAHAN').layak).toBe(false);
  });

  it('menyala bila penyewa mengaktifkannya', () => {
    const s = sakelar('TANAH.SURAT_KETERANGAN');
    expect(layak('TANAH.SURAT_KETERANGAN', 'DESA', s).layak).toBe(true);
    expect(layak('TANAH.SURAT_KETERANGAN', 'KELURAHAN', s).layak).toBe(true);
  });

  it('sakelar satu fitur tidak menyalakan fitur lain', () => {
    const s = sakelar('TANAH.SURAT_KETERANGAN');
    expect(layak('PENGADAAN.RENCANA', 'DESA', s).layak).toBe(false);
  });

  it('sakelar tidak dapat menyalakan yang terkunci profil', () => {
    // Ini yang paling penting: APBDes tidak dapat "diaktifkan" untuk kelurahan
    // dengan menyalakan sakelar. Kelayakannya bukan CONFIGURABLE.
    const s = sakelar('KEUANGAN.APBDES');
    expect(layak('KEUANGAN.APBDES', 'KELURAHAN', s).layak).toBe(false);
  });

  it('penolakan fitur konfigurabel menerangkan bahwa ia belum diaktifkan', () => {
    const h = layak('PENGADAAN.RENCANA', 'KELURAHAN');
    expect(h.alasan).toContain('belum diaktifkan');
  });
});

describe('daftar fitur per profil', () => {
  it('desa dan kelurahan memperoleh daftar yang berbeda', () => {
    const desa = fiturLayak('DESA');
    const kel = fiturLayak('KELURAHAN');
    expect(desa).not.toEqual(kel);
  });

  it('keduanya memperoleh seluruh fitur BOTH', () => {
    const both = (Object.keys(KATALOG_KELAYAKAN) as KodeFitur[]).filter(
      (k) => KATALOG_KELAYAKAN[k] === 'BOTH',
    );
    for (const profil of ['DESA', 'KELURAHAN'] as ProfilPemerintahan[]) {
      const punya = new Set(fiturLayak(profil));
      for (const k of both) expect(punya.has(k)).toBe(true);
    }
  });

  it('tidak ada fitur DESA_ONLY yang bocor ke kelurahan', () => {
    const kel = new Set(fiturLayak('KELURAHAN'));
    const desaOnly = (Object.keys(KATALOG_KELAYAKAN) as KodeFitur[]).filter(
      (k) => KATALOG_KELAYAKAN[k] === 'DESA_ONLY',
    );
    const bocor = desaOnly.filter((k) => kel.has(k));
    expect(bocor).toEqual([]);
  });

  it('tidak ada fitur KELURAHAN_ONLY yang bocor ke desa', () => {
    const desa = new Set(fiturLayak('DESA'));
    const kelOnly = (Object.keys(KATALOG_KELAYAKAN) as KodeFitur[]).filter(
      (k) => KATALOG_KELAYAKAN[k] === 'KELURAHAN_ONLY',
    );
    expect(kelOnly.filter((k) => desa.has(k))).toEqual([]);
  });

  it('fitur konfigurabel tidak muncul sebelum dinyalakan', () => {
    const desa = new Set(fiturLayak('DESA'));
    const konf = (Object.keys(KATALOG_KELAYAKAN) as KodeFitur[]).filter(
      (k) => KATALOG_KELAYAKAN[k] === 'CONFIGURABLE',
    );
    expect(konf.filter((k) => desa.has(k))).toEqual([]);
  });
});

describe('perubahan profil', () => {
  it('desa menjadi kelurahan kehilangan APBDes dan BPD', () => {
    /*
     * Perubahan profil terjadi sungguhan: desa berubah status menjadi kelurahan
     * ketika wilayahnya menjadi perkotaan. Yang tidak boleh terjadi adalah
     * APBDes lama tetap dapat disunting sesudahnya.
     */
    const hilang = fiturTidakLagiLayak('DESA', 'KELURAHAN');
    expect(hilang).toContain('KEUANGAN.APBDES');
    expect(hilang).toContain('APARATUR.BPD');
    expect(hilang).toContain('USAHA.BUMDES');
  });

  it('kelurahan menjadi desa kehilangan jabatan Lurah', () => {
    expect(fiturTidakLagiLayak('KELURAHAN', 'DESA')).toContain('APARATUR.LURAH');
  });

  it('profil yang tidak berubah tidak kehilangan apa pun', () => {
    expect(fiturTidakLagiLayak('DESA', 'DESA')).toEqual([]);
  });

  it('yang hilang tidak memuat fitur BOTH', () => {
    // Layanan warga tidak boleh ikut mati saat profil berubah — warga tetap
    // memerlukan suratnya, apa pun status wilayahnya.
    const hilang = fiturTidakLagiLayak('DESA', 'KELURAHAN');
    expect(hilang).not.toContain('LAYANAN.PERMOHONAN');
    expect(hilang).not.toContain('PENDUDUK.WARGA');
  });
});

describe('sebutan menurut profil', () => {
  it('pimpinan disebut sesuai profilnya', () => {
    expect(sebutanPimpinan('DESA')).toBe('Kepala Desa');
    expect(sebutanPimpinan('KELURAHAN')).toBe('Lurah');
  });

  it('sub-wilayah disebut sesuai profilnya', () => {
    expect(sebutanSubWilayah('DESA')).toBe('Dusun');
    expect(sebutanSubWilayah('KELURAHAN')).toBe('Lingkungan');
  });

  it('unit disebut sesuai profilnya', () => {
    expect(sebutanUnit('DESA')).toBe('Desa');
    expect(sebutanUnit('KELURAHAN')).toBe('Kelurahan');
  });
});
