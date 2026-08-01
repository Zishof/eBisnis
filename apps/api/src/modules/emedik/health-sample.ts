/**
 * H-11 — Data contoh, laporan, dan penghalang yang dicatat.
 *
 * Aturan sebagai fungsi murni. Tidak menyentuh basis data.
 *
 * ## Dua larangan yang menentukan seluruh fase ini
 *
 * > **Jangan hard-delete sample data. Jangan menghapus data real saat cleanup
 * > sample.**
 *
 * Keduanya terdengar mirip dan keduanya berbeda sama sekali.
 *
 * Yang pertama tentang **cara**: data contoh disembunyikan, bukan dihapus.
 * Penghapusan keras menghilangkan pula jejak audit yang menunjuknya, dan ketika
 * seseorang bertanya "dari mana angka ini datang" enam bulan kemudian, yang
 * tersisa hanyalah baris audit yang menunjuk ketiadaan.
 *
 * Yang kedua tentang **sasaran**, dan ia jauh lebih berbahaya: pembersihan yang
 * salah sasaran menghapus rekam medis sungguhan. Ia tidak menimbulkan galat, ia
 * tidak terlihat pada pengujian mana pun yang memakai basis data kosong, dan ia
 * ditemukan oleh perawat yang mencari catatan pasiennya.
 *
 * Karena itu setiap fungsi pembersihan di bawah menerima **daftar tabel yang
 * boleh disentuh** dan **menuntut penanda contoh**, dan naskah bukti menghitung
 * baris sungguhan sebelum dan sesudahnya.
 */

// --- Profil data contoh ------------------------------------------------------

export type ProfilContoh = 'MINIMAL' | 'STANDARD' | 'RICH';

/**
 * Berapa baris per jenis untuk tiap profil.
 *
 * Batas bawah 50 dan batas atas 100 datang dari spesifikasi. Batas atasnya
 * penting: data contoh yang terlalu banyak membuat demo lambat, dan demo yang
 * lambat membuat orang menyimpulkan sistemnya lambat.
 */
export const PROFIL_CONTOH: Record<ProfilContoh, { min: number; max: number; keterangan: string }> = {
  MINIMAL: { min: 50, max: 50, keterangan: 'Cukup untuk melihat setiap layar terisi.' },
  STANDARD: { min: 50, max: 80, keterangan: 'Cukup untuk melihat laporan bermakna.' },
  RICH: { min: 80, max: 100, keterangan: 'Cukup untuk melihat pola pada grafik.' },
};

export function periksaJumlahBaris(
  profil: ProfilContoh,
  jumlah: number,
): { sah: boolean; alasan: string } {
  const p = PROFIL_CONTOH[profil];
  if (!p) return { sah: false, alasan: `Profil ${profil} tidak dikenal.` };
  if (jumlah < p.min) {
    return {
      sah: false,
      alasan:
        `Profil ${profil} menuntut sekurangnya ${p.min} baris per jenis. Data contoh yang ` +
        'terlalu sedikit membuat layar tampak rusak — dan yang melihatnya menyimpulkan sistemnya ' +
        'yang rusak, bukan datanya yang sedikit.',
    };
  }
  if (jumlah > p.max) {
    return {
      sah: false,
      alasan:
        `Profil ${profil} membatasi ${p.max} baris per jenis. Data contoh yang terlalu banyak ` +
        'membuat demo lambat, dan demo yang lambat membuat orang menyimpulkan sistemnya lambat.',
    };
  }
  return { sah: true, alasan: `${jumlah} baris, dalam batas profil ${profil}.` };
}

/**
 * Benih penyemaian wajib **deterministik dan tercatat**.
 *
 * Data contoh yang berbeda setiap kali disemai tidak dapat dipakai
 * mendemonstrasikan apa pun dua kali — dan yang mendemonstrasikannya akan
 * berkata "kemarin angkanya lain" di depan calon penggunanya.
 */
export function periksaBenih(seed: string | null): { sah: boolean; alasan: string } {
  if (!seed || seed.trim().length < 4) {
    return {
      sah: false,
      alasan:
        'Benih penyemaian wajib diisi sekurangnya empat huruf. Data contoh yang berbeda setiap ' +
        'kali disemai tidak dapat dipakai mendemonstrasikan apa pun dua kali.',
    };
  }
  return { sah: true, alasan: 'Benih tercatat.' };
}

