/**
 * Aturan registri alat kesehatan dan gateway.
 *
 * Fungsi murni, tanpa basis data.
 *
 * Keamanan alat medis **tidak diletakkan pada alatnya.** Alat medis menjalankan
 * sistem operasi lama yang tidak lagi menerima tambalan, tidak boleh dipasangi
 * perangkat lunak keamanan tambahan tanpa membatalkan sertifikasinya, sering
 * memakai kata sandi bawaan yang tidak dapat diubah, dan tidak dapat dimatikan
 * untuk diperbarui karena ada pasien yang memakainya. Karena itu keamanannya
 * diletakkan pada apa yang mengelilinginya.
 *
 * Lima hal menentukan bentuk seluruh berkas ini.
 *
 * 1. **Alat tidak pernah punya kredensial basis data.** Ia berbicara kepada
 *    gateway; gateway berbicara kepada integration engine. Tidak ada jalan
 *    langsung dari alat ke basis data, dan tidak ada jalan dari alat ke
 *    internet.
 *
 * 2. **Kendali jarak jauh MATI SECARA BAWAAN, untuk seluruh alat, tanpa
 *    kecuali.** Pompa infus yang dapat dikendalikan jarak jauh adalah pompa
 *    yang dapat dinaikkan dosisnya oleh siapa pun yang menembus jaringannya.
 *    Manfaatnya nyata tetapi kecil; akibat kegagalannya tidak dapat diperbaiki.
 *
 * 3. **Hasil yang tiba tanpa identitas pasien TIDAK DITEBAK.** Mencocokkan
 *    berdasarkan nama, atau berdasarkan "pasien yang sedang di ruangan itu",
 *    akan benar sembilan puluh sembilan kali dan salah sekali — dan yang sekali
 *    itu adalah hasil laboratorium orang lain di rekam medis seseorang.
 *
 * 4. **`capturedAt` dan `receivedAt` berbeda dan keduanya disimpan.** Alat yang
 *    jamnya melenceng, atau yang menyimpan hasil selama jaringan terputus, akan
 *    mengirim hasil lama sebagai hasil baru — dan selisih keduanya yang
 *    menampakkannya.
 *
 * 5. **Kalibrasi kedaluwarsa MENANDAI, tidak menolak.** Menolaknya akan
 *    menghentikan pelayanan pada alat yang mungkin masih benar; menandainya
 *    membuat yang membaca hasilnya tahu apa yang sedang dibacanya.
 */

// --- Protokol ----------------------------------------------------------------

export type Protokol =
  | 'HL7V2'
  | 'ASTM'
  | 'IHE_PCD'
  | 'IEEE_11073'
  | 'TCP_SERIAL'
  | 'SFTP'
  | 'DICOM'
  | 'DICOMWEB'
  | 'MODALITY_WORKLIST'
  | 'MPPS'
  | 'FHIR'
  | 'VENDOR_API'
  | 'MQTT'
  | 'MANUAL_ENTRY';

/**
 * Protokol yang dapat dipakai sekarang, dan yang menunggu sesuatu.
 *
 * Yang terhalang **disebutkan penghalangnya**. Daftar yang hanya berkata
 * "tidak didukung" akan ditanyakan ulang setiap tiga bulan oleh orang yang
 * berbeda.
 */
export const PROTOKOL_STATUS: Record<Protokol, { usable: boolean; blockedBy?: string }> = {
  HL7V2: { usable: true },
  ASTM: { usable: true },
  IHE_PCD: { usable: true },
  IEEE_11073: { usable: true },
  TCP_SERIAL: { usable: true },
  SFTP: { usable: true },
  MANUAL_ENTRY: { usable: true },
  DICOM: { usable: false, blockedBy: 'PACS; arsitektur penyimpanan citra menunggu keputusan Core' },
  DICOMWEB: { usable: false, blockedBy: 'PACS' },
  MODALITY_WORKLIST: { usable: false, blockedBy: 'PACS/RIS' },
  MPPS: { usable: false, blockedBy: 'PACS' },
  FHIR: { usable: false, blockedBy: 'SATUSEHAT; kredensialnya belum ada' },
  VENDOR_API: { usable: false, blockedBy: 'dokumentasi per vendor' },
  MQTT: { usable: false, blockedBy: 'persetujuan keamanan' },
};

