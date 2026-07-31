/**
 * Aturan unit usaha koperasi dan penghubungnya ke POS — fungsi murni.
 *
 * Satu keputusan menentukan bentuk berkas ini:
 *
 *   **Unit usaha koperasi TIDAK memiliki POS sendiri.**
 *
 * Ia tertaut ke `outlet` dan `pos_terminal` milik Core lewat satu tabel
 * penghubung. Membangun POS kedua akan menyelesaikan kebutuhan koperasi dalam
 * sehari dan menimbulkan masalah yang tidak selesai bertahun-tahun: persediaan
 * terbelah menjadi dua angka yang tidak pernah cocok, pembukuan terbelah
 * menjadi dua jalur jurnal, dan cacat yang dibetulkan pada POS Core tetap ada
 * pada POS koperasi sampai seseorang ingat menyalinnya.
 */

// -------------------------------------------------------------- Jenis unit

export const UNIT_BUSINESS_TYPES = [
  'RETAIL_STORE',
  'CANTEEN',
  'SAVINGS_LOAN',
  'SERVICE',
  'PRODUCTION',
  'AGRICULTURE',
  'RENTAL',
  'OTHER',
] as const;
export type UnitBusinessType = (typeof UNIT_BUSINESS_TYPES)[number];

/** Jenis unit yang menjual barang lewat kasir, sehingga perlu tautan POS. */
export const UNIT_BERKASIR: UnitBusinessType[] = ['RETAIL_STORE', 'CANTEEN'];

export function perluTautanPos(type: UnitBusinessType): boolean {
  return UNIT_BERKASIR.includes(type);
}

export interface Verdict {
  allowed: boolean;
  message?: string;
}

/**
 * Bolehkah unit usaha ini ditautkan ke sebuah outlet?
 *
 * Satu outlet hanya boleh dimiliki satu unit usaha. Dua unit yang mengaku
 * memiliki outlet yang sama akan menghitung patronage penjualan yang sama dua
 * kali — dan SHU dibagikan atas angka itu.
 */
export function bolehTautkanOutlet(input: {
  unitType: UnitBusinessType;
  outletAlreadyLinkedToUnitId: string | null;
  thisUnitId: string;
}): Verdict {
  if (!perluTautanPos(input.unitType)) {
    return {
      allowed: false,
      message: `Unit usaha berjenis ${input.unitType} tidak menjual lewat kasir, sehingga tidak memerlukan tautan outlet.`,
    };
  }
  if (
    input.outletAlreadyLinkedToUnitId &&
    input.outletAlreadyLinkedToUnitId !== input.thisUnitId
  ) {
    return {
      allowed: false,
      message:
        'Outlet ini sudah dimiliki unit usaha lain. Satu outlet hanya boleh dimiliki satu unit usaha, sebab dua pemilik akan menghitung patronage penjualan yang sama dua kali.',
    };
  }
  return { allowed: true };
}

// ------------------------------------------------------------- Patronage

export interface PenjualanUnit {
  saleId: string;
  outletId: string;
  customerId: string | null;
  businessDate: string;
  grandTotal: string;
  status: string;
}

export interface PetaAnggota {
  /** `customer_id` POS → `member_id` koperasi. */
  customerToMember: Map<string, string>;
}

export interface RingkasanPatronage {
  perMember: Map<string, number>;
  /** Penjualan yang tidak dapat ditautkan ke anggota mana pun. */
  unattributedAmount: number;
  unattributedCount: number;
  totalSalesAmount: number;
  countedSaleIds: string[];
}

/**
 * Status penjualan yang ikut dihitung sebagai patronage.
 *
 * Hanya penjualan yang **selesai**. Yang masih draf belum tentu terjadi; yang
 * dibatalkan tidak terjadi; yang diretur sebagian sudah berkurang nilainya dan
 * ditangani lewat pengurangan tersendiri.
 */
export const STATUS_DIHITUNG = ['COMPLETED', 'RETURNED_PARTIAL'];

