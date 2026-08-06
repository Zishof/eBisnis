/**
 * Titik masuk HTTP pendaftaran properti hospitality (MI-3).
 *
 * Berkas tersendiri, pola sama dengan `pesantren-registration.controller.ts`
 * -- lihat catatan urutan impor di sana, berlaku sama di sini.
 */

import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { HospitalityRegistrationService } from './hospitality-registration.service';
import { Public, RequestContext, RequestMeta } from '../../common/decorators';

class PendaftaranHospitalityDto {
  @ApiProperty({ example: 'Grand Sun Hotel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  namaProperti!: string;

  @ApiProperty({ example: 'grand-sun-hotel', description: 'Menjadi <slug>.mitrainap.id' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  slugSitus!: string;

  @ApiProperty({ example: 'grand_sun_hotel', description: 'Menjadi nama schema' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  desiredUsername!: string;

  @ApiProperty({ example: 'owner@grandsunhotel.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32)
  teleponPenanggungJawab?: string;

  @ApiProperty() @IsBoolean()
  acceptTerms!: boolean;

  @ApiProperty() @IsBoolean()
  acceptPrivacy!: boolean;

  /*
   * Sengaja TIDAK ada `generatePassword` maupun `password` -- pola sama
   * dengan pendaftaran pesantren, alasannya sama persis.
   */
}

@ApiTags('public')
@Controller('public/hospitality')
export class HospitalityRegistrationController {
  constructor(private readonly hospitality: HospitalityRegistrationService) {}

  @Public()
  @Get('registration-config')
  @ApiOperation({ summary: 'Pilihan yang ditawarkan formulir pendaftaran properti' })
  config() {
    return this.hospitality.getConfig();
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get('site-slug/check')
  @ApiOperation({ summary: 'Cek ketersediaan alamat situs <slug>.mitrainap.id' })
  cekSlug(@Query('slug') slug: string) {
    return this.hospitality.cekSlugSitus(slug ?? '');
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get('site-slug/suggest')
  @ApiOperation({ summary: 'Usulan alamat situs dan nama pengguna dari nama properti' })
  usulkan(@Query('nama') nama: string) {
    return this.hospitality.usulkan(nama ?? '');
  }

  @Public()
  // Batasnya lebih ketat daripada pendaftaran umum -- pola sama dengan
  // pendaftaran pesantren, alasannya sama persis (schema, pengguna, dan
  // host tidak murah dibersihkan).
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('registrations')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Pendaftaran properti hospitality',
    description:
      'Membuat penyewa, schema, akun pemilik, dan situs <slug>.mitrainap.id. ' +
      'Kata sandi selalu dibuat peladen dan hanya ditampilkan sekali pada response ini.',
  })
  register(@Body() dto: PendaftaranHospitalityDto, @RequestContext() meta: RequestMeta) {
    return this.hospitality.register(dto, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
  }
}
