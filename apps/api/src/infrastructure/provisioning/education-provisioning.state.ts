/**
 * State machine provisioning modul pendidikan (BRD Versi 13 §186.2).
 *
 * ## Mengapa berupa mesin keadaan, bukan rangkaian `await`
 *
 * Provisioning menyentuh basis data pada beberapa tahap yang tidak dapat
 * dibungkus satu transaksi: membuat schema, menerapkan migrasi, menyemai peran,
 * memvalidasi. Kegagalan pada tahap keempat meninggalkan tiga tahap pertama yang
 * sudah terjadi.
 *
 * Tanpa keadaan yang tercatat, satu-satunya cara mengetahui sampai mana ia
 * sempat berjalan adalah menebak dari isi basis data — dan tebakan itu
 * menentukan apakah mengulang berarti melanjutkan atau menduplikasi.
 *
 * Karena itu keadaannya dicatat, dan perpindahannya dinyatakan tegas di sini:
 * yang tidak tertulis tidak boleh terjadi.
 */

import { AppError, ErrorCodes } from '../../common/errors/app-error';

export const EDUCATION_PROVISIONING_STATES = [
  'DRAFT',
  'WAITING_CONTRACT',
  'WAITING_PAYMENT',
  'QUEUED',
  'PROVISIONING_CORE',
  'PROVISIONING_VERTICAL',
  'SEEDING',
  'VALIDATING',
  'READY_FOR_CONFIGURATION',
  'ACTIVE',
  'SUSPENDED',
  'FAILED',
  'ROLLING_BACK',
  'ARCHIVED',
] as const;

export type EducationProvisioningState = (typeof EDUCATION_PROVISIONING_STATES)[number];

/**
 * Perpindahan yang diizinkan.
 *
 * Ditulis sebagai peta lengkap, bukan sebagai deretan `if`. Peta membuat
 * pertanyaan "dari SUSPENDED boleh ke mana" punya satu jawaban yang dapat
 * dibaca, dan membuat keadaan yang tidak punya jalan keluar terlihat.
 */
const PERPINDAHAN: Record<EducationProvisioningState, readonly EducationProvisioningState[]> = {
  DRAFT: ['WAITING_CONTRACT', 'QUEUED', 'ARCHIVED'],
  WAITING_CONTRACT: ['WAITING_PAYMENT', 'QUEUED', 'ARCHIVED'],
  WAITING_PAYMENT: ['QUEUED', 'ARCHIVED'],
  QUEUED: ['PROVISIONING_CORE', 'FAILED'],
  PROVISIONING_CORE: ['PROVISIONING_VERTICAL', 'FAILED'],
  PROVISIONING_VERTICAL: ['SEEDING', 'FAILED'],
  SEEDING: ['VALIDATING', 'FAILED'],
  VALIDATING: ['READY_FOR_CONFIGURATION', 'FAILED'],
  READY_FOR_CONFIGURATION: ['ACTIVE', 'FAILED', 'ARCHIVED'],

  /*
   * ACTIVE tidak dapat kembali ke provisioning.
   *
   * Menjalankan ulang provisioning pada modul yang sudah dipakai berarti
   * menyemai ulang peran dan menu di atas data yang sudah disunting institusi.
   * Yang sah hanyalah migrasi tambahan, dan itu bukan perpindahan keadaan.
   */
  ACTIVE: ['SUSPENDED', 'ARCHIVED'],

  /*
   * SUSPENDED kembali ke ACTIVE, bukan ke provisioning.
   *
   * Berlangganan yang berakhir menutup akses, TIDAK menghapus schema. Data
   * akademik milik institusi; mengaktifkan kembali berarti membuka kembali
   * pintu, bukan membangun ulang.
   */
  SUSPENDED: ['ACTIVE', 'ARCHIVED'],

  FAILED: ['ROLLING_BACK', 'QUEUED', 'ARCHIVED'],
  ROLLING_BACK: ['DRAFT', 'FAILED', 'ARCHIVED'],

  /** Keadaan akhir. Tidak ada jalan keluar, dan itu disengaja. */
  ARCHIVED: [],
};

/** Keadaan yang berarti modulnya sedang dipakai institusi. */
export const KEADAAN_TERPAKAI: readonly EducationProvisioningState[] = [
  'READY_FOR_CONFIGURATION',
  'ACTIVE',
  'SUSPENDED',
];

/** Keadaan yang sedang berjalan dan tidak boleh dijalankan ulang bersamaan. */
export const KEADAAN_BERJALAN: readonly EducationProvisioningState[] = [
  'QUEUED',
  'PROVISIONING_CORE',
  'PROVISIONING_VERTICAL',
  'SEEDING',
  'VALIDATING',
  'ROLLING_BACK',
];

export function bolehPindah(
  dari: EducationProvisioningState,
  ke: EducationProvisioningState,
): boolean {
  return PERPINDAHAN[dari].includes(ke);
}

/**
 * Memastikan perpindahan sah, atau melempar dengan menyebut yang diizinkan.
 *
 * Pesannya menyebutkan tujuan yang sah, sebab kegagalan perpindahan hampir
 * selalu berarti pemanggilnya salah membaca keadaan sekarang — dan daftar
 * tujuan yang sah adalah petunjuk tercepat menuju sebabnya.
 */
export function pastikanPindah(
  dari: EducationProvisioningState,
  ke: EducationProvisioningState,
): void {
  if (bolehPindah(dari, ke)) return;

  const sah = PERPINDAHAN[dari];
  throw AppError.conflict(
    ErrorCodes.CONFLICT,
    `Provisioning tidak dapat berpindah dari "${dari}" ke "${ke}". ` +
      (sah.length
        ? `Dari "${dari}" yang diizinkan hanya: ${sah.join(', ')}.`
        : `"${dari}" adalah keadaan akhir.`),
  );
}

/** Benar bila modul pada keadaan ini boleh dipakai institusi. */
export function sedangTerpakai(keadaan: EducationProvisioningState): boolean {
  return KEADAAN_TERPAKAI.includes(keadaan);
}

/** Benar bila ada proses yang sedang berjalan pada keadaan ini. */
export function sedangBerjalan(keadaan: EducationProvisioningState): boolean {
  return KEADAAN_BERJALAN.includes(keadaan);
}

/**
 * Keadaan gagal berikutnya untuk sebuah tahap yang meledak.
 *
 * Dipisahkan supaya penanganan galat tidak perlu tahu peta perpindahan. Tahap
 * yang gagal sebelum sempat berjalan (`DRAFT`, `WAITING_*`) tidak menjadi
 * `FAILED` — tidak ada yang perlu dibatalkan, dan menandainya gagal membuat
 * daftar kegagalan penuh oleh tenant yang sekadar belum menyelesaikan kontrak.
 */
export function keadaanSaatGagal(
  dari: EducationProvisioningState,
): EducationProvisioningState | null {
  return bolehPindah(dari, 'FAILED') ? 'FAILED' : null;
}
