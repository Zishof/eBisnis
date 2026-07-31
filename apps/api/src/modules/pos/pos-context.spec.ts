/**
 * Pengujian konteks kasir.
 *
 * Perintah prioritas POS-1 menyebut enam keadaan yang wajib diuji. Keenamnya
 * ada di sini, ditambah beberapa yang muncul saat aturannya ditulis.
 */

import {
  assignmentBerlaku,
  bolehBertransaksi,
  bolehBukaShift,
  registerYangBoleh,
  tanggalUsaha,
  type AssignmentInfo,
  type RegisterInfo,
} from './pos-context';

const HARI_INI = '2026-07-31';

const reg = (over: Partial<RegisterInfo> = {}): RegisterInfo => ({
  terminalId: 'T1',
  outletId: 'O1',
  outletActive: true,
  terminalActive: true,
  registerStatus: 'READY',
  ...over,
});

const tugas = (over: Partial<AssignmentInfo> = {}): AssignmentInfo => ({
  terminalId: 'T1',
  userSubjectId: 'U1',
  isActive: true,
  validFrom: '2026-01-01',
  validUntil: null,
  ...over,
});

describe('masa berlaku penugasan', () => {
  it('berlaku bila belum ada tanggal akhir', () => {
    expect(assignmentBerlaku(tugas(), HARI_INI)).toBe(true);
  });

  it('belum berlaku sebelum tanggal mulai', () => {
    expect(assignmentBerlaku(tugas({ validFrom: '2026-08-01' }), HARI_INI)).toBe(false);
  });

  it('tidak berlaku sesudah tanggal akhir', () => {
    expect(assignmentBerlaku(tugas({ validUntil: '2026-07-30' }), HARI_INI)).toBe(false);
  });

  it('masih berlaku tepat pada tanggal akhir', () => {
    // Penugasan yang berakhir "hari ini" masih berlaku hari ini. Kasir
    // pengganti yang hari terakhirnya jatuh hari ini tetap dapat bekerja.
    expect(assignmentBerlaku(tugas({ validUntil: HARI_INI }), HARI_INI)).toBe(true);
  });

  it('penugasan nonaktif tidak berlaku walau masa berlakunya masih ada', () => {
    expect(assignmentBerlaku(tugas({ isActive: false }), HARI_INI)).toBe(false);
  });
});

describe('register yang boleh dipakai', () => {
  it('kasir hanya melihat register yang ditugaskan kepadanya', () => {
    const hasil = registerYangBoleh(
      [reg({ terminalId: 'T1' }), reg({ terminalId: 'T2' }), reg({ terminalId: 'T3' })],
      [tugas({ terminalId: 'T1' }), tugas({ terminalId: 'T3' })],
      'U1',
      HARI_INI,
    );
    expect(hasil.map((r) => r.terminalId)).toEqual(['T1', 'T3']);
  });

  it('supervisor dapat ditugaskan pada banyak register', () => {
    const hasil = registerYangBoleh(
      [reg({ terminalId: 'T1' }), reg({ terminalId: 'T2' })],
      [
        tugas({ terminalId: 'T1', userSubjectId: 'SUP' }),
        tugas({ terminalId: 'T2', userSubjectId: 'SUP' }),
      ],
      'SUP',
      HARI_INI,
    );
    expect(hasil).toHaveLength(2);
  });

  it('penugasan milik orang lain tidak terbawa', () => {
    const hasil = registerYangBoleh(
      [reg({ terminalId: 'T1' })],
      [tugas({ terminalId: 'T1', userSubjectId: 'U2' })],
      'U1',
      HARI_INI,
    );
    expect(hasil).toEqual([]);
  });

  it('outlet nonaktif menyembunyikan registernya', () => {
    const hasil = registerYangBoleh([reg({ outletActive: false })], [tugas()], 'U1', HARI_INI);
    expect(hasil).toEqual([]);
  });

  it('register dalam perawatan tidak ditawarkan', () => {
    const hasil = registerYangBoleh(
      [reg({ registerStatus: 'MAINTENANCE' })],
      [tugas()],
      'U1',
      HARI_INI,
    );
    expect(hasil).toEqual([]);
  });

  it('tanpa penugasan sama sekali, tidak ada register yang tampil', () => {
    // Bukan "semua register" — ini kegagalan yang aman. Sistem yang menampilkan
    // segalanya ketika konfigurasinya belum lengkap adalah sistem yang
    // kebocorannya baru ketahuan setelah dipakai.
    expect(registerYangBoleh([reg(), reg({ terminalId: 'T2' })], [], 'U1', HARI_INI)).toEqual([]);
  });
});

