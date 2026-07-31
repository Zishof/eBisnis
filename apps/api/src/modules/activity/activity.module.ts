/**
 * Jejak pemakaian dan jejak perubahan.
 *
 * Dua hal yang sengaja tidak dicampur:
 *
 * * **Jejak pemakaian** (`ui_activity_log`) — dilaporkan peramban, tidak dapat
 *   diverifikasi, berguna untuk analitik.
 * * **Jejak perubahan** (`audit_row_change`) — ditulis trigger basis data,
 *   tidak dapat dilewati oleh kode aplikasi, berguna sebagai bukti.
 *
 * Keduanya dibaca lewat modul yang sama tetapi tidak pernah bercampur pada
 * jawaban yang sama, supaya tidak ada yang keliru menganggap laporan peramban
 * sebagai bukti.
 */

import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import {
  AuthenticatedOnly,
  AuthenticatedUser,
  CurrentUser,
  Permissions,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  ACTIVITY_TYPES,
  MAX_BATCH,
  OUTCOMES,
  UiActivityService,
  type ActivityType,
} from './ui-activity.service';
import { TableAuditService } from './table-audit.service';

class UiActivityEventDto {
  @ApiProperty({ enum: ACTIVITY_TYPES })
  @IsIn(ACTIVITY_TYPES as unknown as string[])
  activityType!: ActivityType;

  @ApiPropertyOptional({ description: 'Kode menu; wajib benar-benar ada.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  menuCode?: string;

  @ApiPropertyOptional({ description: 'Jalur antarmuka. Kueri string dibuang server.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  routePath?: string;

  @ApiPropertyOptional({ description: 'Kode kendali; wajib untuk UI_ACTION.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actionCode?: string;

  @ApiPropertyOptional({ enum: OUTCOMES })
  @IsOptional()
  @IsIn(OUTCOMES as unknown as string[])
  outcome?: (typeof OUTCOMES)[number];

  @ApiPropertyOptional({ description: 'Lama pada halaman, milidetik. Dibatasi dua jam.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;

  @ApiPropertyOptional({ description: 'Waktu menurut peramban; diabaikan bila di luar jangkauan wajar.' })
  @IsOptional()
  @IsISO8601()
  clientTime?: string;
}

class UiActivityBatchDto {
  @ApiProperty({ type: [UiActivityEventDto], description: `Paling banyak ${MAX_BATCH}.` })
  @IsArray()
  @ArrayMaxSize(MAX_BATCH)
  @ValidateNested({ each: true })
  @Type(() => UiActivityEventDto)
  events!: UiActivityEventDto[];
}

const bacaHari = (raw: string | undefined, bawaan: number) => {
  const nilai = Number(raw);
  return Number.isFinite(nilai) && nilai > 0 ? Math.min(nilai, 365) : bawaan;
};

@ApiTags('activity')
@ApiBearerAuth('access-token')
@Controller('activity')
export class UiActivityController {
  constructor(private readonly activity: UiActivityService) {}

  @Post('ui')
  @AuthenticatedOnly()
  @ApiOperation({
    summary: 'Melaporkan pemakaian antarmuka',
    description:
      'Isinya DILAPORKAN PERAMBAN dan tidak dapat diverifikasi server. Dipakai untuk ' +
      'analitik pemakaian, bukan sebagai bukti perbuatan — untuk itu ada audit_event. ' +
      'Identitas pelapor selalu diambil dari sesi, tidak pernah dari badan permintaan.',
  })
  record(@Body() dto: UiActivityBatchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.activity.record(user, dto.events);
  }

  @Get('menu-usage')
  @Permissions('ADMIN_AUDIT.READ')
  @ApiOperation({
    summary: 'Pemakaian menu',
    description:
      'Termasuk daftar menu yang tidak pernah dibuka — biasanya itulah yang paling ' +
      'berguna, karena menandai fitur yang tidak terpakai.',
  })
  @ApiQuery({ name: 'hari', required: false, type: Number })
  menuUsage(@CurrentUser() user: AuthenticatedUser, @Query('hari') days?: string) {
    return this.activity.menuUsage(schemaOf(user), bacaHari(days, 30));
  }

  @Get('abandoned-actions')
  @Permissions('ADMIN_AUDIT.READ')
  @ApiOperation({
    summary: 'Tindakan yang sering dibatalkan',
    description: 'Rasio pembatalan tinggi menandai kendali yang membingungkan.',
  })
  @ApiQuery({ name: 'hari', required: false, type: Number })
  abandoned(@CurrentUser() user: AuthenticatedUser, @Query('hari') days?: string) {
    return this.activity.abandonedActions(schemaOf(user), bacaHari(days, 30));
  }
}

@ApiTags('activity')
@ApiBearerAuth('access-token')
@Controller('table-audit')
export class TableAuditController {
  constructor(private readonly tableAudit: TableAuditService) {}

  @Get('tables')
  @Permissions('ADMIN_AUDIT.READ')
  @ApiOperation({
    summary: 'Ringkasan perubahan per tabel',
    description:
      'Berasal dari trigger basis data, bukan dari kode aplikasi — sehingga tidak dapat ' +
      'dilewati oleh endpoint yang lupa mencatat.',
  })
  @ApiQuery({ name: 'hari', required: false, type: Number })
  tables(@CurrentUser() user: AuthenticatedUser, @Query('hari') days?: string) {
    return this.tableAudit.tableSummary(schemaOf(user), bacaHari(days, 30));
  }

  @Get('actors')
  @Permissions('ADMIN_AUDIT.READ')
  @ApiOperation({
    summary: 'Ringkasan perubahan per pelaku',
    description: 'Penghapusan ditampilkan tersendiri, tidak dilebur ke dalam total.',
  })
  @ApiQuery({ name: 'hari', required: false, type: Number })
  actors(@CurrentUser() user: AuthenticatedUser, @Query('hari') days?: string) {
    return this.tableAudit.actorSummary(schemaOf(user), bacaHari(days, 30));
  }

  @Get('rows/:table/:id')
  @Permissions('ADMIN_AUDIT.READ')
  @ApiOperation({
    summary: 'Seluruh riwayat satu baris',
    description:
      'Menjawab "nilai dokumen ini salah, siapa yang mengubahnya". Yang dikembalikan ' +
      'perbedaan per kolom, bukan dua keadaan utuh yang harus dibandingkan sendiri.',
  })
  rowHistory(
    @Param('table') table: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tableAudit.rowHistory(schemaOf(user), table, id);
  }
}

/** Skema tenant dari sesi — tidak pernah dari permintaan. */
function schemaOf(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.badRequest(
      ErrorCodes.VALIDATION_FAILED,
      'Sesi ini tidak terhubung ke tenant mana pun.',
    );
  }
  return user.schemaName;
}

@Module({
  imports: [InfrastructureModule],
  controllers: [UiActivityController, TableAuditController],
  providers: [UiActivityService, TableAuditService],
  exports: [UiActivityService, TableAuditService],
})
export class ActivityModule {}
