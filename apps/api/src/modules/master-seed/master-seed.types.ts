/**
 * Master Seed Registry — kontrak seed data master (Versi 5, bagian 11.7C).
 *
 * Setiap tabel master yang dapat dikelola pengguna wajib mempunyai minimal
 * 10 record contoh yang deterministik, idempotent, dan bertanda `isSample=true`.
 */

export type MasterSeedStrategy = 'UPSERT_BY_CODE' | 'INSERT_IF_MISSING';

export type HardDeletePolicy =
  | 'NEVER_PURGE'
  | 'PURGE_IF_UNREFERENCED'
  | 'PURGE_SAMPLE_ONLY'
  | 'PURGE_AFTER_RETENTION'
  | 'PLATFORM_SUPER_ADMIN_ONLY';

export interface MasterSeedRecord {
  /** Kode bisnis stabil — dipakai sebagai kunci upsert. */
  code: string;
  /** Kolom lain pada tabel; nilai literal atau resolver terhadap konteks seed. */
  [column: string]: unknown;
}

export interface MasterSeedReference {
  /** Tabel yang mereferensikan master ini. */
  table: string;
  /** Kolom foreign key pada tabel tersebut. */
  column: string;
  /** True jika tabel ini adalah transaksi nyata (bukan data contoh). */
  isTransactional: boolean;
}

/**
 * Sifat sebuah master terhadap pilihan "termasuk data contoh".
 *
 * ## Mengapa perlu dibedakan
 *
 * Seluruh isi seed tenant selama ini ditandai `is_sample = true`, dan itu
 * menyesatkan. Satuan (UOM), bagan akun, kategori pajak, templat pemberitahuan,
 * dan nomor urut BUKAN contoh — tanpanya sistem tidak dapat dipakai sama sekali.
 * Menghapusnya atas nama "membersihkan data contoh" akan melumpuhkan tenant.
 *
 * `REFERENCE` selalu disemai dan tidak pernah ikut terhapus.
 * `EXAMPLE` hanya disemai bila penyewa memintanya, dan boleh dihapus kapan saja.
 *
 * Peran, menu, dan hak akses termasuk `REFERENCE` — mereka menentukan siapa
 * boleh melakukan apa, dan menghapusnya akan mengunci penyewa keluar dari
 * sistemnya sendiri.
 */
export type SeedKind = 'REFERENCE' | 'EXAMPLE';

export interface MasterSeedDefinition {
  /** Kode resource, mis. `PRODUCT_CATEGORY`. */
  resourceCode: string;
  /** Label Bahasa Indonesia untuk laporan verifikasi. */
  label: string;
  /** Nama tabel fisik. */
  table: string;
  /** `tenant` = schema tenant; `platform` = control plane. */
  scope: 'tenant' | 'platform';
  /** Nama model Prisma (hanya untuk scope `platform`). */
  prismaModel?: string;
  minimumRecords: number;
  strategy: MasterSeedStrategy;
  supportsSampleCleanup: boolean;
  /**
   * REFERENCE selalu ada; EXAMPLE hanya bila diminta.
   *
   * Bawaannya `REFERENCE` dengan sengaja: master baru yang lupa
   * diklasifikasikan akan tetap disemai dan tidak akan terhapus, sehingga
   * kelalaian menghasilkan tenant yang berlebih datanya — bukan tenant yang
   * lumpuh.
   */
  seedKind?: SeedKind;
  hardDeletePolicy: HardDeletePolicy;
  /** Kolom yang menjadi kunci unik upsert. Default `code`. */
  uniqueColumn?: string;
  /** Referensi FK untuk pemeriksaan sebelum purge/cleanup. */
  references?: MasterSeedReference[];
  /** Alasan bila master ini dikecualikan dari aturan minimum 10 record. */
  exceptionReason?: string;
  /** Urutan eksekusi (dependency-aware). */
  order: number;
  /**
   * Record contoh. Fungsi resolver menerima konteks seed sehingga dapat
   * menyelesaikan foreign key berdasarkan kode master lain.
   */
  records: MasterSeedRecord[] | ((ctx: MasterSeedContext) => Promise<MasterSeedRecord[]>);
}

export interface MasterSeedContext {
  schemaName: string;
  sampleBatchId: string;
  /** Mencari id record master berdasarkan tabel + kode. */
  lookupId(table: string, code: string): Promise<string | null>;
  /** Sama seperti lookupId tetapi melempar error bila tidak ditemukan. */
  requireId(table: string, code: string): Promise<string>;
}

export interface MasterSeedVerifyRow {
  resourceCode: string;
  label: string;
  requiredMinimum: number;
  activeCount: number;
  sampleCount: number;
  status: 'OK' | 'INSUFFICIENT' | 'EXEMPT' | 'MISSING_TABLE' | 'SAMPLE_EMPTY';
  /** Acuan atau contoh. Antarmuka memakainya untuk memisahkan kedua golongan. */
  seedKind: SeedKind;
  missingCodes: string[];
}

export interface MasterSeedVerifyReport {
  schemaName: string;
  scope: 'tenant' | 'platform';
  checkedAt: string;
  passed: boolean;
  totalResources: number;
  failingResources: number;
  rows: MasterSeedVerifyRow[];
}

export function defineMasterSeed(definition: MasterSeedDefinition): MasterSeedDefinition {
  if (definition.minimumRecords > 0 && Array.isArray(definition.records)) {
    const codes = new Set(definition.records.map((r) => r.code));
    if (codes.size !== definition.records.length) {
      throw new Error(`Seed ${definition.resourceCode} memiliki kode duplikat.`);
    }
    if (definition.records.length < definition.minimumRecords) {
      throw new Error(
        `Seed ${definition.resourceCode} hanya mendefinisikan ${definition.records.length} record, ` +
          `minimum ${definition.minimumRecords}.`,
      );
    }
  }
  return definition;
}
