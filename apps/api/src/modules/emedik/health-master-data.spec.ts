/**
 * Pengujian aturan master data layanan dan pemetaannya.
 *
 * Yang dijaga paling ketat: harga sintetis tidak dapat menyaru sebagai harga
 * resmi, "bila berlaku" ditentukan sifat layanannya bukan pilihan pengguna, dan
 * data contoh yang sudah dipakai data nyata tidak dapat dihapus diam-diam.
 */

import {
  bilanganDeterministik,
  bolehAktifkanLayanan,
  bolehHapusDataContoh,
  bolehMengakuResmi,
  bolehPetakanKodeLokal,
  hargaContoh,
  periksaPemetaan,
  pilihDeterministik,
  sifatLayanan,
  type Layanan,
  type PemetaanLayanan,
} from './health-master-data';

const layanan = (over: Partial<Layanan> = {}): Layanan => ({
  code: 'KONSUL-UMUM',
  name: 'Konsultasi Dokter Umum',
  serviceType: 'CONSULTATION',
  careSetting: 'OUTPATIENT',
  usesInventory: false,
  hasFeeSharing: false,
  ...over,
});

const petaLengkap = (over: Partial<PemetaanLayanan> = {}): PemetaanLayanan => ({
  departmentId: 'dep-1',
  serviceUnitId: 'unit-1',
  locationId: 'lok-1',
  performerRole: 'HEALTH_DOCTOR',
  verifierRole: null,
  equipmentId: null,
  specimenTypeId: null,
  clinicalOrderType: 'CONSULTATION',
  clinicalFormId: null,
  tariffId: 'tarif-1',
  payerCoverageId: null,
  feeRuleId: null,
  revenueAccountId: 'akun-pendapatan',
  cogsAccountId: null,
  ...over,
});

describe('sumber master data', () => {
  it('harga sintetis TIDAK dapat menyebut penerbit resmi', () => {
    /*
     * Kekeliruan yang mahal: harga contoh yang tampak resmi akan dipakai
     * menagih pasien, dan setelah itu tidak ada cara membedakannya dari yang
     * sungguhan.
     */
    const h = bolehMengakuResmi({ source: 'SYNTHETIC_DEMO', issuer: 'BPJS' });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('menagih');
  });

  it('data impor fasilitas pun tidak dapat menyebut penerbit resmi', () => {
    expect(bolehMengakuResmi({ source: 'FACILITY_IMPORT', issuer: 'KFA' }).allowed).toBe(false);
  });

  it('data contoh tanpa penerbit diterima', () => {
    expect(bolehMengakuResmi({ source: 'SYNTHETIC_DEMO' }).allowed).toBe(true);
  });

  it('rujukan resmi wajib menyebut penerbitnya', () => {
    expect(bolehMengakuResmi({ source: 'OFFICIAL_REFERENCE' }).allowed).toBe(false);
  });

  it('rujukan resmi wajib dapat ditelusuri ke terbitannya', () => {
    // Rujukan yang tidak dapat ditelusuri tidak dapat dibedakan dari karangan.
    const h = bolehMengakuResmi({ source: 'OFFICIAL_REFERENCE', issuer: 'KFA' });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('karangan');
  });

  it('rujukan resmi dengan penerbit dan nomor terbitan diterima', () => {
    expect(
      bolehMengakuResmi({
        source: 'OFFICIAL_REFERENCE',
        issuer: 'KFA',
        issuerReference: 'KFA-2026-07',
      }).allowed,
    ).toBe(true);
  });

  it('nomor terbitan berisi spasi saja ditolak', () => {
    expect(
      bolehMengakuResmi({ source: 'OFFICIAL_REFERENCE', issuer: 'BPOM', issuerReference: '   ' })
        .allowed,
    ).toBe(false);
  });
});

