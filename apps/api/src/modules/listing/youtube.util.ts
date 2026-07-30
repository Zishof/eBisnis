/**
 * Validasi URL YouTube untuk video produk.
 *
 * Bahaya yang ditutup di sini: kolom `youtubeUrl` yang isinya diteruskan apa
 * adanya ke atribut `src` sebuah iframe. Bila nilainya tidak divalidasi,
 * seorang penjual dapat memasang `javascript:`, `data:`, atau alamat situs lain
 * yang dijalankan di dalam halaman toko.
 *
 * Maka yang disimpan bukan URL yang dikirim penjual, melainkan **id video**
 * yang diekstrak darinya. Alamat embed dibangun sistem dari id itu, sehingga
 * apa pun yang dikirim penjual tidak pernah menjadi bagian dari HTML.
 */

/** Host yang diterima. Tidak ada yang lain. */
const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/** Id video YouTube: 11 karakter dari himpunan base64url. */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export interface YoutubeResult {
  ok: boolean;
  videoId?: string;
  /** Alamat embed yang dibangun sistem, bukan dari input. */
  embedUrl?: string;
  /** Alamat gambar sampul, juga dibangun sistem. */
  thumbnailUrl?: string;
  reason?: string;
}

/**
 * Mengekstrak id video dari URL.
 *
 * Yang diterima: `watch?v=`, `youtu.be/<id>`, `/embed/<id>`, `/shorts/<id>`,
 * dan `/live/<id>`. Bentuk lain ditolak — termasuk daftar putar dan kanal,
 * yang bukan video tunggal.
 */
export function parseYoutubeUrl(raw: string | null | undefined): YoutubeResult {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, reason: 'URL kosong.' };
  }

  const value = raw.trim();

  // Batasi panjang sebelum diurai; URL yang sangat panjang tidak pernah sah dan
  // hanya membuang waktu pengurai.
  if (value.length > 2048) {
    return { ok: false, reason: 'URL terlalu panjang.' };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: 'Bukan URL yang sah.' };
  }

  // Hanya http dan https. Ini yang menutup `javascript:`, `data:`, dan `file:`.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: `Protokol "${url.protocol}" tidak diterima.` };
  }

  // Kredensial pada URL tidak pernah sah untuk video publik dan menandakan
  // usaha mengelabui pembaca.
  if (url.username || url.password) {
    return { ok: false, reason: 'URL tidak boleh memuat kredensial.' };
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!ALLOWED_HOSTS.has(host)) {
    return { ok: false, reason: `Host "${host}" bukan alamat YouTube resmi.` };
  }

  const videoId = extractVideoId(url, host);
  if (!videoId) {
    return { ok: false, reason: 'Id video tidak ditemukan pada URL.' };
  }
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    return { ok: false, reason: 'Id video tidak berbentuk id YouTube yang sah.' };
  }

  // Alamat di bawah dibangun dari id, bukan dari input. Inilah yang membuat
  // apa pun yang dikirim penjual tidak pernah masuk ke HTML.
  return {
    ok: true,
    videoId,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

function extractVideoId(url: URL, host: string): string | null {
  // youtu.be/<id>
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    return url.pathname.split('/').filter(Boolean)[0] ?? null;
  }

  const segments = url.pathname.split('/').filter(Boolean);

  // /watch?v=<id>
  if (segments[0] === 'watch') {
    return url.searchParams.get('v');
  }

  // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  if (['embed', 'shorts', 'live', 'v'].includes(segments[0] ?? '')) {
    return segments[1] ?? null;
  }

  return null;
}

/**
 * Membangun alamat embed dari id yang sudah tersimpan.
 *
 * Dipisahkan agar penyaji tidak perlu menyimpan URL sama sekali — cukup id, dan
 * alamatnya dibentuk saat dibutuhkan.
 */
export function buildEmbedUrl(videoId: string): string | null {
  if (!VIDEO_ID_PATTERN.test(videoId)) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
