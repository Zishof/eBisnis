/**
 * Aturan penerimaan kiriman dari internet — fungsi murni.
 *
 * Melengkapi pembatas laju berbasis IP. Keduanya menjaga hal yang berbeda, dan
 * yang kedua justru yang lebih menentukan:
 *
 * **Pembatas laju IP** menahan satu mesin yang mengirim cepat. Ia tidak menahan
 * seratus mesin yang masing-masing mengirim sekali — dan itu persis bentuk
 * pengiriman massal yang sebenarnya terjadi.
 *
 * **Aturan di sini** menjaga antreannya: berapa banyak lamaran yang boleh masuk
 * ke satu koperasi dalam sehari, dan berapa sering satu nomor telepon boleh
 * mengirim. Yang dilindungi bukan peladen melainkan **pengurus koperasi** —
 * orang yang harus membaca setiap kiriman satu per satu, dan yang akan berhenti
 * membacanya bila isinya seratus baris sampah.
 *
 * ## Yang sengaja TIDAK dilakukan
 *
 * Tidak ada CAPTCHA. Ia menyulitkan calon anggota yang memakai telepon lama
 * atau yang penglihatannya terbatas, sedangkan pengirim massal membayar orang
 * untuk menyelesaikannya. Yang dipakai adalah batas yang tidak terasa oleh
 * orang yang mendaftar sekali.
 */

import { createHash } from 'node:crypto';

export interface Verdict {
  allowed: boolean;
  message?: string;
  code?: string;
  /** Detik sampai boleh mencoba lagi; dipakai tajuk `Retry-After`. */
  retryAfter?: number;
}

/**
 * Batas lamaran per koperasi per hari.
 *
 * Koperasi yang menerima lima puluh lamaran sehari sudah luar biasa ramai.
 * Angka ini bukan tentang kemampuan peladen melainkan tentang berapa banyak
 * yang sanggup dibaca pengurus — dan lamaran yang tidak pernah dibaca sama
 * saja dengan lamaran yang tidak pernah masuk.
 */
export const BATAS_HARIAN_PER_KOPERASI = 50;

/**
 * Jeda antar kiriman dari nomor telepon yang sama.
 *
 * Enam jam. Cukup lama untuk menahan pengiriman berulang, cukup pendek supaya
 * orang yang salah ketik nomornya dapat memperbaikinya pada hari yang sama.
 */
export const JEDA_NOMOR_SAMA_DETIK = 6 * 60 * 60;

export interface KeadaanAntrean {
  /** Lamaran yang masuk ke koperasi ini dalam 24 jam terakhir. */
  lamaranHariIni: number;
  /** Detik sejak nomor telepon ini terakhir mengirim; null bila belum pernah. */
  detikSejakNomorTerakhir: number | null;
  /** Nomor ini sudah punya lamaran yang belum diperiksa pengurus. */
  adaYangMasihMenunggu: boolean;
}

export function bolehMenerimaLamaran(k: KeadaanAntrean): Verdict {
  /*
   * Lamaran yang masih menunggu diperiksa lebih dahulu, dan pesannya
   * menenangkan — orang yang mengirim dua kali biasanya mengira yang pertama
   * gagal, bukan sedang mencoba membanjiri.
   */
  if (k.adaYangMasihMenunggu) {
    return {
      allowed: false,
      code: 'ALREADY_PENDING',
      message:
        'Pendaftaran Anda sudah kami terima dan sedang menunggu pemeriksaan pengurus. ' +
        'Tidak perlu mengirim ulang.',
    };
  }

  if (
    k.detikSejakNomorTerakhir !== null &&
    k.detikSejakNomorTerakhir < JEDA_NOMOR_SAMA_DETIK
  ) {
    const sisa = JEDA_NOMOR_SAMA_DETIK - k.detikSejakNomorTerakhir;
    return {
      allowed: false,
      code: 'PHONE_COOLDOWN',
      message: `Nomor ini baru saja mengirim pendaftaran. Coba lagi dalam ${Math.ceil(sisa / 3600)} jam.`,
      retryAfter: sisa,
    };
  }

  if (k.lamaranHariIni >= BATAS_HARIAN_PER_KOPERASI) {
    /*
     * Pesannya TIDAK menyebutkan bahwa batasnya tercapai karena banjir
     * kiriman. Calon anggota yang tidak bersalah tidak perlu tahu bahwa
     * koperasi ini sedang diserang, dan yang menyerang tidak perlu memperoleh
     * kepastian bahwa serangannya berhasil.
     */
    return {
      allowed: false,
      code: 'DAILY_QUOTA_REACHED',
      message:
        'Pendaftaran daring sedang penuh untuk hari ini. Silakan coba besok, ' +
        'atau hubungi pengurus koperasi secara langsung.',
      retryAfter: 3600,
    };
  }

  return { allowed: true };
}

// -------------------------------------------------------------- Isian

/** Nomor telepon Indonesia yang masuk akal, setelah dinormalkan. */
const POLA_TELEPON = /^(?:\+62|62|0)8[1-9][0-9]{6,11}$/;

