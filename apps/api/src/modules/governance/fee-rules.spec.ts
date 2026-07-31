import {
  APPEAL_WINDOW_DAYS,
  SUSPENSION_THRESHOLD,
  canAppeal,
  computeFee,
  determinePenalty,
  isZeroFee,
  moderationPriority,
  pointsFor,
  screenAgainstPolicies,
  selectSchedule,
  type FeeSchedule,
} from './fee-rules';

const HARI = 24 * 60 * 60 * 1000;
const now = new Date('2026-07-31T00:00:00Z');

const schedule = (over: Partial<FeeSchedule> = {}): FeeSchedule => ({
  feeType: 'PERCENT',
  feeValue: 5,
  maxFeePerOrder: null,
  minFeePerOrder: 0,
  effectiveFrom: new Date(now.getTime() - 30 * HARI),
  effectiveTo: null,
  status: 'ACTIVE',
  sellerId: null,
  categoryId: null,
  ...over,
});

describe('perhitungan biaya marketplace', () => {
  it('menghitung persen dari nilai barang', () => {
    expect(computeFee(schedule({ feeValue: 5 }), 200000)).toBe(10000);
  });

  it('menghitung nominal tetap per pesanan', () => {
    expect(computeFee(schedule({ feeType: 'FIXED_PER_ORDER', feeValue: 2500 }), 200000)).toBe(2500);
  });

  it('membatasi biaya persen pada batas atas', () => {
    // Tanpa batas, biaya persen pada pesanan besar menjadi angka yang tidak
    // sebanding dengan layanan yang diberikan.
    expect(computeFee(schedule({ feeValue: 5, maxFeePerOrder: 50000 }), 10_000_000)).toBe(50000);
  });

  it('menaikkan ke batas bawah', () => {
    expect(computeFee(schedule({ feeValue: 1, minFeePerOrder: 1000 }), 50000)).toBe(1000);
  });

  it('tidak pernah melebihi nilai barang', () => {
    // Penjual tidak boleh menerima pesanan lalu berutang lebih besar daripada
    // nilai yang dijualnya.
    expect(computeFee(schedule({ feeType: 'FIXED_PER_ORDER', feeValue: 999999 }), 50000)).toBe(50000);
  });

  it('menghasilkan nol untuk nilai nol', () => {
    expect(computeFee(schedule(), 0)).toBe(0);
  });

  it('menerima biaya nol sebagai hasil yang sah', () => {
    expect(isZeroFee(computeFee(schedule({ feeValue: 0 }), 200000))).toBe(true);
  });

  it('membatasi persen pada 0 sampai 100', () => {
    expect(computeFee(schedule({ feeValue: 150 }), 200000)).toBe(200000);
    expect(computeFee(schedule({ feeValue: -5 }), 200000)).toBe(0);
  });

  it('menghasilkan rupiah utuh', () => {
    expect(Number.isInteger(computeFee(schedule({ feeValue: 3.7 }), 99999))).toBe(true);
  });
});

describe('pemilihan kebijakan biaya', () => {
  const context = { now, sellerId: 'S1', categoryId: 'C1', baseAmount: 200000 };

  it('memilih kebijakan umum bila hanya itu yang ada', () => {
    const result = selectSchedule([schedule({ feeValue: 5 })], context);
    expect(result?.feeValue).toBe(5);
  });

  it('mendahulukan kebijakan penjual daripada kebijakan umum', () => {
    // Tanpa urutan ini, kesepakatan khusus dengan satu penjual akan tertimpa
    // kebijakan umum yang diperbarui belakangan.
    const result = selectSchedule(
      [schedule({ feeValue: 5 }), schedule({ feeValue: 2, sellerId: 'S1' })],
      context,
    );
    expect(result?.feeValue).toBe(2);
  });

  it('mendahulukan kebijakan penjual daripada kebijakan kategori', () => {
    const result = selectSchedule(
      [schedule({ feeValue: 3, categoryId: 'C1' }), schedule({ feeValue: 2, sellerId: 'S1' })],
      context,
    );
    expect(result?.feeValue).toBe(2);
  });

  it('mendahulukan kebijakan kategori daripada kebijakan umum', () => {
    const result = selectSchedule(
      [schedule({ feeValue: 5 }), schedule({ feeValue: 3, categoryId: 'C1' })],
      context,
    );
    expect(result?.feeValue).toBe(3);
  });

  it('mengabaikan kebijakan penjual lain', () => {
    const result = selectSchedule(
      [schedule({ feeValue: 5 }), schedule({ feeValue: 1, sellerId: 'S9' })],
      context,
    );
    expect(result?.feeValue).toBe(5);
  });

  it('mengabaikan yang belum berlaku', () => {
    const result = selectSchedule(
      [schedule({ feeValue: 9, effectiveFrom: new Date(now.getTime() + HARI) })],
      context,
    );
    expect(result).toBeNull();
  });

  it('mengabaikan yang sudah berakhir', () => {
    const result = selectSchedule(
      [schedule({ feeValue: 9, effectiveTo: new Date(now.getTime() - HARI) })],
      context,
    );
    expect(result).toBeNull();
  });

  it('mengabaikan yang belum aktif', () => {
    expect(selectSchedule([schedule({ status: 'DRAFT' })], context)).toBeNull();
  });

  it('memilih yang paling baru pada kekhususan sama', () => {
    const result = selectSchedule(
      [
        schedule({ feeValue: 5, effectiveFrom: new Date(now.getTime() - 60 * HARI) }),
        schedule({ feeValue: 4, effectiveFrom: new Date(now.getTime() - 10 * HARI) }),
      ],
      context,
    );
    expect(result?.feeValue).toBe(4);
  });

  it('mengembalikan null bila tidak ada yang cocok', () => {
    expect(selectSchedule([], context)).toBeNull();
  });
});

