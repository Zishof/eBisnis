/**
 * H-9M — Kerangka impor KFA dan terminologi resmi.
 *
 * Aturan sebagai fungsi murni. Tidak menyentuh basis data.
 *
 * ## Kekeliruan mahal yang ditahan berkas ini
 *
 * **Harga sintetis yang tampak resmi.**
 *
 * Data contoh dibuat supaya penyewa baru dapat melihat sistemnya bekerja tanpa
 * mengetik dua ribu baris. Bila harga contoh itu tidak dibedakan dari harga
 * resmi, seseorang akan memakainya menagih pasien — dan ketika ketahuan, tidak
 * ada cara membedakan mana yang contoh dan mana yang sungguhan.
 *
 * Karena itu setiap baris rujukan **membawa penanda sumbernya**, dan penandanya
 * tidak dapat dilepas.
 *
 * ## Aturan kedua yang sama pentingnya
 *
 * **Obat yang belum terpetakan ke KFA tetap dapat dipakai di dalam rumah
 * sakit.** Ia hanya tidak dapat dikirim ke SATUSEHAT. Menahan seluruh farmasi
 * sampai pemetaannya selesai akan menghentikan pelayanan demi kerapian data —
 * dan pelayanan yang berhenti demi kerapian data adalah pelayanan yang akan
 * dijalankan di luar sistem.
 */

// --- Sumber data -------------------------------------------------------------

export type SumberData =
  | 'OFFICIAL_REFERENCE'
  | 'FACILITY_IMPORT'
  | 'SYNTHETIC_DEMO'
  | 'LOCAL_MAPPING';

export const SUMBER_DATA: { kode: SumberData; nama: string; bolehDiklaimResmi: boolean }[] = [
  { kode: 'OFFICIAL_REFERENCE', nama: 'Rujukan resmi (KFA, ICD, LOINC, tarif)', bolehDiklaimResmi: true },
  { kode: 'FACILITY_IMPORT', nama: 'Data milik fasilitas sendiri', bolehDiklaimResmi: false },
  { kode: 'SYNTHETIC_DEMO', nama: 'Data contoh buatan', bolehDiklaimResmi: false },
  { kode: 'LOCAL_MAPPING', nama: 'Pemetaan lokal ke kode resmi', bolehDiklaimResmi: false },
];

/**
 * Bolehkah baris ini disebut rujukan resmi?
 *
 * Yang paling penting: **hanya sumber yang benar-benar resmi**, dan hanya bila
 * terbitannya disebutkan. Rujukan "resmi" tanpa nama terbitan dan tanggalnya
 * tidak dapat diperiksa siapa pun — dan yang tidak dapat diperiksa akan
 * dipercaya.
 */
export function bolehKlaimResmi(input: {
  sumber: SumberData;
  terbitanRef: string | null;
  terbitanTanggal: string | null;
}): { boleh: boolean; alasan: string } {
  const s = SUMBER_DATA.find((x) => x.kode === input.sumber);
  if (!s) {
    return { boleh: false, alasan: `Sumber "${input.sumber}" tidak dikenal.` };
  }
  if (!s.bolehDiklaimResmi) {
    return {
      boleh: false,
      alasan:
        `Sumber ${input.sumber} tidak boleh diklaim sebagai rujukan resmi. Harga sintetis yang ` +
        'tampak resmi akan dipakai seseorang menagih pasien — dan ketika ketahuan, tidak ada ' +
        'cara membedakan mana yang contoh dan mana yang sungguhan.',
    };
  }
  if (!input.terbitanRef?.trim() || !input.terbitanTanggal) {
    return {
      boleh: false,
      alasan:
        'Rujukan resmi wajib menyebutkan terbitannya beserta tanggalnya. Rujukan "resmi" tanpa ' +
        'nama terbitan tidak dapat diperiksa siapa pun — dan yang tidak dapat diperiksa akan ' +
        'dipercaya.',
    };
  }
  return { boleh: true, alasan: 'Rujukan resmi berterbitan.' };
}

// --- Terminologi dan penghalangnya -------------------------------------------

export const TERMINOLOGI = [
  { kode: 'ICD10', nama: 'ICD-10', kegunaan: 'Diagnosis', penghalang: 'Butuh terbitan berlisensi.' },
  { kode: 'ICD9CM', nama: 'ICD-9-CM', kegunaan: 'Tindakan', penghalang: 'Butuh terbitan berlisensi.' },
  { kode: 'LOINC', nama: 'LOINC', kegunaan: 'Pemeriksaan laboratorium', penghalang: 'Butuh terbitan berlisensi.' },
  { kode: 'KFA', nama: 'KFA', kegunaan: 'Obat dan alat kesehatan', penghalang: 'Menunggu akses resmi ke katalog nasional.' },
  { kode: 'SNOMED', nama: 'SNOMED CT', kegunaan: 'Istilah klinis', penghalang: 'Butuh lisensi nasional.' },
  { kode: 'WHO_GROWTH', nama: 'WHO Growth Standards', kegunaan: 'Pertumbuhan anak', penghalang: 'Struktur ada sejak H-8; isinya menunggu.' },
] as const;

