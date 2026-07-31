/**
 * Penagihan langganan eMedik — jenjang tarif pendaftaran pasien.
 *
 * Spesifikasi §4 menetapkan jenjang **marginal bertingkat** (graduated marginal
 * tier), dan perbedaannya dari jenjang biasa menentukan tagihan:
 *
 *     jenjang biasa     : 120 pendaftaran × Rp5.000  = Rp600.000
 *     marginal bertingkat: 49×10.000 + 50×7.500 + 21×5.000 = Rp970.000
 *
 * Angka yang jauh berbeda, dan yang salah akan ditagihkan kepada penyewa.
 * Karena itu perhitungannya dipisahkan sebagai fungsi murni yang dapat
 * diperiksa tangan.
 *
 * Yang membuat perhitungan ini benar bukan rumusnya, melainkan **apa yang
 * dihitung**. Bagian terpenting berkas ini adalah `tertagih()`.
 */

export interface Jenjang {
  /** Batas bawah, inklusif. */
  from: number;
  /** Batas atas, inklusif. `null` berarti tanpa batas. */
  to: number | null;
  /** Tarif per pendaftaran dalam jenjang ini. `null` berarti dinegosiasikan. */
  pricePerRegistration: number | null;
}

/**
 * Jenjang bawaan sesuai spesifikasi §4.
 *
 * 500+ sengaja bernilai `null`, bukan angka. Spesifikasi menyebutnya
 * "contract/negotiation", dan menaruh angka apa pun di sana akan menagihkan
 * tarif yang tidak pernah disepakati siapa pun.
 */
export const JENJANG_BAWAAN: Jenjang[] = [
  { from: 1, to: 49, pricePerRegistration: 10_000 },
  { from: 50, to: 99, pricePerRegistration: 7_500 },
  { from: 100, to: 199, pricePerRegistration: 5_000 },
  { from: 200, to: 499, pricePerRegistration: 3_500 },
  { from: 500, to: null, pricePerRegistration: null },
];

export interface RincianJenjang {
  from: number;
  to: number;
  count: number;
  pricePerRegistration: number;
  subtotal: number;
}

export interface HasilTarif {
  registrations: number;
  lines: RincianJenjang[];
  total: number;
  /** Benar bila sebagian jumlahnya jatuh pada jenjang yang harus dinegosiasikan. */
  requiresNegotiation: boolean;
  negotiationFrom: number | null;
}

/**
 * Menghitung biaya pendaftaran harian.
 *
 * Marginal: setiap jenjang menagih hanya bagian yang jatuh di dalamnya.
 */
export function hitungTarifHarian(
  registrations: number,
  jenjang: Jenjang[] = JENJANG_BAWAAN,
): HasilTarif {
  if (!Number.isFinite(registrations) || registrations <= 0) {
    return {
      registrations: 0,
      lines: [],
      total: 0,
      requiresNegotiation: false,
      negotiationFrom: null,
    };
  }

  const n = Math.floor(registrations);
  const lines: RincianJenjang[] = [];
  let total = 0;
  let requiresNegotiation = false;
  let negotiationFrom: number | null = null;

  const urut = [...jenjang].sort((a, b) => a.from - b.from);

  for (const t of urut) {
    if (n < t.from) break;

    const atas = t.to ?? n;
    const count = Math.min(n, atas) - t.from + 1;
    if (count <= 0) continue;

    if (t.pricePerRegistration === null) {
      /*
       * Jenjang yang harus dinegosiasikan tidak menambah total. Menagih nol
       * jelas salah, tetapi menagih angka karangan lebih buruk: penyewa akan
       * menerima tagihan atas tarif yang tidak pernah ia setujui, dan itu
       * dapat dituntut.
       *
       * Yang benar adalah menandai bahwa tagihan ini belum lengkap dan
       * menuntut kesepakatan, dan itulah yang dilakukan di sini.
       */
      requiresNegotiation = true;
      negotiationFrom = t.from;
      lines.push({ from: t.from, to: atas, count, pricePerRegistration: 0, subtotal: 0 });
      continue;
    }

    const subtotal = count * t.pricePerRegistration;
    total += subtotal;
    lines.push({
      from: t.from,
      to: atas,
      count,
      pricePerRegistration: t.pricePerRegistration,
      subtotal,
    });
  }

  return { registrations: n, lines, total, requiresNegotiation, negotiationFrom };
}

// --- Apa yang tertagih -------------------------------------------------------

export type AlasanTidakTertagih =
  | 'SAMPLE_DATA'
  | 'TRAINING_TENANT'
  | 'CANCELLED_BEFORE_SERVICE'
  | 'DUPLICATE_CORRECTED'
  | 'TEST_PATIENT';

export interface PendaftaranUntukTagihan {
  isSampleData: boolean;
  isTrainingTenant: boolean;
  isTestPatient: boolean;
  /** Dibatalkan SEBELUM satu layanan pun diberikan. */
  cancelledBeforeService: boolean;
  /** Pendaftaran ini adalah hasil koreksi atas pendaftaran ganda. */
  supersededByCorrection: boolean;
}

