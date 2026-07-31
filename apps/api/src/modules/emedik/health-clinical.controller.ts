/**
 * Endpoint pasien, pendaftaran, antrean, dan dokumentasi klinis.
 *
 * Terpisah dari controller fasilitas supaya keduanya tetap terbaca. Yang di
 * sini menyentuh rekam medis; yang di sana menyentuh struktur organisasi — dan
 * aturan aksesnya berbeda jauh.
 *
 * **Setiap jalan yang membaca data pasien menyertakan tujuan penggunaan.**
 * Bukan pilihan: tanpa tujuan, jejak "siapa membaca apa" tidak dapat dinilai
 * wajar atau tidak, dan jejak yang tidak dapat dinilai tidak menahan siapa pun.
 */

import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
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
import { HealthPatientService, type KonteksAkses } from './health-patient.service';
import { TenantPermissionService } from '../auth/tenant-permission.service';
import { HealthVisitService } from './health-visit.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
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

class DaftarPasienDto {
  @ApiProperty({ example: 'Siti Aminah' })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  fullName!: string;

  @ApiPropertyOptional({ example: '1985-03-15' })
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Benar bila tanggal lahirnya diperkirakan, bukan diketahui pasti.' })
  @IsOptional()
  @IsBoolean()
  birthDateEstimated?: boolean;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'UNKNOWN'] })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'UNKNOWN'])
  gender?: 'MALE' | 'FEMALE' | 'UNKNOWN';

  @ApiPropertyOptional({ example: '3201011503850001' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  nik?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(48)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressText?: string;

  @ApiPropertyOptional({ description: 'Nama ibu kandung — pembeda terkuat sesudah NIK.' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  motherName?: string;

  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional({
    description:
      'Menegaskan bahwa dugaan penggandaan sudah ditelaah dan keduanya memang orang berbeda.',
  })
  @IsOptional()
  @IsBoolean()
  confirmedNotDuplicate?: boolean;
}

class GabungPasienDto {
  @ApiProperty({ description: 'Rekam medis yang akan digabungkan (dilebur).' })
  @IsUUID()
  sourceId!: string;

  @ApiProperty({ description: 'Rekam medis yang menjadi induk.' })
  @IsUUID()
  targetId!: string;

  @ApiProperty({ example: 'Terbukti orang yang sama setelah dicocokkan dengan KTP.' })
  @IsString()
  @MinLength(10)
  reason!: string;
}

class AlergiDto {
  @ApiProperty({ enum: ['DRUG', 'FOOD', 'ENVIRONMENT', 'LATEX', 'OTHER'] })
  @IsIn(['DRUG', 'FOOD', 'ENVIRONMENT', 'LATEX', 'OTHER'])
  allergenType!: string;

  @ApiProperty({ example: 'Amoksisilin' })
  @IsString()
  @MaxLength(180)
  allergenName!: string;

  @ApiPropertyOptional({ enum: ['MILD', 'MODERATE', 'SEVERE', 'FATAL', 'UNKNOWN'] })
  @IsOptional()
  @IsIn(['MILD', 'MODERATE', 'SEVERE', 'FATAL', 'UNKNOWN'])
  severity?: string;

  @ApiPropertyOptional({ enum: ['SUSPECTED', 'REPORTED', 'CONFIRMED'] })
  @IsOptional()
  @IsIn(['SUSPECTED', 'REPORTED', 'CONFIRMED'])
  certainty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reaction?: string;
}

class DaftarKunjunganDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({ enum: ['OUTPATIENT', 'EMERGENCY', 'TELEMEDICINE', 'HOME_CARE', 'OUTREACH', 'POSYANDU'] })
  @IsOptional()
  @IsString()
  visitType?: string;

  @ApiPropertyOptional({ enum: ['WALK_IN', 'ONLINE', 'PHONE', 'REFERRAL', 'FOLLOW_UP', 'OUTREACH'] })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiPropertyOptional({ enum: ['SELF_PAY', 'INSURANCE', 'BPJS', 'CORPORATE', 'GOVERNMENT_PROGRAM', 'FREE'] })
  @IsOptional()
  @IsString()
  payerType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional({
    enum: ['ELDERLY', 'PREGNANT', 'DISABILITY', 'INFANT', 'EMERGENCY', 'NONE'],
    description: 'Bila kosong, disimpulkan dari umur pasien.',
  })
  @IsOptional()
  @IsIn(['ELDERLY', 'PREGNANT', 'DISABILITY', 'INFANT', 'EMERGENCY', 'NONE'])
  priorityReason?: 'ELDERLY' | 'PREGNANT' | 'DISABILITY' | 'INFANT' | 'EMERGENCY' | 'NONE';

  @ApiPropertyOptional({ description: 'Pasien uji tidak pernah tertagih.' })
  @IsOptional()
  @IsBoolean()
  isTestPatient?: boolean;
}

class MulaiKunjunganDto {
  @ApiProperty()
  @IsUUID()
  registrationId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional({
    enum: ['NORMAL', 'RESTRICTED', 'VERY_RESTRICTED'],
    description:
      'Kunjungan kesehatan jiwa, kekerasan seksual, atau HIV ditandai sejak awal supaya ' +
      'penyaringan aksesnya tidak perlu menebak dari isinya.',
  })
  @IsOptional()
  @IsIn(['NORMAL', 'RESTRICTED', 'VERY_RESTRICTED'])
  sensitivity?: string;
}

class CatatanKlinisDto {
  @ApiProperty()
  @IsUUID()
  encounterId!: string;

  @ApiPropertyOptional({ enum: ['SOAP', 'PROGRESS', 'CONSULTATION', 'TRIAGE', 'NURSING', 'EDUCATION'] })
  @IsOptional()
  @IsString()
  noteType?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() subjective?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objective?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assessment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() plan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() freeText?: string;

  @ApiPropertyOptional({
    description:
      'Menandatangani catatan. SESUDAH INI ISINYA TIDAK DAPAT DIUBAH LAGI — perubahan hanya ' +
      'lewat amandemen. Karena itu bawaannya salah, bukan benar.',
  })
  @IsOptional()
  @IsBoolean()
  sign?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  signedByProviderId?: string;
}

class AmandemenDto {
  @ApiPropertyOptional() @IsOptional() @IsString() subjective?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() objective?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assessment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() plan?: string;

  @ApiProperty({ example: 'Koreksi diagnosis setelah hasil pemeriksaan lanjutan.' })
  @IsString()
  @MinLength(10)
  reason!: string;
}

class TandaVitalDto {
  @ApiProperty() @IsUUID() encounterId!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(30) @Max(300) systolicMmhg?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(10) @Max(200) diastolicMmhg?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(10) @Max(300) pulseBpm?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(4) @Max(100) respiratoryRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(25) @Max(45) temperatureC?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(30) @Max(100) spo2Percent?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0.3) @Max(500) weightKg?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(20) @Max(260) heightCm?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() headCircumCm?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() muacCm?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10) painScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

class DiagnosisDto {
  @ApiProperty() @IsUUID() encounterId!: string;
  @ApiPropertyOptional({ example: 'G43.0' }) @IsOptional() @IsString() @MaxLength(24) code?: string;
  @ApiPropertyOptional({ example: 'ICD10' }) @IsOptional() @IsString() codeSystem?: string;

  @ApiProperty({ example: 'Migrain tanpa aura' })
  @IsString()
  @MinLength(3)
  description!: string;

  @ApiPropertyOptional({ enum: ['PRIMARY', 'SECONDARY', 'COMPLICATION', 'COMORBIDITY'] })
  @IsOptional()
  @IsIn(['PRIMARY', 'SECONDARY', 'COMPLICATION', 'COMORBIDITY'])
  diagnosisRole?: string;

  @ApiPropertyOptional({ enum: ['SUSPECTED', 'PROVISIONAL', 'CONFIRMED', 'RULED_OUT'] })
  @IsOptional()
  @IsIn(['SUSPECTED', 'PROVISIONAL', 'CONFIRMED', 'RULED_OUT'])
  certainty?: string;
}

class OrderDto {
  @ApiProperty() @IsUUID() encounterId!: string;

  @ApiProperty({ enum: ['LABORATORY', 'RADIOLOGY', 'MEDICATION', 'PROCEDURE', 'DIET', 'CONSULTATION', 'THERAPY', 'NURSING'] })
  @IsString()
  orderType!: string;

  @ApiProperty({ example: 'Darah lengkap' })
  @IsString()
  @MaxLength(255)
  orderName!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) orderCode?: string;

  @ApiPropertyOptional({ enum: ['ROUTINE', 'URGENT', 'STAT'] })
  @IsOptional()
  @IsIn(['ROUTINE', 'URGENT', 'STAT'])
  priority?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() targetUnitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() instruction?: string;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Pasien dan Klinis')
@Controller('health')
export class HealthClinicalController {
  constructor(
    private readonly pasien: HealthPatientService,
    private readonly kunjungan: HealthVisitService,
    private readonly identity: CoreIdentityAdapter,
    private readonly izin: TenantPermissionService,
  ) {}

  /**
   * Menyusun konteks akses dari tajuk permintaan.
   *
   * Tujuan penggunaan WAJIB. Menolak permintaan tanpa tujuan terasa merepotkan
   * sampai seseorang harus menjelaskan mengapa ia membuka rekam medis
   * tetangganya, dan jejaknya hanya berkata "READ".
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
          'Akses darurat wajib disertai tajuk X-Break-Glass-Reason sekurang-kurangnya sepuluh huruf. ' +
            'Akses yang tidak dapat ditelaah sama saja dengan tidak dicatat.',
        );
      }

      /*
       * Akses darurat menuntut HAK AKSES tersendiri, bukan hanya alasan.
       *
       * Celah ini ditemukan saat menjalankan naskah bukti: memberi alasan sudah
       * cukup untuk menembus batas hubungan perawatan, sehingga siapa pun yang
       * boleh membaca satu rekam medis dapat membaca SEMUA rekam medis hanya
       * dengan mengetik kalimat. Alasan membuat perbuatannya dapat ditelaah;
       * ia tidak membuat perbuatannya boleh.
       */
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

  // --- Pasien ----------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.READ')
  @Get('patients')
  @ApiOperation({
    summary: 'Mencari pasien',
    description:
      'Wajib menyertakan tajuk X-Purpose-Of-Use. Jawabannya menyebutkan scope: FACILITY_LOCAL — ' +
      'selama indeks lintas fasilitas belum ada, pencarian ini HANYA mencakup fasilitas ini, dan ' +
      'membiarkannya tampak lebih luas akan membuat seseorang menyimpulkan bahwa pasien tidak ' +
      'punya riwayat di tempat lain padahal kita belum melihatnya.',
  })
  async cariPasien(
    @Query('q') q: string | undefined,
    @Query('nik') nik: string | undefined,
    @Query('phone') phone: string | undefined,
    @Query('limit') limit: string | undefined,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, { purpose, facilityId });
    return this.pasien.cari(schema, { q, nik, phone, limit: limit ? Number(limit) : undefined }, ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.READ')
  @Get('patients/:id')
  @ApiOperation({
    summary: 'Membaca satu pasien',
    description: 'Selalu tercatat pada jejak pembacaan, termasuk tujuannya.',
  })
  async ambilPasien(
    @Param('id') id: string,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-break-glass') breakGlass: string,
    @Headers('x-break-glass-reason') reason: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, { purpose, breakGlass, reason, facilityId });
    return this.pasien.ambil(schema, id, ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.CREATE')
  @Post('patients')
  @ApiOperation({
    summary: 'Mendaftarkan pasien baru',
    description:
      'Memeriksa penggandaan LEBIH DAHULU dan menolak bila keyakinannya tinggi, kecuali petugas ' +
      'menegaskan bahwa keduanya orang berbeda. Petugas yang ditanya kehilangan sepuluh detik; ' +
      'yang tidak ditanya membuat rekam medis kedua yang alerginya tidak terlihat selamanya.',
  })
  async daftarkanPasien(
    @Body() dto: DaftarPasienDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, {
      purpose: purpose || 'TREATMENT',
      facilityId: dto.facilityId,
    });
    return this.pasien.daftarkan(schema, dto, ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT_DUPLICATE.READ')
  @Get('patients/duplicates/open')
  @ApiOperation({ summary: 'Dugaan rekam medis ganda yang menunggu telaah' })
  dugaanGanda(@Query('limit') limit: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.pasien.dugaanGanda(requireSchema(user), limit ? Number(limit) : undefined);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT_DUPLICATE.REVIEW')
  @Post('patients/duplicates/:id/not-duplicate')
  @ApiOperation({ summary: 'Menyatakan dua rekam medis bukan orang yang sama' })
  async bukanGanda(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, { purpose: purpose || 'OPERATIONS' });
    return this.pasien.tandaiBukanGanda(schema, id, body.note ?? '', ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.MERGE_PATIENT')
  @Post('patients/merge')
  @ApiOperation({
    summary: 'Menggabungkan dua rekam medis',
    description:
      'Tidak menghapus apa pun: rekam sumber ditandai menunjuk induknya sehingga rujukan lama ' +
      'tetap dapat diikuti dan penggabungannya dapat dibatalkan. Ditolak bila NIK keduanya ' +
      'berbeda — menggabungkannya akan menempelkan riwayat medis satu orang kepada orang lain.',
  })
  async gabungkan(
    @Body() dto: GabungPasienDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, { purpose: purpose || 'OPERATIONS' });
    return this.pasien.gabungkan(schema, dto, ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.UPDATE')
  @Post('patients/:id/allergies')
  @ApiOperation({
    summary: 'Mencatat alergi',
    description:
      'Alergi melekat pada PASIEN, bukan pada kunjungan — alergi yang tercatat pada kunjungan ' +
      'tidak akan terlihat pada kunjungan berikutnya.',
  })
  async catatAlergi(
    @Param('id') id: string,
    @Body() dto: AlergiDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, { purpose: purpose || 'TREATMENT' });
    return this.pasien.catatAlergi(schema, id, dto, ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ACCESS_LOG.READ')
  @Get('patients/:id/access-log')
  @ApiOperation({
    summary: 'Jejak pembacaan rekam medis seorang pasien',
    description: 'Siapa membaca apa, kapan, dan untuk tujuan apa. Tidak dapat diubah maupun dihapus.',
  })
  jejakAkses(
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pasien.jejakAkses(requireSchema(user), id, limit ? Number(limit) : undefined);
  }

  // --- Pendaftaran dan antrean ----------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.CREATE')
  @Post('registrations')
  @ApiOperation({
    summary: 'Mendaftarkan kunjungan',
    description:
      'Menerbitkan nomor pendaftaran dan nomor antrean sekaligus. Status tagihan ditentukan ' +
      'sekali di sini lalu disimpan, supaya tagihan bulan lalu tetap dapat dijelaskan dengan ' +
      'aturan bulan lalu.',
  })
  async daftarKunjungan(
    @Body() dto: DaftarKunjunganDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, {
      purpose: purpose || 'TREATMENT',
      facilityId: dto.facilityId,
    });
    return this.kunjungan.daftarkanKunjungan(schema, dto, ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.READ')
  @Get('queue')
  @ApiOperation({
    summary: 'Antrean yang sedang menunggu',
    description:
      'Prioritas menang atas nomor, tetapi tidak menghapus urutan di dalam prioritas yang sama — ' +
      'lansia yang datang belakangan tetap menunggu lansia yang datang lebih dahulu.',
  })
  antrean(
    @Query('facilityId') facilityId: string,
    @Query('serviceUnitId') serviceUnitId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kunjungan.antrean(requireSchema(user), facilityId, serviceUnitId ?? null);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.UPDATE')
  @Post('queue/call-next')
  @ApiOperation({ summary: 'Memanggil antrean berikutnya' })
  async panggil(
    @Body() body: { facilityId: string; serviceUnitId?: string; counterCode?: string },
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, { purpose: purpose || 'TREATMENT' });
    return this.kunjungan.panggilBerikutnya(
      schema,
      body.facilityId,
      body.serviceUnitId ?? null,
      body.counterCode ?? null,
      ctx,
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BILLING_TIER.READ')
  @Get('billing/daily')
  @ApiOperation({
    summary: 'Rekap penagihan harian',
    description:
      'Menyebutkan jumlah yang tertagih, jumlah seluruhnya, dan sebab pengecualiannya. Selisih ' +
      'yang tidak dapat dijelaskan akan dipersoalkan penyewa.',
  })
  rekapPenagihan(
    @Query('facilityId') facilityId: string,
    @Query('businessDate') businessDate: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kunjungan.rekapPenagihan(requireSchema(user), facilityId, businessDate);
  }

  // --- Kunjungan klinis ------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.UPDATE')
  @Post('encounters')
  @ApiOperation({ summary: 'Memulai kunjungan dari satu pendaftaran' })
  async mulaiKunjungan(
    @Body() dto: MulaiKunjunganDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, { purpose: purpose || 'TREATMENT' });
    return this.kunjungan.mulaiKunjungan(schema, dto, ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.READ')
  @Get('encounters/:id')
  @ApiOperation({ summary: 'Ringkasan kunjungan beserta catatan, diagnosis, dan ordernya' })
  async ringkasan(
    @Param('id') id: string,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-break-glass') breakGlass: string,
    @Headers('x-break-glass-reason') reason: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, { purpose, breakGlass, reason });
    return this.kunjungan.ringkasanKunjungan(schema, id, ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.UPDATE')
  @Post('clinical-notes')
  @ApiOperation({
    summary: 'Menyimpan catatan klinis',
    description:
      'Bila sign: true, catatan langsung ditandatangani dan SESUDAH ITU ISINYA TIDAK DAPAT ' +
      'DIUBAH LAGI — penjaganya ada di basis data, bukan di layanan ini. Perubahan hanya lewat ' +
      'amandemen yang menunjuk catatan aslinya.',
  })
  async catatKlinis(
    @Body() dto: CatatanKlinisDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, { purpose: purpose || 'TREATMENT' });
    return this.kunjungan.catatKlinis(schema, dto, ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.UPDATE')
  @Post('clinical-notes/:id/amend')
  @ApiOperation({
    summary: 'Membuat amandemen atas catatan bertanda tangan',
    description: 'Catatan aslinya tetap terbaca. Alasan wajib sekurang-kurangnya sepuluh huruf.',
  })
  async amandemen(
    @Param('id') id: string,
    @Body() dto: AmandemenDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, { purpose: purpose || 'TREATMENT' });
    return this.kunjungan.amandemenCatatan(schema, id, dto, ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.UPDATE')
  @Post('vital-signs')
  @ApiOperation({
    summary: 'Mencatat tanda vital',
    description:
      'Batasnya adalah batas KEWAJARAN, bukan batas normal. Tekanan 70/40 dengan nadi 140 ' +
      'diterima — itulah pasien yang sedang syok.',
  })
  async tandaVital(
    @Body() dto: TandaVitalDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, { purpose: purpose || 'TREATMENT' });
    return this.kunjungan.catatTandaVital(schema, dto as never, ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.UPDATE')
  @Post('diagnoses')
  @ApiOperation({
    summary: 'Mencatat diagnosis',
    description:
      'Boleh berupa teks sebelum dikodekan. Satu kunjungan hanya boleh punya satu diagnosis utama.',
  })
  async diagnosis(
    @Body() dto: DiagnosisDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, { purpose: purpose || 'TREATMENT' });
    return this.kunjungan.catatDiagnosis(schema, dto, ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.UPDATE')
  @Post('clinical-orders')
  @ApiOperation({ summary: 'Membuat order klinis' })
  async order(
    @Body() dto: OrderDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    const ctx = await this.konteks(schema, user, { purpose: purpose || 'TREATMENT' });
    return this.kunjungan.buatOrder(schema, dto, ctx);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PATIENT.UPDATE')
  @Post('encounters/:id/complete')
  @ApiOperation({ summary: 'Menyelesaikan kunjungan' })
  selesaikan(
    @Param('id') id: string,
    @Body() body: { disposition?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kunjungan.selesaikanKunjungan(
      requireSchema(user),
      id,
      body.disposition ?? null,
    );
  }
}
