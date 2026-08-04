/**
 * Aturan Puskesmas dan Posyandu: pertumbuhan anak, imunisasi, dan cakupan.
 *
 * Fungsi murni, tanpa basis data.
 *
 * Dua hal menentukan bentuk seluruh berkas ini.
 *
 * 1. **Angka rujukan pertumbuhan TIDAK ditanam di dalam kode.** Ia dimuat dari
 *    tabel rujukan WHO yang disemai sebagai data. Menanam angka hasil taksiran
 *    di dalam kode akan menghasilkan klasifikasi stunting yang tampak resmi dan
 *    sebenarnya karangan — dan klasifikasi itu akan dipakai menentukan siapa
 *    menerima bantuan pangan. Bila rujukannya tidak ada, jawabannya "belum
 *    dapat dinilai", bukan "normal".
 *
 * 2. **Imunisasi yang diberikan terlalu cepat TIDAK melindungi, dan karena itu
 *    tidak boleh dicatat sebagai diberikan.** Anak yang tercatat lengkap tetapi
 *    sebenarnya tidak terlindungi jauh lebih berbahaya daripada anak yang
 *    tercatat belum lengkap: yang kedua akan dikejar petugas, yang pertama
 *    tidak.
 */

// --- Pengukuran pertumbuhan --------------------------------------------------

export type JenisKelamin = 'MALE' | 'FEMALE';

/**
 * Satu baris rujukan WHO dalam bentuk LMS.
 *
 * L = kemencengan Box-Cox, M = median, S = koefisien variasi. Bentuk ini yang
 * dipakai WHO sendiri; menyimpan persentil jadi akan kehilangan kemampuan
 * menghitung z-score di antara persentil yang tersedia.
 */
export interface RujukanLms {
  indicator: 'WEIGHT_FOR_AGE' | 'HEIGHT_FOR_AGE' | 'WEIGHT_FOR_HEIGHT' | 'BMI_FOR_AGE';
  sex: JenisKelamin;
  /** Umur dalam bulan, atau panjang/tinggi dalam cm untuk WEIGHT_FOR_HEIGHT. */
  x: number;
  l: number;
  m: number;
  s: number;
}

/**
 * Menghitung z-score dari nilai LMS.
 *
 * Rumus WHO: bila L ≠ 0, z = ((y/M)^L − 1) / (L·S); bila L = 0, z = ln(y/M)/S.
 * Cabang L = 0 bukan kehalusan matematika — ia yang dipakai tinggi menurut umur,
 * indikator stunting.
 */
export function hitungZ(nilai: number, r: { l: number; m: number; s: number }): number | null {
  if (!(nilai > 0) || !(r.m > 0) || !(r.s > 0)) return null;
  const z = r.l === 0 ? Math.log(nilai / r.m) / r.s : (Math.pow(nilai / r.m, r.l) - 1) / (r.l * r.s);
  return Number.isFinite(z) ? z : null;
}

/**
 * Memilih baris rujukan yang berlaku.
 *
 * Dipilih yang PERSIS cocok, bukan yang terdekat. Rujukan umur 24 bulan
 * dipakaikan pada anak 30 bulan akan menggeser klasifikasinya, dan pergeseran
 * itu tidak akan terlihat oleh siapa pun karena hasilnya tetap berupa angka
 * yang masuk akal.
 */
export function pilihRujukan(
  tabel: RujukanLms[],
  kriteria: { indicator: RujukanLms['indicator']; sex: JenisKelamin; x: number },
): RujukanLms | null {
  const bulat = Math.round(kriteria.x);
  return (
    tabel.find(
      (r) => r.indicator === kriteria.indicator && r.sex === kriteria.sex && r.x === bulat,
    ) ?? null
  );
}

export type StatusGizi =
  | 'SEVERELY_STUNTED'
  | 'STUNTED'
  | 'NORMAL'
  | 'TALL'
  | 'SEVERELY_WASTED'
  | 'WASTED'
  | 'OVERWEIGHT'
  | 'OBESE'
  | 'SEVERELY_UNDERWEIGHT'
  | 'UNDERWEIGHT'
  | 'RISK_OVERWEIGHT'
  | 'UNKNOWN';

