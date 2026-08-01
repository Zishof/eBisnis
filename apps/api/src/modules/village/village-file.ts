/**
 * Aturan berkas unggahan — fungsi murni, tanpa basis data dan tanpa cakram.
 *
 * ## Metadata foto dibuang, dan itu aturan terpenting di berkas ini
 *
 * Foto dari ponsel membawa **EXIF**: koordinat GPS tempat ia diambil, merek dan
 * nomor seri kamera, kadang nama pemilik perangkat. Warga yang memotret
 * pembuangan sampah tetangganya lalu mengunggahnya tidak tahu bahwa ia sedang
 * melampirkan koordinat rumahnya sendiri.
 *
 * Lebih dari itu, membiarkannya **membatalkan keputusan yang sudah diambil**:
 * aplikasi warga sengaja mengirim *lokasi kejadian yang ditunjuk warga*, bukan
 * posisi ponselnya. EXIF yang lolos mengembalikan posisi ponsel lewat pintu
 * belakang — dan tidak seorang pun akan menyadarinya, sebab ia tidak tampak di
 * layar mana pun.
 *
 * Karena itu EXIF tidak "dibersihkan sebisanya" melainkan **dibuang seluruhnya
 * sebelum berkas disimpan**, dan berkas yang tidak dapat dibersihkan ditolak.
 *
 * ## Daftar izin, bukan daftar larangan
 *
 * Hanya JPEG dan PNG. Bukan karena format lain jahat, melainkan karena hanya
 * keduanya yang metadata-nya dapat dibuang dengan pasti oleh kode di berkas
 * ini. Format yang tidak dapat dibersihkan tidak diterima — termasuk yang
 * terlihat aman seperti WebP dan HEIC.
 */

export type Putusan = {
  boleh: boolean;
  alasan?: string;
};

// --- Jenis berkas yang diterima ----------------------------------------------

export type JenisGambar = 'image/jpeg' | 'image/png';

/**
 * Daftar izin jenis berkas.
 *
 * HEIC sengaja tidak ada meskipun ia bawaan iPhone: metadatanya berada di dalam
 * bungkus ISOBMFF yang tidak dapat dibuang oleh kode sederhana, dan menerima
 * berkas yang tidak dapat dibersihkan lebih buruk daripada menyuruh warga
 * mengubah setelan kameranya.
 */
export const JENIS_DIIZINKAN: readonly JenisGambar[] = ['image/jpeg', 'image/png'];

/** Ukuran satu berkas. Foto ponsel biasa 2–5 MB; delapan memberi ruang cukup. */
export const UKURAN_MAKSIMAL_BYTE = 8 * 1024 * 1024;

/**
 * Jumlah berkas per pengaduan.
 *
 * Sama dengan batas pada aplikasi warga. Pengaduan dengan dua puluh foto tidak
 * dibaca petugas mana pun, dan yang tidak dibaca tidak ditindaklanjuti.
 */
export const BERKAS_MAKSIMAL_PER_PENGADUAN = 3;

export interface BerkasMasuk {
  namaAsli: string;
  mimeDilaporkan: string;
  ukuranByte: number;
  /** Delapan bita pertama, untuk memeriksa jenis sebenarnya. */
  awalan: Uint8Array;
}

/**
 * Menebak jenis berkas dari **isinya**, bukan dari yang dilaporkan pengunggah.
 *
 * `Content-Type` dan nama berkas datang dari pengunggah dan dapat diisi apa
 * saja. Berkas bernama `foto.jpg` bertipe `image/jpeg` yang isinya HTML akan
 * dijalankan peramban sebagai HTML bila kelak disajikan tanpa header yang
 * benar — dan "kelak" itu selalu tiba.
 */
