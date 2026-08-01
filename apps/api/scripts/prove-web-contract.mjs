/**
 * Bukti kontrak: bentuk jawaban peladen SAMA dengan tipe yang dideklarasikan
 * klien web.
 *
 * ## Mengapa naskah ini ada
 *
 * Fase W-1 menemukan cacat yang lolos dari SELURUH uji komponennya. `CoveragePage`
 * membaca `percentage` dan `shortfall`; peladen mengirim `coverage`, `gap`, dan
 * `message`. Halamannya melempar TypeError dan kosong sama sekali.
 *
 * Enam uji atas halaman itu lulus — sebab perlengkapan datanya ditulis tangan
 * dengan andaian yang sama kelirunya. **Perlengkapan yang keliru dan kode yang
 * keliru saling menyetujui, dan keduanya tidak sesuai kenyataan.**
 *
 * Uji komponen tidak dapat menutup celah itu, dan tidak akan pernah dapat:
 * ia menguji komponen terhadap data yang bentuknya ditentukan penulisnya
 * sendiri. Yang dapat menutupnya hanya memanggil peladen sungguhan dan
 * membandingkan jawabannya dengan tipe yang dideklarasikan.
 *
 * ## Yang diperiksa
 *
 * Untuk tiap jalan: setiap medan yang dideklarasikan `health-api.ts` sebagai
 * **wajib** harus ada pada jawaban peladen. Medan tambahan pada jawaban
 * DIBIARKAN — peladen boleh mengirim lebih daripada yang dipakai klien, dan
 * memaksanya sama persis akan menggagalkan naskah ini setiap kali peladen
 * menambah kolom yang tidak dipakai siapa pun.
 *
 * Yang TIDAK diperiksa: tipe nilainya. Nama medan yang keliru adalah cacat yang
 * benar-benar terjadi; tipe yang keliru belum pernah.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import pg from 'pg';

const BASE = process.env.API_BASE ?? 'http://localhost:3200/api/v1';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const bacaEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()?.replace(/^"|"$/g, '');
const SCHEMA = process.env.HEALTH_SCHEMA ?? 'demo';
const KLIEN = new URL('../../web/src/verticals/health/health-api.ts', import.meta.url);

const client = new pg.Client({ connectionString: bacaEnv('DATABASE_URL') });
const lines = [];
const log = (t) => {
  lines.push(t);
  console.log(t);
};

let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${label}${ok || !detail ? '' : `  (${detail})`}`);
}

const q = async (sql, p = []) => (await client.query(sql, p)).rows;

/**
 * Membaca medan WAJIB satu antarmuka dari `health-api.ts`.
 *
 * Medan yang berakhiran `?` bersifat pilihan dan dilewati. Dibaca dari berkas
 * sungguhan, bukan disalin ke sini — salinan akan berbeda dalam waktu satu
 * fase, dan naskah yang membandingkan salinan dengan salinan tidak membuktikan
 * apa pun.
 */
