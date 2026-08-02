/**
 * Aturan data santri — bagian yang dapat dibuktikan tanpa basis data.
 *
 * Mengikuti pola `cooperative-profile.ts` dan `pesantren-registration.ts`:
 * aturan sebagai fungsi murni, dipanggil dari service yang membaca/menulis
 * schema penyewa lewat SQL mentah.
 */

export const STATUS_SANTRI = ['AKTIF', 'LULUS', 'KELUAR', 'PINDAH'] as const;
export type StatusSantri = (typeof STATUS_SANTRI)[number];

export const STATUS_TINGGAL = ['MUKIM', 'NONMUKIM'] as const;
export type StatusTinggal = (typeof STATUS_TINGGAL)[number];

export const JENIS_KELAMIN = ['L', 'P'] as const;
export type JenisKelamin = (typeof JENIS_KELAMIN)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

/**
 * Data orang tua/wali -- bentuk yang sama dipakai tiga kali (ayah, ibu, wali)
 * pada `MasukanSantri` di bawah, dan pada `pesantren_santri` maupun
 * `pesantren_psb_pendaftar` di basis data. Lihat migrasi
 * `20260802T340000__pesantren__dapodik_santri.sql`.
 */
export interface DataOrangTua {
  nama?: string | null;
  nik?: string | null;
  tahunLahir?: number | null;
  pendidikan?: string | null;
  pekerjaan?: string | null;
  penghasilan?: string | null;
}

export interface MasukanSantri {
  nis?: string;
  namaLengkap?: string;
  namaPanggilan?: string | null;
  jenisKelamin?: string;
  tempatLahir?: string | null;
  tanggalLahir?: string | null;
  unitPendidikanId?: string | null;
  statusTinggal?: string;
  tanggalMasuk?: string | null;
  alamatAsal?: string | null;
  golonganDarah?: string | null;
  catatanAlergi?: string | null;
  catatan?: string | null;

  // -- Kelengkapan setara Dapodik (lihat migrasi di atas) -------------------
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
}

const POLA_NIS = /^[A-Za-z0-9.\-/]{3,32}$/;
/** Diekspor -- dipakai ulang `pesantren-psb.ts` (calon santri, kolom Dapodik sama persis). */
export const POLA_NIK = /^[0-9]{16}$/;
export const POLA_NISN = /^[0-9]{10}$/;
const GOLONGAN_DARAH_SAH = new Set(['A', 'B', 'AB', 'O', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
export const KEBUTUHAN_KHUSUS_SAH = new Set([
  'TIDAK_ADA', 'NETRA', 'RUNGU', 'WICARA', 'GRAHITA', 'DAKSA', 'LARAS', 'GANDA', 'AUTIS', 'LAINNYA',
]);

/**
 * Memeriksa data satu orang tua/wali (NIK 16 digit bila diisi, tahun lahir
 * masuk akal). Dipakai tiga kali oleh `validasiSantri` (ayah, ibu, wali) --
 * fungsi tersendiri supaya pesan galatnya konsisten untuk ketiganya, bukan
 * ditulis ulang tiga kali dengan risiko berbeda pesan tanpa alasan.
 */
export function validasiOrangTua(field: string, label: string, data: DataOrangTua | undefined, galat: Galat[]): void {
  if (!data) return;
  const nik = (data.nik ?? '').trim();
  if (nik && !POLA_NIK.test(nik)) {
    galat.push({ field: `${field}.nik`, code: 'TIDAK_SAH', message: `NIK ${label} harus 16 digit angka.` });
  }
  if (data.tahunLahir != null && (data.tahunLahir < 1900 || data.tahunLahir > new Date().getFullYear())) {
    galat.push({ field: `${field}.tahunLahir`, code: 'TIDAK_SAH', message: `Tahun lahir ${label} tidak masuk akal.` });
  }
}

/**
 * Memeriksa seluruh masukan sekaligus, sesuai pola pendaftaran pesantren:
 * mengembalikan SEMUA galat, bukan yang pertama.
 */
export function validasiSantri(masukan: MasukanSantri): Galat[] {
  const galat: Galat[] = [];

  const nis = (masukan.nis ?? '').trim();
  if (!nis) {
    galat.push({ field: 'nis', code: 'WAJIB', message: 'Nomor Induk Santri (NIS) wajib diisi.' });
  } else if (!POLA_NIS.test(nis)) {
    galat.push({
      field: 'nis',
      code: 'TIDAK_SAH',
      message: 'NIS hanya boleh huruf, angka, titik, garis miring, dan tanda hubung, 3–32 karakter.',
    });
  }

  const nama = (masukan.namaLengkap ?? '').trim();
  if (!nama) {
    galat.push({ field: 'namaLengkap', code: 'WAJIB', message: 'Nama lengkap santri wajib diisi.' });
  } else if (nama.length > 160) {
    galat.push({ field: 'namaLengkap', code: 'TERLALU_PANJANG', message: 'Nama maksimal 160 karakter.' });
  }

  if (!JENIS_KELAMIN.includes(masukan.jenisKelamin as JenisKelamin)) {
    galat.push({
      field: 'jenisKelamin',
      code: 'TIDAK_DIKENALI',
      message: 'Jenis kelamin wajib dipilih (Laki-laki atau Perempuan).',
    });
  }

  if (!STATUS_TINGGAL.includes(masukan.statusTinggal as StatusTinggal)) {
    galat.push({
      field: 'statusTinggal',
      code: 'TIDAK_DIKENALI',
      message: 'Status tinggal wajib dipilih (Mukim atau Nonmukim).',
    });
  }

  if (masukan.tanggalLahir) {
    const d = new Date(masukan.tanggalLahir);
    if (Number.isNaN(d.getTime())) {
      galat.push({ field: 'tanggalLahir', code: 'TIDAK_SAH', message: 'Tanggal lahir tidak sah.' });
    } else if (d.getTime() > Date.now()) {
      galat.push({
        field: 'tanggalLahir',
        code: 'DI_MASA_DEPAN',
        message: 'Tanggal lahir tidak boleh di masa depan.',
      });
    }
  }

  if (masukan.tanggalMasuk) {
    const d = new Date(masukan.tanggalMasuk);
    if (Number.isNaN(d.getTime())) {
      galat.push({ field: 'tanggalMasuk', code: 'TIDAK_SAH', message: 'Tanggal masuk tidak sah.' });
    }
  }

  const golongan = (masukan.golonganDarah ?? '').trim();
  if (golongan && !GOLONGAN_DARAH_SAH.has(golongan.toUpperCase())) {
    galat.push({
      field: 'golonganDarah',
      code: 'TIDAK_DIKENALI',
      message: 'Golongan darah tidak dikenali. Gunakan A, B, AB, O, dengan atau tanpa rhesus (+/-).',
    });
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
