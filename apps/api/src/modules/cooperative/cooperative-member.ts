/**
 * Aturan keanggotaan koperasi — fungsi murni.
 *
 * Satu aturan menentukan bentuk seluruh berkas ini, dan seluruh modul yang
 * dibangun di atasnya:
 *
 *   **Seseorang menjadi anggota hanya setelah simpanan pokoknya lunas.**
 *
 * Sebelum itu ia calon anggota. Calon anggota tidak boleh meminjam, tidak punya
 * hak suara pada Rapat Anggota, dan tidak memperoleh SHU. Aturan itu bukan
 * kebiasaan administratif melainkan pembeda hukum antara anggota koperasi dan
 * orang yang sekadar berminat — dan ia diperiksa di lima tempat berbeda pada
 * K-2 sampai K-6.
 */

// ------------------------------------------------------------------- Status

export const MEMBER_STATUSES = [
  'PROSPECT',
  'PENDING_VERIFICATION',
  'APPROVED',
  'PENDING_PRINCIPAL_SAVING',
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'RESIGNING',
  'TERMINATED',
] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/**
 * Perpindahan status keanggotaan.
 *
 * `TERMINATED` bersifat akhir. Bekas anggota yang kembali mendaftar memulai
 * dari `PROSPECT` dengan nomor anggota baru — riwayat keanggotaan lamanya tetap
 * utuh, termasuk tunggakan yang belum diselesaikannya.
 */
export const MEMBER_TRANSITIONS: Record<MemberStatus, MemberStatus[]> = {
  PROSPECT: ['PENDING_VERIFICATION', 'TERMINATED'],
  PENDING_VERIFICATION: ['APPROVED', 'PROSPECT', 'TERMINATED'],
  // Disetujui pengurus, tetapi belum membayar simpanan pokok. Inilah keadaan
  // yang paling mudah disalahpahami sebagai "sudah anggota".
  APPROVED: ['PENDING_PRINCIPAL_SAVING', 'TERMINATED'],
  PENDING_PRINCIPAL_SAVING: ['ACTIVE', 'TERMINATED'],
  ACTIVE: ['INACTIVE', 'SUSPENDED', 'RESIGNING', 'TERMINATED'],
  INACTIVE: ['ACTIVE', 'RESIGNING', 'TERMINATED'],
  SUSPENDED: ['ACTIVE', 'TERMINATED'],
  RESIGNING: ['TERMINATED', 'ACTIVE'],
  TERMINATED: [],
};

export interface Verdict {
  allowed: boolean;
  message?: string;
  requiresPermission?: string;
}

const SYARAT: Partial<Record<`${MemberStatus}->${MemberStatus}`, Omit<Verdict, 'allowed'>>> = {
  'PROSPECT->PENDING_VERIFICATION': { requiresPermission: 'COOPERATIVE_PROSPECT.SUBMIT' },
  'PENDING_VERIFICATION->APPROVED': { requiresPermission: 'COOPERATIVE_PROSPECT.APPROVE' },
  'PENDING_VERIFICATION->PROSPECT': { requiresPermission: 'COOPERATIVE_PROSPECT.REJECT' },
  'APPROVED->PENDING_PRINCIPAL_SAVING': { requiresPermission: 'COOPERATIVE_MEMBER.CREATE' },
  // Pengaktifan TIDAK punya hak akses tersendiri dengan sengaja: ia bukan
  // keputusan manusia melainkan akibat dari lunasnya simpanan pokok. Memberinya
  // hak akses akan membuka jalan bagi petugas untuk mengaktifkan anggota yang
  // belum membayar.
  'ACTIVE->SUSPENDED': { requiresPermission: 'COOPERATIVE_MEMBER.SUSPEND' },
  'ACTIVE->RESIGNING': { requiresPermission: 'COOPERATIVE_MEMBER.UPDATE' },
  'RESIGNING->TERMINATED': { requiresPermission: 'COOPERATIVE_MEMBER.APPROVE' },
  'ACTIVE->TERMINATED': { requiresPermission: 'COOPERATIVE_MEMBER.APPROVE' },
};

