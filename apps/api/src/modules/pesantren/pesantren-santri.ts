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
}

const POLA_NIS = /^[A-Za-z0-9.\-/]{3,32}$/;
const GOLONGAN_DARAH_SAH = new Set(['A', 'B', 'AB', 'O', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

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

  return galat;
}
