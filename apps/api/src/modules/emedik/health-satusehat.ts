/**
 * H-9A — Kerangka SATUSEHAT beserta gerbang kemampuannya.
 *
 * Aturan sebagai fungsi murni. Tidak menyentuh basis data, dan **tidak
 * menyentuh jaringan sama sekali.**
 *
 * Berkas ini adalah kerangka yang **menolak berjalan**, dan itulah maksudnya.
 * Perintah R2 §5 menyebutnya tegas: *"Jangan mengarang endpoint/payload."*
 *
 * Yang dibangun di sini adalah gerbangnya, bukan adapternya. Perbedaannya
 * menentukan segalanya:
 *
 * - **Adapter yang berpura-pura bekerja** akan tampak berhasil pada
 *   pengembangan, lalu mengirimkan data pasien ke tempat yang salah pada hari
 *   pertama produksi — dan pengiriman itu tidak dapat ditarik kembali.
 *
 * - **Gerbang yang menolak** akan berkata "kemampuan ini belum terverifikasi,
 *   dan inilah yang dibutuhkan sebelum ia dapat diverifikasi" setiap kali
 *   dipanggil, sampai seseorang benar-benar menyediakannya.
 *
 * Karena itu tidak ada satu pun fungsi pada berkas ini yang menyusun payload
 * FHIR. Ada yang menolak menyusunnya, dan ada yang menjelaskan mengapa.
 */

// --- Kemampuan ---------------------------------------------------------------

export type StatusKemampuan = 'BLOCKED' | 'DOCUMENTED' | 'SANDBOX_TESTED' | 'VERIFIED';

/**
 * Sumber daya FHIR yang tercatat, beserta penghalang dan sumber datanya.
 *
 * **Seluruhnya `BLOCKED`.** Bukan nilai bawaan yang menunggu diisi: ia keadaan
 * yang sesungguhnya hari ini, dan ia akan tetap `BLOCKED` sampai ada manusia
 * yang menjalankan panggilannya terhadap sandbox.
 *
 * Kolom `sumberLokal` sengaja diisi. Ia menyatakan hal yang menggembirakan:
 * **datanya sudah ada.** Penghalangnya benar-benar hanya pada lapisan
 * pertukaran, bukan pada ketiadaan data — dan itu membedakan "belum dibangun"
 * dari "belum dapat dibangun".
 */
export const KEMAMPUAN_SATUSEHAT = [
  { resource: 'Organization', kegunaan: 'Pendaftaran fasilitas', penghalang: 'Kredensial dan ID organisasi resmi.', sumberLokal: 'health_facility' },
  { resource: 'Location', kegunaan: 'Unit layanan dan bangsal', penghalang: 'Bergantung Organization.', sumberLokal: 'health_service_unit, health_room, health_bed' },
  { resource: 'Practitioner', kegunaan: 'Pemberi layanan', penghalang: 'Kredensial; NIK tenaga kesehatan.', sumberLokal: 'health_provider' },
  { resource: 'PractitionerRole', kegunaan: 'Kewenangan klinis', penghalang: 'Bergantung Practitioner.', sumberLokal: 'health_provider_privilege' },
  { resource: 'Patient', kegunaan: 'Identitas pasien', penghalang: 'Kredensial; aturan pencocokan NIK.', sumberLokal: 'patient, patient_identifier' },
  { resource: 'Encounter', kegunaan: 'Kunjungan', penghalang: 'Bergantung Patient dan Location.', sumberLokal: 'health_encounter' },
  { resource: 'Condition', kegunaan: 'Diagnosis', penghalang: 'Terminologi ICD-10 berversi.', sumberLokal: 'health_diagnosis' },
  { resource: 'Procedure', kegunaan: 'Tindakan', penghalang: 'Terminologi ICD-9-CM berversi.', sumberLokal: 'health_procedure' },
  { resource: 'Observation', kegunaan: 'Tanda vital dan hasil laboratorium', penghalang: 'Terminologi LOINC.', sumberLokal: 'health_vital_sign, lab_result' },
  { resource: 'ServiceRequest', kegunaan: 'Pesanan klinis', penghalang: 'Bergantung Encounter.', sumberLokal: 'health_clinical_order, lab_order' },
  { resource: 'Specimen', kegunaan: 'Spesimen', penghalang: 'Bergantung ServiceRequest.', sumberLokal: 'lab_specimen' },
  { resource: 'DiagnosticReport', kegunaan: 'Laporan laboratorium dan radiologi', penghalang: 'Bergantung Observation.', sumberLokal: 'lab_result' },
  { resource: 'ImagingStudy', kegunaan: 'Studi citra', penghalang: 'Bergantung PACS; arsitekturnya belum diputuskan Core.', sumberLokal: null },
  { resource: 'Medication', kegunaan: 'Obat', penghalang: 'KFA — katalog obat nasional belum dapat diimpor.', sumberLokal: 'rx_product' },
  { resource: 'MedicationRequest', kegunaan: 'Resep', penghalang: 'Bergantung Medication.', sumberLokal: 'rx_prescription, rx_prescription_line' },
  { resource: 'MedicationDispense', kegunaan: 'Penyerahan obat', penghalang: 'Bergantung Medication.', sumberLokal: 'rx_dispensing' },
  { resource: 'MedicationAdministration', kegunaan: 'Pemberian obat', penghalang: 'Bergantung Medication.', sumberLokal: 'rx_administration' },
  { resource: 'AllergyIntolerance', kegunaan: 'Alergi', penghalang: 'Terminologi alergen.', sumberLokal: 'patient_allergy' },
  { resource: 'CarePlan', kegunaan: 'Rencana asuhan', penghalang: 'Belum ada model asuhan berencana di sisi kami.', sumberLokal: null },
  { resource: 'Claim', kegunaan: 'Klaim, bila diwajibkan', penghalang: 'Bergantung kemampuan BPJS; lihat H-9B.', sumberLokal: 'health_claim' },
] as const;

