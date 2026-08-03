/**
 * H-9K — Dasbor investor agregat, waterfall, dan distribusi.
 *
 * Aturan sebagai fungsi murni. Tidak menyentuh basis data.
 *
 * Modul ini dibangun di sekitar satu kalimat, dan kalimat itu diambil harfiah
 * dari dokumen [16](../../../../docs/emedik/16-investor-data-access-policy.md):
 *
 * > "Satu pasien HIV pada bulan Maret di Poliklinik Kulit" adalah kalimat
 * > agregat yang menyebut seseorang.
 *
 * Agregat tidak menjadi aman karena ia agregat. Ia menjadi aman ketika
 * penyebutnya cukup besar sehingga tidak ada seorang pun yang dapat dikenali di
 * dalamnya — dan itulah satu-satunya hal yang ditegakkan berkas ini dengan
 * keras.
 *
 * Dua akibat yang menentukan bentuknya:
 *
 * 1. **Angka yang kohortnya terlalu kecil DISEMBUNYIKAN, dan yang ditampilkan
 *    adalah keterangan bahwa ia disembunyikan** — bukan nol. Menampilkan nol
 *    membuat investor menyimpulkan tidak ada pasiennya, dan itu kebohongan yang
 *    berbeda dari kerahasiaan.
 *
 * 2. **Daftar medan yang boleh dilihat bersifat TERTUTUP.** Bukan daftar yang
 *    dilarang, melainkan daftar yang diizinkan. Daftar larangan selalu tertinggal
 *    satu langkah di belakang medan yang baru ditambahkan seseorang.
 */

// --- Medan yang boleh dilihat ------------------------------------------------

/**
 * Medan agregat yang boleh dilihat investor. **Daftar tertutup.**
 *
 * Ditulis sebagai daftar izin, bukan daftar larangan. Daftar larangan menuntut
 * seseorang mengingat untuk menambahkannya setiap kali ada medan baru — dan
 * medan baru ditambahkan oleh orang yang sedang memikirkan hal lain.
 */
export const MEDAN_INVESTOR = [
  'registrationCount',
  'encounterCount',
  'payerMix',
  'grossRevenue',
  'netRevenue',
  'claimsSubmitted',
  'claimsApproved',
  'claimsPaid',
  'claimsReceivable',
  'bedOccupancy',
  'averageLengthOfStay',
  'serviceUtilization',
  'deviceUtilization',
  'marginPerUnit',
  'cashFlow',
  'capitalExpenditure',
  'breakEvenPoint',
  'distribution',
] as const;

export type MedanInvestor = (typeof MEDAN_INVESTOR)[number];

const IZIN = new Set<string>(MEDAN_INVESTOR);

/**
 * Menyaring proyeksi sehingga hanya medan yang diizinkan yang tersisa.
 *
 * Mengembalikan pula apa yang dibuangnya. Penyaring yang membuang diam-diam
 * tidak dapat diuji: naskah bukti tidak dapat membedakan medan yang dibuang
 * dari medan yang memang tidak pernah ada.
 */
export function saringMedan<T extends Record<string, unknown>>(
  proyeksi: T,
): { data: Record<string, unknown>; dibuang: string[] } {
  const data: Record<string, unknown> = {};
  const dibuang: string[] = [];
  for (const [k, v] of Object.entries(proyeksi)) {
    if (IZIN.has(k)) data[k] = v;
    else dibuang.push(k);
  }
  return { data, dibuang };
}

/**
 * Nama medan yang, bila muncul pada proyeksi investor, menandakan kekeliruan
 * yang serius — bukan sekadar medan berlebih.
 *
 * Dipisahkan dari `saringMedan` dengan sengaja: yang pertama membersihkan, yang
 * kedua **berteriak**. Medan bernama `patientName` yang lolos ke proyeksi
 * investor bukan hal yang cukup dibuang diam-diam; ia pertanda ada jalur yang
 * salah arah, dan jalur itu perlu diperbaiki hari itu juga.
 */
