/**
 * Aturan settlement jasa: simulasi, penguncian, pembayaran, pernyataan, dan
 * pembalikan.
 *
 * Fungsi murni, tanpa basis data. Mesin statusnya ada di `health-fee.ts`; yang
 * di sini adalah apa yang boleh terjadi pada tiap status.
 *
 * Empat hal menentukan bentuk seluruh berkas ini.
 *
 * 1. **Simulasi tidak pernah menjadi utang.** Ia bertanda, dan tandanya tidak
 *    dapat dilepas. Simulasi yang dapat berubah menjadi settlement sungguhan
 *    hanya dengan menekan tombol akan berubah menjadi settlement sungguhan
 *    ketika seseorang salah menekan tombol.
 *
 * 2. **Settlement yang sudah dikunci tidak dihapus.** Kekeliruan diperbaiki
 *    lewat penyesuaian atau pembalikan, yang keduanya meninggalkan barisnya
 *    sendiri. Yang dipegang dokter adalah kertas yang sudah dicetak; menghapus
 *    catatannya membuat kertas itu tidak lagi cocok dengan apa pun.
 *
 * 3. **Pembalikan harus sama besar dan berlawanan arah.** Pembalikan sebagian
 *    yang menyamar sebagai pembalikan penuh akan menyisakan selisih yang tidak
 *    dapat dijelaskan siapa pun — dan selisih itu akan ditemukan setahun
 *    kemudian oleh orang yang tidak tahu apa-apa tentang kejadiannya.
 *
 * 4. **Pernyataan mencatat apa yang BENAR-BENAR dibayarkan**, termasuk
 *    potongan pajaknya. Pernyataan yang hanya menyebut nilai kotor akan
 *    ditanyakan setiap bulan oleh setiap penerimanya.
 */

import type { StatusSettlement } from './health-fee';

// --- Baris settlement --------------------------------------------------------

export interface BarisSettlement {
  recipient: string;
  providerId?: string | null;
  grossAmount: number;
  /** Potongan pajak. Selalu dinyatakan, sekalipun nol. */
  taxAmount: number;
  netAmount: number;
}

/**
 * Memeriksa bahwa baris settlement benar-benar berjumlah sama dengan nilai yang
 * di-settle.
 *
 * Selisih satu rupiah pun dilaporkan. Settlement yang jumlahnya tidak cocok
 * akan tetap dibayarkan — dan selisihnya menjadi milik siapa pun yang kebetulan
 * menemukannya lebih dahulu.
 */
export function periksaJumlahBaris(input: {
  settledAmount: number;
  lines: BarisSettlement[];
}): { valid: boolean; message?: string; difference?: number } {
  if (!input.lines.length) {
    return { valid: false, message: 'Settlement tanpa satu pun baris tidak membayar siapa pun.' };
  }

  for (const [i, l] of input.lines.entries()) {
    if (l.grossAmount < 0 || l.taxAmount < 0 || l.netAmount < 0) {
      return { valid: false, message: `Baris ke-${i + 1} bernilai negatif.` };
    }
    if (l.taxAmount > l.grossAmount) {
      return {
        valid: false,
        message: `Baris ke-${i + 1}: potongan pajak melebihi nilai kotornya.`,
      };
    }
    if (l.netAmount !== l.grossAmount - l.taxAmount) {
      return {
        valid: false,
        message:
          `Baris ke-${i + 1}: nilai bersih tidak sama dengan kotor dikurangi pajak. ` +
          'Nilai bersih dihitung, bukan diketik.',
      };
    }
  }

  const totalKotor = input.lines.reduce((n, l) => n + l.grossAmount, 0);
  const selisih = input.settledAmount - totalKotor;
  if (selisih !== 0) {
    return {
      valid: false,
      difference: selisih,
      message:
        `Jumlah baris ${totalKotor} tidak sama dengan nilai yang di-settle ` +
        `${input.settledAmount}; selisih ${selisih}. Settlement yang jumlahnya tidak cocok ` +
        'akan tetap dibayarkan, dan selisihnya menjadi milik siapa pun yang menemukannya ' +
        'lebih dahulu.',
    };
  }

  return { valid: true };
}

// --- Simulasi ----------------------------------------------------------------

/**
 * Boleh atau tidaknya satu settlement dibayarkan.
 *
 * Simulasi **tidak pernah** dapat dibayarkan, sekalipun statusnya sudah
 * berjalan sampai ujung. Tandanya melekat pada barisnya sejak dibuat.
 */
export function bolehBayar(input: {
  isSimulation: boolean;
  status: StatusSettlement;
}): { allowed: boolean; message?: string } {
  if (input.isSimulation) {
    return {
      allowed: false,
      message:
        'Ini simulasi, dan simulasi tidak pernah dibayarkan. Untuk membayarkannya, hitung ulang ' +
        'sebagai settlement sungguhan — simulasi yang dapat berubah menjadi settlement hanya ' +
        'dengan menekan tombol akan berubah ketika seseorang salah menekan tombol.',
    };
  }
  if (input.status !== 'LOCKED') {
    return {
      allowed: false,
      message: `Pembayaran menuntut settlement berstatus LOCKED, saat ini ${input.status}.`,
    };
  }
  return { allowed: true };
}

