/**
 * H-9I — Adapter protokol alat: HL7 v2 dan ASTM.
 *
 * Aturan sebagai fungsi murni. Tidak menyentuh basis data, dan tidak menyentuh
 * jaringan.
 *
 * Seluruh berkas ini dibangun di atas satu kenyataan yang disebutkan dokumen
 * [14](../../../../docs/emedik/14-device-integration-map.md):
 *
 * > "Alat tidak dapat menolak. Bila datanya rusak, ia tetap mengirim. Yang
 * > dapat menolak adalah lapisan di antaranya."
 *
 * Lapisan itu di sini. Dan karena ia satu-satunya yang dapat menolak, ia
 * dibangun dengan satu aturan yang tidak boleh dilanggar:
 *
 * **PENGURAI TIDAK PERNAH MELEMPAR GALAT.**
 *
 * Pesan yang rusak menghasilkan hasil urai yang **menyebutkan kerusakannya**,
 * bukan pengecualian. Sebabnya bukan kerapian: pengurai yang melempar akan
 * menjatuhkan seluruh jalur penerimaan ketika satu alat mengirim satu pesan
 * cacat — dan alat yang mengirim pesan cacat biasanya mengirimnya beruntun.
 * Satu analyzer yang firmware-nya baru diperbarui dapat menghentikan
 * penerimaan hasil seluruh laboratorium.
 *
 * Aturan kedua yang sama pentingnya: **pesan aslinya disimpan apa adanya.**
 * Yang diurai adalah salinannya. Ketika hasilnya dipersengketakan, yang
 * ditanyakan adalah apa yang dikirim alat — bukan apa yang berhasil dipahami
 * pengurai ini.
 */

// --- Hasil urai --------------------------------------------------------------

export type TingkatTemuan = 'ERROR' | 'WARNING';

export interface TemuanUrai {
  tingkat: TingkatTemuan;
  kode: string;
  pesan: string;
  /** Segmen atau baris tempat temuannya, bila diketahui. */
  lokasi?: string;
}

export interface HasilObservasi {
  observationCode: string | null;
  observationValue: string | null;
  observationUnit: string | null;
  referenceRange: string | null;
  abnormalFlag: string | null;
  capturedAt: string | null;
  status: string | null;
}

export interface HasilUrai {
  /** Selalu terisi, bahkan ketika pesannya rusak seluruhnya. */
  protokol: 'HL7V2' | 'ASTM';
  valid: boolean;
  temuan: TemuanUrai[];
  messageControlId: string | null;
  messageType: string | null;
  /** Pengenal pesanan yang dibawa alat, bila ada. Inilah pengaitan terpercaya. */
  orderId: string | null;
  patientIdentifier: string | null;
  deviceIdentifier: string | null;
  observations: HasilObservasi[];
}

const kosong = (protokol: 'HL7V2' | 'ASTM', temuan: TemuanUrai[]): HasilUrai => ({
  protokol,
  valid: false,
  temuan,
  messageControlId: null,
  messageType: null,
  orderId: null,
  patientIdentifier: null,
  deviceIdentifier: null,
  observations: [],
});

// --- HL7 v2 ------------------------------------------------------------------

export interface PemisahHl7 {
  segmen: string;
  medan: string;
  komponen: string;
  ulangan: string;
  escape: string;
  subkomponen: string;
}

/**
 * Membaca karakter pemisah dari MSH-1 dan MSH-2.
 *
 * **Tidak diasumsikan.** Standar HL7 mengizinkan pengirim memilih pemisahnya
 * sendiri, dan sebagian alat memakainya — biasanya alat buatan pabrik yang
 * memformat tanggalnya sendiri pula. Pengurai yang mengasumsikan `|^~\&` akan
 * bekerja pada sembilan puluh sembilan alat dan menghasilkan omong kosong pada
 * yang keseratus, tanpa galat apa pun.
 */
