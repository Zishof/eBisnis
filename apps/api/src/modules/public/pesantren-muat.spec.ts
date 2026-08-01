/**
 * Penjaga pemuatan modul pesantren.
 *
 * ## Cacat yang dicegah
 *
 * `@Controller` dan `@Injectable` menulis `design:paramtypes` **pada saat kelas
 * didefinisikan**. Impor yang diletakkan di bawah definisi kelas belum
 * terinisialisasi saat itu, sehingga tipe dependensinya tercatat `undefined`.
 *
 * Kompilasi tetap berhasil. Uji fungsi murni tetap hijau. Yang gagal adalah
 * pemuatan modul saat peladen dinyalakan — dan pesannya hanya
 * "Cannot access 'X' before initialization", tanpa menyebut berkas mana.
 *
 * Cacat ini pernah terjadi sekali pada modul POS. Uji ini ada supaya
 * kejadiannya tidak berulang tanpa ketahuan sampai peladen dinyalakan.
 */

import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PesantrenRegistrationController } from './pesantren-registration.controller';
import { PesantrenRegistrationService } from './pesantren-registration.service';

function paramtypes(target: unknown): unknown[] {
  return (Reflect.getMetadata('design:paramtypes', target as object) as unknown[]) ?? [];
}

describe('pemuatan modul pesantren', () => {
  it('setiap dependensi controller punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenRegistrationController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenRegistrationService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  /*
   * Pendaftaran modul diperiksa dari sumbernya, bukan dengan mengimpor
   * `PublicModule`.
   *
   * Mengimpornya menarik `contact.service.ts` beserta `sanitize-html`, yang
   * berbentuk ESM dan tidak dapat dimuat pelari uji ini. Yang hendak dibuktikan
   * hanyalah controller dan service benar-benar terdaftar — dan itu terbaca dari
   * berkasnya.
   *
   * Batasnya jujur: penjaga ini tidak menangkap pendaftaran yang dirakit dari
   * potongan. Yang dicegah adalah lupa mendaftarkan sama sekali.
   */
  it('controller dan service terdaftar pada modul publik', () => {
    const sumber = readFileSync(join(__dirname, 'public.module.ts'), 'utf8');
    const kode = sumber
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((baris) => !/^\s*(\/\/|\*)/.test(baris))
      .join('\n');

    const kelasController = kode.slice(kode.indexOf('controllers:'), kode.indexOf('providers:'));
    expect(kelasController).toContain('PesantrenRegistrationController');
    expect(kode).toContain('PesantrenRegistrationService');
  });
});
