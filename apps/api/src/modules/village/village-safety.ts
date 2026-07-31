/**
 * Aturan keamanan, kebencanaan, dan infrastruktur — fungsi murni.
 *
 * ## Catatan insiden tidak menyimpan tuduhan sebagai fakta
 *
 * Catatan desa yang menyebut nama seseorang sebagai pelaku adalah pencemaran
 * nama baik yang menunggu waktu, dan ia tersimpan jauh lebih lama daripada
 * peristiwanya. Yang dicatat: apa yang terjadi, kapan, di mana, siapa yang
 * melaporkan. Bila perkaranya berlanjut, ia **dirujuk** ke kepolisian beserta
 * nomor laporannya — dan di sanalah nama pihak-pihaknya dicatat, oleh lembaga
 * yang berwenang mencatatnya.
 *
 * Larangan itu ditegakkan dengan tidak menyediakan kolomnya, sama seperti
 * larangan lintas vertikal pada D-8. Kolom yang tidak ada tidak dapat diisi.
 *
 * ## Bantuan bencana tidak menunggu penyaringan kelayakan
 *
 * Ini kebalikan sengaja dari bantuan sosial pada D-7. Di sana penetapan
 * penerima menuntut verifikasi, dasar tertulis, dan pemeriksaan bantuan ganda.
 * Di sini tidak ada satu pun dari itu: keluarga yang kehilangan rumah pada
 * pukul tiga pagi bukan berkas yang perlu dinilai kelayakannya.
 *
 * Yang tetap dituntut hanyalah **pencatatan siapa menerima apa** — bukan
 * sebagai syarat pemberian, melainkan sebagai pertanggungjawaban sesudahnya.
 */

export type Putusan = {
  boleh: boolean;
  alasan?: string;
};

// --- Insiden keamanan --------------------------------------------------------

export type JenisInsiden =
  | 'PENCURIAN'
  | 'PERKELAHIAN'
  | 'KEBAKARAN'
  | 'KECELAKAAN'
  | 'GANGGUAN_KETERTIBAN'
  | 'ORANG_HILANG'
  | 'LAINNYA';

export type StatusInsiden = 'DILAPORKAN' | 'DITANGANI' | 'DIRUJUK' | 'SELESAI';

export const TRANSISI_INSIDEN: Record<StatusInsiden, StatusInsiden[]> = {
  DILAPORKAN: ['DITANGANI', 'DIRUJUK', 'SELESAI'],
  DITANGANI: ['DIRUJUK', 'SELESAI'],
  DIRUJUK: ['SELESAI'],
  // Laporan yang sudah selesai tidak dibuka kembali; kejadian susulan adalah
  // laporan baru yang menunjuk yang sebelumnya. Membuka kembali laporan lama
  // membuat riwayat penanganannya bercampur.
  SELESAI: [],
};

export function bolehPindahInsiden(dari: StatusInsiden, ke: StatusInsiden): Putusan {
  if (dari === ke) return { boleh: false, alasan: `Insiden sudah berstatus ${dari}.` };
  if (!TRANSISI_INSIDEN[dari].length) {
    return {
      boleh: false,
      alasan:
        'Laporan yang sudah selesai tidak dibuka kembali. Kejadian susulan dicatat sebagai ' +
        'laporan baru yang menunjuk laporan ini.',
    };
  }
  if (!TRANSISI_INSIDEN[dari].includes(ke)) {
    return { boleh: false, alasan: `Insiden berstatus ${dari} tidak dapat langsung menjadi ${ke}.` };
  }
  return { boleh: true };
}

export interface RujukanInsiden {
  /** Lembaga yang menerima rujukan: kepolisian, damkar, dinas sosial. */
  dirujukKe: string;
  /** Nomor laporan pada lembaga itu. */
  nomorRujukan: string;
}

/**
 * Bolehkah insiden dirujuk?
 *
 * Wajib menyebut nomor laporan pada lembaga yang dituju. "Sudah dilaporkan ke
 * polisi" tanpa nomornya adalah pernyataan yang tidak dapat ditelusuri warga
 * yang menanyakannya enam bulan kemudian — dan pernyataan yang tidak dapat
 * ditelusuri lebih buruk daripada tidak ada pernyataan, sebab ia menghentikan
 * pertanyaan tanpa menjawabnya.
 */
