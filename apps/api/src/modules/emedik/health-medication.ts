/**
 * Aturan keselamatan obat — fungsi murni, tanpa basis data.
 *
 * Bagian yang paling mungkin melukai orang ada di berkas ini. Karena itu
 * seluruhnya dapat diuji tanpa basis data, tanpa jaringan, dan tanpa
 * keberuntungan.
 *
 * Satu pertimbangan berjalan di sepanjang berkas: **peringatan yang terlalu
 * sering muncul akan diabaikan.** Sistem yang memperingatkan segalanya sama
 * tidak amannya dengan sistem yang tidak memperingatkan apa pun — bedanya,
 * yang pertama merasa aman. Karena itu tingkat peringatan dibedakan tegas, dan
 * hanya yang benar-benar berbahaya yang MEMBLOKIR.
 */

export type TingkatPeringatan = 'INFO' | 'WARNING' | 'CRITICAL' | 'BLOCKING';

export interface Peringatan {
  type:
    | 'ALLERGY'
    | 'DRUG_INTERACTION'
    | 'DUPLICATE_THERAPY'
    | 'DOSE_RANGE'
    | 'EXPIRED'
    | 'CONTROLLED'
    | 'LASA'
    | 'HIGH_ALERT';
  severity: TingkatPeringatan;
  message: string;
  /** Benar bila peringatan ini tidak dapat dilewati sama sekali. */
  blocking: boolean;
  detail?: Record<string, unknown>;
}

export interface Obat {
  id: string;
  code: string;
  genericName: string;
  /** Nama dagang. Ditampilkan, tetapi TIDAK pernah dipakai mencocokkan alergi. */
  brandName?: string | null;
  activeIngredient: string;
  drugClass: string;
  isControlled: boolean;
  isHighAlert: boolean;
  isLasa: boolean;
  minSingleDose?: number | null;
  maxSingleDose?: number | null;
  maxDailyDose?: number | null;
  doseUnit?: string | null;
}

export interface AlergiPasien {
  allergenName: string;
  allergenType: string;
  severity: string;
  certainty: string;
}

export interface Interaksi {
  ingredientA: string;
  ingredientB: string;
  severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CONTRAINDICATED';
  description: string;
  management?: string | null;
}

// --- Pencocokan zat ----------------------------------------------------------

