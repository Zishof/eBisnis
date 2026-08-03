/**
 * Aturan master data layanan dan pemetaannya ke unit.
 *
 * Fungsi murni, tanpa basis data.
 *
 * Tiga hal menentukan bentuk seluruh berkas ini.
 *
 * 1. **Layanan tidak dapat diaktifkan sebelum pemetaannya lengkap.** Satu
 *    layanan yang tidak terpetakan tampak tidak berbahaya sampai ia dipesan.
 *    Lalu pesanannya tidak sampai ke unit mana pun, tidak ada peran yang
 *    berwenang mengerjakannya, tarifnya tidak ditemukan, jasanya tidak
 *    terhitung, dan pendapatannya tidak masuk akun mana pun — kelimanya baru
 *    ketahuan pada akhir bulan.
 *
 * 2. **"Bila berlaku" ditentukan sifat layanannya, bukan pilihan pengguna.**
 *    Pemeriksaan laboratorium selalu menuntut spesimen. Menandainya "tidak
 *    berlaku" adalah jalan memutar yang akan selalu diambil ketika tenggat
 *    mendesak, dan akibatnya baru terasa berbulan-bulan kemudian.
 *
 * 3. **Harga sintetis tidak dapat menyamar sebagai harga resmi.** Data contoh
 *    dibuat supaya penyewa baru dapat melihat sistemnya bekerja tanpa mengetik
 *    dua ribu baris. Bila harga contoh tidak dibedakan dari harga resmi,
 *    seseorang akan memakainya menagih pasien — dan ketika ketahuan, tidak ada
 *    cara membedakan mana yang contoh dan mana yang sungguhan.
 */

// --- Sumber master data ------------------------------------------------------

export type SumberMasterData =
  | 'OFFICIAL_REFERENCE'
  | 'FACILITY_IMPORT'
  | 'SYNTHETIC_DEMO'
  | 'LOCAL_MAPPING';

/** Penerbit rujukan resmi yang diakui. */
export type PenerbitResmi = 'KFA' | 'BPOM' | 'LKPP' | 'BPJS' | 'KEMENKES' | 'WHO';

/**
 * Boleh atau tidaknya satu baris master data mengaku bersumber resmi.
 *
 * Yang dijaga di sini bukan kerapian, melainkan satu kekeliruan yang mahal:
 * harga sintetis yang tampak resmi. Penandanya melekat pada barisnya dan tidak
 * dapat dilepas — sebab yang melepasnya kelak bukan orang yang membuatnya.
 */
export function bolehMengakuResmi(input: {
  source: SumberMasterData;
  issuer?: PenerbitResmi | null;
  /** Nomor atau tanggal terbitan yang dapat ditelusuri. */
  issuerReference?: string | null;
}): { allowed: boolean; message?: string } {
  if (input.source !== 'OFFICIAL_REFERENCE') {
    if (input.issuer) {
      return {
        allowed: false,
        message:
          `Baris bersumber ${input.source} tidak dapat menyebut penerbit resmi ` +
          `${input.issuer}. Harga dan kode contoh yang tampak resmi akan dipakai menagih ` +
          'pasien, dan setelah itu tidak ada cara membedakannya dari yang sungguhan.',
      };
    }
    return { allowed: true };
  }

  if (!input.issuer) {
    return {
      allowed: false,
      message: 'Rujukan resmi wajib menyebut penerbitnya.',
    };
  }
  if (!input.issuerReference?.trim()) {
    return {
      allowed: false,
      message:
        `Rujukan ${input.issuer} wajib menyebut nomor atau tanggal terbitannya. Rujukan ` +
        'yang tidak dapat ditelusuri ke terbitannya tidak dapat dibedakan dari karangan.',
    };
  }
  return { allowed: true };
}

/**
 * Boleh atau tidaknya satu kumpulan data contoh dihapus.
 *
 * Penghapusan menolak bila ada data nyata yang merujuknya, **menyebutkan apa
 * yang merujuknya**, dan menyerahkan keputusannya kepada manusia. Obat contoh
 * yang terlanjur diresepkan kepada pasien sungguhan tidak dapat dihapus tanpa
 * meninggalkan resep yang menunjuk kekosongan.
 */
