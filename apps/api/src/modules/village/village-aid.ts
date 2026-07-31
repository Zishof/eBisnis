/**
 * Aturan bantuan sosial — fungsi murni, tanpa basis data.
 *
 * ## Kriteria kelayakan adalah pohon kondisi, bukan ekspresi
 *
 * Kriteria bantuan berubah tiap program dan tiap tahun, sehingga menuliskannya
 * di dalam kode berarti menunggu programmer setiap kali bupati mengubah
 * ambangnya. Godaannya adalah menyimpan kriteria sebagai teks lalu
 * mengevaluasinya — `eval`, `new Function`, atau menempelkannya ke `WHERE`.
 *
 * Ketiganya berarti hal yang sama: **siapa pun yang dapat menyunting kriteria
 * program bantuan dapat menjalankan kode di server.** Yang menyunting kriteria
 * adalah operator desa, dan pada satu dari sekian ribu desa ada operator yang
 * akan mencobanya.
 *
 * Karena itu kriteria disimpan sebagai **pohon kondisi terstruktur**: setiap
 * daun menunjuk satu ruas dari daftar tertutup di bawah, dengan satu
 * pembanding dari daftar tertutup lainnya. Tidak ada tempat bagi teks yang
 * dieksekusi, karena tidak ada teks yang dieksekusi.
 *
 * ## Kecerdasan buatan hanya mengusulkan
 *
 * Penyaringan otomatis boleh menyusun daftar calon; **penetapan penerima
 * dilakukan manusia**, tercatat siapa dan atas dasar apa. Alasannya bukan
 * kehati-hatian teknis melainkan pertanggungjawaban: warga yang tidak menerima
 * bantuan berhak mendapat jawaban dari seseorang, dan "begitu hasil sistemnya"
 * bukan jawaban yang dapat dipertanggungjawabkan oleh siapa pun.
 */

export type Putusan = {
  boleh: boolean;
  alasan?: string;
};

// --- Ruas yang boleh dipakai kriteria ----------------------------------------

/**
 * Daftar tertutup ruas yang boleh muncul pada kriteria.
 *
 * Daftar inilah pengamannya. Nama ruas yang datang dari badan permintaan tidak
 * pernah menjadi nama kolom maupun penelusuran properti pada objek sembarang;
 * ia hanya dicocokkan dengan daftar ini, dan yang tidak cocok ditolak sebelum
 * kriterianya disimpan.
 */
export const RUAS_KRITERIA = {
  penghasilanBulanan: 'ANGKA',
  jumlahAnggotaKeluarga: 'ANGKA',
  usia: 'ANGKA',
  luasLantaiM2: 'ANGKA',
  dayaListrikVa: 'ANGKA',
  jumlahTanggungan: 'ANGKA',

  statusRumah: 'PILIHAN',
  jenisLantai: 'PILIHAN',
  sumberAirMinum: 'PILIHAN',
  pendidikanTerakhir: 'PILIHAN',
  pekerjaan: 'PILIHAN',
  statusPerkawinan: 'PILIHAN',
  dusun: 'PILIHAN',
  rw: 'PILIHAN',
  rt: 'PILIHAN',

  disabilitas: 'BENAR_SALAH',
  lansia: 'BENAR_SALAH',
  ibuHamil: 'BENAR_SALAH',
  balita: 'BENAR_SALAH',
  kepalaKeluargaPerempuan: 'BENAR_SALAH',
  terdaftarDtks: 'BENAR_SALAH',
  memilikiKendaraanBermotor: 'BENAR_SALAH',
} as const;

export type RuasKriteria = keyof typeof RUAS_KRITERIA;
export type TipeRuas = (typeof RUAS_KRITERIA)[RuasKriteria];

export function adalahRuasKriteria(nama: string): nama is RuasKriteria {
  return Object.prototype.hasOwnProperty.call(RUAS_KRITERIA, nama);
}

export const PEMBANDING_ANGKA = ['SAMA', 'TIDAK_SAMA', 'MINIMAL', 'MAKSIMAL', 'LEBIH', 'KURANG'] as const;
export const PEMBANDING_PILIHAN = ['SAMA', 'TIDAK_SAMA', 'TERMASUK', 'TIDAK_TERMASUK'] as const;
export const PEMBANDING_BENAR_SALAH = ['SAMA'] as const;

