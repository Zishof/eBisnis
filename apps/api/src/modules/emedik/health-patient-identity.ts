/**
 * Aturan identitas pasien — fungsi murni, tanpa basis data.
 *
 * Bagian paling berbahaya dari seluruh vertical kesehatan ada di berkas ini.
 * Identitas ganda menjalar ke setiap konteks lain: obat diberikan kepada orang
 * yang salah, hasil laboratorium masuk ke berkas yang salah, alergi tidak
 * terlihat saat meresepkan.
 *
 * Karena itu aturannya dipisahkan sebagai fungsi murni yang dapat diuji tanpa
 * basis data, tanpa jaringan, dan tanpa keberuntungan.
 */

export type Gender = 'MALE' | 'FEMALE' | 'UNKNOWN';
export type IdentityConfidence = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERIFIED';

export interface CalonPasien {
  fullName: string;
  birthDate?: string | null;
  gender?: Gender | null;
  nik?: string | null;
  phone?: string | null;
  motherName?: string | null;
}

// --- Normalisasi -------------------------------------------------------------

/**
 * Menormalkan nama untuk pembandingan.
 *
 * Nama Indonesia sering ditulis berbeda untuk orang yang sama: gelar yang
 * kadang disertakan, "Muhammad" versus "Muhamad" versus "M.", spasi ganda.
 * Membandingkan mentah-mentah akan melewatkan hampir semua penggandaan yang
 * nyata.
 */
export function normalkanNama(nama: string): string {
  return nama
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    // Gelar dan sapaan dibuang. Dipisahkan sebagai kata utuh supaya "Harry"
    // tidak kehilangan "hj" di tengahnya.
    .replace(/\b(dr|drg|prof|ir|h|hj|tn|ny|sdr|sdri|an|alm|almh)\.?\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Menormalkan nomor telepon Indonesia ke satu bentuk. */
export function normalkanTelepon(telepon: string): string {
  const angka = telepon.replace(/\D/g, '');
  if (angka.startsWith('62')) return '0' + angka.slice(2);
  if (angka.startsWith('0')) return angka;
  if (angka.startsWith('8')) return '0' + angka;
  return angka;
}

/**
 * Apakah NIK berbentuk sah?
 *
 * Hanya memeriksa BENTUKNYA — 16 angka, tanggal lahir yang masuk akal. Tidak
 * memeriksa keberadaannya; itu urusan pencocokan ke Dukcapil, dan sampai
 * pencocokan itu tersedia, NIK yang diketik petugas tetap NIK yang belum
 * terverifikasi.
 */
export function nikSahBentuknya(nik: string): boolean {
  if (!/^\d{16}$/.test(nik)) return false;

  // Digit 7-12 adalah tanggal lahir DDMMYY; perempuan ditambah 40 pada harinya.
  const hari = Number(nik.slice(6, 8));
  const bulan = Number(nik.slice(8, 10));
  const hariAsli = hari > 40 ? hari - 40 : hari;

  if (hariAsli < 1 || hariAsli > 31) return false;
  if (bulan < 1 || bulan > 12) return false;

  // Enam digit pertama adalah kode wilayah; nol seluruhnya tidak mungkin.
  if (/^0{6}/.test(nik)) return false;

  return true;
}

// --- Kemiripan ---------------------------------------------------------------

/** Jarak Levenshtein, dibatasi supaya tidak mahal pada nama panjang. */
function jarakEdit(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let sebelumnya = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const kini = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const biaya = a[i - 1] === b[j - 1] ? 0 : 1;
      kini[j] = Math.min(kini[j - 1] + 1, sebelumnya[j] + 1, sebelumnya[j - 1] + biaya);
    }
    sebelumnya = kini;
  }
  return sebelumnya[b.length];
}

/** Kemiripan dua nama, 0..1. */
export function kemiripanNama(a: string, b: string): number {
  const x = normalkanNama(a);
  const y = normalkanNama(b);
  if (!x || !y) return 0;
  if (x === y) return 1;

  /*
   * Nama yang sama dengan urutan berbeda dianggap sangat mirip. "Siti Aminah"
   * dan "Aminah Siti" hampir pasti orang yang sama pada berkas yang berbeda —
   * urutan nama depan dan belakang tidak konsisten di Indonesia.
   */
  const kataX = x.split(' ').sort().join(' ');
  const kataY = y.split(' ').sort().join(' ');
  if (kataX === kataY) return 0.95;

  const maks = Math.max(x.length, y.length);
  return Math.max(0, 1 - jarakEdit(x, y) / maks);
}