export function bolehRujukInsiden(r: RujukanInsiden): Putusan {
  if (!r.dirujukKe?.trim()) {
    return { boleh: false, alasan: 'Lembaga tujuan rujukan wajib disebutkan.' };
  }
  if (!r.nomorRujukan?.trim()) {
    return {
      boleh: false,
      alasan:
        `Nomor laporan pada ${r.dirujukKe} wajib dicatat. "Sudah dilaporkan" tanpa nomornya ` +
        'tidak dapat ditelusuri warga yang menanyakannya enam bulan kemudian.',
    };
  }
  return { boleh: true };
}

/**
 * Ruas yang **tidak boleh** ada pada catatan insiden.
 *
 * Dijaga pengujian dan dibuktikan dengan memindai kolom tabelnya. Nama-nama ini
 * dipilih karena semuanya terdengar wajar ketika diusulkan — dan itulah yang
 * membuat daftarnya perlu ada.
 */
export const RUAS_TERLARANG_INSIDEN = [
  'accused_resident_id',
  'accused_name',
  'suspect_resident_id',
  'suspect_name',
  'perpetrator_name',
  'perpetrator_resident_id',
  'pelaku_id',
  'nama_pelaku',
  'tersangka',
] as const;

// --- Kebencanaan -------------------------------------------------------------

export type JenisBencana =
  | 'BANJIR'
  | 'TANAH_LONGSOR'
  | 'KEBAKARAN'
  | 'ANGIN_PUTING_BELIUNG'
  | 'GEMPA_BUMI'
  | 'KEKERINGAN'
  | 'WABAH'
  | 'LAINNYA';

export interface KejadianBencana {
  jenis: JenisBencana;
  tanggalKejadian: string;
  jumlahTerdampakKk: number;
  jumlahMengungsi: number;
  jumlahKorbanJiwa: number;
}

/**
 * Memeriksa kewajaran angka kejadian bencana.
 *
 * Angkanya masuk ke laporan yang naik ke kecamatan lalu ke BPBD, dan angka yang
 * mustahil pada laporan pertama akan diminta diperbaiki berhari-hari kemudian —
 * ketika yang mencatatnya sudah tidak ingat lagi keadaannya.
 */
export function periksaAngkaBencana(k: KejadianBencana): Putusan {
  const angka = [k.jumlahTerdampakKk, k.jumlahMengungsi, k.jumlahKorbanJiwa];
  if (angka.some((n) => !Number.isInteger(n) || n < 0)) {
    return { boleh: false, alasan: 'Jumlah terdampak, mengungsi, dan korban jiwa tidak boleh negatif.' };
  }
  if (!ISO_TANGGAL.test(k.tanggalKejadian)) {
    return { boleh: false, alasan: 'Tanggal kejadian harus berformat YYYY-MM-DD.' };
  }
  return { boleh: true };
}

/**
 * Bolehkah laporan kejadian dihapus?
 *
 * Tidak pernah. Laporan kejadian bencana naik ke BPBD dan menjadi dasar
 * penetapan status tanggap darurat serta penyaluran bantuan; menghapusnya
 * mengubah catatan sejarah yang sudah dipakai pihak lain. Yang salah
 * **dikoreksi** beserta alasannya, sehingga koreksinya ikut terbaca.
 */
export function bolehHapusKejadian(): Putusan {
  return {
    boleh: false,
    alasan:
      'Laporan kejadian bencana tidak dapat dihapus. Ia sudah menjadi dasar laporan ke ' +
      'kecamatan dan BPBD. Koreksi angkanya beserta alasan koreksinya, agar perubahannya ikut ' +
      'terbaca.',
  };
}

// --- Logistik bantuan bencana -----------------------------------------------

export interface StokLogistik {
  tersedia: number;
  satuan: string;
}

/**
 * Bolehkah bantuan sebanyak ini disalurkan?
 *
 * Hanya sebatas stok. Berbeda dengan bantuan sosial pada D-7, **tidak ada
 * penyaringan kelayakan di sini**: keluarga yang kehilangan rumah pada pukul
 * tiga pagi bukan berkas yang perlu dinilai. Yang membatasi hanyalah berapa
 * yang benar-benar ada di gudang.
 */