export type Pembanding =
  | (typeof PEMBANDING_ANGKA)[number]
  | (typeof PEMBANDING_PILIHAN)[number]
  | (typeof PEMBANDING_BENAR_SALAH)[number];

const PEMBANDING_SAH: Record<TipeRuas, readonly string[]> = {
  ANGKA: PEMBANDING_ANGKA,
  PILIHAN: PEMBANDING_PILIHAN,
  BENAR_SALAH: PEMBANDING_BENAR_SALAH,
};

// --- Pohon kondisi -----------------------------------------------------------

export type NilaiFakta = number | string | boolean | null | undefined;

export interface Daun {
  jenis: 'BANDING';
  ruas: RuasKriteria;
  pembanding: Pembanding;
  nilai: number | string | boolean | Array<string>;
}

export interface Semua {
  jenis: 'SEMUA';
  anak: Kondisi[];
}

export interface SalahSatu {
  jenis: 'SALAH_SATU';
  anak: Kondisi[];
}

export interface Tidak {
  jenis: 'TIDAK';
  anak: Kondisi;
}

export type Kondisi = Daun | Semua | SalahSatu | Tidak;

/** Sedalam ini sudah tidak dapat dibaca manusia, dan kriteria yang tidak dapat dibaca tidak dapat digugat. */
export const KEDALAMAN_MAKSIMAL = 6;
export const SIMPUL_MAKSIMAL = 80;

export interface HasilPeriksaBentuk {
  sah: boolean;
  kesalahan: string[];
  kedalaman: number;
  simpul: number;
}

/**
 * Memeriksa bentuk pohon kriteria **sebelum disimpan**.
 *
 * Memeriksanya saat evaluasi sudah terlambat: kriteria yang cacat sudah
 * tersimpan, dan kegagalannya muncul satu per satu pada tiap calon — jauh dari
 * layar tempat kesalahannya dibuat, dan tanpa petunjuk bahwa kriterianyalah
 * yang salah.
 *
 * Kedalaman dan jumlah simpul dibatasi. Pohon yang datang dari badan permintaan
 * adalah masukan yang tidak tepercaya; rekursi tanpa batas atasnya adalah cara
 * paling mudah menjatuhkan proses.
 */
export function periksaBentuk(kondisi: unknown): HasilPeriksaBentuk {
  const kesalahan: string[] = [];
  let simpul = 0;
  let terdalam = 0;

  const telusuri = (n: unknown, dalam: number, jalur: string): void => {
    simpul += 1;
    terdalam = Math.max(terdalam, dalam);

    if (simpul > SIMPUL_MAKSIMAL) {
      if (!kesalahan.some((k) => k.startsWith('Kriteria terlalu besar'))) {
        kesalahan.push(`Kriteria terlalu besar: lebih dari ${SIMPUL_MAKSIMAL} simpul.`);
      }
      return;
    }
    if (dalam > KEDALAMAN_MAKSIMAL) {
      if (!kesalahan.some((k) => k.startsWith('Kriteria terlalu dalam'))) {
        kesalahan.push(
          `Kriteria terlalu dalam pada ${jalur}: lebih dari ${KEDALAMAN_MAKSIMAL} tingkat. ` +
            'Kriteria yang tidak dapat dibaca manusia tidak dapat digugat warga.',
        );
      }
      return;
    }

    if (!n || typeof n !== 'object') {
      kesalahan.push(`Simpul pada ${jalur} bukan objek kondisi.`);
      return;
    }

    const jenis = (n as { jenis?: unknown }).jenis;

    if (jenis === 'SEMUA' || jenis === 'SALAH_SATU') {
      const anak = (n as { anak?: unknown }).anak;
      if (!Array.isArray(anak) || anak.length === 0) {
        kesalahan.push(`${jenis} pada ${jalur} harus memiliki sekurang-kurangnya satu anak.`);
        return;
      }
      anak.forEach((a, i) => telusuri(a, dalam + 1, `${jalur}.anak[${i}]`));
      return;
    }

    if (jenis === 'TIDAK') {
      const anak = (n as { anak?: unknown }).anak;
      if (!anak) {
        kesalahan.push(`TIDAK pada ${jalur} harus memiliki anak.`);
        return;
      }
      telusuri(anak, dalam + 1, `${jalur}.anak`);
      return;
    }

    if (jenis !== 'BANDING') {
      kesalahan.push(
        `Jenis kondisi "${String(jenis)}" pada ${jalur} tidak dikenal. ` +
          'Yang dikenal: SEMUA, SALAH_SATU, TIDAK, BANDING.',
      );
      return;
    }

    const d = n as Partial<Daun>;
    if (typeof d.ruas !== 'string' || !adalahRuasKriteria(d.ruas)) {
      kesalahan.push(
        `Ruas "${String(d.ruas)}" pada ${jalur} tidak ada dalam daftar ruas kriteria. ` +
          'Kriteria hanya boleh menunjuk ruas yang sudah dikenal sistem.',
      );
      return;
    }

    const tipe = RUAS_KRITERIA[d.ruas];
    if (typeof d.pembanding !== 'string' || !PEMBANDING_SAH[tipe].includes(d.pembanding)) {
      kesalahan.push(
        `Pembanding "${String(d.pembanding)}" tidak berlaku bagi ruas ${d.ruas} bertipe ${tipe}. ` +
          `Yang berlaku: ${PEMBANDING_SAH[tipe].join(', ')}.`,
      );
      return;
    }

    const salahNilai = periksaNilai(tipe, d.pembanding, d.nilai);
    if (salahNilai) kesalahan.push(`${jalur}: ${salahNilai}`);
  };

  telusuri(kondisi, 1, 'kriteria');
  return { sah: kesalahan.length === 0, kesalahan, kedalaman: terdalam, simpul };
}

