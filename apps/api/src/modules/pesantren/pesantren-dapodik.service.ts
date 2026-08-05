import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

export type DatasetCode =
  | 'santri'
  | 'guru'
  | 'mata-pelajaran'
  | 'rombongan'
  | 'kurikulum'
  | 'jadwal'
  | 'komponen-nilai'
  | 'nilai';

export interface DatasetDef {
  code: DatasetCode;
  name: string;
  description: string;
  columns: string[];
  required: string[];
}

interface ImportOptions {
  dataset: DatasetCode;
  format: 'csv' | 'json';
  content: string;
  dryRun: boolean;
  actorUserId: string;
}

export interface ImportResult {
  dataset: DatasetCode;
  dryRun: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

const DATASETS: DatasetDef[] = [
  {
    code: 'santri',
    name: 'Peserta Didik / Santri',
    description: 'Identitas peserta didik, NISN/NIK, alamat, kontak, program bantuan, dan data ayah/ibu/wali.',
    required: ['nis', 'nama_lengkap', 'jenis_kelamin'],
    columns: [
      'nis',
      'nisn',
      'nipd',
      'nik',
      'nama_lengkap',
      'nama_panggilan',
      'jenis_kelamin',
      'tempat_lahir',
      'tanggal_lahir',
      'agama',
      'kewarganegaraan',
      'kebutuhan_khusus',
      'anak_ke',
      'jumlah_saudara',
      'alamat_asal',
      'alat_transportasi',
      'jarak_tempat_tinggal_km',
      'telepon',
      'hp',
      'email',
      'penerima_kip',
      'nomor_kip',
      'penerima_kks',
      'nomor_kks',
      'nomor_kk',
      'nama_ayah',
      'nik_ayah',
      'tahun_lahir_ayah',
      'pendidikan_ayah',
      'pekerjaan_ayah',
      'penghasilan_ayah',
      'nama_ibu',
      'nik_ibu',
      'tahun_lahir_ibu',
      'pendidikan_ibu',
      'pekerjaan_ibu',
      'penghasilan_ibu',
      'nama_wali',
      'nik_wali',
      'tahun_lahir_wali',
      'pendidikan_wali',
      'pekerjaan_wali',
      'penghasilan_wali',
    ],
  },
  {
    code: 'guru',
    name: 'GTK / Guru',
    description: 'Data pendidik dan tenaga pengajar yang dipakai penugasan mengajar.',
    required: ['nama'],
    columns: ['nip', 'nama', 'jenis', 'no_hp', 'email', 'alamat', 'status'],
  },
  {
    code: 'mata-pelajaran',
    name: 'Mata Pelajaran',
    description: 'Master mata pelajaran berikut kode Dapodik dan jenjang.',
    required: ['code', 'nama'],
    columns: ['code', 'nama', 'kelompok', 'kode_mapel_dapodik', 'jenjang'],
  },
  {
    code: 'rombongan',
    name: 'Rombongan Belajar',
    description: 'Kelas/rombel per unit pendidikan dan tahun ajaran.',
    required: ['unit_pendidikan_id', 'tahun_ajaran_id', 'tingkat', 'nama'],
    columns: ['unit_pendidikan_id', 'tahun_ajaran_id', 'tingkat', 'nama', 'wali_kelas_user_id', 'kapasitas'],
  },
  {
    code: 'kurikulum',
    name: 'Kurikulum',
    description: 'Alokasi mata pelajaran per unit, tingkat, dan tahun ajaran.',
    required: ['unit_pendidikan_id', 'tahun_ajaran_id', 'tingkat', 'mata_pelajaran_id', 'jam_per_minggu'],
    columns: ['unit_pendidikan_id', 'tahun_ajaran_id', 'tingkat', 'mata_pelajaran_id', 'jam_per_minggu'],
  },
  {
    code: 'jadwal',
    name: 'Jadwal Pelajaran',
    description: 'Jadwal mengajar per rombongan, hari, jam, pengajar, dan ruang.',
    required: ['rombongan_id', 'mata_pelajaran_id', 'hari', 'waktu_mulai', 'waktu_selesai'],
    columns: ['rombongan_id', 'mata_pelajaran_id', 'hari', 'waktu_mulai', 'waktu_selesai', 'pengajar_user_id', 'ruangan'],
  },
  {
    code: 'komponen-nilai',
    name: 'Komponen Nilai',
    description: 'Komponen penilaian berbobot per mata pelajaran.',
    required: ['mata_pelajaran_id', 'kode', 'nama', 'bobot_persen'],
    columns: ['mata_pelajaran_id', 'kode', 'nama', 'bobot_persen'],
  },
  {
    code: 'nilai',
    name: 'Nilai',
    description: 'Nilai peserta didik per komponen dan tahun ajaran.',
    required: ['santri_id', 'komponen_id', 'tahun_ajaran_id', 'nilai_angka'],
    columns: ['santri_id', 'komponen_id', 'tahun_ajaran_id', 'nilai_angka', 'catatan'],
  },
];
const BOOLEAN_COLUMNS = new Set(['penerima_kip', 'penerima_kks']);

@Injectable()
export class PesantrenDapodikService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  daftarDataset(): DatasetDef[] {
    return DATASETS;
  }

