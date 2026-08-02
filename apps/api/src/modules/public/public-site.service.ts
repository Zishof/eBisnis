import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

/**
 * API publik website eBisnis.id.
 * Seluruh konten berasal dari CMS pada schema `platform`, sehingga homepage
 * dapat diubah Platform Super Admin tanpa mengubah source dan tanpa rebuild.
 */
@Injectable()
export class PublicSiteService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ID situs platform eBisnis.id sendiri (`tenant_id IS NULL`).
   *
   * Dipakai `getPage()`, `listNews()`, dan `getNewsArticle()` (EP-C2) selain
   * `getSite()` — bukan hanya beranda yang dapat salah menampilkan situs
   * pondok, tetapi juga halaman CMS dan berita, sebab `CmsPage.slug` dan
   * (sejak EP-C2) `NewsArticle.slug`/`NewsCategory.slug` hanya unik PER SITUS,
   * bukan global. Query tanpa penyaring `websiteId` dapat mengembalikan baris
   * milik situs pondok mana pun yang kebetulan memakai slug yang sama.
   */
  private async idSitusPlatform(): Promise<string> {
    const website = await this.prisma.website.findFirst({
      where: { isActive: true, deletedAt: null, tenantId: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });
    if (!website) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Website belum dikonfigurasi.');
    }
    return website.id;
  }

  async getSite(localeCode: string) {
    const website = await this.prisma.website.findFirst({
      /*
       * `tenantId: null` dijaga eksplisit sejak EP-C.
       *
       * Sejak situs pondok pesantren memperoleh baris `Website` miliknya
       * sendiri, tabel ini memuat situs platform DAN situs penyewa sekaligus.
       * Tanpa penyaring ini, `findFirst` yang diurutkan `sortOrder` dapat
       * mengembalikan situs sebuah pondok sebagai beranda eBisnis.id — dan
       * kesalahannya baru terlihat sebagai "beranda menampilkan nama pondok
       * yang salah", bukan sebagai galat.
       */
      where: { isActive: true, deletedAt: null, tenantId: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        navigations: {
          where: { isActive: true, deletedAt: null },
          include: {
            items: {
              where: { isActive: true, deletedAt: null },
              orderBy: { sortOrder: 'asc' },
              include: { page: { select: { slug: true } } },
            },
          },
        },
        footerSections: {
          where: { isActive: true, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            items: { where: { isActive: true, deletedAt: null }, orderBy: { sortOrder: 'asc' } },
          },
        },
        heroSlides: {
          where: { isActive: true, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
        pricingSections: { where: { isActive: true, deletedAt: null } },
      },
    });

    if (!website) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Website belum dikonfigurasi.');
    }

    const locales = await this.prisma.locale.findMany({
      where: { enabled: true, isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        code: true,
        name: true,
        nativeName: true,
        direction: true,
        isDefault: true,
        numberFormat: true,
      },
    });

    return {
      code: website.code,
      name: website.name,
      primaryDomain: website.primaryDomain,
      defaultLocaleCode: website.defaultLocaleCode,
      themeCode: website.themeCode,
      activeLocale: localeCode,
      locales,
      navigation: website.navigations.map((nav) => ({
        code: nav.code,
        location: nav.location,
        items: nav.items.map((item) => ({
          labelKey: item.labelKey,
          label: item.defaultLabel,
          url: item.page ? `/${item.page.slug}` : (item.externalUrl ?? '#'),
          icon: item.icon,
          target: item.target,
          sortOrder: item.sortOrder,
        })),
      })),
      footer: website.footerSections.map((section) => ({
        code: section.code,
        titleKey: section.titleKey,
        title: section.defaultTitle,
        items: section.items.map((item) => ({
          labelKey: item.labelKey,
          label: item.defaultLabel,
          url: item.url,
          icon: item.icon,
        })),
      })),
      hero: website.heroSlides.map((slide) => ({
        code: slide.code,
        eyebrowKey: slide.eyebrowKey,
        eyebrow: slide.defaultEyebrow,
        titleKey: slide.titleKey,
        title: slide.defaultTitle,
        subtitleKey: slide.subtitleKey,
        subtitle: slide.defaultSubtitle,
        primaryCta: slide.primaryCtaLabel
          ? { labelKey: slide.primaryCtaLabelKey, label: slide.primaryCtaLabel, url: slide.primaryCtaUrl }
          : null,
        secondaryCta: slide.secondaryCtaLabel
          ? { labelKey: slide.secondaryCtaLabelKey, label: slide.secondaryCtaLabel, url: slide.secondaryCtaUrl }
          : null,
      })),
      pricingSection: website.pricingSections[0]
        ? {
            titleKey: website.pricingSections[0].titleKey,
            title: website.pricingSections[0].defaultTitle,
            descriptionKey: website.pricingSections[0].descriptionKey,
            description: website.pricingSections[0].defaultDescription,
            displayMode: website.pricingSections[0].displayMode,
            footnoteKey: website.pricingSections[0].footnoteKey,
            footnote: website.pricingSections[0].defaultFootnote,
          }
        : null,
    };
  }

  /** Halaman CMS beserta blok. Hanya versi PUBLISHED yang dikembalikan. */
  async getPage(slug: string, localeCode: string) {
    const websiteId = await this.idSitusPlatform();
    const page = await this.prisma.cmsPage.findFirst({
      where: { websiteId, slug, status: 'PUBLISHED', isActive: true, deletedAt: null },
      include: {
        versions: {
          where: { status: 'PUBLISHED', deletedAt: null },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            translations: true,
            blocks: {
              where: { isActive: true, deletedAt: null },
              orderBy: { sortOrder: 'asc' },
              include: { translations: true },
            },
          },
        },
        structuredData: { where: { isActive: true } },
      },
    });

    if (!page || !page.versions.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, `Halaman "${slug}" tidak ditemukan.`);
    }

    const version = page.versions[0];
    const translation =
      version.translations.find((t) => t.localeCode === localeCode) ??
      version.translations.find((t) => t.localeCode === 'id');

    return {
      slug: page.slug,
      code: page.code,
      pageType: page.pageType,
      templateCode: page.templateCode,
      title: translation?.title ?? version.title,
      summary: translation?.summary ?? version.summary,
      seo: {
        title: translation?.seoTitle ?? version.seoTitle ?? version.title,
        description: translation?.seoDescription ?? version.seoDescription ?? version.summary,
        keywords: version.seoKeywords,
      },
      structuredData: page.structuredData.map((sd) => sd.jsonData),
      publishedAt: version.publishedAt,
      blocks: version.blocks.map((block) => {
        const blockTranslation =
          block.translations.find((t) => t.localeCode === localeCode) ??
          block.translations.find((t) => t.localeCode === 'id');
        return {
          key: block.blockKey,
          type: block.blockType,
          layout: block.layout,
          settings: block.settings,
          sortOrder: block.sortOrder,
          eyebrow: blockTranslation?.eyebrow ?? null,
          heading: blockTranslation?.heading ?? null,
          subheading: blockTranslation?.subheading ?? null,
          body: blockTranslation?.body ?? null,
          buttonLabel: blockTranslation?.buttonLabel ?? null,
          buttonUrl: blockTranslation?.buttonUrl ?? null,
          content: blockTranslation?.contentJson ?? null,
        };
      }),
    };
  }

  async listNavigation(localeCode: string) {
    const site = await this.getSite(localeCode);
    return { navigation: site.navigation, footer: site.footer };
  }

  async listNews(params: { page: number; pageSize: number; categorySlug?: string; tagSlug?: string; localeCode: string }) {
    const websiteId = await this.idSitusPlatform();
    const where = {
      websiteId,
      status: 'PUBLISHED' as const,
      isActive: true,
      deletedAt: null,
      publishedAt: { lte: new Date() },
      OR: [{ expiredAt: null }, { expiredAt: { gte: new Date() } }],
      ...(params.categorySlug ? { category: { slug: params.categorySlug, websiteId } } : {}),
      ...(params.tagSlug ? { tags: { some: { tag: { slug: params.tagSlug } } } } : {}),
    };

    const [total, articles] = await Promise.all([
      this.prisma.newsArticle.count({ where }),
      this.prisma.newsArticle.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          category: { select: { code: true, slug: true, defaultName: true, nameKey: true } },
          featuredImage: { select: { publicUrl: true, defaultAlt: true } },
          tags: { include: { tag: { select: { slug: true, defaultName: true } } } },
          versions: {
            where: { status: 'PUBLISHED' },
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: { translations: true },
          },
        },
      }),
    ]);

    return {
      items: articles.map((article) => {
        const version = article.versions[0];
        const translation =
          version?.translations.find((t) => t.localeCode === params.localeCode) ??
          version?.translations.find((t) => t.localeCode === 'id');
        return {
          slug: article.slug,
          title: translation?.title ?? version?.title ?? article.slug,
          summary: translation?.summary ?? version?.summary ?? null,
          publishedAt: article.publishedAt,
          isFeatured: article.isFeatured,
          isPinned: article.isPinned,
          category: {
            slug: article.category.slug,
            name: article.category.defaultName,
            nameKey: article.category.nameKey,
          },
          image: article.featuredImage?.publicUrl ?? null,
          tags: article.tags.map((t) => ({ slug: t.tag.slug, name: t.tag.defaultName })),
        };
      }),
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
        hasNext: params.page * params.pageSize < total,
        hasPrev: params.page > 1,
      },
    };
  }

  async getNewsArticle(slug: string, localeCode: string) {
    const websiteId = await this.idSitusPlatform();
    const article = await this.prisma.newsArticle.findFirst({
      where: { websiteId, slug, status: 'PUBLISHED', isActive: true, deletedAt: null },
      include: {
        category: { select: { slug: true, defaultName: true, nameKey: true } },
        author: { select: { displayName: true } },
        featuredImage: { select: { publicUrl: true, defaultAlt: true } },
        tags: { include: { tag: { select: { slug: true, defaultName: true } } } },
        versions: {
          where: { status: 'PUBLISHED' },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: { translations: true },
        },
      },
    });

    if (!article || !article.versions.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, `Berita "${slug}" tidak ditemukan.`);
    }

    const version = article.versions[0];
    const translation =
      version.translations.find((t) => t.localeCode === localeCode) ??
      version.translations.find((t) => t.localeCode === 'id');

    // Penghitung tampilan tidak boleh menggagalkan permintaan.
    await this.prisma.newsArticle
      .update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    return {
      slug: article.slug,
      title: translation?.title ?? version.title,
      summary: translation?.summary ?? version.summary,
      content: translation?.content ?? version.content,
      publishedAt: article.publishedAt,
      author: article.author?.displayName ?? null,
      category: {
        slug: article.category.slug,
        name: article.category.defaultName,
        nameKey: article.category.nameKey,
      },
      image: article.featuredImage?.publicUrl ?? null,
      tags: article.tags.map((t) => ({ slug: t.tag.slug, name: t.tag.defaultName })),
      seo: {
        title: translation?.seoTitle ?? version.title,
        description: translation?.seoDescription ?? version.summary,
      },
    };
  }

  async listAnnouncements(audience: 'PUBLIC' | 'TENANT' | 'PLATFORM_ADMIN' = 'PUBLIC') {
    const now = new Date();
    const items = await this.prisma.announcement.findMany({
      where: {
        audienceType: audience,
        isActive: true,
        deletedAt: null,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      orderBy: [{ severity: 'desc' }, { sortOrder: 'asc' }],
      select: {
        code: true,
        titleKey: true,
        defaultTitle: true,
        bodyKey: true,
        defaultBody: true,
        severity: true,
        isDismissible: true,
        linkUrl: true,
        startsAt: true,
        endsAt: true,
      },
    });
    return items.map((item) => ({
      code: item.code,
      titleKey: item.titleKey,
      title: item.defaultTitle,
      bodyKey: item.bodyKey,
      body: item.defaultBody,
      severity: item.severity,
      isDismissible: item.isDismissible,
      linkUrl: item.linkUrl,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
    }));
  }

  async listFaqs() {
    const categories = await this.prisma.faqCategory.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { isActive: true, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    return categories
      .filter((category) => category.items.length > 0)
      .map((category) => ({
        code: category.code,
        nameKey: category.nameKey,
        name: category.defaultName,
        items: category.items.map((item) => ({
          code: item.code,
          questionKey: item.questionKey,
          question: item.defaultQuestion,
          answerKey: item.answerKey,
          answer: item.defaultAnswer,
        })),
      }));
  }

  async listMarketingContent() {
    const [features, testimonials, partners, ctas, offices] = await Promise.all([
      this.prisma.marketingFeature.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.testimonial.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.partnerLogo.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.callToAction.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.contactOffice.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    const byGroup = (group: string) =>
      features
        .filter((f) => f.group === group)
        .map((f) => ({
          code: f.code,
          moduleCode: f.moduleCode,
          icon: f.icon,
          titleKey: f.titleKey,
          title: f.defaultTitle,
          descriptionKey: f.descriptionKey,
          description: f.defaultDescription,
        }));

    return {
      features: byGroup('FEATURE'),
      modules: byGroup('MODULE'),
      steps: byGroup('STEP'),
      advantages: byGroup('ADVANTAGE'),
      testimonials: testimonials.map((t) => ({
        code: t.code,
        personName: t.personName,
        organization: t.organization,
        roleTitle: t.roleTitle,
        quoteKey: t.quoteKey,
        quote: t.defaultQuote,
        rating: t.rating,
      })),
      partners: partners.map((p) => ({ code: p.code, name: p.name, logoUrl: p.logoUrl, websiteUrl: p.websiteUrl })),
      callToActions: ctas.map((c) => ({
        code: c.code,
        titleKey: c.titleKey,
        title: c.defaultTitle,
        bodyKey: c.bodyKey,
        body: c.defaultBody,
        buttonKey: c.buttonKey,
        button: c.defaultButton,
        url: c.url,
        style: c.style,
      })),
      contactOffices: offices.map((o) => ({
        code: o.code,
        name: o.name,
        address: o.address,
        phone: o.phone,
        email: o.email,
        mapUrl: o.mapUrl,
        openingHours: o.openingHours,
        isPrimary: o.isPrimary,
      })),
    };
  }

  /** Paket publik — harga selalu dari pricing engine published, bukan hard-coded. */
  async listPublishedPackages(currencyCode = 'IDR') {
    const now = new Date();
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { status: 'PUBLISHED', isPublic: true, isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        versions: {
          where: {
            status: 'PUBLISHED',
            deletedAt: null,
            effectiveFrom: { lte: now },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }],
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          include: {
            prices: {
              where: { isActive: true, deletedAt: null, currencyCode },
              include: { tiers: { orderBy: { minQuantity: 'asc' } } },
            },
            modules: { where: { included: true }, include: { module: true }, orderBy: { sortOrder: 'asc' } },
            features: { where: { included: true }, include: { feature: true } },
            constraints: true,
          },
        },
      },
    });

    return plans
      .filter((plan) => plan.versions.length > 0)
      .map((plan) => {
        const version = plan.versions[0];
        const monthly = version.prices.find(
          (p) => p.billingInterval === 'MONTH' && p.intervalCount === 1,
        );
        return {
          code: plan.code,
          name: plan.name,
          nameKey: plan.nameKey,
          descriptionKey: plan.descriptionKey,
          description: (plan.metadata as { description?: string } | null)?.description ?? null,
          isRecommended: plan.isRecommended,
          sortOrder: plan.sortOrder,
          versionNumber: version.versionNumber,
          trialDays: version.trialDays,
          gracePeriodDays: version.gracePeriodDays,
          futureModulePolicy: version.futureModulePolicy,
          price: monthly
            ? {
                currencyCode: monthly.currencyCode,
                billingMetric: monthly.billingMetric,
                billingInterval: monthly.billingInterval,
                intervalCount: monthly.intervalCount,
                // Decimal diserialisasi sebagai string.
                unitPrice: monthly.unitPrice.toFixed(),
                minimumQty: monthly.minimumQty,
                tiers: monthly.tiers.map((tier) => ({
                  minQuantity: tier.minQuantity,
                  maxQuantity: tier.maxQuantity,
                  unitPrice: tier.unitPrice?.toFixed() ?? null,
                })),
              }
            : null,
          modules: version.modules.map((m) => ({
            code: m.module.code,
            name: m.module.name,
            nameKey: m.module.nameKey,
            category: m.module.category,
            entitlementScope: m.entitlementScope,
            icon: m.module.icon,
          })),
          features: version.features.map((f) => ({
            code: f.feature.code,
            name: f.feature.name,
            nameKey: f.feature.nameKey,
            featureType: f.feature.featureType,
            limitValue: f.limitValue ?? f.feature.defaultLimit,
            unit: f.unit ?? f.feature.unit,
          })),
          constraints: version.constraints.map((c) => ({
            type: c.constraintType,
            value: c.numericValue,
          })),
        };
      });
  }

  /** Perbandingan paket berdasarkan matriks modul. */
  async comparePackages(currencyCode = 'IDR') {
    const packages = await this.listPublishedPackages(currencyCode);
    const allModules = await this.prisma.moduleCatalog.findMany({
      where: { status: 'ACTIVE', isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { code: true, name: true, nameKey: true, category: true, icon: true },
    });

    return {
      modules: allModules,
      packages: packages.map((pkg) => ({
        code: pkg.code,
        name: pkg.name,
        price: pkg.price,
        isRecommended: pkg.isRecommended,
        moduleMatrix: Object.fromEntries(
          allModules.map((module) => [
            module.code,
            pkg.modules.some((m) => m.code === module.code),
          ]),
        ),
      })),
    };
  }
}