export interface HasilPertumbuhan {
  indicator: RujukanLms['indicator'];
  z: number | null;
  status: StatusGizi;
  message: string;
  /** Benar bila menuntut rujukan atau tindak lanjut segera. */
  actionable: boolean;
}

/**
 * Menilai satu indikator pertumbuhan.
 *
 * Ambang batasnya adalah ambang WHO: −3, −2, +1, +2, +3 simpangan baku.
 * Namanya berbeda per indikator, dan perbedaan itu bukan istilah belaka:
 * **stunting itu menahun, wasting itu akut.** Anak pendek karena kurang gizi
 * bertahun-tahun menuntut perbaikan pangan keluarga; anak kurus karena sakit
 * pekan lalu menuntut pengobatan sekarang. Menukar keduanya berarti mengirim
 * bantuan yang keliru kepada anak yang keliru.
 */
export function nilaiPertumbuhan(
  indicator: RujukanLms['indicator'],
  z: number | null,
): HasilPertumbuhan {
  if (z === null) {
    return {
      indicator,
      z: null,
      status: 'UNKNOWN',
      message:
        'Belum dapat dinilai: tidak ada baris rujukan WHO yang berlaku bagi umur dan jenis ' +
        'kelamin ini. Menyebutnya normal akan berbohong.',
      actionable: false,
    };
  }

  if (indicator === 'HEIGHT_FOR_AGE') {
    if (z < -3) {
      return {
        indicator, z, status: 'SEVERELY_STUNTED', actionable: true,
        message: `Sangat pendek (z = ${z.toFixed(2)}). Stunting berat — rujuk dan telusuri sebabnya.`,
      };
    }
    if (z < -2) {
      return {
        indicator, z, status: 'STUNTED', actionable: true,
        message: `Pendek (z = ${z.toFixed(2)}). Stunting — keadaan MENAHUN, tindak lanjutnya perbaikan gizi keluarga.`,
      };
    }
    if (z > 3) {
      return { indicator, z, status: 'TALL', actionable: false, message: `Tinggi (z = ${z.toFixed(2)}).` };
    }
    return { indicator, z, status: 'NORMAL', actionable: false, message: `Normal (z = ${z.toFixed(2)}).` };
  }

  if (indicator === 'WEIGHT_FOR_HEIGHT' || indicator === 'BMI_FOR_AGE') {
    if (z < -3) {
      return {
        indicator, z, status: 'SEVERELY_WASTED', actionable: true,
        message: `Gizi buruk (z = ${z.toFixed(2)}). Keadaan AKUT — perlu penanganan sekarang, bukan penyuluhan.`,
      };
    }
    if (z < -2) {
      return {
        indicator, z, status: 'WASTED', actionable: true,
        message: `Gizi kurang (z = ${z.toFixed(2)}). Keadaan akut — periksa penyakit penyerta.`,
      };
    }
    if (z > 3) {
      return { indicator, z, status: 'OBESE', actionable: true, message: `Obesitas (z = ${z.toFixed(2)}).` };
    }
    if (z > 2) {
      return { indicator, z, status: 'OVERWEIGHT', actionable: true, message: `Gizi lebih (z = ${z.toFixed(2)}).` };
    }
    if (z > 1) {
      return {
        indicator, z, status: 'RISK_OVERWEIGHT', actionable: false,
        message: `Berisiko gizi lebih (z = ${z.toFixed(2)}).`,
      };
    }
    return { indicator, z, status: 'NORMAL', actionable: false, message: `Gizi baik (z = ${z.toFixed(2)}).` };
  }

  // WEIGHT_FOR_AGE — berat menurut umur.
  if (z < -3) {
    return {
      indicator, z, status: 'SEVERELY_UNDERWEIGHT', actionable: true,
      message: `Berat badan sangat kurang (z = ${z.toFixed(2)}).`,
    };
  }
  if (z < -2) {
    return {
      indicator, z, status: 'UNDERWEIGHT', actionable: true,
      message: `Berat badan kurang (z = ${z.toFixed(2)}).`,
    };
  }
  return { indicator, z, status: 'NORMAL', actionable: false, message: `Berat badan normal (z = ${z.toFixed(2)}).` };
}