// --- Penyesuaian dan pembalikan ----------------------------------------------

export type JenisKoreksi = 'ADJUSTMENT' | 'REVERSAL';

/**
 * Boleh atau tidaknya satu koreksi dibuat atas settlement yang sudah dikunci.
 *
 * Pembalikan wajib **sama besar dan berlawanan arah**. Penyesuaian boleh
 * sebagian, tetapi wajib beralasan dan tidak boleh membuat nilai akhirnya
 * negatif — settlement yang berakhir negatif berarti rumah sakit menagih
 * kembali kepada dokter, dan itu keputusan yang tidak boleh terjadi diam-diam.
 */
export function bolehKoreksi(input: {
  type: JenisKoreksi;
  originalAmount: number;
  /** Jumlah koreksi yang sudah pernah dibuat atas settlement ini. */
  alreadyCorrected: number;
  correctionAmount: number;
  reason: string;
  status: StatusSettlement;
  createdBy?: string | null;
  approverId?: string | null;
}): { allowed: boolean; message?: string; resultingAmount?: number } {
  if (input.status !== 'LOCKED' && input.status !== 'PAID' && input.status !== 'STATED') {
    return {
      allowed: false,
      message:
        `Koreksi hanya berlaku atas settlement yang sudah dikunci; saat ini ${input.status}. ` +
        'Yang belum dikunci masih dapat dihitung ulang.',
    };
  }

  if (input.reason.trim().length < 10) {
    return {
      allowed: false,
      message:
        'Koreksi wajib menyebutkan sebabnya. Angka yang berubah tanpa keterangan akan ' +
        'ditanyakan, dan yang ditanya kelak bukan orang yang mengubahnya.',
    };
  }

  if (input.correctionAmount <= 0) {
    return { allowed: false, message: 'Nilai koreksi harus lebih besar daripada nol.' };
  }

  if (input.type === 'REVERSAL') {
    const tersisa = input.originalAmount - input.alreadyCorrected;
    if (input.correctionAmount !== tersisa) {
      return {
        allowed: false,
        message:
          `Pembalikan wajib sama besar dengan yang tersisa (${tersisa}), bukan ` +
          `${input.correctionAmount}. Pembalikan sebagian yang menyamar sebagai pembalikan ` +
          'penuh akan menyisakan selisih yang ditemukan setahun kemudian oleh orang yang ' +
          'tidak tahu apa-apa tentang kejadiannya. Pakai penyesuaian bila memang sebagian.',
      };
    }
    return { allowed: true, resultingAmount: 0 };
  }

  const hasil = input.originalAmount - input.alreadyCorrected - input.correctionAmount;
  if (hasil < 0) {
    return {
      allowed: false,
      message:
        `Penyesuaian ini membuat nilai akhirnya ${hasil}. Settlement yang berakhir negatif ` +
        'berarti rumah sakit menagih kembali kepada dokter, dan itu keputusan yang tidak boleh ' +
        'terjadi sebagai akibat sampingan sebuah penyesuaian.',
    };
  }

  return { allowed: true, resultingAmount: hasil };
}

/**
 * Boleh atau tidaknya koreksi disetujui.
 *
 * Yang membuat koreksi tidak menyetujuinya sendiri. Alasannya sama seperti pada
 * settlement: koreksi adalah tempat paling mudah untuk memindahkan uang tanpa
 * ada yang melihat, sebab ia terlihat seperti pembetulan.
 */
export function bolehSetujuiKoreksi(input: {
  createdBy?: string | null;
  approverId: string;
}): { allowed: boolean; message?: string } {
  if (input.createdBy && input.createdBy === input.approverId) {
    return {
      allowed: false,
      message:
        'Yang membuat koreksi tidak menyetujuinya sendiri. Koreksi adalah tempat paling mudah ' +
        'untuk memindahkan uang tanpa ada yang melihat, sebab ia terlihat seperti pembetulan.',
    };
  }
  return { allowed: true };
}

// --- Pernyataan --------------------------------------------------------------

export interface RingkasanPernyataan {
  providerId: string;
  grossAmount: number;
  taxAmount: number;
  netAmount: number;
  settlementCount: number;
  adjustmentAmount: number;
}

/**
 * Menyusun pernyataan bagi satu penerima.
 *
 * Mencatat nilai kotor, potongan pajak, koreksi, dan nilai bersihnya —
 * keempatnya. Pernyataan yang hanya menyebut nilai bersih akan ditanyakan
 * setiap bulan; pernyataan yang hanya menyebut nilai kotor akan membuat
 * penerimanya mengira ia dibayar kurang.
 */
