/**
 * Endpoint tarif JKN berversi dan cakupan penjamin.
 *
 * Pemisahannya: **yang mengimpor tarif tidak menyetujuinya.**
 * `HEALTH_TARIFF.IMPORT` mengimpor; `HEALTH_TARIFF.APPROVE` menyetujui dan
 * mengaktifkan. Menyatukan keduanya berarti satu orang dapat mengubah seluruh
 * tagihan rumah sakit tanpa ada pihak kedua yang pernah melihatnya.
 *
 * Tidak ada tajuk tujuan penggunaan di sini: tarif bukan data pasien. Yang
 * memakai tarif untuk menghitung tagihan seorang pasien tertentu berada di
 * modul lain, dan di sana tajuknya wajib.
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthTariffService } from './health-tariff.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import type {
  JenisPenjamin,
  KelasFasilitas,
  KelasLayanan,
  MetodePembayaran,
} from './health-tariff';

const METODE = ['CAPITATION', 'NON_CAPITATION', 'INA_CBG', 'NON_INA_CBG', 'FEE_FOR_SERVICE'];
const KELAS_FASILITAS = ['FKTP', 'A', 'B', 'C', 'D'];
const KELAS_LAYANAN = ['KRIS', 'CLASS_1', 'CLASS_2', 'CLASS_3', 'VIP', 'VVIP'];
const PENJAMIN = ['BPJS', 'INSURER', 'CORPORATE', 'SELF_PAY', 'GOVERNMENT_PROGRAM'];
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

// --- DTO ---------------------------------------------------------------------

class PeraturanDto {
  @ApiProperty({ example: 'PMK 3/2026' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reference!: string;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  @Max(2200)
  year!: number;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  title!: string;

  @ApiProperty({ enum: ['FKTP', 'FKRTL', 'BOTH'] })
  @IsIn(['FKTP', 'FKRTL', 'BOTH'])
  scope!: 'FKTP' | 'FKRTL' | 'BOTH';

  @ApiProperty({ example: '2026-01-01' })
  @Matches(TANGGAL, { message: 'Tanggal harus berbentuk YYYY-MM-DD.' })
  effectiveFrom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  revokesReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceFile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sourceHash?: string;
}

class VersiDto {
  @ApiProperty({ example: 'INA-CBG-2026' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'Peraturan yang menjadi dasarnya. Wajib sebelum aktivasi.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  regulationReference?: string;

  @ApiPropertyOptional({ description: 'Berkas sumber. Wajib sebelum aktivasi.' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceFile?: string;

  @ApiPropertyOptional({ description: 'Sidik jari berkas sumber. Wajib sebelum aktivasi.' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sourceHash?: string;
}

class BarisTarifDto {
  @ApiProperty({ enum: METODE })
  @IsIn(METODE)
  paymentMethod!: MetodePembayaran;

  @ApiProperty()
  @IsString()
  @MaxLength(24)
  regionCode!: string;

  @ApiProperty({ enum: KELAS_FASILITAS })
  @IsIn(KELAS_FASILITAS)
  facilityClass!: KelasFasilitas;

  @ApiPropertyOptional({ enum: KELAS_LAYANAN, description: 'Kosong berarti berlaku bagi semua.' })
  @IsOptional()
  @IsIn(KELAS_LAYANAN)
  serviceClass?: KelasLayanan;

  @ApiPropertyOptional({ description: 'Kosong berarti berlaku bagi semua.' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  casemixGroup?: string;

  @ApiPropertyOptional({ description: 'Kosong berarti berlaku bagi semua.' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  casemixSeverity?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ example: '2026-01-01' })
  @Matches(TANGGAL, { message: 'Tanggal harus berbentuk YYYY-MM-DD.' })
  effectiveFrom!: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(TANGGAL, { message: 'Tanggal harus berbentuk YYYY-MM-DD.' })
  effectiveTo?: string;
}

class ImporDto {
  @ApiProperty({ type: [BarisTarifDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => BarisTarifDto)
  rows!: BarisTarifDto[];
}

class SetujuiDto {
  @ApiProperty({ description: 'Apa yang diperiksa sebelum menyetujui.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  note!: string;
}

class PenjaminDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ enum: PENJAMIN })
  @IsIn(PENJAMIN)
  payerType!: JenisPenjamin;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  payerName!: string;

  @ApiPropertyOptional({ description: 'Wajib bagi penjamin selain pasien sendiri.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contractReference?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  coveragePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  ceilingAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  deductibleAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresReferral?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresPreAuthorization?: boolean;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @Matches(TANGGAL, { message: 'Tanggal harus berbentuk YYYY-MM-DD.' })
  effectiveFrom?: string;
}

class HitungBagianDto {
  @ApiProperty()
  @IsUUID()
  coverageId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasValidReferral?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasPreAuthorization?: boolean;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Tarif dan Penjamin')
@Controller('health/tariff')
export class HealthTariffController {
  constructor(
    private readonly tarif: HealthTariffService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  // --- Peraturan -------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_TARIFF.IMPORT')
  @Post('regulations')
  @ApiOperation({
    summary: 'Mencatat peraturan yang menjadi dasar tarif',
    description:
      'Inventaris yang kosong lebih baik daripada inventaris yang berisi nomor peraturan hasil ' +
      'ingatan. Nomor yang keliru akan disalin ke dokumen klaim, dan dokumen klaim yang menyebut ' +
      'peraturan yang tidak berlaku akan dikembalikan.',
  })
  async catatPeraturan(@Body() dto: PeraturanDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.tarif.catatPeraturan(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_TARIFF.READ')
  @Get('regulations')
  @ApiOperation({ summary: 'Inventaris peraturan' })
  daftarPeraturan(@CurrentUser() user: AuthenticatedUser) {
    return this.tarif.daftarPeraturan(requireSchema(user));
  }

  // --- Versi -----------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_TARIFF.IMPORT')
  @Post('versions')
  @ApiOperation({
    summary: 'Membuat versi tarif baru',
    description:
      'Impor tidak menimpa. Versi lama tetap ada supaya klaim tahun lalu dapat dijelaskan ' +
      'dengan tarif tahun lalu.',
  })
  async buatVersi(@Body() dto: VersiDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.tarif.buatVersi(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_TARIFF.IMPORT')
  @Post('versions/:id/rows')
  @ApiOperation({
    summary: 'Mengimpor baris tarif',
    description:
      'Menolak SELURUHNYA bila ada satu baris yang bertumpang tindih. Impor separuh ' +
      'menghasilkan versi yang tampak lengkap dan sebenarnya bolong.',
  })
  impor(@Param('id') id: string, @Body() dto: ImporDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tarif.imporBaris(requireSchema(user), id, dto.rows);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_TARIFF.APPROVE')
  @Post('versions/:id/approve')
  @ApiOperation({
    summary: 'Menyetujui dan mengaktifkan versi tarif',
    description:
      'Yang mengimpor tidak menyetujuinya sendiri. Aktivasi menuntut dasar peraturan, berkas ' +
      'sumber, sidik jarinya, dan isi yang tidak kosong.',
  })
  async setujui(
    @Param('id') id: string,
    @Body() dto: SetujuiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.tarif.aktifkanVersi(schema, id, dto.note, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_TARIFF.READ')
  @Get('versions')
  @ApiOperation({ summary: 'Daftar versi tarif' })
  daftarVersi(@CurrentUser() user: AuthenticatedUser) {
    return this.tarif.daftarVersi(requireSchema(user));
  }

  // --- Pencarian tarif -------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_TARIFF.READ')
  @Get('lookup')
  @ApiOperation({
    summary: 'Mencari tarif yang berlaku bagi satu kunci',
    description:
      'Menurut TANGGAL LAYANAN, bukan tanggal klaim. Tarif yang belum tersedia TIDAK ditaksir: ' +
      'jawabannya "belum tersedia" dan perhitungannya berhenti.',
  })
  cari(
    @Query('paymentMethod') paymentMethod: string,
    @Query('regionCode') regionCode: string,
    @Query('facilityClass') facilityClass: string,
    @Query('serviceDate') serviceDate: string,
    @Query('serviceClass') serviceClass: string | undefined,
    @Query('casemixGroup') casemixGroup: string | undefined,
    @Query('casemixSeverity') casemixSeverity: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!METODE.includes(paymentMethod)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Parameter paymentMethod wajib salah satu dari: ${METODE.join(', ')}.`,
      );
    }
    if (!KELAS_FASILITAS.includes(facilityClass)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Parameter facilityClass wajib salah satu dari: ${KELAS_FASILITAS.join(', ')}.`,
      );
    }
    if (!regionCode) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter regionCode wajib diisi.');
    }
    if (!TANGGAL.test(serviceDate ?? '')) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Parameter serviceDate wajib berbentuk YYYY-MM-DD. Tarif dipilih menurut tanggal ' +
          'layanan, bukan tanggal hari ini.',
      );
    }

    return this.tarif.cariTarif(requireSchema(user), {
      paymentMethod: paymentMethod as MetodePembayaran,
      regionCode,
      facilityClass: facilityClass as KelasFasilitas,
      serviceClass: (serviceClass as KelasLayanan) ?? null,
      casemixGroup: casemixGroup ?? null,
      casemixSeverity: casemixSeverity ?? null,
      serviceDate,
    });
  }

  // --- Penjamin --------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PAYER.CREATE')
  @Post('payers')
  @ApiOperation({
    summary: 'Mencatat cakupan penjamin',
    description:
      'Penjamin selain pasien sendiri wajib menyebut kontraknya. Tanggungan tanpa kontrak yang ' +
      'tercatat tidak dapat ditagihkan kepada siapa pun.',
  })
  async catatPenjamin(@Body() dto: PenjaminDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.tarif.catatPenjamin(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PAYER.READ')
  @Get('payers')
  @ApiOperation({ summary: 'Daftar cakupan penjamin' })
  daftarPenjamin(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.tarif.daftarPenjamin(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PAYER.READ')
  @Post('payers/split')
  @ApiOperation({
    summary: 'Menghitung bagian penjamin dan bagian pasien',
    description:
      'Pembulatannya MEMIHAK PASIEN: sisa satu rupiah menjadi tanggungan penjamin. Rujukan ' +
      'atau persetujuan awal yang belum ada menahan tanggungan SEMENTARA, bukan selamanya.',
  })
  hitung(@Body() dto: HitungBagianDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tarif.hitungBagian(requireSchema(user), dto);
  }
}
