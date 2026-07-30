import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  ANNOUNCEMENT_SEED,
  CALL_TO_ACTION_SEED,
  CMS_PAGE_SEED,
  CONTACT_OFFICE_SEED,
  FAQ_CATEGORY_SEED,
  FAQ_ITEM_SEED,
  HERO_SLIDE_SEED,
  MARKETING_FEATURE_SEED,
  MEDIA_FOLDER_SEED,
  NAVIGATION_SEED,
  NEWS_ARTICLE_SEED,
  NEWS_CATEGORY_SEED,
  NEWS_TAG_SEED,
  PARTNER_LOGO_SEED,
  PRICING_SECTION_SEED,
  TESTIMONIAL_SEED,
  WEBSITE_SEED,
} from './registry/cms-seed';

/** Batch id tetap untuk data contoh CMS agar seed idempotent. */
const SAMPLE_BATCH_ID = '00000000-0000-4000-8000-0000000c5551';

@Injectable()
export class CmsSeedService {
  private readonly logger = new Logger(CmsSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedAll(): Promise<Record<string, number>> {
    const website = await this.seedWebsite();
    const summary: Record<string, number> = {};
    summary.mediaFolders = await this.seedMediaFolders();
    summary.heroSlides = await this.seedHeroSlides(website.id);
    summary.marketingFeatures = await this.seedMarketingFeatures();
    summary.faqCategories = await this.seedFaq();
    summary.testimonials = await this.seedTestimonials();
    summary.partnerLogos = await this.seedPartnerLogos();
    summary.newsCategories = await this.seedNewsCategories();
    summary.newsTags = await this.seedNewsTags();
    summary.newsArticles = await this.seedNewsArticles();
    summary.announcements = await this.seedAnnouncements();
    summary.callToActions = await this.seedCallToActions();
    summary.contactOffices = await this.seedContactOffices();
    summary.navigation = await this.seedNavigation(website.id);
    summary.footer = await this.seedFooter(website.id);
    summary.pricingSection = await this.seedPricingSection(website.id);
    summary.cmsPages = await this.seedPages(website.id);
    return summary;
  }

  private async seedWebsite() {
    return this.prisma.website.upsert({
      where: { code: WEBSITE_SEED.code },
      create: { ...WEBSITE_SEED, isSystem: true },
      update: { name: WEBSITE_SEED.name, primaryDomain: WEBSITE_SEED.primaryDomain },
    });
  }

  private async seedMediaFolders(): Promise<number> {
    const idByCode = new Map<string, string>();
    for (const folder of MEDIA_FOLDER_SEED) {
      const parentId = folder.parentCode ? idByCode.get(folder.parentCode) ?? null : null;
      const created = await this.prisma.mediaFolder.upsert({
        where: { code: folder.code },
        create: {
          code: folder.code,
          name: folder.name,
          path: folder.path,
          parentId,
          sortOrder: folder.sortOrder,
          isSystem: true,
        },
        update: { name: folder.name, path: folder.path, parentId, sortOrder: folder.sortOrder },
      });
      idByCode.set(folder.code, created.id);
    }
    return MEDIA_FOLDER_SEED.length;
  }

  private async seedHeroSlides(websiteId: string): Promise<number> {
    for (const slide of HERO_SLIDE_SEED) {
      await this.prisma.heroSlide.upsert({
        where: { websiteId_code: { websiteId, code: slide.code } },
        create: { ...slide, websiteId, isSample: true, sampleBatchId: SAMPLE_BATCH_ID },
        update: {
          defaultTitle: slide.defaultTitle,
          defaultSubtitle: slide.defaultSubtitle,
          defaultEyebrow: slide.defaultEyebrow,
          primaryCtaLabel: slide.primaryCtaLabel,
          primaryCtaUrl: slide.primaryCtaUrl,
          secondaryCtaLabel: slide.secondaryCtaLabel,
          secondaryCtaUrl: slide.secondaryCtaUrl,
        },
      });
    }
    return HERO_SLIDE_SEED.length;
  }

  private async seedMarketingFeatures(): Promise<number> {
    const modules = await this.prisma.moduleCatalog.findMany({ select: { id: true, code: true } });
    const moduleMap = new Map(modules.map((m) => [m.code, m.id]));

    for (const feature of MARKETING_FEATURE_SEED) {
      const moduleId = feature.moduleCode ? moduleMap.get(feature.moduleCode) ?? null : null;
      await this.prisma.marketingFeature.upsert({
        where: { code: feature.code },
        create: {
          code: feature.code,
          moduleId,
          moduleCode: feature.moduleCode ?? null,
          titleKey: feature.titleKey,
          defaultTitle: feature.defaultTitle,
          descriptionKey: feature.descriptionKey ?? null,
          defaultDescription: feature.defaultDescription ?? null,
          icon: feature.icon ?? null,
          group: feature.group,
          sortOrder: feature.sortOrder,
          isSample: true,
          sampleBatchId: SAMPLE_BATCH_ID,
        },
        update: {
          moduleId,
          defaultTitle: feature.defaultTitle,
          defaultDescription: feature.defaultDescription ?? null,
          icon: feature.icon ?? null,
          group: feature.group,
          sortOrder: feature.sortOrder,
        },
      });
    }
    return MARKETING_FEATURE_SEED.length;
  }

  private async seedFaq(): Promise<number> {
    const idByCode = new Map<string, string>();
    for (const category of FAQ_CATEGORY_SEED) {
      const created = await this.prisma.faqCategory.upsert({
        where: { code: category.code },
        create: {
          code: category.code,
          nameKey: `web.faq.category.${category.code.toLowerCase()}`,
          defaultName: category.name,
          sortOrder: category.sortOrder,
          isSample: true,
          sampleBatchId: SAMPLE_BATCH_ID,
        },
        update: { defaultName: category.name, sortOrder: category.sortOrder },
      });
      idByCode.set(category.code, created.id);
    }

    for (const item of FAQ_ITEM_SEED) {
      const categoryId = idByCode.get(item.categoryCode);
      if (!categoryId) continue;
      await this.prisma.faqItem.upsert({
        where: { code: item.code },
        create: {
          code: item.code,
          categoryId,
          questionKey: `web.faq.q.${item.code.toLowerCase()}`,
          defaultQuestion: item.question,
          answerKey: `web.faq.a.${item.code.toLowerCase()}`,
          defaultAnswer: item.answer,
          sortOrder: item.sortOrder,
          isSample: true,
          sampleBatchId: SAMPLE_BATCH_ID,
        },
        update: {
          categoryId,
          defaultQuestion: item.question,
          defaultAnswer: item.answer,
          sortOrder: item.sortOrder,
        },
      });
    }
    return FAQ_CATEGORY_SEED.length;
  }

  private async seedTestimonials(): Promise<number> {
    for (const testimonial of TESTIMONIAL_SEED) {
      await this.prisma.testimonial.upsert({
        where: { code: testimonial.code },
        create: {
          code: testimonial.code,
          personName: testimonial.personName,
          organization: testimonial.organization,
          roleTitle: testimonial.roleTitle,
          quoteKey: `web.testimonial.${testimonial.code.toLowerCase()}`,
          defaultQuote: testimonial.quote,
          rating: testimonial.rating,
          sortOrder: testimonial.sortOrder,
          isSample: true,
          sampleBatchId: SAMPLE_BATCH_ID,
        },
        update: {
          personName: testimonial.personName,
          organization: testimonial.organization,
          defaultQuote: testimonial.quote,
          rating: testimonial.rating,
          sortOrder: testimonial.sortOrder,
        },
      });
    }
    return TESTIMONIAL_SEED.length;
  }

  private async seedPartnerLogos(): Promise<number> {
    for (const partner of PARTNER_LOGO_SEED) {
      await this.prisma.partnerLogo.upsert({
        where: { code: partner.code },
        create: {
          code: partner.code,
          name: partner.name,
          websiteUrl: partner.websiteUrl,
          sortOrder: partner.sortOrder,
          isSample: true,
          sampleBatchId: SAMPLE_BATCH_ID,
        },
        update: { name: partner.name, sortOrder: partner.sortOrder },
      });
    }
    return PARTNER_LOGO_SEED.length;
  }

  private async seedNewsCategories(): Promise<number> {
    for (const category of NEWS_CATEGORY_SEED) {
      await this.prisma.newsCategory.upsert({
        where: { code: category.code },
        create: {
          code: category.code,
          nameKey: `web.news.category.${category.code.toLowerCase()}`,
          defaultName: category.name,
          slug: category.slug,
          sortOrder: category.sortOrder,
          isSample: true,
          sampleBatchId: SAMPLE_BATCH_ID,
        },
        update: { defaultName: category.name, slug: category.slug, sortOrder: category.sortOrder },
      });
    }
    return NEWS_CATEGORY_SEED.length;
  }

  private async seedNewsTags(): Promise<number> {
    for (const [index, tag] of NEWS_TAG_SEED.entries()) {
      await this.prisma.newsTag.upsert({
        where: { code: tag.code },
        create: {
          code: tag.code,
          nameKey: `web.news.tag.${tag.code.toLowerCase()}`,
          defaultName: tag.name,
          slug: tag.slug,
          sortOrder: index + 1,
          isSample: true,
          sampleBatchId: SAMPLE_BATCH_ID,
        },
        update: { defaultName: tag.name, slug: tag.slug, sortOrder: index + 1 },
      });
    }
    return NEWS_TAG_SEED.length;
  }

  private async seedNewsArticles(): Promise<number> {
    const categories = await this.prisma.newsCategory.findMany({ select: { id: true, code: true } });
    const categoryMap = new Map(categories.map((c) => [c.code, c.id]));
    const tags = await this.prisma.newsTag.findMany({ select: { id: true, code: true } });
    const tagMap = new Map(tags.map((t) => [t.code, t.id]));

    for (const [index, article] of NEWS_ARTICLE_SEED.entries()) {
      const categoryId = categoryMap.get(article.categoryCode);
      if (!categoryId) continue;

      const publishedAt = new Date(Date.now() - article.daysAgo * 86_400_000);
      const created = await this.prisma.newsArticle.upsert({
        where: { code: article.code },
        create: {
          code: article.code,
          categoryId,
          slug: article.slug,
          status: 'PUBLISHED',
          publishedAt,
          isFeatured: article.isFeatured ?? false,
          isPinned: article.isPinned ?? false,
          sortOrder: index + 1,
          isSample: true,
          sampleBatchId: SAMPLE_BATCH_ID,
        },
        update: {
          categoryId,
          slug: article.slug,
          status: 'PUBLISHED',
          isFeatured: article.isFeatured ?? false,
          isPinned: article.isPinned ?? false,
          sortOrder: index + 1,
        },
      });

      const version = await this.prisma.newsArticleVersion.upsert({
        where: { articleId_versionNumber: { articleId: created.id, versionNumber: 1 } },
        create: {
          articleId: created.id,
          versionNumber: 1,
          title: article.title,
          summary: article.summary,
          content: buildArticleContent(article.title, article.summary),
          status: 'PUBLISHED',
        },
        update: {
          title: article.title,
          summary: article.summary,
          content: buildArticleContent(article.title, article.summary),
          status: 'PUBLISHED',
        },
      });

      if (created.publishedVersionId !== version.id) {
        await this.prisma.newsArticle.update({
          where: { id: created.id },
          data: { publishedVersionId: version.id },
        });
      }

      await this.prisma.newsArticleTranslation.upsert({
        where: {
          articleVersionId_localeCode: { articleVersionId: version.id, localeCode: 'id' },
        },
        create: {
          articleVersionId: version.id,
          localeCode: 'id',
          title: article.title,
          summary: article.summary,
          content: buildArticleContent(article.title, article.summary),
          seoTitle: article.title,
          seoDescription: article.summary,
        },
        update: { title: article.title, summary: article.summary },
      });

      for (const tagCode of article.tags ?? []) {
        const tagId = tagMap.get(tagCode);
        if (!tagId) continue;
        await this.prisma.newsArticleTag.upsert({
          where: { articleId_tagId: { articleId: created.id, tagId } },
          create: { articleId: created.id, tagId },
          update: {},
        });
      }
    }
    return NEWS_ARTICLE_SEED.length;
  }

  private async seedAnnouncements(): Promise<number> {
    const startsAt = new Date('2026-01-01T00:00:00.000Z');
    for (const announcement of ANNOUNCEMENT_SEED) {
      await this.prisma.announcement.upsert({
        where: { code: announcement.code },
        create: {
          code: announcement.code,
          titleKey: `web.announcement.${announcement.code.toLowerCase()}.title`,
          defaultTitle: announcement.title,
          bodyKey: `web.announcement.${announcement.code.toLowerCase()}.body`,
          defaultBody: announcement.body,
          severity: announcement.severity,
          audienceType: announcement.audience,
          startsAt,
          sortOrder: announcement.sortOrder,
          isSample: true,
          sampleBatchId: SAMPLE_BATCH_ID,
        },
        update: {
          defaultTitle: announcement.title,
          defaultBody: announcement.body,
          severity: announcement.severity,
          audienceType: announcement.audience,
          sortOrder: announcement.sortOrder,
        },
      });
    }
    return ANNOUNCEMENT_SEED.length;
  }

  private async seedCallToActions(): Promise<number> {
    for (const cta of CALL_TO_ACTION_SEED) {
      await this.prisma.callToAction.upsert({
        where: { code: cta.code },
        create: {
          code: cta.code,
          titleKey: `web.cta.${cta.code.toLowerCase()}.title`,
          defaultTitle: cta.title,
          bodyKey: `web.cta.${cta.code.toLowerCase()}.body`,
          defaultBody: cta.body,
          buttonKey: `web.cta.${cta.code.toLowerCase()}.button`,
          defaultButton: cta.button,
          url: cta.url,
          style: cta.style,
          sortOrder: cta.sortOrder,
          isSample: true,
          sampleBatchId: SAMPLE_BATCH_ID,
        },
        update: {
          defaultTitle: cta.title,
          defaultBody: cta.body,
          defaultButton: cta.button,
          url: cta.url,
          sortOrder: cta.sortOrder,
        },
      });
    }
    return CALL_TO_ACTION_SEED.length;
  }

  private async seedContactOffices(): Promise<number> {
    for (const office of CONTACT_OFFICE_SEED) {
      await this.prisma.contactOffice.upsert({
        where: { code: office.code },
        create: { ...office, isSample: true, sampleBatchId: SAMPLE_BATCH_ID },
        update: {
          name: office.name,
          address: office.address,
          phone: office.phone,
          email: office.email,
          openingHours: office.openingHours,
        },
      });
    }
    return CONTACT_OFFICE_SEED.length;
  }

  private async seedNavigation(websiteId: string): Promise<number> {
    const navigation = await this.prisma.cmsNavigation.upsert({
      where: { websiteId_code: { websiteId, code: 'MAIN_HEADER' } },
      create: {
        websiteId,
        code: 'MAIN_HEADER',
        name: 'Navigasi Utama',
        location: 'HEADER',
        isSystem: true,
      },
      update: {},
    });

    const pages = await this.prisma.cmsPage.findMany({ select: { id: true, slug: true } });
    const pageBySlug = new Map(pages.map((p) => [`/${p.slug}`, p.id]));

    for (const item of NAVIGATION_SEED.header) {
      const existing = await this.prisma.cmsNavigationItem.findFirst({
        where: { navigationId: navigation.id, labelKey: `web.nav.${item.code.toLowerCase()}` },
      });
      const data = {
        navigationId: navigation.id,
        labelKey: `web.nav.${item.code.toLowerCase()}`,
        defaultLabel: item.label,
        externalUrl: item.url,
        pageId: pageBySlug.get(item.url) ?? null,
        sortOrder: item.sortOrder,
      };
      if (existing) {
        await this.prisma.cmsNavigationItem.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.cmsNavigationItem.create({ data });
      }
    }
    return NAVIGATION_SEED.header.length;
  }

  private async seedFooter(websiteId: string): Promise<number> {
    let count = 0;
    for (const [index, section] of NAVIGATION_SEED.footer.entries()) {
      const created = await this.prisma.cmsFooterSection.upsert({
        where: { websiteId_code: { websiteId, code: section.code } },
        create: {
          websiteId,
          code: section.code,
          titleKey: `web.footer.${section.code.toLowerCase()}`,
          defaultTitle: section.title,
          sortOrder: index + 1,
          isSample: true,
          sampleBatchId: SAMPLE_BATCH_ID,
        },
        update: { defaultTitle: section.title, sortOrder: index + 1 },
      });

      for (const [itemIndex, item] of section.items.entries()) {
        const existing = await this.prisma.cmsFooterItem.findFirst({
          where: { footerSectionId: created.id, labelKey: `web.footer.item.${item.code.toLowerCase()}` },
        });
        const data = {
          footerSectionId: created.id,
          labelKey: `web.footer.item.${item.code.toLowerCase()}`,
          defaultLabel: item.label,
          url: item.url,
          sortOrder: itemIndex + 1,
        };
        if (existing) {
          await this.prisma.cmsFooterItem.update({ where: { id: existing.id }, data });
        } else {
          await this.prisma.cmsFooterItem.create({ data });
        }
        count += 1;
      }
    }
    return count;
  }

  private async seedPricingSection(websiteId: string): Promise<number> {
    await this.prisma.pricingDisplaySection.upsert({
      where: { websiteId_code: { websiteId, code: PRICING_SECTION_SEED.code } },
      create: {
        websiteId,
        code: PRICING_SECTION_SEED.code,
        titleKey: 'web.pricing.title',
        defaultTitle: PRICING_SECTION_SEED.title,
        descriptionKey: 'web.pricing.description',
        defaultDescription: PRICING_SECTION_SEED.description,
        displayMode: PRICING_SECTION_SEED.displayMode,
        footnoteKey: 'web.pricing.footnote',
        defaultFootnote: PRICING_SECTION_SEED.footnote,
        isSample: true,
        sampleBatchId: SAMPLE_BATCH_ID,
      },
      update: {
        defaultTitle: PRICING_SECTION_SEED.title,
        defaultDescription: PRICING_SECTION_SEED.description,
        defaultFootnote: PRICING_SECTION_SEED.footnote,
      },
    });
    return 1;
  }

  private async seedPages(websiteId: string): Promise<number> {
    for (const pageSeed of CMS_PAGE_SEED) {
      const page = await this.prisma.cmsPage.upsert({
        where: { websiteId_code: { websiteId, code: pageSeed.code } },
        create: {
          websiteId,
          code: pageSeed.code,
          slug: pageSeed.slug,
          pageType: pageSeed.pageType,
          status: 'PUBLISHED',
          showInNavigation: pageSeed.showInNavigation,
          sortOrder: pageSeed.sortOrder,
          isSystem: true,
        },
        update: {
          slug: pageSeed.slug,
          pageType: pageSeed.pageType,
          status: 'PUBLISHED',
          showInNavigation: pageSeed.showInNavigation,
          sortOrder: pageSeed.sortOrder,
        },
      });

      const version = await this.prisma.cmsPageVersion.upsert({
        where: { pageId_versionNumber: { pageId: page.id, versionNumber: 1 } },
        create: {
          pageId: page.id,
          versionNumber: 1,
          title: pageSeed.title,
          summary: pageSeed.summary,
          seoTitle: pageSeed.seoTitle,
          seoDescription: pageSeed.seoDescription,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
        update: {
          title: pageSeed.title,
          summary: pageSeed.summary,
          seoTitle: pageSeed.seoTitle,
          seoDescription: pageSeed.seoDescription,
          status: 'PUBLISHED',
        },
      });

      if (page.publishedVersionId !== version.id) {
        await this.prisma.cmsPage.update({
          where: { id: page.id },
          data: { publishedVersionId: version.id },
        });
      }

      await this.prisma.cmsPageTranslation.upsert({
        where: { pageVersionId_localeCode: { pageVersionId: version.id, localeCode: 'id' } },
        create: {
          pageVersionId: version.id,
          localeCode: 'id',
          title: pageSeed.title,
          summary: pageSeed.summary,
          seoTitle: pageSeed.seoTitle,
          seoDescription: pageSeed.seoDescription,
        },
        update: { title: pageSeed.title, summary: pageSeed.summary },
      });

      for (const blockSeed of pageSeed.blocks) {
        const block = await this.prisma.cmsBlock.upsert({
          where: { pageVersionId_blockKey: { pageVersionId: version.id, blockKey: blockSeed.key } },
          create: {
            pageVersionId: version.id,
            blockKey: blockSeed.key,
            blockType: blockSeed.type,
            sortOrder: blockSeed.sortOrder,
            settings: {} as Prisma.InputJsonValue,
          },
          update: { blockType: blockSeed.type, sortOrder: blockSeed.sortOrder },
        });

        await this.prisma.cmsBlockTranslation.upsert({
          where: { blockId_localeCode: { blockId: block.id, localeCode: 'id' } },
          create: {
            blockId: block.id,
            localeCode: 'id',
            eyebrow: blockSeed.eyebrow ?? null,
            heading: blockSeed.heading ?? null,
            subheading: blockSeed.subheading ?? null,
            body: blockSeed.body ?? null,
            buttonLabel: blockSeed.buttonLabel ?? null,
            buttonUrl: blockSeed.buttonUrl ?? null,
          },
          update: {
            eyebrow: blockSeed.eyebrow ?? null,
            heading: blockSeed.heading ?? null,
            subheading: blockSeed.subheading ?? null,
            body: blockSeed.body ?? null,
            buttonLabel: blockSeed.buttonLabel ?? null,
            buttonUrl: blockSeed.buttonUrl ?? null,
          },
        });
      }

      await this.prisma.seoStructuredData.upsert({
        where: { pageId_schemaType: { pageId: page.id, schemaType: 'WebPage' } },
        create: {
          pageId: page.id,
          schemaType: 'WebPage',
          jsonData: {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: pageSeed.title,
            description: pageSeed.summary,
          } as Prisma.InputJsonValue,
        },
        update: {
          jsonData: {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: pageSeed.title,
            description: pageSeed.summary,
          } as Prisma.InputJsonValue,
        },
      });
    }
    return CMS_PAGE_SEED.length;
  }
}

function buildArticleContent(title: string, summary: string): string {
  return [
    `<p><strong>${escapeHtml(summary)}</strong></p>`,
    `<p>${escapeHtml(title)} merupakan bagian dari upaya berkelanjutan eBisnis.id menyediakan platform operasional yang dapat dipakai pelaku usaha dari berbagai skala.</p>`,
    '<p>Fitur ini tersedia untuk seluruh pendaftar sesuai paket berlangganan yang aktif. Silakan masuk ke portal untuk mencobanya, atau gunakan sandbox demo untuk melihat alurnya terlebih dahulu.</p>',
    '<p>Untuk pertanyaan lebih lanjut, hubungi tim dukungan melalui halaman Kontak.</p>',
  ].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
