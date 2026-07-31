import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AppError, ErrorCodes } from '../../../common/errors/app-error';
import { IS_PUBLIC_KEY, DEMO_BLOCKED_KEY } from '../../../common/decorators';
import { AccessTokenPayload, AuthService } from '../auth.service';
import { currentScope } from '../../../common/context/request-context';

/**
 * Guard autentikasi global. Endpoint publik ditandai eksplisit dengan @Public().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & { user?: unknown; tenant?: unknown }>();
    const token = extractToken(request);

    if (isPublic) {
      // Endpoint publik tetap memuat konteks bila token tersedia (mis. banner locale).
      if (token) {
        try {
          await this.attachUser(request, token);
        } catch {
          // Token invalid pada endpoint publik diabaikan.
        }
      }
      return true;
    }

    if (!token) {
      throw AppError.unauthorized(ErrorCodes.UNAUTHORIZED, 'Token akses tidak ditemukan.');
    }

    await this.attachUser(request, token);

    const demoBlocked = this.reflector.getAllAndOverride<boolean>(DEMO_BLOCKED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const user = (request as { user?: { isDemo: boolean; mustChangePassword: boolean } }).user;
    if (demoBlocked && user?.isDemo) {
      throw AppError.forbidden(
        ErrorCodes.DEMO_ACTION_DISABLED,
        'Aksi ini dinonaktifkan pada sandbox demo.',
      );
    }

    // Forced password change: seluruh endpoint terlindungi diblokir sampai
    // kata sandi diganti, kecuali endpoint yang memang dibutuhkan untuk itu.
    if (user?.mustChangePassword && !isPasswordChangeAllowed(request.path)) {
      throw AppError.forbidden(
        ErrorCodes.PASSWORD_CHANGE_REQUIRED,
        'Anda wajib mengganti kata sandi sebelum melanjutkan.',
      );
    }

    return true;
  }

  private async attachUser(request: Request, token: string): Promise<void> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw AppError.unauthorized(ErrorCodes.TOKEN_EXPIRED, 'Token akses tidak valid atau kedaluwarsa.');
    }

    const user = await this.authService.buildAuthenticatedUser(payload);
    (request as unknown as { user: unknown }).user = user;

    // Konteks permintaan dilengkapi begitu tokennya terverifikasi, supaya
    // pencatatan tidak perlu menerima pelakunya sebagai argumen di setiap
    // tempat. Inilah yang membuat `actor_role_codes` terisi sendiri alih-alih
    // bergantung pada ingatan penulis tujuh puluh enam pemanggilan audit.
    //
    // Ditulis ke objek konteks yang sudah dibuka middleware, bukan membuka
    // konteks baru: konteks baru di sini tidak akan terlihat oleh kode yang
    // berjalan setelah guard selesai.
    const scope = currentScope();
    if (scope) {
      scope.actorUserId = user.userId;
      scope.actorUsername = user.username;
      scope.activeRoleCode = user.activeRoleCode;
      scope.sessionId = user.sessionId;
      scope.tenantId = user.tenantId;
      scope.tenantSchema = user.schemaName;
      scope.ipAddress = request.ip;
      scope.userAgent = request.header('user-agent');
      // `actorRoleCodes` sengaja TIDAK diisi di sini. Daftar seluruh peran
      // tenant menuntut satu kueri tambahan ke skema tenant, dan membebankan
      // kueri itu pada SETIAP permintaan demi sebuah kolom catatan bukan
      // pertukaran yang sepadan. Pemanggil yang sudah memegang daftarnya tetap
      // dapat menyebutkannya sendiri, dan `activeRoleCode` di atas sudah
      // menjawab pertanyaan yang paling sering diajukan — dalam kapasitas apa.
    }

    if (user.tenantId && user.schemaName && user.auditSchemaName) {
      (request as unknown as { tenant: unknown }).tenant = {
        tenantId: user.tenantId,
        schemaName: user.schemaName,
        auditSchemaName: user.auditSchemaName,
        isDemo: user.isDemo,
      };
    }
  }
}

/** Endpoint yang tetap boleh diakses saat pengguna wajib mengganti kata sandi. */
const PASSWORD_CHANGE_ALLOWLIST = [
  '/auth/change-password',
  '/auth/logout',
  '/auth/me',
  '/me/context',
];

function isPasswordChangeAllowed(path: string): boolean {
  return PASSWORD_CHANGE_ALLOWLIST.some((allowed) => path.endsWith(allowed));
}

function extractToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const cookie = (request as unknown as { cookies?: Record<string, string> }).cookies?.access_token;
  return cookie;
}
