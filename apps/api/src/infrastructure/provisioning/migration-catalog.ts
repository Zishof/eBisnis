/**
 * Penggabungan katalog migrasi inti dengan katalog migrasi modul.
 *
 * Menjawab [IR-001](../../../../../docs/integration-requests/cooperative/001-katalog-migrasi-modular.md)
 * dari sesi eKoperasi, dan sekaligus melayani eMedik serta Info Desa yang akan
 * menghadapi kebutuhan yang sama.
 *
 * ## Persoalan yang diselesaikan
 *
 * Sebelum ini seluruh migrasi tenant tinggal pada satu `manifest.json` bernomor
 * urut `V001`–`V0NN`. Bila tiga vertikal sama-sama menambah ke sana, yang paling
 * berbahaya bukan konflik penggabungan — itu terlihat dan diperbaiki. Yang
 * berbahaya adalah **dua migrasi berbeda memakai nomor yang sama**: penyewa yang
 * sudah menerapkan `V024` milik eMedik akan MELEWATI `V024` milik koperasi,
 * sebab pemuatnya menganggapnya sudah dijalankan. Tabelnya tidak pernah dibuat,
 * dan tidak ada satu pun galat yang muncul. Cacatnya baru terlihat
 * berbulan-bulan kemudian, pada sebagian penyewa saja.
 *
 * ## Bentuknya
 *
 * Migrasi inti tetap memakai `V0NN` dan tetap dibaca dari manifest yang sama.
 * Modul menaruh manifestnya sendiri di `tenant-migrations/<modul>/manifest.json`
 * dengan id bertimestamp yang memuat nama modulnya, sehingga tabrakan praktis
 * mustahil — dan bila tetap terjadi, ditolak **saat pemuatan** dengan menyebut
 * kedua modulnya, bukan dimenangkan salah satunya secara diam-diam.
 *
 * ## Yang sengaja TIDAK berubah
 *
 * `version` tetap menjadi kunci pada `schema_migration`, dan migrasi inti tetap
 * bernama `V001`…`V0NN`. Tiga puluh dua migrasi yang sudah diterapkan pada
 * belasan skema karena itu tidak berjalan ulang dan tidak ditolak. Yang berubah
 * hanya bahwa kuncinya kini boleh berupa teks bebas, bukan wajib berpola `V0NN`.
 */

export interface TenantMigrationDefinition {
  /** Kunci pada `schema_migration`. `V0NN` untuk inti, id bertimestamp untuk modul. */
  version: string;
  /** Urutan penerapan. Inti memakai nomornya; modul diberi nomor setelah inti. */
  sequence: number;
  /** Jalur relatif terhadap `tenant-migrations/`. Modul memakai `<modul>/berkas.sql`. */
  file: string;
  name: string;
  description: string;
  /** Kosong untuk migrasi inti. */
  module?: string;
  /**
   * Benar bila modul ini tinggal di schema-nya sendiri (`{username}_<modul>`).
   *
   * Diturunkan dari manifest modulnya. Modul lama — koperasi — menumpang di
   * schema inti dan tetap begitu; modul pendidikan tidak.
   *
   * Penerapan ke schema inti melewatkan definisi bertanda ini. Tanpa itu setiap
   * tenant memperoleh tabel pendidikan di schema intinya, dan isolasi
   * antarvertical yang dituntut BRD §226 berubah menjadi konvensi penamaan yang
   * dapat dilewati satu kueri yang lupa menyaring.
   */
  ownSchema?: boolean;
}

export interface CoreManifest {
  schemaVersion: number;
  migrations: TenantMigrationDefinition[];
}

export interface ModuleManifestEntry {
  id: string;
  file: string;
  name: string;
  description?: string;
}

export interface ModuleManifest {
  module: string;
  schemaVersion: number;
  /** Modul lain yang migrasinya harus lebih dahulu. `core` selalu tersirat. */
  dependsOn?: string[];
  /**
   * Benar bila modul ini diterapkan ke schema sendiri, bukan ke schema inti.
   *
   * Dinyatakan pada manifest, bukan pada daftar terpisah di dalam kode: daftar
   * semacam itu akan menjadi berkas bersama berikutnya yang harus disunting
   * setiap kali modul baru ditambahkan, dan yang lupa disunting menghasilkan
   * modul yang diam-diam menumpang di schema inti.
   */
  ownSchema?: boolean;
  migrations: ModuleManifestEntry[];
}

/**
 * Batas panjang id migrasi.
 *
 * Sekaligus batas kolom `schema_migration.version` setelah V033. Ditegakkan di
 * sini supaya id yang terlalu panjang ditolak saat pemuatan — bukan saat
 * penerapan, ketika sebagian skema mungkin sudah berubah.
 */
export const MAX_MIGRATION_ID_LENGTH = 128;

/** Modul yang selalu ada dan selalu lebih dahulu. */
export const CORE_MODULE = 'core';

export class MigrationCatalogError extends Error {}

/**
 * Menyusun urutan modul menurut `dependsOn`.
 *
 * Deterministik: modul yang saling bebas diurutkan menurut namanya, bukan
 * menurut urutan penemuannya di sistem berkas. Urutan penemuan berbeda antara
 * Windows dan Linux, dan urutan penerapan migrasi yang berbeda antara mesin
 * pengembang dan CI adalah sumber cacat yang sangat sulit ditelusuri.
 */
