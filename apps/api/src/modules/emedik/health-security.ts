/**
 * H-12 — Zona data kesehatan, tujuan penggunaan, break-glass, penyamaran medan,
 * dan pola redaksi AI untuk data kesehatan.
 *
 * Aturan sebagai fungsi murni. Tidak menyentuh basis data.
 *
 * ## Yang membedakan fase ini dari sebelas fase sebelumnya
 *
 * Sebelas fase sebelumnya membangun kemampuan, dan masing-masing membawa
 * penjaganya sendiri. Fase ini tidak membangun kemampuan baru: ia **memeriksa
 * bahwa penjaga-penjaga itu benar-benar berdiri**, dan menambahkan yang
 * terlewat.
 *
 * Karena itu sebagian besar isinya berbentuk pemeriksaan, bukan tindakan — dan
 * sebagian besar naskah buktinya berbentuk serangan, bukan penggunaan.
 */

// --- Zona data ---------------------------------------------------------------

/**
 * Zona data kesehatan.
 *
 * Bukan tiga tingkat "rendah/sedang/tinggi" — itu penggolongan yang setiap
 * orang menafsirkannya sendiri. Yang dipakai di sini adalah golongan menurut
 * **apa yang terjadi bila ia bocor**, sebab itulah pertanyaan yang sesungguhnya
 * menentukan perlakuannya.
 */
export type ZonaData =
  | 'PUBLIC'
  | 'OPERATIONAL'
  | 'IDENTIFYING'
  | 'CLINICAL'
  | 'SENSITIVE_CLINICAL';

export interface DefinisiZona {
  zona: ZonaData;
  nama: string;
  bilaBocor: string;
  bolehKeAi: boolean;
  wajibTujuanPenggunaan: boolean;
  disamarkanPadaEkspor: boolean;
}

export const ZONA: Record<ZonaData, DefinisiZona> = {
  PUBLIC: {
    zona: 'PUBLIC',
    nama: 'Publik',
    bilaBocor: 'Tidak ada akibat: ia memang diterbitkan. Jam praktik, nama poliklinik, alamat.',
    bolehKeAi: true,
    wajibTujuanPenggunaan: false,
    disamarkanPadaEkspor: false,
  },
  OPERATIONAL: {
    zona: 'OPERATIONAL',
    nama: 'Operasional',
    bilaBocor:
      'Merugikan fasilitas, tidak merugikan pasien. Tarif, jadwal alat, jumlah tempat tidur.',
    bolehKeAi: true,
    wajibTujuanPenggunaan: false,
    disamarkanPadaEkspor: false,
  },
  IDENTIFYING: {
    zona: 'IDENTIFYING',
    nama: 'Mengenali orang',
    bilaBocor:
      'Menyingkap SIAPA. Nama, NIK, nomor rekam medis, alamat, nomor telepon. Ia belum menyebut ' +
      'penyakit apa pun — dan justru karena itu sering dianggap tidak berbahaya, padahal ia ' +
      'kunci yang membuka seluruh sisanya.',
    bolehKeAi: false,
    wajibTujuanPenggunaan: true,
    disamarkanPadaEkspor: true,
  },
  CLINICAL: {
    zona: 'CLINICAL',
    nama: 'Klinis',
    bilaBocor:
      'Menyingkap APA. Diagnosis, tindakan, resep, hasil laboratorium. Bergabung dengan zona ' +
      'yang mengenali orang, ia menjadi rekam medis yang utuh.',
    bolehKeAi: false,
    wajibTujuanPenggunaan: true,
    disamarkanPadaEkspor: true,
  },
  SENSITIVE_CLINICAL: {
    zona: 'SENSITIVE_CLINICAL',
    nama: 'Klinis sangat sensitif',
    bilaBocor:
      'Menyingkap apa yang membuat orang kehilangan pekerjaan, keluarga, atau nyawanya. HIV, ' +
      'kesehatan jiwa, kekerasan seksual, penyalahgunaan zat, kehamilan pada keadaan tertentu, ' +
      'genetika. Kebocorannya tidak dapat dipulihkan dengan permintaan maaf.',
    bolehKeAi: false,
    wajibTujuanPenggunaan: true,
    disamarkanPadaEkspor: true,
  },
};

/**
 * Zona yang **tidak boleh sampai ke AI**, apa pun alasannya.
 *
 * Dinyatakan sebagai daftar tersendiri supaya ia dapat diuji sebagai satu
 * pernyataan, bukan disimpulkan dari menelusuri lima definisi.
 */
