/**
 * Keadaan sambungan kasir — aturan murni, tanpa jaringan.
 *
 * ## Mengapa `navigator.onLine` saja tidak cukup
 *
 * `navigator.onLine` hanya menjawab "apakah ada antarmuka jaringan yang aktif".
 * Ia bernilai `true` pada Wi-Fi warung yang sudah tersambung tetapi tidak dapat
 * mencapai peladen — keadaan yang justru paling sering terjadi: router menyala,
 * langganan internetnya yang mati.
 *
 * Kasir yang membaca "daring" lalu transaksinya gagal satu per satu akan
 * kehilangan kepercayaan pada seluruh layar. Karena itu keadaan sambungan di
 * sini ditentukan oleh **apakah peladen benar-benar menjawab**, bukan oleh
 * apakah ada Wi-Fi.
 */

export type KeadaanKoneksi = 'DARING' | 'LURING' | 'MEMERIKSA' | 'TERBATAS';

export interface RingkasanKoneksi {
  state: KeadaanKoneksi;
  /** Kalimat yang dibaca kasir. Selalu menyebutkan akibatnya bagi pekerjaannya. */
  message: string;
  /** Benar bila transaksi baru akan tersimpan lokal dahulu. */
  queueing: boolean;
  /** Milidetik sejak peladen terakhir menjawab; null bila belum pernah. */
  lastReachableAgoMs: number | null;
}

export interface MasukanKoneksi {
  /** Laporan peramban. Dipakai sebagai petunjuk, bukan sebagai kebenaran. */
  browserOnline: boolean;
  /** Waktu peladen terakhir menjawab, dalam milidetik epoch. */
  lastReachableAt: number | null;
  /** Waktu percobaan terakhir, berhasil atau tidak. */
  lastAttemptAt: number | null;
  /** Percobaan terakhir berhasil? Null bila belum pernah mencoba. */
  lastAttemptOk: boolean | null;
  now: number;
}

/**
 * Berapa lama peladen boleh diam sebelum sambungan dianggap tidak sehat,
 * meski peramban masih mengatakan daring.
 */
export const AMBANG_DIAM_MS = 30_000;

export function nilaiKoneksi(m: MasukanKoneksi): RingkasanKoneksi {
  const jeda = m.lastReachableAt === null ? null : m.now - m.lastReachableAt;

  if (m.lastAttemptOk === null) {
    return {
      state: 'MEMERIKSA',
      message: 'Memeriksa sambungan ke peladen…',
      queueing: false,
      lastReachableAgoMs: jeda,
    };
  }

  if (!m.browserOnline) {
    return {
      state: 'LURING',
      message: 'Tidak ada jaringan. Transaksi disimpan di mesin ini dan dikirim otomatis nanti.',
      queueing: true,
      lastReachableAgoMs: jeda,
    };
  }

  if (!m.lastAttemptOk) {
    /*
     * Inilah keadaan yang paling menyesatkan bila tidak dibedakan: jaringan ada,
     * peladen tidak menjawab. Kasir perlu tahu bahwa masalahnya bukan pada
     * kabel di mejanya, supaya tidak menghabiskan waktu mencabut-colok router.
     */
    return {
      state: 'TERBATAS',
      message:
        'Jaringan tersambung, tetapi peladen tidak menjawab. Transaksi disimpan di mesin ini ' +
        'dan dikirim otomatis begitu peladen kembali.',
      queueing: true,
      lastReachableAgoMs: jeda,
    };
  }

  if (jeda !== null && jeda > AMBANG_DIAM_MS) {
    return {
      state: 'TERBATAS',
      message: `Peladen terakhir menjawab ${Math.round(jeda / 1000)} detik lalu. Sambungan sedang tidak stabil.`,
      queueing: true,
      lastReachableAgoMs: jeda,
    };
  }

  return {
    state: 'DARING',
    message: 'Tersambung ke peladen.',
    queueing: false,
    lastReachableAgoMs: jeda,
  };
}

/**
 * Jeda sebelum percobaan berikutnya, membesar secara bertahap.
 *
 * Mencoba setiap detik saat peladen mati hanya membebani mesin kasir dan
 * memenuhi catatan galat, tanpa membuat peladen kembali lebih cepat. Tetapi
 * jedanya dibatasi: kasir yang menunggu peladen pulih tidak boleh menunggu
 * lebih lama daripada yang diperlukan setelah peladen benar-benar hidup lagi.
 */
export const JEDA_MAKS_MS = 30_000;

export function jedaPercobaan(gagalBerturut: number): number {
  if (gagalBerturut <= 0) return 5_000;
  const jeda = 2_000 * 2 ** Math.min(gagalBerturut - 1, 10);
  return Math.min(jeda, JEDA_MAKS_MS);
}

/** Warna lencana pada batang status. Dipisah supaya dapat diuji tanpa DOM. */
export function warnaKoneksi(state: KeadaanKoneksi): 'hijau' | 'kuning' | 'merah' | 'kelabu' {
  switch (state) {
    case 'DARING':
      return 'hijau';
    case 'TERBATAS':
      return 'kuning';
    case 'LURING':
      return 'merah';
    default:
      return 'kelabu';
  }
}
