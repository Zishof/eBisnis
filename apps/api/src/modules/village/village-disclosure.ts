/**
 * Aturan transparansi dan keterbukaan informasi — fungsi murni.
 *
 * ## Agregat tidak boleh dapat dibongkar menjadi perorangan
 *
 * Menekan sel yang isinya sedikit **tidak cukup**, dan inilah kekeliruan yang
 * paling sering terjadi pada laporan pemerintahan. Perhatikan tabel ini:
 *
 * | RT | Penerima bantuan |
 * |---|---|
 * | 001 | 12 |
 * | 002 | 9 |
 * | 003 | — *(ditekan, di bawah ambang)* |
 * | **Jumlah** | **24** |
 *
 * RT 003 berisi 3 orang, dan siapa pun dapat menghitungnya: 24 − 12 − 9.
 * Penekanan yang hanya satu sel bersama total yang tetap ditayangkan bukan
 * penekanan — ia pengumuman dengan langkah tambahan.
 *
 * Karena itu penekanan di sini **berpasangan**: begitu satu sel ditekan dan
 * totalnya ikut tayang, sel kedua ikut ditekan. Dan bila jumlah yang
 * tersembunyi masih di bawah ambang, penekanan diteruskan — sebab mengetahui
 * "dua RT ini bersama-sama berisi 2 orang" hampir sama buruknya dengan
 * mengetahui masing-masing.
 *
 * ## Ambang tidak boleh diturunkan setelah laporan terbit
 *
 * Laporan yang terbit dengan ambang 5 lalu diterbitkan ulang dengan ambang 3
 * membuka sel yang tadinya ditekan — dan siapa pun yang menyimpan versi
 * pertama kini memegang keduanya. Menurunkan ambang bukan penyesuaian; ia
 * penerbitan surut atas apa yang pernah dinyatakan tidak boleh terbit.
 */

export type Putusan = {
  boleh: boolean;
  alasan?: string;
};

// --- Penekanan penyajian -----------------------------------------------------

/**
 * Ambang minimum penyajian bawaan.
 *
 * Lima adalah nilai yang lazim dipakai lembaga statistik, dan alasannya
 * praktis: pada cacah empat ke bawah, orang yang mengenal wilayahnya sering
 * dapat menebak siapa saja mereka tanpa perlu menghitung apa pun.
 */
export const AMBANG_BAWAAN = 5;

export interface SelAgregat {
  kunci: string;
  cacah: number;
}

export type SebabTekan = 'DI_BAWAH_AMBANG' | 'PELENGKAP' | 'SISA_TERLALU_KECIL';

export interface SelTersaji {
  kunci: string;
  /** `null` bila ditekan. */
  nilai: number | null;
  ditekan: boolean;
  sebab?: SebabTekan;
}

export interface HasilPenyajian {
  ambang: number;
  sel: SelTersaji[];
  /** Total seluruh sel. Ditayangkan hanya bila `totalAman`. */
  total: number;
  totalAman: boolean;
  jumlahDitekan: number;
  /** Cacah yang tersembunyi di balik seluruh sel yang ditekan. */
  sisaTersembunyi: number;
  keterangan: string;
}

/**
 * Menyajikan tabel agregat dengan penekanan yang tidak dapat dibongkar.
 *
 * Langkahnya:
 *
 * 1. **Penekanan utama** — sel bercacah 1 sampai `ambang − 1` ditekan.
 *    Nol tidak ditekan: ia tidak menyebut siapa pun, dan menekannya justru
 *    menandai bahwa di sana ada sesuatu.
 * 2. **Penekanan pelengkap** — bila totalnya ikut tayang dan hanya satu sel
 *    yang ditekan, sel terkecil berikutnya ikut ditekan. Tanpa langkah ini, sel
 *    pertama dapat dihitung dengan pengurangan.
 * 3. **Penekanan lanjutan** — selama cacah yang tersembunyi masih di bawah
 *    ambang, sel terkecil berikutnya ikut ditekan.
 *
 * Yang dipilih pada langkah 2 dan 3 adalah sel **terkecil** di antara yang
 * masih tayang: ia yang paling sedikit menghilangkan informasi bagi pembaca.
 */
