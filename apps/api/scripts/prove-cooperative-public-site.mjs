/**
 * Bukti situs publik koperasi dan pembatas lajunya.
 *
 * Yang dibuktikan adalah rantai penuhnya pada basis data sungguhan:
 *
 *   host permintaan → penyewa → koperasi → isi situs
 *
 * dan bahwa jalur itu **menolak** setiap jalan pintasnya: host yang tidak
 * terdaftar, host yang belum terbukti dimiliki, situs yang belum diterbitkan,
 * dan kiriman yang membanjiri antrean pengurus.
 *
 * Seluruhnya di dalam BEGIN … ROLLBACK.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import {
  BATAS_HARIAN_PER_KOPERASI,
  JEDA_NOMOR_SAMA_DETIK,
  bolehMenerimaLamaran,
  normalkanTelepon,
  periksaIsian,
  sidikSumber,
} from '../dist/modules/cooperative/public/public-intake.js';
import {
  bolehDipakaiMencari,
  bolehMemakaiPencocokan,
  normalkanHost,
} from '../dist/infrastructure/tenant/public-host.js';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^"|"$/g, '');

const client = new pg.Client({ connectionString: url });
const lines = [];
const log = (t) => { lines.push(t); console.log(t); };

let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${label}${ok || !detail ? '' : `  (${detail})`}`);
}

const q = async (sql, params = []) => (await client.query(sql, params)).rows;
const tag = randomBytes(3).toString('hex');
const S = process.env.COOPERATIVE_SCHEMA ?? 'demo';
const HOST = `koperasi-${tag}.ekoperasi.id`;

await client.connect();
await client.query('BEGIN');

try {
  log('='.repeat(78));
  log('BUKTI SITUS PUBLIK KOPERASI DAN PEMBATAS LAJUNYA');
  log(`Waktu  : ${new Date().toISOString()}`);
  log(`Schema : ${S}`);
  log('='.repeat(78));

  // ------------------------------------------------------ Rantai resolusi
  log('');
  log('1. Host permintaan menentukan koperasi — bukan alamat');

  const penyewa = await q(
    `SELECT t.id, r.schema_name FROM platform.tenant t
       JOIN platform.tenant_schema_registry r ON r.tenant_id = t.id
      WHERE r.schema_name = $1 AND r.status = 'READY'`,
    [S],
  );
  if (!penyewa.length) throw new Error(`penyewa untuk skema ${S} tidak siap`);

  // Host belum terdaftar sama sekali.
  const belumAda = bolehMemakaiPencocokan(null, null);
  check('host yang belum terdaftar DITOLAK', belumAda.allowed === false, belumAda.code);
  check('penolakannya berbunyi "Situs tidak ditemukan."', belumAda.message === 'Situs tidak ditemukan.');

  await q(
    `INSERT INTO platform.vertical_site_domain
       (tenant_id, host, vertical, status, updated_at)
     VALUES ($1, $2, 'cooperative', 'PENDING', now())`,
    [penyewa[0].id, HOST],
  );

  const belumTerbukti = await q(
    `SELECT d.host, d.tenant_id, d.vertical, d.status, d.verified_at,
            r.schema_name, r.status AS rs
       FROM platform.vertical_site_domain d
       JOIN platform.tenant_schema_registry r ON r.tenant_id = d.tenant_id
      WHERE d.host = $1`,
    [HOST],
  );
  const v1 = bolehMemakaiPencocokan(
    {
      host: belumTerbukti[0].host,
      tenantId: belumTerbukti[0].tenant_id,
      vertical: belumTerbukti[0].vertical,
      status: belumTerbukti[0].status,
      verifiedAt: belumTerbukti[0].verified_at?.toISOString() ?? null,
    },
    {
      tenantId: belumTerbukti[0].tenant_id,
      schemaName: belumTerbukti[0].schema_name,
      status: belumTerbukti[0].rs,
    },
  );
  check(
    'host yang BELUM terbukti dimiliki DITOLAK',
    v1.allowed === false,
    v1.code,
  );

  await q(
    `UPDATE platform.vertical_site_domain
        SET status = 'ACTIVE', verified_at = now(), updated_at = now()
      WHERE host = $1`,
    [HOST],
  );

  const terbukti = await q(
    `SELECT d.host, d.tenant_id, d.vertical, d.status, d.verified_at,
            r.schema_name, r.status AS rs
       FROM platform.vertical_site_domain d
       JOIN platform.tenant_schema_registry r ON r.tenant_id = d.tenant_id
      WHERE d.host = $1`,
    [HOST],
  );
  const v2 = bolehMemakaiPencocokan(
    {
      host: terbukti[0].host,
      tenantId: terbukti[0].tenant_id,
      vertical: terbukti[0].vertical,
      status: terbukti[0].status,
      verifiedAt: terbukti[0].verified_at?.toISOString() ?? null,
    },
    {
      tenantId: terbukti[0].tenant_id,
      schemaName: terbukti[0].schema_name,
      status: terbukti[0].rs,
    },
  );
  check('host terbukti DITERIMA', v2.allowed === true, v2.code);
  check(
    `skema yang diperoleh "${terbukti[0].schema_name}" — dari registry, bukan alamat`,
    terbukti[0].schema_name === S,
  );

  for (const jahat of ['localhost', '203.0.113.10', 'koperasi', 'koperasi.ekoperа si.id']) {
    const h = normalkanHost(jahat);
    const vonis = bolehDipakaiMencari(h);
    check(`host "${jahat}" ditolak sebelum menyentuh basis data`, vonis.allowed === false, vonis.code);
  }

  // ------------------------------------------------- Situs belum terbit
  log('');
  log('2. Situs yang belum diterbitkan tidak melayani siapa pun');

  const jenis = await q(
    `INSERT INTO "${S}".cooperative_type (code, name) VALUES ($1, 'KSU Bukti Situs') RETURNING id`,
    [`STS_${tag}`.slice(0, 32)],
  );
  const kopLama = await q(`SELECT id FROM "${S}".cooperative WHERE deleted_at IS NULL LIMIT 1`);
  let KOP;
  if (kopLama.length) {
    KOP = kopLama[0].id;
  } else {
    const r = await q(
      `INSERT INTO "${S}".cooperative (code, name, slug, cooperative_type_id, status,
         legal_entity_number, membership_scope)
       VALUES ($1, 'Koperasi Bukti Situs', $2, $3, 'ACTIVE', '518/BH/2020', 'OPEN')
       RETURNING id`,
      [`STS-${tag}`, `bukti-situs-${tag}`, jenis[0].id],
    );
    KOP = r[0].id;
  }

  await q(
    `INSERT INTO "${S}".cooperative_website_setting (cooperative_id, is_published)
     VALUES ($1, FALSE)
     ON CONFLICT (cooperative_id) DO UPDATE SET is_published = FALSE`,
    [KOP],
  );

  const terbitDulu = await q(
    `SELECT 1 FROM "${S}".cooperative c
       JOIN "${S}".cooperative_website_setting s ON s.cooperative_id = c.id
      WHERE s.is_published = TRUE AND c.deleted_at IS NULL`,
  );
  check('situs belum terbit TIDAK terbaca jalur publik', terbitDulu.length === 0);

  await q(
    `UPDATE "${S}".cooperative_website_setting
        SET is_published = TRUE, accepts_online_application = TRUE
      WHERE cooperative_id = $1`,
    [KOP],
  );
  await q(
    `UPDATE "${S}".cooperative SET status = 'ACTIVE', membership_scope = 'OPEN',
        legal_entity_number = COALESCE(legal_entity_number, '518/BH/2020')
      WHERE id = $1`,
    [KOP],
  );

  const terbitSekarang = await q(
    `SELECT c.name FROM "${S}".cooperative c
       JOIN "${S}".cooperative_website_setting s ON s.cooperative_id = c.id
      WHERE s.is_published = TRUE AND c.deleted_at IS NULL`,
  );
  check('setelah diterbitkan, situsnya terbaca', terbitSekarang.length === 1);

  const setelan = await q(
    `SELECT show_member_count, show_asset_total FROM "${S}".cooperative_website_setting
      WHERE cooperative_id = $1`,
    [KOP],
  );
  check(
    'jumlah anggota dan besar aset TETAP tidak ditampilkan tanpa dinyalakan',
    setelan[0].show_member_count === false && setelan[0].show_asset_total === false,
  );

  // ------------------------------------------------------ Pembatas laju
  log('');
  log('3. Antrean pengurus dijaga — bukan hanya peladennya');

  check(
    'kiriman pertama diterima',
    bolehMenerimaLamaran({
      lamaranHariIni: 0,
      detikSejakNomorTerakhir: null,
      adaYangMasihMenunggu: false,
    }).allowed === true,
  );

  check(
    'nomor yang lamarannya masih menunggu DITOLAK',
    bolehMenerimaLamaran({
      lamaranHariIni: 1,
      detikSejakNomorTerakhir: 10,
      adaYangMasihMenunggu: true,
    }).code === 'ALREADY_PENDING',
  );

  check(
    'nomor yang sama dalam jeda DITOLAK',
    bolehMenerimaLamaran({
      lamaranHariIni: 1,
      detikSejakNomorTerakhir: 60,
      adaYangMasihMenunggu: false,
    }).code === 'PHONE_COOLDOWN',
  );

  check(
    `kuota harian ${BATAS_HARIAN_PER_KOPERASI} lamaran DITEGAKKAN`,
    bolehMenerimaLamaran({
      lamaranHariIni: BATAS_HARIAN_PER_KOPERASI,
      detikSejakNomorTerakhir: null,
      adaYangMasihMenunggu: false,
    }).code === 'DAILY_QUOTA_REACHED',
  );

  check(
    'setelah jedanya lewat, diterima lagi',
    bolehMenerimaLamaran({
      lamaranHariIni: 1,
      detikSejakNomorTerakhir: JEDA_NOMOR_SAMA_DETIK + 1,
      adaYangMasihMenunggu: false,
    }).allowed === true,
  );

  // ----------------------------------------- Kueri antrean pada basis data
  log('');
  log('4. Keadaan antrean dibaca dari basis data yang sungguhan');

  const telepon = normalkanTelepon('+62 812-3456-7890');
  check('nomor telepon dinormalkan', telepon === '081234567890');

  /*
   * Alamat ini ditulis melalui sidikSumber(), sama seperti jalur sungguhan,
   * supaya pemeriksaan di bagian 6 menguji nilai yang benar-benar disimpan —
   * bukan kolom kosong.
   */
  const IP_UJI = '203.0.113.10';
  await q(
    `INSERT INTO "${S}".cooperative_public_application
       (cooperative_id, application_number, full_name, phone, consent_given, consent_at,
        source_ip_hash)
     VALUES ($1, $2, 'Calon Anggota Uji', $3, TRUE, now(), $4)`,
    [KOP, `APP-UJI-${tag}`, telepon, sidikSumber(IP_UJI, 'penyewa-uji')],
  );

  const keadaan = await q(
    `SELECT
       (SELECT COUNT(*)::int FROM "${S}".cooperative_public_application
         WHERE cooperative_id = $1 AND submitted_at > now() - interval '24 hours') AS hari_ini,
       (SELECT EXTRACT(EPOCH FROM (now() - MAX(submitted_at)))::int
          FROM "${S}".cooperative_public_application
         WHERE cooperative_id = $1 AND phone = $2) AS detik_terakhir,
       (SELECT EXISTS(SELECT 1 FROM "${S}".cooperative_public_application
         WHERE cooperative_id = $1 AND phone = $2
           AND status IN ('SUBMITTED','UNDER_REVIEW','NEED_DOCUMENT'))) AS menunggu`,
    [KOP, telepon],
  );

  check('kueri antrean membaca lamaran hari ini', Number(keadaan[0].hari_ini) >= 1);
  check('kueri antrean menemukan lamaran yang menunggu', keadaan[0].menunggu === true);

  const vonisUlang = bolehMenerimaLamaran({
    lamaranHariIni: Number(keadaan[0].hari_ini),
    detikSejakNomorTerakhir: Number(keadaan[0].detik_terakhir),
    adaYangMasihMenunggu: keadaan[0].menunggu === true,
  });
  check(
    'kiriman KEDUA dari nomor yang sama DITOLAK',
    vonisUlang.allowed === false,
    vonisUlang.code,
  );

  /*
   * Nomor dalam bentuk lain harus tertangkap penyaring yang sama. Bila tidak,
   * pengirim cukup mengganti bentuknya untuk melewati jedanya.
   */
  const bentukLain = normalkanTelepon('6281234567890');
  const keadaanLain = await q(
    `SELECT EXISTS(SELECT 1 FROM "${S}".cooperative_public_application
       WHERE cooperative_id = $1 AND phone = $2
         AND status IN ('SUBMITTED','UNDER_REVIEW','NEED_DOCUMENT')) AS menunggu`,
    [KOP, bentukLain],
  );
  check(
    'nomor yang sama dalam bentuk lain TETAP tertangkap',
    keadaanLain[0].menunggu === true,
    `dinormalkan menjadi ${bentukLain}`,
  );

  // ------------------------------------------------------- Mutu isian
  log('');
  log('5. Kiriman yang jelas bukan dari manusia tidak sampai ke meja pengurus');

  for (const [label, isian, kode] of [
    ['nama berupa tautan', { fullName: 'http://spam.example', phone: '081234567890' }, 'NAME_HAS_LINK'],
    ['nama tanpa huruf', { fullName: '123456', phone: '081234567890' }, 'NAME_NOT_A_NAME'],
    ['nomor tidak sah', { fullName: 'Siti Rahayu', phone: '12345' }, 'PHONE_INVALID'],
    [
      'uraian bertabur tautan',
      {
        fullName: 'Siti Rahayu',
        phone: '081234567890',
        motivation: 'https://a.example https://b.example https://c.example',
      },
      'TOO_MANY_LINKS',
    ],
  ]) {
    check(`${label} DITOLAK`, periksaIsian(isian).code === kode);
  }

  check(
    'calon anggota yang menyertakan SATU tautan usahanya DITERIMA',
    periksaIsian({
      fullName: 'Siti Rahayu',
      phone: '081234567890',
      motivation: 'Saya punya warung, https://warungsaya.example',
    }).allowed === true,
  );

  check(
    'nama yang memuat angka DITERIMA — kartu identitas kadang begitu',
    periksaIsian({ fullName: 'Siti Rahayu 2', phone: '081234567890' }).allowed === true,
  );

  // ---------------------------------------- Karantina tetap berlaku
  log('');
  log('6. Lamaran berhenti pada karantina — tidak menjadi anggota');

  const anggotaBaru = await q(
    `SELECT 1 FROM "${S}".cooperative_member WHERE full_name = 'Calon Anggota Uji'`,
  );
  check('lamaran TIDAK membentuk baris anggota', anggotaBaru.length === 0);

  const sidik = await q(
    `SELECT source_ip_hash FROM "${S}".cooperative_public_application
      WHERE application_number = $1`,
    [`APP-UJI-${tag}`],
  );
  /*
   * Pemeriksaan ini pernah berbunyi:
   *
   *   sidik[0].source_ip_hash === null || !/^\d+\.\d+\.\d+\.\d+$/.test(…)
   *
   * dan LULUS dua kali secara sia-sia. Kolomnya tidak pernah diisi pada baris
   * uji, sehingga cabang `=== null` yang menjawabnya; dan seandainya terisi,
   * polanya berjangkar sehingga `penyewa-1:203.0.113.10` pun lolos — dengan
   * alamatnya tertulis utuh di sana.
   *
   * Sekarang diperiksa kebalikannya, pada nilai yang sungguh tersimpan.
   */
  const tersimpan = sidik[0]?.source_ip_hash;
  check('kolom sidik sumber terisi', sidik.length === 1 && typeof tersimpan === 'string');
  check(
    'alamat mentah TIDAK muncul di mana pun pada sidiknya',
    typeof tersimpan === 'string' && !tersimpan.includes(IP_UJI) && !tersimpan.includes('203'),
  );
  check(
    'sidiknya heksadesimal berukuran tetap',
    typeof tersimpan === 'string' && /^[0-9a-f]{32}$/.test(tersimpan),
  );
  check(
    'penyewa berbeda menyidik alamat sama secara berbeda',
    sidikSumber(IP_UJI, 'penyewa-uji') !== sidikSumber(IP_UJI, 'penyewa-lain'),
  );

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  await client.query('ROLLBACK');
  log('');
  log('Seluruh perubahan digulung balik — basis data tidak berubah.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/ekoperasi/bukti-situs-publik.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
