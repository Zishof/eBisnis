/**
 * Endpoint adapter protokol alat: penerimaan pesan dan pemetaan istilah.
 *
 * Pemisahan yang menentukan bentuknya:
 *
 * ```
 * MESSAGE.CREATE menerima pesan  ≠  CODE_MAP.CREATE memetakan kodenya
 * ```
 *
 * Pemetaan kode menentukan angka mana yang tersimpan pada baris mana. Kode "K"
 * yang dipetakan ke kalium alih-alih kreatinin menghasilkan hasil laboratorium
 * yang tampak sempurna dan salah seluruhnya, dan kekeliruannya tidak akan
 * terlihat siapa pun sampai seseorang diberi obat berdasarkan angka itu.
 *
 * Tajuk tujuan penggunaan sengaja TIDAK dituntut pada penerimaan pesan. Pesan
 * masuk dari gateway, bukan dari manusia yang sedang membaca rekam medis
 * seseorang — dan tajuk yang dituntut dari mesin akan diisi dengan nilai tetap
 * pada berkas konfigurasi, yang justru merusak maknanya pada jalur yang
 * benar-benar membutuhkannya.
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthDeviceAdapterService } from './health-device-adapter.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import { PROTOKOL_ADAPTER } from './health-device-adapter';

const PROTOKOL = Object.keys(PROTOKOL_ADAPTER);

function requireSchema(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(
      ErrorCodes.FORBIDDEN,
      'Akun ini tidak terikat pada satu ruang kerja tenant.',
    );
  }
  return user.schemaName;
}

class PesanDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gatewayId?: string;

  @ApiProperty({ enum: PROTOKOL })
  @IsIn(PROTOKOL)
  sourceProtocol!: string;

  @ApiProperty({ description: 'Pesan asli apa adanya. Disimpan tanpa diubah.' })
  @IsString()
  @MinLength(1)
  @MaxLength(65536)
  rawMessage!: string;
}

class UraiDto {
  @ApiProperty({ enum: PROTOKOL })
  @IsIn(PROTOKOL)
  sourceProtocol!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(65536)
  rawMessage!: string;
}

class PemetaanDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional({ description: 'Kosongkan untuk pemetaan tingkat fasilitas.' })
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  deviceCode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  localCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  deviceUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  localUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

@ApiTags('eMedik — Adapter Protokol Alat')
@Controller('health/device-adapter')
export class HealthDeviceAdapterController {
  constructor(
    private readonly adapter: HealthDeviceAdapterService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_MESSAGE.READ')
  @Get('protocols')
  @ApiOperation({
    summary: 'Protokol beserta kesiapan adapternya',
    description:
      'Membedakan "boleh dipakai alat" dari "punya pengurai di sini". Yang terhalang ' +
      'menyebutkan penghalangnya.',
  })
  protokol() {
    return this.adapter.daftarProtokol();
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_MESSAGE.CREATE')
  @Post('messages')
  @ApiOperation({
    summary: 'Menerima pesan dari gateway',
    description:
      'Pesan disimpan APA ADANYA lebih dahulu, diurai kemudian. Yang gagal diurai TETAP ' +
      'tersimpan beserta sebabnya — pesan cacat yang dibuang menghilangkan satu-satunya ' +
      'petunjuk tentang alat yang firmware-nya baru diperbarui.',
  })
  async terima(@Body() dto: PesanDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.adapter.terimaPesan(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_MESSAGE.READ')
  @Post('parse')
  @ApiOperation({
    summary: 'Menguraikan pesan tanpa menyimpannya',
    description: 'Untuk memeriksa bentuk pesan sebelum alatnya dipasang.',
  })
  urai(@Body() dto: UraiDto) {
    return this.adapter.uraiSaja(dto);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_MESSAGE.READ')
  @Get('messages')
  @ApiOperation({ summary: 'Daftar pesan masuk' })
  daftar(
    @Query('facilityId') facilityId: string,
    @Query('failedOnly') failedOnly: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.adapter.daftarPesan(requireSchema(user), {
      facilityId,
      failedOnly: failedOnly === 'true',
    });
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_MESSAGE.READ')
  @Get('messages/:id')
  @ApiOperation({
    summary: 'Membaca pesan asli apa adanya',
    description:
      'Inilah yang dibuka ketika hasilnya dipersengketakan. Sidik jarinya menjawab pertanyaan ' +
      'apakah yang tersimpan sama dengan yang dikirim alat.',
  })
  baca(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.adapter.bacaPesan(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_CODE_MAP.CREATE')
  @Post('code-map')
  @ApiOperation({
    summary: 'Memetakan kode alat ke kode lokal',
    description:
      'Sengaja BUKAN hak teknisi. Kode "K" yang dipetakan ke kalium alih-alih kreatinin ' +
      'menghasilkan hasil yang tampak sempurna dan salah seluruhnya.',
  })
  async petakan(@Body() dto: PemetaanDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.adapter.petakan(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_CODE_MAP.UPDATE')
  @Post('code-map/:id/deactivate')
  @ApiOperation({
    summary: 'Menonaktifkan pemetaan',
    description: 'Barisnya tetap tersimpan sebagai riwayat, tidak dihapus.',
  })
  async nonaktif(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.adapter.nonaktifkanPemetaan(schema, id, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_CODE_MAP.READ')
  @Get('code-map')
  @ApiOperation({ summary: 'Daftar pemetaan kode' })
  daftarPeta(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.adapter.daftarPemetaan(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DEVICE_CODE_MAP.READ')
  @Get('code-map/pending')
  @ApiOperation({
    summary: 'Antrean kode yang belum terpeta',
    description:
      'Terurut menurut yang paling sering muncul. Kode yang muncul tiga ratus kali sehari ' +
      'menahan tiga ratus hasil; kode yang muncul sekali mungkin salah ketik pada alatnya.',
  })
  antrean(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.adapter.antreanPemetaan(requireSchema(user), facilityId);
  }
}
