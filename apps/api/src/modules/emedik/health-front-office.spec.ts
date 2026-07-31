/**
 * Pengujian aturan front office.
 *
 * Tiga hal dijaga paling ketat, dan ketiganya berakibat langsung pada orang:
 * urutan antrean yang adil, tanggal usaha yang benar menurut zona waktu
 * fasilitas, dan pendaftaran contoh yang tidak pernah tertagih.
 */

import {
  berikutnya,
  bolehBuatJanji,
  labelAntrean,
  prioritasDariUmur,
  susunNomorPendaftaran,
  susunSlot,
  tanggalUsaha,
  tentukanTagihan,
  tingkatPrioritas,
  urutkanAntrean,
  type AntreanBaris,
  type JadwalHarian,
} from './health-front-office';

const antre = (over: Partial<AntreanBaris>): AntreanBaris => ({
  id: 'q1',
  queuePrefix: 'A',
  queueNumber: 1,
  priority: 0,
  status: 'WAITING',
  createdAt: '2026-08-01T08:00:00Z',
  ...over,
});

describe('label antrean', () => {
  it('menyertakan awalan unit', () => {
    // Satu fasilitas punya beberapa antrean sekaligus. Nomor tanpa awalan
    // tidak memberi tahu pasien antrean mana yang sedang dipanggil.
    expect(labelAntrean('A', 7)).toBe('A-007');
    expect(labelAntrean('B', 42)).toBe('B-042');
  });

  it('membersihkan awalan bertanda baca', () => {
    expect(labelAntrean('A-1', 7)).toBe('A1-007');
  });

  it('memberi awalan cadangan bila kosong', () => {
    expect(labelAntrean('', 7)).toBe('A-007');
  });
});

describe('urutan antrean', () => {
  it('nomor kecil dipanggil lebih dahulu', () => {
    const hasil = urutkanAntrean([
      antre({ id: 'b', queueNumber: 3 }),
      antre({ id: 'a', queueNumber: 1 }),
      antre({ id: 'c', queueNumber: 2 }),
    ]);
    // a bernomor 1, c bernomor 2, b bernomor 3.
    expect(hasil.map((h) => h.id)).toEqual(['a', 'c', 'b']);
  });

  it('prioritas menang atas nomor', () => {
    const hasil = urutkanAntrean([
      antre({ id: 'biasa', queueNumber: 1, priority: 0 }),
      antre({ id: 'lansia', queueNumber: 9, priority: 3 }),
    ]);
    expect(hasil[0].id).toBe('lansia');
  });

  it('prioritas TIDAK menghapus urutan di dalam prioritas yang sama', () => {
    /*
     * Lansia yang datang belakangan tetap menunggu lansia yang datang lebih
     * dahulu. Tanpa aturan ini, antrean prioritas menjadi antrean tanpa urutan,
     * dan yang paling lama menunggu justru paling sering disalip.
     */
    const hasil = urutkanAntrean([
      antre({ id: 'lansia2', queueNumber: 8, priority: 3 }),
      antre({ id: 'lansia1', queueNumber: 5, priority: 3 }),
    ]);
    expect(hasil.map((h) => h.id)).toEqual(['lansia1', 'lansia2']);
  });

  it('yang sudah dipanggil didahulukan atas yang belum, pada prioritas sama', () => {
    // Pasien yang sudah bangkit dari kursinya tidak boleh disalip.
    const hasil = urutkanAntrean([
      antre({ id: 'belum', queueNumber: 1, status: 'WAITING' }),
      antre({ id: 'sudah', queueNumber: 5, status: 'CALLED' }),
    ]);
    expect(hasil[0].id).toBe('sudah');
  });

  it('yang sudah dilayani tidak ikut antre lagi', () => {
    const hasil = urutkanAntrean([
      antre({ id: 'selesai', status: 'SERVED' }),
      antre({ id: 'batal', status: 'CANCELLED' }),
      antre({ id: 'menunggu', queueNumber: 9 }),
    ]);
    expect(hasil.map((h) => h.id)).toEqual(['menunggu']);
  });

  it('gawat darurat mendahului seluruhnya', () => {
    const hasil = urutkanAntrean([
      antre({ id: 'lansia', queueNumber: 1, priority: 3 }),
      antre({ id: 'gawat', queueNumber: 99, priority: 9 }),
    ]);
    expect(hasil[0].id).toBe('gawat');
  });

  it('antrean kosong tidak memanggil siapa pun', () => {
    expect(berikutnya([])).toBeNull();
    expect(berikutnya([antre({ status: 'SERVED' })])).toBeNull();
  });

  it('awalan berbeda tetap terurut secara tertentu', () => {
    // Hasil yang berubah-ubah untuk data yang sama akan membuat layar antrean
    // tampak melompat-lompat.
    const baris = [antre({ id: 'b1', queuePrefix: 'B' }), antre({ id: 'a1', queuePrefix: 'A' })];
    expect(urutkanAntrean(baris).map((h) => h.id)).toEqual(['a1', 'b1']);
    expect(urutkanAntrean([...baris].reverse()).map((h) => h.id)).toEqual(['a1', 'b1']);
  });
});