export const MEDAN_TERLARANG = [
  'patientName',
  'patientId',
  'nik',
  'medicalRecordNumber',
  'diagnosis',
  'diagnosisCode',
  'clinicalNote',
  'prescription',
  'labResult',
  'imagingStudy',
  'patientAddress',
  'patientPhone',
  'patientEmail',
  'birthDate',
] as const;

const TERLARANG = new Set<string>(MEDAN_TERLARANG);

export function periksaMedanTerlarang(proyeksi: Record<string, unknown>): {
  bersih: boolean;
  ditemukan: string[];
  pesan: string;
} {
  const ditemukan = Object.keys(proyeksi).filter((k) => TERLARANG.has(k));
  return {
    bersih: ditemukan.length === 0,
    ditemukan,
    pesan:
      ditemukan.length === 0
        ? 'Proyeksi tidak memuat satu pun medan tingkat pasien.'
        : `Proyeksi memuat medan tingkat pasien: ${ditemukan.join(', ')}. Ini bukan medan ` +
          'berlebih yang cukup dibuang; ia pertanda ada jalur yang salah arah. Investor ' +
          'adalah pihak luar yang memiliki kepentingan keuangan, bukan hubungan perawatan.',
  };
}

// --- Kohort minimum ----------------------------------------------------------

/**
 * Ambang kohort bawaan.
 *
 * **Tidak boleh nol**, dan itu ditegakkan `periksaAmbang` di bawah. Ambang nol
 * berarti tidak ada penyamaran sama sekali, dan konfigurasi yang mengizinkan
 * nol akan disetel nol oleh orang pertama yang terganggu oleh sel yang
 * tersembunyi.
 */
export const AMBANG_KOHORT_BAWAAN = 5;

export function periksaAmbang(ambang: number): { sah: boolean; alasan: string } {
  if (!Number.isInteger(ambang)) {
    return { sah: false, alasan: 'Ambang kohort harus bilangan bulat.' };
  }
  if (ambang < 1) {
    return {
      sah: false,
      alasan:
        'Ambang kohort tidak boleh nol atau negatif. Ambang nol berarti tidak ada penyamaran ' +
        'sama sekali — dan "satu pasien HIV pada bulan Maret di Poliklinik Kulit" adalah ' +
        'kalimat agregat yang menyebut seseorang.',
    };
  }
  return { sah: true, alasan: `Ambang kohort ${ambang}.` };
}

export type AlasanPenyamaran = 'BELOW_THRESHOLD' | 'COMPLEMENT_DISCLOSURE';

export interface SelAgregat {
  /** Kunci pemecahan, misalnya nama unit atau bulan. */
  kunci: string;
  /** Penyebut: berapa orang yang membentuk angka ini. */
  kohort: number;
  nilai: number | null;
}

export interface SelTersamar {
  kunci: string;
  kohort: number | null;
  nilai: number | null;
  tersamar: boolean;
  alasan: AlasanPenyamaran | null;
  keterangan: string;
}

/**
 * Menyamarkan sel yang kohortnya di bawah ambang.
 *
 * Dua hal yang membedakannya dari penyamaran yang naif:
 *
 * 1. **Yang disamarkan tidak menjadi nol.** Nilainya `null`, penanda
 *    `tersamar` bernilai benar, dan keterangannya menyebutkan sebabnya.
 *    Menampilkan nol akan membuat pembacanya menyimpulkan tidak ada pasiennya.
 *
 * 2. **Kohortnya ikut disamarkan.** Menyembunyikan nilainya tetapi menampilkan
 *    "n = 2" tidak menyembunyikan apa pun yang penting: yang berbahaya justru
 *    penyebutnya.
 */
