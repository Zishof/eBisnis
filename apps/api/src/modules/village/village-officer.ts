/**
 * Aturan aparatur dan cakupan data — fungsi murni, tanpa basis data.
 *
 * Dua hal yang paling penting di sini:
 *
 * 1. **Masa jabatan yang berakhir mencabut akses.** Aparatur yang purnatugas
 *    tetapi hak aksesnya masih menyala adalah temuan audit yang menunggu
 *    terjadi — dan di desa, orang yang sudah tidak menjabat kerap masih tinggal
 *    di kampung yang sama dan masih kenal semua orang.
 *
 * 2. **Cakupan yang tidak jelas berarti tidak melihat apa-apa.** Bila penugasan
 *    cakupan seseorang tidak dapat ditentukan, ia memperoleh `NONE` — bukan
 *    `UNIT`. Bawaan yang longgar pada data kependudukan adalah bawaan yang salah.
 */

export type JenisCakupan =
  | 'VILLAGE_UNIT'
  | 'VILLAGE_SUB_AREA'
  | 'VILLAGE_RW'
  | 'VILLAGE_RT'
  | 'VILLAGE_SELF'
  | 'VILLAGE_AGGREGATE_ONLY'
  | 'VILLAGE_NONE';

export type TingkatCakupan =
  | 'UNIT'
  | 'SUB_AREA'
  | 'RW'
  | 'RT'
  | 'SELF'
  | 'AGGREGATE_ONLY'
  | 'NONE';

export type StatusJabatan = 'AKTIF' | 'BERAKHIR' | 'DIBERHENTIKAN' | 'CUTI';

// --- Masa jabatan ------------------------------------------------------------

export interface MasaJabatan {
  status: StatusJabatan;
  startDate: string;
  endDate: string | null;
}

export interface HasilJabatan {
  aktif: boolean;
  alasan?: string;
}

/**
 * Apakah masa jabatan ini sedang berlaku pada tanggal tertentu?
 *
 * Status `AKTIF` saja tidak cukup: masa jabatan yang tanggal berakhirnya sudah
 * lewat tetap bertuliskan `AKTIF` sampai ada yang memperbaruinya, dan di kantor
 * desa hal itu bisa tertunda berbulan-bulan. Tanggal yang menentukan, bukan
 * kolom status.
 */
export function jabatanBerlaku(masa: MasaJabatan, pada: string): HasilJabatan {
  if (masa.status === 'DIBERHENTIKAN') {
    return { aktif: false, alasan: 'Aparatur telah diberhentikan.' };
  }
  if (masa.status === 'BERAKHIR') {
    return { aktif: false, alasan: 'Masa jabatan telah berakhir.' };
  }
  if (masa.status === 'CUTI') {
    return {
      aktif: false,
      alasan: 'Aparatur sedang cuti. Wewenangnya perlu dilimpahkan secara resmi.',
    };
  }
  if (pada < masa.startDate) {
    return { aktif: false, alasan: `Masa jabatan baru dimulai ${masa.startDate}.` };
  }
  if (masa.endDate && pada > masa.endDate) {
    // Inilah yang dijaga: kolom status masih AKTIF, tetapi tanggalnya sudah
    // lewat. Hak akses harus ikut berakhir tanpa menunggu ada yang memperbarui
    // kolomnya.
    return {
      aktif: false,
      alasan: `Masa jabatan berakhir ${masa.endDate} dan belum diperbarui.`,
    };
  }
  return { aktif: true };
}

// --- Pelimpahan wewenang -----------------------------------------------------

export interface Pelimpahan {
  fromOfficerId: string;
  toOfficerId: string;
  startDate: string;
  endDate: string;
  status: 'AKTIF' | 'BERAKHIR' | 'DICABUT';
}

/** Apakah pelimpahan ini berlaku pada tanggal tertentu? */
export function pelimpahanBerlaku(p: Pelimpahan, pada: string): boolean {
  return p.status === 'AKTIF' && pada >= p.startDate && pada <= p.endDate;
}

