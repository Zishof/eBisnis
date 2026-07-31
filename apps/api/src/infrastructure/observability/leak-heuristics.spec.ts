import {
  FLOOR_GROWTH_REPRODUCED,
  FLOOR_GROWTH_SUSPICIOUS,
  MIN_SAMPLES,
  analyzeHandles,
  analyzeMemory,
  anomalyFingerprint,
  linearSlopePerHour,
  percentile,
  type MemorySample,
} from './leak-heuristics';

const MB = 1024 * 1024;
const MENIT = 60 * 1000;
const mulai = new Date('2026-07-31T00:00:00Z').getTime();

/** Menyusun rangkaian sampel dengan pola dasar dan puncak yang ditentukan. */
function samples(
  count: number,
  fn: (i: number) => Partial<MemorySample>,
  intervalMenit = 5,
): MemorySample[] {
  return Array.from({ length: count }, (_, i) => ({
    capturedAt: new Date(mulai + i * intervalMenit * MENIT),
    heapUsed: 100 * MB,
    rss: 200 * MB,
    gcCount: i,
    activeHandles: 20,
    ...fn(i),
  }));
}

describe('bukti belum cukup', () => {
  it('menolak menyimpulkan dari sampel yang sedikit', () => {
    // Menyatakan sesuatu yang tidak diketahui lebih merugikan daripada mengaku
    // belum tahu.
    const result = analyzeMemory(samples(5, () => ({})));
    expect(result.verdict).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.reason).toMatch(String(MIN_SAMPLES));
  });

  it('menolak menyimpulkan dari jendela yang pendek', () => {
    // Dua puluh sampel dalam sepuluh menit tetap tidak cukup.
    const result = analyzeMemory(samples(20, () => ({}), 0.5));
    expect(result.verdict).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('menolak daftar kosong', () => {
    expect(analyzeMemory([]).verdict).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('melaporkan berapa yang sudah terkumpul', () => {
    const result = analyzeMemory(samples(5, () => ({})));
    expect(result.evidence.sampleCount).toBe(5);
  });
});

describe('memori yang naik tetapi tidak bocor', () => {
  it('menyatakan normal bila dasar setelah GC tetap dan tidak ada kecenderungan naik', () => {
    // RAM naik-turun adalah hal paling biasa pada proses Node yang sehat.
    // Pola gigi gergaji yang berulang persis: dasarnya tetap, dan kemiringan
    // keseluruhannya nol.
    const result = analyzeMemory(
      samples(24, (i) => ({ heapUsed: (100 + (i % 4) * 30) * MB })),
    );
    expect(['NORMAL', 'TEMPORARY_SPIKE']).toContain(result.verdict);
    // Yang penting: tidak dinyatakan bocor.
    expect(result.verdict).not.toBe('SUSPECTED_LEAK');
    expect(result.verdict).not.toBe('LEAK_REPRODUCED');
  });

  it('tidak menyatakan normal ketika dasarnya sebenarnya tumbuh', () => {
    // Celah yang ditemukan saat menulis test: rasio antara 1,1 dan ambang
    // curiga sempat jatuh ke NORMAL padahal dasarnya jelas tumbuh.
    const result = analyzeMemory(samples(24, (i) => ({ heapUsed: (100 + i) * MB })));
    expect(result.verdict).not.toBe('NORMAL');
    expect(result.evidence.floorGrowthRatio).toBeGreaterThan(1);
  });

  it('menyatakan lonjakan sesaat bila puncak naik tetapi dasar tidak', () => {
    // Yang bertambah adalah beban sesaat, bukan memori yang tertahan.
    const result = analyzeMemory(
      samples(24, (i) => ({
        // Dasar tetap 100 MB; puncaknya makin tinggi.
        heapUsed: (i % 3 === 0 ? 100 : 100 + i * 4) * MB,
      })),
    );
    expect(['TEMPORARY_SPIKE', 'NORMAL']).toContain(result.verdict);
    expect(result.verdict).not.toBe('SUSPECTED_LEAK');
  });
});

describe('kecurigaan kebocoran', () => {
  it('mencurigai bila dasar tumbuh melewati ambang', () => {
    // Dasar separuh awal 100 MB, separuh akhir 100 + 12*4 = 148 MB.
    // Rasionya 1,48 — jelas melewati ambang 1,25, tetapi belum mencapai 2,0
    // yang berarti terbukti.
    const result = analyzeMemory(
      samples(24, (i) => ({ heapUsed: (100 + i * 4) * MB })),
    );
    expect(result.verdict).toBe('SUSPECTED_LEAK');
    expect(result.evidence.floorGrowthRatio).toBeGreaterThanOrEqual(FLOOR_GROWTH_SUSPICIOUS);
  });

  it('menyatakan terbukti bila dasar tumbuh berlipat', () => {
    const result = analyzeMemory(
      samples(24, (i) => ({ heapUsed: (100 + i * 10) * MB })),
    );
    expect(result.verdict).toBe('LEAK_REPRODUCED');
    expect(result.evidence.floorGrowthRatio).toBeGreaterThanOrEqual(FLOOR_GROWTH_REPRODUCED);
  });

  it('menyebut angka dasarnya pada alasan, bukan sekadar menyimpulkan', () => {
    const result = analyzeMemory(samples(24, (i) => ({ heapUsed: (100 + i * 10) * MB })));
    expect(result.reason).toMatch(/MB|GB/);
    expect(result.reason).toMatch(/GC/);
  });

  it('menyertakan bukti yang dapat diperiksa ulang', () => {
    const result = analyzeMemory(samples(24, (i) => ({ heapUsed: (100 + i * 10) * MB })));
    expect(result.evidence.postGcFloorStart).toBeGreaterThan(0);
    expect(result.evidence.postGcFloorEnd).toBeGreaterThan(result.evidence.postGcFloorStart!);
    expect(result.evidence.heapSlopePerHour).toBeGreaterThan(0);
  });
});

describe('kapasitas dibedakan dari kebocoran', () => {
  it('menyatakan batas kapasitas ketika hampir penuh', () => {
    // Hampir kehabisan adalah keadaan berbeda dari bocor, dan lebih mendesak.
    const limit = 512 * MB;
    const result = analyzeMemory(
      samples(24, () => ({ heapUsed: 480 * MB })),
      limit,
    );
    expect(result.verdict).toBe('CAPACITY_LIMIT');
    expect(result.reason).toMatch(/kapasitas/);
  });

  it('mendahulukan kapasitas daripada kebocoran', () => {
    // Keduanya benar, tetapi yang mendesak disebut lebih dulu.
    const limit = 512 * MB;
    const result = analyzeMemory(
      samples(24, (i) => ({ heapUsed: (200 + i * 12) * MB })),
      limit,
    );
    expect(result.verdict).toBe('CAPACITY_LIMIT');
  });

  it('menyatakan pemakaian tinggi bila besar tetapi stabil', () => {
    const result = analyzeMemory(samples(24, () => ({ heapUsed: 350 * MB })), 512 * MB);
    expect(result.verdict).toBe('HIGH_USAGE');
  });

  it('tidak menyimpulkan kapasitas tanpa mengetahui batasnya', () => {
    // Tanpa batas, 2 GB tidak berarti apa-apa.
    const result = analyzeMemory(samples(24, () => ({ heapUsed: 2048 * MB })), null);
    expect(result.verdict).not.toBe('CAPACITY_LIMIT');
  });
});

describe('kemiringan garis', () => {
  it('menghitung kenaikan per jam', () => {
    const points = Array.from({ length: 13 }, (_, i) => ({
      t: mulai + i * 5 * MENIT,
      v: i * 10,
    }));
    // 10 satuan tiap 5 menit = 120 satuan per jam.
    expect(Math.round(linearSlopePerHour(points)!)).toBe(120);
  });

  it('tidak didominasi satu lonjakan di ujung', () => {
    // Selisih ujung akan menghasilkan angka yang jauh lebih besar.
    const datar = Array.from({ length: 20 }, (_, i) => ({ t: mulai + i * MENIT, v: 100 }));
    datar[19].v = 10000;
    const slope = linearSlopePerHour(datar)!;
    const selisihUjung = ((10000 - 100) / 19) * 60;
    expect(slope).toBeLessThan(selisihUjung);
  });

  it('menghasilkan nol untuk deret datar', () => {
    const datar = Array.from({ length: 10 }, (_, i) => ({ t: mulai + i * MENIT, v: 500 }));
    expect(linearSlopePerHour(datar)).toBe(0);
  });

  it('mengembalikan null untuk titik yang terlalu sedikit', () => {
    expect(linearSlopePerHour([{ t: 1, v: 1 }])).toBeNull();
  });

  it('mengembalikan null ketika seluruh waktunya sama', () => {
    expect(linearSlopePerHour([{ t: 1, v: 1 }, { t: 1, v: 2 }])).toBeNull();
  });
});

describe('pertumbuhan pegangan aktif', () => {
  it('mencurigai pertumbuhan yang konsisten', () => {
    // Penyebab kebocoran yang paling sering, dan paling mudah diperbaiki
    // begitu ketahuan.
    const result = analyzeHandles(samples(24, (i) => ({ activeHandles: 20 + i * 5 })));
    expect(result.suspicious).toBe(true);
    expect(result.reason).toMatch(/pendengar|timer|koneksi/);
  });

  it('tidak mencurigai lonjakan yang terjadi sekali', () => {
    const data = samples(24, () => ({ activeHandles: 20 }));
    data[12].activeHandles = 200;
    expect(analyzeHandles(data).suspicious).toBe(false);
  });

  it('tidak mencurigai pegangan yang stabil', () => {
    expect(analyzeHandles(samples(24, () => ({ activeHandles: 20 }))).suspicious).toBe(false);
  });

  it('tidak menyimpulkan dari sampel yang sedikit', () => {
    expect(analyzeHandles(samples(3, (i) => ({ activeHandles: 20 + i * 100 }))).suspicious).toBe(
      false,
    );
  });
});

describe('persentil', () => {
  it('menghitung nilai tengah', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it('menghitung ekor', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(values, 95)).toBe(95);
    expect(percentile(values, 99)).toBe(99);
  });

  it('tidak mengarang nilai di antara sampel', () => {
    // Metode nearest-rank mengembalikan nilai yang benar-benar teramati.
    const values = [10, 20, 30];
    expect([10, 20, 30]).toContain(percentile(values, 75));
  });

  it('menangani daftar kosong', () => {
    expect(percentile([], 95)).toBe(0);
  });

  it('menangani satu nilai', () => {
    expect(percentile([42], 99)).toBe(42);
  });

  it('tidak mengubah larik masukan', () => {
    const values = [3, 1, 2];
    percentile(values, 50);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe('sidik anomali', () => {
  it('menyatukan anomali yang sama', () => {
    expect(anomalyFingerprint('SLOW_ROUTE', '/api/v1/orders', 'api')).toBe(
      anomalyFingerprint('SLOW_ROUTE', '/api/v1/orders', 'api'),
    );
  });

  it('memisahkan rute yang berbeda', () => {
    expect(anomalyFingerprint('SLOW_ROUTE', '/a', 'api')).not.toBe(
      anomalyFingerprint('SLOW_ROUTE', '/b', 'api'),
    );
  });

  it('memisahkan jenis anomali yang berbeda', () => {
    expect(anomalyFingerprint('SLOW_ROUTE', '/a', 'api')).not.toBe(
      anomalyFingerprint('MEMORY_GROWTH', '/a', 'api'),
    );
  });
});
