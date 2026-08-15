/**
 * Titik masuk HTTP properti, tipe kamar, dan kamar (MI-5). Pola sama dengan
 * `pesantren-asrama.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsInt, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { HospitalityPropertiService } from './hospitality-properti.service';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class CatatPropertiDto {
  @ApiProperty({ example: 'PROP-01' })
  @IsString() @MaxLength(32)
  code!: string;

  @ApiProperty({ example: 'Hotel Merdeka Bandung' })
  @IsString() @MaxLength(120)
  nama!: string;

  @ApiPropertyOptional({ example: 'Asia/Jakarta' })
  @IsOptional() @IsString() @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  alamat?: string;
}

class CatatTipeKamarDto {
  @ApiProperty({ example: 'DLX' })
  @IsString() @MaxLength(32)
  code!: string;

  @ApiProperty({ example: 'Deluxe' })
  @IsString() @MaxLength(120)
  nama!: string;

  @ApiProperty({ example: 2 })
  @IsInt() @IsPositive()
  okupansiMaks!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  deskripsi?: string;
}

class AturTarifPublikDto {
  @ApiPropertyOptional({
    description: 'Tarif per malam yang dipublikasikan ke booking engine. Kosongkan (null) untuk membuka publikasi.',
    example: 850000,
  })
  @IsOptional() @IsNumber()
  amount?: number | null;
}

class CatatKamarDto {
  @ApiProperty()
  @IsString()
  roomTypeId!: string;

  @ApiProperty({ example: '101' })
  @IsString() @MaxLength(16)
  nomorKamar!: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional() @IsString() @MaxLength(16)
  lantai?: string;

  @ApiPropertyOptional({ example: ['CITY_VIEW', 'NON_SMOKING'] })
  @IsOptional() @IsArray() @IsString({ each: true })
  features?: string[];
}

@ApiTags('hospitality')
@ApiBearerAuth('access-token')
@Controller('hospitality/properti')
export class HospitalityPropertiController {
  constructor(private readonly properti: HospitalityPropertiService) {}

  @Permissions('HOSPITALITY_PROPERTI.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar properti' })
  daftarProperti(@CurrentUser() user: AuthenticatedUser) {
    return this.properti.daftarProperti(schemaWajib(user));
  }

  @Permissions('HOSPITALITY_PROPERTI.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat properti baru' })
  catatProperti(@Body() dto: CatatPropertiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.properti.catatProperti(schemaWajib(user), dto, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.READ')
  @Get(':id/tipe-kamar')
  @ApiOperation({ summary: 'Daftar tipe kamar pada satu properti' })
  daftarTipeKamar(@Param('id') propertyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.properti.daftarTipeKamar(schemaWajib(user), propertyId);
  }

  @Permissions('HOSPITALITY_PROPERTI.CREATE')
  @Post(':id/tipe-kamar')
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat tipe kamar baru pada satu properti' })
  catatTipeKamar(
    @Param('id') propertyId: string,
    @Body() dto: CatatTipeKamarDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.properti.catatTipeKamar(schemaWajib(user), propertyId, dto, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.UPDATE')
  @Post(':id/tipe-kamar/:roomTypeId/tarif-publik')
  @ApiOperation({ summary: 'Menetapkan atau membuka tarif publik tipe kamar (booking engine, MI-9)' })
  aturTarifPublik(
    @Param('id') propertyId: string,
    @Param('roomTypeId') roomTypeId: string,
    @Body() dto: AturTarifPublikDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.properti.aturTarifPublik(schemaWajib(user), propertyId, roomTypeId, dto.amount ?? null, user.userId);
  }

  @Permissions('HOSPITALITY_PROPERTI.READ')
  @Get(':id/kamar')
  @ApiOperation({ summary: 'Daftar kamar pada satu properti' })
  daftarKamar(@Param('id') propertyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.properti.daftarKamar(schemaWajib(user), propertyId);
  }

  @Permissions('HOSPITALITY_PROPERTI.CREATE')
  @Post(':id/kamar')
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat kamar baru pada satu properti' })
  catatKamar(
    @Param('id') propertyId: string,
    @Body() dto: CatatKamarDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.properti.catatKamar(schemaWajib(user), propertyId, dto, user.userId);
  }
}