/**
 * Boleh atau tidaknya satu protokol dipakai.
 *
 * Yang terhalang ditolak beserta penghalangnya — bukan dengan pesan umum.
 */
export function bolehPakaiProtokol(protokol: Protokol): {
  allowed: boolean;
  message?: string;
} {
  const status = PROTOKOL_STATUS[protokol];
  if (!status) return { allowed: false, message: `Protokol ${protokol} tidak dikenal.` };
  if (status.usable) return { allowed: true };
  return {
    allowed: false,
    message:
      `Protokol ${protokol} belum dapat dipakai; penghalangnya: ${status.blockedBy}. ` +
      'Ia bukan tidak didukung — ia menunggu sesuatu yang bukan milik kami.',
  };
}

// --- Status alat -------------------------------------------------------------

export type StatusAlat = 'REGISTERED' | 'ACTIVE' | 'MAINTENANCE' | 'DOWNTIME' | 'RETIRED';

/**
 * Boleh atau tidaknya satu alat menerima pesanan baru.
 *
 * Alat yang sedang `DOWNTIME` tidak menerima pesanan. Alat yang kalibrasinya
 * kedaluwarsa **tetap menerima** — menolaknya akan menghentikan pelayanan pada
 * alat yang mungkin masih benar.
 */
export function bolehTerimaPesanan(input: {
  status: StatusAlat;
  calibrationDueAt?: string | null;
  today: string;
}): { allowed: boolean; warning?: string; message: string } {
  if (input.status === 'DOWNTIME') {
    return {
      allowed: false,
      message: 'Alat ini sedang DOWNTIME dan tidak menerima pesanan baru.',
    };
  }
  if (input.status === 'RETIRED') {
    return { allowed: false, message: 'Alat ini sudah dipensiunkan.' };
  }
  if (input.status === 'REGISTERED') {
    return {
      allowed: false,
      message: 'Alat ini baru terdaftar dan belum diaktifkan.',
    };
  }

  const kalibrasiLewat =
    input.calibrationDueAt != null &&
    Date.parse(input.calibrationDueAt) < Date.parse(input.today);

  return {
    allowed: true,
    warning: kalibrasiLewat
      ? `Kalibrasi alat ini jatuh tempo pada ${input.calibrationDueAt}. Hasilnya tetap ` +
        'diterima dan ditandai — menolaknya akan menghentikan pelayanan pada alat yang ' +
        'mungkin masih benar.'
      : undefined,
    message: kalibrasiLewat
      ? 'Alat dapat dipakai, dengan penanda kalibrasi kedaluwarsa.'
      : 'Alat siap dipakai.',
  };
}

// --- Pengaitan pasien --------------------------------------------------------

export type CaraPengaitan = 'ORDER_ID' | 'WRISTBAND_SCAN' | 'MANUAL';

/**
 * Cara pengaitan yang **dilarang**, dan sebabnya.
 *
 * Keduanya akan benar sembilan puluh sembilan kali dan salah sekali — dan yang
 * sekali itu adalah hasil laboratorium orang lain di rekam medis seseorang.
 */
export const PENGAITAN_TERLARANG = ['NAME_MATCH', 'ROOM_OCCUPANCY'] as const;

/**
 * Menentukan bagaimana satu hasil dikaitkan kepada pasien.
 *
 * Berurutan: order ID paling dapat dipercaya sebab alatnya sendiri membawa
 * nomor pesanannya; pemindaian gelang berikutnya; manusia terakhir. Yang tiba
 * tanpa ketiganya **tidak ditebak** — ia masuk antrean yang menunggu manusia.
 */