export function urutkanModul(manifests: ModuleManifest[]): string[] {
  const namaModul = new Set(manifests.map((m) => m.module));
  const byName = new Map(manifests.map((m) => [m.module, m]));

  for (const m of manifests) {
    for (const dep of m.dependsOn ?? []) {
      if (dep === CORE_MODULE) continue;
      if (!namaModul.has(dep)) {
        throw new MigrationCatalogError(
          `Modul "${m.module}" bergantung pada "${dep}", tetapi manifest modul itu tidak ditemukan. ` +
            'Migrasi tidak diterapkan sama sekali — menerapkan sebagian berarti membiarkan skema ' +
            'dalam keadaan yang tidak dapat dijelaskan.',
        );
      }
    }
  }

  const hasil: string[] = [];
  const selesai = new Set<string>();
  const sedang = new Set<string>();

  const kunjungi = (nama: string, jejak: string[]): void => {
    if (selesai.has(nama)) return;
    if (sedang.has(nama)) {
      throw new MigrationCatalogError(
        `Ketergantungan modul berputar: ${[...jejak, nama].join(' → ')}. ` +
          'Tidak ada urutan penerapan yang memenuhi seluruhnya.',
      );
    }
    sedang.add(nama);
    const m = byName.get(nama);
    const deps = (m?.dependsOn ?? []).filter((d) => d !== CORE_MODULE).sort();
    for (const dep of deps) kunjungi(dep, [...jejak, nama]);
    sedang.delete(nama);
    selesai.add(nama);
    hasil.push(nama);
  };

  for (const nama of [...namaModul].sort()) kunjungi(nama, []);
  return hasil;
}

export interface HasilGabung {
  schemaVersion: number;
  migrations: TenantMigrationDefinition[];
}

/**
 * Menggabungkan katalog inti dengan katalog modul.
 *
 * Tiga aturan urutan, dan ketiganya penting:
 *
 *   1. **Seluruh migrasi inti lebih dahulu, tanpa kecuali.** Migrasi modul
 *      merujuk tabel inti — `user_subject`, `customer_group`, `outlet` — dan
 *      menjalankannya sebelum tabel itu ada akan gagal pada kunci asing.
 *   2. **Antar modul menurut `dependsOn`**, lalu menurut nama modulnya.
 *   3. **Di dalam satu modul menurut `id`**, yang bertimestamp sehingga
 *      urutannya sama dengan urutan penulisannya.
 */
export function gabungkanKatalog(
  core: CoreManifest,
  modules: ModuleManifest[],
): HasilGabung {
  const inti = [...core.migrations].sort((a, b) => a.sequence - b.sequence);

  const terpakai = new Map<string, string>();
  for (const d of inti) terpakai.set(d.version, CORE_MODULE);

  const urutan = urutkanModul(modules);
  const byName = new Map(modules.map((m) => [m.module, m]));

  const hasil: TenantMigrationDefinition[] = [...inti];
  let sequence = inti.length > 0 ? inti[inti.length - 1].sequence : 0;

  for (const namaModul of urutan) {
    const m = byName.get(namaModul);
    if (!m) continue;

    const daftar = [...m.migrations].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    for (const entri of daftar) {
      /*
       * Tabrakan id ditolak SAAT PEMUATAN, dengan menyebut kedua modulnya.
       * Bila dibiarkan sampai penerapan, yang terjadi adalah salah satunya
       * dianggap sudah diterapkan dan dilewati diam-diam — persis cacat yang
       * IR-001 hendak cegah.
       */
      const pemilikLain = terpakai.get(entri.id);
      if (pemilikLain) {
        throw new MigrationCatalogError(
          `Id migrasi "${entri.id}" dipakai dua kali: oleh modul "${pemilikLain}" dan "${namaModul}". ` +
            'Katalog tidak dimuat sama sekali. Bila dibiarkan, salah satunya akan dianggap sudah ' +
            'diterapkan dan dilewati tanpa galat, dan tabelnya tidak pernah terbentuk.',
        );
      }

      if (entri.id.length > MAX_MIGRATION_ID_LENGTH) {
        throw new MigrationCatalogError(
          `Id migrasi "${entri.id}" panjangnya ${entri.id.length} aksara, melebihi batas ` +
            `${MAX_MIGRATION_ID_LENGTH}. Kolom schema_migration.version tidak dapat menampungnya.`,
        );
      }

      /*
       * Id wajib memuat nama modulnya di antara sepasang garis bawah ganda.
       *
       * Bukan kerapian. Itulah yang membuat tabrakan antarmodul praktis
       * mustahil, dan yang membuat baris pada `schema_migration` dapat dibaca
       * tanpa membuka manifest.
       *
       * Pembatasnya harus `__<modul>__`, bukan sekadar "memuat namanya".
       * Pemeriksaan yang longgar akan meloloskan modul `coop` mengklaim id
       * milik `coop_extra` — dan nama modul yang saling berawalan bukan hal
       * yang aneh pada sistem yang punya beberapa vertikal.
       */
      if (!entri.id.includes(`__${namaModul}__`)) {
        throw new MigrationCatalogError(
          `Id migrasi "${entri.id}" pada modul "${namaModul}" tidak memuat "__${namaModul}__". ` +
            `Pakai pola <timestamp>__${namaModul}__<keterangan>.`,
        );
      }

      terpakai.set(entri.id, namaModul);
      sequence += 1;
      hasil.push({
        version: entri.id,
        sequence,
        file: `${namaModul}/${entri.file}`,
        name: entri.name,
        description: entri.description ?? '',
        module: namaModul,
        ...(m.ownSchema ? { ownSchema: true } : {}),
      });
    }
  }

  return { schemaVersion: core.schemaVersion, migrations: hasil };
}

/** Versi tertinggi pada bagian INTI saja — arti "versi skema" tidak berubah. */
export function versiIntiTertinggi(migrations: TenantMigrationDefinition[]): string {
  const inti = migrations.filter((m) => !m.module);
  return inti[inti.length - 1]?.version ?? 'V000';
}
