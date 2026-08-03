/**
 * Endpoint portal pasien dan website fasilitas.
 *
 * ## Yang harus diperhatikan pada setiap jalan portal di bawah
 *
 * **Tidak satu pun di antaranya mengambil `patientId` dari kueri, jalur, atau
 * badan permintaan.** Yang dipakai adalah `user.userId` dari token, dan pasien
 * mana yang dibaca ditentukan layanan dengan membaca `patient_portal_account`.
 *
 * `subjectPatientId` yang ada pada beberapa jalan bukan pengecualiannya: ia
 * **pilihan di antara yang sudah dimiliki tokennya**, dicocokkan dengan daftar
 * perwalian sebelum dipakai. Mengirim nomor pasien lain menghasilkan 403 dan
 * satu baris pada jejak penolakan — bukan data orang itu.
 *
 * ## Dua kelompok jalan yang sengaja terpisah
 *
 * ```
 * /health/portal/**     dibuka PASIEN, identitas dari token
 * /health/portal-admin/** dibuka PETUGAS, memakai mesin hak akses menu
 * /health/public/**     dibuka SIAPA SAJA, tanpa masuk sama sekali
 * ```
 *
 * Menyatukannya akan membuat satu kekeliruan pada penjaga rute memberi pasien
 * jalan petugas — dan penjaga rute adalah tempat kekeliruan paling sering
 * terjadi.
 */

import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  AuthenticatedOnly,
  AuthenticatedUser,
  CurrentUser,
  Permissions,
  Public,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthPortalService } from './health-portal.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import type { JenisKonten } from './health-portal';

