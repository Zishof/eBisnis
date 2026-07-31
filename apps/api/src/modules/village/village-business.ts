/**
 * Aturan usaha desa — BUMDes, UMKM, dan wisata. Fungsi murni, tanpa basis data.
 *
 * ## BUMDes adalah badan hukum tersendiri, dan itu menentukan seluruhnya
 *
 * Desa menyertakan modal; ia tidak "punya kas BUMDes". Yang membedakan bukan
 * istilah melainkan akibatnya:
 *
 * | | Unit kerja desa | BUMDes |
 * |---|---|---|
 * | Kerugiannya | Menjadi beban APBDes | Terbatas pada modal yang disertakan |
 * | Utangnya | Utang desa | **Bukan utang desa** |
 * | Labanya | Pendapatan desa seluruhnya | Dibagi menurut anggaran dasarnya |
 * | Pembukuannya | Bagian APBDes | Terpisah |
 *
 * Baris kedua yang paling penting, dan yang paling sering hilang ketika sebuah
 * sistem memperlakukan BUMDes sebagai "unit di dalam desa". Begitu kerugian
 * BUMDes dapat mengalir kembali menjadi angka negatif pada APBDes, pemisahan
 * badan hukumnya sudah runtuh — bukan lewat keputusan, melainkan lewat satu
 * baris pembukuan.
 *
 * ## Bagi hasil ditetapkan sebelum labanya diketahui
 *
 * Persentase bagian desa berasal dari anggaran dasar dan peraturan desa, dan
 * dicuplik ke laporan hasil usaha saat laporan itu dibuat. Menentukan
 * pembagian setelah melihat angkanya adalah cara angkanya dirundingkan.
 */

export type Putusan = {
  boleh: boolean;
  alasan?: string;
};

// --- BUMDes ------------------------------------------------------------------

export type StatusBumdes = 'DIRENCANAKAN' | 'BERDIRI' | 'AKTIF' | 'TIDAK_AKTIF' | 'BUBAR';

export const TRANSISI_BUMDES: Record<StatusBumdes, StatusBumdes[]> = {
  DIRENCANAKAN: ['BERDIRI'],
  BERDIRI: ['AKTIF', 'BUBAR'],
  AKTIF: ['TIDAK_AKTIF', 'BUBAR'],
  TIDAK_AKTIF: ['AKTIF', 'BUBAR'],
  // Pembubaran BUMDes memerlukan musyawarah desa dan peraturan desa
  // tersendiri, serta penyelesaian kewajibannya. Ia tidak berdiri kembali
  // dengan menekan tombol.
  BUBAR: [],
};

export function bolehPindahBumdes(dari: StatusBumdes, ke: StatusBumdes): Putusan {
  if (dari === ke) return { boleh: false, alasan: `BUMDes sudah berstatus ${dari}.` };
  if (!TRANSISI_BUMDES[dari].length) {
    return {
      boleh: false,
      alasan:
        'BUMDes yang sudah bubar tidak dapat diaktifkan kembali. Pendirian baru memerlukan ' +
        'musyawarah desa dan peraturan desa tersendiri.',
    };
  }
  if (!TRANSISI_BUMDES[dari].includes(ke)) {
    return { boleh: false, alasan: `BUMDes berstatus ${dari} tidak dapat langsung menjadi ${ke}.` };
  }
  return { boleh: true };
}

export interface PendirianBumdes {
  profil: 'DESA' | 'KELURAHAN';
  /** Peraturan desa tentang pendirian BUMDes. */
  nomorPerdes: string;
  /** Anggaran dasar dan anggaran rumah tangga. */
  adArtDitetapkan: boolean;
  /** Persentase laba yang menjadi pendapatan asli desa. */
  bagianDesaPersen: number;
}

/**
 * Bolehkah BUMDes didirikan?
 *
 * Kelurahan tidak dapat mendirikan BUMDes — bukan karena fiturnya belum dibuat,
 * melainkan karena kelurahan adalah perangkat daerah dan tidak berwenang
 * mendirikan badan usaha atas namanya sendiri.
 */