export type KodeTerminologi = (typeof TERMINOLOGI)[number]['kode'];

const TERM = new Set<string>(TERMINOLOGI.map((t) => t.kode));

export function terminologiDikenal(kode: string): boolean {
  return TERM.has(kode);
}

/**
 * Tanpa isi terminologinya, sistem berkata **"belum dapat dinilai"** —
 * bukan menebak, dan bukan pula menyatakan tidak ada masalah.
 *
 * Perbedaan ketiganya menentukan: "tidak ada interaksi obat" pada sistem yang
 * belum punya katalog interaksinya adalah kebohongan yang berbeda dari "belum
 * dapat dinilai", dan yang membacanya bertindak berbeda pula.
 */
export function nilaiTanpaKatalog(kodeTerminologi: string): {
  dapatDinilai: false;
  jawaban: 'NOT_ASSESSABLE';
  keterangan: string;
} {
  const t = TERMINOLOGI.find((x) => x.kode === kodeTerminologi);
  return {
    dapatDinilai: false,
    jawaban: 'NOT_ASSESSABLE',
    keterangan:
      `Katalog ${kodeTerminologi} belum ada, sehingga hal ini BELUM DAPAT DINILAI — bukan ` +
      '"tidak ada masalah". Keduanya berbeda, dan yang membacanya bertindak berbeda pula. ' +
      (t ? `Penghalang: ${t.penghalang}` : ''),
  };
}

// --- Pemetaan KFA ------------------------------------------------------------

export type JenisPemetaanKfa = 'PRODUCT' | 'INGREDIENT' | 'MEDICAL_DEVICE';

/**
 * Bolehkah obat dipakai di dalam rumah sakit tanpa pemetaan KFA?
 *
 * **Selalu boleh.** Yang tidak dapat dilakukan hanyalah mengirimkannya ke
 * SATUSEHAT. Menahan seluruh farmasi sampai pemetaannya selesai akan
 * menghentikan pelayanan demi kerapian data — dan pelayanan yang berhenti demi
 * kerapian data akan dijalankan di luar sistem, tempat tidak ada yang
 * mencatatnya sama sekali.
 */
export function bolehPakaiTanpaKfa(): {
  bolehDipakai: true;
  bolehDikirimSatusehat: false;
  keterangan: string;
} {
  return {
    bolehDipakai: true,
    bolehDikirimSatusehat: false,
    keterangan:
      'Obat yang belum terpetakan ke KFA TETAP dapat dipakai di dalam rumah sakit; ia hanya ' +
      'tidak dapat dikirim ke SATUSEHAT. Menahan seluruh farmasi sampai pemetaannya selesai ' +
      'akan menghentikan pelayanan demi kerapian data — dan pelayanan yang berhenti demi ' +
      'kerapian data akan dijalankan di luar sistem, tempat tidak ada yang mencatatnya.',
  };
}

/**
 * Memeriksa satu baris pemetaan KFA.
 *
 * **Pemetaan wajib bernama pemetanya**, dan **kode KFA tidak boleh ditebak dari
 * kemiripan nama.** Nama obat yang mirip adalah hal yang paling sering keliru:
 * "Amlodipine 5 mg" dan "Amlodipine 10 mg" berbeda satu karakter dan berbeda
 * dua kali lipat dosisnya.
 */
export function periksaPemetaanKfa(input: {
  jenis: JenisPemetaanKfa;
  kodeKfa: string | null;
  produkLokalId: string | null;
  dipetakanOleh: string | null;
  caraPemetaan: 'MANUAL' | 'IMPORTED' | 'NAME_SIMILARITY' | null;
}): { sah: boolean; alasan: string } {
  if (!input.produkLokalId) {
    return { sah: false, alasan: 'Pemetaan wajib menunjuk produk lokalnya.' };
  }
  if (!input.kodeKfa?.trim()) {
    return { sah: false, alasan: 'Pemetaan wajib menyebutkan kode KFA-nya.' };
  }
  if (!input.dipetakanOleh) {
    return {
      sah: false,
      alasan:
        'Pemetaan wajib bernama pemetanya. Pemetaan yang tidak dapat ditanyakan kembali adalah ' +
        'pemetaan yang akan dipercaya selamanya.',
    };
  }
  if (input.caraPemetaan === 'NAME_SIMILARITY') {
    return {
      sah: false,
      alasan:
        'Pemetaan berdasarkan KEMIRIPAN NAMA ditolak. "Amlodipine 5 mg" dan "Amlodipine 10 mg" ' +
        'berbeda satu karakter dan berbeda dua kali lipat dosisnya — dan yang salah petakan ' +
        'akan dikirim ke SATUSEHAT sebagai obat yang bukan diberikan.',
    };
  }
  if (!input.caraPemetaan) {
    return { sah: false, alasan: 'Cara pemetaan wajib dicatat.' };
  }
  return { sah: true, alasan: 'Pemetaan lengkap.' };
}

