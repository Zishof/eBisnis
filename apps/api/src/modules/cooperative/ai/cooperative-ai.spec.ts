/**
 * Pengujian keperluan AI koperasi.
 *
 * Yang dijaga bukan mutu jawabannya melainkan batasnya:
 *
 *   · AI tidak pernah bertindak — hanya `DRAFT`, `ANALYSIS`, `RECOMMENDATION`.
 *   · Setiap keperluan bersandar pada menu yang izinnya memang ada.
 *   · Kesimpulan tentang uang wajib berbukti.
 *   · Isi prompt tidak disimpan.
 */

import {
  COOPERATIVE_AI_CATALOG,
  COOPERATIVE_AI_USE_CASES,
  KEPERLUAN_YANG_DITOLAK,
} from './cooperative-ai.catalog';
import { HAK_AKSES_KOPERASI, MENU_KOPERASI } from '../rbac/cooperative-rbac.catalog';

describe('AI tidak pernah bertindak', () => {
  it('setiap keluaran hanya berupa draf, analisis, atau usulan', () => {
    /*
     * Larangan ini ditegakkan dengan bentuk, bukan dengan mengingatkan penulis
     * kode: tidak ada nilai `outputKind` yang berarti "kerjakan".
     */
    for (const u of COOPERATIVE_AI_USE_CASES) {
      expect(['DRAFT', 'ANALYSIS', 'RECOMMENDATION']).toContain(u.outputKind);
    }
  });

  it('tidak ada keperluan yang aksinya menulis', () => {
    // AI hanya membaca. Aksi selain READ akan berarti ia mengubah sesuatu.
    for (const u of COOPERATIVE_AI_USE_CASES) {
      expect(u.action).toBe('READ');
    }
  });

  it('tidak ada nama atau kode keperluan yang menjanjikan perbuatan', () => {
    const kataPerbuatan = [
      'APPROVE', 'POST', 'PAY', 'DELETE', 'EXECUTE', 'AUTO_', 'DISBURSE', 'CLOSE',
    ];
    for (const u of COOPERATIVE_AI_USE_CASES) {
      for (const k of kataPerbuatan) {
        expect(u.code).not.toContain(k);
      }
    }
  });
});

describe('sandaran hak akses', () => {
  it('setiap keperluan menunjuk menu koperasi yang ada', () => {
    const menu = new Set(MENU_KOPERASI.map((m) => m.code));
    for (const u of COOPERATIVE_AI_USE_CASES) {
      expect(menu.has(u.menuCode)).toBe(true);
    }
  });

  it('izin yang tersirat dari tiap keperluan memang ada di katalog', () => {
    /*
     * Keperluan yang bersandar pada izin yang tidak pernah disemai akan
     * menolak setiap permintaan selamanya — dan tampak seperti AI yang rusak,
     * bukan seperti izin yang belum ada.
     */
    const sah = new Set(HAK_AKSES_KOPERASI);
    for (const u of COOPERATIVE_AI_USE_CASES) {
      expect(sah.has(`${u.menuCode}.${u.action}`)).toBe(true);
    }
  });

  it('setiap kode keperluan berawalan COOPERATIVE_', () => {
    for (const u of COOPERATIVE_AI_USE_CASES) {
      expect(u.code.startsWith('COOPERATIVE_')).toBe(true);
    }
  });

  it('setiap kode berbeda', () => {
    const kode = COOPERATIVE_AI_USE_CASES.map((u) => u.code);
    expect(new Set(kode).size).toBe(kode.length);
  });
});

describe('kesimpulan tentang uang wajib berbukti', () => {
  it('setiap temuan pada simpanan dan penagihan menuntut bukti', () => {
    /*
     * Kesimpulan tentang uang tanpa angka yang dapat ditelusuri adalah tebakan
     * yang terdengar meyakinkan — lebih berbahaya daripada tidak ada jawaban.
     */
    for (const kode of ['COOPERATIVE_SAVING_ANOMALY', 'COOPERATIVE_COLLECTION_ANOMALY']) {
      const u = COOPERATIVE_AI_USE_CASES.find((x) => x.code === kode)!;
      expect(u.requiresEvidence).toBe(true);
    }
  });

  it('skema temuan menuntut buktiRujukan pada setiap barisnya', () => {
    for (const kode of ['COOPERATIVE_SAVING_ANOMALY', 'COOPERATIVE_COLLECTION_ANOMALY']) {
      const u = COOPERATIVE_AI_USE_CASES.find((x) => x.code === kode)!;
      const skema = JSON.stringify(u.outputSchema);
      expect(skema).toContain('buktiRujukan');
    }
  });

  it('ringkasan berkas pinjaman menuntut bukti dan berisiko tinggi', () => {
    const u = COOPERATIVE_AI_USE_CASES.find(
      (x) => x.code === 'COOPERATIVE_LOAN_FILE_SUMMARY',
    )!;
    expect(u.requiresEvidence).toBe(true);
    expect(u.riskClass).toBe('HIGH');
  });

  it('ringkasan berkas pinjaman TIDAK menyimpulkan kelayakan', () => {
    /*
     * Penolakan pinjaman menyangkut penghidupan seseorang, dan alasannya harus
     * dapat dijelaskan pengurus kepada anggota yang menanyakannya.
     */
    const u = COOPERATIVE_AI_USE_CASES.find(
      (x) => x.code === 'COOPERATIVE_LOAN_FILE_SUMMARY',
    )!;
    const skema = JSON.stringify(u.outputSchema).toLowerCase();
    for (const kata of ['layak', 'disetujui', 'ditolak', 'skor', 'rekomendasikeputusan']) {
      expect(skema).not.toContain(kata);
    }
    expect(u.description).toContain('TIDAK menyimpulkan layak');
  });
});

