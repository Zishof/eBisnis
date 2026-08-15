/**
 * Endpoint rawat inap: penerimaan, perpindahan, pemulangan, dan keperawatan.
 *
 * Hak aksesnya dipisah menjadi menerima, memindahkan, memulangkan, dan mencatat
 * pengamatan. Memulangkan adalah keputusan klinis, bukan penutupan berkas —
 * dan yang menutup berkas tidak selalu yang boleh memutuskan.
 */

import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
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
import { TenantPermissionService } from '../auth/tenant-permission.service';
import { HealthInpatientService } from './health-inpatient.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import { samarkanPenghuniTempatTidur } from './health-inpatient';
import type { CaraPulang, JenisIsolasi, StatusTempatTidur } from './health-inpatient';
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

const ISOLASI = ['NONE', 'CONTACT', 'DROPLET', 'AIRBORNE', 'PROTECTIVE'];
const CARA_PULANG = ['ROUTINE', 'TRANSFER_OUT', 'AGAINST_MEDICAL_ADVICE', 'ABSCONDED', 'DECEASED'];
const STATUS_TT = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'MAINTENANCE', 'CLOSED'];

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

class TerimaDto {
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
  serviceUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  admissionReason?: string;

  @ApiPropertyOptional({
    enum: ISOLASI,
    description:
      'Kebutuhan isolasi pasien. Menentukan kamar mana yang boleh dipakai; kamar yang tidak ' +
      'mampu menampungnya ditolak sekalipun kosong.',
  })
  @IsOptional()
  @IsIn(ISOLASI)
  isolationType?: JenisIsolasi;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  classCode?: string;

  @ApiPropertyOptional({ description: 'Bila kosong, tempat tidur dipilihkan sistem.' })
  @IsOptional()
  @IsUUID()
  bedId?: string;
}

class PindahDto {
  @ApiProperty()
  @IsUUID()
  bedId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

class PulangkanDto {
  @ApiProperty({ enum: CARA_PULANG })
  @IsIn(CARA_PULANG)
  disposition!: CaraPulang;