export function samarkan(sel: SelAgregat[], ambang: number): SelTersamar[] {
  const izin = periksaAmbang(ambang);
  if (!izin.sah) throw new Error(izin.alasan);

  const hasil: SelTersamar[] = sel.map((s) =>
    s.kohort < ambang
      ? {
          kunci: s.kunci,
          kohort: null,
          nilai: null,
          tersamar: true,
          alasan: 'BELOW_THRESHOLD' as const,
          keterangan:
            `Disembunyikan: kohortnya di bawah ambang ${ambang}. Angkanya BUKAN nol — ` +
            'ia ada, tetapi menampilkannya akan menyingkap seseorang.',
        }
      : {
          kunci: s.kunci,
          kohort: s.kohort,
          nilai: s.nilai,
          tersamar: false,
          alasan: null,
          keterangan: '',
        },
  );

  /*
   * PENYAMARAN PELENGKAP.
   *
   * Bila hanya SATU sel yang tersamar sedangkan totalnya diketahui, sel itu
   * dapat dihitung kembali dengan pengurangan — dan penyamarannya menjadi
   * hiasan. Karena itu sel tampak terkecil ikut disamarkan.
   *
   * Ini bagian yang paling mudah dilupakan, dan ia yang membedakan penyamaran
   * yang bekerja dari penyamaran yang hanya terlihat bekerja.
   */
  const tersamar = hasil.filter((h) => h.tersamar);
  if (tersamar.length === 1) {
    const terbuka = hasil
      .filter((h) => !h.tersamar)
      .sort((a, b) => (a.kohort ?? 0) - (b.kohort ?? 0));
    if (terbuka.length > 0) {
      const korban = terbuka[0];
      korban.kohort = null;
      korban.nilai = null;
      korban.tersamar = true;
      korban.alasan = 'COMPLEMENT_DISCLOSURE';
      korban.keterangan =
        'Disembunyikan pula: bila hanya satu sel yang tersamar sedangkan totalnya diketahui, ' +
        'sel itu dapat dihitung kembali dengan pengurangan — dan penyamarannya menjadi hiasan.';
    }
  }

  return hasil;
}

/**
 * Apakah satu angka gabungan boleh ditampilkan?
 *
 * Total keseluruhan tidak menuntut kohort minimum yang sama dengan sel yang
 * dipecah: total seluruh rumah sakit tidak menyingkap siapa pun. Yang menuntut
 * penyamaran adalah **pemecahannya**.
 */
export function bolehTampilkanTotal(kohortTotal: number, ambang: number): boolean {
  return kohortTotal >= ambang;
}

// --- Waterfall dan distribusi ------------------------------------------------

export type LapisanWaterfall =
  | 'OPERATING_COST'
  | 'DEBT_SERVICE'
  | 'RESERVE'
  | 'PREFERRED_RETURN'
  | 'CAPITAL_RETURN'
  | 'PROFIT_SHARE';

export interface Lapisan {
  jenis: LapisanWaterfall;
  urutan: number;
  /** Nilai tetap, bila lapisan ini berupa jumlah. */
  jumlah?: number | null;
  /** Persentase, bila lapisan ini berupa bagian. */
  persen?: number | null;
}

export interface HasilLapisan {
  jenis: LapisanWaterfall;
  urutan: number;
  diminta: number;
  dibayar: number;
  kurang: number;
  sisaSesudah: number;
  keterangan: string;
}

/**
 * Menghitung waterfall.
 *
 * Tiga aturan yang menentukan bentuknya:
 *
 * 1. **Urutan lapisan mengikat.** Lapisan yang lebih dahulu dipenuhi lebih
 *    dahulu, dan yang berikutnya hanya menerima sisanya. Waterfall yang
 *    membagi rata ketika dananya kurang bukan waterfall.
 *
 * 2. **Tidak ada lapisan yang boleh negatif.** Kekurangan dicatat sebagai
 *    `kurang`, bukan sebagai pembayaran negatif kepada lapisan berikutnya.
 *
 * 3. **Persentase dihitung terhadap SISA saat itu**, bukan terhadap nilai awal.
 *    Menghitungnya terhadap nilai awal akan membuat jumlah seluruh lapisan
 *    melampaui dana yang ada, dan kelebihannya baru ketahuan ketika uangnya
 *    hendak dipindahkan.
 */