describe('isi prompt tidak disimpan', () => {
  it('tidak satu pun keperluan menyimpan isinya', () => {
    /*
     * Prompt koperasi memuat saldo simpanan, nama anggota, dan riwayat
     * pinjamannya. Menyimpannya utuh berarti membuat salinan kedua dari
     * seluruh data itu pada tabel yang aturan aksesnya berbeda.
     */
    for (const u of COOPERATIVE_AI_USE_CASES) {
      expect(u.storeContent).toBe(false);
    }
  });
});

describe('kuota', () => {
  it('setiap keperluan berkuota masuk akal', () => {
    for (const u of COOPERATIVE_AI_USE_CASES) {
      expect(u.hourlyQuotaPerUser).toBeGreaterThan(0);
      expect(u.hourlyQuotaPerUser).toBeLessThanOrEqual(60);
    }
  });

  it('keperluan berisiko tinggi berkuota lebih ketat daripada yang rendah', () => {
    const tinggi = COOPERATIVE_AI_USE_CASES.filter((u) => u.riskClass === 'HIGH');
    const rendah = COOPERATIVE_AI_USE_CASES.filter((u) => u.riskClass === 'LOW');
    const maksTinggi = Math.max(...tinggi.map((u) => u.hourlyQuotaPerUser));
    const minRendah = Math.min(...rendah.map((u) => u.hourlyQuotaPerUser));
    expect(maksTinggi).toBeLessThanOrEqual(minRendah);
  });
});

describe('notulen rapat', () => {
  const u = COOPERATIVE_AI_USE_CASES.find(
    (x) => x.code === 'COOPERATIVE_MEETING_MINUTES_DRAFT',
  )!;

  it('berupa DRAF, bukan notulen jadi', () => {
    expect(u.outputKind).toBe('DRAFT');
  });

  it('menyebutkan bahwa pemeriksaan manusia ditegakkan basis data', () => {
    // Bukan sekadar kebiasaan: constraint pada K-5 menolak notulen yang
    // disusun AI dan belum diperiksa manusia.
    expect(u.description).toContain('constraint basis data');
  });

  it('skemanya menuntut daftar hal yang perlu diperiksa manusia', () => {
    /*
     * Draf yang tidak menyebut bagian mana yang meragukan akan dibaca sebagai
     * draf yang seluruhnya dapat dipercaya.
     */
    expect(JSON.stringify(u.outputSchema)).toContain('halYangPerluDiperiksa');
  });
});

describe('penjelasan istilah untuk anggota', () => {
  const u = COOPERATIVE_AI_USE_CASES.find(
    (x) => x.code === 'COOPERATIVE_MEMBER_EDUCATION',
  )!;

  it('berisiko rendah dan tidak menyentuh data anggota', () => {
    expect(u.riskClass).toBe('LOW');
    expect(u.description).toContain('Tidak menyentuh data anggota');
  });

  it('bersandar pada menu portal, bukan menu pengurus', () => {
    expect(u.menuCode).toBe('COOPERATIVE_PORTAL');
  });
});

describe('keperluan yang sengaja ditolak', () => {
  it('tercatat beserta alasannya', () => {
    /*
     * Dicatat supaya tidak diusulkan lagi setiap beberapa bulan oleh orang
     * yang tidak mengetahui pertimbangannya.
     */
    expect(KEPERLUAN_YANG_DITOLAK.length).toBeGreaterThanOrEqual(5);
    for (const k of KEPERLUAN_YANG_DITOLAK) {
      expect(k.alasan.length).toBeGreaterThan(50);
    }
  });

  it('keputusan kelayakan pinjaman termasuk yang ditolak', () => {
    expect(
      KEPERLUAN_YANG_DITOLAK.some((k) => k.usulan.toLowerCase().includes('kelayakan pinjaman')),
    ).toBe(true);
  });

  it('penilaian karakter anggota termasuk yang ditolak', () => {
    expect(
      KEPERLUAN_YANG_DITOLAK.some((k) => k.usulan.toLowerCase().includes('karakter')),
    ).toBe(true);
  });

  it('perbandingan antarkoperasi termasuk yang ditolak', () => {
    // Melanggar larangan cross-tenant, betapa pun ringkas ringkasannya.
    const k = KEPERLUAN_YANG_DITOLAK.find((x) => x.usulan.includes('antarkoperasi'));
    expect(k?.alasan).toContain('cross-tenant');
  });

  it('tidak ada keperluan yang dibuat menyerupai yang ditolak', () => {
    const kodeDibuat = COOPERATIVE_AI_USE_CASES.map((u) => u.code).join(' ');
    for (const petunjuk of ['ELIGIBILITY', 'CREDIT_SCORE', 'CHARACTER', 'BENCHMARK']) {
      expect(kodeDibuat).not.toContain(petunjuk);
    }
  });
});

describe('bentuk katalog', () => {
  it('siap digabungkan ke daftar Core dengan satu sebaran', () => {
    expect(COOPERATIVE_AI_CATALOG.module).toBe('cooperative');
    expect(COOPERATIVE_AI_CATALOG.useCases).toBe(COOPERATIVE_AI_USE_CASES);
    expect(Array.isArray(COOPERATIVE_AI_CATALOG.useCases)).toBe(true);
  });
});
