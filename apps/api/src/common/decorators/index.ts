import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { StepUpPurpose } from '@prisma/client';

export const IS_PUBLIC_KEY = 'ebisnis:isPublic';
export const PERMISSIONS_KEY = 'ebisnis:permissions';
export const PLATFORM_PERMISSIONS_KEY = 'ebisnis:platformPermissions';
export const STEP_UP_KEY = 'ebisnis:stepUp';
export const DEMO_BLOCKED_KEY = 'ebisnis:demoBlocked';
export const AUTHENTICATED_ONLY_KEY = 'ebisnis:authenticatedOnly';
export const RESOURCE_PERMISSION_KEY = 'ebisnis:resourcePermission';
export const REPORT_PERMISSION_KEY = 'ebisnis:reportPermission';

/** Menandai endpoint dapat diakses tanpa autentikasi. Guard global aktif secara default. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Permission tenant yang dibutuhkan, format `MENU_CODE.ACTION`. */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Endpoint menuntut sesi yang sah tetapi tidak menuntut permission tertentu.
 *
 * Dipakai hanya untuk endpoint yang berbicara tentang pemanggilnya sendiri:
 * profil, keluar, ganti kata sandi, daftar menu yang boleh ia lihat. Endpoint
 * yang menyentuh data selain milik pemanggil wajib memakai `@Permissions` atau
 * `@ResourcePermission`, bukan penanda ini.
 *
 * Penanda ini harus ditulis eksplisit. PermissionGuard menolak handler yang
 * tidak memiliki satu pun penanda, sehingga hak akses tidak dapat terlewat
 * hanya karena dekoratornya lupa ditulis.
 */
export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY_KEY, true);

/**
 * Permission yang kode menunya ditentukan saat permintaan, dari parameter route
 * `:resource`.
 *
 * Endpoint CRUD master melayani puluhan sumber daya lewat satu handler, sehingga
 * kode menunya tidak dapat ditulis sebagai konstanta. Guard menyelesaikannya
 * lewat registry: `resourceCode` menjadi `menuCode`, lalu `MENU_CODE.ACTION`.
 */
export const ResourcePermission = (action: string) => SetMetadata(RESOURCE_PERMISSION_KEY, action);

/**
 * Permission yang ditentukan oleh KODE LAPORAN pada parameter route `:code`.
 *
 * Satu handler melayani seluruh laporan, sehingga haknya tidak dapat ditulis
 * sebagai konstanta — persis persoalan yang sama dengan `:resource` di atas,
 * dan diselesaikan lewat jalur yang sama supaya tidak ada dua aturan berbeda.
 *
 * Petanya di `izin-laporan.ts`. Kode yang tidak ada di sana DITOLAK, bukan
 * diloloskan dengan hak bawaan.
 */
export const ReportPermission = () => SetMetadata(REPORT_PERMISSION_KEY, true);

/** Permission control plane yang dibutuhkan, mis. `PLATFORM.TENANT.READ`. */
export const PlatformPermissions = (...permissions: string[]) =>
  SetMetadata(PLATFORM_PERMISSIONS_KEY, permissions);

/** Endpoint memerlukan step-up authentication yang masih valid. */
export const RequireStepUp = (purpose: StepUpPurpose) => SetMetadata(STEP_UP_KEY, purpose);

/** Endpoint tidak boleh dijalankan oleh sesi demo. */
export const BlockDemo = () => SetMetadata(DEMO_BLOCKED_KEY, true);

export interface AuthenticatedUser {
  userId: string;
  username: string;
  displayName: string;
  isPlatformStaff: boolean;
  platformPermissions: string[];
  mustChangePassword: boolean;
  sessionId: string;
  tokenFamilyId: string;
  tenantId?: string;
  schemaName?: string;
  auditSchemaName?: string;
  isDemo: boolean;
  localeCode: string;
  /**
   * Peran yang sedang dipakai, bila pengguna memilih satu.
   *
   * `undefined` berarti belum memilih — izinnya gabungan seluruh peran, persis
   * seperti sebelum V10-4. Nilainya berasal dari baris sesi, bukan dari klaim
   * token, supaya pergantian peran berlaku seketika.
   */
  activeRoleId?: string;
  activeRoleCode?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined =>
    ctx.switchToHttp().getRequest().user,
);

export interface TenantContext {
  tenantId: string;
  schemaName: string;
  auditSchemaName: string;
  isDemo: boolean;
}

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext | undefined =>
    ctx.switchToHttp().getRequest().tenant,
);

export interface RequestMeta {
  requestId?: string;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
  idempotencyKey?: string;
  localeCode: string;
  /** Host pada permintaan (tanpa porta), dipakai memilih portal/merek yang berlaku. */
  hostname?: string;
}

export const RequestContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestMeta => {
    const request = ctx.switchToHttp().getRequest();
    return {
      requestId: request.requestId,
      correlationId: request.correlationId,
      ipAddress: request.ip ?? request.socket?.remoteAddress,
      userAgent: request.headers?.['user-agent'],
      idempotencyKey: request.headers?.['idempotency-key'],
      localeCode: resolveLocale(request),
      hostname: resolveHostname(request),
    };
  },
);

function resolveHostname(request: { hostname?: string; headers?: Record<string, string | string[] | undefined> }): string | undefined {
  // `request.hostname` (Express) sudah membuang porta; `headers.host` dipakai
  // hanya sebagai cadangan bila middleware Express tidak mengisinya (mis. pada
  // pengujian unit yang membuat request palsu tanpa lapisan Express penuh).
  if (request.hostname) return request.hostname;
  const raw = request.headers?.host;
  const host = Array.isArray(raw) ? raw[0] : raw;
  return host?.split(':')[0];
}

function resolveLocale(request: {
  user?: { localeCode?: string };
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
}): string {
  const supported = ['id', 'en', 'ar', 'zh-CN'];
  const fromQuery = typeof request.query?.locale === 'string' ? request.query.locale : undefined;
  if (fromQuery && supported.includes(fromQuery)) return fromQuery;
  if (request.user?.localeCode && supported.includes(request.user.localeCode)) {
    return request.user.localeCode;
  }
  const header = request.headers?.['accept-language'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (raw) {
    for (const part of raw.split(',')) {
      const tag = part.split(';')[0]?.trim();
      if (!tag) continue;
      if (supported.includes(tag)) return tag;
      const base = tag.split('-')[0];
      const match = supported.find((s) => s.split('-')[0] === base);
      if (match) return match;
    }
  }
  return 'id';
}