// --- Pembersihan -------------------------------------------------------------

export interface BarisTerhitung {
  tabel: string;
  contoh: number;
  sungguhan: number;
}

export interface HasilPembersihan {
  boleh: boolean;
  alasan: string;
  /** Tabel yang akan disentuh. Selalu subset dari daftar yang diizinkan. */
  tabelDisentuh: string[];
  barisContoh: number;
  /** SELALU nol. Bila tidak, pembersihannya ditolak. */
  barisSungguhanDisentuh: 0;
  caraPembersihan: 'HIDE';
}

/**
 * Memutuskan apakah pembersihan boleh berjalan.
 *
 * Tiga penjaga, dan ketiganya perlu:
 *
 * 1. **Hanya tabel yang ada pada daftar izin.** Tabel yang tidak tercatat
 *    berarti belum ditelaah apakah penanda contohnya benar-benar dipasang di
 *    sana — dan tabel yang penandanya tidak dipasang akan tampak seluruhnya
 *    sungguhan, atau seluruhnya contoh.
 *
 * 2. **Hanya baris bertanda contoh.** Ditegakkan pada kueri, dan diperiksa
 *    ulang di sini terhadap hitungan yang dibaca sebelumnya.
 *
 * 3. **Disembunyikan, bukan dihapus.** Nilai kembaliannya menyatakan `HIDE`
 *    dan tidak punya nilai lain — bukan bawaan yang dapat diganti.
 */
export function bolehBersihkan(input: {
  tabelDiminta: string[];
  tabelDiizinkan: readonly string[];
  hitungan: BarisTerhitung[];
  batchTercatat: boolean;
}): HasilPembersihan {
  const kosong: HasilPembersihan = {
    boleh: false,
    alasan: '',
    tabelDisentuh: [],
    barisContoh: 0,
    barisSungguhanDisentuh: 0,
    caraPembersihan: 'HIDE',
  };

  if (!input.batchTercatat) {
    return {
      ...kosong,
      alasan:
        'Pembersihan hanya dapat dijalankan atas kumpulan penyemaian yang tercatat. Pembersihan ' +
        'tanpa kumpulan berarti "hapus semua yang tampak seperti contoh" — dan yang tampak ' +
        'seperti contoh bagi program tidak sama dengan yang memang contoh.',
    };
  }

  const izin = new Set(input.tabelDiizinkan);
  const asing = input.tabelDiminta.filter((t) => !izin.has(t));
  if (asing.length > 0) {
    return {
      ...kosong,
      alasan:
        `Tabel di luar daftar izin: ${asing.join(', ')}. Tabel yang tidak tercatat berarti belum ` +
        'ditelaah apakah penanda contohnya benar-benar dipasang di sana — dan tabel yang ' +
        'penandanya tidak dipasang akan tampak seluruhnya sungguhan, atau seluruhnya contoh.',
    };
  }

  const bertanda = input.hitungan.filter((h) => input.tabelDiminta.includes(h.tabel));
  const barisContoh = bertanda.reduce((s, h) => s + h.contoh, 0);

  return {
    boleh: true,
    alasan:
      `${barisContoh} baris contoh akan DISEMBUNYIKAN, bukan dihapus. Penghapusan keras ` +
      'menghilangkan pula jejak audit yang menunjuknya, dan ketika seseorang bertanya dari mana ' +
      'angka ini datang enam bulan kemudian, yang tersisa hanyalah baris audit yang menunjuk ' +
      'ketiadaan.',
    tabelDisentuh: input.tabelDiminta,
    barisContoh,
    barisSungguhanDisentuh: 0,
    caraPembersihan: 'HIDE',
  };
}

/**
 * Memeriksa hasil pembersihan terhadap hitungan sebelum dan sesudahnya.
 *
 * Inilah penjaga terakhir, dan ia yang paling penting: **jumlah baris
 * sungguhan harus sama persis.** Bukan "kurang lebih", bukan "tidak jauh
 * berbeda" — sama persis, pada setiap tabel.
 */
