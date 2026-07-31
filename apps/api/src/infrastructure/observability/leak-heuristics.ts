/**
 * Analisis kecurigaan kebocoran memori.
 *
 * ## Satu grafik naik bukan bukti
 *
 * RAM yang naik adalah hal paling biasa pada proses Node yang sehat: V8 tidak
 * mengembalikan memori ke sistem sampai perlu, dan cache yang terisi memang
 * menaikkan pemakaian. Menyatakan kebocoran dari satu grafik membuat orang
 * mengejar masalah yang tidak ada, dan membuat kecurigaan berikutnya diabaikan.
 *
 * Yang membedakan kebocoran dari pemakaian yang memang meningkat adalah
 * **dasar setelah pengumpulan sampah**. Bila heap turun kembali ke tingkat
 * semula setelah GC, tidak ada yang bocor — yang naik hanya puncaknya.
 *
 * ## Status yang paling sering benar adalah "bukti belum cukup"
 *
 * `INSUFFICIENT_EVIDENCE` ada dengan sengaja dan dikembalikan lebih sering
 * daripada status lain. Menyatakan sesuatu yang tidak diketahui lebih merugikan
 * daripada mengaku belum tahu.
 */

export type LeakVerdict =
  | 'NORMAL'
  | 'HIGH_USAGE'
  | 'SUSPECTED_LEAK'
  | 'LEAK_REPRODUCED'
  | 'CAPACITY_LIMIT'
  | 'TEMPORARY_SPIKE'
  | 'INSUFFICIENT_EVIDENCE';

export interface MemorySample {
  capturedAt: Date;
  heapUsed: number;
  rss: number;
  gcCount: number;
  /** Jumlah pegangan aktif; pertumbuhannya sering menandai pendengar yang lupa dilepas. */
  activeHandles: number;
}

export interface LeakAnalysis {
  verdict: LeakVerdict;
  /** Alasan yang dapat dibaca manusia, bukan sekadar kode. */
  reason: string;
  evidence: {
    sampleCount: number;
    spanMinutes: number;
    /** Kenaikan heap per jam, dalam byte. */
    heapSlopePerHour: number | null;
    /** Dasar heap setelah GC pada awal dan akhir jendela. */
    postGcFloorStart: number | null;
    postGcFloorEnd: number | null;
    floorGrowthRatio: number | null;
    handleGrowth: number | null;
  };
}

/** Jendela minimum sebelum kesimpulan apa pun dapat ditarik. */
export const MIN_SAMPLES = 12;
export const MIN_SPAN_MINUTES = 30;

/** Ambang pertumbuhan dasar yang dianggap mencurigakan. */
export const FLOOR_GROWTH_SUSPICIOUS = 1.25;
export const FLOOR_GROWTH_REPRODUCED = 2.0;

/** Ambang pemakaian tinggi terhadap batas heap. */
export const HIGH_USAGE_RATIO = 0.85;

/**
 * Menganalisis rangkaian sampel memori.
 *
 * `heapLimitBytes` diperlukan untuk membedakan "banyak memori" dari "hampir
 * kehabisan". Tanpa batasnya, 2 GB tidak berarti apa-apa.
 */
