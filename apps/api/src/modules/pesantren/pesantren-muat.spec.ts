/**
 * Penjaga pemuatan modul pesantren (santri). Pola sama dengan
 * `modules/public/pesantren-muat.spec.ts` dan `pos-module-muat.spec.ts`.
 */

import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PesantrenSantriController } from './pesantren-santri.controller';
import { PesantrenSantriService } from './pesantren-santri.service';
import { PesantrenPresensiController } from './pesantren-presensi.controller';
import { PesantrenPresensiService } from './pesantren-presensi.service';
import { PesantrenTagihanController } from './pesantren-tagihan.controller';
import { PesantrenTagihanService } from './pesantren-tagihan.service';

function paramtypes(target: unknown): unknown[] {
  return (Reflect.getMetadata('design:paramtypes', target as object) as unknown[]) ?? [];
}

describe('pemuatan modul pesantren-santri', () => {
  it('setiap dependensi controller punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenSantriController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenSantriService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller presensi punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenPresensiController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service presensi punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenPresensiService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller tagihan punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenTagihanController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service tagihan punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenTagihanService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('controller dan service terdaftar pada pesantren.module.ts', () => {
    const sumber = readFileSync(join(__dirname, 'pesantren.module.ts'), 'utf8');
    expect(sumber).toContain('PesantrenSantriController');
    expect(sumber).toContain('PesantrenSantriService');
    expect(sumber).toContain('PesantrenPresensiController');
    expect(sumber).toContain('PesantrenPresensiService');
    expect(sumber).toContain('PesantrenTagihanController');
    expect(sumber).toContain('PesantrenTagihanService');
  });

  it('modul terdaftar pada app.module.ts', () => {
    const sumber = readFileSync(join(__dirname, '..', '..', 'app.module.ts'), 'utf8');
    expect(sumber).toContain('PesantrenModule');
  });
});
