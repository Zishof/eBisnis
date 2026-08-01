/**
 * Aturan kependudukan — fungsi murni, tanpa basis data.
 *
 * Dua hal yang menentukan bentuk berkas ini:
 *
 * 1. **NIK tidak divalidasi terlalu ketat.** Godaannya besar: NIK punya format
 *    yang terdefinisi, dan menolak yang tidak sesuai terasa benar. Tetapi NIK
 *    yang tercetak keliru pada KTP sungguhan **ada**, dan desa tetap harus
 *    dapat mendata pemiliknya. Yang salah format ditandai, bukan ditolak.
 *
 * 2. **Duplikat ditandai, bukan diputuskan.** NIK kembar bisa berarti salah
 *    ketik, bisa berarti pemalsuan, bisa berarti dua orang yang sungguh-sungguh
 *    memegang NIK sama karena kesalahan penerbitan. Sistem tidak boleh
 *    memutuskan yang mana — ia menandai, dan manusia yang menelusuri.
 */

export type JenisKelamin = 'L' | 'P';

export type StatusPenduduk =
  | 'TETAP'
  | 'TIDAK_TETAP'
  | 'PINDAH'
  | 'MENINGGAL'
  | 'HILANG';

export type StatusKawin = 'BELUM_KAWIN' | 'KAWIN' | 'CERAI_HIDUP' | 'CERAI_MATI';

export type HubunganKeluarga =
  | 'KEPALA_KELUARGA'
  | 'SUAMI'
  | 'ISTRI'
  | 'ANAK'
  | 'MENANTU'
  | 'CUCU'
  | 'ORANGTUA'
  | 'MERTUA'
  | 'FAMILI_LAIN'
  | 'PEMBANTU'
  | 'LAINNYA';

export type PeristiwaKependudukan =
  | 'KELAHIRAN'
  | 'KEMATIAN'
  | 'PINDAH_MASUK'
  | 'PINDAH_KELUAR'
  | 'PERKAWINAN'
  | 'PERCERAIAN';

// --- NIK ---------------------------------------------------------------------

export interface PemeriksaanNik {
  /** Benar bila formatnya sesuai ketentuan. */
  valid: boolean;
  /** Hal yang janggal, untuk ditandai — bukan untuk menolak. */
  peringatan: string[];
  /** Tanggal lahir yang tersirat dari NIK, bila dapat dibaca. */
  tanggalLahirTersirat?: string;
  /** Jenis kelamin yang tersirat dari NIK, bila dapat dibaca. */
  jenisKelaminTersirat?: JenisKelamin;
}

/**
 * Memeriksa NIK — **menandai, tidak menolak**.
 *
 * Format: PPKKCC-DDMMYY-NNNN, enam belas digit. Tanggal lahir perempuan
 * ditambah 40 pada komponen harinya.
 */
export function periksaNik(nik: string): PemeriksaanNik {
  const bersih = nik.replace(/\s/g, '');
  const peringatan: string[] = [];

  if (!/^\d+$/.test(bersih)) {
    return { valid: false, peringatan: ['NIK hanya boleh berisi angka.'] };
  }
  if (bersih.length !== 16) {
    return {
      valid: false,
      peringatan: [`NIK harus enam belas digit; yang dimasukkan ${bersih.length} digit.`],
    };
  }

  const wilayah = bersih.slice(0, 6);
  if (wilayah === '000000') peringatan.push('Kode wilayah pada NIK bernilai nol.');

  let hari = Number(bersih.slice(6, 8));
  const bulan = Number(bersih.slice(8, 10));
  const tahun2 = Number(bersih.slice(10, 12));

  let jenisKelaminTersirat: JenisKelamin | undefined;
  if (hari > 40) {
    hari -= 40;
    jenisKelaminTersirat = 'P';
  } else if (hari >= 1) {
    jenisKelaminTersirat = 'L';
  }

  let tanggalLahirTersirat: string | undefined;
  if (hari >= 1 && hari <= 31 && bulan >= 1 && bulan <= 12) {
    // Dua digit tahun tidak menyebutkan abadnya. Diperkirakan: tahun yang
    // menghasilkan usia di bawah 110 tahun. Perkiraan ini hanya untuk
    // memudahkan pengisian — tanggal lahir sesungguhnya tetap diisi petugas.
    const sekarang = new Date().getFullYear();
    const abad20 = 1900 + tahun2;
    const abad21 = 2000 + tahun2;
    const tahun = abad21 <= sekarang ? abad21 : abad20;
    tanggalLahirTersirat = `${tahun}-${String(bulan).padStart(2, '0')}-${String(hari).padStart(2, '0')}`;
  } else {
    peringatan.push('Komponen tanggal lahir pada NIK tidak dapat dibaca.');
  }

  const urut = bersih.slice(12, 16);
  if (urut === '0000') peringatan.push('Nomor urut pada NIK bernilai nol.');

  return {
    valid: peringatan.length === 0,
    peringatan,
    tanggalLahirTersirat,
    jenisKelaminTersirat,
  };
}