describe('poin dan hukuman pelanggaran', () => {
  it('memberi poin menurut tingkat', () => {
    expect(pointsFor('LOW')).toBe(1);
    expect(pointsFor('CRITICAL')).toBe(12);
  });

  it('menangguhkan penjual seketika pada pelanggaran kritis', () => {
    expect(determinePenalty('CRITICAL', 0).penalty).toBe('SELLER_SUSPENDED');
  });

  it('tidak menangguhkan penjual karena satu pelanggaran ringan', () => {
    // Menangguhkan penjual karena satu kesalahan kecil menghentikan
    // penghidupannya atas hal yang mungkin kekeliruan.
    expect(determinePenalty('LOW', 0).penalty).toBe('WARNING');
  });

  it('menangguhkan setelah poin terakumulasi mencapai ambang', () => {
    const result = determinePenalty('HIGH', SUSPENSION_THRESHOLD - pointsFor('HIGH'));
    expect(result.penalty).toBe('SELLER_SUSPENDED');
    expect(result.reason).toMatch(String(SUSPENSION_THRESHOLD));
  });

  it('menangguhkan produk pada pelanggaran berat sebelum ambang', () => {
    expect(determinePenalty('HIGH', 0).penalty).toBe('LISTING_SUSPENDED');
  });

  it('menarik produk pada pelanggaran menengah', () => {
    expect(determinePenalty('MEDIUM', 0).penalty).toBe('LISTING_REMOVED');
  });

  it('menyertakan alasan pada setiap hukuman', () => {
    for (const s of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const) {
      expect(determinePenalty(s, 0).reason.length).toBeGreaterThan(5);
    }
  });
});

describe('banding pelanggaran', () => {
  it('mengizinkan banding pada pelanggaran terbuka', () => {
    expect(canAppeal('OPEN', new Date(now.getTime() - 2 * HARI), now).ok).toBe(true);
  });

  it('menolak banding kedua', () => {
    expect(canAppeal('APPEALED', new Date(now.getTime() - 2 * HARI), now).ok).toBe(false);
    expect(canAppeal('UPHELD', new Date(now.getTime() - 2 * HARI), now).ok).toBe(false);
  });

  it('menolak setelah batas waktu lewat', () => {
    const result = canAppeal('OPEN', new Date(now.getTime() - (APPEAL_WINDOW_DAYS + 1) * HARI), now);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(String(APPEAL_WINDOW_DAYS));
  });

  it('menerima tepat pada hari terakhir', () => {
    expect(canAppeal('OPEN', new Date(now.getTime() - APPEAL_WINDOW_DAYS * HARI), now).ok).toBe(true);
  });

  it('menolak pada pelanggaran yang sudah ditutup', () => {
    expect(canAppeal('CLOSED', new Date(now.getTime() - HARI), now).ok).toBe(false);
  });
});

describe('penyaring kebijakan produk', () => {
  const policies = [
    { code: 'OBAT_KERAS', policyType: 'PROHIBITED' as const, keywordPatterns: ['sabu', 'ganja'] },
    { code: 'SENJATA', policyType: 'RESTRICTED' as const, keywordPatterns: ['pisau', 'airsoft'] },
  ];

  it('menemukan kata kunci yang cocok', () => {
    const result = screenAgainstPolicies('Jual pisau dapur stainless', policies);
    expect(result.map((m) => m.policyCode)).toContain('SENJATA');
  });

  it('mencocokkan kata utuh, bukan sebagian', () => {
    // Tanpa batas kata, "sabu" akan cocok pada "sabun".
    const result = screenAgainstPolicies('Sabun cuci piring wangi', policies);
    expect(result).toEqual([]);
  });

  it('tidak peduli huruf besar kecil', () => {
    expect(screenAgainstPolicies('PISAU LIPAT', policies).length).toBe(1);
  });

  it('melaporkan kata kunci yang memicunya', () => {
    // Peninjau perlu tahu apa yang dicurigai, bukan hanya bahwa ada yang
    // dicurigai.
    const result = screenAgainstPolicies('pisau cukur', policies);
    expect(result[0].matchedKeyword).toBe('pisau');
  });

  it('tidak menemukan apa pun pada teks bersih', () => {
    expect(screenAgainstPolicies('Kaos polos katun combed', policies)).toEqual([]);
  });

  it('melaporkan beberapa kebijakan sekaligus', () => {
    const result = screenAgainstPolicies('jual pisau dan ganja', policies);
    expect(result.length).toBe(2);
  });

  it('mengabaikan pola kosong', () => {
    const result = screenAgainstPolicies('apa saja', [
      { code: 'X', policyType: 'PROHIBITED', keywordPatterns: ['', '  '] },
    ]);
    expect(result).toEqual([]);
  });
});

describe('prioritas antrean moderasi', () => {
  it('mendahulukan produk terlarang', () => {
    expect(moderationPriority('AUTOMATIC', 'PROHIBITED')).toBe(1);
  });

  it('mendahulukan laporan orang daripada penyaring otomatis', () => {
    // Seseorang meluangkan waktu melaporkannya, dan penyaring lebih sering
    // keliru.
    expect(moderationPriority('REPORTED', null)).toBeLessThan(
      moderationPriority('AUTOMATIC', null),
    );
  });

  it('menempatkan pemeriksaan berkala paling akhir', () => {
    expect(moderationPriority('ROUTINE', null)).toBeGreaterThan(
      moderationPriority('AUTOMATIC', null),
    );
  });
});
