import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

export type DatasetCode =
  | 'unit-pendidikan'
  | 'tahun-ajaran'
  | 'santri'
  | 'psb-pendaftar'
  | 'guru'
  | 'mata-pelajaran'
  | 'rombongan'
  | 'anggota-rombel'
  | 'kurikulum'
  | 'jadwal'
  | 'komponen-nilai'
  | 'nilai'
  | 'ref-pekerjaan'
  | 'ref-pendidikan'
  | 'ref-penghasilan'
  | 'ref-transportasi'
  | 'ref-jenis-tinggal'
  | 'ref-kebutuhan-khusus';

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
  batchId?: string;
  dataset: DatasetCode;
  dryRun: boolean;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  preview: Array<{ row: number; action: 'CREATE' | 'UPDATE' | 'SKIP'; key: string; summary: string }>;
}

export interface DapodikImportBatchRow {
  id: string;
  dataset: DatasetCode;
  format: 'csv' | 'json';
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
  rolledBackAt: string | null;
  rollbackNote: string | null;
}

interface UpsertOutcome {
  action: 'created' | 'updated';
  targetTable: string;
  targetId: string;
  key: string;
  summary: string;
}

export interface ReferensiDapodikRow {
  code: string;
  nama: string;
  sort_order: number;
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
      'status',
      'status_tinggal',
      'tanggal_masuk',
      'tanggal_keluar',
      'alasan_keluar',
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
    code: 'psb-pendaftar',
    name: 'Pendaftar PSB / Calon Santri',
    description: 'Data calon santri sebelum daftar ulang, termasuk asal sekolah dan jalur masuk.',
    required: ['tahun_ajaran_code', 'gelombang_kode', 'nama_lengkap', 'jenis_kelamin'],
    columns: [
      'tahun_ajaran_code',
      'gelombang_kode',
      'nomor_pendaftaran',
      'nama_lengkap',
      'jenis_kelamin',
      'tempat_lahir',
      'tanggal_lahir',
      'nama_orang_tua',
      'no_hp_orang_tua',
      'alamat',
      'asal_sekolah',
      'jalur_masuk',
      'status',
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
  {
    code: 'ref-pekerjaan',
    name: 'Referensi Pekerjaan',
    description: 'Master pilihan pekerjaan ayah, ibu, dan wali untuk biodata Dapodik.',
    required: ['code', 'nama'],
    columns: ['code', 'nama', 'sort_order', 'is_active'],
  },
  {
    code: 'ref-pendidikan',
    name: 'Referensi Pendidikan',
    description: 'Master pilihan pendidikan terakhir ayah, ibu, dan wali.',
    required: ['code', 'nama'],
    columns: ['code', 'nama', 'sort_order', 'is_active'],
  },
  {
    code: 'ref-penghasilan',
    name: 'Referensi Penghasilan',
    description: 'Master rentang penghasilan orang tua/wali.',
    required: ['code', 'nama'],
    columns: ['code', 'nama', 'sort_order', 'is_active'],
  },
  {
    code: 'ref-transportasi',
    name: 'Referensi Transportasi',
    description: 'Master pilihan alat transportasi peserta didik.',
    required: ['code', 'nama'],
    columns: ['code', 'nama', 'sort_order', 'is_active'],
  },
  {
    code: 'ref-jenis-tinggal',
    name: 'Referensi Jenis Tinggal',
    description: 'Master jenis tempat tinggal peserta didik, termasuk mukim/asrama.',
    required: ['code', 'nama'],
    columns: ['code', 'nama', 'sort_order', 'is_active'],
  },
  {
    code: 'ref-kebutuhan-khusus',
    name: 'Referensi Kebutuhan Khusus',
    description: 'Master kebutuhan khusus peserta didik dan keluarga.',
    required: ['code', 'nama'],
    columns: ['code', 'nama', 'sort_order', 'is_active'],
  },
];
const BOOLEAN_COLUMNS = new Set(['penerima_kip', 'penerima_kks', 'is_active']);
const REFERENSI_KATEGORI: Partial<Record<DatasetCode, string>> = {
  'ref-pekerjaan': 'PEKERJAAN',
  'ref-pendidikan': 'PENDIDIKAN',
  'ref-penghasilan': 'PENGHASILAN',
  'ref-transportasi': 'TRANSPORTASI',
  'ref-jenis-tinggal': 'JENIS_TINGGAL',
  'ref-kebutuhan-khusus': 'KEBUTUHAN_KHUSUS',
};
const KATEGORI_REFERENSI = new Set(Object.values(REFERENSI_KATEGORI));
const DAPODIK_ROLLBACK_TABLES = new Map<string, string>([
  ['pesantren_unit_pendidikan', 'pesantren_unit_pendidikan'],
  ['pesantren_tahun_ajaran', 'pesantren_tahun_ajaran'],
  ['pesantren_santri', 'pesantren_santri'],
  ['pesantren_psb_pendaftar', 'pesantren_psb_pendaftar'],
  ['pesantren_guru', 'pesantren_guru'],
  ['pesantren_mata_pelajaran', 'pesantren_mata_pelajaran'],
  ['pesantren_rombongan_belajar', 'pesantren_rombongan_belajar'],
  ['pesantren_rombongan_anggota', 'pesantren_rombongan_anggota'],
  ['pesantren_kurikulum', 'pesantren_kurikulum'],
  ['pesantren_jadwal_pelajaran', 'pesantren_jadwal_pelajaran'],
  ['pesantren_komponen_nilai', 'pesantren_komponen_nilai'],
  ['pesantren_nilai', 'pesantren_nilai'],
  ['pesantren_referensi_dapodik', 'pesantren_referensi_dapodik'],
]);
const DATASET_ALIASES: Partial<Record<DatasetCode, Partial<Record<string, string[]>>>> = {
  'unit-pendidikan': {
    code: ['kode', 'kode sekolah', 'kode unit', 'npsn'],
    name: ['nama', 'nama sekolah', 'nama unit', 'satuan pendidikan'],
    jenis: ['bentuk pendidikan', 'jenjang', 'jenis sekolah', 'jenis unit'],
  },
  santri: {
    nis: ['nis lokal', 'nomor induk', 'nomor induk siswa'],
    nisn: ['nisn peserta didik', 'nomor nisn'],
    nipd: ['nipd', 'no induk peserta didik'],
    nik: ['nik peserta didik', 'nik siswa'],
    nama_lengkap: ['nama', 'nama peserta didik', 'nama siswa', 'nama santri'],
    nama_panggilan: ['nama panggilan'],
    jenis_kelamin: ['jk', 'kelamin', 'jenis kelamin'],
    status: ['status peserta didik', 'status siswa', 'status santri'],
    status_tinggal: ['status tinggal', 'jenis tinggal'],
    tanggal_masuk: ['tanggal masuk', 'tgl masuk', 'tanggal diterima'],
    tanggal_keluar: ['tanggal keluar', 'tgl keluar', 'tanggal lulus'],
    alasan_keluar: ['alasan keluar', 'keterangan keluar', 'catatan keluar'],
    tempat_lahir: ['tempat lahir'],
    tanggal_lahir: ['tanggal lahir', 'tgl lahir', 'tgl_lahir'],
    kebutuhan_khusus: ['berkebutuhan khusus', 'kebutuhan khusus peserta didik'],
    anak_ke: ['anak ke', 'anak ke-'],
    jumlah_saudara: ['jumlah saudara kandung', 'jml saudara'],
    alamat_asal: ['alamat', 'alamat jalan', 'alamat lengkap', 'alamat peserta didik'],
    alat_transportasi: ['transportasi', 'alat transportasi ke sekolah'],
    jarak_tempat_tinggal_km: ['jarak rumah', 'jarak ke sekolah', 'jarak tempat tinggal'],
    hp: ['no hp', 'nomor hp', 'handphone', 'no handphone'],
    penerima_kip: ['layak pip', 'penerima pip', 'penerima kip'],
    nomor_kip: ['no kip', 'nomor kip', 'nomor pip'],
    penerima_kks: ['penerima kks'],
    nomor_kks: ['no kks', 'nomor kks'],
    nomor_kk: ['no kk', 'nomor kk'],
    nama_ayah: ['nama ayah kandung', 'ayah'],
    nik_ayah: ['nik ayah'],
    tahun_lahir_ayah: ['tahun lahir ayah'],
    pendidikan_ayah: ['pendidikan ayah'],
    pekerjaan_ayah: ['pekerjaan ayah'],
    penghasilan_ayah: ['penghasilan ayah'],
    nama_ibu: ['nama ibu kandung', 'ibu'],
    nik_ibu: ['nik ibu'],
    tahun_lahir_ibu: ['tahun lahir ibu'],
    pendidikan_ibu: ['pendidikan ibu'],
    pekerjaan_ibu: ['pekerjaan ibu'],
    penghasilan_ibu: ['penghasilan ibu'],
    nama_wali: ['nama wali'],
    nik_wali: ['nik wali'],
    tahun_lahir_wali: ['tahun lahir wali'],
    pendidikan_wali: ['pendidikan wali'],
    pekerjaan_wali: ['pekerjaan wali'],
    penghasilan_wali: ['penghasilan wali'],
  },
  guru: {
    nip: ['nuptk', 'nik', 'nip/nuptk'],
    nama: ['nama gtk', 'nama ptk', 'nama guru', 'nama lengkap'],
    jenis: ['jenis gtk', 'jenis ptk', 'status kepegawaian'],
    no_hp: ['no hp', 'nomor hp', 'handphone', 'telepon'],
    alamat: ['alamat jalan', 'alamat lengkap'],
  },
  'psb-pendaftar': {
    gelombang_kode: ['kode gelombang', 'gelombang', 'gelombang psb'],
    tahun_ajaran_code: ['tahun ajaran', 'tahun pelajaran', 'periode'],
    nomor_pendaftaran: ['nomor pendaftaran', 'no pendaftaran', 'no registrasi'],
    nama_lengkap: ['nama', 'nama peserta didik', 'nama calon santri', 'nama pendaftar'],
    jenis_kelamin: ['jk', 'jenis kelamin', 'kelamin'],
    tempat_lahir: ['tempat lahir'],
    tanggal_lahir: ['tanggal lahir', 'tgl lahir'],
    nama_orang_tua: ['nama orang tua', 'orang tua', 'nama wali'],
    no_hp_orang_tua: ['no hp orang tua', 'hp orang tua', 'nomor hp orang tua'],
    alamat: ['alamat jalan', 'alamat lengkap'],
    asal_sekolah: ['sekolah asal', 'asal sekolah'],
    jalur_masuk: ['jalur', 'jalur pendaftaran', 'jalur masuk'],
  },
  'mata-pelajaran': {
    code: ['kode', 'kode mata pelajaran', 'kode mapel'],
    nama: ['mata pelajaran', 'nama mapel', 'nama mata pelajaran'],
    kelompok: ['kelompok mapel', 'kelompok mata pelajaran'],
    kode_mapel_dapodik: ['kode dapodik', 'kode referensi dapodik'],
  },
  rombongan: {
    unit_pendidikan_code: ['kode unit', 'unit pendidikan', 'npsn'],
    tahun_ajaran_code: ['tahun ajaran', 'periode'],
    tingkat: ['kelas', 'tingkat kelas'],
    nama: ['nama rombel', 'rombongan belajar', 'rombel'],
    wali_kelas_user_id: ['wali kelas user id', 'wali kelas'],
  },
  'anggota-rombel': {
    nis: ['nisn', 'nomor induk', 'nis lokal'],
    rombongan_nama: ['nama rombel', 'rombongan belajar', 'rombel'],
    tahun_ajaran_code: ['tahun ajaran', 'periode'],
    tanggal_masuk: ['tanggal masuk rombel', 'tgl masuk'],
  },
  jadwal: {
    rombongan_nama: ['nama rombel', 'rombongan belajar', 'rombel'],
    tahun_ajaran_code: ['tahun ajaran', 'periode'],
    mata_pelajaran_code: ['kode mapel', 'mata pelajaran', 'nama mapel'],
    waktu_mulai: ['jam mulai'],
    waktu_selesai: ['jam selesai'],
    ruangan: ['ruang', 'kelas'],
  },
  nilai: {
    nis: ['nisn', 'nomor induk', 'nis lokal'],
    mata_pelajaran_code: ['kode mapel', 'mata pelajaran', 'nama mapel'],
    komponen_kode: ['kode komponen', 'jenis nilai', 'komponen nilai'],
    tahun_ajaran_code: ['tahun ajaran', 'periode'],
    nilai_angka: ['nilai', 'angka', 'skor'],
  },
};

@Injectable()
export class PesantrenDapodikService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  daftarDataset(): DatasetDef[] {
    return DATASETS;
  }