export function analyzeMemory(
  samples: MemorySample[],
  heapLimitBytes: number | null = null,
): LeakAnalysis {
  const sorted = [...samples].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());

  const spanMinutes =
    sorted.length >= 2
      ? (sorted[sorted.length - 1].capturedAt.getTime() - sorted[0].capturedAt.getTime()) / 60000
      : 0;

  const evidence: LeakAnalysis['evidence'] = {
    sampleCount: sorted.length,
    spanMinutes: Math.round(spanMinutes),
    heapSlopePerHour: null,
    postGcFloorStart: null,
    postGcFloorEnd: null,
    floorGrowthRatio: null,
    handleGrowth: null,
  };

  // Tanpa cukup sampel, tidak ada yang dapat disimpulkan. Ini bukan kegagalan
  // analisis; ini hasil analisis yang jujur.
  if (sorted.length < MIN_SAMPLES || spanMinutes < MIN_SPAN_MINUTES) {
    return {
      verdict: 'INSUFFICIENT_EVIDENCE',
      reason:
        `Baru ${sorted.length} sampel selama ${Math.round(spanMinutes)} menit; ` +
        `diperlukan sedikitnya ${MIN_SAMPLES} sampel dan ${MIN_SPAN_MINUTES} menit.`,
      evidence,
    };
  }

  evidence.heapSlopePerHour = linearSlopePerHour(sorted.map((s) => ({
    t: s.capturedAt.getTime(),
    v: s.heapUsed,
  })));

  // Dasar setelah GC: nilai terendah pada tiap separuh jendela. Nilai terendah
  // adalah yang paling dekat dengan keadaan setelah pengumpulan sampah.
  const half = Math.floor(sorted.length / 2);
  const floorStart = Math.min(...sorted.slice(0, half).map((s) => s.heapUsed));
  const floorEnd = Math.min(...sorted.slice(half).map((s) => s.heapUsed));
  evidence.postGcFloorStart = floorStart;
  evidence.postGcFloorEnd = floorEnd;
  evidence.floorGrowthRatio = floorStart > 0 ? floorEnd / floorStart : null;

  evidence.handleGrowth =
    sorted[sorted.length - 1].activeHandles - sorted[0].activeHandles;

  const ratio = evidence.floorGrowthRatio;
  const latestHeap = sorted[sorted.length - 1].heapUsed;

  // Hampir kehabisan adalah keadaan yang berbeda dari bocor, dan lebih
  // mendesak. Diperiksa lebih dulu.
  if (heapLimitBytes && latestHeap / heapLimitBytes >= HIGH_USAGE_RATIO) {
    return {
      verdict: 'CAPACITY_LIMIT',
      reason:
        `Heap terpakai ${formatBytes(latestHeap)} dari batas ${formatBytes(heapLimitBytes)} ` +
        `(${Math.round((latestHeap / heapLimitBytes) * 100)}%). Ini soal kapasitas, ` +
        'bukan tentu kebocoran.',
      evidence,
    };
  }

  if (ratio === null) {
    return {
      verdict: 'INSUFFICIENT_EVIDENCE',
      reason: 'Dasar heap tidak dapat dihitung dari sampel yang ada.',
      evidence,
    };
  }

  // Dasar yang tumbuh berlipat adalah bukti terkuat yang dapat diperoleh tanpa
  // membandingkan cuplikan heap.
  if (ratio >= FLOOR_GROWTH_REPRODUCED) {
    return {
      verdict: 'LEAK_REPRODUCED',
      reason:
        `Dasar heap setelah GC tumbuh ${ratio.toFixed(2)} kali ` +
        `(${formatBytes(floorStart)} menjadi ${formatBytes(floorEnd)}) selama ` +
        `${Math.round(spanMinutes)} menit. Memori tidak kembali meski sudah dikumpulkan.`,
      evidence,
    };
  }

  if (ratio >= FLOOR_GROWTH_SUSPICIOUS) {
    return {
      verdict: 'SUSPECTED_LEAK',
      reason:
        `Dasar heap setelah GC naik ${Math.round((ratio - 1) * 100)}% ` +
        `(${formatBytes(floorStart)} menjadi ${formatBytes(floorEnd)}). ` +
        'Perlu jendela yang lebih panjang atau perbandingan cuplikan heap untuk memastikan.',
      evidence,
    };
  }

  // Puncak naik tetapi dasar tidak tumbuh sampai ambang curiga: yang bertambah
  // beban sesaat.
  //
  // Batasnya sengaja ambang curiga itu sendiri, bukan angka lain. Memakai angka
  // lain menyisakan celah — rasio antara keduanya akan jatuh ke NORMAL padahal
  // dasarnya jelas tumbuh, dan itu kesimpulan yang menyesatkan.
  if (evidence.heapSlopePerHour !== null && evidence.heapSlopePerHour > 0) {
    return {
      verdict: 'TEMPORARY_SPIKE',
      reason:
        `Pemakaian heap naik tetapi dasarnya setelah GC hanya tumbuh ` +
        `${Math.round((ratio - 1) * 100)}%, di bawah ambang ` +
        `${Math.round((FLOOR_GROWTH_SUSPICIOUS - 1) * 100)}%. Yang bertambah ` +
        'tampaknya beban sesaat, bukan memori yang tertahan.',
      evidence,
    };
  }

  if (heapLimitBytes && latestHeap / heapLimitBytes >= 0.6) {
    return {
      verdict: 'HIGH_USAGE',
      reason: `Pemakaian heap ${Math.round((latestHeap / heapLimitBytes) * 100)}% dari batas, tetapi stabil.`,
      evidence,
    };
  }

  return {
    verdict: 'NORMAL',
    reason: 'Dasar heap setelah GC tidak tumbuh berarti selama jendela pengamatan.',
    evidence,
  };
}