export function bolehHapusDataContoh(input: {
  batchId: string;
  /** Rujukan dari data NYATA — data contoh yang merujuk data contoh tidak menahan. */
  references: Array<{ entity: string; count: number }>;
}): { allowed: boolean; message?: string; blockedBy?: Array<{ entity: string; count: number }> } {
  const menahan = input.references.filter((r) => r.count > 0);
  if (!menahan.length) return { allowed: true };

  const rincian = menahan.map((r) => `${r.count} ${r.entity}`).join(', ');
  return {
    allowed: false,
    blockedBy: menahan,
    message:
      `Data contoh ini sudah dipakai data nyata: ${rincian}. Menghapusnya akan meninggalkan ` +
      'baris yang menunjuk kekosongan. Putuskan sendiri apa yang harus dilakukan terhadap ' +
      'masing-masing — jangan dihapus diam-diam.',
  };
}

// --- Layanan dan sifatnya ----------------------------------------------------

export type CareSetting =
  | 'OUTPATIENT'
  | 'INPATIENT'
  | 'EMERGENCY'
  | 'OPERATING_THEATRE'
  | 'ICU'
  | 'NICU'
  | 'PICU'
  | 'DELIVERY_ROOM'
  | 'LABORATORY'
  | 'RADIOLOGY'
  | 'PHARMACY'
  | 'NUTRITION'
  | 'REHABILITATION'
  | 'DENTAL'
  | 'DIALYSIS'
  | 'ONCOLOGY'
  | 'HOMECARE'
  | 'PUSKESMAS'
  | 'POSYANDU';

export type JenisLayanan =
  | 'CONSULTATION'
  | 'PROCEDURE'
  | 'LABORATORY'
  | 'RADIOLOGY'
  | 'SURGERY'
  | 'ANAESTHESIA'
  | 'MIDWIFERY'
  | 'NURSING'
  | 'EMERGENCY'
  | 'REHABILITATION'
  | 'DENTAL'
  | 'NUTRITION'
  | 'DIALYSIS'
  | 'ONCOLOGY'
  | 'ROOM'
  | 'AMBULANCE'
  | 'OTHER';

export interface Layanan {
  code: string;
  name: string;
  serviceType: JenisLayanan;
  careSetting: CareSetting;
  /** Memakai persediaan — reagen, BMHP, obat. Menentukan wajib tidaknya akun HPP. */
  usesInventory: boolean;
  /** Jasanya dibagi kepada pemberi layanan. Menentukan wajib tidaknya aturan jasa. */
  hasFeeSharing: boolean;
}

/**
 * Sifat yang ditentukan JENIS layanannya, bukan pilihan pengguna.
 *
 * Dipisahkan sebagai fungsi supaya tidak ada tempat kedua yang memutuskannya.
 * Aturan yang disalin ke dua tempat akan berselisih, dan yang berselisih selalu
 * diselesaikan dengan memilih yang lebih longgar.
 */
export function sifatLayanan(jenis: JenisLayanan): {
  requiresSpecimen: boolean;
  requiresEquipment: boolean;
  requiresVerification: boolean;
} {
  switch (jenis) {
    case 'LABORATORY':
      // Selalu. Pemeriksaan laboratorium tanpa spesimen adalah tagihan tanpa
      // pemeriksaan.
      return { requiresSpecimen: true, requiresEquipment: true, requiresVerification: true };
    case 'RADIOLOGY':
      return { requiresSpecimen: false, requiresEquipment: true, requiresVerification: true };
    case 'SURGERY':
    case 'ANAESTHESIA':
      return { requiresSpecimen: false, requiresEquipment: true, requiresVerification: false };
    case 'DIALYSIS':
      return { requiresSpecimen: false, requiresEquipment: true, requiresVerification: false };
    default:
      return { requiresSpecimen: false, requiresEquipment: false, requiresVerification: false };
  }
}

// --- Pemetaan ----------------------------------------------------------------

export interface PemetaanLayanan {
  departmentId?: string | null;
  serviceUnitId?: string | null;
  locationId?: string | null;
  performerRole?: string | null;
  verifierRole?: string | null;
  equipmentId?: string | null;
  specimenTypeId?: string | null;
  clinicalOrderType?: string | null;
  clinicalFormId?: string | null;
  tariffId?: string | null;
  payerCoverageId?: string | null;
  feeRuleId?: string | null;
  revenueAccountId?: string | null;
  cogsAccountId?: string | null;
}

export type SlotPemetaan = keyof PemetaanLayanan;

export interface KekuranganPemetaan {
  slot: SlotPemetaan;
  message: string;
  /** Menahan aktivasi. Yang tidak menahan tetap dilaporkan. */
  blocksActivation: boolean;
  /** Fase yang akan membangunnya, bila belum ada di sistem. */
  awaitingPhase?: string;
}