export type SumberDayaFhir = (typeof KEMAMPUAN_SATUSEHAT)[number]['resource'];

const DAFTAR = new Set<string>(KEMAMPUAN_SATUSEHAT.map((k) => k.resource));

/**
 * Enam hal yang dibutuhkan sebelum satu kemampuan boleh berstatus `VERIFIED`.
 *
 * Daftar tertutup, dan ia sengaja **panjang**. Daftar pendek akan dianggap
 * terpenuhi oleh orang yang punya tiga di antaranya dan tergesa.
 */
export const SYARAT_VERIFIKASI = [
  { kode: 'SANDBOX_CREDENTIAL', nama: 'Kredensial klien untuk lingkungan sandbox' },
  { kode: 'VERSIONED_PROFILE', nama: 'Dokumentasi profil FHIR berversi, bukan ringkasan' },
  { kode: 'ORGANIZATION_ID', nama: 'ID organisasi resmi fasilitas' },
  { kode: 'TERMINOLOGY_MAP', nama: 'Peta terminologi (ICD-10, ICD-9-CM, LOINC, KFA)' },
  { kode: 'SANDBOX_REACHABLE', nama: 'Akses sandbox yang benar-benar dapat dipanggil' },
  { kode: 'SIGNED_UAT', nama: 'Catatan hasil UAT yang ditandatangani' },
] as const;

export type KodeSyarat = (typeof SYARAT_VERIFIKASI)[number]['kode'];

const SYARAT = new Set<string>(SYARAT_VERIFIKASI.map((s) => s.kode));

/**
 * Bolehkah adapter menjalankan pengiriman untuk sumber daya ini?
 *
 * **Menolak, bukan memperingatkan.** Adapter yang berjalan dengan tebakan akan
 * mengirimkan data pasien ke tempat yang salah, dan pengiriman itu tidak dapat
 * ditarik kembali. Peringatan yang dapat diabaikan akan diabaikan pada malam
 * ketika tenggatnya besok.
 */
