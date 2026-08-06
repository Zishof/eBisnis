import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import type { Response } from 'express';
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
import { tautanKanonik } from '../../infrastructure/portal/portal-host';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Public, RequestContext, RequestMeta } from '../../common/decorators';
import { rawResponse } from '../../common/interceptors/response-envelope.interceptor';

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

  @ApiPropertyOptional({
    default: true,
    description:
      'Isi ruang kerja dengan data contoh (produk, pelanggan, pemasok). Data acuan seperti ' +
      'satuan, bagan akun, peran, dan hak akses SELALU dibuat dan tidak terpengaruh pilihan ini.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeSampleData?: boolean;
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

class DemoSessionDto {
  @ApiPropertyOptional({
    description: 'Kode peran demo terbatas untuk simulasi persona uji.',
    example: 'PEMILIK_USAHA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleCode?: string;
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

interface PreviewMetadata {
  title: string;
  description: string;
  siteName: string;
  themeColor: string;
  iconDataUri: string;
  imageUrl: string;
}

const PREVIEW_IMAGES = {
  default: 'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1200&q=80',
  inventory: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80',
  salon: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
  apotik: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=1200&q=80',
  emedik: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80',
  mitrainap: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
};

function cleanHost(hostname: string): string {
  return hostname.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function titleizeTenantSlug(slug: string): string {
  return slug
    .split(/[-.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function svgIcon(text: string, color: string): string {
  const safeText = text.slice(0, 3).replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="${color}"/><text x="64" y="76" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="800" fill="white">${safeText}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function inventoryTenantName(host: string): string {
  if (host === 'inventory.ebisnis.id' || host === 'nventory.ebisnis.id') return 'eBisnis Inventory';
  if (host === 'demo-inventory.ebisnis.id') return 'Demo Inventory Obat';
  if (host === 'cmnmedika-inventory.ebisnis.id') return 'Caruban Medika Nusantara';
  const slug = host.endsWith('.inventory.ebisnis.id')
    ? host.replace(/\.inventory\.ebisnis\.id$/, '')
    : host.replace(/-inventory\.ebisnis\.id$/, '');
  return titleizeTenantSlug(slug);
}

function apotikTenantName(host: string): string {
  if (host === 'apotik.emedik.id' || host === 'www.apotik.emedik.id') return 'Apotik eMedik';
  if (host === 'demo-apotik.emedik.id') return 'Demo Apotik eMedik';
  if (host.endsWith('-apotik.emedik.id')) {
    return `${titleizeTenantSlug(host.replace(/-apotik\.emedik\.id$/, ''))} Apotik`;
  }
  return 'Apotik eMedik';
}

function emedikTenantName(host: string): string {
  if (host === 'emedik.id' || host === 'www.emedik.id') return 'eMedik.id';
  if (host === 'demo.emedik.id') return 'Demo eMedik';
  if (host.endsWith('.emedik.id')) {
    return `${titleizeTenantSlug(host.replace(/\.emedik\.id$/, ''))} eMedik`;
  }
  return 'eMedik.id';
}

export function metadataForHost(hostname: string): PreviewMetadata {
  const host = cleanHost(hostname);
  const inventoryHost =
    host === 'inventory.ebisnis.id' ||
    host === 'nventory.ebisnis.id' ||
    host === 'demo-inventory.ebisnis.id' ||
    host.endsWith('-inventory.ebisnis.id') ||
    host.endsWith('.inventory.ebisnis.id');
  if (inventoryHost) {
    const tenantName = inventoryTenantName(host);
    const root = host === 'inventory.ebisnis.id' || host === 'nventory.ebisnis.id';
    const cmn = host === 'cmnmedika-inventory.ebisnis.id';
    const title = root
      ? 'eBisnis Inventory — Sales dan Stok Obat Terintegrasi'
      : cmn
        ? 'Caruban Medika Nusantara — Sales Obat Cirebon'
      : `${tenantName} — Inventory Obat Terintegrasi`;
    const description = root
      ? 'Aplikasi inventory untuk sales lapangan, admin gudang, batch, expiry, piutang, hutang, dan dashboard pemilik.'
      : cmn
        ? 'Company profile dan katalog display Caruban Medika Nusantara, sales obat untuk Cirebon dan sekitarnya. Pemesanan hanya untuk pelanggan terdaftar melalui aplikasi.'
      : `Inventory obat terintegrasi untuk sales, admin gudang, piutang, batch, expiry, dan dashboard pemilik ${tenantName}.`;
    const iconText = root ? 'eI' : initials(tenantName);
    return {
      title,
      description,
      siteName: tenantName,
      themeColor: '#0f766e',
      iconDataUri: svgIcon(iconText, '#0f766e'),
      imageUrl: PREVIEW_IMAGES.inventory,
    };
  }

  const salonHost =
    host === 'salon.ebisnis.id' ||
    host === 'salon.ebinis.id' ||
    host === 'salon.ebisinis.id' ||
    host.endsWith('-salon.ebisnis.id') ||
    host.endsWith('-salon.ebinis.id') ||
    host.endsWith('-salon.ebisinis.id');
  if (salonHost) {
    return {
      title: 'Salon Cantik Demo — Booking, Produk, dan Dashboard Salon',
      description:
        'Demo salon eBisnis dengan booking online, katalog layanan, manajemen kursi, invoice, promo, dan dashboard transaksi.',
      siteName: 'Salon Cantik Demo',
      themeColor: '#0f766e',
      iconDataUri: svgIcon('SC', '#0f766e'),
      imageUrl: PREVIEW_IMAGES.salon,
    };
  }

  if (
    host === 'apotik.emedik.id' ||
    host === 'www.apotik.emedik.id' ||
    host === 'demo-apotik.emedik.id' ||
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?-apotik\.emedik\.id$/.test(host)
  ) {
    const siteName = apotikTenantName(host);
    return {
      title: `${siteName} - Farmasi dan POS Apotik`,
      description:
        'Landing dan akses apotik eMedik untuk pelayanan farmasi, stok obat, resep, pembelian, dan penjualan obat.',
      siteName,
      themeColor: '#0f766e',
      iconDataUri: svgIcon('Rx', '#0f766e'),
      imageUrl: PREVIEW_IMAGES.apotik,
    };
  }

  if (host === 'emedik.id' || host === 'www.emedik.id' || host.endsWith('.emedik.id')) {
    const siteName = emedikTenantName(host);
    return {
      title: `${siteName} - Sistem Operasional Kesehatan`,
      description:
        'Sistem operasional terpadu untuk rumah sakit, klinik, puskesmas, posyandu, dan apotik.',
      siteName,
      themeColor: '#0891b2',
      iconDataUri: svgIcon('eM', '#0891b2'),
      imageUrl: PREVIEW_IMAGES.emedik,
    };
  }

  if (host === 'mitrainap.id' || host === 'www.mitrainap.id' || host.endsWith('.mitrainap.id')) {
    return {
      title: 'MitraInap.id - PMS, Booking Engine, dan Operasional Hotel Terintegrasi',
      description:
        'Property management system, booking engine langsung, front office, housekeeping, dan folio untuk hotel, homestay, dan properti sewa.',
      siteName: 'MitraInap.id',
      themeColor: '#4f46e5',
      iconDataUri: svgIcon('in', '#4f46e5'),
      imageUrl: PREVIEW_IMAGES.mitrainap,
    };
  }

  return {
    title: 'eBisnis.id — Platform SaaS POS dan ERP Terintegrasi',
    description:
      'Satu aplikasi untuk kasir, toko, persediaan, pembelian, keuangan, SDM, dan monitoring seluruh bisnis Anda.',
    siteName: 'eBisnis.id',
    themeColor: '#0f766e',
    iconDataUri: svgIcon('eB', '#0f766e'),
    imageUrl: PREVIEW_IMAGES.default,
  };
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

  // --- Portal ekosistem ----------------------------------------------------
  //
  // §39.1. Dipakai footer lintas portal, halaman "Ekosistem Kami", dan
  // `deploy/ekosistem.sh` untuk memastikan registry benar-benar terisi sesudah
  // pembaruan.

  @Public()
  @Get('portals')
  @ApiOperation({
    summary: 'Daftar portal ekosistem beserta host kanonik dan tautan silangnya',
    description:
      'Hanya portal berstatus ACTIVE dengan host yang sudah terverifikasi. ' +
      'Portal tanpa host yang melayani tidak ikut, sebab menautkannya berarti ' +
      'mengirim pengunjung ke alamat yang tidak dijawab siapa pun.',
  })
  async getPortals() {
    const portals = await this.prisma.platformPortal.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { sortOrder: 'asc' },
      include: {
        domains: { where: { status: 'ACTIVE' } },
        /*
         * `linksFrom`, BUKAN `linksTo`. `linksTo` berisi baris yang menjadikan
         * portal ini sebagai TARGET (portal lain menaut ke sini) -- me-`include`
         * `target` pada baris semacam itu selalu mengembalikan portal ini
         * sendiri, sebab `target` didefinisikan sebagai portal yang menjadi
         * sasaran baris itu. `linksFrom` adalah baris yang portal ini sebagai
         * SUMBERnya, sehingga `target`-nya benar portal LAIN yang dituju.
         * Bug ini ditemukan lewat pengujian API sungguhan (MI-1 MitraInap):
         * seluruh footer ekosistem portal (termasuk eBisnis.id, santri.info,
         * eMedik.id) menaut ke dirinya sendiri berulang, bukan ke portal lain.
         */
        linksFrom: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: { target: { include: { domains: { where: { status: 'ACTIVE' } } } } },
        },
      },
    });

    return portals
      .map((p) => ({
        code: p.code,
        name: p.name,
        tagline: p.tagline,
        verticalCode: p.verticalCode,
        brandPrimary: p.brandPrimary,
        brandAccent: p.brandAccent,
        defaultLocale: p.defaultLocale,
        url: tautanKanonik(p.domains, 'PUBLIC'),
        appUrl: tautanKanonik(p.domains, 'APP'),
        ecosystem: p.linksFrom
          .map((l) => ({
            code: l.target.code,
            label: l.label,
            description: l.description,
            url: tautanKanonik(l.target.domains, 'PUBLIC'),
          }))
          // Tautan ke portal yang tidak punya host yang melayani dibuang, bukan
          // ditampilkan tanpa alamat: tautan mati pada footer lima situs adalah
          // hal yang dilihat setiap pengunjung.
          .filter((l) => l.url !== null),
      }))
      .filter((p) => p.url !== null);
  }

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
  @Get('link-preview')
  @ApiOperation({ summary: 'HTML metadata dinamis untuk crawler pratinjau tautan sosial' })
  linkPreview(
    @Headers('host') host: string | undefined,
    @Headers('x-forwarded-proto') forwardedProto: string | undefined,
    @Query('path') path = '/',
    @Res({ passthrough: true }) res: Response,
  ) {
    const proto = forwardedProto === 'http' ? 'http' : 'https';
    const meta = metadataForHost(host ?? 'ebisnis.id');
    const safePath = typeof path === 'string' && path.startsWith('/') ? path : '/';
    const url = `${proto}://${cleanHost(host ?? 'ebisnis.id')}${safePath}`;

    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    });

    return rawResponse(`<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}">
    <meta name="theme-color" content="${escapeHtml(meta.themeColor)}">
    <link rel="canonical" href="${escapeHtml(url)}">
    <link rel="icon" href="${escapeHtml(meta.iconDataUri)}" type="image/svg+xml">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(meta.title)}">
    <meta property="og:description" content="${escapeHtml(meta.description)}">
    <meta property="og:site_name" content="${escapeHtml(meta.siteName)}">
    <meta property="og:url" content="${escapeHtml(url)}">
    <meta property="og:image" content="${escapeHtml(meta.imageUrl)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(meta.title)}">
    <meta name="twitter:description" content="${escapeHtml(meta.description)}">
    <meta name="twitter:image" content="${escapeHtml(meta.imageUrl)}">
  </head>
  <body>
    <main>
      <h1>${escapeHtml(meta.siteName)}</h1>
      <p>${escapeHtml(meta.description)}</p>
      <p><a href="${escapeHtml(url)}">Buka website</a></p>
    </main>
  </body>
</html>`);
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
  createDemoSession(@Body() dto: DemoSessionDto | undefined, @RequestContext() meta: RequestMeta) {
    return this.auth.createDemoSession({
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      localeCode: meta.localeCode,
      requestId: meta.requestId,
      hostname: meta.hostname,
      requestedRoleCode: dto?.roleCode,
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
