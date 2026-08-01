/**
 * Modul koperasi (eKoperasi).
 *
 * Seluruh endpoint berada di bawah `/cooperative/*` sesuai batas namespace pada
 * panduan koordinasi §4. Penjaga hak akses memakai awalan `COOPERATIVE_*`.
 *
 * **Catatan penting sampai IR-004 disetujui:** menu dan hak akses koperasi
 * belum disemai ke basis data, sehingga penjaga `@Permissions('COOPERATIVE_*')`
 * akan menolak setiap permintaan dari penyewa sungguhan. Itu keadaan yang
 * benar, bukan yang perlu diakali — melonggarkan penjaga "sementara" akan
 * menghasilkan kelonggaran yang tetap tinggal setelah IR disetujui.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  Patch,
  Post,
  Headers,
  Ip,
  type OnModuleInit,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsPositive,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CooperativeProfileService } from './cooperative-profile.service';
import { CooperativePortalService } from './cooperative-portal.service';
import { CooperativePublicService } from './public/cooperative-public.service';
import { CooperativePosAdapter } from './adapters/pos.adapter';
import { MemberBalanceService } from './payment/member-balance.service';
import { CooperativeSampleService } from './sample/cooperative-sample.service';
import { CooperativeAccountingEventService } from './accounting/cooperative-accounting-event.service';
import { COOPERATIVE_EVENT_CATALOG } from './accounting/cooperative-events.catalog';
import { AccountingEventCatalogRegistry } from '../accounting/event-catalog.registry';
import { AccountingModule } from '../accounting/accounting.module';
import { MemberBalancePaymentHandler } from './payment/member-balance-payment.handler';
import { ExternalPaymentRegistry } from '../pos/external-payment.registry';
import { PosModule } from '../pos/pos.module';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import {
  AuthenticatedUser,
  BlockDemo,
  CurrentUser,
  Permissions,
  Public,
} from '../../common/decorators';
import { Throttle } from '@nestjs/throttler';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  COOPERATIVE_LEVELS,
  COOPERATIVE_STATUSES,
  MEMBERSHIP_SCOPES,
  type CooperativeStatus,
} from './cooperative-profile';
import { COMPLAINT_CATEGORIES } from './cooperative-portal';

function requireSchema(user: AuthenticatedUser): string {
  if (!user.schemaName) {
    throw AppError.forbidden(
      ErrorCodes.FORBIDDEN,
      'Konteks ruang kerja tidak ditemukan pada sesi Anda.',
    );
  }
  return user.schemaName;
}

// --- DTO --------------------------------------------------------------------

class BuatKoperasiDto {
  @ApiProperty({ example: 'Koperasi Serba Usaha Al-Bahjah' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'KSU Al-Bahjah' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  shortName?: string;

  @ApiPropertyOptional({
    description: 'Alamat <slug>.ekoperasi.id. Bila kosong, disusun dari nama koperasi.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(63)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cooperativeTypeId?: string;

  @ApiPropertyOptional({ enum: COOPERATIVE_LEVELS })
  @IsOptional()
  @IsIn([...COOPERATIVE_LEVELS])
  level?: string;

  @ApiPropertyOptional({ enum: MEMBERSHIP_SCOPES })
  @IsOptional()
  @IsIn([...MEMBERSHIP_SCOPES])
  membershipScope?: string;

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
}

class PerbaruiKoperasiDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) shortName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() cooperativeTypeId?: string;
  @ApiPropertyOptional({ enum: COOPERATIVE_LEVELS })
  @IsOptional() @IsIn([...COOPERATIVE_LEVELS]) level?: string;
  @ApiPropertyOptional({ enum: MEMBERSHIP_SCOPES })
  @IsOptional() @IsIn([...MEMBERSHIP_SCOPES]) membershipScope?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() establishmentDate?: string;
  @ApiPropertyOptional({ example: '518/BH/XIV.7/2026' })
  @IsOptional() @IsString() @MaxLength(120) legalEntityNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() legalEntityDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) taxNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(48) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) website?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() logoFileId?: string;
}

class UbahStatusDto {
  @ApiProperty({ enum: COOPERATIVE_STATUSES })
  @IsIn([...COOPERATIVE_STATUSES])
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class DokumenDto {
  @ApiProperty({ example: 'ESTABLISHMENT_DEED' })
  @IsIn([
    'ESTABLISHMENT_DEED', 'AMENDMENT_DEED', 'LEGAL_ENTITY_DECISION',
    'TAX_IDENTITY', 'BUSINESS_LICENSE', 'DOMICILE_LETTER',
    'SHARIA_CERTIFICATE', 'OTHER',
  ])
  documentType!: string;

  @ApiProperty() @IsString() @MaxLength(160) documentNumber!: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() documentDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) issuedBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() validFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() validUntil?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

class WilayahDto {
  @ApiProperty({ example: 'CITY' })
  @IsIn(['PROVINCE', 'CITY', 'DISTRICT', 'VILLAGE', 'INSTITUTION', 'COMMUNITY', 'NATIONWIDE'])
  areaType!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(48) areaCode?: string;
  @ApiProperty() @IsString() @MaxLength(255) areaName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

class KebijakanDto {
  @ApiProperty({ example: 'BYLAW' })
  @IsIn([
    'BYLAW', 'MEMBERSHIP_RULE', 'ACCOUNTING_POLICY', 'SHARIA_POLICY',
    'SHU_POLICY', 'SAVING_POLICY', 'LOAN_POLICY', 'OTHER',
  ])
  policyType!: string;

  @ApiProperty({ example: 'BYLAW' }) @IsString() @MaxLength(64) code!: string;
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() content?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsUUID() documentFileId?: string;
  @ApiProperty({ example: '2026-01-01' }) @IsISO8601() effectiveFrom!: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() effectiveUntil?: string;
}

class SahkanKebijakanDto {
  @ApiPropertyOptional({
    description: 'Keputusan RAT yang mengesahkannya. Wajib untuk AD/ART, aturan keanggotaan, dan kebijakan SHU.',
  })
  @IsOptional()
  @IsUUID()
  meetingDecisionId?: string;
}

class AjukanPengaduanDto {
  @ApiProperty({ enum: COMPLAINT_CATEGORIES })
  @IsIn(COMPLAINT_CATEGORIES)
  category!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({
    description:
      'Menahan nama pelapor dari tampilan pengurus. Kepemilikannya tetap tersimpan — pengaduan tanpa pemilik tidak dapat ditindaklanjuti.',
  })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}

class SetujuiPembayaranDto {
  @ApiProperty({
    example: 53900,
    description:
      'Batas nilai yang boleh dibelanjakan dengan bukti ini. Anggota menyetujui sebuah jumlah, bukan menyerahkan seluruh saldonya kepada kasir.',
  })
  @IsNumber()
  @IsPositive()
  maxAmount!: number;

  @ApiPropertyOptional({
    description: 'Mengikat bukti pada satu gerai. Bukti yang terikat tidak berlaku di gerai lain.',
  })
  @IsOptional()
  @IsUUID()
  outletId?: string;
}

class TanggapiPengaduanDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  body!: string;
}

class LamaranPublikDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(40)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  motivation?: string;

  @ApiProperty({
    description:
      'Persetujuan pengolahan data pribadi. Wajib true — tanpa ini koperasi menyimpan data orang yang tidak pernah menyatakan setuju.',
  })
  @IsBoolean()
  consentGiven!: boolean;
}

// --- Controller -------------------------------------------------------------

/**
 * Portal anggota.
 *
 * Berbeda dari controller di bawahnya: yang ini melayani ANGGOTA, bukan
 * pengurus. Karena itu tidak ada satu pun endpoint di sini yang menerima
 * `memberId` — identitas selalu diturunkan dari sesi lewat
 * `memberDiriSendiri()`. Lihat catatan panjang pada cooperative-portal.service.ts.
 *
 * Hak aksesnya pun terpisah (`COOPERATIVE_PORTAL.*`), supaya memberi seseorang
 * akses portal tidak pernah berarti memberinya akses ke layar pengurus.
 */
