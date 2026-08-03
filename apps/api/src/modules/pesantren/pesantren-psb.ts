/**
 * Aturan PSB/PPDB (EP-O2) — bagian yang dapat dibuktikan tanpa basis data.
 *
 * Mengikuti pola `pesantren-nilai.ts`/`pesantren-santri.ts`: aturan sebagai
 * fungsi murni, dipanggil dari service yang membaca/menulis schema penyewa
 * lewat SQL mentah.
 */

import {
  DataOrangTua,
  KEBUTUHAN_KHUSUS_SAH,
  POLA_NIK,
  POLA_NISN,
  validasiOrangTua,
} from './pesantren-santri';

export const STATUS_GELOMBANG = ['DRAFT', 'DIBUKA', 'DITUTUP', 'SELESAI'] as const;
export type StatusGelombang = (typeof STATUS_GELOMBANG)[number];

export const STATUS_PENDAFTAR = [
  'TERDAFTAR',
  'VERIFIKASI',
  'DIJADWALKAN',
  'LULUS_SELEKSI',
  'TIDAK_LULUS',
  'DITERIMA',
  'DAFTAR_ULANG',
  'DIBATALKAN',
] as const;
export type StatusPendaftar = (typeof STATUS_PENDAFTAR)[number];

export const JENIS_JADWAL = ['UJIAN_TULIS', 'TES_BACA_QURAN', 'WAWANCARA', 'TES_KESEHATAN', 'LAINNYA'] as const;
export type JenisJadwal = (typeof JENIS_JADWAL)[number];

export const STATUS_JADWAL = ['DIJADWALKAN', 'SELESAI', 'TIDAK_HADIR', 'DIBATALKAN'] as const;
export type StatusJadwal = (typeof STATUS_JADWAL)[number];

export const JENIS_KELAMIN_PENDAFTAR = ['L', 'P'] as const;

export interface Galat {
  field: string;
  code: string;
  message: string;
}

const POLA_KODE_GELOMBANG = /^[A-Za-z0-9_-]{1,16}$/;

export interface MasukanGelombang {
  tahunAjaranId?: string;
  /**
   * Opsional -- kosong berarti gelombang berlaku lintas seluruh unit
   * (perilaku lama). Diisi bila jadwal/kuota/biayanya khusus satu unit
   * (mis. gelombang MI berbeda dari gelombang Madrasah Diniyah).
   */
  unitPendidikanId?: string | null;
  kode?: string;
  nama?: string;
  tanggalBuka?: string;
  tanggalTutup?: string;
  kuota?: number | null;
  biayaPendaftaran?: number | null;
  formSchema?: unknown[] | null;
}

export function validasiGelombang(masukan: MasukanGelombang): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.tahunAjaranId ?? '').trim()) {
    galat.push({ field: 'tahunAjaranId', code: 'WAJIB', message: 'Tahun ajaran wajib dipilih.' });
  }

  const kode = (masukan.kode ?? '').trim();
  if (!kode) {
    galat.push({ field: 'kode', code: 'WAJIB', message: 'Kode gelombang wajib diisi.' });
  } else if (!POLA_KODE_GELOMBANG.test(kode)) {
    galat.push({
      field: 'kode',
      code: 'TIDAK_SAH',
      message: 'Kode gelombang hanya boleh huruf, angka, garis bawah, dan tanda hubung, maksimal 16 karakter.',
    });
  }

  if (!(masukan.nama ?? '').trim()) {
    galat.push({ field: 'nama', code: 'WAJIB', message: 'Nama gelombang wajib diisi.' });
  }

  if (!masukan.tanggalBuka) {
    galat.push({ field: 'tanggalBuka', code: 'WAJIB', message: 'Tanggal buka wajib diisi.' });
  }
  if (!masukan.tanggalTutup) {
    galat.push({ field: 'tanggalTutup', code: 'WAJIB', message: 'Tanggal tutup wajib diisi.' });
  }
  if (masukan.tanggalBuka && masukan.tanggalTutup) {
    const buka = new Date(masukan.tanggalBuka);
    const tutup = new Date(masukan.tanggalTutup);
    if (!Number.isNaN(buka.getTime()) && !Number.isNaN(tutup.getTime()) && tutup.getTime() <= buka.getTime()) {
      galat.push({
        field: 'tanggalTutup',
        code: 'SEBELUM_BUKA',
        message: 'Tanggal tutup harus setelah tanggal buka.',
      });
    }
  }

  if (masukan.kuota != null && masukan.kuota <= 0) {
    galat.push({ field: 'kuota', code: 'TIDAK_SAH', message: 'Kuota harus lebih besar dari nol bila diisi.' });
  }

  if (masukan.biayaPendaftaran != null && masukan.biayaPendaftaran < 0) {
    galat.push({
      field: 'biayaPendaftaran',
      code: 'TIDAK_SAH',
      message: 'Biaya pendaftaran tidak boleh negatif.',
    });
  }

  if (masukan.formSchema != null && !Array.isArray(masukan.formSchema)) {
    galat.push({ field: 'formSchema', code: 'TIDAK_SAH', message: 'Skema formulir harus berupa array field.' });
  }

  return galat;
}

