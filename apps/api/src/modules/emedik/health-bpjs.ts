/**
 * H-9B — Kerangka BPJS/JKN beserta gerbang kemampuannya.
 *
 * Aturan sebagai fungsi murni. Tidak menyentuh basis data, dan tidak menyentuh
 * jaringan.
 *
 * ## Pemisahan yang tidak boleh dikaburkan
 *
 * ```text
 * SATUSEHAT  →  pertukaran data kesehatan (FHIR)
 * BPJS/JKN   →  kepesertaan, rujukan, SEP, antrean, klaim, casemix
 * ```
 *
 * Keduanya konteks terbatas yang berbeda, dengan kredensial berbeda dan
 * kegagalan yang berbeda pula. Menyatukannya akan membuat kegagalan pengiriman
 * FHIR menghentikan pengajuan klaim — dan sebaliknya, kesibukan musim klaim
 * menghentikan pengiriman data klinis. Karena itu gerbang kemampuannya
 * **terpisah**, dan berkas ini terpisah pula dari `health-satusehat.ts`.
 *
 * ## Aturan yang menentukan seluruh rancangan
 *
 * **INA-CBG adalah pembayaran berbasis PAKET KASUS.** Ini bukan kehalusan
 * administrasi; ia menentukan bentuk basis data.
 *
 * Seorang pasien yang menerima obat senilai dua juta pada paket klaim senilai
 * lima juta **tidak** membuat BPJS mengganti dua juta untuk obat itu. Yang
 * diganti adalah paketnya.
 *
 * Karena itu satu hal yang tampak wajar justru DILARANG: menyimpan "nilai
 * penggantian BPJS" pada baris obat, tindakan, alat, atau kamar. Menyimpannya
 * akan menghasilkan laporan yang menjumlahkan angka yang tidak pernah ada — dan
 * laporan itu akan dipakai menghitung jasa dokter.
 */

// --- Adapter dan gerbangnya --------------------------------------------------

export const ADAPTER_BPJS = [
  { kode: 'VCLAIM', nama: 'BpjsVClaimAdapter', cakupan: 'Kepesertaan, rujukan, SEP, surat kontrol', penghalang: 'Consumer ID, secret, dan user key belum ada.' },
  { kode: 'PCARE', nama: 'BpjsPcareAdapter', cakupan: 'FKTP: pendaftaran, kunjungan, rujukan', penghalang: 'Kredensial FKTP belum ada.' },
  { kode: 'ANTREAN', nama: 'BpjsAntreanAdapter', cakupan: 'Antrean daring', penghalang: 'Kredensial belum ada; kewajiban SLA jawaban belum disepakati.' },
  { kode: 'APLICARES', nama: 'BpjsAplicaresAdapter', cakupan: 'Ketersediaan tempat tidur', penghalang: 'Kredensial belum ada.' },
  { kode: 'HFIS', nama: 'BpjsHfisAdapter', cakupan: 'Profil dan kelas fasilitas', penghalang: 'Kredensial belum ada.' },
  { kode: 'EKLAIM', nama: 'BpjsEklaimAdapter', cakupan: 'Pengelompokan INA-CBG', penghalang: 'Berkas grouper berlisensi belum ada. Menirunya menghasilkan tarif karangan.' },
  { kode: 'CLAIM_INTEROP', nama: 'BpjsClaimInteroperabilityAdapter', cakupan: 'Pertukaran klaim', penghalang: 'Kredensial dan spesifikasi berversi belum ada.' },
] as const;

export type KodeAdapter = (typeof ADAPTER_BPJS)[number]['kode'];

const ADAPTER = new Set<string>(ADAPTER_BPJS.map((a) => a.kode));

export type StatusAdapter = 'BLOCKED' | 'CONFIGURED' | 'SANDBOX_TESTED' | 'VERIFIED';

/**
 * Bolehkah adapter dipanggil?
 *
 * Menolak, bukan memperingatkan — sama dengan H-9A. Yang membedakan di sini:
 * penolakannya menyebutkan **apa yang masih dapat dikerjakan tanpa adapter
 * itu**, sebab hampir seluruh siklus klaim di dalam rumah sakit memang tidak
 * menuntutnya.
 */