/**
 * Menormalkan nomor telepon menjadi satu bentuk.
 *
 * `0812…`, `62812…`, dan `+62 812-…` adalah nomor yang sama. Menyimpannya
 * dalam tiga bentuk membuat jeda antar kiriman tidak berlaku — pengirim yang
 * sama cukup mengganti bentuknya untuk melewatinya.
 */
export function normalkanTelepon(mentah: string): string | null {
  const bersih = mentah.replace(/[\s\-().]/g, '');
  if (!POLA_TELEPON.test(bersih)) return null;
  if (bersih.startsWith('+62')) return `0${bersih.slice(3)}`;
  if (bersih.startsWith('62')) return `0${bersih.slice(2)}`;
  return bersih;
}

export interface IsianLamaran {
  fullName: string;
  phone: string;
  email?: string | null;
  motivation?: string | null;
}

/**
 * Memeriksa isian sebelum menyentuh basis data.
 *
 * Bukan penjagaan keamanan — itu tugas constraint dan pembatas laju. Ini
 * penjagaan **mutu antrean**: kiriman yang jelas bukan dari manusia tidak perlu
 * sampai ke meja pengurus.
 */
export function periksaIsian(isian: IsianLamaran): Verdict {
  const nama = isian.fullName.trim();

  if (nama.length < 3) {
    return { allowed: false, code: 'NAME_TOO_SHORT', message: 'Nama lengkap terlalu pendek.' };
  }
  if (nama.length > 120) {
    return { allowed: false, code: 'NAME_TOO_LONG', message: 'Nama lengkap terlalu panjang.' };
  }

  /*
   * Nama yang tidak memuat satu pun huruf hampir pasti bukan nama. Diperiksa
   * dengan mencari huruf, bukan dengan menolak angka — nama yang memuat angka
   * memang jarang, tetapi menolaknya akan menolak orang yang namanya memang
   * demikian tertulis pada kartu identitasnya.
   */
  if (!/\p{L}/u.test(nama)) {
    return { allowed: false, code: 'NAME_NOT_A_NAME', message: 'Nama lengkap tidak sah.' };
  }

  // Tautan pada kolom nama adalah tanda kiriman massal, bukan calon anggota.
  if (/https?:\/\/|www\./i.test(nama)) {
    return { allowed: false, code: 'NAME_HAS_LINK', message: 'Nama lengkap tidak sah.' };
  }

  if (!normalkanTelepon(isian.phone)) {
    return {
      allowed: false,
      code: 'PHONE_INVALID',
      message: 'Nomor telepon tidak sah. Contoh: 081234567890.',
    };
  }

  if (isian.email && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(isian.email.trim())) {
    return { allowed: false, code: 'EMAIL_INVALID', message: 'Alamat surel tidak sah.' };
  }

  const alasan = isian.motivation?.trim() ?? '';
  if (alasan.length > 2000) {
    return { allowed: false, code: 'MOTIVATION_TOO_LONG', message: 'Uraian terlalu panjang.' };
  }

  /*
   * Lebih dari dua tautan pada alasan bergabung adalah tanda kiriman massal.
   * Satu tautan dibiarkan — calon anggota kadang menyertakan tautan usahanya,
   * dan menolaknya akan menolak orang yang justru paling berniat.
   */
  const tautan = (alasan.match(/https?:\/\//gi) ?? []).length;
  if (tautan > 2) {
    return {
      allowed: false,
      code: 'TOO_MANY_LINKS',
      message: 'Uraian memuat terlalu banyak tautan.',
    };
  }

  return { allowed: true };
}

/**
 * Menyidik alamat IP untuk disimpan.
 *
 * Yang disimpan sidiknya, bukan alamatnya. Alamat IP adalah data pribadi;
 * menyimpannya utuh pada tabel yang dibaca pengurus koperasi berarti
 * membagikannya kepada orang yang tidak memerlukannya. Sidik cukup untuk
 * menghitung berapa kiriman datang dari sumber yang sama.
 *
 * Garamnya adalah pengenal penyewa, sehingga alamat yang sama menghasilkan
 * sidik berbeda di koperasi berbeda — kiriman seseorang tidak dapat
 * dirangkaikan antar penyewa.
 *
 * ## Sejauh mana ini melindungi
 *
 * Terhadap **paparan biasa**: baris yang dibaca pengurus, ekspor CSV, tangkapan
 * layar, keluaran kueri saat menelusuri masalah. Di sanalah alamat pengunjung
 * paling sering bocor, dan di sanalah sidik ini menahannya.
 *
 * **Bukan** terhadap penyerang yang sudah memegang basis datanya. Garamnya
 * bukan rahasia, dan ruang alamat IPv4 cukup kecil untuk dicoba seluruhnya.
 * Menyebutnya perlindungan penuh akan keliru — tetapi tabel yang sama sudah
 * memuat nama, nomor telepon, dan alamat rumah pelamar, yang jauh lebih peka
 * daripada alamat IP-nya. Bila kelak diinginkan yang lebih kuat, tempatnya
 * adalah lada rahasia pada konfigurasi Core, bukan di sini.
 */
export function sidikSumber(ip: string | undefined, garam: string): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${garam}:${ip}`).digest('hex').slice(0, 32);
}