// --- Berkas impor ------------------------------------------------------------

export type StatusImpor = 'RECEIVED' | 'VALIDATED' | 'APPLIED' | 'REJECTED';

/**
 * Berkas sumber impor **disimpan apa adanya**, beserta sidik jarinya.
 *
 * Sama dengan pesan alat pada H-9I: ketika satu harga dipersengketakan, yang
 * ditanyakan adalah apa yang tertulis pada terbitan resminya — bukan apa yang
 * berhasil dibaca pengimpor kami.
 */
export function periksaBerkasImpor(input: {
  namaBerkas: string;
  sidikJari: string | null;
  sumber: SumberData;
  terbitanRef: string | null;
  terbitanTanggal: string | null;
}): { sah: boolean; alasan: string } {
  if (!input.sidikJari?.trim()) {
    return {
      sah: false,
      alasan:
        'Berkas impor wajib bersidik jari. Tanpanya, pertanyaan "apakah yang tersimpan sama ' +
        'dengan yang diterbitkan" hanya dapat dijawab dengan dugaan.',
    };
  }
  if (input.sumber === 'OFFICIAL_REFERENCE') {
    const izin = bolehKlaimResmi({
      sumber: input.sumber,
      terbitanRef: input.terbitanRef,
      terbitanTanggal: input.terbitanTanggal,
    });
    if (!izin.boleh) return { sah: false, alasan: izin.alasan };
  }
  return { sah: true, alasan: 'Berkas impor lengkap.' };
}

/**
 * Bolehkah hasil impor diterapkan?
 *
 * **Impor yang belum divalidasi tidak diterapkan**, dan yang ditolak tidak
 * diterapkan pula. Menerapkan impor yang belum diperiksa berarti mengganti
 * seluruh katalog obat rumah sakit dengan berkas yang belum dibaca siapa pun.
 */
export function bolehTerapkan(input: {
  status: StatusImpor;
  jumlahBaris: number;
  jumlahGalat: number;
  divalidasiOleh: string | null;
  diterapkanOleh: string | null;
}): { boleh: boolean; alasan: string } {
  if (input.status !== 'VALIDATED') {
    return {
      boleh: false,
      alasan:
        `Impor berstatus ${input.status}; hanya yang VALIDATED dapat diterapkan. Menerapkan ` +
        'impor yang belum diperiksa berarti mengganti seluruh katalog obat rumah sakit dengan ' +
        'berkas yang belum dibaca siapa pun.',
    };
  }
  if (input.jumlahGalat > 0) {
    return {
      boleh: false,
      alasan:
        `Masih ada ${input.jumlahGalat} baris bergalat dari ${input.jumlahBaris}. Impor ` +
        'sebagian akan menghasilkan katalog yang separuhnya baru dan separuhnya lama, dan ' +
        'tidak ada yang tahu baris mana yang mana.',
    };
  }
  if (!input.divalidasiOleh) {
    return { boleh: false, alasan: 'Impor yang divalidasi wajib bernama pemeriksanya.' };
  }
  if (input.diterapkanOleh && input.diterapkanOleh === input.divalidasiOleh) {
    return {
      boleh: false,
      alasan:
        'Yang memvalidasi impor tidak menerapkannya sendiri. Katalog obat menentukan apa yang ' +
        'boleh diresepkan seluruh rumah sakit; penerapan oleh pemeriksanya sendiri hanya ' +
        'membaca ulang keyakinannya.',
    };
  }
  return { boleh: true, alasan: 'Impor boleh diterapkan.' };
}

/**
 * Ringkasan kesiapan katalog.
 *
 * Dilaporkan apa adanya. Sistem yang berkata "katalog siap" ketika isinya
 * kosong akan membuat orang menyimpulkan obat yang dicarinya memang tidak ada.
 */
export function ringkasKatalog(isi: { kode: string; jumlahBaris: number }[]): {
  total: number;
  terisi: number;
  kosong: string[];
  keterangan: string;
} {
  const peta = new Map(isi.map((i) => [i.kode, i.jumlahBaris]));
  const kosong = TERMINOLOGI.filter((t) => (peta.get(t.kode) ?? 0) === 0).map((t) => t.kode);
  return {
    total: TERMINOLOGI.length,
    terisi: TERMINOLOGI.length - kosong.length,
    kosong,
    keterangan:
      kosong.length === TERMINOLOGI.length
        ? 'Tidak satu pun katalog terisi. Strukturnya ada, isinya menunggu — dan tanpa isinya ' +
          'sistem berkata "belum dapat dinilai" alih-alih menebak. Obat tanpa pemetaan KFA ' +
          'TETAP dapat dipakai; ia hanya tidak dapat dikirim ke SATUSEHAT.'
        : `${TERMINOLOGI.length - kosong.length} dari ${TERMINOLOGI.length} katalog terisi.`,
  };
}
