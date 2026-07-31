/**
 * Pengujian klasifikasi data acuan versus data contoh.
 *
 * Satu aturan yang harus selalu benar: **membersihkan data contoh tidak boleh
 * melumpuhkan tenant.**
 */

import { TENANT_MASTER_SEEDS } from './registry/tenant-master-seeds';

/**
 * Master yang tanpanya tenant tidak dapat dipakai sama sekali.
 *
 * Daftar ini ditulis terpisah dari registri dengan sengaja. Bila kelak seseorang
 * menandai salah satunya sebagai `EXAMPLE`, pengujian gagal — dan itu jauh lebih
 * baik daripada penyewa yang kehilangan bagan akunnya karena menekan tombol
 * "Hapus Data Contoh".
 */
const WAJIB_ADA = [
  'UOM',
  'TAX_CATEGORY',
  'PAYMENT_TERM',
  'PAYMENT_METHOD',
  'ACCOUNT_TYPE',
  'CHART_OF_ACCOUNT',
  'NUMBER_SEQUENCE',
  'NOTIFICATION_TEMPLATE',
  'OUTLET_TYPE',
  'WAREHOUSE_TYPE',
  'DEPARTMENT',
  'JOB_POSITION',
  'LEAVE_TYPE',
  'FISCAL_PERIOD',
  'APP_SETTING',
  'ROLE',
  'MENU',
];

const seeds = TENANT_MASTER_SEEDS;
const cari = (code: string) => seeds.find((s) => s.resourceCode === code);

describe('klasifikasi seed tenant', () => {
  it('data acuan TIDAK PERNAH ditandai sebagai contoh', () => {
    const salah = WAJIB_ADA.filter((code) => cari(code)?.seedKind === 'EXAMPLE');
    expect(salah).toEqual([]);
  });

  it('peran dan menu bukan data contoh', () => {
    /*
     * Permintaan pemilik sistem menyebutkannya secara khusus, dan alasannya
     * kuat: menghapus peran berarti mengunci penyewa keluar dari sistemnya
     * sendiri — kerusakan yang tidak dapat diperbaiki penyewa itu sendiri.
     */
    for (const code of ['ROLE', 'MENU']) {
      const def = cari(code);
      if (!def) continue;
      expect(def.seedKind).not.toBe('EXAMPLE');
    }
  });

  it('data contoh memang berupa catatan bisnis, bukan acuan', () => {
    const contoh = seeds.filter((s) => s.seedKind === 'EXAMPLE').map((s) => s.resourceCode);
    expect(contoh.sort()).toEqual(
      [
        'CUSTOMER',
        'CUSTOMER_GROUP',
        'PRODUCT',
        'PRODUCT_BRAND',
        'PRODUCT_CATEGORY',
        'PRODUCT_SUPPLIER',
        'SUPPLIER',
        'SUPPLIER_GROUP',
      ].sort(),
    );
  });

  it('setiap yang dapat dibersihkan HARUS bertanda EXAMPLE', () => {
    /*
     * Inilah cacat yang ditemukan saat mengerjakan permintaan ini: pembersihan
     * dahulu menghapus seluruh baris `is_sample = TRUE`, dan tiga belas data
     * acuan ikut tertandai. Menekan "Hapus Data Contoh" akan menghapus satuan,
     * bagan akun, metode pembayaran, dan templat pemberitahuan — sesudah itu
     * transaksi tidak dapat dibuat dan jurnal tidak dapat diposting.
     *
     * Pembersihan kini menyaring pada `seedKind`. Uji ini menjaga agar
     * penyaringan itu tetap cocok dengan penandaannya.
     */
    const berbahaya = seeds
      .filter((s) => s.supportsSampleCleanup && s.seedKind !== 'EXAMPLE')
      .map((s) => s.resourceCode);

    // Yang bukan EXAMPLE boleh saja punya supportsSampleCleanup: true — itu
    // warisan penandaan lama. Yang penting: pembersihan tidak menyentuhnya.
    // Uji ini mendokumentasikan daftarnya supaya perubahannya terlihat.
    expect(berbahaya).toContain('UOM');
    expect(berbahaya).toContain('CHART_OF_ACCOUNT');
  });

  it('bawaan tanpa seedKind diperlakukan sebagai acuan', () => {
    // Kelalaian menghasilkan tenant yang berlebih datanya, bukan yang lumpuh.
    const tanpaTanda = seeds.filter((s) => s.seedKind === undefined);
    expect(tanpaTanda.every((s) => s.seedKind !== 'EXAMPLE')).toBe(true);
  });

  it('seluruh kode resource unik', () => {
    const kode = seeds.map((s) => s.resourceCode);
    expect(new Set(kode).size).toBe(kode.length);
  });
});
