/**
 * Jatah nomor struk untuk mesin kasir yang berjualan tanpa peladen.
 *
 * ## Masalahnya
 *
 * Nomor struk harus unik di seluruh tenant. Ketika daring, peladen yang
 * membagikannya satu per satu dari `number_sequence`, dan tidak ada dua mesin
 * yang bisa mendapat nomor sama karena barisnya dikunci.
 *
 * Saat luring, mesin kasir tidak dapat bertanya. Bila ia menerka — misalnya
 * memakai nomor urut lokalnya sendiri — dua register yang sama-sama luring akan
 * mencetak nomor struk yang sama, dan keduanya baru ketahuan berbenturan pada
 * saat dikirim. Struknya sudah di tangan dua pembeli berbeda.
 *
 * ## Yang dilakukan
 *
 * Selagi masih daring, register meminta **jatah**: peladen memajukan
 * `number_sequence` sejauh ukuran jatah dan mencatat rentangnya milik register
 * itu. Karena urutannya sudah terlanjur maju, penjualan daring tidak akan pernah
 * memakai nomor di dalam rentang tersebut. Tidak ada sumber penomoran kedua —
 * hanya potongan yang dipesan dari sumber yang sudah ada.
 *
 * Berkas ini hanya mengurus pemakaian jatah di sisi mesin kasir. Pembagiannya
 * ada di peladen.
 */

export interface BlokStruk {
  blockId: string;
  terminalId: string;
  outletId: string;
  prefix: string;
  padding: number;
  /** Nomor pertama pada jatah, ikut terpakai. */
  fromNumber: number;
  /** Nomor terakhir pada jatah, ikut terpakai. */
  toNumber: number;
  /** Nomor berikutnya yang belum dipakai. */
  nextNumber: number;
  allocatedAt: string;
  /** Tanggal usaha jatah ini berlaku; null bila tidak dibatasi. */
  businessDate: string | null;
}

export type KeadaanBlok = 'TIDAK_ADA' | 'CUKUP' | 'MENIPIS' | 'HABIS' | 'SALAH_REGISTER';

export interface PenilaianBlok {
  state: KeadaanBlok;
  remaining: number;
  /** Boleh dipakai menerbitkan struk luring? */
  usable: boolean;
  message: string;
}

/**
 * Sisa jatah yang membuat layar mulai memperingatkan.
 *
 * Peringatannya bukan supaya kasir berhemat — nomor struk tidak perlu dihemat —
 * melainkan supaya ia sempat menyambung ke peladen sebelum jatahnya habis.
 * Peringatan yang muncul saat sisa satu tidak menolong siapa pun.
 */
export const AMBANG_MENIPIS = 20;

export function sisaBlok(b: BlokStruk): number {
  return Math.max(0, b.toNumber - b.nextNumber + 1);
}

export function nilaiBlok(blok: BlokStruk | null, terminalId: string | null): PenilaianBlok {
  if (!blok) {
    return {
      state: 'TIDAK_ADA',
      remaining: 0,
      usable: false,
      message:
        'Register ini belum punya jatah nomor struk. Sambungkan ke peladen sekali untuk ' +
        'mengambil jatah sebelum berjualan luring.',
    };
  }

  /*
   * Jatah milik register lain tidak boleh dipakai, meskipun ada di mesin ini.
   *
   * Terjadi ketika satu komputer dipakai bergantian sebagai dua register: jatah
   * yang tertinggal dari register sebelumnya masih tersimpan. Memakainya berarti
   * dua register menerbitkan nomor dari rentang yang sama.
   */
  if (terminalId && blok.terminalId !== terminalId) {
    return {
      state: 'SALAH_REGISTER',
      remaining: 0,
      usable: false,
      message:
        'Jatah nomor struk yang tersimpan milik register lain. Ambil jatah baru untuk ' +
        'register ini sebelum berjualan luring.',
    };
  }

  const sisa = sisaBlok(blok);
  if (sisa <= 0) {
    return {
      state: 'HABIS',
      remaining: 0,
      usable: false,
      message:
        'Jatah nomor struk habis. Penjualan luring dihentikan sampai peladen dapat dihubungi ' +
        'untuk mengambil jatah baru — struk tanpa nomor tidak dapat dipertanggungjawabkan.',
    };
  }

  if (sisa <= AMBANG_MENIPIS) {
    return {
      state: 'MENIPIS',
      remaining: sisa,
      usable: true,
      message: `Jatah nomor struk tinggal ${sisa}. Sambungkan ke peladen untuk mengambil jatah baru.`,
    };
  }

  return {
    state: 'CUKUP',
    remaining: sisa,
    usable: true,
    message: `Jatah nomor struk tersisa ${sisa}.`,
  };
}

/**
 * Mengambil satu nomor dari jatah.
 *
 * Mengembalikan nomornya beserta jatah yang sudah termaju satu. Tidak mengubah
 * masukannya: pemanggil yang menyimpan hasilnya, dan penyimpanan itu harus
 * berhasil sebelum struknya tercetak. Kalau urutannya dibalik, mesin yang mati
 * di antara keduanya akan menerbitkan nomor yang sama dua kali.
 */
export function ambilNomor(blok: BlokStruk): { nomor: string; blok: BlokStruk } | null {
  if (sisaBlok(blok) <= 0) return null;
  const n = blok.nextNumber;
  return {
    nomor: `${blok.prefix}${String(n).padStart(blok.padding, '0')}`,
    blok: { ...blok, nextNumber: n + 1 },
  };
}
