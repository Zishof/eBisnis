/**
 * Aturan pemenuhan pesanan.
 *
 * Ditulis sebagai fungsi murni tanpa akses basis data, mengikuti pola gerbang
 * publikasi V9-4 dan pemeriksaan checkout V9-6. Aturan yang sama dipakai UI
 * untuk memberi tahu petugas gudang apa yang kurang **sebelum** ia menekan
 * tombol — bukan setelahnya.
 */

export type FulfillmentStatus =
  | 'NEW'
  | 'ALLOCATED'
  | 'PICKING'
  | 'PICKED'
  | 'PACKING'
  | 'PACKED'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'ON_HOLD';

/**
 * Perpindahan yang diizinkan.
 *
 * Sama seperti pesanan, ditulis sebagai tabel agar "barang yang sudah dikirim
 * tidak dapat kembali menjadi belum diambil" dapat dipastikan dengan membaca
 * satu berkas.
 */
const TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  NEW: ['ALLOCATED', 'ON_HOLD', 'CANCELLED'],
  ALLOCATED: ['PICKING', 'ON_HOLD', 'CANCELLED'],
  PICKING: ['PICKED', 'ON_HOLD', 'CANCELLED'],
  PICKED: ['PACKING', 'ON_HOLD', 'CANCELLED'],
  PACKING: ['PACKED', 'ON_HOLD', 'CANCELLED'],
  PACKED: ['READY_TO_SHIP', 'ON_HOLD', 'CANCELLED'],
  READY_TO_SHIP: ['SHIPPED', 'ON_HOLD', 'CANCELLED'],
  // Setelah diserahkan ke ekspedisi, pembatalan bukan lagi urusan gudang.
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  // Penahanan dapat dilepas kembali ke awal; ke mana persisnya ditentukan
  // pemanggil karena bergantung pada sejauh mana pekerjaan sudah berjalan.
  ON_HOLD: ['ALLOCATED', 'PICKING', 'PACKING', 'READY_TO_SHIP', 'CANCELLED'],
};

export interface RuleCheck {
  ok: boolean;
  reason?: string;
}

export function canAdvance(from: FulfillmentStatus, to: FulfillmentStatus): RuleCheck {
  if (from === to) return { ok: false, reason: `Sudah berstatus ${to}.` };

  const allowed = TRANSITIONS[from];
  if (!allowed) return { ok: false, reason: `Status "${from}" tidak dikenal.` };

  if (!allowed.includes(to)) {
    return {
      ok: false,
      reason: `Dari ${from} tidak dapat menjadi ${to}. Yang mungkin: ${allowed.join(', ') || 'tidak ada'}.`,
    };
  }
  return { ok: true };
}

