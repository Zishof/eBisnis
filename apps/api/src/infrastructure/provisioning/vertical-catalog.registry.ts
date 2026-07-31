/**
 * Registri katalog vertikal — menu, peran, dan aksi hak akses per modul.
 *
 * Menjawab [IR-004](../../../../../docs/integration-requests/cooperative/004-katalog-menu-peran-hak-akses-koperasi.md).
 *
 * ## Persoalan yang diselesaikan
 *
 * `MENU_TREE_SEED` dan `ROLE_CATALOG` adalah dua konstanta besar yang disunting
 * setiap kali ada layar baru. Selama hanya inti yang menyentuhnya itu tidak
 * mengapa. Dengan tiga vertikal yang dikerjakan sesi paralel, keduanya menjadi
 * berkas yang diperebutkan — dan konflik pada daftar hak akses lebih berbahaya
 * daripada konflik biasa: penyelesaian konflik yang keliru menghasilkan peran
 * yang memegang izin yang tidak pernah dimaksudkan siapa pun.
 *
 * ## Bentuknya
 *
 * Setiap vertikal mendaftarkan katalognya sendiri. Inti pun mendaftarkan
 * katalognya lewat pintu yang sama, tanpa perlakuan istimewa — bila inti
 * istimewa, jalur inti dan jalur vertikal akan berbeda perilakunya, dan yang
 * jarang dipakai akan membusuk tanpa ada yang tahu.
 *
 * ## Yang ditegakkan registri
 *
 * Empat aturan, dan seluruhnya ditegakkan **saat pendaftaran** — bukan saat
 * penyemaian. Penyemaian berjalan pada penyewa sungguhan; menemukan katalog
 * yang salah di sana berarti sebagian penyewa sudah tersemai sebelum
 * kesalahannya diketahui.
 */

import { Injectable } from '@nestjs/common';
import type { MenuNodeSeed, PermissionActionSeed } from './tenant-menu.seed';
import type { RoleCatalogEntry } from './tenant-role.seed';

export interface VerticalCatalog {
  /** Kode vertikal: `core`, `cooperative`, `health`, `village`. */
  readonly code: string;
  /**
   * Awalan menu milik katalog ini.
   *
   * Katalog inti memakai awalan kosong — ia memiliki menu apa pun. Vertikal
   * wajib memberi awalan, dan seluruh menunya wajib memakainya.
   */
  readonly prefix: string;
  readonly menus: readonly MenuNodeSeed[];
  readonly roles: readonly RoleCatalogEntry[];
  readonly permissionActions?: readonly PermissionActionSeed[];
}

export class VerticalCatalogError extends Error {}

@Injectable()
export class VerticalCatalogRegistry {
  private readonly catalogs = new Map<string, VerticalCatalog>();

