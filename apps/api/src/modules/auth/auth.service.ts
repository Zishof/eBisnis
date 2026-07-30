import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { DEMO_PLATFORM_USER_ID } from '../../infrastructure/provisioning/tenant-bootstrap.service';

const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  mustChangePassword: boolean;
  user: {
    id: string;
    username: string;
    displayName: string;
    isPlatformStaff: boolean;
    localeCode: string;
    platformPermissions: string[];
  };
  tenant: { tenantId: string; schemaName: string; tenantName: string } | null;
}

export interface AccessTokenPayload {
  sub: string;
  username: string;
  sid: string;
  fam: string;
  tid?: string;
  /** Nama schema hanya sebagai petunjuk; runtime tetap mencocokkan dengan registry. */
  sch?: string;
  demo: boolean;
  staff: boolean;
  mcp: boolean;
  loc: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(
    input: { username: string; password: string; tenantCode?: string },
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<LoginResult> {
    const normalized = input.username.trim().toLowerCase();

    const user = await this.prisma.platformUser.findFirst({
      where: {
        OR: [{ normalizedUsername: normalized }, { normalizedEmail: normalized }],
        deletedAt: null,
      },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    const recordAttempt = async (success: boolean, failureCode?: string) => {
      await this.prisma.platformLoginAttempt.create({
        data: {
          username: normalized.slice(0, 64),
          userId: user?.id ?? null,
          success,
          failureCode: failureCode ?? null,
          ipAddress: meta.ipAddress ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
    };

    if (!user) {
      await recordAttempt(false, ErrorCodes.INVALID_CREDENTIALS);
      await this.audit.recordSecurity({
        eventCode: 'LOGIN_FAILED_UNKNOWN_USER',
        actorUsername: normalized,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });
      // Pesan seragam agar tidak membocorkan keberadaan akun.
      throw AppError.unauthorized(
        ErrorCodes.INVALID_CREDENTIALS,
        'Nama pengguna atau kata sandi tidak tepat.',
      );
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await recordAttempt(false, ErrorCodes.ACCOUNT_LOCKED);
      throw AppError.unauthorized(
        ErrorCodes.ACCOUNT_LOCKED,
        'Akun terkunci sementara karena percobaan masuk yang gagal berulang.',
        { lockedUntil: user.lockedUntil.toISOString() },
      );
    }

    if (user.status !== 'ACTIVE' || !user.isActive) {
      await recordAttempt(false, ErrorCodes.ACCOUNT_INACTIVE);
      throw AppError.unauthorized(ErrorCodes.ACCOUNT_INACTIVE, 'Akun tidak aktif.');
    }

    const valid = await argon2.verify(user.passwordHash, input.password).catch(() => false);
    if (!valid) {
      const failedCount = user.failedLoginCount + 1;
      await this.prisma.platformUser.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failedCount,
          lockedUntil:
            failedCount >= MAX_FAILED_LOGINS
              ? new Date(Date.now() + LOCK_MINUTES * 60_000)
              : user.lockedUntil,
        },
      });
      await recordAttempt(false, ErrorCodes.INVALID_CREDENTIALS);
      await this.audit.recordSecurity({
        eventCode: 'LOGIN_FAILED_BAD_PASSWORD',
        actorUserId: user.id,
        actorUsername: user.username,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
        detail: { failedCount },
      });
      throw AppError.unauthorized(
        ErrorCodes.INVALID_CREDENTIALS,
        'Nama pengguna atau kata sandi tidak tepat.',
      );
    }

    // Resolve tenant dari membership — TIDAK dari input pengguna.
    const membership = await this.resolveMembership(user.id, input.tenantCode);

    const platformPermissions = collectPermissions(user);

    const session = await this.prisma.platformSession.create({
      data: {
        userId: user.id,
        tokenFamilyId: randomUUID(),
        tenantId: membership?.tenantId ?? null,
        schemaName: membership?.schemaName ?? null,
        isDemo: false,
        expiresAt: new Date(Date.now() + this.refreshTtlMs()),
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });

    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await recordAttempt(true);

    const tokens = await this.issueTokens({
      userId: user.id,
      username: user.username,
      sessionId: session.id,
      tokenFamilyId: session.tokenFamilyId,
      tenantId: membership?.tenantId,
      schemaName: membership?.schemaName,
      isDemo: false,
      isPlatformStaff: user.isPlatformStaff,
      mustChangePassword: user.mustChangePassword,
      localeCode: user.preferredLocaleCode ?? 'id',
    });

    await this.audit.record({
      moduleCode: 'AUTH',
      actionCode: 'LOGIN',
      entityType: 'PlatformUser',
      entityId: user.id,
      actorUserId: user.id,
      actorUsername: user.username,
      sessionId: session.id,
      tenantId: membership?.tenantId,
      tenantSchema: membership?.schemaName,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
      metadata: { mustChangePassword: user.mustChangePassword },
    });

    return {
      ...tokens,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        isPlatformStaff: user.isPlatformStaff,
        localeCode: user.preferredLocaleCode ?? 'id',
        platformPermissions,
      },
      tenant: membership
        ? {
            tenantId: membership.tenantId,
            schemaName: membership.schemaName,
            tenantName: membership.tenantName,
          }
        : null,
    };
  }

  /** Sesi demo tanpa pendaftaran: hanya mengarah ke schema demo. */
  async createDemoSession(meta: {
    ipAddress?: string;
    userAgent?: string;
    localeCode?: string;
    requestId?: string;
  }): Promise<{
    accessToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
    demoSessionId: string;
    schemaName: string;
    expiresAt: string;
    banner: string;
  }> {
    const demoSchema = this.config.get<string>('schema.demo', 'demo');
    const registry = await this.prisma.tenantSchemaRegistry.findUnique({
      where: { schemaName: demoSchema },
      include: { tenant: true },
    });
    if (!registry || registry.status !== 'READY') {
      throw AppError.unprocessable(
        ErrorCodes.TENANT_NOT_READY,
        'Sandbox demo belum siap. Jalankan `pnpm db:seed` terlebih dahulu.',
      );
    }

    const ttlMinutes = this.config.get<number>('demo.sessionTtlMinutes', 120);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
    const sessionToken = randomBytes(32).toString('hex');

    const lastReset = await this.prisma.demoResetRun.findFirst({
      orderBy: { startedAt: 'desc' },
      select: { generation: true },
    });

    const demoSession = await this.prisma.demoSession.create({
      data: {
        sessionToken: hashToken(sessionToken),
        schemaName: demoSchema,
        localeCode: meta.localeCode ?? 'id',
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
        resetGeneration: lastReset?.generation ?? 0,
        expiresAt,
      },
    });

    // Subject sesi demo memakai identitas demo tetap, bukan id sesi, agar
    // resolusi permission tenant (`user_subject.platform_user_id`) berjalan
    // melalui jalur yang sama dengan pengguna biasa. Validasi masa berlaku sesi
    // tetap memakai `sid`.
    const payload: AccessTokenPayload = {
      sub: DEMO_PLATFORM_USER_ID,
      username: 'demo',
      sid: demoSession.id,
      fam: demoSession.id,
      tid: registry.tenantId,
      sch: demoSchema,
      demo: true,
      staff: false,
      mcp: false,
      loc: meta.localeCode ?? 'id',
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: `${ttlMinutes}m`,
    });

    await this.audit.record({
      moduleCode: 'AUTH',
      actionCode: 'DEMO_SESSION_CREATED',
      entityType: 'DemoSession',
      entityId: demoSession.id,
      tenantId: registry.tenantId,
      tenantSchema: demoSchema,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return {
      accessToken,
      expiresIn: ttlMinutes * 60,
      tokenType: 'Bearer',
      demoSessionId: demoSession.id,
      schemaName: demoSchema,
      expiresAt: expiresAt.toISOString(),
      banner:
        'Anda berada pada sandbox demo yang dipakai bersama. Jangan memasukkan data pribadi ' +
        'atau rahasia. Data demo di-reset secara berkala.',
    };
  }

  async refresh(
    refreshToken: string,
    meta: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<Omit<LoginResult, 'user' | 'tenant' | 'mustChangePassword'>> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.platformRefreshToken.findUnique({
      where: { tokenHash },
      include: { session: { include: { user: true } } },
    });

    if (!stored) {
      throw AppError.unauthorized(ErrorCodes.TOKEN_EXPIRED, 'Refresh token tidak dikenali.');
    }

    // Token reuse → cabut seluruh family (rotation detection).
    if (stored.usedAt || stored.revokedAt) {
      await this.revokeFamily(stored.session.tokenFamilyId, 'TOKEN_REUSE_DETECTED');
      await this.audit.recordSecurity({
        eventCode: 'REFRESH_TOKEN_REUSE',
        severity: 'CRITICAL',
        actorUserId: stored.session.userId,
        ipAddress: meta.ipAddress,
        requestId: meta.requestId,
        detail: { sessionId: stored.sessionId },
      });
      throw AppError.unauthorized(
        ErrorCodes.TOKEN_REUSED,
        'Refresh token telah dipakai. Seluruh sesi dicabut untuk keamanan.',
      );
    }

    if (stored.expiresAt < new Date() || stored.session.revokedAt) {
      throw AppError.unauthorized(ErrorCodes.TOKEN_EXPIRED, 'Sesi telah berakhir.');
    }

    await this.prisma.platformRefreshToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    });

    const user = stored.session.user;
    const tokens = await this.issueTokens({
      userId: user.id,
      username: user.username,
      sessionId: stored.sessionId,
      tokenFamilyId: stored.session.tokenFamilyId,
      tenantId: stored.session.tenantId ?? undefined,
      schemaName: stored.session.schemaName ?? undefined,
      isDemo: stored.session.isDemo,
      isPlatformStaff: user.isPlatformStaff,
      mustChangePassword: user.mustChangePassword,
      localeCode: user.preferredLocaleCode ?? 'id',
      parentTokenId: stored.id,
    });

    await this.prisma.platformSession.update({
      where: { id: stored.sessionId },
      data: { lastSeenAt: new Date() },
    });

    return tokens;
  }

  async logout(sessionId: string, actorUserId?: string): Promise<void> {
    const session = await this.prisma.platformSession.findUnique({ where: { id: sessionId } });
    if (!session) return;
    await this.revokeFamily(session.tokenFamilyId, 'LOGOUT');
    await this.audit.record({
      moduleCode: 'AUTH',
      actionCode: 'LOGOUT',
      entityType: 'PlatformSession',
      entityId: sessionId,
      actorUserId,
    });
  }

  async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string },
    meta: { requestId?: string; ipAddress?: string },
  ): Promise<{ changed: true }> {
    const user = await this.prisma.platformUser.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pengguna tidak ditemukan.');

    const valid = await argon2.verify(user.passwordHash, input.currentPassword).catch(() => false);
    if (!valid) {
      throw AppError.unauthorized(ErrorCodes.INVALID_CREDENTIALS, 'Kata sandi saat ini tidak tepat.');
    }
    assertPasswordStrength(input.newPassword);
    if (input.newPassword === input.currentPassword) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Kata sandi baru harus berbeda dari kata sandi saat ini.',
      );
    }

    const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
    await this.prisma.platformUser.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false, updatedAt: new Date() },
    });

    // Ganti password mencabut seluruh refresh-token family lama.
    const sessions = await this.prisma.platformSession.findMany({
      where: { userId, revokedAt: null },
      select: { tokenFamilyId: true },
    });
    for (const session of sessions) {
      await this.revokeFamily(session.tokenFamilyId, 'PASSWORD_CHANGED');
    }

    await this.audit.record({
      moduleCode: 'AUTH',
      actionCode: 'PASSWORD_CHANGED',
      entityType: 'PlatformUser',
      entityId: userId,
      actorUserId: userId,
      actorUsername: user.username,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });

    return { changed: true };
  }

  /** Step-up authentication untuk aksi sensitif. */
  async createStepUp(
    userId: string,
    input: { password: string; purpose: string; reason?: string; targetType?: string; targetId?: string },
  ): Promise<{ stepUpToken: string; expiresAt: string }> {
    const user = await this.prisma.platformUser.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pengguna tidak ditemukan.');

    const valid = await argon2.verify(user.passwordHash, input.password).catch(() => false);
    if (!valid) {
      await this.audit.recordSecurity({
        eventCode: 'STEP_UP_FAILED',
        actorUserId: userId,
        actorUsername: user.username,
        detail: { purpose: input.purpose },
      });
      throw AppError.unauthorized(ErrorCodes.STEP_UP_INVALID, 'Verifikasi ulang gagal.');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await this.prisma.platformStepUpChallenge.create({
      data: {
        userId,
        purpose: input.purpose as never,
        challengeHash: hashToken(token),
        reason: input.reason ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        verifiedAt: new Date(),
        expiresAt,
      },
    });

    await this.audit.record({
      moduleCode: 'AUTH',
      actionCode: 'STEP_UP_VERIFIED',
      entityType: 'PlatformUser',
      entityId: userId,
      actorUserId: userId,
      actorUsername: user.username,
      reason: input.reason,
      metadata: { purpose: input.purpose, targetType: input.targetType, targetId: input.targetId },
    });

    return { stepUpToken: token, expiresAt: expiresAt.toISOString() };
  }

  async consumeStepUp(userId: string, purpose: string, token: string | undefined): Promise<void> {
    if (!token) {
      throw AppError.forbidden(
        ErrorCodes.STEP_UP_REQUIRED,
        'Aksi ini memerlukan verifikasi ulang kata sandi.',
        { purpose },
      );
    }
    const challenge = await this.prisma.platformStepUpChallenge.findFirst({
      where: {
        userId,
        purpose: purpose as never,
        challengeHash: hashToken(token),
        consumedAt: null,
        expiresAt: { gt: new Date() },
        verifiedAt: { not: null },
      },
    });
    if (!challenge) {
      throw AppError.forbidden(
        ErrorCodes.STEP_UP_INVALID,
        'Verifikasi ulang tidak valid atau sudah kedaluwarsa.',
        { purpose },
      );
    }
    await this.prisma.platformStepUpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
  }

  async buildAuthenticatedUser(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.demo) {
      const registry = payload.tid
        ? await this.prisma.tenantSchemaRegistry.findUnique({ where: { tenantId: payload.tid } })
        : null;
      const demoSession = await this.prisma.demoSession.findUnique({ where: { id: payload.sid } });
      if (!demoSession || demoSession.status !== 'ACTIVE' || demoSession.expiresAt < new Date()) {
        throw AppError.unauthorized(ErrorCodes.TOKEN_EXPIRED, 'Sesi demo telah berakhir.');
      }
      return {
        userId: payload.sub,
        username: 'demo',
        displayName: 'Pengguna Demo',
        isPlatformStaff: false,
        platformPermissions: [],
        mustChangePassword: false,
        sessionId: payload.sid,
        tokenFamilyId: payload.fam,
        tenantId: registry?.tenantId,
        schemaName: registry?.schemaName,
        auditSchemaName: registry?.auditSchemaName,
        isDemo: true,
        localeCode: payload.loc ?? 'id',
      };
    }

    const session = await this.prisma.platformSession.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          include: {
            roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw AppError.unauthorized(ErrorCodes.TOKEN_EXPIRED, 'Sesi tidak valid.');
    }
    if (session.user.status !== 'ACTIVE' || session.user.deletedAt) {
      throw AppError.unauthorized(ErrorCodes.ACCOUNT_INACTIVE, 'Akun tidak aktif.');
    }

    // Schema TIDAK dipercaya dari token; selalu dicocokkan ke registry.
    let schemaName: string | undefined;
    let auditSchemaName: string | undefined;
    if (session.tenantId) {
      const registry = await this.prisma.tenantSchemaRegistry.findUnique({
        where: { tenantId: session.tenantId },
      });
      if (registry && ['READY', 'MIGRATING'].includes(registry.status)) {
        schemaName = registry.schemaName;
        auditSchemaName = registry.auditSchemaName;
      }
    }

    return {
      userId: session.userId,
      username: session.user.username,
      displayName: session.user.displayName,
      isPlatformStaff: session.user.isPlatformStaff,
      platformPermissions: collectPermissions(session.user),
      mustChangePassword: session.user.mustChangePassword,
      sessionId: session.id,
      tokenFamilyId: session.tokenFamilyId,
      tenantId: session.tenantId ?? undefined,
      schemaName,
      auditSchemaName,
      isDemo: session.isDemo,
      localeCode: session.user.preferredLocaleCode ?? 'id',
    };
  }

  // -------------------------------------------------------------------------

  private async issueTokens(input: {
    userId: string;
    username: string;
    sessionId: string;
    tokenFamilyId: string;
    tenantId?: string;
    schemaName?: string;
    isDemo: boolean;
    isPlatformStaff: boolean;
    mustChangePassword: boolean;
    localeCode: string;
    parentTokenId?: string;
  }): Promise<Omit<LoginResult, 'user' | 'tenant' | 'mustChangePassword'>> {
    const payload: AccessTokenPayload = {
      sub: input.userId,
      username: input.username,
      sid: input.sessionId,
      fam: input.tokenFamilyId,
      tid: input.tenantId,
      sch: input.schemaName,
      demo: input.isDemo,
      staff: input.isPlatformStaff,
      mcp: input.mustChangePassword,
      loc: input.localeCode,
    };

    const accessTtl = this.config.get<string>('jwt.accessTtl', '15m');
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: accessTtl,
    });

    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.platformRefreshToken.create({
      data: {
        sessionId: input.sessionId,
        tokenHash: hashToken(refreshToken),
        parentTokenId: input.parentTokenId ?? null,
        expiresAt: new Date(Date.now() + this.refreshTtlMs()),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: parseTtlSeconds(accessTtl),
      tokenType: 'Bearer',
    };
  }

  private async revokeFamily(tokenFamilyId: string, reason: string): Promise<void> {
    const sessions = await this.prisma.platformSession.findMany({
      where: { tokenFamilyId },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    await this.prisma.platformRefreshToken.updateMany({
      where: { sessionId: { in: sessionIds }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.platformSession.updateMany({
      where: { tokenFamilyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  private async resolveMembership(
    userId: string,
    tenantCode?: string,
  ): Promise<{ tenantId: string; schemaName: string; tenantName: string } | null> {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { platformUserId: userId, deletedAt: null, status: 'ACTIVE' },
      include: { tenant: { include: { schemaRegistry: true } } },
      orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
    });

    const usable = memberships.filter(
      (m) =>
        m.tenant.status === 'ACTIVE' &&
        m.tenant.schemaRegistry &&
        m.tenant.schemaRegistry.status === 'READY',
    );
    if (!usable.length) return null;

    const selected = tenantCode
      ? usable.find((m) => m.tenant.code === tenantCode || m.tenant.slug === tenantCode)
      : usable[0];
    if (!selected) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Anda tidak memiliki akses ke tenant tersebut.');
    }
    return {
      tenantId: selected.tenantId,
      schemaName: selected.tenant.schemaRegistry!.schemaName,
      tenantName: selected.tenant.name,
    };
  }

  private refreshTtlMs(): number {
    return parseTtlSeconds(this.config.get<string>('jwt.refreshTtl', '30d')) * 1000;
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function parseTtlSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return 900;
  const value = Number(match[1]);
  switch (match[2]) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86_400;
    default:
      return 900;
  }
}

export function assertPasswordStrength(password: string): void {
  const problems: string[] = [];
  if (password.length < 10) problems.push('MIN_LENGTH_10');
  if (!/[a-z]/.test(password)) problems.push('LOWERCASE_REQUIRED');
  if (!/[A-Z]/.test(password)) problems.push('UPPERCASE_REQUIRED');
  if (!/\d/.test(password)) problems.push('DIGIT_REQUIRED');
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('SYMBOL_REQUIRED');
  if (problems.length) {
    throw AppError.badRequest(
      ErrorCodes.VALIDATION_FAILED,
      'Kata sandi belum memenuhi ketentuan keamanan.',
      { problems },
    );
  }
}

/** Membuat kata sandi sementara yang kuat dan mudah dibaca. */
export function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[randomBytes(1)[0] % set.length];
  const chars = [pick(upper), pick(upper), pick(lower), pick(lower), pick(digits), pick(digits), pick(symbols)];
  while (chars.length < 14) chars.push(pick(all));
  // Fisher–Yates dengan sumber acak kriptografis.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function collectPermissions(user: {
  roles: Array<{
    role: { permissions: Array<{ effect: string; permission: { code: string } }> };
    validFrom: Date;
    validUntil: Date | null;
  }>;
}): string[] {
  const now = new Date();
  const allow = new Set<string>();
  const deny = new Set<string>();
  for (const assignment of user.roles) {
    if (assignment.validFrom > now) continue;
    if (assignment.validUntil && assignment.validUntil < now) continue;
    for (const rolePermission of assignment.role.permissions) {
      if (rolePermission.effect === 'DENY') deny.add(rolePermission.permission.code);
      else allow.add(rolePermission.permission.code);
    }
  }
  for (const denied of deny) allow.delete(denied);
  return [...allow].sort();
}