  template(dataset: DatasetCode): string {
    return toCsv([this.def(dataset).columns.reduce<Record<string, string>>((row, column) => ({ ...row, [column]: '' }), {})], this.def(dataset).columns);
  }

  async ekspor(schemaName: string, dataset: DatasetCode): Promise<{ filename: string; mimeType: string; content: string; columns: string[] }> {
    const def = this.def(dataset);
    const rows = await this.rows(schemaName, dataset);
    return {
      filename: `dapodik-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: toCsv(rows, def.columns),
      columns: def.columns,
    };
  }

  async impor(schemaName: string, opsi: ImportOptions): Promise<ImportResult> {
    const def = this.def(opsi.dataset);
    const rows = opsi.format === 'json' ? parseJsonRows(opsi.content) : parseCsv(opsi.content);
    const result: ImportResult = { dataset: opsi.dataset, dryRun: opsi.dryRun, totalRows: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const row = normalizeRow(rows[index], def.columns);
      const missing = def.required.filter((column) => !clean(row[column]));
      if (missing.length) {
        result.errors.push({ row: rowNumber, message: `Kolom wajib kosong: ${missing.join(', ')}` });
        result.skipped += 1;
        continue;
      }
      if (opsi.dryRun) {
        result.skipped += 1;
        continue;
      }
      try {
        const action = await this.upsert(schemaName, opsi.dataset, row, opsi.actorUserId);
        if (action === 'created') result.created += 1;
        else result.updated += 1;
      } catch (error) {
        result.errors.push({ row: rowNumber, message: errorMessage(error) });
        result.skipped += 1;
      }
    }

    return result;
  }

  private def(dataset: DatasetCode): DatasetDef {
    const def = DATASETS.find((item) => item.code === dataset);
    if (!def) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Dataset Dapodik "${dataset}" belum didukung.`);
    }
    return def;
  }

  private async rows(schemaName: string, dataset: DatasetCode): Promise<Record<string, unknown>[]> {
    const S = `"${schemaName}"`;
    switch (dataset) {
      case 'santri':
        return this.tenantDb.query(schemaName, `SELECT ${DATASETS[0].columns.join(', ')} FROM ${S}.pesantren_santri WHERE deleted_at IS NULL ORDER BY nama_lengkap ASC`);
      case 'guru':
        return this.tenantDb.query(schemaName, `SELECT nip, nama, jenis, no_hp, email, alamat, status FROM ${S}.pesantren_guru WHERE deleted_at IS NULL ORDER BY nama ASC`);
      case 'mata-pelajaran':
        return this.tenantDb.query(schemaName, `SELECT code, nama, kelompok, kode_mapel_dapodik, jenjang FROM ${S}.pesantren_mata_pelajaran WHERE deleted_at IS NULL ORDER BY nama ASC`);
      case 'rombongan':
        return this.tenantDb.query(schemaName, `SELECT unit_pendidikan_id::text, tahun_ajaran_id::text, tingkat, nama, wali_kelas_user_id::text, kapasitas FROM ${S}.pesantren_rombongan_belajar WHERE deleted_at IS NULL ORDER BY tingkat ASC, nama ASC`);
      case 'kurikulum':
        return this.tenantDb.query(schemaName, `SELECT unit_pendidikan_id::text, tahun_ajaran_id::text, tingkat, mata_pelajaran_id::text, jam_per_minggu FROM ${S}.pesantren_kurikulum WHERE deleted_at IS NULL ORDER BY tingkat ASC`);
      case 'jadwal':
        return this.tenantDb.query(schemaName, `SELECT rombongan_id::text, mata_pelajaran_id::text, hari, waktu_mulai::text, waktu_selesai::text, pengajar_user_id::text, ruangan FROM ${S}.pesantren_jadwal_pelajaran WHERE deleted_at IS NULL ORDER BY hari ASC, waktu_mulai ASC`);
      case 'komponen-nilai':
        return this.tenantDb.query(schemaName, `SELECT mata_pelajaran_id::text, kode, nama, bobot_persen::text FROM ${S}.pesantren_komponen_nilai WHERE deleted_at IS NULL ORDER BY kode ASC`);
      case 'nilai':
        return this.tenantDb.query(schemaName, `SELECT santri_id::text, komponen_id::text, tahun_ajaran_id::text, nilai_angka::text, catatan FROM ${S}.pesantren_nilai WHERE deleted_at IS NULL ORDER BY updated_at DESC`);
    }
  }

  private async upsert(schemaName: string, dataset: DatasetCode, row: Record<string, string>, actorUserId: string): Promise<'created' | 'updated'> {
    const S = `"${schemaName}"`;
    switch (dataset) {
      case 'santri':
        return upsertByExists(this.tenantDb, schemaName, `SELECT id FROM ${S}.pesantren_santri WHERE nis = $1 AND deleted_at IS NULL`, [row.nis], async (exists) => {
          const columns = DATASETS[0].columns;
          if (exists) {
            await this.tenantDb.query(schemaName, `UPDATE ${S}.pesantren_santri SET ${columns.filter((c) => c !== 'nis').map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = now(), updated_by = $${columns.length + 1}, version = version + 1 WHERE nis = $1 AND deleted_at IS NULL`, [row.nis, ...columns.filter((c) => c !== 'nis').map((c) => sqlValue(row[c], c)), actorUserId]);
          } else {
            await this.tenantDb.query(schemaName, `INSERT INTO ${S}.pesantren_santri (${columns.join(', ')}, status_tinggal, tanggal_masuk, created_by, updated_by) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, 'NONMUKIM', CURRENT_DATE, $${columns.length + 1}, $${columns.length + 1})`, [...columns.map((c) => sqlValue(row[c], c)), actorUserId]);
          }
        });
      case 'guru':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_guru', ['nama'], ['nip', 'nama', 'jenis', 'no_hp', 'email', 'alamat', 'status'], row, actorUserId);
      case 'mata-pelajaran':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_mata_pelajaran', ['code'], ['code', 'nama', 'kelompok', 'kode_mapel_dapodik', 'jenjang'], row, actorUserId);
      case 'rombongan':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_rombongan_belajar', ['unit_pendidikan_id', 'tahun_ajaran_id', 'nama'], DATASETS[3].columns, row, actorUserId);
      case 'kurikulum':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_kurikulum', ['unit_pendidikan_id', 'tahun_ajaran_id', 'tingkat', 'mata_pelajaran_id'], DATASETS[4].columns, row, actorUserId);
      case 'jadwal':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_jadwal_pelajaran', ['rombongan_id', 'hari', 'waktu_mulai'], DATASETS[5].columns, row, actorUserId);
      case 'komponen-nilai':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_komponen_nilai', ['mata_pelajaran_id', 'kode'], DATASETS[6].columns, row, actorUserId);
      case 'nilai':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_nilai', ['santri_id', 'komponen_id', 'tahun_ajaran_id'], DATASETS[7].columns, row, actorUserId);
    }
  }
}

