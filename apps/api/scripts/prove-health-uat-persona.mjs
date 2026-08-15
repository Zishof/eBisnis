/**
 * UAT persona eMedik — tiap peran yang tersemai dijalankan sebagai orang
 * sungguhan terhadap peladen yang hidup.
 *
 * ## Mengapa naskah ini ada
 *
 * Seluruh fase sebelumnya membuktikan bahwa *fitur* bekerja. Tidak satu pun
 * membuktikan bahwa **pembagian kerjanya** benar: bahwa koder tidak dapat
 * memverifikasi kodenya sendiri, bahwa penyusun kontrak tidak dapat
 * menyetujuinya, bahwa investor tidak pernah sampai ke data pasien.
 *
 * Itu bukan pertanyaan tentang kode satu modul. Ia pertanyaan tentang apa yang
 * **disemai** ke dalam tabel hibah, dan hanya dapat dijawab dengan masuk
 * sebagai orangnya lalu mencoba.
 *
 * ## Yang TIDAK dibuktikan naskah ini
 *
 * Ia tidak membuktikan penjaga hak akses bekerja — penjaga membaca tabel hibah
 * yang sama, jadi "ditolak bila tidak dihibahkan" hampir merupakan tautologi.
 *
 * Yang dibuktikannya adalah hal yang berbeda dan lebih penting: **hibah yang
 * tersemai sesuai dengan kebijakan yang dinyatakan.** Peran yang dihibahi
 * terlalu banyak akan lulus setiap uji unit yang ada, dan hanya terlihat di
 * sini.
 *
 * ## Bentuk tiap persona
 *
 * Mengikuti `docs/ekoperasi/10-uat-skenario.md`:
 *
 *   kerja    — yang dilakukannya tiap hari; harus TIDAK ditolak
 *   ditolak  — yang bukan wewenangnya; harus ditolak 403
 *
 * Bagian "ditolak" yang paling berharga. Sistem yang mengizinkan seluruhnya
 * tetap lulus seluruh bagian "kerja".
 *
 * Jalankan: node scripts/prove-health-uat-persona.mjs
 * Menuntut peladen hidup pada API_BASE.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import pg from 'pg';

const BASE = process.env.API_BASE ?? 'http://localhost:3200/api/v1';
const SCHEMA = process.env.HEALTH_SCHEMA ?? 'demo';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const bacaEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()?.replace(/^"|"$/g, '');

const client = new pg.Client({ connectionString: bacaEnv('DATABASE_URL') });
const q = async (sql, p = []) => (await client.query(sql, p)).rows;

const lines = [];
const log = (t = '') => {
  lines.push(t);
  console.log(t);
};

let gagal = 0;
let lulus = 0;
const temuan = [];
function nilai(label, ok, rinci = '') {
  if (ok) lulus += 1;
  else {
    gagal += 1;
    temuan.push(`${label}${rinci ? ` — ${rinci}` : ''}`);
  }
  log(`    ${ok ? 'LULUS ' : 'GAGAL '} ${label}${ok || !rinci ? '' : `  (${rinci})`}`);
}

/* ---------------------------------------------------------------------------
 * Menu yang membawa data pasien.
 *
 * Dipakai aturan mutlak R2: "Jangan memberikan investor akses data pasien."
 * Daftar ini ditulis tangan dengan sengaja — ia adalah PERNYATAAN KEBIJAKAN,
 * bukan turunan dari basis data. Menurunkannya dari basis data akan membuatnya
 * setuju dengan apa pun yang tersemai, termasuk yang keliru.
 * ------------------------------------------------------------------------- */
const MENU_DATA_PASIEN = [
  'HEALTH_PATIENT', 'HEALTH_PATIENT_DUPLICATE', 'HEALTH_ENCOUNTER', 'HEALTH_CLINICAL_NOTE',
  'HEALTH_ADMISSION', 'HEALTH_EMERGENCY', 'HEALTH_ICU', 'HEALTH_SURGERY',
  'HEALTH_LAB_ORDER', 'HEALTH_LAB_CRITICAL', 'HEALTH_PRESCRIPTION', 'HEALTH_ADMINISTRATION',
  'HEALTH_HIM_CODING', 'HEALTH_ACCESS_LOG', 'HEALTH_BREAK_GLASS', 'HEALTH_LEGAL_HOLD',
  'HEALTH_INFO_RELEASE', 'HEALTH_FAMILY', 'HEALTH_GROWTH', 'HEALTH_IMMUNIZATION',
  'HEALTH_HOME_VISIT', 'HEALTH_BPJS_SEP', 'HEALTH_BPJS_ELIGIBILITY',
  'HEALTH_SAFETY', 'HEALTH_RADIOLOGY_ORDER', 'HEALTH_NUTRITION', 'HEALTH_PORTAL_RELEASE',
];

/*
 * HEALTH_BED sengaja TIDAK ada di atas — dan itu keputusan yang berubah karena
 * temuan UAT ini sendiri, jadi riwayatnya ditulis.
 *
 * Semula ia terdaftar sebagai menu berdata pasien, dan aturannya GAGAL: daftar
 * tempat tidur mengembalikan nama penghuni, nomor rawat inap, dan nama kamar
 * kepada HEALTH_ADMIN — peran yang menerima 403 pada indeks pasien maupun papan
 * bangsal. Salah satu barisnya menyebut kamar isolasi, yang dengan sendirinya
 * sudah menyatakan sesuatu yang klinis.
 *
 * Sesudah controller menyamarkan identitas penghuni bagi yang tidak memegang
 * HEALTH_ADMISSION.READ, hak atas tempat tidur menjadi hak atas SARANA saja.
 *
 * Yang menjaga pernyataan itu bukan daftar ini, melainkan pemeriksaan perilaku
 * pada BAGIAN 2 — ia memanggil peladen sungguhan pada fasilitas yang benar-
 * benar terisi dan melihat apa yang keluar. Daftar dapat menjadi usang tanpa
 * ketahuan; panggilan tidak.
 */

/*
 * HEALTH_DEVICE_INBOX sengaja TIDAK ada di atas, dan sebabnya perlu ditulis
 * supaya tidak dimasukkan kembali oleh orang yang menebak dari namanya.
 *
 * Ia menjaga tepat satu jalan baca — `GET /health/devices/observations/
 * pending-link` — dan pertanyaannya dijawab dengan membaca SQL-nya, bukan
 * namanya: kuerinya memilih kode, nilai, satuan, waktu, dan alatnya saja.
 * Tidak satu pun kolom identitas, sebab menurut definisinya antrean itu berisi
 * hasil yang BELUM berpasangan dengan pasien mana pun.
 *
 * Identitas baru muncul sesudah penautan, dan penautan dijaga ASSIGN, telaahnya
 * dijaga REVIEW — keduanya bukan READ.
 */

