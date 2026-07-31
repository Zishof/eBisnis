/**
 * Aturan situs desa, portal warga, kiosk, dan siaran — fungsi murni.
 *
 * ## Situs publik hanya membaca
 *
 * Tidak ada satu pun jalur tulis dari halaman tanpa autentikasi. Bukan karena
 * belum dibuat, melainkan karena situs desa adalah tempat yang paling mudah
 * ditemukan dan paling jarang diperhatikan: ia terindeks mesin pencari,
 * dipindai otomatis, dan tidak ada seorang pun yang menatapnya setiap hari.
 * Satu endpoint tulis di sana bernilai lebih bagi penyerang daripada seluruh
 * halaman administrasi.
 *
 * ## Portal warga hanya menampilkan diri dan keluarga
 *
 * Tidak ada pencarian warga lain, dan tidak ada parameter untuk menyebutkan
 * warga mana yang hendak dilihat. Yang dilihat ditentukan dari **sesinya**,
 * bukan dari permintaannya. Endpoint yang menerima `residentId` akan dicoba
 * dengan nilai lain oleh orang pertama yang menyadarinya, dan pemeriksaan izin
 * yang menahannya hanya berjarak satu kekeliruan dari terbuka.
 *
 * ## Kiosk menghapus jejaknya
 *
 * Kiosk di balai desa dipakai bergantian. Warga berikutnya berdiri di depan
 * layar yang sama, kurang dari satu menit setelah yang sebelumnya pergi —
 * sering kali tanpa menekan apa pun untuk keluar. Karena itu sesinya berakhir
 * sendiri, dan berakhirnya sesi **menghapus** apa yang tampil, bukan sekadar
 * menutupinya.
 */

export type Putusan = {
  boleh: boolean;
  alasan?: string;
};

// --- Penayangan --------------------------------------------------------------

export type StatusTayang = 'DRAF' | 'TERJADWAL' | 'TAYANG' | 'DIARSIPKAN';

export const TRANSISI_TAYANG: Record<StatusTayang, StatusTayang[]> = {
  DRAF: ['TERJADWAL', 'TAYANG'],
  TERJADWAL: ['TAYANG', 'DRAF'],
  TAYANG: ['DIARSIPKAN', 'DRAF'],
  // Yang diarsipkan dapat ditayangkan kembali: berita lama kadang relevan lagi,
  // dan menyalinnya menjadi tulisan baru menghapus tanggal aslinya.
  DIARSIPKAN: ['TAYANG'],
};

export function bolehPindahTayang(dari: StatusTayang, ke: StatusTayang): Putusan {
  if (dari === ke) return { boleh: false, alasan: `Konten sudah berstatus ${dari}.` };
  if (!TRANSISI_TAYANG[dari].includes(ke)) {
    return { boleh: false, alasan: `Konten berstatus ${dari} tidak dapat langsung menjadi ${ke}.` };
  }
  return { boleh: true };
}

export interface Terbitan {
  judul: string;
  isi: string;
  /** ISO. Wajib bila terjadwal. */
  tayangPada?: string | null;
  status: StatusTayang;
}

/**
 * Bolehkah konten ditayangkan?
 *
 * Judul dan isi wajib. Halaman kosong yang tayang lebih buruk daripada halaman
 * yang belum ada: yang belum ada tidak menjanjikan apa-apa, yang kosong
 * menjanjikan lalu tidak memberi.
 */
export function bolehTayang(t: Terbitan): Putusan {
  if (!t.judul?.trim() || t.judul.trim().length < 3) {
    return { boleh: false, alasan: 'Judul wajib diisi.' };
  }
  if (!t.isi?.trim() || t.isi.trim().length < 20) {
    return {
      boleh: false,
      alasan:
        'Isi wajib diisi, sekurang-kurangnya dua puluh huruf. Halaman kosong yang tayang lebih ' +
        'buruk daripada halaman yang belum ada.',
    };
  }
  if (t.status === 'TERJADWAL' && !t.tayangPada) {
    return { boleh: false, alasan: 'Konten terjadwal wajib menyebutkan kapan ia tayang.' };
  }
  return { boleh: true };
}