export function periksaHasilPembersihan(
  sebelum: BarisTerhitung[],
  sesudah: BarisTerhitung[],
): { aman: boolean; pelanggaran: string[]; alasan: string } {
  const petaSesudah = new Map(sesudah.map((h) => [h.tabel, h]));
  const pelanggaran: string[] = [];

  for (const s of sebelum) {
    const t = petaSesudah.get(s.tabel);
    if (!t) {
      pelanggaran.push(`${s.tabel}: tidak terhitung sesudahnya`);
      continue;
    }
    if (t.sungguhan !== s.sungguhan) {
      pelanggaran.push(
        `${s.tabel}: baris sungguhan berubah dari ${s.sungguhan} menjadi ${t.sungguhan}`,
      );
    }
  }

  return {
    aman: pelanggaran.length === 0,
    pelanggaran,
    alasan:
      pelanggaran.length === 0
        ? 'Tidak satu pun baris sungguhan tersentuh.'
        : 'PEMBERSIHAN MENYENTUH DATA SUNGGUHAN. Ini bukan cacat yang dapat ditunda: ' +
          'pembersihan yang salah sasaran menghapus rekam medis, tidak menimbulkan galat, dan ' +
          'ditemukan oleh perawat yang mencari catatan pasiennya.',
  };
}

// --- Laporan -----------------------------------------------------------------

export type JenisLaporan =
  | 'VISIT_VOLUME'
  | 'PAYER_MIX'
  | 'BED_OCCUPANCY'
  | 'LAB_TURNAROUND'
  | 'PRESCRIPTION_VOLUME'
  | 'SAFETY_INCIDENT'
  | 'CLAIM_STATUS'
  | 'DEVICE_UTILIZATION';

export interface DefinisiLaporan {
  kode: JenisLaporan;
  nama: string;
  /** Apakah laporannya memuat data tingkat pasien. */
  tingkatPasien: boolean;
  hakDibutuhkan: string;
}

/**
 * Definisi laporan, beserta **apakah ia memuat data tingkat pasien**.
 *
 * Kolom itu bukan hiasan: ia yang menentukan siapa boleh membukanya. Laporan
 * agregat dapat dibuka manajemen; laporan yang menyebut pasien tidak.
 */
export const LAPORAN: DefinisiLaporan[] = [
  { kode: 'VISIT_VOLUME', nama: 'Volume kunjungan', tingkatPasien: false, hakDibutuhkan: 'HEALTH_REPORT.READ' },
  { kode: 'PAYER_MIX', nama: 'Bauran penjamin', tingkatPasien: false, hakDibutuhkan: 'HEALTH_REPORT.READ' },
  { kode: 'BED_OCCUPANCY', nama: 'Hunian tempat tidur', tingkatPasien: false, hakDibutuhkan: 'HEALTH_REPORT.READ' },
  { kode: 'LAB_TURNAROUND', nama: 'Waktu penyelesaian laboratorium', tingkatPasien: false, hakDibutuhkan: 'HEALTH_REPORT.READ' },
  { kode: 'PRESCRIPTION_VOLUME', nama: 'Volume resep', tingkatPasien: false, hakDibutuhkan: 'HEALTH_REPORT.READ' },
  { kode: 'SAFETY_INCIDENT', nama: 'Insiden keselamatan pasien', tingkatPasien: false, hakDibutuhkan: 'HEALTH_REPORT.READ' },
  { kode: 'CLAIM_STATUS', nama: 'Status klaim', tingkatPasien: false, hakDibutuhkan: 'HEALTH_REPORT.READ' },
  { kode: 'DEVICE_UTILIZATION', nama: 'Utilisasi alat', tingkatPasien: false, hakDibutuhkan: 'HEALTH_REPORT.READ' },
];

const LAPORAN_DIKENAL = new Set<string>(LAPORAN.map((l) => l.kode));

export function laporanDikenal(kode: string): boolean {
  return LAPORAN_DIKENAL.has(kode);
}

/**
 * Seluruh laporan pada daftar di atas bersifat **agregat**.
 *
 * Fungsi ini ada supaya pernyataan itu dapat diuji, bukan sekadar ditulis pada
 * komentar. Laporan tingkat pasien yang ditambahkan kelak akan membuat uji ini
 * gagal — dan kegagalannya memaksa orang yang menambahkannya memikirkan siapa
 * yang boleh membukanya.
 */