const UUID_PALSU = '00000000-0000-4000-8000-000000000000';

/* ---------------------------------------------------------------------------
 * Persona.
 *
 * `kerja` dan `ditolak` menyebut JALAN SUNGGUHAN yang dibaca dari controller.
 * Jalan berparameter dipakai hanya pada `ditolak`: penjaga hak akses berjalan
 * SEBELUM handler, jadi id palsu tetap menghasilkan 403 bila wewenangnya tidak
 * ada — dan bila ia menghasilkan 404, itu sendiri temuan, sebab berarti
 * barisnya dicari sebelum wewenangnya diperiksa.
 * ------------------------------------------------------------------------- */
const PERSONA = [
  {
    peran: 'HEALTH_REGISTRATION_CLERK',
    nama: 'Petugas pendaftaran',
    cerita: 'Membuka antrean pagi, mencari pasien, mendaftarkan kunjungan.',
    kerja: [['GET', '/health/queue'], ['GET', '/health/patients?q=a']],
    ditolak: [
      ['GET', '/health/him/coding/worklist', 'pendaftaran tidak mengoding diagnosis'],
      ['GET', '/health/fee/policies', 'pendaftaran tidak melihat kebijakan jasa'],
      ['GET', '/health/investor/projections', 'pendaftaran tidak melihat proyeksi investor'],
    ],
  },
  {
    peran: 'HEALTH_TRIAGE_NURSE',
    nama: 'Perawat triase',
    cerita: 'Menerima pasien gawat darurat dan menetapkan tingkat kegawatannya.',
    kerja: [['GET', '/health/acute/ed/board']],
    ditolak: [
      ['GET', '/health/acute/ot/schedule', 'triase bukan kamar operasi'],
      ['GET', '/health/pharmacy/prescriptions', 'triase tidak melihat resep'],
      ['POST', '/health/claims', 'triase tidak membuat klaim'],
    ],
  },
  {
    peran: 'HEALTH_DOCTOR',
    nama: 'Dokter',
    cerita: 'Memeriksa pasien, menulis catatan, meresepkan, memesan laboratorium.',
    kerja: [
      ['GET', '/health/patients?q=a'], ['GET', '/health/queue'],
      ['GET', '/health/lab/worklist'], ['GET', '/health/pharmacy/prescriptions'],
    ],
    ditolak: [
      ['GET', '/health/fee/policies', 'dokter tidak menetapkan persentase jasanya sendiri'],
      ['GET', '/health/investor/distributions', 'dokter tidak melihat distribusi investor'],
      ['GET', '/health/sample/runs', 'dokter tidak mengelola data contoh'],
    ],
  },
  {
    peran: 'HEALTH_NURSE',
    nama: 'Perawat',
    cerita: 'Memberi obat menurut eMAR, mencatat asuhan, melaporkan insiden.',
    kerja: [['GET', '/health/pharmacy/administrations'], ['GET', '/health/inpatient/board']],
    ditolak: [
      ['POST', '/health/him/records/check', 'perawat tidak mengoding rekam medis'],
      ['POST', '/health/pharmacy/prescriptions', 'perawat memberikan obat, tetapi tidak meresepkannya'],
      ['GET', '/health/fee-contract', 'perawat tidak melihat kontrak fee'],
      ['GET', '/health/device-maintenance/work-orders', 'perawat bukan teknisi biomedis'],
    ],
  },
  {
    peran: 'HEALTH_CODER',
    nama: 'Koder rekam medis',
    cerita: 'Mengoding diagnosis dan tindakan dari berkas rekam medis.',
    kerja: [['GET', '/health/him/coding/worklist'], ['GET', '/health/patients?q=a']],
    ditolak: [
      ['GET', '/health/him/incidents', 'koder tidak menelaah insiden keselamatan'],
      /* Koder MEMEGANG HEALTH_CLAIM.READ — ia perlu melihat klaim untuk
       * mengoding dengan benar. Yang tidak boleh adalah MEMBUAT klaim. Uji ini
       * memisahkan READ dari CREATE pada menu yang sama; membacanya sebagai
       * "koder tidak boleh menyentuh klaim" akan keliru. */
      ['POST', '/health/claims', 'koder membaca klaim untuk mengoding, tetapi tidak mengajukannya'],
      ['POST', '/health/him/legal-holds', 'koder tidak menahan berkas untuk perkara hukum'],
    ],
    /* Pemisahan wewenang yang paling sering diminta auditor. */
    hibahTerlarang: [['HEALTH_HIM_CODING', 'VERIFY', 'yang mengoding tidak boleh memverifikasi kodingnya sendiri']],
  },
  {
    peran: 'HEALTH_CODING_VERIFIER',
    nama: 'Verifikator koding',
    cerita: 'Memeriksa hasil koding orang lain sebelum klaim diajukan.',
    kerja: [['GET', '/health/him/coding/worklist']],
    ditolak: [['GET', '/health/claims', 'verifikator koding tidak mengajukan klaim']],
    hibahTerlarang: [['HEALTH_HIM_CODING', 'CREATE', 'yang memverifikasi tidak boleh membuat koding']],
  },
  {
    peran: 'HEALTH_CLAIM_OFFICER',
    nama: 'Petugas klaim',
    cerita: 'Menyusun berkas klaim dan mengajukannya ke penjamin.',
    kerja: [['GET', '/health/claims'], ['GET', '/health/bpjs/sep']],
    ditolak: [
      ['GET', '/health/fee/policies', 'petugas klaim tidak menetapkan jasa'],
      ['GET', '/health/investor/projections', 'petugas klaim tidak melihat proyeksi investor'],
    ],
  },
  {
    peran: 'HEALTH_PHARMACIST',
    nama: 'Apoteker',
    cerita: 'Menelaah resep dan menyerahkan obat. Ia tidak meresepkan, dan tidak memberikannya di bangsal.',
    kerja: [['GET', '/health/pharmacy/prescriptions']],
    ditolak: [
      /* Dua penolakan ini adalah batas profesi, bukan sekadar tata usaha.
       * Apoteker memegang HEALTH_PRESCRIPTION READ+REVIEW — bukan CREATE — dan
       * tidak memegang HEALTH_ADMINISTRATION sama sekali. */
      ['POST', '/health/pharmacy/prescriptions', 'apoteker menelaah resep, tetapi tidak menulisnya'],
      ['GET', '/health/pharmacy/administrations', 'pemberian obat di bangsal dicatat perawat, bukan apoteker'],
      ['GET', '/health/acute/ot/schedule', 'apoteker bukan kamar operasi'],
      ['GET', '/health/fee-contract', 'apoteker tidak melihat kontrak fee'],
    ],
  },
  {
    peran: 'HEALTH_LAB_ANALYST',
    nama: 'Analis laboratorium',
    cerita: 'Mengerjakan pemeriksaan dan melaporkan hasil kritis.',
    kerja: [['GET', '/health/lab/worklist'], ['GET', '/health/lab/critical']],
    ditolak: [
      ['GET', '/health/pharmacy/prescriptions', 'analis lab tidak melihat resep'],
      ['GET', '/health/him/coding/worklist', 'analis lab tidak mengoding'],
    ],
  },
  {
    peran: 'HEALTH_PHC_OFFICER',
    nama: 'Petugas puskesmas',
    cerita: 'Kunjungan rumah, penimbangan balita, imunisasi, cakupan program.',
    kerja: [['GET', '/health/community/home-visits/worklist'], ['GET', '/health/community/coverage']],
    ditolak: [
      ['GET', '/health/acute/icu/board', 'puskesmas bukan ICU'],
      ['GET', '/health/fee/policies', 'puskesmas tidak menetapkan jasa'],
    ],
  },
  {
    peran: 'HEALTH_CADRE',
    nama: 'Kader posyandu',
    cerita: 'Mencatat penimbangan balita di posyandu. Bukan tenaga kesehatan berizin.',
    kerja: [['GET', '/health/community/home-visits/worklist']],
    ditolak: [
      /* Yang paling penting di sini. Kader memegang HEALTH_IMMUNIZATION.READ
       * supaya dapat memberitahu ibu kapan giliran anaknya — tetapi TIDAK
       * memegang CREATE. Kader tidak menyuntik. */
      ['POST', '/health/community/immunization', 'kader memberitahu jadwal imunisasi, tetapi tidak menyuntikkannya'],
      /* Kader memegang HEALTH_SAFETY.CREATE tanpa READ: ia dapat melaporkan
       * insiden, tetapi tidak menelusuri laporan orang lain. */
      ['GET', '/health/him/incidents', 'kader melaporkan insiden, tetapi tidak membaca register insiden'],
      ['GET', '/health/patients?q=a', 'kader tidak membuka indeks pasien fasilitas'],
      ['GET', '/health/pharmacy/prescriptions', 'kader tidak melihat resep'],
      ['GET', '/health/lab/worklist', 'kader tidak melihat hasil laboratorium'],
      ['GET', '/health/him/coding/worklist', 'kader tidak mengoding'],
    ],
  },
  {
    peran: 'HEALTH_CONTRACT_DRAFTER',
    nama: 'Penyusun kontrak fee',
    cerita: 'Menyusun rancangan kontrak bagi hasil dengan investor.',
    kerja: [['GET', '/health/fee-contract']],
    ditolak: [['GET', '/health/patients?q=a', 'urusan kontrak tidak menyentuh data pasien']],
    hibahTerlarang: [
      ['HEALTH_FEE_CONTRACT', 'APPROVE', 'yang menyusun kontrak tidak boleh menyetujuinya'],
      ['HEALTH_FEE_CONTRACT', 'ACTIVATE', 'yang menyusun kontrak tidak boleh mengaktifkannya'],
    ],
  },
  {
    peran: 'HEALTH_CONTRACT_APPROVER',
    nama: 'Penyetuju kontrak fee',
    cerita: 'Menyetujui dan mengaktifkan kontrak yang disusun orang lain.',
    kerja: [['GET', '/health/fee-contract']],
    ditolak: [['GET', '/health/patients?q=a', 'urusan kontrak tidak menyentuh data pasien']],
    hibahTerlarang: [['HEALTH_FEE_CONTRACT', 'CREATE', 'yang menyetujui tidak boleh menyusun kontraknya sendiri']],
  },
  {
    peran: 'HEALTH_SETTLEMENT_CLERK',
    nama: 'Petugas kalkulasi jasa',
    cerita: 'Menghitung jasa yang jatuh kepada tiap pemberi layanan.',
    kerja: [['GET', '/health/fee/policies'], ['GET', '/health/fee/contributors']],
    ditolak: [['GET', '/health/patients?q=a', 'kalkulasi jasa tidak menuntut data pasien']],
    hibahTerlarang: [['HEALTH_FEE_SETTLEMENT', 'POST', 'yang menghitung jasa tidak boleh membayarkannya']],
  },
  {
    peran: 'HEALTH_SETTLEMENT_PAYER',
    nama: 'Petugas pembayaran jasa',
    cerita: 'Membayarkan jasa yang sudah dihitung orang lain.',
    kerja: [['GET', '/health/investor/distributions']],
    ditolak: [['GET', '/health/patients?q=a', 'pembayaran jasa tidak menuntut data pasien']],
    hibahTerlarang: [['HEALTH_FEE_SETTLEMENT', 'CREATE', 'yang membayar tidak boleh menghitung sendiri yang dibayarnya']],
  },
  {
    peran: 'HEALTH_FEE_ADMINISTRATOR',
    nama: 'Petugas kebijakan jasa',
    cerita: 'Menyusun kebijakan persentase jasa pelayanan.',
    kerja: [['GET', '/health/fee/policies']],
    ditolak: [['GET', '/health/patients?q=a', 'kebijakan jasa tidak menuntut data pasien']],
    hibahTerlarang: [['HEALTH_FEE_POLICY', 'APPROVE', 'yang menyusun kebijakan jasa tidak boleh menyetujuinya']],
  },
  {
    peran: 'HEALTH_INVESTOR_VIEWER',
    nama: 'Pemegang kontrak investor',
    cerita: 'Melihat kinerja investasinya. Aturan R2: tidak pernah melihat data pasien.',
    kerja: [['GET', '/health/investor/projections'], ['GET', '/health/fee-contract/investor-summary']],
    ditolak: [
      ['GET', '/health/patients?q=a', 'ATURAN MUTLAK R2 — investor tidak pernah melihat data pasien'],
      ['GET', '/health/queue', 'antrean menyebut nama pasien'],
      ['GET', '/health/lab/critical', 'hasil kritis adalah data klinis'],
      ['GET', '/health/pharmacy/prescriptions', 'resep adalah data klinis'],
      ['GET', '/health/him/coding/worklist', 'koding memuat diagnosis'],
      ['GET', '/health/acute/ed/board', 'papan gawat darurat menyebut pasien'],
      ['GET', '/health/acute/icu/board', 'papan ICU menyebut pasien'],
      ['GET', '/health/inpatient/board', 'papan rawat inap menyebut pasien'],
      ['GET', '/health/bpjs/sep', 'SEP memuat identitas peserta'],
      ['GET', '/health/community/home-visits/worklist', 'kunjungan rumah memuat alamat pasien'],
      ['GET', `/health/patients/${UUID_PALSU}`, 'jalan berparameter pun harus tertutup'],
    ],
  },
  {
    peran: 'HEALTH_BIOMEDICAL_ENGINEER',
    nama: 'Teknisi biomedis',
    cerita: 'Memelihara alat medis, mengerjakan perintah kerja, uji keselamatan.',
    kerja: [['GET', '/health/device-maintenance/work-orders'], ['GET', '/health/devices']],
    ditolak: [
      ['GET', '/health/patients?q=a', 'teknisi alat tidak membuka data pasien'],
      ['GET', '/health/lab/critical', 'teknisi alat tidak melihat hasil pasien'],
    ],
  },
  {
    peran: 'HEALTH_LEGAL_OFFICER',
    nama: 'Petugas hukum',
    cerita: 'Menahan berkas untuk perkara hukum, melayani permintaan informasi.',
    kerja: [['GET', '/health/patients?q=a']],
    ditolak: [
      ['GET', '/health/fee/policies', 'urusan hukum tidak menetapkan jasa'],
      ['POST', '/health/claims', 'urusan hukum tidak mengajukan klaim'],
    ],
  },
  {
    peran: 'HEALTH_PATIENT_SAFETY_OFFICER',
    nama: 'Petugas keselamatan pasien',
    cerita: 'Menelaah insiden keselamatan dan menindaklanjutinya.',
    kerja: [['GET', '/health/him/incidents']],
    ditolak: [
      ['GET', '/health/fee-contract', 'keselamatan pasien tidak melihat kontrak fee'],
      ['GET', '/health/claims', 'keselamatan pasien tidak menangani klaim'],
    ],
  },
  {
    peran: 'HEALTH_WEB_EDITOR',
    nama: 'Pengelola website fasilitas',
    cerita: 'Menyunting konten publik. Sama sekali di luar wilayah klinis.',
    kerja: [],
    ditolak: [
      ['GET', '/health/patients?q=a', 'pengelola website tidak membuka data pasien'],
      ['GET', '/health/queue', 'pengelola website tidak melihat antrean'],
      ['GET', '/health/claims', 'pengelola website tidak melihat klaim'],
      ['GET', '/health/fee/policies', 'pengelola website tidak melihat kebijakan jasa'],
      ['GET', '/health/lab/worklist', 'pengelola website tidak melihat laboratorium'],
    ],
  },

  /* --- Kamar operasi ---------------------------------------------------- */
  {
    peran: 'HEALTH_SURGEON',
    nama: 'Dokter bedah',
    cerita: 'Menjadwalkan operasi, menandai sisi sayatan, mengoperasi.',
    kerja: [['GET', '/health/acute/ot/schedule'], ['GET', '/health/patients?q=a']],
    ditolak: [
      ['GET', '/health/pharmacy/administrations', 'pemberian obat di bangsal bukan wewenang bedah'],
      ['GET', '/health/fee/policies', 'dokter bedah tidak menetapkan persentase jasanya sendiri'],
    ],
    /*
     * Inti daftar periksa keselamatan WHO. Yang mencentang bahwa persiapan
     * sudah benar TIDAK BOLEH orang yang paling dirugikan bila operasinya
     * tertunda. Karena itu INCISE dan CHECKLIST dipegang dua orang berbeda.
     */
    hibahTerlarang: [['HEALTH_SURGERY', 'CHECKLIST', 'yang menyayat tidak mencentang daftar periksa keselamatannya sendiri']],
  },
  {
    peran: 'HEALTH_SCRUB_NURSE',
    nama: 'Perawat instrumen',
    cerita: 'Mencentang daftar periksa keselamatan dan menghitung kasa.',
    kerja: [['GET', '/health/acute/ot/checklist-items'], ['GET', '/health/acute/ot/schedule']],
    ditolak: [['GET', '/health/fee/policies', 'perawat instrumen tidak menetapkan kebijakan jasa']],
    hibahTerlarang: [
      ['HEALTH_SURGERY', 'INCISE', 'yang mencentang daftar periksa bukan yang menyayat'],
      ['HEALTH_SURGERY', 'CREATE', 'perawat instrumen tidak menjadwalkan operasi'],
    ],
  },
  {
    peran: 'HEALTH_INTENSIVIST',
    nama: 'Dokter intensif',
    cerita: 'Mengelola papan ICU dan menilai skor perawatan intensif.',
    kerja: [['GET', '/health/acute/icu/board'], ['GET', '/health/inpatient/board']],
    ditolak: [
      ['GET', '/health/acute/ot/schedule', 'ICU bukan kamar operasi'],
      ['GET', '/health/claims', 'dokter intensif tidak menangani klaim'],
    ],
  },

  /* --- Penunjang -------------------------------------------------------- */
  {
    peran: 'HEALTH_RADIOGRAPHER',
    nama: 'Radiografer',
    cerita: 'Mengerjakan pemeriksaan radiologi dan memasukkan hasilnya.',
    kerja: [['GET', '/health/lab/worklist'], ['GET', '/health/patients?q=a']],
    ditolak: [['GET', '/health/pharmacy/prescriptions', 'radiografer tidak melihat resep']],
    hibahTerlarang: [['HEALTH_LAB_RESULT', 'VERIFY_RESULT', 'yang memasukkan hasil tidak memverifikasi hasilnya sendiri']],
  },
  {
    peran: 'HEALTH_LAB_SUPERVISOR',
    nama: 'Penanggung jawab laboratorium',
    cerita: 'Memverifikasi hasil, melaporkan nilai kritis, menelaah hasil alat.',
    kerja: [['GET', '/health/lab/critical'], ['GET', '/health/devices/observations/pending-link']],
    ditolak: [['GET', '/health/fee/policies', 'penanggung jawab lab tidak menetapkan jasa']],
    hibahTerlarang: [['HEALTH_LAB_RESULT', 'CREATE', 'yang memverifikasi hasil tidak memasukkannya sendiri']],
  },
  {
    peran: 'HEALTH_NUTRITIONIST',
    nama: 'Tenaga gizi',
    cerita: 'Memantau pertumbuhan dan status gizi, terutama balita.',
    kerja: [['GET', '/health/community/coverage'], ['GET', '/health/community/home-visits/worklist']],
    ditolak: [
      ['POST', '/health/community/immunization', 'tenaga gizi tidak mengimunisasi'],
      ['GET', '/health/pharmacy/prescriptions', 'tenaga gizi tidak melihat resep'],
    ],
  },
  {
    peran: 'HEALTH_WARD_CLERK',
    nama: 'Petugas bangsal',
    cerita: 'Mengurus ketersediaan tempat tidur dan perpindahan pasien.',
    kerja: [['GET', '/health/inpatient/beds'], ['GET', '/health/inpatient/board']],
    ditolak: [
      ['POST', '/health/inpatient/admissions', 'petugas bangsal mengatur tempat tidur, tetapi tidak memutuskan rawat inap'],
      ['GET', '/health/patients?q=a', 'petugas bangsal tidak membuka indeks pasien'],
    ],
  },

  /* --- Farmasi ---------------------------------------------------------- */
  {
    peran: 'HEALTH_PHARMACY_TECHNICIAN',
    nama: 'Tenaga teknis kefarmasian',
    cerita: 'Menyiapkan dan menyerahkan obat menurut resep yang sudah ditelaah.',
    kerja: [['GET', '/health/pharmacy/prescriptions']],
    ditolak: [['POST', '/health/pharmacy/prescriptions', 'tenaga teknis tidak menulis resep']],
    hibahTerlarang: [['HEALTH_PRESCRIPTION', 'REVIEW', 'telaah resep wewenang apoteker, bukan tenaga teknis']],
  },
  {
    peran: 'HEALTH_PHARMACY_MANAGER',
    nama: 'Penanggung jawab farmasi',
    cerita: 'Menyetujui terminologi obat dan pemetaan KFA.',
    kerja: [['GET', '/health/terminology/catalog']],
    ditolak: [
      ['GET', '/health/pharmacy/prescriptions', 'penanggung jawab farmasi mengurus terminologi, bukan resep perorangan'],
      ['GET', '/health/patients?q=a', 'urusan terminologi tidak menyentuh data pasien'],
    ],
    hibahTerlarang: [['HEALTH_TERMINOLOGY', 'IMPORT', 'yang menyetujui impor terminologi tidak mengimpornya sendiri']],
  },

  /* --- Klaim, keuangan, tarif ------------------------------------------- */
  {
    peran: 'HEALTH_CLAIM_VERIFIER',
    nama: 'Verifikator klaim internal',
    cerita: 'Memeriksa klaim yang disusun petugas klaim sebelum diajukan.',
    kerja: [['GET', '/health/claims'], ['GET', '/health/bpjs/sep']],
    ditolak: [['GET', '/health/fee/policies', 'verifikator klaim tidak menetapkan jasa']],
    hibahTerlarang: [['HEALTH_CLAIM', 'CREATE', 'yang memverifikasi klaim tidak menyusunnya sendiri']],
  },
  {
    peran: 'HEALTH_FINANCE_OFFICER',
    nama: 'Petugas keuangan rumah sakit',
    cerita: 'Memetakan akuntansi, merekonsiliasi klaim, menutup periode.',
    kerja: [['GET', '/health/accounting/coa-template'], ['GET', '/health/claims']],
    ditolak: [['GET', '/health/patients?q=a', 'urusan keuangan tidak menuntut data pasien']],
    hibahTerlarang: [
      ['HEALTH_FEE_SETTLEMENT', 'POST', 'yang membalik pembayaran jasa tidak membayarkannya'],
      ['HEALTH_FEE_SETTLEMENT', 'APPROVE', 'yang membalik pembayaran jasa tidak menyetujuinya'],
    ],
  },
  {
    peran: 'HEALTH_FEE_APPROVER',
    nama: 'Penyetuju kebijakan jasa',
    cerita: 'Menyetujui dan mengaktifkan kebijakan jasa yang disusun orang lain.',
    kerja: [['GET', '/health/fee/policies']],
    ditolak: [['GET', '/health/patients?q=a', 'kebijakan jasa tidak menuntut data pasien']],
    hibahTerlarang: [['HEALTH_FEE_POLICY', 'CREATE', 'yang menyetujui kebijakan jasa tidak menyusunnya sendiri']],
  },
  {
    peran: 'HEALTH_TARIFF_OFFICER',
    nama: 'Petugas tarif',
    cerita: 'Mengimpor regulasi tarif dan memelihara data penjamin.',
    kerja: [['GET', '/health/tariff/versions'], ['GET', '/health/tariff/regulations']],
    ditolak: [['GET', '/health/patients?q=a', 'urusan tarif tidak menyentuh data pasien']],
    hibahTerlarang: [
      ['HEALTH_TARIFF', 'APPROVE', 'yang mengimpor tarif tidak menyetujuinya'],
      ['HEALTH_TARIFF', 'ACTIVATE', 'yang mengimpor tarif tidak mengaktifkannya'],
    ],
  },
  {
    peran: 'HEALTH_SERVICE_CATALOGUER',
    nama: 'Petugas katalog layanan',
    cerita: 'Menyusun katalog layanan dan pemetaan kodenya.',
    kerja: [['GET', '/health/master-data/services'], ['GET', '/health/master-data/code-mappings']],
    ditolak: [['GET', '/health/patients?q=a', 'katalog layanan tidak menyentuh data pasien']],
    hibahTerlarang: [['HEALTH_SERVICE_CATALOG', 'ACTIVATE', 'yang menyusun katalog layanan tidak mengaktifkannya']],
  },

  /* --- Mutu, rekam medis, interoperabilitas ----------------------------- */
  {
    peran: 'HEALTH_QUALITY_MANAGER',
    nama: 'Manajer mutu',
    cerita: 'Mengukur indikator mutu, menelaah insiden, menyetujui akses darurat.',
    kerja: [['GET', '/health/him/quality/dashboard'], ['GET', '/health/him/incidents']],
    ditolak: [
      /* Manajer mutu MENYETUJUI break-glass tanpa memegang HEALTH_PATIENT.
       * Ia menelaah apakah aksesnya patut, bukan isi rekamnya. */
      ['GET', '/health/patients?q=a', 'penelaah akses darurat tidak perlu membaca rekam yang diaksesnya'],
      ['GET', '/health/fee/policies', 'manajer mutu tidak menetapkan jasa'],
    ],
  },
  {
    peran: 'HEALTH_MEDICAL_RECORD_OFFICER',
    nama: 'Petugas rekam medis',
    cerita: 'Menggabungkan pasien ganda, melayani pelepasan informasi, menelaah jejak akses.',
    kerja: [['GET', '/health/patients/duplicates/open'], ['GET', '/health/patients?q=a']],
    ditolak: [
      ['GET', '/health/fee/policies', 'rekam medis tidak menetapkan jasa'],
      ['POST', '/health/claims', 'rekam medis tidak mengajukan klaim'],
    ],
  },
  {
    peran: 'HEALTH_INTEROP_OFFICER',
    nama: 'Petugas interoperabilitas',
    cerita: 'Mengurus kemampuan SATUSEHAT dan verifikasi sambungan BPJS.',
    kerja: [['GET', '/health/satusehat/capabilities'], ['GET', '/health/satusehat/catalog']],
    ditolak: [
      ['GET', '/health/patients?q=a', 'petugas interoperabilitas mengurus sambungan, bukan isi rekam'],
      ['POST', '/health/bpjs/accounts', 'ia memverifikasi sambungan, tetapi tidak memegang kredensialnya'],
    ],
  },

  /* --- Alat medis ------------------------------------------------------- */
  {
    peran: 'HEALTH_DEVICE_INBOX_CLERK',
    nama: 'Petugas hasil alat',
    cerita: 'Menautkan hasil alat yang belum berpasangan ke pasien yang benar.',
    kerja: [['GET', '/health/devices/observations/pending-link'], ['GET', '/health/patients?q=a']],
    ditolak: [['GET', '/health/device-maintenance/work-orders', 'petugas hasil alat bukan teknisi']],
    hibahTerlarang: [['HEALTH_DEVICE_INBOX', 'REVIEW', 'yang menautkan hasil tidak menelaah tautannya sendiri']],
  },
  {
    peran: 'HEALTH_DEVICE_SECURITY_ANALYST',
    nama: 'Analis keamanan alat medis',
    cerita: 'Menilai risiko keamanan alat dan mencatat insiden keamanannya.',
    kerja: [['GET', '/health/device-maintenance/security-incidents'], ['GET', '/health/device-maintenance/risk']],
    ditolak: [['GET', '/health/patients?q=a', 'analis keamanan alat tidak membuka data pasien']],
    hibahTerlarang: [['HEALTH_DEVICE_SECURITY', 'APPROVE', 'yang menilai risiko alat tidak menyetujui penilaiannya sendiri']],
  },

  /* --- Investor dan pimpinan -------------------------------------------- */
  {
    peran: 'HEALTH_INVESTOR_ANALYST',
    nama: 'Analis investasi rumah sakit',
    cerita: 'Menyusun proyeksi dan waterfall bagi hasil.',
    kerja: [['GET', '/health/investor/projections'], ['GET', '/health/investor/distributions']],
    ditolak: [
      ['GET', '/health/patients?q=a', 'ATURAN MUTLAK R2 — investor tidak pernah melihat data pasien'],
      ['GET', '/health/queue', 'antrean menyebut nama pasien'],
      ['GET', '/health/him/coding/worklist', 'koding memuat diagnosis'],
    ],
    hibahTerlarang: [['HEALTH_INVESTOR_DISTRIBUTION', 'POST', 'yang menyusun distribusi tidak membayarkannya']],
  },
  {
    peran: 'HEALTH_DIRECTOR',
    nama: 'Direktur / kepala fasilitas',
    cerita: 'Mengawasi arus pelayanan, mutu, dan keuangan. Ia mengawasi, bukan merawat.',
    kerja: [['GET', '/health/him/quality/dashboard'], ['GET', '/health/inpatient/board'], ['GET', '/health/claims']],
    ditolak: [
      /* Temuan rancangan yang paling patut diperhatikan: direktur melihat
       * PAPAN — arus pasien — tetapi tidak memegang HEALTH_PATIENT, sehingga
       * indeks pasien dan rekamnya tertutup baginya. Pengawasan tidak menuntut
       * membaca rekam siapa pun. */
      ['GET', '/health/patients?q=a', 'jabatan tinggi bukan alasan klinis untuk membuka rekam pasien'],
      ['GET', '/health/pharmacy/prescriptions', 'direktur tidak membaca resep perorangan'],
      ['POST', '/health/claims', 'direktur tidak mengajukan klaim'],
    ],
  },
  {
    peran: 'HEALTH_ADMIN',
    nama: 'Administrator eMedik',
    cerita: 'Menyiapkan fasilitas, unit, alat, dan sambungan. Ia mengurus sistem, bukan pasien.',
    kerja: [['GET', '/health/sample/catalog'], ['GET', '/health/devices'], ['GET', '/health/master-data/samples']],
    ditolak: [
      /* Aturan yang paling sering dilanggar sistem informasi rumah sakit:
       * administrator diberi "akses penuh" demi kemudahan, lalu seluruh rekam
       * pasien terbuka bagi orang yang tidak pernah merawat siapa pun. */
      ['GET', '/health/patients?q=a', 'administrator sistem bukan tenaga kesehatan'],
      ['GET', '/health/pharmacy/prescriptions', 'administrator tidak membaca resep'],
      ['GET', '/health/lab/critical', 'administrator tidak membaca hasil laboratorium'],
      ['GET', '/health/him/coding/worklist', 'administrator tidak membaca diagnosis'],
    ],
  },
];

