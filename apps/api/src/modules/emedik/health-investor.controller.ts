/**
 * Endpoint dasbor investor agregat, waterfall, dan distribusi.
 *
 * Pemisahan yang menentukan bentuknya:
 *
 * ```
 * DASHBOARD.READ membaca proyeksi  ≠  DASHBOARD.CREATE menghitungnya
 * DISTRIBUTION.CREATE menghitung   ≠  APPROVE menyetujui  ≠  POST membayar
 * ```
 *
 * Investor memegang **tepat satu** di antara seluruhnya: `DASHBOARD.READ`.
 *
 * Ia tidak dapat menghitung proyeksinya sendiri, dan itu bukan pembatasan
 * sewenang-wenang: menghitung ulang dengan ambang kohort yang lebih longgar
 * adalah cara paling rapi untuk menembus penyamaran tanpa pernah melanggar
 * satu pun aturan yang tertulis.
 *
 * Tajuk tujuan penggunaan sengaja TIDAK dituntut pada jalur ini — dan
 * ketiadaannya justru bermakna. Jalur ini tidak menyentuh data pasien sama
 * sekali; menuntut tajuknya akan menyiratkan bahwa ia mungkin menyentuhnya,
 * dan siratan itu keliru.
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
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
import { HealthInvestorService } from './health-investor.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import type { LapisanWaterfall } from './health-investor';

const JENIS_LAPISAN = [
  'OPERATING_COST',
  'DEBT_SERVICE',
  'RESERVE',
  'PREFERRED_RETURN',
  'CAPITAL_RETURN',
  'PROFIT_SHARE',
];
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

class KebijakanDto {
  @ApiProperty({
    minimum: 1,
    description:
      'Ambang kohort. TIDAK BOLEH NOL — ambang nol berarti tidak ada penyamaran sama sekali.',
  })
  @IsInt()
  @Min(1)
  @Max(1000)
  minimumCohort!: number;

  @ApiPropertyOptional({
    description:
      'Penyamaran pelengkap: bila hanya satu sel yang tersamar sedangkan totalnya diketahui, ' +
      'sel itu dapat dihitung kembali dengan pengurangan.',
  })
  @IsOptional()
  @IsBoolean()
  complementSuppression?: boolean;
}

class HitungProyeksiDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ example: '2026-01-01' })
  @Matches(TANGGAL)
  periodStart!: string;

  @ApiProperty({ example: '2026-03-31' })
  @Matches(TANGGAL)
  periodEnd!: string;

  @ApiPropertyOptional({
    description: 'Menandai proyeksi sebagai sintetis. Akun investor contoh hanya melihat yang ini.',
  })
  @IsOptional()
  @IsBoolean()
  synthetic?: boolean;
}

class LapisanDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  order!: number;

  @ApiProperty({ enum: JENIS_LAPISAN })
  @IsIn(JENIS_LAPISAN)
  type!: LapisanWaterfall;

  @ApiPropertyOptional({ description: 'Jumlah tetap. Salah satu di antara ini dan percent.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Persentase terhadap SISA saat itu, bukan nilai awal.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percent?: number;
}

class WaterfallDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ description: 'Wajib bertipe INVESTOR_SHARE.' })
  @IsUUID()
  feeContractId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TANGGAL)
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(TANGGAL)
  effectiveTo?: string;

  @ApiProperty({ type: () => [LapisanDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LapisanDto)
  tiers!: LapisanDto[];
}

class SimulasiDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  distributableAmount!: number;
}

class DistribusiDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty()
  @IsUUID()
  feeContractId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  policyId?: string;

  @ApiProperty()
  @Matches(TANGGAL)
  periodStart!: string;

  @ApiProperty()
  @Matches(TANGGAL)
  periodEnd!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  distributableAmount!: number;

  @ApiPropertyOptional({
    description: 'Tanpa kontrak yang AKTIF, bagiannya nol berapa pun yang diminta.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  requestedPercent?: number;
}

class PersetujuanDto {
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  note!: string;
}

class PembayaranDto {
  @ApiProperty({ minLength: 3 })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  paymentReference!: string;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Dasbor Investor')
@Controller('health/investor')
export class HealthInvestorController {
  constructor(
    private readonly investor: HealthInvestorService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  // --- Kebijakan penyamaran --------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_INVESTOR_DASHBOARD.READ')
  @Get('disclosure-policy')
  @ApiOperation({
    summary: 'Kebijakan penyamaran fasilitas',
    description: 'Ambang kohort tidak boleh nol.',
  })
  kebijakan(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.investor.bacaKebijakan(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_INVESTOR_DASHBOARD.UPDATE')
  @Post('disclosure-policy/:facilityId')
  @ApiOperation({
    summary: 'Mengubah ambang kohort',
    description:
      'Sengaja BUKAN hak investor. Menghitung ulang dengan ambang yang lebih longgar adalah cara ' +
      'paling rapi untuk menembus penyamaran tanpa melanggar satu pun aturan yang tertulis.',
  })
  async ubahKebijakan(
    @Param('facilityId') facilityId: string,
    @Body() dto: KebijakanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.investor.ubahKebijakan(schema, facilityId, dto, await this.aktor(schema, user));
  }

  // --- Proyeksi --------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_INVESTOR_DASHBOARD.CREATE')
  @Post('projections')
  @ApiOperation({
    summary: 'Menghitung proyeksi agregat',
    description:
      'Sumbernya dibaca di sini, disamarkan di sini, dan tidak pernah keluar dari sini. Yang ' +
      'tersimpan hanyalah angka gabungan yang sudah lolos ambang kohort.',
  })
  async hitung(@Body() dto: HitungProyeksiDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.investor.hitungProyeksi(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_INVESTOR_DASHBOARD.READ')
  @Get('projections')
  @ApiOperation({
    summary: 'Membaca proyeksi agregat',
    description:
      'Satu-satunya jalan yang dipegang investor. Ia menyentuh tabel proyeksi saja — tidak ada ' +
      'JOIN ke tabel pasien, dan tidak mungkin ada: tabelnya tidak punya kolom yang dapat ' +
      'dipakai menyambungnya. Yang disembunyikan disebutkan sebabnya, dan angkanya BUKAN nol.',
  })
  baca(
    @Query('facilityId') facilityId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId || !TANGGAL.test(periodStart ?? '') || !TANGGAL.test(periodEnd ?? '')) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Parameter facilityId, periodStart, dan periodEnd wajib diisi (tanggal YYYY-MM-DD).',
      );
    }
    return this.investor.bacaProyeksi(requireSchema(user), {
      facilityId,
      periodStart,
      periodEnd,
      /*
       * Akun demo dikenali dari TOKENNYA, bukan dari parameter.
       *
       * Membiarkannya datang dari kueri berarti membiarkan pemanggilnya
       * memutuskan sendiri apakah ia akun demo — dan pembatasan yang
       * ditentukan oleh pihak yang dibatasi bukan pembatasan.
       */
      akunContoh: user.isDemo === true,
    });
  }

  // --- Waterfall -------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_INVESTOR_WATERFALL.CREATE')
  @Post('waterfall')
  @ApiOperation({
    summary: 'Menyusun kebijakan waterfall',
    description:
      'Hanya menunjuk kontrak bertipe INVESTOR_SHARE. Setiap lapisan berupa jumlah ATAU ' +
      'persentase — lapisan yang keduanya kosong tidak pernah menerima apa pun, dan tidak ada ' +
      'yang menyadarinya sampai distribusinya dihitung.',
  })
  async susun(@Body() dto: WaterfallDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.investor.simpanWaterfall(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_INVESTOR_WATERFALL.ACTIVATE')
  @Post('waterfall/:id/activate')
  @ApiOperation({ summary: 'Mengaktifkan kebijakan waterfall' })
  async aktifkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.investor.aktifkanWaterfall(schema, id, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_INVESTOR_WATERFALL.READ')
  @Post('waterfall/:id/simulate')
  @ApiOperation({
    summary: 'Menyimulasikan waterfall',
    description:
      'Tidak menyimpan apa pun dan tidak memindahkan uang. Persentase dihitung terhadap SISA ' +
      'saat itu, bukan nilai awal — menghitungnya terhadap nilai awal membuat jumlah seluruh ' +
      'lapisan melampaui dana yang ada.',
  })
  simulasi(
    @Param('id') id: string,
    @Body() dto: SimulasiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.investor.simulasikan(requireSchema(user), id, dto.distributableAmount);
  }

  // --- Distribusi ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_INVESTOR_DISTRIBUTION.CREATE')
  @Post('distributions')
  @ApiOperation({
    summary: 'Menghitung distribusi investor',
    description:
      'Perhitungan TIDAK memindahkan uang. Tanpa kontrak yang AKTIF, bagian investor bernilai ' +
      'NOL — bukan galat, dan bukan "belum dihitung".',
  })
  async hitungDistribusi(@Body() dto: DistribusiDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.investor.hitungDistribusi(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_INVESTOR_DISTRIBUTION.APPROVE')
  @Post('distributions/:id/approve')
  @ApiOperation({
    summary: 'Menyetujui distribusi',
    description:
      'Yang menghitung TIDAK menyetujuinya sendiri. Persetujuan oleh penghitungnya hanya ' +
      'membaca ulang angkanya sendiri — dan angka yang keliru masih tampak benar baginya.',
  })
  async setujui(
    @Param('id') id: string,
    @Body() dto: PersetujuanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.investor.setujuiDistribusi(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_INVESTOR_DISTRIBUTION.POST')
  @Post('distributions/:id/pay')
  @ApiOperation({
    summary: 'Mencatat pembayaran distribusi',
    description:
      'Yang menyetujui TIDAK membayarkannya sendiri. Sesudah dibayar, nilainya tidak dapat ' +
      'diubah lagi: yang sudah berpindah adalah angka itu.',
  })
  async bayar(
    @Param('id') id: string,
    @Body() dto: PembayaranDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.investor.bayarDistribusi(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_INVESTOR_DISTRIBUTION.READ')
  @Get('distributions')
  @ApiOperation({ summary: 'Daftar distribusi' })
  daftar(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.investor.daftarDistribusi(requireSchema(user), facilityId);
  }
}
