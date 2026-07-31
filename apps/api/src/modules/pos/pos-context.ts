/**
 * Konteks transaksi kasir — aturan murni, tanpa basis data.
 *
 * Dipisahkan dari layanan supaya dapat diuji sebagai fungsi: masuk keadaan,
 * keluar keputusan beserta alasannya. Aturan yang menentukan siapa boleh
 * berjualan di mana adalah aturan yang paling sering ditanyakan ulang saat
 * terjadi sesuatu, dan jawaban "coba lihat kodenya" tidak cukup baik untuk itu.
 */

/** Status operasional register, berbeda dari status siklus hidup masternya. */
export type RegisterStatus =
  | 'INACTIVE'
  | 'READY'
  | 'OPEN'
  | 'SUSPENDED'
  | 'MAINTENANCE'
  | 'CLOSED';

export const REGISTER_STATUSES: RegisterStatus[] = [
  'INACTIVE',
  'READY',
  'OPEN',
  'SUSPENDED',
  'MAINTENANCE',
  'CLOSED',
];

export interface RegisterInfo {
  terminalId: string;
  outletId: string;
  outletActive: boolean;
  terminalActive: boolean;
  registerStatus: RegisterStatus;
  /** Kode dan nama ditampilkan pada pemilih register di layar kasir. */
  code: string;
  name: string;
}

export interface AssignmentInfo {
  terminalId: string;
  userSubjectId: string;
  isActive: boolean;
  validFrom: string;
  validUntil?: string | null;
  /** Register utama kasir ini; dipakai memilih bawaan pada layar. */
  isPrimary: boolean;
}

export interface OpenShiftInfo {
  shiftId: string;
  terminalId: string;
  cashierId: string;
  /**
   * Keterangan yang ditampilkan batang konteks kasir. Tanpa ketiganya layar
   * berbunyi "Shift undefined · kas awal -", dan kasir yang membacanya tidak
   * dapat tahu apakah shiftnya benar-benar terbuka.
   */
  shiftNumber?: string;
  openedAt?: string;
  openingCash?: string;
  businessDate?: string;
}

/** Alasan penolakan. Kode dipakai antarmuka; pesannya dibaca kasir. */
export type DenialCode =
  | 'OUTLET_INACTIVE'
  | 'REGISTER_INACTIVE'
  | 'REGISTER_NOT_OPERABLE'
  | 'NOT_ASSIGNED'
  | 'ASSIGNMENT_EXPIRED'
  | 'SHIFT_HELD_BY_OTHER'
  | 'NO_OPEN_SHIFT'
  | 'SHIFT_ALREADY_OPEN';

export interface Verdict {
  allowed: boolean;
  code?: DenialCode;
  message?: string;
}

const IZINKAN: Verdict = { allowed: true };

function tolak(code: DenialCode, message: string): Verdict {
  return { allowed: false, code, message };
}

/**
 * Apakah penugasan berlaku pada tanggal tertentu.
 *
 * Tanggal dibandingkan sebagai teks `YYYY-MM-DD`, bukan sebagai `Date`.
 * Perbandingan `Date` di sini akan menyeret zona waktu peladen ke dalam
 * keputusan yang seharusnya memakai tanggal usaha outlet.
 */
export function assignmentBerlaku(a: AssignmentInfo, tanggalUsaha: string): boolean {
  if (!a.isActive) return false;
  if (a.validFrom > tanggalUsaha) return false;
  if (a.validUntil && a.validUntil < tanggalUsaha) return false;
  return true;
}

/**
 * Register mana yang boleh dipakai pengguna ini pada tanggal usaha tertentu.
 *
 * Hasilnya adalah irisan: register yang hidup DAN outletnya hidup DAN ditugaskan
 * kepada pengguna itu. Ketiganya harus benar; tidak ada yang boleh menggantikan
 * yang lain.
 */
export function registerYangBoleh(
  registers: RegisterInfo[],
  assignments: AssignmentInfo[],
  userSubjectId: string,
  tanggalUsaha: string,
): RegisterInfo[] {
  const ditugaskan = new Set(
    assignments
      .filter((a) => a.userSubjectId === userSubjectId && assignmentBerlaku(a, tanggalUsaha))
      .map((a) => a.terminalId),
  );
  return registers.filter(
    (r) =>
      r.outletActive &&
      r.terminalActive &&
      r.registerStatus !== 'INACTIVE' &&
      r.registerStatus !== 'MAINTENANCE' &&
      ditugaskan.has(r.terminalId),
  );
}

/**
 * Bolehkah pengguna ini membuka shift pada register ini?
 *
 * Urutan pemeriksaannya disengaja: yang paling umum dan paling mudah dipahami
 * kasir disebut lebih dahulu. Kasir yang registernya sedang diperbaiki perlu
 * mendengar "register sedang dalam perawatan", bukan "Anda tidak ditugaskan".
 */
