/**
 * Pelaksana daftar.
 *
 * Seluruh keputusan tentang **apa** yang boleh dibaca ada pada
 * `village-listing.ts`. Berkas ini hanya menjalankannya, dan sengaja tidak
 * memiliki cabang keputusan sendiri: satu tempat memutuskan, satu tempat
 * menjalankan.
 *
 * ## Yang datang dari permintaan tidak pernah menjadi pengenal SQL
 *
 * Nama tabel, kolom, gabungan, dan urutan diambil dari konfigurasi. Kunci
 * saringan dicocokkan ke daftar yang tertulis di sana; nilainya diperiksa
 * bentuknya lalu **diikat sebagai parameter**. Tidak ada jalur yang membawa
 * teks permintaan masuk ke badan kueri.
 */

import { Injectable } from '@nestjs/common';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/decorators';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { TenantPermissionService } from '../auth/tenant-permission.service';
import { VillageUnitService } from './village-unit.service';
import {
  DAFTAR,
  bacaBatas,
  bacaNilaiSaringan,
  cariDaftar,
  type Daftar,
} from './village-listing';

export interface HasilDaftar {
  kode: string;
  judul: string;
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
  /**
   * Saringan yang benar-benar dipakai. Dinyatakan kembali supaya layar dapat
   * memberi tahu petugas ketika saringan yang ia kirim **diabaikan** — nilai
   * yang salah bentuk menghasilkan daftar penuh, dan tanpa keterangan ini
   * petugas mengira tidak ada yang cocok padahal saringannya yang tidak
   * terbaca.
   */
  appliedFilters: string[];
  ignoredFilters: string[];
}

@Injectable()
export class VillageListingService {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
    private readonly hak: TenantPermissionService,
  ) {}

  /** Daftar yang tersedia beserta hak akses yang dibutuhkannya. */
  katalog() {
    return DAFTAR.map((d) => ({
      code: d.kode,
      title: d.judul,
      permission: d.hakAkses,
      feature: d.fitur,
      filters: (d.saring ?? []).map((s) => ({
        key: s.kunci,
        type: s.bentuk,
        options: s.pilihan ?? null,
      })),
    }));
  }

  async jalankan(
    schemaName: string,
    kode: string,
    kueri: Record<string, string | undefined>,
    user: AuthenticatedUser,
  ): Promise<HasilDaftar> {
    const d = cariDaftar(kode);
    if (!d) {
      // Daftar yang tidak ada DITOLAK, bukan diloloskan sebagai daftar kosong.
      //
      // Aturan yang sama dipakai penjaga rute Core untuk sumber daya master:
      // meloloskan kode yang tidak dikenal berarti satu huruf salah ketik pada
      // alamat menghapus pemeriksaan haknya.
      throw AppError.notFound(ErrorCodes.NOT_FOUND, `Daftar "${kode}" tidak dikenal.`);
    }

    // Hak akses diperiksa DI SINI, bukan oleh dekorator rute.
    //
    // Satu rute melayani dua puluh daftar, dan `@Permissions()` menempel pada
    // rute, bukan pada daftarnya. Menuliskan satu hak akses yang longgar pada
    // rutenya berarti petugas yang hanya berhak membaca antrean loket dapat
    // membaca buku kas dengan mengganti satu kata pada alamat.
    //
    // Pemeriksaannya memakai layanan yang sama dengan penjaga rute, beserta
    // peran aktif — supaya penyempitan peran yang dipilih pengguna benar-benar
    // membatasi, bukan sekadar mengubah tampilan menu.
    const kurang = await this.hak.findMissing(schemaName, user.userId, [d.hakAkses], {
      isDemo: user.isDemo,
      activeRoleId: user.activeRoleId,
    });
    if (kurang.length) {
      throw AppError.forbidden(ErrorCodes.PERMISSION_DENIED, 'Hak akses tidak mencukupi.', {
        missing: kurang,
        ...(user.activeRoleCode ? { activeRole: user.activeRoleCode } : {}),
      });
    }

    // Kelayakan profil diperiksa berikutnya: kelurahan tidak punya APBDes,
    // dan menampilkan layarnya kosong lebih membingungkan daripada menyatakan
    // fiturnya memang tidak berlaku.
    const u = await this.unit.pastikanLayak(schemaName, d.fitur);

    const params: unknown[] = [u.id];
    const syarat: string[] = [`${d.alias}.village_unit_id = $1`];
    if (d.hapusLunak) syarat.push(`${d.alias}.deleted_at IS NULL`);

    const dipakai: string[] = [];
    const diabaikan: string[] = [];

    for (const s of d.saring ?? []) {
      const mentah = kueri[s.kunci];
      if (mentah === undefined || mentah === '') continue;

      const nilai = bacaNilaiSaringan(s, mentah);
      if (nilai === null) {
        diabaikan.push(s.kunci);
        continue;
      }

      params.push(nilai);
      // Satu nilai dapat dipakai beberapa kali pada satu klausa (misalnya
      // pencarian pada nomor ATAU nama); seluruh `$n` menunjuk parameter yang
      // sama, sehingga nilainya tidak perlu digandakan.
      syarat.push(s.klausa.replace(/\$n/g, `$${params.length}`));
      dipakai.push(s.kunci);
    }

    const where = syarat.join(' AND ');
    const gabung = (d.gabung ?? '').replace(/\{S\}/g, `"${schemaName}"`);
    const pilih = d.pilih.map((p) => p.replace(/\{S\}/g, `"${schemaName}"`)).join(', ');

    const cacah = await this.tenantDb.query<{ n: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS n
         FROM "${schemaName}".${d.tabel} ${d.alias}
         ${gabung}
        WHERE ${where}`,
      params,
    );

    const limit = bacaBatas(kueri.limit);
    const offset = Math.max(0, Number(kueri.offset ?? 0) || 0);
    params.push(limit, offset);

    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT ${pilih}
         FROM "${schemaName}".${d.tabel} ${d.alias}
         ${gabung}
        WHERE ${where}
        ORDER BY ${d.urut}
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      kode: d.kode,
      judul: d.judul,
      rows,
      total: Number(cacah[0]?.n ?? 0),
      limit,
      offset,
      appliedFilters: dipakai,
      ignoredFilters: diabaikan,
    };
  }

  /** Untuk pengujian dan pemeriksaan: SQL yang akan dijalankan sebuah daftar. */
  bentukKueri(d: Daftar, schemaName: string): string {
    const gabung = (d.gabung ?? '').replace(/\{S\}/g, `"${schemaName}"`);
    const pilih = d.pilih.map((p) => p.replace(/\{S\}/g, `"${schemaName}"`)).join(', ');
    return `SELECT ${pilih} FROM "${schemaName}".${d.tabel} ${d.alias} ${gabung}`;
  }
}