export interface MasukanPendaftar {
  gelombangId?: string;
  namaLengkap?: string;
  jenisKelamin?: string;
  tempatLahir?: string | null;
  tanggalLahir?: string | null;
  namaOrangTua?: string | null;
  noHpOrangTua?: string | null;
  alamat?: string | null;
  asalSekolah?: string | null;
  unitPendidikanTujuanId?: string | null;

  // -- Kelengkapan setara Dapodik, sama persis dengan `MasukanSantri` -------
  // (lihat migrasi `20260802T340000__pesantren__dapodik_santri.sql`, yang
  // menambahkan kolom yang sama pada `pesantren_psb_pendaftar`).
  nik?: string | null;
  nisn?: string | null;
  nipd?: string | null;
  agama?: string | null;
  kewarganegaraan?: string | null;
  kebutuhanKhusus?: string | null;
  anakKe?: number | null;
  jumlahSaudara?: number | null;
  alatTransportasi?: string | null;
  jarakTempatTinggalKm?: number | null;
  telepon?: string | null;
  hp?: string | null;
  email?: string | null;
  penerimaKip?: boolean;
  nomorKip?: string | null;
  penerimaKks?: boolean;
  nomorKks?: string | null;
  nomorKk?: string | null;
  ayah?: DataOrangTua;
  ibu?: DataOrangTua;
  wali?: DataOrangTua;
  jawabanTambahan?: Record<string, unknown> | null;
}

export function validasiPendaftar(masukan: MasukanPendaftar): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.gelombangId ?? '').trim()) {
    galat.push({ field: 'gelombangId', code: 'WAJIB', message: 'Gelombang wajib dipilih.' });
  }

  const nama = (masukan.namaLengkap ?? '').trim();
  if (!nama) {
    galat.push({ field: 'namaLengkap', code: 'WAJIB', message: 'Nama lengkap calon santri wajib diisi.' });
  } else if (nama.length > 160) {
    galat.push({ field: 'namaLengkap', code: 'TERLALU_PANJANG', message: 'Nama maksimal 160 karakter.' });
  }

  if (!JENIS_KELAMIN_PENDAFTAR.includes(masukan.jenisKelamin as 'L' | 'P')) {
    galat.push({
      field: 'jenisKelamin',
      code: 'TIDAK_DIKENALI',
      message: 'Jenis kelamin wajib dipilih (Laki-laki atau Perempuan).',
    });
  }

  if (masukan.tanggalLahir) {
    const d = new Date(masukan.tanggalLahir);
    if (Number.isNaN(d.getTime())) {
      galat.push({ field: 'tanggalLahir', code: 'TIDAK_SAH', message: 'Tanggal lahir tidak sah.' });
    } else if (d.getTime() > Date.now()) {
      galat.push({ field: 'tanggalLahir', code: 'DI_MASA_DEPAN', message: 'Tanggal lahir tidak boleh di masa depan.' });
    }
  }

  // -- Kelengkapan setara Dapodik ------------------------------------------
  const nik = (masukan.nik ?? '').trim();
  if (nik && !POLA_NIK.test(nik)) {
    galat.push({ field: 'nik', code: 'TIDAK_SAH', message: 'NIK harus 16 digit angka.' });
  }

  const nisn = (masukan.nisn ?? '').trim();
  if (nisn && !POLA_NISN.test(nisn)) {
    galat.push({ field: 'nisn', code: 'TIDAK_SAH', message: 'NISN harus 10 digit angka.' });
  }

  const nomorKk = (masukan.nomorKk ?? '').trim();
  if (nomorKk && !POLA_NIK.test(nomorKk)) {
    galat.push({ field: 'nomorKk', code: 'TIDAK_SAH', message: 'Nomor Kartu Keluarga harus 16 digit angka.' });
  }

  const kebutuhanKhusus = (masukan.kebutuhanKhusus ?? '').trim();
  if (kebutuhanKhusus && !KEBUTUHAN_KHUSUS_SAH.has(kebutuhanKhusus.toUpperCase())) {
    galat.push({
      field: 'kebutuhanKhusus',
      code: 'TIDAK_DIKENALI',
      message: 'Jenis kebutuhan khusus tidak dikenali.',
    });
  }

  if (masukan.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(masukan.email)) {
    galat.push({ field: 'email', code: 'TIDAK_SAH', message: 'Alamat surel tidak sah.' });
  }

  validasiOrangTua('ayah', 'ayah', masukan.ayah, galat);
  validasiOrangTua('ibu', 'ibu', masukan.ibu, galat);
  validasiOrangTua('wali', 'wali', masukan.wali, galat);

  return galat;
}

