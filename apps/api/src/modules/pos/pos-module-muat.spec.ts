/**
 * Penjaga urutan impor pada `pos.module.ts`.
 *
 * ## Cacat yang dijaga
 *
 * `PosPromotionService` sempat diimpor pada baris DI BAWAH kelas `PosController`.
 * TypeScript menerimanya, `nest build` menerimanya, dan seluruh uji satuan lulus
 * — sebab tak satu pun di antaranya memuat modulnya sebagai modul.
 *
 * Yang gagal adalah peladen saat dijalankan:
 *
 *     ReferenceError: Cannot access 'pos_promotion_service_1' before initialization
 *
 * Sebabnya: dekorator `@Controller` menulis metadata `design:paramtypes` pada
 * saat kelasnya didefinisikan, dan metadata itu menyebut setiap tipe pada
 * konstruktor. Bila `require` untuk salah satu tipe itu baru berjalan sesudahnya,
 * pembacaannya jatuh pada zona mati temporal.
 *
 * Ia ketahuan dari uji peramban, yaitu tempat paling mahal untuk menemukannya:
 * seluruh rangkaian E2E berjalan lebih dahulu, lalu gagal karena peladennya
 * memang tidak pernah menyala.
 *
 * Uji ini memuat modulnya dan membaca metadata itu — persis langkah yang dulu
 * meledak.
 */

import 'reflect-metadata';

import { PosController, PosModule } from './pos.module';

describe('memuat modul POS', () => {
  it('modulnya dan controllernya dapat dimuat', () => {
    expect(typeof PosController).toBe('function');
    expect(typeof PosModule).toBe('function');
  });

  it('setiap tipe pada konstruktor controller sudah terdefinisi', () => {
    /*
     * Inilah yang dulu meledak. Satu `undefined` di dalam daftar ini berarti
     * impornya berjalan terlambat — dan Nest tidak akan dapat menyuntikkannya,
     * meski TypeScript dan `nest build` sama-sama diam.
     */
    const tipe = Reflect.getMetadata('design:paramtypes', PosController) as unknown[];

    expect(Array.isArray(tipe)).toBe(true);
    expect(tipe.length).toBeGreaterThan(0);

    // Indeksnya ikut dilaporkan sebagai daftar, bukan lewat argumen pesan:
    // `expect` milik Jest hanya menerima satu argumen, tidak seperti Vitest.
    const belumTerdefinisi = tipe
      .map((t, i) => (typeof t === 'function' ? null : `parameter ke-${i}`))
      .filter(Boolean);

    expect(belumTerdefinisi).toEqual([]);
  });
});
