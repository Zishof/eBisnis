/**
 * Aturan pembayaran memakai saldo simpanan anggota — fungsi murni.
 *
 * Sisi koperasi dari IR-002. Core memanggil `authorize`, `capture`, dan
 * `reverse`; berkas ini menentukan kapan ketiganya boleh berhasil.
 *
 * ## Dua hal yang dijaga paling ketat
 *
 * **Simpanan pokok dan wajib tidak pernah dapat dibelanjakan.** Keduanya modal
 * keanggotaan, bukan titipan — anggota tidak dapat menariknya selama masih
 * menjadi anggota, dan membiarkannya terpakai di kasir berarti mengizinkan
 * penarikan lewat pintu belakang. Sifat itu sudah ditegakkan basis data pada
 * K-3 (`is_equity`, `allows_withdrawal`); di sini ia ditegakkan sekali lagi,
 * sebab jalur kasir adalah jalur yang paling sering dipakai dan paling jarang
 * diperiksa.
 *
 * **PIN tidak pernah melewati kasir.** Yang sampai ke sini hanyalah bukti
 * sekali pakai yang diterbitkan portal anggota setelah PIN diperiksa pada
 * perangkat anggota sendiri. Bukti itu kredensial pembawa; ia dibatasi
 * nilainya, dibatasi umurnya, dan tidak dapat dipakai dua kali.
 */

export interface Verdict {
  allowed: boolean;
  message?: string;
  code?: string;
}

/** Umur bukti persetujuan. Cukup untuk mengantre, tidak cukup untuk ditinggal. */
export const UMUR_BUKTI_DETIK = 180;

export interface ProdukSimpanan {
  savingKind: string;
  allowsWithdrawal: boolean;
  isEquity: boolean;
  name: string;
}

/**
 * Bolehkah rekening dengan produk ini dipakai membayar?
 *
 * Diperiksa `is_equity` DAN `allows_withdrawal`, bukan salah satunya. Keduanya
 * seharusnya selalu sejalan — constraint K-3 menegakkannya — tetapi
 * mengandalkan satu berarti bergantung pada constraint yang berlaku di tempat
 * lain. Pemeriksaan ini berdiri sendiri.
 */
export function bolehDipakaiMembayar(p: ProdukSimpanan): Verdict {
  if (p.isEquity) {
    return {
      allowed: false,
      code: 'EQUITY_SAVING',
      message: `${p.name} adalah modal keanggotaan dan tidak dapat dibelanjakan.`,
    };
  }
  if (!p.allowsWithdrawal) {
    return {
      allowed: false,
      code: 'NOT_WITHDRAWABLE',
      message: `${p.name} tidak dapat ditarik.`,
    };
  }
  return { allowed: true };
}

export interface KeadaanRekening {
  status: string;
  balance: string;
  /** Jumlah penahanan yang masih menggantung pada rekening ini. */
  heldAmount: string;
  minimumBalance: string;
}

/**
 * Saldo yang benar-benar dapat dibelanjakan.
 *
 * Saldo dikurangi penahanan yang masih menggantung, lalu dikurangi saldo
 * minimum. Mengabaikan penahanan berarti satu saldo dapat dijanjikan kepada
 * dua transaksi sekaligus — dan yang kedua baru gagal saat diwujudkan, ketika
 * barangnya sudah keluar.
 */
export function saldoTersedia(r: KeadaanRekening): number {
  const saldo = Number(r.balance);
  const tertahan = Number(r.heldAmount);
  const minimum = Number(r.minimumBalance);
  if (!Number.isFinite(saldo) || !Number.isFinite(tertahan) || !Number.isFinite(minimum)) return 0;
  return Math.max(0, saldo - tertahan - minimum);
}

export function bolehMenahan(r: KeadaanRekening, nilai: number): Verdict {
  if (r.status !== 'ACTIVE') {
    return {
      allowed: false,
      code: 'ACCOUNT_NOT_ACTIVE',
      message: 'Rekening simpanan Anda tidak aktif.',
    };
  }
  if (!(nilai > 0)) {
    return { allowed: false, code: 'AMOUNT_INVALID', message: 'Nilai pembayaran tidak sah.' };
  }
  if (saldoTersedia(r) < nilai) {
    /*
     * Pesannya TIDAK menyebutkan berapa saldonya.
     *
     * Layar kasir terlihat pelanggan berikutnya, dan berapa simpanan seorang
     * anggota bukan urusan orang yang kebetulan mengantre di belakangnya.
     * Anggota dapat melihat saldonya sendiri di portal.
     */
    return {
      allowed: false,
      code: 'INSUFFICIENT_BALANCE',
      message: 'Saldo simpanan tidak mencukupi.',
    };
  }
  return { allowed: true };
}

// ------------------------------------------------------------ Bukti anggota

export interface KeadaanBukti {
  memberId: string;
  maxAmount: string;
  expiresAt: string;
  usedAt: string | null;
  outletId: string | null;
  now: string;
}