  register(catalog: VerticalCatalog): void {
    if (this.catalogs.has(catalog.code)) {
      throw new VerticalCatalogError(
        `Katalog vertikal "${catalog.code}" sudah terdaftar. Pendaftaran ganda hampir selalu ` +
          'berarti dua modul memakai kode yang sama, dan yang kedua akan menimpa yang pertama ' +
          'tanpa galat.',
      );
    }

    // --- 1. Awalan tidak boleh bertabrakan -------------------------------
    if (catalog.prefix !== '') {
      for (const lain of this.catalogs.values()) {
        if (lain.prefix === '') continue;
        if (
          lain.prefix === catalog.prefix ||
          lain.prefix.startsWith(catalog.prefix) ||
          catalog.prefix.startsWith(lain.prefix)
        ) {
          /*
           * Bukan hanya awalan yang persis sama. Awalan `COOP` dan `COOPERATIVE`
           * saling tumpang tindih: menu `COOPERATIVE_MEMBER` memenuhi keduanya,
           * sehingga pemeriksaan kepemilikan berhenti bermakna.
           */
          throw new VerticalCatalogError(
            `Awalan "${catalog.prefix}" milik "${catalog.code}" bertumpang tindih dengan ` +
              `"${lain.prefix}" milik "${lain.code}". Awalan harus saling asing supaya ` +
              'kepemilikan menu dan hak akses dapat ditentukan tanpa ragu.',
          );
        }
      }
    }

    // --- 2. Menu dan peran wajib berawalan katalognya ---------------------
    if (catalog.prefix !== '') {
      for (const menu of catalog.menus) {
        if (!menu.code.startsWith(catalog.prefix)) {
          throw new VerticalCatalogError(
            `Menu "${menu.code}" pada katalog "${catalog.code}" tidak berawalan ` +
              `"${catalog.prefix}". Vertikal tidak boleh mendaftarkan menu milik inti maupun ` +
              'milik vertikal lain.',
          );
        }
      }
      for (const role of catalog.roles) {
        if (!role.code.startsWith(catalog.prefix)) {
          throw new VerticalCatalogError(
            `Peran "${role.code}" pada katalog "${catalog.code}" tidak berawalan ` +
              `"${catalog.prefix}".`,
          );
        }
      }
    }

    // --- 3. Kode menu tidak boleh dipakai dua katalog ---------------------
    const menuTerdaftar = new Map<string, string>();
    for (const [kode, c] of this.catalogs) {
      for (const m of c.menus) menuTerdaftar.set(m.code, kode);
    }
    for (const menu of catalog.menus) {
      const pemilik = menuTerdaftar.get(menu.code);
      if (pemilik) {
        throw new VerticalCatalogError(
          `Menu "${menu.code}" sudah didaftarkan katalog "${pemilik}"; "${catalog.code}" ` +
            'mendaftarkannya lagi.',
        );
      }
    }

    // --- 4. Aksi bersama boleh, arti yang berbeda tidak ------------------
    /*
     * `APPROVE` milik semua vertikal, dan itu benar — memaksa tiap vertikal
     * mendefinisikan `COOPERATIVE_APPROVE` akan melipatgandakan daftar aksi
     * tanpa menambah kejelasan. Yang ditolak hanyalah dua katalog yang
     * mendefinisikan kode aksi sama dengan ARTI berbeda, sebab layar pengaturan
     * hak akses menampilkan satu nama untuk satu kode.
     */
    const aksiTerdaftar = new Map<string, { name: string; owner: string }>();
    for (const [kode, c] of this.catalogs) {
      for (const a of c.permissionActions ?? []) {
        aksiTerdaftar.set(a.code, { name: a.name, owner: kode });
      }
    }
    for (const aksi of catalog.permissionActions ?? []) {
      const ada = aksiTerdaftar.get(aksi.code);
      if (ada && ada.name !== aksi.name) {
        throw new VerticalCatalogError(
          `Aksi "${aksi.code}" didefinisikan "${ada.owner}" sebagai "${ada.name}", ` +
            `sedangkan "${catalog.code}" menyebutnya "${aksi.name}". Satu kode aksi hanya boleh ` +
            'punya satu arti — layar pengaturan hak akses menampilkan satu nama untuknya.',
        );
      }
    }

    this.catalogs.set(catalog.code, catalog);
  }

  /**
   * Memeriksa bahwa setiap `parentCode` benar-benar ada.
   *
   * Dijalankan setelah seluruh katalog terdaftar, bukan saat mendaftar: sebuah
   * vertikal boleh menggantung menunya pada menu inti, dan urutan pendaftaran
   * tidak boleh menentukan sah atau tidaknya.
   *
   * Menu yatim tidak menimbulkan galat apa pun — ia hanya tidak pernah muncul
   * di layar. Itu jenis cacat yang butuh waktu lama untuk disadari, sebab
   * gejalanya adalah ketiadaan.
   */
  validateTree(): void {
    const semua = this.allMenus();
    const kode = new Set(semua.map((m) => m.code));
    const yatim = semua.filter((m) => m.parentCode && !kode.has(m.parentCode));
    if (yatim.length > 0) {
      throw new VerticalCatalogError(
        `Menu berikut menunjuk induk yang tidak ada: ${yatim
          .map((m) => `${m.code} → ${m.parentCode}`)
          .join(', ')}. Menu yatim tidak pernah muncul di layar dan tidak menimbulkan galat, ` +
          'sehingga lebih baik ditolak sekarang.',
      );
    }
  }

  allMenus(): readonly MenuNodeSeed[] {
    return [...this.catalogs.values()].flatMap((c) => c.menus);
  }

  allRoles(): readonly RoleCatalogEntry[] {
    return [...this.catalogs.values()].flatMap((c) => c.roles);
  }

  allPermissionActions(): readonly PermissionActionSeed[] {
    const byCode = new Map<string, PermissionActionSeed>();
    for (const c of this.catalogs.values()) {
      for (const a of c.permissionActions ?? []) {
        if (!byCode.has(a.code)) byCode.set(a.code, a);
      }
    }
    return [...byCode.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  registeredCodes(): string[] {
    return [...this.catalogs.keys()];
  }

  /** Menemukan katalog pemilik sebuah menu. Dipakai diagnostik dan pengujian. */
  ownerOfMenu(menuCode: string): string | undefined {
    for (const [kode, c] of this.catalogs) {
      if (c.menus.some((m) => m.code === menuCode)) return kode;
    }
    return undefined;
  }

  /** Hanya untuk pengujian — registri sesungguhnya diisi sekali saat modul dimuat. */
  reset(): void {
    this.catalogs.clear();
  }
}
