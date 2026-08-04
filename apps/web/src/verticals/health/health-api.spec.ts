/**
 * Pengujian klien API kesehatan.
 *
 * Yang dijaga di sini satu hal, dan ia menyangkut jejak audit: **setiap
 * pembacaan data pasien membawa tujuan penggunaan.** Bila satu jalan terlupa,
 * peladen memang akan menolaknya — tetapi penolakan itu muncul sebagai galat di
 * hadapan petugas yang sedang melayani pasien, dan itu tempat yang paling buruk
 * untuk menemukannya.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  healthApi,
  umurDari,
  LABEL_GOLONGAN_OBAT,
  LABEL_KEYAKINAN,
  LABEL_CARA_PULANG,
  LABEL_DISPOSISI_IGD,
  LABEL_TAHAP_BEDAH,
  RUPA_TRIASE,
  LABEL_ISOLASI,
  LABEL_PRIORITAS_LAB,
  LABEL_STATUS_TEMPAT_TIDUR,
  RUPA_RISIKO,
  LABEL_STATUS_RESEP,
  LABEL_TOLAK_SPESIMEN,
  RUPA_HASIL,
  RUPA_PERINGATAN,
  RUPA_GIZI,
  LABEL_HUBUNGAN_KELUARGA,
  TUJUAN_LABEL,
  type PurposeOfUse,
} from './health-api';
import * as apiModule from '../../lib/api';

const ctx = { purpose: 'TREATMENT' as PurposeOfUse, facilityId: 'F1' };

/** Menangkap tajuk yang dikirim tanpa benar-benar memanggil jaringan. */
function tangkap() {
  const tercatat: Array<{ path: string; headers?: Record<string, string> }> = [];
  const rekam = (path: string, options?: { headers?: Record<string, string> }) => {
    tercatat.push({ path, headers: options?.headers });
    return Promise.resolve({} as never);
  };
  vi.spyOn(apiModule.api, 'get').mockImplementation(rekam as never);
  vi.spyOn(apiModule.api, 'post').mockImplementation(
    ((path: string, _body: unknown, options?: { headers?: Record<string, string> }) =>
      rekam(path, options)) as never,
  );
  return tercatat;
}