export function bacaPemisah(pesan: string): { pemisah: PemisahHl7 | null; temuan: TemuanUrai[] } {
  if (!pesan.startsWith('MSH')) {
    return {
      pemisah: null,
      temuan: [
        {
          tingkat: 'ERROR',
          kode: 'NO_MSH',
          pesan: 'Pesan HL7 wajib dimulai dengan segmen MSH.',
        },
      ],
    };
  }
  const medan = pesan[3];
  const sisa = pesan.slice(4, 8);
  if (!medan || sisa.length < 4) {
    return {
      pemisah: null,
      temuan: [
        {
          tingkat: 'ERROR',
          kode: 'MSH_TRUNCATED',
          pesan: 'Segmen MSH terpotong sebelum karakter pengkodeannya lengkap.',
          lokasi: 'MSH-2',
        },
      ],
    };
  }
  return {
    pemisah: {
      segmen: '\r',
      medan,
      komponen: sisa[0],
      ulangan: sisa[1],
      escape: sisa[2],
      subkomponen: sisa[3],
    },
    temuan: [],
  };
}

/**
 * Membuka urutan escape HL7.
 *
 * Wajib. Tanpa ini, nama pasien "O\F\Brien" tersimpan apa adanya, dan nilai
 * hasil yang memuat pemisah medan terpotong di tengah.
 */
export function bukaEscape(teks: string, p: PemisahHl7): string {
  const e = p.escape;
  const peta: Record<string, string> = {
    F: p.medan,
    S: p.komponen,
    T: p.subkomponen,
    R: p.ulangan,
    E: e,
    '.br': '\n',
  };
  let hasil = '';
  let i = 0;
  while (i < teks.length) {
    if (teks[i] !== e) {
      hasil += teks[i];
      i += 1;
      continue;
    }
    const tutup = teks.indexOf(e, i + 1);
    if (tutup === -1) {
      // Escape yang tidak tertutup dibiarkan apa adanya, bukan dibuang.
      hasil += teks.slice(i);
      break;
    }
    const isi = teks.slice(i + 1, tutup);
    hasil += peta[isi] ?? (isi.startsWith('X') ? bukaHeks(isi.slice(1)) : '');
    i = tutup + 1;
  }
  return hasil;
}

function bukaHeks(heks: string): string {
  let hasil = '';
  for (let i = 0; i + 1 < heks.length; i += 2) {
    const n = Number.parseInt(heks.slice(i, i + 2), 16);
    if (!Number.isNaN(n)) hasil += String.fromCharCode(n);
  }
  return hasil;
}

/**
 * Mengubah waktu HL7 (`YYYYMMDDHHMMSS[.S+][+/-ZZZZ]`) menjadi ISO 8601.
 *
 * **Zona waktu yang tidak disebutkan TIDAK diasumsikan UTC.** Ia dilaporkan
 * sebagai temuan, dan waktunya dibaca sebagai waktu lokal fasilitas. Alat medis
 * hampir tidak pernah menyertakan zona waktu, dan menganggapnya UTC menggeser
 * seluruh hasil tujuh jam di Indonesia — cukup untuk memindahkan hasil pagi ke
 * hari sebelumnya.
 */
export function uraiWaktuHl7(
  teks: string | null | undefined,
): { iso: string | null; adaZona: boolean; temuan: TemuanUrai[] } {
  const t = (teks ?? '').trim();
  if (!t) return { iso: null, adaZona: false, temuan: [] };

  const m = t.match(/^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:\.\d+)?([+-]\d{4})?$/);
  if (!m) {
    return {
      iso: null,
      adaZona: false,
      temuan: [
        {
          tingkat: 'WARNING',
          kode: 'BAD_TIMESTAMP',
          pesan: `Waktu "${t}" tidak berbentuk waktu HL7; hasilnya diterima tanpa waktu alat.`,
        },
      ],
    };
  }
  const [, th, bl = '01', tg = '01', jm = '00', mn = '00', dt = '00', zona] = m;
  const dasar = `${th}-${bl}-${tg}T${jm}:${mn}:${dt}`;
  if (zona) {
    return {
      iso: `${dasar}${zona.slice(0, 3)}:${zona.slice(3)}`,
      adaZona: true,
      temuan: [],
    };
  }
  return {
    iso: dasar,
    adaZona: false,
    temuan: [
      {
        tingkat: 'WARNING',
        kode: 'NO_TIMEZONE',
        pesan:
          'Waktu alat tidak menyebutkan zona waktunya. Ia dibaca sebagai waktu lokal ' +
          'fasilitas, BUKAN UTC — menganggapnya UTC menggeser seluruh hasil tujuh jam di ' +
          'Indonesia, cukup untuk memindahkan hasil pagi ke hari sebelumnya.',
      },
    ],
  };
}

