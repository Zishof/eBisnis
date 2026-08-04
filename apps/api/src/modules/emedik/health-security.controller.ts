/**
 * Endpoint zona data, telaah break-glass, dan penjaga AI.
 *
 * ## Mengapa sebagian besar jalan di sini TIDAK menuntut X-Purpose-Of-Use
 *
 * Tajuk tujuan penggunaan dipasang pada jalan yang menyentuh data pasien.
 * Jalan di sini menyentuh **penggolongan** dan **telaah** — keduanya
 * berbicara tentang data pasien tanpa memuatnya.
 *
 * Kecualinya satu: `GET /break-glass/queue` mengembalikan `patientId` pada
 * setiap barisnya, sebab penelaah harus tahu rekam medis siapa yang dibuka.
 * Jalan itu menuntut tajuknya.
 *
 * Memasang tajuk pada seluruh jalan tanpa membedakannya akan membuat tajuk itu
 * kehilangan artinya: yang wajib di mana-mana diisi otomatis oleh klien, dan
 * yang diisi otomatis tidak menyatakan apa pun.
 */

import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthenticatedUser, CurrentUser, Permissions } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HealthSecurityService } from './health-security.service';
import { CoreIdentityAdapter } from './adapters/core.adapters';
import { TUJUAN_PENGGUNAAN, ZONA } from './health-security';

const KODE_ZONA = Object.keys(ZONA);
const PUTUSAN = ['JUSTIFIED', 'NOT_JUSTIFIED', 'NEEDS_INVESTIGATION'];

function requireSchema(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(
      ErrorCodes.FORBIDDEN,
      'Akun ini tidak terikat pada satu ruang kerja tenant.',
    );
  }
  return user.schemaName;
}

class TelaahDto {
  @ApiProperty({ description: 'Id baris health_access_log (bigint sebagai teks).' })
  @IsString()
  @MaxLength(32)
  accessLogId!: string;

  @ApiProperty({ enum: PUTUSAN })
  @IsIn(PUTUSAN)
  verdict!: string;

  @ApiProperty({ minLength: 20, description: 'Telaah yang boleh berisi "ok" akan berisi "ok".' })
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  notes!: string;

  @ApiPropertyOptional({
    minLength: 10,
    description: 'WAJIB bila putusannya bukan JUSTIFIED.',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  followUp?: string;
}

class PenyamaranDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  table!: string;

  /*
   * @IsObject WAJIB, dan ketiadaannya bukan sekadar kelalaian gaya.
   *
   * ValidationPipe global berjalan dengan whitelist dan forbidNonWhitelisted:
   * medan TANPA satu pun penanda validasi bukan diloloskan melainkan DITOLAK.
   * Tanpa baris ini seluruh jalan penyamaran mengembalikan 400 untuk setiap
   * permintaan yang sah.
   */
  @ApiProperty({ description: 'Peta kolom → nilai. Kolom yang belum tergolong disebutkan.' })
  @IsObject()
  values!: Record<string, string | null>;
}

class PenjagaAiDto {
  @ApiProperty({ enum: KODE_ZONA })
  @IsIn(KODE_ZONA)
  zone!: string;

  @ApiProperty({ maxLength: 8000 })
  @IsString()
  @MaxLength(8000)
  text!: string;

  @ApiProperty({ isArray: true, description: 'Tenant asal setiap potongan isinya.' })
  @IsArray()
  @IsString({ each: true })
  tenantIds!: string[];

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  feature!: string;
}

@ApiTags('eMedik — Keamanan Data Kesehatan')
@Controller('health/security')
export class HealthSecurityController {
  constructor(
    private readonly keamanan: HealthSecurityService,
    private readonly identity: CoreIdentityAdapter,
  ) {}

