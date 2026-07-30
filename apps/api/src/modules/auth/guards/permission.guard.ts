import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { StepUpPurpose } from '@prisma/client';
import { AppError, ErrorCodes } from '../../../common/errors/app-error';
import {
  AuthenticatedUser,
  PERMISSIONS_KEY,
  PLATFORM_PERMISSIONS_KEY,
  STEP_UP_KEY,
} from '../../../common/decorators';
import { AuthService } from '../auth.service';
import { TenantPermissionService } from '../tenant-permission.service';

/**
 * Guard otorisasi: permission control plane, permission tenant, dan step-up.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly tenantPermissions: TenantPermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const platformPermissions = this.reflector.getAllAndOverride<string[]>(
      PLATFORM_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const tenantPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const stepUpPurpose = this.reflector.getAllAndOverride<StepUpPurpose>(STEP_UP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!platformPermissions?.length && !tenantPermissions?.length && !stepUpPurpose) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw AppError.unauthorized(ErrorCodes.UNAUTHORIZED, 'Autentikasi diperlukan.');
    }

    // Wajib ganti kata sandi sebelum mengakses endpoint terlindungi lainnya.
    if (user.mustChangePassword) {
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

    if (tenantPermissions?.length) {
      if (!user.schemaName) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Sesi ini tidak terhubung ke tenant mana pun.',
        );
      }
      const missing = await this.tenantPermissions.findMissing(
        user.schemaName,
        user.userId,
        tenantPermissions,
        { isDemo: user.isDemo },
      );
      if (missing.length) {
        throw AppError.forbidden(ErrorCodes.PERMISSION_DENIED, 'Hak akses tidak mencukupi.', {
          missing,
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
