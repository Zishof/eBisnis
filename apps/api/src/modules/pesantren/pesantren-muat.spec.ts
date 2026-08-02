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
import { PesantrenAsramaController, PesantrenPenempatanController } from './pesantren-asrama.controller';
import { PesantrenAsramaService } from './pesantren-asrama.service';
import { PesantrenKitabController, PesantrenHalaqahController } from './pesantren-diniyah.controller';
import { PesantrenDiniyahService } from './pesantren-diniyah.service';
import { PesantrenTahfizController } from './pesantren-tahfiz.controller';
import { PesantrenTahfizService } from './pesantren-tahfiz.service';
import { PesantrenPerizinanController } from './pesantren-perizinan.controller';
import { PesantrenPerizinanService } from './pesantren-perizinan.service';
import { PesantrenGerbangController } from './pesantren-gerbang.controller';
import { PesantrenGerbangService } from './pesantren-gerbang.service';
import { PesantrenPortalWaliController } from './pesantren-portal-wali.controller';
import { PesantrenPortalWaliService } from './pesantren-portal-wali.service';
import { PesantrenDompetController } from './pesantren-dompet.controller';
import { PesantrenDompetService } from './pesantren-dompet.service';
import { PesantrenKartuController } from './pesantren-kartu.controller';
import { PesantrenKartuService } from './pesantren-kartu.service';
import { PesantrenKioskController } from './pesantren-kiosk.controller';
import { PesantrenKioskService } from './pesantren-kiosk.service';
import { PesantrenDompetPaymentHandler } from './pesantren-dompet-payment.handler';
import { PesantrenNilaiController } from './pesantren-nilai.controller';
import { PesantrenNilaiService } from './pesantren-nilai.service';
import { PesantrenPsbGelombangController, PesantrenPsbPendaftarController } from './pesantren-psb.controller';
import { PesantrenPsbService } from './pesantren-psb.service';
import { PesantrenRombonganController } from './pesantren-rombongan.controller';
import { PesantrenRombonganService } from './pesantren-rombongan.service';
import { PesantrenKurikulumController } from './pesantren-kurikulum.controller';
import { PesantrenKurikulumService } from './pesantren-kurikulum.service';
import { PesantrenLaporanController } from './pesantren-laporan.controller';
import { PesantrenLaporanService } from './pesantren-laporan.service';

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

  it('setiap dependensi controller asrama punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenAsramaController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller penempatan punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenPenempatanController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service asrama punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenAsramaService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller kitab punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenKitabController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller halaqah punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenHalaqahController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service diniyah punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenDiniyahService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller tahfiz punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenTahfizController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service tahfiz punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenTahfizService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller perizinan punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenPerizinanController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service perizinan punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenPerizinanService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller gerbang punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenGerbangController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service gerbang punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenGerbangService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('layanan gerbang tidak memiliki metode yang menyentuh status izin (docs/santri-info/13 R10)', () => {
    // Pemeriksaan langsung terhadap bentuk kelas: metode yang dimilikinya
    // hanya `daftar` dan `catat` -- tidak ada `setujui`/`tolak`/`ubah` apa pun.
    const metode = Object.getOwnPropertyNames(PesantrenGerbangService.prototype).filter(
      (m) => m !== 'constructor',
    );
    expect(metode.sort()).toEqual(['catat', 'daftar'].sort());
  });

  it('setiap dependensi controller portal wali punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenPortalWaliController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service portal wali punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenPortalWaliService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller dompet punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenDompetController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service dompet punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenDompetService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller kartu punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenKartuController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service kartu punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenKartuService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller kiosk punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenKioskController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service kiosk punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenKioskService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('layanan kiosk hanya punya metode baca (EP-M SoD perangkat)', () => {
    const metode = Object.getOwnPropertyNames(PesantrenKioskService.prototype).filter((m) => m !== 'constructor');
    expect(metode).toEqual(['pindaiKartu']);
  });

  it('setiap dependensi penangan pembayaran dompet punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenDompetPaymentHandler);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller nilai punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenNilaiController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service nilai punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenNilaiService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller gelombang psb punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenPsbGelombangController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller pendaftar psb punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenPsbPendaftarController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service psb punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenPsbService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller rombongan punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenRombonganController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service rombongan punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenRombonganService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller kurikulum punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenKurikulumController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service kurikulum punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenKurikulumService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi controller laporan punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenLaporanController);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('setiap dependensi service laporan punya tipe yang terdefinisi', () => {
    const tipe = paramtypes(PesantrenLaporanService);
    expect(tipe.length).toBeGreaterThan(0);
    expect(tipe.filter((t) => t === undefined)).toEqual([]);
  });

  it('controller dan service terdaftar pada pesantren.module.ts', () => {
    const sumber = readFileSync(join(__dirname, 'pesantren.module.ts'), 'utf8');
    expect(sumber).toContain('PesantrenNilaiController');
    expect(sumber).toContain('PesantrenNilaiService');
    expect(sumber).toContain('PesantrenDompetPaymentHandler');
    expect(sumber).toContain('PesantrenSantriController');
    expect(sumber).toContain('PesantrenSantriService');
    expect(sumber).toContain('PesantrenPresensiController');
    expect(sumber).toContain('PesantrenPresensiService');
    expect(sumber).toContain('PesantrenTagihanController');
    expect(sumber).toContain('PesantrenTagihanService');
    expect(sumber).toContain('PesantrenAsramaController');
    expect(sumber).toContain('PesantrenPenempatanController');
    expect(sumber).toContain('PesantrenAsramaService');
    expect(sumber).toContain('PesantrenKitabController');
    expect(sumber).toContain('PesantrenHalaqahController');
    expect(sumber).toContain('PesantrenDiniyahService');
    expect(sumber).toContain('PesantrenTahfizController');
    expect(sumber).toContain('PesantrenTahfizService');
    expect(sumber).toContain('PesantrenPerizinanController');
    expect(sumber).toContain('PesantrenPerizinanService');
    expect(sumber).toContain('PesantrenGerbangController');
    expect(sumber).toContain('PesantrenGerbangService');
    expect(sumber).toContain('PesantrenPortalWaliController');
    expect(sumber).toContain('PesantrenPortalWaliService');
    expect(sumber).toContain('PesantrenDompetController');
    expect(sumber).toContain('PesantrenDompetService');
    expect(sumber).toContain('PesantrenKartuController');
    expect(sumber).toContain('PesantrenKartuService');
    expect(sumber).toContain('PesantrenKioskController');
    expect(sumber).toContain('PesantrenKioskService');
    expect(sumber).toContain('PesantrenPsbGelombangController');
    expect(sumber).toContain('PesantrenPsbPendaftarController');
    expect(sumber).toContain('PesantrenPsbService');
    expect(sumber).toContain('PesantrenRombonganController');
    expect(sumber).toContain('PesantrenRombonganService');
    expect(sumber).toContain('PesantrenKurikulumController');
    expect(sumber).toContain('PesantrenKurikulumService');
    expect(sumber).toContain('PesantrenLaporanController');
    expect(sumber).toContain('PesantrenLaporanService');
  });

  it('modul terdaftar pada app.module.ts', () => {
    const sumber = readFileSync(join(__dirname, '..', '..', 'app.module.ts'), 'utf8');
    expect(sumber).toContain('PesantrenModule');
  });
});
