/**
 * Membuat ikon PWA untuk layar kasir.
 *
 * Ikon PNG berukuran 192 dan 512 piksel WAJIB ada agar peramban menawarkan
 * "Pasang". Tanpanya seluruh berkas manifest yang lain tidak berguna: aplikasi
 * tidak dapat dipasang, dan mesin kasir tidak pernah punya pintasan sendiri.
 *
 * Digambar dengan kode, bukan berkas biner yang dilempar ke dalam repositori,
 * karena dua alasan. Berkas biner tidak dapat ditinjau pada permintaan tarik —
 * yang terlihat hanyalah "berkas berubah". Dan ikon ini **sementara**: begitu
 * logo resmi tersedia, naskah ini yang diganti, dan perubahannya terbaca.
 *
 * Pemakaian:
 *   node scripts/buat-ikon-pwa.mjs
 *
 * Tidak memakai pustaka apa pun; PNG dirakit langsung dengan zlib bawaan Node.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KELUARAN = fileURLToPath(new URL('../public/', import.meta.url));

/** Warna merek; sama dengan `theme_color` pada manifest. */
const LATAR = [15, 23, 42]; // slate-900
const TANDA = [255, 255, 255];

/** Tabel CRC32 untuk potongan PNG. */
const TABEL_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABEL_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function potongan(jenis, data) {
  const panjang = Buffer.alloc(4);
  panjang.writeUInt32BE(data.length);
  const isi = Buffer.concat([Buffer.from(jenis, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(isi));
  return Buffer.concat([panjang, isi, crc]);
}

/** Menyusun PNG RGBA dari fungsi warna per piksel. */
function png(ukuran, warnaDi) {
  // Setiap baris diawali satu byte penyaring; 0 berarti tanpa penyaringan.
  const baris = Buffer.alloc(ukuran * (ukuran * 4 + 1));
  let p = 0;
  for (let y = 0; y < ukuran; y += 1) {
    baris[p] = 0;
    p += 1;
    for (let x = 0; x < ukuran; x += 1) {
      const [r, g, b, a] = warnaDi(x, y, ukuran);
      baris[p] = r;
      baris[p + 1] = g;
      baris[p + 2] = b;
      baris[p + 3] = a;
      p += 4;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ukuran, 0);
  ihdr.writeUInt32BE(ukuran, 4);
  ihdr[8] = 8; // kedalaman bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    potongan('IHDR', ihdr),
    potongan('IDAT', deflateSync(baris, { level: 9 })),
    potongan('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Bentuk struk: persegi panjang putih bergerigi di sisi bawah, dengan tiga
 * garis yang mewakili baris cetakan.
 *
 * Mengembalikan warna piksel, atau `null` bila titiknya di luar struk sehingga
 * pemanggil memakai warna latarnya sendiri.
 *
 * Sengaja geometris dan tanpa huruf. Huruf yang digambar per piksel tanpa mesin
 * font akan terlihat buruk pada 192 piksel, dan ikon yang terlihat buruk pada
 * bilah tugas mesin kasir dipakai setiap hari oleh orang yang tidak memilihnya.
 *
 * Seluruh bentuknya berada di dalam 30–70% mendatar dan 24–72% menegak, yang
 * juga membuatnya muat di zona aman ikon maskable tanpa perlu diperkecil lagi.
 */
function struk(x, y, n) {
  const kiri = n * 0.3;
  const kanan = n * 0.7;
  const atas = n * 0.24;
  const bawah = n * 0.72;
  if (x < kiri || x > kanan || y < atas || y > bawah) return null;

  // Gerigi bawah: tiga takik segitiga yang menembus sampai ke latar.
  if (y > bawah - n * 0.07) {
    const lebar = (kanan - kiri) / 3;
    const dalam = ((x - kiri) % lebar) / lebar;
    const tinggiTakik = Math.abs(dalam - 0.5) * 2;
    if (y > bawah - n * 0.07 * tinggiTakik) return null;
  }

  // Tiga garis teks pada struk.
  for (const g of [0.36, 0.46, 0.56].map((v) => n * v)) {
    if (y >= g && y <= g + n * 0.035 && x >= kiri + n * 0.05 && x <= kanan - n * 0.05) {
      return LATAR;
    }
  }
  return TANDA;
}

/** Ikon biasa: persegi membulat, sudut di luarnya tembus pandang. */
function tandaKasir(x, y, n) {
  if (!sudutMembulat(x, y, n, n * 0.22)) return [0, 0, 0, 0];
  return [...(struk(x, y, n) ?? LATAR), 255];
}

/** Benar bila titik berada di dalam persegi membulat. */
function sudutMembulat(x, y, n, r) {
  const dx = Math.min(x, n - 1 - x);
  const dy = Math.min(y, n - 1 - y);
  if (dx >= r || dy >= r) return true;
  const jx = r - dx;
  const jy = r - dy;
  return jx * jx + jy * jy <= r * r;
}

/**
 * Ikon maskable: penuh sampai ke tepi, tanpa sudut membulat dan tanpa satu pun
 * piksel tembus pandang.
 *
 * Peluncur Android memotong sendiri ikon maskable menjadi lingkaran, kotak
 * membulat, atau bentuk lain sesuai peranti. Menyerahkan ikon yang sudah
 * membulat berarti sudutnya dipotong dua kali: yang tersisa adalah bentuk
 * membulat yang mengambang di dalam bentuk potongan peluncur, dengan celah
 * kosong di antaranya.
 */
function tandaMaskable(x, y, n) {
  return [...(struk(x, y, n) ?? LATAR), 255];
}

mkdirSync(dirname(`${KELUARAN}x`), { recursive: true });

for (const ukuran of [192, 512]) {
  writeFileSync(`${KELUARAN}pwa-${ukuran}.png`, png(ukuran, tandaKasir));
  console.log(`pwa-${ukuran}.png dibuat`);
}
writeFileSync(`${KELUARAN}pwa-512-maskable.png`, png(512, tandaMaskable));
console.log('pwa-512-maskable.png dibuat');
