/**
 * Endpoint Puskesmas dan Posyandu.
 *
 * Hak akses kader dipisahkan dari hak akses petugas Puskesmas. Kader menimbang
 * dan mencatat; ia tidak menetapkan diagnosis dan tidak membaca rekam medis
 * lengkap. Menyatukannya akan memberi ratusan kader di desa akses penuh ke
 * seluruh rekam medis, dan tidak ada yang akan menyadarinya sampai ada
 * kebocoran.
 */

import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { TenantPermissionService } from '../auth/tenant-permission.service';
import { HealthCommunityService } from './health-community.service';
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

const ALASAN_KUNJUNGAN = [
  'SEVERE_WASTING',
  'WEIGHT_FLAT',
  'STUNTING',
  'IMMUNIZATION_OVERDUE',
  'HIGH_RISK_FAMILY',
  'FOLLOW_UP',
  'OTHER',
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

class FolderDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  headPatientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  familyCardNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  addressText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  rt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  rw?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  village?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  posyanduName?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  memberPatientIds?: string[];
}

class PertumbuhanDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  familyFolderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(10)
  heightCm?: number;

  @ApiPropertyOptional({
    enum: ['RECUMBENT', 'STANDING'],
    description:
      'Wajib bila tinggi diisi. Berbaring dan berdiri berselisih sekitar 0,7 cm — cukup untuk ' +
      'memindahkan anak melintasi ambang stunting.',
  })
  @IsOptional()
  @IsIn(['RECUMBENT', 'STANDING'])
  heightMeasuredAs?: 'RECUMBENT' | 'STANDING';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  headCircumferenceCm?: number;

  @ApiPropertyOptional({ description: 'Lingkar lengan atas.' })
  @IsOptional()
  @IsNumber()
  muacCm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  posyanduName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

class ImunisasiDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ example: 'DPT-HB-Hib' })
  @IsString()
  @MaxLength(48)
  vaccineCode!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(10)
  doseNumber!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  site?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  posyanduName?: string;
}