/**
 * Bolehkah bukti ini dipakai untuk pembayaran sebesar ini?
 *
 * Seluruh penolakan berbunyi sama. Kasir yang memasukkan bukti keliru tidak
 * perlu tahu apakah buktinya sudah terpakai, kedaluwarsa, atau milik anggota
 * lain — dan orang yang mencoba menebak bukti orang lain tidak boleh
 * memperoleh keterangan dari perbedaan pesannya.
 */
export function bolehMemakaiBukti(
  b: KeadaanBukti | null,
  nilai: number,
  outletId: string | null,
): Verdict {
  const tolak = (code: string): Verdict => ({
    allowed: false,
    code,
    message: 'Bukti persetujuan tidak berlaku. Minta anggota membuat yang baru.',
  });

  if (!b) return tolak('TOKEN_NOT_FOUND');
  if (b.usedAt) return tolak('TOKEN_USED');
  if (b.now >= b.expiresAt) return tolak('TOKEN_EXPIRED');

  /*
   * Nilai yang dibayar tidak boleh melebihi yang disetujui anggota. Anggota
   * menyetujui sebuah jumlah pada layarnya sendiri; kasir tidak dapat
   * menaikkannya setelah itu.
   */
  if (nilai > Number(b.maxAmount)) return tolak('AMOUNT_EXCEEDS_TOKEN');

  /*
   * Bukti yang terikat pada satu gerai tidak berlaku di gerai lain. Anggota
   * yang menyetujui pembayaran di toko koperasi tidak sedang menyetujui
   * pembayaran di kantor cabang.
   */
  if (b.outletId && outletId && b.outletId !== outletId) return tolak('TOKEN_WRONG_OUTLET');

  return { allowed: true };
}

// ------------------------------------------------------------- Keanggotaan

export interface KeadaanAnggota {
  status: string;
  cooperativeId: string;
}

export function bolehMembayar(a: KeadaanAnggota | null, cooperativeId: string): Verdict {
  if (!a) {
    return {
      allowed: false,
      code: 'NOT_A_MEMBER',
      message: 'Pelanggan ini belum terdaftar sebagai anggota koperasi.',
    };
  }
  if (a.cooperativeId !== cooperativeId) {
    return { allowed: false, code: 'CROSS_COOPERATIVE', message: 'Data tidak ditemukan.' };
  }
  if (a.status !== 'ACTIVE') {
    /*
     * Anggota yang dibekukan atau berhenti tidak dapat membelanjakan
     * simpanannya di kasir. Penarikannya berjalan lewat loket, tempat
     * pengurus dapat memeriksa keadaannya — dan tempat penyelesaian
     * keanggotaan memang diurus.
     */
    return {
      allowed: false,
      code: 'MEMBERSHIP_NOT_ACTIVE',
      message: 'Keanggotaan tidak aktif. Hubungi pengurus koperasi.',
    };
  }
  return { allowed: true };
}

// --------------------------------------------------------------- Penahanan

export const HOLD_STATES = ['AUTHORIZED', 'CAPTURED', 'REVERSED'] as const;
export type HoldState = (typeof HOLD_STATES)[number];

/**
 * Bolehkah penahanan berpindah keadaan?
 *
 * `CAPTURED` dan `REVERSED` bersifat akhir. Penahanan yang sudah diwujudkan
 * tidak dapat dilepaskan, dan yang sudah dilepaskan tidak dapat diwujudkan;
 * keduanya berarti saldo bergerak dua kali ke arah berlawanan.
 */
export function bolehPindahKeadaan(dari: string, ke: HoldState): Verdict {
  if (dari === 'AUTHORIZED' && (ke === 'CAPTURED' || ke === 'REVERSED')) {
    return { allowed: true };
  }
  if (dari === ke) {
    /*
     * Bukan galat. POS dapat memanggil `capture()` dua kali bila jaringan
     * putus setelah panggilan pertama berhasil, dan pemanggilan kedua harus
     * berakhir dengan keadaan yang sama — bukan dengan kegagalan yang
     * menggulung balik transaksi yang sudah benar.
     */
    return { allowed: false, code: 'ALREADY_IN_STATE', message: `Penahanan sudah ${ke}.` };
  }
  return {
    allowed: false,
    code: 'HOLD_STATE_FINAL',
    message: `Penahanan berstatus ${dari} tidak dapat menjadi ${ke}.`,
  };
}

/** Apakah pemanggilan ulang ini sudah selesai sebelumnya? */
export function sudahSelesai(dari: string, ke: HoldState): boolean {
  return dari === ke;
}

export interface RingkasanPembayaran {
  memberId: string;
  savingAccountId: string;
  amount: number;
}

/**
 * Menyusun keterangan transaksi simpanan saat penahanan diwujudkan.
 *
 * Menyebut nomor struk, bukan hanya "pembayaran kasir". Anggota yang memeriksa
 * mutasinya sebulan kemudian perlu dapat mencocokkannya dengan struk yang ia
 * simpan — dan tanpa nomor itu, satu-satunya jalan adalah menebak dari tanggal.
 */
export function keteranganMutasi(nomorStruk: string | null, namaOutlet: string | null): string {
  const bagian = ['Pembayaran belanja'];
  if (namaOutlet) bagian.push(`di ${namaOutlet}`);
  if (nomorStruk) bagian.push(`(struk ${nomorStruk})`);
  return bagian.join(' ');
}
