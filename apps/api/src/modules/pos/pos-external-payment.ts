/**
 * Aturan pembayaran bersaldo eksternal pada kasir — fungsi murni.
 *
 * Melengkapi `external-payment.registry.ts`, yang menyediakan kontraknya.
 * Berkas ini menjawab pertanyaan yang muncul di alur kasir: kapan penangan
 * dipanggil, apa yang boleh terjadi setelahnya, dan apa yang harus dilepaskan
 * bila transaksinya tidak jadi.
 *
 * Dipisahkan dari layanan supaya dapat diuji tanpa basis data — dan supaya
 * urutan keadaannya dapat dibaca sebagai satu halaman, bukan tersebar di
 * antara kueri.
 */

/** Jenis metode pembayaran yang dananya dikelola modul lain. */
export const EXTERNAL_BALANCE_METHOD = 'EXTERNAL_BALANCE';

export const EXTERNAL_STATES = ['AUTHORIZED', 'CAPTURED', 'REVERSED'] as const;
export type ExternalState = (typeof EXTERNAL_STATES)[number];

export interface Verdict {
  allowed: boolean;
  message?: string;
  code?: string;
}

export interface MetodePembayaran {
  methodType: string;
  externalHandler: string | null;
  name: string;
}

/**
 * Perlukah penangan eksternal dipanggil untuk metode ini?
 *
 * Ditentukan `method_type`, bukan oleh ada tidaknya `external_handler`.
 * Membalik urutannya akan membuat metode yang keliru terisi penangannya
 * diam-diam berjalan lewat jalur eksternal.
 */
export function perluPenangan(m: MetodePembayaran): boolean {
  return m.methodType === EXTERNAL_BALANCE_METHOD;
}

/**
 * Bolehkah pembayaran dengan metode ini diproses?
 *
 * Metode `EXTERNAL_BALANCE` tanpa penangan **menggagalkan pembayaran**, bukan
 * berjalan sebagai tunai. Penjualan yang tercatat lunas tanpa ada dana yang
 * berpindah jauh lebih sulit diperbaiki daripada pembayaran yang gagal di
 * depan kasir — pelanggan masih di sana, dan kasir dapat mencoba cara lain.
 */
export function bolehDiproses(m: MetodePembayaran, penanganTerdaftar: boolean): Verdict {
  if (!perluPenangan(m)) return { allowed: true };

  if (!m.externalHandler) {
    return {
      allowed: false,
      code: 'HANDLER_NOT_CONFIGURED',
      message: `Metode ${m.name} belum tersambung ke penyedia saldonya. Pakai metode lain.`,
    };
  }

  if (!penanganTerdaftar) {
    return {
      allowed: false,
      code: 'HANDLER_NOT_REGISTERED',
      message: `Metode ${m.name} sedang tidak tersedia. Pakai metode lain.`,
    };
  }

  return { allowed: true };
}

/**
 * Bolehkah kembalian diberikan pada pembayaran bersaldo eksternal?
 *
 * Tidak pernah. Saldo yang ditahan sebesar nilai transaksi tidak menghasilkan
 * uang tunai di laci; memberi kembalian atasnya berarti mengeluarkan kas untuk
 * dana yang tidak pernah masuk ke laci itu.
 */
export function bolehMemberiKembalian(m: MetodePembayaran): Verdict {
  if (!perluPenangan(m)) return { allowed: true };
  return {
    allowed: false,
    code: 'NO_CHANGE_ON_EXTERNAL',
    message:
      'Pembayaran bersaldo tidak memberi kembalian. Nilai yang ditagih harus sama dengan nilai yang dibayar.',
  };
}

export interface BarisPembayaran {
  id: string;
  externalHandler: string | null;
  externalReference: string | null;
  externalState: string | null;
  status: string;
}

/**
 * Pembayaran yang penahanannya harus diwujudkan saat penjualan diselesaikan.
 *
 * Yang sudah `CAPTURED` dilewati — penyelesaian yang terulang tidak boleh
 * memotong saldo dua kali.
 */
export function perluDiwujudkan(pembayaran: BarisPembayaran[]): BarisPembayaran[] {
  return pembayaran.filter(
    (p) => p.status === 'RECEIVED' && p.externalState === 'AUTHORIZED' && p.externalReference,
  );
}

/**
 * Pembayaran yang penahanannya harus dilepaskan saat penjualan batal.
 *
 * Yang sudah `CAPTURED` **tidak** termasuk. Dana yang sudah berpindah
 * dikembalikan lewat retur, yang punya jejaknya sendiri — melepaskannya
 * diam-diam di sini akan mengembalikan uang tanpa dokumen yang menjelaskannya.
 */
export function perluDilepaskan(pembayaran: BarisPembayaran[]): BarisPembayaran[] {
  return pembayaran.filter((p) => p.externalState === 'AUTHORIZED' && p.externalReference);
}

/**
 * Bolehkah penjualan diselesaikan dengan keadaan pembayaran seperti ini?
 *
 * Menolak bila ada pembayaran eksternal yang belum tertahan sama sekali.
 * Menyelesaikan penjualan dengan pembayaran yang penahanannya gagal berarti
 * menyerahkan barang tanpa dana apa pun berpindah.
 */
export function bolehDiselesaikan(pembayaran: BarisPembayaran[]): Verdict {
  const menggantung = pembayaran.filter(
    (p) => p.status === 'RECEIVED' && p.externalHandler && !p.externalReference,
  );
  if (menggantung.length > 0) {
    return {
      allowed: false,
      code: 'EXTERNAL_NOT_AUTHORIZED',
      message:
        'Ada pembayaran bersaldo yang penahanannya tidak tercatat. Batalkan pembayaran itu lalu ulangi.',
    };
  }
  return { allowed: true };
}

/**
 * Keadaan berikutnya setelah sebuah perpindahan.
 *
 * `CAPTURED` dan `REVERSED` bersifat akhir. Penahanan yang sudah diwujudkan
 * tidak dapat dilepaskan, dan yang sudah dilepaskan tidak dapat diwujudkan —
 * keduanya berarti dana bergerak dua kali ke arah yang berlawanan, dan tidak
 * ada catatan yang dapat menjelaskan hasilnya.
 */
export function bolehPindahKeadaan(dari: string | null, ke: ExternalState): Verdict {
  if (dari === null) {
    if (ke === 'AUTHORIZED') return { allowed: true };
    return {
      allowed: false,
      code: 'NOT_AUTHORIZED_YET',
      message: 'Penahanan belum pernah dibuat.',
    };
  }
  if (dari === 'AUTHORIZED') {
    if (ke === 'CAPTURED' || ke === 'REVERSED') return { allowed: true };
  }
  return {
    allowed: false,
    code: 'EXTERNAL_STATE_FINAL',
    message: `Penahanan berstatus ${dari} tidak dapat menjadi ${ke}.`,
  };
}

/**
 * Menyusun pesan penolakan yang aman ditampilkan kasir.
 *
 * Pesan dari penangan dipakai apa adanya bila ada — penangan yang tahu
 * alasannya dapat menjelaskan lebih baik. Bila tidak ada, dipakai kalimat
 * umum; yang tidak boleh terjadi adalah galat teknis muncul di layar kasir,
 * sebab kasir tidak dapat berbuat apa pun dengannya dan pelanggan membacanya.
 */
export function pesanUntukKasir(dariPenangan: string | undefined, namaMetode: string): string {
  const bersih = dariPenangan?.trim();
  if (bersih && bersih.length > 0 && bersih.length <= 200) return bersih;
  return `Pembayaran dengan ${namaMetode} tidak dapat diteruskan. Pakai metode lain.`;
}
