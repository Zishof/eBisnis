import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';

interface CacheEntry {
  permissions: Set<string>;
  expiresAt: number;
}

/** Aksi yang tidak boleh dijalankan sesi demo meskipun role DEMO_USER mengizinkan. */
const DEMO_FORBIDDEN_ACTIONS = new Set([
  'HARD_DELETE',
  'EXPORT',
  'IMPORT',
  'MANAGE_DEVICE',
  'CLOSE_PERIOD',
  'REOPEN',
]);

/**
 * Menu akar (tanpa `parent_id`) INTI/generik yang tampil BAWAAN per vertikal
 * tenant -- lihat `menuTree()`. Sebelumnya setiap tenant, apa pun
 * vertikalnya, melihat SELURUH menu ERP generik (Kasir/POS, Penjualan,
 * Produksi, dst.) sekaligus menu vertikalnya sendiri, sebab peran OWNER
 * (`allModules: true`, lihat `tenant-role.seed.ts`) menggenapi hak akses ke
 * mana pun tanpa mempedulikan vertikal.
 *
 * Filter ini SENGAJA hanya menyaring TAMPILAN sidebar (dilakukan di sini,
 * bukan dengan menyempitkan hak akses OWNER/`allModules` itu sendiri) --
 * `allModules` dipakai bersama SEMUA vertikal (koperasi, klinik, dst.), jadi
 * menyempitkannya akan diam-diam mencabut akses menu penyewa lain yang
 * sudah berjalan. Hak akses sesungguhnya TIDAK berubah sama sekali:
 * pengurus tetap `OWNER` penuh, hanya saja sidebar-nya tidak menawarkan
 * menu yang hampir pasti tidak relevan untuk pondok pesantren. Menu yang
 * disembunyikan tetap dapat dibuka langsung lewat alamatnya, dan tetap
 * dapat ditampilkan lagi kelak lewat pengaturan hak akses begitu itu ada.
 *
 * `undefined` (vertikal tidak terdaftar di sini) berarti TIDAK disaring
 * sama sekali -- perilaku lama, aman bagi vertikal yang belum pernah
 * dipertimbangkan secara eksplisit.
 */
const MENU_AKAR_BAWAAN_PER_VERTIKAL: Record<string, ReadonlySet<string>> = {
  // "PESANTREN" (huruf besar) -- nilai `Tenant.verticalCode` sesungguhnya
  // (lihat `VERTIKAL_PESANTREN` di `apps/web/src/app/beranda-sesudah-masuk.ts`
  // dan `AuthService.verticalPenyewa()`), BUKAN kode registrasi katalog RBAC
  // ('pesantren', huruf kecil, dipakai `PESANTREN_VERTICAL_CATALOG` di
  // `pesantren-vertical.catalog.ts`) -- keduanya identifier yang berbeda
  // meski berasal dari kata yang sama. Tertukar sekali saat pertama ditulis
  // dan ditangkap lewat pengujian nyata (login sungguhan mengembalikan
  // `verticalCode: "PESANTREN"`), bukan lewat pembacaan kode.
  PESANTREN: new Set([
    // Menu vertikal pesantren sendiri (lihat pesantren-vertical.catalog.ts) --
    // tiga akar mandiri (Gerbang/Portal Wali/Kiosk) sengaja terpisah dari
    // EPESANTREN_GROUP di sana justru supaya peran sempitnya tidak
    // merembes ke seluruh grup; di sini keempatnya tetap harus tampil.
    'EPESANTREN_GROUP',
    'EPESANTREN_GERBANG',
    'EPESANTREN_PORTAL_WALI',
    'EPESANTREN_KIOSK',
    // Menu INTI yang tetap relevan bagi pondok: beranda, pembukuan
    // operasional pondok sendiri (di luar tagihan santri yang sudah
    // punya menunya sendiri), langganan eBisnis, data master bersama,
    // administrasi pengguna/peran, dan bantuan.
    'HOME',
    'FINANCE',
    'SUBSCRIPTION',
    'MASTER_DATA',
    'ADMIN',
    'SUPPORT',
  ]),
  // "HOSPITALITY" -- nilai `Tenant.verticalCode` untuk penyewa MitraInap.id
  // (lihat docs/mitrainap/PERINTAH_MASTER...md §6). Belum ada penyewa
  // hospitality sungguhan untuk memverifikasi casing ini lewat login nyata
  // (beda dengan PESANTREN, yang tertangkap salah lewat pengujian nyata) --
  // ditulis konsisten dengan casing yang sama sekarang, WAJIB diverifikasi
  // ulang begitu tenant hospitality pertama benar-benar login.
  HOSPITALITY: new Set([
    'HOSPITALITY_GROUP',
    'HOME',
    'FINANCE',
    'SUBSCRIPTION',
    'MASTER_DATA',
    'ADMIN',
    'SUPPORT',
  ]),
};