export function kaitkanPasien(input: {
  orderId?: string | null;
  scannedPatientId?: string | null;
  manualPatientId?: string | null;
  manualLinkedBy?: string | null;
}): {
  linked: boolean;
  patientId?: string | null;
  method?: CaraPengaitan;
  needsHumanLink: boolean;
  message: string;
} {
  if (input.orderId?.trim()) {
    return {
      linked: true,
      method: 'ORDER_ID',
      needsHumanLink: false,
      message: 'Dikaitkan lewat nomor pesanan; alatnya sendiri yang membawanya.',
    };
  }

  if (input.scannedPatientId?.trim()) {
    return {
      linked: true,
      patientId: input.scannedPatientId,
      method: 'WRISTBAND_SCAN',
      needsHumanLink: false,
      message: 'Dikaitkan lewat pemindaian gelang pasien di sisi alat.',
    };
  }

  if (input.manualPatientId?.trim()) {
    if (!input.manualLinkedBy?.trim()) {
      return {
        linked: false,
        needsHumanLink: true,
        message:
          'Pengaitan manual wajib mencatat siapa yang mengaitkannya. Pengaitan tanpa nama ' +
          'tidak dapat ditanyakan kembali ketika hasilnya ternyata milik orang lain.',
      };
    }
    return {
      linked: true,
      patientId: input.manualPatientId,
      method: 'MANUAL',
      needsHumanLink: false,
      message: 'Dikaitkan manusia, dan namanya tercatat.',
    };
  }

  return {
    linked: false,
    needsHumanLink: true,
    message:
      'Hasil ini tiba tanpa identitas pasien dan TIDAK ditebak. Ia masuk antrean yang menunggu ' +
      'manusia mengaitkannya. Mencocokkan berdasarkan nama atau berdasarkan pasien yang sedang ' +
      'di ruangan itu akan benar sembilan puluh sembilan kali dan salah sekali — dan yang ' +
      'sekali itu adalah hasil laboratorium orang lain di rekam medis seseorang.',
  };
}

// --- Provenance dan waktu ----------------------------------------------------

/**
 * Memeriksa selisih antara waktu pengambilan dan waktu penerimaan.
 *
 * Selisih besar **ditandai, bukan ditolak**. Alat yang menyimpan hasil selama
 * jaringan terputus memang mengirimnya terlambat, dan hasilnya sah — yang tidak
 * sah adalah mencatat waktu tibanya sebagai waktu pengambilannya.
 *
 * Waktu pengambilan **di masa depan** selalu janggal: jam alatnya melenceng.
 */
export function periksaWaktu(input: {
  capturedAt: string;
  receivedAt: string;
  /** Ambang selisih yang dianggap wajar, dalam menit. */
  toleranceMinutes?: number;
}): { drifted: boolean; driftMinutes: number; futureCapture: boolean; message: string } {
  const ambil = Date.parse(input.capturedAt);
  const terima = Date.parse(input.receivedAt);
  if (!Number.isFinite(ambil) || !Number.isFinite(terima)) {
    throw new Error('Waktu pengambilan atau penerimaan tidak sah.');
  }

  const selisihMenit = Math.round((terima - ambil) / 60000);
  const ambang = input.toleranceMinutes ?? 60;
  const masaDepan = selisihMenit < 0;

  if (masaDepan) {
    return {
      drifted: true,
      driftMinutes: selisihMenit,
      futureCapture: true,
      message:
        `Waktu pengambilan ${Math.abs(selisihMenit)} menit SETELAH waktu penerimaan. Jam alat ` +
        'ini melenceng; urutan kejadian klinis yang dihitung darinya akan kacau.',
    };
  }

  return {
    drifted: selisihMenit > ambang,
    driftMinutes: selisihMenit,
    futureCapture: false,
    message:
      selisihMenit > ambang
        ? `Hasil tiba ${selisihMenit} menit setelah diambil. Ditandai, bukan ditolak — alat ` +
          'yang menyimpan hasil selama jaringan terputus memang mengirimnya terlambat, dan ' +
          'hasilnya sah.'
        : 'Selisih waktu wajar.',
  };
}

