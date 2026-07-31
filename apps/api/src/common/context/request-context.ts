/**
 * Konteks permintaan yang mengikuti alur eksekusi.
 *
 * ## Mengapa ini ada
 *
 * Kolom `actor_role_codes` pada `audit_event` sudah ada sejak skema pertama —
 * dan sampai V10-5 seluruh 258 barisnya bernilai `null`. Sebabnya bukan
 * kelalaian satu orang: memanggil `audit.record()` dari tujuh puluh enam tempat
 * berarti tujuh puluh enam kesempatan untuk lupa mengisi satu bidang, dan
 * bidang yang bergantung pada ingatan penulis kode akan kosong pada sebagian
 * besar tempat.
 *
 * Cara memperbaikinya bukan menambal ketujuh puluh enam pemanggilan itu — itu
 * hanya menunda masalah yang sama sampai pemanggilan ketujuh puluh tujuh
 * ditulis. Cara memperbaikinya adalah membuat bidang itu **terisi sendiri**.
 *
 * `AsyncLocalStorage` menyimpan konteks yang mengikuti seluruh rantai `await`
 * dari satu permintaan, sehingga siapa pun yang perlu tahu "siapa yang sedang
 * meminta ini" dapat menanyakannya tanpa menerimanya sebagai argumen.
 *
 * ## Yang TIDAK boleh dilakukan dengan ini
 *
 * Konteks ini **bukan sumber kebenaran untuk otorisasi**. Penjaga hak akses
 * tetap membaca `request.user` yang berasal dari token terverifikasi. Konteks
 * ini hanya untuk mencatat — dan mencatat dari konteks yang salah menghasilkan
 * catatan yang salah, sedangkan mengizinkan dari konteks yang salah
 * menghasilkan pelanggaran.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestScope {
  requestId?: string;
  correlationId?: string;
  actorUserId?: string;
  actorUsername?: string;
  /** Seluruh peran yang dipegang, sebagai kode. */
  actorRoleCodes?: string[];
  /** Peran yang sedang dipakai, bila pengguna memilih satu. */
  activeRoleCode?: string;
  sessionId?: string;
  tenantId?: string;
  tenantSchema?: string;
  ipAddress?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestScope>();

/** Menjalankan sesuatu di dalam konteks permintaan. */
export function runInRequestScope<T>(scope: RequestScope, fn: () => T): T {
  return storage.run(scope, fn);
}

/**
 * Konteks permintaan yang sedang berjalan.
 *
 * Mengembalikan `undefined` di luar permintaan HTTP — mis. pada pekerjaan
 * terjadwal dan proses latar. Itu keadaan yang sah, bukan galat: pekerjaan
 * terjadwal memang tidak punya pelaku manusia, dan mengarangkan satu justru
 * membuat jejak auditnya berbohong.
 */
export function currentScope(): RequestScope | undefined {
  return storage.getStore();
}

/**
 * Melengkapi masukan audit dengan konteks yang sedang berjalan.
 *
 * Nilai yang sudah disebut pemanggil **tidak** ditimpa. Pemanggil yang
 * menyebutkan pelaku secara eksplisit biasanya sedang mencatat perbuatan atas
 * nama orang lain — mis. petugas dukungan yang bertindak untuk penyewa — dan
 * konteks yang menimpanya akan menghapus justru perbedaan yang paling penting
 * untuk dicatat.
 */
export function withRequestScope<T extends Partial<RequestScope>>(input: T): T {
  const scope = currentScope();
  if (!scope) return input;

  const hasil = { ...input } as T & Partial<RequestScope>;
  for (const kunci of [
    'requestId',
    'correlationId',
    'actorUserId',
    'actorUsername',
    'actorRoleCodes',
    'activeRoleCode',
    'sessionId',
    'tenantId',
    'tenantSchema',
    'ipAddress',
    'userAgent',
  ] as const) {
    if (hasil[kunci] === undefined && scope[kunci] !== undefined) {
      (hasil as Record<string, unknown>)[kunci] = scope[kunci];
    }
  }
  return hasil;
}
