/**
 * Aturan profil, legalitas, dan kebijakan koperasi — fungsi murni.
 *
 * Dipisahkan dari basis data supaya dapat diuji tanpa menyiapkan skema sama
 * sekali. Pola yang sama dipakai sesi Core pada `pos-sale-state.ts`, dan
 * terbukti: aturan yang dapat diuji murah akan benar-benar diuji.
 */

// --------------------------------------------------------------- Jenis dan status

export const COOPERATIVE_LEVELS = ['PRIMARY', 'SECONDARY', 'TERTIARY'] as const;
export type CooperativeLevel = (typeof COOPERATIVE_LEVELS)[number];

export const COOPERATIVE_STATUSES = [
  'DRAFT',
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'DISSOLVED',
] as const;
export type CooperativeStatus = (typeof COOPERATIVE_STATUSES)[number];

export const MEMBERSHIP_SCOPES = [
  'OPEN',
  'CLOSED',
  'EMPLOYEE',
  'COMMUNITY',
  'FUNCTIONAL',
] as const;
export type MembershipScope = (typeof MEMBERSHIP_SCOPES)[number];

/**
 * Perpindahan status koperasi.
 *
 * `DISSOLVED` bersifat akhir. Koperasi yang sudah dibubarkan tidak dapat
 * "dihidupkan kembali" — pembubaran adalah keputusan RAT yang dicatat pada
 * lembaga pengawas, dan menghidupkannya kembali berarti mendirikan koperasi
 * baru dengan badan hukum baru.
 */
export const COOPERATIVE_TRANSITIONS: Record<CooperativeStatus, CooperativeStatus[]> = {
  DRAFT: ['PENDING_VERIFICATION', 'DISSOLVED'],
  PENDING_VERIFICATION: ['ACTIVE', 'DRAFT', 'DISSOLVED'],
  ACTIVE: ['SUSPENDED', 'DISSOLVED'],
  SUSPENDED: ['ACTIVE', 'DISSOLVED'],
  DISSOLVED: [],
};

export interface Verdict {
  allowed: boolean;
  message?: string;
}

export function bolehPindahStatus(
  dari: CooperativeStatus,
  ke: CooperativeStatus,
): Verdict {
  if (dari === ke) return { allowed: false, message: `Koperasi sudah berstatus ${ke}.` };
  if (COOPERATIVE_TRANSITIONS[dari].length === 0) {
    return {
      allowed: false,
      message: `Koperasi berstatus ${dari} sudah final dan tidak dapat diubah lagi.`,
    };
  }
  if (!COOPERATIVE_TRANSITIONS[dari].includes(ke)) {
    return {
      allowed: false,
      message: `Koperasi berstatus ${dari} tidak dapat langsung menjadi ${ke}.`,
    };
  }
  return { allowed: true };
}

// ------------------------------------------------------------------ Go-live

export interface KesiapanInput {
  legalEntityNumber: string | null;
  legalEntityDate: string | null;
  cooperativeTypeId: string | null;
  hasPrimaryAddress: boolean;
  hasServiceArea: boolean;
  activePolicyCodes: string[];
  documentTypes: string[];
}

export interface Kekurangan {
  code: string;
  message: string;
}

/**
 * Kebijakan yang harus aktif sebelum koperasi boleh melayani anggota.
 *
 * Bukan daftar kelengkapan administratif. Tanpa AD/ART, syarat menjadi anggota
 * tidak dapat dibuktikan; tanpa aturan keanggotaan, besaran simpanan pokok
 * tidak ditetapkan siapa pun; tanpa kebijakan akuntansi, jurnal simpanan masuk
 * ke akun yang ditebak.
 */
export const KEBIJAKAN_WAJIB = ['BYLAW', 'MEMBERSHIP_RULE', 'ACCOUNTING_POLICY'] as const;

/** Dokumen yang harus ada sebelum koperasi dinyatakan sah beroperasi. */
export const DOKUMEN_WAJIB = ['ESTABLISHMENT_DEED', 'LEGAL_ENTITY_DECISION'] as const;

