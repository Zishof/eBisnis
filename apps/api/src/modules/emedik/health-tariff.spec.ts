/**
 * Pengujian aturan tarif berversi dan cakupan penjamin.
 *
 * Yang dijaga paling ketat: tarif dipilih menurut TANGGAL LAYANAN, tarif yang
 * ambigu menghentikan perhitungan alih-alih memilih salah satunya, dan tarif
 * yang tidak ada TIDAK ditaksir.
 */

import {
  bolehAktifkanVersi,
  hitungTanggungan,
  periksaTumpangTindih,
  pilihTarif,
  type BarisTarif,
  type KunciTarif,
  type VersiTarif,
} from './health-tariff';

const tarif = (over: Partial<BarisTarif> = {}): BarisTarif => ({
  id: 't1',
  paymentMethod: 'INA_CBG',
  regionCode: 'REG-1',
  facilityClass: 'C',
  serviceClass: null,
  casemixGroup: null,
  casemixSeverity: null,
  amount: 1000000,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  versionId: 'v1',
  ...over,
});

const kunci = (over: Partial<KunciTarif> = {}): KunciTarif => ({
  paymentMethod: 'INA_CBG',
  regionCode: 'REG-1',
  facilityClass: 'C',
  serviceClass: 'CLASS_3',
  casemixGroup: 'A-4-13-I',
  casemixSeverity: 'I',
  serviceDate: '2026-06-15',
  ...over,
});

const versi = (over: Partial<VersiTarif> = {}): VersiTarif => ({
  id: 'v1',
  code: 'INA-CBG-2026',
  regulationReference: 'PMK 3/2026',
  sourceFile: 'inacbg-2026.csv',
  sourceHash: 'sha256:abc',
  importedBy: 'user-a',
  approvedBy: null,
  rowCount: 1200,
  ...over,
});