describe('tingkat prioritas', () => {
  it('gawat darurat tertinggi', () => {
    expect(tingkatPrioritas('EMERGENCY')).toBe(9);
  });

  it('tanpa alasan tidak berprioritas', () => {
    expect(tingkatPrioritas('NONE')).toBe(0);
  });

  it('nilainya tetap, bukan urutan daftar', () => {
    /*
     * Angka disimpan pada baris antrean. Bila nilainya bergeser saat kategori
     * baru ditambahkan, baris lama akan berubah artinya — lansia kemarin
     * menjadi ibu hamil hari ini.
     */
    expect(tingkatPrioritas('ELDERLY')).toBe(3);
    expect(tingkatPrioritas('PREGNANT')).toBe(4);
    expect(tingkatPrioritas('INFANT')).toBe(5);
  });

  it('bayi didahulukan atas lansia', () => {
    expect(tingkatPrioritas('INFANT')).toBeGreaterThan(tingkatPrioritas('ELDERLY'));
  });
});

describe('prioritas dari umur', () => {
  it('enam puluh tahun ke atas adalah lanjut usia', () => {
    expect(prioritasDariUmur(60)).toBe('ELDERLY');
    expect(prioritasDariUmur(75)).toBe('ELDERLY');
    expect(prioritasDariUmur(59)).toBe('NONE');
  });

  it('di bawah satu tahun adalah bayi', () => {
    expect(prioritasDariUmur(0)).toBe('INFANT');
    expect(prioritasDariUmur(0.5)).toBe('INFANT');
    expect(prioritasDariUmur(1)).toBe('NONE');
  });

  it('umur yang tidak diketahui tidak berprioritas', () => {
    // Menebak prioritas dari umur yang tidak diketahui akan mendahulukan orang
    // yang datanya kebetulan kosong.
    expect(prioritasDariUmur(null)).toBe('NONE');
    expect(prioritasDariUmur(Number.NaN)).toBe('NONE');
  });
});

describe('slot janji temu', () => {
  const jadwal: JadwalHarian = {
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '10:00',
    slotMinutes: 30,
    capacityPerSlot: 2,
  };

  it('membagi jadwal menjadi slot berdurasi tetap', () => {
    const slots = susunSlot(jadwal, new Date('2026-08-03T00:00:00'));
    expect(slots).toHaveLength(4); // 08.00, 08.30, 09.00, 09.30
    expect(slots[0].capacity).toBe(2);
  });

  it('tidak membuat slot yang tidak muat penuh', () => {
    /*
     * Slot lima menit di ujung jadwal akan menjanjikan waktu periksa yang
     * tidak pernah cukup, dan pasien terakhir selalu terlambat dilayani.
     */
    const ganjil: JadwalHarian = { ...jadwal, endTime: '09:50' };
    const slots = susunSlot(ganjil, new Date('2026-08-03T00:00:00'));
    expect(slots).toHaveLength(3); // 08.00, 08.30, 09.00 — sisa 20 menit dibuang
  });

  it('membaca jumlah yang sudah terpakai', () => {
    const tanggal = new Date('2026-08-03T00:00:00');
    const pertama = susunSlot(jadwal, tanggal)[0];
    const slots = susunSlot(jadwal, tanggal, { [pertama.startsAt.toISOString()]: 2 });
    expect(slots[0].booked).toBe(2);
  });
});

describe('boleh membuat janji temu', () => {
  const now = new Date('2026-08-01T09:00:00Z');
  const slotKosong = {
    startsAt: new Date('2026-08-03T01:00:00Z'),
    endsAt: new Date('2026-08-03T01:30:00Z'),
    capacity: 2,
    booked: 0,
  };

  it('mengizinkan slot yang masih kosong di masa depan', () => {
    expect(
      bolehBuatJanji({ slot: slotKosong, now, patientHasOverlapping: false, scheduleClosed: false })
        .allowed,
    ).toBe(true);
  });

  it('menolak jadwal yang ditutup', () => {
    const v = bolehBuatJanji({
      slot: slotKosong,
      now,
      patientHasOverlapping: false,
      scheduleClosed: true,
    });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('ditutup');
  });

  it('menolak waktu yang sudah lewat, dan mengarahkan ke loket', () => {
    const v = bolehBuatJanji({
      slot: { ...slotKosong, startsAt: new Date('2026-07-01T01:00:00Z') },
      now,
      patientHasOverlapping: false,
      scheduleClosed: false,
    });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('loket');
  });

  it('menolak slot penuh, dan menyebutkan angkanya', () => {
    const v = bolehBuatJanji({
      slot: { ...slotKosong, booked: 2 },
      now,
      patientHasOverlapping: false,
      scheduleClosed: false,
    });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('2');
  });

  it('menolak janji yang bertumpang tindih bagi pasien yang sama', () => {
    /*
     * Pasien dengan dua janji bertumpang tindih pasti gagal hadir pada salah
     * satunya, dan yang tercatat adalah "tidak hadir" — yang pada sebagian
     * fasilitas berakibat pada kemudahan mendaftar berikutnya.
     */
    const v = bolehBuatJanji({
      slot: slotKosong,
      now,
      patientHasOverlapping: true,
      scheduleClosed: false,
    });
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('bertumpang tindih');
  });

  it('menolak bila tidak ada sesi pada waktu itu', () => {
    expect(
      bolehBuatJanji({ slot: null, now, patientHasOverlapping: false, scheduleClosed: false }).allowed,
    ).toBe(false);
  });
});