/**
 * Apa saja yang masih kurang sebelum koperasi dapat go-live.
 *
 * Mengembalikan **daftar** kekurangan, bukan kekurangan pertama. Pemilik
 * koperasi yang diberi tahu satu kekurangan lalu satu lagi setelah
 * memperbaikinya akan melalui lima putaran untuk hal yang dapat disebutkan
 * sekaligus.
 */
export function periksaKesiapan(input: KesiapanInput): Kekurangan[] {
  const kurang: Kekurangan[] = [];

  if (!input.cooperativeTypeId) {
    kurang.push({
      code: 'TYPE_MISSING',
      message: 'Jenis koperasi belum dipilih. Jenis menentukan produk simpanan dan pinjaman yang boleh dijalankan.',
    });
  }
  if (!input.legalEntityNumber) {
    kurang.push({
      code: 'LEGAL_NUMBER_MISSING',
      message: 'Nomor badan hukum belum diisi. Koperasi tanpa badan hukum tidak boleh menghimpun simpanan anggota.',
    });
  }
  if (!input.legalEntityDate) {
    kurang.push({
      code: 'LEGAL_DATE_MISSING',
      message: 'Tanggal pengesahan badan hukum belum diisi.',
    });
  }
  if (!input.hasPrimaryAddress) {
    kurang.push({
      code: 'ADDRESS_MISSING',
      message: 'Alamat kantor pusat belum diisi. Alamat ini muncul pada perjanjian dan kartu anggota.',
    });
  }
  if (!input.hasServiceArea) {
    kurang.push({
      code: 'SERVICE_AREA_MISSING',
      message: 'Wilayah kerja belum ditetapkan. Tanpa wilayah kerja, syarat keanggotaan tidak dapat diperiksa sistem.',
    });
  }

  for (const kode of DOKUMEN_WAJIB) {
    if (!input.documentTypes.includes(kode)) {
      kurang.push({
        code: `DOCUMENT_${kode}`,
        message: `Dokumen ${namaDokumen(kode)} belum diunggah.`,
      });
    }
  }
  for (const kode of KEBIJAKAN_WAJIB) {
    if (!input.activePolicyCodes.includes(kode)) {
      kurang.push({
        code: `POLICY_${kode}`,
        message: `${namaKebijakan(kode)} belum ditetapkan dan disetujui.`,
      });
    }
  }

  return kurang;
}

export function siapGoLive(input: KesiapanInput): boolean {
  return periksaKesiapan(input).length === 0;
}

function namaDokumen(kode: string): string {
  const peta: Record<string, string> = {
    ESTABLISHMENT_DEED: 'Akta Pendirian',
    AMENDMENT_DEED: 'Akta Perubahan',
    LEGAL_ENTITY_DECISION: 'SK Pengesahan Badan Hukum',
    TAX_IDENTITY: 'NPWP',
    BUSINESS_LICENSE: 'Izin Usaha',
    DOMICILE_LETTER: 'Surat Keterangan Domisili',
    SHARIA_CERTIFICATE: 'Sertifikat Kesesuaian Syariah',
  };
  return peta[kode] ?? kode;
}

function namaKebijakan(kode: string): string {
  const peta: Record<string, string> = {
    BYLAW: 'AD/ART',
    MEMBERSHIP_RULE: 'Aturan keanggotaan',
    ACCOUNTING_POLICY: 'Kebijakan akuntansi',
    SHARIA_POLICY: 'Kebijakan syariah',
    SHU_POLICY: 'Kebijakan SHU',
    SAVING_POLICY: 'Kebijakan simpanan',
    LOAN_POLICY: 'Kebijakan pinjaman',
  };
  return peta[kode] ?? kode;
}

// ------------------------------------------------------------------- Slug

/**
 * Menyusun slug dari nama koperasi.
 *
 * Slug menjadi alamat `<slug>.ekoperasi.id`, jadi ia harus sah sebagai label
 * DNS: huruf kecil, angka, dan tanda hubung; tidak diawali maupun diakhiri
 * tanda hubung; paling panjang 63 aksara.
 */
export function susunSlug(nama: string): string {
  return nama
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
}

/**
 * Slug yang tidak boleh dipakai koperasi.
 *
 * Sebagian karena sudah dipakai platform, sebagian karena akan menyesatkan —
 * koperasi bernama slug "admin" akan tampak seperti halaman pengelola.
 */