/**
 * Apakah NIK boleh disimpan?
 *
 * **Selalu boleh**, selama enam belas digit angka. Yang janggal ditandai.
 *
 * Alasannya bukan kelonggaran: NIK yang tercetak keliru pada KTP sungguhan ada,
 * dan warga pemiliknya tetap berhak memperoleh layanan desa. Menolaknya berarti
 * memaksa petugas mengarang NIK lain agar datanya dapat masuk — dan data karangan
 * lebih buruk daripada data yang ditandai janggal.
 */
export function bolehSimpanNik(nik: string): { boleh: boolean; alasan?: string } {
  const bersih = nik.replace(/\s/g, '');
  if (!/^\d{16}$/.test(bersih)) {
    return {
      boleh: false,
      alasan: 'NIK harus tepat enam belas digit angka.',
    };
  }
  return { boleh: true };
}

// --- Duplikat ----------------------------------------------------------------

export type AlasanDuplikat = 'NIK_SAMA' | 'NAMA_TANGGAL_LAHIR_SAMA' | 'KK_NIK_SAMA';

export interface TemuanDuplikat {
  alasan: AlasanDuplikat;
  keyakinan: 'TINGGI' | 'SEDANG';
  keterangan: string;
}

export interface CalonPenduduk {
  nik: string;
  nama: string;
  tanggalLahir: string | null;
}

/**
 * Menandai kemungkinan duplikat.
 *
 * Mengembalikan temuan, **bukan keputusan**. NIK kembar bisa berarti salah
 * ketik, bisa berarti pemalsuan, bisa berarti kesalahan penerbitan. Menolaknya
 * otomatis akan menghalangi pendataan warga yang datanya memang bermasalah —
 * padahal justru merekalah yang paling perlu dibantu mengurusnya.
 */
export function cariDuplikat(
  baru: CalonPenduduk,
  yangAda: Array<CalonPenduduk & { id: string }>,
): Array<TemuanDuplikat & { residentId: string }> {
  const temuan: Array<TemuanDuplikat & { residentId: string }> = [];
  const namaBaru = normalkanNama(baru.nama);

  for (const a of yangAda) {
    if (a.nik && baru.nik && a.nik === baru.nik) {
      temuan.push({
        residentId: a.id,
        alasan: 'NIK_SAMA',
        keyakinan: 'TINGGI',
        keterangan: `NIK sama dengan ${a.nama}. Periksa apakah salah ketik atau memang perlu ditelusuri.`,
      });
      continue;
    }
    if (
      namaBaru &&
      normalkanNama(a.nama) === namaBaru &&
      baru.tanggalLahir &&
      a.tanggalLahir === baru.tanggalLahir
    ) {
      temuan.push({
        residentId: a.id,
        alasan: 'NAMA_TANGGAL_LAHIR_SAMA',
        keyakinan: 'SEDANG',
        keterangan: `Nama dan tanggal lahir sama dengan penduduk yang sudah terdaftar.`,
      });
    }
  }
  return temuan;
}

/**
 * Menormalkan nama untuk perbandingan.
 *
 * Gelar dan tanda baca dibuang; "H. Ahmad, S.Pd" dan "Ahmad" dianggap sama
 * untuk keperluan penandaan duplikat. Sengaja longgar — tugasnya menandai
 * untuk ditelusuri, bukan memutuskan.
 */