/* ------------------------------------------------------------------------- */

await client.connect();
const dibuat = [];

async function buatPersona(kodePeran, tenantId) {
  const tag = randomBytes(4).toString('hex');
  const username = `uat_${kodePeran.toLowerCase()}_${tag}`;
  const password = `Uat-${randomBytes(9).toString('base64url')}!7`;
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const pid = randomUUID();

  await q(
    `INSERT INTO platform.platform_user
       (id, username, normalized_username, email, display_name, password_hash,
        status, must_change_password, is_platform_staff, created_at, updated_at)
     VALUES ($1,$2::varchar,lower($2::varchar),$3,$4,$5,'ACTIVE',FALSE,FALSE,now(),now())`,
    [pid, username, `${username}@contoh.invalid`, `UAT ${kodePeran}`, hash],
  );
  await q(
    `INSERT INTO platform.tenant_membership (id, tenant_id, platform_user_id, is_owner, status, created_at, updated_at)
     VALUES (gen_random_uuid(),$1,$2,FALSE,'ACTIVE',now(),now())`,
    [tenantId, pid],
  );
  const subjectId = (
    await q(
      `INSERT INTO "${SCHEMA}".user_subject (platform_user_id, code, name, username_snapshot, is_owner, status)
       VALUES ($1,$2::varchar,$3,$2::varchar,FALSE,'ACTIVE') RETURNING id`,
      [pid, username, `UAT ${kodePeran}`],
    )
  )[0].id;

  /* Peran yang TERSEMAI dipakai apa adanya. Membuat peran sintetis di sini
   * akan menguji naskah ini terhadap dirinya sendiri, bukan terhadap apa yang
   * sebenarnya diterima orang pada pemasangan sungguhan. */
  const peran = (await q(`SELECT id FROM "${SCHEMA}".role WHERE code = $1 AND deleted_at IS NULL`, [kodePeran]))[0];
  dibuat.push({ pid, subjectId, username });
  if (!peran) return { galat: `peran ${kodePeran} tidak tersemai pada skema ${SCHEMA}` };
  await q(
    `INSERT INTO "${SCHEMA}".user_role_assignment (user_subject_id, role_id, valid_from) VALUES ($1,$2,CURRENT_DATE)`,
    [subjectId, peran.id],
  );

  /*
   * `/auth/login` dibatasi 10 percobaan per 60 detik — dan batas itu terkunci
   * pada dekorator `auth.controller.ts`, sehingga `THROTTLE_AUTH_LIMIT` pada
   * `.env` tidak mengubahnya.
   *
   * Pembatas itu BENAR: ia yang menahan penebakan sandi. Yang keliru adalah
   * UAT yang masuk dua puluh kali lalu melaporkan "peran tidak ada". Jadi
   * naskah ini menunggu jendelanya berganti, dan MENGATAKAN bahwa ia menunggu.
   */
  for (let percobaan = 1; percobaan <= 4; percobaan += 1) {
    const masuk = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (masuk.status === 429) {
      log(`    ... batas laju login tercapai; menunggu 61 detik (percobaan ${percobaan}/4)`);
      await new Promise((r) => setTimeout(r, 61_000));
      continue;
    }
    const badan = await masuk.json().catch(() => ({}));
    const sesi = badan?.data;
    if (!sesi?.accessToken) return { galat: `login dijawab ${masuk.status} ${badan?.error?.code ?? ''}`.trim() };
    return { token: sesi.accessToken, username };
  }
  return { galat: 'batas laju login tidak reda sesudah 4 percobaan' };
}

