/**
 * Galeri/program visual untuk situs pondok dan halaman unit pendidikan.
 */

import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { PesantrenMediaService } from './pesantren-media.service';
import { KATEGORI_MEDIA_PESANTREN } from './pesantren-media';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

const MIME_GAMBAR_SAH = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UKURAN_MAKSIMUM_BYTES = 5 * 1024 * 1024;

interface BerkasUnggah {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class DaftarMediaQuery {
  @ApiPropertyOptional({ description: 'Filter galeri milik satu unit pendidikan' })
  @IsOptional()
  @IsString()
  unitPendidikanId?: string;
}

class SimpanMediaDto {
  @ApiPropertyOptional({ description: 'Kosongkan untuk galeri pondok utama.' })
  @IsOptional()
  @IsString()
  unitPendidikanId?: string | null;

  @ApiPropertyOptional({ enum: KATEGORI_MEDIA_PESANTREN })
  @IsOptional()
  @IsIn(KATEGORI_MEDIA_PESANTREN as unknown as string[])
  kategori?: string;

  @ApiProperty({ example: 'Halaqah kitab kuning pagi hari' })
  @IsString()
  @MaxLength(160)
  judul!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deskripsi?: string | null;

  @ApiPropertyOptional({ description: 'URL gambar luar, bila tidak memakai unggahan.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  attribution?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/media')
export class PesantrenMediaController {
  constructor(private readonly media: PesantrenMediaService) {}

  @Permissions('EPESANTREN_PROFIL.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar galeri/program visual situs pondok dan unit pendidikan' })
  daftar(@Query() query: DaftarMediaQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.media.daftar(schemaWajib(user), { unitPendidikanId: query.unitPendidikanId });
  }

  @Permissions('EPESANTREN_PROFIL.UPDATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Menambahkan media galeri/program situs' })
  catat(@Body() dto: SimpanMediaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.media.catat(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_PROFIL.UPDATE')
  @Patch(':id')
  @ApiOperation({ summary: 'Memperbarui metadata media galeri/program situs' })
  ubah(@Param('id') id: string, @Body() dto: SimpanMediaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.media.ubah(schemaWajib(user), id, dto, user.userId);
  }

  @Permissions('EPESANTREN_PROFIL.UPDATE')
  @Post(':id/gambar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Mengunggah gambar media galeri/program situs' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UKURAN_MAKSIMUM_BYTES } }))
  unggahGambar(
    @Param('id') id: string,
    @UploadedFile() file: BerkasUnggah | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Berkas gambar wajib disertakan.');
    }
    if (!MIME_GAMBAR_SAH.has(file.mimetype)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Jenis berkas tidak didukung. Gunakan JPEG, PNG, atau WEBP.',
      );
    }
    return this.media.unggahGambar(
      schemaWajib(user),
      id,
      { filename: file.originalname, mimeType: file.mimetype, buffer: file.buffer },
      user.userId,
    );
  }

  @Permissions('EPESANTREN_PROFIL.UPDATE')
  @Delete(':id')
  @ApiOperation({ summary: 'Menghapus media galeri/program situs' })
  hapus(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.media.hapus(schemaWajib(user), id, user.userId);
  }
}
