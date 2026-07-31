/**
 * Pengujian pemetaan akuntansi kesehatan.
 *
 * Yang dijaga paling ketat: tidak ada buku besar kedua, saldo normal peran
 * harus cocok dengan akun yang ditautkan, dan selisih klaim adalah BEBAN —
 * bukan pendapatan yang hilang begitu saja.
 */

import {
  GOLONGAN_PERAN,
  PERISTIWA,
  SELURUH_PERAN,
  bolehPasangAturan,
  bolehTautkanAkun,
  hitungSelisihKlaim,
  kesiapanMenjurnal,
  peranDibutuhkan,
  periksaProfilAkun,
  type PeranAkun,
  type PeristiwaKesehatan,
} from './health-accounting';

const SEMUA_PERISTIWA = PERISTIWA.map((p) => p.event);

/** Menautkan seluruh peran, supaya kekurangannya dapat dibuat satu per satu. */
const tautLengkap = (kecuali: PeranAkun[] = []): Partial<Record<PeranAkun, string>> => {
  const hasil: Partial<Record<PeranAkun, string>> = {};
  for (const role of SELURUH_PERAN) {
    if (!kecuali.includes(role)) hasil[role] = `akun-${role}`;
  }
  return hasil;
};

describe('peran akun', () => {
  it('setiap peran punya golongan dan saldo normal', () => {
    for (const role of SELURUH_PERAN) {
      expect(GOLONGAN_PERAN[role].golongan).toBeTruthy();
      expect(['DEBIT', 'CREDIT']).toContain(GOLONGAN_PERAN[role].normal);
    }
  });

  it('seluruh pendapatan bersaldo normal kredit', () => {
    for (const role of SELURUH_PERAN) {
      if (GOLONGAN_PERAN[role].golongan === 'REVENUE') {
        expect(GOLONGAN_PERAN[role].normal).toBe('CREDIT');
      }
    }
  });

  it('seluruh beban bersaldo normal debit', () => {
    for (const role of SELURUH_PERAN) {
      if (GOLONGAN_PERAN[role].golongan === 'EXPENSE') {
        expect(GOLONGAN_PERAN[role].normal).toBe('DEBIT');
      }
    }
  });

  it('akumulasi penyusutan bersaldo normal KREDIT meski bergolongan aset', () => {
    // Akun lawan. Menyimpulkan saldo normalnya dari golongannya akan keliru.
    expect(GOLONGAN_PERAN.ACCUMULATED_DEPRECIATION).toEqual({
      golongan: 'ASSET',
      normal: 'CREDIT',
    });
  });

  it('deposit pasien adalah LIABILITAS, bukan pendapatan', () => {
    // Uang yang belum menjadi hak rumah sakit.
    expect(GOLONGAN_PERAN.PATIENT_DEPOSIT.golongan).toBe('LIABILITY');
  });
});

describe('katalog peristiwa', () => {
  it('kode peristiwa unik', () => {
    expect(new Set(SEMUA_PERISTIWA).size).toBe(SEMUA_PERISTIWA.length);
  });

  it('seluruh kode berawalan HEALTH_', () => {
    for (const e of SEMUA_PERISTIWA) expect(e.startsWith('HEALTH_')).toBe(true);
  });

  it('setiap peristiwa menyebut medan nilainya, bukan rumus', () => {
    // Rumus bebas pada data adalah pintu masuk eksekusi kode yang tidak
    // diinginkan; larangan eval berlaku di sini pula.
    for (const p of PERISTIWA) {
      expect(p.amountKey).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
    }
  });

  it('tidak ada peristiwa yang mendebit dan mengkredit peran yang sama', () => {
    for (const p of PERISTIWA) expect(p.debit).not.toBe(p.credit);
  });

  it('pendapatan layanan ditentukan pemetaan layanan, bukan satu akun untuk semua', () => {
    const tunai = PERISTIWA.find((p) => p.event === 'HEALTH_SERVICE_RENDERED_CASH');
    expect(tunai?.credit).toBe('BY_SERVICE');
  });

  it('klaim yang kurang dibayar menghasilkan BEBAN, bukan pendapatan yang lenyap', () => {
    const p = PERISTIWA.find((x) => x.event === 'HEALTH_CLAIM_UNDERPAID');
    expect(p?.debit).toBe('EXPENSE_CLAIM_ADJUSTMENT');
    expect(p?.credit).toBe('AR_BPJS');
    expect(p?.note).toContain('mutu pengkodean');
  });

  it('penyerahan obat memakai harga pokok, bukan harga jual', () => {
    const p = PERISTIWA.find((x) => x.event === 'HEALTH_DRUG_DISPENSED');
    expect(p?.amountKey).toBe('costAmount');
    expect(p?.note).toContain('bukan harga jualnya');
  });

  it('fee sistem dan distribusi investor menyebutkan bahwa bawaannya NONE', () => {
    for (const kode of ['HEALTH_SYSTEM_FEE_ACCRUED', 'HEALTH_INVESTOR_DISTRIBUTION_APPROVED']) {
      expect(PERISTIWA.find((p) => p.event === kode)?.note).toContain('NONE');
    }
  });

  it('peran yang dibutuhkan tidak memuat BY_SERVICE', () => {
    const perlu = peranDibutuhkan('HEALTH_SERVICE_RENDERED_CASH');
    expect(perlu).toEqual(['AR_PATIENT']);
  });

  it('peristiwa yang tidak dikenal tidak menuntut peran apa pun', () => {
    expect(peranDibutuhkan('TIDAK_ADA' as PeristiwaKesehatan)).toEqual([]);
  });
});