// --- Penilaian penggandaan ---------------------------------------------------

export interface AlasanCocok {
  field: string;
  weight: number;
  detail: string;
}

export interface SkorPenggandaan {
  score: number;
  reasons: AlasanCocok[];
  /** Benar bila hampir pasti orang yang sama dan wajib ditelaah sebelum lanjut. */
  blocking: boolean;
}

/**
 * Seberapa mungkin dua data ini orang yang sama.
 *
 * Bobotnya dipilih dengan satu pertimbangan: **melewatkan penggandaan jauh
 * lebih berbahaya daripada menanyakannya.** Petugas yang ditanya "apakah ini
 * orang yang sama?" kehilangan sepuluh detik; petugas yang tidak ditanya
 * membuat rekam medis kedua yang alerginya tidak terlihat selamanya.
 *
 * Karena itu ambangnya rendah dan bobot NIK mutlak.
 */
export function skorPenggandaan(a: CalonPasien, b: CalonPasien): SkorPenggandaan {
  const reasons: AlasanCocok[] = [];
  let score = 0;

  // NIK sama = orang yang sama. Tidak ada pertimbangan lain yang dapat
  // membatalkannya, karena satu NIK memang hanya milik satu orang.
  if (a.nik && b.nik && a.nik === b.nik) {
    return {
      score: 100,
      reasons: [{ field: 'nik', weight: 100, detail: 'NIK sama persis' }],
      blocking: true,
    };
  }

  const mirip = kemiripanNama(a.fullName, b.fullName);
  if (mirip >= 0.99) {
    score += 45;
    reasons.push({ field: 'name', weight: 45, detail: 'nama sama persis' });
  } else if (mirip >= 0.9) {
    score += 35;
    reasons.push({ field: 'name', weight: 35, detail: 'nama sangat mirip' });
  } else if (mirip >= 0.8) {
    score += 20;
    reasons.push({ field: 'name', weight: 20, detail: 'nama mirip' });
  }

  if (a.birthDate && b.birthDate && a.birthDate === b.birthDate) {
    score += 30;
    reasons.push({ field: 'birthDate', weight: 30, detail: 'tanggal lahir sama' });
  }

  if (a.gender && b.gender && a.gender === b.gender && a.gender !== 'UNKNOWN') {
    score += 5;
    reasons.push({ field: 'gender', weight: 5, detail: 'jenis kelamin sama' });
  }

  if (a.phone && b.phone && normalkanTelepon(a.phone) === normalkanTelepon(b.phone)) {
    score += 20;
    reasons.push({ field: 'phone', weight: 20, detail: 'nomor telepon sama' });
  }

  /*
   * Nama ibu kandung adalah pembeda terkuat sesudah NIK, dan justru itulah
   * gunanya ditanyakan saat pendaftaran. Dua orang bernama sama dengan tanggal
   * lahir sama masih mungkin; ditambah nama ibu yang sama, hampir tidak.
   */
  if (a.motherName && b.motherName && kemiripanNama(a.motherName, b.motherName) >= 0.9) {
    score += 25;
    reasons.push({ field: 'motherName', weight: 25, detail: 'nama ibu sama' });
  }

  score = Math.min(100, score);

  // Nama sama persis DAN tanggal lahir sama sudah cukup untuk menahan
  // pendaftaran sampai petugas menegaskan.
  const blocking = score >= 75;

  return { score, reasons, blocking };
}

/** Ambang yang dipakai layanan. */
export const AMBANG_DUGAAN = 50;
export const AMBANG_TAHAN = 75;

/**
 * Keyakinan identitas dari apa yang tersedia.
 *
 * Dipakai menandai seberapa dapat dipercaya sebuah baris pasien. Pendaftaran
 * daring tanpa verifikasi menghasilkan keyakinan rendah; itu bukan cacat —
 * yang berbahaya adalah memperlakukannya seolah terverifikasi.
 */
export function keyakinanIdentitas(input: {
  nikVerified: boolean;
  hasNik: boolean;
  hasBirthDate: boolean;
  selfRegistered: boolean;
}): IdentityConfidence {
  if (input.nikVerified) return 'VERIFIED';
  if (input.hasNik && input.hasBirthDate && !input.selfRegistered) return 'HIGH';
  if (input.hasBirthDate && !input.selfRegistered) return 'MEDIUM';
  return 'LOW';
}

