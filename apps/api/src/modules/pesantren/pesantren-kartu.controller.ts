/**
 * Titik masuk HTTP kartu RFID/QR santri (EP-M). Pola sama dengan
 * `pesantren-santri.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PesantrenKartuService } from './pesantren-kartu.service';
import { JENIS_KARTU } from './pesantren-kartu';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class TerbitkanKartuDto {
  @ApiProperty()
  @IsString()
  santriId!: string;

  @ApiProperty({ example: 'RFID-000123' })
  @IsString() @MaxLength(64)
  nomorKartu!: string;

  @ApiProperty({ enum: JENIS_KARTU, default: 'RFID' })
  @IsIn(JENIS_KARTU as unknown as string[])
  jenis!: string;
}

class NonaktifkanKartuDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  alasan?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/kartu')
export class PesantrenKartuController {
  constructor(private readonly kartu: PesantrenKartuService) {}

  @Permissions('EPESANTREN_KARTU.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar kartu santri' })
  daftar(@CurrentUser() user: AuthenticatedUser) {
    return this.kartu.daftar(schemaWajib(user));
  }

  @Permissions('EPESANTREN_KARTU.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Menerbitkan kartu baru untuk satu santri' })
  terbitkan(@Body() dto: TerbitkanKartuDto, @CurrentUser() user: AuthenticatedUser) {
    return this.kartu.terbitkan(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_KARTU.UPDATE')
  @Post(':id/nonaktifkan')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menonaktifkan kartu (hilang/rusak/diganti)' })
  nonaktifkan(@Param('id') id: string, @Body() dto: NonaktifkanKartuDto, @CurrentUser() user: AuthenticatedUser) {
    return this.kartu.nonaktifkan(schemaWajib(user), id, dto.alasan ?? '', user.userId);
  }
}
