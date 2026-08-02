/**
 * Titik masuk HTTP PSB/PPDB (EP-O2). Pola sama dengan
 * `pesantren-nilai.controller.ts`. Satu berkas, dua controller (gelombang
 * dan pendaftar/jadwal) — mengikuti pola `pesantren-asrama.controller.ts`.
 */

import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PesantrenPsbService } from './pesantren-psb.service';
import { JENIS_JADWAL, STATUS_JADWAL } from './pesantren-psb';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

function schemaWajib(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Konteks ruang kerja tidak ditemukan pada sesi Anda.');
  }
  return user.schemaName;
}

class HalamanQuery {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number)
  halaman?: number;

  @ApiPropertyOptional({ default: 25 }) @IsOptional() @Type(() => Number)
  ukuranHalaman?: number;
}

class DaftarGelombangQuery extends HalamanQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  status?: string;
}

class DaftarPendaftarQuery extends HalamanQuery {
  @ApiPropertyOptional() @IsOptional() @IsString()
  gelombangId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  cari?: string;
}

function halamanOpsi(q: HalamanQuery) {
  return {
    halaman: q.halaman && q.halaman > 0 ? q.halaman : 1,
    ukuranHalaman: q.ukuranHalaman && q.ukuranHalaman > 0 && q.ukuranHalaman <= 100 ? q.ukuranHalaman : 25,
  };
}

class CatatGelombangDto {
  @ApiProperty() @IsString()
  tahunAjaranId!: string;

  @ApiProperty({ example: 'G1' }) @IsString() @MaxLength(16)
  kode!: string;

  @ApiProperty({ example: 'Gelombang 1' }) @IsString() @MaxLength(160)
  nama!: string;

  @ApiProperty() @IsString()
  tanggalBuka!: string;

  @ApiProperty() @IsString()
  tanggalTutup!: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1)
  kuota?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0)
  biayaPendaftaran?: number;
}

class DaftarkanPendaftarDto {
  @ApiProperty() @IsString()
  gelombangId!: string;

  @ApiProperty() @IsString() @MaxLength(160)
  namaLengkap!: string;

  @ApiProperty({ enum: ['L', 'P'] }) @IsIn(['L', 'P'])
  jenisKelamin!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  tempatLahir?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggalLahir?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160)
  namaOrangTua?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32)
  noHpOrangTua?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  alamat?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160)
  asalSekolah?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  unitPendidikanTujuanId?: string;
}

class CatatanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  catatan?: string;
}

class JadwalkanDto {
  @ApiProperty() @IsString()
  pendaftarId!: string;

  @ApiProperty({ enum: JENIS_JADWAL }) @IsIn(JENIS_JADWAL as unknown as string[])
  jenis!: string;

  @ApiProperty() @IsString()
  tanggal!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  waktuMulai?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  waktuSelesai?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160)
  lokasi?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160)
  penguji?: string;
}

class HasilJadwalDto {
  @ApiProperty({ enum: STATUS_JADWAL }) @IsIn(STATUS_JADWAL as unknown as string[])
  status!: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100)
  nilai?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  catatanHasil?: string;
}

class DaftarUlangDto {
  @ApiProperty() @IsString() @MaxLength(32)
  nis!: string;

  @ApiProperty({ enum: ['MUKIM', 'NONMUKIM'] }) @IsIn(['MUKIM', 'NONMUKIM'])
  statusTinggal!: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  tanggalMasuk?: string;
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/psb/gelombang')
export class PesantrenPsbGelombangController {
  constructor(private readonly psb: PesantrenPsbService) {}

  @Permissions('EPESANTREN_PSB.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar gelombang PSB/PPDB' })
  daftar(@Query() query: DaftarGelombangQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.daftarGelombang(schemaWajib(user), { status: query.status, ...halamanOpsi(query) });
  }

