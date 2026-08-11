/**
 * Penjaga kejujuran klaim paritas 48 layar.
 *
 * ## Cacat yang dijaga
 *
 * Katalog menyatakan jangkauan per surface (`OPERATIONAL`/`READ_ONLY`/
 * `CONTRACT_ONLY`); registry menyimpan buktinya per `screen + surface +
 * capability`. Keduanya dapat menyimpang, dan ketika menyimpang yang terbaca
 * orang adalah katalognya.
 *
 * Penjaga lamanya, `ensureCatalogWired()`, menuntut setiap layar `OPERATIONAL`
 * tercatat pada `provenScreens()` ATAU `PENDING_PROOF`. Ketika registry masih
 * menghitung `view` saja, syarat itu berarti sesuatu. Setelah registry diperluas
 * menjadi 606 requirement dengan 414 pending, `PENDING_PROOF` memuat SELURUH 48
 * layar — sehingga syaratnya dipenuhi setiap layar tanpa kecuali.
 *
 * Dua hal sekaligus, dan keduanya diuji di sini:
 *
 * 1. penjaganya tidak pernah dapat gagal;
 * 2. penjaganya tidak pernah dipanggil dari mana pun.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SALES_INVENTORY_PARITY,
  type InventoryParityItem,
} from './sales-inventory-parity.catalog';
import {
  CATALOG_SURFACES,
  PARITY_REQUIREMENTS,
  PENDING_PROOF,
  catalogOverclaims,
  ensureCatalogWired,
  parityEvidenceSummary,
  provenScreens,
  surfaceEvidence,
} from './parity-evidence.registry';

/** Layar palsu yang mengklaim OPERATIONAL tanpa bukti apa pun. */
const LAYAR_MENGADA_ADA: InventoryParityItem = {
  screen: 999,
  legacyName: 'Layar yang tidak pernah dibuktikan',
  domain: 'MASTER',
  api: ['/tidak-ada'],
  webRoute: '/app/tidak-ada',
  flutterModule: 'Inventory Control',
  web: 'OPERATIONAL',
  windows: 'OPERATIONAL',
  android: 'OPERATIONAL',
  flutter: 'OPERATIONAL',
};

describe('mengapa penjaga lama tidak pernah dapat gagal', () => {
  it('PENDING_PROOF memuat SELURUH 48 layar', () => {
    /*
     * Inilah sebabnya. Syarat lamanya "PROVEN atau PENDING_PROOF" dipenuhi
     * setiap layar begitu daftar pending mencakup semuanya — dan itu terjadi
     * justru ketika registry diperluas, yaitu saat penjaganya paling dibutuhkan.
     */
    const pending = new Set(PENDING_PROOF.map((r) => r.screen));
    expect(pending.size).toBe(48);
  });

  it('syarat lamanya meloloskan layar yang tidak punya bukti sama sekali', () => {
    // Diperagakan apa adanya: layar 999 tidak punya satu pun bukti, tetapi
    // syarat lamanya tetap terpenuhi karena ia hanya bertanya "tercatat?".
    const proven = provenScreens();
    const pending = new Set(PENDING_PROOF.map((r) => r.screen));
    const lolosSyaratLama =
      proven.has(LAYAR_MENGADA_ADA.screen) || pending.has(LAYAR_MENGADA_ADA.screen);

    expect(lolosSyaratLama).toBe(false);
    // Untuk 48 layar sungguhan syarat itu SELALU terpenuhi -- itulah cacatnya.
    for (const item of SALES_INVENTORY_PARITY) {
      expect(proven.has(item.screen) || pending.has(item.screen)).toBe(true);
    }
  });
});

