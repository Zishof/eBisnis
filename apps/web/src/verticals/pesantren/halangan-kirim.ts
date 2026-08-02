/**
 * Mengapa tombol "Daftarkan pondok" belum dapat ditekan.
 *
 * ## Cacat yang diperbaiki berkas ini
 *
 * Sebelumnya tombol kirim menjadi kelabu ketika ada syarat yang belum
 * terpenuhi, **tanpa menyebut syarat yang mana**. Pengurus pondok melihat
 * formulir yang tampak sudah terisi, tombol yang tidak bereaksi, dan tidak ada
 * satu pun keterangan di layar.
 *
 * Lebih buruk lagi: sebagian syaratnya berada di langkah lain yang sudah
 * terlewat, sehingga yang kurang bahkan tidak terlihat dari tempat tombol itu
 * berada.
 *
 * ## Bentuk jawabannya
 *
 * Setiap halangan menyebut tiga hal:
 *
 *   - **apa** yang kurang, dengan nama kolom yang persis seperti di layar;
 *   - **di langkah berapa** kolom itu berada, supaya dapat dituju langsung;
 *   - **apa yang harus dikerjakan**, dalam kalimat perintah yang pendek.
 *
 * Ditulis untuk dibaca pengurus pondok, bukan untuk dibaca pemrogram. Tidak ada
 * istilah teknis, tidak ada kode galat, dan tidak ada kata "validasi".
 *
 * ## Mengapa fungsi murni
 *
 * Aturannya banyak dan sebagiannya bergantung pada keadaan jaringan yang sulit
 * dihadirkan ulang di layar. Diuji sebagai fungsi, seluruh kemungkinannya dapat
 * diperiksa — termasuk yang jarang terjadi, yang justru paling membingungkan
 * bila salah.
 */

/** Nomor langkah pada formulir, 1-based, sesuai yang tampil di layar. */
export const LANGKAH_IDENTITAS = 1;
export const LANGKAH_PENYELENGGARAAN = 2;
export const LANGKAH_KONTAK = 4;
export const LANGKAH_AKUN = 5;

export interface KeadaanFormulir {
  namaPondok: string;
  email: string;
  slugSitus: string;
  desiredUsername: string;
  jumlahJenjangDipilih: number;

  slugSedangDiperiksa: boolean;
  slugTersedia?: boolean;
  slugGagalDiperiksa: boolean;
  /** Pemeriksaan sudah selesai sedikitnya sekali — berhasil maupun gagal. */
  slugSudahDijawab: boolean;
  slugPesan?: string;

  usernameSedangDiperiksa: boolean;
  usernameTersedia?: boolean;
  usernameGagalDiperiksa: boolean;
  usernameSudahDijawab: boolean;
  usernamePesan?: string;

  setujuSyarat: boolean;
  setujuPrivasi: boolean;
}

export interface Halangan {
  kode: string;
  langkah: number;
  /** Apa yang kurang. Satu kalimat, memakai nama kolom seperti di layar. */
  apa: string;
  /** Apa yang harus dikerjakan. Kalimat perintah, pendek. */
  tindakan: string;
  /**
   * Benar bila ini bukan kesalahan pengisian, melainkan keadaan yang perlu
   * ditunggu atau dicoba lagi. Dipakai memilih warna dan nada pesan: yang
   * sedang menunggu tidak boleh terlihat seperti yang salah.
   */
  menunggu?: boolean;
}

const POLA_SUREL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Seluruh alasan tombol kirim belum dapat ditekan.
 *
 * Larik kosong berarti sudah dapat ditekan.
 *
 * Urutannya mengikuti urutan langkah pada formulir — bukan urutan kepentingan.
 * Orang yang memperbaiki dari atas ke bawah bergerak maju melewati formulir,
 * bukan melompat mundur lalu maju lagi.
 */