class KunjunganDto {
  @ApiProperty()
  @IsUUID()
  familyFolderId!: string;

  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiProperty({ enum: ALASAN_KUNJUNGAN })
  @IsIn(ALASAN_KUNJUNGAN)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  findings?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  actionTaken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  referredTo?: string;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Puskesmas dan Posyandu')
@Controller('health/community')
export class HealthCommunityController {
  constructor(
    private readonly komunitas: HealthCommunityService,
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

  // --- Folder keluarga -------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FAMILY.CREATE')
  @Post('folders')
  @ApiOperation({
    summary: 'Membuat folder keluarga',
    description:
      'Puskesmas bekerja pada keluarga, bukan pada individu yang kebetulan datang. Anak yang ' +
      'gizinya buruk hampir selalu punya saudara yang gizinya juga buruk, dan kunjungan rumah ' +
      'yang hanya menyasar satu anak akan melewati yang lain. Anggota yang sudah terdaftar pada ' +
      'folder lain dilaporkan namanya, tanpa menggagalkan pembuatan foldernya.',
  })
  async buatFolder(
    @Body() dto: FolderDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.komunitas.buatFolder(
      schema,
      dto,
      await this.konteks(schema, user, { purpose, facilityId: dto.facilityId }),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_FAMILY.READ')
  @Get('folders/:id')
  @ApiOperation({ summary: 'Anggota folder beserta keadaan gizi terakhirnya' })
  async isiFolder(
    @Param('id') id: string,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.komunitas.isiFolder(schema, id, await this.konteks(schema, user, { purpose, facilityId }));
  }

  // --- Pertumbuhan -----------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_GROWTH.CREATE')
  @Post('growth')
  @ApiOperation({
    summary: 'Mencatat penimbangan dan pengukuran anak',
    description:
      'Z-score dihitung dari tabel rujukan WHO yang disemai sebagai DATA, bukan ditanam di ' +
      'kode. Bila baris rujukan yang berlaku tidak ada, hasilnya dinyatakan belum dapat ' +
      'dinilai — bukan normal. Klasifikasi stunting dipakai menentukan siapa menerima bantuan ' +
      'pangan, dan klasifikasi karangan akan mengirimnya kepada anak yang keliru.',
  })
  async catatPertumbuhan(
    @Body() dto: PertumbuhanDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.komunitas.catatPertumbuhan(
      schema,
      dto,
      await this.konteks(schema, user, { purpose, facilityId: dto.facilityId }),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_GROWTH.READ')
  @Get('growth/:patientId')
  @ApiOperation({ summary: 'Riwayat pertumbuhan seorang anak (KMS digital)' })
  async riwayat(
    @Param('patientId') patientId: string,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.komunitas.riwayatPertumbuhan(
      schema,
      patientId,
      await this.konteks(schema, user, { purpose, facilityId }),
    );
  }

  // --- Imunisasi -------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_IMMUNIZATION.READ')
  @Get('immunization/:patientId')
  @ApiOperation({
    summary: 'Status imunisasi: yang sudah, yang boleh hari ini, dan yang tertunggak',
    description:
      'Tertunggak dihitung dari umur ANJURAN, bukan umur minimum. Umur minimum adalah batas ' +
      'keamanan; umur anjuran adalah kapan anak seharusnya sudah terlindungi.',
  })
  async statusImunisasi(
    @Param('patientId') patientId: string,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.komunitas.statusImunisasi(
      schema,
      patientId,
      await this.konteks(schema, user, { purpose, facilityId }),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_IMMUNIZATION.CREATE')
  @Post('immunization')
  @ApiOperation({
    summary: 'Mencatat pemberian imunisasi',
    description:
      'Vaksin yang diberikan sebelum umur minimum atau sebelum jarak minimum DITOLAK, bukan ' +
      'diperingatkan. Ia tidak membentuk kekebalan yang cukup — dan yang lebih berbahaya, ia ' +
      'akan tercatat sebagai diberikan; anak itu lalu tampak lengkap di laporan cakupan dan ' +
      'tidak akan dikejar siapa pun. Penolakannya menyebut tanggal paling awal.',
  })
  async catatImunisasi(
    @Body() dto: ImunisasiDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.komunitas.catatImunisasi(
      schema,
      dto,
      await this.konteks(schema, user, { purpose, facilityId: dto.facilityId }),
    );
  }

  // --- Cakupan dan kunjungan rumah -------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PROGRAM.READ')
  @Get('coverage')
  @ApiOperation({
    summary: 'Cakupan program',
    description:
      'Penyebutnya SASARAN, bukan yang datang. Menghitung "berapa persen yang datang sudah ' +
      'diimunisasi" akan selalu mendekati seratus persen dan tidak memberi tahu apa pun — yang ' +
      'perlu diketahui justru berapa banyak yang tidak pernah datang.',
  })
  cakupan(
    @Query('facilityId') facilityId: string,
    @Query('year') year: string,
    @Query('month') month: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId || !year) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Parameter facilityId dan year wajib diisi.',
      );
    }
    return this.komunitas.cakupan(
      requireSchema(user),
      facilityId,
      Number(year),
      month ? Number(month) : undefined,
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_HOME_VISIT.READ')
  @Get('home-visits/worklist')
  @ApiOperation({
    summary: 'Anak yang perlu dikunjungi, diurutkan menurut kemendesakannya',
    description:
      'Gizi buruk lebih dahulu, lalu berat yang tidak naik, lalu stunting, lalu imunisasi yang ' +
      'paling lama tertunggak. Kader yang punya waktu untuk lima kunjungan hari ini harus tahu ' +
      'lima siapa; daftar seratus nama yang tidak berurutan sama saja dengan tidak ada daftar.',
  })
  daftarKunjungan(
    @Query('facilityId') facilityId: string,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.komunitas.daftarKunjungan(
      requireSchema(user),
      facilityId,
      limit ? Math.min(200, Number(limit)) : 50,
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_HOME_VISIT.CREATE')
  @Post('home-visits')
  @ApiOperation({ summary: 'Mencatat kunjungan rumah' })
  async catatKunjungan(
    @Body() dto: KunjunganDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.komunitas.catatKunjungan(
      schema,
      dto,
      await this.konteks(schema, user, { purpose, facilityId: dto.facilityId }),
    );
  }
}
