/**
 * Endpoint laboratorium dan radiologi.
 *
 * Hak aksesnya dipisah menjadi memasukkan hasil, memverifikasi, dan menerima
 * nilai kritis — tiga hal yang dikerjakan tiga orang berbeda. Menyatukannya
 * akan membuat analis yang mengetik angkanya juga yang menyatakan angkanya
 * benar, dan itu bukan verifikasi.
 */

import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { TenantPermissionService } from '../auth/tenant-permission.service';
import { HealthLabService } from './health-lab.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
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

class BuatPesananDto {
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

  @ApiPropertyOptional({ enum: ['LAB', 'RAD', 'PATH', 'OTHER'] })
  @IsOptional()
  @IsIn(['LAB', 'RAD', 'PATH', 'OTHER'])
  department?: string;

  @ApiPropertyOptional({ enum: ['STAT', 'URGENT', 'ROUTINE'] })
  @IsOptional()
  @IsIn(['STAT', 'URGENT', 'ROUTINE'])
  priority?: 'STAT' | 'URGENT' | 'ROUTINE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({
    description:
      'Keterangan klinis. Laboratorium yang tahu dugaan dokter menafsirkan hasil tidak biasa ' +
      'dengan lebih tepat, dan radiologi yang tahu apa yang dicari melihat tempat yang benar.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clinicalInfo?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  testIds!: string[];
}

class AmbilSpesimenDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  volumeMl?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  collectedAt?: string;
}

class TerimaSpesimenDto {
  @ApiProperty({ description: 'Spesimen tanpa label TIDAK PERNAH dapat diterima.' })
  @IsBoolean()
  labelled!: boolean;

  @ApiProperty()
  @IsBoolean()
  labelMatchesRequest!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  volumeSufficient?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  containerCorrect?: boolean;

  @ApiPropertyOptional({
    enum: [
      'UNLABELLED',
      'MISLABELLED',
      'HEMOLYSED',
      'CLOTTED',
      'INSUFFICIENT_VOLUME',
      'WRONG_CONTAINER',
      'CONTAMINATED',
      'EXPIRED_TUBE',
      'DELAYED_TRANSPORT',
      'LEAKED',
    ],
    description: 'Sebab yang hanya dapat dilihat mata, misalnya hemolisis atau bekuan.',
  })
  @IsOptional()
  @IsIn([
    'UNLABELLED',
    'MISLABELLED',
    'HEMOLYSED',
    'CLOTTED',
    'INSUFFICIENT_VOLUME',
    'WRONG_CONTAINER',
    'CONTAMINATED',
    'EXPIRED_TUBE',
    'DELAYED_TRANSPORT',
    'LEAKED',
  ])
  manualRejectReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  manualRejectNote?: string;
}

class MasukkanHasilDto {
  @ApiProperty()
  @IsUUID()
  orderItemId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  valueNumeric?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  valueText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  method?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  instrument?: string;

  @ApiPropertyOptional({
    description:
      'Rujukan citra, BUKAN citranya. Menyimpan DICOM utuh di basis data relasional akan ' +
      'membengkakkan cadangan sampai tidak dapat dipulihkan saat dibutuhkan.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  impression?: string;
}

class AmandemenDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  valueNumeric?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  valueText?: string;

  @ApiProperty({ description: 'Sekurang-kurangnya sepuluh huruf.' })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}

class SampaikanKritisDto {
  @ApiProperty({ enum: ['PHONE', 'IN_PERSON', 'SECURE_MESSAGE', 'OTHER'] })
  @IsIn(['PHONE', 'IN_PERSON', 'SECURE_MESSAGE', 'OTHER'])
  channel!: string;