export function halanganKirim(k: KeadaanFormulir): Halangan[] {
  const halangan: Halangan[] = [];

  // --- Langkah 1 ---
  if (!k.namaPondok.trim()) {
    halangan.push({
      kode: 'NAMA_KOSONG',
      langkah: LANGKAH_IDENTITAS,
      apa: 'Nama pondok pesantren belum diisi.',
      tindakan: 'Buka langkah 1 dan tuliskan nama lengkap pondok.',
    });
  }

  // --- Langkah 2 ---
  if (k.jumlahJenjangDipilih === 0) {
    halangan.push({
      kode: 'JENJANG_KOSONG',
      langkah: LANGKAH_PENYELENGGARAAN,
      apa: 'Belum ada jenjang pendidikan yang dicentang.',
      tindakan:
        'Buka langkah 2 dan centang sedikitnya satu jenjang yang diselenggarakan pondok, ' +
        'misalnya Madrasah Diniyah Takmiliyah atau Program Tahfiz.',
    });
  }

  // --- Langkah 4 ---
  const surel = k.email.trim();
  if (!surel) {
    halangan.push({
      kode: 'SUREL_KOSONG',
      langkah: LANGKAH_KONTAK,
      apa: 'Alamat surel belum diisi.',
      tindakan: 'Buka langkah 4 dan isi surel pengurus yang akan menerima pemberitahuan.',
    });
  } else if (!POLA_SUREL.test(surel)) {
    halangan.push({
      kode: 'SUREL_TIDAK_SAH',
      langkah: LANGKAH_KONTAK,
      apa: `Alamat surel "${surel}" belum berbentuk alamat surel yang benar.`,
      tindakan:
        'Buka langkah 4 dan perbaiki. Alamat surel selalu memuat tanda @ dan sebuah titik, ' +
        'misalnya pengurus@namapondok.sch.id',
    });
  }

  // --- Langkah 5: alamat situs ---
  const slug = k.slugSitus.trim();
  if (!slug) {
    halangan.push({
      kode: 'SLUG_KOSONG',
      langkah: LANGKAH_AKUN,
      apa: 'Alamat situs pondok belum diisi.',
      tindakan: 'Isi alamat situs, misalnya ponpes-demo untuk ponpes-demo.santri.info',
    });
  } else if (slug.length < 3) {
    halangan.push({
      kode: 'SLUG_PENDEK',
      langkah: LANGKAH_AKUN,
      apa: `Alamat situs "${slug}" terlalu pendek.`,
      tindakan: 'Pakai sedikitnya 3 huruf.',
    });
  } else if (k.slugSedangDiperiksa) {
    halangan.push({
      kode: 'SLUG_DIPERIKSA',
      langkah: LANGKAH_AKUN,
      apa: 'Alamat situs sedang diperiksa apakah masih tersedia.',
      tindakan: 'Tunggu sebentar, biasanya kurang dari satu detik.',
      menunggu: true,
    });
  } else if (k.slugGagalDiperiksa) {
    halangan.push({
      kode: 'SLUG_GAGAL_DIPERIKSA',
      langkah: LANGKAH_AKUN,
      apa: 'Ketersediaan alamat situs belum dapat diperiksa karena sambungan ke server terputus.',
      tindakan:
        'Periksa sambungan internet Anda, lalu ubah sedikit isi kolom alamat situs ' +
        'agar pemeriksaannya diulang. Bila tetap gagal, hubungi kami.',
      menunggu: true,
    });
  } else if (k.slugTersedia === false) {
    halangan.push({
      kode: 'SLUG_TERPAKAI',
      langkah: LANGKAH_AKUN,
      apa: k.slugPesan?.trim() || `Alamat situs "${slug}" tidak dapat dipakai.`,
      tindakan:
        'Ganti dengan alamat lain, misalnya dengan menambahkan nama daerah — ' +
        `${slug}-bojonegoro.`,
    });
  } else if (k.slugSudahDijawab && k.slugTersedia === undefined) {
    /*
     * Server menjawab, tetapi jawabannya bukan yang dimengerti halaman ini.
     *
     * Dibedakan dari "sedang diperiksa" dengan sengaja. Keadaan ini TIDAK akan
     * selesai sendiri, sehingga menyuruh menunggu adalah menyuruh menunggu
     * selamanya — dan itu persis yang membuat orang menekan tombol berulang kali
     * tanpa apa pun berubah.
     */
    halangan.push({
      kode: 'SLUG_JAWABAN_TAK_TERBACA',
      langkah: LANGKAH_AKUN,
      apa: 'Server menjawab pemeriksaan alamat situs, tetapi jawabannya tidak dapat dibaca halaman ini.',
      tindakan:
        'Muat ulang halaman ini. Bila sesudah dimuat ulang tetap sama, kemungkinan ' +
        'besar layanannya sedang bermasalah — hubungi kami dan sebutkan alamat situs ' +
        'yang Anda coba.',
      menunggu: true,
    });
  } else if (k.slugTersedia !== true) {
    halangan.push({
      kode: 'SLUG_BELUM_DIPERIKSA',
      langkah: LANGKAH_AKUN,
      apa: 'Alamat situs belum selesai diperiksa.',
      tindakan: 'Tunggu sebentar sampai keterangan "Tersedia" muncul di bawah kolomnya.',
      menunggu: true,
    });
  }

  // --- Langkah 5: nama pengguna ---
  const nama = k.desiredUsername.trim();
  if (!nama) {
    halangan.push({
      kode: 'NAMA_PENGGUNA_KOSONG',
      langkah: LANGKAH_AKUN,
      apa: 'Nama pengguna belum diisi.',
      tindakan: 'Isi nama pengguna yang akan dipakai pengurus untuk masuk.',
    });
  } else if (nama.length < 3) {
    halangan.push({
      kode: 'NAMA_PENGGUNA_PENDEK',
      langkah: LANGKAH_AKUN,
      apa: `Nama pengguna "${nama}" terlalu pendek.`,
      tindakan: 'Pakai sedikitnya 3 huruf.',
    });
  } else if (k.usernameSedangDiperiksa) {
    halangan.push({
      kode: 'NAMA_PENGGUNA_DIPERIKSA',
      langkah: LANGKAH_AKUN,
      apa: 'Nama pengguna sedang diperiksa apakah masih tersedia.',
      tindakan: 'Tunggu sebentar, biasanya kurang dari satu detik.',
      menunggu: true,
    });
  } else if (k.usernameGagalDiperiksa) {
    halangan.push({
      kode: 'NAMA_PENGGUNA_GAGAL_DIPERIKSA',
      langkah: LANGKAH_AKUN,
      apa: 'Ketersediaan nama pengguna belum dapat diperiksa karena sambungan ke server terputus.',
      tindakan:
        'Periksa sambungan internet Anda, lalu ubah sedikit isi kolom nama pengguna ' +
        'agar pemeriksaannya diulang. Bila tetap gagal, hubungi kami.',
      menunggu: true,
    });
  } else if (k.usernameTersedia === false) {
    halangan.push({
      kode: 'NAMA_PENGGUNA_TERPAKAI',
      langkah: LANGKAH_AKUN,
      apa: k.usernamePesan?.trim() || `Nama pengguna "${nama}" tidak dapat dipakai.`,
      tindakan: 'Ganti dengan nama lain. Usulan penggantinya tampil di bawah kolomnya.',
    });
  } else if (k.usernameSudahDijawab && k.usernameTersedia === undefined) {
    halangan.push({
      kode: 'NAMA_PENGGUNA_JAWABAN_TAK_TERBACA',
      langkah: LANGKAH_AKUN,
      apa: 'Server menjawab pemeriksaan nama pengguna, tetapi jawabannya tidak dapat dibaca halaman ini.',
      tindakan:
        'Muat ulang halaman ini. Bila sesudah dimuat ulang tetap sama, kemungkinan ' +
        'besar layanannya sedang bermasalah — hubungi kami dan sebutkan nama pengguna ' +
        'yang Anda coba.',
      menunggu: true,
    });
  } else if (k.usernameTersedia !== true) {
    halangan.push({
      kode: 'NAMA_PENGGUNA_BELUM_DIPERIKSA',
      langkah: LANGKAH_AKUN,
      apa: 'Nama pengguna belum selesai diperiksa.',
      tindakan: 'Tunggu sebentar sampai keterangan "Tersedia" muncul di bawah kolomnya.',
      menunggu: true,
    });
  }

  // --- Langkah 5: persetujuan ---
  if (!k.setujuSyarat) {
    halangan.push({
      kode: 'SYARAT_BELUM',
      langkah: LANGKAH_AKUN,
      apa: 'Persetujuan syarat dan ketentuan belum dicentang.',
      tindakan: 'Baca syarat dan ketentuan, lalu centang kotaknya.',
    });
  }
  if (!k.setujuPrivasi) {
    halangan.push({
      kode: 'PRIVASI_BELUM',
      langkah: LANGKAH_AKUN,
      apa: 'Persetujuan kebijakan privasi belum dicentang.',
      tindakan: 'Baca kebijakan privasi, lalu centang kotaknya.',
    });
  }

  return halangan;
}

/** Benar bila seluruh syarat sudah terpenuhi. */
export function bolehKirim(k: KeadaanFormulir): boolean {
  return halanganKirim(k).length === 0;
}
