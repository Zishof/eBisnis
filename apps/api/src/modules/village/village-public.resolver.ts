/**
 * Menyelesaikan permintaan publik menjadi skema penyewa.
 *
 * ## Mengapa village punya penyelesai sendiri
 *
 * Penyelesai milik Core menyelesaikan toko marketplace lewat
 * `marketplace_store_domain`; desa bukan toko. Perintah §3 melarang mengubah
 * penyelesai penyewa global, sehingga village menyediakan miliknya sendiri
 * yang **hanya membaca** `tenant_schema_registry` dan `tenant`. Rinciannya pada
 * `docs/integration-requests/village/005-public-site-resolution.md`.
 *
 * ## Yang ditolak, dan mengapa
 *
 * Slug yang tidak dikenal **ditolak**, tidak dialihkan ke desa mana pun.
 * Mengarahkan slug asing ke desa bawaan berarti setiap salah ketik menampilkan
 * halaman milik desa lain — dan pada situs pemerintahan, halaman yang salah
 * lebih buruk daripada halaman yang tidak ada.
 *
 * Penyewa yang belum aktif juga ditolak. Desa yang berhenti berlangganan tidak
 * boleh situsnya tetap tayang: isinya tidak lagi diperbarui siapa pun, dan
 * pengumuman lama yang terus tampil adalah pengumuman yang menyesatkan.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

/** Slug hanya huruf kecil, angka, dan tanda hubung. */
const SLUG_SAH = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const PANJANG_SLUG_MAKSIMAL = 80;

@Injectable()
export class VillagePublicResolver {
  private readonly logger = new Logger(VillagePublicResolver.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Menyelesaikan slug penyewa menjadi nama skema.
   *
   * Bentuk slug diperiksa lebih dahulu, dan itu bukan kesopanan: nilai ini
   * kelak menjadi bagian dari nama skema pada kueri. Nama skema tidak pernah
   * boleh berasal dari badan permintaan tanpa disaring — dan penyaringan yang
   * paling aman adalah mencocokkannya dengan daftar yang sudah ada, seperti di
   * bawah ini.
   */
  async skemaDariSlug(slug: string): Promise<{ schemaName: string; tenantId: string }> {
    const bersih = (slug ?? '').trim().toLowerCase();

    if (!bersih || bersih.length > PANJANG_SLUG_MAKSIMAL || !SLUG_SAH.test(bersih)) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs desa tidak ditemukan.');
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: bersih, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!tenant) {
      // Pesannya sama dengan slug yang bentuknya salah. Membedakan keduanya
      // memberi tahu penebak bahwa slug yang ia coba berbentuk benar.
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs desa tidak ditemukan.');
    }

    const registry = await this.prisma.tenantSchemaRegistry.findUnique({
      where: { tenantId: tenant.id },
      select: { schemaName: true, status: true },
    });
    if (!registry || registry.status !== 'READY') {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs desa belum tersedia.');
    }

    if (tenant.status !== 'ACTIVE') {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'Situs desa ini sedang tidak tayang. Hubungi pemerintah desa yang bersangkutan.',
      );
    }

    return { schemaName: registry.schemaName, tenantId: tenant.id };
  }
}
