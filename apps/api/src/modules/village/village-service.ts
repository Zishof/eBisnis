/**
 * Aturan layanan warga dan persuratan — fungsi murni, tanpa basis data.
 *
 * Inti sistem ini. Bila hanya satu bagian yang boleh benar, ini bagiannya:
 * layanan warga dan surat adalah alasan sebuah desa memakai sistem seperti ini.
 *
 * Empat hal yang menentukan bentuk berkas ini, dan seluruhnya berasal dari
 * keadaan nyata di kantor desa:
 *
 * 1. **Permohonan yang ditolak kembali kepada warga beserta alasannya.**
 *    Permohonan yang berhenti tanpa kabar adalah keluhan nomor satu pelayanan
 *    publik.
 * 2. **SLA dihitung sejak berkas lengkap**, bukan sejak permohonan masuk.
 *    Menghitung dari permohonan masuk membuat angka SLA menyalahkan warga yang
 *    lambat melengkapi berkas — dan angka yang menyalahkan orang yang salah
 *    tidak dipakai siapa pun.
 * 3. **Aturan yang berlaku adalah aturan saat permohonan masuk.**
 * 4. **Pemohon tidak dapat memproses permohonannya sendiri.** Di desa kecil,
 *    perangkat desa juga warga yang suatu saat mengajukan surat untuk dirinya.
 */

import type { LangkahWorkflow } from './ports/workflow.port';

export type StatusPermohonan =
  | 'DRAF'
  | 'DIAJUKAN'
  | 'BERKAS_KURANG'
  | 'DIVERIFIKASI'
  | 'MENUNGGU_PERSETUJUAN'
  | 'DISETUJUI'
  | 'DITOLAK'
  | 'DITERBITKAN'
  | 'DISERAHKAN'
  | 'DIBATALKAN';

export const STATUS_PERMOHONAN: StatusPermohonan[] = [
  'DRAF',
  'DIAJUKAN',
  'BERKAS_KURANG',
  'DIVERIFIKASI',
  'MENUNGGU_PERSETUJUAN',
  'DISETUJUI',
  'DITOLAK',
  'DITERBITKAN',
  'DISERAHKAN',
  'DIBATALKAN',
];

/**
 * Transisi yang sah.
 *
 * `BERKAS_KURANG` kembali ke `DIAJUKAN`, bukan ke `DRAF`: warga melengkapi
 * berkasnya, bukan mengajukan ulang dari nol. Nomor antreannya tetap, dan
 * riwayatnya tidak terputus.
 */
export const TRANSISI_PERMOHONAN: Record<StatusPermohonan, StatusPermohonan[]> = {
  DRAF: ['DIAJUKAN', 'DIBATALKAN'],
  DIAJUKAN: ['BERKAS_KURANG', 'DIVERIFIKASI', 'DITOLAK', 'DIBATALKAN'],
  BERKAS_KURANG: ['DIAJUKAN', 'DIBATALKAN'],
  DIVERIFIKASI: ['MENUNGGU_PERSETUJUAN', 'BERKAS_KURANG', 'DITOLAK'],
  MENUNGGU_PERSETUJUAN: ['DISETUJUI', 'DITOLAK', 'BERKAS_KURANG'],
  DISETUJUI: ['DITERBITKAN'],
  DITERBITKAN: ['DISERAHKAN'],
  // Status akhir.
  DITOLAK: [],
  DISERAHKAN: [],
  DIBATALKAN: [],
};

export interface Putusan {
  boleh: boolean;
  alasan?: string;
  /** Benar bila transisi ini wajib menyertakan alasan yang terbaca warga. */
  wajibBeralasan?: boolean;
}

/** Status yang tidak dapat berubah lagi. */
export function statusAkhir(s: StatusPermohonan): boolean {
  return TRANSISI_PERMOHONAN[s].length === 0;
}