try {
  log('='.repeat(78));
  log('UAT PERSONA eMEDIK — TIAP PERAN DIJALANKAN SEBAGAI ORANG SUNGGUHAN');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Peladen : ${BASE}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q('SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1', [SCHEMA])
  )[0].id;
  const fasilitas = (await q(`SELECT id::text FROM "${SCHEMA}".health_facility ORDER BY created_at LIMIT 1`))[0]?.id;
  if (!fasilitas) throw new Error('Tidak ada fasilitas kesehatan pada skema ini.');

  const hibah = new Map();
  for (const r of await q(
    `SELECT r.code AS peran, m.code AS menu, a.code AS aksi
       FROM "${SCHEMA}".role r
       JOIN "${SCHEMA}".role_menu_permission p ON p.role_id = r.id
       JOIN "${SCHEMA}".menu m ON m.id = p.menu_id
       JOIN "${SCHEMA}".permission_action a ON a.id = p.permission_action_id
      WHERE r.code LIKE 'HEALTH%' AND r.deleted_at IS NULL AND p.effect = 'ALLOW'`,
  )) {
    if (!hibah.has(r.peran)) hibah.set(r.peran, new Set());
    hibah.get(r.peran).add(`${r.menu}.${r.aksi}`);
  }

  /* === BAGIAN 1 — PERSONA ============================================== */
  for (const p of PERSONA) {
    log('');
    log('-'.repeat(78));
    log(`${p.nama}  [${p.peran}]`);
    log(`  ${p.cerita}`);

    const sesi = await buatPersona(p.peran, tenantId);
    if (sesi.galat) {
      nilai(`masuk sebagai ${p.peran}`, false, sesi.galat);
      continue;
    }
    const H = {
      authorization: `Bearer ${sesi.token}`,
      'x-purpose-of-use': 'TREATMENT',
      'x-facility-id': fasilitas,
      'content-type': 'application/json',
    };
    const panggil = async (metode, jalan) => {
      const r = await fetch(`${BASE}${jalan}`, {
        method: metode,
        headers: H,
        body: metode === 'GET' ? undefined : '{}',
      });
      return r.status;
    };

    if (p.kerja.length) log('  Yang dilakukannya:');
    for (const [metode, jalan] of p.kerja) {
      const s = await panggil(metode, jalan);
      nilai(`${metode} ${jalan}`, s !== 403 && s !== 401, `dijawab ${s}, seharusnya tidak ditolak`);
    }

    log('  Yang harus DITOLAK sistem:');
    for (const [metode, jalan, sebab] of p.ditolak) {
      const s = await panggil(metode, jalan);
      nilai(`${metode} ${jalan} — ${sebab}`, s === 403, `dijawab ${s}, seharusnya 403`);
    }

    /* Hibah terlarang: pemisahan wewenang yang tidak dapat dilihat dari satu
     * panggilan HTTP, sebab ia tentang apa yang TIDAK ada pada tabel hibah. */
    if (p.hibahTerlarang) {
      log('  Hak yang tidak boleh dipegangnya:');
      const punya = hibah.get(p.peran) ?? new Set();
      for (const [menu, aksi, sebab] of p.hibahTerlarang) {
        nilai(`${p.peran} tidak memegang ${menu}.${aksi} — ${sebab}`, !punya.has(`${menu}.${aksi}`), 'hak itu tersemai');
      }
    }
  }

  /* === BAGIAN 2 — PENYAMARAN IDENTITAS PENGHUNI TEMPAT TIDUR =========== */
  log('');
  log('='.repeat(78));
  log('DAFTAR TEMPAT TIDUR — IDENTITAS PENGHUNI');
  log('Diperiksa pada fasilitas yang tempat tidurnya BENAR-BENAR TERISI.');
  log('Nol baris bukan bukti keamanan; ia hanya berarti tidak ada yang dilihat.');
  log('='.repeat(78));

  const fasilitasTerisi = (
    await q(`SELECT u.facility_id::text AS id
               FROM "${SCHEMA}".health_bed_assignment asg
               JOIN "${SCHEMA}".health_bed b ON b.id = asg.bed_id
               JOIN "${SCHEMA}".health_room r ON r.id = b.room_id
               JOIN "${SCHEMA}".health_service_unit u ON u.id = r.service_unit_id
              WHERE asg.released_at IS NULL LIMIT 1`)
  )[0]?.id;

  if (!fasilitasTerisi) {
    nilai('ada tempat tidur terisi untuk diperiksa', false, 'tidak ada; penyamaran TIDAK terbukti');
  } else {
    for (const [kodePeran, harusTerlihat, sebab] of [
      ['HEALTH_ADMIN', false, 'administrator ditolak indeks pasien, jadi ia tidak boleh memperolehnya lewat tempat tidur'],
      ['HEALTH_NURSE', true, 'perawat memegang HEALTH_ADMISSION.READ dan memang merawat penghuninya'],
    ]) {
      const s = await buatPersona(kodePeran, tenantId);
      if (s.galat) {
        nilai(`masuk sebagai ${kodePeran}`, false, s.galat);
        continue;
      }
      const r = await fetch(`${BASE}/health/inpatient/beds?facilityId=${fasilitasTerisi}`, {
        headers: { authorization: `Bearer ${s.token}`, 'x-facility-id': fasilitasTerisi },
      });
      const baris = (await r.json().catch(() => ({})))?.data ?? [];
      const bernama = baris.filter((x) => x.patient_name);
      nilai(
        `${kodePeran}: daftar tempat tidur terjawab (${baris.length} baris)`,
        r.status === 200 && baris.length > 0,
        `status ${r.status}, ${baris.length} baris`,
      );
      nilai(
        harusTerlihat
          ? `${kodePeran} MELIHAT nama penghuni — ${sebab}`
          : `${kodePeran} TIDAK melihat nama penghuni — ${sebab}`,
        harusTerlihat ? bernama.length > 0 : bernama.length === 0,
        harusTerlihat ? 'tidak ada nama yang terlihat' : `bocor: ${bernama.map((x) => x.patient_name).join(', ')}`,
      );
    }
  }

  /* === BAGIAN 3 — ATURAN MUTLAK: SIAPA YANG TIDAK PERNAH KE DATA PASIEN = */
  log('');
  log('='.repeat(78));
  log('ATURAN MUTLAK — PERAN NON-KLINIS TIDAK MEMEGANG SATU PUN HAK DATA PASIEN');
  log('Disapu atas SELURUH menu berdata pasien, bukan hanya yang kebetulan');
  log('diuji persona di atas. Satu hak yang lolos di sini membuka seluruh');
  log('rekam bagi orang yang tidak pernah merawat siapa pun.');
  log('='.repeat(78));

  /*
   * Pemilihan peran di bawah adalah PERNYATAAN KEBIJAKAN, bukan turunan dari
   * basis data — sama seperti MENU_DATA_PASIEN. Menurunkannya dari yang
   * tersemai akan membuatnya menyetujui apa pun yang tersemai.
   *
   * HEALTH_DIRECTOR sengaja TIDAK di sini: ia memegang papan ICU, gawat
   * darurat, dan rawat inap supaya dapat mengawasi arus pelayanan. Itu
   * keputusan sadar, dan persona direkturlah yang memeriksa batasnya.
   */
  const NON_KLINIS = [
    ...[...hibah.keys()].filter((k) => k.includes('INVESTOR')),
    'HEALTH_ADMIN',
    'HEALTH_WEB_EDITOR',
    'HEALTH_TARIFF_OFFICER',
    'HEALTH_FEE_ADMINISTRATOR',
    'HEALTH_FEE_APPROVER',
    'HEALTH_CONTRACT_DRAFTER',
    'HEALTH_CONTRACT_APPROVER',
    'HEALTH_SETTLEMENT_CLERK',
    'HEALTH_SETTLEMENT_PAYER',
    'HEALTH_SERVICE_CATALOGUER',
    'HEALTH_INTEROP_OFFICER',
    'HEALTH_DEVICE_SECURITY_ANALYST',
    'HEALTH_BIOMEDICAL_ENGINEER',
    'HEALTH_PHARMACY_MANAGER',
  ];
  for (const kode of NON_KLINIS) {
    const punya = [...(hibah.get(kode) ?? [])];
    if (!punya.length) {
      nilai(`${kode} ada pada skema ini`, false, 'peran tidak tersemai');
      continue;
    }
    const bocor = punya.filter((h) => MENU_DATA_PASIEN.includes(h.split('.')[0]));
    nilai(`${kode} tidak memegang satu pun hak berdata pasien`, bocor.length === 0, bocor.join(', '));
  }

  /* === BAGIAN 4 — PERAN YANG TIDAK DIUJI PERSONA ======================= */
  log('');
  log('='.repeat(78));
  log('PERAN YANG BELUM DIUJI PERSONA');
  log('='.repeat(78));
  const diuji = new Set(PERSONA.map((p) => p.peran));
  const semua = (await q(`SELECT code FROM "${SCHEMA}".role WHERE code LIKE 'HEALTH%' AND deleted_at IS NULL ORDER BY code`)).map((r) => r.code);
  const belum = semua.filter((c) => !diuji.has(c));
  log(`  tersemai ${semua.length} peran; diuji persona ${diuji.size}; belum ${belum.length}`);
  for (const c of belum) log(`    ${c}`);
  log('');
  log('  Angka ini BUKAN kelulusan. Ia daftar yang masih harus ditulis persona-');
  log('  nya. Menghapusnya dari laporan akan membuat cakupan separuh tampak penuh.');

  /* === RINGKASAN ======================================================= */
  log('');
  log('='.repeat(78));
  log(`RINGKASAN — lulus ${lulus}, gagal ${gagal}`);
  log(`Cakupan persona: ${diuji.size}/${semua.length} peran; ${belum.length} belum berpersona.`);
  if (temuan.length) {
    log('');
    log('TEMUAN:');
    for (const t of temuan) log(`  - ${t}`);
  }
  log('='.repeat(78));
} finally {
  /* Pengguna UAT dibersihkan. Peran yang tersemai TIDAK disentuh — naskah ini
   * memakai peran sungguhan, dan menghapusnya akan merusak pemasangan. */
  for (const d of dibuat) {
    await q(`DELETE FROM "${SCHEMA}".user_role_assignment WHERE user_subject_id = $1`, [d.subjectId]).catch(() => {});
    await q(`DELETE FROM "${SCHEMA}".user_subject WHERE id = $1`, [d.subjectId]).catch(() => {});
    await q('DELETE FROM platform.tenant_membership WHERE platform_user_id = $1', [d.pid]).catch(() => {});
    await q('DELETE FROM platform.platform_user WHERE id = $1', [d.pid]).catch(() => {});
  }
  writeFileSync(new URL('../../../docs/emedik/bukti-uat-persona.txt', import.meta.url), lines.join('\n') + '\n');
  await client.end();
}

process.exit(gagal ? 1 : 0);
