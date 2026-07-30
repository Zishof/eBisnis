/**
 * Validasi berkas media produk.
 *
 * Seluruh pemeriksaan di sini dilakukan **tanpa mendekode gambar**. Itu
 * disengaja: bom dekompresi bekerja justru dengan membuat pendekode
 * mengembangkan berkas kecil menjadi gigabyte. Dimensi dibaca dari header,
 * dan berkas ditolak sebelum satu piksel pun dibentuk.
 *
 * Tidak ada dependensi native di berkas ini. Deteksi tipe dan pembacaan dimensi
 * memakai magic byte, yang cukup untuk empat format yang diterima. Pustaka
 * pengolah gambar hanya dibutuhkan untuk MEMBUAT turunan, dan itu bukan kontrol
 * keamanan — lihat catatan pada bagian akhir docs/upgrade-v9/18.
 */

/** Format yang diterima sebagai gambar produk. */
export type ImageFormat = 'JPEG' | 'PNG' | 'WEBP' | 'GIF';

export interface ImageProbe {
  format: ImageFormat;
  width: number;
  height: number;
  mimeType: string;
}

export type MediaRejectionCode =
  | 'EMPTY'
  | 'TOO_LARGE'
  | 'UNKNOWN_FORMAT'
  | 'EXTENSION_MISMATCH'
  | 'DIMENSION_TOO_SMALL'
  | 'DIMENSION_TOO_LARGE'
  | 'PIXEL_BUDGET_EXCEEDED'
  | 'ASPECT_RATIO_EXTREME'
  | 'HEADER_TRUNCATED';

export interface MediaValidationResult {
  ok: boolean;
  probe?: ImageProbe;
  code?: MediaRejectionCode;
  /** Pesan untuk pengunggah; menyebut apa yang harus diperbaiki. */
  message?: string;
}

/** Batas ukuran berkas. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Dimensi minimum agar gambar layak ditampilkan. */
export const MIN_DIMENSION = 500;
/** Dimensi maksimum per sisi. */
export const MAX_DIMENSION = 8000;
/**
 * Batas total piksel. Inilah pertahanan utama terhadap bom dekompresi: berkas
 * PNG beberapa kilobyte dapat menyatakan dimensi 60.000 × 60.000, yang bila
 * didekode menuntut belasan gigabyte memori.
 */
export const MAX_PIXELS = 40_000_000;
/** Rasio sisi terpanjang terhadap terpendek. */
export const MAX_ASPECT_RATIO = 5;

/**
 * Ekstensi yang boleh dipakai, dipetakan ke format yang harus cocok.
 *
 * Ekstensi TIDAK dipercaya sebagai penentu tipe — ia hanya diperiksa agar tidak
 * bertentangan dengan isi berkas. Berkas `.jpg` yang isinya PNG menandakan
 * pengunggah yang bingung atau sengaja mengelabui, dan keduanya layak ditolak.
 */
const EXTENSION_FORMATS: Record<string, ImageFormat> = {
  jpg: 'JPEG',
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WEBP',
  gif: 'GIF',
};

const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
  GIF: 'image/gif',
};

/**
 * Memeriksa satu berkas gambar.
 *
 * `declaredName` dipakai hanya untuk memeriksa konsistensi ekstensi; tipe
 * sebenarnya selalu berasal dari isi berkas.
 */
export function validateImage(buffer: Buffer, declaredName: string): MediaValidationResult {
  if (buffer.length === 0) {
    return { ok: false, code: 'EMPTY', message: 'Berkas kosong.' };
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return {
      ok: false,
      code: 'TOO_LARGE',
      message: `Ukuran berkas ${formatBytes(buffer.length)} melebihi batas ${formatBytes(MAX_FILE_BYTES)}.`,
    };
  }

  const probe = probeImage(buffer);
  if (!probe) {
    // Tipe ditentukan dari isi, bukan dari ekstensi maupun Content-Type. Berkas
    // `.jpg` yang sebenarnya skrip PHP atau SVG ditolak di sini.
    return {
      ok: false,
      code: 'UNKNOWN_FORMAT',
      message: 'Isi berkas bukan gambar JPEG, PNG, WebP, atau GIF.',
    };
  }

  const extension = declaredName.split('.').pop()?.toLowerCase() ?? '';
  const expected = EXTENSION_FORMATS[extension];
  if (!expected) {
    return {
      ok: false,
      code: 'EXTENSION_MISMATCH',
      message: `Ekstensi ".${extension}" tidak diterima. Pakai .jpg, .png, .webp, atau .gif.`,
    };
  }
  if (expected !== probe.format) {
    return {
      ok: false,
      code: 'EXTENSION_MISMATCH',
      message: `Berkas berekstensi ".${extension}" tetapi isinya ${probe.format}.`,
    };
  }

  if (probe.width < MIN_DIMENSION || probe.height < MIN_DIMENSION) {
    return {
      ok: false,
      code: 'DIMENSION_TOO_SMALL',
      message: `Gambar ${probe.width}×${probe.height} terlalu kecil. Minimum ${MIN_DIMENSION}×${MIN_DIMENSION}.`,
    };
  }
  if (probe.width > MAX_DIMENSION || probe.height > MAX_DIMENSION) {
    return {
      ok: false,
      code: 'DIMENSION_TOO_LARGE',
      message: `Gambar ${probe.width}×${probe.height} melebihi ${MAX_DIMENSION} piksel per sisi.`,
    };
  }
  if (probe.width * probe.height > MAX_PIXELS) {
    return {
      ok: false,
      code: 'PIXEL_BUDGET_EXCEEDED',
      message: `Gambar ${probe.width}×${probe.height} melebihi batas total piksel.`,
    };
  }

  const ratio = Math.max(probe.width, probe.height) / Math.min(probe.width, probe.height);
  if (ratio > MAX_ASPECT_RATIO) {
    return {
      ok: false,
      code: 'ASPECT_RATIO_EXTREME',
      message: `Perbandingan sisi ${ratio.toFixed(1)}:1 terlalu ekstrem untuk gambar produk.`,
    };
  }

  return { ok: true, probe };
}