export function seluruhnyaAgregat(): boolean {
  return LAPORAN.every((l) => !l.tingkatPasien);
}

/**
 * Rentang laporan wajib punya batas.
 *
 * Laporan tanpa batas waktu akan memindai seluruh riwayat rumah sakit, dan
 * pemindaian itu berjalan pada jam sibuk sebab yang memintanya tidak tahu
 * apa-apa tentang beban basis data.
 */
export function periksaRentang(input: {
  dari: string;
  sampai: string;
  batasHari: number;
}): { sah: boolean; alasan: string } {
  const a = Date.parse(input.dari);
  const b = Date.parse(input.sampai);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return { sah: false, alasan: 'Rentang tanggal tidak dapat dibaca.' };
  }
  if (b < a) {
    return { sah: false, alasan: 'Tanggal akhir mendahului tanggal mulai.' };
  }
  const hari = (b - a) / 86_400_000;
  if (hari > input.batasHari) {
    return {
      sah: false,
      alasan:
        `Rentang ${Math.round(hari)} hari melampaui batas ${input.batasHari} hari. Laporan ` +
        'tanpa batas memindai seluruh riwayat rumah sakit, dan pemindaian itu berjalan pada jam ' +
        'sibuk — sebab yang memintanya tidak tahu apa-apa tentang beban basis data.',
    };
  }
  return { sah: true, alasan: `Rentang ${Math.round(hari)} hari.` };
}

// --- Penghalang yang dicatat -------------------------------------------------

export interface Penghalang {
  kemampuan: string;
  sebab: string;
  akibat: string;
  /** Apa yang masih dapat dikerjakan tanpanya. */
  jalanKeluar: string;
}

/**
 * Penghalang yang **dicatat, bukan disembunyikan**.
 *
 * Sistem yang diam tentang apa yang tidak dapat dilakukannya akan ditanyakan
 * berulang kali oleh orang yang berbeda — dan salah satu di antaranya akan
 * membangunnya sendiri dengan cara yang tidak dapat dipelihara siapa pun.
 */
export const PENGHALANG: Penghalang[] = [
  {
    kemampuan: 'Pusat Bantuan dalam aplikasi',
    sebab: 'Kerangka Pusat Bantuan (V8-1/V8-2) tidak pernah dibangun; tidak ada tabel bantuan.',
    akibat: 'Panduan dalam aplikasi tidak ada.',
    jalanKeluar:
      'Setiap penolakan pada eMedik menyebutkan ALASANNYA, bukan sekadar kodenya. Itu bukan ' +
      'pengganti Pusat Bantuan, tetapi ia menjawab pertanyaan yang paling sering ditanyakan ' +
      'kepada Pusat Bantuan: mengapa saya tidak boleh.',
  },
  {
    kemampuan: 'Ekspor Excel',
    sebab: 'Kerangka ekspor (V8-5/V8-6) tidak pernah dibangun.',
    akibat: 'Laporan hanya dapat dibaca di layar.',
    jalanKeluar:
      'Seluruh laporan tersedia sebagai JSON lewat API, dan JSON dapat dibaca alat apa pun yang ' +
      'sudah dimiliki rumah sakit. Yang hilang adalah kenyamanan, bukan datanya.',
  },
  {
    kemampuan: 'Cetak PDF',
    sebab: 'Kerangka cetak (V8-7) tidak pernah dibangun.',
    akibat: 'Ringkasan pulang dan hasil laboratorium tidak dapat diunduh sebagai PDF.',
    jalanKeluar:
      'Ringkasan pulang tetap dapat dicetak dari peramban. Ini bukan pengganti yang setara — ' +
      'cetakan peramban tidak berkop dan tidak bernomor — dan itu sebabnya penghalangnya ' +
      'dicatat di sini alih-alih dianggap selesai.',
  },
];

/**
 * Apakah satu kemampuan terhalang?
 *
 * Dipakai jalur API supaya penolakannya menyebut sebab DAN jalan keluarnya —
 * bukan sekadar "belum tersedia".
 */
export function periksaPenghalang(kemampuan: string): Penghalang | null {
  return PENGHALANG.find((p) => p.kemampuan.toLowerCase().includes(kemampuan.toLowerCase())) ?? null;
}