  @ApiPropertyOptional({ description: 'Wajib untuk pulang paksa dan pasien menghilang.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional({ description: 'Wajib bila caranya DECEASED.' })
  @IsOptional()
  @IsString()
  deathAt?: string;
}

class RingkasanDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  dischargeDiagnosis!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  admissionDiagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  hospitalCourse?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  procedures?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  dischargeMedications?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  followUpPlan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  diet?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  activity?: string;

  @ApiPropertyOptional({
    description:
      'Tanda-tanda yang menuntut pasien kembali. Bagian yang paling sering dilewati dan paling ' +
      'sering dibutuhkan.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  warningSigns?: string;
}

class PengamatanDto {
  @ApiProperty()
  @IsUUID()
  admissionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  respiratoryRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  spo2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  systolicBp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  diastolicBp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  heartRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional({ enum: ['ALERT', 'VOICE', 'PAIN', 'UNRESPONSIVE'] })
  @IsOptional()
  @IsIn(['ALERT', 'VOICE', 'PAIN', 'UNRESPONSIVE'])
  consciousness?: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  painScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

class StatusTempatTidurDto {
  @ApiProperty({ enum: STATUS_TT })
  @IsIn(STATUS_TT)
  status!: StatusTempatTidur;
}

// --- Controller --------------------------------------------------------------

@ApiTags('eMedik — Rawat Inap')
@Controller('health/inpatient')
export class HealthInpatientController {
  constructor(
    private readonly inap: HealthInpatientService,
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

  // --- Penerimaan dan perpindahan -------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ADMISSION.ADMIT')
  @Post('admissions')
  @ApiOperation({
    summary: 'Menerima pasien rawat inap',
    description:
      'Penerimaan dan penempatan tempat tidur dalam satu transaksi. Penerimaan tanpa tempat ' +
      'tidur menghasilkan pasien yang tercatat dirawat tetapi tidak berada di mana pun — dan ' +
      'perawat yang mencarinya akan menemukannya di lorong. Bila tidak ada tempat tidur yang ' +
      'layak, sebab tiap penolakan ikut dilaporkan.',
  })
  async terima(
    @Body() dto: TerimaDto,
    @Headers('x-purpose-of-use') purpose: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.inap.terima(
      schema,
      dto,
      await this.konteks(schema, user, { purpose, facilityId: dto.facilityId }),
    );
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ADMISSION.UPDATE')
  @Post('admissions/:id/transfer')
  @ApiOperation({
    summary: 'Memindahkan pasien ke tempat tidur lain',
    description:
      'Yang lama ditinggalkan dan yang baru ditempati dalam satu transaksi. Aturan penempatan ' +
      'tetap berlaku: perpindahan bukan celah untuk melewati pemeriksaan yang sama.',
  })
  async pindah(
    @Param('id') id: string,
    @Body() dto: PindahDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.inap.pindah(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  // --- Pemulangan ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ADMISSION.DISCHARGE')
  @Post('admissions/:id/discharge')
  @ApiOperation({
    summary: 'Memulangkan pasien',
    description:
      'Nilai kritis yang belum diterima klinisi MENAHAN pemulangan — kecuali pada kematian, di ' +
      'mana menahannya tidak lagi menolong siapa pun. Pulang paksa tidak ditolak: menolaknya ' +
      'berarti menahan orang di rumah sakit di luar kehendaknya, dan itu bukan wewenang sistem. ' +
      'Yang dituntut adalah alasannya tercatat.',
  })
  async pulangkan(
    @Param('id') id: string,
    @Body() dto: PulangkanDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.inap.pulangkan(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ADMISSION.UPDATE')
  @Post('admissions/:id/summary')
  @ApiOperation({
    summary: 'Menulis ringkasan pulang',
    description:
      'Pasien yang pulang tanpa ringkasan membawa riwayat perawatannya hanya di dalam ' +
      'ingatannya sendiri, dan dokter berikutnya akan memulai dari nol.',
  })
  async ringkasan(
    @Param('id') id: string,
    @Body() dto: RingkasanDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.inap.tulisRingkasan(schema, id, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  // --- Keperawatan -----------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_NURSING.CREATE')
  @Post('observations')
  @ApiOperation({
    summary: 'Mencatat pengamatan keperawatan',
    description:
      'Skor peringatan dini dihitung peladen dan DISIMPAN, bukan dihitung ulang saat dibaca — ' +
      'rumusnya kelak disesuaikan, dan pengamatan bulan lalu harus tetap dapat dijelaskan ' +
      'dengan rumus bulan lalu. Tanda vital yang tidak diukur dilaporkan sebagai tidak diukur, ' +
      'bukan dianggap normal.',
  })
  async pengamatan(
    @Body() dto: PengamatanDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.inap.catatPengamatan(schema, dto, await this.konteks(schema, user, { purpose, facilityId }));
  }

  // --- Papan -----------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_ADMISSION.READ')
  @Get('board')
  @ApiOperation({
    summary: 'Papan bangsal',
    description: 'Siapa di tempat tidur mana, dan siapa yang pengamatannya sudah lewat waktunya.',
  })
  papan(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    return this.inap.papanBangsal(requireSchema(user), facilityId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BED.READ')
  @Get('beds')
  @ApiOperation({
    summary: 'Tempat tidur beserta keadaannya',
    description:
      'Nama penghuni dan nomor rawat inap hanya disertakan bagi pemegang HEALTH_ADMISSION.READ. ' +
      'Pengurus sarana memerlukan tempat tidurnya, bukan orang yang menempatinya.',
  })
  async tempatTidur(@Query('facilityId') facilityId: string, @CurrentUser() user: AuthenticatedUser) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    const schema = requireSchema(user);
    const baris = await this.inap.daftarTempatTidur(schema, facilityId);

    /*
     * Daftar tempat tidur mengembalikan nama penghuninya, dan HEALTH_BED.READ
     * dipegang pula oleh peran yang sengaja DITOLAK indeks pasien maupun papan
     * bangsal — administrator eMedik salah satunya.
     *
     * Akibatnya pintu depan terkunci sementara pintu samping terbuka: UAT
     * persona memperlihatkan administrator menerima 403 pada /health/patients
     * lalu memperoleh nama lengkap, nomor rawat inap, dan letak kamar dari
     * jalan ini — termasuk bahwa seseorang berada di kamar isolasi, yang
     * dengan sendirinya sudah menyatakan sesuatu yang klinis.
     *
     * Yang dibuang hanya identitas penghuninya. Kode tempat tidur, kamar,
     * status, kelas rawat, dan waktu pembersihan tetap utuh, sebab itulah yang
     * diperlukan pengurus sarana. Peran yang memang mengurus pasien — perawat,
     * petugas bangsal, direktur — seluruhnya memegang HEALTH_ADMISSION.READ,
     * sehingga tidak ada pekerjaan yang hilang karena penyamaran ini.
     */
    const kurang = await this.izin.findMissing(schema, user.userId, ['HEALTH_ADMISSION.READ'], {
      isDemo: user.isDemo,
      activeRoleId: user.activeRoleId,
    });
    return samarkanPenghuniTempatTidur(baris, kurang.length === 0);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BED.UPDATE')
  @Post('beds/:id/status')
  @ApiOperation({
    summary: 'Mengubah status tempat tidur',
    description:
      'Tempat tidur yang baru ditinggalkan TIDAK dapat langsung dinyatakan kosong; ia wajib ' +
      'melewati pembersihan. Menempatkan pasien baru di tempat tidur yang belum dibersihkan ' +
      'adalah cara paling langsung memindahkan infeksi dari pasien yang sudah pulang kepada ' +
      'pasien yang baru masuk.',
  })
  async ubahStatus(
    @Param('id') id: string,
    @Body() dto: StatusTempatTidurDto,
    @Headers('x-purpose-of-use') purpose: string,
    @Headers('x-facility-id') facilityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.inap.ubahStatusTempatTidur(
      schema,
      id,
      dto.status,
      await this.konteks(schema, user, { purpose, facilityId }),
    );
  }
}