describe('tujuan penggunaan pada pembacaan rekam medis', () => {
  let tercatat: ReturnType<typeof tangkap>;

  beforeEach(() => {
    tercatat = tangkap();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pencarian pasien membawa tujuan penggunaan', async () => {
    await healthApi.searchPatients({ q: 'siti' }, ctx);
    expect(tercatat[0].headers?.['X-Purpose-Of-Use']).toBe('TREATMENT');
  });

  it('membaca satu pasien membawa tujuan penggunaan', async () => {
    await healthApi.patient('P1', ctx);
    expect(tercatat[0].headers?.['X-Purpose-Of-Use']).toBe('TREATMENT');
  });

  it('membaca kunjungan membawa tujuan penggunaan', async () => {
    await healthApi.encounter('E1', ctx);
    expect(tercatat[0].headers?.['X-Purpose-Of-Use']).toBe('TREATMENT');
  });

  it('mendaftarkan pasien membawa tujuan penggunaan', async () => {
    await healthApi.createPatient({ fullName: 'Siti' }, ctx);
    expect(tercatat[0].headers?.['X-Purpose-Of-Use']).toBe('TREATMENT');
  });

  it('menyimpan catatan klinis membawa tujuan penggunaan', async () => {
    await healthApi.saveNote({ encounterId: 'E1' }, ctx);
    expect(tercatat[0].headers?.['X-Purpose-Of-Use']).toBe('TREATMENT');
  });

  it('SETIAP jalan yang menyentuh rekam medis membawa tujuan', async () => {
    /*
     * Pemeriksaan menyeluruh, bukan satu per satu. Jalan baru yang ditambahkan
     * kelak tanpa tujuan penggunaan akan menggagalkan uji ini — dan itulah
     * gunanya: yang terlupa ditemukan di sini, bukan di hadapan pasien.
     */
    const jalan: Array<[string, () => Promise<unknown>]> = [
      ['searchPatients', () => healthApi.searchPatients({ q: 'x' }, ctx)],
      ['patient', () => healthApi.patient('P1', ctx)],
      ['createPatient', () => healthApi.createPatient({}, ctx)],
      ['merge', () => healthApi.merge({ sourceId: 'a', targetId: 'b', reason: 'sepuluh huruf' }, ctx)],
      ['addAllergy', () => healthApi.addAllergy('P1', {}, ctx)],
      ['register', () => healthApi.register({}, ctx)],
      ['callNext', () => healthApi.callNext({ facilityId: 'F1' }, ctx)],
      ['startEncounter', () => healthApi.startEncounter({ registrationId: 'R1' }, ctx)],
      ['encounter', () => healthApi.encounter('E1', ctx)],
      ['saveNote', () => healthApi.saveNote({}, ctx)],
      ['amendNote', () => healthApi.amendNote('N1', {}, ctx)],
      ['saveVitals', () => healthApi.saveVitals({}, ctx)],
      ['saveDiagnosis', () => healthApi.saveDiagnosis({}, ctx)],
      ['saveOrder', () => healthApi.saveOrder({}, ctx)],
      ['notDuplicate', () => healthApi.notDuplicate('D1', 'catatan', ctx)],
      // Farmasi. `checkDrug` termasuk meski tidak menyimpan apa pun: ia membaca
      // alergi dan riwayat obat pasien, dan pembacaan yang tidak berujung pada
      // penyimpanan tetap pembacaan.
      [
        'checkDrug',
        () => healthApi.checkDrug({ patientId: 'P1', drugId: 'D1', doseValue: 500, doseUnit: 'mg' }, ctx),
      ],
      ['createPrescription', () => healthApi.createPrescription({}, ctx)],
      ['prescription', () => healthApi.prescription('R1', ctx)],
      ['reviewPrescription', () => healthApi.reviewPrescription('R1', { approve: true }, ctx)],
      ['dispense', () => healthApi.dispense({}, ctx)],
      ['administer', () => healthApi.administer({}, ctx)],
      [
        'skipAdministration',
        () => healthApi.skipAdministration({ administrationId: 'A1', status: 'OMITTED', reason: 'x' }, ctx),
      ],
      // Laboratorium.
      ['createLabOrder', () => healthApi.createLabOrder({}, ctx)],
      ['collectSpecimen', () => healthApi.collectSpecimen('S1', {}, ctx)],
      ['receiveSpecimen', () => healthApi.receiveSpecimen('S1', {}, ctx)],
      ['enterResult', () => healthApi.enterResult({}, ctx)],
      ['verifyResult', () => healthApi.verifyResult('R1', ctx)],
      ['releaseResult', () => healthApi.releaseResult('R1', ctx)],
      ['amendResult', () => healthApi.amendResult('R1', { reason: 'sepuluh huruf' }, ctx)],
      ['patientLabResults', () => healthApi.patientLabResults('P1', ctx)],
      ['notifyCritical', () => healthApi.notifyCritical('C1', { channel: 'PHONE', notifiedTo: 'x' }, ctx)],
      ['acknowledgeCritical', () => healthApi.acknowledgeCritical('C1', { readBackValue: '7.2' }, ctx)],
      // Rawat inap.
      ['admit', () => healthApi.admit({}, ctx)],
      ['transferBed', () => healthApi.transferBed('A1', { bedId: 'B1' }, ctx)],
      ['discharge', () => healthApi.discharge('A1', { disposition: 'ROUTINE' }, ctx)],
      ['dischargeSummary', () => healthApi.dischargeSummary('A1', {}, ctx)],
      ['recordObservation', () => healthApi.recordObservation({}, ctx)],
      ['setBedStatus', () => healthApi.setBedStatus('B1', { status: 'AVAILABLE' }, ctx)],
      // Gawat darurat, bedah, intensif.
      ['triage', () => healthApi.triage({}, ctx)],
      ['retriage', () => healthApi.retriage('V1', { level: 2 }, ctx)],
      ['markSeen', () => healthApi.markSeen('V1', ctx)],
      ['edDisposition', () => healthApi.edDisposition('V1', { disposition: 'DISCHARGED' }, ctx)],
      ['scheduleSurgery', () => healthApi.scheduleSurgery({}, ctx)],
      ['markSite', () => healthApi.markSite('C1', { site: 'KIRI' }, ctx)],
      [
        'surgicalChecklist',
        () => healthApi.surgicalChecklist('C1', { phase: 'TIME_OUT', items: [] }, ctx),
      ],
      ['surgicalCount', () => healthApi.surgicalCount('C1', {}, ctx)],
      ['incision', () => healthApi.incision('C1', ctx)],
      ['leaveTheatre', () => healthApi.leaveTheatre('C1', {}, ctx)],
      ['icuAssessment', () => healthApi.icuAssessment({}, ctx)],
      // Puskesmas dan Posyandu.
      ['createFamilyFolder', () => healthApi.createFamilyFolder({}, ctx)],
      ['familyFolder', () => healthApi.familyFolder('F1', ctx)],
      ['recordGrowth', () => healthApi.recordGrowth({}, ctx)],
      ['growthHistory', () => healthApi.growthHistory('P1', ctx)],
      ['immunizationStatus', () => healthApi.immunizationStatus('P1', ctx)],
      ['recordImmunization', () => healthApi.recordImmunization({}, ctx)],
      ['recordHomeVisit', () => healthApi.recordHomeVisit({}, ctx)],
    ];

    const tanpaTujuan: string[] = [];
    for (const [nama, panggil] of jalan) {
      tercatat.length = 0;
      await panggil();
      if (!tercatat[0]?.headers?.['X-Purpose-Of-Use']) tanpaTujuan.push(nama);
    }
    expect(tanpaTujuan).toEqual([]);
  });

  it('cakupan dan daftar kunjungan SENGAJA tidak membawa tujuan penggunaan', async () => {
    /*
     * Bukan kelalaian, dan diuji supaya tidak "diperbaiki" oleh orang yang
     * mengira begitu.
     *
     * Keduanya endpoint agregat/kerja yang peladennya memang tidak menuntut
     * tajuk: cakupan tidak menyebut satu pasien pun, dan daftar kunjungan
     * adalah daftar kerja kader — menuntut tujuan penggunaan pada layar yang
     * dibuka setiap pagi akan membuat tajuk itu diisi otomatis, dan yang diisi
     * otomatis tidak menyatakan apa pun.
     */
    tercatat.length = 0;
    await healthApi.coverage('F1', 2026, 8);
    expect(tercatat[0].headers?.['X-Purpose-Of-Use']).toBeUndefined();

    tercatat.length = 0;
    await healthApi.homeVisitWorklist('F1');
    expect(tercatat[0].headers?.['X-Purpose-Of-Use']).toBeUndefined();
  });

  it('membaca isi folder keluarga membawa tujuan — ia menyebut nama anggotanya', async () => {
    await healthApi.familyFolder('F1', ctx);
    expect(tercatat[0].headers?.['X-Purpose-Of-Use']).toBe('TREATMENT');
  });

  it('akses darurat membawa alasannya, bukan hanya penandanya', async () => {
    // Penanda tanpa alasan akan ditolak peladen dan constraint basis data.
    // Mengirim keduanya bersama-sama mencegah galat yang membingungkan.
    await healthApi.patient('P1', {
      ...ctx,
      breakGlass: true,
      breakGlassReason: 'Pasien tidak sadar di IGD.',
    });
    expect(tercatat[0].headers?.['X-Break-Glass']).toBe('true');
    expect(tercatat[0].headers?.['X-Break-Glass-Reason']).toBe('Pasien tidak sadar di IGD.');
  });

  it('tanpa akses darurat, penandanya tidak dikirim sama sekali', async () => {
    await healthApi.patient('P1', ctx);
    expect(tercatat[0].headers?.['X-Break-Glass']).toBeUndefined();
  });

  it('daftar fasilitas TIDAK membawa tujuan — ia tidak menyentuh rekam medis', async () => {
    /*
     * Perbedaan ini disengaja. Menuntut tujuan penggunaan pada hal yang tidak
     * menyentuh pasien akan membuat pengguna memilih apa pun demi lewat, dan
     * pilihan yang asal justru merusak nilai jejaknya pada tempat yang penting.
     */
    await healthApi.facilities();
    expect(tercatat[0].headers?.['X-Purpose-Of-Use']).toBeUndefined();
  });

  it('lingkup fasilitas dibawa bila diketahui', async () => {
    await healthApi.patient('P1', ctx);
    expect(tercatat[0].headers?.['X-Facility-Id']).toBe('F1');
  });

  it('daftar kerja eMAR SENGAJA tidak membawa tujuan penggunaan', async () => {
    await healthApi.administrationQueue('F1');
    expect(tercatat[0].path).toBe('/health/pharmacy/administrations?facilityId=F1');
    expect(tercatat[0].headers?.['X-Purpose-Of-Use']).toBeUndefined();
  });
});