export function bolehPanggil(input: {
  adapter: string;
  status: StatusAdapter;
  adaAkun: boolean;
  adaRujukanKredensial: boolean;
}): { boleh: boolean; alasan: string; yangMasihBisa: string } {
  const a = ADAPTER_BPJS.find((x) => x.kode === input.adapter);
  if (!a) {
    return {
      boleh: false,
      alasan: `Adapter "${input.adapter}" tidak ada pada matriks. Matriksnya daftar TERTUTUP.`,
      yangMasihBisa: '',
    };
  }
  const masihBisa =
    input.adapter === 'EKLAIM'
      ? 'Penyusunan berkas klaim, pengkodean, verifikasi internal, dan penelusuran selisih ' +
        'tetap berjalan penuh — seluruhnya milik kami dan tidak menuntut grouper.'
      : 'Seluruh siklus klaim di dalam rumah sakit tetap berjalan: penyusunan berkas, ' +
        'pengkodean, kelengkapan, verifikasi internal, dan rekonsiliasi. Yang terhalang hanya ' +
        'dua ujungnya — menanyakan kepesertaan, dan mengirimkan klaimnya.';

  if (!input.adaAkun) {
    return {
      boleh: false,
      alasan: `Belum ada akun BPJS terdaftar pada fasilitas ini. ${a.penghalang}`,
      yangMasihBisa: masihBisa,
    };
  }
  if (!input.adaRujukanKredensial) {
    return {
      boleh: false,
      alasan:
        'Akun terdaftar tanpa rujukan kredensial. Rahasianya tidak pernah masuk basis data ' +
        'tenant — yang disimpan adalah rujukan ke brankas.',
      yangMasihBisa: masihBisa,
    };
  }
  if (input.status !== 'VERIFIED') {
    return {
      boleh: false,
      alasan:
        `Adapter ${input.adapter} berstatus ${input.status}, bukan VERIFIED. MENOLAK berjalan. ` +
        `Penghalangnya: ${a.penghalang}`,
      yangMasihBisa: masihBisa,
    };
  }
  return { boleh: true, alasan: 'Adapter terverifikasi.', yangMasihBisa: '' };
}

export function adapterDikenal(kode: string): boolean {
  return ADAPTER.has(kode);
}

// --- Aturan paket kasus ------------------------------------------------------

/**
 * Nama medan yang, bila muncul pada baris item klaim, menandakan pelanggaran
 * aturan paket kasus.
 *
 * Daftar ini dipakai naskah bukti untuk memeriksa `information_schema`, dan
 * dipakai layanan untuk menolak masukan yang memuatnya.
 */
export const MEDAN_TERLARANG_PER_ITEM = [
  'bpjsReimbursement',
  'bpjsReimbursementAmount',
  'bpjsApprovedAmount',
  'bpjsPaidAmount',
  'inacbgAmount',
  'inacbgItemAmount',
  'jknReimbursement',
] as const;

const TERLARANG = new Set<string>(MEDAN_TERLARANG_PER_ITEM);

/**
 * Memeriksa apakah satu baris item memuat nilai penggantian BPJS.
 *
 * **Ini larangan, bukan peringatan.** Seorang pasien yang menerima obat senilai
 * dua juta pada paket senilai lima juta tidak membuat BPJS mengganti dua juta
 * untuk obat itu — yang diganti adalah paketnya. Angka per item yang disimpan
 * sebagai "penggantian" akan dijumlahkan oleh laporan, dan jumlah itu akan
 * dipakai menghitung jasa dokter.
 */
export function periksaItemKlaim(item: Record<string, unknown>): {
  sah: boolean;
  ditemukan: string[];
  alasan: string;
} {
  const ditemukan = Object.keys(item).filter((k) => TERLARANG.has(k));
  return {
    sah: ditemukan.length === 0,
    ditemukan,
    alasan:
      ditemukan.length === 0
        ? 'Tidak ada nilai penggantian per item.'
        : `Baris item memuat nilai penggantian BPJS: ${ditemukan.join(', ')}. INA-CBG adalah ` +
          'pembayaran berbasis PAKET KASUS. Pasien yang menerima obat senilai dua juta pada ' +
          'paket senilai lima juta tidak membuat BPJS mengganti dua juta untuk obat itu — yang ' +
          'diganti adalah paketnya. Angka per item yang disimpan sebagai penggantian akan ' +
          'dijumlahkan laporan, dan jumlah itu akan dipakai menghitung jasa dokter.',
  };
}

