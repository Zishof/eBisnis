/**
 * Pengujian hak akses per laporan.
 *
 * Yang diputuskan modul ini menentukan siapa boleh melihat angka apa. Sekali
 * laba rugi terbaca oleh orang yang tidak berhak, ia tidak dapat ditarik
 * kembali — dan tidak ada galat yang muncul untuk memberi tahu bahwa itu
 * terjadi.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  IZIN_LAPORAN,
  bolehMembacaLaporan,
  izinUntukLaporan,
} from './izin-laporan';
import { reportSql } from './sales-inventory-operations.controller';

/** Kode laporan yang benar-benar dilayani `reportSql`, dibaca dari sumbernya. */
function kodeLaporanDiKatalog(): string[] {
  const sumber = readFileSync(
    join(__dirname, 'sales-inventory-operations.controller.ts'),
    'utf8',
  );
  const isi = sumber.slice(sumber.indexOf('export function reportSql'));
  const kode = new Set<string>();
  for (const cocok of isi.matchAll(/^\s{4}'([a-z0-9-]+)':\s*\{$/gm)) kode.add(cocok[1]);
  // `profit-loss` dilayani lewat cabang terpisah, bukan lewat objek literal.
  kode.add('profit-loss');
  return [...kode];
}

describe('setiap laporan punya haknya sendiri', () => {
  const kodeKatalog = kodeLaporanDiKatalog();

  it('katalognya terbaca dan tidak kosong', () => {
    // Bila pembacaan ini gagal, penjaga di bawahnya menjadi hampa.
    expect(kodeKatalog.length).toBeGreaterThan(15);
    expect(kodeKatalog).toContain('profit-loss');
    expect(kodeKatalog).toContain('gross-profit');
  });

  it('TIDAK ADA laporan yang tertinggal tanpa pemetaan', () => {
    /*
     * Penjaga terpenting berkas ini. Laporan yang ditambahkan tanpa entri di
     * `IZIN_LAPORAN` akan ditolak saat dipanggil — benar, tetapi baru ketahuan
     * di produksi. Uji ini memindahkan penemuannya ke CI.
     */
    const tanpaIzin = kodeKatalog.filter((code) => !izinUntukLaporan(code));
    expect(tanpaIzin).toEqual([]);
  });

  it('tidak ada pemetaan untuk laporan yang sudah tidak ada', () => {
    // Peta yang menyimpan kode mati menyesatkan pembacanya tentang apa yang
    // sebenarnya dijaga.
    const yatim = Object.keys(IZIN_LAPORAN).filter((code) => !kodeKatalog.includes(code));
    expect(yatim).toEqual([]);
  });

  it('setiap laporan pada katalog benar-benar dilayani reportSql', () => {
    for (const code of kodeKatalog) {
      expect(reportSql(code, '"demo"')).not.toBeNull();
    }
  });
});

describe('angka yang paling sensitif tidak lagi memakai SALES.READ', () => {
  it('laba rugi menuntut hak keuangan', () => {
    expect(izinUntukLaporan('profit-loss')).toBe('FINANCE_JOURNAL.READ');
  });

  it('laba kotor menuntut hak melihat profit', () => {
    /*
     * `gross-profit` memuat HPP per barang: yang membacanya tahu margin setiap
     * produk. `SALES_REPORT.VIEW_PROFIT` sudah ada pada katalog menu sejak awal
     * dan belum pernah dipakai menjaga apa pun -- hak yang tersedia tetapi
     * tidak ditegakkan sama saja dengan hak yang tidak ada.
     */
    expect(izinUntukLaporan('gross-profit')).toBe('SALES_REPORT.VIEW_PROFIT');
  });

  it('hutang pemasok menuntut hak pembelian, bukan hak penjualan', () => {
    for (const code of ['ap-aging', 'ap-payment-register', 'purchase-register', 'supplier-list']) {
      expect(izinUntukLaporan(code)).toBe('PURCHASING.READ');
    }
  });

  it('tidak ada laporan sensitif yang tersisa di SALES.READ', () => {
    const sensitif = ['profit-loss', 'gross-profit', 'ap-aging', 'ap-payment-register'];
    const masihSales = sensitif.filter((code) => izinUntukLaporan(code) === 'SALES.READ');
    expect(masihSales).toEqual([]);
  });
});

describe('laporan tak dikenal ditolak, bukan diloloskan', () => {
  it('kode yang tidak ada memberi null, bukan hak bawaan', () => {
    expect(izinUntukLaporan('laporan-karangan')).toBeNull();
    expect(izinUntukLaporan('')).toBeNull();
    expect(izinUntukLaporan(null)).toBeNull();
    expect(izinUntukLaporan(undefined)).toBeNull();
  });

  it('bukan lewat prototype chain', () => {
    // `IZIN_LAPORAN['toString']` akan mengembalikan fungsi bila petanya dibaca
    // ceroboh -- dan fungsi itu bernilai truthy, sehingga aksesnya lolos.
    expect(izinUntukLaporan('toString')).toBeNull();
    expect(izinUntukLaporan('constructor')).toBeNull();
    expect(izinUntukLaporan('__proto__')).toBeNull();
  });

  it('petanya tidak dapat diubah saat berjalan', () => {
    expect(Object.isFrozen(IZIN_LAPORAN)).toBe(true);
  });
});

describe('keputusan baca untuk snapshot tersimpan', () => {
  it('mengizinkan bila haknya dimiliki', () => {
    expect(bolehMembacaLaporan('profit-loss', ['FINANCE_JOURNAL.READ'])).toEqual({
      allowed: true,
      required: 'FINANCE_JOURNAL.READ',
      reason: null,
    });
  });

  it('menolak pemegang SALES.READ membaca snapshot laba rugi', () => {
    // Snapshot justru bentuk yang paling mudah beredar: ditautkan, dicetak,
    // dikirim ulang. Membiarkannya di SALES.READ membuat perbaikan ini kosmetik.
    expect(bolehMembacaLaporan('profit-loss', ['SALES.READ', 'SALES_REPORT.READ'])).toEqual({
      allowed: false,
      required: 'FINANCE_JOURNAL.READ',
      reason: 'HAK_TIDAK_CUKUP',
    });
  });

  it('menolak kode yang tidak dikenal walau haknya banyak', () => {
    const kaya = Object.values(IZIN_LAPORAN);
    expect(bolehMembacaLaporan('entah-apa', kaya)).toEqual({
      allowed: false,
      required: null,
      reason: 'KODE_TIDAK_DIKENAL',
    });
  });

  it('tanpa hak sama sekali tetap ditolak', () => {
    expect(bolehMembacaLaporan('stock-list', []).allowed).toBe(false);
  });
});

describe('penjaga: penegakannya benar-benar terpasang', () => {
  const controller = readFileSync(
    join(__dirname, 'sales-inventory-operations.controller.ts'),
    'utf8',
  );
  const guard = readFileSync(
    join(__dirname, '..', 'auth', 'guards', 'permission.guard.ts'),
    'utf8',
  );

  it('endpoint laporan memakai @ReportPermission, bukan SALES.READ', () => {
    expect(controller).toMatch(/@Post\('reports\/:code\/preview'\)\s*\n\s*@ReportPermission\(\)/);
    expect(controller).toMatch(
      /@Post\('reports\/:code\/snapshot'\)[\s\S]{0,80}?@ReportPermission\(\)/,
    );
  });

  it('membaca snapshot tersimpan ikut diperiksa', () => {
    expect(controller).toContain('pastikanBolehMembacaLaporan(user, row.report_code');
  });

  it('penjaga menolak kode laporan yang tidak dikenal', () => {
    expect(guard).toContain('izinUntukLaporan(code)');
    expect(guard).toMatch(/if \(!izin\)[\s\S]{0,600}?Kode laporan tidak dikenal/);
  });

  it('daftar pembayaran hutang tidak lagi dijaga hak penjualan', () => {
    expect(controller).toMatch(/@Get\('ap\/payments'\)\s*\n\s*@Permissions\('PURCHASING\.READ'\)/);
  });
});