function periksaNilai(tipe: TipeRuas, pembanding: string, nilai: unknown): string | null {
  if (pembanding === 'TERMASUK' || pembanding === 'TIDAK_TERMASUK') {
    if (!Array.isArray(nilai) || nilai.length === 0) {
      return `Pembanding ${pembanding} memerlukan daftar nilai yang tidak kosong.`;
    }
    if (!nilai.every((v) => typeof v === 'string')) {
      return `Pembanding ${pembanding} hanya menerima daftar teks.`;
    }
    return null;
  }
  if (tipe === 'ANGKA' && typeof nilai !== 'number') return 'Ruas bertipe angka memerlukan nilai angka.';
  if (tipe === 'ANGKA' && !Number.isFinite(nilai as number)) return 'Nilai angka tidak sah.';
  if (tipe === 'PILIHAN' && typeof nilai !== 'string') return 'Ruas bertipe pilihan memerlukan nilai teks.';
  if (tipe === 'BENAR_SALAH' && typeof nilai !== 'boolean') {
    return 'Ruas bertipe benar/salah memerlukan nilai benar atau salah.';
  }
  return null;
}

// --- Evaluasi ----------------------------------------------------------------

export type Fakta = Partial<Record<RuasKriteria, NilaiFakta>>;

export interface JejakKondisi {
  jalur: string;
  ruas?: RuasKriteria;
  pembanding?: Pembanding;
  diharapkan?: unknown;
  senyatanya?: NilaiFakta;
  lulus: boolean;
  /** Ruas yang datanya belum terisi. Bukan lulus, dan bukan gagal karena tidak memenuhi. */
  dataKosong?: boolean;
}

export interface HasilEvaluasi {
  layak: boolean;
  jejak: JejakKondisi[];
  /** Ruas yang datanya belum terisi sehingga hasilnya belum dapat dipastikan. */
  ruasKosong: RuasKriteria[];
}

/**
 * Menilai satu calon terhadap kriteria program.
 *
 * Mengembalikan **jejaknya**, bukan sekadar layak/tidak. Warga yang tidak masuk
 * daftar akan bertanya mengapa, dan petugas yang tidak dapat menjawabnya akan
 * dituduh pilih kasih — di desa, tuduhan itu melekat jauh lebih lama daripada
 * bantuannya sendiri.
 *
 * Ruas yang datanya kosong dianggap **tidak memenuhi**, dan disebutkan
 * tersendiri. Menganggapnya memenuhi berarti warga yang datanya belum lengkap
 * lolos lebih mudah daripada warga yang datanya lengkap — kebalikan dari yang
 * dikehendaki siapa pun.
 */