export const SLUG_TERLARANG = [
  'www', 'api', 'admin', 'app', 'portal', 'login', 'daftar', 'register',
  'mail', 'ftp', 'ns1', 'ns2', 'cdn', 'static', 'assets', 'status',
  'help', 'bantuan', 'support', 'dukungan', 'blog', 'docs', 'dokumentasi',
  'ekoperasi', 'koperasi', 'test', 'staging', 'dev', 'demo',
];

export function slugSah(slug: string): Verdict {
  if (!slug) return { allowed: false, message: 'Slug tidak boleh kosong.' };
  if (slug.length < 3) {
    return { allowed: false, message: 'Slug minimal tiga aksara.' };
  }
  if (slug.length > 63) {
    return { allowed: false, message: 'Slug paling panjang 63 aksara.' };
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return {
      allowed: false,
      message: 'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung, serta tidak diawali maupun diakhiri tanda hubung.',
    };
  }
  if (SLUG_TERLARANG.includes(slug)) {
    return { allowed: false, message: `Slug "${slug}" dipakai platform dan tidak dapat dipilih.` };
  }
  return { allowed: true };
}

// -------------------------------------------------------------- Masa berlaku

export interface BerlakuInput {
  effectiveFrom: string;
  effectiveUntil?: string | null;
}

/** Apakah sesuatu berlaku pada tanggal tertentu. */
export function berlakuPada(item: BerlakuInput, tanggal: string): boolean {
  if (tanggal < item.effectiveFrom) return false;
  if (item.effectiveUntil && tanggal > item.effectiveUntil) return false;
  return true;
}

/**
 * Memilih satu yang berlaku dari beberapa versi.
 *
 * Bila dua versi sama-sama berlaku pada tanggal itu — keadaan yang seharusnya
 * dicegah indeks unik, tetapi dapat terjadi pada data lama — yang dipilih
 * adalah yang mulai berlakunya paling akhir. Memilih diam-diam lebih baik
 * daripada melempar galat pada jalur baca, tetapi keadaannya tetap patut
 * dilaporkan pemanggil.
 */
export function versiBerlaku<T extends BerlakuInput>(
  versi: T[],
  tanggal: string,
): { terpilih: T | null; ganda: boolean } {
  const cocok = versi.filter((v) => berlakuPada(v, tanggal));
  if (cocok.length === 0) return { terpilih: null, ganda: false };
  const urut = [...cocok].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return { terpilih: urut[0], ganda: cocok.length > 1 };
}

// --------------------------------------------------------- Kesesuaian jenis

export interface JenisKoperasi {
  allowsLending: boolean;
  allowsRetail: boolean;
  isSharia: boolean;
}

/**
 * Bolehkah koperasi jenis ini menjalankan produk pinjaman?
 *
 * Bukan pembatasan teknis melainkan pembatasan hukum: hanya koperasi simpan
 * pinjam yang boleh menjadikan pinjaman sebagai usaha utamanya. Koperasi
 * konsumen yang meminjamkan uang kepada anggotanya melampaui izin usahanya.
 */
export function bolehMenjalankanPinjaman(jenis: JenisKoperasi): Verdict {
  if (!jenis.allowsLending) {
    return {
      allowed: false,
      message:
        'Jenis koperasi ini tidak berwenang menjalankan produk pinjaman. Ubah jenis koperasi atau ajukan izin usaha simpan pinjam terlebih dahulu.',
    };
  }
  return { allowed: true };
}

/**
 * Bolehkah produk berbunga dipakai?
 *
 * Koperasi syariah tidak memakai bunga sama sekali — bukan memakai istilah
 * lain untuk hal yang sama. Produk yang membawa medan bunga ditolak, dan
 * penggantinya adalah akad murabahah, mudharabah, atau ijarah dengan kode
 * peristiwa akuntansi tersendiri.
 */
export function bolehMemakaiBunga(jenis: JenisKoperasi): Verdict {
  if (jenis.isSharia) {
    return {
      allowed: false,
      message:
        'Koperasi syariah tidak memakai bunga. Gunakan akad murabahah, mudharabah, musyarakah, ijarah, atau qardh.',
    };
  }
  return { allowed: true };
}
