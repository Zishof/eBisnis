/**
 * Aturan pembagian jasa profesional.
 *
 * Fungsi murni, tanpa basis data.
 *
 * Lima hal menentukan bentuk seluruh berkas ini.
 *
 * 1. **Persentase TIDAK PERNAH ditanam di kode.** Ia kesepakatan antara rumah
 *    sakit dan tenaga medisnya: berbeda antar fasilitas, berubah, dan kadang
 *    menjadi pokok sengketa. Menanamnya di kode berarti perhitungan jasa bulan
 *    lalu tidak dapat diulang, sebab kodenya sudah berubah. Berkas ini hanya
 *    tahu **cara membagi**, tidak pernah tahu **berapa**.
 *
 * 2. **Jasa BPJS dihitung dari klaim yang DIBAYAR, bukan yang diajukan.**
 *    Diajukan sepuluh juta, disetujui tujuh, dibayar tujuh. Bila jasa dibagi
 *    dari sepuluh, rumah sakit sudah membayarkan uang yang tidak pernah
 *    diterimanya — dan menariknya kembali dari dokter jauh lebih sulit daripada
 *    tidak membayarkannya sejak awal.
 *
 * 3. **Jasa dibayarkan kepada yang benar-benar HADIR.** Tanpa bukti kehadiran,
 *    daftar kontributor menjadi daftar keinginan — dan pada operasi yang
 *    jasanya besar, daftar keinginan cenderung memanjang.
 *
 * 4. **Fee sistem dan fee investor bawaannya NONE.** Aktivasinya menuntut
 *    kontrak, telaah hukum, persetujuan manajemen, perlakuan pajak, tanggal
 *    berlaku, dan batas maksimum — seluruhnya, bukan sebagian.
 *
 * 5. **Settlement yang sudah dikunci tidak dihapus.** Kekeliruan diperbaiki
 *    lewat penyesuaian atau pembalikan, yang keduanya meninggalkan barisnya
 *    sendiri. Yang dipegang dokter adalah kertas yang sudah dicetak.
 */

// --- Dasar perhitungan -------------------------------------------------------

export type DasarPerhitungan =
  | 'GROSS_CHARGE'
  | 'NET_CHARGE'
  | 'NET_COLLECTED'
  | 'VERIFIED_CLAIM'
  | 'PAID_CLAIM'
  | 'FIXED_AMOUNT';

export type CaraBagi =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'POINT_BASED'
  | 'TIME_BASED'
  | 'UNIT_BASED'
  | 'WEIGHTED_SCORE';

export type PenerimaJasa =
  | 'FACILITY_FEE'
  | 'DOCTOR_FEE'
  | 'MIDWIFE_FEE'
  | 'NURSE_FEE'
  | 'PHARMACY_SERVICE_FEE'
  | 'LAB_SERVICE_FEE'
  | 'RADIOLOGY_SERVICE_FEE'
  | 'ANESTHESIA_FEE'
  | 'ASSISTANT_FEE'
  | 'WARD_SERVICE_FEE'
  | 'BED_FACILITY_FEE'
  | 'EQUIPMENT_USAGE_FEE'
  | 'MEDICAL_DEVICE_USAGE_FEE'
  | 'DRUG_DISPENSING_FEE'
  | 'TEAM_POOL_FEE'
  | 'MANAGEMENT_POOL'
  | 'SUPPORT_STAFF_POOL'
  | 'SYSTEM_PLATFORM_FEE'
  | 'INVESTOR_SHARE'
  | 'RESERVE_FUND'
  | 'QUALITY_FUND'
  | 'TAX_WITHHOLDING'
  | 'OTHER_FEE';

/**
 * Penerima yang menuntut kontrak sebelum boleh aktif.
 *
 * Keduanya mengambil uang dari kumpulan yang sama dengan jasa tenaga medis, dan
 * keduanya bukan pihak yang merawat pasien. Bawaannya NONE.
 */
export const PENERIMA_BERKONTRAK: PenerimaJasa[] = ['SYSTEM_PLATFORM_FEE', 'INVESTOR_SHARE'];

/**
 * Dasar perhitungan yang **tidak boleh** dipakai untuk settlement final pada
 * penjamin yang membayar lewat klaim.
 *
 * Boleh untuk akrual dan simulasi. Tidak pernah untuk yang dibayarkan.
 */
export const DASAR_TAKSIRAN: DasarPerhitungan[] = [
  'GROSS_CHARGE',
  'NET_CHARGE',
  'VERIFIED_CLAIM',
];

// --- Kebijakan ---------------------------------------------------------------