  @Permissions('EPESANTREN_PSB.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail satu gelombang' })
  satu(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.satuGelombang(schemaWajib(user), id);
  }

  @Permissions('EPESANTREN_PSB.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat gelombang penerimaan baru' })
  catat(@Body() dto: CatatGelombangDto, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.catatGelombang(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_PSB.APPROVE')
  @Post(':id/buka')
  @ApiOperation({ summary: 'Membuka gelombang untuk pendaftaran (DRAFT -> DIBUKA)' })
  buka(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.bukaGelombang(schemaWajib(user), id, user.userId);
  }

  @Permissions('EPESANTREN_PSB.APPROVE')
  @Post(':id/tutup')
  @ApiOperation({ summary: 'Menutup gelombang dari pendaftaran baru (DIBUKA -> DITUTUP)' })
  tutup(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.tutupGelombang(schemaWajib(user), id, user.userId);
  }

  @Permissions('EPESANTREN_PSB.APPROVE')
  @Post(':id/selesai')
  @ApiOperation({ summary: 'Menandai gelombang selesai diproses (DITUTUP -> SELESAI)' })
  selesai(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.selesaikanGelombang(schemaWajib(user), id, user.userId);
  }
}

@ApiTags('pesantren')
@ApiBearerAuth('access-token')
@Controller('pesantren/psb/pendaftar')
export class PesantrenPsbPendaftarController {
  constructor(private readonly psb: PesantrenPsbService) {}

  @Permissions('EPESANTREN_PSB.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar pendaftar PSB/PPDB' })
  daftar(@Query() query: DaftarPendaftarQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.daftarPendaftar(schemaWajib(user), {
      gelombangId: query.gelombangId,
      status: query.status,
      cari: query.cari,
      ...halamanOpsi(query),
    });
  }

  @Permissions('EPESANTREN_PSB.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Detail satu pendaftar' })
  satu(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.satuPendaftar(schemaWajib(user), id);
  }

  @Permissions('EPESANTREN_PSB.CREATE')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Mendaftarkan calon santri baru pada gelombang yang sedang DIBUKA' })
  daftarkan(@Body() dto: DaftarkanPendaftarDto, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.daftarkan(schemaWajib(user), dto, user.userId);
  }

  @Permissions('EPESANTREN_PSB.REVIEW')
  @Post(':id/verifikasi')
  @ApiOperation({ summary: 'Memverifikasi berkas pendaftar (TERDAFTAR -> VERIFIKASI)' })
  verifikasi(@Param('id') id: string, @Body() dto: CatatanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.verifikasi(schemaWajib(user), id, dto.catatan, user.userId);
  }

  @Permissions('EPESANTREN_PSB.READ')
  @Get(':id/jadwal')
  @ApiOperation({ summary: 'Daftar jadwal ujian/wawancara satu pendaftar' })
  daftarJadwal(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.daftarJadwal(schemaWajib(user), id);
  }

  @Permissions('EPESANTREN_PSB.CREATE')
  @Post(':id/jadwal')
  @HttpCode(201)
  @ApiOperation({ summary: 'Menjadwalkan ujian/wawancara' })
  jadwalkan(@Param('id') id: string, @Body() dto: Omit<JadwalkanDto, 'pendaftarId'>, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.jadwalkan(schemaWajib(user), { ...dto, pendaftarId: id }, user.userId);
  }

  @Permissions('EPESANTREN_PSB.CREATE')
  @Post('jadwal/:jadwalId/hasil')
  @ApiOperation({ summary: 'Mencatat hasil ujian/wawancara' })
  catatHasilJadwal(
    @Param('jadwalId') jadwalId: string,
    @Body() dto: HasilJadwalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.psb.catatHasilJadwal(schemaWajib(user), jadwalId, dto, user.userId);
  }

  @Permissions('EPESANTREN_PSB.APPROVE')
  @Post(':id/luluskan')
  @ApiOperation({ summary: 'Meluluskan seleksi pendaftar (DIJADWALKAN -> LULUS_SELEKSI)' })
  luluskan(@Param('id') id: string, @Body() dto: CatatanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.luluskan(schemaWajib(user), id, dto.catatan, user.userId);
  }

  @Permissions('EPESANTREN_PSB.REJECT')
  @Post(':id/tidak-luluskan')
  @ApiOperation({ summary: 'Menyatakan pendaftar tidak lulus seleksi (DIJADWALKAN -> TIDAK_LULUS)' })
  tidakLuluskan(@Param('id') id: string, @Body() dto: CatatanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.tidakLuluskan(schemaWajib(user), id, dto.catatan, user.userId);
  }

  @Permissions('EPESANTREN_PSB.APPROVE')
  @Post(':id/terima')
  @ApiOperation({ summary: 'Menerima pendaftar yang sudah lulus seleksi (LULUS_SELEKSI -> DITERIMA)' })
  terima(@Param('id') id: string, @Body() dto: CatatanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.terima(schemaWajib(user), id, dto.catatan, user.userId);
  }

  @Permissions('EPESANTREN_PSB.CANCEL')
  @Post(':id/batalkan')
  @ApiOperation({ summary: 'Membatalkan pendaftaran (mengundurkan diri, data ganda, dan lain sebagainya)' })
  batalkan(@Param('id') id: string, @Body() dto: CatatanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.batalkan(schemaWajib(user), id, dto.catatan, user.userId);
  }

  @Permissions('EPESANTREN_PSB.CREATE')
  @Post(':id/daftar-ulang')
  @ApiOperation({ summary: 'Daftar ulang — membuat baris santri aktif dari pendaftar yang DITERIMA' })
  daftarUlang(@Param('id') id: string, @Body() dto: DaftarUlangDto, @CurrentUser() user: AuthenticatedUser) {
    return this.psb.daftarUlang(schemaWajib(user), id, dto, user.userId);
  }
}