export function bolehBukaShift(input: {
  register?: RegisterInfo;
  assignments: AssignmentInfo[];
  userSubjectId: string;
  tanggalUsaha: string;
  shiftTerbuka?: OpenShiftInfo | null;
}): Verdict {
  const { register, assignments, userSubjectId, tanggalUsaha, shiftTerbuka } = input;

  if (!register) return tolak('REGISTER_INACTIVE', 'Register tidak ditemukan.');
  if (!register.outletActive) {
    return tolak('OUTLET_INACTIVE', 'Outlet ini sedang tidak aktif.');
  }
  if (!register.terminalActive || register.registerStatus === 'INACTIVE') {
    return tolak('REGISTER_INACTIVE', 'Register ini sedang tidak aktif.');
  }
  if (register.registerStatus === 'MAINTENANCE') {
    return tolak('REGISTER_NOT_OPERABLE', 'Register sedang dalam perawatan.');
  }
  if (register.registerStatus === 'SUSPENDED') {
    return tolak('REGISTER_NOT_OPERABLE', 'Register sedang ditangguhkan. Hubungi supervisor.');
  }

  const punya = assignments.some(
    (a) =>
      a.terminalId === register.terminalId &&
      a.userSubjectId === userSubjectId &&
      a.isActive,
  );
  if (!punya) {
    return tolak('NOT_ASSIGNED', 'Anda tidak ditugaskan pada register ini.');
  }

  const berlaku = assignments.some(
    (a) =>
      a.terminalId === register.terminalId &&
      a.userSubjectId === userSubjectId &&
      assignmentBerlaku(a, tanggalUsaha),
  );
  if (!berlaku) {
    return tolak('ASSIGNMENT_EXPIRED', 'Penugasan Anda pada register ini sudah tidak berlaku.');
  }

  if (shiftTerbuka) {
    if (shiftTerbuka.cashierId === userSubjectId) {
      return tolak(
        'SHIFT_ALREADY_OPEN',
        'Anda masih memiliki shift yang terbuka pada register ini. Lanjutkan shift tersebut.',
      );
    }
    return tolak(
      'SHIFT_HELD_BY_OTHER',
      'Register ini sedang dipakai kasir lain. Shift sebelumnya harus ditutup terlebih dahulu.',
    );
  }

  return IZINKAN;
}

/**
 * Bolehkah bertransaksi sekarang?
 *
 * Perintah prioritas menyebutnya sebagai larangan: "Jangan bertransaksi tanpa
 * tenant/outlet/register/shift context." Dinyatakan sebagai fungsi supaya
 * larangan itu punya satu tempat, bukan tersebar sebagai pemeriksaan `if` di
 * setiap endpoint.
 */
export function bolehBertransaksi(input: {
  register?: RegisterInfo;
  shiftTerbuka?: OpenShiftInfo | null;
  userSubjectId: string;
}): Verdict {
  const { register, shiftTerbuka, userSubjectId } = input;

  if (!register) return tolak('REGISTER_INACTIVE', 'Register tidak ditemukan.');
  if (!register.outletActive) return tolak('OUTLET_INACTIVE', 'Outlet ini sedang tidak aktif.');
  if (!register.terminalActive || register.registerStatus === 'INACTIVE') {
    return tolak('REGISTER_INACTIVE', 'Register ini sedang tidak aktif.');
  }
  if (!shiftTerbuka) {
    return tolak('NO_OPEN_SHIFT', 'Belum ada shift yang terbuka. Buka shift terlebih dahulu.');
  }
  if (shiftTerbuka.terminalId !== register.terminalId) {
    return tolak('SHIFT_HELD_BY_OTHER', 'Shift Anda terbuka pada register lain.');
  }
  if (shiftTerbuka.cashierId !== userSubjectId) {
    return tolak('SHIFT_HELD_BY_OTHER', 'Shift pada register ini milik kasir lain.');
  }

  return IZINKAN;
}

/**
 * Tanggal usaha dari sebuah saat, menurut zona waktu outlet.
 *
 * Penjualan pukul 01.00 pada gerai yang buka sampai dini hari tetap masuk
 * tanggal usaha hari sebelumnya bila outlet menyatakan demikian lewat
 * `cutoverHour`. Tanpa ini, laporan harian akan memotong penjualan di tengah
 * malam pada gerai yang justru paling ramai pada jam itu.
 */
export function tanggalUsaha(saat: Date, timezone: string, cutoverHour = 0): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const bagian = Object.fromEntries(fmt.formatToParts(saat).map((p) => [p.type, p.value]));
  const jam = Number(bagian.hour);
  const tanggal = `${bagian.year}-${bagian.month}-${bagian.day}`;
  if (cutoverHour <= 0 || jam >= cutoverHour) return tanggal;

  const mundur = new Date(`${tanggal}T12:00:00Z`);
  mundur.setUTCDate(mundur.getUTCDate() - 1);
  return mundur.toISOString().slice(0, 10);
}
