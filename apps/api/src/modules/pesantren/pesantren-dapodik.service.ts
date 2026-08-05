import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

export type DatasetCode =
  | 'unit-pendidikan'
  | 'tahun-ajaran'
  | 'santri'
  | 'guru'
  | 'mata-pelajaran'
  | 'rombongan'
  | 'anggota-rombel'
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
    code: 'unit-pendidikan',
    name: 'Sekolah / Unit Pendidikan',
    description: 'Satuan pendidikan di bawah pondok: MI, MTs, MA, diniyah, tahfiz, BLK, atau unit lain.',
    required: ['code', 'name', 'jenis'],
    columns: ['code', 'name', 'jenis', 'sort_order'],
  },
  {
    code: 'tahun-ajaran',
    name: 'Tahun Ajaran',
    description: 'Referensi periode tahun ajaran yang dipakai rombel, kurikulum, jadwal, dan nilai.',
    required: ['code', 'name', 'tanggal_mulai', 'tanggal_selesai'],
    columns: ['code', 'name', 'tanggal_mulai', 'tanggal_selesai', 'status'],
  },
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
    required: ['unit_pendidikan_code', 'tahun_ajaran_code', 'tingkat', 'nama'],
    columns: ['unit_pendidikan_code', 'tahun_ajaran_code', 'tingkat', 'nama', 'wali_kelas_user_id', 'kapasitas'],
  },
  {
    code: 'anggota-rombel',
    name: 'Anggota Rombongan Belajar',
    description: 'Keanggotaan peserta didik pada rombel/tahun ajaran.',
    required: ['nis', 'rombongan_nama', 'tahun_ajaran_code'],
    columns: ['nis', 'rombongan_nama', 'tahun_ajaran_code', 'tanggal_masuk', 'status'],
  },
  {
    code: 'kurikulum',
    name: 'Kurikulum',
    description: 'Alokasi mata pelajaran per unit, tingkat, dan tahun ajaran.',
    required: ['unit_pendidikan_code', 'tahun_ajaran_code', 'tingkat', 'mata_pelajaran_code', 'jam_per_minggu'],
    columns: ['unit_pendidikan_code', 'tahun_ajaran_code', 'tingkat', 'mata_pelajaran_code', 'jam_per_minggu'],
  },
  {
    code: 'jadwal',
    name: 'Jadwal Pelajaran',
    description: 'Jadwal mengajar per rombongan, hari, jam, pengajar, dan ruang.',
    required: ['rombongan_nama', 'tahun_ajaran_code', 'mata_pelajaran_code', 'hari', 'waktu_mulai', 'waktu_selesai'],
    columns: ['rombongan_nama', 'tahun_ajaran_code', 'mata_pelajaran_code', 'hari', 'waktu_mulai', 'waktu_selesai', 'pengajar_user_id', 'ruangan'],
  },
  {
    code: 'komponen-nilai',
    name: 'Komponen Nilai',
    description: 'Komponen penilaian berbobot per mata pelajaran.',
    required: ['mata_pelajaran_code', 'kode', 'nama', 'bobot_persen'],
    columns: ['mata_pelajaran_code', 'kode', 'nama', 'bobot_persen'],
  },
  {
    code: 'nilai',
    name: 'Nilai',
    description: 'Nilai peserta didik per komponen dan tahun ajaran.',
    required: ['nis', 'mata_pelajaran_code', 'komponen_kode', 'tahun_ajaran_code', 'nilai_angka'],
    columns: ['nis', 'mata_pelajaran_code', 'komponen_kode', 'tahun_ajaran_code', 'nilai_angka', 'catatan'],
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
      case 'unit-pendidikan':
        return this.tenantDb.query(schemaName, `SELECT code, name, jenis, sort_order FROM ${S}.pesantren_unit_pendidikan WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC`);
      case 'tahun-ajaran':
        return this.tenantDb.query(schemaName, `SELECT code, name, tanggal_mulai::text, tanggal_selesai::text, status FROM ${S}.pesantren_tahun_ajaran WHERE deleted_at IS NULL ORDER BY tanggal_mulai DESC`);
      case 'santri':
        return this.tenantDb.query(schemaName, `SELECT ${this.def('santri').columns.join(', ')} FROM ${S}.pesantren_santri WHERE deleted_at IS NULL ORDER BY nama_lengkap ASC`);
      case 'guru':
        return this.tenantDb.query(schemaName, `SELECT nip, nama, jenis, no_hp, email, alamat, status FROM ${S}.pesantren_guru WHERE deleted_at IS NULL ORDER BY nama ASC`);
      case 'mata-pelajaran':
        return this.tenantDb.query(schemaName, `SELECT code, nama, kelompok, kode_mapel_dapodik, jenjang FROM ${S}.pesantren_mata_pelajaran WHERE deleted_at IS NULL ORDER BY nama ASC`);
      case 'rombongan':
        return this.tenantDb.query(schemaName, `SELECT u.code AS unit_pendidikan_code, ta.code AS tahun_ajaran_code, r.tingkat, r.nama, r.wali_kelas_user_id::text, r.kapasitas FROM ${S}.pesantren_rombongan_belajar r JOIN ${S}.pesantren_unit_pendidikan u ON u.id = r.unit_pendidikan_id JOIN ${S}.pesantren_tahun_ajaran ta ON ta.id = r.tahun_ajaran_id WHERE r.deleted_at IS NULL ORDER BY r.tingkat ASC, r.nama ASC`);
      case 'anggota-rombel':
        return this.tenantDb.query(schemaName, `SELECT s.nis, r.nama AS rombongan_nama, ta.code AS tahun_ajaran_code, a.tanggal_masuk::text, a.status FROM ${S}.pesantren_rombongan_anggota a JOIN ${S}.pesantren_santri s ON s.id = a.santri_id JOIN ${S}.pesantren_rombongan_belajar r ON r.id = a.rombongan_id JOIN ${S}.pesantren_tahun_ajaran ta ON ta.id = a.tahun_ajaran_id WHERE a.deleted_at IS NULL ORDER BY r.nama ASC, s.nama_lengkap ASC`);
      case 'kurikulum':
        return this.tenantDb.query(schemaName, `SELECT u.code AS unit_pendidikan_code, ta.code AS tahun_ajaran_code, k.tingkat, mp.code AS mata_pelajaran_code, k.jam_per_minggu FROM ${S}.pesantren_kurikulum k JOIN ${S}.pesantren_unit_pendidikan u ON u.id = k.unit_pendidikan_id JOIN ${S}.pesantren_tahun_ajaran ta ON ta.id = k.tahun_ajaran_id JOIN ${S}.pesantren_mata_pelajaran mp ON mp.id = k.mata_pelajaran_id WHERE k.deleted_at IS NULL ORDER BY k.tingkat ASC`);
      case 'jadwal':
        return this.tenantDb.query(schemaName, `SELECT r.nama AS rombongan_nama, ta.code AS tahun_ajaran_code, mp.code AS mata_pelajaran_code, j.hari, j.waktu_mulai::text, j.waktu_selesai::text, j.pengajar_user_id::text, j.ruangan FROM ${S}.pesantren_jadwal_pelajaran j JOIN ${S}.pesantren_rombongan_belajar r ON r.id = j.rombongan_id JOIN ${S}.pesantren_tahun_ajaran ta ON ta.id = r.tahun_ajaran_id JOIN ${S}.pesantren_mata_pelajaran mp ON mp.id = j.mata_pelajaran_id WHERE j.deleted_at IS NULL ORDER BY j.hari ASC, j.waktu_mulai ASC`);
      case 'komponen-nilai':
        return this.tenantDb.query(schemaName, `SELECT mp.code AS mata_pelajaran_code, k.kode, k.nama, k.bobot_persen::text FROM ${S}.pesantren_komponen_nilai k JOIN ${S}.pesantren_mata_pelajaran mp ON mp.id = k.mata_pelajaran_id WHERE k.deleted_at IS NULL ORDER BY mp.code ASC, k.kode ASC`);
      case 'nilai':
        return this.tenantDb.query(schemaName, `SELECT s.nis, mp.code AS mata_pelajaran_code, k.kode AS komponen_kode, ta.code AS tahun_ajaran_code, n.nilai_angka::text, n.catatan FROM ${S}.pesantren_nilai n JOIN ${S}.pesantren_santri s ON s.id = n.santri_id JOIN ${S}.pesantren_komponen_nilai k ON k.id = n.komponen_id JOIN ${S}.pesantren_mata_pelajaran mp ON mp.id = k.mata_pelajaran_id JOIN ${S}.pesantren_tahun_ajaran ta ON ta.id = n.tahun_ajaran_id WHERE n.deleted_at IS NULL ORDER BY n.updated_at DESC`);
    }
  }

  private async upsert(schemaName: string, dataset: DatasetCode, row: Record<string, string>, actorUserId: string): Promise<'created' | 'updated'> {
    const S = `"${schemaName}"`;
    switch (dataset) {
      case 'unit-pendidikan':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_unit_pendidikan', ['code'], ['code', 'name', 'jenis', 'sort_order'], withDefaults(row, { sort_order: '0' }), actorUserId);
      case 'tahun-ajaran':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_tahun_ajaran', ['code'], ['code', 'name', 'tanggal_mulai', 'tanggal_selesai', 'status'], withDefaults(row, { status: 'DRAFT' }), actorUserId);
      case 'santri':
        return upsertByExists(this.tenantDb, schemaName, `SELECT id FROM ${S}.pesantren_santri WHERE nis = $1 AND deleted_at IS NULL`, [row.nis], async (exists) => {
          const santriRow = withDefaults(row, {
            kewarganegaraan: 'WNI',
            kebutuhan_khusus: 'TIDAK_ADA',
            penerima_kip: 'false',
            penerima_kks: 'false',
          });
          const columns = this.def('santri').columns;
          if (exists) {
            await this.tenantDb.query(schemaName, `UPDATE ${S}.pesantren_santri SET ${columns.filter((c) => c !== 'nis').map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = now(), updated_by = $${columns.length + 1}, version = version + 1 WHERE nis = $1 AND deleted_at IS NULL`, [row.nis, ...columns.filter((c) => c !== 'nis').map((c) => sqlValue(santriRow[c], c)), actorUserId]);
          } else {
            await this.tenantDb.query(schemaName, `INSERT INTO ${S}.pesantren_santri (${columns.join(', ')}, status_tinggal, tanggal_masuk, created_by, updated_by) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, 'NONMUKIM', CURRENT_DATE, $${columns.length + 1}, $${columns.length + 1})`, [...columns.map((c) => sqlValue(santriRow[c], c)), actorUserId]);
          }
        });
      case 'guru':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_guru', ['nama'], ['nip', 'nama', 'jenis', 'no_hp', 'email', 'alamat', 'status'], withDefaults(row, { jenis: 'HONORER', status: 'AKTIF' }), actorUserId);
      case 'mata-pelajaran':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_mata_pelajaran', ['code'], ['code', 'nama', 'kelompok', 'kode_mapel_dapodik', 'jenjang'], row, actorUserId);
      case 'rombongan':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_rombongan_belajar', ['unit_pendidikan_id', 'tahun_ajaran_id', 'nama'], ['unit_pendidikan_id', 'tahun_ajaran_id', 'tingkat', 'nama', 'wali_kelas_user_id', 'kapasitas'], await this.resolveRombongan(schemaName, row), actorUserId);
      case 'anggota-rombel':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_rombongan_anggota', ['santri_id', 'tahun_ajaran_id'], ['santri_id', 'rombongan_id', 'tahun_ajaran_id', 'tanggal_masuk', 'status'], await this.resolveAnggotaRombel(schemaName, row), actorUserId);
      case 'kurikulum':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_kurikulum', ['unit_pendidikan_id', 'tahun_ajaran_id', 'tingkat', 'mata_pelajaran_id'], ['unit_pendidikan_id', 'tahun_ajaran_id', 'tingkat', 'mata_pelajaran_id', 'jam_per_minggu'], await this.resolveKurikulum(schemaName, row), actorUserId);
      case 'jadwal':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_jadwal_pelajaran', ['rombongan_id', 'hari', 'waktu_mulai'], ['rombongan_id', 'mata_pelajaran_id', 'hari', 'waktu_mulai', 'waktu_selesai', 'pengajar_user_id', 'ruangan'], await this.resolveJadwal(schemaName, row), actorUserId);
      case 'komponen-nilai':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_komponen_nilai', ['mata_pelajaran_id', 'kode'], ['mata_pelajaran_id', 'kode', 'nama', 'bobot_persen'], await this.resolveKomponen(schemaName, row), actorUserId);
      case 'nilai':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_nilai', ['santri_id', 'komponen_id', 'tahun_ajaran_id'], ['santri_id', 'komponen_id', 'tahun_ajaran_id', 'nilai_angka', 'catatan'], await this.resolveNilai(schemaName, row), actorUserId);
    }
  }

  private async resolveRombongan(schemaName: string, row: Record<string, string>): Promise<Record<string, string>> {
    return {
      unit_pendidikan_id: await this.idByCode(schemaName, 'pesantren_unit_pendidikan', row.unit_pendidikan_code, 'Unit pendidikan'),
      tahun_ajaran_id: await this.idByCode(schemaName, 'pesantren_tahun_ajaran', row.tahun_ajaran_code, 'Tahun ajaran'),
      tingkat: row.tingkat,
      nama: row.nama,
      wali_kelas_user_id: row.wali_kelas_user_id,
      kapasitas: row.kapasitas,
    };
  }

  private async resolveAnggotaRombel(schemaName: string, row: Record<string, string>): Promise<Record<string, string>> {
    return {
      santri_id: await this.idByColumn(schemaName, 'pesantren_santri', 'nis', row.nis, 'Santri'),
      rombongan_id: await this.rombonganId(schemaName, row.rombongan_nama, row.tahun_ajaran_code),
      tahun_ajaran_id: await this.idByCode(schemaName, 'pesantren_tahun_ajaran', row.tahun_ajaran_code, 'Tahun ajaran'),
      tanggal_masuk: row.tanggal_masuk || new Date().toISOString().slice(0, 10),
      status: row.status || 'AKTIF',
    };
  }

  private async resolveKurikulum(schemaName: string, row: Record<string, string>): Promise<Record<string, string>> {
    return {
      unit_pendidikan_id: await this.idByCode(schemaName, 'pesantren_unit_pendidikan', row.unit_pendidikan_code, 'Unit pendidikan'),
      tahun_ajaran_id: await this.idByCode(schemaName, 'pesantren_tahun_ajaran', row.tahun_ajaran_code, 'Tahun ajaran'),
      tingkat: row.tingkat,
      mata_pelajaran_id: await this.idByCode(schemaName, 'pesantren_mata_pelajaran', row.mata_pelajaran_code, 'Mata pelajaran'),
      jam_per_minggu: row.jam_per_minggu,
    };
  }

  private async resolveJadwal(schemaName: string, row: Record<string, string>): Promise<Record<string, string>> {
    return {
      rombongan_id: await this.rombonganId(schemaName, row.rombongan_nama, row.tahun_ajaran_code),
      mata_pelajaran_id: await this.idByCode(schemaName, 'pesantren_mata_pelajaran', row.mata_pelajaran_code, 'Mata pelajaran'),
      hari: row.hari,
      waktu_mulai: row.waktu_mulai,
      waktu_selesai: row.waktu_selesai,
      pengajar_user_id: row.pengajar_user_id,
      ruangan: row.ruangan,
    };
  }

  private async resolveKomponen(schemaName: string, row: Record<string, string>): Promise<Record<string, string>> {
    return {
      mata_pelajaran_id: await this.idByCode(schemaName, 'pesantren_mata_pelajaran', row.mata_pelajaran_code, 'Mata pelajaran'),
      kode: row.kode,
      nama: row.nama,
      bobot_persen: row.bobot_persen,
    };
  }

  private async resolveNilai(schemaName: string, row: Record<string, string>): Promise<Record<string, string>> {
    const mataPelajaranId = await this.idByCode(schemaName, 'pesantren_mata_pelajaran', row.mata_pelajaran_code, 'Mata pelajaran');
    return {
      santri_id: await this.idByColumn(schemaName, 'pesantren_santri', 'nis', row.nis, 'Santri'),
      komponen_id: await this.komponenId(schemaName, mataPelajaranId, row.komponen_kode),
      tahun_ajaran_id: await this.idByCode(schemaName, 'pesantren_tahun_ajaran', row.tahun_ajaran_code, 'Tahun ajaran'),
      nilai_angka: row.nilai_angka,
      catatan: row.catatan,
    };
  }

  private async idByCode(schemaName: string, table: string, code: string, label: string): Promise<string> {
    return this.idByColumn(schemaName, table, 'code', code, label);
  }

  private async idByColumn(schemaName: string, table: string, column: string, value: string, label: string): Promise<string> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne<{ id: string }>(
      schemaName,
      `SELECT id::text FROM ${S}.${table} WHERE ${column} = $1 AND deleted_at IS NULL`,
      [value],
    );
    if (!row) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `${label} "${value}" tidak ditemukan.`);
    return row.id;
  }

  private async rombonganId(schemaName: string, nama: string, tahunAjaranCode: string): Promise<string> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne<{ id: string }>(
      schemaName,
      `SELECT r.id::text
         FROM ${S}.pesantren_rombongan_belajar r
         JOIN ${S}.pesantren_tahun_ajaran ta ON ta.id = r.tahun_ajaran_id
        WHERE r.nama = $1 AND ta.code = $2 AND r.deleted_at IS NULL`,
      [nama, tahunAjaranCode],
    );
    if (!row) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Rombongan "${nama}" tahun "${tahunAjaranCode}" tidak ditemukan.`);
    return row.id;
  }

  private async komponenId(schemaName: string, mataPelajaranId: string, kode: string): Promise<string> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne<{ id: string }>(
      schemaName,
      `SELECT id::text FROM ${S}.pesantren_komponen_nilai WHERE mata_pelajaran_id = $1 AND kode = $2 AND deleted_at IS NULL`,
      [mataPelajaranId, kode],
    );
    if (!row) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Komponen nilai "${kode}" tidak ditemukan.`);
    return row.id;
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

function withDefaults(row: Record<string, string>, defaults: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries({ ...row, ...defaults }).map(([key, value]) => [key, row[key]?.trim() ? row[key] : value]),
  );
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