describe('penghapusan data contoh', () => {
  it('data contoh yang belum dipakai boleh dihapus', () => {
    expect(bolehHapusDataContoh({ batchId: 'b1', references: [] }).allowed).toBe(true);
  });

  it('rujukan bernilai nol tidak menahan', () => {
    expect(
      bolehHapusDataContoh({ batchId: 'b1', references: [{ entity: 'resep', count: 0 }] }).allowed,
    ).toBe(true);
  });

  it('data contoh yang sudah diresepkan kepada pasien nyata TIDAK dapat dihapus', () => {
    /*
     * Menghapusnya akan meninggalkan resep yang menunjuk kekosongan — dan resep
     * itu milik pasien sungguhan.
     */
    const h = bolehHapusDataContoh({
      batchId: 'b1',
      references: [{ entity: 'baris resep', count: 3 }],
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('3 baris resep');
  });

  it('penolakannya menyebut SETIAP yang merujuknya, bukan hanya yang pertama', () => {
    const h = bolehHapusDataContoh({
      batchId: 'b1',
      references: [
        { entity: 'baris resep', count: 3 },
        { entity: 'penyerahan obat', count: 1 },
      ],
    });
    expect(h.blockedBy).toHaveLength(2);
    expect(h.message).toContain('penyerahan obat');
  });

  it('keputusannya diserahkan kepada manusia, tidak dilakukan diam-diam', () => {
    const h = bolehHapusDataContoh({
      batchId: 'b1',
      references: [{ entity: 'baris resep', count: 1 }],
    });
    expect(h.message).toContain('jangan dihapus diam-diam');
  });
});

describe('sifat layanan', () => {
  it('pemeriksaan laboratorium SELALU menuntut spesimen', () => {
    // Pemeriksaan laboratorium tanpa spesimen adalah tagihan tanpa pemeriksaan.
    expect(sifatLayanan('LABORATORY').requiresSpecimen).toBe(true);
  });

  it('dan selalu menuntut verifikasi', () => {
    expect(sifatLayanan('LABORATORY').requiresVerification).toBe(true);
  });

  it('radiologi menuntut alat dan verifikasi, tetapi bukan spesimen', () => {
    const s = sifatLayanan('RADIOLOGY');
    expect(s.requiresEquipment).toBe(true);
    expect(s.requiresVerification).toBe(true);
    expect(s.requiresSpecimen).toBe(false);
  });

  it('konsultasi tidak menuntut ketiganya', () => {
    expect(sifatLayanan('CONSULTATION')).toEqual({
      requiresSpecimen: false,
      requiresEquipment: false,
      requiresVerification: false,
    });
  });

  it('operasi menuntut alat', () => {
    expect(sifatLayanan('SURGERY').requiresEquipment).toBe(true);
  });
});

describe('kelengkapan pemetaan', () => {
  it('layanan konsultasi yang terpetakan penuh dinyatakan lengkap', () => {
    const h = periksaPemetaan(layanan(), petaLengkap());
    expect(h.complete).toBe(true);
    expect(h.blockingCount).toBe(0);
  });

  it('unit layanan yang kosong disebutkan akibatnya, bukan hanya namanya', () => {
    const h = periksaPemetaan(layanan(), petaLengkap({ serviceUnitId: null }));
    expect(h.missing.find((m) => m.slot === 'serviceUnitId')?.message)
      .toContain('tidak akan sampai ke mana pun');
  });

  it('kekurangan dilaporkan SATU PER SATU, bukan sebagai satu pesan', () => {
    const h = periksaPemetaan(
      layanan(),
      petaLengkap({ departmentId: null, performerRole: null, tariffId: null }),
    );
    expect(h.missing.filter((m) => m.blocksActivation)).toHaveLength(3);
  });

  it('pemeriksaan laboratorium menuntut spesimen meski penggunanya tidak mengisinya', () => {
    /*
     * "Bila berlaku" ditentukan sifat layanannya, bukan pilihan pengguna.
     * Menandainya "tidak berlaku" adalah jalan memutar yang akan selalu diambil
     * ketika tenggat mendesak.
     */
    const h = periksaPemetaan(
      layanan({ serviceType: 'LABORATORY', careSetting: 'LABORATORY' }),
      petaLengkap(),
    );
    expect(h.missing.some((m) => m.slot === 'specimenTypeId')).toBe(true);
    expect(h.missing.some((m) => m.slot === 'verifierRole')).toBe(true);
    expect(h.missing.some((m) => m.slot === 'equipmentId')).toBe(true);
  });

  it('peran verifikator yang kurang menyebut akibatnya pada pasien', () => {
    const h = periksaPemetaan(layanan({ serviceType: 'RADIOLOGY' }), petaLengkap());
    expect(h.missing.find((m) => m.slot === 'verifierRole')?.message)
      .toContain('menumpuk');
  });

  it('layanan yang memakai persediaan menuntut akun HPP', () => {
    // Layanan yang hanya memetakan pendapatannya akan menampilkan margin
    // seratus persen.
    const h = periksaPemetaan(layanan({ usesInventory: true }), petaLengkap());
    expect(h.missing.find((m) => m.slot === 'cogsAccountId')?.message)
      .toContain('seratus persen');
  });

  it('layanan tanpa persediaan TIDAK menuntut akun HPP', () => {
    const h = periksaPemetaan(layanan({ usesInventory: false }), petaLengkap());
    expect(h.missing.some((m) => m.slot === 'cogsAccountId')).toBe(false);
  });

  it('layanan yang jasanya dibagi menuntut aturan jasa', () => {
    const h = periksaPemetaan(layanan({ hasFeeSharing: true }), petaLengkap());
    expect(h.missing.some((m) => m.slot === 'feeRuleId')).toBe(true);
  });

  it('akun pendapatan selalu wajib', () => {
    const h = periksaPemetaan(layanan(), petaLengkap({ revenueAccountId: null }));
    expect(h.missing.find((m) => m.slot === 'revenueAccountId')?.blocksActivation).toBe(true);
  });

  it('lokasi dan jenis pesanan dilaporkan tetapi TIDAK menahan aktivasi', () => {
    const h = periksaPemetaan(
      layanan(),
      petaLengkap({ locationId: null, clinicalOrderType: null }),
    );
    expect(h.complete).toBe(false);
    expect(h.blockingCount).toBe(0);
    expect(h.missing).toHaveLength(2);
  });

  it('slot yang tabelnya belum dibangun menyebut fase yang akan membangunnya', () => {
    const h = periksaPemetaan(layanan(), petaLengkap({ tariffId: null }));
    expect(h.missing.find((m) => m.slot === 'tariffId')?.awaitingPhase).toBe('H-9D');
  });

  it('akun pendapatan menunggu H-9N', () => {
    const h = periksaPemetaan(layanan(), petaLengkap({ revenueAccountId: null }));
    expect(h.missing.find((m) => m.slot === 'revenueAccountId')?.awaitingPhase).toBe('H-9N');
  });

  it('departemen TIDAK menunggu fase mana pun — tabelnya sudah ada', () => {
    const h = periksaPemetaan(layanan(), petaLengkap({ departmentId: null }));
    expect(h.missing.find((m) => m.slot === 'departmentId')?.awaitingPhase).toBeUndefined();
  });
});

describe('aktivasi layanan', () => {
  it('pemetaan lengkap boleh diaktifkan', () => {
    const k = periksaPemetaan(layanan(), petaLengkap());
    expect(bolehAktifkanLayanan({ kelengkapan: k }).allowed).toBe(true);
  });

  it('pemetaan yang hanya kurang hal tak menahan tetap boleh diaktifkan', () => {
    // Lokasi berguna, tetapi layanan tanpa lokasi masih dapat dikerjakan.
    const k = periksaPemetaan(layanan(), petaLengkap({ locationId: null }));
    expect(k.complete).toBe(false);
    expect(bolehAktifkanLayanan({ kelengkapan: k }).allowed).toBe(true);
  });

  it('layanan yang belum terpetakan DITOLAK', () => {
    const k = periksaPemetaan(layanan(), petaLengkap({ serviceUnitId: null }));
    expect(bolehAktifkanLayanan({ kelengkapan: k }).allowed).toBe(false);
  });

  it('penolakannya menyebut slot mana yang kurang', () => {
    const k = periksaPemetaan(layanan(), petaLengkap({ serviceUnitId: null, tariffId: null }));
    const h = bolehAktifkanLayanan({ kelengkapan: k });
    expect(h.missing).toContain('serviceUnitId');
    expect(h.missing).toContain('tariffId');
  });

  it('slot yang menunggu fase berikutnya DIPISAHKAN dalam pesannya', () => {
    /*
     * Menyamarkannya sebagai "belum lengkap" biasa akan membuat penggunanya
     * mencari kolom yang memang belum ada, lalu menyimpulkan sistemnya rusak.
     */
    const k = periksaPemetaan(layanan(), petaLengkap({ tariffId: null }));
    const h = bolehAktifkanLayanan({ kelengkapan: k });
    expect(h.awaiting).toEqual(['H-9D']);
    expect(h.message).toContain('tabelnya memang belum ada');
  });

  it('fase yang ditunggu disebutkan tanpa pengulangan', () => {
    const k = periksaPemetaan(
      layanan({ usesInventory: true }),
      petaLengkap({ revenueAccountId: null, cogsAccountId: null }),
    );
    expect(bolehAktifkanLayanan({ kelengkapan: k }).awaiting).toEqual(['H-9N']);
  });
});

describe('pemetaan kode lokal', () => {
  it('kode lokal baru boleh dipetakan', () => {
    expect(
      bolehPetakanKodeLokal({
        localCode: 'LAB-DL',
        targetSystem: 'LOINC',
        targetCode: '58410-2',
        existing: [],
      }).allowed,
    ).toBe(true);
  });

  it('kode lokal kosong ditolak', () => {
    expect(
      bolehPetakanKodeLokal({
        localCode: '  ',
        targetSystem: 'LOINC',
        targetCode: '58410-2',
        existing: [],
      }).allowed,
    ).toBe(false);
  });

  it('satu kode lokal TIDAK dapat menunjuk dua kode resmi pada sistem yang sama', () => {
    // Yang mengirim ke luar akan memilih salah satunya menurut urutan baris,
    // dan urutan baris bukan keputusan klinis.
    const h = bolehPetakanKodeLokal({
      localCode: 'LAB-DL',
      targetSystem: 'LOINC',
      targetCode: '99999-9',
      existing: [{ targetSystem: 'LOINC', targetCode: '58410-2' }],
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('58410-2');
  });

  it('pemetaan yang sudah dipensiunkan tidak menahan yang baru', () => {
    expect(
      bolehPetakanKodeLokal({
        localCode: 'LAB-DL',
        targetSystem: 'LOINC',
        targetCode: '99999-9',
        existing: [{ targetSystem: 'LOINC', targetCode: '58410-2', retiredAt: '2026-01-01' }],
      }).allowed,
    ).toBe(true);
  });

  it('sistem yang berbeda boleh dipetakan berdampingan', () => {
    expect(
      bolehPetakanKodeLokal({
        localCode: 'LAB-DL',
        targetSystem: 'SNOMED',
        targetCode: '26604007',
        existing: [{ targetSystem: 'LOINC', targetCode: '58410-2' }],
      }).allowed,
    ).toBe(true);
  });

  it('memetakan ulang ke kode yang SAMA tidak dianggap bentrok', () => {
    expect(
      bolehPetakanKodeLokal({
        localCode: 'LAB-DL',
        targetSystem: 'LOINC',
        targetCode: '58410-2',
        existing: [{ targetSystem: 'LOINC', targetCode: '58410-2' }],
      }).allowed,
    ).toBe(true);
  });
});

describe('pembangkitan data contoh', () => {
  it('benih yang sama menghasilkan bilangan yang sama', () => {
    /*
     * Tanpa ini, dua penyewa demo akan melihat katalog yang berbeda dan salah
     * satunya akan melaporkan kerusakan yang tidak dapat ditirukan siapa pun.
     */
    expect(bilanganDeterministik('demo', 7)).toBe(bilanganDeterministik('demo', 7));
  });

  it('benih yang berbeda menghasilkan bilangan yang berbeda', () => {
    expect(bilanganDeterministik('demo', 7)).not.toBe(bilanganDeterministik('lain', 7));
  });

  it('urutan yang berdekatan tidak menghasilkan nilai yang berdekatan', () => {
    const a = bilanganDeterministik('demo', 1);
    const b = bilanganDeterministik('demo', 2);
    expect(Math.abs(a - b)).toBeGreaterThan(1000);
  });

  it('pemilihan dari daftar deterministik pula', () => {
    const daftar = ['a', 'b', 'c', 'd'];
    expect(pilihDeterministik(daftar, 'demo', 3)).toBe(pilihDeterministik(daftar, 'demo', 3));
  });

  it('daftar kosong ditolak, bukan menghasilkan undefined', () => {
    expect(() => pilihDeterministik([], 'demo', 0)).toThrow();
  });

  it('harga contoh SELALU bertanda sintetis', () => {
    expect(hargaContoh({ seed: 'demo', index: 1, min: 10000, max: 500000 }).source)
      .toBe('SYNTHETIC_DEMO');
  });

  it('dan menyatakan dengan jelas bahwa ia bukan tarif resmi', () => {
    const h = hargaContoh({ seed: 'demo', index: 1, min: 10000, max: 500000 });
    expect(h.disclaimer).toContain('BUKAN tarif resmi');
    expect(h.disclaimer).toContain('menagih');
  });

  it('harga contoh berada di dalam rentangnya', () => {
    for (let i = 0; i < 200; i += 1) {
      const h = hargaContoh({ seed: 'demo', index: i, min: 10000, max: 500000 });
      expect(h.amount).toBeGreaterThanOrEqual(9900);
      expect(h.amount).toBeLessThanOrEqual(500000);
    }
  });

  it('harga contoh dibulatkan ke ratusan', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(hargaContoh({ seed: 'demo', index: i, min: 10000, max: 500000 }).amount % 100).toBe(0);
    }
  });

  it('harga contoh deterministik', () => {
    expect(hargaContoh({ seed: 'demo', index: 5, min: 1000, max: 2000 }).amount).toBe(
      hargaContoh({ seed: 'demo', index: 5, min: 1000, max: 2000 }).amount,
    );
  });

  it('rentang harga yang terbalik ditolak', () => {
    expect(() => hargaContoh({ seed: 'demo', index: 1, min: 500, max: 100 })).toThrow();
  });
});