export function sajikan(
  sel: SelAgregat[],
  opsi: { ambang?: number; tampilkanTotal?: boolean } = {},
): HasilPenyajian {
  const ambang = opsi.ambang ?? AMBANG_BAWAAN;
  const tampilkanTotal = opsi.tampilkanTotal ?? true;
  const total = sel.reduce((n, s) => n + s.cacah, 0);

  const keadaan = sel.map((s) => ({
    kunci: s.kunci,
    cacah: s.cacah,
    ditekan: s.cacah > 0 && s.cacah < ambang,
    sebab: (s.cacah > 0 && s.cacah < ambang ? 'DI_BAWAH_AMBANG' : undefined) as
      | SebabTekan
      | undefined,
  }));

  const tersembunyi = () =>
    keadaan.filter((k) => k.ditekan).reduce((n, k) => n + k.cacah, 0);
  const cacahDitekan = () => keadaan.filter((k) => k.ditekan).length;

  if (tampilkanTotal && cacahDitekan() > 0) {
    // Langkah 2 dan 3 digabung: teruskan menekan selama tabelnya masih dapat
    // dibongkar, yaitu selama hanya satu sel yang ditekan atau selama yang
    // tersembunyi masih di bawah ambang.
    let aman = false;
    while (!aman) {
      const kurangPasangan = cacahDitekan() < 2;
      const sisaKecil = tersembunyi() < ambang;
      if (!kurangPasangan && !sisaKecil) {
        aman = true;
        break;
      }

      const calon = keadaan
        .filter((k) => !k.ditekan)
        .sort((a, b) => a.cacah - b.cacah || a.kunci.localeCompare(b.kunci))[0];
      if (!calon) break; // Seluruhnya sudah ditekan.

      calon.ditekan = true;
      calon.sebab = kurangPasangan ? 'PELENGKAP' : 'SISA_TERLALU_KECIL';
    }
  }

  const sisa = tersembunyi();
  const ditekan = cacahDitekan();

  // Total hanya aman bila tidak ada yang ditekan, atau bila yang tersembunyi
  // sudah cukup banyak dan tersebar pada dua sel atau lebih.
  const totalAman = tampilkanTotal && (ditekan === 0 || (ditekan >= 2 && sisa >= ambang));

  return {
    ambang,
    total,
    totalAman,
    jumlahDitekan: ditekan,
    sisaTersembunyi: sisa,
    sel: keadaan.map((k) => ({
      kunci: k.kunci,
      nilai: k.ditekan ? null : k.cacah,
      ditekan: k.ditekan,
      sebab: k.sebab,
    })),
    keterangan:
      ditekan === 0
        ? `Seluruh sel memenuhi ambang ${ambang}.`
        : `${ditekan} sel ditekan; ${sisa} orang tersembunyi di baliknya. ` +
          (totalAman
            ? 'Jumlah keseluruhan tetap ditayangkan karena tidak dapat dibongkar.'
            : 'Jumlah keseluruhan ikut ditahan agar sel yang ditekan tidak dapat dihitung.'),
  };
}

/**
 * Bentuk yang boleh keluar ke publik.
 *
 * **`sebab` dibuang.** Ia berguna bagi petugas yang menyusun laporan — ia
 * menjelaskan mengapa sebuah sel hilang — tetapi pada halaman publik ia
 * membocorkan persis yang hendak disembunyikan: sel bertanda
 * `DI_BAWAH_AMBANG` adalah sel yang isinya kurang dari ambang, dan pembaca yang
 * melihatnya sudah tahu jauh lebih banyak daripada yang seharusnya.
 *
 * Kekeliruan ini tidak terlihat pada tampilan tabelnya. Ia terlihat pada
 * jawaban API yang dibaca siapa pun.
 */
