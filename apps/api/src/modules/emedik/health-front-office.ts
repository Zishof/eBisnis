/**
 * Aturan front office — fungsi murni, tanpa basis data.
 *
 * Antrean, janji temu, dan penentuan tagihan. Ketiganya tampak sederhana dan
 * ketiganya punya satu jebakan yang sama: aturannya tampak jelas sampai
 * dihadapkan pada keadaan yang benar-benar terjadi di loket.
 */

import { tertagih, type PendaftaranUntukTagihan, type VerdictTagihan } from './health-billing';

// --- Antrean -----------------------------------------------------------------

export interface AntreanBaris {
  id: string;
  queuePrefix: string;
  queueNumber: number;
  priority: number;
  status: string;
  createdAt: string;
}

/**
 * Menyusun label antrean yang dibaca pasien di layar.
 *
 * Awalan disertakan karena satu fasilitas punya beberapa antrean sekaligus —
 * A untuk poli umum, B untuk poli gigi. Nomor tanpa awalan tidak memberi tahu
 * pasien antrean mana yang sedang dipanggil, dan pasien yang salah paham akan
 * maju saat bukan gilirannya.
 */
export function labelAntrean(prefix: string, nomor: number, padding = 3): string {
  const bersih = prefix.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'A';
  return `${bersih}-${String(nomor).padStart(padding, '0')}`;
}

/**
 * Urutan panggil berikutnya.
 *
 * Prioritas menang atas nomor, tetapi **tidak menghapus urutan di dalam
 * prioritas yang sama**. Lansia yang datang belakangan tetap menunggu lansia
 * yang datang lebih dahulu.
 *
 * Yang sudah dipanggil tetapi belum dilayani ikut dipertimbangkan, dan justru
 * didahulukan atas yang belum pernah dipanggil pada tingkat prioritas yang
 * sama — pasien yang sudah bangkit dari kursinya tidak boleh disalip.
 */
export function urutkanAntrean(baris: AntreanBaris[]): AntreanBaris[] {
  const menunggu = baris.filter((b) => b.status === 'WAITING' || b.status === 'CALLED');
  return [...menunggu].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    const aDipanggil = a.status === 'CALLED' ? 0 : 1;
    const bDipanggil = b.status === 'CALLED' ? 0 : 1;
    if (aDipanggil !== bDipanggil) return aDipanggil - bDipanggil;
    if (a.queuePrefix !== b.queuePrefix) return a.queuePrefix.localeCompare(b.queuePrefix);
    return a.queueNumber - b.queueNumber;
  });
}

/** Siapa yang dipanggil berikutnya, atau `null` bila antreannya kosong. */
export function berikutnya(baris: AntreanBaris[]): AntreanBaris | null {
  return urutkanAntrean(baris)[0] ?? null;
}

export type AlasanPrioritas =
  | 'ELDERLY'
  | 'PREGNANT'
  | 'DISABILITY'
  | 'INFANT'
  | 'EMERGENCY'
  | 'NONE';

/**
 * Tingkat prioritas dari keadaan pasien.
 *
 * Angka, bukan urutan daftar, supaya penambahan kategori baru tidak menggeser
 * arti kategori yang sudah ada — nilai `3` harus tetap berarti hal yang sama
 * tahun depan, termasuk pada baris antrean lama yang sudah tersimpan.
 */
export function tingkatPrioritas(alasan: AlasanPrioritas): number {
  switch (alasan) {
    case 'EMERGENCY':
      return 9;
    case 'INFANT':
      return 5;
    case 'PREGNANT':
      return 4;
    case 'DISABILITY':
      return 4;
    case 'ELDERLY':
      return 3;
    default:
      return 0;
  }
}

/**
 * Prioritas dari umur, bila tidak dinyatakan petugas.
 *
 * Batasnya mengikuti kebiasaan layanan publik Indonesia: 60 tahun ke atas
 * lanjut usia, di bawah 1 tahun bayi.
 */
export function prioritasDariUmur(umurTahun: number | null): AlasanPrioritas {
  if (umurTahun === null || !Number.isFinite(umurTahun)) return 'NONE';
  if (umurTahun < 1) return 'INFANT';
  if (umurTahun >= 60) return 'ELDERLY';
  return 'NONE';
}

// --- Janji temu --------------------------------------------------------------

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  booked: number;
}

export interface JadwalHarian {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  capacityPerSlot: number;
}