export function isFulfillmentTerminal(status: FulfillmentStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

export const ALL_FULFILLMENT_STATUSES = Object.keys(TRANSITIONS) as FulfillmentStatus[];

// ---------------------------------------------------------------------------
// Pengambilan
// ---------------------------------------------------------------------------

export interface PickLine {
  lineId: string;
  sku: string;
  orderedQty: number;
  pickedQty: number;
  discrepancyReason?: string | null;
}

export interface PickIssue {
  code: 'SHORT_PICK' | 'OVER_PICK' | 'REASON_REQUIRED' | 'NOTHING_PICKED';
  lineId: string;
  detail: string;
}

/**
 * Memeriksa hasil pengambilan.
 *
 * Kekurangan **diizinkan** tetapi wajib beralasan. Menolaknya akan membuat
 * petugas gudang mencatat angka palsu supaya bisa lanjut, dan angka palsu jauh
 * lebih merusak daripada kekurangan yang jujur.
 *
 * Kelebihan **ditolak**: mengambil lebih banyak daripada yang dipesan berarti
 * barang milik pesanan lain ikut terbawa.
 */
export function validatePick(lines: PickLine[]): { ok: boolean; issues: PickIssue[] } {
  const issues: PickIssue[] = [];

  for (const line of lines) {
    if (line.pickedQty > line.orderedQty) {
      issues.push({
        code: 'OVER_PICK',
        lineId: line.lineId,
        detail: `${line.sku}: diambil ${line.pickedQty} melebihi pesanan ${line.orderedQty}.`,
      });
    }

    if (line.pickedQty < line.orderedQty && !line.discrepancyReason) {
      issues.push({
        code: 'REASON_REQUIRED',
        lineId: line.lineId,
        detail: `${line.sku}: kekurangan ${line.orderedQty - line.pickedQty} harus disertai alasan.`,
      });
    }
  }

  const total = lines.reduce((sum, l) => sum + l.pickedQty, 0);
  if (lines.length > 0 && total === 0) {
    issues.push({
      code: 'NOTHING_PICKED',
      lineId: lines[0].lineId,
      detail: 'Tidak ada satu pun barang yang diambil.',
    });
  }

  return { ok: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Pengemasan
// ---------------------------------------------------------------------------

export interface PackageInput {
  weightGram: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  lines: { lineId: string; quantity: number; pickedQty: number }[];
}

export interface PackIssue {
  code:
    | 'WEIGHT_REQUIRED'
    | 'DIMENSION_REQUIRED'
    | 'EXCEEDS_PICKED'
    | 'EMPTY_PACKAGE'
    | 'DIMENSION_UNREASONABLE';
  detail: string;
}

/** Batas dimensi yang masuk akal untuk satu paket kiriman. */
export const MAX_PACKAGE_DIMENSION_MM = 3000;
export const MAX_PACKAGE_WEIGHT_GRAM = 150_000;

/**
 * Memeriksa paket sebelum disegel.
 *
 * Berat dan dimensi wajib karena ekspedisi menagih berdasarkan yang ditimbang,
 * bukan berdasarkan berat barang yang dijumlahkan. Paket tanpa berat berarti
 * ongkos kirim baru diketahui setelah barang diserahkan.
 */
export function validatePackage(input: PackageInput): { ok: boolean; issues: PackIssue[] } {
  const issues: PackIssue[] = [];

  if (input.lines.length === 0) {
    issues.push({ code: 'EMPTY_PACKAGE', detail: 'Paket tidak berisi apa pun.' });
  }

  if (!input.weightGram || input.weightGram <= 0) {
    issues.push({
      code: 'WEIGHT_REQUIRED',
      detail: 'Berat paket wajib diisi; ekspedisi menagih berdasarkan yang ditimbang.',
    });
  } else if (input.weightGram > MAX_PACKAGE_WEIGHT_GRAM) {
    issues.push({
      code: 'DIMENSION_UNREASONABLE',
      detail: `Berat ${input.weightGram} gram melebihi batas satu paket.`,
    });
  }

  const dims = [
    ['panjang', input.lengthMm],
    ['lebar', input.widthMm],
    ['tinggi', input.heightMm],
  ] as const;
  for (const [name, value] of dims) {
    if (!value || value <= 0) {
      issues.push({ code: 'DIMENSION_REQUIRED', detail: `Dimensi ${name} wajib diisi.` });
    } else if (value > MAX_PACKAGE_DIMENSION_MM) {
      issues.push({
        code: 'DIMENSION_UNREASONABLE',
        detail: `Dimensi ${name} ${value} mm melebihi batas satu paket.`,
      });
    }
  }

  for (const line of input.lines) {
    if (line.quantity > line.pickedQty) {
      issues.push({
        code: 'EXCEEDS_PICKED',
        detail: `Dikemas ${line.quantity} melebihi yang diambil ${line.pickedQty}.`,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Berat yang ditagih ekspedisi.
 *
 * Ekspedisi menagih berdasarkan yang lebih besar antara berat sesungguhnya dan
 * berat volume. Menghitungnya di sini membuat penjual melihat angka yang sama
 * dengan yang akan ditagihkan, bukan terkejut kemudian.
 *
 * Pembagi 6000 adalah kelaziman kurir domestik untuk satuan sentimeter.
 */
export function chargeableWeightGram(
  actualGram: number,
  lengthMm: number,
  widthMm: number,
  heightMm: number,
  divisor = 6000,
): number {
  const volumetricGram =
    ((lengthMm / 10) * (widthMm / 10) * (heightMm / 10) / divisor) * 1000;
  return Math.max(Math.round(actualGram), Math.round(volumetricGram));
}