/**
 * Memeriksa kelengkapan provenance satu hasil.
 *
 * `rawMessageHash` menjawab pertanyaan yang muncul ketika hasilnya
 * dipersengketakan: *apakah yang tersimpan sama dengan yang dikirim alat?*
 * Tanpanya, jawabannya hanya dugaan.
 */
export function periksaProvenance(input: {
  deviceId?: string | null;
  gatewayId?: string | null;
  sourceProtocol?: Protokol | null;
  rawMessageHash?: string | null;
  capturedAt?: string | null;
  receivedAt?: string | null;
}): { complete: boolean; missing: string[]; message: string } {
  const kurang: string[] = [];
  if (!input.deviceId) kurang.push('alat');
  if (!input.gatewayId && input.sourceProtocol !== 'MANUAL_ENTRY') kurang.push('gateway');
  if (!input.sourceProtocol) kurang.push('protokol sumber');
  if (!input.rawMessageHash && input.sourceProtocol !== 'MANUAL_ENTRY') {
    kurang.push('sidik jari pesan asli');
  }
  if (!input.capturedAt) kurang.push('waktu pengambilan');
  if (!input.receivedAt) kurang.push('waktu penerimaan');

  if (kurang.length) {
    return {
      complete: false,
      missing: kurang,
      message:
        `Provenance belum lengkap; yang kurang: ${kurang.join(', ')}. Hasil tanpa provenance ` +
        'tidak dapat dijawab ketika dipersengketakan — dan yang dipersengketakan biasanya ' +
        'hasil yang menentukan keputusan besar.',
    };
  }

  return { complete: true, missing: [], message: 'Provenance lengkap.' };
}

// --- Kendali jarak jauh ------------------------------------------------------

export interface SyaratKendaliJauh {
  hasWrittenApproval: boolean;
  hasClinicalRiskReview: boolean;
  allowedCommands: string[];
  hasValueLimits: boolean;
  hasCommandLogging: boolean;
  hasEmergencyStop: boolean;
}

/**
 * Boleh atau tidaknya kendali jarak jauh dinyalakan pada satu alat.
 *
 * **Mati secara bawaan, untuk seluruh alat, tanpa kecuali.** Yang kurang
 * disebutkan satu per satu.
 */
export function bolehNyalakanKendaliJauh(input: {
  deviceCategory: string;
  syarat: SyaratKendaliJauh;
}): { allowed: boolean; missing: string[]; message: string } {
  const kurang: string[] = [];
  const s = input.syarat;

  if (!s.hasWrittenApproval) kurang.push('persetujuan tertulis manajemen');
  if (!s.hasClinicalRiskReview) kurang.push('telaah risiko klinis');
  if (!s.allowedCommands.length) kurang.push('daftar perintah yang diizinkan');
  if (!s.hasValueLimits) kurang.push('batas nilai');
  if (!s.hasCommandLogging) kurang.push('pencatatan setiap perintah');
  if (!s.hasEmergencyStop) kurang.push('tombol henti darurat');

  if (kurang.length) {
    return {
      allowed: false,
      missing: kurang,
      message:
        `Kendali jarak jauh pada ${input.deviceCategory} belum dapat dinyalakan; yang kurang: ` +
        `${kurang.join(', ')}. Bawaannya MATI untuk seluruh alat tanpa kecuali — pompa infus ` +
        'yang dapat dikendalikan jarak jauh adalah pompa yang dapat dinaikkan dosisnya oleh ' +
        'siapa pun yang menembus jaringannya. Manfaatnya nyata tetapi kecil; akibat ' +
        'kegagalannya tidak dapat diperbaiki.',
    };
  }

  return { allowed: true, missing: [], message: 'Seluruh syaratnya terpenuhi.' };
}

