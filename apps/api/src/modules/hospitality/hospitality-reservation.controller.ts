/**
 * Titik masuk HTTP reservasi dan siklus hidupnya (MI-8). Pola sama dengan
 * `hospitality-properti.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { HospitalityReservationService } from './hospitality-reservation.service';
import { SUMBER_RESERVASI } from './hospitality-reservation';
import { AuthenticatedUser, CurrentUser, Permissions, RequestContext, type RequestMeta } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class RoomStayDto {
  @ApiProperty()
  @IsString()
  roomTypeId!: string;

  @ApiProperty({ example: '2026-09-10' })
  @IsString()
  checkinDate!: string;

  @ApiProperty({ example: '2026-09-12' })
  @IsString()
  checkoutDate!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsInt() @Min(1)
  adults?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt() @Min(0)
  children?: number;

  @ApiProperty({ example: 850000 })
  @IsNumber()
  rateAmount!: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  guestId?: string;
}

class CatatReservasiDto {
  @ApiProperty()
  @IsString()
  propertyId!: string;

  @ApiProperty()
  @IsString()
  guestId!: string;

  @ApiPropertyOptional({ enum: SUMBER_RESERVASI })
  @IsOptional() @IsIn(SUMBER_RESERVASI as unknown as string[])
  source?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  marketSegment?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  specialRequests?: string;

  @ApiPropertyOptional({ enum: ['HOLD', 'CONFIRMED'] })
  @IsOptional() @IsIn(['HOLD', 'CONFIRMED'])
  statusAwal?: string;

  @ApiProperty({ type: [RoomStayDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => RoomStayDto)
  roomStays!: RoomStayDto[];
}

class DaftarReservasiQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  propertyId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class UbahStatusDto {
  @ApiProperty({ description: 'Version reservasi yang sedang dilihat -- kunci optimistik.' })
  @IsInt()
  expectedVersion!: number;
}

class BatalkanDto extends UbahStatusDto {
  @ApiProperty()
  @IsString()
  alasan!: string;
}

@ApiTags('hospitality')
@ApiBearerAuth('access-token')
@Controller('hospitality/reservasi')
export class HospitalityReservationController {
  constructor(private readonly reservasi: HospitalityReservationService) {}

  @Permissions('HOSPITALITY_RESERVASI.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar reservasi' })
  daftar(@Query() query: DaftarReservasiQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.reservasi.daftarReservasi(schemaWajib(user), {
      propertyId: query.propertyId,
      status: query.status,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman: query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('HOSPITALITY_RESERVASI.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail reservasi beserta kamarnya' })
  detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reservasi.detailReservasi(schemaWajib(user), id);
  }

  @Permissions('HOSPITALITY_RESERVASI.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Mencatat reservasi baru',
    description: 'Idempoten terhadap tajuk Idempotency-Key -- permintaan yang diulang dengan kunci yang sama mengembalikan reservasi yang sama, bukan membuat yang kedua.',
  })
  async catat(
    @Body() dto: CatatReservasiDto,
    @RequestContext() meta: RequestMeta,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { reservasi, diulang } = await this.reservasi.catatReservasi(
      schemaWajib(user),
      dto,
      meta.idempotencyKey,
      user.userId,
    );
    return { ...reservasi, _diulangDariPermintaanSebelumnya: diulang };
  }

  @Permissions('HOSPITALITY_RESERVASI.UPDATE')
  @Post(':id/konfirmasi')
  @ApiOperation({ summary: 'Mengonfirmasi reservasi (HOLD -> CONFIRMED)' })
  konfirmasi(@Param('id') id: string, @Body() dto: UbahStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reservasi.ubahStatus(schemaWajib(user), id, 'CONFIRMED', dto.expectedVersion, user.userId);
  }

  @Permissions('HOSPITALITY_RESERVASI.UPDATE')
  @Post(':id/batalkan')
  @ApiOperation({ summary: 'Membatalkan reservasi' })
  batalkan(@Param('id') id: string, @Body() dto: BatalkanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reservasi.ubahStatus(schemaWajib(user), id, 'CANCELLED', dto.expectedVersion, user.userId, {
      alasan: dto.alasan,
    });
  }

  @Permissions('HOSPITALITY_RESERVASI.UPDATE')
  @Post(':id/no-show')
  @ApiOperation({ summary: 'Menandai reservasi sebagai no-show' })
  noShow(@Param('id') id: string, @Body() dto: UbahStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reservasi.ubahStatus(schemaWajib(user), id, 'NO_SHOW', dto.expectedVersion, user.userId);
  }

  @Permissions('HOSPITALITY_RESERVASI.UPDATE')
  @Post(':id/pulihkan')
  @ApiOperation({ summary: 'Memulihkan reservasi CANCELLED/NO_SHOW kembali menjadi CONFIRMED' })
  pulihkan(@Param('id') id: string, @Body() dto: UbahStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reservasi.ubahStatus(schemaWajib(user), id, 'CONFIRMED', dto.expectedVersion, user.userId);
  }
}