function medanWajib(sumber, nama) {
  const m = sumber.match(new RegExp(`export interface ${nama} \\{([\\s\\S]*?)\\n\\}`));
  if (!m) return null;
  const medan = [];
  for (const baris of m[1].split('\n')) {
    const f = baris.match(/^\s{2}([a-zA-Z_][a-zA-Z0-9_]*)(\??):/);
    if (f && f[2] !== '?') medan.push(f[1]);
  }
  return medan;
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI KONTRAK — BENTUK JAWABAN PELADEN vs TIPE KLIEN WEB');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const sumber = readFileSync(KLIEN, 'utf8');
  const tag = randomBytes(3).toString('hex');
  const tenantId = (
    await q('SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1', [SCHEMA])
  )[0].id;

  const username = `bukti_kontrak_${tag}`;
  const password = `Kontrak-${randomBytes(9).toString('base64url')}!7`;
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const pid = randomUUID();

  await q(
    `INSERT INTO platform.platform_user
       (id, username, normalized_username, email, display_name, password_hash,
        status, must_change_password, is_platform_staff, created_at, updated_at)
     VALUES ($1,$2::varchar,lower($2::varchar),$3,'Bukti Kontrak',$4,'ACTIVE',FALSE,FALSE,now(),now())`,
    [pid, username, `${username}@contoh.invalid`, hash],
  );
  await q(
    `INSERT INTO platform.tenant_membership (id, tenant_id, platform_user_id, is_owner, status, created_at, updated_at)
     VALUES (gen_random_uuid(),$1,$2,FALSE,'ACTIVE',now(),now())`,
    [tenantId, pid],
  );
  const subjectId = (
    await q(
      `INSERT INTO "${SCHEMA}".user_subject (platform_user_id, code, name, username_snapshot, is_owner, status)
       VALUES ($1,$2::varchar,'Bukti Kontrak',$2::varchar,FALSE,'ACTIVE') RETURNING id`,
      [pid, username],
    )
  )[0].id;
  const roleId = (
    await q(
      `INSERT INTO "${SCHEMA}".role (code, name, description, is_system)
       VALUES ($1,'Bukti kontrak','Peran naskah bukti kontrak web',FALSE) RETURNING id`,
      [`BUKTI_KONTRAK_${tag.toUpperCase()}`],
    )
  )[0].id;

  const menus = new Map((await q(`SELECT id, code FROM "${SCHEMA}".menu WHERE deleted_at IS NULL`)).map((m) => [m.code, m.id]));
  const aksi = new Map((await q(`SELECT id, code FROM "${SCHEMA}".permission_action`)).map((a) => [a.code, a.id]));
  const hak = {
    HEALTH: ['READ'],
    HEALTH_FACILITY: ['READ'],
    HEALTH_PATIENT: ['READ'],
    HEALTH_FAMILY: ['READ', 'CREATE'],
    HEALTH_GROWTH: ['READ', 'CREATE'],
    HEALTH_IMMUNIZATION: ['READ', 'CREATE', 'IMMUNIZE'],
    HEALTH_HOME_VISIT: ['READ', 'CREATE'],
    HEALTH_PROGRAM: ['READ'],
    HEALTH_HIM_CODING: ['READ', 'CREATE'],
    HEALTH_LEGAL_HOLD: ['READ'],
    HEALTH_INFO_RELEASE: ['READ'],
    HEALTH_ACCESS_LOG: ['READ'],
    HEALTH_BREAK_GLASS: ['READ'],
    HEALTH_SAFETY: ['READ', 'CREATE'],
    HEALTH_QUALITY: ['READ'],
  };
  for (const [m, aa] of Object.entries(hak)) {
    const mid = menus.get(m);
    if (!mid) continue;
    for (const a of aa) {
      const aid = aksi.get(a);
      if (!aid) continue;
      await q(
        `INSERT INTO "${SCHEMA}".role_menu_permission (role_id, menu_id, permission_action_id, effect)
         VALUES ($1,$2,$3,'ALLOW') ON CONFLICT DO NOTHING`,
        [roleId, mid, aid],
      );
    }
  }
  await q(
    `INSERT INTO "${SCHEMA}".user_role_assignment (user_subject_id, role_id, valid_from) VALUES ($1,$2,CURRENT_DATE)`,
    [subjectId, roleId],
  );

  const masuk = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const sesi = (await masuk.json())?.data;
  if (!sesi?.accessToken) throw new Error('login naskah bukti gagal');

  /*
   * Satu kunjungan sungguhan menjadi jangkarnya, dan fasilitasnya diambil DARI
   * kunjungan itu — bukan dipilih terpisah. Fasilitas yang dipilih terpisah
   * membuat separuh jalan mengembalikan larik kosong, dan naskah ini lalu
   * melaporkan "tidak ada baris" untuk jalan yang sebenarnya berisi.
   */
  const kunjungan = (
    await q(
      `SELECT e.id::text AS id, e.patient_id::text AS patient_id, e.facility_id::text AS facility_id
         FROM "${SCHEMA}".health_encounter e
        WHERE e.status = 'COMPLETED'
        ORDER BY e.created_at DESC LIMIT 1`,
    )
  )[0];
  if (!kunjungan) throw new Error('Tidak ada kunjungan untuk dijadikan jangkar.');
  const facilityId = kunjungan.facility_id;

  const H = {
    authorization: `Bearer ${sesi.accessToken}`,
    'x-purpose-of-use': 'QUALITY',
    'x-facility-id': facilityId,
  };
  const amb = async (jalan) => {
    const r = await fetch(`${BASE}${jalan}`, { headers: H });
    const b = await r.json().catch(() => ({}));
    return { status: r.status, data: b?.data ?? b };
  };

  const pasien = (await amb('/health/patients?q=a')).data?.results?.[0];
  const tahun = new Date().getFullYear();

  /*
   * --- Menyiapkan baris supaya SETIAP kontrak benar-benar diperiksa ---------
   *
   * Naskah bukti yang melewatkan jalan tanpa data akan berkata seluruh kontrak
   * cocok sekalipun jalan yang paling rawan tidak pernah dilihat. Pada W-1
   * jalan yang rusak justru `coverage` — yang pada mulanya kosong.
   *
   * Seluruhnya dibuat lewat JALAN SUNGGUHAN bila ada; hanya sasaran program
   * yang disisipkan langsung, sebab tidak ada jalan API untuk menetapkannya.
   */
  const kirim = async (jalan, isi) => {
    const r = await fetch(`${BASE}${jalan}`, {
      method: 'POST',
      headers: { ...H, 'content-type': 'application/json' },
      body: JSON.stringify(isi),
    });
    const b = await r.json().catch(() => ({}));
    return { status: r.status, data: b?.data ?? b };
  };

  await q(
    `INSERT INTO "${SCHEMA}".community_program_target
       (facility_id, program_code, program_name, village, target_count, achieved_count, period_year, period_month)
     VALUES ($1,'IMUNISASI_DASAR','Imunisasi Dasar Lengkap','Bukti Kontrak',200,151,$2,NULL)
     ON CONFLICT DO NOTHING`,
    [facilityId, tahun],
  );

  const periksa = await kirim('/health/him/records/check', { encounterId: kunjungan.id });
  const insiden = await kirim('/health/him/incidents', {
    facilityId,
    incidentType: 'MEDICATION',
    occurredAt: new Date().toISOString(),
    description: 'Insiden contoh yang dibuat naskah bukti kontrak web.',
    harmLevel: 'NEAR_MISS',
    reachedPatient: false,
  });
  /*
   * Pengukuran menuntut ANAK, bukan sembarang pasien: peladen menolak umur di
   * luar 0–300 bulan. Dicari yang benar-benar balita — dan bila tidak ada,
   * jalannya dilaporkan tidak terbukti, bukan dipaksakan.
   */
  const balita = (
    await q(
      `SELECT id::text AS id FROM "${SCHEMA}".patient
        WHERE deleted_at IS NULL AND birth_date IS NOT NULL
          AND birth_date > (CURRENT_DATE - INTERVAL '5 years')
        ORDER BY birth_date DESC LIMIT 1`,
    )
  )[0];
  const folder = (
    await q(
      `SELECT id::text AS id FROM "${SCHEMA}".family_folder
        WHERE deleted_at IS NULL AND facility_id = $1 LIMIT 1`,
      [facilityId],
    )
  )[0];
  const tumbuh = balita
    ? await kirim('/health/community/growth', {
        patientId: balita.id,
        facilityId,
        familyFolderId: folder?.id,
        /* Sengaja rendah: supaya ia muncul pada daftar kunjungan rumah. */
        weightKg: 5.4,
        heightCm: 82,
        heightMeasuredAs: 'STANDING',
      })
    : { status: 0 };

  log('');
  log('--- Menyiapkan baris uji ------------------------------------------------');
  log(`  periksa berkas  : ${periksa.status}`);
  log(`  insiden         : ${insiden.status}`);
  log(`  pengukuran      : ${tumbuh.status}${balita ? '' : '  (tidak ada balita)'}`);

  /**
   * Jalan yang dipakai klien web, beserta antarmuka yang mewakili SATU
   * barisnya. `ambil` menarik satu contoh baris dari jawaban.
   */
  const kontrak = [
    {
      nama: 'facilities',
      jalan: '/health/facilities',
      antarmuka: 'Fasilitas',
      ambil: (d) => d?.[0],
    },
    {
      nama: 'searchPatients',
      jalan: '/health/patients?q=a',
      antarmuka: 'HasilCari',
      ambil: (d) => d,
    },
    {
      nama: 'searchPatients.results[]',
      jalan: '/health/patients?q=a',
      antarmuka: 'RingkasPasien',
      ambil: (d) => d?.results?.[0],
    },
    {
      nama: 'coverage',
      jalan: `/health/community/coverage?facilityId=${facilityId}&year=${tahun}`,
      antarmuka: 'BarisCakupan',
      ambil: (d) => d?.[0],
    },
    {
      nama: 'homeVisitWorklist',
      jalan: `/health/community/home-visits/worklist?facilityId=${facilityId}&limit=5`,
      antarmuka: 'BarisKunjunganRumah',
      ambil: (d) => d?.[0],
    },
    {
      nama: 'codingWorklist',
      jalan: `/health/him/coding/worklist?facilityId=${facilityId}`,
      antarmuka: 'BarisKoding',
      ambil: (d) => d?.[0],
    },
    {
      nama: 'deficiencies',
      jalan: `/health/him/deficiencies?facilityId=${facilityId}&role=DOCTOR`,
      antarmuka: 'BarisKekurangan',
      ambil: (d) => d?.[0],
    },
    {
      nama: 'incidents',
      jalan: `/health/him/incidents?facilityId=${facilityId}`,
      antarmuka: 'BarisInsiden',
      ambil: (d) => d?.[0],
    },
    {
      nama: 'qualityDashboard',
      jalan: `/health/him/quality/dashboard?facilityId=${facilityId}&year=${tahun}`,
      antarmuka: 'PapanMutu',
      ambil: (d) => d,
    },
    {
      nama: 'breakGlassQueue',
      jalan: '/health/security/break-glass/queue?limit=5',
      antarmuka: 'AntreanTelaah',
      ambil: (d) => d,
    },
    {
      nama: 'breakGlassReviews',
      jalan: '/health/security/break-glass/reviews?limit=5',
      antarmuka: 'RiwayatTelaah',
      ambil: (d) => d,
    },
    {
      nama: 'breakGlassSummary',
      jalan: '/health/security/break-glass/summary',
      antarmuka: 'RingkasTelaah',
      ambil: (d) => d,
    },
  ];
  if (pasien) {
    kontrak.push({
      nama: 'legalHolds',
      jalan: `/health/him/legal-holds/${pasien.id}`,
      antarmuka: 'StatusPenahanan',
      ambil: (d) => d,
    });
    kontrak.push({
      nama: 'immunizationStatus',
      jalan: `/health/community/immunization/${pasien.id}`,
      antarmuka: 'StatusImunisasi',
      ambil: (d) => d,
    });
    kontrak.push({
      nama: 'growthHistory',
      jalan: `/health/community/growth/${pasien.id}`,
      antarmuka: 'BarisPertumbuhan',
      ambil: (d) => d?.[0],
    });
    kontrak.push({
      nama: 'accessLog',
      jalan: `/health/patients/${pasien.id}/access-log`,
      antarmuka: 'JejakAkses',
      ambil: (d) => d?.[0],
    });
  }

  log('');
  log('--- Medan wajib klien harus ada pada jawaban peladen -------------------');

  let takTerbukti = 0;
  for (const k of kontrak) {
    const diharapkan = medanWajib(sumber, k.antarmuka);
    if (!diharapkan) {
      check(`${k.nama} — antarmuka ${k.antarmuka} tidak ditemukan pada health-api.ts`, false);
      continue;
    }

    const r = await amb(k.jalan);
    if (r.status !== 200) {
      check(`${k.nama} — jawaban ${r.status}`, false, k.jalan);
      continue;
    }

    const contoh = k.ambil(r.data);
    if (contoh == null || typeof contoh !== 'object') {
      /*
       * Tidak ada baris untuk diperiksa. DILAPORKAN, bukan didiamkan: naskah
       * yang menghitung jalan tanpa data sebagai "lulus" akan berkata seluruh
       * kontrak terbukti sekalipun tidak satu pun barisnya pernah dilihat.
       */
      takTerbukti += 1;
      log(`  LEWAT  ${k.nama} — tidak ada baris untuk diperiksa (${k.antarmuka})`);
      continue;
    }

    const ada = new Set(Object.keys(contoh));
    const hilang = diharapkan.filter((m) => !ada.has(m));
    check(
      `${k.nama} → ${k.antarmuka} (${diharapkan.length} medan wajib)`,
      hilang.length === 0,
      hilang.length ? `hilang: ${hilang.join(', ')}` : '',
    );
  }

  log('');
  log('--- Penolakan yang dapat dibaca, bukan 500 -----------------------------');

  /*
   * Layar Pertumbuhan mencari SELURUH pasien, bukan hanya balita — sebab
   * pencarian yang menyaring umur akan menyembunyikan anak yang tanggal
   * lahirnya keliru tercatat, dan anak itu justru yang paling perlu ditemukan.
   *
   * Akibatnya petugas dapat memilih pasien dewasa. Sebelum perbaikan ini,
   * jawabannya 500 INTERNAL_ERROR dari pelanggaran constraint — pesan yang
   * tidak memberi tahu apa pun.
   */
  const dewasa = (
    await q(
      `SELECT id::text AS id FROM "${SCHEMA}".patient
        WHERE deleted_at IS NULL AND birth_date IS NOT NULL
          AND birth_date < (CURRENT_DATE - INTERVAL '30 years')
        ORDER BY birth_date LIMIT 1`,
    )
  )[0];

  if (dewasa) {
    const r = await kirim('/health/community/growth', {
      patientId: dewasa.id,
      facilityId,
      weightKg: 62,
      heightCm: 165,
      heightMeasuredAs: 'STANDING',
    });
    const pesan = JSON.stringify(r.data ?? {});
    check(
      'menimbang pasien dewasa ditolak 422, BUKAN 500',
      r.status === 422,
      `status ${r.status}`,
    );
    check(
      'dan penolakannya menyebutkan umurnya serta jalan keluarnya',
      /tanggal lahirnya yang perlu diperbaiki/.test(pesan),
      pesan.slice(0, 140),
    );
  } else {
    log('  LEWAT  tidak ada pasien dewasa untuk menguji penolakan umur');
  }

  log('');
  log(`  ${takTerbukti} jalan tidak dapat dibuktikan karena tidak ada barisnya.`);
  log('  Angka itu BUKAN kelulusan. Ia daftar yang masih harus dilihat orang.');

  log('');
  log('='.repeat(78));
  log(
    failures === 0
      ? `SELURUH KONTRAK YANG DAPAT DIPERIKSA COCOK (${lines.filter((l) => l.includes('LULUS')).length})`
      : `${failures} KONTRAK TIDAK COCOK`,
  );
  log('='.repeat(78));
} finally {
  await client.end();
  writeFileSync(
    new URL('../../../docs/emedik/bukti-kontrak-web.txt', import.meta.url),
    lines.join('\n'),
    'utf8',
  );
}

process.exit(failures === 0 ? 0 : 1);