/**
 * Kemiringan garis lurus, dinyatakan per jam.
 *
 * Memakai kuadrat terkecil, bukan sekadar selisih ujung — satu lonjakan pada
 * ujung akan mendominasi selisih ujung dan menghasilkan kesimpulan yang salah.
 */
export function linearSlopePerHour(points: { t: number; v: number }[]): number | null {
  if (points.length < 2) return null;

  const n = points.length;
  const meanT = points.reduce((s, p) => s + p.t, 0) / n;
  const meanV = points.reduce((s, p) => s + p.v, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.t - meanT) * (point.v - meanV);
    denominator += (point.t - meanT) ** 2;
  }

  if (denominator === 0) return null;
  // Kemiringan per milidetik dikalikan jumlah milidetik dalam satu jam.
  return (numerator / denominator) * 3_600_000;
}

/**
 * Menilai pertumbuhan pegangan aktif.
 *
 * Pegangan yang terus bertambah menandai pendengar, timer, atau koneksi yang
 * lupa dilepas — penyebab kebocoran yang paling sering, dan paling mudah
 * diperbaiki begitu ketahuan.
 */
export function analyzeHandles(
  samples: MemorySample[],
): { suspicious: boolean; growth: number; reason: string } {
  if (samples.length < MIN_SAMPLES) {
    return { suspicious: false, growth: 0, reason: 'Sampel belum cukup.' };
  }

  const sorted = [...samples].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  const growth = sorted[sorted.length - 1].activeHandles - sorted[0].activeHandles;

  const slope = linearSlopePerHour(
    sorted.map((s) => ({ t: s.capturedAt.getTime(), v: s.activeHandles })),
  );

  // Pertumbuhan yang konsisten lebih menarik daripada pertumbuhan besar yang
  // terjadi sekali. Kemiringan menangkap yang pertama.
  const suspicious = growth > 50 && (slope ?? 0) > 10;

  return {
    suspicious,
    growth,
    reason: suspicious
      ? `Pegangan aktif bertambah ${growth} dan terus naik sekitar ${Math.round(slope ?? 0)} per jam. ` +
        'Periksa pendengar, timer, atau koneksi yang tidak dilepas.'
      : `Pegangan aktif berubah ${growth}; tidak menunjukkan pertumbuhan berkelanjutan.`,
  };
}

/** Menghitung persentil dari daftar angka. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  // Metode nearest-rank: sederhana, dan tidak mengarang nilai di antara sampel.
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * Sidik anomali kinerja.
 *
 * Seperti galat, satu masalah kinerja yang berulang adalah satu masalah.
 */
export function anomalyFingerprint(
  anomalyType: string,
  subject: string,
  serviceName: string,
): string {
  return [anomalyType, subject, serviceName].join(':').toLowerCase();
}
