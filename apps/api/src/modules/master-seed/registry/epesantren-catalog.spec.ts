/**
 * Pengujian data katalog produk dan paket ePesantren (EP-B).
 *
 * Bukan uji terhadap basis data — itu diverifikasi dengan menjalankan seed
 * sungguhan (lihat catatan pada dokumen EP-0.17). Yang dijaga di sini adalah
 * bentuk datanya sebelum sempat disimpan: kode yang tidak bertabrakan dengan
 * katalog POS yang sudah ada, dan modul yang disertakan paket benar-benar
 * terdaftar di `EPESANTREN_MODULE_CATALOG_SEED`.
 */

import {
  ECAMPUS_PRODUCT_CODE,
  EPESANTREN_MODULE_CATALOG_SEED,
  EPESANTREN_PLAN_SEED,
  EPESANTREN_PRODUCT_CODE,
  ESCHOOL_PRODUCT_CODE,
  MODULE_CATALOG_SEED,
  SUBSCRIPTION_PLAN_SEED,
} from './platform-master-seeds';

describe('kode produk ePesantren', () => {
  it('tiga kode berbeda satu sama lain', () => {
    const kode = [EPESANTREN_PRODUCT_CODE, ESCHOOL_PRODUCT_CODE, ECAMPUS_PRODUCT_CODE];
    expect(new Set(kode).size).toBe(kode.length);
  });
});

describe('katalog modul ePesantren', () => {
  it('kode modul tidak bertabrakan dengan katalog POS yang sudah ada', () => {
    /*
     * `ModuleCatalog.code` unik global (`@@unique([code])`). Tabrakan di sini
     * tidak menghasilkan galat migrasi — ia menghasilkan `upsert` yang diam-diam
     * menimpa modul POS dengan nama ePesantren, atau sebaliknya.
     */
    const kodePos = new Set(MODULE_CATALOG_SEED.map((m) => m.code));
    const tabrakan = EPESANTREN_MODULE_CATALOG_SEED.filter((m) => kodePos.has(m.code));
    expect(tabrakan).toEqual([]);
  });

  it('setiap modul berawalan EPESANTREN_, sesuai konvensi §8.3', () => {
    const salah = EPESANTREN_MODULE_CATALOG_SEED.filter((m) => !m.code.startsWith('EPESANTREN_'));
    expect(salah).toEqual([]);
  });

  it('dependsOn hanya menunjuk modul yang benar-benar ada dalam daftar ini', () => {
    // Menunjuk modul yang tidak ada berarti seed akan gagal senyap: relasi
    // dependensi tersimpan sebagai JSON bebas, bukan foreign key — tidak ada
    // yang menolaknya saat disimpan.
    const kodeYangAda = new Set(EPESANTREN_MODULE_CATALOG_SEED.map((m) => m.code));
    const dependensiHilang = EPESANTREN_MODULE_CATALOG_SEED.flatMap((m) => {
      const dependsOn = (m as { dependsOn?: string[] }).dependsOn ?? [];
      return dependsOn.filter((dep) => !kodeYangAda.has(dep)).map((dep) => `${m.code} -> ${dep}`);
    });
    expect(dependensiHilang).toEqual([]);
  });
});

describe('paket EPESANTREN_SCHOOL_FIRST', () => {
  it('kode paket tidak bertabrakan dengan paket POS yang sudah ada', () => {
    const kodePos = new Set(SUBSCRIPTION_PLAN_SEED.map((p) => p.code));
    expect(kodePos.has(EPESANTREN_PLAN_SEED.code)).toBe(false);
  });

  it('harga sesuai kesepakatan Rp 2.000 per santri per bulan', () => {
    // Ini SUMBER KEBENARAN penagihan, berbeda dari teks pemasaran di sisi web.
    expect(EPESANTREN_PLAN_SEED.unitPrice).toBe(2000);
  });

  it('seluruh modul paket terdaftar pada katalog modul ePesantren', () => {
    /*
     * Paket yang menyertakan modul yang tidak ada di katalog akan senyap
     * dilewati saat seeding (lihat `moduleMap.get(entry.code)` yang
     * mengembalikan `undefined`) — pondok membayar untuk modul yang tidak
     * pernah benar-benar ditambahkan ke paketnya.
     */
    const kodeModul = new Set(EPESANTREN_MODULE_CATALOG_SEED.map((m) => m.code));
    const hilang = EPESANTREN_PLAN_SEED.modules.filter((m) => !kodeModul.has(m.code));
    expect(hilang).toEqual([]);
  });

  it('hanya menyertakan modul yang audit EP-0 catat berstatus DONE', () => {
    /*
     * §6 melarang mengklaim fitur selesai hanya karena menu sudah tampil.
     * Paket berstatus PUBLISHED yang menyertakan modul MISSING adalah bentuk
     * pelanggaran itu — pondok membayar untuk sesuatu yang belum ada.
     */
    const modulSelesai = new Set(['EPESANTREN_FOUNDATION', 'EPESANTREN_ONBOARDING']);
    const belumSelesai = EPESANTREN_PLAN_SEED.modules
      .filter((m) => !modulSelesai.has(m.code))
      .map((m) => m.code);
    expect(belumSelesai).toEqual([]);
  });
});