export function bolehDirikanBumdes(p: PendirianBumdes): Putusan {
  if (p.profil === 'KELURAHAN') {
    return {
      boleh: false,
      alasan:
        'Kelurahan tidak dapat mendirikan BUMDes. Kelurahan adalah perangkat daerah dan tidak ' +
        'berwenang mendirikan badan usaha atas namanya sendiri.',
    };
  }
  if (!p.nomorPerdes?.trim()) {
    return {
      boleh: false,
      alasan:
        'Nomor peraturan desa tentang pendirian wajib disebutkan. BUMDes tanpa perdes bukan badan ' +
        'usaha milik desa melainkan usaha yang kebetulan dikelola perangkat desa.',
    };
  }
  if (!p.adArtDitetapkan) {
    return {
      boleh: false,
      alasan:
        'Anggaran dasar dan anggaran rumah tangga harus ditetapkan terlebih dahulu. Di dalamnya ' +
        'diatur pembagian hasil usaha, dan pembagian yang belum diatur akan dirundingkan setelah ' +
        'labanya diketahui.',
    };
  }
  return periksaBagianDesa(p.bagianDesaPersen);
}

export function periksaBagianDesa(persen: number): Putusan {
  if (!Number.isFinite(persen) || persen < 0 || persen > 100) {
    return { boleh: false, alasan: 'Persentase bagian desa harus antara 0 dan 100.' };
  }
  if (persen === 100) {
    return {
      boleh: false,
      alasan:
        'Bagian desa 100 persen tidak menyisakan apa pun untuk pemupukan modal, cadangan, dan ' +
        'jasa pengurus. BUMDes yang seluruh labanya disetor tidak akan tumbuh, dan tahun ' +
        'berikutnya desa menyertakan modal lagi untuk hal yang sama.',
    };
  }
  return { boleh: true };
}

// --- Penyertaan modal --------------------------------------------------------

export interface PenyertaanModal {
  jumlah: number;
  /** Peraturan desa yang menjadi dasarnya. */
  nomorPerdes: string;
  /** Transaksi APBDes tempat uangnya benar-benar keluar. */
  budgetTransactionId?: string | null;
  statusBumdes: StatusBumdes;
}

/**
 * Bolehkah desa menyertakan modal sebesar ini?
 *
 * Wajib menunjuk transaksi APBDes-nya. Penyertaan modal yang tercatat pada
 * BUMDes tetapi tidak ada padanannya pada APBDes berarti salah satu dari dua
 * hal: uangnya belum keluar, atau uangnya keluar tanpa dicatat. Keduanya perlu
 * ketahuan sekarang, bukan saat pemeriksaan.
 *
 * Wajib pula menyebut perdes-nya. Penyertaan modal adalah pengeluaran
 * pembiayaan, dan pengeluaran pembiayaan tanpa dasar hukum bukan investasi
 * melainkan pemindahan uang yang tidak dapat dijelaskan.
 */
export function bolehSertakanModal(p: PenyertaanModal): Putusan {
  if (!Number.isFinite(p.jumlah) || p.jumlah <= 0) {
    return { boleh: false, alasan: 'Jumlah penyertaan modal harus lebih besar dari nol.' };
  }
  if (!p.nomorPerdes?.trim()) {
    return {
      boleh: false,
      alasan:
        'Nomor peraturan desa wajib disebutkan. Penyertaan modal tanpa dasar hukum bukan ' +
        'investasi melainkan pemindahan uang yang tidak dapat dijelaskan.',
    };
  }
  if (!p.budgetTransactionId) {
    return {
      boleh: false,
      alasan:
        'Penyertaan modal wajib menunjuk transaksi APBDes-nya. Modal yang tercatat pada BUMDes ' +
        'tanpa padanan pada APBDes berarti uangnya belum keluar, atau keluar tanpa dicatat.',
    };
  }
  if (p.statusBumdes === 'BUBAR') {
    return { boleh: false, alasan: 'BUMDes yang sudah bubar tidak dapat menerima penyertaan modal.' };
  }
  if (p.statusBumdes === 'DIRENCANAKAN') {
    return {
      boleh: false,
      alasan:
        'BUMDes belum berdiri. Tetapkan pendiriannya terlebih dahulu, agar penyertaan modal ' +
        'punya penerima yang berbadan hukum.',
    };
  }
  return { boleh: true };
}

// --- Hasil usaha -------------------------------------------------------------

export interface HasilUsaha {
  pendapatan: number;
  beban: number;
  /** Persentase bagian desa yang berlaku, dicuplik dari anggaran dasar. */
  bagianDesaPersen: number;
}