describe('bantuan tampilan', () => {
  it('umur bayi dinyatakan dalam bulan', () => {
    const enamBulanLalu = new Date();
    enamBulanLalu.setMonth(enamBulanLalu.getMonth() - 6);
    expect(umurDari(enamBulanLalu.toISOString().slice(0, 10))).toMatch(/bln$/);
  });

  it('umur dewasa dinyatakan dalam tahun', () => {
    expect(umurDari('1985-03-15')).toMatch(/th$/);
  });

  it('tanggal lahir yang tidak diketahui tidak ditebak', () => {
    // Menebak umur dari data kosong akan salah pada perhitungan dosis anak.
    expect(umurDari(null)).toBe('—');
    expect(umurDari('bukan tanggal')).toBe('—');
  });

  it('setiap tingkat keyakinan identitas punya label dan warna', () => {
    for (const k of ['VERIFIED', 'HIGH', 'MEDIUM', 'LOW']) {
      expect(LABEL_KEYAKINAN[k]?.teks).toBeTruthy();
      expect(LABEL_KEYAKINAN[k]?.kelas).toContain('bg-');
    }
  });

  it('setiap tujuan penggunaan punya label berbahasa Indonesia', () => {
    for (const [kode, label] of Object.entries(TUJUAN_LABEL)) {
      expect(label.length).toBeGreaterThan(4);
      expect(label).not.toBe(kode);
    }
  });
});