export function bolehPindahStatus(dari: MemberStatus, ke: MemberStatus): Verdict {
  if (dari === ke) return { allowed: false, message: `Sudah berstatus ${ke}.` };
  if (MEMBER_TRANSITIONS[dari].length === 0) {
    return {
      allowed: false,
      message: `Keanggotaan berstatus ${dari} sudah final. Pendaftaran ulang dimulai sebagai calon anggota baru.`,
    };
  }
  if (!MEMBER_TRANSITIONS[dari].includes(ke)) {
    return { allowed: false, message: `Status ${dari} tidak dapat langsung menjadi ${ke}.` };
  }
  return { allowed: true, ...(SYARAT[`${dari}->${ke}`] ?? {}) };
}

/**
 * Apakah status ini berarti anggota penuh?
 *
 * Dipakai di mana-mana — pinjaman, hak suara, SHU. Satu fungsi supaya
 * jawabannya tidak dapat berbeda antar tempat.
 */
export function anggotaPenuh(status: MemberStatus): boolean {
  return status === 'ACTIVE';
}

/**
 * Apakah status ini masih calon anggota?
 *
 * `APPROVED` dan `PENDING_PRINCIPAL_SAVING` termasuk di sini. Keduanya sudah
 * disetujui pengurus tetapi **belum** membayar simpanan pokok, dan itulah yang
 * menentukan — bukan persetujuannya.
 */
export function masihCalon(status: MemberStatus): boolean {
  return ['PROSPECT', 'PENDING_VERIFICATION', 'APPROVED', 'PENDING_PRINCIPAL_SAVING'].includes(
    status,
  );
}

// -------------------------------------------------------------- Pengaktifan

export interface PengaktifanInput {
  status: MemberStatus;
  principalSavingRequired: number;
  principalSavingPaid: number;
}

/**
 * Bolehkah keanggotaan diaktifkan?
 *
 * Satu-satunya jalan menuju `ACTIVE`. Sengaja tidak menerima "paksa aktif":
 * anggota yang aktif tanpa simpanan pokok akan memperoleh SHU atas modal yang
 * tidak pernah disetorkannya, dengan mengurangi bagian anggota lain.
 */
export function bolehDiaktifkan(input: PengaktifanInput): Verdict {
  if (input.status === 'ACTIVE') {
    return { allowed: false, message: 'Sudah berstatus anggota aktif.' };
  }
  if (input.status !== 'PENDING_PRINCIPAL_SAVING' && input.status !== 'APPROVED') {
    return {
      allowed: false,
      message: `Keanggotaan berstatus ${input.status} belum sampai pada tahap pengaktifan.`,
    };
  }
  if (input.principalSavingPaid < input.principalSavingRequired) {
    const kurang = input.principalSavingRequired - input.principalSavingPaid;
    return {
      allowed: false,
      // Menyebutkan kekurangannya, bukan sekadar menolak — petugas yang tahu
      // angkanya dapat langsung menagihkannya.
      message: `Simpanan pokok belum lunas. Kurang ${kurang} dari ${input.principalSavingRequired}.`,
    };
  }
  return { allowed: true };
}

// ------------------------------------------------------------- Kelayakan

export interface KelayakanInput {
  age: number | null;
  hasIdentityNumber: boolean;
  withinServiceArea: boolean;
  membershipScope: string;
  meetsScopeRequirement: boolean;
  hasActiveMembershipElsewhereInSameCooperative: boolean;
  hasUnsettledPriorMembership: boolean;
}

export interface Kekurangan {
  code: string;
  message: string;
}

/** Usia minimum menurut ketentuan umum perkoperasian Indonesia. */
export const USIA_MINIMUM = 17;

/**
 * Syarat yang belum terpenuhi untuk menjadi calon anggota.
 *
 * Seperti pada K-1, mengembalikan **seluruh** kekurangan sekaligus.
 */