/**
 * Apakah satu menu AKAR (parent_id NULL) tampil bawaan bagi vertikal ini.
 * Menu turunan (punya parent_id) tidak pernah diperiksa di sini -- nasibnya
 * mengikuti induknya secara alami lewat penautan `byId` pada `menuTree()`:
 * akar yang disembunyikan otomatis membuat seluruh turunannya tidak
 * tertaut ke mana pun, tanpa perlu pemeriksaan rekursif terpisah.
 */
export function akarMenuTampilBawaan(
  kodeMenu: string,
  parentId: string | null,
  verticalCode: string | null | undefined,
): boolean {
  if (parentId) return true;
  if (!verticalCode) return true;
  const akarBawaan = MENU_AKAR_BAWAAN_PER_VERTIKAL[verticalCode];
  if (!akarBawaan) return true;
  return akarBawaan.has(kodeMenu);
}

/** Satu baris izin sebagaimana dibaca dari basis data. */
export interface PermissionRow {
  permission: string;
  effect: string;
  source: string;
  role_id: string | null;
}

/** Gabungan seluruh sumber, dengan DENY selalu menang. Perilaku sebelum V10-4. */
export function unionOf(rows: PermissionRow[]): Set<string> {
  const allow = new Set<string>();
  const deny = new Set<string>();
  for (const row of rows) {
    if (row.effect === 'DENY') deny.add(row.permission);
    else allow.add(row.permission);
  }
  for (const denied of deny) allow.delete(denied);
  return allow;
}

/**
 * Mempersempit izin ke satu peran aktif.
 *
 * ## Aturan yang menjaganya tetap aman
 *
 * **Memilih peran hanya boleh MENGURANGI izin, tidak pernah menambah.**
 *
 * Tanpa aturan itu ada celah yang nyata: bila peran A menolak `KAS.APPROVE`
 * dan peran B mengizinkannya, gabungan keduanya menghasilkan TOLAK karena DENY
 * menang. Bila penyempitan hanya melihat peran B, larangan dari peran A ikut
 * hilang — dan memilih peran justru MEMBERI izin yang tadinya tidak ada. Fitur
 * yang dijual sebagai pembatasan akan diam-diam menjadi peningkatan hak.
 *
 * Karena itu:
 *
 * 1. Seluruh DENY dari **semua** peran tetap berlaku, bukan hanya dari peran
 *    aktif. Larangan tidak melekat pada topi yang sedang dipakai.
 * 2. Hasilnya diiriskan dengan gabungan penuh. Langkah ini sudah tersirat oleh
 *    butir pertama, tetapi ditulis eksplisit supaya sifat "tidak pernah
 *    menambah" dijamin oleh kode, bukan oleh penalaran.
 *
 * ## Izin langsung tetap berlaku
 *
 * Izin yang diberikan langsung kepada orangnya (`user_direct_permission`)
 * tidak melekat pada peran mana pun — ia diberikan kepada orang itu, bukan
 * kepada topi yang dipakainya. Karena itu ia tetap berlaku saat menyempit.
 * Yang dipersempit adalah izin yang berasal dari peran.
 */
export function narrowToRole(rows: PermissionRow[], activeRoleId: string): Set<string> {
  const penuh = unionOf(rows);

  const deny = new Set<string>();
  for (const row of rows) if (row.effect === 'DENY') deny.add(row.permission);

  const sempit = new Set<string>();
  for (const row of rows) {
    if (row.effect === 'DENY') continue;
    const dariPeranAktif = row.source === 'ROLE' && row.role_id === activeRoleId;
    const izinLangsung = row.source === 'DIRECT';
    if (!dariPeranAktif && !izinLangsung) continue;
    if (deny.has(row.permission)) continue;
    // Irisan dengan gabungan penuh: jaminan bahwa menyempit tidak menambah.
    if (!penuh.has(row.permission)) continue;
    sempit.add(row.permission);
  }
  return sempit;
}

