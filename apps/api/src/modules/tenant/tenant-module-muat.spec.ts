/**
 * Penjaga urutan impor pada `tenant.module.ts` dan layanan yang dipakainya.
 *
 * ## Cacat yang dijaga
 *
 * Dekorator `@Controller` dan `@Injectable` menulis metadata `design:paramtypes`
 * pada saat kelasnya DIDEFINISIKAN, dan metadata itu menyebut setiap tipe pada
 * konstruktornya. Bila `require` untuk salah satu tipe itu baru berjalan
 * sesudahnya, pembacaannya jatuh pada zona mati temporal dan peladen gagal
 * menyala:
 *
 *     ReferenceError: Cannot access 'x_service_1' before initialization
 *
 * Hal persis ini pernah terjadi pada `pos.module.ts` (lihat
 * `pos-module-muat.spec.ts`). TypeScript menerimanya, `nest build` menerimanya,
 * dan seluruh uji satuan lulus — sebab tak satu pun di antaranya memuat
 * modulnya sebagai modul. Yang menemukannya adalah uji peramban, yaitu tempat
 * paling mahal untuk menemukannya.
 *
 * Modul tenant belum punya penjaga seperti itu sampai `ErpPurchasingService`
 * menerima dependensi lintas-modul yang pertama (`AccountingPostingService`,
 * untuk jurnal pembalik) — dependensi lintas-modul persis yang membuat urutan
 * impor mulai berarti.
 */

import 'reflect-metadata';

import {
  AccountingDocumentController,
  ErpController,
  MasterController,
  TenantAdminController,
  TenantModule,
} from './tenant.module';
import { ErpPurchasingService } from './erp-purchasing.service';

/** Melaporkan indeks yang kosong sebagai daftar: `expect` Jest hanya menerima satu argumen. */
function parameterBelumTerdefinisi(target: unknown): string[] {
  const tipe = (Reflect.getMetadata('design:paramtypes', target as object) ?? []) as unknown[];
  return tipe
    .map((t, i) => (typeof t === 'function' ? null : `parameter ke-${i}`))
    .filter((x): x is string => x !== null);
}

describe('memuat modul tenant', () => {
  const kelas: [string, unknown][] = [
    ['TenantModule', TenantModule],
    ['MasterController', MasterController],
    ['TenantAdminController', TenantAdminController],
    ['AccountingDocumentController', AccountingDocumentController],
    ['ErpController', ErpController],
    ['ErpPurchasingService', ErpPurchasingService],
  ];

  for (const [nama, target] of kelas) {
    it(`${nama} dapat dimuat`, () => {
      expect(typeof target).toBe('function');
    });

    it(`setiap tipe pada konstruktor ${nama} sudah terdefinisi`, () => {
      expect(parameterBelumTerdefinisi(target)).toEqual([]);
    });
  }

  it('ErpPurchasingService benar-benar menerima layanan posting akuntansi', () => {
    /*
     * Bukan sekadar "tidak undefined": kalau dependensi ini hilang, jurnal
     * pembalik tidak pernah terbentuk dan pembatalan penerimaan barang kembali
     * meninggalkan buku besar yang tidak dibalik — tanpa galat apa pun.
     */
    const tipe = Reflect.getMetadata('design:paramtypes', ErpPurchasingService) as {
      name?: string;
    }[];
    const nama = tipe.map((t) => t?.name);
    expect(nama).toContain('AccountingPostingService');
  });
});