/**
 * Cara mengukur panjang atau tinggi badan, menurut umur.
 *
 * Di bawah 24 bulan diukur BERBARING; 24 bulan ke atas diukur BERDIRI.
 * Selisihnya sekitar 0,7 cm — kecil, tetapi cukup untuk memindahkan anak
 * melintasi ambang −2 simpangan baku, dan ambang itulah yang menentukan ia
 * masuk hitungan stunting atau tidak.
 */
export function caraUkurTinggi(ageMonths: number): 'RECUMBENT' | 'STANDING' {
  return ageMonths < 24 ? 'RECUMBENT' : 'STANDING';
}

/**
 * Membetulkan pengukuran yang caranya tidak sesuai umur.
 *
 * Dibetulkan, bukan ditolak. Menolaknya akan membuat kader mengulang pengukuran
 * pada bayi yang sudah menangis — dan yang lebih sering terjadi, membuat kader
 * mengubah umurnya supaya lewat.
 */
export function betulkanTinggi(input: {
  value: number;
  measuredAs: 'RECUMBENT' | 'STANDING';
  ageMonths: number;
}): { value: number; adjusted: boolean; note?: string } {
  const seharusnya = caraUkurTinggi(input.ageMonths);
  if (input.measuredAs === seharusnya) return { value: input.value, adjusted: false };

  if (seharusnya === 'STANDING' && input.measuredAs === 'RECUMBENT') {
    return {
      value: Number((input.value - 0.7).toFixed(1)),
      adjusted: true,
      note: 'Diukur berbaring pada umur ≥ 24 bulan; dikurangi 0,7 cm sesuai standar WHO.',
    };
  }
  return {
    value: Number((input.value + 0.7).toFixed(1)),
    adjusted: true,
    note: 'Diukur berdiri pada umur < 24 bulan; ditambah 0,7 cm sesuai standar WHO.',
  };
}

/**
 * Apakah berat badan tidak naik dari penimbangan sebelumnya.
 *
 * "Tidak naik dua kali berturut-turut" adalah penanda yang dipakai Posyandu
 * jauh sebelum z-score mana pun, dan ia masih yang paling berguna: ia tidak
 * menuntut tabel rujukan, tidak menuntut umur yang tepat, dan dapat dilihat
 * kader dari buku KMS di tangannya.
 */
export function beratTidakNaik(
  timbangan: Array<{ measuredAt: string; weightKg: number }>,
): { flat: boolean; consecutive: number; message?: string } {
  const urut = [...timbangan].sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt));
  let beruntun = 0;
  for (let i = urut.length - 1; i > 0; i -= 1) {
    if (urut[i].weightKg <= urut[i - 1].weightKg) beruntun += 1;
    else break;
  }

  if (beruntun >= 2) {
    return {
      flat: true,
      consecutive: beruntun,
      message:
        `Berat badan tidak naik ${beruntun} kali penimbangan berturut-turut. Rujuk ke ` +
        'Puskesmas — ini penanda paling dini yang dapat dilihat tanpa tabel rujukan apa pun.',
    };
  }
  return { flat: false, consecutive: beruntun };
}

// --- Imunisasi ---------------------------------------------------------------

export interface JadwalImunisasi {
  vaccineCode: string;
  doseNumber: number;
  /** Umur paling awal boleh diberikan, dalam hari. */
  minAgeDays: number;
  /** Jarak paling dekat dari dosis sebelumnya, dalam hari. */
  minIntervalDays?: number | null;
  /** Umur yang dianjurkan, dalam hari. */
  recommendedAgeDays?: number | null;
}