@Injectable()
export class TenantPermissionService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 30_000;

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Menghitung permission efektif: role assignment + direct permission,
   * dengan DENY selalu menang.
   *
   * ## Peran aktif
   *
   * Bila `activeRoleId` diberikan, hasilnya dipersempit ke peran itu saja —
   * lihat {@link narrowToRole} untuk aturan yang menjaganya tetap aman.
   * `undefined` atau `null` berarti pengguna belum memilih, dan hasilnya
   * gabungan seluruh peran persis seperti sebelum V10-4.
   */
  async resolve(
    schemaName: string,
    platformUserId: string,
    activeRoleId?: string | null,
  ): Promise<Set<string>> {
    // Peran aktif ikut menjadi kunci cache. Tanpa itu, seseorang yang berganti
    // peran akan tetap memakai izin peran sebelumnya sampai cache kedaluwarsa —
    // dan itu berarti penyempitan yang diminta tidak benar-benar berlaku.
    const key = `${schemaName}:${platformUserId}:${activeRoleId ?? '*'}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.permissions;

    const rows = await this.tenantDb.query<{
      permission: string;
      effect: string;
      source: string;
      role_id: string | null;
    }>(
      schemaName,
      `WITH subject AS (
         SELECT id FROM "${schemaName}".user_subject
         WHERE platform_user_id = $1 AND deleted_at IS NULL AND is_active = TRUE
       ),
       from_role AS (
         SELECT m.code || '.' || pa.code AS permission, rmp.effect AS effect, 'ROLE' AS source,
                r.id::text AS role_id
         FROM subject s
         JOIN "${schemaName}".user_role_assignment ura ON ura.user_subject_id = s.id
           AND ura.valid_from <= now()
           AND (ura.valid_until IS NULL OR ura.valid_until >= now())
         JOIN "${schemaName}".role r ON r.id = ura.role_id AND r.deleted_at IS NULL AND r.is_active = TRUE
         JOIN "${schemaName}".role_menu_permission rmp ON rmp.role_id = r.id
         JOIN "${schemaName}".menu m ON m.id = rmp.menu_id AND m.deleted_at IS NULL AND m.is_active = TRUE
         JOIN "${schemaName}".permission_action pa ON pa.id = rmp.permission_action_id AND pa.deleted_at IS NULL
       ),
       from_direct AS (
         SELECT m.code || '.' || pa.code AS permission, udp.effect AS effect, 'DIRECT' AS source,
                NULL::text AS role_id
         FROM subject s
         JOIN "${schemaName}".user_direct_permission udp ON udp.user_subject_id = s.id
         JOIN "${schemaName}".menu m ON m.id = udp.menu_id AND m.deleted_at IS NULL AND m.is_active = TRUE
         JOIN "${schemaName}".permission_action pa ON pa.id = udp.permission_action_id AND pa.deleted_at IS NULL
       )
       SELECT * FROM from_role UNION ALL SELECT * FROM from_direct`,
      [platformUserId],
    );

    const effective = activeRoleId ? narrowToRole(rows, activeRoleId) : unionOf(rows);

    this.cache.set(key, { permissions: effective, expiresAt: Date.now() + this.ttlMs });
    return effective;
  }

  async findMissing(
    schemaName: string,
    platformUserId: string,
    required: string[],
    options: { isDemo?: boolean; activeRoleId?: string | null } = {},
  ): Promise<string[]> {
    if (options.isDemo) {
      const blocked = required.filter((permission) => {
        const action = permission.split('.').pop() ?? '';
        return DEMO_FORBIDDEN_ACTIONS.has(action);
      });
      if (blocked.length) return blocked;
      // Sesi demo memakai role DEMO_USER yang di-seed pada schema demo;
      // tetap dievaluasi lewat resolve() di bawah.
    }
    const granted = await this.resolve(schemaName, platformUserId, options.activeRoleId);
    return required.filter((permission) => !granted.has(permission));
  }

  /** Peran yang dipegang pengguna pada tenant, beserta jumlah izinnya. */
  async rolesOf(
    schemaName: string,
    platformUserId: string,
  ): Promise<Array<{ roleId: string; code: string; name: string; permissionCount: number }>> {
    const rows = await this.tenantDb.query<{
      role_id: string;
      code: string;
      name: string;
      permission_count: string;
    }>(
      schemaName,
      `SELECT r.id::text AS role_id, r.code, r.name,
              count(DISTINCT m.code || '.' || pa.code) FILTER (WHERE rmp.effect <> 'DENY') AS permission_count
         FROM "${schemaName}".user_subject s
         JOIN "${schemaName}".user_role_assignment ura ON ura.user_subject_id = s.id
           AND ura.valid_from <= now()
           AND (ura.valid_until IS NULL OR ura.valid_until >= now())
         JOIN "${schemaName}".role r ON r.id = ura.role_id AND r.deleted_at IS NULL AND r.is_active = TRUE
         LEFT JOIN "${schemaName}".role_menu_permission rmp ON rmp.role_id = r.id
         LEFT JOIN "${schemaName}".menu m ON m.id = rmp.menu_id AND m.deleted_at IS NULL AND m.is_active = TRUE
         LEFT JOIN "${schemaName}".permission_action pa ON pa.id = rmp.permission_action_id AND pa.deleted_at IS NULL
        WHERE s.platform_user_id = $1 AND s.deleted_at IS NULL AND s.is_active = TRUE
        GROUP BY r.id, r.code, r.name
        ORDER BY r.code`,
      [platformUserId],
    );

    return rows.map((row) => ({
      roleId: row.role_id,
      code: row.code,
      name: row.name,
      permissionCount: Number(row.permission_count),
    }));
  }

  /** Menu yang boleh dilihat pengguna (memiliki aksi READ). */
  async menuTree(
    schemaName: string,
    platformUserId: string,
    localeCode = 'id',
    activeRoleId?: string | null,
    verticalCode?: string | null,
  ): Promise<Array<Record<string, unknown>>> {
    // Menu mengikuti peran aktif. Menampilkan menu yang tidak dapat dibuka
    // hanya memindahkan penolakan dari daftar menu ke halaman kosong.
    const granted = await this.resolve(schemaName, platformUserId, activeRoleId);
    const menus = await this.tenantDb.query<{
      id: string;
      parent_id: string | null;
      code: string;
      name: string;
      translation_key: string;
      route: string | null;
      icon: string | null;
      module_code: string | null;
      sort_order: number;
      is_coming_soon: boolean;
    }>(
      schemaName,
      `SELECT id::text, parent_id::text, code, name, translation_key, route, icon,
              module_code, sort_order, is_coming_soon
       FROM "${schemaName}".menu
       WHERE deleted_at IS NULL AND is_active = TRUE
       ORDER BY sort_order, code`,
    );

    const actionsByMenu = new Map<string, string[]>();
    for (const permission of granted) {
      const [menuCode, action] = permission.split('.');
      if (!menuCode || !action) continue;
      const list = actionsByMenu.get(menuCode) ?? [];
      list.push(action);
      actionsByMenu.set(menuCode, list);
    }

    const visible = menus.filter(
      (menu) =>
        actionsByMenu.get(menu.code)?.includes('READ') &&
        akarMenuTampilBawaan(menu.code, menu.parent_id, verticalCode),
    );
    const byId = new Map(
      visible.map((menu) => [
        menu.id,
        {
          id: menu.id,
          code: menu.code,
          label: menu.name,
          translationKey: menu.translation_key,
          route: menu.route,
          icon: menu.icon,
          moduleCode: menu.module_code,
          sortOrder: menu.sort_order,
          isComingSoon: menu.is_coming_soon,
          actions: (actionsByMenu.get(menu.code) ?? []).sort(),
          children: [] as Array<Record<string, unknown>>,
        },
      ]),
    );

    const roots: Array<Record<string, unknown>> = [];
    for (const menu of visible) {
      const node = byId.get(menu.id)!;
      if (menu.parent_id && byId.has(menu.parent_id)) {
        (byId.get(menu.parent_id)!.children as Array<Record<string, unknown>>).push(node);
      } else if (!menu.parent_id) {
        roots.push(node);
      }
    }
    void localeCode;
    return roots;
  }

  invalidate(schemaName: string, platformUserId?: string): void {
    if (platformUserId) {
      this.cache.delete(`${schemaName}:${platformUserId}`);
      return;
    }
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(`${schemaName}:`)) this.cache.delete(key);
    }
  }
}
