/**
 * Aturan rapat anggota — fungsi murni.
 *
 * Satu prinsip menentukan seluruh berkas ini, dan ia adalah pembeda koperasi
 * dari perseroan:
 *
 *   **Satu anggota satu suara, berapa pun besar simpanannya.**
 *
 * Menuliskannya sebagai invarian yang diuji, bukan sekadar sebagai kebiasaan,
 * mencegah seseorang kelak menambahkan pembobotan suara berdasarkan modal —
 * perubahan yang tampak masuk akal bagi orang yang terbiasa dengan perseroan,
 * dan yang menghapus sifat koperasi dari sistemnya.
 */

// ----------------------------------------------------------------- Jenis rapat

export const MEETING_TYPES = ['RAT', 'RALB', 'RAT_TUTUP_BUKU'] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const MEETING_STATUSES = [
  'PLANNED',
  'INVITED',
  'OPEN',
  'QUORUM_REACHED',
  'ADJOURNED',
  'CLOSED',
  'CANCELLED',
] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_TRANSITIONS: Record<MeetingStatus, MeetingStatus[]> = {
  PLANNED: ['INVITED', 'CANCELLED'],
  INVITED: ['OPEN', 'CANCELLED'],
  OPEN: ['QUORUM_REACHED', 'ADJOURNED', 'CLOSED'],
  // Kuorum tercapai; rapat dapat mengambil keputusan.
  QUORUM_REACHED: ['CLOSED'],
  // Ditunda karena kuorum tidak tercapai. Rapat kedua dapat dibuka kemudian
  // dengan syarat kuorum yang lebih ringan, sesuai AD/ART kebanyakan koperasi.
  ADJOURNED: ['OPEN', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
};

export interface Verdict {
  allowed: boolean;
  message?: string;
}

export function bolehPindahStatusRapat(dari: MeetingStatus, ke: MeetingStatus): Verdict {
  if (dari === ke) return { allowed: false, message: `Rapat sudah berstatus ${ke}.` };
  if (MEETING_TRANSITIONS[dari].length === 0) {
    return { allowed: false, message: `Rapat berstatus ${dari} sudah final.` };
  }
  if (!MEETING_TRANSITIONS[dari].includes(ke)) {
    return { allowed: false, message: `Rapat berstatus ${dari} tidak dapat langsung menjadi ${ke}.` };
  }
  return { allowed: true };
}

// -------------------------------------------------------------------- Kehadiran

export const ATTENDANCE_MODES = ['IN_PERSON', 'ONLINE', 'PROXY'] as const;
export type AttendanceMode = (typeof ATTENDANCE_MODES)[number];

export interface Kehadiran {
  memberId: string;
  mode: AttendanceMode;
  /** Diisi bila `mode` adalah PROXY: siapa yang mewakili. */
  proxyHolderMemberId?: string | null;
  hasVotingRight: boolean;
}

export interface BatasKuasa {
  /** Berapa anggota yang boleh diwakili satu orang. Nol berarti kuasa dilarang. */
  maxProxyPerHolder: number;
  /** Apakah kehadiran lewat kuasa ikut dihitung untuk kuorum. */
  proxyCountsForQuorum: boolean;
}

export interface HasilKuasa {
  valid: Kehadiran[];
  rejected: Array<{ memberId: string; reason: string }>;
}

/**
 * Menyaring kehadiran berkuasa menurut batasnya.
 *
 * Batas jumlah kuasa bukan formalitas: tanpa batas, seseorang dapat
 * mengumpulkan kuasa dari puluhan anggota dan memutuskan sendiri hal yang
 * seharusnya diputuskan bersama. Itulah cara tercepat mengubah rapat anggota
 * menjadi rapat satu orang.
 */
export function saringKuasa(hadir: Kehadiran[], batas: BatasKuasa): HasilKuasa {
  const valid: Kehadiran[] = [];
  const rejected: Array<{ memberId: string; reason: string }> = [];
  const jumlahPerPemegang = new Map<string, number>();

  // Yang hadir sendiri diproses lebih dahulu supaya kuasa tidak menyingkirkan
  // kehadiran langsung ketika keduanya tercatat atas orang yang sama.
  const langsung = hadir.filter((h) => h.mode !== 'PROXY');
  const kuasa = hadir.filter((h) => h.mode === 'PROXY');
  const sudahHadir = new Set(langsung.map((h) => h.memberId));

  valid.push(...langsung);

  for (const k of kuasa) {
    if (batas.maxProxyPerHolder <= 0) {
      rejected.push({ memberId: k.memberId, reason: 'PROXY_NOT_ALLOWED' });
      continue;
    }
    if (!k.proxyHolderMemberId) {
      rejected.push({ memberId: k.memberId, reason: 'PROXY_HOLDER_MISSING' });
      continue;
    }
    if (k.proxyHolderMemberId === k.memberId) {
      rejected.push({ memberId: k.memberId, reason: 'PROXY_SELF' });
      continue;
    }
    if (sudahHadir.has(k.memberId)) {
      // Sudah hadir sendiri; kuasanya tidak diperlukan dan tidak dihitung dua kali.
      rejected.push({ memberId: k.memberId, reason: 'ALREADY_PRESENT' });
      continue;
    }
    const n = jumlahPerPemegang.get(k.proxyHolderMemberId) ?? 0;
    if (n >= batas.maxProxyPerHolder) {
      rejected.push({ memberId: k.memberId, reason: 'PROXY_LIMIT_EXCEEDED' });
      continue;
    }
    jumlahPerPemegang.set(k.proxyHolderMemberId, n + 1);
    sudahHadir.add(k.memberId);
    valid.push(k);
  }

  return { valid, rejected };
}

// ---------------------------------------------------------------------- Kuorum

export interface KuorumInput {
  totalActiveMembers: number;
  attendance: Kehadiran[];
  batasKuasa: BatasKuasa;
  /** Bagian minimum kehadiran, mis. 0.5 untuk separuh. */
  requiredRatio: number;
  /** Benar bila ini rapat kedua setelah rapat pertama ditunda. */
  isSecondCall?: boolean;
  /** Bagian minimum untuk rapat kedua, biasanya lebih ringan. */
  secondCallRatio?: number;
}

export interface HasilKuorum {
  reached: boolean;
  totalActiveMembers: number;
  presentCount: number;
  inPersonCount: number;
  onlineCount: number;
  proxyCount: number;
  countedForQuorum: number;
  requiredCount: number;
  ratio: number;
}

/**
 * Menghitung kuorum dari kehadiran yang **tercatat**.
 *
 * Bukan dari perkiraan, bukan dari daftar undangan. Keputusan rapat anggota
 * menentukan pembagian SHU dan perubahan AD/ART; kuorumnya harus dapat
 * dibuktikan dari daftar hadir, bukan dinyatakan begitu saja oleh pimpinan
 * rapat.
 */
export function hitungKuorum(input: KuorumInput): HasilKuorum {
  const { valid } = saringKuasa(input.attendance, input.batasKuasa);
  const bersuara = valid.filter((h) => h.hasVotingRight);

  const inPersonCount = bersuara.filter((h) => h.mode === 'IN_PERSON').length;
  const onlineCount = bersuara.filter((h) => h.mode === 'ONLINE').length;
  const proxyCount = bersuara.filter((h) => h.mode === 'PROXY').length;

  const countedForQuorum =
    inPersonCount + onlineCount + (input.batasKuasa.proxyCountsForQuorum ? proxyCount : 0);

  const ratio =
    input.isSecondCall && input.secondCallRatio !== undefined
      ? input.secondCallRatio
      : input.requiredRatio;

  const requiredCount = Math.ceil(input.totalActiveMembers * ratio);

  return {
    reached: input.totalActiveMembers > 0 && countedForQuorum >= requiredCount,
    totalActiveMembers: input.totalActiveMembers,
    presentCount: bersuara.length,
    inPersonCount,
    onlineCount,
    proxyCount,
    countedForQuorum,
    requiredCount,
    ratio: input.totalActiveMembers > 0 ? countedForQuorum / input.totalActiveMembers : 0,
  };
}

// -------------------------------------------------------------------- Voting

export const VOTE_CHOICES = ['YES', 'NO', 'ABSTAIN'] as const;
export type VoteChoice = (typeof VOTE_CHOICES)[number];

export const DECISION_RULES = ['SIMPLE_MAJORITY', 'TWO_THIRDS', 'THREE_QUARTERS', 'UNANIMOUS'] as const;
export type DecisionRule = (typeof DECISION_RULES)[number];

/**
 * Ambang tiap aturan keputusan.
 *
 * Perubahan AD/ART dan pembubaran koperasi lazimnya menuntut dua per tiga atau
 * lebih. Ditulis sebagai data supaya AD/ART koperasi yang menetapkan angka
 * berbeda dapat dipenuhi tanpa mengubah kode.
 */
export const AMBANG: Record<DecisionRule, number> = {
  SIMPLE_MAJORITY: 0.5,
  TWO_THIRDS: 2 / 3,
  THREE_QUARTERS: 0.75,
  UNANIMOUS: 1,
};

export interface Suara {
  memberId: string;
  choice: VoteChoice;
}

export interface HasilVoting {
  yes: number;
  no: number;
  abstain: number;
  /** Suara sah yang dihitung: setuju + tidak setuju. Abstain tidak dihitung. */
  validVotes: number;
  totalCast: number;
  threshold: number;
  requiredYes: number;
  passed: boolean;
}

/**
 * Menghitung hasil pemungutan suara.
 *
 * **Abstain tidak dihitung sebagai penolak.** Anggota yang abstain menyatakan
 * dirinya tidak mengambil sikap; memperlakukannya sebagai penolak berarti
 * memberinya sikap yang tidak dinyatakannya. Ia tetap dihitung untuk kuorum —
 * kehadirannya nyata — tetapi tidak untuk ambang keputusan.
 *
 * Pengecualian: pada keputusan `UNANIMOUS`, abstain **menggagalkan** kebulatan,
 * sebab bulat berarti seluruh yang hadir menyetujui.
 */
export function hitungVoting(suara: Suara[], rule: DecisionRule): HasilVoting {
  const yes = suara.filter((s) => s.choice === 'YES').length;
  const no = suara.filter((s) => s.choice === 'NO').length;
  const abstain = suara.filter((s) => s.choice === 'ABSTAIN').length;
  const validVotes = yes + no;
  const threshold = AMBANG[rule];

  if (rule === 'UNANIMOUS') {
    return {
      yes, no, abstain,
      validVotes,
      totalCast: suara.length,
      threshold,
      requiredYes: suara.length,
      passed: suara.length > 0 && yes === suara.length,
    };
  }

  // Mayoritas sederhana berarti LEBIH dari separuh, bukan tepat separuh.
  const requiredYes =
    rule === 'SIMPLE_MAJORITY'
      ? Math.floor(validVotes / 2) + 1
      : Math.ceil(validVotes * threshold);

  return {
    yes, no, abstain,
    validVotes,
    totalCast: suara.length,
    threshold,
    requiredYes,
    passed: validVotes > 0 && yes >= requiredYes,
  };
}

/**
 * Bolehkah anggota ini memberikan suara?
 *
 * Empat syarat, dan yang pertama adalah aturan yang sama dengan K-2 sampai K-4:
 * hanya anggota penuh yang punya hak suara. Calon anggota hadir sebagai
 * peninjau, bukan sebagai pemilih.
 */
export function bolehMemilih(input: {
  memberStatus: string;
  categoryHasVotingRight: boolean;
  isPresent: boolean;
  hasVoted: boolean;
}): Verdict {
  if (input.memberStatus !== 'ACTIVE') {
    return {
      allowed: false,
      message:
        input.memberStatus === 'PENDING_PRINCIPAL_SAVING' || input.memberStatus === 'APPROVED'
          ? 'Calon anggota hadir sebagai peninjau dan belum memiliki hak suara.'
          : `Keanggotaan berstatus ${input.memberStatus} tidak memiliki hak suara.`,
    };
  }
  if (!input.categoryHasVotingRight) {
    return {
      allowed: false,
      message: 'Kategori keanggotaan ini tidak memiliki hak suara menurut AD/ART.',
    };
  }
  if (!input.isPresent) {
    return {
      allowed: false,
      message: 'Hanya yang tercatat hadir — langsung, daring, atau berkuasa — yang dapat memilih.',
    };
  }
  if (input.hasVoted) {
    return { allowed: false, message: 'Anda sudah memberikan suara pada mata acara ini.' };
  }
  return { allowed: true };
}

// -------------------------------------------------------------------- Keputusan

export const DECISION_VALIDITIES = ['VALID', 'INVALID_NO_QUORUM', 'INVALID_INSUFFICIENT_VOTE'] as const;
export type DecisionValidity = (typeof DECISION_VALIDITIES)[number];

export interface KeabsahanInput {
  quorumReached: boolean;
  voteResult: HasilVoting;
}

/**
 * Keabsahan sebuah keputusan.
 *
 * Keputusan yang diambil tanpa kuorum **ditandai tidak sah**, bukan ditolak
 * diam-diam. Alasannya penting: keputusan itu terjadi, tercatat pada notulen,
 * dan mungkin sudah dilaksanakan. Menghilangkannya dari catatan akan membuat
 * pelaksanaannya tidak dapat dijelaskan kemudian; menandainya tidak sah
 * membuatnya terlihat dan dapat diperbaiki lewat rapat berikutnya.
 */
export function keabsahanKeputusan(input: KeabsahanInput): {
  validity: DecisionValidity;
  message: string;
} {
  if (!input.quorumReached) {
    return {
      validity: 'INVALID_NO_QUORUM',
      message:
        'Keputusan diambil tanpa kuorum dan tidak sah. Agendakan ulang pada rapat berikutnya untuk mengesahkannya.',
    };
  }
  if (!input.voteResult.passed) {
    return {
      validity: 'INVALID_INSUFFICIENT_VOTE',
      message: `Suara setuju ${input.voteResult.yes} belum mencapai ambang ${input.voteResult.requiredYes} dari ${input.voteResult.validVotes} suara sah.`,
    };
  }
  return { validity: 'VALID', message: 'Keputusan sah.' };
}

/**
 * Aturan keputusan yang dituntut tiap jenis mata acara.
 *
 * Perubahan AD/ART dan pembubaran menuntut ambang lebih tinggi karena keduanya
 * mengubah dasar keberadaan koperasi itu sendiri.
 */
export const ATURAN_PER_AGENDA: Record<string, DecisionRule> = {
  ANNUAL_REPORT: 'SIMPLE_MAJORITY',
  FINANCIAL_REPORT: 'SIMPLE_MAJORITY',
  SHU_DISTRIBUTION: 'SIMPLE_MAJORITY',
  BUDGET_PLAN: 'SIMPLE_MAJORITY',
  BOARD_ELECTION: 'SIMPLE_MAJORITY',
  BOARD_DISMISSAL: 'TWO_THIRDS',
  BYLAW_AMENDMENT: 'TWO_THIRDS',
  MERGER: 'THREE_QUARTERS',
  DISSOLUTION: 'THREE_QUARTERS',
  OTHER: 'SIMPLE_MAJORITY',
};

export function aturanUntukAgenda(agendaType: string): DecisionRule {
  return ATURAN_PER_AGENDA[agendaType] ?? 'SIMPLE_MAJORITY';
}
