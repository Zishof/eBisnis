/**
 * Kontrak village terhadap vertikal lain — eMedik, eKoperasi, POS Core, dan
 * marketplace.
 *
 * Perintah §3 menutup bagian anti-bentroknya dengan: *"Untuk Posyandu gunakan
 * public health contract. Untuk koperasi desa gunakan public cooperative
 * contract. Jangan menyalin modul tersebut ke village."* Ketiga mitra itu belum
 * ada, sehingga village mendefinisikan **sisi konsumennya** lebih dahulu.
 *
 * ## Larangan ditegakkan dengan tidak menyediakan metodenya
 *
 * Antarmuka di bawah tidak memiliki metode untuk membaca rekam medis, riwayat
 * kunjungan, saldo simpanan, maupun tunggakan pinjaman. Itu bukan kelalaian.
 * Antarmuka yang tidak punya metode tidak dapat dipanggil, dan itu jauh lebih
 * kuat daripada metode yang ada tetapi diberi pemeriksaan izin — pemeriksaan
 * izin dapat dilonggarkan oleh orang yang sedang terburu-buru, metode yang
 * tidak ada tidak dapat.
 *
 * ## "Kosong" dan "belum tersambung" harus dapat dibedakan
 *
 * Setiap metode mengembalikan {@link HasilLuar}, yang menyatakan ketersediaan
 * secara terpisah dari datanya. Halaman yang menampilkan "0 koperasi di desa
 * ini" padahal yang sebenarnya terjadi adalah eKoperasi belum tersambung
 * menyampaikan kebohongan yang akan diulang pemerintah desa kepada warganya.
 */

export interface HasilLuar<T> {
  /** Salah bila sistem mitranya belum tersambung. */
  tersedia: boolean;
  /**
   * Keterangan bila tidak tersedia. Bukan pesan galat — kalimat yang dapat
   * ditampilkan apa adanya kepada petugas.
   */
  keterangan?: string;
  data: T;
}

// --- eMedik ------------------------------------------------------------------

export interface JadwalPosyanduView {
  scheduleId: string;
  postName: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  activity: string;
  subAreaName?: string | null;
}

export interface IndikatorKesehatanView {
  code: string;
  label: string;
  period: string;
  /**
   * Nol bukan berarti tidak ada. Bila cacahnya di bawah ambang minimum
   * penyajian, nilainya `null` disertai `suppressed: true` — bukan angka kecil
   * yang dapat dibongkar menjadi orang tertentu.
   */
  value: number | null;
  suppressed: boolean;
  breakdown?: string | null;
}

export interface KampanyeKesehatanView {
  campaignId: string;
  title: string;
  summary: string;
  startDate: string;
  endDate: string;
}

/**
 * Kontrak paling berhati-hati di antara keempatnya, karena menyangkut data
 * kesehatan perorangan.
 *
 * Tidak ada metode untuk rekam medis, diagnosis, riwayat kunjungan seseorang,
 * hasil pemeriksaan, resep, maupun daftar nama pasien.
 *
 * Ada satu keadaan sah ketika desa memerlukan data kesehatan perorangan:
 * pendataan penerima bantuan yang syaratnya kondisi kesehatan. Bahkan itu tidak
 * dilayani lewat port ini — warga menyerahkan sendiri surat keterangan dari
 * fasilitas kesehatan sebagai berkas persyaratan, lalu diverifikasi manusia.
 * Datanya datang dari **warga**, bukan dari sistem kesehatan. Itulah yang
 * membedakan warga menyerahkan datanya sendiri untuk keperluan yang ia ketahui,
 * dari pemerintah desa mengambil data kesehatan warganya tanpa ia tahu.
 */
export interface HealthAggregatePort {
  jadwalPosyandu(input: {
    villageUnitId: string;
    from: string;
    to: string;
  }): Promise<HasilLuar<JadwalPosyanduView[]>>;

  indikatorAgregat(input: {
    villageUnitId: string;
    period: string;
    breakdown?: 'SUB_AREA' | 'RW' | 'NONE';
  }): Promise<HasilLuar<IndikatorKesehatanView[]>>;

  /** Sasaran kegiatan: jumlah, bukan daftar nama. */
  cacahSasaran(input: {
    villageUnitId: string;
    programCode: string;
  }): Promise<HasilLuar<{ total: number; reached: number }>>;

  kampanyeAktif(villageUnitId: string): Promise<HasilLuar<KampanyeKesehatanView[]>>;
}

export const HEALTH_PORT = Symbol('VillageHealthAggregatePort');

// --- eKoperasi ---------------------------------------------------------------

export interface KoperasiRingkasView {
  cooperativeId: string;
  name: string;
  type: string;
  legalNumber?: string | null;
  memberCount?: number | null;
}

export interface KoperasiPublikView {
  cooperativeId: string;
  name: string;
  memberCount: number;
  businessSummary: string;
  lastReportPeriod: string;
}

export interface CooperativeIntegrationPort {
  koperasiDiDesa(villageUnitId: string): Promise<HasilLuar<KoperasiRingkasView[]>>;

  /** Ringkasan keanggotaan tingkat desa — jumlah, bukan daftar nama. */
  ringkasanKeanggotaan(input: {
    villageUnitId: string;
    period: string;
  }): Promise<HasilLuar<{ memberCount: number; activeCount: number; newThisPeriod: number }>>;

