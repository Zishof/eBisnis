/**
 * Endpoint settlement jasa.
 *
 * Empat wewenang, empat pemegang berbeda:
 *
 * ```
 * CREATE  ->  APPROVE  ->  POST (kunci dan bayar)  ->  REVERSE (koreksi)
 * ```
 *
 * Tidak ada satu pun jalan yang MENGHAPUS. Settlement yang keliru dikoreksi;
 * pernyataan yang keliru dikoreksi dengan pernyataan kedua. Menghapusnya akan
 * membuat kertas yang sudah dipegang penerimanya tidak lagi cocok dengan apa
 * pun — dan kertas itu tidak dapat ditarik kembali.
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthSettlementService } from './health-settlement.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import type { JenisKoreksi } from './health-settlement';

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

class HitungDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty()
  @IsUUID()
  policyId!: string;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  @Max(2200)
  periodYear!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  basisAmount!: number;

  @ApiPropertyOptional({
    description: 'Tarif pajak datang dari peraturan, bukan dari bawaan sistem.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRatePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  payerPaysByClaim?: boolean;

  @ApiPropertyOptional({
    description: 'Simulasi TIDAK PERNAH dapat dibayarkan, dan tandanya tidak dapat diubah.',
  })
  @IsOptional()
  @IsBoolean()
  isSimulation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

class SetujuiDto {
  @ApiProperty({ description: 'Apa yang diperiksa sebelum menyetujui.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  note!: string;
}

class BayarDto {
  @ApiProperty({
    description:
      'Rujukan transaksi. Pembayaran tanpa rujukan tidak dapat dicocokkan dengan rekening ' +
      'koran, dan yang tidak dapat dicocokkan akan dibayarkan dua kali.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reference!: string;
}

class KoreksiDto {
  @ApiProperty({ enum: ['ADJUSTMENT', 'REVERSAL'] })
  @IsIn(['ADJUSTMENT', 'REVERSAL'])
  type!: JenisKoreksi;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ description: 'Sekurang-kurangnya sepuluh huruf.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}

class PernyataanDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty()
  @IsUUID()
  providerId!: string;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  @Max(2200)
  periodYear!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth?: number;

  @ApiPropertyOptional({
    description:
      'Pernyataan koreksi menunjuk pernyataan yang dikoreksinya. Yang dipegang penerimanya ' +
      'harus dua kertas, bukan satu kertas yang diam-diam berganti isi.',
  })
  @IsOptional()
  @IsBoolean()
  isCorrection?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  correctsStatementId?: string;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Settlement Jasa')
@Controller('health/settlement')
export class HealthSettlementController {
  constructor(
    private readonly settlement: HealthSettlementService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  // --- Perhitungan -----------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_SETTLEMENT.CREATE')
  @Post()
  @ApiOperation({
    summary: 'Menghitung settlement jasa',
    description:
      'Simulasi dan settlement sungguhan dihitung dengan jalan yang SAMA — yang membedakan ' +
      'hanya tandanya, dan tanda itu tidak dapat diubah kemudian. Menghitungnya dengan dua ' +
      'jalan berbeda akan membuat simulasi memberi angka yang tidak pernah benar-benar terjadi.',
  })
  async hitung(@Body() dto: HitungDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.settlement.hitung(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_SETTLEMENT.APPROVE')
  @Post(':id/approve')
  @ApiOperation({
    summary: 'Menyetujui settlement',
    description: 'Yang menghitung tidak menyetujuinya sendiri.',
  })
  async setujui(
    @Param('id') id: string,
    @Body() dto: SetujuiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.settlement.setujui(schema, id, dto.note, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_SETTLEMENT.POST')
  @Post(':id/lock')
  @ApiOperation({
    summary: 'Mengunci settlement',
    description:
      'Sejak dikunci, settlement tidak dapat diubah maupun dihapus. Kekeliruan diperbaiki lewat ' +
      'penyesuaian atau pembalikan.',
  })
  kunci(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.settlement.kunci(requireSchema(user), id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_SETTLEMENT.POST')
  @Post(':id/pay')
  @ApiOperation({
    summary: 'Mencatat pembayaran settlement',
    description: 'Simulasi tidak pernah dibayarkan, sekalipun statusnya sudah terkunci.',
  })
  bayar(@Param('id') id: string, @Body() dto: BayarDto, @CurrentUser() user: AuthenticatedUser) {
    return this.settlement.bayar(requireSchema(user), id, dto.reference);
  }

  // --- Koreksi ---------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_SETTLEMENT.REVERSE')
  @Post(':id/corrections')
  @ApiOperation({
    summary: 'Membuat penyesuaian atau pembalikan',
    description:
      'Pembalikan wajib SAMA BESAR dengan yang tersisa. Pembalikan sebagian yang menyamar ' +
      'sebagai pembalikan penuh akan menyisakan selisih yang ditemukan setahun kemudian oleh ' +
      'orang yang tidak tahu apa-apa tentang kejadiannya.',
  })
  async koreksi(
    @Param('id') id: string,
    @Body() dto: KoreksiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.settlement.koreksi(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_SETTLEMENT.APPROVE')
  @Post('corrections/:id/approve')
  @ApiOperation({
    summary: 'Menyetujui koreksi',
    description:
      'Yang membuat koreksi tidak menyetujuinya sendiri. Koreksi adalah tempat paling mudah ' +
      'untuk memindahkan uang tanpa ada yang melihat, sebab ia terlihat seperti pembetulan.',
  })
  async setujuiKoreksi(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.settlement.setujuiKoreksi(schema, id, await this.aktor(schema, user));
  }

  // --- Pernyataan ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_STATEMENT.CREATE')
  @Post('statements')
  @ApiOperation({
    summary: 'Menerbitkan pernyataan bagi satu penerima',
    description:
      'Hanya settlement yang BENAR-BENAR dibayarkan yang masuk. Pernyataan yang memuat angka ' +
      'yang belum tentu dibayarkan akan dibaca sebagai janji — dan janji yang tercetak lebih ' +
      'sulit ditarik daripada janji yang diucapkan.',
  })
  async terbitkan(@Body() dto: PernyataanDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.settlement.terbitkanPernyataan(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_STATEMENT.READ')
  @Get('statements')
  @ApiOperation({ summary: 'Pernyataan satu penerima' })
  daftarPernyataan(
    @Query('providerId') providerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!providerId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter providerId wajib diisi.');
    }
    return this.settlement.daftarPernyataan(requireSchema(user), providerId);
  }

  // --- Pembacaan -------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_SETTLEMENT.READ')
  @Get()
  @ApiOperation({ summary: 'Daftar settlement satu fasilitas pada satu tahun' })
  daftar(
    @Query('facilityId') facilityId: string,
    @Query('year') year: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId || !year) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Parameter facilityId dan year wajib diisi.',
      );
    }
    return this.settlement.daftar(requireSchema(user), facilityId, Number(year));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FEE_SETTLEMENT.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Satu settlement beserta baris dan koreksinya' })
  baca(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.settlement.baca(requireSchema(user), id);
  }
}
