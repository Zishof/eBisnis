/**
 * Aturan pengaduan, aspirasi, dan Musrenbang — fungsi murni, tanpa basis data.
 *
 * ## Anonimitas adalah syarat, bukan pilihan
 *
 * Pengaduan yang paling perlu didengar adalah pengaduan **tentang perangkat
 * desa itu sendiri** — pungutan liar, bantuan yang tidak sampai, keputusan yang
 * berpihak. Warga tidak akan mengadukannya bila namanya terlihat oleh orang
 * yang ia adukan, yang tinggal di kampung yang sama dan akan terus ia temui
 * setiap hari.
 *
 * Karena itu pengaduan anonim di sini berarti **identitas pelapor tidak
 * disimpan sama sekali** — bukan disimpan lalu disembunyikan. Perbedaannya
 * menentukan: yang disembunyikan dapat dibuka oleh siapa pun yang punya akses
 * basis data, dan administrator desa punya akses itu.
 *
 * ### Mengapa hash NIK bukan anonim
 *
 * Godaan yang wajar: simpan `sha256(nik)` untuk mencegah spam, "toh tidak dapat
 * dibalik". Tetapi ruang NIK hanya enam belas digit, dan desa memiliki daftar
 * NIK seluruh warganya. Mencocokkan hash terhadap seribu NIK yang sudah dimiliki
 * memakan waktu kurang dari sedetik.
 *
 * Hash dari data berentropi rendah yang daftarnya sudah dipegang bukan
 * penyamaran — ia hanya penundaan yang tidak menunda apa pun.
 */

export type StatusPengaduan =
  | 'BARU'
  | 'DITERIMA'
  | 'DITUGASKAN'
  | 'DITINDAKLANJUTI'
  | 'SELESAI'
  | 'DITUTUP'
  | 'BUKAN_KEWENANGAN';

export const STATUS_PENGADUAN: StatusPengaduan[] = [
  'BARU',
  'DITERIMA',
  'DITUGASKAN',
  'DITINDAKLANJUTI',
  'SELESAI',
  'DITUTUP',
  'BUKAN_KEWENANGAN',
];

/**
 * Transisi pengaduan.
 *
 * `SELESAI` masih dapat kembali ke `DITINDAKLANJUTI`: warga yang menilai
 * penyelesaiannya belum memadai dapat membuka kembali. Pengaduan yang sekali
 * ditutup tidak dapat dibuka lagi akan mendorong petugas menutupnya cepat-cepat
 * demi angka penyelesaian.
 */
export const TRANSISI_PENGADUAN: Record<StatusPengaduan, StatusPengaduan[]> = {
  BARU: ['DITERIMA', 'BUKAN_KEWENANGAN', 'DITUTUP'],
  DITERIMA: ['DITUGASKAN', 'DITINDAKLANJUTI', 'BUKAN_KEWENANGAN', 'DITUTUP'],
  DITUGASKAN: ['DITINDAKLANJUTI', 'DITERIMA', 'DITUTUP'],
  DITINDAKLANJUTI: ['SELESAI', 'DITUTUP'],
  SELESAI: ['DITINDAKLANJUTI', 'DITUTUP'],
  // Status akhir.
  DITUTUP: [],
  BUKAN_KEWENANGAN: [],
};

export interface Putusan {
  boleh: boolean;
  alasan?: string;
  wajibBeralasan?: boolean;
}

export function statusAkhirPengaduan(s: StatusPengaduan): boolean {
  return TRANSISI_PENGADUAN[s].length === 0;
}

/**
 * Transisi yang wajib beralasan.
 *
 * Seluruhnya adalah transisi yang **menghentikan** pengaduan tanpa
 * menyelesaikan masalahnya. Warga berhak tahu mengapa aduannya berhenti.
 */