/** Jenis pesan HL7 yang diterima. Daftar TERTUTUP. */
export const JENIS_HL7_DITERIMA = ['ORU^R01', 'ORU^R30', 'OUL^R21', 'OUL^R22', 'OUL^R23'];

export function uraiHl7(pesan: string): HasilUrai {
  const mentah = (pesan ?? '').replace(/\r\n|\n/g, '\r').trim();
  if (!mentah) {
    return kosong('HL7V2', [
      { tingkat: 'ERROR', kode: 'EMPTY', pesan: 'Pesan kosong.' },
    ]);
  }

  const { pemisah, temuan: temuanPemisah } = bacaPemisah(mentah);
  if (!pemisah) return kosong('HL7V2', temuanPemisah);

  const temuan: TemuanUrai[] = [];
  const segmen = mentah.split(pemisah.segmen).filter((x) => x.trim().length > 0);
  const belah = (baris: string) => baris.split(pemisah.medan);
  const komponen = (nilai: string | undefined, n: number) =>
    (nilai ?? '').split(pemisah.komponen)[n] ?? '';

  const msh = belah(segmen[0]);
  /*
   * Penomoran MSH bergeser satu.
   *
   * MSH-1 adalah pemisah medannya sendiri, sehingga sesudah dibelah, indeks
   * larik 1 berisi MSH-2 dan seterusnya. Salah satu sumber kekeliruan paling
   * umum pada pengurai HL7 buatan sendiri, dan ia tidak menimbulkan galat: ia
   * hanya membaca medan yang salah.
   */
  const messageControlId = bukaEscape(msh[9] ?? '', pemisah) || null;
  const jenisMentah = msh[8] ?? '';
  const messageType =
    [komponen(jenisMentah, 0), komponen(jenisMentah, 1)].filter(Boolean).join('^') || null;
  const deviceIdentifier = bukaEscape(msh[2] ?? '', pemisah) || null;

  if (!messageControlId) {
    temuan.push({
      tingkat: 'WARNING',
      kode: 'NO_CONTROL_ID',
      pesan:
        'Pesan tanpa message control ID. Duplikatnya tetap dikenali lewat sidik jari isi ' +
        'pesannya — tetapi pengirim yang tidak menomori pesannya juga tidak dapat menerima ' +
        'balasan ACK yang bermakna.',
      lokasi: 'MSH-10',
    });
  }
  if (messageType && !JENIS_HL7_DITERIMA.includes(messageType)) {
    temuan.push({
      tingkat: 'ERROR',
      kode: 'UNSUPPORTED_MESSAGE_TYPE',
      pesan:
        `Jenis pesan ${messageType} tidak diterima jalur ini. Yang diterima: ` +
        `${JENIS_HL7_DITERIMA.join(', ')}. Jalur hasil alat sengaja tidak menerima ADT ` +
        'maupun ORM — pendaftaran pasien dan pemesanan pemeriksaan datang dari eMedik, ' +
        'bukan dari alat.',
      lokasi: 'MSH-9',
    });
  }

  let orderId: string | null = null;
  let patientIdentifier: string | null = null;
  const observations: HasilObservasi[] = [];

  for (const baris of segmen.slice(1)) {
    const f = belah(baris);
    const nama = f[0];

    if (nama === 'PID') {
      patientIdentifier = bukaEscape(komponen(f[3], 0), pemisah) || null;
    } else if (nama === 'OBR') {
      // OBR-2 pengenal pemesan; OBR-3 pengenal pelaksana. Yang dipakai untuk
      // pengaitan adalah OBR-2 bila ada — ia nomor yang KAMI berikan.
      orderId =
        bukaEscape(komponen(f[2], 0), pemisah) ||
        bukaEscape(komponen(f[3], 0), pemisah) ||
        orderId;
    } else if (nama === 'OBX') {
      const kode = bukaEscape(komponen(f[3], 0), pemisah) || null;
      const nilai = bukaEscape(f[5] ?? '', pemisah) || null;
      const waktu = uraiWaktuHl7(f[14]);
      temuan.push(...waktu.temuan);

      if (!kode) {
        temuan.push({
          tingkat: 'ERROR',
          kode: 'OBX_NO_CODE',
          pesan: 'Segmen OBX tanpa kode pemeriksaan; hasilnya tidak dapat dipetakan.',
          lokasi: 'OBX-3',
        });
      }
      observations.push({
        observationCode: kode,
        observationValue: nilai,
        observationUnit: bukaEscape(komponen(f[6], 0), pemisah) || null,
        referenceRange: bukaEscape(f[7] ?? '', pemisah) || null,
        abnormalFlag: bukaEscape(f[8] ?? '', pemisah) || null,
        capturedAt: waktu.iso,
        status: bukaEscape(f[11] ?? '', pemisah) || null,
      });
    }
  }

  if (observations.length === 0) {
    temuan.push({
      tingkat: 'ERROR',
      kode: 'NO_OBX',
      pesan: 'Pesan hasil tanpa satu pun segmen OBX; tidak ada hasil untuk disimpan.',
    });
  }

  return {
    protokol: 'HL7V2',
    valid: !temuan.some((t) => t.tingkat === 'ERROR'),
    temuan,
    messageControlId,
    messageType,
    orderId,
    patientIdentifier,
    deviceIdentifier,
    observations,
  };
}

