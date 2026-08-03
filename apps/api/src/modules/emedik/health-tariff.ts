/**
 * Aturan tarif berversi dan cakupan penjamin.
 *
 * Fungsi murni, tanpa basis data.
 *
 * Empat hal menentukan bentuk seluruh berkas ini.
 *
 * 1. **Tarif dipilih menurut TANGGAL LAYANAN, bukan tanggal klaim.** Pasien
 *    yang dirawat pada Maret dan klaimnya diajukan pada Mei tetap memakai tarif
 *    Maret. Memakai tanggal klaim berarti menunda pengajuan menjadi cara
 *    menaikkan tagihan.
 *
 * 2. **Tarif tidak pernah ditimpa.** Impor membuat versi baru; versi lama
 *    ditutup dengan tanggal berakhir. Klaim tahun lalu harus tetap dapat
 *    dijelaskan dengan tarif tahun lalu — bila tarifnya ditimpa, seluruh klaim
 *    lama menjadi tidak dapat diaudit.
 *
 * 3. **Tumpang tindih tanggal DITOLAK.** Dua versi yang berlaku pada tanggal
 *    yang sama untuk kunci yang sama membuat pemilihan tarif tidak dapat
 *    ditentukan — dan yang tidak dapat ditentukan akan ditentukan secara acak
 *    oleh urutan baris.
 *
 * 4. **Tarif yang tidak ada tidak ditaksir.** Jawabannya "belum tersedia", dan
 *    perhitungannya berhenti. Menaksirnya akan menghasilkan angka yang tampak
 *    resmi lalu dipakai menagih orang.
 */

// --- Kunci pemilihan ---------------------------------------------------------

export type MetodePembayaran =
  | 'CAPITATION'
  | 'NON_CAPITATION'
  | 'INA_CBG'
  | 'NON_INA_CBG'
  | 'FEE_FOR_SERVICE';

export type KelasFasilitas = 'FKTP' | 'A' | 'B' | 'C' | 'D';

export type KelasLayanan = 'KRIS' | 'CLASS_1' | 'CLASS_2' | 'CLASS_3' | 'VIP' | 'VVIP';

/**
 * Kunci pemilihan tarif.
 *
 * Enam bagian, dan keenamnya menentukan. Menghilangkan salah satunya akan
 * menghasilkan tarif yang cocok bagi rumah sakit lain di provinsi lain.
 */
export interface KunciTarif {
  paymentMethod: MetodePembayaran;
  regionCode: string;
  facilityClass: KelasFasilitas;
  serviceClass?: KelasLayanan | null;
  casemixGroup?: string | null;
  casemixSeverity?: string | null;
  /** TANGGAL LAYANAN, bukan tanggal klaim. */
  serviceDate: string;
}

export interface BarisTarif {
  id: string;
  paymentMethod: MetodePembayaran;
  regionCode: string;
  facilityClass: KelasFasilitas;
  serviceClass?: string | null;
  casemixGroup?: string | null;
  casemixSeverity?: string | null;
  amount: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  versionId: string;
  regulationReference?: string | null;
}

// --- Pemilihan tarif ---------------------------------------------------------

function dalamMasaBerlaku(baris: BarisTarif, tanggal: string): boolean {
  const layanan = Date.parse(tanggal);
  const mulai = Date.parse(baris.effectiveFrom);
  if (!Number.isFinite(layanan) || !Number.isFinite(mulai)) return false;
  if (layanan < mulai) return false;
  if (!baris.effectiveTo) return true;
  const selesai = Date.parse(baris.effectiveTo);
  return Number.isFinite(selesai) ? layanan <= selesai : true;
}

function cocokKunci(baris: BarisTarif, kunci: KunciTarif): boolean {
  if (baris.paymentMethod !== kunci.paymentMethod) return false;
  if (baris.regionCode !== kunci.regionCode) return false;
  if (baris.facilityClass !== kunci.facilityClass) return false;

  /*
   * Bagian yang KOSONG pada baris tarif berarti "berlaku bagi semua"; bagian
   * yang terisi harus cocok persis. Dibalik — kosong berarti "tidak berlaku
   * bagi apa pun" — akan membuat tarif umum tidak pernah terpilih.
   */
  if (baris.serviceClass && baris.serviceClass !== kunci.serviceClass) return false;
  if (baris.casemixGroup && baris.casemixGroup !== kunci.casemixGroup) return false;
  if (baris.casemixSeverity && baris.casemixSeverity !== kunci.casemixSeverity) return false;
  return true;
}

/** Seberapa khusus satu baris tarif. Yang lebih khusus menang. */
function kekhususan(baris: BarisTarif): number {
  return (
    (baris.serviceClass ? 1 : 0) +
    (baris.casemixGroup ? 2 : 0) +
    (baris.casemixSeverity ? 4 : 0)
  );
}

/**
 * Memilih tarif yang berlaku bagi satu kunci.
 *
 * Yang paling khusus menang. Bila dua baris sama khususnya dan sama-sama
 * berlaku, jawabannya **ambigu** — bukan salah satunya. Memilih yang pertama
 * berarti membiarkan urutan baris menentukan tagihan pasien.
 */