/**
 * Transisi yang wajib menyertakan alasan.
 *
 * Seluruhnya adalah transisi yang **merugikan atau menunda warga**. Warga yang
 * permohonannya ditolak atau dikembalikan tanpa keterangan akan datang lagi
 * menanyakan hal yang sama, dan petugas berikutnya tidak tahu apa yang harus
 * dijawab.
 */
const WAJIB_BERALASAN = new Set<string>([
  'DIAJUKAN->BERKAS_KURANG',
  'DIVERIFIKASI->BERKAS_KURANG',
  'MENUNGGU_PERSETUJUAN->BERKAS_KURANG',
  'DIAJUKAN->DITOLAK',
  'DIVERIFIKASI->DITOLAK',
  'MENUNGGU_PERSETUJUAN->DITOLAK',
  'DRAF->DIBATALKAN',
  'DIAJUKAN->DIBATALKAN',
  'BERKAS_KURANG->DIBATALKAN',
]);

export function bolehPindahPermohonan(
  dari: StatusPermohonan,
  ke: StatusPermohonan,
): Putusan {
  if (dari === ke) return { boleh: false, alasan: `Permohonan sudah berstatus ${ke}.` };
  if (statusAkhir(dari)) {
    return { boleh: false, alasan: `Permohonan berstatus ${dari} sudah selesai dan tidak dapat diubah.` };
  }
  if (!TRANSISI_PERMOHONAN[dari].includes(ke)) {
    return { boleh: false, alasan: `Permohonan berstatus ${dari} tidak dapat langsung menjadi ${ke}.` };
  }
  return { boleh: true, wajibBeralasan: WAJIB_BERALASAN.has(`${dari}->${ke}`) };
}

/**
 * Bolehkah pengguna ini memproses permohonan yang diajukan orang lain?
 *
 * Di desa kecil, operator layanan juga warga yang suatu saat mengajukan surat
 * keterangan untuk dirinya sendiri. Ia boleh mengajukannya; yang tidak boleh
 * adalah ia sendiri yang memverifikasi dan menyetujuinya.
 */
export function bolehMemproses(pemohonUserId: string | null, pemrosesUserId: string): Putusan {
  if (pemohonUserId && pemohonUserId === pemrosesUserId) {
    return {
      boleh: false,
      alasan:
        'Anda tidak dapat memproses permohonan yang Anda ajukan sendiri. ' +
        'Mintakan kepada petugas lain.',
    };
  }
  return { boleh: true };
}

// --- Persyaratan -------------------------------------------------------------

export interface Persyaratan {
  code: string;
  name: string;
  mandatory: boolean;
}

export interface BerkasTerkumpul {
  requirementCode: string;
}

export interface HasilKelengkapan {
  lengkap: boolean;
  kurang: Array<{ code: string; name: string }>;
  pesan?: string;
}

/**
 * Memeriksa kelengkapan berkas.
 *
 * Menyebutkan **apa** yang kurang, bukan sekadar "berkas belum lengkap". Warga
 * yang harus menebak apa yang kurang akan datang berkali-kali membawa berkas
 * yang salah.
 */
export function periksaKelengkapan(
  syarat: Persyaratan[],
  terkumpul: BerkasTerkumpul[],
): HasilKelengkapan {
  const ada = new Set(terkumpul.map((t) => t.requirementCode));
  const kurang = syarat
    .filter((s) => s.mandatory && !ada.has(s.code))
    .map((s) => ({ code: s.code, name: s.name }));

  if (!kurang.length) return { lengkap: true, kurang: [] };

  return {
    lengkap: false,
    kurang,
    pesan:
      kurang.length === 1
        ? `Berkas yang masih kurang: ${kurang[0].name}.`
        : `Berkas yang masih kurang: ${kurang.map((k) => k.name).join(', ')}.`,
  };
}

// --- SLA ---------------------------------------------------------------------

