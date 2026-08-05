/**
 * Endpoint farmasi: resep, telaah, penyerahan, dan pemberian obat.
 *
 * Terpisah dari controller klinis karena hak aksesnya memang terpisah. Yang
 * meresepkan bukan yang menyerahkan, dan yang menyerahkan bukan yang memberikan
 * — pemisahan itu harus terlihat pada daftar hak akses, bukan hanya di dalam
 * kepala orang yang membaca kodenya.
 */

import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { TenantPermissionService } from '../auth/tenant-permission.service';
import { HealthPharmacyService } from './health-pharmacy.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import { PosSaleService } from '../pos/pos-sale.service';
import type { KonteksAkses } from './health-patient.service';
import type { PurposeOfUse } from './ports';

const TUJUAN: PurposeOfUse[] = [
  'TREATMENT',
  'PAYMENT',
  'OPERATIONS',
  'QUALITY',
  'RESEARCH',
  'PATIENT_REQUEST',
  'LEGAL',
  'EMERGENCY',
];

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

class BarisResepDto {
  @ApiProperty()
  @IsUUID()
  drugId!: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0.0001)
  doseValue!: number;

  @ApiProperty({ example: 'mg' })
  @IsString()
  @MaxLength(24)
  doseUnit!: string;

  @ApiProperty({ example: 'ORAL' })
  @IsString()
  @MaxLength(32)
  route!: string;

  @ApiProperty({ example: '3x1' })
  @IsString()
  @MaxLength(24)
  frequencyCode!: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  frequencyPerDay?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationDays?: number;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({ example: 'tablet' })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  quantityUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instruction?: string;

  @ApiPropertyOptional({ description: 'Obat bila perlu — tanpa jadwal tetap.' })
  @IsOptional()
  @IsBoolean()
  isPrn?: boolean;

  @ApiPropertyOptional({
    description:
      'Alasan meneruskan meski ada peringatan yang menahan. Wajib bila peringatannya memblokir; ' +
      'tersimpan bersama peringatannya pada baris resep.',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  overrideReason?: string;
}

class BuatResepDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiProperty({ type: [BarisResepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BarisResepDto)
  lines!: BarisResepDto[];
}

class PeriksaObatDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty()
  @IsUUID()
  drugId!: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  doseValue!: number;

  @ApiProperty({ example: 'mg' })
  @IsString()
  @MaxLength(24)
  doseUnit!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  frequencyPerDay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  prescriptionId?: string;
}

class TelaahDto {
  @ApiProperty()
  @IsBoolean()
  approve!: boolean;

  @ApiPropertyOptional({ description: 'Wajib bila resep ditolak.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

class SerahkanDto {
  @ApiProperty()
  @IsUUID()
  prescriptionLineId!: string;

  @ApiProperty({ example: 15 })
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  lotId?: string;

  @ApiPropertyOptional({ description: 'Obat pengganti bila berbeda dari yang diresepkan.' })
  @IsOptional()
  @IsUUID()
  dispensedDrugId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  substitutionReason?: string;

  @ApiPropertyOptional({ description: 'Wajib bagi obat terkendali dan obat berisiko tinggi.' })
  @IsOptional()
  @IsUUID()
  doubleCheckedBy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiProperty({ description: 'Mencegah stok berkurang dua kali bila permintaannya terulang.' })
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  idempotencyKey!: string;
}

class BerikanDto {
  @ApiProperty()
  @IsUUID()
  administrationId!: string;

  @ApiPropertyOptional({ description: 'Hasil pemindaian gelang pasien.' })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  scanPatientId?: string;

  @ApiPropertyOptional({ description: 'Hasil pemindaian label obat.' })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  scanDrugId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  doseValue!: number;

  @ApiProperty({ example: 'ORAL' })
  @IsString()
  @MaxLength(32)
  route!: string;

  @ApiPropertyOptional({ description: 'Saksi. Tidak boleh sama dengan pemberi obat.' })
  @IsOptional()
  @IsUUID()
  witnessedBy?: string;

  @ApiPropertyOptional({ description: 'Sisa yang dibuang, untuk obat terkendali.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  wastedAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

class LewatiDto {
  @ApiProperty()
  @IsUUID()
  administrationId!: string;

  @ApiProperty({ enum: ['OMITTED', 'REFUSED', 'HELD'] })
  @IsIn(['OMITTED', 'REFUSED', 'HELD'])
  status!: 'OMITTED' | 'REFUSED' | 'HELD';

  @ApiProperty({ description: 'Wajib. Obat yang dilewati tanpa alasan tidak dapat dibedakan dari yang terlupa.' })
  @IsString()
  @MinLength(3)
  @MaxLength(48)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

class KonteksPosApotikDto {
  @ApiProperty({ enum: ['OTC', 'PRESCRIPTION', 'COMPOUND', 'PRODUCTION'] })
  @IsIn(['OTC', 'PRESCRIPTION', 'COMPOUND', 'PRODUCTION'])
  mode!: 'OTC' | 'PRESCRIPTION' | 'COMPOUND' | 'PRODUCTION';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  prescriptionNumber?: string;

  @ApiPropertyOptional({ description: 'Nomor work order atau batch produksi.' })
  @IsOptional()
  @IsString()
  @MaxLength(96)
  referenceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  formulaName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  dosageForm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  labelInstruction?: string;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Farmasi')
@Controller('health/pharmacy')
export class HealthPharmacyController {
  constructor(
    private readonly farmasi: HealthPharmacyService,
    private readonly identity: CoreIdentityAdapter,
    private readonly izin: TenantPermissionService,
    private readonly posSale: PosSaleService,
  ) {}

  /**
   * Menyusun konteks akses dari tajuk permintaan.
   *
   * Sama dengan yang dipakai controller klinis, dan memang harus sama: jalan
   * farmasi menyentuh rekam medis yang sama, sehingga jejaknya harus terbaca
   * dengan aturan yang sama pula.
   */
  private async konteks(
    schema: string,
    user: AuthenticatedUser,
    tajuk: { purpose?: string; breakGlass?: string; reason?: string; facilityId?: string },
  ): Promise<KonteksAkses> {
    const purpose = (tajuk.purpose ?? '').toUpperCase() as PurposeOfUse;
    if (!TUJUAN.includes(purpose)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Tajuk X-Purpose-Of-Use wajib dan harus salah satu dari: ${TUJUAN.join(', ')}.`,
      );
    }

    const breakGlass = tajuk.breakGlass === 'true' || tajuk.breakGlass === '1';
    if (breakGlass) {
      if ((tajuk.reason ?? '').trim().length < 10) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Akses darurat wajib disertai tajuk X-Break-Glass-Reason sekurang-kurangnya sepuluh huruf.',
        );
      }
      const kurang = await this.izin.findMissing(
        schema,
        user.userId,
        ['HEALTH_PATIENT.BREAK_GLASS'],
        { isDemo: user.isDemo, activeRoleId: user.activeRoleId ?? null },
      );
      if (kurang.length) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Anda tidak berwenang melakukan akses darurat. Mintakan kepada dokter penanggung jawab.',
        );
      }
    }

    return {
      actorUserId: await this.identity.subjectId(schema, user.userId),
      activeRoleId: user.activeRoleId ?? null,
      purposeOfUse: purpose,
      facilityId: tajuk.facilityId ?? null,
      breakGlass,
      breakGlassReason: breakGlass ? (tajuk.reason ?? '').trim() : null,
    };
  }

  // --- Peresepan -------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PRESCRIPTION.CREATE')
  @Post('check')
  @ApiOperation({
    summary: 'Memeriksa satu calon obat sebelum diresepkan',
    description:
      'Alergi, interaksi, kewajaran dosis, terapi ganda, dan penandaan obat. Peringatan yang ' +
      'memblokir hanya yang benar-benar berbahaya — sistem yang memperingatkan segalanya sama ' +
      'tidak amannya dengan yang tidak memperingatkan apa pun, bedanya yang pertama merasa aman.',
  })
  async periksa(
    @Body() dto: PeriksaObatDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.farmasi.periksaCalonResep(schema, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  // --- Penjualan, racikan, dan produksi pada POS Apotik --------------------

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('pos-sales')
  @ApiOperation({ summary: 'Daftar transaksi POS Apotik beserta konteks farmasinya' })
  daftarTransaksiPos(
    @CurrentUser() user: AuthenticatedUser,
    @Query('mode') mode?: string,
    @Query('limit') limit?: string,
  ) {
    return this.farmasi.daftarTransaksiPos(requireSchema(user), mode, Number(limit) || 100);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.READ')
  @Get('pos-sales/:id/context')
  @ApiOperation({ summary: 'Konteks resep/racikan satu transaksi POS Apotik' })
  konteksPos(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.farmasi.konteksTransaksiPos(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Post('pos-sales/:id/context')
  @ApiOperation({ summary: 'Menyimpan konteks klinis atau produksi transaksi POS Apotik' })
  async simpanKonteksPos(
    @Param('id') id: string,
    @Body() dto: KonteksPosApotikDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.farmasi.simpanKonteksTransaksiPos(
      schema,
      id,
      dto,
      await this.identity.subjectId(schema, user.userId),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Post('pos-sales/:id/validate')
  @ApiOperation({
    summary: 'Memeriksa resep, item, formula, dan snapshot racikan sebelum menerima pembayaran',
  })
  validasiPos(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.farmasi.validasiTransaksiPos(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('POS_SALE.SELL')
  @Post('pos-sales/:id/complete')
  @ApiOperation({
    summary: 'Validasi aturan farmasi lalu selesaikan transaksi POS secara atomik',
    description:
      'Menolak obat resep tanpa resep ditelaah dan obat yang tidak tercantum pada resep. ' +
      'Pembayaran, stok, jurnal, dan struk tetap diselesaikan mesin POS.',
  })
  async selesaikanPos(
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    await this.farmasi.validasiTransaksiPos(schema, id);
    const hasil = await this.posSale.selesaikan(
      schema,
      id,
      idempotencyKey?.trim() || id,
      user,
      await this.identity.subjectId(schema, user.userId),
    );
    await this.farmasi.tandaiTransaksiPosSelesai(schema, id);
    return hasil;
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PRESCRIPTION.CREATE')
  @Post('prescriptions')
  @ApiOperation({
    summary: 'Menulis resep',
    description:
      'Peringatan yang memblokir boleh dilewati dengan alasan tertulis, dan alasannya tersimpan ' +
      'bersama peringatannya. Menolak seluruhnya akan memindahkan peresepan ke kertas — di luar ' +
      'sistem, tanpa jejak sama sekali.',
  })
  async buatResep(
    @Body() dto: BuatResepDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.farmasi.buatResep(
      schema,
      dto,
      await this.konteks(schema, user, { purpose, facilityId: dto.facilityId }),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PRESCRIPTION.READ')
  @Get('prescriptions')
  @ApiOperation({ summary: 'Antrian farmasi — resep yang menunggu telaah atau penyerahan' })
  antrian(
    @Query('facilityId') facilityId: string,
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.farmasi.antrianFarmasi(requireSchema(user), facilityId, status);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PRESCRIPTION.READ')
  @Get('prescriptions/:id')
  @ApiOperation({ summary: 'Rincian resep beserta peringatan yang pernah muncul' })
  async resep(
    @Param('id') id: string,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.farmasi.resep(schema, id, await this.konteks(schema, user, { purpose, facilityId }));
  }

  // --- Telaah apoteker -------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PRESCRIPTION.REVIEW')
  @Post('prescriptions/:id/review')
  @ApiOperation({
    summary: 'Telaah apoteker',
    description:
      'Hak akses tersendiri, dan penelaahnya tidak boleh sama dengan peresepnya. Pemeriksaan ' +
      'oleh orang kedua adalah satu-satunya penahan yang bekerja ketika dosisnya salah ketik.',
  })
  async telaah(
    @Param('id') id: string,
    @Body() dto: TelaahDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.farmasi.telaah(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  // --- Penyerahan ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DISPENSING.CREATE')
  @Post('dispensings')
  @ApiOperation({
    summary: 'Menyerahkan obat',
    description:
      'Stok berkurang lewat adapter persediaan, bukan dari layar. Lot kedaluwarsa dan lot yang ' +
      'dikarantina tidak pernah terpilih. Idempoten terhadap idempotencyKey.',
  })
  async serahkan(
    @Body() dto: SerahkanDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.farmasi.serahkan(schema, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  // --- Pemberian obat --------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ADMINISTRATION.READ')
  @Get('administrations')
  @ApiOperation({ summary: 'Daftar kerja eMAR — pemberian obat yang menunggu keputusan' })
  daftarPemberian(
    @Query('facilityId') facilityId: string,
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.farmasi.daftarPemberian(requireSchema(user), facilityId, status);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ADMINISTRATION.CREATE')
  @Post('administrations')
  @ApiOperation({
    summary: 'Mencatat pemberian obat (enam benar)',
    description:
      'Yang dipindai dibandingkan dengan yang diresepkan DI PELADEN. Kegagalannya dicatat ' +
      'sebagai kejadian nyaris cedera, bukan hanya ditolak — nyaris cedera menunjukkan celah ' +
      'sebelum ada yang terluka.',
  })
  async berikan(
    @Body() dto: BerikanDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.farmasi.berikan(schema, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ADMINISTRATION.CREATE')
  @Post('administrations/skip')
  @ApiOperation({ summary: 'Mencatat obat yang tidak jadi diberikan beserta sebabnya' })
  async lewati(
    @Body() dto: LewatiDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.farmasi.lewati(schema, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }
}
