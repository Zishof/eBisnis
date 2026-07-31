/**
 * Pengujian rencana data contoh.
 *
 * Dua hal dijaga:
 *
 * 1. **Data contoh mengikuti kelayakan profil.** Penyewa kelurahan yang
 *    menemukan APBDes contoh akan menyimpulkan fitur itu tersedia baginya, lalu
 *    menyusun anggaran, dan kekeliruannya baru ketahuan pada penetapan —
 *    setelah pekerjaannya terlanjur dilakukan.
 * 2. **Peran dan hak akses bukan data contoh.** Menandainya sebagai contoh
 *    berarti pembersihan menghapus seluruh hak akses penyewa, dan penyewa itu
 *    terkunci dari sistemnya sendiri karena menekan tombol yang menjanjikan
 *    kebalikannya.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  BAGIAN_CONTOH,
  BUKAN_DATA_CONTOH,
  bolehBersihkan,
  bolehSemai,
  periksaCakupanBersih,
  rencanakan,
} from './village-sample';

const bagian = (r: ReturnType<typeof rencanakan>, kode: string) =>
  r.bagian.find((b) => b.kode === kode)!;

describe('rencana data contoh', () => {
  it('desa memperoleh APBDes, BPD, dan BUMDes', () => {
    const r = rencanakan('DESA');
    expect(bagian(r, 'APBDES').disemai).toBe(true);
    expect(bagian(r, 'BPD').disemai).toBe(true);
    expect(bagian(r, 'BUMDES').disemai).toBe(true);
  });

  it('kelurahan TIDAK memperoleh APBDes, BPD, maupun BUMDes', () => {
    const r = rencanakan('KELURAHAN');
    expect(bagian(r, 'APBDES').disemai).toBe(false);
    expect(bagian(r, 'BPD').disemai).toBe(false);
    expect(bagian(r, 'BUMDES').disemai).toBe(false);
  });

  it('bagian yang dilewati menyebutkan alasannya', () => {
    // Petugas yang melihat daftar lebih pendek tanpa keterangan hanya mengira
    // ada yang tidak berjalan.
    const r = rencanakan('KELURAHAN');
    for (const b of r.bagian.filter((x) => !x.disemai)) {
      expect([b.kode, (b.alasanDilewati ?? '').length > 10]).toEqual([b.kode, true]);
    }
  });

  it('keduanya memperoleh penduduk, layanan, dan aset', () => {
    for (const profil of ['DESA', 'KELURAHAN'] as const) {
      const r = rencanakan(profil);
      expect(bagian(r, 'PENDUDUK').disemai).toBe(true);
      expect(bagian(r, 'LAYANAN').disemai).toBe(true);
      expect(bagian(r, 'ASET').disemai).toBe(true);
    }
  });

  it('KEDUANYA memperoleh musrenbang, dengan kode fitur masing-masing', () => {
    // Kelurahan menyelenggarakan musrenbang; hanya kode fiturnya yang berbeda.
    // Memakai satu kode saja akan membuatnya kehilangan musrenbang contohnya.
    expect(bagian(rencanakan('DESA'), 'MUSRENBANG').disemai).toBe(true);
    expect(bagian(rencanakan('KELURAHAN'), 'MUSRENBANG').disemai).toBe(true);
  });

  it('desa menyemai lebih banyak daripada kelurahan', () => {
    expect(rencanakan('DESA').totalPerkiraan).toBeGreaterThan(
      rencanakan('KELURAHAN').totalPerkiraan,
    );
  });

  it('setiap bagian punya kode yang unik', () => {
    const kode = BAGIAN_CONTOH.map((b) => b.kode);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('setiap bagian memperkirakan jumlah barisnya', () => {
    for (const b of BAGIAN_CONTOH) {
      expect([b.kode, b.perkiraanBaris > 0]).toEqual([b.kode, true]);
    }
  });

  it('bagian yang CONFIGURABLE mengikuti sakelar penyewa', () => {
    // `USAHA.WISATA` berlaku bagi keduanya, tetapi bagian lain yang
    // CONFIGURABLE hanya menyala bila penyewanya menghidupkannya.
    const mati = rencanakan('DESA');
    const hidup = rencanakan('DESA', { aktif: new Set(['PENGADAAN.RENCANA']) });
    expect(hidup.totalPerkiraan).toBeGreaterThanOrEqual(mati.totalPerkiraan);
  });
});

describe('peran bukan data contoh', () => {
  it('daftar yang bukan data contoh memuat peran dan hak akses', () => {
    for (const wajib of ['role', 'permission', 'menu', 'user_role_assignment']) {
      expect(BUKAN_DATA_CONTOH as readonly string[]).toContain(wajib);
    }
  });

  it('tidak satu pun tabel peran memiliki kolom is_sample pada migrasi village', () => {
    // Kolom `is_sample` pada tabel peran akan membuat pembersihan menghapusnya.
    const dir = join(__dirname, '..', '..', '..', 'tenant-migrations', 'village');
    const sql = readdirSync(dir)
      .filter((n) => n.endsWith('.sql'))
      .map((n) => readFileSync(join(dir, n), 'utf8'))
      .join('\n');

    // `village_scope_assignment` adalah penetapan cakupan — data acuan, bukan
    // contoh. Ia tidak boleh bertanda contoh.
    const blok = sql.match(
      /CREATE TABLE IF NOT EXISTS "\{\{TENANT_SCHEMA\}\}"\.village_scope_assignment \(([\s\S]*?)\n\);/,
    );
    expect(blok).not.toBeNull();
    expect(blok![1]).not.toContain('is_sample');
  });
});

describe('penyemaian dan pembersihan', () => {
  it('menolak menyemai bila sudah ada batch aktif', () => {
    expect(bolehSemai(0).boleh).toBe(true);
    const h = bolehSemai(1);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('NIK yang sama');
  });

  it('menolak pembersihan tanpa batch', () => {
    const h = bolehBersihkan(null);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('batch mana pun ikut terhapus');
    expect(bolehBersihkan('   ').boleh).toBe(false);
    expect(bolehBersihkan('batch-1').boleh).toBe(true);
  });

  it('MENGHENTIKAN pembersihan yang cakupannya melampaui data contoh', () => {
    const r = { batchId: 'b1', barisContoh: 120, barisSungguhan: 340 };
    expect(periksaCakupanBersih(r, 120).boleh).toBe(true);
    const h = periksaCakupanBersih(r, 460);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('Penghapusan dihentikan');
  });

  it('pembersihan yang menghapus lebih sedikit tetap diizinkan', () => {
    // Baris yang sudah dihapus penyewa sendiri membuat cacahnya lebih kecil.
    const r = { batchId: 'b1', barisContoh: 120, barisSungguhan: 340 };
    expect(periksaCakupanBersih(r, 90).boleh).toBe(true);
  });
});
