/**
 * Pusat Observability.
 *
 * Seluruh endpoint di sini menuntut `PLATFORM.OBSERVABILITY.*`, yang **hanya**
 * dimiliki Super Admin. Administrator tenant tidak memilikinya meski datanya
 * berasal dari tenantnya — observability memuat jejak seluruh tenant, dan siapa
 * pun yang dapat membacanya dapat melihat data tenant mana pun tanpa melewati
 * support session yang tercatat.
 *
 * Tidak ada endpoint tenant di sini, dan tidak akan pernah ada. Bila tenant
 * memerlukan datanya, Super Admin mengekspor paket tersanitasi lewat alur
 * dukungan.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import {
  AuthenticatedUser,
  CurrentUser,
  PlatformPermissions,
  RequestContext,
  RequestMeta,
} from '../../common/decorators';
import { ErrorCaptureService } from '../../infrastructure/observability/error-capture.service';
import {
  ErrorQueryService,
  MAX_PAGE_SIZE,
  type AccessActor,
  type ErrorView,
} from './error-query.service';

const VIEWS: ErrorView[] = ['UNIQUE', 'NEW', 'REGRESSED', 'UNHANDLED', 'RESOLVED', 'IGNORED'];

const STATUSES = [
  'NEW', 'TRIAGED', 'INVESTIGATING', 'REPRODUCED', 'FIX_PLANNED', 'FIX_IN_PROGRESS',
  'PR_OPENED', 'READY_FOR_RELEASE', 'RESOLVED', 'REGRESSED', 'IGNORED', 'DUPLICATE',
  'NOT_ACTIONABLE',
];

class SetStatusDto {
  @ApiProperty({ enum: STATUSES })
  @IsIn(STATUSES)
  status!: string;

  @ApiPropertyOptional({ description: 'Wajib bila status IGNORED.' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason?: string;
}

class ExportDto {
  @ApiProperty({ description: 'Alasan ekspor. Wajib — ekspor mengeluarkan data dari sistem.' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

function readNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

@ApiTags('observability')
@ApiBearerAuth('access-token')
@Controller('platform/observability/errors')
export class ObservabilityErrorController {
  constructor(
    private readonly errors: ErrorQueryService,
    private readonly capture: ErrorCaptureService,
  ) {}

  @Get('groups')
  @PlatformPermissions('PLATFORM.OBSERVABILITY.READ')
  @ApiOperation({
    summary: 'Kelompok galat unik',
    description:
      'Tampilan bawaan menyembunyikan yang sudah selesai dan yang sengaja diabaikan — ' +
      'keduanya bukan pekerjaan yang menunggu. Setiap pembacaan tercatat.',
  })
  @ApiQuery({ name: 'tampilan', required: false, enum: VIEWS })
  @ApiQuery({ name: 'modul', required: false })
  @ApiQuery({ name: 'tingkat', required: false })
  @ApiQuery({ name: 'cari', required: false })
  @ApiQuery({ name: 'hari', required: false, type: Number })
  @ApiQuery({ name: 'halaman', required: false, type: Number })
  @ApiQuery({ name: 'jumlah', required: false, type: Number, description: `Maksimum ${MAX_PAGE_SIZE}.` })
  listGroups(
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
    @Query('tampilan') view?: string,
    @Query('modul') moduleCode?: string,
    @Query('tingkat') severity?: string,
    @Query('cari') search?: string,
    @Query('hari') sinceDays?: string,
    @Query('halaman') page?: string,
    @Query('jumlah') limit?: string,
  ) {
    return this.errors.listGroups(
      {
        view: VIEWS.includes(view as ErrorView) ? (view as ErrorView) : undefined,
        moduleCode,
        severity,
        search,
        sinceDays: readNumber(sinceDays),
        page: readNumber(page),
        limit: readNumber(limit),
      },
      actorOf(user, meta),
    );
  }

  @Get('groups/:id')
  @PlatformPermissions('PLATFORM.OBSERVABILITY.READ')
  @ApiOperation({ summary: 'Detail kelompok beserta sepuluh kejadian terakhir' })
  getGroup(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.errors.getGroup(id, actorOf(user, meta));
  }

  @Get('groups/:id/occurrences')
  @PlatformPermissions('PLATFORM.OBSERVABILITY.READ')
  @ApiOperation({
    summary: 'Seluruh kejadian pada satu kelompok',
    description: 'Kejadian tetap tersimpan utuh; pengelompokan hanya menentukan tampilan bawaan.',
  })
  @ApiQuery({ name: 'tenant', required: false })
  listOccurrences(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
    @Query('tenant') tenantId?: string,
    @Query('halaman') page?: string,
    @Query('jumlah') limit?: string,
  ) {
    return this.errors.listOccurrences(
      id,
      { page: readNumber(page), limit: readNumber(limit), tenantId },
      actorOf(user, meta),
    );
  }

  @Post('groups/:id/status')
  @PlatformPermissions('PLATFORM.OBSERVABILITY.MANAGE')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mengubah status kelompok',
    description:
      'Alasan wajib untuk IGNORED. Galat yang diabaikan tanpa alasan akan diabaikan lagi ' +
      'oleh orang berikutnya tanpa tahu mengapa.',
  })
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.errors.setStatus(id, dto.status, actorOf(user, meta), dto.reason);
  }

  @Post('groups/:id/context')
  @PlatformPermissions('PLATFORM.OBSERVABILITY.EXPORT')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menyusun paket konteks tersanitasi',
    description:
      'Alasan wajib. Seluruh isinya sudah tersanitasi sejak disimpan; tidak ada penyamaran ' +
      'tambahan di sini karena penyamaran yang dilakukan dua kali di dua tempat akan berbeda.',
  })
  async buildContext(
    @Param('id') id: string,
    @Body() dto: ExportDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    const markdown = await this.errors.buildContext(id, {
      ...actorOf(user, meta),
      reason: dto.reason,
    });
    return { format: 'markdown', content: markdown };
  }

  @Post('refresh-impact')
  @PlatformPermissions('PLATFORM.OBSERVABILITY.MANAGE')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menghitung ulang jumlah tenant dan pengguna terdampak',
    description:
      'Dihitung berkala, bukan pada setiap kejadian — menghitung DISTINCT pada setiap galat ' +
      'akan membuat penangkapan lebih mahal daripada permintaan yang menyebabkannya.',
  })
  async refreshImpact() {
    const updated = await this.capture.refreshImpactCounts();
    return { updated };
  }
}

const actorOf = (user: AuthenticatedUser, meta: RequestMeta): AccessActor => ({
  userId: user.userId,
  username: user.username,
  requestId: meta.requestId,
  ipAddress: meta.ipAddress,
});

@Module({
  imports: [InfrastructureModule],
  controllers: [ObservabilityErrorController],
  providers: [ErrorQueryService],
  exports: [ErrorQueryService],
})
export class ObservabilityModule {}