describe('membuka shift', () => {
  it('mengizinkan kasir yang ditugaskan pada register yang siap', () => {
    const v = bolehBukaShift({
      register: reg(),
      assignments: [tugas()],
      userSubjectId: 'U1',
      tanggalUsaha: HARI_INI,
      shiftTerbuka: null,
    });
    expect(v.allowed).toBe(true);
  });

  it('menolak kasir yang tidak ditugaskan', () => {
    const v = bolehBukaShift({
      register: reg(),
      assignments: [],
      userSubjectId: 'U1',
      tanggalUsaha: HARI_INI,
    });
    expect(v).toMatchObject({ allowed: false, code: 'NOT_ASSIGNED' });
  });

  it('membedakan penugasan kedaluwarsa dari tidak pernah ditugaskan', () => {
    /*
     * Keduanya sama-sama penolakan, tetapi tindak lanjutnya berbeda: yang satu
     * perlu perpanjangan, yang lain perlu penugasan baru. Kasir yang membaca
     * pesan yang tepat tahu harus meminta apa kepada siapa.
     */
    const v = bolehBukaShift({
      register: reg(),
      assignments: [tugas({ validUntil: '2026-07-01' })],
      userSubjectId: 'U1',
      tanggalUsaha: HARI_INI,
    });
    expect(v).toMatchObject({ allowed: false, code: 'ASSIGNMENT_EXPIRED' });
  });

  it('menolak outlet nonaktif', () => {
    const v = bolehBukaShift({
      register: reg({ outletActive: false }),
      assignments: [tugas()],
      userSubjectId: 'U1',
      tanggalUsaha: HARI_INI,
    });
    expect(v).toMatchObject({ allowed: false, code: 'OUTLET_INACTIVE' });
  });

  it('menolak register nonaktif', () => {
    const v = bolehBukaShift({
      register: reg({ terminalActive: false }),
      assignments: [tugas()],
      userSubjectId: 'U1',
      tanggalUsaha: HARI_INI,
    });
    expect(v).toMatchObject({ allowed: false, code: 'REGISTER_INACTIVE' });
  });

  it('menyebut perawatan dan penangguhan secara berbeda', () => {
    const perawatan = bolehBukaShift({
      register: reg({ registerStatus: 'MAINTENANCE' }),
      assignments: [tugas()],
      userSubjectId: 'U1',
      tanggalUsaha: HARI_INI,
    });
    const ditangguhkan = bolehBukaShift({
      register: reg({ registerStatus: 'SUSPENDED' }),
      assignments: [tugas()],
      userSubjectId: 'U1',
      tanggalUsaha: HARI_INI,
    });
    expect(perawatan.message).toContain('perawatan');
    expect(ditangguhkan.message).toContain('supervisor');
  });

  it('menolak buka ganda pada register yang sama', () => {
    const v = bolehBukaShift({
      register: reg(),
      assignments: [tugas()],
      userSubjectId: 'U1',
      tanggalUsaha: HARI_INI,
      shiftTerbuka: { shiftId: 'S1', terminalId: 'T1', cashierId: 'U1' },
    });
    expect(v).toMatchObject({ allowed: false, code: 'SHIFT_ALREADY_OPEN' });
    expect(v.message).toContain('Lanjutkan');
  });

  it('menolak bila register sedang dipakai kasir lain', () => {
    const v = bolehBukaShift({
      register: reg(),
      assignments: [tugas()],
      userSubjectId: 'U1',
      tanggalUsaha: HARI_INI,
      shiftTerbuka: { shiftId: 'S1', terminalId: 'T1', cashierId: 'U2' },
    });
    expect(v).toMatchObject({ allowed: false, code: 'SHIFT_HELD_BY_OTHER' });
  });

  it('menyebut keadaan register lebih dahulu daripada penugasan', () => {
    // Kasir yang registernya rusak perlu tahu registernya rusak, bukan diberi
    // tahu bahwa ia tidak ditugaskan — yang belum tentu benar dan mengirimnya
    // ke orang yang salah.
    const v = bolehBukaShift({
      register: reg({ registerStatus: 'MAINTENANCE' }),
      assignments: [],
      userSubjectId: 'U1',
      tanggalUsaha: HARI_INI,
    });
    expect(v.code).toBe('REGISTER_NOT_OPERABLE');
  });
});

