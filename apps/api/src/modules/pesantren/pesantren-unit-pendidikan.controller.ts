import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { JENIS_UNIT_PENDIDIKAN, KATEGORI_GAMBAR_UNIT_PENDIDIKAN, KategoriGambarUnitPendidikan } from './pesantren-unit-pendidikan';
import { PesantrenUnitPendidikanService } from './pesantren-unit-pendidikan.service';

const MIME_GAMBAR_SAH = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UKURAN_MAKSIMUM_BYTES = 5 * 1024 * 1024;

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

function tenantWajib(user: AuthenticatedUser): string {
  if (!user.tenantId) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks penyewa tidak ditemukan pada sesi Anda.');
  }
  return user.tenantId;
}

class DaftarUnitPendidikanQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  cari?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'] }) @IsOptional() @IsIn(['true', 'false'])
  aktif?: string;
}

class SimpanUnitPendidikanDto {
  @ApiProperty({ example: 'MI-RU' }) @IsString()
  code!: string;

  @ApiProperty({ example: 'Madrasah Ibtidaiyah Raudlatul Ulum' }) @IsString()
  name!: string;

  @ApiProperty({ enum: JENIS_UNIT_PENDIDIKAN }) @IsIn(JENIS_UNIT_PENDIDIKAN)
  jenis!: string;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  websiteEnabled?: boolean;

  @ApiPropertyOptional({ example: 'mi-ru' }) @IsOptional() @IsString()
  publicSlug?: string;

  @ApiPropertyOptional({ example: 'mi-raudlatul-ulum' }) @IsOptional() @IsString()
  santriSubdomain?: string;

  @ApiPropertyOptional({ example: 'mi.raudlatululum.sch.id' }) @IsOptional() @IsString()
  customDomain?: string;

  @ApiPropertyOptional({ example: 'https://example.sch.id/logo-mi.png' }) @IsOptional() @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.sch.id/kegiatan-belajar.jpg' }) @IsOptional() @IsString()
  heroImageUrl?: string;

  @ApiPropertyOptional({ example: 'Selamat datang di MI Raudlatul Ulum' }) @IsOptional() @IsString()
  welcomeTitle?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  welcomeBody?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/unit-pendidikan')
export class PesantrenUnitPendidikanController {
  constructor(private readonly unitPendidikan: PesantrenUnitPendidikanService) {}

  @Permissions('EPESANTREN_UNIT_PENDIDIKAN.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar unit pendidikan pesantren' })
  daftar(@Query() query: DaftarUnitPendidikanQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.unitPendidikan.daftar(schemaWajib(user), {
      cari: query.cari,
      aktif: query.aktif == null ? undefined : query.aktif === 'true',
    });
  }

  @Permissions('EPESANTREN_UNIT_PENDIDIKAN.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail satu unit pendidikan' })
  async satu(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const unit = await this.unitPendidikan.satu(schemaWajib(user), id);
    if (!unit) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Unit pendidikan tidak ditemukan.');
    }
    return unit;
  }

  @Permissions('EPESANTREN_UNIT_PENDIDIKAN.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat unit pendidikan baru' })
  catat(@Body() dto: SimpanUnitPendidikanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.unitPendidikan.catat(schemaWajib(user), tenantWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_UNIT_PENDIDIKAN.UPDATE')
  @Patch(':id')
  @ApiOperation({ summary: 'Mengubah unit pendidikan' })
  ubah(@Param('id') id: string, @Body() dto: SimpanUnitPendidikanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.unitPendidikan.ubah(schemaWajib(user), tenantWajib(user), id, dto, user.userId);
  }

  @Permissions('EPESANTREN_UNIT_PENDIDIKAN.UPDATE')
  @Post(':id/gambar/:kategori')
  @ApiParam({ name: 'kategori', enum: KATEGORI_GAMBAR_UNIT_PENDIDIKAN })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Mengunggah logo atau foto hero unit pendidikan' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UKURAN_MAKSIMUM_BYTES } }))
  unggahGambar(
    @Param('id') id: string,
    @Param('kategori') kategori: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const kategoriUpper = kategori.toUpperCase();
    if (!KATEGORI_GAMBAR_UNIT_PENDIDIKAN.includes(kategoriUpper as KategoriGambarUnitPendidikan)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Kategori gambar tidak dikenali. Pilih salah satu: ${KATEGORI_GAMBAR_UNIT_PENDIDIKAN.join(', ')}.`,
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
    return this.unitPendidikan.unggahGambar(
      schemaWajib(user),
      id,
      kategoriUpper as KategoriGambarUnitPendidikan,
      { filename: file.originalname, mimeType: file.mimetype, buffer: file.buffer },
      user.userId,
    );
  }

  @Permissions('EPESANTREN_UNIT_PENDIDIKAN.UPDATE')
  @Delete(':id')
  @ApiOperation({ summary: 'Menghapus lunak unit pendidikan yang belum dipakai' })
  hapus(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.unitPendidikan.hapus(schemaWajib(user), id, user.userId);
  }
}