describe('kelengkapan profil akun', () => {
  it('profil yang seluruh perannya tertaut dinyatakan lengkap', () => {
    const h = periksaProfilAkun({ linked: tautLengkap(), enabledEvents: SEMUA_PERISTIWA });
    expect(h.complete).toBe(true);
  });

  it('peran yang belum tertaut disebut namanya', () => {
    const h = periksaProfilAkun({
      linked: tautLengkap(['AR_BPJS']),
      enabledEvents: SEMUA_PERISTIWA,
    });
    expect(h.missing.map((m) => m.role)).toEqual(['AR_BPJS']);
  });

  it('dan menyebut peristiwa apa yang menjadi buntu karenanya', () => {
    const h = periksaProfilAkun({
      linked: tautLengkap(['AR_BPJS']),
      enabledEvents: SEMUA_PERISTIWA,
    });
    expect(h.missing[0].blocksEvents).toContain('HEALTH_CLAIM_PAID');
    expect(h.missing[0].blocksEvents).toContain('HEALTH_CLAIM_UNDERPAID');
    expect(h.missing[0].message).toContain('3 peristiwa');
  });

  it('yang membuntukan paling banyak peristiwa berada di atas', () => {
    const h = periksaProfilAkun({
      linked: tautLengkap(['AR_BPJS', 'INVENTORY_IMPLANT']),
      enabledEvents: SEMUA_PERISTIWA,
    });
    expect(h.missing[0].role).toBe('AR_BPJS');
  });

  it('peristiwa yang TIDAK dipakai tidak menuntut penautan akun', () => {
    /*
     * Menuntut penautan bagi peristiwa yang tidak akan pernah terjadi — fee
     * sistem yang bawaannya NONE, misalnya — akan membuat seluruh daftar
     * diabaikan.
     */
    const h = periksaProfilAkun({
      linked: tautLengkap(['AP_SYSTEM_FEE', 'EXPENSE_PLATFORM']),
      enabledEvents: ['HEALTH_DEPOSIT_RECEIVED'],
    });
    expect(h.complete).toBe(true);
  });

  it('fasilitas tanpa BPJS tidak dituntut menautkan piutang BPJS', () => {
    const h = periksaProfilAkun({
      linked: tautLengkap(['AR_BPJS']),
      enabledEvents: ['HEALTH_SERVICE_RENDERED_CASH', 'HEALTH_DRUG_DISPENSED'],
    });
    expect(h.complete).toBe(true);
  });

  it('peran yang tertaut null dihitung belum tertaut', () => {
    const h = periksaProfilAkun({
      linked: { ...tautLengkap(), AR_PATIENT: null },
      enabledEvents: ['HEALTH_SERVICE_RENDERED_CASH'],
    });
    expect(h.missing.map((m) => m.role)).toEqual(['AR_PATIENT']);
  });
});

