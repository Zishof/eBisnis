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
import { healthApi, umurDari, LABEL_KEYAKINAN, TUJUAN_LABEL, type PurposeOfUse } from './health-api';
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
    ];

    const tanpaTujuan: string[] = [];
    for (const [nama, panggil] of jalan) {
      tercatat.length = 0;
      await panggil();
      if (!tercatat[0]?.headers?.['X-Purpose-Of-Use']) tanpaTujuan.push(nama);
    }
    expect(tanpaTujuan).toEqual([]);
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