const WAJIB_BERALASAN_PENGADUAN = new Set<string>([
  'BARU->BUKAN_KEWENANGAN',
  'DITERIMA->BUKAN_KEWENANGAN',
  'BARU->DITUTUP',
  'DITERIMA->DITUTUP',
  'DITUGASKAN->DITUTUP',
  'DITINDAKLANJUTI->DITUTUP',
  'SELESAI->DITUTUP',
  'SELESAI->DITINDAKLANJUTI',
]);

export function bolehPindahPengaduan(dari: StatusPengaduan, ke: StatusPengaduan): Putusan {
  if (dari === ke) return { boleh: false, alasan: `Pengaduan sudah berstatus ${ke}.` };
  if (statusAkhirPengaduan(dari)) {
    return { boleh: false, alasan: `Pengaduan berstatus ${dari} sudah ditutup.` };
  }
  if (!TRANSISI_PENGADUAN[dari].includes(ke)) {
    return { boleh: false, alasan: `Pengaduan berstatus ${dari} tidak dapat langsung menjadi ${ke}.` };
  }
  return { boleh: true, wajibBeralasan: WAJIB_BERALASAN_PENGADUAN.has(`${dari}->${ke}`) };
}

// --- Anonimitas --------------------------------------------------------------

export type ModePelapor = 'TERBUKA' | 'ANONIM';

export interface IdentitasPelapor {
  residentId?: string | null;
  userId?: string | null;
  name?: string | null;
  phone?: string | null;
}

export interface PelaporTersimpan {
  residentId: string | null;
  userId: string | null;
  name: string | null;
  phone: string | null;
}

/**
 * Menyaring identitas pelapor menurut modenya.
 *
 * Untuk `ANONIM`, seluruh medan dikosongkan — termasuk yang tidak diminta
 * pemanggil. Membiarkan pemanggil menentukan medan mana yang dikosongkan berarti
 * satu jalan yang lupa akan menyimpan nama pelapor selamanya, dan tidak ada yang
 * menyadarinya sampai seseorang membuka tabelnya.
 */
export function saringIdentitas(mode: ModePelapor, id: IdentitasPelapor): PelaporTersimpan {
  if (mode === 'ANONIM') {
    return { residentId: null, userId: null, name: null, phone: null };
  }
  return {
    residentId: id.residentId ?? null,
    userId: id.userId ?? null,
    name: id.name ?? null,
    phone: id.phone ?? null,
  };
}

/**
 * Apakah sebuah nilai boleh dipakai sebagai penanda anti-spam?
 *
 * Menolak apa pun yang berentropi rendah dan daftarnya dimiliki desa: NIK,
 * nomor KK, nomor telepon. Hash dari nilai seperti itu dapat dicocokkan
 * exhaustively terhadap daftar warga dalam hitungan detik, sehingga
 * "anonim"-nya hanya penundaan yang tidak menunda apa pun.
 */
export function bolehJadiPenandaAntiSpam(jenis: string): { boleh: boolean; alasan?: string } {
  const terlarang: Record<string, string> = {
    NIK: 'Ruang NIK hanya enam belas digit dan desa memiliki daftar NIK seluruh warganya.',
    KK: 'Nomor kartu keluarga sama halnya.',
    PHONE: 'Nomor telepon warga tercatat pada data kependudukan.',
    NAME: 'Nama bukan rahasia dan daftarnya dimiliki desa.',
    EMAIL: 'Surel warga tercatat pada data kependudukan.',
  };
  const alasan = terlarang[jenis.toUpperCase()];
  if (alasan) {
    return {
      boleh: false,
      alasan: `${alasan} Hash-nya dapat dicocokkan terhadap daftar warga dalam hitungan detik.`,
    };
  }
  return { boleh: true };
}

/**
 * Bolehkah petugas ini menangani pengaduan ini?
 *
 * Pengaduan **tentang** seseorang tidak boleh ditugaskan **kepada** orang itu.
 * Ini bukan kehati-hatian berlebihan: pengaduan desa paling sering menyangkut
 * perangkat desa, dan menugaskan aduan kepada terlapor sama dengan menutupnya.
 */