export type PutusanImunisasi = {
  allowed: boolean;
  reason?: 'TOO_YOUNG' | 'INTERVAL_TOO_SHORT' | 'ALREADY_GIVEN' | 'OUT_OF_ORDER';
  message?: string;
  /** Tanggal paling awal boleh diberikan, bila ditolak karena waktu. */
  earliestDate?: string;
};

/**
 * Boleh atau tidaknya satu dosis vaksin diberikan hari ini.
 *
 * Vaksin yang diberikan sebelum umur minimum atau sebelum jarak minimum **tidak
 * membentuk kekebalan yang cukup** — dan yang lebih berbahaya, ia akan tercatat
 * sebagai diberikan. Anak itu lalu tampak lengkap di laporan cakupan, tidak
 * akan dikejar petugas, dan tidak terlindungi.
 *
 * Karena itu jawabannya penolakan beserta tanggal paling awalnya, bukan
 * peringatan yang dapat dilewati.
 */
export function bolehImunisasi(input: {
  jadwal: JadwalImunisasi;
  birthDate: string;
  today: string;
  /** Dosis yang sudah pernah diberikan untuk vaksin yang sama. */
  previousDoses: Array<{ doseNumber: number; givenAt: string }>;
}): PutusanImunisasi {
  const lahir = Date.parse(input.birthDate);
  const kini = Date.parse(input.today);
  if (!Number.isFinite(lahir) || !Number.isFinite(kini)) {
    return { allowed: false, message: 'Tanggal lahir atau tanggal pemberian tidak sah.' };
  }

  const sudah = input.previousDoses.find((d) => d.doseNumber === input.jadwal.doseNumber);
  if (sudah) {
    return {
      allowed: false,
      reason: 'ALREADY_GIVEN',
      message: `Dosis ke-${input.jadwal.doseNumber} sudah diberikan pada ${sudah.givenAt.slice(0, 10)}.`,
    };
  }

  /*
   * Dosis tidak boleh melompat. Dosis kedua yang diberikan sebelum dosis
   * pertama bukan sekadar kacau administrasi: jadwal berikutnya dihitung dari
   * dosis sebelumnya, dan urutan yang kacau membuat seluruh jarak berikutnya
   * salah.
   */
  if (input.jadwal.doseNumber > 1) {
    const sebelumnya = input.previousDoses.filter((d) => d.doseNumber < input.jadwal.doseNumber);
    if (sebelumnya.length < input.jadwal.doseNumber - 1) {
      return {
        allowed: false,
        reason: 'OUT_OF_ORDER',
        message: `Dosis sebelumnya belum lengkap. Berikan dosis ke-${sebelumnya.length + 1} lebih dahulu.`,
      };
    }
  }

  const umurHari = Math.floor((kini - lahir) / 86_400_000);
  if (umurHari < input.jadwal.minAgeDays) {
    const paling = new Date(lahir + input.jadwal.minAgeDays * 86_400_000);
    return {
      allowed: false,
      reason: 'TOO_YOUNG',
      earliestDate: paling.toISOString().slice(0, 10),
      message:
        `Umur anak ${umurHari} hari, sedangkan ${input.jadwal.vaccineCode} dosis ` +
        `ke-${input.jadwal.doseNumber} paling awal pada ${input.jadwal.minAgeDays} hari. ` +
        `Paling cepat ${paling.toISOString().slice(0, 10)}. Diberikan sekarang, ia tidak ` +
        'membentuk kekebalan yang cukup tetapi akan tercatat sebagai diberikan.',
    };
  }

  if (input.jadwal.minIntervalDays && input.jadwal.doseNumber > 1) {
    const terakhir = input.previousDoses
      .filter((d) => d.doseNumber < input.jadwal.doseNumber)
      .map((d) => Date.parse(d.givenAt))
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0];

    if (terakhir !== undefined) {
      const jarak = Math.floor((kini - terakhir) / 86_400_000);
      if (jarak < input.jadwal.minIntervalDays) {
        const paling = new Date(terakhir + input.jadwal.minIntervalDays * 86_400_000);
        return {
          allowed: false,
          reason: 'INTERVAL_TOO_SHORT',
          earliestDate: paling.toISOString().slice(0, 10),
          message:
            `Jarak dari dosis sebelumnya baru ${jarak} hari, sedangkan paling dekat ` +
            `${input.jadwal.minIntervalDays} hari. Paling cepat ${paling.toISOString().slice(0, 10)}.`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Dosis yang sudah lewat waktunya.
 *
 * Dihitung dari umur yang dianjurkan, bukan umur minimum. Umur minimum adalah
 * batas keamanan; umur anjuran adalah kapan anak seharusnya sudah terlindungi.
 */
export function imunisasiTertunggak(input: {
  jadwal: JadwalImunisasi[];
  birthDate: string;
  today: string;
  given: Array<{ vaccineCode: string; doseNumber: number }>;
}): Array<{ vaccineCode: string; doseNumber: number; overdueDays: number }> {
  const lahir = Date.parse(input.birthDate);
  const kini = Date.parse(input.today);
  if (!Number.isFinite(lahir) || !Number.isFinite(kini)) return [];

  const sudah = new Set(input.given.map((g) => `${g.vaccineCode}:${g.doseNumber}`));
  const umurHari = Math.floor((kini - lahir) / 86_400_000);

  return input.jadwal
    .filter((j) => !sudah.has(`${j.vaccineCode}:${j.doseNumber}`))
    .filter((j) => j.recommendedAgeDays != null && umurHari > j.recommendedAgeDays)
    .map((j) => ({
      vaccineCode: j.vaccineCode,
      doseNumber: j.doseNumber,
      overdueDays: umurHari - (j.recommendedAgeDays as number),
    }))
    .sort((a, b) => b.overdueDays - a.overdueDays);
}

// --- Cakupan program ---------------------------------------------------------

/**
 * Menghitung cakupan program.
 *
 * Penyebutnya **sasaran**, bukan yang datang. Menghitung "berapa persen yang
 * datang sudah diimunisasi" akan selalu mendekati seratus persen dan tidak
 * memberi tahu apa pun — yang perlu diketahui justru berapa banyak yang tidak
 * pernah datang.
 */
export function hitungCakupan(input: {
  target: number;
  achieved: number;
}): { coverage: number; gap: number; message: string } {
  if (!(input.target > 0)) {
    return {
      coverage: 0,
      gap: 0,
      message: 'Sasaran belum ditetapkan; cakupan tidak dapat dihitung tanpa penyebut.',
    };
  }
  const persen = (input.achieved / input.target) * 100;
  const kurang = Math.max(0, input.target - input.achieved);
  return {
    coverage: Number(persen.toFixed(1)),
    gap: kurang,
    message:
      kurang > 0
        ? `${persen.toFixed(1)}% tercapai. ${kurang} sasaran belum terjangkau.`
        : `${persen.toFixed(1)}% tercapai. Seluruh sasaran terjangkau.`,
  };
}

/**
 * Anak yang perlu dikunjungi ke rumah.
 *
 * Diurutkan menurut apa yang paling mendesak: gizi buruk lebih dahulu, lalu
 * berat yang tidak naik, lalu imunisasi tertunggak paling lama. Kader yang
 * punya waktu untuk lima kunjungan hari ini harus tahu lima siapa.
 */
export function urutkanKunjunganRumah<
  T extends {
    severelyWasted?: boolean;
    stunted?: boolean;
    weightFlat?: boolean;
    overdueDays?: number;
  },
>(anak: T[]): T[] {
  const skor = (a: T) =>
    (a.severelyWasted ? 10_000 : 0) +
    (a.weightFlat ? 5_000 : 0) +
    (a.stunted ? 2_000 : 0) +
    Math.min(1_000, a.overdueDays ?? 0);
  return [...anak].sort((x, y) => skor(y) - skor(x));
}
