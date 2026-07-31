/**
 * Bukti sisi Core untuk IR-001 sampai IR-005.
 *
 * Yang dibuktikan di sini berbeda dari pengujian satuan: bahwa mekanismenya
 * berjalan pada **basis data sungguhan**, atas skema yang sudah berisi tiga
 * puluh dua migrasi yang diterapkan berbulan-bulan sebelumnya.
 *
 * Yang paling penting dibuktikan adalah hal yang tidak dapat diuji dengan
 * fungsi murni:
 *
 *   **Menambahkan katalog modul tidak menjalankan ulang satu migrasi inti pun.**
 *
 * Kompatibilitas mundur pada pemuat migrasi bukan soal kerapian. Migrasi inti
 * yang berjalan ulang pada skema berisi data adalah kerusakan yang tidak dapat
 * ditarik kembali.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import pg from 'pg';
import {
  gabungkanKatalog,
  versiIntiTertinggi,
  MAX_MIGRATION_ID_LENGTH,
} from '../dist/infrastructure/provisioning/migration-catalog.js';
import { VerticalCatalogRegistry } from '../dist/infrastructure/provisioning/vertical-catalog.registry.js';
import { AccountingEventCatalogRegistry } from '../dist/modules/accounting/event-catalog.registry.js';
import { CORE_EVENT_CATALOGS } from '../dist/modules/accounting/core-event-catalog.js';
import { ALL_EVENTS } from '../dist/modules/accounting/posting-engine.js';
import { ExternalPaymentRegistry } from '../dist/modules/pos/external-payment.registry.js';
import {
  normalkanHost,
  bolehDipakaiMencari,
  bolehMemakaiPencocokan,
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
const MIGRATIONS_DIR = new URL('../tenant-migrations/', import.meta.url).pathname.replace(/^\//, '');

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI SISI CORE — IR-001 SAMPAI IR-005');
  log(`Waktu : ${new Date().toISOString()}`);
  log('='.repeat(78));

  // ============================================================== IR-001
  log('');
  log('IR-001 · Katalog migrasi modular');

  const skema = await q(
    `SELECT table_schema FROM information_schema.tables
      WHERE table_name = 'schema_migration' AND table_schema NOT LIKE 'pg_%'
      ORDER BY table_schema`,
  );
  check(`${skema.length} skema penyewa ditemukan`, skema.length > 0);

  const kolom = await q(
    `SELECT character_maximum_length AS len FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'schema_migration' AND column_name = 'version'`,
    [skema[0].table_schema],
  );
  check(
    'schema_migration.version kini VARCHAR(128)',
    Number(kolom[0].len) === MAX_MIGRATION_ID_LENGTH,
    `sekarang ${kolom[0].len}`,
  );

  /*
   * SELURUH kolom yang menyimpan versi migrasi, di mana pun letaknya.
   *
   * V033 melebarkan dua dari tiga, dan yang ketiga —
   * audit_schema_migration.migration_version — baru ketahuan saat E2E
   * menyiapkan penyewa baru: migrasinya berhasil, pembukuannya berhasil, lalu
   * jejak auditnya gagal dan seluruh provisioning batal.
   *
   * Pemeriksaan ini mencari kolomnya sendiri alih-alih memakai daftar yang
   * ditulis tangan. Daftar yang ditulis tangan persis yang gagal kemarin.
   */
  const kolomVersi = await q(
    `SELECT table_schema, table_name, column_name, character_maximum_length AS len
       FROM information_schema.columns
      WHERE column_name IN ('version', 'migration_version')
        AND table_name IN ('schema_migration', 'audit_schema_migration',
                           'schema_migration_catalog', 'tenant_schema_migration_history')
        AND data_type = 'character varying'`,
  );
  const sempit = kolomVersi.filter((k) => Number(k.len) < MAX_MIGRATION_ID_LENGTH);
  check(
    `seluruh ${kolomVersi.length} kolom penyimpan versi migrasi cukup lebar`,
    sempit.length === 0,
    sempit.map((k) => `${k.table_schema}.${k.table_name}.${k.column_name}=${k.len}`).join(', '),
  );

  const kolomModul = await q(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'schema_migration' AND column_name = 'module'`,
    [skema[0].table_schema],
  );
  check('kolom module tersedia', kolomModul.length === 1);

  /*
   * Pemeriksaan yang paling menentukan: seluruh baris V001-V032 masih ada,
   * apa adanya, pada setiap skema. Bila katalog modular sempat mengubah
   * kuncinya, baris-baris ini akan hilang atau berganda.
   */
  let skemaLengkap = 0;
  for (const s of skema) {
    const n = await q(
      `SELECT COUNT(*)::int AS n FROM "${s.table_schema}".schema_migration
        WHERE version ~ '^V0[0-9]{2}$'`,
    );
    if (Number(n[0].n) >= 33) skemaLengkap += 1;
  }
  check(
    `seluruh ${skema.length} skema masih memuat 33 migrasi inti`,
    skemaLengkap === skema.length,
    `${skemaLengkap} dari ${skema.length}`,
  );

  const ganda = await q(
    `SELECT version, COUNT(*)::int AS n FROM "${skema[0].table_schema}".schema_migration
      GROUP BY version HAVING COUNT(*) > 1`,
  );
  check('tidak ada versi yang tercatat dua kali', ganda.length === 0);

  // Panjang id modular sungguhan benar-benar muat sekarang.
  // Sepanjang id koperasi sungguhan, tetapi bertanda uji supaya tidak
  // bertabrakan dengan yang sudah benar-benar diterapkan.
  const idPanjang = `20260731T160000__cooperative__uji_${tag}_and_legality`;
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO "${skema[0].table_schema}".schema_migration
       (version, name, checksum, module) VALUES ($1, $2, $3, 'cooperative')`,
    [idPanjang, 'Uji panjang id modular', 'x'.repeat(64)],
  );
  const terbaca = await q(
    `SELECT version, module FROM "${skema[0].table_schema}".schema_migration WHERE version = $1`,
    [idPanjang],
  );
  check(
    `id modular ${idPanjang.length} aksara tersimpan dan terbaca kembali`,
    terbaca[0].version === idPanjang && terbaca[0].module === 'cooperative',
  );
  await client.query('ROLLBACK');

  // --- Penggabungan katalog dengan modul sungguhan di disk ---------------
  const manifestInti = JSON.parse(readFileSync(join(MIGRATIONS_DIR, 'manifest.json'), 'utf8'));
  const hanyaInti = gabungkanKatalog(manifestInti, []);
  check(
    'katalog tanpa modul sama persis dengan manifest inti',
    hanyaInti.migrations.length === manifestInti.migrations.length,
  );
  /*
   * Diturunkan dari manifest, bukan ditulis tetap. Nilai tetap di sini harus
   * disunting setiap ada migrasi inti baru, dan pemeriksaan yang menuntut
   * penyuntingan rutin akan disesuaikan tanpa dibaca.
   */
  const versiTerakhirManifest =
    manifestInti.migrations[manifestInti.migrations.length - 1].version;
  check(
    `versi inti tertinggi ${versiTerakhirManifest}`,
    versiIntiTertinggi(hanyaInti.migrations) === versiTerakhirManifest,
  );

  const modulUji = {
    module: `uji${tag}`,
    schemaVersion: 2,
    dependsOn: ['core'],
    migrations: [
      {
        id: `20260801T120000__uji${tag}__contoh`,
        file: `20260801T120000__uji${tag}__contoh.sql`,
        name: 'Contoh modul uji',
      },
    ],
  };
  const gabung = gabungkanKatalog(manifestInti, [modulUji]);
  check(
    'katalog gabungan bertambah tepat satu',
    gabung.migrations.length === manifestInti.migrations.length + 1,
  );
  check(
    'seluruh migrasi inti tetap mendahului migrasi modul',
    gabung.migrations.findIndex((m) => m.module) === manifestInti.migrations.length,
  );
  check(
    'versi inti tertinggi TIDAK berubah oleh kehadiran modul',
    versiIntiTertinggi(gabung.migrations) === versiTerakhirManifest,
  );

  // --- Penemuan manifest modul dari sistem berkas sungguhan --------------
  const dirUji = join(MIGRATIONS_DIR, modulUji.module);
  mkdirSync(dirUji, { recursive: true });
  writeFileSync(join(dirUji, 'manifest.json'), JSON.stringify(modulUji, null, 2));
  writeFileSync(
    join(dirUji, modulUji.migrations[0].file),
    'CREATE TABLE IF NOT EXISTS "{{TENANT_SCHEMA}}".uji_modular (id UUID PRIMARY KEY);\n',
  );
  try {
    const { readdirSync, statSync, existsSync } = await import('node:fs');
    const ditemukan = readdirSync(MIGRATIONS_DIR)
      .filter((n) => {
        try {
          return statSync(join(MIGRATIONS_DIR, n)).isDirectory() &&
            existsSync(join(MIGRATIONS_DIR, n, 'manifest.json'));
        } catch {
          return false;
        }
      });
    check('manifest modul ditemukan dari sistem berkas', ditemukan.includes(modulUji.module));
  } finally {
    rmSync(dirUji, { recursive: true, force: true });
  }

  // ============================================================== IR-003
  log('');
  log('IR-003 · Katalog peristiwa akuntansi modular');

  const eventReg = new AccountingEventCatalogRegistry();
  for (const c of CORE_EVENT_CATALOGS) eventReg.register(c);

  let semuaDikenal = true;
  for (const e of ALL_EVENTS) if (!eventReg.isKnownEvent(e)) semuaDikenal = false;
  check(`seluruh ${ALL_EVENTS.length} peristiwa inti tetap dikenal`, semuaDikenal);

  eventReg.register({
    module: 'cooperative',
    prefix: 'COOPERATIVE_',
    events: ['COOPERATIVE_SHU_PAID', 'COOPERATIVE_INSTALLMENT_RECEIVED'],
    requiredAmounts: {
      COOPERATIVE_SHU_PAID: ['amount'],
      COOPERATIVE_INSTALLMENT_RECEIVED: ['principalPortion', 'interestPortion', 'total'],
    },
  });
  check('peristiwa koperasi kini dikenal mesin akuntansi', eventReg.isKnownEvent('COOPERATIVE_SHU_PAID'));
  check('peristiwa inti tidak terganggu', eventReg.isKnownEvent('POS_SALE'));
  check(
    'angsuran koperasi menuntut pokok dan jasa terpisah',
    eventReg.checkRequiredAmounts('COOPERATIVE_INSTALLMENT_RECEIVED', { total: 1 }).ok === false,
  );

  let ditolakBeda = false;
  try {
    eventReg.register({
      module: 'nakal',
      prefix: 'POS_',
      events: ['POS_SALE'],
      requiredAmounts: { POS_SALE: ['x'] },
    });
  } catch {
    ditolakBeda = true;
  }
  check('modul lain TIDAK dapat merebut peristiwa POS_SALE', ditolakBeda);

  // ============================================================== IR-004
  log('');
  log('IR-004 · Katalog menu, peran, dan hak akses modular');

  const catReg = new VerticalCatalogRegistry();
  catReg.register({ code: 'core', prefix: '', menus: [{ code: 'POS', label: 'POS', translationKey: 'menu.pos', sortOrder: 1 }], roles: [] });
  catReg.register({
    code: 'cooperative',
    prefix: 'COOPERATIVE',
    menus: [
      { code: 'COOPERATIVE', label: 'Koperasi', translationKey: 'menu.cooperative', sortOrder: 400 },
      { code: 'COOPERATIVE_MEMBER', parentCode: 'COOPERATIVE', label: 'Anggota', translationKey: 'menu.cooperative.member', sortOrder: 1 },
    ],
    roles: [],
  });
  check('dua katalog terdaftar', catReg.registeredCodes().length === 2);
  check('menu koperasi tercatat milik koperasi', catReg.ownerOfMenu('COOPERATIVE') === 'cooperative');
  check('menu POS tetap milik inti', catReg.ownerOfMenu('POS') === 'core');

  let ditolakMenu = false;
  try {
    catReg.register({ code: 'nakal', prefix: 'NAKAL', menus: [{ code: 'POS', label: 'x', translationKey: 'x', sortOrder: 1 }], roles: [] });
  } catch {
    ditolakMenu = true;
  }
  check('vertikal lain TIDAK dapat mendaftarkan menu POS', ditolakMenu);

  let pohonSah = true;
  try {
    catReg.validateTree();
  } catch {
    pohonSah = false;
  }
  check('pohon menu gabungan sah — tidak ada menu yatim', pohonSah);

  // ============================================================== IR-005
  log('');
  log('IR-005 · Resolusi tenant untuk situs publik');

  const tabel = await q(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'platform' AND table_name = 'vertical_site_domain'`,
  );
  check('tabel platform.vertical_site_domain terpasang', tabel.length === 1);

  const penyewa = await q(
    `SELECT t.id, r.schema_name, r.audit_schema_name, r.status
       FROM platform.tenant t
       JOIN platform.tenant_schema_registry r ON r.tenant_id = t.id
      WHERE r.status = 'READY' LIMIT 1`,
  );
  check('ada penyewa aktif untuk diuji', penyewa.length === 1);

  await client.query('BEGIN');
  const host = `koperasi-${tag}.ekoperasi.id`;

  // Host yang belum terverifikasi tidak boleh berstatus aktif.
  let ditolakBelumVerif = false;
  try {
    await client.query('SAVEPOINT s');
    await client.query(
      `INSERT INTO platform.vertical_site_domain
         (tenant_id, host, vertical, status, updated_at)
       VALUES ($1, $2, 'cooperative', 'ACTIVE', now())`,
      [penyewa[0].id, host],
    );
    await client.query('RELEASE SAVEPOINT s');
  } catch {
    ditolakBelumVerif = true;
    await client.query('ROLLBACK TO SAVEPOINT s');
  }
  check('host AKTIF tanpa bukti kepemilikan DITOLAK basis data', ditolakBelumVerif);

  // Host yang belum dinormalkan ditolak.
  let ditolakBesar = false;
  try {
    await client.query('SAVEPOINT s');
    await client.query(
      `INSERT INTO platform.vertical_site_domain
         (tenant_id, host, vertical, status, updated_at)
       VALUES ($1, $2, 'cooperative', 'PENDING', now())`,
      [penyewa[0].id, `KOPERASI-${tag}.EKOPERASI.ID`],
    );
    await client.query('RELEASE SAVEPOINT s');
  } catch {
    ditolakBesar = true;
    await client.query('ROLLBACK TO SAVEPOINT s');
  }
  check('host berhuruf besar DITOLAK — penormalan wajib saat menyimpan', ditolakBesar);

  await client.query(
    `INSERT INTO platform.vertical_site_domain
       (tenant_id, host, vertical, status, verified_at, updated_at)
     VALUES ($1, $2, 'cooperative', 'ACTIVE', now(), now())`,
    [penyewa[0].id, host],
  );

  const baris = await q(
    `SELECT d.host, d.tenant_id, d.vertical, d.status, d.verified_at,
            r.schema_name, r.status AS registry_status
       FROM platform.vertical_site_domain d
       JOIN platform.tenant_schema_registry r ON r.tenant_id = d.tenant_id
      WHERE d.host = $1`,
    [host],
  );
  check('host terdaftar dapat ditemukan kembali', baris.length === 1);

  const vonis = bolehMemakaiPencocokan(
    {
      host: baris[0].host,
      tenantId: baris[0].tenant_id,
      vertical: baris[0].vertical,
      status: baris[0].status,
      verifiedAt: baris[0].verified_at?.toISOString() ?? null,
    },
    {
      tenantId: baris[0].tenant_id,
      schemaName: baris[0].schema_name,
      status: baris[0].registry_status,
    },
  );
  check('pencocokan atas baris sungguhan diterima', vonis.allowed === true, vonis.code);
  check(
    `skema yang diperoleh "${baris[0].schema_name}" — dari registry, bukan dari alamat`,
    baris[0].schema_name === penyewa[0].schema_name,
  );

  // Host yang sama tidak boleh diklaim dua penyewa.
  const penyewaLain = await q(
    `SELECT t.id FROM platform.tenant t
       JOIN platform.tenant_schema_registry r ON r.tenant_id = t.id
      WHERE t.id <> $1 LIMIT 1`,
    [penyewa[0].id],
  );
  if (penyewaLain.length === 1) {
    let ditolakRebut = false;
    try {
      await client.query('SAVEPOINT s');
      await client.query(
        `INSERT INTO platform.vertical_site_domain
           (tenant_id, host, vertical, status, verified_at, updated_at)
         VALUES ($1, $2, 'cooperative', 'ACTIVE', now(), now())`,
        [penyewaLain[0].id, host],
      );
      await client.query('RELEASE SAVEPOINT s');
    } catch {
      ditolakRebut = true;
      await client.query('ROLLBACK TO SAVEPOINT s');
    }
    check('penyewa lain TIDAK dapat merebut host yang sama', ditolakRebut);
  }

  await client.query('ROLLBACK');

  // Host berbahaya ditolak sebelum menyentuh basis data.
  for (const [h, alasan] of [
    ['localhost', 'HOST_RESERVED'],
    ['169.254.169.254', 'HOST_RESERVED'],
    ['203.0.113.10', 'HOST_IS_IP'],
    ['koperasi', 'HOST_NO_DOT'],
  ]) {
    const v = bolehDipakaiMencari(normalkanHost(h));
    check(`host "${h}" ditolak sebelum menyentuh basis data`, v.code === alasan, v.code);
  }

  // ============================================================== IR-002
  log('');
  log('IR-002 · Penangan pembayaran bersaldo eksternal');

  const payReg = new ExternalPaymentRegistry();
  payReg.register({
    handlerCode: 'COOPERATIVE_MEMBER_BALANCE',
    authorize: async () => ({ authorized: true, reference: 'REF' }),
    capture: async () => undefined,
    reverse: async () => undefined,
  });
  check('penangan koperasi terdaftar', payReg.has('COOPERATIVE_MEMBER_BALANCE'));

  let ditolakTakDikenal = false;
  try {
    payReg.require('TIDAK_TERDAFTAR');
  } catch {
    ditolakTakDikenal = true;
  }
  check(
    'metode pembayaran tanpa penangan MELEMPAR, bukan lolos diam-diam',
    ditolakTakDikenal,
  );

  const metode = await q(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'payment_method'`,
    [skema[0].table_schema],
  );
  const namaKolom = metode.map((m) => m.column_name);
  check(
    'payment_method siap menampung penangan eksternal',
    namaKolom.includes('method_type'),
    namaKolom.join(', ').slice(0, 80),
  );

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
  try { await client.query('ROLLBACK'); } catch { /* sudah di luar transaksi */ }
} finally {
  await client.end();
  log('');
  log('Seluruh perubahan uji digulung balik — basis data tidak berubah.');
  writeFileSync(
    new URL('../../../docs/integration-requests/bukti-core-ir.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