export interface PembagianHasil {
  labaKotor: number;
  labaBersih: number;
  bagianDesa: number;
  bagianBumdes: number;
  rugi: boolean;
  keterangan: string;
}

/**
 * Membagi hasil usaha BUMDes.
 *
 * **Kerugian tidak pernah menjadi bagian desa yang negatif.** Bila BUMDes rugi,
 * bagian desa nol — bukan angka minus yang mengurangi APBDes. Kerugian BUMDes
 * ditanggung modalnya sendiri, dan itulah arti badan hukum yang terpisah.
 * Membiarkannya mengalir kembali sebagai angka negatif meruntuhkan pemisahan
 * itu lewat satu baris pembukuan, tanpa seorang pun memutuskannya.
 */
export function bagiHasil(h: HasilUsaha): PembagianHasil {
  const labaBersih = h.pendapatan - h.beban;

  if (labaBersih <= 0) {
    return {
      labaKotor: h.pendapatan,
      labaBersih,
      bagianDesa: 0,
      bagianBumdes: labaBersih,
      rugi: labaBersih < 0,
      keterangan:
        labaBersih < 0
          ? `BUMDes rugi ${rupiah(Math.abs(labaBersih))}. Bagian desa nol — kerugian ditanggung ` +
            'modal BUMDes, tidak mengurangi APBDes.'
          : 'Pendapatan sama dengan beban. Tidak ada yang dibagi.',
    };
  }

  const bagianDesa = bulatkanRupiah((labaBersih * h.bagianDesaPersen) / 100);
  return {
    labaKotor: h.pendapatan,
    labaBersih,
    bagianDesa,
    bagianBumdes: labaBersih - bagianDesa,
    rugi: false,
    keterangan:
      `Laba bersih ${rupiah(labaBersih)}. Bagian desa ${h.bagianDesaPersen} persen = ` +
      `${rupiah(bagianDesa)}, menjadi pendapatan asli desa.`,
  };
}

/**
 * Bolehkah laporan hasil usaha ditetapkan?
 *
 * Persentase yang dipakai wajib dicuplik ke laporannya. Laporan yang hanya
 * merujuk anggaran dasar akan berubah artinya ketika anggaran dasarnya diubah,
 * dan laporan tahun lalu yang berubah artinya bukan laporan.
 */
export function bolehTetapkanHasil(input: {
  bagianDesaPersenTercuplik?: number | null;
  periodeSelesai: boolean;
}): Putusan {
  if (!input.periodeSelesai) {
    return {
      boleh: false,
      alasan: 'Laporan hasil usaha hanya dapat ditetapkan setelah periodenya berakhir.',
    };
  }
  if (input.bagianDesaPersenTercuplik === null || input.bagianDesaPersenTercuplik === undefined) {
    return {
      boleh: false,
      alasan:
        'Persentase bagian desa yang berlaku wajib dicuplik ke laporan. Laporan yang hanya ' +
        'merujuk anggaran dasar akan berubah artinya ketika anggaran dasarnya diubah.',
    };
  }
  return { boleh: true };
}

// --- UMKM --------------------------------------------------------------------

export type SkalaUsaha = 'MIKRO' | 'KECIL' | 'MENENGAH';

/**
 * Menggolongkan skala usaha dari omzet tahunannya.
 *
 * Ambangnya mengikuti PP 7/2021 dan dapat berubah, karena itu ia parameter.
 * Yang tetap adalah bahwa penggolongannya dihitung, bukan diketik: skala yang
 * diisi sendiri oleh pelaku usaha akan mengikuti syarat bantuan yang sedang
 * dibuka, bukan mengikuti usahanya.
 */
export function skalaUsaha(
  omzetTahunan: number,
  ambang: { mikro: number; kecil: number } = { mikro: 2_000_000_000, kecil: 15_000_000_000 },
): SkalaUsaha {
  if (omzetTahunan <= ambang.mikro) return 'MIKRO';
  if (omzetTahunan <= ambang.kecil) return 'KECIL';
  return 'MENENGAH';
}

export interface TautanListing {
  /** Listing yang hendak ditautkan. */
  listingId: string;
  /** Pemilik listing menurut marketplace. */
  ownerUserId: string | null;
  /** Pemilik profil UMKM menurut desa. */
  umkmOwnerUserId: string | null;
  /** Salah bila marketplace belum tersambung. */
  tersedia: boolean;
}

