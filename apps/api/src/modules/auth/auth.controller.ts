import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StepUpPurpose } from '@prisma/client';
import { AuthService } from './auth.service';
import { TenantPermissionService } from './tenant-permission.service';
import {
  AuthenticatedUser,
  CurrentUser,
  Public,
  RequestContext,
  RequestMeta,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  username!: string;

  // Contoh Swagger tidak pernah memuat kredensial nyata.
  @ApiProperty({ example: 'ContohKataSandi#2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;

  @ApiPropertyOptional({ description: 'Kode atau slug tenant bila pengguna anggota beberapa tenant.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantCode?: string;
}

class RefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  refreshToken!: string;
}

class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  currentPassword!: string;

  @ApiProperty({ description: 'Minimal 10 karakter dengan huruf besar, kecil, angka, dan simbol.' })
  @IsString()
  @MinLength(10)
  @MaxLength(256)
  newPassword!: string;
}

class StepUpDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;

  @ApiProperty({ enum: StepUpPurpose })
  @IsEnum(StepUpPurpose)
  purpose!: StepUpPurpose;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetId?: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantPermissions: TenantPermissionService,
  ) {}

  @Public()
  @Throttle({ auth: { ttl: 60_000, limit: 10 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Masuk menggunakan nama pengguna atau surel' })
  login(@Body() dto: LoginDto, @RequestContext() meta: RequestMeta) {
    return this.authService.login(dto, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
  }

  @Public()
  @Throttle({ auth: { ttl: 60_000, limit: 30 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Memperbarui access token dengan rotasi refresh token' })
  refresh(@Body() dto: RefreshDto, @RequestContext() meta: RequestMeta) {
    return this.authService.refresh(dto.refreshToken, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
  }

  @ApiBearerAuth('access-token')
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Keluar dan mencabut seluruh refresh token pada sesi ini' })
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.logout(user.sessionId, user.userId);
    return { loggedOut: true };
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  @ApiOperation({ summary: 'Profil, konteks tenant, dan hak akses pengguna saat ini' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    const tenantPermissions = user.schemaName
      ? [...(await this.tenantPermissions.resolve(user.schemaName, user.userId))]
      : [];
    return {
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      isPlatformStaff: user.isPlatformStaff,
      isDemo: user.isDemo,
      mustChangePassword: user.mustChangePassword,
      localeCode: user.localeCode,
      platformPermissions: user.platformPermissions,
      tenant: user.tenantId
        ? { tenantId: user.tenantId, schemaName: user.schemaName }
        : null,
      tenantPermissions,
    };
  }

  @ApiBearerAuth('access-token')
  @Post('change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengganti kata sandi dan mencabut sesi lama' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @RequestContext() meta: RequestMeta,
  ) {
    if (user.isDemo) {
      throw AppError.forbidden(
        ErrorCodes.DEMO_ACTION_DISABLED,
        'Sesi demo tidak dapat mengganti kata sandi.',
      );
    }
    return this.authService.changePassword(user.userId, dto, {
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });
  }

  @ApiBearerAuth('access-token')
  @Post('step-up')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verifikasi ulang kata sandi untuk aksi sensitif',
    description:
      'Mengembalikan `stepUpToken` yang dikirim melalui header `X-Step-Up-Token` pada permintaan berikutnya.',
  })
  stepUp(@CurrentUser() user: AuthenticatedUser, @Body() dto: StepUpDto) {
    if (user.isDemo) {
      throw AppError.forbidden(
        ErrorCodes.DEMO_ACTION_DISABLED,
        'Sesi demo tidak dapat melakukan verifikasi ulang.',
      );
    }
    return this.authService.createStepUp(user.userId, dto);
  }
}

@ApiTags('auth')
@Controller('me')
export class MeController {
  constructor(private readonly tenantPermissions: TenantPermissionService) {}

  @ApiBearerAuth('access-token')
  @Get('context')
  @ApiOperation({ summary: 'Konteks aktif pengguna' })
  context(@CurrentUser() user: AuthenticatedUser) {
    return {
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      localeCode: user.localeCode,
      isDemo: user.isDemo,
      isPlatformStaff: user.isPlatformStaff,
      tenant: user.tenantId ? { tenantId: user.tenantId, schemaName: user.schemaName } : null,
    };
  }

  @ApiBearerAuth('access-token')
  @Get('menus')
  @ApiOperation({ summary: 'Menu tree sesuai hak akses. Menu tanpa READ tidak tampil.' })
  async menus(@CurrentUser() user: AuthenticatedUser) {
    if (!user.schemaName) return [];
    return this.tenantPermissions.menuTree(user.schemaName, user.userId, user.localeCode);
  }

  @ApiBearerAuth('access-token')
  @Get('permissions')
  @ApiOperation({ summary: 'Daftar permission efektif pada tenant aktif' })
  async permissions(@CurrentUser() user: AuthenticatedUser) {
    if (!user.schemaName) return { tenantPermissions: [], platformPermissions: user.platformPermissions };
    return {
      tenantPermissions: [...(await this.tenantPermissions.resolve(user.schemaName, user.userId))],
      platformPermissions: user.platformPermissions,
    };
  }
}

/** Tipe request Express yang membawa konteks terautentikasi. */
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