// --- Proyeksi publik ---------------------------------------------------------

/**
 * Ruas yang boleh tampil pada situs publik untuk tiap jenis isi.
 *
 * Daftar tertutup, bukan daftar larangan. Perbedaannya menentukan: daftar
 * larangan harus diperbarui setiap kali kolom baru ditambahkan, dan yang lupa
 * diperbarui menjadi kebocoran. Daftar izin yang lupa diperbarui hanya membuat
 * kolom barunya tidak tampil — dan itu ketahuan pada hari yang sama.
 */
export const RUAS_PUBLIK = {
  PROFIL: ['name', 'profileType', 'administrativeCode', 'address', 'motto', 'phone', 'email',
           'provinceName', 'regencyName', 'districtName', 'areaKm2', 'establishedYear'],
  BERITA: ['id', 'slug', 'title', 'summary', 'body', 'coverPath', 'publishedAt', 'authorName',
           'category'],
  AGENDA: ['id', 'title', 'description', 'startAt', 'endAt', 'location', 'isPublic'],
  HALAMAN: ['id', 'slug', 'title', 'body', 'updatedAt'],
  WISATA: ['id', 'name', 'category', 'description', 'address', 'openHours', 'entryFee', 'isFree',
           'managerName', 'managerContact', 'facilities'],
  UMKM: ['id', 'businessName', 'businessSector', 'description', 'phone', 'address'],
  APBDES: ['fiscalYear', 'totalRevenue', 'totalExpenditure', 'regulationNumber', 'establishedAt'],
  // Programnya boleh tampil; penerimanya tidak, dan tidak akan pernah.
  BANTUAN: ['programName', 'aidCategory', 'periodStart', 'periodEnd', 'quota'],
} as const;

export type JenisPublik = keyof typeof RUAS_PUBLIK;

/**
 * Menyaring satu baris menjadi bentuk yang boleh tampil publik.
 *
 * Dipakai pada seluruh keluaran publik tanpa kecuali. Menyaring "hanya yang
 * perlu" berarti mengandalkan ingatan penulis kode berikutnya, dan ingatan
 * itulah yang paling sering gagal ketika sebuah kolom baru ditambahkan
 * seminggu kemudian.
 */
export function proyeksikan<T extends Record<string, unknown>>(
  jenis: JenisPublik,
  baris: T,
): Record<string, unknown> {
  const izin = RUAS_PUBLIK[jenis] as readonly string[];
  const keluar: Record<string, unknown> = {};
  for (const ruas of izin) {
    if (Object.prototype.hasOwnProperty.call(baris, ruas)) keluar[ruas] = baris[ruas];
  }
  return keluar;
}

/**
 * Ruas yang **tidak pernah** boleh tampil publik, betapapun masuk akal
 * permintaannya kelak.
 *
 * Bukan pengganti daftar izin — pemeriksaan kedua atas daftar izin itu sendiri.
 * Bila suatu hari `nik` masuk ke `RUAS_PUBLIK`, pengujian menggagalkannya.
 */
export const RUAS_TIDAK_PUBLIK = [
  'nik',
  'nationalId',
  'national_id',
  'birthDate',
  'birth_date',
  'motherName',
  'mother_name',
  'familyCardNo',
  'family_card_no',
  'monthlyIncome',
  'monthly_income',
  'residentId',
  'resident_id',
  'possessorName',
  'reporterName',
  'reporter_name',
  'decisionBasis',
  'decision_basis',
] as const;

// --- Portal warga ------------------------------------------------------------

export interface AksesPortal {
  /** Penduduk yang tertaut pada sesi. Kosong berarti akun belum tertaut. */
  residentIdSesi: string | null;
  /** Keluarga penduduk itu. */
  familyIdSesi: string | null;
  /** Penduduk yang datanya diminta. */
  residentIdDiminta: string;
  familyIdDiminta: string | null;
}

/**
 * Bolehkah portal menampilkan data penduduk ini?
 *
 * Hanya diri dan satu keluarga. Perhatikan bahwa `residentIdSesi` datang dari
 * tautan akun, bukan dari permintaan — fungsi ini menjaga agar keduanya tidak
 * pernah tertukar, dan pengujian menjaga agar tidak ada endpoint portal yang
 * menerima pengenal penduduk dari luar.
 */
