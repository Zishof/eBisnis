/**
 * Endpoint siklus klaim internal.
 *
 * Dua pemisahan menentukan bentuknya:
 *
 * ```
 * CREATE menyusun  ->  VERIFY memeriksa berkas  ->  SUBMIT mengajukan
 *                          REVIEW menelaah penanda
 * ```
 *
 * Yang mengode tidak memverifikasi klaimnya sendiri, dan yang mengajukan tidak
 * menelaah penandanya. Yang kedua bukan soal kejujuran: telaah oleh orang yang
 * sedang dikejar tenggat pengajuan akan selalu berkesimpulan "tidak ada
 * masalah", sebab ia satu-satunya orang yang biayanya ditanggung sendiri bila
 * telaahnya memperlambat.
 *
 * Klaim menyentuh data pasien, jadi tajuk `X-Purpose-Of-Use` wajib di sini —
 * berbeda dari modul tarif dan jasa.
 */

import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthClaimService } from './health-claim.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import { SEBAB_PENOLAKAN, type SebabPenolakan } from './health-claim';
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

const KELAS = ['KRIS', 'CLASS_1', 'CLASS_2', 'CLASS_3', 'VIP', 'VVIP'];
const HASIL_TELAAH = ['EXPLAINED', 'CORRECTED', 'ESCALATED', 'NO_ISSUE'];

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

class BuatKlaimDto {
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
  admissionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  payerCoverageId?: string;