/**
 * Membaca format dan dimensi dari header.
 *
 * Mengembalikan `null` untuk apa pun yang bukan salah satu dari empat format.
 * SVG sengaja tidak termasuk: ia dokumen XML yang dapat memuat skrip, dan
 * menyanitasinya dengan benar jauh lebih sulit daripada menolaknya.
 */
export function probeImage(buffer: Buffer): ImageProbe | null {
  const png = probePng(buffer);
  if (png) return png;
  const gif = probeGif(buffer);
  if (gif) return gif;
  const webp = probeWebp(buffer);
  if (webp) return webp;
  return probeJpeg(buffer);
}

/** PNG: 8 byte tanda tangan, lalu chunk IHDR berisi lebar dan tinggi. */
function probePng(buffer: Buffer): ImageProbe | null {
  const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(SIGNATURE)) return null;
  if (buffer.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  return {
    format: 'PNG',
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    mimeType: MIME_BY_FORMAT.PNG,
  };
}

/** GIF: "GIF87a" atau "GIF89a", lalu lebar dan tinggi little-endian. */
function probeGif(buffer: Buffer): ImageProbe | null {
  if (buffer.length < 10) return null;
  const header = buffer.subarray(0, 6).toString('ascii');
  if (header !== 'GIF87a' && header !== 'GIF89a') return null;
  return {
    format: 'GIF',
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
    mimeType: MIME_BY_FORMAT.GIF,
  };
}

/** WebP: kontainer RIFF, lalu salah satu dari tiga varian VP8. */
function probeWebp(buffer: Buffer): ImageProbe | null {
  if (buffer.length < 30) return null;
  if (buffer.subarray(0, 4).toString('ascii') !== 'RIFF') return null;
  if (buffer.subarray(8, 12).toString('ascii') !== 'WEBP') return null;

  const variant = buffer.subarray(12, 16).toString('ascii');
  if (variant === 'VP8 ') {
    // Lossy: kode awal 3 byte, lalu tanda 0x9d012a, lalu dimensi 14 bit.
    if (buffer.length < 30) return null;
    return {
      format: 'WEBP',
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
      mimeType: MIME_BY_FORMAT.WEBP,
    };
  }
  if (variant === 'VP8L') {
    // Lossless: 14 bit lebar dan tinggi, dikurangi satu, dikemas rapat.
    const bits = buffer.readUInt32LE(21);
    return {
      format: 'WEBP',
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
      mimeType: MIME_BY_FORMAT.WEBP,
    };
  }
  if (variant === 'VP8X') {
    // Extended: dimensi 24 bit dikurangi satu.
    const width = buffer.readUIntLE(24, 3) + 1;
    const height = buffer.readUIntLE(27, 3) + 1;
    return { format: 'WEBP', width, height, mimeType: MIME_BY_FORMAT.WEBP };
  }
  return null;
}

/**
 * JPEG: menelusuri marker sampai menemukan Start Of Frame.
 *
 * Penelusuran dibatasi agar berkas yang dibuat-buat tidak membuat pemindaian
 * berjalan tanpa henti.
 */
function probeJpeg(buffer: Buffer): ImageProbe | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  let guard = 0;
  while (offset + 9 < buffer.length && guard < 2000) {
    guard += 1;
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];

    // SOF0–SOF15, kecuali DHT (c4), JPG (c8), dan DAC (cc).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (offset + 9 >= buffer.length) return null;
      return {
        format: 'JPEG',
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
        mimeType: MIME_BY_FORMAT.JPEG,
      };
    }

    // Marker tanpa muatan.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }
  return null;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}
