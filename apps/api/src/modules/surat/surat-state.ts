/**
 * Aturan perpindahan status surat keluar.
 *
 * ## Mengapa tabel, bukan rangkaian `if`
 *
 * Status surat keluar menentukan apakah nomor resmi sudah diberikan, apakah ia
 * masih dapat disunting, dan apakah ia sudah keluar dari organisasi. Aturan
 * seperti itu yang tersebar sebagai `if` di beberapa controller akan berbeda
 * antar tempat begitu satu status baru ditambahkan.
 *
 * Sebagai tabel, seluruh perpindahan yang sah dapat dibaca sekaligus — dan
 * yang tidak tercantum otomatis terlarang, bukan tanpa sengaja terlewat.
 */

export const SURAT_OUTGOING_STATUSES = [
  'KONSEP',
  'DIAJUKAN',
  'DIREVISI',
  'DISETUJUI',
  'DITOLAK',
  'DITERBITKAN',
  'DIKIRIM',
  'DIARSIPKAN',
  'DIBATALKAN',
] as const;

export type SuratOutgoingStatus = (typeof SURAT_OUTGOING_STATUSES)[number];

/**
 * Perpindahan yang sah.
 *
 * Yang sengaja TIDAK ada:
 *
 * * `DITERBITKAN -> KONSEP` — surat yang sudah bernomor dan keluar tidak dapat
 *   kembali menjadi konsep. Yang benar adalah membuat surat baru yang
 *   menggantikannya (`supersedes_outgoing_id`), sehingga keduanya tetap
 *   tercatat. Menyunting surat yang sudah keluar berarti riwayatnya berbohong.
 * * `DIBATALKAN -> apa pun` — pembatalan bersifat akhir.
 * * `DIARSIPKAN -> apa pun` selain pengarsipan ulang.
 */
const TRANSISI: Record<SuratOutgoingStatus, SuratOutgoingStatus[]> = {
  KONSEP: ['DIAJUKAN', 'DIBATALKAN'],
  // Pengaju dapat menarik kembali selama belum ada keputusan.
  DIAJUKAN: ['DISETUJUI', 'DITOLAK', 'DIREVISI', 'KONSEP', 'DIBATALKAN'],
  // Setelah direvisi, surat diajukan ulang.
  DIREVISI: ['DIAJUKAN', 'DIBATALKAN'],
  DISETUJUI: ['DITERBITKAN', 'DIBATALKAN'],
  // Surat yang ditolak masih dapat diperbaiki lalu diajukan ulang.
  DITOLAK: ['DIREVISI', 'DIBATALKAN'],
  DITERBITKAN: ['DIKIRIM', 'DIARSIPKAN'],
  DIKIRIM: ['DIARSIPKAN'],
  DIARSIPKAN: [],
  DIBATALKAN: [],
};

/** Status yang sudah memegang nomor resmi. */
export const STATUS_BERNOMOR: SuratOutgoingStatus[] = ['DITERBITKAN', 'DIKIRIM', 'DIARSIPKAN'];

/** Status yang isinya masih boleh disunting. */
export const STATUS_DAPAT_DISUNTING: SuratOutgoingStatus[] = ['KONSEP', 'DIREVISI', 'DITOLAK'];

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Apakah perpindahan status ini sah.
 *
 * Alasan penolakan disebutkan, bukan sekadar `false`. "Tidak dapat mengubah
 * status" memaksa penggunanya menebak apa yang sebenarnya boleh dilakukan.
 */
export function canTransition(
  from: SuratOutgoingStatus,
  to: SuratOutgoingStatus,
): TransitionResult {
  if (from === to) {
    return { allowed: false, reason: `Surat sudah berstatus ${from}.` };
  }

  const tujuan = TRANSISI[from];
  if (!tujuan) {
    return { allowed: false, reason: `Status asal ${from} tidak dikenal.` };
  }

  if (!tujuan.includes(to)) {
    const daftar = tujuan.length ? tujuan.join(', ') : 'tidak ada';
    return {
      allowed: false,
      reason: `Surat berstatus ${from} tidak dapat menjadi ${to}. Yang mungkin: ${daftar}.`,
    };
  }

  return { allowed: true };
}

/** Status berikutnya yang mungkin dari sebuah status. */
export function nextStatuses(from: SuratOutgoingStatus): SuratOutgoingStatus[] {
  return [...(TRANSISI[from] ?? [])];
}

/**
 * Apakah surat berstatus ini wajib sudah bernomor.
 *
 * Sama dengan batasan pada basis data — sengaja diulang di sini supaya
 * penolakannya terjadi sebelum penulisan, dengan pesan yang dapat dibaca,
 * alih-alih muncul sebagai galat batasan yang tidak berarti apa-apa bagi
 * penggunanya.
 */
export function requiresNumber(status: SuratOutgoingStatus): boolean {
  return STATUS_BERNOMOR.includes(status);
}

export function isEditable(status: SuratOutgoingStatus): boolean {
  return STATUS_DAPAT_DISUNTING.includes(status);
}

/**
 * Menentukan hasil sebuah langkah persetujuan terhadap status surat.
 *
 * Fungsi murni supaya aturannya dapat diuji tanpa basis data: siapa memutuskan
 * apa pada langkah keberapa, dan apa akibatnya bagi surat itu.
 */
export function statusAfterDecision(input: {
  decision: 'DISETUJUI' | 'DITOLAK' | 'DIKEMBALIKAN' | 'DILEWATI';
  stepOrder: number;
  totalSteps: number;
  enforceAllSteps: boolean;
  /**
   * Penyetuju menyatakan alurnya selesai di sini, tanpa melanjutkan ke langkah
   * berikutnya.
   *
   * Hanya dihormati bila alurnya `enforceAllSteps: false`. Niat menyelesaikan
   * lebih awal harus dinyatakan terpisah dari keputusan menyetujui: seorang
   * direktur yang menyetujui langkah kedua dari lima belum tentu bermaksud
   * melewatkan tiga langkah sisanya, dan menebakkan maksud itu dari keputusan
   * "setuju" akan melewatkan penyetuju yang seharusnya ikut membaca.
   */
  finalize?: boolean;
}): { status: SuratOutgoingStatus; nextStep: number | null } {
  if (input.decision === 'DITOLAK') {
    return { status: 'DITOLAK', nextStep: null };
  }
  if (input.decision === 'DIKEMBALIKAN') {
    // Dikembalikan bukan ditolak: penyusunnya diminta memperbaiki, dan alurnya
    // dimulai lagi dari langkah pertama karena penyetuju sebelumnya menyetujui
    // naskah yang kini sudah berubah.
    return { status: 'DIREVISI', nextStep: null };
  }

  // Penyelesaian lebih awal hanya mungkin bila alurnya memang tidak wajib
  // dilalui seluruhnya DAN penyetujunya menyatakannya.
  if (input.finalize && !input.enforceAllSteps) {
    return { status: 'DISETUJUI', nextStep: null };
  }

  const berikutnya = input.stepOrder + 1;
  if (berikutnya > input.totalSteps) {
    return { status: 'DISETUJUI', nextStep: null };
  }

  return { status: 'DIAJUKAN', nextStep: berikutnya };
}
