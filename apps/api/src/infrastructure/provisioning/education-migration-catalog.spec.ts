/**
 * Menjaga katalog migrasi pendidikan tetap dapat diterapkan ke schema terpisah.
 *
 * Manifest modul ditemukan dari nama direktori, bukan dari daftar yang disunting.
 * Uji ini membaca manifest yang benar-benar ada di `tenant-migrations/`, sehingga
 * ia merah ketika seseorang menambahkan migrasi pendidikan yang tidak dapat
 * diterapkan — bukan ketika seseorang lupa menyunting daftar.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { gabungkanKatalog, type CoreManifest, type ModuleManifest } from './migration-catalog';

const DIR = join(__dirname, '../../../tenant-migrations');

const baca = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

const inti = baca<CoreManifest>(join(DIR, 'manifest.json'));
const education = baca<ModuleManifest>(join(DIR, 'education/manifest.json'));
const eschool = baca<ModuleManifest>(join(DIR, 'eschool/manifest.json'));
/** Modul lama yang menumpang di schema inti — pembanding bagi `ownSchema`. */
const cooperative = baca<ModuleManifest>(join(DIR, 'cooperative/manifest.json'));

describe('manifest modul pendidikan', () => {
  it('kode modulnya canonical', () => {
    // Nama direktori dan nama modul harus sama — jalur berkas SQL diturunkan
    // darinya, dan salah eja menghasilkan migrasi yang tidak pernah ditemukan.
    expect(education.module).toBe('education');
    expect(eschool.module).toBe('eschool');
  });

  it('eschool bergantung pada kernel pendidikan, bukan sebaliknya', () => {
    /*
     * Arah kebergantungan menentukan urutan penerapan. Terbalik, migrasi
     * eschool berjalan sebelum tabel kernel ada dan gagal pada rujukan yang
     * belum terbentuk — di tengah provisioning, saat tenant sudah menunggu.
     */
    expect(eschool.dependsOn).toContain('education');
    expect(education.dependsOn ?? []).not.toContain('eschool');
  });

  it('keduanya tinggal di schema sendiri, bukan menumpang di schema inti', () => {
    /*
     * Penanda inilah yang menahan tabel pendidikan keluar dari schema inti.
     *
     * Bila hilang, migrasi pendidikan ikut diterapkan ke `{username}` bersama
     * migrasi inti. Tidak ada galat yang muncul: tabelnya terbentuk, kueri
     * berhasil, dan isolasi antarvertical yang seharusnya ditegakkan PostgreSQL
     * berubah menjadi konvensi penamaan — bentuk yang ditolak dokumen audit 03
     * justru karena alasan keamanan.
     */
    expect(education.ownSchema).toBe(true);
    expect(eschool.ownSchema).toBe(true);
  });

  it('setiap migrasi memuat nama modulnya pada id', () => {
    /*
     * Ditegakkan `gabungkanKatalog`, dan diuji lagi di sini supaya kegagalannya
     * menyebut modul yang salah alih-alih menggagalkan seluruh suite saat
     * pemuatan.
     *
     * BRD menuliskan awalan `education_common`, sedangkan kode modulnya
     * `education` — dan kode modul itu pula yang menjadi akhiran schema
     * (`{username}_education`). Satu string canonical dipakai untuk keduanya;
     * dua nama untuk satu hal adalah persis yang menghasilkan schema salah eja.
     */
    for (const m of education.migrations) {
      expect(m.id).toContain('__education__');
    }
    for (const m of eschool.migrations) {
      expect(m.id).toContain('__eschool__');
    }
  });
});

describe('penggabungan katalog', () => {
  const hasil = gabungkanKatalog(inti, [cooperative, education, eschool]);

  it('kernel pendidikan berada sebelum eschool', () => {
    const urut = hasil.migrations.map((m) => m.module ?? 'core');
    const iEducation = urut.lastIndexOf('education');
    const iEschool = urut.indexOf('eschool');

    expect(iEducation).toBeGreaterThanOrEqual(0);
    expect(iEschool).toBeGreaterThan(iEducation);
  });

  it('seluruh migrasi inti mendahului migrasi pendidikan', () => {
    const pertamaModul = hasil.migrations.findIndex((m) => m.module);
    const intiSetelahnya = hasil.migrations
      .slice(pertamaModul)
      .filter((m) => !m.module);

    expect(intiSetelahnya).toHaveLength(0);
  });

  it('jalur berkas modul diawali nama modulnya', () => {
    for (const m of hasil.migrations.filter((x) => x.module === 'eschool')) {
      expect(m.file.startsWith('eschool/')).toBe(true);
    }
  });
});

describe('penyaringan per modul', () => {
  const hasil = gabungkanKatalog(inti, [cooperative, education, eschool]);

  /**
   * Meniru penyaringan yang dilakukan `applyAll` ketika `modules` diberikan.
   *
   * Ditulis di sini, bukan memanggil `applyAll`, karena yang diuji adalah
   * pemilihan migrasinya — bukan penerapannya ke basis data. Perilaku yang
   * sama diuji dari sisi basis data oleh provisioning di CI.
   */
  const saring = (modules: readonly string[]) =>
    hasil.migrations.filter((m) => m.module && modules.includes(m.module));

  it('menyaring hanya modul yang diminta', () => {
    const hanyaEducation = saring(['education']);
    expect(hanyaEducation.length).toBeGreaterThan(0);
    expect(hanyaEducation.every((m) => m.module === 'education')).toBe(true);
  });

  it('TIDAK menyertakan migrasi inti', () => {
    /*
     * Inilah yang membuat `{username}_eschool` berisi tabel sekolah saja
     * alih-alih salinan seluruh tabel inti. Bila migrasi inti ikut terbawa,
     * setiap schema vertical memperoleh tabel pengguna, peran, dan menu
     * sendiri — dan sejak saat itu tidak jelas lagi yang mana yang berlaku.
     */
    expect(saring(['education', 'eschool']).some((m) => !m.module)).toBe(false);
  });

  it('urutan kernel sebelum vertical tetap terjaga sesudah disaring', () => {
    const urut = saring(['education', 'eschool']).map((m) => m.module);
    expect(urut.lastIndexOf('education')).toBeLessThan(urut.indexOf('eschool'));
  });

  it('penerapan ke schema INTI melewatkan seluruh modul berschema sendiri', () => {
    /*
     * Meniru cabang `applyAll` ketika `modules` tidak diberikan — jalur yang
     * dipakai provisioning schema inti dan `pnpm migrate:tenants`.
     *
     * Inilah uji yang menjaga tabel pendidikan tidak diam-diam terbentuk di
     * schema setiap tenant.
     */
    const keInti = hasil.migrations.filter((m) => !m.ownSchema);

    expect(keInti.some((m) => m.module === 'education')).toBe(false);
    expect(keInti.some((m) => m.module === 'eschool')).toBe(false);
    // Modul lama tetap menumpang di schema inti, dan itu memang disengaja.
    expect(keInti.some((m) => m.module === 'cooperative')).toBe(true);
    // Migrasi inti tentu saja ikut.
    expect(keInti.some((m) => !m.module)).toBe(true);
  });
});