const JENIS_KONTEN = [
  'FACILITY_PROFILE',
  'DOCTOR',
  'SERVICE',
  'SCHEDULE',
  'ARTICLE',
  'ANNOUNCEMENT',
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

class JanjiDto {
  @ApiPropertyOptional({
    description:
      'Pilihan di antara pasien yang sudah dimiliki token Anda — BUKAN jawabannya. Nomor di ' +
      'luar daftar perwalian Anda menghasilkan 403.',
  })
  @IsOptional()
  @IsUUID()
  subjectPatientId?: string;

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

  @ApiProperty({ example: '2026-08-15T09:00:00Z' })
  @IsString()
  scheduledAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  chiefComplaint?: string;
}

class BatalDto {
  @ApiProperty({ minLength: 3 })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

class AkunDto {
  @ApiProperty()
  @IsUUID()
  patientId!: string;

  @ApiProperty({ description: 'Pengguna platform yang akan memiliki akun ini.' })
  @IsUUID()
  platformUserId!: string;
}

class VerifikasiDto {
  @ApiProperty({ enum: ['IN_PERSON_ID', 'VIDEO_CALL', 'REGISTERED_LETTER', 'OTHER'] })
  @IsIn(['IN_PERSON_ID', 'VIDEO_CALL', 'REGISTERED_LETTER', 'OTHER'])
  method!: string;
}

class LepasHasilDto {
  @ApiPropertyOptional({ description: 'WAJIB true bila hasilnya bertanda KRITIS.' })
  @IsOptional()
  patientContacted?: boolean;

  @ApiPropertyOptional({ minLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  contactNote?: string;
}

class KontenDto {
  @ApiProperty()
  @IsUUID()
  facilityId!: string;

  @ApiProperty({ enum: JENIS_KONTEN })
  @IsIn(JENIS_KONTEN)
  contentKind!: JenisKonten;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  slug!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceUnitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class TarikDto {
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}

// --- Portal pasien -----------------------------------------------------------

/*
 * SELURUH RUTE DI BAWAH DITANDAI @AuthenticatedOnly, BUKAN @Permissions.
 *
 * Bukan kelalaian, dan audit rute pada `route-authorization.audit.ts` menuntut
 * setiap rute menyatakan penandanya — ia menolak menyalakan aplikasi bila ada
 * yang lupa. Yang dipilih di sini adalah @AuthenticatedOnly, sebab pasien
 * memang TIDAK PUNYA PERAN pada mesin hak akses menu: memberinya satu peran di
 * sana berarti satu kekeliruan konfigurasi memberinya hak yang dimiliki
 * petugas.
 *
 * Yang menjaga rute ini bukan hak akses menu melainkan `patient_portal_account`
 * — dan penjaga itu lebih sempit: ia menentukan pasien MANA yang dibaca, bukan
 * sekadar boleh atau tidak.
 */
@ApiTags('eMedik — Portal Pasien')
@Controller('health/portal')
export class HealthPortalController {
  constructor(private readonly portal: HealthPortalService) {}

  /**
   * Sidik jari alamat pemanggil, untuk mengenali penolakan beruntun.
   *
   * Disidik, bukan disimpan: alamat IP adalah data pribadi, dan yang
   * dibutuhkan hanyalah kemampuan mengenali sumber yang sama.
   */
  private ip(req: { ip?: string; headers?: Record<string, unknown> }): string | null {
    const maju = req.headers?.['x-forwarded-for'];
    const alamat = typeof maju === 'string' ? maju.split(',')[0].trim() : req.ip;
    return this.portal.hashIp(alamat);
  }

  @ApiBearerAuth('access-token')
  @AuthenticatedOnly()
  @Get('me')
  @ApiOperation({
    summary: 'Siapa saja yang boleh dilihat akun ini',
    description:
      'Daftarnya datang dari token. Pasien di luar daftar ini tidak dapat dibuka akun ini, ' +
      'berapa pun nomor yang dikirimkan.',
  })
  siapa(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.siapaSaja(requireSchema(user), user.userId);
  }

  @ApiBearerAuth('access-token')
  @AuthenticatedOnly()
  @Get('appointments')
  @ApiOperation({ summary: 'Janji temu saya' })
  janji(
    @Query('subjectPatientId') subjectPatientId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: never,
  ) {
    return this.portal.janjiSaya(
      requireSchema(user),
      user.userId,
      subjectPatientId ?? null,
      this.ip(req),
    );
  }

  @ApiBearerAuth('access-token')
  @AuthenticatedOnly()
  @Post('appointments')
  @ApiOperation({ summary: 'Membuat janji temu' })
  buatJanji(@Body() dto: JanjiDto, @CurrentUser() user: AuthenticatedUser, @Req() req: never) {
    return this.portal.buatJanji(requireSchema(user), user.userId, dto, this.ip(req));
  }

  @ApiBearerAuth('access-token')
  @AuthenticatedOnly()
  @Post('appointments/:id/cancel')
  @ApiOperation({
    summary: 'Membatalkan janji temu',
    description:
      'Portal yang menyulitkan pembatalan menghasilkan bangku kosong yang tidak diketahui siapa ' +
      'pun — dan bangku kosong yang tidak diketahui lebih merugikan daripada pembatalan mendadak.',
  })
  batalkan(
    @Param('id') id: string,
    @Body() dto: BatalDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: never,
  ) {
    return this.portal.batalkanJanji(
      requireSchema(user),
      user.userId,
      id,
      dto.reason,
      this.ip(req),
    );
  }

  @ApiBearerAuth('access-token')
  @AuthenticatedOnly()
  @Get('queue')
  @ApiOperation({
    summary: 'Antrean saya hari ini',
    description: 'Nomor dan perkiraan waktu — bukan nama orang lain.',
  })
  antrean(
    @Query('subjectPatientId') subjectPatientId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: never,
  ) {
    return this.portal.antreanSaya(
      requireSchema(user),
      user.userId,
      subjectPatientId ?? null,
      this.ip(req),
    );
  }

  @ApiBearerAuth('access-token')
  @AuthenticatedOnly()
  @Get('lab-results')
  @ApiOperation({
    summary: 'Hasil laboratorium saya',
    description:
      'Yang belum diverifikasi dan yang bertanda KRITIS tidak menampilkan angkanya — tetapi ' +
      'barisnya tetap muncul beserta pesannya, supaya Anda tahu pemeriksaannya sudah dikerjakan.',
  })
  hasil(
    @Query('subjectPatientId') subjectPatientId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: never,
  ) {
    return this.portal.hasilSaya(
      requireSchema(user),
      user.userId,
      subjectPatientId ?? null,
      this.ip(req),
    );
  }

  @ApiBearerAuth('access-token')
  @AuthenticatedOnly()
  @Get('visits')
  @ApiOperation({ summary: 'Ringkasan kunjungan saya' })
  kunjungan(
    @Query('subjectPatientId') subjectPatientId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: never,
  ) {
    return this.portal.ringkasanKunjunganSaya(
      requireSchema(user),
      user.userId,
      subjectPatientId ?? null,
      this.ip(req),
    );
  }

  @ApiBearerAuth('access-token')
  @AuthenticatedOnly()
  @Get('prescriptions')
  @ApiOperation({ summary: 'Resep saya' })
  resep(
    @Query('subjectPatientId') subjectPatientId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: never,
  ) {
    return this.portal.resepSaya(
      requireSchema(user),
      user.userId,
      subjectPatientId ?? null,
      this.ip(req),
    );
  }
}

// --- Sisi petugas ------------------------------------------------------------

@ApiTags('eMedik — Pengelolaan Portal')
@Controller('health/portal-admin')
export class HealthPortalAdminController {
  constructor(
    private readonly portal: HealthPortalService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  private aktor(schema: string, user: AuthenticatedUser) {
    return this.identity.subjectId(schema, user.userId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PORTAL_ACCOUNT.CREATE')
  @Post('accounts')
  @ApiOperation({
    summary: 'Membuat akun portal',
    description:
      'Akun lahir PENDING dan belum dapat membuka apa pun. Satu akun menaut tepat satu pasien; ' +
      'wali diselesaikan lewat perwalian, bukan lewat akun ganda.',
  })
  async buatAkun(@Body() dto: AkunDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.portal.buatAkun(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PORTAL_ACCOUNT.VERIFY')
  @Post('accounts/:id/verify')
  @ApiOperation({
    summary: 'Memverifikasi identitas pemohon dan mengaktifkan akun',
    description:
      'Akun portal yang dibuat tanpa verifikasi tatap muka adalah rekam medis yang diserahkan ' +
      'kepada siapa pun yang mengetahui tanggal lahir seseorang.',
  })
  async verifikasi(
    @Param('id') id: string,
    @Body() dto: VerifikasiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.portal.verifikasiAkun(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_PORTAL_RELEASE.RELEASE')
  @Post('lab-results/:id/release')
  @ApiOperation({
    summary: 'Melepas hasil laboratorium ke portal',
    description:
      'Hasil bertanda KRITIS hanya dilepas sesudah pasiennya dihubungi. Melepasnya tanpa ' +
      'menghubungi lebih dahulu adalah menyerahkan kabar buruk kepada layar telepon — dan layar ' +
      'telepon tidak dapat menjawab pertanyaan.',
  })
  async lepas(
    @Param('id') id: string,
    @Body() dto: LepasHasilDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.portal.lepasHasil(schema, id, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_WEB_CONTENT.CREATE')
  @Post('web-content')
  @ApiOperation({
    summary: 'Menyusun konten website',
    description:
      'Diperiksa dua kali: nama medannya, dan isi teksnya. Website dibaca tanpa masuk sama ' +
      'sekali; satu nomor rekam medis yang lolos tidak dapat ditarik kembali.',
  })
  async simpanKonten(@Body() dto: KontenDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.portal.simpanKonten(schema, dto, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_WEB_CONTENT.PUBLISH')
  @Post('web-content/:id/publish')
  @ApiOperation({ summary: 'Menerbitkan konten' })
  async terbitkan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return this.portal.terbitkanKonten(schema, id, await this.aktor(schema, user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_WEB_CONTENT.UNPUBLISH')
  @Post('web-content/:id/unpublish')
  @ApiOperation({
    summary: 'Menarik konten',
    description: 'Wajib beralasan. Yang menariknya sedang tergesa.',
  })
  async tarik(
    @Param('id') id: string,
    @Body() dto: TarikDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const schema = requireSchema(user);
    return this.portal.tarikKonten(schema, id, dto.reason, await this.aktor(schema, user));
  }
}

// --- Website publik ----------------------------------------------------------

@ApiTags('eMedik — Website Publik')
@Controller('health/public')
export class HealthPublicWebController {
  constructor(private readonly portal: HealthPortalService) {}

  /*
   * Terbuka tanpa masuk sama sekali — dan karena itu ia hanya membaca
   * `facility_web_content`, tabel yang tidak punya satu pun kolom pasien
   * maupun kunci asing ke tabel klinis. Yang tidak dapat disimpan tidak dapat
   * dibocorkan.
   */
  @Public()
  @Get(':schema/website')
  @ApiOperation({
    summary: 'Website fasilitas',
    description:
      'Dibaca tanpa masuk. Hanya membaca tabel konten — tabel yang tidak punya satu pun kolom ' +
      'pasien.',
  })
  website(
    @Param('schema') schema: string,
    @Query('facilityId') facilityId: string,
    @Query('kind') kind: string | undefined,
  ) {
    if (!facilityId) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Parameter facilityId wajib diisi.');
    }
    if (!/^[a-z][a-z0-9_]{1,62}$/.test(schema)) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Nama ruang kerja tidak sah.');
    }
    return this.portal.websitePublik(schema, facilityId, kind);
  }
}