// --- ASTM E1394 --------------------------------------------------------------

/**
 * Menghitung checksum ASTM: jumlah byte modulo 256, dua digit heksadesimal
 * huruf besar.
 *
 * Dihitung atas isi bingkai **sesudah** STX sampai dan termasuk ETX/ETB.
 */
export function checksumAstm(isi: string): string {
  let jumlah = 0;
  for (let i = 0; i < isi.length; i += 1) jumlah = (jumlah + isi.charCodeAt(i)) % 256;
  return jumlah.toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Memeriksa checksum satu bingkai ASTM.
 *
 * Bingkai yang checksumnya salah **tetap diurai**, dan ditandai. Membuangnya
 * berarti membuang hasil yang mungkin benar seluruhnya kecuali satu bit pada
 * jalur serialnya — dan yang membuangnya tidak akan pernah tahu apa yang
 * dibuangnya.
 */
export function periksaChecksumAstm(bingkai: string): {
  cocok: boolean;
  diharapkan: string | null;
  ditemukan: string | null;
} {
  /*
   * Dua karakter apa pun, bukan hanya heksadesimal.
   *
   * Checksum yang tidak berbentuk heksadesimal adalah checksum yang RUSAK — dan
   * justru itu yang paling perlu dilaporkan beserta nilai yang diharapkan. Pola
   * yang hanya menerima heksadesimal akan berkata "tidak ada checksum" pada
   * bingkai yang checksumnya ada tetapi tergaduh di jalur serialnya, dan kedua
   * keadaan itu menuntut tindakan yang berbeda: yang pertama berarti
   * pengirimnya salah bentuk, yang kedua berarti kabelnya.
   */
  /*
   * ESLint dimatikan setempat, dengan alasan yang tercatat: STX (0x02), ETX
   * (0x03), dan ETB (0x17) adalah BAGIAN DARI DEFINISI protokol ASTM E1381,
   * bukan kelalaian pengetikan. Bingkai ASTM tidak dapat dikenali tanpa
   * menyebutnya.
   */
  // eslint-disable-next-line no-control-regex
  const m = bingkai.match(/\x02?(.*[\x03\x17])(..)\r?\n?$/s);
  if (!m) return { cocok: false, diharapkan: null, ditemukan: null };
  const diharapkan = checksumAstm(m[1]);
  return {
    cocok: diharapkan.toUpperCase() === m[2].toUpperCase(),
    diharapkan,
    ditemukan: m[2].toUpperCase(),
  };
}

export function uraiAstm(pesan: string): HasilUrai {
  const mentah = (pesan ?? '').trim();
  if (!mentah) {
    return kosong('ASTM', [{ tingkat: 'ERROR', kode: 'EMPTY', pesan: 'Pesan kosong.' }]);
  }

  const temuan: TemuanUrai[] = [];
  const baris = mentah
    .split(/[\r\n]+/)
    // Membuang bingkai ASTM: STX dan nomor bingkai di depan, ETX/ETB beserta
    // checksumnya di belakang. Karakter kendalinya bagian dari definisi
    // protokolnya, sama seperti pada periksaChecksumAstm di atas.
    // eslint-disable-next-line no-control-regex
    .map((b) => b.replace(/^\x02?\d?/, '').replace(/[\x03\x17][0-9A-Fa-f]{2}$/, ''))
    .filter((b) => b.trim().length > 0);

  let messageControlId: string | null = null;
  let orderId: string | null = null;
  let patientIdentifier: string | null = null;
  let deviceIdentifier: string | null = null;
  const observations: HasilObservasi[] = [];

  for (const b of baris) {
    const jenis = b[0]?.toUpperCase();
    const f = b.split('|');

    if (jenis === 'H') {
      // H|\^&|||NamaAlat^Versi|...  — pengenal alat pada medan ke-5.
      deviceIdentifier = (f[4] ?? '').split('^')[0] || null;
      messageControlId = (f[12] ?? '').trim() || null;
    } else if (jenis === 'P') {
      patientIdentifier = (f[3] ?? '').trim() || (f[2] ?? '').trim() || null;
    } else if (jenis === 'O') {
      orderId = (f[2] ?? '').trim() || null;
    } else if (jenis === 'R') {
      const kode = (f[2] ?? '').split('^').filter(Boolean).slice(-1)[0] ?? null;
      const waktu = uraiWaktuHl7(f[12]);
      temuan.push(...waktu.temuan);
      if (!kode) {
        temuan.push({
          tingkat: 'ERROR',
          kode: 'R_NO_CODE',
          pesan: 'Rekaman hasil ASTM tanpa kode pemeriksaan.',
          lokasi: 'R-3',
        });
      }
      observations.push({
        observationCode: kode,
        observationValue: (f[3] ?? '').trim() || null,
        observationUnit: (f[4] ?? '').trim() || null,
        referenceRange: (f[5] ?? '').trim() || null,
        abnormalFlag: (f[6] ?? '').trim() || null,
        capturedAt: waktu.iso,
        status: (f[8] ?? '').trim() || null,
      });
    }
  }

  if (baris.length > 0 && baris[0][0]?.toUpperCase() !== 'H') {
    temuan.push({
      tingkat: 'ERROR',
      kode: 'NO_HEADER',
      pesan: 'Pesan ASTM wajib dimulai dengan rekaman H.',
    });
  }
  if (observations.length === 0) {
    temuan.push({
      tingkat: 'ERROR',
      kode: 'NO_RESULT',
      pesan: 'Pesan ASTM tanpa satu pun rekaman R; tidak ada hasil untuk disimpan.',
    });
  }

  return {
    protokol: 'ASTM',
    valid: !temuan.some((t) => t.tingkat === 'ERROR'),
    temuan,
    messageControlId,
    messageType: null,
    orderId,
    patientIdentifier,
    deviceIdentifier,
    observations,
  };
}

// --- Pemetaan istilah --------------------------------------------------------

export interface PetaKode {
  kodeAlat: string;
  kodeLokal: string;
  satuanAlat: string | null;
  satuanLokal: string | null;
}

export interface HasilPemetaan {
  kodeAlat: string;
  kodeLokal: string | null;
  terpetakan: boolean;
  satuanBerbeda: boolean;
  keterangan: string;
}

/**
 * Memetakan kode alat ke kode lokal.
 *
 * **Yang tidak terpeta TIDAK DITEBAK.** Ia dilaporkan sebagai belum terpeta,
 * dan hasilnya tetap disimpan dengan kode alatnya apa adanya.
 *
 * Menebaknya — dengan kemiripan nama, dengan urutan, dengan "biasanya HGB
 * berarti hemoglobin" — akan benar hampir selalu dan salah sekali, dan yang
 * sekali itu menaruh kadar kalium pada baris natrium. Perbedaannya tidak akan
 * terlihat oleh siapa pun sampai seseorang diberi obat berdasarkan angka itu.
 */
export function petakanKode(kodeAlat: string, peta: PetaKode[], satuan?: string | null): HasilPemetaan {
  const cocok = peta.find((p) => p.kodeAlat.toUpperCase() === kodeAlat.toUpperCase());
  if (!cocok) {
    return {
      kodeAlat,
      kodeLokal: null,
      terpetakan: false,
      satuanBerbeda: false,
      keterangan:
        `Kode "${kodeAlat}" belum dipetakan. Hasilnya tetap disimpan dengan kode alatnya apa ` +
        'adanya dan masuk antrean pemetaan. Menebaknya akan benar hampir selalu dan salah ' +
        'sekali, dan yang sekali itu menaruh kadar kalium pada baris natrium.',
    };
  }
  const satuanBerbeda = Boolean(
    satuan && cocok.satuanAlat && satuan.trim().toLowerCase() !== cocok.satuanAlat.trim().toLowerCase(),
  );
  return {
    kodeAlat,
    kodeLokal: cocok.kodeLokal,
    terpetakan: true,
    satuanBerbeda,
    keterangan: satuanBerbeda
      ? `Terpetakan ke ${cocok.kodeLokal}, TETAPI satuannya berbeda dari yang dipetakan ` +
        `("${satuan}" vs "${cocok.satuanAlat}"). Satuan yang berubah diam-diam adalah cara ` +
        'alat yang baru diperbarui melipatgandakan seluruh hasilnya tanpa ada yang tahu.'
      : `Terpetakan ke ${cocok.kodeLokal}.`,
  };
}

// --- Protokol yang terhalang -------------------------------------------------

export const PROTOKOL_ADAPTER = {
  HL7V2: { siap: true, penghalang: null as string | null },
  ASTM: { siap: true, penghalang: null as string | null },
  IHE_PCD: { siap: true, penghalang: null as string | null },
  IEEE_11073: { siap: true, penghalang: null as string | null },
  TCP_SERIAL: { siap: true, penghalang: null as string | null },
  SFTP: { siap: true, penghalang: null as string | null },
  DICOM: {
    siap: false,
    penghalang:
      'Menunggu arsitektur PACS. Menyimpan berkas DICOM utuh di basis data relasional akan ' +
      'membengkakkan cadangan sampai tidak dapat dipulihkan pada saat dibutuhkan. Yang ' +
      'disimpan hanya rujukan, dan tempat rujukan itu menunjuk belum diputuskan Core.',
  },
  DICOMWEB: {
    siap: false,
    penghalang:
      'Menunggu arsitektur PACS, sama dengan DICOM. Ia jalan lain menuju berkas yang sama, dan ' +
      'jalannya tidak berguna sebelum berkasnya punya tempat.',
  },
  MODALITY_WORKLIST: {
    siap: false,
    penghalang:
      'Menunggu PACS/RIS. Daftar kerja modalitas dibaca dari sistem radiologi, dan sistem itu ' +
      'yang menentukan bentuk pesanannya.',
  },
  MPPS: {
    siap: false,
    penghalang:
      'Menunggu PACS. Status pengerjaan modalitas hanya bermakna bila ada tempat citranya ' +
      'disimpan; tanpa itu ia laporan tentang berkas yang tidak ada.',
  },
  FHIR: {
    siap: false,
    penghalang:
      'Bergantung SATUSEHAT. Profil FHIR yang dipakai Indonesia ditetapkan SATUSEHAT, dan ' +
      'mengarangnya akan menghasilkan adapter yang harus dibuang seluruhnya.',
  },
  VENDOR_API: {
    siap: false,
    penghalang:
      'Dokumentasi berbeda per vendor dan tidak ada yang umum. Adapter yang ditulis untuk satu ' +
      'vendor tidak dapat dipakai vendor lain, dan menulisnya sebelum ada alatnya berarti ' +
      'menebak bentuk pesannya.',
  },
  MQTT: {
    siap: false,
    penghalang:
      'Menunggu persetujuan keamanan. MQTT membuka jalur dua arah yang bertahan lama, dan jalur ' +
      'dua arah ke alat medis adalah hal yang harus ditelaah sebelum ada, bukan sesudah.',
  },
} as const;

export type ProtokolAdapter = keyof typeof PROTOKOL_ADAPTER;

/**
 * Bolehkah pesan protokol ini diurai?
 *
 * Yang terhalang **menyebutkan penghalangnya**. Adapter yang hanya berkata
 * "tidak didukung" akan ditanyakan ulang setiap tiga bulan oleh orang yang
 * berbeda, dan salah satu di antaranya akan menuliskannya sendiri.
 */
export function bolehUrai(protokol: string): { boleh: boolean; pesan: string } {
  const p = PROTOKOL_ADAPTER[protokol as ProtokolAdapter];
  if (!p) {
    return { boleh: false, pesan: `Protokol ${protokol} tidak dikenal.` };
  }
  if (!p.siap) {
    return {
      boleh: false,
      pesan: `Adapter ${protokol} belum ada. ${p.penghalang}`,
    };
  }
  return { boleh: true, pesan: `Adapter ${protokol} siap.` };
}

/** Protokol yang punya pengurai sungguhan pada berkas ini. */
export function punyaPengurai(protokol: string): boolean {
  return protokol === 'HL7V2' || protokol === 'ASTM';
}

// --- Balasan ACK -------------------------------------------------------------

export type KodeAck = 'AA' | 'AE' | 'AR';

/**
 * Menyusun balasan ACK HL7.
 *
 * **Pesan yang cacat dibalas AE, bukan AR.**
 *
 * Perbedaannya menentukan perilaku alat: `AR` (reject) membuat sebagian alat
 * mengirim ulang pesan yang sama tanpa henti, sedangkan `AE` (error) membuatnya
 * melanjutkan ke pesan berikutnya. Pesan yang cacat karena isinya akan tetap
 * cacat berapa kali pun dikirim ulang — dan alat yang mengirim ulang tanpa henti
 * akan memenuhi antrean sampai hasil pasien lain tidak dapat masuk.
 */
export function susunAck(input: {
  messageControlId: string | null;
  diterima: boolean;
  temuan: TemuanUrai[];
  penerima?: string;
}): { kode: KodeAck; teks: string } {
  const kode: KodeAck = input.diterima ? 'AA' : 'AE';
  const galat = input.temuan
    .filter((t) => t.tingkat === 'ERROR')
    .map((t) => t.kode)
    .join(',');
  const id = input.messageControlId ?? 'UNKNOWN';
  const penerima = input.penerima ?? 'EMEDIK';
  return {
    kode,
    teks:
      `MSH|^~\\&|${penerima}|||||ACK|${id}|P|2.5\rMSA|${kode}|${id}` +
      (galat ? `|${galat}` : ''),
  };
}
