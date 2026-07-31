/**
 * Aturan pertanahan administratif — fungsi murni, tanpa basis data.
 *
 * ## Sistem ini tidak menggantikan sistem pertanahan nasional
 *
 * Yang disimpan di sini adalah **catatan desa**: penguasaan fisik, riwayat yang
 * diketahui, dan pernyataan batas. Bukan hak atas tanah. Perbedaannya bukan
 * kehati-hatian hukum melainkan kenyataan sehari-hari — surat keterangan desa
 * yang dianggap bukti kepemilikan adalah awal dari sengketa yang paling sulit
 * diselesaikan, karena kedua pihak sama-sama memegang kertas dari kantor yang
 * sama.
 *
 * Karena itu:
 *
 * 1. Kolomnya bernama `possessor`, bukan `owner`. Nama kolom yang menyatakan
 *    kepemilikan membuat sistem mengklaim apa yang justru dinyatakannya tidak
 *    dilakukan, dan yang membaca basis data tidak membaca dokumentasi.
 * 2. Surat keterangan tanah **wajib memuat penyangkalannya di dalam surat itu
 *    sendiri**, bukan hanya di dokumentasi. Yang membaca surat adalah orang
 *    yang tidak pernah membuka dokumentasi apa pun.
 * 3. Bidang tanah yang sudah bersertifikat **tidak diberi surat keterangan.**
 *    Dua kertas atas satu bidang adalah cara sengketa dimulai.
 */

export type Putusan = {
  boleh: boolean;
  alasan?: string;
};

// --- Penyangkalan yang wajib ada di dalam surat ------------------------------

/**
 * Kalimat penyangkalan bawaan.
 *
 * Desa boleh menyusun kalimatnya sendiri — bahasa surat berbeda antar daerah —
 * tetapi dua frasa pada {@link FRASA_WAJIB} harus tetap ada. Yang dijaga
 * bukan susunan kalimatnya melainkan dua hal yang harus terbaca oleh siapa pun
 * yang memegang suratnya.
 */
export const PENYANGKALAN_BAKU =
  'Surat keterangan ini BUKAN BUKTI KEPEMILIKAN hak atas tanah dan TIDAK MENGGANTIKAN ' +
  'SERTIFIKAT yang diterbitkan Badan Pertanahan Nasional. Surat ini hanya menerangkan ' +
  'penguasaan fisik dan riwayat yang tercatat pada administrasi Pemerintah Desa.';

/**
 * Frasa yang wajib terbaca di dalam badan surat.
 *
 * Dua, dan keduanya menjawab pertanyaan yang benar-benar ditanyakan orang saat
 * memegang surat keterangan tanah: "ini bukti milik saya, kan?" dan "berarti
 * saya tidak perlu sertifikat, kan?"
 */
export const FRASA_WAJIB = ['bukan bukti kepemilikan', 'tidak menggantikan sertifikat'] as const;

export interface HasilPeriksaPenyangkalan {
  ada: boolean;
  hilang: string[];
}

/**
 * Memeriksa bahwa penyangkalannya benar-benar ada di dalam badan surat.
 *
 * Diperiksa pada teks yang akan tercetak, bukan pada berkas templat. Templat
 * yang benar tidak menjamin surat yang benar: templat dapat disunting, diganti,
 * atau dilewati oleh jalur penerbitan lain.
 */
export function periksaPenyangkalan(badanSurat: string): HasilPeriksaPenyangkalan {
  const teks = (badanSurat ?? '').toLowerCase();
  const hilang = FRASA_WAJIB.filter((f) => !teks.includes(f));
  return { ada: hilang.length === 0, hilang: [...hilang] };
}

/** Menyisipkan penyangkalan baku bila belum ada. */
export function sisipkanPenyangkalan(badanSurat: string): string {
  if (periksaPenyangkalan(badanSurat).ada) return badanSurat;
  return `${(badanSurat ?? '').trimEnd()}\n\n${PENYANGKALAN_BAKU}`;
}

// --- Bidang tanah ------------------------------------------------------------

export type JenisPenguasaan =
  | 'MILIK_ADAT'
  | 'GARAPAN'
  | 'SEWA'
  | 'TANAH_KAS_DESA'
  | 'TANAH_BENGKOK'
  | 'WAKAF'
  | 'LAINNYA';

export type StatusSertifikat = 'BELUM_BERSERTIFIKAT' | 'BERSERTIFIKAT' | 'DALAM_PROSES';

export interface BidangTanah {
  statusSertifikat: StatusSertifikat;
  nomorSertifikat?: string | null;
  luasM2: number;
  jenisPenguasaan: JenisPenguasaan;
}

export function periksaBidang(b: BidangTanah): Putusan {
  if (!Number.isFinite(b.luasM2) || b.luasM2 <= 0) {
    return { boleh: false, alasan: 'Luas bidang harus lebih besar dari nol.' };
  }
  if (b.statusSertifikat === 'BERSERTIFIKAT' && !b.nomorSertifikat?.trim()) {
    return {
      boleh: false,
      alasan:
        'Bidang bertanda bersertifikat wajib menyebutkan nomor sertifikatnya. Tanpa nomornya, ' +
        'catatan desa tidak dapat dicocokkan dengan data pertanahan nasional.',
    };
  }
  if (b.statusSertifikat !== 'BERSERTIFIKAT' && b.nomorSertifikat?.trim()) {
    return {
      boleh: false,
      alasan: 'Nomor sertifikat terisi tetapi statusnya bukan bersertifikat. Pilih salah satu.',
    };
  }
  return { boleh: true };
}

// --- Surat keterangan tanah --------------------------------------------------