  // --- Zona ------------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DATA_ZONE.READ')
  @Get('zones')
  @ApiOperation({
    summary: 'Zona data kesehatan beserta jumlah medan pada masing-masing',
    description:
      'Dibaca dari basis data, bukan dari tetapan pada kode. Zona digolongkan menurut AKIBAT ' +
      'KEBOCORANNYA — tingkat bernomor ditafsirkan sendiri oleh setiap orang yang membacanya.',
  })
  zona(@CurrentUser() user: AuthenticatedUser) {
    return this.keamanan.zona(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DATA_ZONE.READ')
  @Get('fields')
  @ApiOperation({
    summary: 'Penggolongan medan',
    description:
      'Menyertakan keterbatasan yang dinyatakan: penggolongan ini bekerja per KOLOM, sedangkan ' +
      'clinical_note.sensitivity bekerja per BARIS.',
  })
  medan(@Query('table') table: string, @CurrentUser() user: AuthenticatedUser) {
    return this.keamanan.penggolongan(requireSchema(user), table || undefined);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DATA_ZONE.READ')
  @Post('mask')
  @ApiOperation({
    summary: 'Menyamarkan sekumpulan nilai menurut penggolongan yang tercatat',
    description:
      'Penyamaran MENYISAKAN BENTUKNYA: "Tono Suryo" menjadi "T*** S****", bukan ' +
      '"[DISAMARKAN]". Petugas yang membandingkan dua daftar perlu tahu bahwa keduanya menunjuk ' +
      'orang yang berbeda. Kolom yang belum tergolong dikembalikan apa adanya DAN disebutkan.',
  })
  samarkan(@Body() dto: PenyamaranDto, @CurrentUser() user: AuthenticatedUser) {
    if (!dto.values || typeof dto.values !== 'object' || Array.isArray(dto.values)) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'values harus berupa peta kolom.');
    }
    return this.keamanan.samarkan(requireSchema(user), dto.table, dto.values);
  }

  // --- Tujuan penggunaan -----------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DATA_ZONE.READ')
  @Get('purposes')
  @ApiOperation({
    summary: 'Daftar tujuan penggunaan — TERTUTUP',
    description:
      'Tujuan bebas-teks akan diisi "kerja" atau "cek", dan jejak akses yang tujuannya "cek" ' +
      'tidak dapat ditelaah siapa pun.',
  })
  tujuan() {
    return this.keamanan.katalogTujuan();
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DATA_ZONE.READ')
  @Get('purposes/:kode/check')
  @ApiOperation({
    summary: 'Memeriksa satu tujuan penggunaan beserta syarat tambahannya',
    description:
      'RESEARCH menuntut rujukan persetujuan etik; EMERGENCY hanya sah bersama break-glass. ' +
      'Keduanya sering dipakai sebagai jalan pintas justru karena ia yang paling jarang ' +
      'diperiksa.',
  })
  periksaTujuan(
    @Param('kode') kode: string,
    @Query('ethicsApprovalRef') ethics: string,
    @Query('breakGlass') breakGlass: string,
  ) {
    return this.keamanan.periksaTujuanPenggunaan(kode, ethics || undefined, breakGlass === 'true');
  }

  // --- Telaah break-glass ----------------------------------------------------

  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'X-Purpose-Of-Use',
    required: true,
    description: `Wajib: jalan ini mengembalikan patientId. Salah satu dari ${TUJUAN_PENGGUNAAN.join(', ')}.`,
  })
  @Permissions('HEALTH_BREAK_GLASS.READ')
  @Get('break-glass/queue')
  @ApiOperation({
    summary: 'Antrean telaah, terurut menurut yang paling mencurigakan',
    description:
      'BUKAN menurut waktu. Antrean yang diurut waktu akan membuat yang paling mencurigakan ' +
      'tenggelam di bawah ratusan akses yang wajar — dan yang menelaahnya berhenti pada halaman ' +
      'kedua. Jalan ini menuntut X-Purpose-Of-Use sebab ia menyebutkan rekam medis siapa yang ' +
      'dibuka.',
  })
  antrean(
    @Headers('x-purpose-of-use') tujuan: string,
    @Query('limit') limit: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.keamanan.periksaTujuanPenggunaan(tujuan ?? null);
    const batas = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return this.keamanan.antrean(requireSchema(user), batas);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BREAK_GLASS.APPROVE')
  @Post('break-glass/review')
  @ApiOperation({
    summary: 'Mencatat telaah akses darurat',
    description:
      'Telaah TIDAK menyetujui aksesnya — aksesnya sudah terjadi dan tidak pernah dapat ' +
      'ditarik kembali. Tidak seorang pun menelaah aksesnya sendiri: ditegakkan trigger pada ' +
      'basis data, bukan di lapisan aplikasi, sebab penegakan di aplikasi terlewat oleh setiap ' +
      'jalan yang tidak melewatinya. Tambah-saja: tidak dapat diubah dan tidak dapat dihapus.',
  })
  async telaah(@Body() dto: TelaahDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    const penelaah = await this.identity.subjectId(schema, user.userId);
    return this.keamanan.catatTelaah(schema, dto, penelaah);
  }

  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'X-Purpose-Of-Use',
    required: true,
    description: 'Wajib: jalan ini mengembalikan patientId.',
  })
  @Permissions('HEALTH_BREAK_GLASS.READ')
  @Get('break-glass/reviews')
  @ApiOperation({ summary: 'Riwayat telaah' })
  riwayat(
    @Headers('x-purpose-of-use') tujuan: string,
    @Query('limit') limit: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.keamanan.periksaTujuanPenggunaan(tujuan ?? null);
    const batas = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return this.keamanan.riwayatTelaah(requireSchema(user), batas);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_BREAK_GLASS.READ')
  @Get('break-glass/summary')
  @ApiOperation({
    summary: 'Berapa akses darurat yang belum ditelaah',
    description:
      'Angka pending yang terus naik berarti sifat kedua break-glass sudah berhenti berlaku — ' +
      'dan "tidak pernah ditolak" tanpa "selalu ditelaah" adalah pintu belakang. Agregat: tidak ' +
      'menyebut satu pasien pun, jadi tidak menuntut X-Purpose-Of-Use.',
  })
  ringkasan(@CurrentUser() user: AuthenticatedUser) {
    return this.keamanan.ringkasanBreakGlass(requireSchema(user));
  }

  // --- Penjaga AI ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_AI_GUARD.READ')
  @Post('ai/check')
  @ApiOperation({
    summary: 'Memeriksa apakah suatu permintaan boleh sampai ke AI',
    description:
      'Tiga penjaga, dan yang ketiga paling sering terlupakan: zonanya boleh; teksnya bersih ' +
      'sesudah penyamaran; dan SELURUH isinya berasal dari satu tenant. Permintaan yang ' +
      'menggabungkan dua tenant tidak pernah sah sekalipun sudah disamarkan — yang bocor bukan ' +
      'hanya nilainya melainkan fakta bahwa keduanya dibandingkan. Teksnya TIDAK disimpan.',
  })
  async periksaAi(@Body() dto: PenjagaAiDto, @CurrentUser() user: AuthenticatedUser) {
    const schema = requireSchema(user);
    const aktor = await this.identity.subjectId(schema, user.userId);
    return this.keamanan.periksaAi(schema, dto, aktor);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_AI_GUARD.READ')
  @Get('ai/log')
  @ApiOperation({
    summary: 'Permintaan yang TIDAK pernah sampai ke AI Gateway bersama',
    description:
      'Seorang petugas yang tiga puluh kali mencoba mengirim rekam medis ke model bahasa tidak ' +
      'muncul sama sekali pada log gateway, dan tampak sebagai pengguna yang tidak pernah ' +
      'memakai AI. Justru itu yang perlu dilihat orang.',
  })
  logAi(@Query('limit') limit: string, @CurrentUser() user: AuthenticatedUser) {
    const batas = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return this.keamanan.riwayatPenjagaAi(requireSchema(user), batas);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_AI_GUARD.READ')
  @Get('ai/forbidden-actions')
  @ApiOperation({
    summary: 'Tindakan yang tidak pernah dilakukan AI secara otomatis',
    description:
      'Daftar TERTUTUP. Yang dapat dilakukan AI adalah menyiapkan, menjelaskan, dan ' +
      'mengusulkan — dan ketiganya menunggu seseorang menekan tombolnya.',
  })
  laranganAi() {
    return this.keamanan.katalogLaranganAi();
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_AI_GUARD.READ')
  @Get('ai/forbidden-actions/:kode/check')
  @ApiOperation({ summary: 'Memeriksa satu tindakan terhadap daftar larangan AI' })
  periksaTindakan(@Param('kode') kode: string) {
    return this.keamanan.periksaTindakanAi(kode);
  }

  // --- Isolasi ---------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DATA_ZONE.READ')
  @Get('isolation')
  @ApiOperation({
    summary: 'Isolasi antar-tenant dan antar-vertical',
    description:
      'Memeriksa pula apakah ada tabel kesehatan yang bocor ke skema public. public tidak ' +
      'pernah menjadi cadangan search_path, dan tabel kesehatan yang muncul di sana berarti ' +
      'sebuah migrasi berjalan tanpa skema tenant — kegagalan yang tidak menimbulkan galat dan ' +
      'membuat satu tabel dapat dibaca setiap tenant.',
  })
  isolasi(@Query('schema') schema: string, @CurrentUser() user: AuthenticatedUser) {
    const milikToken = requireSchema(user);
    /*
     * Bila pemanggilnya menyebut skema, ia HARUS sama dengan skema pada token.
     *
     * Penjaga sesungguhnya ada di resolver tenant milik Core, yang menetapkan
     * search_path sebelum satu kueri pun berjalan. Yang di sini dapat
     * DIPERLIHATKAN — supaya naskah bukti dapat menunjukkan penolakannya,
     * bukan sekadar mempercayai bahwa lapisan bawah bekerja.
     */
    if (schema) this.keamanan.periksaRuangKerja(schema, milikToken);
    return this.keamanan.isolasiVertical(milikToken);
  }

  @ApiBearerAuth('access-token')
  @Permissions('HEALTH_DATA_ZONE.READ')
  @Get('posture')
  @ApiOperation({
    summary: 'Sikap keamanan: satu jawaban atas "apakah pertahanannya berdiri"',
    description:
      'Seluruh angkanya dibaca dari basis data. Tidak satu pun dihitung dari tetapan pada kode ' +
      '— ringkasan yang membaca tetapannya sendiri akan selalu berkata semuanya baik.',
  })
  sikap(@CurrentUser() user: AuthenticatedUser) {
    return this.keamanan.sikapKeamanan(requireSchema(user));
  }
}