export function normalkanNama(nama: string): string {
  return nama
    .toUpperCase()
    .replace(/\b(H|HJ|IR|DRS|DRA|DR|PROF|S\.?[A-Z]{1,4})\.?\b/g, ' ')
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Keluarga ----------------------------------------------------------------

export interface AnggotaKeluarga {
  id: string;
  hubungan: HubunganKeluarga;
}

export interface HasilPeriksaKeluarga {
  sah: boolean;
  masalah: string[];
}

/**
 * Memeriksa susunan kartu keluarga.
 *
 * Satu aturan keras: **tepat satu kepala keluarga**. Kartu keluarga tanpa
 * kepala keluarga tidak dapat dipakai mengurus apa pun, dan yang berkepala dua
 * berarti salah satunya keliru.
 */
export function periksaSusunanKeluarga(anggota: AnggotaKeluarga[]): HasilPeriksaKeluarga {
  const masalah: string[] = [];
  const kepala = anggota.filter((a) => a.hubungan === 'KEPALA_KELUARGA');

  if (kepala.length === 0) masalah.push('Kartu keluarga belum memiliki kepala keluarga.');
  if (kepala.length > 1) {
    masalah.push(`Kartu keluarga memiliki ${kepala.length} kepala keluarga; seharusnya satu.`);
  }

  const istri = anggota.filter((a) => a.hubungan === 'ISTRI').length;
  const suami = anggota.filter((a) => a.hubungan === 'SUAMI').length;
  if (istri > 1) masalah.push('Terdapat lebih dari satu anggota berhubungan ISTRI.');
  if (suami > 1) masalah.push('Terdapat lebih dari satu anggota berhubungan SUAMI.');

  const ganda = anggota.map((a) => a.id).filter((id, i, arr) => arr.indexOf(id) !== i);
  if (ganda.length) masalah.push('Terdapat penduduk yang tercatat dua kali pada kartu yang sama.');

  return { sah: masalah.length === 0, masalah };
}

// --- Peristiwa kependudukan --------------------------------------------------

/** Status penduduk sesudah sebuah peristiwa. */
export function statusSesudahPeristiwa(
  sekarang: StatusPenduduk,
  peristiwa: PeristiwaKependudukan,
): { status: StatusPenduduk; boleh: boolean; alasan?: string } {
  if (sekarang === 'MENINGGAL') {
    return {
      status: sekarang,
      boleh: false,
      alasan: 'Penduduk berstatus meninggal tidak dapat dikenai peristiwa lain.',
    };
  }

  switch (peristiwa) {
    case 'KEMATIAN':
      return { status: 'MENINGGAL', boleh: true };
    case 'PINDAH_KELUAR':
      if (sekarang === 'PINDAH') {
        return { status: sekarang, boleh: false, alasan: 'Penduduk ini sudah tercatat pindah keluar.' };
      }
      return { status: 'PINDAH', boleh: true };
    case 'PINDAH_MASUK':
      return { status: 'TETAP', boleh: true };
    case 'KELAHIRAN':
      return { status: 'TETAP', boleh: true };
    // Perkawinan dan perceraian mengubah status kawin, bukan status kependudukan.
    case 'PERKAWINAN':
    case 'PERCERAIAN':
      return { status: sekarang, boleh: true };
    default:
      return { status: sekarang, boleh: false, alasan: 'Peristiwa tidak dikenal.' };
  }
}

/**
 * Bolehkah data penduduk ini disunting?
 *
 * Penduduk yang sudah meninggal atau pindah **tidak dihapus** — dokumen
 * kependudukan kerap dibutuhkan bertahun-tahun kemudian, termasuk oleh ahli
 * warisnya. Yang tidak boleh adalah menyuntingnya seolah ia masih warga di sini.
 */
export function bolehSuntingPenduduk(status: StatusPenduduk): { boleh: boolean; alasan?: string } {
  if (status === 'MENINGGAL') {
    return {
      boleh: false,
      alasan:
        'Data penduduk yang telah meninggal tidak dapat diubah. Bila terdapat kekeliruan, ' +
        'ajukan perbaikan melalui peristiwa kependudukan agar riwayatnya tercatat.',
    };
  }
  if (status === 'PINDAH') {
    return {
      boleh: false,
      alasan: 'Penduduk ini telah pindah keluar. Catat pindah masuk kembali bila ia kembali menetap.',
    };
  }
  return { boleh: true };
}

// --- Usia dan kelompok -------------------------------------------------------

/** Usia dalam tahun penuh pada tanggal acuan. */
export function usia(tanggalLahir: string, pada: string): number | null {
  const lahir = new Date(tanggalLahir);
  const acuan = new Date(pada);
  if (Number.isNaN(lahir.getTime()) || Number.isNaN(acuan.getTime())) return null;
  let n = acuan.getFullYear() - lahir.getFullYear();
  const bulan = acuan.getMonth() - lahir.getMonth();
  if (bulan < 0 || (bulan === 0 && acuan.getDate() < lahir.getDate())) n -= 1;
  return n < 0 ? null : n;
}

export type KelompokUsia =
  | 'BALITA'
  | 'ANAK'
  | 'REMAJA'
  | 'DEWASA'
  | 'LANSIA';

/** Kelompok usia untuk laporan demografi. */
export function kelompokUsia(tahun: number): KelompokUsia {
  if (tahun < 5) return 'BALITA';
  if (tahun < 13) return 'ANAK';
  if (tahun < 18) return 'REMAJA';
  if (tahun < 60) return 'DEWASA';
  return 'LANSIA';
}

/** Apakah penduduk ini wajib memiliki KTP? */
export function wajibKtp(tahun: number, statusKawin: StatusKawin): boolean {
  // Tujuh belas tahun, atau sudah/pernah kawin.
  return tahun >= 17 || statusKawin !== 'BELUM_KAWIN';
}

// --- Penyajian agregat -------------------------------------------------------

/** Cacah minimum sebelum sebuah agregat boleh ditampilkan kepada publik. */
export const AMBANG_AGREGAT = 5;

/**
 * Menyembunyikan agregat yang terlalu kecil.
 *
 * Jumlah penyandang disabilitas per RT yang isinya satu orang bukan agregat —
 * ia adalah penyebutan orang itu dengan cara lain, dan tetangganya tahu siapa.
 */
export function sajikanAgregat(cacah: number): { value: number | null; suppressed: boolean } {
  if (cacah > 0 && cacah < AMBANG_AGREGAT) return { value: null, suppressed: true };
  return { value: cacah, suppressed: false };
}
