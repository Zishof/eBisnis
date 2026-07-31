/**
 * Data awal koperasi: yang wajib ada, dan yang hanya contoh.
 *
 * ## Pembedaan yang menentukan
 *
 * Sebagian data koperasi **bukan contoh** — tanpanya modul ini tidak dapat
 * dipakai sama sekali:
 *
 *   · jenis koperasi (KSP, KSPPS, KSU, …)
 *   · kategori pengaduan, jenis pemberitahuan
 *   · pemetaan akun bawaan
 *   · **peran, menu, dan hak akses**
 *
 * Yang terakhir paling penting. Peran dan hak akses menentukan siapa boleh
 * melakukan apa; menghapusnya atas nama "membersihkan data contoh" akan
 * mengunci pengurus keluar dari koperasinya sendiri, dan tidak ada yang
 * tersisa untuk memulihkannya. Karena itu seluruh katalog RBAC bertanda
 * `REFERENCE` dan **tidak pernah** ikut terhapus.
 *
 * Sisanya memang contoh: koperasi teladan beserta sebelas anggotanya, produk
 * simpanan dan pinjaman, satu RAT, satu perhitungan SHU. Berguna untuk
 * mempelajari sistem, dan harus dapat dihapus tanpa sisa ketika penyewa siap
 * memasukkan data sungguhannya.
 *
 * ## Satu larangan yang berlaku selamanya
 *
 * Pembersihan data contoh **tidak boleh menyentuh data sungguhan.** Karena itu
 * setiap baris contoh diberi awalan kode yang tetap (`CONTOH-`), dan
 * penghapusannya menyaring pada awalan itu — bukan pada tanggal, bukan pada
 * "yang dibuat sebelum penyewa mulai memakai", dan bukan pada tanda `is_sample`
 * yang dapat tertulis pada baris sungguhan karena kekeliruan.
 */

export type SifatData = 'REFERENCE' | 'EXAMPLE';

export interface KelompokData {
  code: string;
  label: string;
  table: string;
  sifat: SifatData;
  /** Jumlah baris yang disemai. */
  jumlah: number;
  /**
   * Alasan mengapa sifatnya demikian. Wajib diisi — pilihan REFERENCE
   * artinya "tidak akan pernah dapat dihapus", dan pilihan sebesar itu harus
   * beralasan tertulis.
   */
  alasan: string;
}

/** Awalan kode setiap baris contoh. Menjadi dasar penghapusannya. */
export const AWALAN_CONTOH = 'CONTOH-';

export const KELOMPOK_DATA_KOPERASI: KelompokData[] = [
  // --- REFERENCE: selalu ada, tidak pernah terhapus ------------------------
  {
    code: 'COOPERATIVE_TYPE',
    label: 'Jenis Koperasi',
    table: 'cooperative_type',
    sifat: 'REFERENCE',
    jumlah: 8,
    alasan:
      'Profil koperasi tidak dapat dibuat tanpa jenisnya, dan jenisnya menentukan apakah koperasi boleh menyalurkan pinjaman serta apakah ia tunduk pada aturan syariah.',
  },
  {
    code: 'COOPERATIVE_RBAC',
    label: 'Peran, Menu, dan Hak Akses',
    table: '(katalog RBAC)',
    sifat: 'REFERENCE',
    jumlah: 9,
    alasan:
      'Menentukan siapa boleh melakukan apa. Menghapusnya mengunci pengurus keluar dari koperasinya sendiri, dan tidak ada yang tersisa untuk memulihkannya.',
  },
  {
    code: 'COOPERATIVE_ACCOUNT_MAPPING',
    label: 'Pemetaan Akun Bawaan',
    table: 'cooperative_account_mapping',
    sifat: 'REFERENCE',
    jumlah: 26,
    alasan:
      'Setiap peristiwa akuntansi koperasi menuntut pemetaan akunnya. Tanpa ini tidak ada satu pun jurnal yang dapat terbentuk.',
  },
  {
    code: 'COOPERATIVE_SHU_COMPONENT',
    label: 'Komponen SHU Bawaan',
    table: 'cooperative_shu_component',
    sifat: 'REFERENCE',
    jumlah: 6,
    alasan:
      'Cadangan, jasa modal, jasa usaha, dana pengurus, dana pendidikan, dana sosial — enam komponen yang disebut Undang-Undang Koperasi. Bukan pilihan penyewa.',
  },

  // --- EXAMPLE: hanya bila diminta, boleh dihapus kapan saja ---------------
  {
    code: 'COOPERATIVE_SAMPLE_PROFILE',
    label: 'Contoh Profil Koperasi',
    table: 'cooperative',
    sifat: 'EXAMPLE',
    jumlah: 1,
    alasan: 'Koperasi teladan untuk mempelajari alur; penyewa mengisi profilnya sendiri.',
  },
  {
    code: 'COOPERATIVE_SAMPLE_MEMBER',
    label: 'Contoh Anggota',
    table: 'cooperative_member',
    sifat: 'EXAMPLE',
    jumlah: 12,
    alasan:
      'Sebelas anggota aktif dan satu calon anggota, cukup untuk melihat perhitungan SHU yang tidak bulat.',
  },
  {
    code: 'COOPERATIVE_SAMPLE_SAVING_PRODUCT',
    label: 'Contoh Produk Simpanan',
    table: 'cooperative_saving_product',
    sifat: 'EXAMPLE',
    jumlah: 4,
    alasan: 'Pokok, wajib, sukarela, berjangka — besarannya berbeda di tiap koperasi.',
  },
  {
    code: 'COOPERATIVE_SAMPLE_LOAN_PRODUCT',
    label: 'Contoh Produk Pinjaman',
    table: 'cooperative_loan_product',
    sifat: 'EXAMPLE',
    jumlah: 4,
    alasan: 'Menurun, tetap, murabahah, qardh — tarifnya ditentukan RAT masing-masing koperasi.',
  },
  {
    code: 'COOPERATIVE_SAMPLE_SAVING',
    label: 'Contoh Simpanan Anggota',
    table: 'cooperative_saving_account',
    sifat: 'EXAMPLE',
    jumlah: 30,
    alasan: 'Saldo dan mutasi contoh; data keuangan sungguhan tidak boleh bercampur dengannya.',
  },
  {
    code: 'COOPERATIVE_SAMPLE_LOAN',
    label: 'Contoh Pinjaman',
    table: 'cooperative_loan',
    sifat: 'EXAMPLE',
    jumlah: 5,
    alasan: 'Termasuk satu yang menunggak, supaya layar penagihan tidak kosong saat dipelajari.',
  },
  {
    code: 'COOPERATIVE_SAMPLE_MEETING',
    label: 'Contoh Rapat Anggota',
    table: 'cooperative_meeting',
    sifat: 'EXAMPLE',
    jumlah: 2,
    alasan: 'Satu RAT yang kuorum dan satu yang tidak, supaya keduanya dapat dilihat bedanya.',
  },
  {
    code: 'COOPERATIVE_SAMPLE_SHU',
    label: 'Contoh Perhitungan SHU',
    table: 'cooperative_shu_calculation',
    sifat: 'EXAMPLE',
    jumlah: 1,
    alasan: 'Satu tahun buku lengkap dengan alokasi per anggota.',
  },
  {
    code: 'COOPERATIVE_SAMPLE_WEBSITE',
    label: 'Contoh Isi Situs',
    table: 'cooperative_website_page',
    sifat: 'EXAMPLE',
    jumlah: 5,
    alasan: 'Halaman profil, sejarah, syarat keanggotaan, produk, dan kontak sebagai titik mulai.',
  },
];