  @ApiPropertyOptional({ description: 'Nomor SEP dari penjamin. Kami menyimpannya, tidak mengarangnya.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sepNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  membershipNumber?: string;

  @ApiPropertyOptional({ enum: KELAS })
  @IsOptional()
  @IsIn(KELAS)
  billedClass?: string;

  @ApiPropertyOptional({ enum: KELAS })
  @IsOptional()
  @IsIn(KELAS)
  entitledClass?: string;
}

class AjukanDto {
  @ApiProperty({ description: 'Yang KAMI kirim. Berbeda dari yang disetujui dan yang dibayar.' })
  @IsNumber()
  @Min(0)
  submittedAmount!: number;
}

class KeputusanDto {
  @ApiProperty({ description: 'Yang diakui penjamin.' })
  @IsNumber()
  @Min(0)
  approvedAmount!: number;

  @ApiPropertyOptional({
    enum: SEBAB_PENOLAKAN,
    description:
      'Wajib bila yang disetujui lebih kecil daripada yang diajukan. KODE TERTUTUP — laporan ' +
      'yang tidak dapat menghitung sebab penolakan tidak dapat memperbaikinya.',
  })
  @IsOptional()
  @IsIn(SEBAB_PENOLAKAN)
  rejectionReason?: SebabPenolakan;

  @ApiPropertyOptional({ description: 'Wajib bila sebabnya OTHER.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionNote?: string;
}

class PembayaranDto {
  @ApiProperty({ description: 'Yang benar-benar masuk rekening.' })
  @IsNumber()
  @Min(0)
  paidAmount!: number;
}

class TelaahDto {
  @ApiProperty({ enum: HASIL_TELAAH })
  @IsIn(HASIL_TELAAH)
  outcome!: string;

  @ApiProperty({ description: 'Penanda yang ditutup tanpa keterangan sama saja dengan penanda yang tidak pernah ada.' })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  note!: string;
}

class RekonsiliasiDto {
  @ApiProperty({ description: 'Menurut catatan penjamin.' })
  @IsNumber()
  @Min(0)
  payerStatedAmount!: number;

  @ApiProperty({ description: 'Menurut mutasi rekening.' })
  @IsNumber()
  @Min(0)
  bankCreditedAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankReference?: string;

  @ApiPropertyOptional({ description: 'Wajib bila hendak ditutup sementara masih ada selisih.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  explanation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  close?: boolean;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Klaim')
@Controller('health/claims')
export class HealthClaimController {
  constructor(
    private readonly klaim: HealthClaimService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private async konteks(
    schema: string,
    user: AuthenticatedUser,
    purpose: string,
    facilityId?: string,
  ): Promise<KonteksAkses> {
    const tujuan = (purpose ?? '').toUpperCase() as PurposeOfUse;
    if (!TUJUAN.includes(tujuan)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Tajuk X-Purpose-Of-Use wajib dan harus salah satu dari: ${TUJUAN.join(', ')}.`,
      );
    }
    return {
      actorUserId: await this.identity.subjectId(schema, user.userId),
      activeRoleId: user.activeRoleId ?? null,
      purposeOfUse: tujuan,
      facilityId: facilityId ?? null,
      breakGlass: false,
      breakGlassReason: null,
    };
  }

  // --- Penyusunan ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_CLAIM.CREATE')
  @Post()
  @ApiOperation({
    summary: 'Menyusun klaim dari satu kunjungan atau perawatan',
    description: 'Satu klaim per kunjungan yang masih hidup; yang dibatalkan boleh diklaimkan ulang.',
  })
  async buat(
    @Body() dto: BuatKlaimDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.klaim.buat(schema, dto, await this.konteks(schema, user, purpose, dto.facilityId));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_CLAIM.VERIFY')
  @Post(':id/verify')
  @ApiOperation({
    summary: 'Verifikasi internal berkas klaim',
    description:
      'Menemukan kekurangan SEBELUM penjamin menemukannya. Klaim yang dikembalikan karena ' +
      'berkasnya kurang menghabiskan waktu berminggu-minggu, sedangkan seluruh kekurangannya ' +
      'dapat diperiksa mesin dalam hitungan detik. Penanda anti-fraud ikut dihitung — dan ia ' +
      'TIDAK menahan.',
  })
  async verifikasi(
    @Param('id') id: string,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.klaim.verifikasi(schema, id, await this.konteks(schema, user, purpose));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_CLAIM.SUBMIT')
  @Post(':id/submit')
  @ApiOperation({
    summary: 'Mengajukan klaim',
    description:
      'Menuntut klaim sudah diverifikasi internal dan tidak ada temuan yang menahan. Penanda ' +
      'anti-fraud tidak menahan pengajuan.',
  })
  async ajukan(
    @Param('id') id: string,
    @Body() dto: AjukanDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.klaim.ajukan(schema, id, dto, await this.konteks(schema, user, purpose));
  }

  // --- Keputusan penjamin ----------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_CLAIM.UPDATE')
  @Post(':id/decision')
  @ApiOperation({
    summary: 'Mencatat keputusan penjamin',
    description:
      'Yang disetujui adalah angka KEDUA, bukan pengganti angka pertama. Selisih yang ' +
      'merugikan wajib bersebab, dan sebabnya kode tertutup.',
  })
  keputusan(@Param('id') id: string, @Body() dto: KeputusanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.klaim.catatKeputusan(requireSchema(user), id, dto);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_CLAIM.UPDATE')
  @Post(':id/payment')
  @ApiOperation({
    summary: 'Mencatat pembayaran',
    description: 'Yang dibayar adalah angka KETIGA. Ketiganya disimpan terpisah.',
  })
  pembayaran(
    @Param('id') id: string,
    @Body() dto: PembayaranDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.klaim.catatPembayaran(requireSchema(user), id, dto.paidAmount);
  }

  // --- Telaah ----------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_CLAIM_REVIEW.REVIEW')
  @Post('flags/:id/review')
  @ApiOperation({
    summary: 'Menelaah satu penanda',
    description:
      'Penanda BUKAN tuduhan dan tidak pernah menghentikan pengajuan. Telaahnya wajib ' +
      'berketerangan — penanda yang ditutup tanpa keterangan sama saja dengan penanda yang ' +
      'tidak pernah ada.',
  })
  async telaah(
    @Param('id') id: string,
    @Body() dto: TelaahDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.klaim.telaahPenanda(schema, id, dto, await this.konteks(schema, user, purpose));
  }

  // --- Rekonsiliasi ----------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_CLAIM_RECON.CREATE')
  @Post(':id/reconcile')
  @ApiOperation({
    summary: 'Merekonsiliasi tiga sisi',
    description:
      'Catatan kami, catatan penjamin, dan mutasi rekening. Selisih yang tidak terjelaskan ' +
      'TIDAK boleh ditutup — rekonsiliasi yang dapat ditutup dengan selisih akan selalu ' +
      'ditutup dengan selisih.',
  })
  async rekonsiliasi(
    @Param('id') id: string,
    @Body() dto: RekonsiliasiDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.klaim.rekonsiliasi(schema, id, dto, await this.konteks(schema, user, purpose));
  }

  // --- Pembacaan -------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_CLAIM.READ')
  @Get()
  @ApiOperation({
    summary: 'Daftar kerja klaim',
    description: 'Yang bertanda perlu ditelaah berada di atas.',
  })
  daftar(
    @Query('facilityId') facilityId: string,
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.klaim.daftarKerja(requireSchema(user), facilityId, status);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_CLAIM.READ')
  @Get('rejection-report')
  @ApiOperation({
    summary: 'Laporan sebab penolakan',
    description:
      'Inilah yang membuat sebab penolakan harus berupa kode tertutup: laporan ini tidak dapat ' +
      'disusun dari teks bebas.',
  })
  laporan(
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
    return this.klaim.laporanPenolakan(requireSchema(user), facilityId, Number(year));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_CLAIM.READ')
  @Get(':id')
  @ApiOperation({ summary: 'Satu klaim beserta temuan dan penandanya' })
  baca(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.klaim.baca(requireSchema(user), id);
  }
}