export interface BarisKebijakan {
  recipient: PenerimaJasa;
  method: CaraBagi;
  /** Nilainya datang dari DATA. Berkas ini tidak pernah menetapkannya. */
  value: number;
  providerId?: string | null;
  contributorRole?: string | null;
  note?: string | null;
}

export interface KebijakanJasa {
  id: string;
  code: string;
  basis: DasarPerhitungan;
  lines: BarisKebijakan[];
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  isSampleData: boolean;
  active: boolean;
  productionApproved: boolean;
}

/**
 * Memeriksa satu kebijakan sebelum disimpan.
 *
 * Yang diperiksa bukan besarnya persentase — itu kesepakatan fasilitas, bukan
 * urusan kode ini. Yang diperiksa adalah bentuknya: jumlah persentase tidak
 * melebihi seratus, tidak ada penerima ganda dengan cara yang sama, dan nilai
 * tidak negatif.
 */
export function periksaKebijakan(input: {
  basis: DasarPerhitungan;
  lines: BarisKebijakan[];
}): { valid: boolean; problems: string[] } {
  const masalah: string[] = [];

  if (!input.lines.length) {
    masalah.push('Kebijakan tanpa satu pun baris tidak membagi apa pun.');
  }

  for (const [i, l] of input.lines.entries()) {
    if (l.value < 0) {
      masalah.push(`Baris ke-${i + 1} (${l.recipient}) bernilai negatif.`);
    }
    if (l.method === 'PERCENTAGE' && l.value > 100) {
      masalah.push(`Baris ke-${i + 1} (${l.recipient}) melebihi 100 persen.`);
    }
  }

  const totalPersen = input.lines
    .filter((l) => l.method === 'PERCENTAGE')
    .reduce((n, l) => n + l.value, 0);
  if (totalPersen > 100) {
    /*
     * Lebih dari seratus persen berarti rumah sakit membagikan uang yang tidak
     * dimilikinya. Kurang dari seratus persen sah — sisanya menjadi bagian
     * fasilitas, dan banyak kesepakatan memang berbentuk begitu.
     */
    masalah.push(
      `Jumlah persentase ${totalPersen} melebihi 100. Rumah sakit akan membagikan uang yang ` +
        'tidak dimilikinya.',
    );
  }

  const kunci = new Set<string>();
  for (const l of input.lines) {
    const k = `${l.recipient}|${l.method}|${l.providerId ?? ''}|${l.contributorRole ?? ''}`;
    if (kunci.has(k)) {
      masalah.push(`Penerima ${l.recipient} muncul dua kali dengan cara pembagian yang sama.`);
    }
    kunci.add(k);
  }

  return { valid: masalah.length === 0, problems: masalah };
}

/**
 * Boleh atau tidaknya satu kebijakan disetujui.
 *
 * Pembuat kebijakan tidak menyetujui versinya sendiri. Dan **penerima jasa
 * tidak menyetujui aturan yang membayar dirinya** — yang terakhir paling sering
 * dilanggar dan paling sulit dilihat: dokter yang juga administrator dapat
 * menaikkan persentasenya sendiri, dan tidak ada yang akan menyadarinya sampai
 * ada yang membandingkan dua bulan berturut-turut.
 */
export function bolehSetujuiKebijakan(input: {
  createdBy?: string | null;
  approverId: string;
  /** Pemberi layanan yang tertaut pada akun penyetuju, bila ada. */
  approverProviderId?: string | null;
  lines: BarisKebijakan[];
}): { allowed: boolean; message?: string } {
  if (input.createdBy && input.createdBy === input.approverId) {
    return {
      allowed: false,
      message:
        'Pembuat kebijakan tidak menyetujui versinya sendiri. Persentase pembagian jasa adalah ' +
        'kesepakatan dua pihak; disetujui satu pihak saja, ia bukan kesepakatan.',
    };
  }

  if (input.approverProviderId) {
    const membayarDirinya = input.lines.some((l) => l.providerId === input.approverProviderId);
    if (membayarDirinya) {
      return {
        allowed: false,
        message:
          'Penyetuju termasuk penerima pada kebijakan ini. Yang menerima jasa tidak menyetujui ' +
          'aturan yang membayar dirinya — pelanggarannya tidak akan disadari siapa pun sampai ' +
          'ada yang membandingkan dua bulan berturut-turut.',
      };
    }
  }

  return { allowed: true };
}

// --- Kontributor -------------------------------------------------------------

