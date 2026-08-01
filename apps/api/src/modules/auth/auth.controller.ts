import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StepUpPurpose } from '@prisma/client';
import { AuthService } from './auth.service';
import { TenantPermissionService } from './tenant-permission.service';
import { SessionService } from './session.service';
import {
  AuthenticatedOnly,
  AuthenticatedUser,
  CurrentUser,
  PlatformPermissions,
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
  @AuthenticatedOnly()
  @HttpCode(200)
  @ApiOperation({ summary: 'Keluar dan mencabut seluruh refresh token pada sesi ini' })
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.logout(user.sessionId, user.userId);
    return { loggedOut: true };
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  @AuthenticatedOnly()
  @ApiOperation({ summary: 'Profil, konteks tenant, dan hak akses pengguna saat ini' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    // Peran aktif ikut diperhitungkan. Melaporkan izin penuh sementara
    // penjaganya memakai izin yang sudah dipersempit akan membuat antarmuka
    // menampilkan tombol yang pasti ditolak saat ditekan.
    const tenantPermissions = user.schemaName
      ? [...(await this.tenantPermissions.resolve(user.schemaName, user.userId, user.activeRoleId))]
      : [];
    // Vertikal ikut pada setiap pemulihan sesi, bukan hanya saat masuk. Tanpa
    // ini, pengurus pondok yang memuat ulang halamannya terlempar ke beranda
    // bawaan — sesi yang sama, tujuan yang berbeda.
    const verticalCode = await this.authService.verticalPenyewa(user.tenantId);
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
        ? { tenantId: user.tenantId, schemaName: user.schemaName, verticalCode }
        : null,
      activeRoleId: user.activeRoleId ?? null,
      activeRoleCode: user.activeRoleCode ?? null,
      tenantPermissions,
    };
  }

  @ApiBearerAuth('access-token')
  @Post('change-password')
  @AuthenticatedOnly()
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
  @AuthenticatedOnly()
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
  @AuthenticatedOnly()
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
      activeRoleId: user.activeRoleId ?? null,
      activeRoleCode: user.activeRoleCode ?? null,
    };
  }

  @ApiBearerAuth('access-token')
  @Get('menus')
  @AuthenticatedOnly()
  @ApiOperation({ summary: 'Menu tree sesuai hak akses. Menu tanpa READ tidak tampil.' })
  async menus(@CurrentUser() user: AuthenticatedUser) {
    if (!user.schemaName) return [];
    return this.tenantPermissions.menuTree(
      user.schemaName,
      user.userId,
      user.localeCode,
      user.activeRoleId,
    );
  }

  @ApiBearerAuth('access-token')
  @Get('permissions')
  @AuthenticatedOnly()
  @ApiOperation({ summary: 'Daftar permission efektif pada tenant aktif' })
  async permissions(@CurrentUser() user: AuthenticatedUser) {
    if (!user.schemaName) return { tenantPermissions: [], platformPermissions: user.platformPermissions };
    return {
      tenantPermissions: [
        ...(await this.tenantPermissions.resolve(user.schemaName, user.userId, user.activeRoleId)),
      ],
      platformPermissions: user.platformPermissions,
      activeRoleCode: user.activeRoleCode ?? null,
    };
  }
}

class SetActiveRoleDto {
  @ApiPropertyOptional({
    description:
      'Id peran yang dipilih, atau null untuk kembali ke gabungan seluruh peran. ' +
      'Peran wajib benar-benar dipegang pengguna.',
    nullable: true,
  })
  // `null` adalah nilai yang sah dan artinya berbeda dari tidak dikirim:
  // ia berarti "kembalikan saya ke gabungan seluruh peran".
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  roleId!: string | null;