export const ZONA_TERLARANG_AI: readonly ZonaData[] = [
  'IDENTIFYING',
  'CLINICAL',
  'SENSITIVE_CLINICAL',
];

export function bolehKeAi(zona: ZonaData): { boleh: boolean; alasan: string } {
  const z = ZONA[zona];
  if (!z) return { boleh: false, alasan: `Zona ${zona} tidak dikenal.` };
  if (!z.bolehKeAi) {
    return {
      boleh: false,
      alasan:
        `Zona ${z.nama} tidak boleh dikirim ke AI. ${z.bilaBocor} Model bahasa menyimpan ` +
        'permintaannya pada log penyedianya, dan log itu berada di luar jangkauan setiap ' +
        'perjanjian yang ditandatangani rumah sakit.',
    };
  }
  return { boleh: true, alasan: `Zona ${z.nama} boleh dikirim ke AI.` };
}

// --- Tujuan penggunaan -------------------------------------------------------

/**
 * Kosakata tujuan penggunaan.
 *
 * **Disalin dari constraint `health_access_purpose_valid` pada H002, bukan
 * disusun sendiri.**
 *
 * Rancangan pertama menyusunnya dari ingatan: ia memuat `PUBLIC_HEALTH` yang
 * tidak ada pada skema, dan menghilangkan `QUALITY` yang ada. Akibatnya bukan
 * galat pada saat itu juga, melainkan yang jauh lebih buruk — sebuah jalan
 * yang MENERIMA tajuk `PUBLIC_HEALTH`, membiarkan aksesnya berjalan, lalu
 * gagal ketika mencatatnya. Aksesnya terjadi; catatannya tidak.
 *
 * Ini kemunculan kedua cacat yang sama. Yang pertama H-9J: aksi `CLOSE`
 * disusun dari ingatan dan tidak ada pada kosakata hak akses, sehingga teknisi
 * tidak dapat menutup perintah kerjanya.
 */
export type TujuanPenggunaan =
  | 'TREATMENT'
  | 'PAYMENT'
  | 'OPERATIONS'
  | 'QUALITY'
  | 'RESEARCH'
  | 'PATIENT_REQUEST'
  | 'LEGAL'
  | 'EMERGENCY';

export const TUJUAN_PENGGUNAAN: readonly TujuanPenggunaan[] = [
  'TREATMENT',
  'PAYMENT',
  'OPERATIONS',
  'QUALITY',
  'RESEARCH',
  'PATIENT_REQUEST',
  'LEGAL',
  'EMERGENCY',
];

const TUJUAN_SAH = new Set<string>(TUJUAN_PENGGUNAAN);

/**
 * Memeriksa tujuan penggunaan.
 *
 * Daftar TERTUTUP. Tujuan bebas-teks akan diisi "kerja", "cek", atau dikosongkan
 * — dan jejak akses yang tujuannya "cek" tidak dapat ditelaah siapa pun.
 */
export function periksaTujuan(tujuan: string | null | undefined): {
  sah: boolean;
  alasan: string;
} {
  if (!tujuan) {
    return {
      sah: false,
      alasan:
        `Tajuk X-Purpose-Of-Use wajib dan harus salah satu dari: ${TUJUAN_PENGGUNAAN.join(', ')}.`,
    };
  }
  if (!TUJUAN_SAH.has(tujuan)) {
    return {
      sah: false,
      alasan:
        `Tujuan "${tujuan}" tidak dikenal. Daftarnya TERTUTUP: tujuan bebas-teks akan diisi ` +
        '"kerja" atau "cek", dan jejak akses yang tujuannya "cek" tidak dapat ditelaah siapa pun.',
    };
  }
  return { sah: true, alasan: `Tujuan ${tujuan}.` };
}

/**
 * `RESEARCH` menuntut persetujuan etik, dan `EMERGENCY` menuntut break-glass.
 *
 * Keduanya sering dipakai sebagai jalan pintas justru karena ia yang paling
 * jarang diperiksa — dan itulah sebabnya keduanya diperiksa di sini.
 */