// ------------------------------------------------------------ Pemeriksaan

export interface Vonis {
  allowed: boolean;
  message?: string;
  code?: string;
}

/**
 * Bolehkah kelompok data ini dihapus saat pembersihan data contoh?
 *
 * Hanya `EXAMPLE`. Penolakan atas `REFERENCE` bukan kehati-hatian berlebihan:
 * ia menutup satu-satunya jalan yang tersedia untuk menghapus peran dan hak
 * akses secara tidak sengaja.
 */
export function bolehDibersihkan(kelompok: KelompokData): Vonis {
  if (kelompok.sifat !== 'EXAMPLE') {
    return {
      allowed: false,
      code: 'REFERENCE_NOT_REMOVABLE',
      message: `${kelompok.label} bukan data contoh — ${kelompok.alasan}`,
    };
  }
  return { allowed: true };
}

/**
 * Bolehkah baris ini dihapus saat pembersihan?
 *
 * Menyaring pada awalan kode, bukan pada tanggal maupun tanda `is_sample`.
 * Tanggal tidak membedakan apa pun bila penyewa mulai memakai sistemnya pada
 * hari yang sama, dan `is_sample` dapat tertulis pada baris sungguhan karena
 * kekeliruan — sekali itu terjadi, pembersihan berikutnya menghapus data
 * sungguhan tanpa ada yang menyadarinya.
 */
export function barisBolehDihapus(kode: string | null | undefined): boolean {
  if (!kode) return false;
  return kode.startsWith(AWALAN_CONTOH);
}

export interface RingkasanPembersihan {
  kelompokDihapus: string[];
  kelompokDipertahankan: string[];
  perkiraanBarisDihapus: number;
}

/** Menyusun rencana pembersihan sebelum dijalankan. */
export function rencanaPembersihan(): RingkasanPembersihan {
  const dihapus = KELOMPOK_DATA_KOPERASI.filter((k) => bolehDibersihkan(k).allowed);
  const dipertahankan = KELOMPOK_DATA_KOPERASI.filter((k) => !bolehDibersihkan(k).allowed);
  return {
    kelompokDihapus: dihapus.map((k) => k.code),
    kelompokDipertahankan: dipertahankan.map((k) => k.code),
    perkiraanBarisDihapus: dihapus.reduce((s, k) => s + k.jumlah, 0),
  };
}

/**
 * Urutan penghapusan.
 *
 * Dari yang paling bergantung ke yang paling dirujuk. Menghapus anggota lebih
 * dahulu akan gagal pada kunci asing — dan kegagalan di tengah pembersihan
 * meninggalkan keadaan separuh bersih yang lebih sulit dipulihkan daripada
 * tidak dibersihkan sama sekali.
 */
export const URUTAN_PEMBERSIHAN = [
  'COOPERATIVE_SAMPLE_SHU',
  'COOPERATIVE_SAMPLE_MEETING',
  'COOPERATIVE_SAMPLE_LOAN',
  'COOPERATIVE_SAMPLE_SAVING',
  'COOPERATIVE_SAMPLE_WEBSITE',
  'COOPERATIVE_SAMPLE_MEMBER',
  'COOPERATIVE_SAMPLE_LOAN_PRODUCT',
  'COOPERATIVE_SAMPLE_SAVING_PRODUCT',
  'COOPERATIVE_SAMPLE_PROFILE',
];
