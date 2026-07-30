import { MarketplaceEnrollmentStatus as S } from '@prisma/client';

/**
 * Mesin status pendaftaran seller marketplace.
 *
 * Empat belas status pada blueprint Versi 9 bagian 5.2 tidak membentuk garis
 * lurus: pendaftaran dapat mundur ketika profil ternyata kurang, dapat menunggu
 * provider berhari-hari, dan dapat ditolak lalu diajukan ulang.
 *
 * Transisi yang sah ditulis sebagai data, bukan sebagai rangkaian `if`, supaya
 * dapat diuji dan dibaca tanpa menelusuri kode.
 */

export type EnrollmentStatus = S;

/** Transisi yang diizinkan dari setiap status. */
export const ALLOWED_TRANSITIONS: Readonly<Record<S, readonly S[]>> = {
  [S.DRAFT]: [S.PROFILE_INCOMPLETE, S.PAYMENT_ACCOUNT_REQUIRED, S.UNDER_REVIEW, S.CLOSED],

  // Kembali ke DRAFT ketika tenant melengkapi profilnya.
  [S.PROFILE_INCOMPLETE]: [S.DRAFT, S.PAYMENT_ACCOUNT_REQUIRED, S.CLOSED],

  [S.PAYMENT_ACCOUNT_REQUIRED]: [S.ACTIVATION_TICKET_REQUIRED, S.PROFILE_INCOMPLETE, S.CLOSED],
  [S.ACTIVATION_TICKET_REQUIRED]: [S.ACTIVATION_TICKET_OPENED, S.PAYMENT_ACCOUNT_REQUIRED, S.CLOSED],
  [S.ACTIVATION_TICKET_OPENED]: [S.WAITING_PROVIDER, S.ACTIVATION_TICKET_REQUIRED, S.CLOSED],

  // Provider dapat menolak; berkasnya kembali ke tiket, bukan langsung ditutup.
  [S.WAITING_PROVIDER]: [S.CREDENTIAL_RECEIVED, S.ACTIVATION_TICKET_OPENED, S.REJECTED, S.CLOSED],

  [S.CREDENTIAL_RECEIVED]: [S.CREDENTIAL_CONFIGURED, S.WAITING_PROVIDER, S.CLOSED],

  // Credential dapat salah dan harus dimasukkan ulang.
  [S.CREDENTIAL_CONFIGURED]: [S.PAYMENT_TESTING, S.CREDENTIAL_RECEIVED, S.CLOSED],

  // Uji pembayaran gagal mengembalikan ke konfigurasi credential.
  [S.PAYMENT_TESTING]: [S.UNDER_REVIEW, S.CREDENTIAL_CONFIGURED, S.CLOSED],

  [S.UNDER_REVIEW]: [S.ACTIVE, S.REJECTED, S.PROFILE_INCOMPLETE, S.CLOSED],

  // ACTIVE tidak dapat kembali ke tahap persiapan; yang mungkin hanya
  // ditangguhkan atau ditutup. Membiarkannya mundur berarti toko yang sudah
  // menerima pesanan tiba-tiba dianggap belum siap.
  [S.ACTIVE]: [S.SUSPENDED, S.CLOSED],

  [S.SUSPENDED]: [S.ACTIVE, S.CLOSED],

  // Penolakan tidak dapat dibatalkan; tenant mengajukan berkas baru.
  [S.REJECTED]: [S.CLOSED],

  // Status akhir.
  [S.CLOSED]: [],
};

/** Status yang tidak dapat berpindah ke mana pun kecuali penutupan. */
export const TERMINAL_STATUSES: readonly S[] = [S.CLOSED];

/** Status yang berarti seller boleh menerima pesanan. */
export const SELLING_STATUSES: readonly S[] = [S.ACTIVE];

/**
 * Status yang keputusannya sudah diambil. Pemeriksaan kesiapan tidak menghitung
 * ulang berkas yang berada di salah satunya.
 */
export const SETTLED_STATUSES: readonly S[] = [S.ACTIVE, S.SUSPENDED, S.REJECTED, S.CLOSED];

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
}

/** Memeriksa apakah satu perpindahan status sah. */
export function canTransition(from: S, to: S): TransitionCheck {
  if (from === to) {
    return { allowed: false, reason: `Status sudah ${from}.` };
  }
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    return { allowed: false, reason: `Status asal tidak dikenal: ${from}.` };
  }
  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason:
        `Pendaftaran berstatus ${from} tidak dapat berpindah ke ${to}. ` +
        (allowed.length > 0
          ? `Yang mungkin: ${allowed.join(', ')}.`
          : 'Status ini tidak dapat berpindah lagi.'),
    };
  }
  return { allowed: true };
}

/**
 * Status berikutnya yang wajar berdasarkan hasil pemeriksaan kesiapan.
 *
 * Dipakai ketika tenant menekan "periksa kesiapan": sistem yang menentukan
 * berkasnya berhenti di mana, bukan tenant yang memilih sendiri.
 */
export function nextStatusFromReadiness(current: S, readiness: {
  profileComplete: boolean;
  paymentAccountReady: boolean;
  activationTicketOpen: boolean;
}): S {
  // Berkas yang sudah aktif, ditangguhkan, ditolak, atau ditutup tidak dihitung
  // ulang oleh pemeriksaan kesiapan.
  if (SETTLED_STATUSES.includes(current)) return current;

  if (!readiness.profileComplete) return S.PROFILE_INCOMPLETE;
  if (!readiness.paymentAccountReady) {
    return readiness.activationTicketOpen ? S.ACTIVATION_TICKET_OPENED : S.PAYMENT_ACCOUNT_REQUIRED;
  }
  return S.UNDER_REVIEW;
}
