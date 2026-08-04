/**
 * Validasi aturan diskon sebelum disimpan.
 *
 * ## Mengapa terpisah dan murni
 *
 * Aturan diskon disunting pengguna tenant, dan yang tersimpan salah tidak
 * menghasilkan galat: ia hanya menjadi harga yang lebih murah pada setiap
 * transaksi sampai seseorang menyadarinya dari laporan — atau tidak menyadarinya
 * sama sekali.
 *
 * Sebagian aturan di bawah juga dijaga `CHECK` pada tabel. Itu disengaja: basis
 * data adalah pertahanan terakhir yang tidak dapat dilewati jalur mana pun,
 * sedangkan berkas ini yang memberi tahu penyuntingnya **apa** yang salah dan
 * **mengapa**. Galat basis data yang bocor ke layar tidak dapat dibaca kasir.
 */

/** Bentuk masukan yang divalidasi. Sengaja longgar: ia datang dari HTTP. */
export interface MasukanAturanDiskon {
  code?: unknown;
  name?: unknown;
  description?: unknown;
  benefitType?: unknown;
  benefitValue?: unknown;
  maxDiscountAmount?: unknown;
  minimumPurchase?: unknown;
  minimumQuantity?: unknown;
  scopeType?: unknown;
  scopeId?: unknown;
  validFrom?: unknown;
  validUntil?: unknown;
  validDays?: unknown;
  validTimeFrom?: unknown;
  validTimeTo?: unknown;
  usageLimit?: unknown;
  requiresApproval?: unknown;
  priority?: unknown;
  isActive?: unknown;
  targets?: unknown;
}

export interface TargetAturan {
  productId: string | null;
  productCategoryId: string | null;
  isExclusion: boolean;
}

export interface AturanDiskonBersih {
  code: string;
  name: string;
  description: string | null;
  benefitType: 'PERCENT' | 'AMOUNT';
  benefitValue: number;
  maxDiscountAmount: number | null;
  minimumPurchase: number | null;
  minimumQuantity: number | null;
  scopeType: 'TENANT' | 'OUTLET' | 'BRAND';
  scopeId: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  validDays: number[] | null;
  validTimeFrom: string | null;
  validTimeTo: string | null;
  usageLimit: number | null;
  requiresApproval: boolean;
  priority: number;
  isActive: boolean;
  targets: TargetAturan[];
}

export interface HasilValidasi {
  /** Kosong bila sah. */
  galat: string[];
  bersih: AturanDiskonBersih | null;
}

const POLA_KODE = /^[A-Z0-9][A-Z0-9_-]{1,47}$/;
const POLA_JAM = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function angka(nilai: unknown): number | null {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  const n = typeof nilai === 'number' ? nilai : Number(nilai);
  return Number.isFinite(n) ? n : NaN;
}