export function bolehKirim(input: {
  resource: string;
  status: StatusKemampuan;
  lingkunganAktif: boolean;
  adaRujukanKredensial: boolean;
}): { boleh: boolean; alasan: string; yangDibutuhkan: string[] } {
  const kemampuan = KEMAMPUAN_SATUSEHAT.find((k) => k.resource === input.resource);
  if (!kemampuan) {
    return {
      boleh: false,
      alasan:
        `Sumber daya "${input.resource}" tidak ada pada matriks kemampuan. Matriksnya adalah ` +
        'daftar TERTUTUP: sumber daya yang tidak tercatat berarti belum ditelaah, dan yang ' +
        'belum ditelaah tidak boleh dikirim.',
      yangDibutuhkan: [],
    };
  }
  if (!input.lingkunganAktif) {
    return {
      boleh: false,
      alasan: 'Tidak ada lingkungan SATUSEHAT yang aktif pada fasilitas ini.',
      yangDibutuhkan: ['SANDBOX_CREDENTIAL'],
    };
  }
  if (!input.adaRujukanKredensial) {
    return {
      boleh: false,
      alasan:
        'Lingkungan aktif tanpa rujukan kredensial. Rahasianya tidak pernah masuk basis data ' +
        'tenant — yang disimpan adalah rujukan ke brankas.',
      yangDibutuhkan: ['SANDBOX_CREDENTIAL'],
    };
  }
  if (input.status !== 'VERIFIED') {
    return {
      boleh: false,
      alasan:
        `Kemampuan ${input.resource} berstatus ${input.status}, bukan VERIFIED. Adapter MENOLAK ` +
        'berjalan — bukan memperingatkan. Penghalangnya: ' +
        kemampuan.penghalang,
      yangDibutuhkan: SYARAT_VERIFIKASI.map((s) => s.kode),
    };
  }
  return { boleh: true, alasan: 'Kemampuan terverifikasi.', yangDibutuhkan: [] };
}

/**
 * Bolehkah status kemampuan dinaikkan?
 *
 * Dua aturan:
 *
 * 1. **`VERIFIED` hanya boleh diberikan MANUSIA yang sudah menjalankan
 *    panggilannya terhadap sandbox.** Bukan program, dan bukan berdasarkan
 *    dokumentasi saja. Status yang dapat dinaikkan program adalah status yang
 *    akan dinaikkan program.
 *
 * 2. **Kenaikan tidak boleh melompat.** `BLOCKED` tidak dapat langsung menjadi
 *    `VERIFIED`. Melompatinya berarti melewatkan tahap yang justru menemukan
 *    bahwa dokumentasinya berbeda dari sandbox-nya — dan perbedaan itu selalu
 *    ada.
 */
export function bolehNaikkanStatus(input: {
  dari: StatusKemampuan;
  ke: StatusKemampuan;
  olehManusia: boolean;
  buktiSyarat: string[];
}): { boleh: boolean; alasan: string } {
  const urutan: StatusKemampuan[] = ['BLOCKED', 'DOCUMENTED', 'SANDBOX_TESTED', 'VERIFIED'];
  const i = urutan.indexOf(input.dari);
  const j = urutan.indexOf(input.ke);

  if (j < i) {
    // Penurunan selalu boleh: yang ternyata tidak bekerja harus dapat
    // dikembalikan tanpa perdebatan.
    return { boleh: true, alasan: 'Penurunan status selalu diizinkan.' };
  }
  if (j === i) {
    return { boleh: false, alasan: 'Status tidak berubah.' };
  }
  if (j - i > 1) {
    return {
      boleh: false,
      alasan:
        `Kenaikan dari ${input.dari} ke ${input.ke} melompati tahap. Tahap yang dilompati ` +
        'justru yang menemukan bahwa dokumentasinya berbeda dari sandbox-nya — dan perbedaan ' +
        'itu selalu ada.',
    };
  }
  if (input.ke === 'VERIFIED') {
    if (!input.olehManusia) {
      return {
        boleh: false,
        alasan:
          'VERIFIED hanya boleh diberikan manusia yang sudah menjalankan panggilannya terhadap ' +
          'sandbox. Status yang dapat dinaikkan program adalah status yang akan dinaikkan ' +
          'program, dan sesudah itu ia tidak berarti apa-apa.',
      };
    }
    const kurang = SYARAT_VERIFIKASI.filter((s) => !input.buktiSyarat.includes(s.kode));
    if (kurang.length > 0) {
      return {
        boleh: false,
        alasan:
          `Belum lengkap: ${kurang.map((k) => k.nama).join('; ')}. Keenamnya wajib, dan ` +
          'daftarnya sengaja panjang — daftar pendek akan dianggap terpenuhi oleh orang yang ' +
          'punya tiga di antaranya dan tergesa.',
      };
    }
  }
  return { boleh: true, alasan: `Status naik dari ${input.dari} ke ${input.ke}.` };
}

