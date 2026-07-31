/**
 * Aturan portal anggota — fungsi murni.
 *
 * Satu aturan menentukan seluruh berkas ini:
 *
 *   **Anggota hanya melihat dirinya sendiri.**
 *
 * Portal anggota adalah satu-satunya bagian sistem yang dibuka kepada ratusan
 * orang yang bukan pengurus dan bukan petugas. Cakupan datanya karena itu yang
 * paling ketat: bukan "anggota melihat data koperasinya", melainkan "anggota
 * melihat barisnya sendiri". Seorang anggota yang dapat membaca simpanan
 * tetangganya adalah kebocoran yang tidak dapat ditarik kembali — dan tetangga
 * itu tidak akan pernah tahu bahwa datanya pernah terbaca.
 *
 * Aturan di sini ditulis sebagai fungsi murni supaya dapat diuji tanpa
 * menyiapkan basis data, dan supaya setiap jalur baca portal memanggil
 * pemeriksaan yang **sama** — bukan masing-masing menulis penyaringnya sendiri.
 */

// -------------------------------------------------------------- Sumber daya

export const PORTAL_RESOURCES = [
  'PROFILE',
  'SAVING_ACCOUNT',
  'SAVING_TRANSACTION',
  'LOAN',
  'INSTALLMENT',
  'SHU',
  'MEETING',
  'VOTE',
  'COMPLAINT',
  'DOCUMENT',
  'NOTIFICATION',
] as const;
export type PortalResource = (typeof PORTAL_RESOURCES)[number];

/**
 * Sumber daya yang isinya milik bersama, bukan milik seorang anggota.
 *
 * Rapat anggota adalah milik seluruh anggota — setiap anggota berhak membaca
 * agenda, kuorum, dan keputusannya. Yang tetap milik perorangan adalah
 * suaranya.
 */
export const SUMBER_DAYA_BERSAMA: PortalResource[] = ['MEETING'];

export interface Verdict {
  allowed: boolean;
  message?: string;
  /** Alasan penolakan dalam bentuk kode, untuk audit dan pengujian. */
  code?: string;
}

export interface AksesInput {
  resource: PortalResource;
  /** Anggota yang sedang masuk. */
  viewerMemberId: string;
  /** Pemilik baris yang hendak dibaca. Kosong untuk sumber daya bersama. */
  ownerMemberId: string | null;
  viewerStatus: string;
  cooperativeIdOfViewer: string;
  cooperativeIdOfRow: string;
}

/**
 * Bolehkah anggota ini membaca baris itu?
 *
 * Pemeriksaan berlapis, dan urutannya disengaja: koperasi lebih dahulu, baru
 * kepemilikan. Anggota koperasi lain tidak boleh mengetahui **keberadaan**
 * barisnya, apalagi isinya — jadi penolakannya tidak menyebutkan bahwa
 * barisnya ada.
 */
export function bolehMembaca(input: AksesInput): Verdict {
  if (input.cooperativeIdOfViewer !== input.cooperativeIdOfRow) {
    return {
      allowed: false,
      code: 'CROSS_COOPERATIVE',
      // Tidak menyebutkan bahwa barisnya ada. Pesan "data koperasi lain" sudah
      // memberitahu lebih banyak daripada yang perlu diketahui.
      message: 'Data tidak ditemukan.',
    };
  }

  if (input.viewerStatus === 'TERMINATED') {
    /*
     * Bekas anggota kehilangan akses portal, tetapi datanya tidak dihapus —
     * ia masih diperlukan untuk penyelesaian dan untuk audit. Yang hilang
     * hanyalah kemampuannya membaca lewat portal.
     */
    return {
      allowed: false,
      code: 'MEMBERSHIP_ENDED',
      message: 'Keanggotaan Anda telah berakhir. Hubungi pengurus untuk mengakses data Anda.',
    };
  }

  if (SUMBER_DAYA_BERSAMA.includes(input.resource)) {
    return { allowed: true };
  }

  if (!input.ownerMemberId) {
    return {
      allowed: false,
      code: 'OWNER_UNKNOWN',
      message: 'Data tidak ditemukan.',
    };
  }

  if (input.ownerMemberId !== input.viewerMemberId) {
    return {
      allowed: false,
      code: 'NOT_OWNER',
      message: 'Data tidak ditemukan.',
    };
  }

  return { allowed: true };
}