  @ApiPropertyOptional({ description: 'Alasan berganti peran; tersimpan pada riwayat.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class RevokeSessionDto {
  @ApiPropertyOptional({ description: 'Alasan pencabutan.' })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  reason?: string;
}

/**
 * Sesi dan peran aktif milik pengguna sendiri.
 *
 * Seluruh endpoint di sini bekerja pada sesi **milik pemanggilnya**. Tidak ada
 * parameter untuk menyebut pengguna lain, dan itu disengaja: melihat atau
 * mengakhiri sesi orang lain adalah kemampuan pengawasan yang menuntut izin
 * tersendiri, bukan kelanjutan wajar dari mengelola akun sendiri.
 */
@ApiTags('auth')
@ApiBearerAuth('access-token')
@Controller('me')
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Get('sessions')
  @AuthenticatedOnly()
  @ApiOperation({
    summary: 'Sesi milik sendiri',
    description:
      'Beserta perangkat, alamat IP, dan waktu terakhir dipakai. Sesi yang sedang berjalan ' +
      'ditandai `isCurrent` supaya tidak tercabut tanpa sengaja.',
  })
  mySessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.mySessions(user);
  }

  @Post('sessions/:id/revoke')
  @AuthenticatedOnly()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mencabut satu sesi milik sendiri',
    description: 'Sesi milik orang lain dijawab sama seperti sesi yang tidak ada.',
  })
  revokeSession(
    @Param('id') id: string,
    @Body() dto: RevokeSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.revokeSession(user, id, dto.reason);
  }

  @Post('sessions/revoke-others')
  @AuthenticatedOnly()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mencabut seluruh sesi lain',
    description:
      'Sesi yang sedang dipakai sengaja disisakan — mencabutnya akan mengeluarkan orang ' +
      'tepat saat ia sedang mengamankan akunnya.',
  })
  revokeOthers(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.revokeOtherSessions(user);
  }

  @Get('roles')
  @AuthenticatedOnly()
  @ApiOperation({
    summary: 'Peran yang dipegang dan peran yang sedang dipakai',
    description:
      '`canNarrow` bernilai true hanya bila pengguna memegang lebih dari satu peran; ' +
      'bagi yang memegang satu, memilih peran tidak mengubah apa pun.',
  })
  myRoles(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.myRoles(user);
  }

  @Post('active-role')
  @AuthenticatedOnly()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Memilih peran aktif',
    description:
      'Memilih peran hanya MENGURANGI izin, tidak pernah menambah: larangan dari peran lain ' +
      'tetap berlaku. Kirim `roleId: null` untuk kembali ke gabungan seluruh peran. ' +
      'Izin yang hilang akibat pilihan ini disebutkan pada jawaban.',
  })
  setActiveRole(
    @Body() dto: SetActiveRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.sessions.setActiveRole(user, dto.roleId, {
      reason: dto.reason,
      ipAddress: meta.ipAddress,
      requestId: meta.requestId,
    });
  }
}

/**
 * Riwayat pergantian peran — untuk auditor, bukan untuk pemilik sesinya.
 *
 * Dipisahkan dari controller di atas karena sifatnya berbeda: yang ini membaca
 * jejak orang lain, dan karena itu menuntut izin tersendiri.
 */
@ApiTags('auth')
@ApiBearerAuth('access-token')
@Controller('platform/security')
export class SecurityAuditController {
  constructor(private readonly sessions: SessionService) {}

  @Get('role-switches')
  @PlatformPermissions('PLATFORM.OBSERVABILITY.READ')
  @ApiOperation({
    summary: 'Riwayat pergantian peran aktif',
    description:
      'Menjawab pertanyaan yang tidak dapat dijawab tabel sesi: dalam kapasitas apa ' +
      'seseorang bertindak pada suatu saat.',
  })
  @ApiQuery({ name: 'tenant', required: false })
  @ApiQuery({ name: 'jumlah', required: false, type: Number })
  roleSwitches(@Query('tenant') tenantId?: string, @Query('jumlah') limit?: string) {
    return this.sessions.roleSwitchHistory(tenantId, Number(limit) || 50);
  }
}

/** Tipe request Express yang membawa konteks terautentikasi. */
export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
