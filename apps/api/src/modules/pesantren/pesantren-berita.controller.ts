/**
 * Titik masuk HTTP berita/kabar pondok.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenBeritaService } from './pesantren-berita.service';
import { STATUS_BERITA } from './pesantren-berita';
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

class DaftarBeritaQuery {
  @ApiPropertyOptional({ enum: STATUS_BERITA })
  @IsOptional() @IsIn(STATUS_BERITA as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 }) @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class CatatBeritaDto {
  @ApiProperty({ example: 'Bahtsul Masail IPPB Digelar di Pondok' })
  @IsString() @MaxLength(255)
  judul!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  ringkasan?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  isiHtml?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  gambarUrl?: string;

  @ApiPropertyOptional({ description: 'Tautan sumber bila diadaptasi dari liputan luar' })
  @IsOptional() @IsString() @MaxLength(500)
  sumberUrl?: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional() @IsISO8601()
  tanggalTerbit?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/berita')
export class PesantrenBeritaController {
  constructor(private readonly berita: PesantrenBeritaService) {}

  @Permissions('EPESANTREN_BERITA.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar berita pondok' })
  daftar(@Query() query: DaftarBeritaQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.berita.daftar(schemaWajib(user), {
      status: query.status,
      halaman: query.halaman && query.halaman > 0 ? query.halaman : 1,
      ukuranHalaman:
        query.ukuranHalaman && query.ukuranHalaman > 0 && query.ukuranHalaman <= 100 ? query.ukuranHalaman : 25,
    });
  }

  @Permissions('EPESANTREN_BERITA.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail satu berita' })
  async satu(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const berita = await this.berita.satu(schemaWajib(user), id);
    if (!berita) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berita tidak ditemukan.');
    }
    return berita;
  }

  @Permissions('EPESANTREN_BERITA.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Menulis berita baru (berstatus DRAFT)' })
  catat(@Body() dto: CatatBeritaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.berita.catat(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_BERITA.APPROVE')
  @Post(':id/terbitkan')
  @ApiOperation({ summary: 'Menerbitkan berita (DRAFT -> TERBIT)' })
  terbitkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.berita.terbitkan(schemaWajib(user), id, user.userId);
  }

  @Permissions('EPESANTREN_BERITA.UPDATE')
  @Post(':id/gambar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Mengunggah gambar sampul berita pondok' })
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
    return this.berita.unggahGambar(
      schemaWajib(user),
      id,
      { filename: file.originalname, mimeType: file.mimetype, buffer: file.buffer },
      user.userId,
    );
  }
}