export function hitungWaterfall(
  dana: number,
  lapisan: Lapisan[],
): { lapisan: HasilLapisan[]; sisaAkhir: number; adaKekurangan: boolean } {
  if (dana < 0) throw new Error('Dana yang dibagikan tidak boleh negatif.');

  let sisa = dana;
  const hasil: HasilLapisan[] = [];

  for (const l of [...lapisan].sort((a, b) => a.urutan - b.urutan)) {
    const diminta =
      l.jumlah != null
        ? l.jumlah
        : l.persen != null
          ? bulatkan((sisa * l.persen) / 100)
          : 0;
    const dibayar = Math.min(Math.max(diminta, 0), sisa);
    const kurang = bulatkan(Math.max(diminta - dibayar, 0));
    sisa = bulatkan(sisa - dibayar);
    hasil.push({
      jenis: l.jenis,
      urutan: l.urutan,
      diminta: bulatkan(diminta),
      dibayar: bulatkan(dibayar),
      kurang,
      sisaSesudah: sisa,
      keterangan:
        kurang > 0
          ? `Kurang ${kurang}. Lapisan berikutnya tidak menerima apa pun sampai lapisan ini ` +
            'terpenuhi — itulah arti urutan pada waterfall.'
          : 'Terpenuhi.',
    });
  }

  return {
    lapisan: hasil,
    sisaAkhir: sisa,
    adaKekurangan: hasil.some((h) => h.kurang > 0),
  };
}

function bulatkan(n: number): number {
  return Math.round(n * 100) / 100;
}

// --- Kontrak dan persetujuan distribusi --------------------------------------

/**
 * Tanpa kontrak investor yang AKTIF, bagian investor bernilai **nol**.
 *
 * Nol, bukan "belum dihitung" dan bukan galat. Sama seperti H-9G: keadaan
 * bawaan seluruh fasilitas adalah tanpa kontrak, dan keadaan bawaan itu harus
 * dapat dicatat sebagai angka.
 */
export function bagianInvestor(input: {
  adaKontrakAktif: boolean;
  persenKontrak: number | null;
  batasMaksimum: number | null;
}): { persen: number; dibatasi: boolean; alasan: string } {
  if (!input.adaKontrakAktif) {
    return {
      persen: 0,
      dibatasi: false,
      alasan:
        'Tanpa kontrak investor yang aktif, bagian investor bernilai NOL. Bukan galat, dan ' +
        'bukan "belum dihitung" — nol adalah jawaban yang benar bagi fasilitas yang memang ' +
        'tidak berkontrak.',
    };
  }
  const diminta = input.persenKontrak ?? 0;
  if (input.batasMaksimum != null && diminta > input.batasMaksimum) {
    return {
      persen: input.batasMaksimum,
      dibatasi: true,
      alasan:
        `Dibatasi kontrak pada ${input.batasMaksimum}%. Batas yang hanya tertulis pada ` +
        'kontrak akan dilampaui oleh perhitungan yang tidak pernah membacanya.',
    };
  }
  return { persen: diminta, dibatasi: false, alasan: 'Sesuai kontrak.' };
}

export type StatusDistribusi =
  | 'CALCULATED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PAID'
  | 'CANCELLED';

/**
 * Bolehkah distribusi dibayarkan?
 *
 * **Tidak ada pembayaran otomatis**, dan yang menghitung tidak menyetujui.
 * Uang yang berpindah berdasarkan angka yang keliru sulit ditarik kembali, dan
 * investor yang sudah menerimanya punya alasan untuk tidak mengembalikannya.
 */