export function syaratTambahanTujuan(input: {
  tujuan: TujuanPenggunaan;
  ethicsApprovalRef: string | null;
  breakGlass: boolean;
}): { sah: boolean; alasan: string } {
  if (input.tujuan === 'RESEARCH' && !input.ethicsApprovalRef) {
    return {
      sah: false,
      alasan:
        'Tujuan RESEARCH menuntut rujukan persetujuan etik. Penelitian tanpa persetujuan etik ' +
        'adalah pembacaan rekam medis yang menyebut dirinya penelitian.',
    };
  }
  if (input.tujuan === 'EMERGENCY' && !input.breakGlass) {
    return {
      sah: false,
      alasan:
        'Tujuan EMERGENCY hanya sah bersama break-glass yang tercatat. Tanpa itu, ia sekadar ' +
        'kata yang membuka pintu — dan kata yang membuka pintu akan diketik setiap hari.',
    };
  }
  return { sah: true, alasan: 'Syarat tujuan terpenuhi.' };
}

// --- Break-glass -------------------------------------------------------------

/**
 * Panjang alasan minimum, **disalin dari constraint
 * `health_access_breakglass_needs_reason` pada H002**.
 *
 * Angka ini tidak dipilih di sini. Ia dibaca dari basis data, sebab basis data
 * yang menegakkannya — dan fungsi yang memakai angka yang berbeda akan
 * meloloskan permintaan yang kemudian ditolak constraint, dengan pesan galat
 * yang tidak dapat dibaca siapa pun.
 */
export const PANJANG_ALASAN_MINIMUM = 10;

/** Di bawah ini, alasannya sah tetapi telaahnya naik prioritas. */
const PANJANG_ALASAN_MEYAKINKAN = 20;

/**
 * Break-glass: akses darurat yang **selalu ditelaah**, dan yang **tidak pernah
 * ditolak atas dasar penilaian tentang keadaan daruratnya**.
 *
 * Kalimat kedua itu perlu ditulis selengkap itu, sebab rancangan pertamanya
 * menyingkatnya menjadi "tidak pernah ditolak" — dan itu tidak benar pada
 * sistem ini. H002 menuntut alasan sepanjang sekurang-kurangnya sepuluh huruf,
 * dan basis datalah yang menegakkannya.
 *
 * Tuntutan itu benar dan dipertahankan: sepuluh huruf kira-kira dua kata,
 * bukan hambatan bagi orang yang sedang menolong, sedangkan break-glass tanpa
 * satu pun kata tidak dapat ditelaah siapa pun — dan yang tidak dapat ditelaah
 * sama saja dengan yang tidak dicatat.
 *
 * Yang TIDAK dilakukan fungsi ini adalah menilai apakah keadaannya sungguh
 * darurat. Perangkat lunak tidak berada pada posisi itu, dan penolakan atas
 * dasar itu akan menghentikan dokter yang sedang menangani pasien tidak
 * sadarkan diri.
 */
export function periksaBreakGlass(input: {
  alasan: string | null;
  patientTerdaftarPadaAktor: boolean;
}): { diizinkan: boolean; wajibTelaah: boolean; alasan: string } {
  const panjang = (input.alasan ?? '').trim().length;

  if (panjang < PANJANG_ALASAN_MINIMUM) {
    return {
      diizinkan: false,
      /*
       * Tetap wajib ditelaah sekalipun ditolak — percobaan break-glass yang
       * gagal berulang kali adalah pola yang perlu dilihat orang.
       */
      wajibTelaah: true,
      alasan:
        `Alasan akses darurat harus sekurang-kurangnya ${PANJANG_ALASAN_MINIMUM} huruf. ` +
        'Ini SATU-SATUNYA dasar penolakan break-glass, dan ia bukan penilaian tentang ' +
        'keadaan daruratnya: break-glass tanpa satu pun kata tidak dapat ditelaah siapa pun, ' +
        'dan yang tidak dapat ditelaah sama saja dengan yang tidak dicatat. Sepuluh huruf ' +
        'kira-kira dua kata. Ditegakkan constraint health_access_breakglass_needs_reason pada ' +
        'basis data pula, jadi menghindarinya lewat jalan lain tidak mungkin.',
    };
  }

  return {
    diizinkan: true,
    /*
     * Selalu ditelaah, kecuali pasiennya memang pasiennya sendiri — dan
     * bahkan itu pun tetap dicatat.
     */
    wajibTelaah: !input.patientTerdaftarPadaAktor,
    alasan:
      panjang >= PANJANG_ALASAN_MEYAKINKAN
        ? 'Akses darurat diizinkan dan akan ditelaah.'
        : 'Akses darurat DIIZINKAN sekalipun alasannya pendek — menahannya di sini akan ' +
          'menghentikan pertolongan. Tetapi alasan yang pendek menaikkan prioritas telaahnya: ' +
          'yang menuliskan sepatah kata pada kolom alasan sedang tergesa, atau sedang tidak ' +
          'jujur, dan keduanya perlu dilihat orang.',
  };
}