export interface VerdictTagihan {
  billable: boolean;
  reason?: AlasanTidakTertagih;
  explanation?: string;
}

/**
 * Apakah satu pendaftaran pasien tertagih?
 *
 * **Ini bagian terpenting berkas ini.** Rumus jenjang hanya mengalikan angka;
 * yang menentukan tagihan benar atau salah adalah apa yang masuk hitungan.
 *
 * Spesifikasi §4 menyebut lima yang tidak tertagih. Kelimanya punya sifat yang
 * sama: penyewa tidak memperoleh layanan apa pun darinya. Menagihnya berarti
 * menagih sesuatu yang tidak pernah diberikan — dan penyewa yang menyadarinya
 * akan mempertanyakan seluruh tagihan, bukan hanya baris itu.
 *
 * Urutannya bukan kebetulan: yang paling menyeluruh diperiksa lebih dahulu,
 * supaya alasan yang dilaporkan adalah yang paling menjelaskan.
 */
export function tertagih(p: PendaftaranUntukTagihan): VerdictTagihan {
  if (p.isTrainingTenant) {
    return {
      billable: false,
      reason: 'TRAINING_TENANT',
      explanation: 'Seluruh isi lingkungan pelatihan tidak tertagih.',
    };
  }

  if (p.isSampleData) {
    return {
      billable: false,
      reason: 'SAMPLE_DATA',
      explanation: 'Data contoh dibuat sistem, bukan hasil layanan kepada pasien.',
    };
  }

  if (p.isTestPatient) {
    return {
      billable: false,
      reason: 'TEST_PATIENT',
      explanation: 'Pasien uji dipakai memeriksa konfigurasi, bukan menerima layanan.',
    };
  }

  if (p.supersededByCorrection) {
    return {
      billable: false,
      reason: 'DUPLICATE_CORRECTED',
      explanation:
        'Pendaftaran ini digantikan koreksi atas penggandaan. Menagih keduanya berarti menagih ' +
        'satu kunjungan dua kali.',
    };
  }

  if (p.cancelledBeforeService) {
    return {
      billable: false,
      reason: 'CANCELLED_BEFORE_SERVICE',
      explanation: 'Dibatalkan sebelum satu layanan pun diberikan.',
    };
  }

  return { billable: true };
}

/** Menghitung berapa dari sekumpulan pendaftaran yang tertagih. */
export function hitungTertagih(daftar: PendaftaranUntukTagihan[]): {
  billable: number;
  excluded: number;
  byReason: Record<string, number>;
} {
  const byReason: Record<string, number> = {};
  let billable = 0;

  for (const p of daftar) {
    const v = tertagih(p);
    if (v.billable) {
      billable += 1;
    } else if (v.reason) {
      byReason[v.reason] = (byReason[v.reason] ?? 0) + 1;
    }
  }

  return { billable, excluded: daftar.length - billable, byReason };
}

/**
 * Memeriksa kesehatan susunan jenjang.
 *
 * Jenjang yang berlubang atau bertumpang tindih menghasilkan tagihan yang
 * salah tanpa ada yang menyadarinya — angkanya tetap keluar, hanya nilainya
 * yang keliru. Diperiksa saat konfigurasi disimpan, bukan saat menagih.
 */
export function periksaJenjang(jenjang: Jenjang[]): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (!jenjang.length) return { ok: false, problems: ['Jenjang tarif kosong.'] };

  const urut = [...jenjang].sort((a, b) => a.from - b.from);

  if (urut[0].from !== 1) {
    problems.push(`Jenjang pertama harus mulai dari 1, bukan ${urut[0].from}.`);
  }

  for (let i = 0; i < urut.length; i += 1) {
    const t = urut[i];

    if (t.to !== null && t.to < t.from) {
      problems.push(`Jenjang ${t.from}–${t.to} berbatas terbalik.`);
    }
    if (t.pricePerRegistration !== null && t.pricePerRegistration < 0) {
      problems.push(`Jenjang mulai ${t.from} bertarif negatif.`);
    }

    if (i < urut.length - 1) {
      const berikut = urut[i + 1];
      if (t.to === null) {
        problems.push(`Jenjang mulai ${t.from} tidak berbatas atas tetapi masih ada jenjang sesudahnya.`);
      } else if (berikut.from !== t.to + 1) {
        problems.push(
          berikut.from > t.to + 1
            ? `Ada lubang antara ${t.to} dan ${berikut.from}.`
            : `Jenjang ${t.from}–${t.to} dan ${berikut.from}– bertumpang tindih.`,
        );
      }
    }
  }

  const terakhir = urut[urut.length - 1];
  if (terakhir.to !== null) {
    problems.push('Jenjang terakhir harus tanpa batas atas agar jumlah berapa pun tertampung.');
  }

  return { ok: problems.length === 0, problems };
}