describe('rupa peringatan obat', () => {
  it('setiap tingkat peringatan punya rupa dan labelnya sendiri', () => {
    for (const tingkat of ['BLOCKING', 'CRITICAL', 'WARNING', 'INFO']) {
      expect(RUPA_PERINGATAN[tingkat]?.label).toBeTruthy();
      expect(RUPA_PERINGATAN[tingkat]?.kelas).toContain('border-');
    }
  });

  it('HANYA tingkat yang menahan yang berwarna merah', () => {
    /*
     * Bila semua peringatan tampak sama mendesak, tidak ada yang tampak
     * mendesak — dan yang benar-benar berbahaya tenggelam di antara pengingat
     * biasa. Warna merah disimpan untuk satu tingkat saja supaya ia tetap
     * berarti ketika muncul.
     */
    const merah = Object.entries(RUPA_PERINGATAN).filter(([, r]) => r.kelas.includes('rose'));
    expect(merah.map(([k]) => k)).toEqual(['BLOCKING']);
  });

  it('setiap status resep punya label yang dapat dibaca petugas', () => {
    for (const [kode, label] of Object.entries(LABEL_STATUS_RESEP)) {
      expect(label).not.toBe(kode);
      expect(label).not.toMatch(/_/);
    }
  });

  it('golongan obat dinyatakan dengan istilah Indonesia yang dipakai apoteker', () => {
    expect(LABEL_GOLONGAN_OBAT.NARCOTIC).toBe('Narkotika');
    expect(LABEL_GOLONGAN_OBAT.PRESCRIPTION).toBe('Keras');
  });
});