describe('tanggal usaha menurut zona waktu fasilitas', () => {
  it('memakai zona waktu fasilitas, bukan peladen', () => {
    /*
     * Pukul 23.30 WIT tanggal 1 masih tanggal 1 di Jayapura, tetapi sudah
     * 16.30 UTC. Memakai waktu peladen akan memindahkan pendaftaran itu ke
     * hari yang salah — lalu jumlah pendaftaran harian salah pada DUA hari,
     * dan jenjang tarifnya ikut salah.
     */
    const saat = new Date('2026-08-01T14:30:00Z'); // 23.30 WIT, 21.30 WIB
    expect(tanggalUsaha(saat, 'Asia/Jayapura')).toBe('2026-08-01');
    expect(tanggalUsaha(saat, 'Asia/Jakarta')).toBe('2026-08-01');
  });

  it('membedakan tanggal saat melewati tengah malam setempat', () => {
    const saat = new Date('2026-08-01T16:30:00Z'); // 01.30 WIT tanggal 2, 23.30 WIB tanggal 1
    expect(tanggalUsaha(saat, 'Asia/Jayapura')).toBe('2026-08-02');
    expect(tanggalUsaha(saat, 'Asia/Jakarta')).toBe('2026-08-01');
  });

  it('zona waktu yang tidak dikenal tidak menghentikan pendaftaran', () => {
    // Jatuh ke WIB. Menolak pendaftaran pasien karena salah ketik zona waktu
    // adalah kerugian yang jauh lebih besar daripada tanggal yang meleset.
    expect(tanggalUsaha(new Date('2026-08-01T05:00:00Z'), 'Mars/Olympus')).toBe('2026-08-01');
  });
});

describe('nomor pendaftaran', () => {
  it('menyertakan kode fasilitas dan tanggal', () => {
    expect(susunNomorPendaftaran('KLN01', '2026-08-01', 7)).toBe('KLN01-20260801-0007');
  });

  it('membersihkan kode bertanda baca', () => {
    expect(susunNomorPendaftaran('KLN-01', '2026-08-01', 7)).toBe('KLN01-20260801-0007');
  });
});

describe('penentuan tagihan saat pendaftaran dibuat', () => {
  const wajar = {
    isSampleData: false,
    isTrainingTenant: false,
    isTestPatient: false,
    cancelledBeforeService: false,
    supersededByCorrection: false,
  };

  it('pendaftaran wajar tertagih dan tanpa alasan pengecualian', () => {
    const h = tentukanTagihan(wajar);
    expect(h.isBillable).toBe(true);
    expect(h.nonBillableReason).toBeNull();
  });

  it('data contoh tidak tertagih dan menyimpan sebabnya', () => {
    /*
     * Sebabnya WAJIB tersimpan. Tanpa itu, laporan penagihan tidak dapat
     * menjelaskan selisih antara jumlah pendaftaran dan jumlah yang ditagih —
     * dan selisih yang tidak dapat dijelaskan akan dipersoalkan penyewa.
     */
    const h = tentukanTagihan({ ...wajar, isSampleData: true });
    expect(h.isBillable).toBe(false);
    expect(h.nonBillableReason).toBe('SAMPLE_DATA');
  });

  it('lingkungan pelatihan tidak tertagih', () => {
    expect(tentukanTagihan({ ...wajar, isTrainingTenant: true }).nonBillableReason).toBe(
      'TRAINING_TENANT',
    );
  });

  it('dibatalkan sebelum layanan tidak tertagih', () => {
    expect(tentukanTagihan({ ...wajar, cancelledBeforeService: true }).nonBillableReason).toBe(
      'CANCELLED_BEFORE_SERVICE',
    );
  });

  it('setiap yang tidak tertagih selalu punya alasan', () => {
    // Constraint basis data menuntutnya; pengujian ini memastikan layanan tidak
    // pernah menghasilkan baris yang ditolak constraint itu.
    const kasus = [
      { isSampleData: true },
      { isTrainingTenant: true },
      { isTestPatient: true },
      { cancelledBeforeService: true },
      { supersededByCorrection: true },
    ];
    for (const k of kasus) {
      const h = tentukanTagihan({ ...wajar, ...k });
      expect(h.isBillable).toBe(false);
      expect(h.nonBillableReason).toBeTruthy();
    }
  });
});