/** Menyusun slot dari satu jadwal harian pada satu tanggal. */
export function susunSlot(jadwal: JadwalHarian, tanggal: Date, terpakai: Record<string, number> = {}): Slot[] {
  const [jamMulai, menitMulai] = jadwal.startTime.split(':').map(Number);
  const [jamSelesai, menitSelesai] = jadwal.endTime.split(':').map(Number);

  const mulai = new Date(tanggal);
  mulai.setHours(jamMulai, menitMulai, 0, 0);
  const selesai = new Date(tanggal);
  selesai.setHours(jamSelesai, menitSelesai, 0, 0);

  const slots: Slot[] = [];
  let kursor = new Date(mulai);

  while (kursor < selesai) {
    const akhir = new Date(kursor.getTime() + jadwal.slotMinutes * 60_000);
    // Slot yang tidak muat penuh tidak dibuat. Slot lima menit di ujung jadwal
    // akan menjanjikan waktu periksa yang tidak pernah cukup.
    if (akhir > selesai) break;

    const kunci = kursor.toISOString();
    slots.push({
      startsAt: new Date(kursor),
      endsAt: akhir,
      capacity: jadwal.capacityPerSlot,
      booked: terpakai[kunci] ?? 0,
    });
    kursor = akhir;
  }

  return slots;
}

export interface VerdictJanji {
  allowed: boolean;
  message?: string;
}

/**
 * Bolehkah membuat janji temu pada slot ini?
 */
export function bolehBuatJanji(input: {
  slot: Slot | null;
  now: Date;
  patientHasOverlapping: boolean;
  scheduleClosed: boolean;
}): VerdictJanji {
  if (input.scheduleClosed) {
    return { allowed: false, message: 'Jadwal pada tanggal itu ditutup.' };
  }
  if (!input.slot) {
    return { allowed: false, message: 'Tidak ada sesi layanan pada waktu yang diminta.' };
  }
  if (input.slot.startsAt <= input.now) {
    return {
      allowed: false,
      message: 'Waktu yang diminta sudah lewat. Pilih waktu berikutnya atau daftar langsung di loket.',
    };
  }
  if (input.slot.booked >= input.slot.capacity) {
    return {
      allowed: false,
      message: `Sesi itu sudah penuh (${input.slot.booked} dari ${input.slot.capacity}). Pilih waktu lain.`,
    };
  }
  if (input.patientHasOverlapping) {
    /*
     * Pasien yang punya dua janji bertumpang tindih akan gagal hadir pada
     * salah satunya, dan yang tercatat kemudian adalah "tidak hadir" — yang
     * pada sebagian fasilitas berakibat pada kemudahan mendaftar berikutnya.
     */
    return {
      allowed: false,
      message: 'Pasien ini sudah memiliki janji temu lain pada waktu yang bertumpang tindih.',
    };
  }
  return { allowed: true };
}

// --- Penentuan tagihan -------------------------------------------------------

export interface PendaftaranBaru {
  isSampleData: boolean;
  isTrainingTenant: boolean;
  isTestPatient: boolean;
  cancelledBeforeService: boolean;
  supersededByCorrection: boolean;
}

/**
 * Menentukan status tagihan satu pendaftaran, sekali, saat dibuat.
 *
 * Hasilnya **disimpan**, bukan dihitung ulang setiap kali laporan dibuka.
 * Sebabnya: aturan penagihan akan berubah — jenjangnya dinegosiasikan, dan
 * pengecualiannya dapat bertambah. Tagihan bulan lalu harus tetap dapat
 * dijelaskan dengan aturan bulan lalu, dan itu mustahil bila angkanya dihitung
 * ulang memakai aturan hari ini.
 */
export function tentukanTagihan(p: PendaftaranBaru): {
  isBillable: boolean;
  nonBillableReason: string | null;
  verdict: VerdictTagihan;
} {
  const untuk: PendaftaranUntukTagihan = {
    isSampleData: p.isSampleData,
    isTrainingTenant: p.isTrainingTenant,
    isTestPatient: p.isTestPatient,
    cancelledBeforeService: p.cancelledBeforeService,
    supersededByCorrection: p.supersededByCorrection,
  };
  const verdict = tertagih(untuk);
  return {
    isBillable: verdict.billable,
    nonBillableReason: verdict.reason ?? null,
    verdict,
  };
}

// --- Tanggal usaha -----------------------------------------------------------

/**
 * Tanggal usaha menurut zona waktu FASILITAS.
 *
 * Penagihan harian dihitung menurut tanggal ini. Memakai zona waktu peladen
 * akan memindahkan pendaftaran pukul 23.30 di Jayapura ke hari berikutnya
 * menurut catatan — lalu jumlah pendaftaran harian menjadi salah pada dua hari
 * sekaligus, dan jenjang tarifnya ikut salah.
 */
export function tanggalUsaha(saat: Date, timezone: string): string {
  try {
    // `en-CA` menghasilkan YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(saat);
  } catch {
    // Zona waktu yang tidak dikenal tidak boleh menghentikan pendaftaran
    // pasien. Jatuh ke WIB, karena itulah zona waktu sebagian besar fasilitas.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(saat);
  }
}

// --- Nomor pendaftaran -------------------------------------------------------

/** `<kode fasilitas>-<YYYYMMDD>-<urutan>` */
export function susunNomorPendaftaran(
  kodeFasilitas: string,
  businessDate: string,
  urutan: number,
  padding = 4,
): string {
  const kode = kodeFasilitas.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'FAC';
  return `${kode}-${businessDate.replace(/-/g, '')}-${String(urutan).padStart(padding, '0')}`;
}