export function jenisSebenarnya(awalan: Uint8Array): JenisGambar | null {
  if (awalan.length >= 3 && awalan[0] === 0xff && awalan[1] === 0xd8 && awalan[2] === 0xff) {
    return 'image/jpeg';
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (awalan.length >= 8 && png.every((b, i) => awalan[i] === b)) return 'image/png';
  return null;
}

export function periksaBerkas(b: BerkasMasuk): Putusan {
  if (b.ukuranByte <= 0) {
    return { boleh: false, alasan: 'Berkas kosong.' };
  }
  if (b.ukuranByte > UKURAN_MAKSIMAL_BYTE) {
    const mb = Math.round(UKURAN_MAKSIMAL_BYTE / 1024 / 1024);
    return {
      boleh: false,
      alasan: `Ukuran foto melebihi ${mb} MB. Kecilkan dahulu, atau ambil ulang dengan mutu lebih rendah.`,
    };
  }

  const asli = jenisSebenarnya(b.awalan);
  if (!asli) {
    return {
      boleh: false,
      alasan:
        'Berkas ini bukan foto JPEG atau PNG. Bila Anda memakai iPhone, ubah setelan kamera ' +
        'menjadi "Paling Cocok" agar fotonya tersimpan sebagai JPEG.',
    };
  }

  // Yang dilaporkan pengunggah hanya dipakai untuk menyebut ketidakcocokan,
  // tidak pernah untuk memutuskan. Yang memutuskan adalah isinya.
  if (!JENIS_DIIZINKAN.includes(asli)) {
    return { boleh: false, alasan: 'Jenis berkas ini tidak diterima.' };
  }

  return { boleh: true };
}

export function bolehTambahBerkas(jumlahSekarang: number): Putusan {
  if (jumlahSekarang >= BERKAS_MAKSIMAL_PER_PENGADUAN) {
    return {
      boleh: false,
      alasan:
        `Paling banyak ${BERKAS_MAKSIMAL_PER_PENGADUAN} foto per laporan. Pengaduan dengan ` +
        'terlalu banyak foto jarang selesai dibaca, dan yang tidak dibaca tidak ditindaklanjuti.',
    };
  }
  return { boleh: true };
}

// --- Pembuangan metadata -----------------------------------------------------

/**
 * Membuang seluruh metadata dari JPEG.
 *
 * JPEG tersusun dari segmen bertanda. Yang dibuang adalah seluruh segmen
 * APP0–APP15 (`0xFFE0`–`0xFFEF`, tempat EXIF dan XMP berada) dan COM
 * (`0xFFFE`, komentar bebas). Yang disisakan hanya segmen yang benar-benar
 * diperlukan untuk menggambar: kuantisasi, Huffman, dan data pindainya.
 *
 * Dibuang **seluruhnya**, bukan hanya ruas GPS. Menghapus GPS saja menyisakan
 * nomor seri kamera — yang menghubungkan seluruh foto dari ponsel yang sama,
 * termasuk yang dikirim sebagai pengaduan "tanpa nama".
 */
export function buangMetadataJpeg(data: Uint8Array): Uint8Array | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;

  const keluar: number[] = [0xff, 0xd8];
  let i = 2;

  while (i < data.length) {
    if (data[i] !== 0xff) return null; // Bukan batas segmen: berkas rusak.

    // Bita pengisi 0xFF berturut-turut dibolehkan oleh standar.
    let j = i;
    while (j < data.length && data[j] === 0xff) j += 1;
    if (j >= data.length) return null;

    const penanda = data[j];

    // Mulai data pindai: sisanya disalin apa adadanya sampai akhir.
    if (penanda === 0xda) {
      keluar.push(0xff, 0xda);
      for (let k = j + 1; k < data.length; k += 1) keluar.push(data[k]);
      return Uint8Array.from(keluar);
    }

    if (penanda === 0xd9) {
      keluar.push(0xff, 0xd9);
      return Uint8Array.from(keluar);
    }

    if (j + 2 >= data.length) return null;
    const panjang = (data[j + 1] << 8) | data[j + 2];
    if (panjang < 2 || j + 1 + panjang > data.length) return null;

    const dibuang = (penanda >= 0xe0 && penanda <= 0xef) || penanda === 0xfe;
    if (!dibuang) {
      keluar.push(0xff, penanda);
      for (let k = j + 1; k < j + 1 + panjang; k += 1) keluar.push(data[k]);
    }
    i = j + 1 + panjang;
  }

  return null; // Habis tanpa menemukan data pindai: berkas tidak utuh.
}

/**
 * Membuang seluruh metadata dari PNG.
 *
 * PNG tersusun dari potongan (*chunk*) bernama. Yang **disisakan** hanya
 * potongan yang diperlukan untuk menggambar — daftar izin, bukan daftar
 * larangan: potongan baru yang kelak ditambahkan standar tidak diam-diam ikut
 * lolos.
 */
