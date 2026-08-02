/**
 * Titik masuk HTTP pengaturan situs publik pondok (profil, tema tampilan).
 */

import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenProfilService } from './pesantren-profil.service';
import { TEMA_SITUS } from './pesantren-profil';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class PerbaruiProfilDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ enum: TEMA_SITUS }) @IsOptional() @IsIn(TEMA_SITUS as unknown as string[])
  themeCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160)
  namaTampilan?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  tagline?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  muqodimahHtml?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  sejarahHtml?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  visi?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  misi?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160)
  pengasuh?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt()
  tahunBerdiri?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
  afiliasi?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  heroImageUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  alamatPublik?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  kontakTelepon?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40)
  kontakWhatsapp?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160)
  kontakEmail?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  mapEmbedUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  instagramUrl?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(320)
  metaDescription?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/profil')
export class PesantrenProfilController {
  constructor(private readonly profil: PesantrenProfilService) {}

  @Permissions('EPESANTREN_PROFIL.READ')
  @Get()
  @ApiOperation({ summary: 'Pengaturan situs publik pondok saat ini' })
  ambil(@CurrentUser() user: AuthenticatedUser) {
    return this.profil.ambil(schemaWajib(user));
  }

  @Permissions('EPESANTREN_PROFIL.UPDATE')
  @Put()
  @ApiOperation({ summary: 'Memperbarui pengaturan situs publik pondok (profil, tema, kontak)' })
  perbarui(@Body() dto: PerbaruiProfilDto, @CurrentUser() user: AuthenticatedUser) {
    return this.profil.perbarui(schemaWajib(user), dto, user.userId);
  }
}