export interface Kontributor {
  providerId: string;
  contributorRole: string;
  /** Bukti kehadiran dari H-7: daftar periksa, hitungan kasa, atau penugasan. */
  attendanceEvidence?: string | null;
  percentage?: number | null;
  point?: number | null;
  fixedAmount?: number | null;
  durationMinutes?: number | null;
  complexityWeight?: number | null;
}

/**
 * Menyaring kontributor yang tidak memiliki bukti kehadiran.
 *
 * Tidak menghapusnya diam-diam — ia dikembalikan terpisah supaya yang menyusun
 * daftarnya melihat siapa yang tercoret dan mengapa. Menghapus diam-diam akan
 * menghasilkan pertanyaan "mengapa jasa saya tidak ada" yang tidak dapat
 * dijawab siapa pun.
 */
export function saringKontributor(kontributor: Kontributor[]): {
  eligible: Kontributor[];
  rejected: Array<{ contributor: Kontributor; reason: string }>;
} {
  const layak: Kontributor[] = [];
  const ditolak: Array<{ contributor: Kontributor; reason: string }> = [];

  for (const k of kontributor) {
    if (!k.attendanceEvidence?.trim()) {
      ditolak.push({
        contributor: k,
        reason:
          'Tidak ada bukti kehadiran. Jasa dibayarkan kepada yang benar-benar hadir; tanpa ' +
          'buktinya, daftar kontributor menjadi daftar keinginan.',
      });
      continue;
    }
    layak.push(k);
  }

  return { eligible: layak, rejected: ditolak };
}

// --- Perhitungan -------------------------------------------------------------

/**
 * Boleh atau tidaknya satu dasar perhitungan dipakai untuk settlement final.
 *
 * Penjamin yang membayar lewat klaim wajib memakai `PAID_CLAIM`. Taksiran boleh
 * untuk akrual dan simulasi — dan perbedaan itu satu-satunya yang mencegah
 * rumah sakit membayarkan uang yang tidak pernah diterimanya.
 */
export function bolehJadikanFinal(input: {
  basis: DasarPerhitungan;
  payerPaysByClaim: boolean;
  isSimulation: boolean;
}): { allowed: boolean; message?: string } {
  if (input.isSimulation) return { allowed: true };

  if (input.payerPaysByClaim && DASAR_TAKSIRAN.includes(input.basis)) {
    return {
      allowed: false,
      message:
        `Dasar ${input.basis} adalah taksiran, dan penjamin ini membayar lewat klaim. ` +
        'Settlement final wajib memakai PAID_CLAIM. Klaim yang diajukan sepuluh juta dan ' +
        'dibayar tujuh juta akan membuat rumah sakit membayarkan uang yang tidak pernah ' +
        'diterimanya — dan menariknya kembali dari dokter jauh lebih sulit daripada tidak ' +
        'membayarkannya sejak awal.',
    };
  }

  return { allowed: true };
}

export interface HasilBagian {
  recipient: PenerimaJasa;
  providerId?: string | null;
  amount: number;
  method: CaraBagi;
  basisValue: number;
}

/**
 * Membagi satu nilai menurut kebijakan.
 *
 * **Sisa pembulatan diberikan kepada baris terakhir yang berjenis persentase**,
 * bukan dibuang. Membuangnya berarti jumlah bagian tidak pernah sama dengan
 * nilai yang dibagi, dan selisih beberapa rupiah dikalikan ribuan tindakan
 * menjadi selisih yang harus dijelaskan seseorang pada akhir tahun.
 */