describe('penautan akun', () => {
  it('peran pendapatan boleh ditautkan ke akun bersaldo normal kredit', () => {
    expect(
      bolehTautkanAkun({
        role: 'REVENUE_LAB',
        accountNormalBalance: 'CREDIT',
        accountAllowsPosting: true,
        accountIsActive: true,
      }).allowed,
    ).toBe(true);
  });

  it('peran pendapatan ke akun bersaldo normal debit DITOLAK', () => {
    /*
     * Menautkannya akan menghasilkan pendapatan bernilai negatif pada setiap
     * laporan, dan yang membacanya akan menyimpulkan laboratoriumnya merugi.
     */
    const h = bolehTautkanAkun({
      role: 'REVENUE_LAB',
      accountNormalBalance: 'DEBIT',
      accountAllowsPosting: true,
      accountIsActive: true,
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('berlawanan tanda');
  });

  it('akun induk yang tidak menerima posting DITOLAK', () => {
    // Jurnal pada akun induk membuat rincian per unit hilang seluruhnya.
    const h = bolehTautkanAkun({
      role: 'REVENUE_LAB',
      accountNormalBalance: 'CREDIT',
      accountAllowsPosting: false,
      accountIsActive: true,
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('akun anaknya');
  });

  it('akun yang tidak aktif DITOLAK', () => {
    expect(
      bolehTautkanAkun({
        role: 'REVENUE_LAB',
        accountNormalBalance: 'CREDIT',
        accountAllowsPosting: true,
        accountIsActive: false,
      }).allowed,
    ).toBe(false);
  });

  it('peran yang tidak dikenal DITOLAK', () => {
    expect(
      bolehTautkanAkun({
        role: 'TIDAK_ADA' as PeranAkun,
        accountNormalBalance: 'CREDIT',
        accountAllowsPosting: true,
        accountIsActive: true,
      }).allowed,
    ).toBe(false);
  });

  it('akumulasi penyusutan menuntut akun bersaldo normal kredit', () => {
    expect(
      bolehTautkanAkun({
        role: 'ACCUMULATED_DEPRECIATION',
        accountNormalBalance: 'DEBIT',
        accountAllowsPosting: true,
        accountIsActive: true,
      }).allowed,
    ).toBe(false);
  });
});

describe('aturan pemetaan peristiwa', () => {
  it('aturan yang sah diterima', () => {
    expect(
      bolehPasangAturan({
        event: 'HEALTH_DRUG_DISPENSED',
        debitRole: 'COGS_DRUG',
        creditRole: 'INVENTORY_DRUG',
      }).allowed,
    ).toBe(true);
  });

  it('debit dan kredit peran yang SAMA ditolak', () => {
    // Jurnal semacam itu tidak mengubah apa pun, tetapi tampak seperti
    // pekerjaan yang sudah selesai.
    const h = bolehPasangAturan({
      event: 'HEALTH_DRUG_DISPENSED',
      debitRole: 'COGS_DRUG',
      creditRole: 'COGS_DRUG',
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('tidak mengubah apa pun');
  });

  it('peristiwa yang tidak dikenal ditolak', () => {
    expect(
      bolehPasangAturan({
        event: 'HEALTH_TIDAK_ADA' as PeristiwaKesehatan,
        debitRole: 'CASH',
        creditRole: 'AR_PATIENT',
      }).allowed,
    ).toBe(false);
  });

  it('peran yang tidak dikenal ditolak', () => {
    expect(
      bolehPasangAturan({
        event: 'HEALTH_CLAIM_PAID',
        debitRole: 'CASH',
        creditRole: 'TIDAK_ADA' as PeranAkun,
      }).allowed,
    ).toBe(false);
  });

  it('BY_SERVICE pada satu sisi diterima', () => {
    expect(
      bolehPasangAturan({
        event: 'HEALTH_SERVICE_RENDERED_CASH',
        debitRole: 'AR_PATIENT',
        creditRole: 'BY_SERVICE',
      }).allowed,
    ).toBe(true);
  });
});

describe('kesiapan menjurnal', () => {
  const profilLengkap = { complete: true, missing: [] };

  it('siap bila profilnya lengkap dan Core sudah menerima kodenya', () => {
    const h = kesiapanMenjurnal({
      profile: profilLengkap,
      coreAcceptedEvents: ['HEALTH_DRUG_DISPENSED'],
      enabledEvents: ['HEALTH_DRUG_DISPENSED'],
    });
    expect(h.ready).toBe(true);
  });

  it('memisahkan pekerjaan kami dari yang menunggu Core', () => {
    /*
     * Laporan kesiapan yang menyatukan keduanya akan membuat orang mengerjakan
     * hal yang memang tidak dapat dikerjakannya.
     */
    const h = kesiapanMenjurnal({
      profile: {
        complete: false,
        missing: [{ role: 'AR_PATIENT', message: 'belum tertaut', blocksEvents: [] }],
      },
      coreAcceptedEvents: [],
      enabledEvents: ['HEALTH_DRUG_DISPENSED'],
    });
    expect(h.ourWork).toHaveLength(1);
    expect(h.waitingOnCore).toEqual(['HEALTH_DRUG_DISPENSED']);
  });

  it('menyebut bahwa membuat buku besar kedua bukan jalan keluarnya', () => {
    const h = kesiapanMenjurnal({
      profile: profilLengkap,
      coreAcceptedEvents: [],
      enabledEvents: ['HEALTH_DRUG_DISPENSED'],
    });
    expect(h.message).toContain('buku besar kedua');
  });

  it('tidak siap selama masih ada yang menunggu Core, meski profilnya lengkap', () => {
    const h = kesiapanMenjurnal({
      profile: profilLengkap,
      coreAcceptedEvents: ['HEALTH_DRUG_DISPENSED'],
      enabledEvents: ['HEALTH_DRUG_DISPENSED', 'HEALTH_CLAIM_PAID'],
    });
    expect(h.ready).toBe(false);
    expect(h.waitingOnCore).toEqual(['HEALTH_CLAIM_PAID']);
  });

  it('fasilitas tanpa peristiwa apa pun dinyatakan siap', () => {
    expect(
      kesiapanMenjurnal({ profile: profilLengkap, coreAcceptedEvents: [], enabledEvents: [] }).ready,
    ).toBe(true);
  });
});

describe('selisih klaim', () => {
  it('disetujui penuh tidak menghasilkan penyesuaian', () => {
    const h = hitungSelisihKlaim({ submittedAmount: 1000000, approvedAmount: 1000000 });
    expect(h.adjustmentAmount).toBe(0);
    expect(h.event).toBeNull();
  });

  it('disetujui kurang menghasilkan BEBAN, bukan piutang yang dihapus diam-diam', () => {
    const h = hitungSelisihKlaim({ submittedAmount: 1000000, approvedAmount: 750000 });
    expect(h.adjustmentAmount).toBe(250000);
    expect(h.event).toBe('HEALTH_CLAIM_UNDERPAID');
    expect(h.message).toContain('bukan dihapus dari piutang begitu saja');
  });

  it('dan pesannya menyebut mengapa selisih itu harus terlihat', () => {
    // Ia ukuran mutu pengkodean dan kelengkapan berkas; yang tidak terlihat
    // tidak pernah diperbaiki.
    expect(
      hitungSelisihKlaim({ submittedAmount: 1000000, approvedAmount: 750000 }).message,
    ).toContain('mutu pengkodean');
  });

  it('disetujui LEBIH BESAR daripada yang diajukan menuntut telaah, bukan jurnal', () => {
    const h = hitungSelisihKlaim({ submittedAmount: 750000, approvedAmount: 1000000 });
    expect(h.needsReview).toBe(true);
    expect(h.event).toBeNull();
    expect(h.adjustmentAmount).toBe(0);
    expect(h.message).toContain('bukan keuntungan');
  });

  it('klaim nol disetujui nol tidak menghasilkan apa-apa', () => {
    expect(hitungSelisihKlaim({ submittedAmount: 0, approvedAmount: 0 }).event).toBeNull();
  });

  it('seluruh klaim ditolak menghasilkan beban sebesar seluruh pengajuannya', () => {
    const h = hitungSelisihKlaim({ submittedAmount: 500000, approvedAmount: 0 });
    expect(h.adjustmentAmount).toBe(500000);
    expect(h.event).toBe('HEALTH_CLAIM_UNDERPAID');
  });

  it('nilai negatif ditolak', () => {
    expect(() => hitungSelisihKlaim({ submittedAmount: -1, approvedAmount: 0 })).toThrow();
    expect(() => hitungSelisihKlaim({ submittedAmount: 0, approvedAmount: -1 })).toThrow();
  });
});
