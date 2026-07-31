/**
 * Pengenalan perangkat dari user agent.
 *
 * ## Mengenali, bukan menjaga
 *
 * Sidik yang dihasilkan di sini **tidak dipakai untuk mengizinkan atau menolak**
 * apa pun. Gunanya satu: mengelompokkan sesi pada daftar "di mana saja saya
 * sedang masuk" supaya orang dapat mengenali mana yang miliknya.
 *
 * Menjadikannya penjaga adalah godaan yang harus ditolak. User agent berubah
 * setiap kali peramban memperbarui dirinya sendiri — dan penjaga yang memakainya
 * akan mengunci orang keluar dari akunnya sendiri pada hari Chrome naik versi.
 * Ia juga sepenuhnya dapat dipalsukan oleh siapa pun yang mengirim permintaan,
 * sehingga sebagai penjaga ia menghalangi yang jujur tanpa menghambat yang tidak.
 */

import { createHash } from 'node:crypto';

export interface DeviceIdentity {
  /** Hash, bukan nilai mentahnya. */
  fingerprint: string | null;
  /** Keterangan singkat yang dapat dibaca manusia. */
  label: string | null;
}

/**
 * Sidik perangkat dari user agent.
 *
 * Nilai mentahnya tidak disimpan pada kolom sidik: user agent memuat versi
 * peramban, sistem operasi, dan kadang perangkat keras — cukup untuk melacak
 * seseorang lintas tenant bila kolomnya kelak dibaca untuk keperluan lain.
 */
export function fingerprintDevice(userAgent: string | null | undefined): DeviceIdentity {
  if (!userAgent) return { fingerprint: null, label: null };
  return {
    fingerprint: createHash('sha256').update(userAgent).digest('hex').slice(0, 32),
    label: describeDevice(userAgent),
  };
}

/** Menerjemahkan user agent menjadi keterangan singkat yang dapat dibaca. */
export function describeDevice(userAgent: string): string {
  const ua = userAgent;

  // Urutan pemeriksaan penting: Edge dan Opera menyebut dirinya Chrome, dan
  // Chrome menyebut dirinya Safari. Yang paling spesifik harus diperiksa dulu,
  // atau semuanya akan dilaporkan sebagai Safari.
  const peramban = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : /curl\//i.test(ua)
              ? 'curl'
              : /PostmanRuntime/i.test(ua)
                ? 'Postman'
                : null;

  const sistem = /Windows NT/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;

  if (peramban && sistem) return `${peramban} di ${sistem}`;
  if (peramban) return peramban;
  if (sistem) return sistem;
  // Tidak dikenali bukan berarti tidak ada. Potongan awal user agent lebih
  // berguna bagi pemiliknya daripada kata "Tidak diketahui".
  return ua.slice(0, 60);
}