  @ApiProperty({ description: 'Kepada siapa disampaikan.' })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  notifiedTo!: string;
}

class TerimaKritisDto {
  @ApiProperty({
    description:
      'Bacaan ulang: penerima mengulang angkanya kepada penyampai. Dibandingkan di peladen ' +
      'dengan nilai hasilnya. Satu-satunya cara mengetahui bahwa yang terdengar sama dengan ' +
      'yang diucapkan.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  readBackValue!: string;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Laboratorium')
@Controller('health/lab')
export class HealthLabController {
  constructor(
    private readonly lab: HealthLabService,
    private readonly identity: CoreIdentityAdapter,
    private readonly izin: TenantPermissionService,
  ) {}

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
      const kurang = await this.izin.findMissing(schema, user.userId, ['HEALTH_PATIENT.BREAK_GLASS'], {
        isDemo: user.isDemo,
        activeRoleId: user.activeRoleId ?? null,
      });
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

  // --- Katalog ---------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LAB_ORDER.READ')
  @Get('tests')
  @ApiOperation({ summary: 'Katalog pemeriksaan laboratorium dan radiologi' })
  katalog(@Query('department') department: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.lab.katalog(requireSchema(user), department);
  }

  // --- Pesanan ---------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LAB_ORDER.CREATE')
  @Post('orders')
  @ApiOperation({
    summary: 'Memesan pemeriksaan',
    description:
      'Spesimen dibuat sekaligus, satu per jenis spesimen — bukan satu per pemeriksaan. Tiga ' +
      'pemeriksaan dari satu tabung darah memang satu spesimen, dan membuatnya tiga akan ' +
      'menuntut petugas menusuk pasien tiga kali.',
  })
  async buatPesanan(
    @Body() dto: BuatPesananDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.lab.buatPesanan(
      schema,
      dto,
      await this.konteks(schema, user, { purpose, facilityId: dto.facilityId }),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LAB_ORDER.READ')
  @Get('worklist')
  @ApiOperation({
    summary: 'Daftar kerja laboratorium',
    description:
      'Nilai kritis yang belum diterima klinisi berada di atas STAT sekalipun. Pemeriksaan ' +
      'STAT yang belum dikerjakan masih menunggu; nilai kritis yang belum tersampaikan sudah ' +
      'menjadi bahaya.',
  })
  daftarKerja(
    @Query('facilityId') facilityId: string,
    @Query('department') department: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.lab.daftarKerja(requireSchema(user), facilityId, department);
  }

  // --- Spesimen --------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LAB_SPECIMEN.CREATE')
  @Post('specimens/:id/collect')
  @ApiOperation({ summary: 'Mencatat pengambilan spesimen' })
  async ambil(
    @Param('id') id: string,
    @Body() dto: AmbilSpesimenDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.lab.ambilSpesimen(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LAB_SPECIMEN.RECEIVE')
  @Post('specimens/:id/receive')
  @ApiOperation({
    summary: 'Menerima atau menolak spesimen',
    description:
      'Spesimen tanpa label tidak pernah dapat diterima, sekalipun petugas yang mengantarnya ' +
      'yakin betul itu milik siapa. Keyakinan yang salah tentang identitas spesimen ' +
      'menghasilkan hasil yang benar secara analitis, dilaporkan dengan percaya diri, dan ' +
      'tertempel pada orang yang keliru — dan ia akan dipercaya, karena laboratorium jarang salah.',
  })
  async terima(
    @Param('id') id: string,
    @Body() dto: TerimaSpesimenDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.lab.terimaSpesimen(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  // --- Hasil -----------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LAB_RESULT.CREATE')
  @Post('results')
  @ApiOperation({
    summary: 'Memasukkan hasil pemeriksaan',
    description:
      'Penilaian terhadap rentang rujukan dilakukan DI PELADEN, memakai rentang yang berlaku ' +
      'bagi umur dan jenis kelamin pasien. Nilai kritis yang terdeteksi langsung membuka ' +
      'catatan penyampaian, bukan menunggu seseorang menekan tombol.',
  })
  async masukkanHasil(
    @Body() dto: MasukkanHasilDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.lab.masukkanHasil(schema, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LAB_RESULT.VERIFY_RESULT')
  @Post('results/:id/verify')
  @ApiOperation({
    summary: 'Memverifikasi hasil',
    description:
      'Verifikator tidak boleh sama dengan yang memasukkan hasil. Orang yang mengetik angkanya ' +
      'adalah orang yang paling sulit melihat kekeliruannya.',
  })
  async verifikasi(
    @Param('id') id: string,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.lab.verifikasi(schema, id, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LAB_RESULT.VERIFY_RESULT')
  @Post('results/:id/release')
  @ApiOperation({ summary: 'Melepas hasil kepada klinisi' })
  async lepas(
    @Param('id') id: string,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.lab.lepasHasil(schema, id, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LAB_RESULT.AMEND')
  @Post('results/:id/amend')
  @ApiOperation({
    summary: 'Mengamandemen hasil yang sudah dilepas',
    description:
      'Diperbaiki, bukan ditimpa. Hasil yang sudah dilepas mungkin sudah dipakai mengambil ' +
      'keputusan — obat sudah diberikan, pasien sudah dipulangkan. Yang salah tetap terlihat ' +
      'beserta penggantinya.',
  })
  async amandemen(
    @Param('id') id: string,
    @Body() dto: AmandemenDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.lab.amandemen(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LAB_RESULT.READ')
  @Get('patients/:id/results')
  @ApiOperation({ summary: 'Hasil pemeriksaan seorang pasien' })
  async hasilPasien(
    @Param('id') id: string,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.lab.hasilPasien(schema, id, await this.konteks(schema, user, { purpose, facilityId }));
  }

  // --- Nilai kritis ----------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LAB_CRITICAL.READ')
  @Get('critical')
  @ApiOperation({
    summary: 'Nilai kritis yang belum diterima klinisi',
    description:
      'Tenggatnya tiga puluh menit. Nilai kritis yang menunggu satu jam bukan lagi nilai ' +
      'kritis — ia riwayat.',
  })
  kritis(@Query('facilityId') facilityId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.lab.kritisTertunda(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LAB_CRITICAL.CREATE')
  @Post('critical/:id/notify')
  @ApiOperation({ summary: 'Mencatat percobaan penyampaian nilai kritis' })
  async sampaikan(
    @Param('id') id: string,
    @Body() dto: SampaikanKritisDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.lab.sampaikanKritis(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_LAB_CRITICAL.ACKNOWLEDGE_CRITICAL')
  @Post('critical/:id/acknowledge')
  @ApiOperation({
    summary: 'Menerima nilai kritis dengan bacaan ulang',
    description:
      'Bacaan ulang dibandingkan DI PELADEN dengan nilai hasilnya. Membandingkannya di ' +
      'peramban berarti siapa pun yang memanggil jalur ini langsung dapat mengetik apa saja, ' +
      'dan catatan penerimaan yang dapat diisi apa saja tidak membuktikan bahwa angkanya ' +
      'benar-benar terdengar.',
  })
  async terimaKritis(
    @Param('id') id: string,
    @Body() dto: TerimaKritisDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.lab.terimaKritis(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }
}