export function bagiJasa(input: {
  basisAmount: number;
  lines: BarisKebijakan[];
  contributors?: Kontributor[];
}): { shares: HasilBagian[]; distributed: number; remainder: number; message: string } {
  if (input.basisAmount < 0) throw new Error('Nilai dasar tidak boleh negatif.');

  const hasil: HasilBagian[] = [];

  for (const l of input.lines) {
    let nilai = 0;
    switch (l.method) {
      case 'PERCENTAGE':
        nilai = Math.floor((input.basisAmount * l.value) / 100);
        break;
      case 'FIXED_AMOUNT':
        nilai = Math.min(l.value, input.basisAmount);
        break;
      case 'POINT_BASED':
      case 'UNIT_BASED':
      case 'WEIGHTED_SCORE':
      case 'TIME_BASED': {
        /*
         * Cara berbasis poin, satuan, bobot, dan waktu menuntut kontributor.
         * Tanpa kontributor, nilainya nol — bukan ditaksir dari jumlah baris,
         * sebab taksiran itu akan tampak masuk akal dan salah.
         */
        const kontributor = input.contributors ?? [];
        const totalBobot = kontributor.reduce(
          (n, k) => n + bobotKontributor(k, l.method),
          0,
        );
        if (totalBobot <= 0) {
          nilai = 0;
          break;
        }
        nilai = Math.floor((input.basisAmount * l.value) / 100);
        break;
      }
      default:
        nilai = 0;
    }

    hasil.push({
      recipient: l.recipient,
      providerId: l.providerId ?? null,
      amount: nilai,
      method: l.method,
      basisValue: l.value,
    });
  }

  const terbagi = hasil.reduce((n, h) => n + h.amount, 0);
  let sisa = input.basisAmount - terbagi;

  // Sisa pembulatan diberikan kepada baris persentase yang terakhir.
  if (sisa > 0) {
    for (let i = hasil.length - 1; i >= 0; i -= 1) {
      if (hasil[i].method === 'PERCENTAGE') {
        const totalPersen = input.lines
          .filter((l) => l.method === 'PERCENTAGE')
          .reduce((n, l) => n + l.value, 0);
        // Hanya bila kebijakannya memang membagi seluruhnya.
        if (totalPersen >= 100) {
          hasil[i].amount += sisa;
          sisa = 0;
        }
        break;
      }
    }
  }

  return {
    shares: hasil,
    distributed: input.basisAmount - sisa,
    remainder: sisa,
    message:
      sisa === 0
        ? 'Seluruh nilai terbagi habis.'
        : `Sisa ${sisa} tidak terbagi; menjadi bagian fasilitas menurut kebijakan ini.`,
  };
}

function bobotKontributor(k: Kontributor, method: CaraBagi): number {
  switch (method) {
    case 'POINT_BASED':
      return k.point ?? 0;
    case 'TIME_BASED':
      return k.durationMinutes ?? 0;
    case 'WEIGHTED_SCORE':
      return k.complexityWeight ?? 0;
    case 'UNIT_BASED':
      return 1;
    default:
      return 0;
  }
}

/**
 * Membagi satu kumpulan jasa kepada para kontributor.
 *
 * Sisa pembulatannya diberikan kepada kontributor dengan bobot terbesar, bukan
 * kepada yang pertama pada daftar. Urutan daftar tidak berarti apa-apa; bobot
 * berarti sesuatu.
 */
export function bagiKepadaKontributor(input: {
  poolAmount: number;
  contributors: Kontributor[];
  method: CaraBagi;
}): { shares: Array<{ providerId: string; amount: number; weight: number }>; message: string } {
  if (input.poolAmount < 0) throw new Error('Nilai kumpulan tidak boleh negatif.');

  const berbobot = input.contributors.map((k) => ({
    providerId: k.providerId,
    weight: bobotKontributor(k, input.method),
  }));
  const total = berbobot.reduce((n, b) => n + b.weight, 0);

  if (total <= 0) {
    return {
      shares: [],
      message:
        'Tidak ada kontributor yang berbobot. Kumpulan ini tidak dibagi — menaksirnya dengan ' +
        'membagi rata akan tampak masuk akal dan salah.',
    };
  }

  const bagian = berbobot.map((b) => ({
    providerId: b.providerId,
    weight: b.weight,
    amount: Math.floor((input.poolAmount * b.weight) / total),
  }));

  const terbagi = bagian.reduce((n, b) => n + b.amount, 0);
  const sisa = input.poolAmount - terbagi;
  if (sisa > 0) {
    const terbesar = bagian.reduce((a, b) => (b.weight > a.weight ? b : a), bagian[0]);
    terbesar.amount += sisa;
  }

  return {
    shares: bagian,
    message: `Dibagi kepada ${bagian.length} kontributor menurut bobotnya.`,
  };
}

// --- Fee sistem dan investor -------------------------------------------------

export interface SyaratKontrak {
  hasContract: boolean;
  hasLegalReview: boolean;
  hasManagementApproval: boolean;
  hasTaxTreatment: boolean;
  effectiveFrom?: string | null;
  maximumPercent?: number | null;
}

/**
 * Boleh atau tidaknya fee sistem atau fee investor diaktifkan.
 *
 * Bawaannya NONE, dan aktivasinya menuntut **seluruhnya** — bukan sebagian.
 * Yang kurang disebutkan satu per satu: daftar syarat yang hanya berkata "belum
 * lengkap" akan diisi seadanya sampai tombolnya menyala.
 */