export function bolehMenangani(
  terlaporOfficerId: string | null,
  penerimaOfficerId: string,
): Putusan {
  if (terlaporOfficerId && terlaporOfficerId === penerimaOfficerId) {
    return {
      boleh: false,
      alasan:
        'Pengaduan ini menyangkut aparatur yang bersangkutan dan tidak dapat ditugaskan kepadanya. ' +
        'Tugaskan kepada atasan atau petugas lain.',
    };
  }
  return { boleh: true };
}

/**
 * Bolehkah identitas pelapor ditampilkan kepada penerima tugas?
 *
 * Tidak pernah, untuk pengaduan anonim — bahkan kepada Kepala Desa. Tidak ada
 * peran yang dapat "membuka" anonimitas, sebab tidak ada yang disimpan untuk
 * dibuka.
 */
export function bolehLihatPelapor(mode: ModePelapor): boolean {
  return mode === 'TERBUKA';
}

// --- Eskalasi ----------------------------------------------------------------

export interface AmbangEskalasi {
  /** Hari kerja sebelum pengaduan dianggap terlantar. */
  hariTerlantar: number;
  /** Hari kerja sebelum dinaikkan ke atasan. */
  hariEskalasi: number;
}

export const AMBANG_BAWAAN: AmbangEskalasi = { hariTerlantar: 3, hariEskalasi: 7 };

export type TingkatPerhatian = 'NORMAL' | 'TERLANTAR' | 'PERLU_ESKALASI';

/**
 * Menilai apakah pengaduan perlu diangkat.
 *
 * Dihitung dari **terakhir ada tindakan**, bukan dari tanggal masuk. Pengaduan
 * yang ditindaklanjuti kemarin tidak terlantar meski masuknya sebulan lalu;
 * yang masuk kemarin dan belum disentuh juga belum terlantar.
 */
export function tingkatPerhatian(
  hariSejakTindakanTerakhir: number,
  status: StatusPengaduan,
  ambang: AmbangEskalasi = AMBANG_BAWAAN,
): { tingkat: TingkatPerhatian; keterangan: string } {
  if (statusAkhirPengaduan(status) || status === 'SELESAI') {
    return { tingkat: 'NORMAL', keterangan: 'Pengaduan sudah selesai.' };
  }
  if (hariSejakTindakanTerakhir >= ambang.hariEskalasi) {
    return {
      tingkat: 'PERLU_ESKALASI',
      keterangan: `Tidak ada tindakan selama ${hariSejakTindakanTerakhir} hari kerja. Perlu diangkat ke atasan.`,
    };
  }
  if (hariSejakTindakanTerakhir >= ambang.hariTerlantar) {
    return {
      tingkat: 'TERLANTAR',
      keterangan: `Belum ada tindakan selama ${hariSejakTindakanTerakhir} hari kerja.`,
    };
  }
  return { tingkat: 'NORMAL', keterangan: 'Dalam penanganan.' };
}

// --- Musrenbang --------------------------------------------------------------

export type StatusUsulan =
  | 'DIUSULKAN'
  | 'DIBAHAS'
  | 'DISEPAKATI'
  | 'DITUNDA'
  | 'DITOLAK'
  | 'MASUK_RKP';

export const TRANSISI_USULAN: Record<StatusUsulan, StatusUsulan[]> = {
  DIUSULKAN: ['DIBAHAS', 'DITOLAK'],
  DIBAHAS: ['DISEPAKATI', 'DITUNDA', 'DITOLAK'],
  // Usulan yang ditunda kembali dibahas pada Musrenbang tahun berikutnya.
  // Menolaknya secara permanen membuat warga berhenti mengusulkan.
  DITUNDA: ['DIBAHAS'],
  DISEPAKATI: ['MASUK_RKP', 'DITUNDA'],
  MASUK_RKP: [],
  DITOLAK: [],
};

