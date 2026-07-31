/**
 * Aturan perencanaan dan APBDes — fungsi murni, tanpa basis data.
 *
 * ## APBDes bukan pembukuan komersial
 *
 * Perbedaannya bukan istilah:
 *
 * | | Akuntansi komersial | APBDes |
 * |---|---|---|
 * | Struktur | Neraca, laba-rugi | Pendapatan, Belanja, Pembiayaan |
 * | Tujuan | Mengukur laba | Mempertanggungjawabkan penggunaan anggaran |
 * | Satuan kendali | Akun | **Pagu per kegiatan** |
 * | Yang dilarang | — | **Belanja melampaui pagu kegiatan** |
 *
 * Yang terakhir menentukan seluruh rancangan. Pada sistem komersial,
 * membelanjakan lebih dari rencana adalah keputusan bisnis. Pada APBDes,
 * belanja melampaui pagu adalah **pelanggaran** — dan sistem harus menolaknya,
 * bukan memberi peringatan lalu menerimanya.
 *
 * ## Ikat dahulu, baru bayar
 *
 * Pagu terpakai sejak belanja **diikat** (SPP disetujui, kontrak
 * ditandatangani), bukan sejak uang keluar. Desa yang hanya melihat realisasi
 * akan mengira paguya masih tersedia padahal sudah habis diikat kontrak — lalu
 * mengikat kontrak kedua yang tidak ada uangnya.
 */

export type JenisAnggaran = 'PENDAPATAN' | 'BELANJA' | 'PEMBIAYAAN_PENERIMAAN' | 'PEMBIAYAAN_PENGELUARAN';

export type StatusAnggaran = 'DRAF' | 'DIBAHAS' | 'DISETUJUI' | 'DITETAPKAN' | 'PERUBAHAN' | 'DITUTUP';

export const TRANSISI_ANGGARAN: Record<StatusAnggaran, StatusAnggaran[]> = {
  DRAF: ['DIBAHAS'],
  DIBAHAS: ['DISETUJUI', 'DRAF'],
  // Disetujui BPD, lalu ditetapkan dengan peraturan desa.
  DISETUJUI: ['DITETAPKAN', 'DIBAHAS'],
  // APBDes Perubahan: satu-satunya jalan mengubah pagu setelah ditetapkan.
  DITETAPKAN: ['PERUBAHAN', 'DITUTUP'],
  PERUBAHAN: ['DITETAPKAN'],
  DITUTUP: [],
};

export interface Putusan {
  boleh: boolean;
  alasan?: string;
}

export function bolehPindahAnggaran(dari: StatusAnggaran, ke: StatusAnggaran): Putusan {
  if (dari === ke) return { boleh: false, alasan: `Anggaran sudah berstatus ${ke}.` };
  if (!TRANSISI_ANGGARAN[dari].length) {
    return { boleh: false, alasan: `Anggaran tahun ini sudah ditutup.` };
  }
  if (!TRANSISI_ANGGARAN[dari].includes(ke)) {
    return { boleh: false, alasan: `Anggaran berstatus ${dari} tidak dapat langsung menjadi ${ke}.` };
  }
  return { boleh: true };
}

/**
 * Bolehkah pagu diubah?
 *
 * Setelah ditetapkan, pagu hanya berubah lewat APBDes Perubahan — yang
 * memerlukan persetujuan BPD dan peraturan desa tersendiri. Membiarkannya
 * disunting langsung berarti anggaran yang disahkan bukan anggaran yang
 * dijalankan.
 */
export function bolehUbahPagu(status: StatusAnggaran): Putusan {
  if (status === 'DRAF' || status === 'DIBAHAS' || status === 'PERUBAHAN') {
    return { boleh: true };
  }
  if (status === 'DITETAPKAN') {
    return {
      boleh: false,
      alasan:
        'Pagu yang sudah ditetapkan hanya dapat diubah melalui APBDes Perubahan, ' +
        'yang memerlukan persetujuan BPD dan peraturan desa tersendiri.',
    };
  }
  return { boleh: false, alasan: `Anggaran berstatus ${status} tidak dapat diubah.` };
}

// --- Pagu --------------------------------------------------------------------

export interface PaguKegiatan {
  /** Pagu yang ditetapkan. */
  ceiling: number;
  /** Yang sudah diikat: SPP disetujui, kontrak ditandatangani. */
  committed: number;
  /** Yang sudah direalisasi: uang benar-benar keluar. */
  realized: number;
}