export function syaratSah(kode: string): boolean {
  return SYARAT.has(kode);
}

export function kemampuanDikenal(resource: string): boolean {
  return DAFTAR.has(resource);
}

// --- Kredensial --------------------------------------------------------------

/**
 * Rahasia **tidak pernah** masuk basis data tenant.
 *
 * Sama dengan H-9H: yang disimpan adalah rujukan ke brankas, dan yang
 * menyimpannya tidak dapat membacanya kembali. Ia dapat menggantinya; ia tidak
 * dapat melihatnya.
 */
export function bolehSimpanKredensial(input: {
  secretRef: string | null;
  rawValue: string | null;
}): { boleh: boolean; alasan: string } {
  if (input.rawValue) {
    return {
      boleh: false,
      alasan:
        'Kredensial SATUSEHAT tidak boleh disimpan sebagai nilai. Kredensial sistem nasional ' +
        'yang bocor tidak hanya membuka data satu fasilitas — ia membuka jalan mengirimkan ' +
        'data atas nama fasilitas itu, dan yang menerima tidak punya cara membedakannya.',
    };
  }
  if (!input.secretRef) {
    return { boleh: false, alasan: 'Rujukan brankas wajib diisi.' };
  }
  if (!/^(vault|secret|kms):\/\//.test(input.secretRef)) {
    return {
      boleh: false,
      alasan:
        'Rujukan brankas harus berawalan vault://, secret://, atau kms://. Nilai yang tidak ' +
        'berawalan skema brankas hampir pasti kredensial yang ditempel langsung.',
    };
  }
  return { boleh: true, alasan: 'Rujukan brankas sah.' };
}

// --- Idempotensi -------------------------------------------------------------

/**
 * Menyusun kunci idempotensi pengiriman.
 *
 * Deterministik dari isinya, **bukan dari waktunya**. Percobaan ulang karena
 * jaringan terputus tidak boleh menghasilkan dua sumber daya di sistem
 * nasional — dan sumber daya ganda pada sistem nasional tidak dapat dihapus
 * dari sini.
 */
export function kunciIdempotensi(input: {
  facilityCode: string;
  resource: string;
  localId: string;
  versi: number;
}): string {
  return `${input.facilityCode}:${input.resource}:${input.localId}:v${input.versi}`;
}

/**
 * Bolehkah percobaan pengiriman diulang?
 *
 * **Yang sudah berhasil TIDAK diulang**, sekalipun pemanggilnya meminta. Yang
 * gagal boleh diulang sampai batas percobaan, dan sesudah itu ia menunggu
 * manusia — percobaan tanpa batas pada sistem nasional adalah cara paling
 * sopan untuk diblokir.
 */
export function bolehUlangi(input: {
  statusTerakhir: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REJECTED';
  jumlahPercobaan: number;
  batasPercobaan: number;
}): { boleh: boolean; alasan: string } {
  if (input.statusTerakhir === 'SUCCESS') {
    return {
      boleh: false,
      alasan:
        'Pengiriman ini sudah berhasil. Mengulanginya akan menghasilkan sumber daya kedua di ' +
        'sistem nasional, dan sumber daya ganda di sana tidak dapat dihapus dari sini.',
    };
  }
  if (input.statusTerakhir === 'REJECTED') {
    return {
      boleh: false,
      alasan:
        'Pengiriman ini DITOLAK sistem nasional, bukan gagal karena jaringan. Mengulanginya ' +
        'akan ditolak dengan cara yang sama — yang perlu diperbaiki adalah datanya, bukan ' +
        'percobaannya.',
    };
  }
  if (input.jumlahPercobaan >= input.batasPercobaan) {
    return {
      boleh: false,
      alasan:
        `Sudah ${input.jumlahPercobaan} percobaan, batasnya ${input.batasPercobaan}. Selebihnya ` +
        'menunggu manusia: percobaan tanpa batas pada sistem nasional adalah cara paling sopan ' +
        'untuk diblokir.',
    };
  }
  return { boleh: true, alasan: 'Boleh diulang.' };
}

// --- Rekonsiliasi ------------------------------------------------------------