  /**
   * Apakah seorang penduduk anggota koperasi tertentu.
   *
   * Dipakai saat penduduk diusulkan menerima bantuan modal usaha, agar bantuan
   * yang sama tidak diterima dua kali dari dua jalur. Mengembalikan **boolean**,
   * bukan data keanggotaannya: pertanyaannya "apakah", bukan "apa".
   *
   * `purpose` sengaja diwajibkan. Nilainya masuk ke jejak audit di kedua sisi,
   * dan pemeriksaan yang dilakukan tanpa keperluan yang dinyatakan adalah
   * pemeriksaan yang tidak dapat dipertanggungjawabkan kemudian.
   */
  apakahAnggota(input: {
    residentNationalId: string;
    cooperativeId: string;
    purpose: 'AID_DUPLICATE_CHECK';
  }): Promise<HasilLuar<{ isMember: boolean; checkedAt: string }>>;

  kinerjaPublik(cooperativeId: string): Promise<HasilLuar<KoperasiPublikView | null>>;
}

export const COOPERATIVE_PORT = Symbol('VillageCooperativeIntegrationPort');

// --- POS Core ----------------------------------------------------------------

export interface PenjualanProdukView {
  productName: string;
  quantity: number;
  grossSales: string;
}

/**
 * Hanya membaca.
 *
 * Village tidak memanggil penjualan, tidak membuka shift, dan tidak menyentuh
 * stok. Unit usaha BUMDes yang berjualan memakai POS sebagaimana penyewa lain;
 * village membaca ringkasannya untuk laporan dan transparansi. Perintah §3
 * melarang mengubah perilaku POS, dan port yang hanya membaca memenuhinya
 * dengan sendirinya.
 */
export interface PosIntegrationPort {
  ringkasanPenjualan(input: {
    outletId: string;
    from: string;
    to: string;
  }): Promise<HasilLuar<{ transactionCount: number; grossSales: string; currency: string }>>;

  produkTerlaris(input: {
    outletId: string;
    period: string;
    limit: number;
  }): Promise<HasilLuar<PenjualanProdukView[]>>;

  /** Menautkan unit usaha BUMDes ke outlet POS yang sudah ada. Tidak membuatnya. */
  tautkanUnitUsaha(input: {
    bumdesUnitId: string;
    outletId: string;
  }): Promise<HasilLuar<{ linked: boolean }>>;
}

export const POS_PORT = Symbol('VillagePosIntegrationPort');

// --- Marketplace -------------------------------------------------------------

export interface ListingRingkasView {
  listingId: string;
  title: string;
  status: string;
  priceDisplay?: string | null;
}

/**
 * Menautkan, tidak membuat.
 *
 * Tidak ada metode untuk membuat listing, dan alasannya bukan teknis: produk
 * yang didaftarkan pemerintah desa atas nama warga menimbulkan pertanyaan siapa
 * yang bertanggung jawab bila produknya bermasalah. Pelaku usaha mendaftarkan
 * produknya sendiri lewat jalur marketplace yang sudah ada; village hanya
 * menautkan profil usahanya.
 */
export interface MarketplaceLinkPort {
  /** Memastikan listing itu ada dan memang milik pelaku usaha yang menautkan. */
  periksaListing(input: {
    listingId: string;
    ownerUserId: string;
  }): Promise<HasilLuar<ListingRingkasView | null>>;

  listingPelakuUsaha(ownerUserId: string): Promise<HasilLuar<ListingRingkasView[]>>;
}

export const MARKETPLACE_PORT = Symbol('VillageMarketplaceLinkPort');

// --- Daftar metode yang sah --------------------------------------------------

/**
 * Metode yang boleh ada pada tiap port.
 *
 * Dijaga pengujian. Aturan yang hanya tertulis di dokumen akan dilanggar suatu
 * hari oleh orang yang belum pernah membacanya; daftar yang diuji akan
 * menggagalkan berkasnya pada hari yang sama.
 */
export const METODE_SAH = {
  HEALTH: ['jadwalPosyandu', 'indikatorAgregat', 'cacahSasaran', 'kampanyeAktif'],
  COOPERATIVE: ['koperasiDiDesa', 'ringkasanKeanggotaan', 'apakahAnggota', 'kinerjaPublik'],
  POS: ['ringkasanPenjualan', 'produkTerlaris', 'tautkanUnitUsaha'],
  MARKETPLACE: ['periksaListing', 'listingPelakuUsaha'],
} as const;

/**
 * Metode yang **tidak boleh** ada, betapapun masuk akal permintaannya kelak.
 *
 * Daftar ini bukan hiasan. Ia yang diperiksa pengujian ketika seseorang
 * menambahkan metode baru dengan nama yang terdengar tidak berbahaya.
 */
export const METODE_TERLARANG = [
  'rekamMedis',
  'medicalRecord',
  'diagnosis',
  'riwayatKunjungan',
  'visitHistory',
  'hasilPemeriksaan',
  'resep',
  'prescription',
  'daftarPasien',
  'patientList',
  'saldoSimpanan',
  'savingsBalance',
  'riwayatPinjaman',
  'loanHistory',
  'tunggakan',
  'arrears',
  'buatListing',
  'createListing',
  'jual',
  'sell',
  'bukaShift',
  'openShift',
  'sesuaikanStok',
  'adjustStock',
] as const;