export type AlasanTolakPagu = 'MELAMPAUI_PAGU' | 'MELAMPAUI_IKATAN' | 'NILAI_TIDAK_SAH';

export interface KeputusanPagu {
  boleh: boolean;
  reason?: AlasanTolakPagu;
  alasan?: string;
  /** Sisa yang masih dapat diikat. */
  sisaPagu: number;
  /** Sisa ikatan yang belum direalisasi. */
  sisaIkatan: number;
}

/** Sisa pagu yang masih dapat diikat. */
export function sisaPagu(p: PaguKegiatan): number {
  return p.ceiling - p.committed;
}

/** Ikatan yang belum direalisasi. */
export function sisaIkatan(p: PaguKegiatan): number {
  return p.committed - p.realized;
}

/**
 * Bolehkah mengikat belanja sebesar ini?
 *
 * Menolak bila melampaui pagu. Bukan memperingatkan — menolak. Pada APBDes,
 * belanja melampaui pagu adalah pelanggaran, dan sistem yang memperingatkan
 * lalu menerima hanya memindahkan tanggung jawabnya kepada petugas yang
 * menekan "lanjutkan".
 */
export function bolehMengikat(p: PaguKegiatan, nilai: number): KeputusanPagu {
  const sisa = sisaPagu(p);
  const sisaIk = sisaIkatan(p);

  if (!Number.isFinite(nilai) || nilai <= 0) {
    return {
      boleh: false,
      reason: 'NILAI_TIDAK_SAH',
      alasan: 'Nilai ikatan harus lebih besar dari nol.',
      sisaPagu: sisa,
      sisaIkatan: sisaIk,
    };
  }

  if (nilai > sisa) {
    return {
      boleh: false,
      reason: 'MELAMPAUI_PAGU',
      // Menyebutkan angkanya. Petugas yang tahu sisa paguya dapat menyesuaikan
      // nilainya; yang hanya diberi tahu "melampaui pagu" akan menebak.
      alasan:
        `Ikatan ${format(nilai)} melampaui sisa pagu kegiatan ini. ` +
        `Pagu ${format(p.ceiling)}, sudah diikat ${format(p.committed)}, sisa ${format(sisa)}.`,
      sisaPagu: sisa,
      sisaIkatan: sisaIk,
    };
  }

  return { boleh: true, sisaPagu: sisa - nilai, sisaIkatan: sisaIk + nilai };
}

/**
 * Bolehkah merealisasi belanja sebesar ini?
 *
 * Realisasi tidak boleh melampaui **ikatan**, bukan pagu. Uang yang keluar
 * tanpa ikatan adalah pengeluaran tanpa dasar — dan itu temuan pemeriksaan,
 * bukan sekadar kelalaian pencatatan.
 */
export function bolehMerealisasi(p: PaguKegiatan, nilai: number): KeputusanPagu {
  const sisa = sisaPagu(p);
  const sisaIk = sisaIkatan(p);

  if (!Number.isFinite(nilai) || nilai <= 0) {
    return {
      boleh: false,
      reason: 'NILAI_TIDAK_SAH',
      alasan: 'Nilai realisasi harus lebih besar dari nol.',
      sisaPagu: sisa,
      sisaIkatan: sisaIk,
    };
  }

  if (nilai > sisaIk) {
    return {
      boleh: false,
      reason: 'MELAMPAUI_IKATAN',
      alasan:
        `Realisasi ${format(nilai)} melampaui ikatan yang belum dibayar. ` +
        `Diikat ${format(p.committed)}, sudah direalisasi ${format(p.realized)}, sisa ${format(sisaIk)}. ` +
        'Ikat belanjanya terlebih dahulu.',
      sisaPagu: sisa,
      sisaIkatan: sisaIk,
    };
  }

  return { boleh: true, sisaPagu: sisa, sisaIkatan: sisaIk - nilai };
}

/**
 * Bolehkah pagu diturunkan menjadi nilai baru?
 *
 * Tidak, bila sudah ada ikatan melebihi nilai barunya. Pagu yang diturunkan di
 * bawah ikatan yang sudah berjalan akan membuat kontrak yang sudah
 * ditandatangani tidak punya anggaran.
 */