describe('rupa hasil laboratorium', () => {
  it('setiap penilaian punya rupa, label, dan singkatannya', () => {
    for (const f of ['CRITICAL_HIGH', 'CRITICAL_LOW', 'HIGH', 'LOW', 'NORMAL', 'UNKNOWN']) {
      expect(RUPA_HASIL[f]?.label).toBeTruthy();
      expect(RUPA_HASIL[f]?.singkat).toBeTruthy();
      expect(RUPA_HASIL[f]?.kelas).toContain('bg-');
    }
  });

  it('HANYA nilai kritis yang berwarna merah pekat', () => {
    const pekat = Object.entries(RUPA_HASIL).filter(([, r]) => r.kelas.includes('rose-6'));
    expect(pekat.map(([k]) => k).sort()).toEqual(['CRITICAL_HIGH', 'CRITICAL_LOW']);
  });

  it('hasil yang belum dapat dinilai TIDAK berwarna hijau', () => {
    /*
     * Hasil tanpa rentang rujukan yang berlaku bukan hasil normal — ia hasil
     * yang belum dapat dinilai. Mewarnainya hijau akan membuat pembacanya
     * berhenti melihat.
     */
    expect(RUPA_HASIL.UNKNOWN.kelas).not.toContain('emerald');
    expect(RUPA_HASIL.UNKNOWN.label).toContain('Belum');
  });

  it('setiap sebab penolakan spesimen punya label berbahasa Indonesia', () => {
    for (const [kode, label] of Object.entries(LABEL_TOLAK_SPESIMEN)) {
      expect(label).not.toBe(kode);
      expect(label).not.toMatch(/_/);
    }
  });

  it('prioritas laboratorium dinyatakan dengan kata yang dipahami petugas', () => {
    expect(LABEL_PRIORITAS_LAB.STAT).toBe('Segera');
    expect(LABEL_PRIORITAS_LAB.ROUTINE).toBe('Rutin');
  });
});

describe('rupa rawat inap', () => {
  it('label risiko menyebut TINDAKAN yang dituntut, bukan sekadar tingkatnya', () => {
    /*
     * Skornya bukan diagnosis; ia penentu seberapa sering pasien dilihat lagi.
     * "Tinggi" tidak memberi tahu perawat apa yang harus dilakukan; "Amati tiap
     * 30 menit" memberi tahu.
     */
    for (const t of ['HIGH', 'MEDIUM', 'LOW']) {
      expect(RUPA_RISIKO[t]?.label).toMatch(/Amati/);
    }
    expect(RUPA_RISIKO.HIGH.label).toContain('30');
  });

  it('hanya risiko tinggi yang berwarna merah pekat', () => {
    const pekat = Object.entries(RUPA_RISIKO).filter(([, r]) => r.kelas.includes('rose-6'));
    expect(pekat.map(([k]) => k)).toEqual(['HIGH']);
  });

  it('tempat tidur yang baru ditinggalkan TIDAK disebut kosong', () => {
    /*
     * Menyebutnya kosong akan membuat orang menempatkan pasien di sana — dan
     * itulah cara paling langsung memindahkan infeksi dari pasien yang sudah
     * pulang kepada pasien yang baru masuk.
     */
    expect(LABEL_STATUS_TEMPAT_TIDUR.CLEANING).toBe('Menunggu pembersihan');
    expect(LABEL_STATUS_TEMPAT_TIDUR.CLEANING).not.toContain('osong');
    expect(LABEL_STATUS_TEMPAT_TIDUR.AVAILABLE).toBe('Siap dipakai');
  });

  it('setiap jenis isolasi dan cara pulang punya label Indonesia', () => {
    for (const peta of [LABEL_ISOLASI, LABEL_CARA_PULANG]) {
      for (const [kode, label] of Object.entries(peta)) {
        expect(label).not.toBe(kode);
        expect(label).not.toMatch(/_/);
      }
    }
  });

  it('pulang paksa disebut apa adanya, bukan diperhalus', () => {
    // Laporan yang tidak dapat membedakan pulang paksa dari pulang biasa tidak
    // dapat memperbaiki sebabnya.
    expect(LABEL_CARA_PULANG.AGAINST_MEDICAL_ADVICE).toBe('Pulang paksa');
  });
});