describe('bertransaksi', () => {
  it('menolak tanpa shift terbuka', () => {
    const v = bolehBertransaksi({ register: reg(), shiftTerbuka: null, userSubjectId: 'U1' });
    expect(v).toMatchObject({ allowed: false, code: 'NO_OPEN_SHIFT' });
  });

  it('menolak shift milik kasir lain', () => {
    const v = bolehBertransaksi({
      register: reg(),
      shiftTerbuka: { shiftId: 'S1', terminalId: 'T1', cashierId: 'U2' },
      userSubjectId: 'U1',
    });
    expect(v).toMatchObject({ allowed: false, code: 'SHIFT_HELD_BY_OTHER' });
  });

  it('menolak shift yang terbuka pada register lain', () => {
    const v = bolehBertransaksi({
      register: reg({ terminalId: 'T1' }),
      shiftTerbuka: { shiftId: 'S1', terminalId: 'T9', cashierId: 'U1' },
      userSubjectId: 'U1',
    });
    expect(v).toMatchObject({ allowed: false, code: 'SHIFT_HELD_BY_OTHER' });
  });

  it('mengizinkan bila konteksnya lengkap', () => {
    const v = bolehBertransaksi({
      register: reg(),
      shiftTerbuka: { shiftId: 'S1', terminalId: 'T1', cashierId: 'U1' },
      userSubjectId: 'U1',
    });
    expect(v.allowed).toBe(true);
  });

  it('menolak bila outlet dinonaktifkan di tengah shift', () => {
    // Terjadi ketika administrator menonaktifkan outlet sementara kasir sedang
    // bekerja. Transaksi berikutnya harus berhenti, bukan lolos karena shiftnya
    // terlanjur terbuka.
    const v = bolehBertransaksi({
      register: reg({ outletActive: false }),
      shiftTerbuka: { shiftId: 'S1', terminalId: 'T1', cashierId: 'U1' },
      userSubjectId: 'U1',
    });
    expect(v).toMatchObject({ allowed: false, code: 'OUTLET_INACTIVE' });
  });
});

describe('tanggal usaha', () => {
  it('memakai zona waktu outlet, bukan zona waktu peladen', () => {
    // 2026-07-31T17:30Z adalah 2026-08-01 pukul 00.30 di Jakarta.
    const saat = new Date('2026-07-31T17:30:00Z');
    expect(tanggalUsaha(saat, 'Asia/Jakarta')).toBe('2026-08-01');
    expect(tanggalUsaha(saat, 'UTC')).toBe('2026-07-31');
  });

  it('menghormati jam pergantian hari usaha', () => {
    /*
     * Gerai yang buka sampai dini hari menutup hari usahanya pukul 04.00.
     * Penjualan pukul 01.00 masuk tanggal kemarin — bila tidak, laporan harian
     * memotong penjualan tepat pada jam paling ramai.
     */
    const dini = new Date('2026-07-31T18:00:00Z'); // 01.00 WIB tanggal 1 Agustus
    expect(tanggalUsaha(dini, 'Asia/Jakarta', 4)).toBe('2026-07-31');
    expect(tanggalUsaha(dini, 'Asia/Jakarta', 0)).toBe('2026-08-01');
  });

  it('siang hari tidak terpengaruh jam pergantian', () => {
    const siang = new Date('2026-07-31T05:00:00Z'); // 12.00 WIB
    expect(tanggalUsaha(siang, 'Asia/Jakarta', 4)).toBe('2026-07-31');
  });

  it('pergantian bulan tidak salah mundur', () => {
    const dini = new Date('2026-08-01T18:00:00Z'); // 01.00 WIB tanggal 2 Agustus
    expect(tanggalUsaha(dini, 'Asia/Jakarta', 4)).toBe('2026-08-01');
  });

  it('pergantian tahun tidak salah mundur', () => {
    const dini = new Date('2026-12-31T18:00:00Z'); // 01.00 WIB tanggal 1 Januari 2027
    expect(tanggalUsaha(dini, 'Asia/Jakarta', 4)).toBe('2026-12-31');
  });
});