export interface HitungSla {
  /** Kapan berkas dinyatakan lengkap. Null bila belum lengkap. */
  completedAt: string | null;
  /** Kapan permohonan selesai (diterbitkan). Null bila belum. */
  finishedAt: string | null;
  /** Janji layanan dalam hari kerja. */
  slaWorkingDays: number;
  /** Tanggal-tanggal yang bukan hari kerja, format YYYY-MM-DD. */
  holidays?: string[];
}

export interface HasilSla {
  /** Hari kerja yang terpakai. Null bila belum dapat dihitung. */
  elapsedWorkingDays: number | null;
  /** Batas waktu penyelesaian. Null bila berkas belum lengkap. */
  dueDate: string | null;
  status: 'BELUM_MULAI' | 'DALAM_TENGGAT' | 'TERLAMBAT' | 'SELESAI_TEPAT' | 'SELESAI_TERLAMBAT';
  keterangan: string;
}

function harikerja(tanggal: Date, libur: Set<string>): boolean {
  const h = tanggal.getUTCDay();
  if (h === 0 || h === 6) return false;
  return !libur.has(tanggal.toISOString().slice(0, 10));
}

/** Menambah n hari kerja pada sebuah tanggal. */
export function tambahHariKerja(mulai: string, n: number, holidays: string[] = []): string {
  const libur = new Set(holidays);
  const d = new Date(`${mulai}T00:00:00Z`);
  let sisa = n;
  while (sisa > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (harikerja(d, libur)) sisa -= 1;
  }
  return d.toISOString().slice(0, 10);
}

/** Menghitung hari kerja antara dua tanggal, tidak termasuk tanggal mulai. */
export function selisihHariKerja(dari: string, sampai: string, holidays: string[] = []): number {
  const libur = new Set(holidays);
  const a = new Date(`${dari}T00:00:00Z`);
  const b = new Date(`${sampai}T00:00:00Z`);
  if (b <= a) return 0;
  let n = 0;
  const d = new Date(a);
  while (d < b) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (harikerja(d, libur)) n += 1;
  }
  return n;
}

/**
 * Menghitung SLA.
 *
 * Dihitung **sejak berkas lengkap**, bukan sejak permohonan masuk. Perbedaannya
 * bukan teknis melainkan soal siapa yang disalahkan angkanya: warga yang butuh
 * seminggu melengkapi berkas bukan kesalahan desa, dan angka yang menyalahkan
 * pihak yang salah tidak akan dipakai siapa pun untuk memperbaiki apa pun.
 */
export function hitungSla(input: HitungSla, hariIni: string): HasilSla {
  if (!input.completedAt) {
    return {
      elapsedWorkingDays: null,
      dueDate: null,
      status: 'BELUM_MULAI',
      keterangan:
        'Perhitungan janji layanan dimulai setelah berkas dinyatakan lengkap.',
    };
  }

  const mulai = input.completedAt.slice(0, 10);
  const jatuhTempo = tambahHariKerja(mulai, input.slaWorkingDays, input.holidays);

  if (input.finishedAt) {
    const selesai = input.finishedAt.slice(0, 10);
    const terpakai = selisihHariKerja(mulai, selesai, input.holidays);
    const tepat = selesai <= jatuhTempo;
    return {
      elapsedWorkingDays: terpakai,
      dueDate: jatuhTempo,
      status: tepat ? 'SELESAI_TEPAT' : 'SELESAI_TERLAMBAT',
      keterangan: tepat
        ? `Selesai dalam ${terpakai} hari kerja, dari janji ${input.slaWorkingDays} hari kerja.`
        : `Selesai dalam ${terpakai} hari kerja, melampaui janji ${input.slaWorkingDays} hari kerja.`,
    };
  }

  const terpakai = selisihHariKerja(mulai, hariIni, input.holidays);
  const terlambat = hariIni > jatuhTempo;
  return {
    elapsedWorkingDays: terpakai,
    dueDate: jatuhTempo,
    status: terlambat ? 'TERLAMBAT' : 'DALAM_TENGGAT',
    keterangan: terlambat
      ? `Melewati batas ${jatuhTempo}; sudah ${terpakai} hari kerja berjalan.`
      : `Batas penyelesaian ${jatuhTempo}; ${terpakai} hari kerja berjalan.`,
  };
}