export interface PermohonanSkt {
  statusSertifikat: StatusSertifikat;
  /** Jumlah bidang yang berbatasan menurut pernyataan pemohon. */
  jumlahTetangga: number;
  /** Persetujuan batas yang sudah terkumpul. */
  jumlahPersetujuan: number;
  /** Nama pemohon; yang menguasai secara fisik, bukan yang memiliki. */
  namaPenguasa: string;
  /** Badan surat yang akan tercetak. */
  badanSurat: string;
  /** Sudah ada surat keterangan yang masih berlaku atas bidang ini? */
  adaSktBerlaku: boolean;
}

/**
 * Bolehkah surat keterangan tanah diterbitkan?
 *
 * Empat penolakan, dan seluruhnya berasal dari cara surat keterangan desa
 * benar-benar menjadi masalah:
 *
 * 1. **Bidang yang sudah bersertifikat tidak diberi surat keterangan.**
 *    Sertifikatnya sudah menjawab pertanyaan yang hendak dijawab surat ini, dan
 *    dua kertas atas satu bidang adalah cara sengketa dimulai.
 * 2. **Batas wajib disepakati seluruh tetangga.** Surat yang terbit tanpa
 *    persetujuan batas memindahkan sengketa dari kantor desa ke pengadilan,
 *    dengan kertas resmi di tangan satu pihak.
 * 3. **Satu bidang, satu surat yang berlaku.** Dua surat yang sama-sama berlaku
 *    atas bidang yang sama adalah keadaan yang tidak dapat dijelaskan kepada
 *    siapa pun.
 * 4. **Penyangkalannya harus ada di dalam suratnya.**
 */
export function bolehTerbitkanSkt(p: PermohonanSkt): Putusan {
  if (p.statusSertifikat === 'BERSERTIFIKAT') {
    return {
      boleh: false,
      alasan:
        'Bidang ini sudah bersertifikat. Surat keterangan desa tidak diterbitkan atas tanah ' +
        'bersertifikat — sertifikatnya sudah menjawab pertanyaan yang hendak dijawab surat ini, ' +
        'dan dua kertas atas satu bidang adalah cara sengketa dimulai.',
    };
  }

  if (p.adaSktBerlaku) {
    return {
      boleh: false,
      alasan:
        'Bidang ini sudah memiliki surat keterangan yang masih berlaku. Cabut surat sebelumnya ' +
        'beserta alasannya sebelum menerbitkan yang baru.',
    };
  }

  if (!Number.isInteger(p.jumlahTetangga) || p.jumlahTetangga < 0) {
    return { boleh: false, alasan: 'Jumlah bidang yang berbatasan harus dinyatakan.' };
  }

  if (p.jumlahPersetujuan < p.jumlahTetangga) {
    const kurang = p.jumlahTetangga - p.jumlahPersetujuan;
    return {
      boleh: false,
      alasan:
        `Persetujuan batas belum lengkap: ${kurang} dari ${p.jumlahTetangga} bidang yang ` +
        'berbatasan belum menyatakan setuju. Surat yang terbit tanpa persetujuan batas ' +
        'memindahkan sengketa dari kantor desa ke pengadilan, dengan kertas resmi di tangan ' +
        'satu pihak.',
    };
  }

  if (!p.namaPenguasa?.trim()) {
    return { boleh: false, alasan: 'Nama pihak yang menguasai wajib disebutkan.' };
  }

  const d = periksaPenyangkalan(p.badanSurat);
  if (!d.ada) {
    return {
      boleh: false,
      alasan:
        `Badan surat belum memuat penyangkalannya: frasa "${d.hilang.join('", "')}" tidak ` +
        'ditemukan. Penyangkalan harus terbaca di dalam suratnya sendiri — yang membaca surat ' +
        'adalah orang yang tidak pernah membuka dokumentasi apa pun.',
    };
  }

  return { boleh: true };
}

// --- Riwayat peralihan -------------------------------------------------------

export type CaraPeralihan = 'JUAL_BELI' | 'WARIS' | 'HIBAH' | 'TUKAR_MENUKAR' | 'WAKAF' | 'LAINNYA';

export interface Peralihan {
  cara: CaraPeralihan;
  dariNama: string;
  kepadaNama: string;
  tanggal: string;
  /** Nomor akta, kutipan letter C, atau bukti lain. */
  dasarPeralihan?: string | null;
}

/**
 * Bolehkah peralihan dicatat?
 *
 * Wajib menyebut dasarnya. Riwayat peralihan tanpa dasar adalah daftar nama
 * yang berurutan — ia tampak seperti bukti tetapi tidak membuktikan apa pun,
 * dan justru bentuk itulah yang paling sering dibawa ke pengadilan.
 */
export function bolehCatatPeralihan(p: Peralihan): Putusan {
  if (!p.dariNama?.trim() || !p.kepadaNama?.trim()) {
    return { boleh: false, alasan: 'Pihak yang mengalihkan dan yang menerima wajib disebutkan.' };
  }
  if (p.dariNama.trim() === p.kepadaNama.trim()) {
    return { boleh: false, alasan: 'Pihak yang mengalihkan dan yang menerima tidak boleh sama.' };
  }
  if (!ISO_TANGGAL.test(p.tanggal)) {
    return { boleh: false, alasan: 'Tanggal peralihan harus berformat YYYY-MM-DD.' };
  }
  if (!p.dasarPeralihan?.trim()) {
    return {
      boleh: false,
      alasan:
        'Dasar peralihan wajib disebutkan — nomor akta, kutipan letter C, atau bukti lain. ' +
        'Riwayat tanpa dasar adalah daftar nama yang berurutan: tampak seperti bukti, tetapi ' +
        'tidak membuktikan apa pun.',
    };
  }
  return { boleh: true };
}

const ISO_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