export function evaluasi(kondisi: Kondisi, fakta: Fakta): HasilEvaluasi {
  const jejak: JejakKondisi[] = [];
  const kosong = new Set<RuasKriteria>();

  const nilai = (n: Kondisi, jalur: string): boolean => {
    if (n.jenis === 'SEMUA') {
      // Seluruh anak dinilai, bukan berhenti pada yang pertama gagal. Jejak yang
      // berhenti di tengah hanya menyebut satu sebab, dan warga yang
      // memperbaiki satu sebab lalu ditolak lagi karena sebab kedua akan
      // merasa dipermainkan.
      const hasil = n.anak.map((a, i) => nilai(a, `${jalur}.${i}`));
      return hasil.every(Boolean);
    }
    if (n.jenis === 'SALAH_SATU') {
      const hasil = n.anak.map((a, i) => nilai(a, `${jalur}.${i}`));
      return hasil.some(Boolean);
    }
    if (n.jenis === 'TIDAK') {
      return !nilai(n.anak, `${jalur}.tidak`);
    }

    const f = fakta[n.ruas];
    const adaData = f !== undefined && f !== null && f !== '';
    if (!adaData) kosong.add(n.ruas);

    const lulus = adaData ? bandingkan(n, f) : false;
    jejak.push({
      jalur,
      ruas: n.ruas,
      pembanding: n.pembanding,
      diharapkan: n.nilai,
      senyatanya: f,
      lulus,
      dataKosong: !adaData,
    });
    return lulus;
  };

  const layak = nilai(kondisi, 'kriteria');
  return { layak, jejak, ruasKosong: [...kosong] };
}

function bandingkan(d: Daun, f: NilaiFakta): boolean {
  switch (d.pembanding) {
    case 'SAMA':
      return f === d.nilai;
    case 'TIDAK_SAMA':
      return f !== d.nilai;
    case 'MINIMAL':
      return Number(f) >= Number(d.nilai);
    case 'MAKSIMAL':
      return Number(f) <= Number(d.nilai);
    case 'LEBIH':
      return Number(f) > Number(d.nilai);
    case 'KURANG':
      return Number(f) < Number(d.nilai);
    case 'TERMASUK':
      return Array.isArray(d.nilai) && d.nilai.includes(String(f));
    case 'TIDAK_TERMASUK':
      return Array.isArray(d.nilai) && !d.nilai.includes(String(f));
    default:
      // Tidak terjangkau: pembanding sudah disaring `periksaBentuk`. Menolak,
      // bukan meloloskan — pembanding yang tidak dikenal tidak boleh menjadi
      // jalan lolos.
      return false;
  }
}

/** Menyusun jejak menjadi kalimat yang dapat dibacakan kepada warga. */
export function ringkasJejak(hasil: HasilEvaluasi): string[] {
  return hasil.jejak
    .filter((j) => !j.lulus)
    .map((j) =>
      j.dataKosong
        ? `Data ${labelRuas(j.ruas!)} belum terisi.`
        : `${labelRuas(j.ruas!)} ${kataPembanding(j.pembanding!)} ${String(j.diharapkan)} ` +
          `(tercatat ${String(j.senyatanya)}).`,
    );
}

