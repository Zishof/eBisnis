/**
 * Normalisasi dan validasi host untuk storefront.
 *
 * Host adalah satu-satunya hal yang menentukan toko mana yang ditampilkan
 * kepada pengunjung anonim, dan ia sepenuhnya dikendalikan pengirim permintaan.
 * Maka nilainya tidak pernah dipercaya apa adanya: ia dinormalkan lebih dahulu,
 * lalu dicari pada registry domain terverifikasi.
 *
 * Yang TIDAK PERNAH dilakukan: menerjemahkan host menjadi nama schema. Aturan
 * itu berlaku sejak Versi 5 dan menjadi lebih penting di sini, karena
 * pengunjung storefront tidak punya sesi yang membuktikan apa pun.
 */

/** Panjang maksimum host menurut RFC 1035. */
const MAX_HOST_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

/** Label host yang sah: huruf, angka, dan tanda hubung di tengah. */
const LABEL_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export interface HostNormalizationResult {
  ok: boolean;
  /** Host yang sudah dinormalkan; hanya terisi bila `ok`. */
  host?: string;
  /** Alasan penolakan yang dapat dicatat, bukan ditampilkan ke pengunjung. */
  reason?: string;
}

/**
 * Menormalkan host dari header permintaan.
 *
 * Yang dibuang: port, spasi, titik di akhir, dan perbedaan huruf besar-kecil.
 * Yang ditolak: host kosong, terlalu panjang, mengandung karakter di luar
 * label yang sah, alamat IP, dan bentuk yang memuat kredensial atau jalur.
 */
export function normalizeHost(raw: string | string[] | undefined): HostNormalizationResult {
  if (Array.isArray(raw)) {
    // Beberapa header Host berarti permintaan yang dibuat-buat. Menerima yang
    // pertama membuat perilaku bergantung pada proxy di depan aplikasi.
    return { ok: false, reason: 'Header host lebih dari satu.' };
  }
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, reason: 'Header host kosong.' };
  }

  let value = raw.trim().toLowerCase();

  // Buang skema bila ikut terkirim.
  value = value.replace(/^https?:\/\//, '');

  // Tolak bentuk yang memuat kredensial, jalur, kueri, atau fragmen. Semuanya
  // tidak pernah sah pada header Host dan menandakan permintaan yang disusun
  // untuk membingungkan pencocokan.
  if (/[@/?#\\]/.test(value)) {
    return { ok: false, reason: 'Host memuat karakter yang tidak sah.' };
  }

  // Buang port. IPv6 dalam kurung siku ditolak bersama alamat IP di bawah.
  const portIndex = value.lastIndexOf(':');
  if (portIndex !== -1) {
    const port = value.slice(portIndex + 1);
    if (!/^\d{1,5}$/.test(port)) {
      return { ok: false, reason: 'Bagian port tidak valid.' };
    }
    value = value.slice(0, portIndex);
  }

  // Titik di akhir menandakan root DNS; ia sah tetapi harus dinormalkan agar
  // "toko.com." dan "toko.com" tidak menjadi dua entri berbeda.
  value = value.replace(/\.+$/, '');

  if (value.length === 0) return { ok: false, reason: 'Host kosong setelah normalisasi.' };
  if (value.length > MAX_HOST_LENGTH) return { ok: false, reason: 'Host melebihi 253 karakter.' };

  // Alamat IP tidak pernah menjadi domain toko. Menerimanya membuka pencocokan
  // lewat alamat langsung yang melewati DNS.
  if (isIpAddress(value)) {
    return { ok: false, reason: 'Alamat IP tidak dapat dipakai sebagai domain toko.' };
  }

  const labels = value.split('.');
  if (labels.length < 2) {
    return { ok: false, reason: 'Host harus memuat sedikitnya dua label.' };
  }
  for (const label of labels) {
    if (label.length === 0) return { ok: false, reason: 'Host memuat label kosong.' };
    if (label.length > MAX_LABEL_LENGTH) return { ok: false, reason: 'Label host terlalu panjang.' };
    if (!LABEL_PATTERN.test(label)) {
      return { ok: false, reason: `Label host tidak valid: "${label}".` };
    }
  }

  return { ok: true, host: value };
}

/** Benar untuk IPv4, IPv6, dan bentuk berkurung siku. */
function isIpAddress(value: string): boolean {
  if (value.startsWith('[')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return true;
  // IPv6 tanpa kurung siku setelah port dibuang.
  return value.includes(':');
}

/**
 * Membandingkan dua host yang sudah dinormalkan.
 *
 * Perbandingan biasa sudah cukup karena keduanya dinormalkan lebih dulu; fungsi
 * ini ada agar pemanggilnya tidak tergoda membandingkan nilai mentah.
 */
export function hostEquals(a: string, b: string): boolean {
  return a === b;
}

/**
 * Slug toko dari jalur marketplace.
 *
 * Slug menentukan toko mana yang ditampilkan pada `belanja.ebisnis.id/toko/x`,
 * sehingga ia divalidasi sama ketatnya dengan host.
 */
const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{1,62}[a-z0-9])?$/;

export function normalizeStoreSlug(raw: string | undefined): HostNormalizationResult {
  if (typeof raw !== 'string') return { ok: false, reason: 'Slug kosong.' };
  const value = raw.trim().toLowerCase();
  if (value.length < 3) return { ok: false, reason: 'Slug kurang dari tiga karakter.' };
  if (value.length > 64) return { ok: false, reason: 'Slug melebihi 64 karakter.' };
  if (!SLUG_PATTERN.test(value)) return { ok: false, reason: 'Slug memuat karakter yang tidak sah.' };
  if (RESERVED_SLUGS.has(value)) return { ok: false, reason: 'Slug ini dicadangkan platform.' };
  return { ok: true, host: value };
}

/**
 * Slug yang tidak boleh dipakai toko.
 *
 * Sebagiannya menghindari tabrakan dengan jalur platform; sebagiannya mencegah
 * toko menyamar sebagai halaman resmi.
 */
export const RESERVED_SLUGS = new Set([
  'api', 'app', 'admin', 'platform', 'auth', 'login', 'logout', 'daftar',
  'masuk', 'toko', 'produk', 'kategori', 'cari', 'keranjang', 'checkout',
  'pesanan', 'akun', 'bantuan', 'help', 'docs', 'static', 'assets', 'public',
  'ebisnis', 'belanja', 'www', 'mail', 'ftp', 'support', 'dukungan',
]);