/**
 * Untuk apa data per item BOLEH dipakai, dan di mana nilai penggantian resmi
 * sesungguhnya berada.
 *
 * Ditulis sebagai fungsi supaya jawabannya sama di setiap tempat yang
 * menanyakannya.
 */
export function tujuanDataPerItem(): {
  bolehUntuk: string[];
  penggantianResmiAda: string[];
  keterangan: string;
} {
  return {
    bolehUntuk: [
      'biaya aktual',
      'tagihan pasien',
      'utilisasi',
      'bukti klaim',
      'perhitungan harga pokok',
      'alokasi internal',
      'dasar pembagian jasa',
    ],
    penggantianResmiAda: [
      'Claim Package',
      'Casemix Group',
      'Severity',
      'Tariff Region',
      'Facility Class',
      'Approved Claim',
      'Paid Claim',
    ],
    keterangan:
      'Data per item tetap disimpan, tetapi untuk tujuan yang berbeda. Nilai penggantian resmi ' +
      'berada pada tingkat paket, bukan pada baris item.',
  };
}

// --- Kepesertaan -------------------------------------------------------------

/**
 * Berapa lama hasil pemeriksaan kepesertaan boleh dipercaya?
 *
 * Kepesertaan berubah: peserta dapat menunggak, pindah fasilitas, atau berhenti
 * bekerja. Cache tanpa kedaluwarsa akan membuat rumah sakit melayani sebagai
 * peserta orang yang kepesertaannya sudah berakhir bulan lalu — dan klaimnya
 * ditolak sesudah pelayanannya diberikan.
 */
export const MASA_BERLAKU_KEPESERTAAN_JAM = 24;

export function kepesertaanMasihBerlaku(
  diperiksaPada: string | null,
  sekarang: string,
  masaJam = MASA_BERLAKU_KEPESERTAAN_JAM,
): { berlaku: boolean; umurJam: number | null; keterangan: string } {
  if (!diperiksaPada) {
    return {
      berlaku: false,
      umurJam: null,
      keterangan:
        'Belum pernah diperiksa. Kepesertaan yang tidak pernah diperiksa BUKAN kepesertaan yang ' +
        'sah — ia kepesertaan yang belum diketahui.',
    };
  }
  const umur = (Date.parse(sekarang) - Date.parse(diperiksaPada)) / 3_600_000;
  const berlaku = umur <= masaJam;
  return {
    berlaku,
    umurJam: Math.round(umur * 10) / 10,
    keterangan: berlaku
      ? `Diperiksa ${Math.round(umur)} jam lalu; masih dalam masa ${masaJam} jam.`
      : `Diperiksa ${Math.round(umur)} jam lalu, melampaui masa ${masaJam} jam. Kepesertaan ` +
        'berubah: peserta dapat menunggak, pindah fasilitas, atau berhenti bekerja.',
  };
}

/**
 * Bolehkah pasien dilayani sebagai peserta JKN?
 *
 * **Selalu boleh dilayani.** Yang diputuskan di sini bukan pelayanannya
 * melainkan penjaminannya — dan keduanya tidak boleh dikaburkan. Pasien yang
 * kepesertaannya belum terperiksa tetap dilayani; yang berubah hanyalah siapa
 * yang membayar.
 */
export function statusPenjaminan(input: {
  kepesertaanBerlaku: boolean;
  statusPeserta: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'UNKNOWN';
}): {
  dijamin: boolean;
  bolehDilayani: true;
  tagihanKe: 'BPJS' | 'PATIENT' | 'PENDING';
  keterangan: string;
} {
  if (!input.kepesertaanBerlaku || input.statusPeserta === 'UNKNOWN') {
    return {
      dijamin: false,
      bolehDilayani: true,
      tagihanKe: 'PENDING',
      keterangan:
        'Kepesertaan belum diketahui. Pasien TETAP DILAYANI — yang belum diketahui adalah siapa ' +
        'yang membayar, bukan apakah ia berhak ditolong. Tagihannya ditahan sampai ' +
        'kepesertaannya diperiksa.',
    };
  }
  if (input.statusPeserta !== 'ACTIVE') {
    return {
      dijamin: false,
      bolehDilayani: true,
      tagihanKe: 'PATIENT',
      keterangan:
        `Kepesertaan berstatus ${input.statusPeserta}. Pasien tetap dilayani; tagihannya ` +
        'kepada pasien. Menolak melayani karena kepesertaan tidak aktif adalah keputusan yang ' +
        'bukan milik perangkat lunak.',
    };
  }
  return {
    dijamin: true,
    bolehDilayani: true,
    tagihanKe: 'BPJS',
    keterangan: 'Kepesertaan aktif dan masih berlaku.',
  };
}