export function sajikanPublik(h: HasilPenyajian): {
  ambang: number;
  sel: Array<{ kunci: string; nilai: number | null; ditekan: boolean }>;
  total: number | null;
  keterangan: string;
} {
  return {
    ambang: h.ambang,
    sel: h.sel.map((s) => ({ kunci: s.kunci, nilai: s.nilai, ditekan: s.ditekan })),
    total: h.totalAman ? h.total : null,
    keterangan:
      h.jumlahDitekan === 0
        ? h.keterangan
        : `Sebagian nilai tidak ditampilkan karena berada di bawah ambang penyajian ${h.ambang} orang.`,
  };
}

/**
 * Apakah penyajian ini benar-benar tidak dapat dibongkar?
 *
 * Dipakai pengujian dan bukti: ia mencoba membongkar hasilnya dengan cara yang
 * akan dipakai orang — pengurangan dari total.
 */
export function dapatDibongkar(h: HasilPenyajian): boolean {
  if (!h.totalAman) return false;
  const ditekan = h.sel.filter((s) => s.ditekan);
  if (ditekan.length === 0) return false;
  // Satu sel ditekan bersama total yang tayang: nilainya adalah selisihnya.
  if (ditekan.length === 1) return true;
  // Dua sel atau lebih, tetapi jumlahnya masih di bawah ambang: keduanya nyaris
  // pasti bernilai kecil, dan itu sudah cukup mengungkap.
  return h.sisaTersembunyi < h.ambang;
}

/**
 * Bolehkah ambang penyajian diubah?
 *
 * Menaikkan selalu boleh. Menurunkan tidak — laporan yang terbit dengan ambang
 * 5 lalu diterbitkan ulang dengan ambang 3 membuka sel yang tadinya ditekan,
 * dan siapa pun yang menyimpan versi pertama kini memegang keduanya.
 */
export function bolehUbahAmbang(lama: number, baru: number, adaTerbitan: boolean): Putusan {
  if (!Number.isInteger(baru) || baru < 2) {
    return {
      boleh: false,
      alasan: 'Ambang minimum penyajian sekurang-kurangnya 2. Ambang 1 tidak menyembunyikan apa pun.',
    };
  }
  if (baru >= lama) return { boleh: true };
  if (!adaTerbitan) return { boleh: true };
  return {
    boleh: false,
    alasan:
      `Ambang tidak dapat diturunkan dari ${lama} menjadi ${baru} selama masih ada laporan yang ` +
      'terbit dengan ambang lama. Sel yang tadinya ditekan akan terbuka, dan siapa pun yang ' +
      'menyimpan versi sebelumnya memegang keduanya sekaligus. Tarik laporan terdahulu ' +
      'terlebih dahulu bila penurunan memang dikehendaki.',
  };
}

// --- PPID: daftar informasi --------------------------------------------------

export type GolonganInformasi =
  | 'BERKALA'
  | 'SERTA_MERTA'
  | 'SETIAP_SAAT'
  | 'DIKECUALIKAN';

export interface Pengecualian {
  /** Pasal atau dasar hukum pengecualiannya. */
  dasarHukum: string;
  /** Uji konsekuensi: akibat apa yang timbul bila dibuka. */
  konsekuensi: string;
  /** Jangka waktu pengecualian berakhir. */
  berlakuSampai?: string | null;
}

/**
 * Bolehkah informasi ditetapkan sebagai dikecualikan?
 *
 * Tiga syarat, dan ketiganya berasal dari Undang-Undang Keterbukaan Informasi
 * Publik:
 *
 * 1. **Dasar hukumnya disebut.** "Rahasia" bukan dasar hukum.
 * 2. **Uji konsekuensinya diuraikan** — akibat apa yang timbul bila dibuka.
 *    Pengecualian tanpa konsekuensi yang dinyatakan bukan pengecualian
 *    melainkan penolakan yang diberi nama lain.
 * 3. **Jangka waktunya disebut.** Pengecualian tanpa batas waktu adalah
 *    kerahasiaan permanen yang ditetapkan diam-diam, dan tidak ada seorang pun
 *    yang akan meninjaunya kembali bila tidak ada tanggal yang memaksanya.
 */