export function pilihTarif(
  daftar: BarisTarif[],
  kunci: KunciTarif,
): {
  found: boolean;
  tariff?: BarisTarif;
  ambiguous?: BarisTarif[];
  message: string;
} {
  const berlaku = daftar.filter(
    (b) => cocokKunci(b, kunci) && dalamMasaBerlaku(b, kunci.serviceDate),
  );

  if (!berlaku.length) {
    return {
      found: false,
      message:
        `Tarif untuk kunci ini belum tersedia (${kunci.paymentMethod}, wilayah ` +
        `${kunci.regionCode}, kelas ${kunci.facilityClass}, tanggal layanan ` +
        `${kunci.serviceDate}). Perhitungan dihentikan — menaksirnya akan menghasilkan angka ` +
        'yang tampak resmi lalu dipakai menagih orang.',
    };
  }

  const tertinggi = Math.max(...berlaku.map(kekhususan));
  const terpilih = berlaku.filter((b) => kekhususan(b) === tertinggi);

  if (terpilih.length > 1) {
    return {
      found: false,
      ambiguous: terpilih,
      message:
        `${terpilih.length} tarif sama-sama berlaku dan sama khususnya bagi kunci ini. ` +
        'Perhitungan dihentikan: memilih salah satunya berarti membiarkan urutan baris ' +
        'menentukan tagihan pasien. Tutup salah satunya dengan tanggal berakhir.',
    };
  }

  return {
    found: true,
    tariff: terpilih[0],
    message: `Tarif ${terpilih[0].amount} berlaku sejak ${terpilih[0].effectiveFrom}.`,
  };
}

/**
 * Memeriksa tumpang tindih tanggal sebelum satu baris tarif disimpan.
 *
 * Dilakukan sebelum penyimpanan, bukan sesudahnya. Basis data menegakkannya
 * pula lewat constraint pengecualian; yang di sini hanya memberi pesan yang
 * dapat dikerjakan.
 */
export function periksaTumpangTindih(input: {
  baru: Omit<BarisTarif, 'id' | 'versionId'>;
  existing: BarisTarif[];
}): { allowed: boolean; message?: string; conflicts?: BarisTarif[] } {
  const mulaiBaru = Date.parse(input.baru.effectiveFrom);
  const selesaiBaru = input.baru.effectiveTo
    ? Date.parse(input.baru.effectiveTo)
    : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(mulaiBaru)) {
    return { allowed: false, message: 'Tanggal mulai berlaku tidak sah.' };
  }
  if (selesaiBaru < mulaiBaru) {
    return {
      allowed: false,
      message: 'Tanggal berakhir mendahului tanggal mulai berlaku.',
    };
  }

  const sama = input.existing.filter(
    (b) =>
      b.paymentMethod === input.baru.paymentMethod &&
      b.regionCode === input.baru.regionCode &&
      b.facilityClass === input.baru.facilityClass &&
      (b.serviceClass ?? null) === (input.baru.serviceClass ?? null) &&
      (b.casemixGroup ?? null) === (input.baru.casemixGroup ?? null) &&
      (b.casemixSeverity ?? null) === (input.baru.casemixSeverity ?? null),
  );

  const bentrok = sama.filter((b) => {
    const mulai = Date.parse(b.effectiveFrom);
    const selesai = b.effectiveTo ? Date.parse(b.effectiveTo) : Number.POSITIVE_INFINITY;
    return mulai <= selesaiBaru && selesai >= mulaiBaru;
  });

  if (bentrok.length) {
    return {
      allowed: false,
      conflicts: bentrok,
      message:
        `${bentrok.length} tarif sudah berlaku pada rentang yang sama untuk kunci yang sama. ` +
        'Dua versi yang berlaku bersamaan membuat pemilihan tarif tidak dapat ditentukan, dan ' +
        'yang tidak dapat ditentukan akan ditentukan urutan baris. Tutup versi lama dengan ' +
        'tanggal berakhir lebih dahulu.',
    };
  }

  return { allowed: true };
}

// --- Versi tarif dan aktivasinya ---------------------------------------------

export interface VersiTarif {
  id: string;
  code: string;
  regulationReference?: string | null;
  sourceFile?: string | null;
  sourceHash?: string | null;
  importedBy?: string | null;
  approvedBy?: string | null;
  rowCount: number;
}

/**
 * Boleh atau tidaknya satu versi tarif diaktifkan.
 *
 * Tiga syarat, dan ketiganya berasal dari kekeliruan yang sudah pernah terjadi
 * di tempat lain: tarif yang tidak dapat ditelusuri ke terbitannya, tarif yang
 * diaktifkan oleh orang yang mengimpornya sendiri, dan versi kosong yang
 * diaktifkan lalu membuat seluruh perhitungan berhenti.
 */
