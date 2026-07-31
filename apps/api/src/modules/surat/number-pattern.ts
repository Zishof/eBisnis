/**
 * Pola nomor surat.
 *
 * ## Pola yang ditegakkan, bukan contoh
 *
 * Sistem lama menyimpan `contohFormat` — sebuah CONTOH. Contoh tidak dapat
 * dieksekusi: dua orang yang membaca contoh yang sama tetap dapat menuliskan
 * nomor yang berbeda, dan mesin tidak dapat memeriksanya sama sekali.
 *
 * Di sini yang disimpan pola dengan penanda tertutup. Penanda di luar daftar
 * **ditolak**, bukan dibiarkan menjadi teks apa adanya — penanda salah ketik
 * yang lolos akan menghasilkan nomor surat resmi yang memuat `{TAHNU}`, dan
 * nomor itu sudah terlanjur keluar sebelum ada yang menyadarinya.
 */

/** Penanda yang dikenal. Tertutup dengan sengaja. */
export const PLACEHOLDERS = [
  'NOMOR',
  'TAHUN',
  'TAHUN2',
  'BULAN',
  'BULAN_ROMAWI',
  'KODE_KLASIFIKASI',
  'KODE_UNIT',
] as const;

export type Placeholder = (typeof PLACEHOLDERS)[number];

export interface PatternContext {
  number: number;
  padding: number;
  date: Date;
  classificationCode?: string | null;
  unitCode?: string | null;
}

const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/**
 * Memeriksa pola sebelum disimpan.
 *
 * Dijalankan saat skema penomoran dibuat atau diubah — bukan saat surat
 * diterbitkan. Pola yang salah harus ditolak pada saat ia ditulis, karena pada
 * saat surat diterbitkan sudah terlambat: orangnya sedang menunggu nomor, dan
 * menolak di situ berarti pekerjaannya berhenti.
 */
export function validatePattern(pattern: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const ditemukan = [...pattern.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
  for (const nama of ditemukan) {
    if (!PLACEHOLDERS.includes(nama as Placeholder)) {
      errors.push(
        `Penanda {${nama}} tidak dikenal. Yang tersedia: ${PLACEHOLDERS.map((p) => `{${p}}`).join(', ')}.`,
      );
    }
  }

  if (!ditemukan.includes('NOMOR')) {
    // Tanpa {NOMOR}, setiap surat memperoleh nomor yang sama persis.
    errors.push('Pola wajib memuat {NOMOR}; tanpa itu seluruh surat bernomor sama.');
  }

  // Kurung yang tidak berpasangan menandai penanda yang belum selesai ditulis.
  const buka = (pattern.match(/\{/g) ?? []).length;
  const tutup = (pattern.match(/\}/g) ?? []).length;
  if (buka !== tutup) {
    errors.push('Kurung kurawal tidak berpasangan.');
  }

  if (pattern.trim().length === 0) {
    errors.push('Pola tidak boleh kosong.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Menyusun nomor dari pola.
 *
 * Fungsi murni: hasilnya hanya bergantung pada masukannya. Itu yang membuatnya
 * dapat diuji tanpa basis data, dan yang membuat contoh pratinjau pada
 * antarmuka pasti sama dengan nomor yang kelak benar-benar diterbitkan.
 */
export function renderPattern(pattern: string, context: PatternContext): string {
  const bulan = context.date.getMonth();
  const tahun = context.date.getFullYear();

  const nilai: Record<Placeholder, string> = {
    NOMOR: String(context.number).padStart(context.padding, '0'),
    TAHUN: String(tahun),
    TAHUN2: String(tahun).slice(-2),
    BULAN: String(bulan + 1).padStart(2, '0'),
    BULAN_ROMAWI: ROMAWI[bulan],
    // Penanda yang nilainya tidak tersedia menjadi kosong, bukan menjadi
    // "undefined". Nomor surat resmi yang memuat kata "undefined" adalah cacat
    // yang terbawa ke luar organisasi.
    KODE_KLASIFIKASI: context.classificationCode ?? '',
    KODE_UNIT: context.unitCode ?? '',
  };

  return pattern.replace(/\{([^}]*)\}/g, (utuh, nama: string) =>
    PLACEHOLDERS.includes(nama as Placeholder) ? nilai[nama as Placeholder] : utuh,
  );
}

/**
 * Kunci periode penghitung.
 *
 * Menentukan kapan penomoran kembali ke angka awal. Dipisahkan sebagai fungsi
 * murni supaya aturannya dapat diuji langsung — kesalahan di sini menghasilkan
 * penomoran yang tidak pernah reset, atau reset pada waktu yang salah, dan
 * keduanya baru ketahuan berbulan-bulan kemudian.
 */
export function periodKeyFor(resetPeriod: string, date: Date): string {
  switch (resetPeriod) {
    case 'MONTHLY':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    case 'YEARLY':
      return String(date.getFullYear());
    case 'NEVER':
      return 'ALL';
    default:
      // Nilai tak dikenal diperlakukan seperti NEVER, bukan dilempar sebagai
      // galat: menolak menerbitkan nomor karena satu kolom konfigurasi
      // bernilai aneh akan menghentikan pekerjaan orang. Nomor yang berlanjut
      // selamanya tetap nomor yang sah.
      return 'ALL';
  }
}

/**
 * Contoh nomor untuk pratinjau.
 *
 * Memakai angka 1 dan tanggal yang diberikan, sehingga administrator melihat
 * bentuk sebenarnya sebelum menyimpan polanya.
 */
export function previewPattern(
  pattern: string,
  padding: number,
  date: Date,
  classificationCode = 'KP',
  unitCode = 'HO',
): string {
  return renderPattern(pattern, { number: 1, padding, date, classificationCode, unitCode });
}
