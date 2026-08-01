/**
 * Titik masuk HTTP pendaftaran pondok pesantren.
 *
 * Berkas tersendiri, bukan tambahan pada `public.controller.ts`, karena alasan
 * yang sama dengan servicenya: yang ditanyakan dan yang dihasilkan berbeda, dan
 * jalur yang membuat schema serta credential tidak boleh menanggung risiko
 * perubahan yang sebenarnya milik jalur lain.
 *
 * ## Catatan urutan impor
 *
 * Seluruh impor berada di atas kelas. `@Controller` menulis `design:paramtypes`
 * pada saat kelas didefinisikan; impor yang diletakkan di bawahnya membuat
 * Nest membaca `undefined` sebagai tipe dependensi, dan galatnya baru muncul
 * saat modul dimuat — bukan saat dikompilasi.
 */

import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PesantrenRegistrationService } from './pesantren-registration.service';
import { Public, RequestContext, RequestMeta } from '../../common/decorators';

class PendaftaranPesantrenDto {
  @ApiProperty({ example: 'Pondok Pesantren Raudlatul Ulum' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  namaPondok!: string;

  @ApiProperty({ example: 'raudlatul-ulum', description: 'Menjadi <slug>.santri.info' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  slugSitus!: string;

  @ApiProperty({ example: 'raudlatul_ulum', description: 'Menjadi nama schema' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  desiredUsername!: string;

  @ApiProperty({ example: 'admin@raudlatul-ulum.sch.id' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ enum: ['SALAFIYAH', 'KHALAFIYAH', 'KOMBINASI'] })
  @IsString()
  tipePesantren!: string;

  @ApiProperty({ enum: ['PUTRA', 'PUTRI', 'PUTRA_PUTRI'] })
  @IsString()
  santriDilayani!: string;

  @ApiProperty({ example: ['DINIYAH_TAKMILIYAH', 'TAHFIZ'], type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  // Batas atas ada supaya kiriman tidak dapat membawa larik sepanjang apa pun.
  // Katalognya sendiri hanya sepuluh entri.
  @ArrayMaxSize(32)
  @IsString({ each: true })
  @MaxLength(48, { each: true })
  jenjang!: string[];

  @ApiPropertyOptional({ example: '512345670001' })
  @IsOptional() @IsString() @MaxLength(32)
  nomorStatistik?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64)
  nomorIzinOperasional?: string;

  @ApiPropertyOptional({ example: '2015-06-01' })
  @IsOptional() @IsString() @MaxLength(32)
  tanggalIzin?: string;

  @ApiPropertyOptional({ example: 1975 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1200) @Max(2100)
  tahunBerdiri?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  namaYayasan?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128)
  aktaYayasan?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  namaPengasuh?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64)
  afiliasi?: string;

  @ApiPropertyOptional({ example: 450 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000)
  jumlahSantriMukim?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000)
  jumlahSantriNonmukim?: number;

  @ApiPropertyOptional({ example: 38 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000)
  jumlahUstaz?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  provinsi?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  kabupatenKota?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  kecamatan?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128)
  desaKelurahan?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  alamat?: string;

  @ApiPropertyOptional({ example: '61152' })
  @IsOptional() @IsString() @MaxLength(16)
  kodePos?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  penanggungJawab?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  teleponPenanggungJawab?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  teleponPondok?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32)
  whatsapp?: string;

  @ApiPropertyOptional({ example: 'https://raudlatul-ulum.sch.id' })
  @IsOptional() @IsString() @MaxLength(255)
  situsWeb?: string;

  @ApiProperty() @IsBoolean()
  acceptTerms!: boolean;

  @ApiProperty() @IsBoolean()
  acceptPrivacy!: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  includeSampleData?: boolean;

  /*
   * Sengaja TIDAK ada `generatePassword` maupun `password`.
   *
   * Pada jalur ini kata sandi selalu dibuat peladen. Menerima keduanya dari
   * kiriman berarti pendaftar dapat memilih kata sandinya sendiri lewat
   * permintaan langsung, melewati formulir yang tidak pernah menawarkannya.
   */
}

@ApiTags('public')
@Controller('public/pesantren')
export class PesantrenRegistrationController {
  constructor(private readonly pesantren: PesantrenRegistrationService) {}

  @Public()
  @Get('registration-config')
  @ApiOperation({ summary: 'Pilihan yang ditawarkan formulir pendaftaran pesantren' })
  config() {
    return this.pesantren.getConfig();
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get('site-slug/check')
  @ApiOperation({ summary: 'Cek ketersediaan alamat situs <slug>.santri.info' })
  cekSlug(@Query('slug') slug: string) {
    return this.pesantren.cekSlugSitus(slug ?? '');
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get('site-slug/suggest')
  @ApiOperation({ summary: 'Usulan alamat situs dan nama pengguna dari nama pondok' })
  usulkan(@Query('nama') nama: string) {
    return this.pesantren.usulkan(nama ?? '');
  }

  @Public()
  // Batasnya lebih ketat daripada pendaftaran umum. Setiap kiriman yang lolos
  // membuat schema, pengguna, dan host — tiga hal yang tidak murah dibersihkan.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('registrations')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Pendaftaran pondok pesantren',
    description:
      'Membuat penyewa, schema, akun pengurus, dan situs <slug>.santri.info. ' +
      'Kata sandi selalu dibuat peladen dan hanya ditampilkan sekali pada response ini.',
  })
  register(@Body() dto: PendaftaranPesantrenDto, @RequestContext() meta: RequestMeta) {
    return this.pesantren.register(dto, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
  }
}