export function bolehLihatDiPortal(a: AksesPortal): Putusan {
  if (!a.residentIdSesi) {
    return {
      boleh: false,
      alasan:
        'Akun ini belum tertaut ke data kependudukan. Hubungi petugas desa untuk menautkannya — ' +
        'penautan dilakukan petugas setelah memastikan identitasnya, bukan oleh pemilik akun.',
    };
  }
  if (a.residentIdSesi === a.residentIdDiminta) return { boleh: true };

  if (a.familyIdSesi && a.familyIdDiminta && a.familyIdSesi === a.familyIdDiminta) {
    return { boleh: true };
  }

  return {
    boleh: false,
    alasan: 'Portal warga hanya menampilkan data diri dan anggota keluarga dalam satu kartu keluarga.',
  };
}

/**
 * Nama endpoint portal yang **tidak boleh** ada.
 *
 * Pencarian warga adalah fitur yang akan diminta, terdengar wajar, dan
 * menghapus seluruh pembatasan di atas dalam satu langkah.
 */
export const ENDPOINT_TERLARANG_PORTAL = [
  'cariWarga',
  'searchResidents',
  'daftarWarga',
  'listResidents',
  'lihatWarga',
  'getResident',
  'cariKeluarga',
  'searchFamilies',
] as const;

// --- Kiosk -------------------------------------------------------------------

/** Sesi kiosk berakhir sendiri sesudah ini, dihitung sejak sentuhan terakhir. */
export const KIOSK_MENGANGGUR_DETIK = 120;

/** Batas atas umur sesi kiosk, betapapun sibuknya. */
export const KIOSK_UMUR_MAKSIMAL_DETIK = 900;

export interface SesiKiosk {
  mulaiPada: number;
  sentuhanTerakhir: number;
  berakhirPada?: number | null;
}

export type SebabBerakhir = 'MENGANGGUR' | 'UMUR_MAKSIMAL' | 'DITUTUP_PENGGUNA' | 'MASIH_BERJALAN';

export interface KeadaanKiosk {
  berakhir: boolean;
  sebab: SebabBerakhir;
  sisaDetik: number;
  keterangan: string;
}

/**
 * Apakah sesi kiosk sudah harus berakhir?
 *
 * Dua ambang, dan keduanya perlu. Yang pertama menutup sesi yang ditinggalkan;
 * yang kedua menutup sesi yang tampak sibuk karena layarnya tersenggol
 * berulang kali — antrean di balai desa berdiri rapat, dan layar sentuh tidak
 * dapat membedakan jari yang membaca dari siku yang menunggu.
 */
export function keadaanKiosk(s: SesiKiosk, sekarang: number): KeadaanKiosk {
  if (s.berakhirPada) {
    return {
      berakhir: true,
      sebab: 'DITUTUP_PENGGUNA',
      sisaDetik: 0,
      keterangan: 'Sesi sudah ditutup.',
    };
  }

  const menganggur = Math.floor((sekarang - s.sentuhanTerakhir) / 1000);
  const umur = Math.floor((sekarang - s.mulaiPada) / 1000);

  if (umur >= KIOSK_UMUR_MAKSIMAL_DETIK) {
    return {
      berakhir: true,
      sebab: 'UMUR_MAKSIMAL',
      sisaDetik: 0,
      keterangan: `Sesi melampaui batas ${KIOSK_UMUR_MAKSIMAL_DETIK / 60} menit dan ditutup.`,
    };
  }
  if (menganggur >= KIOSK_MENGANGGUR_DETIK) {
    return {
      berakhir: true,
      sebab: 'MENGANGGUR',
      sisaDetik: 0,
      keterangan: `Tidak ada sentuhan selama ${KIOSK_MENGANGGUR_DETIK} detik. Sesi ditutup.`,
    };
  }

  const sisaMenganggur = KIOSK_MENGANGGUR_DETIK - menganggur;
  const sisaUmur = KIOSK_UMUR_MAKSIMAL_DETIK - umur;
  const sisa = Math.min(sisaMenganggur, sisaUmur);
  return {
    berakhir: false,
    sebab: 'MASIH_BERJALAN',
    sisaDetik: sisa,
    keterangan: `Sesi berakhir dalam ${sisa} detik bila tidak disentuh.`,
  };
}