export interface HasilRekonsiliasi {
  dikirim: number;
  diterima: number;
  gagal: number;
  selisih: number;
  seimbang: boolean;
  keterangan: string;
}

/**
 * Membandingkan jumlah kirim dengan jumlah yang tercatat diterima.
 *
 * Tanpa ini, "sudah dikirim" hanya berarti "sudah kami coba" — dan perbedaan
 * antara keduanya baru terlihat ketika ada yang menanyakan data yang seharusnya
 * ada di sana.
 */
export function rekonsiliasi(input: {
  dikirim: number;
  diterima: number;
  gagal: number;
}): HasilRekonsiliasi {
  const selisih = input.dikirim - input.diterima - input.gagal;
  const seimbang = selisih === 0;
  return {
    ...input,
    selisih,
    seimbang,
    keterangan: seimbang
      ? 'Seimbang: seluruh yang dikirim tercatat diterima atau tercatat gagal.'
      : `Selisih ${selisih} pengiriman tidak berkesudahan — tidak tercatat diterima dan tidak ` +
        'tercatat gagal. Inilah yang paling berbahaya: "sudah dikirim" yang sesungguhnya ' +
        'berarti "sudah kami coba, dan kami tidak tahu apa yang terjadi sesudahnya".',
  };
}

// --- Yang sengaja tidak ada --------------------------------------------------

/**
 * Payload FHIR **tidak disusun di sini**, dan tidak akan disusun sampai
 * dokumentasi profil berversinya ada.
 *
 * Fungsi ini ada supaya penolakannya punya tempat — dan supaya orang yang
 * mencari "di mana payload-nya dibuat" menemukan penjelasan alih-alih
 * ketiadaan. Ketiadaan akan ditafsirkan sebagai kelalaian, dan orang yang
 * menafsirkannya begitu akan menuliskannya sendiri.
 */
export function susunPayload(resource: string): never {
  const kemampuan = KEMAMPUAN_SATUSEHAT.find((k) => k.resource === resource);
  throw new Error(
    `PAYLOAD_NOT_BUILDABLE: payload FHIR untuk ${resource} tidak disusun di sini, dan itu ` +
      'disengaja. Bentuk dan profilnya harus datang dari dokumentasi resmi berversi, bukan ' +
      'dari ingatan siapa pun. Payload yang dikarang akan diterima sandbox, ditolak produksi, ' +
      'dan di antara keduanya seseorang akan menyimpulkan bahwa integrasinya berfungsi. ' +
      (kemampuan ? `Penghalang ${resource}: ${kemampuan.penghalang}` : ''),
  );
}

/**
 * Ringkasan kesiapan, untuk ditampilkan apa adanya.
 *
 * Dibuat sebagai fungsi alih-alih tetapan supaya angkanya dihitung dari
 * daftarnya, bukan ditulis tangan — angka yang ditulis tangan akan berbeda dari
 * daftarnya dalam waktu satu bulan.
 */
export function ringkasKesiapan(status: { resource: string; status: StatusKemampuan }[]): {
  total: number;
  terverifikasi: number;
  terhalang: number;
  siapKirim: string[];
  keterangan: string;
} {
  const peta = new Map(status.map((s) => [s.resource, s.status]));
  const semua = KEMAMPUAN_SATUSEHAT.map((k) => peta.get(k.resource) ?? 'BLOCKED');
  const terverifikasi = semua.filter((s) => s === 'VERIFIED').length;
  return {
    total: KEMAMPUAN_SATUSEHAT.length,
    terverifikasi,
    terhalang: semua.filter((s) => s === 'BLOCKED').length,
    siapKirim: KEMAMPUAN_SATUSEHAT.filter((k) => peta.get(k.resource) === 'VERIFIED').map(
      (k) => k.resource,
    ),
    keterangan:
      terverifikasi === 0
        ? 'Tidak satu pun kemampuan terverifikasi. Ini bukan kegagalan pembangunan melainkan ' +
          'keadaan yang sesungguhnya: kredensial, dokumentasi berversi, dan akses sandbox ' +
          'belum ada. Datanya sudah ada di sisi kami — penghalangnya hanya pada lapisan ' +
          'pertukaran.'
        : `${terverifikasi} dari ${KEMAMPUAN_SATUSEHAT.length} kemampuan terverifikasi.`,
  };
}