export function bolehSalurkanLogistik(stok: StokLogistik, jumlah: number): Putusan {
  if (!Number.isFinite(jumlah) || jumlah <= 0) {
    return { boleh: false, alasan: 'Jumlah penyaluran harus lebih besar dari nol.' };
  }
  if (jumlah > stok.tersedia) {
    return {
      boleh: false,
      alasan:
        `Stok tidak mencukupi: tersedia ${stok.tersedia} ${stok.satuan}, diminta ${jumlah}. ` +
        'Catat penerimaan bantuan masuk terlebih dahulu bila barangnya sudah datang.',
    };
  }
  return { boleh: true };
}

export interface PenyaluranLogistik {
  jumlah: number;
  /** Nama penerima. Wajib — pertanggungjawaban, bukan syarat pemberian. */
  namaPenerima: string;
  /** Titik penyaluran: posko, dusun, atau alamat. */
  lokasi?: string | null;
}

export function bolehCatatPenyaluran(p: PenyaluranLogistik): Putusan {
  if (!Number.isFinite(p.jumlah) || p.jumlah <= 0) {
    return { boleh: false, alasan: 'Jumlah penyaluran harus lebih besar dari nol.' };
  }
  if (!p.namaPenerima?.trim()) {
    return {
      boleh: false,
      alasan:
        'Nama penerima wajib dicatat. Ini pertanggungjawaban sesudahnya, bukan syarat sebelum ' +
        'bantuan diberikan — catat setelah barangnya diserahkan bila keadaannya mendesak.',
    };
  }
  return { boleh: true };
}

// --- Infrastruktur -----------------------------------------------------------

export type KondisiInfrastruktur = 'BAIK' | 'RUSAK_RINGAN' | 'RUSAK_SEDANG' | 'RUSAK_BERAT';

export interface PenilaianKondisi {
  kondisi: KondisiInfrastruktur;
  /** ISO `YYYY-MM-DD`. Wajib. */
  dinilaiPada: string;
}

/** Umur penilaian kondisi, dalam hari. */
export function umurPenilaian(dinilaiPada: string, pada: string): number {
  return Math.round(
    (Date.parse(`${pada}T00:00:00Z`) - Date.parse(`${dinilaiPada}T00:00:00Z`)) / 86_400_000,
  );
}

/** Penilaian yang lebih tua dari ini disebut kedaluwarsa pada laporan. */
export const UMUR_PENILAIAN_KEDALUWARSA_HARI = 365;

export interface TilikanKondisi {
  kondisi: KondisiInfrastruktur;
  umurHari: number;
  kedaluwarsa: boolean;
  keterangan: string;
}

/**
 * Menyajikan kondisi beserta umur penilaiannya.
 *
 * Kondisi tanpa tanggal adalah pernyataan yang tidak pernah kedaluwarsa: "jalan
 * rusak berat" akan tetap ada di RKP tiga tahun setelah jalannya diaspal, dan
 * anggaran akan mengikuti pernyataan itu, bukan mengikuti jalannya. Karena itu
 * umurnya disajikan bersama kondisinya, bukan disimpan diam-diam.
 */
export function tilikKondisi(p: PenilaianKondisi, pada: string): TilikanKondisi {
  const umur = umurPenilaian(p.dinilaiPada, pada);
  const kedaluwarsa = umur > UMUR_PENILAIAN_KEDALUWARSA_HARI;
  return {
    kondisi: p.kondisi,
    umurHari: umur,
    kedaluwarsa,
    keterangan: kedaluwarsa
      ? `Dinilai ${umur} hari lalu (${p.dinilaiPada}). Perlu ditinjau ulang sebelum dipakai ` +
        'sebagai dasar usulan anggaran.'
      : `Dinilai ${umur} hari lalu (${p.dinilaiPada}).`,
  };
}

export function periksaPenilaian(p: PenilaianKondisi): Putusan {
  if (!ISO_TANGGAL.test(p.dinilaiPada)) {
    return {
      boleh: false,
      alasan:
        'Tanggal penilaian wajib diisi dan berformat YYYY-MM-DD. Kondisi tanpa tanggal adalah ' +
        'pernyataan yang tidak pernah kedaluwarsa.',
    };
  }
  return { boleh: true };
}

const ISO_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