export function susunPernyataan(input: {
  providerId: string;
  settlements: Array<{
    grossAmount: number;
    taxAmount: number;
    netAmount: number;
    isSimulation: boolean;
    status: StatusSettlement;
  }>;
  corrections?: Array<{ amount: number }>;
}): { statement: RingkasanPernyataan; excluded: number; message: string } {
  /*
   * Simulasi dan yang belum dibayarkan TIDAK masuk pernyataan. Pernyataan yang
   * memuat angka yang belum tentu dibayarkan akan dibaca sebagai janji.
   */
  const masuk = input.settlements.filter(
    (s) => !s.isSimulation && (s.status === 'PAID' || s.status === 'STATED'),
  );
  const dikecualikan = input.settlements.length - masuk.length;

  const kotor = masuk.reduce((n, s) => n + s.grossAmount, 0);
  const pajak = masuk.reduce((n, s) => n + s.taxAmount, 0);
  const koreksi = (input.corrections ?? []).reduce((n, c) => n + c.amount, 0);
  const bersih = masuk.reduce((n, s) => n + s.netAmount, 0) - koreksi;

  return {
    statement: {
      providerId: input.providerId,
      grossAmount: kotor,
      taxAmount: pajak,
      netAmount: bersih,
      settlementCount: masuk.length,
      adjustmentAmount: koreksi,
    },
    excluded: dikecualikan,
    message:
      dikecualikan > 0
        ? `${dikecualikan} settlement tidak dimasukkan karena simulasi atau belum dibayarkan. ` +
          'Pernyataan yang memuat angka yang belum tentu dibayarkan akan dibaca sebagai janji.'
        : 'Seluruh settlement yang sudah dibayarkan termasuk di dalamnya.',
  };
}

/**
 * Boleh atau tidaknya satu pernyataan diterbitkan.
 *
 * Pernyataan yang sudah diterbitkan **tidak dapat diterbitkan ulang** dengan
 * angka berbeda. Bila angkanya berubah, terbitkan pernyataan koreksi yang
 * menunjuk pernyataan lamanya — dan yang dipegang penerimanya adalah dua kertas,
 * bukan satu kertas yang diam-diam berganti isi.
 */
export function bolehTerbitkanPernyataan(input: {
  alreadyIssued: boolean;
  previousNetAmount?: number | null;
  netAmount: number;
  isCorrection: boolean;
  correctsStatementId?: string | null;
}): { allowed: boolean; message?: string } {
  if (input.netAmount < 0) {
    return {
      allowed: false,
      message:
        'Pernyataan bernilai negatif berarti penerimanya berutang kepada rumah sakit. Itu ' +
        'keputusan tersendiri, bukan akibat sampingan penerbitan pernyataan.',
    };
  }

  if (input.alreadyIssued && !input.isCorrection) {
    return {
      allowed: false,
      message:
        `Pernyataan untuk periode ini sudah diterbitkan dengan nilai bersih ` +
        `${input.previousNetAmount ?? 0}. Terbitkan pernyataan KOREKSI yang menunjuk ` +
        'pernyataan lamanya — yang dipegang penerimanya harus dua kertas, bukan satu kertas ' +
        'yang diam-diam berganti isi.',
    };
  }

  if (input.isCorrection && !input.correctsStatementId?.trim()) {
    return {
      allowed: false,
      message: 'Pernyataan koreksi wajib menunjuk pernyataan yang dikoreksinya.',
    };
  }

  return { allowed: true };
}

// --- Pemotongan pajak --------------------------------------------------------

/**
 * Menghitung potongan pajak satu baris.
 *
 * Pembulatannya **memihak penerima**: potongan dibulatkan ke bawah, sehingga
 * sisa satu rupiah tetap menjadi haknya. Selisih itu tidak berarti bagi kas
 * negara — yang menyetorkannya adalah rumah sakit, dan rumah sakit menyetor
 * jumlah yang benar dari kasnya sendiri.
 *
 * Tarif pajaknya datang dari DATA. Berkas ini tidak pernah menetapkannya:
 * tarif pajak berubah lewat peraturan, dan peraturan tidak menunggu penerbitan
 * versi aplikasi.
 */
export function hitungPotonganPajak(input: {
  grossAmount: number;
  taxRatePercent: number;
}): { taxAmount: number; netAmount: number; message: string } {
  if (input.grossAmount < 0) throw new Error('Nilai kotor tidak boleh negatif.');
  if (input.taxRatePercent < 0 || input.taxRatePercent > 100) {
    throw new Error('Tarif pajak harus antara 0 dan 100.');
  }

  const pajak = Math.floor((input.grossAmount * input.taxRatePercent) / 100);
  return {
    taxAmount: pajak,
    netAmount: input.grossAmount - pajak,
    message:
      input.taxRatePercent === 0
        ? 'Tidak ada potongan pajak pada baris ini.'
        : `Potongan ${input.taxRatePercent}% sebesar ${pajak}, dibulatkan ke bawah demi penerima.`,
  };
}