function labelRuas(r: RuasKriteria): string {
  return r.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function kataPembanding(p: Pembanding): string {
  const kamus: Record<string, string> = {
    SAMA: 'harus',
    TIDAK_SAMA: 'tidak boleh',
    MINIMAL: 'sekurang-kurangnya',
    MAKSIMAL: 'sebanyak-banyaknya',
    LEBIH: 'harus lebih dari',
    KURANG: 'harus kurang dari',
    TERMASUK: 'harus termasuk',
    TIDAK_TERMASUK: 'tidak boleh termasuk',
  };
  return kamus[p] ?? p;
}

// --- Batas kecerdasan buatan -------------------------------------------------

export type SumberUsulan = 'MANUAL' | 'ATURAN' | 'AI';

export type JenisAktor = 'MANUSIA' | 'AI';

export type StatusCalon = 'DIUSULKAN' | 'DIVERIFIKASI' | 'DITETAPKAN' | 'DITOLAK';

export interface PenetapanPenerima {
  status: StatusCalon;
  sumber: SumberUsulan;
  /** Pengguna yang mengusulkan. Kosong bila usulan berasal dari penyaringan. */
  diusulkanOleh: string | null;
  penetap: { userId: string; jenis: JenisAktor };
  /** Uraian dasar penetapannya. Bukan kode, bukan centang — kalimat. */
  dasarPenetapan: string;
}

/**
 * Bolehkah calon ini ditetapkan menjadi penerima?
 *
 * Empat hal ditolak di sini, dan seluruhnya berasal dari cara bantuan desa
 * benar-benar disalahgunakan:
 *
 * 1. **Kecerdasan buatan tidak menetapkan.** Ia boleh menyusun daftar calon;
 *    keputusannya tetap pada manusia yang namanya tercatat.
 * 2. **Pengusul bukan penetap.** Satu orang yang mengusulkan sekaligus
 *    menetapkan berarti tidak ada yang memeriksa siapa pun.
 * 3. **Wajib melalui verifikasi.** Calon hasil penyaringan adalah dugaan,
 *    bukan temuan; yang menjadikannya temuan adalah kunjungan petugas.
 * 4. **Dasar penetapan wajib diuraikan.** Warga yang tidak menerima berhak
 *    mendapat jawaban dari seseorang, dan "begitu hasil sistemnya" bukan
 *    jawaban yang dapat dipertanggungjawabkan siapa pun.
 */
export function bolehTetapkanPenerima(p: PenetapanPenerima): Putusan {
  if (p.penetap.jenis === 'AI') {
    return {
      boleh: false,
      alasan:
        'Penetapan penerima bantuan tidak dapat dilakukan sistem. Penyaringan otomatis hanya ' +
        'mengusulkan calon; penetapannya dilakukan pejabat yang berwenang dan tercatat namanya.',
    };
  }

  if (p.status === 'DITETAPKAN') {
    return { boleh: false, alasan: 'Calon ini sudah ditetapkan sebagai penerima.' };
  }
  if (p.status === 'DITOLAK') {
    return {
      boleh: false,
      alasan: 'Calon ini sudah ditolak. Usulkan ulang bila keadaannya berubah, agar penolakannya tetap terbaca.',
    };
  }
  if (p.status !== 'DIVERIFIKASI') {
    return {
      boleh: false,
      alasan:
        'Calon harus diverifikasi terlebih dahulu. Hasil penyaringan adalah dugaan, bukan ' +
        'temuan; yang menjadikannya temuan adalah kunjungan petugas.',
    };
  }

  if (p.diusulkanOleh && p.diusulkanOleh === p.penetap.userId) {
    return {
      boleh: false,
      alasan:
        'Anda tidak dapat menetapkan calon yang Anda usulkan sendiri. Mintakan penetapan ' +
        'kepada pejabat lain.',
    };
  }

  if (!p.dasarPenetapan?.trim() || p.dasarPenetapan.trim().length < 15) {
    return {
      boleh: false,
      alasan:
        'Dasar penetapan wajib diuraikan, sekurang-kurangnya lima belas huruf. ' +
        'Warga yang tidak menerima bantuan berhak mendapat jawaban yang dapat dibaca.',
    };
  }

  return { boleh: true };
}

// --- Tumpang tindih antarprogram ---------------------------------------------

export interface PenerimaanLain {
  programId: string;
  programName: string;
  aidCategory: string;
  /** ISO `YYYY-MM-DD`. */
  periodStart: string;
  periodEnd: string;
}

export interface ProgramDinilai {
  id: string;
  aidCategory: string;
  periodStart: string;
  periodEnd: string;
  /** Program yang memang dirancang menambah bantuan lain. Bawaan: tidak. */
  bolehBertumpuk?: boolean;
}

export interface HasilTumpangTindih {
  bentrok: boolean;
  penerimaanBentrok: PenerimaanLain[];
  alasan?: string;
}

/**
 * Apakah warga ini sudah menerima bantuan sejenis pada periode yang beririsan?
 *
 * **Menolak**, bukan menandai. Ini berbeda dengan NIK kembar pada D-2, dan
 * perbedaannya bukan kebetulan: NIK kembar bisa berarti salah ketik, dan sistem
 * yang menolak menyimpannya justru memaksa petugas memalsukan data agar dapat
 * melanjutkan. Bantuan ganda bukan keraguan pencatatan — ia pembayaran kedua.
 *
 * Bertumpuk tetap mungkin, tetapi harus dinyatakan sebagai rancangan program,
 * bukan diputuskan diam-diam per warga. Bantuan yang diam-diam berganda bagi
 * sebagian keluarga dan tidak bagi yang lain adalah cara sebuah pemerintah desa
 * kehilangan kepercayaan warganya, dan bawaan yang aman adalah bawaan yang
 * menuntut seseorang memutuskan sebaliknya secara sadar.
 */
export function deteksiTumpangTindih(
  program: ProgramDinilai,
  lain: PenerimaanLain[],
): HasilTumpangTindih {
  if (program.bolehBertumpuk) {
    return { bentrok: false, penerimaanBentrok: [] };
  }

  const bentrok = lain.filter(
    (l) =>
      l.programId !== program.id &&
      l.aidCategory === program.aidCategory &&
      beririsan(program.periodStart, program.periodEnd, l.periodStart, l.periodEnd),
  );

  if (!bentrok.length) return { bentrok: false, penerimaanBentrok: [] };

  return {
    bentrok: true,
    penerimaanBentrok: bentrok,
    alasan:
      `Warga ini sudah ditetapkan menerima bantuan sejenis (${program.aidCategory}) pada ` +
      `periode yang beririsan: ${bentrok.map((b) => b.programName).join(', ')}. ` +
      'Bila penumpukan memang dikehendaki, nyatakan pada rancangan programnya.',
  };
}

function beririsan(aMulai: string, aSelesai: string, bMulai: string, bSelesai: string): boolean {
  return aMulai <= bSelesai && bMulai <= aSelesai;
}

// --- Penyaluran --------------------------------------------------------------

export type BentukBantuan = 'UANG' | 'BARANG' | 'JASA';

export interface Penyaluran {
  statusPenerima: StatusCalon;
  bentuk: BentukBantuan;
  nilai: number;
  /** Diterima langsung, atau diwakilkan. */
  diterimaOleh: 'PENERIMA' | 'KUASA';
  namaPenerimaKuasa?: string;
  /** Bukti terima: tanda tangan, foto, atau nomor bukti transfer. */
  buktiTerima?: string;
}

/**
 * Bolehkah penyaluran dicatat?
 *
 * Bantuan yang diwakilkan wajib menyebut nama yang mewakili. Penyaluran yang
 * hanya mencatat "diwakilkan" tanpa nama adalah baris yang tidak dapat
 * ditelusuri ketika penerimanya menyatakan tidak pernah menerima apa pun — dan
 * pernyataan itu pasti muncul sekurang-kurangnya sekali di tiap program.
 */
export function bolehSalurkan(p: Penyaluran): Putusan {
  if (p.statusPenerima !== 'DITETAPKAN') {
    return {
      boleh: false,
      alasan: `Bantuan hanya disalurkan kepada penerima yang sudah ditetapkan (status sekarang ${p.statusPenerima}).`,
    };
  }
  if (!Number.isFinite(p.nilai) || p.nilai <= 0) {
    return { boleh: false, alasan: 'Nilai penyaluran harus lebih besar dari nol.' };
  }
  if (p.diterimaOleh === 'KUASA' && !p.namaPenerimaKuasa?.trim()) {
    return {
      boleh: false,
      alasan:
        'Nama yang mewakili wajib dicatat. Penyaluran yang hanya tertulis "diwakilkan" tidak ' +
        'dapat ditelusuri ketika penerimanya menyatakan tidak pernah menerima apa pun.',
    };
  }
  if (p.bentuk === 'UANG' && !p.buktiTerima?.trim()) {
    return {
      boleh: false,
      alasan: 'Penyaluran berbentuk uang wajib menyertakan bukti terima.',
    };
  }
  return { boleh: true };
}
