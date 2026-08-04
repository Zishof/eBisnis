/**
 * H-9J — Pemeliharaan biomedis, kalibrasi, dan keamanan siber alat.
 *
 * Aturan sebagai fungsi murni. Tidak menyentuh basis data.
 *
 * Modul ini berdiri di atas satu kenyataan yang harus diterima apa adanya:
 * **alat medis tidak dapat diamankan seperti server.** Ia menjalankan sistem
 * operasi yang tidak lagi menerima tambalan, tidak boleh dipasangi perangkat
 * lunak keamanan tambahan tanpa membatalkan sertifikasinya, sering memakai kata
 * sandi bawaan yang tidak dapat diubah, dan tidak dapat dimatikan untuk
 * diperbarui karena ada pasien yang memakainya.
 *
 * Akibatnya, seluruh modul ini menolak satu godaan yang sama berulang kali:
 * **menonaktifkan alat secara otomatis ketika sesuatu tampak buruk.** Alat yang
 * dimatikan sendiri oleh perangkat lunak adalah ventilator yang berhenti,
 * pompa infus yang berhenti, atau monitor yang berhenti — pada pasien yang
 * sedang memakainya. Yang dilakukan modul ini adalah **menyatakan temuannya,
 * menamai akibatnya, dan menuntut keputusan manusia yang tercatat.**
 *
 * Satu-satunya pengecualian ada di bawah, dan pengecualian itu dijelaskan
 * alasannya: uji keselamatan listrik yang GAGAL.
 */

// --- Pemeliharaan ------------------------------------------------------------

export type JenisPekerjaan =
  | 'PREVENTIVE'
  | 'CORRECTIVE'
  | 'CALIBRATION'
  | 'SAFETY_INSPECTION'
  | 'SOFTWARE_UPDATE';

export type StatusPekerjaan = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface JadwalPemeliharaan {
  /** Selang pemeliharaan pencegahan dalam hari. */
  intervalHari: number;
  terakhirDikerjakan: string | null;
}

/**
 * Kapan pemeliharaan berikutnya jatuh tempo.
 *
 * Alat yang belum pernah dipelihara jatuh tempo **sekarang**, bukan satu selang
 * dari sekarang. Menghitungnya dari tanggal pendaftaran akan memberi alat bekas
 * yang baru masuk registri satu tahun tenggang yang tidak pernah diberikan
 * siapa pun.
 */