export function bolehBayarDistribusi(input: {
  status: StatusDistribusi;
  dihitungOleh: string | null;
  disetujuiOleh: string | null;
  dibayarOleh: string | null;
  adaKontrakAktif: boolean;
}): { boleh: boolean; alasan: string } {
  if (!input.adaKontrakAktif) {
    return {
      boleh: false,
      alasan:
        'Tidak ada kontrak investor yang aktif. Distribusi tanpa kontrak adalah pemindahan ' +
        'uang yang tidak dapat dijelaskan kepada siapa pun yang bertanya kemudian.',
    };
  }
  if (input.status !== 'APPROVED') {
    return {
      boleh: false,
      alasan:
        `Distribusi berstatus ${input.status}; hanya yang APPROVED dapat dibayarkan. Tidak ` +
        'ada pembayaran otomatis pada jalur ini — persetujuan manusia adalah satu-satunya ' +
        'cara sebuah distribusi berpindah dari angka menjadi uang.',
    };
  }
  if (!input.disetujuiOleh) {
    return { boleh: false, alasan: 'Distribusi yang disetujui wajib bernama penyetujunya.' };
  }
  if (input.dihitungOleh && input.disetujuiOleh === input.dihitungOleh) {
    return {
      boleh: false,
      alasan:
        'Yang menghitung distribusi tidak menyetujuinya sendiri. Persetujuan oleh penghitungnya ' +
        'hanya membaca ulang angkanya sendiri — dan angka yang keliru masih tampak benar ' +
        'baginya, sebab ia yang membuatnya.',
    };
  }
  if (input.dibayarOleh && input.disetujuiOleh === input.dibayarOleh) {
    return {
      boleh: false,
      alasan:
        'Yang menyetujui distribusi tidak membayarkannya sendiri. Persetujuan yang langsung ' +
        'menjadi transfer menghilangkan jeda terakhir sebelum uang berpindah, dan jeda itu ' +
        'satu-satunya kesempatan bagi orang ketiga untuk melihat angkanya.',
    };
  }
  return { boleh: true, alasan: 'Distribusi boleh dibayarkan.' };
}

// --- Data contoh -------------------------------------------------------------

/**
 * Akun investor contoh hanya melihat data **sintetis**.
 *
 * Agregat dari data nyata tetap dapat menyingkap sesuatu ketika penyebutnya
 * kecil, dan demo dijalankan pada fasilitas yang penyebutnya selalu kecil.
 */
export function bolehLihatProyeksi(input: {
  akunContoh: boolean;
  proyeksiSintetis: boolean;
}): { boleh: boolean; alasan: string } {
  if (input.akunContoh && !input.proyeksiSintetis) {
    return {
      boleh: false,
      alasan:
        'Akun investor contoh hanya melihat data sintetis. Agregat dari data nyata tetap dapat ' +
        'menyingkap sesuatu ketika penyebutnya kecil — dan demo dijalankan justru pada ' +
        'fasilitas yang penyebutnya selalu kecil.',
    };
  }
  return { boleh: true, alasan: 'Boleh.' };
}

/**
 * Ringkasan alasan penyamaran pada satu proyeksi.
 *
 * Dilaporkan kepada investor apa adanya. Dasbor yang menyembunyikan sesuatu
 * **tanpa mengatakan bahwa ia menyembunyikan** akan dipercaya sebagai gambaran
 * lengkap, dan kesimpulan yang ditarik darinya akan keliru dengan cara yang
 * tidak disadari siapa pun.
 */
export function ringkasPenyamaran(sel: SelTersamar[]): {
  total: number;
  tersamar: number;
  ditampilkan: number;
  keterangan: string;
} {
  const tersamar = sel.filter((s) => s.tersamar).length;
  return {
    total: sel.length,
    tersamar,
    ditampilkan: sel.length - tersamar,
    keterangan:
      tersamar === 0
        ? 'Tidak ada sel yang disembunyikan.'
        : `${tersamar} dari ${sel.length} sel disembunyikan karena kohortnya terlalu kecil. ` +
          'Angkanya BUKAN nol. Dasbor yang menyembunyikan tanpa mengatakan bahwa ia ' +
          'menyembunyikan akan dipercaya sebagai gambaran lengkap.',
  };
}