export function bolehAktifkanFeeBerkontrak(input: {
  recipient: PenerimaJasa;
  syarat: SyaratKontrak;
}): { allowed: boolean; missing: string[]; message: string } {
  if (!PENERIMA_BERKONTRAK.includes(input.recipient)) {
    return { allowed: true, missing: [], message: 'Penerima ini tidak menuntut kontrak.' };
  }

  const kurang: string[] = [];
  const s = input.syarat;
  if (!s.hasContract) kurang.push('kontrak');
  if (!s.hasLegalReview) kurang.push('telaah hukum');
  if (!s.hasManagementApproval) kurang.push('persetujuan manajemen');
  if (!s.hasTaxTreatment) kurang.push('perlakuan pajak');
  if (!s.effectiveFrom?.trim()) kurang.push('tanggal berlaku');
  if (s.maximumPercent == null) kurang.push('batas maksimum');

  if (kurang.length) {
    return {
      allowed: false,
      missing: kurang,
      message:
        `${input.recipient} belum dapat diaktifkan; yang kurang: ${kurang.join(', ')}. ` +
        'Bawaannya NONE, dan aktivasinya menuntut seluruhnya — fee yang aktif tanpa kontrak ' +
        'mengambil uang dari kumpulan yang sama dengan jasa tenaga medis.',
    };
  }

  return { allowed: true, missing: [], message: `${input.recipient} dapat diaktifkan.` };
}

/**
 * Boleh atau tidaknya satu templat contoh dipakai di produksi.
 *
 * Templat dari blueprint bertanda `isSampleData=true`, `active=false`,
 * `productionApproved=false`. Ia **bukan** standar nasional dan bukan saran
 * hukum — persentase produksi ditentukan masing-masing fasilitas bersama tenaga
 * medisnya.
 */
export function bolehPakaiDiProduksi(kebijakan: {
  isSampleData: boolean;
  productionApproved: boolean;
}): { allowed: boolean; message?: string } {
  if (kebijakan.isSampleData && !kebijakan.productionApproved) {
    return {
      allowed: false,
      message:
        'Kebijakan ini templat contoh dan belum disetujui untuk produksi. Ia bukan standar ' +
        'nasional dan bukan saran hukum; persentase produksi ditentukan fasilitas ini bersama ' +
        'tenaga medisnya, lalu disetujui dua pihak.',
    };
  }
  return { allowed: true };
}

// --- Settlement --------------------------------------------------------------

export type StatusSettlement =
  | 'CALCULATED'
  | 'SIMULATED'
  | 'APPROVED'
  | 'LOCKED'
  | 'PAID'
  | 'STATED';

const URUTAN: Record<StatusSettlement, StatusSettlement[]> = {
  CALCULATED: ['SIMULATED', 'APPROVED'],
  SIMULATED: ['CALCULATED', 'APPROVED'],
  APPROVED: ['LOCKED'],
  LOCKED: ['PAID'],
  PAID: ['STATED'],
  STATED: [],
};

/**
 * Perpindahan status settlement.
 *
 * Tidak ada jalan kembali dari `LOCKED`. Kekeliruan diperbaiki lewat penyesuaian
 * atau pembalikan, yang keduanya meninggalkan barisnya sendiri — menghapusnya
 * akan membuat pernyataan yang sudah diterima dokter tidak lagi cocok dengan
 * catatan rumah sakit, dan yang dipegang dokter adalah kertas yang sudah
 * dicetak.
 */
export function bolehPindahStatus(input: {
  from: StatusSettlement;
  to: StatusSettlement;
}): { allowed: boolean; message?: string } {
  const berikut = URUTAN[input.from];
  if (!berikut) {
    return { allowed: false, message: `Status ${input.from} tidak dikenal.` };
  }
  if (!berikut.includes(input.to)) {
    return {
      allowed: false,
      message:
        `Settlement berstatus ${input.from} tidak dapat berpindah ke ${input.to}. ` +
        (input.from === 'LOCKED' || input.from === 'PAID' || input.from === 'STATED'
          ? 'Yang sudah dikunci tidak dapat dibatalkan; pakai penyesuaian atau pembalikan.'
          : `Yang mungkin dari sini: ${berikut.join(', ')}.`),
    };
  }
  return { allowed: true };
}

/**
 * Boleh atau tidaknya settlement disetujui.
 *
 * Petugas kalkulasi tidak menyetujui settlement-nya sendiri.
 */
export function bolehSetujuiSettlement(input: {
  calculatedBy?: string | null;
  approverId: string;
}): { allowed: boolean; message?: string } {
  if (input.calculatedBy && input.calculatedBy === input.approverId) {
    return {
      allowed: false,
      message:
        'Yang menghitung settlement tidak menyetujuinya sendiri. Perhitungan yang diperiksa ' +
        'oleh yang menghitungnya bukan pemeriksaan.',
    };
  }
  return { allowed: true };
}
