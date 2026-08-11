import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { StepUpPurpose } from '@prisma/client';
import { AppError, ErrorCodes } from '../../../common/errors/app-error';
import {
  AUTHORIZATION_MARKER_KEYS,
  AuthenticatedUser,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  PLATFORM_PERMISSIONS_KEY,
  REPORT_PERMISSION_KEY,
  RESOURCE_PERMISSION_KEY,
  STEP_UP_KEY,
} from '../../../common/decorators';
import { AuthService } from '../auth.service';
import { TenantPermissionService } from '../tenant-permission.service';
import { MASTER_RESOURCES } from '../../tenant/master-resource.registry';
import { izinUntukLaporan } from '../../tenant/izin-laporan';
import { bolehSaatWajibGantiKataSandi } from './password-change-allowlist';

/** Peta kode sumber daya master ke kode menunya, untuk `@ResourcePermission`. */
const RESOURCE_MENU_CODES = new Map(
  MASTER_RESOURCES.map((resource) => [resource.resourceCode, resource.menuCode]),
);

/**
 * Guard otorisasi: permission control plane, permission tenant, dan step-up.
 *
 * Handler yang tidak memiliki satu pun penanda otorisasi **ditolak**. Sebelum
 * perbaikan ini guard mengembalikan `true` pada kasus tersebut, sehingga 32
 * endpoint — termasuk seluruh CRUD master — dapat dipanggil tanpa pemeriksaan
 * hak sama sekali (temuan V6-0-F03).
 *
 * Menolak lebih baik daripada meloloskan karena kesalahannya menjadi terlihat:
 * endpoint yang lupa diberi penanda gagal saat pertama dipanggil, bukan diam-diam
 * terbuka untuk semua orang. Pemeriksaan saat aplikasi menyala
 * (`assertEveryRouteIsMarked`) membuatnya terlihat lebih awal lagi.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly tenantPermissions: TenantPermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const platformPermissions = this.reflector.getAllAndOverride<string[]>(
      PLATFORM_PERMISSIONS_KEY,
      targets,
    );
    const tenantPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, targets);
    const stepUpPurpose = this.reflector.getAllAndOverride<StepUpPurpose>(STEP_UP_KEY, targets);
    const resourceAction = this.reflector.getAllAndOverride<string>(
      RESOURCE_PERMISSION_KEY,
      targets,
    );
    const reportPermission = this.reflector.getAllAndOverride<boolean>(
      REPORT_PERMISSION_KEY,
      targets,
    );
    /*
     * Dihitung dari daftar penanda yang SAMA dengan `assertEveryRouteIsMarked`.
     *
     * Sebelumnya keduanya menyebut penandanya satu per satu, masing-masing di
     * berkasnya sendiri. `@ReportPermission` sempat ditambahkan ke sini saja,
     * dan akibatnya bukan endpoint yang lolos melainkan aplikasi yang tidak
     * dapat menyala sama sekali -- audit itu berjalan saat bootstrap.
     */
    const hasMarker = AUTHORIZATION_MARKER_KEYS.some((key) => {
      const value = this.reflector.getAllAndOverride<unknown>(key, targets);
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    });

    if (!hasMarker) {
      throw AppError.forbidden(
        ErrorCodes.PERMISSION_DENIED,
        'Endpoint ini tidak menyatakan hak akses yang dibutuhkannya sehingga ditolak.',
        { handler: `${context.getClass().name}.${context.getHandler().name}` },
      );
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw AppError.unauthorized(ErrorCodes.UNAUTHORIZED, 'Autentikasi diperlukan.');
    }

    /*
     * Wajib ganti kata sandi sebelum mengakses endpoint terlindungi lainnya.
     *
     * Daftar pengecualiannya dipakai bersama `JwtAuthGuard`, bukan disalin.
     * Sebelumnya penjaga ini menolak TANPA pengecualian apa pun, sehingga
     * `/auth/change-password` — satu-satunya jalan keluar dari keadaan ini —
     * ikut terblokir. Setiap penyewa yang baru mendaftar terjebak di layar ganti
     * kata sandi dan menerima 403 yang tidak berarti apa pun baginya.
     */
    if (user.mustChangePassword && !bolehSaatWajibGantiKataSandi(request.path)) {
      throw AppError.forbidden(
        ErrorCodes.PASSWORD_CHANGE_REQUIRED,
        'Anda wajib mengganti kata sandi sebelum melanjutkan.',
      );
    }

    if (platformPermissions?.length) {
      const granted = new Set(user.platformPermissions);
      const missing = platformPermissions.filter((permission) => !granted.has(permission));
      if (missing.length) {
        throw AppError.forbidden(ErrorCodes.PERMISSION_DENIED, 'Hak akses tidak mencukupi.', {
          missing,
        });
      }
    }

    // Permission tenant statis dan permission yang diturunkan dari `:resource`
    // diperiksa lewat jalur yang sama, agar tidak ada dua aturan berbeda.
    const requiredTenantPermissions = [...(tenantPermissions ?? [])];

    if (resourceAction) {
      const resourceCode = (request.params as Record<string, string> | undefined)?.resource;
      const menuCode = resourceCode ? RESOURCE_MENU_CODES.get(resourceCode) : undefined;
      if (!menuCode) {
        // Sumber daya tak dikenal ditolak, bukan diloloskan. Meloloskannya berarti
        // parameter route yang salah ketik menghapus pemeriksaan hak.
        throw AppError.forbidden(
          ErrorCodes.PERMISSION_DENIED,
          'Sumber daya master tidak dikenal.',
          { resource: resourceCode ?? null },
        );
      }
      requiredTenantPermissions.push(`${menuCode}.${resourceAction}`);
    }

    if (reportPermission) {
      const code = (request.params as Record<string, string> | undefined)?.code;
      const izin = izinUntukLaporan(code);
      if (!izin) {
        /*
         * Laporan tak dikenal ditolak, bukan diloloskan -- alasan yang sama
         * dengan sumber daya master di atas.
         *
         * Bila laporan baru diloloskan dengan hak bawaan, ia terbuka bagi semua
         * orang tanpa seorang pun menyadarinya. Itu persis cara seluruh laporan,
         * termasuk laba rugi, sempat dijaga `SALES.READ` saja.
         */
        throw AppError.forbidden(ErrorCodes.PERMISSION_DENIED, 'Kode laporan tidak dikenal.', {
          report: code ?? null,
        });
      }
      requiredTenantPermissions.push(izin);
    }

    if (requiredTenantPermissions.length) {
      if (!user.schemaName) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Sesi ini tidak terhubung ke tenant mana pun.',
        );
      }
      const missing = await this.tenantPermissions.findMissing(
        user.schemaName,
        user.userId,
        requiredTenantPermissions,
        // Peran aktif ikut menentukan. Tanpa baris ini, penyempitan yang dipilih
        // pengguna hanya mengubah tampilan menu sementara penjaganya tetap
        // memakai gabungan seluruh peran — pembatasan yang tidak membatasi apa
        // pun.
        { isDemo: user.isDemo, activeRoleId: user.activeRoleId },
      );
      if (missing.length) {
        throw AppError.forbidden(ErrorCodes.PERMISSION_DENIED, 'Hak akses tidak mencukupi.', {
          missing,
          // Disebutkan supaya penolakan dapat dipahami. Ditolak karena peran
          // yang sedang dipakai memang berbeda dari ditolak karena tidak berhak
          // sama sekali, dan penyelesaiannya juga berbeda.
          ...(user.activeRoleCode ? { activeRole: user.activeRoleCode } : {}),
        });
      }
    }

    if (stepUpPurpose) {
      const token = request.headers['x-step-up-token'];
      await this.authService.consumeStepUp(
        user.userId,
        stepUpPurpose,
        Array.isArray(token) ? token[0] : token,
      );
    }

    return true;
  }
}