export function bolehTurunkanPagu(p: PaguKegiatan, paguBaru: number): Putusan {
  if (paguBaru < p.committed) {
    return {
      boleh: false,
      alasan:
        `Pagu tidak dapat diturunkan menjadi ${format(paguBaru)} karena sudah diikat ` +
        `${format(p.committed)}. Batalkan ikatannya terlebih dahulu.`,
    };
  }
  return { boleh: true };
}

/** Persentase serapan terhadap pagu. */
export function serapan(p: PaguKegiatan): { committedPct: number; realizedPct: number } {
  if (p.ceiling <= 0) return { committedPct: 0, realizedPct: 0 };
  return {
    committedPct: Math.round((p.committed / p.ceiling) * 1000) / 10,
    realizedPct: Math.round((p.realized / p.ceiling) * 1000) / 10,
  };
}

function format(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

// --- Keseimbangan APBDes -----------------------------------------------------

export interface RingkasanApbdes {
  pendapatan: number;
  belanja: number;
  pembiayaanPenerimaan: number;
  pembiayaanPengeluaran: number;
}

export interface HasilKeseimbangan {
  seimbang: boolean;
  surplusDefisit: number;
  pembiayaanNeto: number;
  selisih: number;
  keterangan: string;
}

/**
 * Memeriksa keseimbangan APBDes.
 *
 * Aturannya: **surplus/defisit + pembiayaan neto harus nol.**
 *
 *   Surplus/Defisit = Pendapatan − Belanja
 *   Pembiayaan Neto = Penerimaan Pembiayaan − Pengeluaran Pembiayaan
 *
 * Defisit ditutup penerimaan pembiayaan (SiLPA tahun lalu); surplus disalurkan
 * ke pengeluaran pembiayaan. APBDes yang tidak seimbang tidak dapat ditetapkan
 * — bukan karena aturan sistem, melainkan karena begitulah anggaran disusun.
 */
export function periksaKeseimbangan(r: RingkasanApbdes): HasilKeseimbangan {
  const surplusDefisit = r.pendapatan - r.belanja;
  const pembiayaanNeto = r.pembiayaanPenerimaan - r.pembiayaanPengeluaran;
  const selisih = surplusDefisit + pembiayaanNeto;

  if (selisih === 0) {
    return {
      seimbang: true,
      surplusDefisit,
      pembiayaanNeto,
      selisih,
      keterangan:
        surplusDefisit < 0
          ? `Defisit ${format(Math.abs(surplusDefisit))} ditutup pembiayaan neto. Seimbang.`
          : surplusDefisit > 0
            ? `Surplus ${format(surplusDefisit)} disalurkan ke pengeluaran pembiayaan. Seimbang.`
            : 'Pendapatan sama dengan belanja. Seimbang.',
    };
  }

  return {
    seimbang: false,
    surplusDefisit,
    pembiayaanNeto,
    selisih,
    keterangan:
      selisih > 0
        ? `Kelebihan ${format(selisih)} belum dialokasikan. Tambahkan pengeluaran pembiayaan atau belanja.`
        : `Kekurangan ${format(Math.abs(selisih))} belum tertutup. Tambahkan penerimaan pembiayaan atau kurangi belanja.`,
  };
}

// --- Peristiwa akuntansi -----------------------------------------------------

/**
 * Kode peristiwa akuntansi village.
 *
 * Berawalan `VILLAGE_` supaya tidak tercampur dengan `MARKETPLACE_*` maupun
 * `POS_*` milik Core. Mengikuti pola yang sudah ada: setiap kode wajib punya
 * daftar nilai wajibnya, dan pengujian kelengkapan menjaganya — kode yang
 * ditambahkan tanpa daftar akan menggagalkan pengujian, bukan diam-diam
 * menghasilkan jurnal kosong.
 */
export const VILLAGE_EVENTS = [
  'VILLAGE_BUDGET_APPROVED',
  'VILLAGE_REVENUE_RECEIVED',
  'VILLAGE_EXPENDITURE_COMMITTED',
  'VILLAGE_EXPENDITURE_REALIZED',
  'VILLAGE_ADVANCE_ISSUED',
  'VILLAGE_ADVANCE_SETTLED',
  'VILLAGE_TAX_WITHHELD',
  'VILLAGE_TAX_REMITTED',
  'VILLAGE_FINANCING_RECEIPT',
  'VILLAGE_FINANCING_EXPENDITURE',
  'VILLAGE_AID_DISBURSED',
  'VILLAGE_ASSET_ACQUIRED',
] as const;

export type VillageEventCode = (typeof VILLAGE_EVENTS)[number];

export function isVillageEvent(code: string): code is VillageEventCode {
  return (VILLAGE_EVENTS as readonly string[]).includes(code);
}

/**
 * Nilai yang wajib dibawa setiap peristiwa.
 *
 * `VILLAGE_EXPENDITURE_COMMITTED` menuntut `budgetLineId` supaya ikatan dapat
 * dibebankan pada kegiatan yang benar. Ikatan tanpa kegiatan adalah ikatan yang
 * tidak mengurangi pagu siapa pun — dan pagu yang tidak berkurang akan diikat
 * lagi oleh orang berikutnya.
 */
export const NILAI_WAJIB: Record<VillageEventCode, string[]> = {
  VILLAGE_BUDGET_APPROVED: ['totalRevenue', 'totalExpenditure'],
  VILLAGE_REVENUE_RECEIVED: ['amount'],
  VILLAGE_EXPENDITURE_COMMITTED: ['amount'],
  VILLAGE_EXPENDITURE_REALIZED: ['amount'],
  VILLAGE_ADVANCE_ISSUED: ['amount'],
  // Panjar yang dipertanggungjawabkan membawa dua angka: berapa yang dipakai
  // dan berapa yang dikembalikan. Menyimpan hanya salah satunya membuat sisa
  // panjar harus dihitung ulang, dan perhitungan ulang selalu ada yang lupa.
  VILLAGE_ADVANCE_SETTLED: ['usedAmount', 'returnedAmount'],
  VILLAGE_TAX_WITHHELD: ['taxBase', 'taxAmount'],
  VILLAGE_TAX_REMITTED: ['taxAmount'],
  VILLAGE_FINANCING_RECEIPT: ['amount'],
  VILLAGE_FINANCING_EXPENDITURE: ['amount'],
  VILLAGE_AID_DISBURSED: ['amount', 'beneficiaryCount'],
  VILLAGE_ASSET_ACQUIRED: ['amount'],
};

export function periksaNilaiWajib(
  eventCode: string,
  amounts: Record<string, number>,
): { ok: boolean; missing: string[] } {
  if (!isVillageEvent(eventCode)) {
    return { ok: false, missing: [`(peristiwa "${eventCode}" tidak dikenal)`] };
  }
  const missing = NILAI_WAJIB[eventCode].filter(
    (k) => amounts[k] === undefined || amounts[k] === null,
  );
  return { ok: missing.length === 0, missing };
}

// --- Perencanaan -------------------------------------------------------------

export type StatusRencana = 'DRAF' | 'DIBAHAS' | 'DITETAPKAN' | 'DIREVISI' | 'SELESAI';

/**
 * Apakah tahun ini termasuk dalam periode RPJMDes?
 *
 * RPJMDes berlaku enam tahun mengikuti masa jabatan Kepala Desa. RKPDes yang
 * disusun di luar periode RPJMDes-nya tidak punya induk — dan rencana tahunan
 * tanpa rencana jangka menengah adalah rencana yang tidak dapat
 * dipertanggungjawabkan arahnya.
 */
export function tahunDalamPeriode(
  tahun: number,
  periode: { startYear: number; endYear: number },
): Putusan {
  if (tahun < periode.startYear || tahun > periode.endYear) {
    return {
      boleh: false,
      alasan:
        `Tahun ${tahun} berada di luar periode RPJM Desa ` +
        `(${periode.startYear}–${periode.endYear}). Susun RPJM Desa untuk periode yang sesuai.`,
    };
  }
  return { boleh: true };
}

/**
 * Bolehkah usulan Musrenbang dimasukkan ke RKP?
 *
 * Hanya yang sudah disepakati. Memasukkan usulan yang masih dibahas berarti
 * mendahului musyawarahnya, dan usulan yang ditolak tidak boleh muncul kembali
 * lewat pintu belakang.
 */
export function bolehMasukRkp(statusUsulan: string): Putusan {
  if (statusUsulan === 'DISEPAKATI') return { boleh: true };
  if (statusUsulan === 'MASUK_RKP') {
    return { boleh: false, alasan: 'Usulan ini sudah masuk RKP.' };
  }
  return {
    boleh: false,
    alasan:
      `Usulan berstatus ${statusUsulan} belum dapat dimasukkan ke RKP. ` +
      'Hanya usulan yang sudah disepakati musyawarah yang dapat masuk.',
  };
}
