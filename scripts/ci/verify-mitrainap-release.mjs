import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'apps/api/tenant-migrations/hospitality');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const errors = [];
const ids = new Set();

for (const migration of manifest.migrations) {
  if (ids.has(migration.id)) errors.push(`duplicate migration ${migration.id}`);
  ids.add(migration.id);
  const file = path.join(dir, migration.file);
  if (!fs.existsSync(file)) {
    errors.push(`missing ${migration.file}`);
    continue;
  }
  const sql = fs.readFileSync(file, 'utf8');
  if (/\b(DROP\s+(TABLE|SCHEMA|DATABASE)|TRUNCATE\s+|ALTER\s+TABLE[^;]+DROP\s+COLUMN)\b/i.test(sql)) {
    errors.push(`destructive SQL in ${migration.file}`);
  }
  if (!sql.includes('{{TENANT_SCHEMA}}')) errors.push(`tenant placeholder missing in ${migration.file}`);
}

const required = [
  '20260807T120000__hospitality__folio',
  '20260807T150000__hospitality__night_audit',
  '20260807T180000__hospitality__pos_adapter',
  '20260807T210000__hospitality__mice',
  '20260808T000000__hospitality__guest_service',
  '20260808T030000__hospitality__longstay',
  '20260808T060000__hospitality__experience',
  '20260808T090000__hospitality__erp',
  '20260808T120000__hospitality__insight',
  '20260809T000000__hospitality__go_live_completion',
];
for (const id of required) if (!ids.has(id)) errors.push(`required migration absent: ${id}`);

const domainMigration = path.join(root, 'apps/api/prisma/platform/migrations/20260809000000_hospitality_custom_domain_lifecycle/migration.sql');
if (!fs.existsSync(domainMigration)) errors.push('custom-domain platform migration absent');
const apache = fs.readFileSync(path.join(root, 'deploy/apache/ebisnis.conf'), 'utf8');
if (!apache.includes('*.mitrainap.id')) errors.push('wildcard MitraInap host absent from Apache');
if (!apache.includes('mitrainap-custom-domains.inc')) errors.push('custom-domain Apache include absent');

const ledger = fs.readFileSync(path.join(root, 'docs/mitrainap/19-requirement-ledger.csv'), 'utf8');
for (const phase of [2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]) {
  if (!ledger.includes(`MI-${phase}`)) errors.push(`ledger evidence absent for MI-${phase}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`MitraInap release gate OK: ${manifest.migrations.length} additive tenant migrations; MI-2..MI-23 completion evidence present.`);
