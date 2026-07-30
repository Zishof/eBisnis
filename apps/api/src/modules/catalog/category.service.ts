/**
 * Kategori marketplace: penanaman dan pembacaan.
 *
 * Penanaman bersifat idempoten dan **tidak menulis ulang baris yang sudah
 * sama**. Pelajaran dari V8-R1 masih berlaku: `ON CONFLICT DO UPDATE` yang
 * dijalankan pada nilai yang identik tetap memicu trigger audit, dan 455 baris
 * menghasilkan 910 catatan audit yang seluruhnya tidak berarti. Audit yang
 * penuh perubahan semu membuat perubahan sungguhan sulit ditemukan.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  MARKETPLACE_CATEGORIES,
  buildPath,
  computeParentCodes,
  type CategorySeed,
} from './marketplace-category.seed';

export interface CategoryNode {
  id: string;
  code: string;
  name: string;
  slug: string;
  iconName: string | null;
  isLeaf: boolean;
  isRestricted: boolean;
  restrictionNote: string | null;
  children: CategoryNode[];
}

export interface SeedOutcome {
  created: number;
  updated: number;
  unchanged: number;
}

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Menanam katalog kategori.
   *
   * Dijalankan dua lintasan: induk lebih dulu, lalu anak. Menanamnya satu
   * lintasan menuntut urutan berkas selalu benar, dan syarat yang bergantung
   * pada urutan penulisan akan rusak diam-diam saat ada yang menyisipkan baris.
   */
  async seed(): Promise<SeedOutcome> {
    const parents = computeParentCodes();
    const outcome: SeedOutcome = { created: 0, updated: 0, unchanged: 0 };

    const roots = MARKETPLACE_CATEGORIES.filter((c) => c.parentCode === null);
    const children = MARKETPLACE_CATEGORIES.filter((c) => c.parentCode !== null);

    for (const seed of [...roots, ...children]) {
      await this.upsertOne(seed, parents, outcome);
    }

    this.logger.log(
      `Kategori: ${outcome.created} dibuat, ${outcome.updated} diperbarui, ` +
        `${outcome.unchanged} tidak berubah.`,
    );
    return outcome;
  }

  private async upsertOne(
    seed: CategorySeed,
    parents: Set<string>,
    outcome: SeedOutcome,
  ): Promise<void> {
    const parentId = seed.parentCode ? await this.idOf(seed.parentCode) : null;
    const path = buildPath(seed.code);
    const desired = {
      parentId,
      name: seed.name,
      slug: seed.slug,
      path,
      level: path.split('/').filter(Boolean).length - 1,
      iconName: seed.iconName ?? null,
      sortOrder: seed.sortOrder,
      isRestricted: seed.isRestricted ?? false,
      restrictionNote: seed.restrictionNote ?? null,
      description: seed.description ?? null,
      isLeaf: !parents.has(seed.code),
      isActive: true,
      isSystem: true,
    };

    const existing = await this.prisma.marketplaceCategory.findUnique({
      where: { code: seed.code },
    });

    if (!existing) {
      await this.prisma.marketplaceCategory.create({ data: { code: seed.code, ...desired } });
      outcome.created += 1;
      return;
    }

    // Perbandingan medan demi medan. Inilah yang mencegah pembaruan semu.
    const changed = (Object.keys(desired) as (keyof typeof desired)[]).some(
      (key) => existing[key] !== desired[key],
    );
    if (!changed) {
      outcome.unchanged += 1;
      return;
    }

    await this.prisma.marketplaceCategory.update({
      where: { id: existing.id },
      data: { ...desired, version: { increment: 1 } },
    });
    outcome.updated += 1;
  }

  private async idOf(code: string): Promise<string | null> {
    const row = await this.prisma.marketplaceCategory.findUnique({
      where: { code },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  /**
   * Pohon kategori untuk navigasi.
   *
   * Disusun di aplikasi dari satu kali pembacaan, bukan lewat kueri rekursif
   * per tingkat. Jumlah kategori berada pada orde ratusan, dan satu pembacaan
   * jauh lebih murah daripada satu kueri untuk setiap simpul.
   */
  async tree(): Promise<CategoryNode[]> {
    const rows = await this.prisma.marketplaceCategory.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        parentId: true,
        code: true,
        name: true,
        slug: true,
        iconName: true,
        isLeaf: true,
        isRestricted: true,
        restrictionNote: true,
      },
    });

    const nodes = new Map<string, CategoryNode>();
    for (const row of rows) {
      nodes.set(row.id, {
        id: row.id,
        code: row.code,
        name: row.name,
        slug: row.slug,
        iconName: row.iconName,
        isLeaf: row.isLeaf,
        isRestricted: row.isRestricted,
        restrictionNote: row.restrictionNote,
        children: [],
      });
    }

    const roots: CategoryNode[] = [];
    for (const row of rows) {
      const node = nodes.get(row.id)!;
      if (row.parentId) nodes.get(row.parentId)?.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  /**
   * Kategori yang boleh dipilih listing.
   *
   * Hanya daun. Kategori induk ada untuk menavigasi, dan produk yang ditaruh
   * di sana tidak akan ditemukan lewat penelusuran normal.
   */
  async selectable(): Promise<
    { id: string; code: string; name: string; path: string; isRestricted: boolean }[]
  > {
    const rows = await this.prisma.marketplaceCategory.findMany({
      where: { isActive: true, isLeaf: true, deletedAt: null },
      orderBy: [{ path: 'asc' }],
      select: { id: true, code: true, name: true, path: true, isRestricted: true },
    });
    return rows;
  }

  /** Memastikan kategori ada dan boleh dipilih. Dipakai saat listing disetel. */
  async assertSelectable(categoryId: string): Promise<{ id: string; isRestricted: boolean }> {
    const row = await this.prisma.marketplaceCategory.findFirst({
      where: { id: categoryId, isActive: true, isLeaf: true, deletedAt: null },
      select: { id: true, isRestricted: true },
    });
    if (!row) {
      throw new Error('Kategori tidak ditemukan atau bukan kategori yang dapat dipilih.');
    }
    return row;
  }
}
