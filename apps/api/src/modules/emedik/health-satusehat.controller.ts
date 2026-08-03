/**
 * Endpoint kerangka SATUSEHAT.
 *
 * Pemisahan yang menentukan bentuknya:
 *
 * ```
 * SATUSEHAT.ACTIVATE menyalakan lingkungan
 *   ≠  SATUSEHAT_CAPABILITY.VERIFY menyatakan kemampuannya bekerja
 * ```
 *
 * Dan satu hal yang harus dibaca sebagai fitur, bukan kekurangan: **tidak ada
 * satu pun jalan di sini yang benar-benar mengirimkan data ke SATUSEHAT.**
 * `POST /transmissions` menyiapkan, memeriksa gerbangnya, mencatat
 * percobaannya, dan **menolak** — sebab payload FHIR-nya memang belum dapat
 * disusun tanpa dokumentasi profil berversi.
 *
 * Perintah R2 §5: *"Jangan mengarang endpoint/payload."*
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthSatusehatService } from './health-satusehat.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import {
  KEMAMPUAN_SATUSEHAT,
  SYARAT_VERIFIKASI,
  type StatusKemampuan,
} from './health-satusehat';

const STATUS = ['BLOCKED', 'DOCUMENTED', 'SANDBOX_TESTED', 'VERIFIED'];
const SUMBER_DAYA = KEMAMPUAN_SATUSEHAT.map((k) => k.resource);
const KODE_SYARAT = SYARAT_VERIFIKASI.map((s) => s.kode);

function requireSchema(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(
      ErrorCodes.FORBIDDEN,
      'Akun ini tidak terikat pada satu ruang kerja tenant.',
    );
  }
  return user.schemaName;
}

class LingkunganDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ enum: ['SANDBOX', 'PRODUCTION'] })
  @IsIn(['SANDBOX', 'PRODUCTION'])
  environment!: 'SANDBOX' | 'PRODUCTION';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  baseUrl?: string;

  @ApiPropertyOptional({
    description:
      'RUJUKAN ke brankas, misalnya vault://satusehat/1. Bukan nilainya — kredensial sistem ' +
      'nasional yang bocor membuka jalan mengirimkan data ATAS NAMA fasilitas ini.',
  })
  @IsOptional()
  @Matches(/^(vault|secret|kms):\/\//)
  @MaxLength(255)
  credentialSecretRef?: string;

  @ApiPropertyOptional({ description: 'Selalu DITOLAK. Ada supaya penolakannya jelas.' })
  @IsOptional()
  @IsString()
  credentialRawValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

class StatusKemampuanDto {
  @ApiProperty({ enum: STATUS })
  @IsIn(STATUS)
  status!: StatusKemampuan;

  @ApiPropertyOptional({
    isArray: true,
    enum: KODE_SYARAT,
    description: 'Keenamnya wajib untuk VERIFIED.',
  })
  @IsOptional()
  @IsArray()
  @IsIn(KODE_SYARAT, { each: true })
  evidenceCodes?: string[];

  @ApiPropertyOptional({ description: 'Wajib sekurangnya 20 huruf untuk VERIFIED.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;
}

class PengirimanDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ enum: SUMBER_DAYA })
  @IsIn(SUMBER_DAYA)
  resourceType!: string;

  @ApiProperty()
  @IsUUID()
  localId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  localVersion?: number;
}

@ApiTags('eMedik — SATUSEHAT')
@Controller('health/satusehat')
export class HealthSatusehatController {
  constructor(
    private readonly satusehat: HealthSatusehatService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SATUSEHAT.READ')
  @Get('catalog')
  @ApiOperation({
    summary: 'Matriks kemampuan beserta penghalang dan sumber datanya',
    description:
      'Seluruhnya BLOCKED, dan itu keadaan yang sesungguhnya. Kolom sumber lokal menyatakan ' +
      'bahwa datanya sudah ada di sisi kami — penghalangnya hanya pada lapisan pertukaran.',
  })
  katalog() {
    return this.satusehat.katalog();
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SATUSEHAT.MANAGE_CREDENTIAL')
  @Post('environments')
  @ApiOperation({
    summary: 'Mendaftarkan lingkungan SATUSEHAT',
    description:
      'Kredensial disimpan sebagai RUJUKAN ke brankas, tidak pernah sebagai nilai. Lingkungan ' +
      'yang terdaftar TIDAK aktif, dan lingkungan yang aktif pun tidak membuka pengiriman.',
  })
  async daftarkan(@Body() dto: LingkunganDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.satusehat.daftarkanLingkungan(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SATUSEHAT.ACTIVATE')
  @Post('environments/:id/activate')
  @ApiOperation({
    summary: 'Mengaktifkan lingkungan',
    description:
      'Satu lingkungan aktif per fasilitas: dua yang aktif berarti tidak ada yang tahu ke mana ' +
      'data pasien dikirimkan. Mengaktifkan TIDAK membuka pengiriman.',
  })
  async aktifkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.satusehat.aktifkanLingkungan(schema, id, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SATUSEHAT.READ')
  @Get('environments')
  @ApiOperation({
    summary: 'Daftar lingkungan',
    description: 'Rujukan kredensialnya TIDAK ikut dikembalikan; hanya keterangan bahwa ia ada.',
  })
  daftarLingkungan(
    @Query('facilityId') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.satusehat.daftarLingkungan(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SATUSEHAT_CAPABILITY.READ')
  @Get('capabilities')
  @ApiOperation({ summary: 'Status kemampuan per sumber daya FHIR' })
  kemampuan(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.satusehat.daftarKemampuan(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SATUSEHAT_CAPABILITY.VERIFY')
  @Post('capabilities/:id/status')
  @ApiOperation({
    summary: 'Mengubah status kemampuan',
    description:
      'Sengaja BUKAN hak administrator yang memasang kredensial. Kenaikan tidak boleh melompat, ' +
      'dan VERIFIED menuntut keenam buktinya beserta keterangannya.',
  })
  async ubahStatus(
    @Param('id') id: string,
    @Body() dto: StatusKemampuanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.satusehat.ubahStatusKemampuan(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SATUSEHAT.CREATE')
  @Post('transmissions')
  @ApiOperation({
    summary: 'Menyiapkan pengiriman satu sumber daya',
    description:
      'TIDAK MENGIRIM APA PUN, dan itu bukan kekurangan melainkan yang diminta perintah R2 §5. ' +
      'Ia memeriksa gerbangnya, mencatat percobaannya, dan menolak — sebab payload FHIR-nya ' +
      'belum dapat disusun tanpa dokumentasi profil berversi. Percobaan yang tertahan gerbang ' +
      'pun dicatat: ia menunjukkan bahwa seseorang mencoba, dan kapan.',
  })
  async kirim(@Body() dto: PengirimanDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.satusehat.siapkanPengiriman(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SATUSEHAT.READ')
  @Get('transmissions')
  @ApiOperation({ summary: 'Jejak percobaan pengiriman' })
  jejak(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.satusehat.jejakPengiriman(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_SATUSEHAT.READ')
  @Get('reconciliation')
  @ApiOperation({
    summary: 'Rekonsiliasi kirim vs diterima',
    description:
      'Tanpa ini, "sudah dikirim" hanya berarti "sudah kami coba" — dan perbedaan antara ' +
      'keduanya baru terlihat ketika ada yang menanyakan data yang seharusnya ada di sana.',
  })
  rekonsiliasi(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.satusehat.rekonsiliasiPengiriman(requireSchema(user), facilityId);
  }
}