export function jatuhTempoPemeliharaan(
  jadwal: JadwalPemeliharaan,
  hariIni: string,
): string {
  if (!jadwal.terakhirDikerjakan) return hariIni;
  const t = new Date(`${jadwal.terakhirDikerjakan}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + jadwal.intervalHari);
  return t.toISOString().slice(0, 10);
}

export interface StatusPemeliharaan {
  jatuhTempo: string;
  terlambatHari: number;
  terlambat: boolean;
  /**
   * SELALU false.
   *
   * Pemeliharaan yang terlambat **menandai**, tidak menghentikan. Alat yang
   * dihentikan sendiri oleh penjadwal adalah alat yang berhenti pada saat yang
   * dipilih kalender, bukan pada saat yang dipilih orang yang tahu ada pasien
   * memakainya atau tidak.
   */
  menghentikanLayanan: false;
  keterangan: string;
}

export function periksaPemeliharaan(
  jadwal: JadwalPemeliharaan,
  hariIni: string,
): StatusPemeliharaan {
  const jatuhTempo = jatuhTempoPemeliharaan(jadwal, hariIni);
  const selisih = Math.floor(
    (Date.parse(`${hariIni}T00:00:00Z`) - Date.parse(`${jatuhTempo}T00:00:00Z`)) / 86400000,
  );
  const terlambat = selisih > 0;
  return {
    jatuhTempo,
    terlambatHari: terlambat ? selisih : 0,
    terlambat,
    menghentikanLayanan: false,
    keterangan: terlambat
      ? `Pemeliharaan terlambat ${selisih} hari. Alat tetap melayani; ` +
        'jadwalkan pekerjaan pemeliharaan. Menghentikan alat karena jadwalnya lewat ' +
        'akan menghentikannya pada saat yang dipilih kalender, bukan pada saat yang ' +
        'dipilih orang yang tahu ada pasien memakainya atau tidak.'
      : `Pemeliharaan berikutnya ${jatuhTempo}.`,
  };
}

/**
 * Bolehkah alat kembali melayani sesudah pekerjaan pemeliharaan?
 *
 * Tidak, selama pekerjaannya belum ditutup. Alat yang dikembalikan ke pelayanan
 * dengan pekerjaan yang masih terbuka adalah alat yang dilupakan seseorang —
 * dan pekerjaan yang tidak pernah ditutup tidak pernah pula ditanyakan.
 */
export function bolehKembaliMelayani(pekerjaan: {
  status: StatusPekerjaan;
  jenis: JenisPekerjaan;
  hasilInspeksi?: HasilInspeksi | null;
}): { boleh: boolean; alasan: string } {
  if (pekerjaan.status === 'OPEN' || pekerjaan.status === 'IN_PROGRESS') {
    return {
      boleh: false,
      alasan:
        'Pekerjaan pemeliharaannya belum ditutup. Alat yang dikembalikan ke pelayanan ' +
        'dengan pekerjaan yang masih terbuka adalah alat yang dilupakan seseorang.',
    };
  }
  if (pekerjaan.jenis === 'SAFETY_INSPECTION' && pekerjaan.hasilInspeksi === 'FAIL') {
    return {
      boleh: false,
      alasan:
        'Uji keselamatan listriknya GAGAL. Ini satu-satunya temuan pada modul ini yang ' +
        'benar-benar menghentikan alat, dan sebabnya berbeda dari yang lain: kalibrasi ' +
        'yang lewat berarti hasilnya MUNGKIN menyimpang, sedangkan uji listrik yang gagal ' +
        'berarti alatnya MUNGKIN menyetrum orang yang menyentuhnya. Yang pertama ' +
        'ditandai; yang kedua tidak boleh menunggu keputusan siapa pun.',
    };
  }
  return { boleh: true, alasan: 'Pekerjaan selesai; alat boleh kembali melayani.' };
}

export type HasilInspeksi = 'PASS' | 'FAIL' | 'PASS_WITH_NOTE';

/**
 * Pekerjaan korektif yang lahir dari kejadian yang mengenai pasien wajib
 * menunjuk laporan insidennya.
 *
 * Tanpa tautan itu, dua catatan tentang satu kejadian yang sama hidup terpisah:
 * satu di berkas teknisi ("pompa diganti"), satu di berkas keselamatan pasien
 * ("dosis berlebih"). Yang mencari pola tidak akan pernah menemukan bahwa pompa
 * merek itu sudah tiga kali.
 */
export function wajibTautInsiden(input: {
  jenis: JenisPekerjaan;
  mengenaiPasien: boolean;
  safetyIncidentId: string | null;
}): { sah: boolean; alasan: string } {
  if (input.jenis !== 'CORRECTIVE' || !input.mengenaiPasien) {
    return { sah: true, alasan: 'Tidak menuntut tautan insiden.' };
  }
  if (input.safetyIncidentId) {
    return { sah: true, alasan: 'Tertaut laporan insiden keselamatan pasien.' };
  }
  return {
    sah: false,
    alasan:
      'Pekerjaan korektif yang lahir dari kejadian yang mengenai pasien wajib menunjuk ' +
      'laporan insiden keselamatannya. Tanpa tautan itu, catatan teknisi dan catatan ' +
      'keselamatan pasien hidup terpisah — dan yang mencari pola tidak akan pernah ' +
      'menemukan bahwa alat merek itu sudah tiga kali.',
  };
}

// --- Kalibrasi ---------------------------------------------------------------

export interface CatatanKalibrasi {
  dilakukanPada: string;
  berlakuSampai: string;
  hasil: HasilInspeksi;
  standarAcuan: string | null;
}

/**
 * Kalibrasi wajib menyebut standar acuannya.
 *
 * "Sudah dikalibrasi" tanpa menyebut terhadap apa adalah pernyataan yang tidak
 * dapat diperiksa siapa pun. Ia hanya berarti seseorang menekan tombol.
 */
export function periksaCatatanKalibrasi(c: CatatanKalibrasi): {
  sah: boolean;
  alasan: string;
} {
  if (Date.parse(c.berlakuSampai) < Date.parse(c.dilakukanPada)) {
    return { sah: false, alasan: 'Masa berlaku kalibrasi mendahului tanggal pelaksanaannya.' };
  }
  if (c.hasil !== 'FAIL' && !c.standarAcuan?.trim()) {
    return {
      sah: false,
      alasan:
        'Kalibrasi wajib menyebut standar acuannya. "Sudah dikalibrasi" tanpa menyebut ' +
        'terhadap apa hanya berarti seseorang menekan tombol.',
    };
  }
  return { sah: true, alasan: 'Catatan kalibrasi lengkap.' };
}

// --- Keamanan siber ----------------------------------------------------------

/**
 * Faktor risiko bawaan alat, beserta bobot dan **alasan** masing-masing.
 *
 * Bobotnya ada di satu tempat ini saja. Bobot yang tersebar di beberapa berkas
 * akan berbeda satu sama lain dalam waktu enam bulan, dan tidak ada yang akan
 * tahu yang mana yang benar.
 */
export const FAKTOR_RISIKO = {
  OS_END_OF_LIFE: {
    bobot: 3,
    nama: 'Sistem operasi tidak lagi menerima tambalan',
    alasan:
      'Celah yang ditemukan sesudah ini tidak akan pernah ditambal. Ia bukan risiko yang ' +
      'menurun seiring waktu, melainkan yang menaik.',
  },
  VENDOR_SUPPORT_ENDED: {
    bobot: 3,
    nama: 'Dukungan pabrikan berakhir',
    alasan:
      'Tidak akan ada perbaikan, dan tidak akan ada pula pemberitahuan bahwa ada yang ' +
      'perlu diperbaiki.',
  },
  DEFAULT_CREDENTIALS: {
    bobot: 4,
    nama: 'Kata sandi bawaan pabrik masih terpasang',
    alasan:
      'Kata sandi bawaan alat medis tercantum pada manual yang dapat diunduh siapa pun. ' +
      'Sebagian alat tidak mengizinkan penggantiannya sama sekali — dan justru alat ' +
      'itulah yang paling menuntut penahan di sekelilingnya.',
  },
  INTERNET_REACHABLE: {
    bobot: 5,
    nama: 'Dapat dijangkau dari internet',
    alasan:
      'Alat medis yang dapat dijangkau dari internet ditemukan pemindai otomatis dalam ' +
      'hitungan jam, bukan bulan. Ini faktor tunggal terberat pada daftar ini.',
  },
  REMOVABLE_MEDIA: {
    bobot: 2,
    nama: 'Media lepasan aktif',
    alasan: 'Jalan masuk yang tidak melewati jaringan, sehingga tidak terlihat pemantau jaringan.',
  },
  REMOTE_CONTROL: {
    bobot: 4,
    nama: 'Kendali jarak jauh menyala',
    alasan:
      'Menaikkan akibat setiap celah lain: yang tadinya membaca data kini dapat mengubah ' +
      'apa yang dilakukan alat kepada pasien.',
  },
  PATIENT_CONNECTED: {
    bobot: 3,
    nama: 'Terhubung langsung ke pasien',
    alasan:
      'Menentukan akibat, bukan kemungkinan. Kegagalan pada alat yang terhubung ke pasien ' +
      'tidak dapat ditunda sampai jam kerja.',
  },
  STORES_PHI: {
    bobot: 2,
    nama: 'Menyimpan data pasien secara lokal',
    alasan: 'Alat yang dicuri atau dijual bekas membawa serta data yang ada di dalamnya.',
  },
} as const;

export type KodeFaktor = keyof typeof FAKTOR_RISIKO;

/**
 * Penahan pengganti — yang diletakkan DI SEKELILING alat, bukan di dalamnya.
 *
 * Inilah seluruh jawaban terhadap kenyataan bahwa alat medis tidak dapat
 * ditambal: keamanannya tidak diletakkan pada alatnya.
 */
export const PENAHAN_PENGGANTI = {
  NETWORK_SEGMENTED: {
    pengurang: 4,
    nama: 'Jaringan tersegmentasi',
    alasan:
      'Alat tidak dapat menjangkau apa pun selain gateway-nya. Penahan tunggal paling ' +
      'kuat yang tersedia bagi alat yang tidak dapat ditambal.',
  },
  ACCESS_RESTRICTED: {
    pengurang: 2,
    nama: 'Akses dibatasi hanya dari gateway',
    alasan: 'Mempersempit siapa yang dapat berbicara kepadanya, sekalipun jaringannya ditembus.',
  },
  TRAFFIC_MONITORED: {
    pengurang: 2,
    nama: 'Lalu lintasnya dipantau',
    alasan:
      'Tidak mencegah, tetapi memperpendek jarak antara kejadian dan diketahuinya kejadian ' +
      'itu — dan jarak itulah yang menentukan besar kerusakannya.',
  },
  PHYSICALLY_SECURED: {
    pengurang: 1,
    nama: 'Diamankan secara fisik',
    alasan: 'Menutup media lepasan dan port layanan dari orang yang lewat.',
  },
  OFFLINE_PROCEDURE: {
    pengurang: 2,
    nama: 'Ada prosedur luring bila alat berhenti',
    alasan:
      'Tidak mengurangi kemungkinan sama sekali; mengurangi akibatnya. Rumah sakit yang ' +
      'punya prosedur luring dapat mematikan alat yang tersusupi; yang tidak punya akan ' +
      'membiarkannya menyala.',
  },
} as const;

export type KodePenahan = keyof typeof PENAHAN_PENGGANTI;

export type TingkatRisiko = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface HasilPenilaianRisiko {
  skorBawaan: number;
  pengurang: number;
  skorSisa: number;
  tingkat: TingkatRisiko;
  faktor: { kode: KodeFaktor; nama: string; bobot: number; alasan: string }[];
  penahan: { kode: KodePenahan; nama: string; pengurang: number; alasan: string }[];
  penahanDitolak: { kode: string; alasan: string }[];
  /**
   * SELALU false. Lihat `keputusanWajib` untuk yang harus dilakukan.
   */
  memutusAlatOtomatis: false;
  catatan: string[];
}

/**
 * Menilai risiko siber satu alat.
 *
 * Dua aturan yang menentukan bentuk fungsi ini:
 *
 * 1. **Penahan pengganti MENGURANGI risiko; ia tidak pernah menghilangkannya.**
 *    Skor sisa tidak pernah turun di bawah sepertiga skor bawaannya, dibulatkan
 *    ke atas. Segmentasi jaringan yang sempurna pun tidak membuat alat ber-OS
 *    kedaluwarsa menjadi alat yang aman — ia membuatnya menjadi alat yang
 *    risikonya dapat ditanggung, dan kedua hal itu berbeda.
 *
 * 2. **Penahan yang tidak berbukti tidak dihitung.** Penahan yang diakui tanpa
 *    rujukan buktinya adalah kotak yang dicentang, dan kotak yang dicentang
 *    adalah cara paling umum sebuah asesmen risiko menjadi tidak berarti.
 */
export function nilaiRisikoSiber(input: {
  faktor: Partial<Record<KodeFaktor, boolean>>;
  penahan: { kode: KodePenahan; buktiRef: string | null }[];
}): HasilPenilaianRisiko {
  const faktorAktif = (Object.keys(FAKTOR_RISIKO) as KodeFaktor[])
    .filter((k) => input.faktor[k] === true)
    .map((k) => ({ kode: k, ...FAKTOR_RISIKO[k] }));

  const skorBawaan = faktorAktif.reduce((s, f) => s + f.bobot, 0);

  const diterima: HasilPenilaianRisiko['penahan'] = [];
  const ditolak: HasilPenilaianRisiko['penahanDitolak'] = [];
  const sudah = new Set<string>();

  for (const p of input.penahan) {
    const def = PENAHAN_PENGGANTI[p.kode];
    if (!def) {
      ditolak.push({ kode: String(p.kode), alasan: 'Penahan tidak dikenal.' });
      continue;
    }
    if (sudah.has(p.kode)) {
      ditolak.push({ kode: p.kode, alasan: 'Penahan yang sama diakui dua kali.' });
      continue;
    }
    if (!p.buktiRef?.trim()) {
      ditolak.push({
        kode: p.kode,
        alasan:
          'Penahan tanpa rujukan bukti tidak dihitung. Penahan yang diakui tanpa bukti ' +
          'adalah kotak yang dicentang, dan kotak yang dicentang adalah cara paling umum ' +
          'sebuah asesmen risiko menjadi tidak berarti.',
      });
      continue;
    }
    sudah.add(p.kode);
    diterima.push({ kode: p.kode, ...def });
  }

  const pengurang = diterima.reduce((s, p) => s + p.pengurang, 0);

  /*
   * LANTAI RISIKO SISA.
   *
   * Sepertiga skor bawaan, dibulatkan ke atas. Tanpa lantai ini, alat dengan
   * lima faktor berat dan lima penahan lengkap akan berskor nol — dan skor nol
   * berarti "tidak perlu ditinjau lagi", yang persis kebalikan dari yang benar
   * bagi alat yang tidak dapat ditambal.
   */
  const lantai = skorBawaan === 0 ? 0 : Math.ceil(skorBawaan / 3);
  const skorSisa = Math.max(lantai, skorBawaan - pengurang);

  const catatan: string[] = [];
  if (skorBawaan > 0 && skorBawaan - pengurang < lantai) {
    catatan.push(
      `Penahan menurunkan skor sampai ${skorBawaan - pengurang}, tetapi risiko sisa ` +
        `ditahan pada ${lantai}. Penahan pengganti mengurangi risiko; ia tidak ` +
        'menghilangkannya. Segmentasi yang sempurna pun tidak membuat alat ber-OS ' +
        'kedaluwarsa menjadi alat yang aman — ia membuatnya menjadi alat yang risikonya ' +
        'dapat ditanggung.',
    );
  }
  if (input.faktor.INTERNET_REACHABLE && input.faktor.DEFAULT_CREDENTIALS) {
    catatan.push(
      'Dapat dijangkau dari internet DENGAN kata sandi bawaan. Gabungan ini tidak ' +
        'menuntut penyerang yang terampil; ia menuntut penyerang yang membaca manual.',
    );
  }
  if (input.faktor.REMOTE_CONTROL && input.faktor.VENDOR_SUPPORT_ENDED) {
    catatan.push(
      'Kendali jarak jauh menyala pada alat yang dukungan pabrikannya sudah berakhir. ' +
        'Antarmuka perintahnya tidak akan pernah diperbaiki lagi.',
    );
  }

  return {
    skorBawaan,
    pengurang,
    skorSisa,
    tingkat: tingkatRisiko(skorSisa),
    faktor: faktorAktif,
    penahan: diterima,
    penahanDitolak: ditolak,
    memutusAlatOtomatis: false,
    catatan,
  };
}

export function tingkatRisiko(skor: number): TingkatRisiko {
  if (skor >= 10) return 'CRITICAL';
  if (skor >= 6) return 'HIGH';
  if (skor >= 3) return 'MEDIUM';
  return 'LOW';
}

export type Keputusan = 'ACCEPT' | 'MITIGATE' | 'RETIRE';

/**
 * Apa yang wajib dilakukan atas hasil penilaian, dan apa yang **tidak**.
 *
 * Yang tidak: memutus alat. Tidak sekali pun, pada tingkat mana pun. Alat yang
 * diputus sendiri oleh perangkat lunak adalah ventilator yang berhenti pada
 * pasien yang sedang memakainya, dan tidak ada skor risiko yang sepadan dengan
 * itu. Yang dituntut adalah keputusan manusia yang tercatat, bertenggat, dan
 * bertanda tangan.
 */
export function keputusanWajib(tingkat: TingkatRisiko): {
  wajibKeputusan: boolean;
  tenggatHari: number | null;
  bolehDiterima: boolean;
  memutusAlatOtomatis: false;
  keterangan: string;
} {
  switch (tingkat) {
    case 'CRITICAL':
      return {
        wajibKeputusan: true,
        tenggatHari: 7,
        bolehDiterima: true,
        memutusAlatOtomatis: false,
        keterangan:
          'Menuntut keputusan tercatat dalam 7 hari: terima dengan alasan bernama, ' +
          'kurangi dengan rencana bertanggal, atau pensiunkan dengan rencana pengganti. ' +
          'MENERIMANYA tetap boleh — rumah sakit yang tidak dapat menerima risiko apa pun ' +
          'akan mematikan alat yang dibutuhkan pasiennya — tetapi penerimaannya harus ' +
          'bernama, bertenggat, dan dapat ditanyakan kembali.',
      };
    case 'HIGH':
      return {
        wajibKeputusan: true,
        tenggatHari: 30,
        bolehDiterima: true,
        memutusAlatOtomatis: false,
        keterangan: 'Menuntut keputusan tercatat dalam 30 hari.',
      };
    case 'MEDIUM':
      return {
        wajibKeputusan: true,
        tenggatHari: 90,
        bolehDiterima: true,
        memutusAlatOtomatis: false,
        keterangan: 'Menuntut keputusan tercatat dalam 90 hari.',
      };
    default:
      return {
        wajibKeputusan: false,
        tenggatHari: null,
        bolehDiterima: true,
        memutusAlatOtomatis: false,
        keterangan: 'Ditinjau ulang pada siklus penilaian berikutnya.',
      };
  }
}

/**
 * Penerimaan risiko wajib punya tanggal peninjauan ulang.
 *
 * Penerimaan tanpa tanggal tinjau adalah penerimaan selamanya — dan selamanya
 * adalah bagaimana alat tahun 2016 masih berjalan pada tahun 2026 dengan
 * catatan "risiko diterima" yang ditandatangani orang yang sudah pensiun.
 */
export function periksaPenerimaanRisiko(input: {
  keputusan: Keputusan;
  alasan: string | null;
  tinjauUlangPada: string | null;
  rencanaRef: string | null;
  diputuskanOleh: string | null;
  dinilaiOleh: string | null;
}): { sah: boolean; alasan: string } {
  if (!input.diputuskanOleh) {
    return { sah: false, alasan: 'Keputusan risiko wajib bernama.' };
  }
  if (input.dinilaiOleh && input.diputuskanOleh === input.dinilaiOleh) {
    return {
      sah: false,
      alasan:
        'Yang menilai risikonya tidak memutuskan penerimaannya sendiri. Penilaian ' +
        'menyatakan seberapa besar risikonya; keputusan menyatakan bahwa risiko sebesar ' +
        'itu ditanggung rumah sakit. Pertanyaan yang berbeda, dan yang kedua bukan milik ' +
        'orang yang menjawab yang pertama.',
    };
  }
  if (!input.alasan || input.alasan.trim().length < 20) {
    return {
      sah: false,
      alasan:
        'Keputusan risiko wajib beralasan sekurangnya 20 huruf. Alasan sepatah kata ' +
        'tidak dapat ditelaah siapa pun setahun kemudian.',
    };
  }
  if (input.keputusan === 'ACCEPT' && !input.tinjauUlangPada) {
    return {
      sah: false,
      alasan:
        'Penerimaan risiko wajib punya tanggal peninjauan ulang. Penerimaan tanpa tanggal ' +
        'tinjau adalah penerimaan selamanya — dan selamanya adalah bagaimana alat tahun ' +
        '2016 masih berjalan hari ini dengan catatan "risiko diterima" yang ' +
        'ditandatangani orang yang sudah pensiun.',
    };
  }
  if ((input.keputusan === 'MITIGATE' || input.keputusan === 'RETIRE') && !input.rencanaRef) {
    return {
      sah: false,
      alasan:
        'Keputusan mengurangi atau memensiunkan wajib menunjuk rencananya. Niat tanpa ' +
        'rencana bertanggal tidak dapat dibedakan dari penerimaan risiko yang tidak ' +
        'mau mengakui dirinya.',
    };
  }
  return { sah: true, alasan: 'Keputusan risiko lengkap.' };
}

/** Penerimaan risiko yang lewat tanggal tinjaunya tidak lagi berlaku. */
export function penerimaanMasihBerlaku(
  tinjauUlangPada: string | null,
  hariIni: string,
): { berlaku: boolean; keterangan: string } {
  if (!tinjauUlangPada) {
    return { berlaku: false, keterangan: 'Tanpa tanggal tinjau; tidak dianggap berlaku.' };
  }
  const lewat = Date.parse(`${tinjauUlangPada}T00:00:00Z`) < Date.parse(`${hariIni}T00:00:00Z`);
  return {
    berlaku: !lewat,
    keterangan: lewat
      ? `Penerimaan risiko kedaluwarsa sejak ${tinjauUlangPada}. Alat kembali ke daftar ` +
        'yang menunggu keputusan — bukan ke daftar yang harus dimatikan.'
      : `Berlaku sampai ${tinjauUlangPada}.`,
  };
}

// --- Insiden keamanan siber alat ---------------------------------------------

export type JenisInsidenSiber =
  | 'MALWARE'
  | 'UNAUTHORIZED_ACCESS'
  | 'UNAUTHORIZED_COMMAND'
  | 'DATA_EXFILTRATION'
  | 'RANSOMWARE'
  | 'DENIAL_OF_SERVICE'
  | 'UNPATCHED_EXPLOIT'
  | 'PHYSICAL_TAMPERING'
  | 'OTHER';

/**
 * Insiden siber yang mengenai perawatan pasien **juga** insiden keselamatan
 * pasien.
 *
 * Dua daftar tentang satu kejadian yang sama adalah cara paling rapi untuk
 * membuat kejadian itu tidak pernah dihitung. Pompa infus yang berhenti karena
 * penyanderaan data adalah kejadian teknologi informasi menurut satu daftar dan
 * kejadian keselamatan pasien menurut daftar yang lain — dan bila keduanya
 * tidak bertaut, tidak ada satu pun yang tahu keduanya kejadian yang sama.
 */
export function wajibLaporKeselamatan(input: {
  jenis: JenisInsidenSiber;
  mempengaruhiPerawatan: boolean;
  safetyIncidentId: string | null;
}): { sah: boolean; wajib: boolean; alasan: string } {
  const wajib = input.mempengaruhiPerawatan;
  if (!wajib) {
    return {
      sah: true,
      wajib: false,
      alasan: 'Tidak mengenai perawatan pasien; cukup dicatat sebagai insiden siber.',
    };
  }
  if (input.safetyIncidentId) {
    return { sah: true, wajib: true, alasan: 'Tertaut laporan keselamatan pasien.' };
  }
  return {
    sah: false,
    wajib: true,
    alasan:
      'Insiden siber yang mempengaruhi perawatan pasien wajib pula dilaporkan sebagai ' +
      'insiden keselamatan pasien, dan tautannya dicatat. Dua daftar tentang satu ' +
      'kejadian yang sama adalah cara paling rapi untuk membuat kejadian itu tidak ' +
      'pernah dihitung.',
  };
}

/**
 * Yang dilakukan ketika alat diduga tersusupi.
 *
 * Bukan mematikannya. Perhatikan urutannya: **isolasi jaringan lebih dahulu,
 * penggantian alat kemudian, dan pemutusan dari pasien tidak pernah dilakukan
 * perangkat lunak.** Alat yang tersusupi tetapi masih menopang pasien lebih
 * baik daripada alat yang mati.
 */
export function langkahPenahanan(input: {
  terhubungPasien: boolean;
  adaPenggantiTersedia: boolean;
}): { langkah: string[]; memutusAlatOtomatis: false } {
  const langkah = [
    'Isolasi jaringan alat — putuskan jalurnya ke gateway, bukan dayanya.',
    'Catat keadaan alat apa adanya sebelum apa pun diubah; yang hilang tidak dapat diambil kembali.',
  ];
  if (input.terhubungPasien) {
    langkah.push(
      'ALAT MASIH TERHUBUNG KE PASIEN. Jangan memutus daya, jangan mengganti alat, dan ' +
        'jangan menghentikan terapinya sampai ada tenaga klinis di sisi pasien. Alat yang ' +
        'tersusupi tetapi masih menopang pasien lebih baik daripada alat yang mati.',
    );
    langkah.push(
      input.adaPenggantiTersedia
        ? 'Pengganti tersedia: peralihan dilakukan tenaga klinis, bukan teknisi jaringan.'
        : 'Tidak ada pengganti tersedia: jalankan prosedur luring dan naikkan pemantauan.',
    );
  } else {
    langkah.push('Alat tidak terhubung pasien: boleh dimatikan untuk pemeriksaan.');
  }
  langkah.push('Laporkan sebagai insiden siber; bila mengenai perawatan, tautkan ke keselamatan pasien.');
  return { langkah, memutusAlatOtomatis: false };
}

/**
 * Daftar alat yang menuntut perhatian, terurut.
 *
 * Urutannya bukan menurut skor semata: yang **tenggat keputusannya sudah lewat**
 * didahulukan atas yang skornya lebih tinggi tetapi masih dalam tenggat. Daftar
 * yang diurut skor saja akan menaruh alat yang sudah dua tahun tanpa keputusan
 * di bawah alat yang baru dinilai kemarin.
 */
export function urutkanPerhatian<
  T extends {
    tingkat: TingkatRisiko;
    skorSisa: number;
    tenggatKeputusan: string | null;
    adaKeputusanBerlaku: boolean;
  },
>(daftar: T[], hariIni: string): T[] {
  const urutTingkat: Record<TingkatRisiko, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  const lewatTenggat = (d: T) =>
    !d.adaKeputusanBerlaku &&
    d.tenggatKeputusan !== null &&
    Date.parse(`${d.tenggatKeputusan}T00:00:00Z`) < Date.parse(`${hariIni}T00:00:00Z`);

  return [...daftar].sort((a, b) => {
    const la = lewatTenggat(a) ? 0 : 1;
    const lb = lewatTenggat(b) ? 0 : 1;
    if (la !== lb) return la - lb;
    if (urutTingkat[a.tingkat] !== urutTingkat[b.tingkat]) {
      return urutTingkat[a.tingkat] - urutTingkat[b.tingkat];
    }
    return b.skorSisa - a.skorSisa;
  });
}