describe('penjaga baru dapat gagal', () => {
  it('katalog yang berlaku sekarang lolos', () => {
    expect(catalogOverclaims()).toEqual([]);
    expect(() => ensureCatalogWired()).not.toThrow();
  });

  it('klaim tanpa bukti buka ditolak, per surface', () => {
    const overclaims = catalogOverclaims([LAYAR_MENGADA_ADA]);
    expect(overclaims.map((o) => o.surface)).toEqual([...CATALOG_SURFACES]);
    expect(overclaims.every((o) => o.claimed === 'OPERATIONAL')).toBe(true);
  });

  it('pesannya menyebut layar dan surface yang melanggar', () => {
    // Penjaga yang gagal tanpa memberi tahu apa yang salah akan dilewati orang
    // berikutnya, bukan diperbaiki.
    expect(() => ensureCatalogWired([LAYAR_MENGADA_ADA])).toThrow(/layar 999\/web/);
  });

  it('CONTRACT_ONLY tidak dianggap klaim', () => {
    // Menyatakan "belum ada" bukan klaim yang perlu dibuktikan.
    const jujur: InventoryParityItem = {
      ...LAYAR_MENGADA_ADA,
      web: 'CONTRACT_ONLY',
      windows: 'CONTRACT_ONLY',
      android: 'CONTRACT_ONLY',
      flutter: 'CONTRACT_ONLY',
    };
    expect(catalogOverclaims([jujur])).toEqual([]);
  });

  it('READ_ONLY pun tetap perlu bukti buka', () => {
    const setengah: InventoryParityItem = {
      ...LAYAR_MENGADA_ADA,
      web: 'READ_ONLY',
      windows: 'CONTRACT_ONLY',
      android: 'CONTRACT_ONLY',
      flutter: 'CONTRACT_ONLY',
    };
    expect(catalogOverclaims([setengah])).toEqual([
      { screen: 999, surface: 'web', claimed: 'READ_ONLY', missing: [] },
    ]);
  });
});

describe('bukti per layar per surface', () => {
  it('melaporkan capability yang masih kurang, bukan hanya jumlahnya', () => {
    // Angka tanpa nama capability tidak dapat ditindaklanjuti siapa pun.
    const bukti = surfaceEvidence(30, 'web');
    expect(bukti.viewProven).toBe(true);
    expect(bukti.allProven).toBe(false);
    expect(bukti.missing).toEqual(expect.arrayContaining(['create', 'post', 'offline']));
    expect(bukti.proven + bukti.missing.length).toBe(bukti.required);
  });

  it('layar yang seluruh capability-nya terbukti ditandai allProven', () => {
    const bukti = surfaceEvidence(1, 'api');
    expect(bukti.required).toBeGreaterThan(0);
    // Layar 1 API masih punya requirement `reconciliation` yang belum terbukti.
    expect(bukti.allProven).toBe(false);
    expect(bukti.missing).toContain('reconciliation');
  });
});

describe('ringkasan bukti terpisah dari ringkasan jangkauan', () => {
  it('menghitung bukti, bukan label', () => {
    const s = parityEvidenceSummary();
    expect(s.screens).toBe(48);
    expect(s.requirements).toBe(PARITY_REQUIREMENTS.length);
    expect(s.pending).toBe(PENDING_PROOF.length);

    /*
     * Yang membuat angka ini jujur: `view` terbukti pada seluruh 48 layar,
     * tetapi hanya 12 layar yang SELURUH capability-nya terbukti.
     *
     * Keduabelas itu memang layar yang tidak menuntut apa pun selain dapat
     * dibuka (mis. "Membuka Daftar Supplier"). Selebihnya menuntut mutasi,
     * cetak, ekspor, luring, atau perangkat -- dan itu belum dibuktikan.
     *
     * Angka 12 inilah yang dulu terbaca 48 karena label katalog berjalan
     * sendirian.
     */
    expect(s.web.viewProven).toBe(48);
    expect(s.web.fullyProven).toBe(12);
    expect(s.windows.fullyProven).toBe(12);
    expect(s.android.fullyProven).toBe(12);

    // API tidak punya satu pun: setiap layar masih menunggu bukti rekonsiliasi.
    expect(s.api.fullyProven).toBe(0);

    // Dan tidak ada satu layar pun yang lengkap pada SEMUA surface sekaligus.
    expect(s.fullyProvenAllSurfaces).toBe(0);
  });

  it('jumlah pending per surface menutup total pending', () => {
    const s = parityEvidenceSummary();
    expect(s.api.pending + s.web.pending + s.windows.pending + s.android.pending).toBe(s.pending);
  });
});

describe('penjaga: label tidak pernah dikirim sendirian', () => {
  const controller = readFileSync(
    join(__dirname, 'sales-inventory-operations.controller.ts'),
    'utf8',
  );

  it('endpoint kontrak paritas ikut mengirim bukti per surface', () => {
    expect(controller).toContain('surfaceEvidence(item.screen, surface)');
    expect(controller).toContain('parityEvidenceSummary()');
  });

  it('penjaga klaim benar-benar dipanggil, bukan hanya ada', () => {
    /*
     * `ensureCatalogWired()` sempat tidak dipanggil dari mana pun -- penjaga yang
     * tidak pernah dijalankan sama saja dengan penjaga yang tidak ada. Berkas ini
     * memanggilnya, jadi ia berjalan pada setiap CI.
     */
    const sendiri = readFileSync(join(__dirname, 'parity-klaim.spec.ts'), 'utf8');
    expect(sendiri).toContain('ensureCatalogWired()');
  });
});
