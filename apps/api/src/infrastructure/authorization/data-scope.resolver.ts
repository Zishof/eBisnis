import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../database/tenant-connection.service';
import type { DataScopeCode } from '../provisioning/role-profile';

/**
 * Menerjemahkan batas data role menjadi predikat SQL.
 *
 * V010 menyimpan tingkat batas data pada `role_data_scope` dan V011 menyimpan
 * penugasan konkret pada `user_scope_assignment`. Keduanya tidak menyaring apa
 * pun sampai ada yang memakainya — sampai berkas ini ada, batas data adalah
 * data yang benar tanpa penjaga, persis seperti menu tersembunyi tanpa
 * PermissionGuard.
 *
 * Predikat dikembalikan sebagai fragmen SQL, bukan diterapkan sendiri, karena
 * query pada sistem ini ditulis sebagai SQL mentah dengan bentuk yang
 * berbeda-beda. Pemanggil menyisipkannya pada klausa WHERE-nya.
 */

/** Tingkat yang berarti "seluruh tenant"; tidak menyaring apa pun. */
const UNRESTRICTED: ReadonlySet<string> = new Set(['PLATFORM', 'TENANT']);

/** Tingkat yang berarti "hanya milik sendiri". */
const SELF_SCOPE = 'SELF';

/**
 * Urutan keluasan, dari paling luas. Dipakai ketika pengguna memegang beberapa
 * role dengan tingkat berbeda: yang berlaku adalah yang PALING LUAS.
 *
 * Ini disengaja. Seseorang yang menjadi kepala gudang sekaligus direktur harus
 * melihat sebagaimana direktur; mengambil yang tersempit akan membuat
 * penambahan role justru mengurangi akses, dan itu perilaku yang membingungkan
 * sekaligus mendorong orang membuat akun kedua.
 */
const BREADTH_ORDER: readonly string[] = [
  'PLATFORM',
  'TENANT',
  'LEGAL_ENTITY',
  'BRAND',
  'STORE',
  'OUTLET',
  'FULFILLMENT_LOCATION',
  'WAREHOUSE',
  'OUTLET_TERMINAL',
  'DEPARTMENT',
  'TEAM',
  'ASSIGNED_QUEUE',
  'ASSIGNED_TRIP',
  'PAYMENT_PROVIDER_ACCOUNT',
  'API_SCOPE',
  'OWNERSHIP',
  'SELF',
];

/** Predikat siap disisipkan ke klausa WHERE. */
export interface ScopePredicate {
  /** Fragmen SQL. `TRUE` berarti tanpa batas, `FALSE` berarti nol baris. */
  sql: string;
  /** Parameter untuk fragmen di atas, sudah bernomor sesuai `startIndex`. */
  params: unknown[];
  /** Tingkat yang benar-benar dipakai; berguna untuk log dan pengujian. */
  level: string | null;
  /** Benar bila pemegangnya tidak melihat baris apa pun. */
  denied: boolean;
}

/**
 * Peta tingkat batas data ke kolom pada query pemanggil.
 *
 * Contoh untuk saldo stok:
 * ```
 * { WAREHOUSE: 'sb.warehouse_id', LEGAL_ENTITY: 'w.legal_entity_id' }
 * ```
 */
export type ScopeColumnMap = Partial<Record<DataScopeCode | string, string>>;

const ALLOW: ScopePredicate = { sql: 'TRUE', params: [], level: null, denied: false };

