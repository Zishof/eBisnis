import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PublicSiteService } from './public-site.service';
import { RegistrationService } from './registration.service';
import { ContactService } from './contact.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Public, RequestContext, RequestMeta } from '../../common/decorators';

class CheckUsernameDto {
  @ApiProperty({ example: 'joni_utama' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  desiredUsername!: string;
}

class RegistrationDto {
  @ApiProperty({ example: 'Joni Utama' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  businessName!: string;

  @ApiPropertyOptional({ example: 'Kafe' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessType?: string;

  @ApiPropertyOptional({ example: 'Indonesia' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cityRegency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactPerson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessPhone?: string;

  @ApiProperty({ example: 'joni@contoh.example' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'joni_utama' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  desiredUsername!: string;

  @ApiPropertyOptional({ default: true, description: 'Server membuat kata sandi sementara.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  generatePassword?: boolean;

  @ApiPropertyOptional({ description: 'Wajib bila generatePassword=false.' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  passwordConfirmation?: string;

  @ApiProperty({ description: 'Persetujuan syarat penggunaan.' })
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  acceptTerms!: boolean;

  @ApiProperty({ description: 'Persetujuan kebijakan privasi.' })
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  acceptPrivacy!: boolean;

  @ApiPropertyOptional({ example: 'id' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  localeCode?: string;
}

class ContactMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;
}

class NewsletterDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  localeCode?: string;
}

class NewsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize = 9;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(96)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(96)
  tag?: string;
}

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly site: PublicSiteService,
    private readonly registration: RegistrationService,
    private readonly contact: ContactService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  // --- Website -------------------------------------------------------------

  @Public()
  @Get('site')
  @ApiOperation({ summary: 'Konfigurasi website, navigasi, hero, footer, dan daftar bahasa' })
  getSite(@RequestContext() meta: RequestMeta) {
    return this.site.getSite(meta.localeCode);
  }

  @Public()
  @Get('pages/:slug')
  @ApiOperation({ summary: 'Halaman CMS beserta blok yang sudah dipublikasikan' })
  getPage(@Param('slug') slug: string, @RequestContext() meta: RequestMeta) {
    return this.site.getPage(slug, meta.localeCode);
  }

  @Public()
  @Get('navigation')
  @ApiOperation({ summary: 'Navigasi header dan footer' })
  getNavigation(@RequestContext() meta: RequestMeta) {
    return this.site.listNavigation(meta.localeCode);
  }

  @Public()
  @Get('marketing')
  @ApiOperation({ summary: 'Fitur, modul, langkah, keunggulan, testimoni, mitra, CTA, dan kontak' })
  getMarketing() {
    return this.site.listMarketingContent();
  }

  @Public()
  @Get('news')
  @ApiOperation({ summary: 'Daftar berita terpublikasi' })
  listNews(@Query() query: NewsQueryDto, @RequestContext() meta: RequestMeta) {
    return this.site.listNews({
      page: query.page,
      pageSize: query.pageSize,
      categorySlug: query.category,
      tagSlug: query.tag,
      localeCode: meta.localeCode,
    });
  }

  @Public()
  @Get('news/:slug')
  @ApiOperation({ summary: 'Detail berita' })
  getNews(@Param('slug') slug: string, @RequestContext() meta: RequestMeta) {
    return this.site.getNewsArticle(slug, meta.localeCode);
  }

  @Public()
  @Get('announcements')
  @ApiOperation({ summary: 'Pengumuman publik yang sedang berlaku' })
  listAnnouncements() {
    return this.site.listAnnouncements('PUBLIC');
  }

  @Public()
  @Get('faqs')
  @ApiOperation({ summary: 'FAQ per kategori' })
  listFaqs() {
    return this.site.listFaqs();
  }

  @Public()
  @Get('packages')
  @ApiOperation({
    summary: 'Paket berlangganan terpublikasi',
    description: 'Harga berasal dari pricing engine, bukan nilai hard-coded pada frontend.',
  })
  listPackages(@Query('currency') currency?: string) {
    return this.site.listPublishedPackages(currency ?? 'IDR');
  }

  @Public()
  @Get('subscription-packages')
  @ApiOperation({ summary: 'Alias paket berlangganan terpublikasi' })
  listSubscriptionPackages(@Query('currency') currency?: string) {
    return this.site.listPublishedPackages(currency ?? 'IDR');
  }

  @Public()
  @Get('subscription-packages/compare')
  @ApiOperation({ summary: 'Matriks perbandingan paket berdasarkan modul' })
  comparePackages(@Query('currency') currency?: string) {
    return this.site.comparePackages(currency ?? 'IDR');
  }

  @Public()
  @Get('locales')
  @ApiOperation({ summary: 'Daftar bahasa aktif' })
  async listLocales() {
    return this.prisma.locale.findMany({
      where: { enabled: true, isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        code: true,
        name: true,
        nativeName: true,
        direction: true,
        isDefault: true,
        fallbackCode: true,
        numberFormat: true,
        dateFormat: true,
      },
    });
  }

  @Public()
  @Get('translations/:locale')
  @ApiOperation({ summary: 'Katalog terjemahan untuk satu bahasa' })
  async getTranslations(@Param('locale') locale: string) {
    const values = await this.prisma.translationValue.findMany({
      where: { localeCode: locale, deletedAt: null },
      include: { key: { include: { namespace: true } } },
    });
    const catalog: Record<string, Record<string, string>> = {};
    for (const value of values) {
      const ns = value.key.namespace.code;
      catalog[ns] = catalog[ns] ?? {};
      catalog[ns][value.key.key] = value.value;
    }
    return { locale, catalog };
  }

  // --- Registrasi ----------------------------------------------------------

  @Public()
  @Get('registration-config')
  @ApiOperation({ summary: 'Konfigurasi formulir pendaftaran' })
  registrationConfig() {
    return this.registration.getRegistrationConfig();
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Post('usernames/check')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cek ketersediaan nama pengguna dan pratinjau nama schema' })
  checkUsername(@Body() dto: CheckUsernameDto) {
    return this.registration.checkUsername(dto.desiredUsername);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('registrations')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Pendaftaran mandiri tanpa login',
    description:
      'Membuat tenant, schema ERP, schema audit, seed master, dan akun pemilik. ' +
      'Kata sandi sementara hanya ditampilkan satu kali pada response ini.',
  })
  register(@Body() dto: RegistrationDto, @RequestContext() meta: RequestMeta) {
    return this.registration.register(dto, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
  }

  @Public()
  @Get('registrations/:id/status')
  @ApiOperation({ summary: 'Status provisioning pendaftaran' })
  registrationStatus(@Param('id') id: string) {
    return this.registration.getStatus(id);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('registrations/:id/retry')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengulang provisioning yang gagal' })
  retryRegistration(@Param('id') id: string, @RequestContext() meta: RequestMeta) {
    return this.registration.retry(id, { requestId: meta.requestId });
  }

  // --- Demo ----------------------------------------------------------------

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('demo/session')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Membuat sesi sandbox demo tanpa pendaftaran',
    description: 'Token demo berumur pendek dan hanya mengarah ke schema `demo`.',
  })
  createDemoSession(@RequestContext() meta: RequestMeta) {
    return this.auth.createDemoSession({
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      localeCode: meta.localeCode,
      requestId: meta.requestId,
    });
  }

  @Public()
  @Get('demo/status')
  @ApiOperation({ summary: 'Status ketersediaan sandbox demo' })
  async demoStatus() {
    const registry = await this.prisma.tenantSchemaRegistry.findFirst({
      where: { schemaName: 'demo' },
      include: { tenant: { select: { name: true } } },
    });
    const lastReset = await this.prisma.demoResetRun.findFirst({
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, finishedAt: true, generation: true, status: true },
    });
    const activeSessions = await this.prisma.demoSession.count({
      where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
    });
    return {
      available: registry?.status === 'READY',
      schemaName: registry?.schemaName ?? null,
      tenantName: registry?.tenant?.name ?? null,
      schemaVersion: registry?.schemaVersion ?? null,
      activeSessions,
      lastReset,
      notice:
        'Sandbox demo dipakai bersama dan di-reset secara berkala. Jangan memasukkan data pribadi atau rahasia.',
    };
  }

  // --- Kontak dan newsletter ----------------------------------------------

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('contact')
  @HttpCode(201)
  @ApiOperation({ summary: 'Mengirim pesan kontak' })
  submitContact(@Body() dto: ContactMessageDto, @RequestContext() meta: RequestMeta) {
    return this.contact.submit(dto, {
      ipAddress: meta.ipAddress,
      localeCode: meta.localeCode,
      requestId: meta.requestId,
    });
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('newsletter/subscribe')
  @HttpCode(201)
  @ApiOperation({ summary: 'Berlangganan buletin' })
  subscribe(@Body() dto: NewsletterDto) {
    return this.contact.subscribeNewsletter(dto.email, dto.localeCode ?? 'id');
  }
}