  template(dataset: DatasetCode): string {
    return toCsv([this.def(dataset).columns.reduce<Record<string, string>>((row, column) => ({ ...row, [column]: '' }), {})], this.def(dataset).columns);
  }

  async referensi(schemaName: string, kategori: string): Promise<ReferensiDapodikRow[]> {
    const normalized = kategori.toUpperCase();
    if (!KATEGORI_REFERENSI.has(normalized)) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Kategori referensi Dapodik "${kategori}" belum didukung.`);
    }
    const S = `"${schemaName}"`;
    return this.tenantDb.query(
      schemaName,
      `SELECT code, nama, sort_order
         FROM ${S}.pesantren_referensi_dapodik
        WHERE kategori = $1 AND is_active = true AND deleted_at IS NULL
        ORDER BY sort_order ASC, nama ASC`,
      [normalized],
    );
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
    const result: ImportResult = { dataset: opsi.dataset, dryRun: opsi.dryRun, totalRows: rows.length, created: 0, updated: 0, skipped: 0, errors: [], preview: [] };
    const batchId = opsi.dryRun ? undefined : await this.mulaiBatch(schemaName, opsi, rows.length);
    if (batchId) result.batchId = batchId;

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const row = normalizeRow(rows[index], def.columns, opsi.dataset);
      const missing = def.required.filter((column) => !clean(row[column]));
      if (missing.length) {
        const message = `Kolom wajib kosong: ${missing.join(', ')}`;
        result.errors.push({ row: rowNumber, message });
        result.skipped += 1;
        result.preview.push({ row: rowNumber, action: 'SKIP', key: '-', summary: message });
        if (batchId) {
          await this.catatBatchRow(schemaName, batchId, {
            rowNumber,
            action: 'SKIP',
            key: '-',
            summary: message,
            errorMessage: message,
            rawRow: row,
          });
        }
        continue;
      }
      if (opsi.dryRun) {
        try {
          const preview = await this.previewUpsert(schemaName, opsi.dataset, row);
          result.preview.push({ row: rowNumber, ...preview });
          if (preview.action === 'CREATE') result.created += 1;
          else result.updated += 1;
        } catch (error) {
          result.errors.push({ row: rowNumber, message: errorMessage(error) });
          result.skipped += 1;
          result.preview.push({ row: rowNumber, action: 'SKIP', key: '-', summary: errorMessage(error) });
        }
        continue;
      }
      try {
        const outcome = await this.upsert(schemaName, opsi.dataset, row, opsi.actorUserId);
        if (outcome.action === 'created') result.created += 1;
        else result.updated += 1;
        result.preview.push({
          row: rowNumber,
          action: outcome.action === 'created' ? 'CREATE' : 'UPDATE',
          key: outcome.key,
          summary: outcome.summary,
        });
        if (batchId) {
          await this.catatBatchRow(schemaName, batchId, {
            rowNumber,
            action: outcome.action === 'created' ? 'CREATE' : 'UPDATE',
            targetTable: outcome.targetTable,
            targetId: outcome.targetId,
            key: outcome.key,
            summary: outcome.summary,
            rawRow: row,
          });
        }
      } catch (error) {
        const message = errorMessage(error);
        result.errors.push({ row: rowNumber, message });
        result.skipped += 1;
        result.preview.push({ row: rowNumber, action: 'SKIP', key: '-', summary: message });
        if (batchId) {
          await this.catatBatchRow(schemaName, batchId, {
            rowNumber,
            action: 'SKIP',
            key: '-',
            summary: message,
            errorMessage: message,
            rawRow: row,
          });
        }
      }
    }

    if (batchId) await this.selesaikanBatch(schemaName, batchId, result);
    return result;
  }

  async daftarBatch(schemaName: string, dataset?: DatasetCode): Promise<DapodikImportBatchRow[]> {
    const S = `"${schemaName}"`;
    const params = dataset ? [dataset] : [];
    const where = dataset ? 'WHERE dataset = $1' : '';
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT id::text, dataset, format, total_rows, created_count, updated_count, skipped_count, error_count,
              status, created_at::text, completed_at::text, rolled_back_at::text, rollback_note
         FROM ${S}.pesantren_dapodik_import_batch
         ${where}
        ORDER BY created_at DESC
        LIMIT 50`,
      params,
    );
    return rows.map((row) => ({
      id: String(row.id),
      dataset: row.dataset as DatasetCode,
      format: row.format as 'csv' | 'json',
      totalRows: Number(row.total_rows ?? 0),
      createdCount: Number(row.created_count ?? 0),
      updatedCount: Number(row.updated_count ?? 0),
      skippedCount: Number(row.skipped_count ?? 0),
      errorCount: Number(row.error_count ?? 0),
      status: String(row.status),
      createdAt: String(row.created_at),
      completedAt: row.completed_at ? String(row.completed_at) : null,
      rolledBackAt: row.rolled_back_at ? String(row.rolled_back_at) : null,
      rollbackNote: row.rollback_note ? String(row.rollback_note) : null,
    }));
  }

  async detailBatch(schemaName: string, batchId: string) {
    const S = `"${schemaName}"`;
    const batch = await this.tenantDb.queryOne<Record<string, unknown>>(
      schemaName,
      `SELECT id::text, dataset, format, total_rows, created_count, updated_count, skipped_count, error_count,
              status, error_summary, created_at::text, completed_at::text, rolled_back_at::text, rollback_note
         FROM ${S}.pesantren_dapodik_import_batch
        WHERE id = $1`,
      [batchId],
    );
    if (!batch) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Batch import DAPODIK tidak ditemukan.');
    const rows = await this.tenantDb.query(
      schemaName,
      `SELECT id::text, row_number, action, target_table, target_id::text, import_key, summary,
              error_message, rollback_status, rollback_message, created_at::text
         FROM ${S}.pesantren_dapodik_import_row
        WHERE batch_id = $1
        ORDER BY row_number ASC`,
      [batchId],
    );
    return { batch, rows };
  }

  async rollbackBatch(schemaName: string, batchId: string, actorUserId: string) {
    const S = `"${schemaName}"`;
    const batch = await this.tenantDb.queryOne<{ id: string; status: string }>(
      schemaName,
      `SELECT id::text, status FROM ${S}.pesantren_dapodik_import_batch WHERE id = $1`,
      [batchId],
    );
    if (!batch) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Batch import DAPODIK tidak ditemukan.');
    if (['ROLLED_BACK', 'PARTIAL_ROLLBACK'].includes(batch.status)) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Batch import ini sudah pernah di-rollback.');
    }

    const rows = await this.tenantDb.query<{ id: string; target_table: string; target_id: string }>(
      schemaName,
      `SELECT id::text, target_table, target_id::text
         FROM ${S}.pesantren_dapodik_import_row
        WHERE batch_id = $1 AND action = 'CREATE' AND target_id IS NOT NULL AND rollback_status = 'PENDING'
        ORDER BY row_number DESC`,
      [batchId],
    );
    let rolledBack = 0;
    let failed = 0;
    for (const row of rows) {
      const table = DAPODIK_ROLLBACK_TABLES.get(row.target_table);
      if (!table) {
        failed += 1;
        await this.tandaiRollbackRow(schemaName, row.id, 'FAILED', 'Target tabel tidak diizinkan untuk rollback otomatis.');
        continue;
      }
      const updated = await this.tenantDb.query<{ id: string }>(
        schemaName,
        `UPDATE ${S}.${table}
            SET deleted_at = now(), version = version + 1
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id::text`,
        [row.target_id],
      );
      if (updated.length) {
        rolledBack += 1;
        await this.tandaiRollbackRow(schemaName, row.id, 'ROLLED_BACK', 'Baris yang dibuat batch sudah dihapus lunak.');
      } else {
        failed += 1;
        await this.tandaiRollbackRow(schemaName, row.id, 'FAILED', 'Data target tidak ditemukan atau sudah dihapus.');
      }
    }
    const status = failed > 0 ? 'PARTIAL_ROLLBACK' : 'ROLLED_BACK';
    await this.tenantDb.query(
      schemaName,
      `UPDATE ${S}.pesantren_dapodik_import_batch
          SET status = $2, rolled_back_at = now(), rolled_back_by = $3,
              rollback_note = $4
        WHERE id = $1`,
      [batchId, status, actorUserId, `Rollback created rows: ${rolledBack}, gagal: ${failed}. Update lama tidak dibalik otomatis.`],
    );
    return { batchId, status, rolledBack, failed, skippedUpdates: true };
  }

  private async mulaiBatch(schemaName: string, opsi: ImportOptions, totalRows: number): Promise<string> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne<{ id: string }>(
      schemaName,
      `INSERT INTO ${S}.pesantren_dapodik_import_batch
         (dataset, format, content_hash, dry_run, total_rows, created_by)
       VALUES ($1, $2, $3, false, $4, $5)
       RETURNING id::text`,
      [opsi.dataset, opsi.format, hashContent(opsi.content), totalRows, opsi.actorUserId],
    );
    if (!row) throw AppError.internal(ErrorCodes.INTERNAL_ERROR, 'Batch import DAPODIK gagal dibuat.');
    return row.id;
  }

  private async catatBatchRow(
    schemaName: string,
    batchId: string,
    input: {
      rowNumber: number;
      action: 'CREATE' | 'UPDATE' | 'SKIP';
      targetTable?: string;
      targetId?: string;
      key: string;
      summary: string;
      errorMessage?: string;
      rawRow: Record<string, string>;
    },
  ): Promise<void> {
    const S = `"${schemaName}"`;
    await this.tenantDb.query(
      schemaName,
      `INSERT INTO ${S}.pesantren_dapodik_import_row
         (batch_id, row_number, action, target_table, target_id, import_key, summary, error_message, raw_row, rollback_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
      [
        batchId,
        input.rowNumber,
        input.action,
        input.targetTable ?? null,
        input.targetId ?? null,
        input.key,
        input.summary,
        input.errorMessage ?? null,
        JSON.stringify(input.rawRow),
        input.action === 'CREATE' ? 'PENDING' : 'NOT_REQUIRED',
      ],
    );
  }

  private async selesaikanBatch(schemaName: string, batchId: string, result: ImportResult): Promise<void> {
    const S = `"${schemaName}"`;
    const status = result.errors.length ? 'IMPORTED_WITH_ERRORS' : 'IMPORTED';
    await this.tenantDb.query(
      schemaName,
      `UPDATE ${S}.pesantren_dapodik_import_batch
          SET created_count = $2, updated_count = $3, skipped_count = $4, error_count = $5,
              status = $6, error_summary = $7, completed_at = now()
        WHERE id = $1`,
      [
        batchId,
        result.created,
        result.updated,
        result.skipped,
        result.errors.length,
        status,
        result.errors.slice(0, 10).map((item) => `Baris ${item.row}: ${item.message}`).join('\n') || null,
      ],
    );
  }

  private async tandaiRollbackRow(schemaName: string, rowId: string, status: 'ROLLED_BACK' | 'FAILED', message: string): Promise<void> {
    const S = `"${schemaName}"`;
    await this.tenantDb.query(
      schemaName,
      `UPDATE ${S}.pesantren_dapodik_import_row
          SET rollback_status = $2, rollback_message = $3
        WHERE id = $1`,
      [rowId, status, message],
    );
  }

  private async previewUpsert(
    schemaName: string,
    dataset: DatasetCode,
    row: Record<string, string>,
  ): Promise<{ action: 'CREATE' | 'UPDATE'; key: string; summary: string }> {
    const S = `"${schemaName}"`;
    switch (dataset) {
      case 'unit-pendidikan':
        return previewSimple(this.tenantDb, schemaName, S, 'pesantren_unit_pendidikan', ['code'], withDefaults(row, { sort_order: '0' }), 'Unit pendidikan');
      case 'tahun-ajaran':
        return previewSimple(this.tenantDb, schemaName, S, 'pesantren_tahun_ajaran', ['code'], withDefaults(row, { status: 'DRAFT' }), 'Tahun ajaran');
      case 'santri':
        return previewSimple(this.tenantDb, schemaName, S, 'pesantren_santri', ['nis'], row, 'Santri');
      case 'psb-pendaftar':
        return previewSimple(this.tenantDb, schemaName, S, 'pesantren_psb_pendaftar', ['gelombang_id', 'nomor_pendaftaran'], await this.resolvePsbPendaftar(schemaName, row), 'Pendaftar PSB');
      case 'guru':
        return previewSimple(this.tenantDb, schemaName, S, 'pesantren_guru', ['nama'], withDefaults(row, { jenis: 'HONORER', status: 'AKTIF' }), 'Guru');
      case 'mata-pelajaran':
        return previewSimple(this.tenantDb, schemaName, S, 'pesantren_mata_pelajaran', ['code'], row, 'Mata pelajaran');
      case 'rombongan':
        return previewSimple(this.tenantDb, schemaName, S, 'pesantren_rombongan_belajar', ['unit_pendidikan_id', 'tahun_ajaran_id', 'nama'], await this.resolveRombongan(schemaName, row), 'Rombongan belajar');
      case 'anggota-rombel':
        return previewSimple(this.tenantDb, schemaName, S, 'pesantren_rombongan_anggota', ['santri_id', 'tahun_ajaran_id'], await this.resolveAnggotaRombel(schemaName, row), 'Anggota rombel');
      case 'kurikulum':
        return previewSimple(this.tenantDb, schemaName, S, 'pesantren_kurikulum', ['unit_pendidikan_id', 'tahun_ajaran_id', 'tingkat', 'mata_pelajaran_id'], await this.resolveKurikulum(schemaName, row), 'Kurikulum');
      case 'jadwal':
        return previewSimple(this.tenantDb, schemaName, S, 'pesantren_jadwal_pelajaran', ['rombongan_id', 'hari', 'waktu_mulai'], await this.resolveJadwal(schemaName, row), 'Jadwal');
      case 'komponen-nilai':
        return previewSimple(this.tenantDb, schemaName, S, 'pesantren_komponen_nilai', ['mata_pelajaran_id', 'kode'], await this.resolveKomponen(schemaName, row), 'Komponen nilai');
      case 'nilai':
        return previewSimple(this.tenantDb, schemaName, S, 'pesantren_nilai', ['santri_id', 'komponen_id', 'tahun_ajaran_id'], await this.resolveNilai(schemaName, row), 'Nilai');
      case 'ref-pekerjaan':
      case 'ref-pendidikan':
      case 'ref-penghasilan':
      case 'ref-transportasi':
      case 'ref-jenis-tinggal':
      case 'ref-kebutuhan-khusus':
        return previewSimple(
          this.tenantDb,
          schemaName,
          S,
          'pesantren_referensi_dapodik',
          ['kategori', 'code'],
          withDefaults({ ...row, kategori: this.kategoriReferensi(dataset) }, { sort_order: '0', is_active: 'true' }),
          'Referensi DAPODIK',
        );
    }
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
      case 'psb-pendaftar':
        return this.tenantDb.query(schemaName, `SELECT ta.code AS tahun_ajaran_code, g.kode AS gelombang_kode, p.nomor_pendaftaran, p.nama_lengkap, p.jenis_kelamin, p.tempat_lahir, p.tanggal_lahir::text, p.nama_orang_tua, p.no_hp_orang_tua, p.alamat, p.asal_sekolah, p.jalur_masuk, p.status FROM ${S}.pesantren_psb_pendaftar p JOIN ${S}.pesantren_psb_gelombang g ON g.id = p.gelombang_id JOIN ${S}.pesantren_tahun_ajaran ta ON ta.id = g.tahun_ajaran_id WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC`);
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
      case 'ref-pekerjaan':
      case 'ref-pendidikan':
      case 'ref-penghasilan':
      case 'ref-transportasi':
      case 'ref-jenis-tinggal':
      case 'ref-kebutuhan-khusus':
        return this.rowsReferensi(schemaName, dataset);
    }
  }

  private async upsert(schemaName: string, dataset: DatasetCode, row: Record<string, string>, actorUserId: string): Promise<UpsertOutcome> {
    const S = `"${schemaName}"`;
    switch (dataset) {
      case 'unit-pendidikan':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_unit_pendidikan', ['code'], ['code', 'name', 'jenis', 'sort_order'], withDefaults(row, { sort_order: '0' }), actorUserId);
      case 'tahun-ajaran':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_tahun_ajaran', ['code'], ['code', 'name', 'tanggal_mulai', 'tanggal_selesai', 'status'], withDefaults(row, { status: 'DRAFT' }), actorUserId);
      case 'santri':
        return upsertByExists(this.tenantDb, schemaName, `SELECT id::text AS id FROM ${S}.pesantren_santri WHERE nis = $1 AND deleted_at IS NULL`, [row.nis], async (exists) => {
          const santriRow = withDefaults(row, {
            status: 'AKTIF',
            status_tinggal: 'MUKIM',
            tanggal_masuk: new Date().toISOString().slice(0, 10),
            kewarganegaraan: 'WNI',
            kebutuhan_khusus: 'TIDAK_ADA',
            penerima_kip: 'false',
            penerima_kks: 'false',
          });
          if (santriRow.status !== 'AKTIF' && !santriRow.tanggal_keluar) {
            santriRow.tanggal_keluar = new Date().toISOString().slice(0, 10);
          }
          if (santriRow.status === 'AKTIF') {
            santriRow.tanggal_keluar = '';
            santriRow.alasan_keluar = '';
          }
          const columns = this.def('santri').columns;
          if (exists) {
            await this.tenantDb.query(schemaName, `UPDATE ${S}.pesantren_santri SET ${columns.filter((c) => c !== 'nis').map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = now(), updated_by = $${columns.length + 1}, version = version + 1 WHERE nis = $1 AND deleted_at IS NULL`, [row.nis, ...columns.filter((c) => c !== 'nis').map((c) => sqlValue(santriRow[c], c)), actorUserId]);
          } else {
            await this.tenantDb.query(schemaName, `INSERT INTO ${S}.pesantren_santri (${columns.join(', ')}, created_by, updated_by) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, $${columns.length + 1}, $${columns.length + 1})`, [...columns.map((c) => sqlValue(santriRow[c], c)), actorUserId]);
          }
        }, 'pesantren_santri', `nis=${row.nis || '-'}`, exists => exists ? 'Santri akan diperbarui.' : 'Santri akan dibuat.');
      case 'psb-pendaftar':
        return upsertSimple(this.tenantDb, schemaName, S, 'pesantren_psb_pendaftar', ['gelombang_id', 'nomor_pendaftaran'], ['gelombang_id', 'nomor_pendaftaran', 'nama_lengkap', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir', 'nama_orang_tua', 'no_hp_orang_tua', 'alamat', 'asal_sekolah', 'jalur_masuk', 'status'], await this.resolvePsbPendaftar(schemaName, row), actorUserId);
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
      case 'ref-pekerjaan':
      case 'ref-pendidikan':
      case 'ref-penghasilan':
      case 'ref-transportasi':
      case 'ref-jenis-tinggal':
      case 'ref-kebutuhan-khusus':
        return upsertSimple(
          this.tenantDb,
          schemaName,
          S,
          'pesantren_referensi_dapodik',
          ['kategori', 'code'],
          ['kategori', 'code', 'nama', 'sort_order', 'is_active'],
          withDefaults({ ...row, kategori: this.kategoriReferensi(dataset) }, { sort_order: '0', is_active: 'true' }),
          actorUserId,
        );
    }
  }

  private async rowsReferensi(schemaName: string, dataset: DatasetCode): Promise<Record<string, unknown>[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query(
      schemaName,
      `SELECT code, nama, sort_order, is_active
         FROM ${S}.pesantren_referensi_dapodik
        WHERE kategori = $1 AND deleted_at IS NULL
        ORDER BY sort_order ASC, nama ASC`,
      [this.kategoriReferensi(dataset)],
    );
  }

  private kategoriReferensi(dataset: DatasetCode): string {
    const kategori = REFERENSI_KATEGORI[dataset];
    if (!kategori) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Dataset "${dataset}" bukan referensi Dapodik.`);
    }
    return kategori;
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

  private async resolvePsbPendaftar(schemaName: string, row: Record<string, string>): Promise<Record<string, string>> {
    return {
      gelombang_id: await this.gelombangPsbId(schemaName, row.gelombang_kode, row.tahun_ajaran_code),
      nomor_pendaftaran: row.nomor_pendaftaran || nomorPsbImpor(row.gelombang_kode, row.nama_lengkap, row.tanggal_lahir),
      nama_lengkap: row.nama_lengkap,
      jenis_kelamin: row.jenis_kelamin,
      tempat_lahir: row.tempat_lahir,
      tanggal_lahir: row.tanggal_lahir,
      nama_orang_tua: row.nama_orang_tua,
      no_hp_orang_tua: row.no_hp_orang_tua,
      alamat: row.alamat,
      asal_sekolah: row.asal_sekolah,
      jalur_masuk: row.jalur_masuk,
      status: row.status || 'TERDAFTAR',
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

  private async gelombangPsbId(schemaName: string, kode: string, tahunAjaranCode: string): Promise<string> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne<{ id: string }>(
      schemaName,
      `SELECT g.id::text
         FROM ${S}.pesantren_psb_gelombang g
         JOIN ${S}.pesantren_tahun_ajaran ta ON ta.id = g.tahun_ajaran_id
        WHERE g.kode = $1 AND ta.code = $2 AND g.deleted_at IS NULL`,
      [kode, tahunAjaranCode],
    );
    if (!row) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Gelombang PSB "${kode}" tahun "${tahunAjaranCode}" tidak ditemukan.`);
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
): Promise<UpsertOutcome> {
  const where = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
  return upsertByExists(
    db,
    schemaName,
    `SELECT id::text AS id FROM ${S}.${table} WHERE ${where} AND deleted_at IS NULL`,
    keys.map((key) => sqlValue(row[key], key)),
    async (exists) => {
      if (exists) {
        const updateColumns = columns.filter((column) => !keys.includes(column));
        await db.query(schemaName, `UPDATE ${S}.${table} SET ${updateColumns.map((c, i) => `${c} = $${keys.length + i + 1}`).join(', ')}, updated_at = now(), updated_by = $${keys.length + updateColumns.length + 1}, version = version + 1 WHERE ${where} AND deleted_at IS NULL`, [...keys.map((key) => sqlValue(row[key], key)), ...updateColumns.map((c) => sqlValue(row[c], c)), actorUserId]);
      } else {
        await db.query(schemaName, `INSERT INTO ${S}.${table} (${columns.join(', ')}, created_by, updated_by) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}, $${columns.length + 1}, $${columns.length + 1})`, [...columns.map((c) => sqlValue(row[c], c)), actorUserId]);
      }
    },
    table,
    keys.map((item) => `${item}=${clean(row[item]) || '-'}`).join(', '),
    (exists) => exists ? `${labelTable(table)} akan diperbarui.` : `${labelTable(table)} akan dibuat.`,
  );
}

async function previewSimple(
  db: TenantConnectionService,
  schemaName: string,
  S: string,
  table: string,
  keys: string[],
  row: Record<string, string>,
  label: string,
): Promise<{ action: 'CREATE' | 'UPDATE'; key: string; summary: string }> {
  const where = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
  const params = keys.map((key) => sqlValue(row[key], key));
  const exists = Boolean(await db.queryOne(schemaName, `SELECT id FROM ${S}.${table} WHERE ${where} AND deleted_at IS NULL`, params));
  const key = keys.map((item) => `${item}=${clean(row[item]) || '-'}`).join(', ');
  return {
    action: exists ? 'UPDATE' : 'CREATE',
    key,
    summary: exists ? `${label} akan diperbarui.` : `${label} akan dibuat.`,
  };
}

async function upsertByExists(
  db: TenantConnectionService,
  schemaName: string,
  existsSql: string,
  existsParams: unknown[],
  write: (exists: boolean) => Promise<void>,
  targetTable: string,
  key: string,
  summary: (exists: boolean) => string,
): Promise<UpsertOutcome> {
  const existing = await db.queryOne<{ id: string }>(schemaName, existsSql, existsParams);
  const exists = Boolean(existing);
  await write(exists);
  const target = existing ?? await db.queryOne<{ id: string }>(schemaName, existsSql, existsParams);
  if (!target) throw AppError.internal(ErrorCodes.INTERNAL_ERROR, `Target import ${targetTable} gagal ditemukan setelah upsert.`);
  return {
    action: exists ? 'updated' : 'created',
    targetTable,
    targetId: target.id,
    key,
    summary: summary(exists),
  };
}

function normalizeRow(row: Record<string, unknown>, columns: string[], dataset: DatasetCode): Record<string, string> {
  const out: Record<string, string> = {};
  const indexed = new Map(Object.entries(row).map(([key, value]) => [headerKey(key), value]));
  const aliases = DATASET_ALIASES[dataset] ?? {};
  for (const column of columns) {
    const candidates = [column, ...(aliases[column] ?? [])];
    const found = candidates.map(headerKey).find((candidate) => indexed.has(candidate));
    out[column] = clean(found ? indexed.get(found) : row[column]);
  }
  return out;
}

function headerKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/[_./()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function labelTable(table: string): string {
  const labels: Record<string, string> = {
    pesantren_unit_pendidikan: 'Unit pendidikan',
    pesantren_tahun_ajaran: 'Tahun ajaran',
    pesantren_santri: 'Santri',
    pesantren_psb_pendaftar: 'Pendaftar PSB',
    pesantren_guru: 'Guru',
    pesantren_mata_pelajaran: 'Mata pelajaran',
    pesantren_rombongan_belajar: 'Rombongan belajar',
    pesantren_rombongan_anggota: 'Anggota rombel',
    pesantren_kurikulum: 'Kurikulum',
    pesantren_jadwal_pelajaran: 'Jadwal',
    pesantren_komponen_nilai: 'Komponen nilai',
    pesantren_nilai: 'Nilai',
    pesantren_referensi_dapodik: 'Referensi DAPODIK',
  };
  return labels[table] ?? table;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Baris tidak dapat diimpor.';
}

function nomorPsbImpor(gelombangKode: string, nama: string, tanggalLahir: string): string {
  const basis = `${nama}-${tanggalLahir || 'tanpa-tanggal'}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return `IMP-${gelombangKode}-${basis || 'PENDAFTAR'}`;
}