async function upsertSimple(
  db: TenantConnectionService,
  schemaName: string,
  S: string,
  table: string,
  keys: string[],
  columns: string[],
  row: Record<string, string>,
  actorUserId: string,
): Promise<'created' | 'updated'> {
  const where = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
  return upsertByExists(db, schemaName, `SELECT id FROM ${S}.${table} WHERE ${where} AND deleted_at IS NULL`, keys.map((key) => sqlValue(row[key], key)), async (exists) => {
    if (exists) {
      const updateColumns = columns.filter((column) => !keys.includes(column));
      await db.query(schemaName, `UPDATE ${S}.${table} SET ${updateColumns.map((c, i) => `${c} = $${keys.length + i + 1}`).join(', ')}, updated_at = now(), updated_by = $${keys.length + updateColumns.length + 1}, version = version + 1 WHERE ${where} AND deleted_at IS NULL`, [...keys.map((key) => sqlValue(row[key], key)), ...updateColumns.map((c) => sqlValue(row[c], c)), actorUserId]);
    } else {
      await db.query(schemaName, `INSERT INTO ${S}.${table} (${columns.join(', ')}, created_by, updated_by) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, $${columns.length + 1}, $${columns.length + 1})`, [...columns.map((c) => sqlValue(row[c], c)), actorUserId]);
    }
  });
}

async function upsertByExists(
  db: TenantConnectionService,
  schemaName: string,
  existsSql: string,
  existsParams: unknown[],
  write: (exists: boolean) => Promise<void>,
): Promise<'created' | 'updated'> {
  const exists = Boolean(await db.queryOne(schemaName, existsSql, existsParams));
  await write(exists);
  return exists ? 'updated' : 'created';
}

function normalizeRow(row: Record<string, unknown>, columns: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const column of columns) out[column] = clean(row[column]);
  return out;
}

function sqlValue(value: string, column: string): string | number | boolean | null {
  const cleaned = clean(value);
  if (!cleaned) return null;
  if (BOOLEAN_COLUMNS.has(column)) {
    if (/^(true|ya|y|1)$/i.test(cleaned)) return true;
    if (/^(false|tidak|n|0)$/i.test(cleaned)) return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  return cleaned;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function parseJsonRows(content: string): Record<string, unknown>[] {
  const parsed = JSON.parse(content) as unknown;
  if (!Array.isArray(parsed)) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'JSON impor harus berupa array objek.');
  return parsed as Record<string, unknown>[];
}

function parseCsv(content: string): Record<string, string>[] {
  const rows = splitCsvRows(content);
  if (rows.length < 2) return [];
  const headers = parseCsvLine(rows[0]).map((h) => h.trim());
  return rows.slice(1).filter((line) => line.trim()).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']));
  });
}

function splitCsvRows(content: string): string[] {
  return content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  return [columns.map(csvCell).join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\r\n');
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Baris tidak dapat diimpor.';
}
