/**
 * Penyamar data sensitif untuk seluruh telemetri.
 *
 * ## Satu sanitizer, bukan dua
 *
 * `maskPayload` sudah ada pada klien eSmartlink dan menyamarkan muatan
 * pembayaran. Berkas ini **mengangkatnya** menjadi layanan bersama alih-alih
 * membuat penyamar kedua.
 *
 * Dua sanitizer akan berbeda daftar medannya, dan yang satu akan lupa
 * menyamarkan apa yang disamarkan yang lain. Perbedaan itu baru ketahuan
 * ketika sesuatu yang seharusnya tersamar muncul pada log.
 *
 * ## Daftar izin untuk header, daftar larangan untuk medan
 *
 * Header memakai **daftar izin**: hanya yang disebut yang disimpan. Header baru
 * yang muncul dari pustaka pihak ketiga tidak otomatis tersimpan, dan itu yang
 * diinginkan — `authorization` bukan satu-satunya header yang membawa rahasia.
 *
 * Medan payload memakai **daftar larangan** karena bentuknya tidak terbatas:
 * daftar izin untuk payload berarti tidak ada payload yang pernah tersimpan.
 */

/** Header yang boleh disimpan apa adanya. */
export const HEADER_ALLOWLIST = new Set([
  'user-agent',
  'accept-language',
  'content-type',
  'content-length',
  'x-request-id',
  'x-correlation-id',
  'x-forwarded-proto',
  'referer',
  'origin',
]);

/**
 * Nama medan yang isinya tidak pernah disimpan.
 *
 * Dibandingkan setelah dikecilkan huruf dan dibuang pemisahnya, sehingga
 * `client_secret`, `clientSecret`, dan `CLIENT-SECRET` sama-sama tertangkap.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'secret',
  'clientsecret',
  'apikey',
  'apisecret',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'authorization',
  'cookie',
  'setcookie',
  'sessionid',
  'otp',
  'pin',
  'cvv',
  'cardnumber',
  'cardno',
  'accountnumber',
  'norekening',
  'privatekey',
  'signature',
  'salt',
  'credential',
  'credentials',
]);

/**
 * Pola yang menandakan rahasia meski nama medannya tidak dikenal.
 *
 * Diperlukan karena pihak ketiga memberi nama sesukanya. Token JWT tetap
 * terlihat seperti JWT apa pun nama medannya.
 */
const SENSITIVE_VALUE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+$/i, label: 'bearer' },
  { pattern: /^[\w-]+\.[\w-]+\.[\w-]{20,}$/, label: 'jwt' },
  { pattern: /^-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: 'private-key' },
  { pattern: /^(sk|pk)_(live|test)_[A-Za-z0-9]{10,}$/, label: 'provider-key' },
];

export const MASK = '***MASKED***';

/** Kedalaman maksimum penelusuran objek. */
const MAX_DEPTH = 8;
/** Panjang maksimum satu nilai teks yang disimpan. */
const MAX_STRING_LENGTH = 2000;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_\s]/g, '');
}

/** Apakah nama medan ini tidak boleh disimpan isinya. */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(normalizeKey(key));
}

/** Apakah isi ini terlihat seperti rahasia meski namanya tidak dikenal. */
export function looksSensitive(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some((rule) => rule.pattern.test(value.trim()));
}

/**
 * Menyamarkan objek apa pun.
 *
 * Lingkaran rujukan ditangani: objek yang menunjuk dirinya sendiri menghasilkan
 * penanda, bukan penelusuran tanpa henti.
 */
