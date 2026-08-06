/**
 * Titik masuk HTTP rate plan dan kalender harga/restriksi (MI-10). Pola
 * sama dengan `hospitality-room-block.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { HospitalityRateService } from './hospitality-rate.service';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class CatatRatePlanDto {
  @ApiProperty({ example: 'BAR' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Best Flexible Rate' })
  @IsString()
  nama!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  deskripsi?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isRefundable?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsNumber()
  extraPersonAmount?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsInt() @Min(1)
  defaultMinLos?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(1)
  defaultMaxLos?: number;
}

class RentangTanggalDto {
  @ApiProperty({ example: '2026-10-01' })
  @IsString()
  checkin!: string;

  @ApiProperty({ example: '2026-10-31' })
  @IsString()
  checkout!: string;
}

class AturHargaKalenderDto extends RentangTanggalDto {
  @ApiProperty({ example: 850000 })
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(1)
  minLos?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(1)
  maxLos?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean()
  closedToArrival?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean()
  closedToDeparture?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean()
  stopSell?: boolean;
}

@ApiTags('hospitality')
@ApiBearerAuth('access-token')
@Controller('hospitality/tipe-kamar/:roomTypeId/rate-plan')
export class HospitalityRateController {
  constructor(private readonly rate: HospitalityRateService) {}

  @Permissions('HOSPITALITY_PROPERTI.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar rate plan pada satu tipe kamar' })
  daftar(@Param('roomTypeId') roomTypeId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rate.daftarRatePlan(schemaWajib(user), roomTypeId);
  }

  @Permissions('HOSPITALITY_PROPERTI.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat rate plan baru' })
  catat(
    @Param('roomTypeId') roomTypeId: string,
    @Body() dto: CatatRatePlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rate.catatRatePlan(schemaWajib(user), roomTypeId, dto, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.READ')
  @Get(':ratePlanId/kalender')
  @ApiOperation({ summary: 'Kalender harga+restriksi rate plan untuk rentang tanggal' })
  daftarKalender(
    @Param('ratePlanId') ratePlanId: string,
    @Query() query: RentangTanggalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rate.daftarKalender(schemaWajib(user), ratePlanId, query);
  }

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post(':ratePlanId/kalender')
  @ApiOperation({ summary: 'Menyusun harga dan restriksi untuk rentang tanggal (upsert per malam)' })
  aturKalender(
    @Param('ratePlanId') ratePlanId: string,
    @Body() dto: AturHargaKalenderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rate.aturHargaKalender(schemaWajib(user), ratePlanId, dto, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post(':ratePlanId/terbitkan')
  @ApiOperation({ summary: 'Menerbitkan kalender (DRAFT -> PUBLISHED) untuk rentang tanggal' })
  terbitkan(
    @Param('ratePlanId') ratePlanId: string,
    @Body() dto: RentangTanggalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rate.terbitkan(schemaWajib(user), ratePlanId, dto, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post(':ratePlanId/tarik')
  @ApiOperation({ summary: 'Menarik kalender (PUBLISHED -> DRAFT) untuk rentang tanggal' })
  tarik(
    @Param('ratePlanId') ratePlanId: string,
    @Body() dto: RentangTanggalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rate.tarik(schemaWajib(user), ratePlanId, dto, user.userId);
  }
}