@ApiTags('cooperative-portal')
@Controller('cooperative/portal')
export class CooperativePortalController {
  constructor(
    private readonly portal: CooperativePortalService,
    private readonly saldo: MemberBalanceService,
  ) {}

  private async konteks(user: AuthenticatedUser) {
    const schema = requireSchema(user);
    return { schema, konteks: await this.portal.memberDiriSendiri(schema, user.userId) };
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.READ')
  @Get('me')
  @ApiOperation({
    summary: 'Ringkasan portal anggota',
    description: 'Identitas diambil dari sesi, tidak pernah dari permintaan.',
  })
  async ringkasan(@CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.ringkasan(schema, konteks);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.READ')
  @Get('savings')
  @ApiOperation({ summary: 'Simpanan milik anggota yang sedang masuk' })
  async simpanan(@CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.simpanan(schema, konteks);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.READ')
  @Get('savings/:id/transactions')
  @ApiOperation({
    summary: 'Mutasi satu rekening simpanan',
    description: 'Menolak dengan 404 bila rekeningnya milik anggota lain — tanpa menyebut bahwa rekening itu ada.',
  })
  async mutasi(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.mutasiSimpanan(schema, konteks, id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.READ')
  @Get('loans')
  @ApiOperation({ summary: 'Pinjaman milik anggota yang sedang masuk' })
  async pinjaman(@CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.pinjaman(schema, konteks);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.READ')
  @Get('loans/:id/schedule')
  @ApiOperation({ summary: 'Jadwal angsuran satu pinjaman' })
  async jadwal(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.jadwalAngsuran(schema, konteks, id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.READ')
  @Get('shu')
  @ApiOperation({ summary: 'Rincian SHU yang diterima anggota' })
  async shu(@CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.shu(schema, konteks);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.READ')
  @Get('meetings')
  @ApiOperation({
    summary: 'Rapat anggota',
    description:
      'Satu-satunya sumber daya portal yang bersifat bersama — setiap anggota berhak mengawasi jalannya rapat. Suaranya sendiri tetap perorangan.',
  })
  async rapat(@CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.rapat(schema, konteks);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.READ')
  @Get('meetings/:id/my-votes')
  @ApiOperation({ summary: 'Suara yang saya berikan pada rapat itu' })
  async suara(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.suaraSaya(schema, konteks, id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.READ')
  @Get('complaints')
  @ApiOperation({ summary: 'Pengaduan yang saya ajukan' })
  async pengaduan(@CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.pengaduan(schema, konteks);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.READ')
  @Get('complaints/:id/responses')
  @ApiOperation({
    summary: 'Tanggapan atas pengaduan',
    description: 'Catatan internal pengurus tidak pernah termasuk.',
  })
  async tanggapan(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.tanggapanPengaduan(schema, konteks, id);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.WRITE')
  @BlockDemo()
  @Post('complaints')
  @ApiOperation({ summary: 'Mengajukan pengaduan' })
  async ajukan(@Body() dto: AjukanPengaduanDto, @CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.ajukanPengaduan(schema, konteks, {
      category: dto.category,
      subject: dto.subject,
      body: dto.body,
      isAnonymous: dto.isAnonymous ?? false,
    });
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.WRITE')
  @BlockDemo()
  @Post('complaints/:id/responses')
  @ApiOperation({
    summary: 'Menanggapi pengaduan saya',
    description:
      'Tanggapan atas pengaduan yang sudah dinyatakan selesai membukanya kembali. Anggota tidak dapat menutup pengaduannya sendiri.',
  })
  async tanggapi(
    @Param('id') id: string,
    @Body() dto: TanggapiPengaduanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.tanggapiPengaduan(schema, konteks, id, dto.body);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.READ')
  @Get('payment/balance')
  @ApiOperation({
    summary: 'Saldo yang dapat dibelanjakan di kasir',
    description:
      'Hanya simpanan yang boleh ditarik dan bukan ekuitas. Simpanan pokok dan wajib sengaja tidak ikut — menampilkannya sebagai saldo belanja akan membuat anggota mengira modal keanggotaannya dapat dipakai berbelanja.',
  })
  async saldoBelanja(@CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.saldo.saldoBelanja(schema, konteks);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.WRITE')
  @BlockDemo()
  @Post('payment/authorize')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Menyetujui pembayaran di kasir',
    description:
      'Menerbitkan bukti sekali pakai berumur pendek yang ditunjukkan kepada kasir. PIN anggota TIDAK PERNAH melewati kasir; yang melewatinya hanya bukti bahwa PIN sudah dimasukkan pada perangkat anggota sendiri. Buktinya dikembalikan SEKALI dan tidak dapat dibaca lagi.',
  })
  async setujuiPembayaran(
    @Body() dto: SetujuiPembayaranDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { schema, konteks } = await this.konteks(user);
    return this.saldo.terbitkanBukti(schema, konteks, {
      maxAmount: dto.maxAmount,
      outletId: dto.outletId ?? null,
    });
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.READ')
  @Get('payment/history')
  @ApiOperation({ summary: 'Riwayat pembayaran saya di kasir' })
  async riwayatPembayaran(@CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.saldo.riwayat(schema, konteks);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.READ')
  @Get('notifications')
  @ApiOperation({ summary: 'Pemberitahuan untuk saya' })
  async pemberitahuan(@CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.pemberitahuan(schema, konteks);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PORTAL.WRITE')
  @Patch('notifications/:id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menandai pemberitahuan sudah dibaca' })
  async dibaca(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const { schema, konteks } = await this.konteks(user);
    return this.portal.tandaiDibaca(schema, konteks, id);
  }
}

/**
 * Situs koperasi untuk pengunjung yang belum masuk.
 *
 * Jalur ini **publik** — tanpa sesi, tanpa hak akses, dapat dipanggil siapa
 * saja. Yang membuatnya boleh ada adalah `PublicTenantResolver` (IR-005):
 * koperasi mana yang dilayani ditentukan **host permintaan**, dicocokkan ke
 * baris terdaftar di control plane.
 *
 * Nama skema tidak pernah datang dari alamat. Sebelum IR-005 disetujui, jalur
 * ini memang tidak dibuat sama sekali — bukan ditunda karena belum sempat.
 *
 * ## Pembatas laju
 *
 * Dua lapis, menjaga hal yang berbeda:
 *
 *   · `@Throttle` menahan satu mesin yang mengirim cepat.
 *   · `public-intake.ts` menjaga ANTREAN PENGURUS — berapa lamaran boleh masuk
 *     ke satu koperasi sehari, dan berapa sering satu nomor boleh mengirim.
 *     Lapis pertama tidak menahan seratus mesin yang masing-masing mengirim
 *     sekali; lapis kedua menahannya.
 *
 * ## Lapis pertama lumpuh di belakang proxy, dan itu disebutkan di sini
 *
 * `ThrottlerGuard` menghitung per `req.ip`. Aplikasi ini **tidak** menyetel
 * `trust proxy`, sehingga di belakang Apache (`koperasi.ebisnis.id`) `req.ip`
 * bernilai alamat proxy untuk SETIAP pengunjung — seluruh internet berbagi satu
 * ember hitungan.
 *
 * Akibatnya bukan sekadar "pembatasnya tidak bekerja", melainkan lebih buruk:
 * batas yang ketat berubah menjadi penolakan layanan terhadap pelamar
 * sungguhan. Lima kiriman per jam per alamat akan menjadi lima kiriman per jam
 * bagi seluruh koperasi di seluruh platform, dan satu pengirim sampah cukup
 * untuk menutup pintu bagi semua orang.
 *
 * Sampai [IR-006](../../../../docs/integration-requests/cooperative/006-alamat-asli-di-belakang-proxy.md)
 * dikerjakan Core, angkanya dipilih supaya benar pada KEDUA keadaan:
 *
 *   · **Pembacaan tidak diberi batas khusus.** Ia mewarisi batas umum seperti
 *     route lain. Memberinya batas lebih ketat justru membuat situs publik
 *     lebih rapuh daripada bagian API lainnya — kebalikan dari yang diinginkan.
 *   · **Penulisan diberi angka yang longgar** — cukup longgar untuk tidak
 *     menolak pelamar sungguhan ketika embernya berbagi, cukup ketat untuk
 *     tetap berguna setelah IR-006 mendudukkan alamat aslinya.
 *
 * Yang benar-benar menahan banjir tetap lapis kedua: batas harian per koperasi
 * dan jeda per nomor telepon, keduanya **tidak bergantung pada alamat IP** dan
 * karenanya bekerja sama benarnya di kedua keadaan. Batas kerusakan terburuk
 * tidak berubah: lima puluh baris karantina per koperasi per hari, tanpa satu
 * pun baris anggota terbentuk.
 *
 * `ThrottlerGuard` milik modul auth tidak disentuh sama sekali (panduan §3).
 */
@ApiTags('cooperative-public')
@Controller('cooperative/public')
export class CooperativePublicController {
  constructor(private readonly situs: CooperativePublicService) {}

  /*
   * Tanpa @Throttle: mewarisi batas umum. Lihat catatan kelas di atas — batas
   * per-route yang lebih ketat akan lumpuh menjadi satu ember bersama di
   * belakang proxy, dan menolak pengunjung biasa lebih dahulu daripada
   * penyerang.
   */
  @Public()
  @Get('site')
  @ApiOperation({
    summary: 'Isi situs koperasi',
    description:
      'Koperasi ditentukan host permintaan, bukan alamat. Hanya yang situsnya sudah diterbitkan. Jumlah anggota disertakan hanya bila pengurus memilih menampilkannya.',
  })
  async isi(@Headers('host') host: string) {
    return this.situs.situs(host);
  }

  @Public()
  @Get('pages/:slug')
  @ApiOperation({ summary: 'Satu halaman situs koperasi' })
  async halaman(@Headers('host') host: string, @Param('slug') slug: string) {
    return this.situs.halaman(host, slug);
  }

  /*
   * Tiga puluh kiriman per jam. Bukan angka yang dipilih untuk menahan
   * penyerang — lapis kedualah yang melakukannya — melainkan angka yang tidak
   * melukai siapa pun ketika embernya berbagi di belakang proxy, sambil tetap
   * memangkas kiriman bertubi-tubi dari satu mesin bila alamatnya kelak
   * terbaca benar.
   *
   * Orang yang mendaftar sungguhan mengirim sekali; tiga puluh tidak akan
   * pernah ia sentuh.
   */
  @Public()
  @Throttle({ default: { ttl: 3_600_000, limit: 30 } })
  @Post('applications')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Mengirim pendaftaran calon anggota',
    description:
      'Berhenti pada tabel karantina. TIDAK membentuk baris anggota — pengurus yang menerbitkannya setelah memeriksa berkas. Yang menahan banjir adalah batas harian per koperasi dan jeda per nomor telepon; keduanya tidak bergantung pada alamat IP.',
  })
  async lamar(
    @Headers('host') host: string,
    @Body() dto: LamaranPublikDto,
    @Ip() ip: string,
  ) {
    return this.situs.terimaLamaran(
      host,
      {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email ?? null,
        occupation: dto.occupation ?? null,
        address: dto.address ?? null,
        motivation: dto.motivation ?? null,
        consentGiven: dto.consentGiven,
      },
      ip,
    );
  }
}

/**
 * Pratinjau situs bagi pengurus.
 *
 * Tetap ada meski jalur publiknya sudah dibuka: pengurus perlu melihat
 * situsnya **sebelum** diterbitkan, dan jalur publik hanya melayani yang sudah
 * terbit.
 */
/**
 * Data contoh koperasi — dua tombol.
 *
 * Terpisah dari permukaan data contoh milik Core (`/sample-data/*`) dengan
 * sengaja: yang ini menyemai koperasi lengkap beserta RAT dan SHU-nya, dan
 * penghapusannya menyaring pada awalan kode koperasi sendiri.
 */
@ApiTags('cooperative-sample')
@Controller('cooperative/sample')
export class CooperativeSampleController {
  constructor(private readonly contoh: CooperativeSampleService) {}

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.READ')
  @Get()
  @ApiOperation({
    summary: 'Keadaan data contoh',
    description: 'Apakah terpasang, berapa anggotanya, dan tahun bukunya.',
  })
  async status(@CurrentUser() user: AuthenticatedUser) {
    return this.contoh.status(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.CREATE')
  @BlockDemo()
  @Post('install')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Memasang data contoh',
    description:
      'Satu koperasi lengkap: 60 anggota, setahun simpanan wajib, 25 pinjaman, satu RAT beserta kuorum dan pemungutan suaranya, dan satu perhitungan SHU yang dibagikan. Menolak bila sudah terpasang — pemasangan ulang akan menggandakan mutasi dan membuat laporan SHU memuat angka yang tidak dapat dijelaskan.',
  })
  async pasang(@CurrentUser() user: AuthenticatedUser) {
    return this.contoh.pasang(requireSchema(user), user.userId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.UPDATE')
  @BlockDemo()
  @Post('remove')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menghapus data contoh',
    description:
      'Menyaring pada awalan kode CONTOH-, bukan pada tanggal maupun tanda is_sample. Peran, menu, dan hak akses TIDAK ikut terhapus — menghapusnya mengunci pengurus keluar dari koperasinya sendiri.',
  })
  async hapus(@CurrentUser() user: AuthenticatedUser) {
    return this.contoh.hapus(requireSchema(user));
  }
}

@ApiTags('cooperative-website')
@Controller('cooperative/website')
export class CooperativeWebsiteController {
  constructor(private readonly portal: CooperativePortalService) {}

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_WEBSITE.READ')
  @Get('preview/:slug')
  @ApiOperation({
    summary: 'Pratinjau situs koperasi',
    description:
      'Melayani pula situs yang BELUM diterbitkan — itulah gunanya. Jalur publik hanya melayani yang sudah terbit.',
  })
  async pratinjau(@Param('slug') slug: string, @CurrentUser() user: AuthenticatedUser) {
    return this.portal.situsPublik(requireSchema(user), slug);
  }
}

@ApiTags('cooperative')
@Controller('cooperative')
export class CooperativeController {
  constructor(private readonly profil: CooperativeProfileService) {}

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.READ')
  @Get('profile')
  @ApiOperation({
    summary: 'Profil koperasi',
    description: 'Mengembalikan null bila belum dibuat — ruang kerja baru memang belum punya profil.',
  })
  async ambilProfil(@CurrentUser() user: AuthenticatedUser) {
    return this.profil.profil(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.CREATE')
  @BlockDemo()
  @Post('profile')
  @ApiOperation({ summary: 'Membuat profil koperasi beserta subdomainnya' })
  async buatProfil(@Body() dto: BuatKoperasiDto, @CurrentUser() user: AuthenticatedUser) {
    return this.profil.buat(requireSchema(user), dto, user.userId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.UPDATE')
  @BlockDemo()
  @Patch('profile')
  @ApiOperation({ summary: 'Memperbarui profil dan legalitas ringkas' })
  async perbaruiProfil(
    @Body() dto: PerbaruiKoperasiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profil.perbarui(requireSchema(user), { ...dto }, user.userId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.READ')
  @Get('profile/readiness')
  @ApiOperation({
    summary: 'Daftar periksa kesiapan go-live',
    description:
      'Melaporkan SELURUH kekurangan sekaligus. Pemilik koperasi yang diberi tahu satu ' +
      'kekurangan lalu satu lagi setelah memperbaikinya akan melalui banyak putaran untuk ' +
      'hal yang dapat disebutkan dalam satu layar.',
  })
  async kesiapan(@CurrentUser() user: AuthenticatedUser) {
    return this.profil.kesiapan(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.APPROVE')
  @BlockDemo()
  @Post('profile/status')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mengubah status koperasi',
    description: 'Menuju ACTIVE hanya dapat bila seluruh syarat kesiapan terpenuhi.',
  })
  async ubahStatus(@Body() dto: UbahStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.profil.pindahStatus(
      requireSchema(user),
      dto.status as CooperativeStatus,
      dto.reason ?? 'Perubahan status oleh pengurus',
      user.userId,
    );
  }

  // --- Jenis koperasi -------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.READ')
  @Get('types')
  @ApiOperation({ summary: 'Jenis koperasi yang tersedia' })
  jenis(@CurrentUser() user: AuthenticatedUser) {
    return this.profil.daftarJenis(requireSchema(user));
  }

  // --- Legalitas ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.READ')
  @Get('legal-documents')
  @ApiOperation({ summary: 'Dokumen legalitas beserta tanda kedaluwarsanya' })
  dokumen(@CurrentUser() user: AuthenticatedUser) {
    return this.profil.daftarDokumen(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.UPDATE')
  @BlockDemo()
  @Post('legal-documents')
  @ApiOperation({ summary: 'Menambahkan dokumen legalitas' })
  tambahDokumen(@Body() dto: DokumenDto, @CurrentUser() user: AuthenticatedUser) {
    return this.profil.tambahDokumen(requireSchema(user), { ...dto }, user.userId);
  }

  // --- Wilayah kerja --------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.READ')
  @Get('service-areas')
  @ApiOperation({ summary: 'Wilayah kerja koperasi' })
  wilayah(@CurrentUser() user: AuthenticatedUser) {
    return this.profil.daftarWilayah(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.UPDATE')
  @BlockDemo()
  @Post('service-areas')
  @ApiOperation({
    summary: 'Menambahkan wilayah kerja',
    description: 'Menentukan siapa yang boleh menjadi anggota; dipakai pemeriksaan kelayakan pada K-2.',
  })
  tambahWilayah(@Body() dto: WilayahDto, @CurrentUser() user: AuthenticatedUser) {
    return this.profil.tambahWilayah(requireSchema(user), { ...dto }, user.userId);
  }

  // --- Kebijakan ------------------------------------------------------------

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.READ')
  @Get('policies')
  @ApiOperation({ summary: 'Kebijakan koperasi beserta seluruh versinya' })
  kebijakan(@CurrentUser() user: AuthenticatedUser) {
    return this.profil.daftarKebijakan(requireSchema(user));
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.UPDATE')
  @BlockDemo()
  @Post('policies')
  @ApiOperation({
    summary: 'Menetapkan kebijakan baru',
    description:
      'Selalu membentuk VERSI BARU, tidak pernah menyunting versi lama. SHU dihitung menurut ' +
      'kebijakan yang berlaku pada periode bukunya; kebijakan yang disunting di tempat membuat ' +
      'perhitungan tahun lalu tidak dapat diulang.',
  })
  tetapkanKebijakan(@Body() dto: KebijakanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.profil.tetapkanKebijakan(requireSchema(user), { ...dto }, user.userId);
  }

  @ApiBearerAuth('access-token')
  @Permissions('COOPERATIVE_PROFILE.APPROVE')
  @BlockDemo()
  @Post('policies/:id/approve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mengesahkan kebijakan',
    description:
      'AD/ART, aturan keanggotaan, dan kebijakan SHU sah hanya setelah diputuskan Rapat Anggota.',
  })
  sahkanKebijakan(
    @Param('id') id: string,
    @Body() dto: SahkanKebijakanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profil.sahkanKebijakan(
      requireSchema(user),
      id,
      dto.meetingDecisionId ?? null,
      user.userId,
    );
  }
}

@Module({
  /*
   * `PosModule` diimpor demi `ExternalPaymentRegistry` saja.
   *
   * Arahnya sengaja begini: koperasi bergantung pada POS, bukan sebaliknya.
   * POS tidak mengetahui apa pun tentang simpanan anggota, dan menghapus modul
   * koperasi tidak menyentuh satu baris pun miliknya.
   */
  imports: [InfrastructureModule, PosModule, AccountingModule],
  controllers: [
    CooperativeController,
    CooperativePortalController,
    CooperativeWebsiteController,
    CooperativePublicController,
    CooperativeSampleController,
  ],
  providers: [
    CooperativeProfileService,
    CooperativePortalService,
    CooperativePosAdapter,
    MemberBalanceService,
    MemberBalancePaymentHandler,
    CooperativeAccountingEventService,
    CooperativePublicService,
    CooperativeSampleService,
  ],
  exports: [CooperativeProfileService, CooperativePortalService, CooperativePosAdapter],
})
/**
 * Katalog RBAC koperasi TIDAK didaftarkan di sini.
 *
 * Pendaftaran lewat daur hidup modul membuat isi registri bergantung pada
 * modul mana yang kebetulan dimuat — dan CLI penyemai memuat lebih sedikit
 * modul daripada aplikasi HTTP. Lihat `vertical-catalogs.ts`.
 */
export class CooperativeModule implements OnModuleInit {
  constructor(
    private readonly pembayaranEksternal: ExternalPaymentRegistry,
    private readonly penanganSaldo: MemberBalancePaymentHandler,
    private readonly katalogPeristiwa: AccountingEventCatalogRegistry,
  ) {}

  /**
   * Mendaftarkan penangan pembayaran bersaldo anggota (IR-002).
   *
   * Inilah satu-satunya tempat modul koperasi menyentuh alur kasir — lewat
   * kontrak milik Core, bukan dengan menyunting POS. Panduan koordinasi §3.
   *
   * Pendaftaran dilewati bila sudah ada: modul Nest dapat dimuat lebih dari
   * sekali pada pengujian, dan pendaftaran ganda ditolak registri — penolakan
   * yang benar pada keadaan yang salah.
   */
  onModuleInit(): void {
    if (!this.pembayaranEksternal.has(this.penanganSaldo.handlerCode)) {
      this.pembayaranEksternal.register(this.penanganSaldo);
    }

    /*
     * Katalog peristiwa akuntansi koperasi (IR-003).
     *
     * Setelah ini, 29 kode `COOPERATIVE_*` dikenal mesin akuntansi — dan
     * peristiwa koperasi yang terbit dapat diperiksa kelengkapannya sebelum
     * ditulis.
     *
     * Perlu disebutkan apa adanya: pendaftaran ini TIDAK membuat peristiwanya
     * dijurnal. Saluran peristiwa-ke-jurnal belum dibangun untuk modul mana
     * pun — POS pun peristiwanya masih menunggu.
     */
    const kunci = `${COOPERATIVE_EVENT_CATALOG.module}:${COOPERATIVE_EVENT_CATALOG.prefix}`;
    if (!this.katalogPeristiwa.registeredCatalogs().includes(kunci)) {
      this.katalogPeristiwa.register(COOPERATIVE_EVENT_CATALOG);
    }
  }
}
