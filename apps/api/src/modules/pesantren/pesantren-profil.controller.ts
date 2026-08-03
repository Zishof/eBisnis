/**
 * Titik masuk HTTP pengaturan situs publik pondok (profil, tema tampilan).
 */

import { Body, Controller, Get, Param, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenProfilService } from './pesantren-profil.service';
import { KATEGORI_GAMBAR_PROFIL, KategoriGambarProfil, TEMA_SITUS } from './pesantren-profil';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

/** Ditolak di luar daftar ini -- lihat komentar pada `PesantrenProfilService.unggahGambar`. */
const MIME_GAMBAR_SAH = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UKURAN_MAKSIMUM_BYTES = 5 * 1024 * 1024;

type BerkasUnggahan = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

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

  @ApiPropertyOptional({ description: 'Kredit sumber gambar latar, mis. lisensi CC. Kosong berarti tidak perlu atribusi.' })
  @IsOptional() @IsString() @MaxLength(255)
  heroImageAttribution?: string;

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

  /**
   * Mengunggah logo atau gambar latar (hero) situs pondok. Disimpan SEBAGAI
   * DATA di skema penyewa (PostgreSQL Large Object, lihat
   * `TenantFileBlobService`), bukan folder server -- diminta langsung
   * pengguna. `logo_url`/`hero_image_url` diperbarui otomatis menunjuk
   * endpoint publik yang menyajikannya (`PesantrenPublicController.gambar`).
   */
  @Permissions('EPESANTREN_PROFIL.UPDATE')
  @Post('gambar/:kategori')
  @ApiParam({ name: 'kategori', enum: KATEGORI_GAMBAR_PROFIL })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Mengunggah logo atau gambar latar (hero) situs pondok' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UKURAN_MAKSIMUM_BYTES } }))
  async unggahGambar(
    @Param('kategori') kategori: string,
    @UploadedFile() file: BerkasUnggahan | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const kategoriUpper = kategori.toUpperCase();
    if (!KATEGORI_GAMBAR_PROFIL.includes(kategoriUpper as KategoriGambarProfil)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Kategori gambar tidak dikenali. Pilih salah satu: ${KATEGORI_GAMBAR_PROFIL.join(', ')}.`,
      );
    }
    if (!file) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Berkas gambar wajib disertakan.');
    }
    if (!MIME_GAMBAR_SAH.has(file.mimetype)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Jenis berkas tidak didukung. Gunakan JPEG, PNG, atau WEBP.',
      );
    }
    return this.profil.unggahGambar(
      schemaWajib(user),
      kategoriUpper as KategoriGambarProfil,
      { filename: file.originalname, mimeType: file.mimetype, buffer: file.buffer },
      user.userId,
    );
  }
}