export function periksaKelayakan(input: KelayakanInput): Kekurangan[] {
  const kurang: Kekurangan[] = [];

  if (input.age === null) {
    kurang.push({ code: 'AGE_UNKNOWN', message: 'Tanggal lahir belum diisi.' });
  } else if (input.age < USIA_MINIMUM) {
    kurang.push({
      code: 'AGE_BELOW_MINIMUM',
      message: `Usia minimal ${USIA_MINIMUM} tahun untuk menjadi anggota koperasi.`,
    });
  }

  if (!input.hasIdentityNumber) {
    kurang.push({
      code: 'IDENTITY_MISSING',
      message: 'Nomor identitas belum diisi. Diperlukan untuk verifikasi keanggotaan.',
    });
  }

  if (!input.withinServiceArea) {
    kurang.push({
      code: 'OUTSIDE_SERVICE_AREA',
      message: 'Alamat berada di luar wilayah kerja koperasi.',
    });
  }

  if (input.membershipScope !== 'OPEN' && !input.meetsScopeRequirement) {
    kurang.push({
      code: 'SCOPE_REQUIREMENT_UNMET',
      message: pesanLingkup(input.membershipScope),
    });
  }

  if (input.hasActiveMembershipElsewhereInSameCooperative) {
    kurang.push({
      code: 'ALREADY_MEMBER',
      message: 'Orang ini sudah terdaftar sebagai anggota aktif pada koperasi ini.',
    });
  }

  if (input.hasUnsettledPriorMembership) {
    /*
     * Bekas anggota yang berhenti dengan meninggalkan tunggakan tidak dapat
     * mendaftar ulang begitu saja. Membiarkannya berarti seseorang dapat
     * menghapus tunggakannya dengan keluar lalu masuk kembali.
     */
    kurang.push({
      code: 'PRIOR_MEMBERSHIP_UNSETTLED',
      message:
        'Keanggotaan sebelumnya belum diselesaikan. Lunasi kewajiban yang tersisa sebelum mendaftar kembali.',
    });
  }

  return kurang;
}

function pesanLingkup(scope: string): string {
  const peta: Record<string, string> = {
    CLOSED: 'Koperasi ini tertutup dan hanya menerima anggota atas undangan pengurus.',
    EMPLOYEE: 'Koperasi ini hanya menerima karyawan instansi yang menaunginya.',
    COMMUNITY: 'Koperasi ini hanya menerima warga komunitas yang ditetapkan.',
    FUNCTIONAL: 'Koperasi ini hanya menerima anggota dengan profesi yang ditetapkan.',
  };
  return peta[scope] ?? 'Syarat keanggotaan khusus koperasi ini belum terpenuhi.';
}

export function layakMendaftar(input: KelayakanInput): boolean {
  return periksaKelayakan(input).length === 0;
}

// --------------------------------------------------------------- Kepengurusan

export interface Jabatan {
  positionCode: string;
  memberId: string;
  termStart: string;
  termEnd: string | null;
}

/**
 * Bolehkah jabatan ini diisi pada rentang waktu itu?
 *
 * Satu jabatan hanya boleh dipangku satu orang pada satu waktu. Bukan
 * kerapian: jabatan Ketua menentukan siapa yang sah menandatangani perjanjian
 * pinjaman, dan dua ketua pada satu tanggal berarti dua tanda tangan yang
 * sama-sama tampak sah.
 */
export function bolehMenjabat(
  jabatanAda: Jabatan[],
  baru: Jabatan,
): Verdict {
  const bentrok = jabatanAda.filter(
    (j) =>
      j.positionCode === baru.positionCode &&
      j.memberId !== baru.memberId &&
      tumpangTindih(j, baru),
  );
  if (bentrok.length) {
    return {
      allowed: false,
      message: `Jabatan ${baru.positionCode} masih dipangku orang lain pada rentang tanggal tersebut.`,
    };
  }
  return { allowed: true };
}