/**
 * Subset kolom yang boleh diubah PENDAFTAR SENDIRI lewat portal PSB
 * (`PesantrenPsbPortalController`) -- BUKAN pengurus. Sengaja tidak
 * mengikutkan `namaLengkap`, `jenisKelamin`, `tanggalLahir` (dipakai
 * sebagai kata sandi masuk, lihat `PsbApplicantAuthGuard`), `nik`/`nisn`,
 * `gelombangId`, atau `status` -- itu semua kewenangan pengurus lewat
 * `MasukanPendaftar`/`ubahStatusPendaftar`, bukan calon santri.
 */
export interface MasukanBiodataSendiri {
  alamat?: string | null;
  telepon?: string | null;
  hp?: string | null;
  email?: string | null;
  namaOrangTua?: string | null;
  noHpOrangTua?: string | null;
  ayah?: DataOrangTua;
  ibu?: DataOrangTua;
  wali?: DataOrangTua;
}

export function validasiBiodataSendiri(masukan: MasukanBiodataSendiri): Galat[] {
  const galat: Galat[] = [];

  if (masukan.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(masukan.email)) {
    galat.push({ field: 'email', code: 'TIDAK_SAH', message: 'Alamat surel tidak sah.' });
  }

  validasiOrangTua('ayah', 'ayah', masukan.ayah, galat);
  validasiOrangTua('ibu', 'ibu', masukan.ibu, galat);
  validasiOrangTua('wali', 'wali', masukan.wali, galat);

  return galat;
}

export interface MasukanJadwal {
  pendaftarId?: string;
  jenis?: string;
  tanggal?: string;
  waktuMulai?: string | null;
  waktuSelesai?: string | null;
  lokasi?: string | null;
  penguji?: string | null;
}

export function validasiJadwal(masukan: MasukanJadwal): Galat[] {
  const galat: Galat[] = [];

  if (!(masukan.pendaftarId ?? '').trim()) {
    galat.push({ field: 'pendaftarId', code: 'WAJIB', message: 'Pendaftar wajib dipilih.' });
  }

  if (!JENIS_JADWAL.includes(masukan.jenis as JenisJadwal)) {
    galat.push({ field: 'jenis', code: 'TIDAK_DIKENALI', message: 'Jenis jadwal tidak dikenali.' });
  }

  if (!masukan.tanggal) {
    galat.push({ field: 'tanggal', code: 'WAJIB', message: 'Tanggal jadwal wajib diisi.' });
  } else if (Number.isNaN(new Date(masukan.tanggal).getTime())) {
    galat.push({ field: 'tanggal', code: 'TIDAK_SAH', message: 'Tanggal jadwal tidak sah.' });
  }

  if (masukan.waktuMulai && masukan.waktuSelesai && masukan.waktuSelesai <= masukan.waktuMulai) {
    galat.push({
      field: 'waktuSelesai',
      code: 'SEBELUM_MULAI',
      message: 'Waktu selesai harus setelah waktu mulai.',
    });
  }

  return galat;
}

export interface HasilJadwal {
  status?: string;
  nilai?: number | null;
  catatanHasil?: string | null;
}

export function validasiHasilJadwal(masukan: HasilJadwal): Galat[] {
  const galat: Galat[] = [];

  if (!STATUS_JADWAL.includes(masukan.status as StatusJadwal)) {
    galat.push({ field: 'status', code: 'TIDAK_DIKENALI', message: 'Status jadwal tidak dikenali.' });
  }

  if (masukan.nilai != null && (masukan.nilai < 0 || masukan.nilai > 100)) {
    galat.push({ field: 'nilai', code: 'TIDAK_SAH', message: 'Nilai harus antara 0 dan 100.' });
  }

  return galat;
}

/**
 * Membentuk nomor pendaftaran dari kode tahun ajaran, kode gelombang, dan
 * urutan yang sudah dinaikkan atomik oleh service (`nomor_urut_terakhir`).
 * Format: `PSB-{tahunAjaranCode}-{gelombangKode}-{00001}`.
 */
export function bentukNomorPendaftaran(tahunAjaranCode: string, gelombangKode: string, urutan: number): string {
  const nomorUrut = String(urutan).padStart(5, '0');
  return `PSB-${tahunAjaranCode}-${gelombangKode}-${nomorUrut}`;
}
