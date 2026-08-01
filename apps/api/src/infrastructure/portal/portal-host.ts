/**
 * Aturan host portal — bagian yang dapat dibuktikan tanpa basis data.
 *
 * ## Mengapa terpisah dan murni
 *
 * Pemetaan host menentukan **merek dan konten apa yang tampil kepada publik**,
 * dan pada beberapa jalur juga menentukan penerbit identitas mana yang dipercaya.
 * Kesalahan di sini tidak menghasilkan galat: ia menghasilkan halaman yang
 * salah, atau halaman yang tidak pernah muncul.
 *
 * Penormalan host **tidak** ditulis ulang di sini. Ia dipakai ulang dari
 * `infrastructure/tenant/public-host.ts`. Dua penormal berbeda untuk dua tabel
 * host menghasilkan host yang cocok di satu tempat dan tidak di tempat lain —
 * dan yang begitu baru ketahuan ketika seseorang mengeluh situsnya mati.
 */

import { HOST_TERLARANG, normalkanHost } from '../tenant/public-host';

/** Peran sebuah host bagi portalnya. */
export type PeranHost = 'PUBLIC' | 'APP' | 'AUTH';

export interface BarisPortalDomain {
  host: string;
  kind: string;
  status: string;
  verifiedAt: Date | null;
  isCanonical: boolean;
}

export interface Keputusan {
  boleh: boolean;
  kode?: string;
  pesan?: string;
}

/**
 * Label subdomain yang dipesan platform (§7.4).
 *
 * Penyewa tidak boleh memakainya sebagai slug. Bila boleh, seorang penyewa
 * dapat mendaftarkan `auth.ebisnis.id` atau `app.ebisnis.id` dan menerima
 * permintaan yang ditujukan kepada penerbit identitas maupun pintu aplikasi —
 * termasuk kode otorisasi yang sedang dipertukarkan.
 *
 * Karena itu daftar ini bukan soal kerapian penamaan. Ia batas keamanan.
 */
export const LABEL_TERPESAN = new Set([
  'www',
  'app',
  'auth',
  'api',
  'admin',
  'console',
  'support',
  'status',
  'docs',
  'assets',
  'cdn',
  'mail',
]);

/** Benar bila slug penyewa boleh dipakai sebagai subdomain. */
export function slugPenyewaBoleh(slug: string): Keputusan {
  const bersih = slug.trim().toLowerCase();

  if (!bersih) {
    return { boleh: false, kode: 'SLUG_KOSONG', pesan: 'Nama subdomain wajib diisi.' };
  }
  if (LABEL_TERPESAN.has(bersih)) {
    return {
      boleh: false,
      kode: 'SLUG_TERPESAN',
      pesan: `"${bersih}" dipesan platform dan tidak dapat dipakai.`,
    };
  }
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(bersih)) {
    return {
      boleh: false,
      kode: 'SLUG_TIDAK_SAH',
      pesan: 'Subdomain hanya boleh huruf kecil, angka, dan tanda hubung di tengah.',
    };
  }
  return { boleh: true };
}

/**
 * Bolehkah host ini dipakai mencari portal?
 *
 * Pemeriksaan sebelum menyentuh basis data — yang ditolak di sini tidak pernah
 * menjadi kueri, sehingga tidak ada yang dapat disimpulkan dari lama jawabannya.
 */
export function bolehMencariPortal(raw: string | null | undefined): Keputusan {
  const host = normalkanHost(raw);
  if (!host) {
    return { boleh: false, kode: 'HOST_TIDAK_SAH', pesan: 'Portal tidak ditemukan.' };
  }
  if (HOST_TERLARANG.has(host)) {
    return { boleh: false, kode: 'HOST_TERLARANG', pesan: 'Portal tidak ditemukan.' };
  }
  return { boleh: true };
}

/**
 * Bolehkah baris domain ini melayani permintaan?
 *
 * Pesannya sengaja sama untuk setiap penolakan. Pengunjung yang menebak tidak
 * boleh dapat membedakan "host tidak terdaftar" dari "host terdaftar tetapi
 * belum terbukti dimiliki" — perbedaan itu memberitahunya bahwa ia menebak
 * dengan benar.
 */
export function domainBolehMelayani(baris: BarisPortalDomain): Keputusan {
  if (baris.status !== 'ACTIVE') {
    return { boleh: false, kode: 'PORTAL_TIDAK_AKTIF', pesan: 'Portal tidak ditemukan.' };
  }
  if (baris.verifiedAt === null) {
    /*
     * Basis data sudah menolak `ACTIVE` tanpa `verifiedAt` lewat CHECK. Ini
     * pertahanan kedua: baris yang masuk lewat jalur mana pun — pemulihan
     * cadangan, penyuntingan manual, migrasi yang keliru — tetap tidak
     * melayani apa pun.
     */
    return { boleh: false, kode: 'PORTAL_TIDAK_AKTIF', pesan: 'Portal tidak ditemukan.' };
  }
  return { boleh: true };
}

/**
 * Peran yang diminta cocok dengan peran host?
 *
 * Host `PUBLIC` tidak boleh melayani pertukaran kode otorisasi, dan host `AUTH`
 * tidak boleh menyajikan halaman pemasaran. Memisahkannya membuat satu host yang
 * bocor tidak sekaligus membocorkan keduanya.
 */
export function peranCocok(baris: BarisPortalDomain, diminta: PeranHost): Keputusan {
  if (baris.kind !== diminta) {
    return { boleh: false, kode: 'PERAN_TIDAK_COCOK', pesan: 'Portal tidak ditemukan.' };
  }
  return { boleh: true };
}

/**
 * Menyusun tautan kanonik sebuah portal.
 *
 * Selalu https, selalu host kanonik. Tautan lintas portal yang memakai host
 * non-kanonik menghasilkan konten ganda di mata mesin pencari (§1683), dan
 * itulah yang §33 minta dicegah.
 */
export function tautanKanonik(
  domains: BarisPortalDomain[],
  peran: PeranHost = 'PUBLIC',
): string | null {
  const layak = domains.filter(
    (d) => d.kind === peran && domainBolehMelayani(d).boleh,
  );
  if (!layak.length) return null;

  const kanonik = layak.find((d) => d.isCanonical) ?? layak[0];
  return `https://${kanonik.host}`;
}