export function sanitize(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (looksSensitive(value)) return MASK;
    // Nilai yang sangat panjang dipotong. Log bukan tempat menyimpan berkas,
    // dan satu muatan besar dapat memenuhi penyimpanan telemetri.
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…[dipotong ${value.length - MAX_STRING_LENGTH} karakter]`
      : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;

  if (depth >= MAX_DEPTH) return '[kedalaman maksimum]';

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[lingkaran]';
    seen.add(value);
    // Larik panjang dipotong agar satu permintaan dengan sepuluh ribu baris
    // tidak menghasilkan satu catatan log sebesar berkas.
    const limited = value.slice(0, 100).map((item) => sanitize(item, depth + 1, seen));
    return value.length > 100 ? [...limited, `[${value.length - 100} lainnya]`] : limited;
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[lingkaran]';
    seen.add(value as object);

    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        out[key] = MASK;
        continue;
      }
      const cleaned = sanitize(item, depth + 1, seen);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }

  return String(value);
}

/**
 * Menyaring header permintaan.
 *
 * Yang tidak ada pada daftar izin **dibuang seluruhnya**, bukan disamarkan.
 * Menyimpan nama header yang tidak dikenal beserta penanda tersamar tetap
 * membocorkan bahwa header itu ada, dan kadang keberadaannya sendiri yang
 * menarik bagi penyerang.
 */
export function sanitizeHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
): Record<string, string> {
  if (!headers) return {};

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (!HEADER_ALLOWLIST.has(lower)) continue;
    if (value === undefined) continue;

    const flat = Array.isArray(value) ? value.join(', ') : value;
    out[lower] = flat.length > 512 ? `${flat.slice(0, 512)}…` : flat;
  }
  return out;
}

/**
 * Menyamarkan alamat IP.
 *
 * Oktet terakhir dibuang untuk IPv4, dan separuh belakang untuk IPv6. Ini cukup
 * untuk mengelompokkan asal permintaan tanpa menyimpan alamat yang menunjuk
 * satu orang.
 */
export function maskIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const trimmed = ip.trim().replace(/^::ffff:/, '');

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
    const parts = trimmed.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    return `${parts.slice(0, 4).join(':')}::`;
  }

  return null;
}

/**
 * Membersihkan jejak tumpukan.
 *
 * Jalur berkas absolut memuat nama pengguna dan struktur direktori server.
 * Yang disimpan hanya jalur relatif terhadap akar proyek.
 */
export function sanitizeStack(stack: string | undefined, maxFrames = 30): string | null {
  if (!stack) return null;

  return stack
    .split('\n')
    .slice(0, maxFrames)
    .map((line) =>
      line
        // Windows dan POSIX sama-sama ditangani.
        .replace(/[A-Za-z]:\\[^\s)]*?[\\/](apps|packages|src)[\\/]/g, '$1/')
        .replace(/\/(?:home|Users|opt|var)\/[^\s)]*?\/(apps|packages|src)\//g, '$1/')
        .replace(/\\/g, '/'),
    )
    .join('\n');
}

/**
 * Menormalkan pesan galat untuk pengelompokan.
 *
 * Nilai yang berubah setiap kejadian — id, angka, waktu, alamat surel —
 * diganti penanda. Tanpa itu, satu galat yang sama menghasilkan ribuan
 * kelompok berbeda dan pengelompokan menjadi tidak berguna.
 */
export function normalizeMessage(message: string): string {
  return message
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '{uuid}')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '{email}')
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, '{timestamp}')
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '{ip}')
    .replace(/\b0x[0-9a-f]+\b/gi, '{hex}')
    .replace(/\b\d{3,}\b/g, '{n}')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Menormalkan alamat rute.
 *
 * `/api/v1/orders/8f3a.../lines/42` menjadi `/api/v1/orders/{id}/lines/{n}`.
 * Tanpa ini, setiap pesanan menghasilkan rute yang berbeda dan agregat per
 * rute menjadi tidak berarti.
 */
export function normalizeRoute(path: string): string {
  return path
    .split('?')[0]
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return '{id}';
      if (/^\d+$/.test(segment)) return '{n}';
      // Segmen panjang tanpa huruf vokal biasanya token atau hash.
      if (segment.length > 24 && !/[aeiou]/i.test(segment)) return '{token}';
      return segment;
    })
    .join('/');
}