export function bolehAktifkanVersi(input: {
  versi: VersiTarif;
  approverId: string;
}): { allowed: boolean; message?: string } {
  if (!input.versi.regulationReference?.trim()) {
    return {
      allowed: false,
      message:
        'Versi tarif wajib menyebut peraturan yang menjadi dasarnya. Nomor peraturan yang ' +
        'keliru akan disalin ke dokumen klaim, dan dokumen klaim yang menyebut peraturan yang ' +
        'tidak berlaku akan dikembalikan.',
    };
  }

  if (!input.versi.sourceFile?.trim() || !input.versi.sourceHash?.trim()) {
    return {
      allowed: false,
      message:
        'Versi tarif wajib menyimpan berkas sumber beserta sidik jarinya. Tarif yang tidak ' +
        'dapat ditelusuri ke terbitan resminya tidak dapat dibedakan dari tarif yang diketik ' +
        'dari ingatan.',
    };
  }

  if (input.versi.rowCount < 1) {
    return {
      allowed: false,
      message:
        'Versi tarif ini kosong. Mengaktifkannya akan menghentikan seluruh perhitungan tarif ' +
        'tanpa ada yang tahu sebabnya.',
    };
  }

  if (input.versi.importedBy && input.versi.importedBy === input.approverId) {
    return {
      allowed: false,
      message:
        'Yang mengimpor tarif tidak menyetujuinya sendiri. Impor dan aktivasi adalah dua ' +
        'langkah; menyatukannya berarti satu orang dapat mengubah seluruh tagihan rumah sakit ' +
        'tanpa ada pihak kedua yang pernah melihatnya.',
    };
  }

  return { allowed: true };
}

// --- Cakupan penjamin --------------------------------------------------------

export type JenisPenjamin = 'BPJS' | 'INSURER' | 'CORPORATE' | 'SELF_PAY' | 'GOVERNMENT_PROGRAM';

export interface CakupanPenjamin {
  payerType: JenisPenjamin;
  /** Persentase yang ditanggung, 0–100. */
  coveragePercent: number;
  /** Batas atas nilai yang ditanggung. Null berarti tanpa batas. */
  ceilingAmount?: number | null;
  /** Bagian yang selalu ditanggung pasien lebih dahulu. */
  deductibleAmount?: number | null;
  requiresReferral: boolean;
  requiresPreAuthorization: boolean;
}

/**
 * Menghitung bagian penjamin dan bagian pasien.
 *
 * **Pembulatannya memihak pasien.** Bagian penjamin dibulatkan ke atas,
 * sehingga sisa satu rupiah menjadi tanggungan penjamin, bukan pasien. Selisih
 * satu rupiah tidak berarti bagi penjamin; bagi loket pendaftaran ia berarti
 * uang kembalian yang tidak ada.
 *
 * Tidak menyimpulkan apa pun tentang keabsahan rujukan — itu keputusan
 * penjamin, bukan keputusan kami.
 */
export function hitungTanggungan(input: {
  totalAmount: number;
  coverage: CakupanPenjamin;
  hasValidReferral?: boolean;
  hasPreAuthorization?: boolean;
}): {
  payerAmount: number;
  patientAmount: number;
  blocked: boolean;
  reasons: string[];
  message: string;
} {
  if (input.totalAmount < 0) throw new Error('Nilai tagihan tidak boleh negatif.');

  const c = input.coverage;
  if (c.coveragePercent < 0 || c.coveragePercent > 100) {
    throw new Error('Persentase tanggungan harus antara 0 dan 100.');
  }

  const alasan: string[] = [];
  if (c.requiresReferral && !input.hasValidReferral) {
    alasan.push('Penjamin ini menuntut rujukan, dan rujukannya belum ada.');
  }
  if (c.requiresPreAuthorization && !input.hasPreAuthorization) {
    alasan.push('Penjamin ini menuntut persetujuan awal, dan persetujuannya belum ada.');
  }

  if (alasan.length) {
    /*
     * Seluruh tagihan menjadi tanggungan pasien SEMENTARA — bukan selamanya.
     * Perbedaannya penting: yang pertama dapat diperbaiki dengan melengkapi
     * rujukan, yang kedua sudah dianggap keputusan akhir.
     */
    return {
      payerAmount: 0,
      patientAmount: input.totalAmount,
      blocked: true,
      reasons: alasan,
      message:
        `${alasan.join(' ')} Sementara ini seluruh tagihan menjadi tanggungan pasien; ` +
        'lengkapi berkasnya, lalu hitung ulang.',
    };
  }

  const potongan = Math.min(c.deductibleAmount ?? 0, input.totalAmount);
  const dasar = input.totalAmount - potongan;

  let penjamin = Math.ceil((dasar * c.coveragePercent) / 100);
  if (c.ceilingAmount != null) penjamin = Math.min(penjamin, c.ceilingAmount);
  penjamin = Math.min(penjamin, dasar);

  const pasien = input.totalAmount - penjamin;

  return {
    payerAmount: penjamin,
    patientAmount: pasien,
    blocked: false,
    reasons: [],
    message:
      `Penjamin menanggung ${penjamin}, pasien menanggung ${pasien}` +
      (potongan > 0 ? ` (termasuk potongan awal ${potongan})` : '') +
      (c.ceilingAmount != null && penjamin === c.ceilingAmount
        ? '. Batas atas tanggungan tercapai.'
        : '.'),
  };
}