/** Slot yang tabelnya belum dibangun; menahan aktivasi, tetapi jujur sebabnya. */
const MENUNGGU_FASE: Partial<Record<SlotPemetaan, string>> = {
  equipmentId: 'H-9H',
  tariffId: 'H-9D',
  payerCoverageId: 'H-9D',
  feeRuleId: 'H-9E',
  revenueAccountId: 'H-9N',
  cogsAccountId: 'H-9N',
};

/**
 * Memeriksa kelengkapan pemetaan satu layanan.
 *
 * Melaporkan yang kurang **satu per satu**, bukan "pemetaan belum lengkap".
 * Pesan yang hanya berkata belum lengkap memaksa penggunanya menebak, dan yang
 * menebak akan mengisi seadanya.
 */
export function periksaPemetaan(
  layanan: Layanan,
  pemetaan: PemetaanLayanan,
): { complete: boolean; missing: KekuranganPemetaan[]; blockingCount: number } {
  const sifat = sifatLayanan(layanan.serviceType);
  const kurang: KekuranganPemetaan[] = [];

  const wajib = (slot: SlotPemetaan, pesan: string) => {
    if (!pemetaan[slot]) {
      kurang.push({
        slot,
        message: pesan,
        blocksActivation: true,
        ...(MENUNGGU_FASE[slot] ? { awaitingPhase: MENUNGGU_FASE[slot] } : {}),
      });
    }
  };

  wajib('departmentId', 'Departemen belum ditetapkan.');
  wajib('serviceUnitId', 'Unit layanan belum ditetapkan; pesanannya tidak akan sampai ke mana pun.');
  wajib('performerRole', 'Peran pemberi layanan belum ditetapkan.');

  if (sifat.requiresVerification) {
    /*
     * Yang paling sering terlupa. Tanpa peran verifikator, hasilnya menumpuk
     * tanpa ada yang berwenang melepasnya — dan yang menunggu hasil itu pasien.
     */
    wajib('verifierRole', 'Peran verifikator belum ditetapkan; hasilnya akan menumpuk tanpa ada yang berwenang melepasnya.');
  }
  if (sifat.requiresSpecimen) {
    wajib('specimenTypeId', 'Jenis spesimen belum ditetapkan.');
  }
  if (sifat.requiresEquipment) {
    wajib('equipmentId', 'Peralatan belum ditetapkan.');
  }

  wajib('tariffId', 'Tarif berlaku belum ditetapkan.');
  wajib('revenueAccountId', 'Akun pendapatan belum ditetapkan; pendapatannya akan menggantung.');

  if (layanan.usesInventory) {
    /*
     * Layanan yang hanya memetakan pendapatannya akan menampilkan margin
     * seratus persen — dan margin seratus persen tidak pernah dipertanyakan
     * siapa pun sampai kasnya tidak cocok.
     */
    wajib('cogsAccountId', 'Akun harga pokok belum ditetapkan; marginnya akan tampak seratus persen.');
  }
  if (layanan.hasFeeSharing) {
    wajib('feeRuleId', 'Aturan pembagian jasa belum ditetapkan.');
  }

  // Dilaporkan, tetapi tidak menahan.
  if (!pemetaan.locationId) {
    kurang.push({
      slot: 'locationId',
      message: 'Lokasi belum ditetapkan.',
      blocksActivation: false,
    });
  }
  if (!pemetaan.clinicalOrderType) {
    kurang.push({
      slot: 'clinicalOrderType',
      message: 'Jenis pesanan klinis belum ditetapkan.',
      blocksActivation: false,
    });
  }

  return {
    complete: kurang.length === 0,
    missing: kurang,
    blockingCount: kurang.filter((k) => k.blocksActivation).length,
  };
}

/**
 * Boleh atau tidaknya satu layanan diaktifkan.
 *
 * Slot yang menunggu fase berikutnya disebutkan tersendiri. Menyamarkannya
 * sebagai "belum lengkap" biasa akan membuat penggunanya mencari kolom yang
 * memang belum ada, lalu menyimpulkan sistemnya rusak.
 */