/**
 * Memeriksa kesahihan pelimpahan sebelum disimpan.
 *
 * Pelimpahan wajib berbatas waktu. Yang tidak berujung bukan pelimpahan
 * melainkan pergantian jabatan — dan itu prosedur yang berbeda, dengan surat
 * keputusan yang berbeda pula.
 */
export function periksaPelimpahan(input: {
  fromOfficerId: string;
  toOfficerId: string;
  startDate: string;
  endDate: string;
  maxHari?: number;
}): { sah: boolean; alasan?: string } {
  if (input.fromOfficerId === input.toOfficerId) {
    return { sah: false, alasan: 'Wewenang tidak dapat dilimpahkan kepada diri sendiri.' };
  }
  if (input.endDate < input.startDate) {
    return { sah: false, alasan: 'Tanggal berakhir mendahului tanggal mulai.' };
  }
  const hari =
    (new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / 86_400_000;
  const batas = input.maxHari ?? 180;
  if (hari > batas) {
    return {
      sah: false,
      alasan:
        `Pelimpahan melebihi ${batas} hari. Pelimpahan yang sepanjang itu sesungguhnya ` +
        'pergantian jabatan, dan memerlukan surat keputusan tersendiri.',
    };
  }
  return { sah: true };
}

// --- Struktur organisasi -----------------------------------------------------

export interface SimpulOrganisasi {
  id: string;
  parentId: string | null;
}

/**
 * Mendeteksi lingkaran pada struktur organisasi.
 *
 * Struktur yang melingkar akan membuat penelusuran atasan berputar tanpa henti,
 * dan yang menemukannya biasanya adalah permintaan persetujuan yang tidak
 * pernah sampai kepada siapa pun.
 */
export function adaLingkaran(simpul: SimpulOrganisasi[]): { melingkar: boolean; jalur?: string[] } {
  const induk = new Map(simpul.map((s) => [s.id, s.parentId]));

  for (const s of simpul) {
    const dilalui: string[] = [];
    let kini: string | null = s.id;
    const terlihat = new Set<string>();
    while (kini) {
      if (terlihat.has(kini)) {
        return { melingkar: true, jalur: [...dilalui, kini] };
      }
      terlihat.add(kini);
      dilalui.push(kini);
      kini = induk.get(kini) ?? null;
    }
  }
  return { melingkar: false };
}

// --- Cakupan data ------------------------------------------------------------

export interface PenugasanCakupan {
  scopeType: JenisCakupan;
  scopeId: string | null;
  validFrom: string;
  validUntil: string | null;
  revokedAt: string | null;
}

export interface CakupanEfektif {
  level: TingkatCakupan;
  subAreaId?: string | null;
  rwId?: string | null;
  rtId?: string | null;
  residentId?: string | null;
  /** Dari mana cakupan ini berasal — untuk keterangan dan pemeriksaan. */
  sumber: 'PENUGASAN' | 'PERAN' | 'BAWAAN_TERKUNCI';
}

const LUAS: Record<TingkatCakupan, number> = {
  UNIT: 5,
  SUB_AREA: 4,
  RW: 3,
  RT: 2,
  SELF: 1,
  AGGREGATE_ONLY: 0,
  NONE: 0,
};

const DARI_JENIS: Record<JenisCakupan, TingkatCakupan> = {
  VILLAGE_UNIT: 'UNIT',
  VILLAGE_SUB_AREA: 'SUB_AREA',
  VILLAGE_RW: 'RW',
  VILLAGE_RT: 'RT',
  VILLAGE_SELF: 'SELF',
  VILLAGE_AGGREGATE_ONLY: 'AGGREGATE_ONLY',
  VILLAGE_NONE: 'NONE',
};

/** Apakah penugasan ini masih berlaku? */
export function penugasanBerlaku(p: PenugasanCakupan, pada: string): boolean {
  if (p.revokedAt) return false;
  if (pada < p.validFrom.slice(0, 10)) return false;
  if (p.validUntil && pada > p.validUntil.slice(0, 10)) return false;
  return true;
}

/**
 * Cakupan efektif seorang pengguna.
 *
 * Aturannya, dan urutannya penting:
 *
 * 1. Bila ada penugasan berlaku, yang **terluas** di antaranya berlaku. Satu
 *    orang dapat menjadi Ketua RT sekaligus operator kependudukan; ia tidak
 *    boleh kehilangan akses desa-luasnya hanya karena juga memimpin RT.
 * 2. Bila tidak ada penugasan sama sekali, cakupan bawaan peran berlaku.
 * 3. Bila keduanya tidak ada, **`NONE`** — bukan `UNIT`.
 *
 * Butir ketiga adalah yang paling mudah salah. Bawaan yang longgar pada data
 * kependudukan berarti pengguna yang penugasannya belum sempat diisi melihat
 * seluruh warga desa, dan tidak ada yang menyadarinya karena tidak ada yang
 * error.
 */
export function cakupanEfektif(
  penugasan: PenugasanCakupan[],
  bawaanPeran: TingkatCakupan | null,
  pada: string,
): CakupanEfektif {
  const berlaku = penugasan.filter((p) => penugasanBerlaku(p, pada));

  if (berlaku.length) {
    let terpilih = berlaku[0];
    for (const p of berlaku) {
      if (LUAS[DARI_JENIS[p.scopeType]] > LUAS[DARI_JENIS[terpilih.scopeType]]) terpilih = p;
    }
    const level = DARI_JENIS[terpilih.scopeType];
    return {
      level,
      sumber: 'PENUGASAN',
      subAreaId: level === 'SUB_AREA' ? terpilih.scopeId : null,
      rwId: level === 'RW' ? terpilih.scopeId : null,
      rtId: level === 'RT' ? terpilih.scopeId : null,
      residentId: level === 'SELF' ? terpilih.scopeId : null,
    };
  }

  if (bawaanPeran) {
    // Bawaan peran yang menunjuk objek tetapi tidak punya penugasan tidak dapat
    // dipakai: Ketua RT tanpa penugasan RT tidak tahu RT mana yang dimaksud.
    if (['SUB_AREA', 'RW', 'RT', 'SELF'].includes(bawaanPeran)) {
      return { level: 'NONE', sumber: 'BAWAAN_TERKUNCI' };
    }
    return { level: bawaanPeran, sumber: 'PERAN' };
  }

  return { level: 'NONE', sumber: 'BAWAAN_TERKUNCI' };
}

/** Apakah cakupan ini memperbolehkan melihat baris perorangan? */
export function bolehLihatPerorangan(level: TingkatCakupan): boolean {
  return level !== 'AGGREGATE_ONLY' && level !== 'NONE';
}

/**
 * Keterangan cakupan untuk ditampilkan kepada pengguna.
 *
 * Pengguna yang tidak melihat data perlu tahu sebabnya. "Tidak ada data" dan
 * "Anda tidak berwenang melihat data ini" adalah dua hal yang sangat berbeda,
 * dan menyamakannya membuat petugas mengira sistemnya rusak.
 */
export function keteranganCakupan(c: CakupanEfektif): string {
  switch (c.level) {
    case 'UNIT':
      return 'Anda melihat seluruh wilayah desa/kelurahan ini.';
    case 'SUB_AREA':
      return 'Anda melihat warga pada dusun/lingkungan yang ditugaskan kepada Anda.';
    case 'RW':
      return 'Anda melihat warga pada RW yang ditugaskan kepada Anda.';
    case 'RT':
      return 'Anda melihat warga pada RT yang ditugaskan kepada Anda.';
    case 'SELF':
      return 'Anda melihat data diri dan anggota keluarga Anda.';
    case 'AGGREGATE_ONLY':
      return 'Peran Anda memperoleh angka ringkasan, bukan data warga per orang.';
    case 'NONE':
    default:
      return c.sumber === 'BAWAAN_TERKUNCI'
        ? 'Cakupan wilayah Anda belum ditetapkan. Hubungi administrator desa untuk penugasan wilayah.'
        : 'Peran Anda tidak mencakup akses data kependudukan.';
  }
}