/**
 * Menyaring sekumpulan baris menjadi yang boleh dibaca anggota.
 *
 * Dipakai pada setiap daftar yang ditampilkan portal. Menyaring di sini —
 * satu tempat — lebih aman daripada menuliskan `WHERE member_id = ...` pada
 * belasan kueri, sebab satu kueri yang lupa menyaring sudah cukup.
 */
export function saring<T extends { memberId: string | null; cooperativeId: string }>(
  baris: T[],
  konteks: { viewerMemberId: string; viewerStatus: string; cooperativeId: string; resource: PortalResource },
): T[] {
  return baris.filter(
    (b) =>
      bolehMembaca({
        resource: konteks.resource,
        viewerMemberId: konteks.viewerMemberId,
        ownerMemberId: b.memberId,
        viewerStatus: konteks.viewerStatus,
        cooperativeIdOfViewer: konteks.cooperativeId,
        cooperativeIdOfRow: b.cooperativeId,
      }).allowed,
  );
}

// ----------------------------------------------------------------- Penyamaran

/**
 * Medan yang **tidak pernah** dikirim ke portal anggota.
 *
 * Sebagian karena bukan urusan anggota; sebagian karena berbahaya bila bocor.
 * Daftar ini dipakai pengujian untuk memeriksa bentuk tanggapan portal.
 */
export const MEDAN_TERLARANG = [
  'pin_hash',
  'password_hash',
  'identity_number',
  'notes',
  'appraised_value',
  'estimated_value',
  'character_score',
  'capacity_score',
  'analyzed_by',
  'approved_by',
  'internal_note',
];

/**
 * Membuang medan terlarang dari sebuah objek sebelum dikirim.
 *
 * Menyaring saat mengirim, bukan mengandalkan setiap kueri memilih kolom yang
 * benar. Kueri yang memakai `SELECT *` akan membawa serta kolom yang kelak
 * ditambahkan seseorang, dan tidak ada yang mengingatkan.
 */
export function bersihkan<T extends Record<string, unknown>>(objek: T): Partial<T> {
  const hasil: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(objek)) {
    if (MEDAN_TERLARANG.includes(k)) continue;
    hasil[k] = v;
  }
  return hasil as Partial<T>;
}

/** Menutupi sebagian nomor rekening bank. */
export function samarkanRekening(nomor: string | null): string | null {
  if (!nomor) return null;
  const bersih = nomor.replace(/\s/g, '');
  if (bersih.length <= 4) return '*'.repeat(bersih.length);
  return `${'*'.repeat(bersih.length - 4)}${bersih.slice(-4)}`;
}

/** Menutupi sebagian nomor identitas. */
export function samarkanIdentitas(nik: string | null): string | null {
  if (!nik) return null;
  const bersih = nik.replace(/\s/g, '');
  if (bersih.length <= 6) return '*'.repeat(bersih.length);
  return `${bersih.slice(0, 2)}${'*'.repeat(bersih.length - 6)}${bersih.slice(-4)}`;
}

// ------------------------------------------------------------------- PIN

export interface KeadaanPin {
  pinSetAt: string | null;
  failedCount: number;
  lockedUntil: string | null;
  now: string;
}

export const PIN_MAKSIMUM_GAGAL = 5;
export const PIN_KUNCI_MENIT = 30;

/**
 * Bolehkah PIN diverifikasi sekarang?
 *
 * PIN yang dapat dicoba tanpa batas bukan PIN melainkan tebakan bernomor empat
 * angka. Pembatasan dan penguncian dinyatakan sebagai aturan yang diuji, bukan
 * sebagai kebiasaan pada layanan.
 */
export function bolehVerifikasiPin(k: KeadaanPin): Verdict {
  if (!k.pinSetAt) {
    return {
      allowed: false,
      code: 'PIN_NOT_SET',
      message: 'PIN belum diatur. Aturlah lebih dahulu lewat portal anggota.',
    };
  }
  if (k.lockedUntil && k.now < k.lockedUntil) {
    return {
      allowed: false,
      code: 'PIN_LOCKED',
      message: `PIN terkunci sampai ${k.lockedUntil} karena terlalu banyak percobaan yang salah.`,
    };
  }
  return { allowed: true };
}

export interface HasilGagalPin {
  failedCount: number;
  lockedUntil: string | null;
  locked: boolean;
}