@Injectable()
export class DataScopeResolver {
  private readonly logger = new Logger(DataScopeResolver.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Tingkat batas data terluas yang dimiliki pengguna, beserta apakah tingkat
   * itu menuntut penugasan konkret.
   */
  async resolveLevel(
    schemaName: string,
    userSubjectId: string,
  ): Promise<{ level: string; requiresAssignment: boolean } | null> {
    const rows = await this.tenantDb.query<{
      scope_level: string;
      requires_assignment: boolean;
    }>(
      schemaName,
      `SELECT DISTINCT rds.scope_level, rds.requires_assignment
         FROM role_data_scope rds
         JOIN user_role_assignment ura
           ON ura.role_id = rds.role_id
          AND ura.user_subject_id = $1
          AND ura.valid_from <= now()
          AND (ura.valid_until IS NULL OR ura.valid_until > now())
         JOIN role r ON r.id = rds.role_id AND r.deleted_at IS NULL AND r.is_active`,
      [userSubjectId],
    );

    if (rows.length === 0) return null;

    let best = rows[0];
    let bestRank = rank(best.scope_level);
    for (const row of rows.slice(1)) {
      const candidate = rank(row.scope_level);
      if (candidate < bestRank) {
        best = row;
        bestRank = candidate;
      }
    }
    return { level: best.scope_level, requiresAssignment: best.requires_assignment };
  }

  /** Id objek yang ditugaskan kepada pengguna pada satu tingkat. */
  async resolveAssignments(
    schemaName: string,
    userSubjectId: string,
    scopeType: string,
  ): Promise<string[]> {
    const rows = await this.tenantDb.query<{ scope_id: string }>(
      schemaName,
      `SELECT DISTINCT scope_id::text AS scope_id
         FROM user_scope_assignment
        WHERE user_subject_id = $1
          AND scope_type = $2
          AND revoked_at IS NULL
          AND valid_from <= now()
          AND (valid_until IS NULL OR valid_until > now())
        UNION
       SELECT DISTINCT rs.scope_id::text
         FROM role_scope rs
         JOIN user_role_assignment ura
           ON ura.role_id = rs.role_id
          AND ura.user_subject_id = $1
          AND ura.valid_from <= now()
          AND (ura.valid_until IS NULL OR ura.valid_until > now())
        WHERE rs.scope_type = $2
          AND rs.scope_id IS NOT NULL`,
      [userSubjectId, scopeType],
    );
    return rows.map((row) => row.scope_id);
  }

  /**
   * Membangun predikat untuk satu query.
   *
   * `columns` memetakan tingkat batas data ke kolom yang mewakilinya pada query
   * pemanggil. `startIndex` adalah nomor parameter berikutnya yang tersedia,
   * sehingga predikat dapat digabung dengan parameter yang sudah ada.
   */
  async buildPredicate(
    schemaName: string,
    userSubjectId: string,
    columns: ScopeColumnMap,
    options: { startIndex?: number; ownerColumn?: string } = {},
  ): Promise<ScopePredicate> {
    const startIndex = options.startIndex ?? 1;
    const scope = await this.resolveLevel(schemaName, userSubjectId);

    // Tanpa role sama sekali berarti tanpa akses. Meloloskannya akan membuat
    // pengguna yang seluruh role-nya dicabut justru melihat segalanya.
    if (!scope) return { sql: 'FALSE', params: [], level: null, denied: true };

    if (UNRESTRICTED.has(scope.level)) return { ...ALLOW, level: scope.level };

    if (scope.level === SELF_SCOPE) {
      const column = options.ownerColumn ?? columns[SELF_SCOPE];
      if (!column) {
        // Sumber daya ini tidak punya kolom pemilik, sehingga "hanya milik
        // sendiri" tidak dapat dinyatakan. Menolak lebih aman daripada
        // menampilkan seluruhnya.
        this.logger.warn(
          `Batas data SELF tidak dapat diterapkan: query tidak menyediakan kolom pemilik.`,
        );
        return { sql: 'FALSE', params: [], level: scope.level, denied: true };
      }
      return {
        sql: `${column} = $${startIndex}`,
        params: [userSubjectId],
        level: scope.level,
        denied: false,
      };
    }

    const column = columns[scope.level];
    if (!column) {
      // Tingkat yang dimiliki pengguna tidak dapat dipetakan ke query ini.
      // Contohnya pemegang batas ASSIGNED_TRIP membuka daftar produk.
      this.logger.warn(
        `Batas data ${scope.level} tidak dapat dipetakan pada query ini; akses ditolak.`,
      );
      return { sql: 'FALSE', params: [], level: scope.level, denied: true };
    }

    const assignments = await this.resolveAssignments(schemaName, userSubjectId, scope.level);

    if (assignments.length === 0) {
      // Inti aturannya: tingkat yang menuntut penugasan tetapi belum ditugaskan
      // berarti NOL baris, bukan seluruhnya. Kebalikannya adalah cara paling
      // mudah membocorkan data — role baru yang belum sempat ditugaskan akan
      // melihat segalanya.
      if (scope.requiresAssignment) {
        return { sql: 'FALSE', params: [], level: scope.level, denied: true };
      }
      return { ...ALLOW, level: scope.level };
    }

    return {
      sql: `${column} = ANY($${startIndex}::uuid[])`,
      params: [assignments],
      level: scope.level,
      denied: false,
    };
  }
}

function rank(level: string): number {
  const index = BREADTH_ORDER.indexOf(level);
  // Tingkat yang tidak dikenal diperlakukan sebagai yang paling sempit, sehingga
  // salah ketik pada data tidak berubah menjadi akses yang lebih luas.
  return index === -1 ? BREADTH_ORDER.length : index;
}