export interface JejakKiosk {
  residentId?: string | null;
  searchTerm?: string | null;
  lastViewPayload?: unknown;
  requestId?: string | null;
}

/**
 * Menghapus jejak layar saat sesi berakhir.
 *
 * Mengembalikan objek yang seluruh jejaknya `null`. Kiosk di balai desa dipakai
 * bergantian, dan warga berikutnya berdiri di depan layar yang sama kurang dari
 * satu menit kemudian — sering tanpa menekan apa pun untuk keluar. Menutupi
 * layar tidak cukup: tombol "kembali" mengembalikannya.
 */
export function hapusJejakKiosk(_jejak: JejakKiosk): Required<JejakKiosk> {
  return {
    residentId: null,
    searchTerm: null,
    lastViewPayload: null,
    requestId: null,
  };
}

/** Sesi yang sudah berakhir tetapi masih menyimpan jejak adalah cacat. */
export function jejakBersih(j: JejakKiosk): boolean {
  return (
    (j.residentId ?? null) === null &&
    (j.searchTerm ?? null) === null &&
    (j.lastViewPayload ?? null) === null &&
    (j.requestId ?? null) === null
  );
}

// --- Siaran ------------------------------------------------------------------

export type KanalSiaran = 'WHATSAPP' | 'SUREL' | 'SMS' | 'PAPAN_INFORMASI';

export type StatusSiaran = 'DRAF' | 'ANTRE' | 'TERKIRIM' | 'GAGAL' | 'TERHALANG';

export interface KesiapanKanal {
  kanal: KanalSiaran;
  /** Benar bila kredensial penyedianya sudah ada. */
  adaKredensial: boolean;
}

/**
 * Bolehkah siaran dikirim melalui kanal ini?
 *
 * Kanal tanpa kredensial menghasilkan `TERHALANG`, bukan `GAGAL` dan bukan
 * `TERKIRIM`. Perbedaannya penting: `GAGAL` mengundang percobaan ulang yang
 * tidak akan pernah berhasil, dan `TERKIRIM` adalah kebohongan yang akan
 * diulang pemerintah desa kepada warganya ketika ditanya mengapa pesannya tidak
 * sampai.
 *
 * `PAPAN_INFORMASI` selalu siap — ia hanya menayangkan pada situs desa, dan
 * tidak memerlukan penyedia mana pun.
 */
export function bolehSiarkan(k: KesiapanKanal): Putusan {
  if (k.kanal === 'PAPAN_INFORMASI') return { boleh: true };
  if (!k.adaKredensial) {
    return {
      boleh: false,
      alasan:
        `Kanal ${k.kanal} belum memiliki kredensial penyedia sehingga siaran tidak dapat ` +
        'dikirim. Siaran disimpan berstatus TERHALANG — bukan gagal, dan bukan terkirim.',
    };
  }
  return { boleh: true };
}

/**
 * Bolehkah siaran ditandai terkirim?
 *
 * Hanya bila penyedianya mengembalikan rujukan. Sistem yang menandai terkirim
 * tanpa bukti dari penyedia membuat pemerintah desa menyatakan sesuatu yang
 * tidak diketahuinya kepada warganya — dan itu justru muncul ketika warga
 * bertanya mengapa ia tidak menerima pesan yang katanya sudah dikirim.
 */
export function bolehTandaiTerkirim(rujukanPenyedia?: string | null): Putusan {
  if (!rujukanPenyedia?.trim()) {
    return {
      boleh: false,
      alasan:
        'Siaran tidak dapat ditandai terkirim tanpa rujukan dari penyedianya. Menandai terkirim ' +
        'tanpa bukti membuat pemerintah desa menyatakan sesuatu yang tidak diketahuinya.',
    };
  }
  return { boleh: true };
}
