/**
 * Titik masuk HTTP blokir kamar dan ketersediaan (MI-6). Pola sama dengan
 * `hospitality-properti.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { HospitalityRoomBlockService } from './hospitality-room-block.service';
import { STATUS_BLOKIR } from './hospitality-room-block';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class BlokirKamarDto {
  @ApiProperty({ example: '2026-09-01' })
  @IsString()
  checkin!: string;

  @ApiProperty({ example: '2026-09-03' })
  @IsString()
  checkout!: string;

  @ApiProperty({ enum: STATUS_BLOKIR })
  @IsIn(STATUS_BLOKIR as unknown as string[])
  status!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  alasan?: string;
}

class RentangTanggalDto {
  @ApiProperty({ example: '2026-09-01' })
  @IsString()
  checkin!: string;

  @ApiProperty({ example: '2026-09-03' })
  @IsString()
  checkout!: string;
}

class KetersediaanQuery {
  @ApiProperty({ example: '2026-09-01' })
  @IsString()
  checkin!: string;

  @ApiProperty({ example: '2026-09-03' })
  @IsString()
  checkout!: string;
}

@ApiTags('hospitality')
@ApiBearerAuth('access-token')
@Controller('hospitality/properti')
export class HospitalityRoomBlockController {
  constructor(private readonly blok: HospitalityRoomBlockService) {}

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post(':propertyId/kamar/:roomId/blok')
  @HttpCode(201)
  @ApiOperation({ summary: 'Memblokir kamar (BLOCKED/OUT_OF_ORDER/OUT_OF_SERVICE) untuk rentang tanggal' })
  blokir(
    @Param('propertyId') propertyId: string,
    @Param('roomId') roomId: string,
    @Body() dto: BlokirKamarDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blok.blokir(schemaWajib(user), propertyId, roomId, dto, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post(':propertyId/kamar/:roomId/buka-blokir')
  @HttpCode(200)
  @ApiOperation({ summary: 'Membuka blokir kamar untuk rentang tanggal' })
  bukaBlokir(
    @Param('propertyId') propertyId: string,
    @Param('roomId') roomId: string,
    @Body() dto: RentangTanggalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blok.bukaBlokir(schemaWajib(user), propertyId, roomId, dto, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.READ')
  @Get(':propertyId/kamar/:roomId/blok')
  @ApiOperation({ summary: 'Daftar blokir aktif pada satu kamar' })
  daftarBlokir(@Param('roomId') roomId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.blok.daftarBlokir(schemaWajib(user), roomId);
  }

  @Permissions('HOSPITALITY_PROPERTI.READ')
  @Get(':propertyId/tipe-kamar/:roomTypeId/ketersediaan')
  @ApiOperation({ summary: 'Ketersediaan tipe kamar untuk rentang menginap' })
  ketersediaan(
    @Param('roomTypeId') roomTypeId: string,
    @Query() query: KetersediaanQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.blok.hitungKetersediaan(schemaWajib(user), roomTypeId, query);
  }
}