// --- Nomor surat -------------------------------------------------------------

export interface PolaNomor {
  /** Contoh: '{urut}/{kode}/{bulanRomawi}/{tahun}'. */
  pattern: string;
  padding: number;
}

const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/**
 * Menyusun nomor surat dari pola.
 *
 * Pola disimpan sebagai data, bukan ditulis di kode: setiap desa punya
 * kebiasaan penomoran sendiri, dan yang di kode berarti setiap desa memerlukan
 * pemasangan tersendiri.
 */
export function susunNomorSurat(
  pola: PolaNomor,
  bagian: { urut: number; kode: string; tanggal: string; unitCode?: string },
): string {
  const d = new Date(`${bagian.tanggal}T00:00:00Z`);
  const bulan = d.getUTCMonth();
  return pola.pattern
    .replace('{urut}', String(bagian.urut).padStart(pola.padding, '0'))
    .replace('{kode}', bagian.kode)
    .replace('{unit}', bagian.unitCode ?? '')
    .replace('{bulanRomawi}', ROMAWI[bulan] ?? '')
    .replace('{bulan}', String(bulan + 1).padStart(2, '0'))
    .replace('{tahun}', String(d.getUTCFullYear()))
    .replace('{tahun2}', String(d.getUTCFullYear()).slice(2));
}

// --- Antrean -----------------------------------------------------------------

/**
 * Nomor antrean berikutnya.
 *
 * Kembali ke satu setiap hari. Antrean yang tidak pernah kembali akan mencapai
 * angka ribuan pada bulan ketiga, dan warga yang dipanggil "nomor 3.412"
 * kehilangan gambaran berapa lama lagi gilirannya.
 */
export function nomorAntreanBerikutnya(kodeLoket: string, terakhirHariIni: number): string {
  return `${kodeLoket}-${String(terakhirHariIni + 1).padStart(3, '0')}`;
}

// --- Cuplikan alur -----------------------------------------------------------

/**
 * Langkah yang benar-benar dijalankan, setelah yang perannya tidak ada dilewati.
 *
 * Desa kecil kerap tidak punya seluruh jabatan. Alur yang menuntut persetujuan
 * Kasi Pelayanan pada desa yang tidak punya Kasi Pelayanan akan menggantung
 * selamanya, dan warganya tidak pernah memperoleh suratnya.
 */
export function langkahEfektif(
  langkah: LangkahWorkflow[],
  peranTersedia: Set<string>,
): { steps: LangkahWorkflow[]; dilewati: LangkahWorkflow[] } {
  const steps: LangkahWorkflow[] = [];
  const dilewati: LangkahWorkflow[] = [];
  for (const l of langkah) {
    if (peranTersedia.has(l.roleCode)) steps.push(l);
    else if (l.skippable) dilewati.push(l);
    else steps.push(l); // tidak boleh dilewati: tetap menunggu, dan itu disengaja
  }
  return { steps, dilewati };
}

/**
 * Apakah alur ini dapat diselesaikan pada desa dengan peran yang tersedia?
 *
 * Diperiksa saat katalog layanan disimpan, bukan saat warga sudah mengantre.
 * Alur yang tidak dapat diselesaikan lebih baik ketahuan saat dikonfigurasi.
 */
export function alurDapatDiselesaikan(
  langkah: LangkahWorkflow[],
  peranTersedia: Set<string>,
): { dapat: boolean; buntu: LangkahWorkflow[] } {
  const buntu = langkah.filter((l) => !l.skippable && !peranTersedia.has(l.roleCode));
  return { dapat: buntu.length === 0, buntu };
}