/** Menormalkan nama zat untuk pembandingan. */
export function normalkanZat(nama: string): string {
  return nama
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Apakah obat ini mengandung zat yang dialergikan pasien?
 *
 * Pencocokan dilakukan pada ZAT AKTIF, bukan nama dagang. Pasien yang alergi
 * amoksisilin alergi terhadap seluruh merek yang mengandungnya, dan mencocokkan
 * nama dagang akan melewatkan hampir semuanya.
 *
 * Pencocokan sengaja longgar — awalan yang sama sudah dianggap cocok. Golongan
 * obat sering berbagi awalan nama (amoksisilin, amoksisilin-klavulanat), dan
 * pada alergi, **kelebihan peringatan jauh lebih murah daripada kekurangan.**
 */
export function cocokAlergi(zatObat: string, alergen: string): boolean {
  const a = normalkanZat(zatObat);
  const b = normalkanZat(alergen);
  if (!a || !b) return false;
  if (a === b) return true;
  // Salah satu memuat yang lain, dengan panjang minimum supaya "al" tidak
  // mencocoki segalanya.
  if (a.length >= 5 && b.includes(a)) return true;
  if (b.length >= 5 && a.includes(b)) return true;
  return false;
}

/**
 * Memeriksa alergi.
 *
 * Alergi berat dan fatal **memblokir**, apa pun keadaannya. Tidak ada alasan
 * klinis yang cukup kuat untuk melewati riwayat anafilaksis lewat satu klik;
 * bila memang harus diberikan, itu keputusan yang dibuat di luar sistem oleh
 * orang yang menuliskan pertimbangannya.
 */
export function periksaAlergi(obat: Obat, alergi: AlergiPasien[]): Peringatan[] {
  const hasil: Peringatan[] = [];

  for (const a of alergi) {
    if (a.allergenType !== 'DRUG') continue;
    if (!cocokAlergi(obat.activeIngredient, a.allergenName)) continue;

    const berat = a.severity === 'SEVERE' || a.severity === 'FATAL';
    hasil.push({
      type: 'ALLERGY',
      severity: berat ? 'BLOCKING' : 'CRITICAL',
      blocking: berat,
      message: berat
        ? `Pasien memiliki riwayat alergi ${a.severity === 'FATAL' ? 'FATAL' : 'BERAT'} terhadap ` +
          `${a.allergenName}. ${obat.genericName} mengandung ${obat.activeIngredient}. ` +
          `Obat ini TIDAK BOLEH diberikan.`
        : `Pasien pernah dilaporkan alergi terhadap ${a.allergenName}, dan ${obat.genericName} ` +
          `mengandung ${obat.activeIngredient}.`,
      detail: { allergen: a.allergenName, severity: a.severity, certainty: a.certainty },
    });
  }

  return hasil;
}

/** Memeriksa interaksi terhadap obat lain yang sedang dipakai pasien. */
export function periksaInteraksi(
  obat: Obat,
  zatLain: string[],
  katalog: Interaksi[],
): Peringatan[] {
  const hasil: Peringatan[] = [];
  const zat = normalkanZat(obat.activeIngredient);

  for (const lain of zatLain) {
    const b = normalkanZat(lain);
    if (!b || b === zat) continue;

    const cocok = katalog.find((i) => {
      const x = normalkanZat(i.ingredientA);
      const y = normalkanZat(i.ingredientB);
      return (x === zat && y === b) || (x === b && y === zat);
    });
    if (!cocok) continue;

    const kontra = cocok.severity === 'CONTRAINDICATED';
    hasil.push({
      type: 'DRUG_INTERACTION',
      severity: kontra ? 'BLOCKING' : cocok.severity === 'MAJOR' ? 'CRITICAL' : 'WARNING',
      blocking: kontra,
      message:
        `${obat.genericName} berinteraksi dengan ${lain} (${cocok.severity}). ${cocok.description}` +
        (cocok.management ? ` Penanganan: ${cocok.management}` : ''),
      detail: { with: lain, severity: cocok.severity },
    });
  }

  return hasil;
}

/**
 * Memeriksa kewajaran dosis.
 *
 * Hanya memeriksa bila batasnya diketahui. Obat tanpa batas tercatat **tidak
 * diperiksa** — memeriksa dengan angka yang dikarang menghasilkan peringatan
 * palsu, dan peringatan palsu adalah cara tercepat membuat orang berhenti
 * membaca peringatan.
 */
export function periksaDosis(
  obat: Obat,
  dosis: { value: number; unit: string; perDay?: number | null },
): Peringatan[] {
  const hasil: Peringatan[] = [];

  if (!Number.isFinite(dosis.value) || dosis.value <= 0) {
    return [
      {
        type: 'DOSE_RANGE',
        severity: 'BLOCKING',
        blocking: true,
        message: 'Dosis harus lebih besar dari nol.',
      },
    ];
  }

  // Satuan yang berbeda tidak dapat dibandingkan. Membandingkannya begitu saja
  // akan menghasilkan peringatan yang salah pada kedua arah — mg terhadap gram
  // akan tampak seribu kali terlalu besar.
  const satuanCocok =
    obat.doseUnit && dosis.unit && normalkanZat(obat.doseUnit) === normalkanZat(dosis.unit);

  if (!satuanCocok) return hasil;

  if (obat.maxSingleDose != null && dosis.value > obat.maxSingleDose) {
    const berapaKali = dosis.value / obat.maxSingleDose;
    hasil.push({
      type: 'DOSE_RANGE',
      severity: berapaKali >= 2 ? 'BLOCKING' : 'CRITICAL',
      // Dua kali lipat batas atas hampir selalu salah ketik — koma yang
      // tergeser, atau satuan yang tertukar.
      blocking: berapaKali >= 2,
      message:
        `Dosis ${dosis.value} ${dosis.unit} melebihi batas sekali pakai ` +
        `${obat.maxSingleDose} ${obat.doseUnit} untuk ${obat.genericName}` +
        (berapaKali >= 2 ? ` — ${berapaKali.toFixed(1)}× batas atas. Periksa kembali ketikannya.` : '.'),
      detail: { max: obat.maxSingleDose, given: dosis.value, ratio: berapaKali },
    });
  }

  if (obat.minSingleDose != null && dosis.value < obat.minSingleDose) {
    hasil.push({
      type: 'DOSE_RANGE',
      severity: 'WARNING',
      blocking: false,
      message:
        `Dosis ${dosis.value} ${dosis.unit} di bawah batas lazim ` +
        `${obat.minSingleDose} ${obat.doseUnit}. Pastikan memang disengaja.`,
    });
  }

  if (obat.maxDailyDose != null && dosis.perDay) {
    const harian = dosis.value * dosis.perDay;
    if (harian > obat.maxDailyDose) {
      hasil.push({
        type: 'DOSE_RANGE',
        severity: 'CRITICAL',
        blocking: false,
        message:
          `Total harian ${harian} ${dosis.unit} melebihi batas ${obat.maxDailyDose} ` +
          `${obat.doseUnit} untuk ${obat.genericName}.`,
        detail: { dailyTotal: harian, maxDaily: obat.maxDailyDose },
      });
    }
  }

  return hasil;
}

/** Terapi ganda: dua obat dengan zat aktif yang sama pada satu resep. */
export function periksaTerapiGanda(obat: Obat, zatLainDiResep: string[]): Peringatan[] {
  const zat = normalkanZat(obat.activeIngredient);
  const ganda = zatLainDiResep.some((z) => normalkanZat(z) === zat);
  if (!ganda) return [];
  return [
    {
      type: 'DUPLICATE_THERAPY',
      severity: 'CRITICAL',
      blocking: false,
      message:
        `Resep ini sudah memuat obat lain dengan zat aktif ${obat.activeIngredient}. ` +
        `Pemberian bersamaan dapat menggandakan dosisnya tanpa disadari.`,
    },
  ];
}

/** Penandaan obat yang menuntut kehati-hatian tambahan. */
export function periksaPenandaan(obat: Obat): Peringatan[] {
  const hasil: Peringatan[] = [];

  if (obat.isHighAlert) {
    hasil.push({
      type: 'HIGH_ALERT',
      severity: 'WARNING',
      blocking: false,
      message: `${obat.genericName} tergolong obat berisiko tinggi; pemeriksaan ganda diwajibkan.`,
    });
  }

  if (obat.isLasa) {
    hasil.push({
      type: 'LASA',
      severity: 'WARNING',
      blocking: false,
      message:
        `${obat.genericName} termasuk obat yang namanya mirip obat lain (LASA). ` +
        `Pastikan yang dipilih memang yang dimaksud.`,
    });
  }

  if (obat.isControlled) {
    hasil.push({
      type: 'CONTROLLED',
      severity: 'INFO',
      blocking: false,
      message: `${obat.genericName} tergolong ${obat.drugClass === 'NARCOTIC' ? 'narkotika' : 'psikotropika'}; pencatatan ganda berlaku.`,
    });
  }

  return hasil;
}

/**
 * Seluruh pemeriksaan sekaligus.
 *
 * Diurutkan dari yang paling berbahaya, supaya yang pertama terbaca adalah
 * yang paling penting — bukan yang kebetulan diperiksa lebih dulu.
 */
export function periksaResep(input: {
  obat: Obat;
  alergiPasien: AlergiPasien[];
  zatLainDipakai: string[];
  zatLainDiResep: string[];
  katalogInteraksi: Interaksi[];
  dosis: { value: number; unit: string; perDay?: number | null };
}): { alerts: Peringatan[]; blocked: boolean } {
  const alerts = [
    ...periksaAlergi(input.obat, input.alergiPasien),
    ...periksaDosis(input.obat, input.dosis),
    ...periksaInteraksi(input.obat, input.zatLainDipakai, input.katalogInteraksi),
    ...periksaTerapiGanda(input.obat, input.zatLainDiResep),
    ...periksaPenandaan(input.obat),
  ];

  const urutan: Record<TingkatPeringatan, number> = {
    BLOCKING: 0,
    CRITICAL: 1,
    WARNING: 2,
    INFO: 3,
  };
  alerts.sort((a, b) => urutan[a.severity] - urutan[b.severity]);

  return { alerts, blocked: alerts.some((a) => a.blocking) };
}

// --- Penyerahan --------------------------------------------------------------

export interface VerdictSerah {
  allowed: boolean;
  message?: string;
  requiresDoubleCheck: boolean;
}

/**
 * Bolehkah obat ini diserahkan?
 *
 * Kedaluwarsa **menghentikan** penyerahan. Inilah aturan yang tidak dimiliki
 * mesin persediaan umum, dan inilah sebabnya farmasi tidak boleh menulis
 * langsung ke sana.
 */
export function bolehSerahkan(input: {
  obat: Obat;
  expiryDate: string | null;
  today: string;
  quantityRequested: number;
  quantityRemaining: number;
  prescriptionStatus: string;
  reviewed: boolean;
}): VerdictSerah {
  const perluGanda = input.obat.isControlled || input.obat.isHighAlert;

  if (input.prescriptionStatus === 'CANCELLED' || input.prescriptionStatus === 'REJECTED') {
    return {
      allowed: false,
      message: `Resep berstatus ${input.prescriptionStatus} tidak dapat dilayani.`,
      requiresDoubleCheck: perluGanda,
    };
  }

  /*
   * Obat terkendali menuntut telaah apoteker sebelum diserahkan. Untuk obat
   * biasa, telaah dianjurkan tetapi tidak menahan — menahan seluruhnya akan
   * menghentikan apotek kecil yang apotekernya merangkap penyerah.
   */
  if (input.obat.isControlled && !input.reviewed) {
    return {
      allowed: false,
      message:
        `${input.obat.genericName} tergolong terkendali dan wajib ditelaah apoteker sebelum ` +
        `diserahkan.`,
      requiresDoubleCheck: true,
    };
  }

  if (input.expiryDate && input.expiryDate <= input.today) {
    return {
      allowed: false,
      message:
        `Sediaan ini kedaluwarsa pada ${input.expiryDate} dan tidak boleh diserahkan. ` +
        `Pilih batch lain.`,
      requiresDoubleCheck: perluGanda,
    };
  }

  if (input.quantityRequested <= 0) {
    return { allowed: false, message: 'Jumlah harus lebih besar dari nol.', requiresDoubleCheck: perluGanda };
  }

  if (input.quantityRequested > input.quantityRemaining) {
    return {
      allowed: false,
      message:
        `Jumlah ${input.quantityRequested} melebihi sisa resep ${input.quantityRemaining}. ` +
        `Serahkan paling banyak sisa yang ada.`,
      requiresDoubleCheck: perluGanda,
    };
  }

  return { allowed: true, requiresDoubleCheck: perluGanda };
}

// --- Enam benar --------------------------------------------------------------

export interface EnamBenar {
  patient: boolean;
  medication: boolean;
  dose: boolean;
  route: boolean;
  time: boolean;
  documentation: boolean;
}

export interface HasilEnamBenar {
  ok: boolean;
  failed: Array<keyof EnamBenar>;
  message?: string;
}

/** Berapa lama sebelum/sesudah jadwal masih dianggap tepat waktu. */
export const TOLERANSI_WAKTU_MENIT = 60;

/**
 * Memeriksa enam benar sebelum obat diberikan.
 *
 * Nama Indonesianya: benar pasien, benar obat, benar dosis, benar rute, benar
 * waktu, benar dokumentasi. Kelima yang pertama diperiksa terhadap resepnya;
 * yang keenam adalah keberadaan catatan pemberiannya sendiri.
 */
export function periksaEnamBenar(input: {
  scanPatientId: string | null;
  prescriptionPatientId: string;
  scanDrugId: string | null;
  prescriptionDrugId: string;
  doseValue: number;
  prescriptionDose: number;
  route: string;
  prescriptionRoute: string;
  scheduledAt: string | null;
  administeredAt: string;
  administeredBy: string | null;
}): HasilEnamBenar {
  const failed: Array<keyof EnamBenar> = [];

  /*
   * Identitas pasien TIDAK boleh dianggap benar hanya karena layar sedang
   * menampilkannya. Bila tidak ada pemindaian, itu kegagalan "benar pasien" —
   * bukan hal yang dilewati diam-diam. Memberi obat kepada orang yang salah
   * adalah kekeliruan yang paling sering terjadi dan paling mudah dicegah.
   */
  if (!input.scanPatientId || input.scanPatientId !== input.prescriptionPatientId) {
    failed.push('patient');
  }
  if (!input.scanDrugId || input.scanDrugId !== input.prescriptionDrugId) {
    failed.push('medication');
  }
  if (input.doseValue !== input.prescriptionDose) {
    failed.push('dose');
  }
  if (normalkanZat(input.route) !== normalkanZat(input.prescriptionRoute)) {
    failed.push('route');
  }

  if (input.scheduledAt) {
    const selisih =
      Math.abs(new Date(input.administeredAt).getTime() - new Date(input.scheduledAt).getTime()) /
      60_000;
    if (!Number.isFinite(selisih) || selisih > TOLERANSI_WAKTU_MENIT) failed.push('time');
  }

  if (!input.administeredBy) failed.push('documentation');

  const label: Record<keyof EnamBenar, string> = {
    patient: 'benar pasien',
    medication: 'benar obat',
    dose: 'benar dosis',
    route: 'benar rute',
    time: 'benar waktu',
    documentation: 'benar dokumentasi',
  };

  return {
    ok: failed.length === 0,
    failed,
    message: failed.length
      ? `Pemeriksaan enam benar gagal pada: ${failed.map((f) => label[f]).join(', ')}.`
      : undefined,
  };
}

/**
 * Bolehkah obat ini dianggap terlewat, dan seberapa penting.
 *
 * Obat yang dilewati tanpa alasan tidak dapat dibedakan dari obat yang lupa
 * diberikan — dan keduanya menuntut tindak lanjut yang sama sekali berbeda.
 */
export function bolehLewati(alasan: string | null): { allowed: boolean; message?: string } {
  if (!alasan || !alasan.trim()) {
    return {
      allowed: false,
      message:
        'Obat yang tidak diberikan wajib menyebutkan sebabnya. Tanpa itu, ia tidak dapat ' +
        'dibedakan dari obat yang lupa diberikan.',
    };
  }
  return { allowed: true };
}
