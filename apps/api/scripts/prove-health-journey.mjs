/**
 * Alur satu pasien: dari pendaftaran sampai klaim terbayar.
 *
 * ## Mengapa naskah ini ada
 *
 * UAT persona membuktikan tiap orang boleh mengerjakan pekerjaannya dan ditolak
 * pada yang bukan wewenangnya. Ia TIDAK membuktikan bahwa pekerjaan itu
 * bersambung.
 *
 * Itu pertanyaan yang berbeda. Tiap langkah dapat lulus sendiri-sendiri
 * sementara serah-terimanya putus: koder membuka daftar kerjanya dan kunjungan
 * yang baru selesai tidak ada di sana; petugas klaim membuat klaim dan
 * kodingnya tidak ikut. Tidak satu pun uji yang memeriksa satu modul akan
 * melihatnya, sebab kegagalannya berada di ANTARA modul.
 *
 * Naskah ini menjalankan SATU pasien melewati DELAPAN tangan yang berbeda,
 * memakai peran yang tersemai apa adanya, terhadap peladen yang hidup.
 *
 * ## Yang diperiksa pada tiap serah-terima
 *
 * Bukan sekadar "langkahnya berhasil", melainkan tiga hal:
 *
 *   1. orang berikutnya MELIHAT hasil orang sebelumnya pada daftar kerjanya,
 *   2. yang dilihatnya menunjuk pasien dan kunjungan yang SAMA,
 *   3. orang sebelumnya TIDAK dapat mengerjakan langkah berikutnya.
 *
 * Yang ketiga paling mudah terlewat. Alur yang mengalir mulus dari ujung ke
 * ujung di tangan SATU orang bukan alur yang benar — ia alur tanpa pemisahan
 * wewenang sama sekali.
 *
 * Jalankan: node scripts/prove-health-journey.mjs
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

const dibuat = [];

/**
 * Membuat satu orang dengan peran yang TERSEMAI, lalu memasukkannya.
 *
 * Peran sintetis sengaja tidak dipakai: ia akan menguji naskah ini terhadap
 * dirinya sendiri, bukan terhadap apa yang benar-benar diterima orang pada
 * pemasangan sungguhan.
 */
async function orang(kodePeran, tenantId, nama) {
  const tag = randomBytes(4).toString('hex');
  const username = `alur_${kodePeran.toLowerCase()}_${tag}`;
  const password = `Alur-${randomBytes(9).toString('base64url')}!7`;
  const pid = randomUUID();
  await q(
    `INSERT INTO platform.platform_user
       (id, username, normalized_username, email, display_name, password_hash,
        status, must_change_password, is_platform_staff, created_at, updated_at)
     VALUES ($1,$2::varchar,lower($2::varchar),$3,$4,$5,'ACTIVE',FALSE,FALSE,now(),now())`,
    [pid, username, `${username}@contoh.invalid`, nama, await argon2.hash(password, { type: argon2.argon2id })],
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
      [pid, username, nama],
    )
  )[0].id;
  dibuat.push({ pid, subjectId });

  const peran = (await q(`SELECT id FROM "${SCHEMA}".role WHERE code = $1 AND deleted_at IS NULL`, [kodePeran]))[0];
  if (!peran) throw new Error(`peran ${kodePeran} tidak tersemai`);
  await q(
    `INSERT INTO "${SCHEMA}".user_role_assignment (user_subject_id, role_id, valid_from) VALUES ($1,$2,CURRENT_DATE)`,
    [subjectId, peran.id],
  );

  /* Batas laju login 10 per 60 detik; alur ini memakai delapan tangan. */
  for (let n = 1; n <= 4; n += 1) {
    const r = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (r.status === 429) {
      log(`    ... batas laju login; menunggu 61 detik (${n}/4)`);
      await new Promise((s) => setTimeout(s, 61_000));
      continue;
    }
    const b = await r.json().catch(() => ({}));
    if (!b?.data?.accessToken) throw new Error(`login ${kodePeran} dijawab ${r.status}`);
    return { nama, peran: kodePeran, token: b.data.accessToken, subjectId };
  }
  throw new Error(`batas laju login tidak reda untuk ${kodePeran}`);
}

