/**
 * Titik masuk HTTP tagihan pendidikan/SPP (EP-F). Pola sama dengan
 * `pesantren-santri.controller.ts` dan `pesantren-presensi.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsISO8601, IsNumber, IsOptional, IsPositive, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenTagihanService } from './pesantren-tagihan.service';
import { STATUS_TAGIHAN } from './pesantren-tagihan';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(
      ErrorCodes.FORBIDDEN,
      'Konteks ruang kerja tidak ditemukan pada sesi Anda.',
    );
  }
  return user.schemaName;
}

class DaftarTagihanQuery {
  @ApiPropertyOptional({ enum: STATUS_TAGIHAN })
  @IsOptional() @IsIn(STATUS_TAGIHAN as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ example: '2026-08' })
  @IsOptional() @IsString() @MaxLength(7)
  periode?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  santriId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class ItemTagihanDto {
  @ApiProperty({ example: 'SPP' })
  @IsString() @MaxLength(32)
  kode!: string;

  @ApiProperty({ example: 'SPP Bulan Agustus 2026' })
  @IsString() @MaxLength(255)
  deskripsi!: string;

  @ApiProperty({ example: 150000 })
  @IsNumber() @IsPositive()
  jumlah!: number;
}

class CatatTagihanDto {
  @ApiProperty()
  @IsString()
  santriId!: string;

  @ApiProperty({ example: '2026-08' })
  @IsString() @MaxLength(7)
  periode!: string;

  @ApiProperty({ example: '2026-08-10' })
  @IsISO8601()
  jatuhTempo!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  catatan?: string;

  @ApiProperty({ type: [ItemTagihanDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => ItemTagihanDto)
  items!: ItemTagihanDto[];
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/tagihan')
export class PesantrenTagihanController {
  constructor(private readonly tagihan: PesantrenTagihanService) {}

  @Permissions('EPESANTREN_TAGIHAN.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar tagihan' })
  async daftar(@Query() query: DaftarTagihanQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.tagihan.daftar(schemaWajib(user), {
      status: query.status,
      periode: query.periode,
      santriId: query.santriId,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman:
        query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100
          ? query.ukuranHalaman
          : 25,
    });
  }

  @Permissions('EPESANTREN_TAGIHAN.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail satu tagihan beserta rinciannya' })
  async satu(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const tagihan = await this.tagihan.satu(schemaWajib(user), id);
    if (!tagihan) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tagihan tidak ditemukan.');
    }
    return tagihan;
  }

  @Permissions('EPESANTREN_TAGIHAN.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat tagihan baru berstatus DRAFT' })
  async catat(@Body() dto: CatatTagihanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tagihan.catat(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_TAGIHAN.UPDATE')
  @Post(':id/terbitkan')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menerbitkan tagihan DRAFT' })
  async terbitkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tagihan.terbitkan(schemaWajib(user), id, user.userId);
  }
}