// --- SEP ---------------------------------------------------------------------

/**
 * Nomor SEP datang dari BPJS, bukan dari kami.
 *
 * Fungsi ini **tidak menghasilkan nomor**, dan ia **tidak memvalidasi format
 * SEP yang sesungguhnya** — sebab formatnya milik BPJS dan kami tidak memiliki
 * spesifikasinya. Menuliskan pola yang ditebak dari beberapa contoh akan
 * menolak nomor sah dari fasilitas yang kodenya berbeda, dan penolakan itu
 * datang pada saat pasien sedang menunggu.
 *
 * Yang diperiksa hanyalah dua hal yang tidak menuntut spesifikasi siapa pun:
 * nomornya tidak kosong, dan bentuknya tidak jelas-jelas buatan sendiri. Selain
 * itu, nomor apa pun diterima apa adanya — sebab yang berwenang menyatakan ia
 * sah adalah BPJS, bukan berkas ini.
 */
export function periksaNomorSep(nomor: string | null): { sah: boolean; alasan: string } {
  const n = (nomor ?? '').trim();
  if (!n) {
    return {
      sah: false,
      alasan:
        'Nomor SEP wajib diisi dan datang dari BPJS. Ia tidak dihasilkan di sini — kami tidak ' +
        'punya wewenang menerbitkannya.',
    };
  }
  /*
   * Penolakan yang paling berguna dan paling dapat dipertanggungjawabkan:
   * nomor yang JELAS dibuat sendiri. "SEP-001", "TEST", "-", dan sejenisnya
   * muncul ketika seseorang mengisi kolom wajib supaya layarnya lanjut.
   */
  if (/^(sep|test|dummy|coba|xxx|-|0+)$/i.test(n) || /^sep[-_ ]/i.test(n) || n.length < 10) {
    return {
      sah: false,
      alasan:
        `Nomor "${n}" tampak dibuat sendiri, bukan diterbitkan BPJS. Nomor yang dikarang akan ` +
        'diterima basis data kami dan ditolak BPJS — sesudah pelayanannya diberikan. Perhatikan ' +
        'bahwa yang diperiksa di sini HANYA bentuk yang jelas buatan sendiri: format SEP yang ' +
        'sesungguhnya milik BPJS, dan menebaknya akan menolak nomor sah dari fasilitas yang ' +
        'kodenya berbeda.',
    };
  }
  return {
    sah: true,
    alasan:
      'Diterima apa adanya. Yang berwenang menyatakan nomor ini sah adalah BPJS, bukan ' +
      'perangkat lunak ini.',
  };
}

// --- Kelas dan KRIS ----------------------------------------------------------

export type MetodeBayar = 'CAPITATION' | 'NON_CAPITATION' | 'INACBG' | 'NON_INACBG' | 'PROGRAM';

export const METODE_BAYAR: { kode: MetodeBayar; jenjang: string; catatan: string }[] = [
  { kode: 'CAPITATION', jenjang: 'FKTP', catatan: 'Per peserta terdaftar per bulan, BUKAN per kunjungan.' },
  { kode: 'NON_CAPITATION', jenjang: 'FKTP', catatan: 'Layanan tertentu di luar kapitasi.' },
  { kode: 'INACBG', jenjang: 'FKRTL', catatan: 'Paket kasus.' },
  { kode: 'NON_INACBG', jenjang: 'FKRTL', catatan: 'Di luar paket; obat kronis dan alat tertentu.' },
  { kode: 'PROGRAM', jenjang: 'Khusus', catatan: 'Menurut program yang berlaku.' },
];

/**
 * Kelas dan KRIS diperlakukan sebagai **kebijakan berversi**, bukan tetapan.
 *
 * Tata kelola JKN memang berubah, dan perubahannya harus dapat diikuti tanpa
 * mengubah kode. Sistem yang mengunci kelas I/II/III pada tipe data akan
 * menuntut migrasi setiap kali peraturannya berubah — dan migrasi itu selalu
 * datang terlambat.
 */
