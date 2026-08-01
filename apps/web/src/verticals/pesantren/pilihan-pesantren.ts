/**
 * Pilihan formulir pendaftaran pesantren — salinan sisi peramban.
 *
 * ## Cacat yang diperbaiki berkas ini
 *
 * Sebelumnya seluruh pilihan pada langkah "Penyelenggaraan" hanya datang dari
 * `GET /public/pesantren/registration-config`. Ketika permintaan itu gagal,
 * lambat, atau ditolak pembatas laju, tiga pertanyaan **wajib** — tipe
 * pesantren, santri yang dilayani, dan jenjang — tergambar sebagai judul tanpa
 * satu pun pilihan di bawahnya.
 *
 * Tidak ada galat, tidak ada keterangan. Yang terlihat pengurus pondok hanyalah
 * formulir yang tampak rusak, pada langkah yang tidak dapat dilewati.
 *
 * ## Mengapa disalin, bukan sekadar ditunggu
 *
 * Isinya katalog tetap: sepuluh jenjang, tiga tipe, tiga jenis santri. Katalog
 * yang tidak berubah tanpa penyebaran baru tidak perlu diambil lewat jaringan
 * untuk dapat digambar. Yang diambil dari peladen tetap dipakai bila datang —
 * ia yang berwenang — tetapi kedatangannya bukan syarat formulir dapat dibaca.
 *
 * ## Yang mengikat kedua salinan
 *
 * `pilihan-pesantren.test.ts` membaca
 * `apps/api/src/modules/public/pesantren-registration.ts` dan gagal bila kodenya
 * berselisih. Kode yang berbeda tidak menghasilkan galat saat digambar: ia
 * menghasilkan kiriman yang ditolak peladen dengan pesan "tidak dikenali",
 * sesudah pengurus mengisi lima langkah.
 */

export interface PilihanPesantren {
  code: string;
  label: string;
}

export const TIPE_PESANTREN_BAWAAN: PilihanPesantren[] = [
  { code: 'SALAFIYAH', label: 'Salafiyah (kajian kitab kuning)' },
  { code: 'KHALAFIYAH', label: 'Khalafiyah (sekolah/madrasah formal)' },
  { code: 'KOMBINASI', label: 'Kombinasi salafiyah dan khalafiyah' },
];

export const SANTRI_DILAYANI_BAWAAN: PilihanPesantren[] = [
  { code: 'PUTRA', label: 'Putra' },
  { code: 'PUTRI', label: 'Putri' },
  { code: 'PUTRA_PUTRI', label: 'Putra dan putri' },
];

export const JENJANG_BAWAAN: PilihanPesantren[] = [
  { code: 'DINIYAH_TAKMILIYAH', label: 'Madrasah Diniyah Takmiliyah' },
  { code: 'DINIYAH_FORMAL', label: 'Pendidikan Diniyah Formal' },
  { code: 'MUADALAH', label: 'Satuan Pendidikan Muadalah' },
  { code: 'TAHFIZ', label: 'Program Tahfiz' },
  { code: 'MI', label: 'MI / SD' },
  { code: 'MTS', label: 'MTs / SMP' },
  { code: 'MA', label: 'MA / SMA / SMK' },
  { code: 'MAHAD_ALY', label: "Ma'had Aly" },
  { code: 'PAUD_RA', label: 'PAUD / RA' },
  { code: 'KESETARAAN', label: 'Pendidikan Kesetaraan (Paket A/B/C)' },
];

export const AFILIASI_BAWAAN: string[] = [
  'Nahdlatul Ulama',
  'Muhammadiyah',
  'Persis',
  'Al-Washliyah',
  'Mathlaul Anwar',
  'Independen',
  'Lainnya',
];

export const DOMAIN_SITUS_BAWAAN = 'santri.info';

/**
 * Memilih daftar yang dipakai.
 *
 * Jawaban peladen menang bila ada isinya. Larik kosong dari peladen diperlakukan
 * sama dengan tidak ada jawaban: formulir yang menggambar nol pilihan sama tidak
 * dapat diisinya dengan formulir yang gagal memuat, dan pengurus pondok tidak
 * dapat membedakan keduanya.
 */
export function pilihanDipakai<T>(dariPeladen: T[] | undefined, bawaan: T[]): T[] {
  return dariPeladen && dariPeladen.length > 0 ? dariPeladen : bawaan;
}

/**
 * Merapikan ketikan menjadi alamat situs yang sah.
 *
 * Orang mengetik "Raudlatul Ulum" atau "RaudlatulUlum" — keduanya wajar, dan
 * keduanya ditolak aturan label DNS. Menolaknya dengan pesan merah memaksa
 * pengurus pondok menebak bentuk yang benar; membetulkannya sambil diketik
 * tidak.
 *
 * Yang dibetulkan hanya yang tidak mungkin dimaksudkan lain: huruf besar
 * menjadi kecil, spasi dan garis bawah menjadi tanda hubung, dan karakter yang
 * tidak pernah sah dibuang.
 *
 * Tanda hubung di ujung TIDAK dibuang. Orang yang baru mengetik "raudlatul-"
 * sedang menuju "raudlatul-ulum"; membuangnya membuat tanda hubung mustahil
 * diketik.
 */
export function rapikanSlug(ketikan: string): string {
  return ketikan
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, 63);
}

/**
 * Merapikan ketikan menjadi nama pengguna yang sah.
 *
 * Bentuknya berbeda dari alamat situs, dan perbedaannya bukan gaya: nama
 * pengguna menjadi nama schema PostgreSQL, yang memakai garis bawah dan tidak
 * boleh memakai tanda hubung.
 *
 * Angka di awal tidak diberi awalan huruf di sini. Membubuhkan huruf sambil
 * orang mengetik memindahkan kursornya dan mengubah apa yang baru saja ia
 * ketik — yang dibetulkan diam-diam saat mengetik haruslah yang tidak
 * mengagetkan. Bentuk yang tersisa salah tetap ditangkap pemeriksa, dengan
 * pesan yang menjelaskan.
 */
export function rapikanNamaPengguna(ketikan: string): string {
  return ketikan
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_+/, '')
    .slice(0, 48);
}
