import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { StepUpPurpose } from '@prisma/client';

export const IS_PUBLIC_KEY = 'ebisnis:isPublic';
export const PERMISSIONS_KEY = 'ebisnis:permissions';
export const PLATFORM_PERMISSIONS_KEY = 'ebisnis:platformPermissions';
export const STEP_UP_KEY = 'ebisnis:stepUp';
export const DEMO_BLOCKED_KEY = 'ebisnis:demoBlocked';

/** Menandai endpoint dapat diakses tanpa autentikasi. Guard global aktif secara default. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Permission tenant yang dibutuhkan, format `MENU_CODE.ACTION`. */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

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
    };
  },
);

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