/**
 * Menjumlahkan patronage anggota dari penjualan unit usaha.
 *
 * Penjualan yang tidak dapat ditautkan ke anggota **dilaporkan**, bukan
 * dibuang diam-diam. Angkanya berguna: unit toko yang sebagian besar
 * penjualannya tidak teratribusi berarti kartu anggotanya jarang dipakai, dan
 * itu keadaan yang perlu diketahui pengurus sebelum SHU dihitung — bukan
 * sesudahnya.
 */
export function ringkasPatronage(
  penjualan: PenjualanUnit[],
  peta: PetaAnggota,
): RingkasanPatronage {
  const perMember = new Map<string, number>();
  const countedSaleIds: string[] = [];
  let unattributedAmount = 0;
  let unattributedCount = 0;
  let totalSalesAmount = 0;

  for (const p of penjualan) {
    if (!STATUS_DIHITUNG.includes(p.status)) continue;

    const nilai = Math.round(Number(p.grandTotal));
    if (!Number.isFinite(nilai) || nilai <= 0) continue;

    totalSalesAmount += nilai;
    countedSaleIds.push(p.saleId);

    const memberId = p.customerId ? peta.customerToMember.get(p.customerId) : undefined;
    if (!memberId) {
      unattributedAmount += nilai;
      unattributedCount += 1;
      continue;
    }
    perMember.set(memberId, (perMember.get(memberId) ?? 0) + nilai);
  }

  return { perMember, unattributedAmount, unattributedCount, totalSalesAmount, countedSaleIds };
}

/** Bagian penjualan yang berhasil ditautkan ke anggota. */
export function rasioTerAtribusi(r: RingkasanPatronage): number {
  if (r.totalSalesAmount <= 0) return 0;
  return (r.totalSalesAmount - r.unattributedAmount) / r.totalSalesAmount;
}

// ----------------------------------------------------- Hasil usaha per unit

export interface HasilUnit {
  unitBusinessId: string;
  revenue: number;
  cogs: number;
  operatingExpense: number;
  allocatedOverhead: number;
}

export interface LabaUnit {
  unitBusinessId: string;
  grossProfit: number;
  operatingProfit: number;
  netProfit: number;
  grossMarginRatio: number;
}

/**
 * Laba rugi per unit usaha.
 *
 * Beban umum koperasi dialokasikan ke unit sebagai `allocatedOverhead`.
 * Tanpanya, unit tampak jauh lebih untung daripada sebenarnya — dan pengurus
 * mengambil keputusan membuka unit baru berdasarkan angka yang belum menanggung
 * bagiannya atas gaji, listrik, dan sewa kantor koperasi.
 */
export function hitungLabaUnit(h: HasilUnit): LabaUnit {
  const grossProfit = h.revenue - h.cogs;
  const operatingProfit = grossProfit - h.operatingExpense;
  const netProfit = operatingProfit - h.allocatedOverhead;
  return {
    unitBusinessId: h.unitBusinessId,
    grossProfit,
    operatingProfit,
    netProfit,
    grossMarginRatio: h.revenue > 0 ? grossProfit / h.revenue : 0,
  };
}

/**
 * Membagi beban umum ke unit menurut dasarnya.
 *
 * Memakai metode sisa terbesar yang sama dengan pembagian SHU, sehingga jumlah
 * beban yang dialokasikan persis sama dengan beban yang ada — bukan kurang
 * beberapa rupiah yang kemudian menggantung tanpa pemilik.
 */