/**
 * Boleh atau tidaknya satu perintah dikirim kepada alat.
 *
 * Perintah yang **tidak ada pada daftar putih** ditolak. Daftar hitam akan
 * melewatkan setiap perintah yang ditambahkan pembaruan perangkat lunak alat —
 * dan pembaruan itu datang tanpa memberi tahu siapa pun.
 */
export function bolehKirimPerintah(input: {
  remoteControlEnabled: boolean;
  command: string;
  allowedCommands: string[];
  value?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
}): { allowed: boolean; message: string } {
  if (!input.remoteControlEnabled) {
    return {
      allowed: false,
      message: 'Kendali jarak jauh pada alat ini mati. Bawaannya memang mati.',
    };
  }

  if (!input.allowedCommands.includes(input.command)) {
    return {
      allowed: false,
      message:
        `Perintah "${input.command}" tidak ada pada daftar perintah yang diizinkan. Daftarnya ` +
        'putih, bukan hitam: daftar hitam akan melewatkan setiap perintah yang ditambahkan ' +
        'pembaruan perangkat lunak alat, dan pembaruan itu datang tanpa memberi tahu siapa pun.',
    };
  }

  if (input.value != null) {
    if (input.minValue != null && input.value < input.minValue) {
      return {
        allowed: false,
        message: `Nilai ${input.value} di bawah batas bawah ${input.minValue}.`,
      };
    }
    if (input.maxValue != null && input.value > input.maxValue) {
      return {
        allowed: false,
        message:
          `Nilai ${input.value} melampaui batas atas ${input.maxValue}. Batas itu satu-satunya ` +
          'yang memisahkan perintah yang keliru dari perintah yang mencelakakan.',
      };
    }
  }

  return { allowed: true, message: 'Perintah diizinkan.' };
}

// --- Kredensial --------------------------------------------------------------

/**
 * Boleh atau tidaknya satu kredensial disimpan pada registri.
 *
 * Kredensial gateway dan alat disimpan sebagai **rujukan ke brankas**, tidak
 * pernah sebagai nilai. Administrator yang menyimpannya tidak dapat membacanya
 * kembali — ia dapat menggantinya; ia tidak dapat melihatnya. Perbedaan itu
 * menentukan siapa yang harus dicurigai ketika ada kebocoran.
 */
export function bolehSimpanKredensial(input: {
  secretRef?: string | null;
  /** Nilai mentah. Bila terisi, ia sudah salah tempat. */
  rawValue?: string | null;
}): { allowed: boolean; message?: string } {
  if (input.rawValue) {
    return {
      allowed: false,
      message:
        'Kredensial tidak disimpan sebagai nilai, melainkan sebagai rujukan ke brankas. ' +
        'Administrator yang menyimpannya tidak dapat membacanya kembali — ia dapat ' +
        'menggantinya; ia tidak dapat melihatnya. Perbedaan itu menentukan siapa yang harus ' +
        'dicurigai ketika ada kebocoran.',
    };
  }
  if (!input.secretRef?.trim()) {
    return { allowed: false, message: 'Rujukan brankas wajib diisi.' };
  }
  return { allowed: true };
}

// --- Duplikat ----------------------------------------------------------------

/**
 * Menentukan apakah satu pesan sudah pernah diterima.
 *
 * Deteksinya lewat **sidik jari pesan, bukan lewat waktu**. Alat yang menyimpan
 * hasil selama jaringan terputus akan mengirim ulang seluruh simpanannya begitu
 * tersambung, dan deteksi berbasis waktu akan menganggap seluruhnya baru.
 */
export function pesanDuplikat(input: {
  rawMessageHash: string;
  knownHashes: string[];
}): { duplicate: boolean; message: string } {
  const ada = input.knownHashes.includes(input.rawMessageHash);
  return {
    duplicate: ada,
    message: ada
      ? 'Pesan ini sudah pernah diterima; dikenali lewat sidik jarinya, bukan lewat waktunya.'
      : 'Pesan baru.',
  };
}
