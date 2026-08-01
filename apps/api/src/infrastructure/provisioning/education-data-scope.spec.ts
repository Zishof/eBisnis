/**
 * Menjaga `DataScopeCode` dan kembarannya di basis data tetap sama.
 *
 * ## Mengapa uji ini ada
 *
 * Tingkat cakupan data dinyatakan di DUA tempat: union TypeScript pada
 * `role-profile.ts`, dan dua CHECK constraint di dalam SQL migration tenant.
 * Keduanya harus memuat nilai yang sama persis.
 *
 * Menambah nilai pada TypeScript saja lolos kompilasi, lolos seluruh uji
 * satuan, lalu **berhenti saat provisioning tenant** dengan
 * "violates check constraint ck_role_data_scope_level". Itu sudah terjadi
 * sekali pada E13-1, dan yang menangkapnya adalah CI — sesudah kode terkirim.
 *
 * Uji ini memindahkan penangkapannya ke tempat yang lebih murah: sebelum commit.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DATA_SCOPE_CODES } from './role-profile';

/** Migration terakhir yang menetapkan daftar tingkat cakupan. */
const BERKAS = join(__dirname, '../../../tenant-migrations/V038__education_data_scope.sql');

/** Membaca nilai di dalam sebuah `CHECK (<kolom> IN ( ... ))`. */
function nilaiConstraint(sql: string, namaConstraint: string): string[] {
  const mulai = sql.indexOf(`ADD CONSTRAINT ${namaConstraint}`);
  if (mulai < 0) throw new Error(`Constraint ${namaConstraint} tidak ditemukan`);

  const buka = sql.indexOf('IN (', mulai);
  const tutup = sql.indexOf('));', buka);
  if (buka < 0 || tutup < 0) throw new Error(`Bentuk ${namaConstraint} tidak dikenali`);

  const isi = sql.slice(buka + 4, tutup);
  return [...isi.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
}

describe('tingkat cakupan data: TypeScript dan SQL', () => {
  const sql = readFileSync(BERKAS, 'utf8');

  it.each([['ck_role_data_scope_level'], ['ck_user_scope_type']])(
    '%s memuat nilai yang sama persis dengan DATA_SCOPE_CODES',
    (constraint) => {
      /*
       * Dibandingkan sebagai HIMPUNAN yang terurut, bukan daftar berurutan.
       * Urutan penulisan di SQL dan di TypeScript tidak perlu sama; yang wajib
       * sama adalah isinya.
       */
      const diSql = [...nilaiConstraint(sql, constraint)].sort();
      const diKode = [...DATA_SCOPE_CODES].sort();

      expect(diSql).toEqual(diKode);
    },
  );

  it('tidak ada nilai ganda pada daftar TypeScript', () => {
    // Nilai ganda membuat perbandingan himpunan di atas tetap lulus sementara
    // jumlahnya berbeda — dan yang ganda itu biasanya salah ketik.
    expect(new Set(DATA_SCOPE_CODES).size).toBe(DATA_SCOPE_CODES.length);
  });

  it('dua belas cakupan pendidikan Versi 13 ada', () => {
    for (const kode of [
      'INSTITUTION',
      'CAMPUS',
      'FACULTY',
      'STUDY_PROGRAM',
      'SCHOOL_UNIT',
      'GRADE',
      'CLASS_GROUP',
      'PESANTREN_UNIT',
      'DORMITORY',
      'ROOM',
      'LEARNER_SELF',
      'GUARDIAN_CHILD',
    ]) {
      expect(DATA_SCOPE_CODES).toContain(kode);
    }
  });

  it('cakupan Versi 5-9 tidak hilang', () => {
    // Menghapus tingkat yang sudah dipakai membuat peran yang ada kehilangan
    // batas datanya — dan peran tanpa batas melihat seluruh tenant.
    for (const kode of ['PLATFORM', 'TENANT', 'OUTLET_TERMINAL', 'PAYMENT_PROVIDER_ACCOUNT']) {
      expect(DATA_SCOPE_CODES).toContain(kode);
    }
  });
});