export interface TemuanTelaah {
  accessLogId: string;
  alasan: string;
  prioritas: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Menyusun antrean telaah break-glass, terurut menurut yang paling mencurigakan.
 *
 * Urutannya bukan menurut waktu. Antrean yang diurut waktu akan membuat yang
 * paling mencurigakan tenggelam di bawah ratusan akses yang wajar — dan yang
 * menelaahnya berhenti pada halaman kedua.
 */
export function antreanTelaah(
  akses: {
    id: string;
    alasan: string | null;
    umurJam: number;
    aktorMerawatPasien: boolean;
    diLuarJamKerja: boolean;
  }[],
): TemuanTelaah[] {
  return akses
    .map((a) => {
      const sebab: string[] = [];
      if (!a.aktorMerawatPasien) sebab.push('bukan pasien yang dirawatnya');
      if ((a.alasan ?? '').trim().length < 20) sebab.push('alasannya pendek');
      if (a.diLuarJamKerja) sebab.push('di luar jam kerja');

      const prioritas: 'HIGH' | 'MEDIUM' | 'LOW' =
        sebab.length >= 2 ? 'HIGH' : sebab.length === 1 ? 'MEDIUM' : 'LOW';

      return {
        accessLogId: a.id,
        alasan:
          sebab.length > 0
            ? `Perlu ditelaah: ${sebab.join('; ')}.`
            : 'Akses darurat wajar; tetap dicatat.',
        prioritas,
        _urut: sebab.length * 1000 + Math.min(a.umurJam, 999),
      };
    })
    .sort((a, b) => b._urut - a._urut)
    .map(({ accessLogId, alasan, prioritas }) => ({ accessLogId, alasan, prioritas }));
}

// --- Penyamaran medan --------------------------------------------------------

/**
 * Menyamarkan satu nilai menurut zonanya.
 *
 * **Penyamaran menyisakan bentuknya, bukan menghapusnya.** "Tono Suryo" menjadi
 * "T*** S****", bukan "[DISAMARKAN]". Alasannya bukan estetika: petugas yang
 * membandingkan dua daftar perlu tahu bahwa keduanya menunjuk orang yang
 * berbeda, dan "[DISAMARKAN]" pada dua baris tampak seperti orang yang sama.
 */
export function samarkanNilai(nilai: string | null, zona: ZonaData): string | null {
  if (nilai == null) return null;
  if (!ZONA[zona]?.disamarkanPadaEkspor) return nilai;

  const t = String(nilai);
  if (t.length === 0) return '';
  if (t.length === 1) return '*';

  // Nama: tiap kata disisakan huruf pertamanya.
  if (/^[A-Za-zÀ-ÿ'.\s-]+$/.test(t)) {
    return t
      .split(/\s+/)
      .map((k) => (k.length <= 1 ? k : `${k[0]}${'*'.repeat(k.length - 1)}`))
      .join(' ');
  }

  // Nomor: empat huruf terakhir disisakan — cukup untuk mencocokkan, tidak
  // cukup untuk mengenali.
  if (t.length > 4) return `${'*'.repeat(t.length - 4)}${t.slice(-4)}`;
  return '*'.repeat(t.length);
}

// --- Isolasi -----------------------------------------------------------------

/**
 * Memeriksa isolasi antar-tenant.
 *
 * Satu fungsi, satu pertanyaan: **apakah skema yang diminta sama dengan skema
 * pada token?** Tidak ada nilai bawaan, tidak ada "bila kosong maka pakai yang
 * ini". Nilai bawaan pada pemeriksaan isolasi adalah pintu yang terbuka ketika
 * pemanggilnya lupa mengisi.
 */
export function periksaIsolasi(input: {
  schemaDiminta: string | null | undefined;
  schemaToken: string | null | undefined;
}): { sah: boolean; alasan: string } {
  if (!input.schemaToken) {
    return {
      sah: false,
      alasan: 'Token tidak menyebut ruang kerja mana pun.',
    };
  }
  if (!input.schemaDiminta) {
    return {
      sah: false,
      alasan:
        'Permintaan tidak menyebut ruang kerja. Tidak ada nilai bawaan pada pemeriksaan ' +
        'isolasi — nilai bawaan adalah pintu yang terbuka ketika pemanggilnya lupa mengisi.',
    };
  }
  if (input.schemaDiminta !== input.schemaToken) {
    return {
      sah: false,
      alasan:
        'Ruang kerja yang diminta berbeda dari ruang kerja pada token. Rekam medis satu ' +
        'fasilitas tidak pernah dapat dibaca dari token fasilitas lain, berapa pun nomor yang ' +
        'dikirimkan.',
    };
  }
  return { sah: true, alasan: 'Ruang kerja sesuai.' };
}

/**
 * Memeriksa isolasi antar-vertical.
 *
 * eMedik tidak boleh membaca tabel milik vertical lain, dan sebaliknya. Bukan
 * karena datanya rahasia satu sama lain — sebagian memang milik tenant yang
 * sama — melainkan karena **semantiknya berbeda**: "member" pada koperasi bukan
 * "patient" pada kesehatan, dan kode yang memperlakukannya sama akan
 * menghasilkan kesimpulan yang salah tanpa satu pun galat.
 */
export const AWALAN_TABEL_KESEHATAN = [
  'health_',
  'patient',
  'lab_',
  'rx_',
  'him_',
  'safety_',
  'quality_',
  'device_',
  'medical_device',
  'bpjs_',
  'satusehat_',
  'jkn_',
  'investor_',
  'fee_',
  'terminology_',
  'kfa_',
  'master_data_',
  'immunization_',
  'portal_',
  'facility_web_content',
] as const;

export function tabelMilikKesehatan(nama: string): boolean {
  return AWALAN_TABEL_KESEHATAN.some((a) => nama === a || nama.startsWith(a));
}

// --- Redaksi AI --------------------------------------------------------------

/**
 * Pola redaksi **tambahan** untuk data kesehatan.
 *
 * Sengaja disebut tambahan: penyamar bersama (`redactText` pada modul AI) sudah
 * menangani surel, telepon, NPWP, dan deretan angka panjang. Yang ditambahkan
 * di sini adalah yang khas kesehatan — dan ia ditambahkan, bukan menggantikan,
 * sebab dua penyamar yang saling menggantikan akan berbeda dalam waktu enam
 * bulan dan tidak ada yang tahu yang mana yang berjalan.
 */
export const POLA_KESEHATAN: { nama: string; pola: RegExp; ganti: string }[] = [
  {
    nama: 'nomor rekam medis',
    pola: /\bRM[-\s]?\d{4,}\b/gi,
    ganti: '[RM-DISAMARKAN]',
  },
  {
    nama: 'nomor SEP',
    pola: /\bSEP[-\s]?[A-Z0-9]{6,}\b/gi,
    ganti: '[SEP-DISAMARKAN]',
  },
  {
    nama: 'kode diagnosis ICD-10',
    pola: /\b[A-TV-Z]\d{2}(?:\.\d{1,2})?\b/g,
    ganti: '[DIAGNOSIS-DISAMARKAN]',
  },
  {
    nama: 'nomor kepesertaan JKN',
    pola: /\b000\d{10}\b/g,
    ganti: '[JKN-DISAMARKAN]',
  },
];

export interface HasilRedaksi {
  teks: string;
  disamarkan: { nama: string; jumlah: number }[];
  /** Apakah masih ada yang mencurigakan sesudah penyamaran. */
  bersih: boolean;
}

/**
 * Menyamarkan pola kesehatan dari teks.
 *
 * Yang disamarkan **dilaporkan**, tidak dibuang diam-diam — sama seperti
 * penyamar bersama. Pengguna yang melihat "dua kode diagnosis disamarkan" tahu
 * mengapa jawabannya tidak menyebut diagnosis; tanpa laporan, ia akan mengira
 * modelnya yang tidak becus.
 */
export function redaksiKesehatan(teks: string): HasilRedaksi {
  let hasil = teks;
  const laporan: { nama: string; jumlah: number }[] = [];

  for (const { nama, pola, ganti } of POLA_KESEHATAN) {
    const cocok = hasil.match(pola);
    if (cocok?.length) {
      laporan.push({ nama, jumlah: cocok.length });
      hasil = hasil.replace(pola, ganti);
    }
  }

  return {
    teks: hasil,
    disamarkan: laporan,
    bersih: !POLA_KESEHATAN.some((p) => {
      p.pola.lastIndex = 0;
      return p.pola.test(hasil);
    }),
  };
}

/**
 * Bolehkah satu permintaan dikirim ke AI?
 *
 * Tiga penjaga, dan yang ketiga yang paling sering terlupakan:
 *
 * 1. zonanya boleh;
 * 2. teksnya sudah bersih sesudah penyamaran;
 * 3. **seluruh isinya berasal dari satu tenant.** Permintaan yang menggabungkan
 *    dua tenant tidak pernah sah, sekalipun keduanya sudah disamarkan — sebab
 *    yang bocor bukan hanya nilainya melainkan **fakta bahwa keduanya
 *    dibandingkan**.
 */
export function bolehKirimKeAi(input: {
  zona: ZonaData;
  teks: string;
  tenantIds: string[];
}): { boleh: boolean; alasan: string; hasilRedaksi: HasilRedaksi } {
  const redaksi = redaksiKesehatan(input.teks);

  const tenantUnik = new Set(input.tenantIds.filter(Boolean));
  if (tenantUnik.size > 1) {
    return {
      boleh: false,
      alasan:
        `Permintaan menggabungkan ${tenantUnik.size} tenant. Ini tidak pernah sah, sekalipun ` +
        'seluruhnya sudah disamarkan — yang bocor bukan hanya nilainya melainkan fakta bahwa ' +
        'keduanya dibandingkan.',
      hasilRedaksi: redaksi,
    };
  }

  const zonaBoleh = bolehKeAi(input.zona);
  if (!zonaBoleh.boleh) {
    return { boleh: false, alasan: zonaBoleh.alasan, hasilRedaksi: redaksi };
  }

  if (!redaksi.bersih) {
    return {
      boleh: false,
      alasan:
        'Masih ada pola kesehatan yang terdeteksi sesudah penyamaran. Permintaan tidak dikirim: ' +
        'penyamaran yang gagal sekali menghasilkan satu catatan permanen pada log penyedia ' +
        'model, dan catatan itu tidak dapat ditarik kembali.',
      hasilRedaksi: redaksi,
    };
  }

  return { boleh: true, alasan: 'Boleh dikirim.', hasilRedaksi: redaksi };
}

// --- Tindakan yang tidak boleh dilakukan AI ----------------------------------

/**
 * Tindakan yang **tidak pernah** boleh dilakukan AI secara otomatis.
 *
 * Daftar tertutup, dan setiap barisnya punya sebab yang sama: akibatnya tidak
 * dapat ditarik kembali oleh orang yang menyadarinya kemudian.
 */
export const TINDAKAN_TERLARANG_AI = [
  { kode: 'PAYMENT', nama: 'Pembayaran', sebab: 'Uang yang berpindah sulit ditarik kembali.' },
  { kode: 'POSTING', nama: 'Penjurnalan', sebab: 'Jurnal yang terposting mengubah laporan keuangan.' },
  { kode: 'APPROVAL', nama: 'Persetujuan', sebab: 'Persetujuan adalah pernyataan seseorang, bukan keluaran model.' },
  { kode: 'DELETE', nama: 'Penghapusan', sebab: 'Yang terhapus tidak dapat dikembalikan.' },
  { kode: 'RBAC', nama: 'Perubahan hak akses', sebab: 'Hak yang diberikan jarang ditarik kembali.' },
  { kode: 'PRESCRIBE', nama: 'Peresepan', sebab: 'Resep adalah tindakan medis yang menuntut penanggung jawab.' },
  { kode: 'DEVICE_COMMAND', nama: 'Perintah ke alat medis', sebab: 'Alat medis menyentuh pasien.' },
  { kode: 'RESULT_RELEASE', nama: 'Pelepasan hasil', sebab: 'Kabar buruk menuntut manusia yang menjelaskannya.' },
] as const;

const TERLARANG_AI = new Set<string>(TINDAKAN_TERLARANG_AI.map((t) => t.kode));

export function bolehAiMelakukan(tindakan: string): { boleh: boolean; alasan: string } {
  const t = TINDAKAN_TERLARANG_AI.find((x) => x.kode === tindakan);
  if (t) {
    return {
      boleh: false,
      alasan:
        `AI tidak melakukan ${t.nama.toLowerCase()} secara otomatis. ${t.sebab} Yang dapat ` +
        'dilakukannya adalah menyiapkan, menjelaskan, dan mengusulkan — dan ketiganya menunggu ' +
        'seseorang menekan tombolnya.',
    };
  }
  return { boleh: true, alasan: 'Tindakan ini bukan tindakan yang dilarang bagi AI.' };
}

export function tindakanTerlarangAi(kode: string): boolean {
  return TERLARANG_AI.has(kode);
}