export function kebijakanBerlaku<T extends { effectiveFrom: string; effectiveTo: string | null }>(
  kebijakan: T[],
  tanggal: string,
): T | null {
  const cocok = kebijakan.filter(
    (k) =>
      k.effectiveFrom <= tanggal && (k.effectiveTo === null || k.effectiveTo >= tanggal),
  );
  if (cocok.length === 0) return null;
  return cocok.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
}

/**
 * Naik kelas atas permintaan pasien: selisihnya ditagihkan kepada **pasien**,
 * bukan kepada BPJS.
 *
 * Dan yang lebih penting: naik kelas **tidak menahan klaimnya**. Pelajaran
 * H-9C — menahannya akan membuat verifikasi internal dimatikan oleh orang
 * pertama yang klaimnya tertahan karena hal yang memang sah.
 */
export function hitungSelisihKelas(input: {
  kelasHak: number;
  kelasDitempati: number;
  tarifKelasHak: number;
  tarifKelasDitempati: number;
  atasPermintaanPasien: boolean;
}): {
  naikKelas: boolean;
  selisih: number;
  ditagihkanKe: 'PATIENT' | 'FACILITY' | 'NONE';
  menahanKlaim: false;
  keterangan: string;
} {
  if (input.kelasDitempati >= input.kelasHak) {
    return {
      naikKelas: false,
      selisih: 0,
      ditagihkanKe: 'NONE',
      menahanKlaim: false,
      keterangan: 'Kelas yang ditempati tidak melampaui hak peserta.',
    };
  }
  const selisih = Math.max(input.tarifKelasDitempati - input.tarifKelasHak, 0);
  return {
    naikKelas: true,
    selisih,
    ditagihkanKe: input.atasPermintaanPasien ? 'PATIENT' : 'FACILITY',
    menahanKlaim: false,
    keterangan: input.atasPermintaanPasien
      ? 'Naik kelas atas permintaan pasien; selisihnya ditagihkan kepada pasien. Klaimnya TIDAK ' +
        'tertahan — naik kelas atas permintaan pasien adalah hal yang sah.'
      : 'Naik kelas BUKAN atas permintaan pasien — misalnya karena kelas haknya penuh. ' +
        'Selisihnya ditanggung fasilitas, dan tidak boleh ditagihkan kepada pasien maupun BPJS.',
  };
}

// --- Yang sengaja tidak ada --------------------------------------------------

/**
 * Pengelompokan INA-CBG **tidak dihitung di sini**.
 *
 * Grouper adalah perangkat lunak berlisensi, dan menirunya menghasilkan tarif
 * karangan. Tarif karangan tidak menimbulkan galat: ia menghasilkan angka yang
 * tampak masuk akal, dipakai menyusun anggaran, dan dipakai membagi jasa medis
 * — sampai klaim pertamanya kembali dengan angka yang berbeda.
 */
export function kelompokkanInacbg(): never {
  throw new Error(
    'GROUPER_NOT_AVAILABLE: pengelompokan INA-CBG tidak dihitung di sini, dan itu disengaja. ' +
      'Grouper adalah perangkat lunak berlisensi; menirunya menghasilkan tarif karangan. Tarif ' +
      'karangan tidak menimbulkan galat — ia menghasilkan angka yang tampak masuk akal, dipakai ' +
      'menyusun anggaran, dan dipakai membagi jasa medis, sampai klaim pertamanya kembali ' +
      'dengan angka yang berbeda.',
  );
}

export function ringkasKesiapan(status: { adapter: string; status: StatusAdapter }[]): {
  total: number;
  terverifikasi: number;
  keterangan: string;
} {
  const peta = new Map(status.map((s) => [s.adapter, s.status]));
  const terverifikasi = ADAPTER_BPJS.filter((a) => peta.get(a.kode) === 'VERIFIED').length;
  return {
    total: ADAPTER_BPJS.length,
    terverifikasi,
    keterangan:
      terverifikasi === 0
        ? 'Tidak satu pun adapter terverifikasi — dan itu tidak menghentikan apa pun yang ' +
          'penting. Seluruh siklus klaim di dalam rumah sakit berjalan penuh: penyusunan ' +
          'berkas, pengkodean, kelengkapan, verifikasi internal, dan rekonsiliasi. Yang ' +
          'terhalang hanya dua ujungnya.'
        : `${terverifikasi} dari ${ADAPTER_BPJS.length} adapter terverifikasi.`,
  };
}