// --- Nomor rekam medis -------------------------------------------------------

/**
 * Menyusun nomor rekam medis.
 *
 * Berbentuk `<awalan fasilitas>-<urutan berpadding>`. Awalannya disertakan
 * karena satu pasien memiliki nomor berbeda di setiap fasilitas, dan nomor
 * tanpa awalan tidak dapat dibedakan asalnya ketika berkas dirujuk antar
 * fasilitas.
 */
export function susunNomorRekamMedis(awalan: string, urutan: number, padding = 6): string {
  const bersih = awalan.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'MRN';
  return `${bersih}-${String(urutan).padStart(padding, '0')}`;
}

// --- Penggabungan ------------------------------------------------------------

export interface VerdictGabung {
  allowed: boolean;
  message?: string;
}

/**
 * Bolehkah dua rekam medis digabungkan?
 *
 * Penggabungan yang salah lebih berbahaya daripada penggandaan yang dibiarkan:
 * penggandaan menyembunyikan sebagian riwayat, penggabungan yang salah
 * **menempelkan riwayat orang lain** — alergi yang bukan miliknya, diagnosis
 * yang bukan miliknya, golongan darah yang bukan miliknya.
 *
 * Karena itu penolakannya lebih banyak daripada yang mungkin terasa perlu.
 */
export function bolehGabung(input: {
  sourceId: string;
  targetId: string;
  sourceMergedInto: string | null;
  targetMergedInto: string | null;
  sourceDeceasedAt: string | null;
  targetDeceasedAt: string | null;
  sourceNik: string | null;
  targetNik: string | null;
  reason: string;
}): VerdictGabung {
  if (input.sourceId === input.targetId) {
    return { allowed: false, message: 'Rekam medis tidak dapat digabungkan dengan dirinya sendiri.' };
  }

  if (input.sourceMergedInto) {
    return {
      allowed: false,
      message: 'Rekam medis sumber sudah pernah digabungkan. Batalkan penggabungan sebelumnya lebih dahulu.',
    };
  }

  if (input.targetMergedInto) {
    return {
      allowed: false,
      message: 'Rekam medis tujuan sudah digabungkan ke rekam medis lain. Pilih rekam medis induknya.',
    };
  }

  /*
   * Dua NIK berbeda berarti dua orang berbeda, apa pun kemiripan namanya.
   * Menggabungkannya akan menempelkan riwayat medis satu orang kepada orang
   * lain — dan itu tidak dapat dibatalkan dari sisi kerugiannya, meskipun
   * datanya dapat dikembalikan.
   */
  if (input.sourceNik && input.targetNik && input.sourceNik !== input.targetNik) {
    return {
      allowed: false,
      message:
        'Kedua rekam medis memiliki NIK yang berbeda, sehingga bukan orang yang sama. ' +
        'Perbaiki NIK yang keliru lebih dahulu bila salah satu salah ketik.',
    };
  }

  if (!input.reason || input.reason.trim().length < 10) {
    return {
      allowed: false,
      message: 'Penggabungan rekam medis wajib disertai alasan sekurang-kurangnya sepuluh huruf.',
    };
  }

  return { allowed: true };
}

/**
 * Arah penggabungan yang dianjurkan.
 *
 * Rekam medis yang lebih tua dan lebih kaya riwayatnya menjadi tujuan, supaya
 * yang dipindahkan lebih sedikit dan risiko kehilangan lebih kecil.
 */
export function arahGabung(
  a: { id: string; createdAt: string; recordCount: number },
  b: { id: string; createdAt: string; recordCount: number },
): { sourceId: string; targetId: string; reason: string } {
  if (a.recordCount !== b.recordCount) {
    const [target, source] = a.recordCount > b.recordCount ? [a, b] : [b, a];
    return {
      sourceId: source.id,
      targetId: target.id,
      reason: 'rekam medis dengan riwayat lebih banyak dijadikan tujuan',
    };
  }
  const [target, source] = a.createdAt <= b.createdAt ? [a, b] : [b, a];
  return { sourceId: source.id, targetId: target.id, reason: 'rekam medis yang lebih dahulu dibuat dijadikan tujuan' };
}