export function bolehAktifkanLayanan(input: {
  kelengkapan: { blockingCount: number; missing: KekuranganPemetaan[] };
}): { allowed: boolean; message?: string; missing?: string[]; awaiting?: string[] } {
  const penahan = input.kelengkapan.missing.filter((m) => m.blocksActivation);
  if (!penahan.length) return { allowed: true };

  const menunggu = penahan.filter((m) => m.awaitingPhase);
  const siap = penahan.filter((m) => !m.awaitingPhase);

  const bagian: string[] = [];
  if (siap.length) bagian.push(siap.map((m) => m.message).join(' '));
  if (menunggu.length) {
    const fase = [...new Set(menunggu.map((m) => m.awaitingPhase as string))].sort();
    bagian.push(
      `Selain itu ${menunggu.length} bagian pemetaan menunggu fase ${fase.join(', ')} — ` +
        'tabelnya memang belum ada, dan tidak ada yang dapat diisi sekarang.',
    );
  }

  return {
    allowed: false,
    missing: penahan.map((m) => m.slot),
    awaiting: [...new Set(menunggu.map((m) => m.awaitingPhase as string))].sort(),
    message: `Layanan belum dapat diaktifkan. ${bagian.join(' ')}`,
  };
}

// --- Pemetaan kode lokal -----------------------------------------------------

/**
 * Boleh atau tidaknya satu kode lokal dipetakan ke kode resmi.
 *
 * Pemetaan satu kode lokal ke dua kode resmi yang berbeda **pada sistem yang
 * sama** dilarang: yang mengirim ke luar akan memilih salah satunya menurut
 * urutan baris, dan urutan baris bukan keputusan klinis.
 */
export function bolehPetakanKodeLokal(input: {
  localCode: string;
  targetSystem: string;
  targetCode: string;
  /** Pemetaan yang sudah ada untuk kode lokal ini. */
  existing: Array<{ targetSystem: string; targetCode: string; retiredAt?: string | null }>;
}): { allowed: boolean; message?: string } {
  if (!input.localCode.trim() || !input.targetCode.trim()) {
    return { allowed: false, message: 'Kode lokal dan kode tujuan harus diisi.' };
  }

  const bentrok = input.existing.find(
    (e) => !e.retiredAt && e.targetSystem === input.targetSystem && e.targetCode !== input.targetCode,
  );
  if (bentrok) {
    return {
      allowed: false,
      message:
        `Kode lokal ${input.localCode} sudah dipetakan ke ${bentrok.targetSystem} ` +
        `${bentrok.targetCode}. Satu kode lokal tidak dapat menunjuk dua kode resmi pada ` +
        'sistem yang sama — pensiunkan pemetaan lama lebih dahulu supaya jejaknya tetap ada.',
    };
  }
  return { allowed: true };
}

// --- Pembangkitan data contoh ------------------------------------------------

/**
 * Bilangan semu yang **deterministik** dari benih dan urutan.
 *
 * Benih yang sama menghasilkan data yang sama. Tanpa itu, dua penyewa demo akan
 * melihat katalog yang berbeda dan salah satunya akan menyimpulkan sistemnya
 * rusak — lalu melaporkan kerusakan yang tidak dapat ditirukan siapa pun.
 *
 * Bukan pembangkit acak kriptografis, dan tidak boleh dipakai untuk apa pun yang
 * menuntut kerahasiaan.
 */
export function bilanganDeterministik(seed: string, index: number): number {
  let h = 2166136261 >>> 0;
  const teks = `${seed}#${index}`;
  for (let i = 0; i < teks.length; i += 1) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // Satu putaran pencampuran akhir supaya urutan yang berdekatan tidak
  // menghasilkan nilai yang berdekatan pula.
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/** Memilih satu anggota daftar secara deterministik. */
export function pilihDeterministik<T>(daftar: readonly T[], seed: string, index: number): T {
  if (!daftar.length) throw new Error('Daftar pilihan kosong.');
  return daftar[bilanganDeterministik(seed, index) % daftar.length];
}

/**
 * Harga contoh yang deterministik, dan **selalu bertanda sintetis**.
 *
 * Dibulatkan ke ratusan rupiah supaya tampak masuk akal di layar tanpa pernah
 * menyaru sebagai tarif resmi.
 */
export function hargaContoh(input: {
  seed: string;
  index: number;
  min: number;
  max: number;
}): { amount: number; source: SumberMasterData; disclaimer: string } {
  if (!(input.max > input.min)) {
    throw new Error('Batas atas harga contoh harus lebih besar daripada batas bawahnya.');
  }
  const rentang = input.max - input.min;
  const kasar = input.min + (bilanganDeterministik(input.seed, input.index) % (rentang + 1));
  return {
    amount: Math.round(kasar / 100) * 100,
    source: 'SYNTHETIC_DEMO',
    disclaimer:
      'Harga contoh. BUKAN tarif resmi BPJS, KFA, BPOM, maupun LKPP, dan tidak boleh dipakai ' +
      'menagih pasien.',
  };
}