/**
 * Bolehkah listing marketplace ditautkan ke profil UMKM ini?
 *
 * Desa **menautkan**, tidak membuat. Produk yang didaftarkan pemerintah desa
 * atas nama warga menimbulkan pertanyaan siapa yang bertanggung jawab bila
 * produknya bermasalah — dan pertanyaan itu muncul justru ketika keadaannya
 * sedang buruk.
 *
 * Karena itu listing hanya dapat ditautkan bila pemiliknya menurut marketplace
 * sama dengan pemilik profil UMKM menurut desa.
 */
export function bolehTautkanListing(t: TautanListing): Putusan {
  if (!t.tersedia) {
    return {
      boleh: false,
      alasan:
        'Marketplace belum tersambung sehingga kepemilikan listing tidak dapat diperiksa. ' +
        'Penautan ditunda — menautkan tanpa memeriksa berarti desa menjamin sesuatu yang tidak ' +
        'diketahuinya.',
    };
  }
  if (!t.ownerUserId) {
    return { boleh: false, alasan: 'Listing tidak ditemukan pada marketplace.' };
  }
  if (!t.umkmOwnerUserId) {
    return {
      boleh: false,
      alasan: 'Profil UMKM ini belum tertaut ke akun pelaku usahanya, sehingga kepemilikan tidak dapat dibandingkan.',
    };
  }
  if (t.ownerUserId !== t.umkmOwnerUserId) {
    return {
      boleh: false,
      alasan:
        'Listing ini bukan milik pelaku usaha yang bersangkutan. Desa menautkan produk milik ' +
        'warganya, bukan mendaftarkan produk atas namanya.',
    };
  }
  return { boleh: true };
}

// --- Wisata ------------------------------------------------------------------

export interface PenayanganWisata {
  namaPengelola?: string | null;
  kontakPengelola?: string | null;
  /** Tarif masuk. Nol berarti gratis, dan itu berbeda dari belum diisi. */
  tarifMasuk?: number | null;
  gratis: boolean;
  adaFoto: boolean;
}

/**
 * Bolehkah destinasi wisata ditayangkan pada situs desa?
 *
 * Dua syarat, keduanya karena penayangan adalah janji kepada orang yang belum
 * pernah datang:
 *
 * 1. **Wajib menyebut pengelolanya.** Destinasi tanpa pengelola yang ditayangkan
 *    sebagai tujuan wisata desa mengirim orang ke tempat yang tidak ada
 *    penanggung jawabnya.
 * 2. **Tarif wajib dinyatakan** — termasuk bila gratis. Destinasi yang
 *    ditayangkan tanpa tarif adalah destinasi yang tarifnya ditentukan di pintu
 *    masuk, berbeda-beda menurut penampilan yang datang.
 */
export function bolehTayangkanWisata(w: PenayanganWisata): Putusan {
  if (!w.namaPengelola?.trim()) {
    return {
      boleh: false,
      alasan:
        'Nama pengelola wajib diisi sebelum ditayangkan. Destinasi tanpa pengelola mengirim ' +
        'pengunjung ke tempat yang tidak ada penanggung jawabnya.',
    };
  }
  if (!w.kontakPengelola?.trim()) {
    return { boleh: false, alasan: 'Kontak pengelola wajib diisi sebelum ditayangkan.' };
  }
  if (!w.gratis && !(Number(w.tarifMasuk) > 0)) {
    return {
      boleh: false,
      alasan:
        'Tarif masuk wajib dinyatakan, atau tandai destinasi ini gratis. Destinasi yang ' +
        'ditayangkan tanpa tarif adalah destinasi yang tarifnya ditentukan di pintu masuk.',
    };
  }
  if (w.gratis && Number(w.tarifMasuk) > 0) {
    return {
      boleh: false,
      alasan: 'Destinasi ditandai gratis tetapi tarif masuknya diisi. Pilih salah satu.',
    };
  }
  if (!w.adaFoto) {
    return {
      boleh: false,
      alasan: 'Sekurang-kurangnya satu foto diperlukan sebelum destinasi ditayangkan.',
    };
  }
  return { boleh: true };
}

// --- Bagian dalam ------------------------------------------------------------

function rupiah(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

/** Pembulatan ke rupiah penuh. Sen tidak dipakai pada pembukuan desa. */
function bulatkanRupiah(n: number): number {
  return Math.round(n);
}
