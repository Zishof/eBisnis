import { Body, Controller, Get, HttpCode, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CmsStatus, Prisma } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import {
  AuthenticatedUser,
  BlockDemo,
  CurrentUser,
  PlatformPermissions,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

/** Whitelist rich text CMS — tidak ada script, event handler, iframe, atau style bebas. */
const RICH_TEXT_POLICY: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'ul', 'ol', 'li',
    'h2', 'h3', 'h4', 'h5', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'code', 'pre',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  disallowedTagsMode: 'discard',
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_POLICY);
}

class UpdateBlockDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  localeCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  eyebrow?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  heading?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  subheading?: string;

  @ApiPropertyOptional({ description: 'Rich text; disanitasi sebelum disimpan.' })
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  buttonLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  buttonUrl?: string;
}

class UpdatePageVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  seoDescription?: string;
}

class PublishDto {
  @ApiProperty({ enum: ['DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED', 'REJECTED'] })
  @IsIn(['DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED', 'REJECTED'])
  status!: CmsStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

@ApiTags('cms')
@Controller('platform/cms')
export class CmsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.CMS.READ')
  @Get('pages')
  @ApiOperation({ summary: 'Daftar halaman CMS' })
  listPages() {
    return this.prisma.cmsPage.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { id: true, versionNumber: true, title: true, status: true, publishedAt: true },
        },
      },
    });
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.CMS.READ')
  @Get('pages/:code')
  @ApiOperation({ summary: 'Detail halaman beserta blok versi terbaru' })
  async getPage(@Param('code') code: string) {
    const page = await this.prisma.cmsPage.findFirst({
      where: { code, deletedAt: null },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            translations: true,
            blocks: {
              where: { deletedAt: null },
              orderBy: { sortOrder: 'asc' },
              include: { translations: true },
            },
          },
        },
      },
    });
    if (!page) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Halaman tidak ditemukan.');
    return page;
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.CMS.MANAGE')
  @BlockDemo()
  @Patch('pages/:code/versions/:versionId')
  @ApiOperation({ summary: 'Mengubah judul, ringkasan, dan SEO versi halaman' })
  async updatePageVersion(
    @Param('versionId') versionId: string,
    @Body() dto: UpdatePageVersionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const version = await this.prisma.cmsPageVersion.findUnique({ where: { id: versionId } });
    if (!version) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Versi halaman tidak ditemukan.');
    if (version.status === 'PUBLISHED' && version.publishedAt) {
      // Versi published tidak diedit langsung; buat versi baru.
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Versi yang sudah dipublikasikan tidak dapat diedit. Buat versi baru terlebih dahulu.',
      );
    }

    const updated = await this.prisma.cmsPageVersion.update({
      where: { id: versionId },
      data: {
        title: dto.title ?? version.title,
        summary: dto.summary ?? version.summary,
        seoTitle: dto.seoTitle ?? version.seoTitle,
        seoDescription: dto.seoDescription ?? version.seoDescription,
        updatedBy: user.userId,
      },
    });

    await this.audit.record({
      moduleCode: 'CMS',
      actionCode: 'PAGE_VERSION_UPDATED',
      entityType: 'CmsPageVersion',
      entityId: versionId,
      actorUserId: user.userId,
    });
    return updated;
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.CMS.MANAGE')
  @BlockDemo()
  @Patch('blocks/:blockId')
  @ApiOperation({
    summary: 'Mengubah konten blok homepage tanpa mengubah source',
    description: 'Rich text disanitasi; JavaScript executable tidak pernah disimpan.',
  })
  async updateBlock(
    @Param('blockId') blockId: string,
    @Body() dto: UpdateBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const block = await this.prisma.cmsBlock.findUnique({ where: { id: blockId } });
    if (!block) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Blok tidak ditemukan.');

    const localeCode = dto.localeCode ?? 'id';
    const sanitizedBody = dto.body !== undefined ? sanitizeRichText(dto.body) : undefined;

    const translation = await this.prisma.cmsBlockTranslation.upsert({
      where: { blockId_localeCode: { blockId, localeCode } },
      create: {
        blockId,
        localeCode,
        eyebrow: dto.eyebrow ?? null,
        heading: dto.heading ?? null,
        subheading: dto.subheading ?? null,
        body: sanitizedBody ?? null,
        buttonLabel: dto.buttonLabel ?? null,
        buttonUrl: dto.buttonUrl ?? null,
      },
      update: {
        ...(dto.eyebrow !== undefined ? { eyebrow: dto.eyebrow } : {}),
        ...(dto.heading !== undefined ? { heading: dto.heading } : {}),
        ...(dto.subheading !== undefined ? { subheading: dto.subheading } : {}),
        ...(sanitizedBody !== undefined ? { body: sanitizedBody } : {}),
        ...(dto.buttonLabel !== undefined ? { buttonLabel: dto.buttonLabel } : {}),
        ...(dto.buttonUrl !== undefined ? { buttonUrl: dto.buttonUrl } : {}),
      },
    });

    await this.audit.record({
      moduleCode: 'CMS',
      actionCode: 'BLOCK_UPDATED',
      entityType: 'CmsBlockTranslation',
      entityId: translation.id,
      actorUserId: user.userId,
      metadata: { blockKey: block.blockKey, localeCode },
    });

    return translation;
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.CMS.PUBLISH')
  @BlockDemo()
  @Post('pages/:code/versions/:versionId/status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mengubah status publikasi halaman (draft/review/publish/arsip)' })
  async setPageStatus(
    @Param('code') code: string,
    @Param('versionId') versionId: string,
    @Body() dto: PublishDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const version = await this.prisma.cmsPageVersion.findUnique({
      where: { id: versionId },
      include: { page: true },
    });
    if (!version || version.page.code !== code) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Versi halaman tidak ditemukan.');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.cmsPageVersion.update({
        where: { id: versionId },
        data: {
          status: dto.status,
          publishedAt: dto.status === 'PUBLISHED' ? now : version.publishedAt,
          publishedBy: dto.status === 'PUBLISHED' ? user.userId : version.publishedBy,
        },
      });
      if (dto.status === 'PUBLISHED') {
        await tx.cmsPage.update({
          where: { id: version.pageId },
          data: { status: 'PUBLISHED', publishedVersionId: versionId },
        });
      } else if (dto.status === 'ARCHIVED') {
        await tx.cmsPage.update({ where: { id: version.pageId }, data: { status: 'ARCHIVED' } });
      }
      await tx.cmsPublicationWorkflow.create({
        data: {
          entityType: 'CmsPageVersion',
          entityId: versionId,
          status: dto.status,
          submittedById: user.userId,
          submittedAt: now,
          ...(dto.status === 'PUBLISHED' ? { publishedById: user.userId, publishedAt: now } : {}),
          ...(dto.status === 'IN_REVIEW' ? { reviewedById: user.userId, reviewedAt: now } : {}),
          comment: dto.comment ?? null,
        },
      });
    });

    await this.audit.record({
      moduleCode: 'CMS',
      actionCode: `PAGE_${dto.status}`,
      entityType: 'CmsPageVersion',
      entityId: versionId,
      actorUserId: user.userId,
      reason: dto.comment,
    });

    return { versionId, status: dto.status };
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.CMS.MANAGE')
  @BlockDemo()
  @Post('pages/:code/versions')
  @HttpCode(201)
  @ApiOperation({ summary: 'Membuat versi draft baru dari versi terbaru' })
  async createDraftVersion(@Param('code') code: string, @CurrentUser() user: AuthenticatedUser) {
    const page = await this.prisma.cmsPage.findFirst({
      where: { code, deletedAt: null },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: { blocks: { include: { translations: true } }, translations: true },
        },
      },
    });
    if (!page?.versions.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Halaman tidak ditemukan.');
    }

    const source = page.versions[0];
    const created = await this.prisma.cmsPageVersion.create({
      data: {
        pageId: page.id,
        versionNumber: source.versionNumber + 1,
        title: source.title,
        summary: source.summary,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        seoKeywords: source.seoKeywords,
        status: 'DRAFT',
        createdBy: user.userId,
        translations: {
          create: source.translations.map((t) => ({
            localeCode: t.localeCode,
            title: t.title,
            summary: t.summary,
            seoTitle: t.seoTitle,
            seoDescription: t.seoDescription,
          })),
        },
        blocks: {
          create: source.blocks.map((block) => ({
            blockKey: block.blockKey,
            blockType: block.blockType,
            layout: block.layout,
            settings: (block.settings ?? {}) as Prisma.InputJsonValue,
            sortOrder: block.sortOrder,
            createdBy: user.userId,
            translations: {
              create: block.translations.map((t) => ({
                localeCode: t.localeCode,
                eyebrow: t.eyebrow,
                heading: t.heading,
                subheading: t.subheading,
                body: t.body,
                buttonLabel: t.buttonLabel,
                buttonUrl: t.buttonUrl,
                contentJson: (t.contentJson ?? undefined) as Prisma.InputJsonValue | undefined,
              })),
            },
          })),
        },
      },
      include: { blocks: true },
    });

    await this.audit.record({
      moduleCode: 'CMS',
      actionCode: 'PAGE_VERSION_CREATED',
      entityType: 'CmsPageVersion',
      entityId: created.id,
      actorUserId: user.userId,
    });

    return created;
  }

  // --- Berita, pengumuman, FAQ, media -------------------------------------

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.CMS.READ')
  @Get('news')
  @ApiOperation({ summary: 'Daftar berita untuk pengelolaan' })
  listNews(@Query('status') status?: string) {
    return this.prisma.newsArticle.findMany({
      where: { deletedAt: null, ...(status ? { status: status as CmsStatus } : {}) },
      orderBy: { publishedAt: 'desc' },
      include: {
        category: { select: { code: true, defaultName: true } },
        versions: { orderBy: { versionNumber: 'desc' }, take: 1, select: { title: true, status: true } },
      },
    });
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.CMS.READ')
  @Get('announcements')
  @ApiOperation({ summary: 'Daftar pengumuman' })
  listAnnouncements() {
    return this.prisma.announcement.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.CMS.READ')
  @Get('faqs')
  @ApiOperation({ summary: 'FAQ untuk pengelolaan' })
  listFaqs() {
    return this.prisma.faqCategory.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: { items: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
    });
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.CMS.READ')
  @Get('media')
  @ApiOperation({ summary: 'Media library' })
  listMedia() {
    return this.prisma.mediaFolder.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: { assets: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
    });
  }

  @ApiBearerAuth('access-token')
  @PlatformPermissions('PLATFORM.CMS.READ')
  @Get('contact-messages')
  @ApiOperation({ summary: 'Pesan kontak masuk' })
  listContactMessages(@Query('status') status?: string) {
    return this.prisma.contactMessage.findMany({
      where: { deletedAt: null, ...(status ? { status: status as never } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}

@Module({
  controllers: [CmsAdminController],
})
export class CmsModule {}