export function tumpangTindih(a: Jabatan, b: Jabatan): boolean {
  const akhirA = a.termEnd ?? '9999-12-31';
  const akhirB = b.termEnd ?? '9999-12-31';
  return a.termStart <= akhirB && b.termStart <= akhirA;
}

/**
 * Jabatan yang tidak boleh dirangkap satu orang.
 *
 * Pengawas yang merangkap pengurus mengawasi dirinya sendiri, dan bendahara
 * yang merangkap ketua memegang uang sekaligus memutuskan pengeluarannya.
 */
export const RANGKAP_TERLARANG: Array<[string, string]> = [
  ['CHAIRPERSON', 'SUPERVISOR'],
  ['SECRETARY', 'SUPERVISOR'],
  ['TREASURER', 'SUPERVISOR'],
  ['CHAIRPERSON', 'TREASURER'],
  ['MANAGER', 'SUPERVISOR'],
];

export function bolehMerangkap(jabatanSekarang: string[], jabatanBaru: string): Verdict {
  for (const [a, b] of RANGKAP_TERLARANG) {
    const bentrok =
      (jabatanBaru === a && jabatanSekarang.includes(b)) ||
      (jabatanBaru === b && jabatanSekarang.includes(a));
    if (bentrok) {
      return {
        allowed: false,
        message: `Jabatan ${a} dan ${b} tidak boleh dirangkap satu orang.`,
      };
    }
  }
  return { allowed: true };
}

// ------------------------------------------------------------- Nomor anggota

/**
 * Menyusun nomor anggota.
 *
 * Berpola `<kode koperasi>-<tahun>-<urut>`. Terbaca dan memuat tahun masuk,
 * yang berguna saat menghitung masa keanggotaan untuk SHU. Keunikannya dijamin
 * indeks unik pada basis data — fungsi ini hanya menyusun bentuknya.
 */
export function susunNomorAnggota(kodeKoperasi: string, tahun: number, urut: number): string {
  const kode = kodeKoperasi.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'KOP';
  return `${kode}-${tahun}-${String(urut).padStart(5, '0')}`;
}

// --------------------------------------------------------------- Penyelesaian

export interface PenyelesaianInput {
  principalSaving: number;
  mandatorySaving: number;
  voluntarySaving: number;
  outstandingLoan: number;
  unpaidPenalty: number;
  pendingShu: number;
}

export interface HasilPenyelesaian {
  totalReceivable: number;
  totalPayable: number;
  netToMember: number;
  memberOwes: boolean;
}

/**
 * Perhitungan penyelesaian saat anggota berhenti.
 *
 * Simpanan pokok dan wajib dikembalikan — keduanya modal anggota, bukan milik
 * koperasi. Sisa pinjaman dan denda dipotongkan lebih dahulu; anggota tidak
 * dapat menarik modalnya sambil meninggalkan utangnya.
 *
 * Bila kewajibannya melebihi simpanannya, hasilnya negatif dan `memberOwes`
 * bernilai benar — keanggotaannya tidak dapat ditutup sebelum sisanya dilunasi.
 */
export function hitungPenyelesaian(input: PenyelesaianInput): HasilPenyelesaian {
  const totalReceivable =
    input.principalSaving + input.mandatorySaving + input.voluntarySaving + input.pendingShu;
  const totalPayable = input.outstandingLoan + input.unpaidPenalty;
  const netToMember = totalReceivable - totalPayable;
  return {
    totalReceivable,
    totalPayable,
    netToMember,
    memberOwes: netToMember < 0,
  };
}

/** Bolehkah keanggotaan ditutup? */
export function bolehDitutup(hasil: HasilPenyelesaian): Verdict {
  if (hasil.memberOwes) {
    return {
      allowed: false,
      message: `Kewajiban anggota melebihi simpanannya sebesar ${Math.abs(hasil.netToMember)}. Keanggotaan tidak dapat ditutup sebelum sisanya dilunasi.`,
    };
  }
  return { allowed: true };
}