export function bolehKecualikan(p: Pengecualian): Putusan {
  if (!p.dasarHukum?.trim()) {
    return {
      boleh: false,
      alasan: 'Dasar hukum pengecualian wajib disebutkan. "Rahasia" bukan dasar hukum.',
    };
  }
  if (!p.konsekuensi?.trim() || p.konsekuensi.trim().length < 20) {
    return {
      boleh: false,
      alasan:
        'Uji konsekuensi wajib diuraikan: akibat apa yang timbul bila informasi ini dibuka. ' +
        'Pengecualian tanpa konsekuensi yang dinyatakan bukan pengecualian melainkan penolakan ' +
        'yang diberi nama lain.',
    };
  }
  if (!p.berlakuSampai) {
    return {
      boleh: false,
      alasan:
        'Jangka waktu pengecualian wajib disebutkan. Pengecualian tanpa batas waktu adalah ' +
        'kerahasiaan permanen yang ditetapkan diam-diam — tidak ada yang akan meninjaunya ' +
        'kembali bila tidak ada tanggal yang memaksanya.',
    };
  }
  return { boleh: true };
}

/** Apakah pengecualian sudah lewat masanya pada tanggal tertentu? */
export function pengecualianKedaluwarsa(berlakuSampai: string, pada: string): boolean {
  return berlakuSampai < pada;
}

// --- PPID: permohonan informasi ----------------------------------------------

/** Hari kerja untuk menjawab permohonan informasi. */
export const HARI_JAWAB = 10;

/** Perpanjangan, satu kali. */
export const HARI_PERPANJANGAN = 7;

/** Hari kerja untuk menjawab keberatan. */
export const HARI_KEBERATAN = 30;

/**
 * Menambahkan sejumlah hari kerja pada sebuah tanggal.
 *
 * Sabtu, Minggu, dan hari libur yang terdaftar dilewati. Menghitungnya dengan
 * hari kalender akan membuat tenggat jatuh pada hari kantor desa tutup — dan
 * tenggat yang jatuh saat kantor tutup selalu terlambat, tanpa seorang pun
 * bersalah.
 */
export function tambahHariKerja(dari: string, hari: number, libur: ReadonlySet<string>): string {
  let t = Date.parse(`${dari}T00:00:00Z`);
  let sisa = hari;
  while (sisa > 0) {
    t += 86_400_000;
    const iso = new Date(t).toISOString().slice(0, 10);
    const hariMinggu = new Date(t).getUTCDay();
    if (hariMinggu !== 0 && hariMinggu !== 6 && !libur.has(iso)) sisa -= 1;
  }
  return new Date(t).toISOString().slice(0, 10);
}

export interface TenggatPermohonan {
  tenggat: string;
  diperpanjang: boolean;
}

export function hitungTenggat(
  diterimaPada: string,
  libur: ReadonlySet<string>,
  diperpanjang = false,
): TenggatPermohonan {
  const dasar = tambahHariKerja(diterimaPada, HARI_JAWAB, libur);
  return {
    tenggat: diperpanjang ? tambahHariKerja(dasar, HARI_PERPANJANGAN, libur) : dasar,
    diperpanjang,
  };
}

/**
 * Bolehkah tenggat diperpanjang?
 *
 * Satu kali, dan wajib beralasan. Perpanjangan yang tidak beralasan adalah
 * penundaan, dan penundaan yang berulang adalah penolakan yang tidak pernah
 * dinyatakan — sehingga tidak pernah dapat diajukan keberatan atasnya.
 */
export function bolehPerpanjang(sudahDiperpanjang: boolean, alasan: string): Putusan {
  if (sudahDiperpanjang) {
    return {
      boleh: false,
      alasan:
        'Perpanjangan hanya dapat diberikan satu kali. Bila informasinya belum juga tersedia, ' +
        'sampaikan penolakan beserta dasarnya agar pemohon dapat mengajukan keberatan.',
    };
  }
  if (!alasan?.trim() || alasan.trim().length < 10) {
    return {
      boleh: false,
      alasan:
        'Alasan perpanjangan wajib diuraikan. Penundaan yang berulang tanpa alasan adalah ' +
        'penolakan yang tidak pernah dinyatakan — sehingga tidak pernah dapat diajukan ' +
        'keberatan atasnya.',
    };
  }
  return { boleh: true };
}