/** Memanggil peladen sebagai satu orang tertentu. */
function tangan(o, facilityId) {
  const H = {
    authorization: `Bearer ${o.token}`,
    'x-purpose-of-use': 'TREATMENT',
    'x-facility-id': facilityId,
    'content-type': 'application/json',
  };
  return async (metode, jalan, isi) => {
    const r = await fetch(`${BASE}${jalan}`, {
      method: metode,
      headers: H,
      body: metode === 'GET' ? undefined : JSON.stringify(isi ?? {}),
    });
    const b = await r.json().catch(() => ({}));
    return { status: r.status, data: b?.data ?? b, galat: b?.error };
  };
}

await client.connect();

try {
  log('='.repeat(78));
  log('ALUR SATU PASIEN — PENDAFTARAN SAMPAI KLAIM TERBAYAR');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Peladen : ${BASE}`);
  log('='.repeat(78));

  const tenantId = (
    await q('SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1', [SCHEMA])
  )[0].id;
  const fasilitas = (
    await q(`SELECT f.id::text AS id, f.code
               FROM "${SCHEMA}".health_facility f
              WHERE f.deleted_at IS NULL
                AND EXISTS (SELECT 1 FROM "${SCHEMA}".health_service_unit u WHERE u.facility_id = f.id)
              ORDER BY f.created_at LIMIT 1`)
  )[0];
  const obat = (
    await q(`SELECT id::text AS id, code, generic_name, dose_unit
               FROM "${SCHEMA}".rx_drug_master
              WHERE is_active AND NOT is_controlled AND NOT is_high_alert AND deleted_at IS NULL
              ORDER BY code LIMIT 1`)
  )[0];
  log(`Fasilitas: ${fasilitas.code}`);
  log(`Obat     : ${obat.generic_name}`);

  /* --- Delapan tangan, dibuat lebih dulu supaya batas laju tertumpuk sekali -- */
  log('');
  log('Menyiapkan delapan orang dengan peran yang tersemai...');
  const admin = await orang('HEALTH_ADMIN', tenantId, 'Hesti, administrator eMedik');
  const pendaftaran = await orang('HEALTH_REGISTRATION_CLERK', tenantId, 'Rina, petugas pendaftaran');
  const dokter = await orang('HEALTH_DOCTOR', tenantId, 'dr. Ardi');
  const apoteker = await orang('HEALTH_PHARMACIST', tenantId, 'Dewi, apoteker');
  const koder = await orang('HEALTH_CODER', tenantId, 'Yanto, koder');
  const verifKoding = await orang('HEALTH_CODING_VERIFIER', tenantId, 'Sri, verifikator koding');
  const petugasKlaim = await orang('HEALTH_CLAIM_OFFICER', tenantId, 'Budi, petugas klaim');
  const verifKlaim = await orang('HEALTH_CLAIM_VERIFIER', tenantId, 'Tuti, verifikator klaim');
  log('  delapan tangan siap.');

  const F = fasilitas.id;
  const kAdmin = tangan(admin, F);
  const kPendaftaran = tangan(pendaftaran, F);
  const kDokter = tangan(dokter, F);
  const kApoteker = tangan(apoteker, F);
  const kKoder = tangan(koder, F);
  const kVerifKoding = tangan(verifKoding, F);
  const kKlaim = tangan(petugasKlaim, F);
  const kVerifKlaim = tangan(verifKlaim, F);

  const namaPasien = `Alur Uji ${randomBytes(3).toString('hex')}`;

  /* === 0 — ADMINISTRATOR MENDAFTARKAN DOKTERNYA ======================== */
  log('');
  log('-'.repeat(78));
  log('0. Hesti, administrator — mendaftarkan dr. Ardi sebagai pemberi layanan');
  log('   Tanpa langkah ini berkasnya tidak dapat dikode sama sekali; percobaan');
  log('   pertama alur ini terhenti tepat di situ.');

  const buatDokter = await kAdmin('POST', '/health/providers', {
    code: `DR-ALUR-${randomBytes(3).toString('hex')}`,
    fullName: 'dr. Ardi',
    providerType: 'DOCTOR',
    primaryFacilityId: F,
    userSubjectId: dokter.subjectId,
    practiceLicenseNo: `SIP-${randomBytes(3).toString('hex')}`,
    practiceLicenseValidUntil: '2030-12-31',
  });
  nilai('mendaftarkan dokter beserta nomor izin praktiknya', buatDokter.status < 300,
    `${buatDokter.status} ${JSON.stringify(buatDokter.galat ?? '').slice(0, 200)}`);
  const providerId = buatDokter.data?.providerId ?? buatDokter.data?.id;
  if (!providerId) throw new Error(`tidak memperoleh providerId: ${JSON.stringify(buatDokter.data).slice(0, 250)}`);

  /* Izin praktik wajib bagi dokter — dan itu diperiksa, bukan sekadar ditulis
   * pada dokumentasi. Kader sengaja dikecualikan; menuntutnya akan
   * menghentikan pendaftaran kader Posyandu. */
  const dokterTanpaIzin = await kAdmin('POST', '/health/providers', {
    code: `DR-TANPA-${randomBytes(3).toString('hex')}`,
    fullName: 'dr. Tanpa Izin',
    providerType: 'DOCTOR',
    primaryFacilityId: F,
  });
  nilai('ATURAN: dokter tanpa nomor izin praktik DITOLAK', dokterTanpaIzin.status === 400,
    `dijawab ${dokterTanpaIzin.status}, seharusnya 400`);

  /* === 1 — PENDAFTARAN ================================================= */
  log('');
  log('-'.repeat(78));
  log('1. Rina, petugas pendaftaran — mendaftarkan pasien baru');

  const daftarPasien = await kPendaftaran('POST', '/health/patients', {
    fullName: namaPasien,
    birthDate: '1990-05-17',
    gender: 'FEMALE',
    facilityId: F,
  });
  nilai('mendaftarkan pasien baru', daftarPasien.status < 300, `${daftarPasien.status} ${JSON.stringify(daftarPasien.galat ?? '').slice(0, 160)}`);
  /* Jawabannya memakai `patientId`, bukan `id` — dan ia juga menerbitkan nomor
   * rekam medis serta identitas lintas fasilitas sekaligus. */
  const patientId = daftarPasien.data?.patientId;
  if (!patientId) throw new Error(`tidak memperoleh patientId: ${JSON.stringify(daftarPasien.data).slice(0, 300)}`);
  log(`   pasien: ${namaPasien}  (RM ${daftarPasien.data?.medicalRecordNumber ?? '?'})`);

  const daftarKunjungan = await kPendaftaran('POST', '/health/registrations', {
    patientId,
    facilityId: F,
    providerId,
    visitType: 'OUTPATIENT',
    channel: 'WALK_IN',
    payerType: 'BPJS',
    chiefComplaint: 'Nyeri ulu hati sejak dua hari',
  });
  nilai('mendaftarkan kunjungannya', daftarKunjungan.status < 300, `${daftarKunjungan.status} ${JSON.stringify(daftarKunjungan.galat ?? '').slice(0, 160)}`);
  const registrationId =
    daftarKunjungan.data?.registrationId ?? daftarKunjungan.data?.id ?? daftarKunjungan.data?.registration?.id;
  if (!registrationId) {
    throw new Error(`tidak memperoleh registrationId: ${JSON.stringify(daftarKunjungan.data).slice(0, 300)}`);
  }
  log(`   nomor antrean: ${daftarKunjungan.data?.queueNumber ?? daftarKunjungan.data?.queue_number ?? '(tidak disebut)'}`);

  /*
   * SERAH-TERIMA 1 — pasien yang baru didaftarkan muncul pada antrean.
   *
   * Dicari berdasarkan NAMA, bukan id: kueri antreannya memang tidak
   * mengembalikan `patient_id`, dan nama itulah yang dilihat petugas di layar.
   */
  const antrean = await kPendaftaran('GET', `/health/queue?facilityId=${F}`);
  const adaDiAntrean = JSON.stringify(antrean.data ?? '').includes(namaPasien);
  nilai('SERAH-TERIMA: pasiennya muncul pada antrean', adaDiAntrean,
    `tidak ditemukan; antrean berisi ${JSON.stringify(antrean.data ?? '').slice(0, 180)}`);

  /* === 2 — DOKTER ====================================================== */
  log('');
  log('-'.repeat(78));
  log('2. dr. Ardi — memeriksa, mendiagnosis, meresepkan');

  const mulai = await kDokter('POST', '/health/encounters', { registrationId, providerId });
  nilai('memulai kunjungan dari pendaftaran itu', mulai.status < 300, `${mulai.status} ${JSON.stringify(mulai.galat ?? '').slice(0, 200)}`);
  const encounterId = mulai.data?.encounterId;
  if (!encounterId) throw new Error(`tidak memperoleh encounterId: ${JSON.stringify(mulai.data).slice(0, 300)}`);
  log(`   nomor kunjungan: ${mulai.data?.encounterNumber ?? '?'}`);

  const diagnosis = await kDokter('POST', '/health/diagnoses', {
    encounterId,
    code: 'K29.7',
    codeSystem: 'ICD10',
    description: 'Gastritis, tidak spesifik',
    diagnosisRole: 'PRIMARY',
    certainty: 'CONFIRMED',
  });
  nilai('mencatat diagnosis utama', diagnosis.status < 300, `${diagnosis.status} ${JSON.stringify(diagnosis.galat ?? '').slice(0, 160)}`);

  const resep = await kDokter('POST', '/health/pharmacy/prescriptions', {
    patientId,
    facilityId: F,
    encounterId,
    lines: [
      {
        drugId: obat.id,
        doseValue: 500,
        doseUnit: obat.dose_unit ?? 'mg',
        route: 'ORAL',
        frequencyCode: 'TID',
        frequencyPerDay: 3,
        durationDays: 3,
        quantity: 9,
        quantityUnit: 'tablet',
        instruction: 'Sesudah makan',
      },
    ],
  });
  nilai('menulis resep', resep.status < 300, `${resep.status} ${JSON.stringify(resep.galat ?? '').slice(0, 200)}`);

  /* PEMISAHAN — dokter tidak menyerahkan obatnya sendiri diperiksa UAT persona;
   * di sini yang diperiksa serah-terimanya: resepnya sampai ke apoteker. */
  const daftarResep = await kApoteker('GET', `/health/pharmacy/prescriptions?facilityId=${F}`);
  const isiResep = JSON.stringify(daftarResep.data ?? '');
  const resepSampai = isiResep.includes(patientId) || isiResep.includes(namaPasien);
  nilai('SERAH-TERIMA: resepnya terlihat oleh Dewi, apoteker', resepSampai,
    `tidak muncul pada daftar apoteker; ${daftarResep.status}, ${isiResep.slice(0, 180)}`);

  const selesai = await kDokter('POST', `/health/encounters/${encounterId}/complete`, { disposition: 'DISCHARGED' });
  nilai('menyelesaikan kunjungan', selesai.status < 300, `${selesai.status} ${JSON.stringify(selesai.galat ?? '').slice(0, 200)}`);

  /* === 3 — KODER ======================================================= */
  log('');
  log('-'.repeat(78));
  log('3. Yanto, koder — memeriksa kelengkapan berkas, lalu mengoding');

  /*
   * LANGKAH YANG MUDAH DIKIRA OTOMATIS — dan tidak.
   *
   * Menyelesaikan kunjungan TIDAK menaruhnya pada daftar kerja koder. Berkas
   * pengkodean baru terbit ketika seseorang memeriksa kelengkapannya lewat
   * `POST /health/him/records/check`; `periksaBerkas` tidak dipanggil dari mana
   * pun selain controller itu.
   *
   * Akibatnya bila tak seorang pun menjalankan pemeriksaan ini, kunjungannya
   * tidak pernah dikoding, tidak pernah menjadi klaim, dan tidak ada satu pun
   * galat yang muncul. Uangnya diam-diam tidak ditagihkan.
   */
  const periksaBerkas = await kKoder('POST', '/health/him/records/check', { encounterId });
  nilai('membuka berkas pengkodean lewat pemeriksaan kelengkapan', periksaBerkas.status < 300,
    `${periksaBerkas.status} ${JSON.stringify(periksaBerkas.galat ?? '').slice(0, 200)}`);
  const kurangLengkap = periksaBerkas.data?.deficiencies ?? periksaBerkas.data?.findings ?? [];
  log(`   kekurangan berkas: ${Array.isArray(kurangLengkap) ? kurangLengkap.length : '?'}`);

  const daftarKoding = await kKoder('GET', `/health/him/coding/worklist?facilityId=${F}`);
  /* Daftar kerjanya menyebut NAMA pasien, bukan id kunjungan. */
  const barisKoding = (Array.isArray(daftarKoding.data) ? daftarKoding.data : (daftarKoding.data?.results ?? []))
    .find((x) => x.patient_name === namaPasien);
  nilai('SERAH-TERIMA: kunjungannya muncul pada daftar kerja koder', Boolean(barisKoding),
    `tidak sampai ke daftar koding; ${daftarKoding.status}, ${JSON.stringify(daftarKoding.data ?? '').slice(0, 160)}`);

  const idKoding = barisKoding?.id ?? periksaBerkas.data?.codingId ?? periksaBerkas.data?.id;
  const kode = await kKoder('POST', `/health/him/coding/${idKoding}/code`, {
    /*
     * Kodenya diambil dari terminologi yang BENAR-BENAR aktif pada tenant ini,
     * bukan dari kode yang masuk akal secara klinis. Percobaan sebelumnya
     * memakai G43.0 dan ditolak: snapshot ICD-10 yang aktif hanya memuat tiga
     * kode. Kode yang dikarang akan membuat naskah ini gagal pada pemasangan
     * mana pun yang terminologinya berbeda.
     */
    items: [{ itemType: 'DIAGNOSIS', code: 'K29.7', codeSystem: 'ICD10', isPrincipal: true, sequenceNo: 1 }],
  });
  nilai('mengoding diagnosis dan tindakan', kode.status < 300, `${kode.status} ${JSON.stringify(kode.galat ?? '').slice(0, 200)}`);

  /* PEMISAHAN WEWENANG — koder mencoba memverifikasi kodingnya sendiri. */
  const koderVerifikasiSendiri = await kKoder('POST', `/health/him/coding/${idKoding}/verify`, { approve: true });
  nilai('PEMISAHAN: Yanto TIDAK dapat memverifikasi kodingnya sendiri',
    koderVerifikasiSendiri.status === 403, `dijawab ${koderVerifikasiSendiri.status}, seharusnya 403`);

  /* === 4 — VERIFIKATOR KODING ========================================== */
  log('');
  log('-'.repeat(78));
  log('4. Sri, verifikator koding — memeriksa hasil koding Yanto');

  const verifikasi = await kVerifKoding('POST', `/health/him/coding/${idKoding}/verify`, {
    approve: true,
    note: 'Kode sesuai dengan catatan klinis.',
  });
  nilai('memverifikasi koding orang lain', verifikasi.status < 300, `${verifikasi.status} ${JSON.stringify(verifikasi.galat ?? '').slice(0, 200)}`);

  /* === 5 — PETUGAS KLAIM =============================================== */
  log('');
  log('-'.repeat(78));
  log('5. Budi, petugas klaim — menyusun klaim');

  const klaim = await kKlaim('POST', '/health/claims', { facilityId: F, encounterId });
  nilai('SERAH-TERIMA: menyusun klaim atas kunjungan itu', klaim.status < 300, `${klaim.status} ${JSON.stringify(klaim.galat ?? '').slice(0, 220)}`);
  const claimId = klaim.data?.id ?? klaim.data?.claim?.id;

  if (!claimId) {
    nilai('memperoleh nomor klaim', false, `tidak ada id pada jawaban: ${JSON.stringify(klaim.data).slice(0, 200)}`);
  } else {
    /* PEMISAHAN — petugas klaim mencoba memverifikasi klaimnya sendiri. */
    const klaimVerifikasiSendiri = await kKlaim('POST', `/health/claims/${claimId}/verify`, {});
    nilai('PEMISAHAN: Budi TIDAK dapat memverifikasi klaimnya sendiri',
      klaimVerifikasiSendiri.status === 403, `dijawab ${klaimVerifikasiSendiri.status}, seharusnya 403`);

    /* === 6 — VERIFIKATOR KLAIM ========================================= */
    log('');
    log('-'.repeat(78));
    log('6. Tuti, verifikator klaim — memeriksa klaim Budi');

    const daftarKlaim = await kVerifKlaim('GET', `/health/claims?facilityId=${F}`);
    const klaimTerlihat = JSON.stringify(daftarKlaim.data ?? '').includes(claimId);
    nilai('SERAH-TERIMA: klaimnya terlihat oleh verifikator', klaimTerlihat,
      `tidak muncul; ${daftarKlaim.status}, ${JSON.stringify(daftarKlaim.data ?? '').slice(0, 160)}`);

    /*
     * 200 BUKAN berarti terverifikasi.
     *
     * `verify` memindahkan status ke INTERNALLY_VERIFIED hanya bila
     * `blockingCount === 0`. Bila masih ada yang menahan, ia tetap menjawab 200
     * dan mengembalikan daftar temuannya — dan status klaimnya tidak berubah.
     *
     * Memeriksa kode HTTP saja akan melaporkan langkah ini lulus lalu
     * membiarkan pengajuan gagal beberapa baris kemudian dengan sebab yang
     * tampak tidak berhubungan.
     */
    const verifKlaimHasil = await kVerifKlaim('POST', `/health/claims/${claimId}/verify`, {});
    const menahan = verifKlaimHasil.data?.blockingCount;
    const temuanKlaim = verifKlaimHasil.data?.findings ?? [];
    nilai('memverifikasi klaim orang lain', verifKlaimHasil.status < 300,
      `${verifKlaimHasil.status} ${JSON.stringify(verifKlaimHasil.galat ?? '').slice(0, 200)}`);
    nilai('verifikasi internal tidak menemukan yang menahan pengajuan', menahan === 0,
      `${menahan} temuan menahan: ${temuanKlaim.filter((t) => t.blocksSubmission).map((t) => t.type).join(', ')}`);
    log(`   status sesudah verifikasi: ${verifKlaimHasil.data?.status ?? '(tidak disebut)'}`);

    /* === 7 — PENGAJUAN, KEPUTUSAN, PEMBAYARAN ========================== */
    log('');
    log('-'.repeat(78));
    log('7. Budi — mengajukan, lalu mencatat keputusan dan pembayaran penjamin');

    const ajukan = await kKlaim('POST', `/health/claims/${claimId}/submit`, { submittedAmount: 350000 });
    nilai('mengajukan klaim ke penjamin', ajukan.status < 300, `${ajukan.status} ${JSON.stringify(ajukan.galat ?? '').slice(0, 200)}`);

    /*
     * ATURAN — selisih antara yang diajukan dan yang disetujui wajib bersebab,
     * dan sebabnya kosakata tertutup.
     *
     * Ini yang menahan potongan yang tak pernah dijelaskan. Klaim yang
     * disetujui sebagian tanpa sebab tampak sama seperti yang disetujui penuh
     * pada laporan mana pun yang hanya menjumlahkan angkanya; sebabnya jugalah
     * satu-satunya cara mengetahui apakah potongan itu berulang karena koding
     * yang keliru atau karena tarifnya memang tidak cocok.
     */
    const potongTanpaSebab = await kKlaim('POST', `/health/claims/${claimId}/decision`, { approvedAmount: 300000 });
    nilai('ATURAN: potongan tanpa sebab DITOLAK', potongTanpaSebab.status === 422,
      `dijawab ${potongTanpaSebab.status}, seharusnya 422`);

    const keputusan = await kKlaim('POST', `/health/claims/${claimId}/decision`, {
      approvedAmount: 300000,
      rejectionReason: 'TARIFF_MISMATCH',
      rejectionNote: 'Tarif yang ditagihkan di atas tarif regional yang berlaku.',
    });
    nilai('mencatat keputusan penjamin (disetujui sebagian, bersebab)', keputusan.status < 300,
      `${keputusan.status} ${JSON.stringify(keputusan.galat ?? '').slice(0, 200)}`);

    const bayar = await kKlaim('POST', `/health/claims/${claimId}/payment`, { paidAmount: 300000 });
    nilai('mencatat pembayaran', bayar.status < 300, `${bayar.status} ${JSON.stringify(bayar.galat ?? '').slice(0, 200)}`);

    /* === PENUTUP — keadaan akhir klaimnya ============================== */
    const akhir = await kKlaim('GET', `/health/claims/${claimId}`);
    const st = akhir.data?.status ?? akhir.data?.claim?.status;
    log('');
    log(`   keadaan akhir klaim: ${st ?? '(tidak disebut)'}`);
    nilai('klaimnya dapat dibaca kembali beserta keadaannya', akhir.status < 300 && Boolean(st),
      `${akhir.status}, status ${st ?? 'tidak ada'}`);
  }

  /* === RINGKASAN ======================================================= */
  log('');
  log('='.repeat(78));
  log(`RINGKASAN — lulus ${lulus}, gagal ${gagal}`);
  log('Satu pasien, delapan tangan, dari pendaftaran sampai pembayaran.');
  if (temuan.length) {
    log('');
    log('TEMUAN:');
    for (const t of temuan) log(`  - ${t}`);
  }
  log('='.repeat(78));
} catch (e) {
  gagal += 1;
  log('');
  log(`ALUR TERHENTI: ${e.message}`);
  log('Langkah yang belum sempat dijalankan TIDAK dihitung lulus.');
} finally {
  for (const d of dibuat) {
    await q(`DELETE FROM "${SCHEMA}".user_role_assignment WHERE user_subject_id = $1`, [d.subjectId]).catch(() => {});
    await q(`DELETE FROM "${SCHEMA}".user_subject WHERE id = $1`, [d.subjectId]).catch(() => {});
    await q('DELETE FROM platform.tenant_membership WHERE platform_user_id = $1', [d.pid]).catch(() => {});
    await q('DELETE FROM platform.platform_user WHERE id = $1', [d.pid]).catch(() => {});
  }
  writeFileSync(new URL('../../../docs/emedik/bukti-alur-pasien.txt', import.meta.url), lines.join('\n') + '\n');
  await client.end();
}

process.exit(gagal ? 1 : 0);