const POTONGAN_PNG_DIIZINKAN = new Set([
  'IHDR', // ukuran dan kedalaman warna
  'PLTE', // palet
  'IDAT', // data gambar
  'IEND', // penutup
  'tRNS', // transparansi
  'gAMA',
  'sRGB',
]);

export function buangMetadataPng(data: Uint8Array): Uint8Array | null {
  const tanda = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (data.length < 8 || !tanda.every((b, i) => data[i] === b)) return null;

  const keluar: number[] = [...tanda];
  let i = 8;
  let adaIhdr = false;
  let adaIdat = false;

  while (i + 8 <= data.length) {
    const panjang =
      (data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3];
    if (panjang < 0 || i + 12 + panjang > data.length) return null;

    const nama = String.fromCharCode(data[i + 4], data[i + 5], data[i + 6], data[i + 7]);
    const akhir = i + 12 + panjang;

    if (POTONGAN_PNG_DIIZINKAN.has(nama)) {
      for (let k = i; k < akhir; k += 1) keluar.push(data[k]);
      if (nama === 'IHDR') adaIhdr = true;
      if (nama === 'IDAT') adaIdat = true;
    }

    i = akhir;
    if (nama === 'IEND') break;
  }

  if (!adaIhdr || !adaIdat) return null;
  return Uint8Array.from(keluar);
}

/**
 * Membuang metadata sesuai jenisnya.
 *
 * Mengembalikan `null` bila berkas tidak dapat dibersihkan — dan pemanggil
 * **wajib menolaknya**, bukan menyimpannya apa adanya. Berkas yang tidak dapat
 * dibersihkan adalah berkas yang metadatanya tidak diketahui isinya.
 */
export function buangMetadata(jenis: JenisGambar, data: Uint8Array): Uint8Array | null {
  return jenis === 'image/jpeg' ? buangMetadataJpeg(data) : buangMetadataPng(data);
}

/**
 * Apakah data ini masih memuat penanda metadata?
 *
 * Dipakai pengujian dan bukti. Bukan pengganti pembuangan — pemeriksaan setelah
 * pembuangan, sebab aturan sepenting ini tidak boleh hanya dipercaya.
 */
export function masihAdaMetadata(jenis: JenisGambar, data: Uint8Array): boolean {
  if (jenis === 'image/jpeg') {
    for (let i = 0; i + 1 < data.length; i += 1) {
      if (data[i] !== 0xff) continue;
      const p = data[i + 1];
      if (p === 0xda) return false; // Sampai data pindai: bersih.
      if ((p >= 0xe0 && p <= 0xef) || p === 0xfe) return true;
    }
    return false;
  }

  const teks = ['eXIf', 'tEXt', 'zTXt', 'iTXt'];
  const isi = Buffer.from(data).toString('latin1');
  return teks.some((t) => isi.includes(t));
}

// --- Siapa yang boleh melihat ------------------------------------------------

export type PerannyaTerhadapBerkas = 'PELAPOR' | 'PETUGAS' | 'ORANG_LAIN';

/**
 * Bolehkah berkas bukti pengaduan dilihat?
 *
 * **Tidak pernah publik.** Berbeda dari media CMS yang memang untuk ditayangkan,
 * foto pengaduan memperlihatkan rumah, wajah, pelat nomor, dan halaman orang.
 * Foto pembuangan sampah selalu memuat pagar rumah seseorang.
 *
 * Yang boleh melihat hanya pelapornya sendiri dan petugas yang menangani.
 * Warga lain tidak — termasuk pada daftar pengaduan yang terbuka.
 */
export function bolehLihatBukti(peran: PerannyaTerhadapBerkas): Putusan {
  if (peran === 'PELAPOR' || peran === 'PETUGAS') return { boleh: true };
  return {
    boleh: false,
    alasan:
      'Foto bukti pengaduan hanya dapat dilihat pelapor dan petugas yang menangani. ' +
      'Foto pengaduan memperlihatkan rumah dan halaman orang.',
  };
}

/** Nama berkas yang aman untuk disimpan. */
export function amankanNama(namaAsli: string): string {
  const bersih = (namaAsli ?? '')
    .replace(/[\\/]/g, '')
    .replace(/\.\./g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(-80);
  return bersih.length >= 3 ? bersih : 'foto';
}