describe('rupa gawat darurat dan bedah', () => {
  it('lima tingkat triase, masing-masing berwarna dan berlabel', () => {
    for (const t of [1, 2, 3, 4, 5]) {
      expect(RUPA_TRIASE[t]?.label).toBeTruthy();
      expect(RUPA_TRIASE[t]?.kelas).toContain('bg-');
    }
  });

  it('hanya tingkat 1 dan 2 berwarna pekat', () => {
    /*
     * Perawat yang memindai papan dari seberang ruangan harus dapat melihat
     * siapa yang tidak boleh menunggu, tanpa membaca satu angka pun. Bila
     * seluruh tingkat berwarna pekat, tidak ada yang menonjol.
     */
    const pekat = Object.entries(RUPA_TRIASE).filter(([, r]) => r.kelas.includes('text-white'));
    expect(pekat.map(([k]) => k).sort()).toEqual(['1', '2']);
  });

  it('"pergi tanpa dilihat" TIDAK diperhalus menjadi "pulang"', () => {
    /*
     * Menyamarkannya akan menyembunyikan angka yang paling penting bagi mutu
     * IGD: berapa banyak orang yang menyerah menunggu.
     */
    expect(LABEL_DISPOSISI_IGD.LEFT_WITHOUT_BEING_SEEN).toBe('Pergi tanpa dilihat');
    expect(LABEL_DISPOSISI_IGD.LEFT_WITHOUT_BEING_SEEN).not.toContain('Pulang');
  });

  it('setiap disposisi IGD punya label Indonesia', () => {
    for (const [kode, label] of Object.entries(LABEL_DISPOSISI_IGD)) {
      expect(label).not.toBe(kode);
      expect(label).not.toMatch(/_/);
    }
  });

  it('tahap bedah dinamai menurut SAAT-nya, bukan istilah asingnya', () => {
    // "Time out" tidak berarti apa-apa bagi perawat yang belum pernah membaca
    // panduannya; "jeda sebelum sayatan" mengatakan kapan ia terjadi.
    expect(LABEL_TAHAP_BEDAH.TIME_OUT).toBe('Jeda sebelum sayatan');
    expect(LABEL_TAHAP_BEDAH.SIGN_IN).toContain('pembiusan');
  });
});


describe('rupa status gizi', () => {
  it('yang menuntut tindakan ditandai mendesak, yang normal tidak', () => {
    /*
     * Warna yang dipakai untuk segalanya sama saja dengan tidak berwarna. Layar
     * Posyandu dipakai kader sambil berdiri di antara puluhan ibu.
     */
    for (const k of [
      'SEVERELY_WASTED',
      'WASTED',
      'SEVERELY_STUNTED',
      'STUNTED',
      'SEVERELY_UNDERWEIGHT',
      'UNDERWEIGHT',
      'OBESE',
      'OVERWEIGHT',
    ]) {
      expect(RUPA_GIZI[k]?.mendesak).toBe(true);
    }
    for (const k of ['NORMAL', 'TALL', 'RISK_OVERWEIGHT']) {
      expect(RUPA_GIZI[k]?.mendesak).toBe(false);
    }
  });

  it('KOSAKATANYA LENGKAP terhadap yang dapat dikembalikan peladen', () => {
    /*
     * Disalin dari `health-community.ts`, tidak disusun dari ingatan. Status
     * yang tidak dikenal akan tampil sebagai kode mentah di hadapan kader —
     * dan kader yang membaca "SEVERELY_WASTED" tidak tahu itu artinya gizi
     * buruk.
     *
     * Pelajaran H-12: kosakata yang disusun dari ingatan meleset, dan
     * melesetnya baru terlihat di hadapan pengguna.
     */
    const dariPeladen = [
      'SEVERELY_STUNTED',
      'STUNTED',
      'NORMAL',
      'TALL',
      'SEVERELY_WASTED',
      'WASTED',
      'OVERWEIGHT',
      'OBESE',
      'SEVERELY_UNDERWEIGHT',
      'UNDERWEIGHT',
      'RISK_OVERWEIGHT',
    ];
    const hilang = dariPeladen.filter((k) => !RUPA_GIZI[k]);
    expect(hilang).toEqual([]);
  });

  it('setiap status punya label berbahasa Indonesia, bukan kode mentah', () => {
    for (const [kode, rupa] of Object.entries(RUPA_GIZI)) {
      expect(rupa.label).not.toBe(kode);
      expect(rupa.label.length).toBeGreaterThan(3);
    }
  });

  it('hubungan keluarga punya label untuk kepala keluarga dan anak', () => {
    expect(LABEL_HUBUNGAN_KELUARGA.HEAD).toBeTruthy();
    expect(LABEL_HUBUNGAN_KELUARGA.CHILD).toBeTruthy();
  });
});