function tanggal(nilai: unknown): Date | null | undefined {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  const d = new Date(String(nilai));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function validasiAturanDiskon(masuk: MasukanAturanDiskon): HasilValidasi {
  const galat: string[] = [];

  const code = typeof masuk.code === 'string' ? masuk.code.trim().toUpperCase() : '';
  if (!POLA_KODE.test(code)) {
    galat.push('Kode aturan wajib diisi, 2–48 karakter, hanya huruf kapital, angka, - dan _.');
  }

  const name = typeof masuk.name === 'string' ? masuk.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 3 || name.length > 160) {
    galat.push('Nama aturan wajib diisi, 3–160 karakter.');
  }

  const benefitType = masuk.benefitType === 'AMOUNT' ? 'AMOUNT' : 'PERCENT';
  if (masuk.benefitType !== 'AMOUNT' && masuk.benefitType !== 'PERCENT') {
    galat.push('Jenis potongan harus PERCENT atau AMOUNT.');
  }

  const benefitValue = angka(masuk.benefitValue);
  if (benefitValue === null || Number.isNaN(benefitValue) || benefitValue < 0) {
    galat.push('Nilai potongan wajib diisi dan tidak boleh negatif.');
  } else if (benefitType === 'PERCENT' && benefitValue > 100) {
    /*
     * Diskon di atas seratus persen berarti menyerahkan uang kepada pembeli.
     * Dijaga juga oleh CHECK pada tabel; di sini supaya penyuntingnya membaca
     * kalimat yang dapat dimengerti, bukan galat basis data.
     */
    galat.push('Diskon persen tidak boleh melebihi 100% — itu berarti menyerahkan uang kepada pembeli.');
  } else if (benefitType === 'PERCENT' && benefitValue === 0) {
    galat.push('Diskon 0% tidak memotong apa pun. Nonaktifkan aturannya bila memang belum dipakai.');
  }

  const maxDiscountAmount = angka(masuk.maxDiscountAmount);
  if (maxDiscountAmount !== null && (Number.isNaN(maxDiscountAmount) || maxDiscountAmount < 0)) {
    galat.push('Batas potongan tidak boleh negatif.');
  }
  if (maxDiscountAmount !== null && !Number.isNaN(maxDiscountAmount) && benefitType === 'AMOUNT') {
    // Bukan sekadar mubazir: dua angka yang menyatakan hal yang sama akan
    // berselisih cepat atau lambat, dan yang menang bukan yang diharapkan.
    galat.push('Batas potongan hanya berlaku untuk diskon persen, bukan nominal tetap.');
  }

  const minimumPurchase = angka(masuk.minimumPurchase);
  if (minimumPurchase !== null && (Number.isNaN(minimumPurchase) || minimumPurchase < 0)) {
    galat.push('Minimum pembelian tidak boleh negatif.');
  }

  const minimumQuantity = angka(masuk.minimumQuantity);
  if (minimumQuantity !== null && (Number.isNaN(minimumQuantity) || minimumQuantity < 0)) {
    galat.push('Minimum jumlah tidak boleh negatif.');
  }

  const scopeType =
    masuk.scopeType === 'OUTLET' || masuk.scopeType === 'BRAND' ? masuk.scopeType : 'TENANT';
  if (
    masuk.scopeType !== undefined &&
    !['TENANT', 'OUTLET', 'BRAND'].includes(String(masuk.scopeType))
  ) {
    galat.push('Lingkup harus TENANT, OUTLET, atau BRAND.');
  }

  const scopeIdMentah = typeof masuk.scopeId === 'string' ? masuk.scopeId.trim() : null;
  let scopeId: string | null = null;
  if (scopeType === 'TENANT') {
    // Dikosongkan, bukan ditolak: lingkup tenant memang berlaku di mana pun, dan
    // id yang tertinggal akan membingungkan siapa pun yang membaca barisnya.
    scopeId = null;
  } else if (!scopeIdMentah || !POLA_UUID.test(scopeIdMentah)) {
    /*
     * Lingkup outlet atau brand TANPA id tidak akan pernah cocok dengan apa pun
     * — aturannya tersimpan, tampak aktif pada daftar, dan tidak pernah berlaku
     * sekali pun. Tidak ada galat yang muncul; yang muncul hanya pertanyaan
     * "kenapa promosinya tidak jalan".
     */
    galat.push('Lingkup outlet atau brand wajib menyebut outlet atau brand yang dituju.');
  } else {
    scopeId = scopeIdMentah;
  }

  const validFrom = tanggal(masuk.validFrom);
  const validUntil = tanggal(masuk.validUntil);
  if (validFrom === undefined) galat.push('Tanggal mulai tidak dapat dibaca.');
  if (validUntil === undefined) galat.push('Tanggal selesai tidak dapat dibaca.');
  if (validFrom && validUntil && validFrom.getTime() > validUntil.getTime()) {
    galat.push('Tanggal selesai mendahului tanggal mulai.');
  }

  let validDays: number[] | null = null;
  if (masuk.validDays !== null && masuk.validDays !== undefined) {
    if (!Array.isArray(masuk.validDays)) {
      galat.push('Hari berlaku harus berupa daftar angka 1–7.');
    } else if (masuk.validDays.length > 0) {
      const hari = masuk.validDays.map((h) => Number(h));
      if (hari.some((h) => !Number.isInteger(h) || h < 1 || h > 7)) {
        galat.push('Hari berlaku harus 1 (Senin) sampai 7 (Minggu).');
      } else {
        validDays = [...new Set(hari)].sort((a, b) => a - b);
      }
    }
  }

  const jam = (nilai: unknown, label: string): string | null => {
    if (nilai === null || nilai === undefined || nilai === '') return null;
    const t = String(nilai).trim();
    if (!POLA_JAM.test(t)) {
      galat.push(`${label} harus berbentuk HH:MM.`);
      return null;
    }
    return t.length === 5 ? `${t}:00` : t;
  };
  const validTimeFrom = jam(masuk.validTimeFrom, 'Jam mulai');
  const validTimeTo = jam(masuk.validTimeTo, 'Jam selesai');
  if ((validTimeFrom && !validTimeTo) || (!validTimeFrom && validTimeTo)) {
    /*
     * Satu sisi saja memang dapat dijalankan mesinnya, tetapi hampir selalu
     * bukan yang dimaksud: "mulai 17.00" tanpa jam selesai berarti berlaku
     * sampai tengah malam, dan itu perlu ditulis tegas, bukan disimpulkan.
     */
    galat.push('Jam mulai dan jam selesai harus diisi berdua, atau dikosongkan berdua.');
  }

  const usageLimit = angka(masuk.usageLimit);
  if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) {
    galat.push('Kuota pemakaian harus bilangan bulat minimal 1.');
  }

  const priorityMentah = angka(masuk.priority);
  const priority = priorityMentah === null ? 100 : priorityMentah;
  if (Number.isNaN(priority) || !Number.isInteger(priority) || priority < 0) {
    galat.push('Prioritas harus bilangan bulat tidak negatif.');
  }

  const targets: TargetAturan[] = [];
  if (masuk.targets !== null && masuk.targets !== undefined) {
    if (!Array.isArray(masuk.targets)) {
      galat.push('Daftar produk tidak dapat dibaca.');
    } else {
      for (const t of masuk.targets as Record<string, unknown>[]) {
        const productId = typeof t?.productId === 'string' ? t.productId.trim() : null;
        const categoryId =
          typeof t?.productCategoryId === 'string' ? t.productCategoryId.trim() : null;
        const isExclusion = t?.isExclusion === true;

        if ((productId && categoryId) || (!productId && !categoryId)) {
          galat.push('Setiap baris target harus menyebut produk ATAU kategori, tidak keduanya.');
          continue;
        }
        const id = productId ?? categoryId!;
        if (!POLA_UUID.test(id)) {
          galat.push('Id produk atau kategori pada daftar target tidak sah.');
          continue;
        }
        targets.push({ productId, productCategoryId: categoryId, isExclusion });
      }
    }
  }

  /*
   * Aturan yang seluruh targetnya pengecualian tidak berlaku untuk apa pun.
   *
   * Mesinnya memperlakukan "tanpa daftar cakup" sebagai berlaku untuk semua,
   * lalu setiap pengecualian menguranginya — sehingga aturan seperti ini
   * sebenarnya berarti "semua KECUALI ini". Itu mungkin memang dimaksud, tetapi
   * lebih sering salah paham, jadi dinyatakan tegas alih-alih ditebak.
   */
  const adaCakup = targets.some((t) => !t.isExclusion);
  const adaKecuali = targets.some((t) => t.isExclusion);
  if (!adaCakup && adaKecuali) {
    galat.push(
      'Daftar target hanya berisi pengecualian. Bila memang dimaksud "semua produk kecuali ini", ' +
        'kosongkan daftar cakupnya dengan sengaja — bukan dengan hanya mengisi pengecualian.',
    );
  }

  if (galat.length > 0) return { galat, bersih: null };

  return {
    galat: [],
    bersih: {
      code,
      name,
      description:
        typeof masuk.description === 'string' && masuk.description.trim()
          ? masuk.description.trim()
          : null,
      benefitType,
      benefitValue: benefitValue!,
      maxDiscountAmount,
      minimumPurchase,
      minimumQuantity,
      scopeType,
      scopeId,
      validFrom: validFrom ?? null,
      validUntil: validUntil ?? null,
      validDays,
      validTimeFrom,
      validTimeTo,
      usageLimit,
      requiresApproval: masuk.requiresApproval === true,
      priority,
      isActive: masuk.isActive !== false,
      targets,
    },
  };
}