export function alokasikanOverhead(
  totalOverhead: number,
  dasar: Array<{ unitBusinessId: string; basis: number }>,
): Map<string, number> {
  const hasil = new Map<string, number>();
  const total = Math.round(totalOverhead);
  const jumlah = dasar.reduce((n, d) => n + Math.max(0, d.basis), 0);

  if (total <= 0 || jumlah <= 0) {
    for (const d of dasar) hasil.set(d.unitBusinessId, 0);
    return hasil;
  }

  const antara = dasar.map((d) => {
    const tepat = (total * Math.max(0, d.basis)) / jumlah;
    const bawah = Math.floor(tepat);
    return { unitBusinessId: d.unitBusinessId, bawah, pecahan: tepat - bawah };
  });

  let terpakai = 0;
  for (const a of antara) {
    hasil.set(a.unitBusinessId, a.bawah);
    terpakai += a.bawah;
  }

  let sisa = total - terpakai;
  const urut = [...antara].sort(
    (a, b) => b.pecahan - a.pecahan || a.unitBusinessId.localeCompare(b.unitBusinessId),
  );
  let i = 0;
  while (sisa > 0 && urut.length > 0) {
    const u = urut[i % urut.length];
    hasil.set(u.unitBusinessId, (hasil.get(u.unitBusinessId) ?? 0) + 1);
    sisa -= 1;
    i += 1;
  }

  return hasil;
}

// ------------------------------------------------------- Harga khusus anggota

/**
 * Bolehkah kategori anggota ini ditautkan ke kelompok pelanggan?
 *
 * Tautan inilah yang membuat harga khusus anggota berjalan **lewat mekanisme
 * POS yang sudah ada** — tanpa satu baris pun perubahan pada POS. Kasir
 * memindai kartu anggota, POS mengenali pelanggannya, dan buku harga
 * berlingkup kelompok itu berlaku.
 */
export function bolehTautkanKelompokPelanggan(input: {
  customerGroupId: string;
  groupAlreadyLinkedToCategoryId: string | null;
  thisCategoryId: string;
}): Verdict {
  if (
    input.groupAlreadyLinkedToCategoryId &&
    input.groupAlreadyLinkedToCategoryId !== input.thisCategoryId
  ) {
    return {
      allowed: false,
      message:
        'Kelompok pelanggan ini sudah ditautkan ke kategori anggota lain. Satu kelompok pelanggan hanya boleh mewakili satu kategori, sebab harga yang berlaku ditentukan kelompoknya.',
    };
  }
  return { allowed: true };
}

// -------------------------------------------------- Batas kewenangan adapter

/**
 * Tabel POS yang **tidak boleh** ditulis dari kode koperasi.
 *
 * Dinyatakan sebagai data, bukan sekadar sebagai aturan pada dokumen, supaya
 * pengujian dapat memeriksanya. Penjualan di unit toko sudah menghasilkan
 * jurnal lewat mesin POS; koperasi yang menulis ke sana akan menggandakan
 * pendapatan dan membelah persediaan.
 */
export const TABEL_POS_TERLARANG = [
  'pos_sale',
  'pos_sale_line',
  'pos_payment',
  'pos_shift',
  'pos_terminal',
  'pos_sale_receipt',
  'stock_balance',
  'stock_movement',
  'stock_reservation',
];

/**
 * Peristiwa akuntansi yang **tidak boleh** diterbitkan koperasi.
 *
 * Penjualan di unit toko sudah dijurnal mesin POS lewat `POS_SALE`. Koperasi
 * hanya menjurnal hal yang tidak diketahui POS — pemotongan saldo simpanan,
 * misalnya, yang bagi POS tampak seperti pembayaran biasa. Menjurnal ulang
 * penjualannya akan mencatat pendapatan dua kali.
 */
export const PERISTIWA_POS_TERLARANG = [
  'POS_SALE',
  'POS_COGS',
  'POS_INVENTORY_RELEASE',
  'POS_CASH_RECEIPT',
  'POS_TAX_OUTPUT',
];

export function bolehMenerbitkanPeristiwa(eventCode: string): Verdict {
  if (PERISTIWA_POS_TERLARANG.includes(eventCode)) {
    return {
      allowed: false,
      message: `Peristiwa ${eventCode} diterbitkan mesin POS, bukan koperasi. Menerbitkannya dari sini akan mencatat pendapatan dua kali.`,
    };
  }
  if (!eventCode.startsWith('COOPERATIVE_')) {
    return {
      allowed: false,
      message: `Modul koperasi hanya boleh menerbitkan peristiwa berawalan COOPERATIVE_, bukan ${eventCode}.`,
    };
  }
  return { allowed: true };
}
