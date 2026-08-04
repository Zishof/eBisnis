/**
 * Endpoint kerangka BPJS/JKN.
 *
 * Menu BPJS sengaja terpisah dari menu SATUSEHAT. Keduanya konteks terbatas
 * yang berbeda: kredensialnya berbeda, siklus hidupnya berbeda, dan
 * kegagalannya berbeda. Petugas yang mengurus klaim tidak perlu — dan tidak
 * boleh — memegang kredensial pertukaran data klinis.
 *
 * Dan sama seperti H-9A: **tidak ada satu pun jalan di sini yang benar-benar
 * memanggil BPJS.** `POST /adapters/:code/call` memeriksa gerbangnya dan
 * menolak, beserta penjelasan tentang apa yang **masih dapat dikerjakan** tanpa
 * adapter itu — sebab hampir seluruh siklus klaim di dalam rumah sakit memang
 * tidak menuntutnya.
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthBpjsService } from './health-bpjs.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import { ADAPTER_BPJS, type StatusAdapter } from './health-bpjs';

const ADAPTER = ADAPTER_BPJS.map((a) => a.kode);
const STATUS = ['BLOCKED', 'CONFIGURED', 'SANDBOX_TESTED', 'VERIFIED'];
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

function requireSchema(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(
      ErrorCodes.FORBIDDEN,
      'Akun ini tidak terikat pada satu ruang kerja tenant.',
    );
  }
  return user.schemaName;
}

class AkunDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  providerCode!: string;

  @ApiProperty({ enum: ['FKTP', 'FKRTL'] })
  @IsIn(['FKTP', 'FKRTL'])
  serviceLevel!: 'FKTP' | 'FKRTL';

  @ApiPropertyOptional({ enum: ['SANDBOX', 'PRODUCTION'] })
  @IsOptional()
  @IsIn(['SANDBOX', 'PRODUCTION'])
  environment?: 'SANDBOX' | 'PRODUCTION';

  @ApiPropertyOptional({ description: 'RUJUKAN ke brankas. Bukan nilainya.' })
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

class StatusAdapterDto {
  @ApiProperty({ enum: STATUS })
  @IsIn(STATUS)
  status!: StatusAdapter;

  @ApiPropertyOptional({ description: 'Wajib sekurangnya 20 huruf untuk VERIFIED.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;
}

class KepesertaanDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  membershipNumber?: string;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'UNKNOWN'] })
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'UNKNOWN'])
  participantStatus!: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'UNKNOWN';

  @ApiPropertyOptional({ minimum: 1, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  benefitClass?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  registeredFktp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

class SepDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiProperty({ description: 'Nomor dari BPJS. TIDAK dihasilkan di sini.' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  sepNumber!: string;

  @ApiProperty({ example: '2026-08-01' })
  @Matches(TANGGAL)
  sepDate!: string;

  @ApiProperty({ enum: ['OUTPATIENT', 'INPATIENT', 'EMERGENCY'] })
  @IsIn(['OUTPATIENT', 'INPATIENT', 'EMERGENCY'])
  serviceType!: 'OUTPATIENT' | 'INPATIENT' | 'EMERGENCY';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  referralNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(24)
  diagnosisCode?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  benefitClass?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  occupiedClass?: number;
}

class ItemKlaimDto {
  @ApiProperty({ enum: ['DRUG', 'PROCEDURE', 'DEVICE', 'ROOM', 'SERVICE', 'OTHER'] })
  @IsIn(['DRUG', 'PROCEDURE', 'DEVICE', 'ROOM', 'SERVICE', 'OTHER'])
  itemType!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  itemCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  itemName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Biaya yang sesungguhnya keluar.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualCost?: number;

  @ApiPropertyOptional({ description: 'Yang ditagihkan kepada pasien.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  patientCharge?: number;
}

@ApiTags('eMedik — BPJS/JKN')
@Controller('health/bpjs')
export class HealthBpjsController {
  constructor(
    private readonly bpjs: HealthBpjsService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BPJS.READ')
  @Get('catalog')
  @ApiOperation({
    summary: 'Matriks adapter, metode pembayaran, dan tujuan data per item',
    description:
      'Menyatakan di mana nilai penggantian resmi berada: pada tingkat PAKET, bukan pada baris ' +
      'item. INA-CBG membayar paket kasus.',
  })
  katalog() {
    return this.bpjs.katalog();
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BPJS.MANAGE_CREDENTIAL')
  @Post('accounts')
  @ApiOperation({
    summary: 'Mendaftarkan akun penyedia BPJS',
    description: 'Kredensial disimpan sebagai RUJUKAN ke brankas, tidak pernah sebagai nilai.',
  })
  async daftarkan(@Body() dto: AkunDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.bpjs.daftarkanAkun(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BPJS.ACTIVATE')
  @Post('accounts/:id/activate')
  @ApiOperation({ summary: 'Mengaktifkan akun; TIDAK membuka pemanggilan adapter' })
  async aktifkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.bpjs.aktifkanAkun(schema, id, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BPJS.READ')
  @Get('accounts')
  @ApiOperation({ summary: 'Daftar akun; rujukan kredensialnya tidak dikembalikan' })
  daftarAkun(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.bpjs.daftarAkun(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BPJS.READ')
  @Get('adapters')
  @ApiOperation({ summary: 'Status tujuh adapter beserta penghalangnya' })
  adapters(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.bpjs.daftarKemampuan(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BPJS.VERIFY')
  @Post('adapters/:id/status')
  @ApiOperation({
    summary: 'Mengubah status adapter',
    description: 'Sengaja BUKAN hak administrator yang memasang kredensial.',
  })
  async ubahStatus(
    @Param('id') id: string,
    @Body() dto: StatusAdapterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.bpjs.ubahStatusAdapter(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BPJS.READ')
  @Post('adapters/:code/call')
  @ApiOperation({
    summary: 'Memanggil adapter',
    description:
      'TIDAK MEMANGGIL APA PUN. Ia memeriksa gerbangnya dan menolak, beserta penjelasan tentang ' +
      'apa yang MASIH dapat dikerjakan tanpa adapter itu — sebab hampir seluruh siklus klaim di ' +
      'dalam rumah sakit memang tidak menuntutnya.',
  })
  panggil(
    @Param('code') code: string,
    @Query('facilityId') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    if (!ADAPTER.includes(code as (typeof ADAPTER)[number])) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Adapter "${code}" tidak ada pada matriks. Matriksnya daftar TERTUTUP.`,
      );
    }
    return this.bpjs.panggilAdapter(requireSchema(user), { facilityId, adapterCode: code });
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BPJS_ELIGIBILITY.CREATE')
  @Post('eligibility')
  @ApiOperation({
    summary: 'Mencatat kepesertaan',
    description:
      'Dicatat sebagai MANUAL — diketik petugas dari kartu peserta, bukan jawaban BPJS. ' +
      'Keduanya sah tetapi tidak sama, dan yang membedakannya adalah kolom sumbernya.',
  })
  async catat(@Body() dto: KepesertaanDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.bpjs.catatKepesertaan(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BPJS_ELIGIBILITY.READ')
  @Get('eligibility')
  @ApiOperation({
    summary: 'Membaca kepesertaan beserta status penjaminannya',
    description:
      'Pasien SELALU boleh dilayani. Yang diputuskan di sini bukan pelayanannya melainkan siapa ' +
      'yang membayar.',
  })
  baca(
    @Query('facilityId') facilityId: string,
    @Query('patientId') patientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId || !patientId) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Parameter facilityId dan patientId wajib diisi.',
      );
    }
    return this.bpjs.bacaKepesertaan(requireSchema(user), facilityId, patientId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BPJS_SEP.CREATE')
  @Post('sep')
  @ApiOperation({
    summary: 'Mencatat SEP',
    description:
      'Nomornya dari BPJS; catatannya milik kami. Nomor TIDAK dihasilkan di sini — kami tidak ' +
      'punya wewenang menerbitkannya.',
  })
  async catatSep(@Body() dto: SepDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.bpjs.catatSep(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BPJS_SEP.READ')
  @Get('sep')
  @ApiOperation({ summary: 'Daftar SEP' })
  daftarSep(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.bpjs.daftarSep(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BPJS.UPDATE')
  @Post('claims/:id/items')
  @ApiOperation({
    summary: 'Menambahkan baris item klaim',
    description:
      'MENOLAK masukan yang memuat nilai penggantian BPJS per item. Tabelnya memang tidak punya ' +
      'kolomnya, tetapi penolakan di sini menjelaskan ALASANNYA — dan alasan itulah yang ' +
      'mencegah orang berikutnya menambahkan kolomnya.',
  })
  tambahItem(
    @Param('id') id: string,
    @Body() dto: ItemKlaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    /*
     * Tiga lapis, dan ketiganya disengaja.
     *
     * 1. ValidationPipe global berjalan dengan `forbidNonWhitelisted`, sehingga
     *    permintaan HTTP yang membawa `bpjsReimbursement` ditolak 400 SEBELUM
     *    sampai ke sini. Inilah lapis pertama, dan ia yang paling sering
     *    berbunyi.
     *
     * 2. Pemeriksaan pada layanan tetap ada, dan ia BUKAN mubazir: pemanggil
     *    dari dalam proses — naskah penyemaian, pekerjaan latar, migrasi data —
     *    tidak melewati ValidationPipe sama sekali. Lapis inilah yang
     *    menjelaskan ALASANNYA, dan alasan itulah yang mencegah orang
     *    berikutnya menambahkan kolomnya.
     *
     * 3. Tabelnya memang tidak punya kolomnya. Yang ini tidak dapat dilewati
     *    siapa pun.
     */
    return this.bpjs.tambahItemKlaim(requireSchema(user), id, { ...dto });
  }
}