export function bolehPindahUsulan(dari: StatusUsulan, ke: StatusUsulan): Putusan {
  if (dari === ke) return { boleh: false, alasan: `Usulan sudah berstatus ${ke}.` };
  if (!TRANSISI_USULAN[dari].length) {
    return { boleh: false, alasan: `Usulan berstatus ${dari} sudah final.` };
  }
  if (!TRANSISI_USULAN[dari].includes(ke)) {
    return { boleh: false, alasan: `Usulan berstatus ${dari} tidak dapat langsung menjadi ${ke}.` };
  }
  // Penolakan dan penundaan wajib beralasan: warga yang usulannya ditolak tanpa
  // keterangan tidak akan mengusulkan lagi tahun depan.
  return { boleh: true, wajibBeralasan: ke === 'DITOLAK' || ke === 'DITUNDA' };
}

export interface Usulan {
  id: string;
  title: string;
  estimatedCost: number;
  beneficiaryCount: number;
  /** Skor prioritas hasil musyawarah, 1–5. */
  priorityScore: number;
  status: StatusUsulan;
}

/**
 * Mengurutkan usulan menurut prioritas musyawarah.
 *
 * Skor musyawarah didahulukan atas jumlah penerima manfaat, dan keduanya
 * mendahului biaya. Mengurutkan menurut biaya lebih dahulu — yang termurah
 * menang — akan membuat jalan setapak selalu mengalahkan jembatan, dan desa
 * tidak pernah membangun apa pun yang besar.
 */
export function urutkanUsulan(usulan: Usulan[]): Usulan[] {
  return [...usulan].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (b.beneficiaryCount !== a.beneficiaryCount) return b.beneficiaryCount - a.beneficiaryCount;
    return a.estimatedCost - b.estimatedCost;
  });
}

export interface HasilPagu {
  masuk: Usulan[];
  luar: Usulan[];
  terpakai: number;
  sisa: number;
}

/**
 * Membagi usulan menurut pagu yang tersedia.
 *
 * Usulan yang tidak tertampung **tidak ditolak** — ia dikembalikan sebagai
 * daftar tersendiri untuk ditunda ke tahun berikutnya. Menolaknya menghapus
 * jejak bahwa warga pernah mengusulkannya, dan tahun depan pengusulnya harus
 * mulai dari nol.
 */
export function bagiMenurutPagu(usulan: Usulan[], pagu: number): HasilPagu {
  const urut = urutkanUsulan(usulan);
  const masuk: Usulan[] = [];
  const luar: Usulan[] = [];
  let terpakai = 0;

  for (const u of urut) {
    if (terpakai + u.estimatedCost <= pagu) {
      masuk.push(u);
      terpakai += u.estimatedCost;
    } else {
      luar.push(u);
    }
  }
  return { masuk, luar, terpakai, sisa: pagu - terpakai };
}

/**
 * Apakah Musrenbang ini sah menurut kehadirannya?
 *
 * Musyawarah yang dihadiri lima orang bukan musyawarah desa. Ambangnya
 * dinyatakan sebagai data, bukan angka tetap: ketentuan kuorum berbeda antar
 * daerah, dan menebaknya dari pusat akan salah di sebagian tempat.
 */
export function kuorumTerpenuhi(
  hadir: number,
  ambangMinimum: number,
): { sah: boolean; keterangan: string } {
  if (hadir >= ambangMinimum) {
    return { sah: true, keterangan: `Dihadiri ${hadir} peserta, memenuhi kuorum ${ambangMinimum}.` };
  }
  return {
    sah: false,
    keterangan:
      `Dihadiri ${hadir} peserta, kurang dari kuorum ${ambangMinimum}. ` +
      'Hasilnya belum dapat ditetapkan sebagai keputusan musyawarah.',
  };
}