/** Keadaan PIN setelah satu percobaan yang salah. */
export function setelahPinSalah(k: KeadaanPin): HasilGagalPin {
  const failedCount = k.failedCount + 1;
  if (failedCount >= PIN_MAKSIMUM_GAGAL) {
    const sampai = new Date(Date.parse(k.now) + PIN_KUNCI_MENIT * 60_000).toISOString();
    return { failedCount, lockedUntil: sampai, locked: true };
  }
  return { failedCount, lockedUntil: null, locked: false };
}

/**
 * Bolehkah kasir melihat atau mengatur PIN anggota?
 *
 * **Tidak pernah.** Spesifikasi §14 menyebutnya tegas, dan alasannya jelas:
 * kasir yang mengetahui PIN seorang anggota dapat memakai saldonya. Layar PIN
 * adalah milik koperasi dan ditampilkan pada perangkat anggota, bukan pada
 * layar kasir.
 */
export function bolehKasirMengaksesPin(): Verdict {
  return {
    allowed: false,
    code: 'PIN_NEVER_VISIBLE_TO_CASHIER',
    message:
      'PIN anggota tidak pernah terlihat maupun dapat diatur kasir. Anggota mengaturnya sendiri lewat portal.',
  };
}

// ------------------------------------------------------------- Pengaduan

export const COMPLAINT_CATEGORIES = [
  'SERVICE',
  'SAVING',
  'LOAN',
  'SHU',
  'GOVERNANCE',
  'STAFF',
  'UNIT_BUSINESS',
  'OTHER',
] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const COMPLAINT_STATUSES = [
  'SUBMITTED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED',
  'CLOSED',
] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const COMPLAINT_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  SUBMITTED: ['ACKNOWLEDGED', 'REJECTED'],
  ACKNOWLEDGED: ['IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  REJECTED: ['CLOSED'],
  CLOSED: [],
};

export function bolehPindahStatusPengaduan(
  dari: ComplaintStatus,
  ke: ComplaintStatus,
): Verdict {
  if (dari === ke) return { allowed: false, message: `Pengaduan sudah berstatus ${ke}.` };
  if (COMPLAINT_TRANSITIONS[dari].length === 0) {
    return { allowed: false, message: `Pengaduan berstatus ${dari} sudah ditutup.` };
  }
  if (!COMPLAINT_TRANSITIONS[dari].includes(ke)) {
    return { allowed: false, message: `Pengaduan berstatus ${dari} tidak dapat menjadi ${ke}.` };
  }
  return { allowed: true };
}

/**
 * Bolehkah anggota menutup pengaduannya sendiri?
 *
 * Tidak. Pengaduan yang dapat ditutup pelapornya sendiri mudah ditutup oleh
 * orang yang ditegur isinya — dengan meminta pelapornya menutupnya. Penutupan
 * adalah wewenang pengurus, dan pelapor selalu dapat menyatakan keberatan
 * kembali lewat pengaduan baru.
 */
export function bolehAnggotaMenutup(): Verdict {
  return {
    allowed: false,
    code: 'MEMBER_CANNOT_CLOSE',
    message: 'Penutupan pengaduan adalah wewenang pengurus. Anda dapat menambahkan tanggapan.',
  };
}

// ------------------------------------------------------- Pendaftaran publik

export interface PendaftaranPublikInput {
  cooperativeStatus: string;
  membershipScope: string;
  acceptsOnlineApplication: boolean;
}

/**
 * Bolehkah calon anggota mendaftar lewat situs koperasi?
 *
 * Koperasi yang belum berbadan hukum tidak boleh menerima pendaftaran — ia
 * belum sah menghimpun simpanan, dan simpanan pokok adalah hal pertama yang
 * diminta dari calon anggota.
 */
export function bolehMendaftarPublik(input: PendaftaranPublikInput): Verdict {
  if (input.cooperativeStatus !== 'ACTIVE') {
    return {
      allowed: false,
      code: 'COOPERATIVE_NOT_ACTIVE',
      message: 'Koperasi ini belum menerima pendaftaran anggota baru.',
    };
  }
  if (!input.acceptsOnlineApplication) {
    return {
      allowed: false,
      code: 'ONLINE_APPLICATION_CLOSED',
      message: 'Pendaftaran daring sedang ditutup. Silakan hubungi pengurus.',
    };
  }
  if (input.membershipScope === 'CLOSED') {
    return {
      allowed: false,
      code: 'MEMBERSHIP_CLOSED',
      message: 'Koperasi ini hanya menerima anggota atas undangan pengurus.',
    };
  }
  return { allowed: true };
}