describe('pemilihan tarif', () => {
  it('tarif yang berlaku terpilih', () => {
    const h = pilihTarif([tarif()], kunci());
    expect(h.found).toBe(true);
    expect(h.tariff?.amount).toBe(1000000);
  });

  it('tarif yang belum ada TIDAK ditaksir', () => {
    /*
     * Menaksirnya akan menghasilkan angka yang tampak resmi lalu dipakai
     * menagih orang.
     */
    const h = pilihTarif([], kunci());
    expect(h.found).toBe(false);
    expect(h.tariff).toBeUndefined();
    expect(h.message).toContain('belum tersedia');
    expect(h.message).toContain('menagih orang');
  });

  it('tarif dipilih menurut TANGGAL LAYANAN, bukan tanggal hari ini', () => {
    // Pasien yang dirawat Maret dan klaimnya diajukan Mei tetap memakai tarif
    // Maret.
    const lama = tarif({ id: 'lama', amount: 800000, effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31' });
    const baru = tarif({ id: 'baru', amount: 1000000, effectiveFrom: '2026-01-01' });
    const h = pilihTarif([lama, baru], kunci({ serviceDate: '2025-03-10' }));
    expect(h.tariff?.id).toBe('lama');
    expect(h.tariff?.amount).toBe(800000);
  });

  it('tanggal layanan sesudah tarif berakhir tidak memakai tarif itu', () => {
    const h = pilihTarif(
      [tarif({ effectiveTo: '2026-03-31' })],
      kunci({ serviceDate: '2026-06-15' }),
    );
    expect(h.found).toBe(false);
  });

  it('tanggal layanan tepat pada hari mulai berlaku sudah memakai tarifnya', () => {
    const h = pilihTarif([tarif({ effectiveFrom: '2026-06-15' })], kunci({ serviceDate: '2026-06-15' }));
    expect(h.found).toBe(true);
  });

  it('tanggal layanan tepat pada hari terakhir masih memakai tarifnya', () => {
    const h = pilihTarif(
      [tarif({ effectiveTo: '2026-06-15' })],
      kunci({ serviceDate: '2026-06-15' }),
    );
    expect(h.found).toBe(true);
  });

  it('yang lebih KHUSUS menang atas yang umum', () => {
    const umum = tarif({ id: 'umum', amount: 900000 });
    const khusus = tarif({ id: 'khusus', amount: 1500000, casemixSeverity: 'I' });
    expect(pilihTarif([umum, khusus], kunci()).tariff?.id).toBe('khusus');
  });

  it('bagian yang kosong pada baris tarif berarti berlaku bagi semua', () => {
    // Dibalik, tarif umum tidak akan pernah terpilih.
    const h = pilihTarif([tarif({ casemixGroup: null })], kunci({ casemixGroup: 'X-9-99-III' }));
    expect(h.found).toBe(true);
  });

  it('bagian yang TERISI harus cocok persis', () => {
    const h = pilihTarif([tarif({ casemixGroup: 'A-4-13-I' })], kunci({ casemixGroup: 'B-1-01-II' }));
    expect(h.found).toBe(false);
  });

  it('wilayah yang berbeda tidak dipakai', () => {
    expect(pilihTarif([tarif({ regionCode: 'REG-2' })], kunci()).found).toBe(false);
  });

  it('kelas fasilitas yang berbeda tidak dipakai', () => {
    expect(pilihTarif([tarif({ facilityClass: 'A' })], kunci()).found).toBe(false);
  });

  it('metode pembayaran yang berbeda tidak dipakai', () => {
    expect(pilihTarif([tarif({ paymentMethod: 'CAPITATION' })], kunci()).found).toBe(false);
  });

  it('dua tarif yang sama khususnya menghentikan perhitungan, bukan memilih satu', () => {
    /*
     * Memilih yang pertama berarti membiarkan urutan baris menentukan tagihan
     * pasien.
     */
    const a = tarif({ id: 'a', amount: 1000000 });
    const b = tarif({ id: 'b', amount: 2000000 });
    const h = pilihTarif([a, b], kunci());
    expect(h.found).toBe(false);
    expect(h.ambiguous).toHaveLength(2);
    expect(h.message).toContain('urutan baris');
  });

  it('ambiguitas menyebut berapa banyak yang bentrok', () => {
    const h = pilihTarif([tarif({ id: 'a' }), tarif({ id: 'b' }), tarif({ id: 'c' })], kunci());
    expect(h.message).toContain('3 tarif');
  });

  it('tarif yang lebih khusus mengalahkan ambiguitas di tingkat umum', () => {
    const h = pilihTarif(
      [tarif({ id: 'a' }), tarif({ id: 'b' }), tarif({ id: 'c', casemixSeverity: 'I' })],
      kunci(),
    );
    expect(h.found).toBe(true);
    expect(h.tariff?.id).toBe('c');
  });
});

describe('tumpang tindih tanggal', () => {
  it('rentang yang tidak bersinggungan diterima', () => {
    const h = periksaTumpangTindih({
      baru: { ...tarif({ effectiveFrom: '2027-01-01' }) },
      existing: [tarif({ effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31' })],
    });
    expect(h.allowed).toBe(true);
  });

  it('rentang yang bersinggungan DITOLAK', () => {
    const h = periksaTumpangTindih({
      baru: { ...tarif({ effectiveFrom: '2026-06-01' }) },
      existing: [tarif({ effectiveFrom: '2026-01-01' })],
    });
    expect(h.allowed).toBe(false);
    expect(h.conflicts).toHaveLength(1);
  });

  it('penolakannya menyuruh menutup versi lama lebih dahulu', () => {
    const h = periksaTumpangTindih({
      baru: { ...tarif({ effectiveFrom: '2026-06-01' }) },
      existing: [tarif({ effectiveFrom: '2026-01-01' })],
    });
    expect(h.message).toContain('Tutup versi lama');
  });

  it('bersinggungan tepat satu hari pun ditolak', () => {
    const h = periksaTumpangTindih({
      baru: { ...tarif({ effectiveFrom: '2026-12-31' }) },
      existing: [tarif({ effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31' })],
    });
    expect(h.allowed).toBe(false);
  });

  it('kunci yang berbeda tidak dianggap bertumpang tindih', () => {
    const h = periksaTumpangTindih({
      baru: { ...tarif({ regionCode: 'REG-2' }) },
      existing: [tarif({ regionCode: 'REG-1' })],
    });
    expect(h.allowed).toBe(true);
  });

  it('kelas layanan yang berbeda tidak dianggap bertumpang tindih', () => {
    const h = periksaTumpangTindih({
      baru: { ...tarif({ serviceClass: 'CLASS_1' }) },
      existing: [tarif({ serviceClass: 'CLASS_3' })],
    });
    expect(h.allowed).toBe(true);
  });

  it('tanggal berakhir yang mendahului tanggal mulai ditolak', () => {
    const h = periksaTumpangTindih({
      baru: { ...tarif({ effectiveFrom: '2026-06-01', effectiveTo: '2026-01-01' }) },
      existing: [],
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('mendahului');
  });

  it('tanggal yang tidak sah ditolak', () => {
    const h = periksaTumpangTindih({
      baru: { ...tarif({ effectiveFrom: 'bukan-tanggal' }) },
      existing: [],
    });
    expect(h.allowed).toBe(false);
  });
});

describe('aktivasi versi tarif', () => {
  it('versi yang lengkap boleh diaktifkan orang kedua', () => {
    expect(bolehAktifkanVersi({ versi: versi(), approverId: 'user-b' }).allowed).toBe(true);
  });

  it('versi tanpa dasar peraturan DITOLAK', () => {
    /*
     * Nomor peraturan yang keliru akan disalin ke dokumen klaim, dan dokumen
     * klaim yang menyebut peraturan yang tidak berlaku akan dikembalikan.
     */
    const h = bolehAktifkanVersi({
      versi: versi({ regulationReference: null }),
      approverId: 'user-b',
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('dikembalikan');
  });

  it('versi tanpa berkas sumber DITOLAK', () => {
    expect(
      bolehAktifkanVersi({ versi: versi({ sourceFile: null }), approverId: 'user-b' }).allowed,
    ).toBe(false);
  });

  it('versi tanpa sidik jari berkas DITOLAK', () => {
    const h = bolehAktifkanVersi({ versi: versi({ sourceHash: null }), approverId: 'user-b' });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('diketik dari ingatan');
  });

  it('versi KOSONG ditolak', () => {
    // Mengaktifkannya akan menghentikan seluruh perhitungan tarif tanpa ada
    // yang tahu sebabnya.
    const h = bolehAktifkanVersi({ versi: versi({ rowCount: 0 }), approverId: 'user-b' });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('kosong');
  });

  it('yang mengimpor TIDAK menyetujuinya sendiri', () => {
    const h = bolehAktifkanVersi({ versi: versi({ importedBy: 'user-a' }), approverId: 'user-a' });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('dua langkah');
  });

  it('penolakannya menyebut akibatnya: satu orang mengubah seluruh tagihan', () => {
    const h = bolehAktifkanVersi({ versi: versi({ importedBy: 'user-a' }), approverId: 'user-a' });
    expect(h.message).toContain('seluruh tagihan rumah sakit');
  });
});

describe('tanggungan penjamin', () => {
  const cakupan = {
    payerType: 'BPJS' as const,
    coveragePercent: 100,
    ceilingAmount: null,
    deductibleAmount: null,
    requiresReferral: false,
    requiresPreAuthorization: false,
  };

  it('tanggungan penuh membuat bagian pasien nol', () => {
    const h = hitungTanggungan({ totalAmount: 1000000, coverage: cakupan });
    expect(h.payerAmount).toBe(1000000);
    expect(h.patientAmount).toBe(0);
  });

  it('tanggungan sebagian dibagi menurut persentasenya', () => {
    const h = hitungTanggungan({
      totalAmount: 1000000,
      coverage: { ...cakupan, coveragePercent: 80 },
    });
    expect(h.payerAmount).toBe(800000);
    expect(h.patientAmount).toBe(200000);
  });

  it('pembulatannya MEMIHAK PASIEN', () => {
    /*
     * Sisa satu rupiah menjadi tanggungan penjamin. Selisih itu tidak berarti
     * bagi penjamin; bagi loket pendaftaran ia berarti uang kembalian yang
     * tidak ada.
     */
    const h = hitungTanggungan({ totalAmount: 1001, coverage: { ...cakupan, coveragePercent: 50 } });
    expect(h.payerAmount).toBe(501);
    expect(h.patientAmount).toBe(500);
  });

  it('batas atas tanggungan dihormati', () => {
    const h = hitungTanggungan({
      totalAmount: 10000000,
      coverage: { ...cakupan, ceilingAmount: 5000000 },
    });
    expect(h.payerAmount).toBe(5000000);
    expect(h.patientAmount).toBe(5000000);
    expect(h.message).toContain('Batas atas');
  });

  it('potongan awal ditanggung pasien lebih dahulu', () => {
    const h = hitungTanggungan({
      totalAmount: 1000000,
      coverage: { ...cakupan, deductibleAmount: 100000 },
    });
    expect(h.payerAmount).toBe(900000);
    expect(h.patientAmount).toBe(100000);
  });

  it('potongan awal yang melebihi tagihan tidak membuat pasien membayar lebih', () => {
    const h = hitungTanggungan({
      totalAmount: 50000,
      coverage: { ...cakupan, deductibleAmount: 100000 },
    });
    expect(h.patientAmount).toBe(50000);
    expect(h.payerAmount).toBe(0);
  });

  it('rujukan yang belum ada MENAHAN tanggungan', () => {
    const h = hitungTanggungan({
      totalAmount: 1000000,
      coverage: { ...cakupan, requiresReferral: true },
      hasValidReferral: false,
    });
    expect(h.blocked).toBe(true);
    expect(h.payerAmount).toBe(0);
    expect(h.patientAmount).toBe(1000000);
  });

  it('dan menyatakan bahwa itu SEMENTARA, bukan keputusan akhir', () => {
    // Perbedaannya penting: yang pertama dapat diperbaiki dengan melengkapi
    // rujukan.
    const h = hitungTanggungan({
      totalAmount: 1000000,
      coverage: { ...cakupan, requiresReferral: true },
    });
    expect(h.message).toContain('Sementara ini');
    expect(h.message).toContain('hitung ulang');
  });

  it('rujukan yang ada memulihkan tanggungan', () => {
    const h = hitungTanggungan({
      totalAmount: 1000000,
      coverage: { ...cakupan, requiresReferral: true },
      hasValidReferral: true,
    });
    expect(h.blocked).toBe(false);
    expect(h.payerAmount).toBe(1000000);
  });

  it('persetujuan awal yang belum ada menahan pula', () => {
    const h = hitungTanggungan({
      totalAmount: 1000000,
      coverage: { ...cakupan, requiresPreAuthorization: true },
    });
    expect(h.blocked).toBe(true);
    expect(h.reasons).toHaveLength(1);
  });

  it('dua syarat yang kurang disebutkan keduanya', () => {
    const h = hitungTanggungan({
      totalAmount: 1000000,
      coverage: { ...cakupan, requiresReferral: true, requiresPreAuthorization: true },
    });
    expect(h.reasons).toHaveLength(2);
  });

  it('tanggungan nol persen membuat seluruhnya tanggungan pasien', () => {
    const h = hitungTanggungan({
      totalAmount: 1000000,
      coverage: { ...cakupan, coveragePercent: 0 },
    });
    expect(h.payerAmount).toBe(0);
    expect(h.patientAmount).toBe(1000000);
    expect(h.blocked).toBe(false);
  });

  it('tagihan nol tidak menghasilkan nilai negatif', () => {
    const h = hitungTanggungan({ totalAmount: 0, coverage: cakupan });
    expect(h.payerAmount).toBe(0);
    expect(h.patientAmount).toBe(0);
  });

  it('nilai tagihan negatif ditolak', () => {
    expect(() => hitungTanggungan({ totalAmount: -1, coverage: cakupan })).toThrow();
  });

  it('persentase di luar 0-100 ditolak', () => {
    expect(() =>
      hitungTanggungan({ totalAmount: 1000, coverage: { ...cakupan, coveragePercent: 150 } }),
    ).toThrow();
    expect(() =>
      hitungTanggungan({ totalAmount: 1000, coverage: { ...cakupan, coveragePercent: -1 } }),
    ).toThrow();
  });

  it('penjamin tidak pernah menanggung lebih daripada tagihannya', () => {
    const h = hitungTanggungan({
      totalAmount: 1000,
      coverage: { ...cakupan, ceilingAmount: 999999 },
    });
    expect(h.payerAmount).toBe(1000);
  });
});