export interface Penolakan {
  dasarHukum: string;
  uraian: string;
  /** Cara mengajukan keberatan wajib disampaikan bersama penolakannya. */
  caraKeberatan: string;
}

/**
 * Bolehkah permohonan ditolak?
 *
 * Penolakan wajib menyebutkan **cara mengajukan keberatan**. Penolakan yang
 * tidak menyebutkannya adalah penolakan yang mengakhiri perkara — pemohon yang
 * tidak diberi tahu haknya tidak akan memakainya, dan itu berarti hak itu
 * dihapus tanpa ada yang menghapusnya.
 */
export function bolehTolak(p: Penolakan): Putusan {
  if (!p.dasarHukum?.trim()) {
    return { boleh: false, alasan: 'Dasar hukum penolakan wajib disebutkan.' };
  }
  if (!p.uraian?.trim() || p.uraian.trim().length < 20) {
    return { boleh: false, alasan: 'Uraian penolakan wajib diberikan, sekurang-kurangnya dua puluh huruf.' };
  }
  if (!p.caraKeberatan?.trim()) {
    return {
      boleh: false,
      alasan:
        'Cara mengajukan keberatan wajib disampaikan bersama penolakannya. Pemohon yang tidak ' +
        'diberi tahu haknya tidak akan memakainya, dan itu berarti hak itu dihapus tanpa ada ' +
        'yang menghapusnya.',
    };
  }
  return { boleh: true };
}

export type StatusPermohonan =
  | 'DITERIMA'
  | 'DIPROSES'
  | 'DIPERPANJANG'
  | 'DIPENUHI'
  | 'DIPENUHI_SEBAGIAN'
  | 'DITOLAK';

export const TRANSISI_PERMOHONAN_INFORMASI: Record<StatusPermohonan, StatusPermohonan[]> = {
  DITERIMA: ['DIPROSES', 'DIPENUHI', 'DIPENUHI_SEBAGIAN', 'DITOLAK'],
  DIPROSES: ['DIPERPANJANG', 'DIPENUHI', 'DIPENUHI_SEBAGIAN', 'DITOLAK'],
  DIPERPANJANG: ['DIPENUHI', 'DIPENUHI_SEBAGIAN', 'DITOLAK'],
  // Yang sudah dijawab tidak diubah. Yang keberatan mengajukan keberatan, dan
  // keberatan adalah berkas tersendiri — bukan penyuntingan jawaban yang sudah
  // diterima pemohon.
  DIPENUHI: [],
  DIPENUHI_SEBAGIAN: [],
  DITOLAK: [],
};

export function bolehPindahPermohonan(dari: StatusPermohonan, ke: StatusPermohonan): Putusan {
  if (dari === ke) return { boleh: false, alasan: `Permohonan sudah berstatus ${dari}.` };
  if (!TRANSISI_PERMOHONAN_INFORMASI[dari].length) {
    return {
      boleh: false,
      alasan:
        'Permohonan yang sudah dijawab tidak diubah. Pemohon yang keberatan mengajukan keberatan, ' +
        'dan keberatan adalah berkas tersendiri.',
    };
  }
  if (!TRANSISI_PERMOHONAN_INFORMASI[dari].includes(ke)) {
    return { boleh: false, alasan: `Permohonan berstatus ${dari} tidak dapat langsung menjadi ${ke}.` };
  }
  return { boleh: true };
}

/** Terlambat berapa hari kerja dari tenggatnya? */
export function keterlambatan(tenggat: string, pada: string, libur: ReadonlySet<string>): number {
  if (pada <= tenggat) return 0;
  let n = 0;
  let t = Date.parse(`${tenggat}T00:00:00Z`);
  const batas = Date.parse(`${pada}T00:00:00Z`);
  while (t < batas) {
    t += 86_400_000;
    const iso = new Date(t).toISOString().slice(0, 10);
    const hariMinggu = new Date(t).getUTCDay();
    if (hariMinggu !== 0 && hariMinggu !== 6 && !libur.has(iso)) n += 1;
  }
  return n;
}
