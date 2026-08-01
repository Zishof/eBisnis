/**
 * Pengujian aturan registri alat kesehatan dan gateway.
 *
 * Yang dijaga paling ketat: kendali jarak jauh mati secara bawaan, hasil tanpa
 * identitas pasien tidak ditebak, kredensial tidak pernah disimpan sebagai
 * nilai, dan kalibrasi kedaluwarsa menandai — tidak menolak.
 */

import {
  PENGAITAN_TERLARANG,
  PROTOKOL_STATUS,
  bolehKirimPerintah,
  bolehNyalakanKendaliJauh,
  bolehPakaiProtokol,
  bolehSimpanKredensial,
  bolehTerimaPesanan,
  kaitkanPasien,
  periksaProvenance,
  periksaWaktu,
  pesanDuplikat,
  type Protokol,
  type StatusAlat,
} from './health-device';

describe('protokol', () => {
  it('HL7 v2 dan ASTM dapat dipakai — keduanya protokol terbuka', () => {
    expect(bolehPakaiProtokol('HL7V2').allowed).toBe(true);
    expect(bolehPakaiProtokol('ASTM').allowed).toBe(true);
  });

  it('DICOM terhalang PACS, dan penghalangnya DISEBUTKAN', () => {
    /*
     * Daftar yang hanya berkata "tidak didukung" akan ditanyakan ulang setiap
     * tiga bulan oleh orang yang berbeda.
     */
    const h = bolehPakaiProtokol('DICOM');
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('PACS');
    expect(h.message).toContain('bukan tidak didukung');
  });

  it('FHIR terhalang SATUSEHAT', () => {
    expect(bolehPakaiProtokol('FHIR').message).toContain('SATUSEHAT');
  });

  it('MQTT menunggu persetujuan keamanan', () => {
    expect(bolehPakaiProtokol('MQTT').message).toContain('persetujuan keamanan');
  });

  it('protokol yang tidak dikenal ditolak', () => {
    expect(bolehPakaiProtokol('TIDAK_ADA' as Protokol).allowed).toBe(false);
  });

  it('setiap protokol yang terhalang menyebut penghalangnya', () => {
    for (const [kode, status] of Object.entries(PROTOKOL_STATUS)) {
      if (!status.usable) {
        expect(status.blockedBy).toBeTruthy();
        expect(kode).toBeTruthy();
      }
    }
  });

  it('pencatatan manual selalu dapat dipakai', () => {
    // Alat yang tidak mampu menyimpan hasilnya saat terputus tetap harus dapat
    // dicatat — dengan penanda yang membedakannya, selamanya.
    expect(bolehPakaiProtokol('MANUAL_ENTRY').allowed).toBe(true);
  });
});

describe('kelayakan alat menerima pesanan', () => {
  const hariIni = '2026-08-01';

  it('alat aktif menerima pesanan', () => {
    expect(bolehTerimaPesanan({ status: 'ACTIVE', today: hariIni }).allowed).toBe(true);
  });

  it('alat DOWNTIME tidak menerima pesanan baru', () => {
    const h = bolehTerimaPesanan({ status: 'DOWNTIME', today: hariIni });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('DOWNTIME');
  });

  it('alat yang sudah dipensiunkan tidak menerima pesanan', () => {
    expect(bolehTerimaPesanan({ status: 'RETIRED', today: hariIni }).allowed).toBe(false);
  });

  it('alat yang baru terdaftar belum menerima pesanan', () => {
    expect(bolehTerimaPesanan({ status: 'REGISTERED', today: hariIni }).allowed).toBe(false);
  });

  it('kalibrasi kedaluwarsa MENANDAI, tidak menolak', () => {
    /*
     * Menolaknya akan menghentikan pelayanan pada alat yang mungkin masih
     * benar; menandainya membuat yang membaca hasilnya tahu apa yang sedang
     * dibacanya.
     */
    const h = bolehTerimaPesanan({
      status: 'ACTIVE',
      calibrationDueAt: '2026-01-01',
      today: hariIni,
    });
    expect(h.allowed).toBe(true);
    expect(h.warning).toContain('mungkin masih benar');
  });

  it('kalibrasi yang masih berlaku tidak menandai apa pun', () => {
    const h = bolehTerimaPesanan({
      status: 'ACTIVE',
      calibrationDueAt: '2026-12-31',
      today: hariIni,
    });
    expect(h.warning).toBeUndefined();
  });

  it('alat dalam pemeliharaan tetap menerima', () => {
    // MAINTENANCE bukan DOWNTIME: yang pertama terjadwal, yang kedua rusak.
    expect(bolehTerimaPesanan({ status: 'MAINTENANCE' as StatusAlat, today: hariIni }).allowed)
      .toBe(true);
  });
});

describe('pengaitan pasien', () => {
  it('nomor pesanan adalah cara yang paling dapat dipercaya', () => {
    const h = kaitkanPasien({ orderId: 'ORD-1' });
    expect(h.method).toBe('ORDER_ID');
    expect(h.message).toContain('alatnya sendiri');
  });

  it('pemindaian gelang dipakai bila tidak ada nomor pesanan', () => {
    const h = kaitkanPasien({ scannedPatientId: 'pat-1' });
    expect(h.method).toBe('WRISTBAND_SCAN');
    expect(h.patientId).toBe('pat-1');
  });

  it('pengaitan manual wajib mencatat SIAPA', () => {
    const h = kaitkanPasien({ manualPatientId: 'pat-1' });
    expect(h.linked).toBe(false);
    expect(h.message).toContain('milik orang lain');
  });

  it('pengaitan manual dengan nama diterima', () => {
    const h = kaitkanPasien({ manualPatientId: 'pat-1', manualLinkedBy: 'user-1' });
    expect(h.method).toBe('MANUAL');
    expect(h.linked).toBe(true);
  });

  it('hasil tanpa identitas TIDAK DITEBAK', () => {
    /*
     * Mencocokkan berdasarkan nama akan benar sembilan puluh sembilan kali dan
     * salah sekali — dan yang sekali itu adalah hasil laboratorium orang lain
     * di rekam medis seseorang.
     */
    const h = kaitkanPasien({});
    expect(h.linked).toBe(false);
    expect(h.needsHumanLink).toBe(true);
    expect(h.message).toContain('salah sekali');
  });

  it('nomor pesanan menang atas pemindaian', () => {
    const h = kaitkanPasien({ orderId: 'ORD-1', scannedPatientId: 'pat-1' });
    expect(h.method).toBe('ORDER_ID');
  });

  it('dua cara pengaitan dilarang dan namanya tercatat', () => {
    expect(PENGAITAN_TERLARANG).toEqual(['NAME_MATCH', 'ROOM_OCCUPANCY']);
  });
});

describe('waktu pengambilan dan penerimaan', () => {
  it('selisih wajar tidak ditandai', () => {
    const h = periksaWaktu({
      capturedAt: '2026-08-01T10:00:00Z',
      receivedAt: '2026-08-01T10:05:00Z',
    });
    expect(h.drifted).toBe(false);
    expect(h.driftMinutes).toBe(5);
  });

  it('selisih besar DITANDAI, tidak ditolak', () => {
    /*
     * Alat yang menyimpan hasil selama jaringan terputus memang mengirimnya
     * terlambat, dan hasilnya sah — yang tidak sah adalah mencatat waktu
     * tibanya sebagai waktu pengambilannya.
     */
    const h = periksaWaktu({
      capturedAt: '2026-08-01T02:00:00Z',
      receivedAt: '2026-08-01T10:00:00Z',
    });
    expect(h.drifted).toBe(true);
    expect(h.driftMinutes).toBe(480);
    expect(h.message).toContain('hasilnya sah');
  });

  it('waktu pengambilan di MASA DEPAN selalu janggal', () => {
    // Jam alatnya melenceng; urutan kejadian klinis yang dihitung darinya akan
    // kacau.
    const h = periksaWaktu({
      capturedAt: '2026-08-01T12:00:00Z',
      receivedAt: '2026-08-01T10:00:00Z',
    });
    expect(h.futureCapture).toBe(true);
    expect(h.message).toContain('melenceng');
  });

  it('ambang toleransi dapat diatur', () => {
    const h = periksaWaktu({
      capturedAt: '2026-08-01T09:00:00Z',
      receivedAt: '2026-08-01T10:00:00Z',
      toleranceMinutes: 120,
    });
    expect(h.drifted).toBe(false);
  });

  it('waktu yang tidak sah ditolak', () => {
    expect(() =>
      periksaWaktu({ capturedAt: 'bukan-waktu', receivedAt: '2026-08-01T10:00:00Z' }),
    ).toThrow();
  });
});

describe('provenance', () => {
  const lengkap = {
    deviceId: 'dev-1',
    gatewayId: 'gw-1',
    sourceProtocol: 'HL7V2' as Protokol,
    rawMessageHash: 'sha256:abc',
    capturedAt: '2026-08-01T10:00:00Z',
    receivedAt: '2026-08-01T10:01:00Z',
  };

  it('provenance lengkap diterima', () => {
    expect(periksaProvenance(lengkap).complete).toBe(true);
  });

  it('sidik jari pesan asli WAJIB', () => {
    /*
     * Ia menjawab pertanyaan yang muncul ketika hasilnya dipersengketakan:
     * apakah yang tersimpan sama dengan yang dikirim alat? Tanpanya, jawabannya
     * hanya dugaan.
     */
    const h = periksaProvenance({ ...lengkap, rawMessageHash: null });
    expect(h.complete).toBe(false);
    expect(h.missing).toContain('sidik jari pesan asli');
    expect(h.message).toContain('dipersengketakan');
  });

  it('pencatatan manual tidak dituntut gateway maupun sidik jari', () => {
    const h = periksaProvenance({
      ...lengkap,
      sourceProtocol: 'MANUAL_ENTRY',
      gatewayId: null,
      rawMessageHash: null,
    });
    expect(h.complete).toBe(true);
  });

  it('yang kurang disebutkan satu per satu', () => {
    const h = periksaProvenance({});
    expect(h.missing.length).toBeGreaterThanOrEqual(5);
  });

  it('kedua waktu wajib', () => {
    expect(periksaProvenance({ ...lengkap, capturedAt: null }).missing)
      .toContain('waktu pengambilan');
    expect(periksaProvenance({ ...lengkap, receivedAt: null }).missing)
      .toContain('waktu penerimaan');
  });
});

describe('kendali jarak jauh', () => {
  const lengkap = {
    hasWrittenApproval: true,
    hasClinicalRiskReview: true,
    allowedCommands: ['SET_RATE'],
    hasValueLimits: true,
    hasCommandLogging: true,
    hasEmergencyStop: true,
  };

  it('seluruh syarat terpenuhi boleh dinyalakan', () => {
    expect(bolehNyalakanKendaliJauh({ deviceCategory: 'INFUSION_PUMP', syarat: lengkap }).allowed)
      .toBe(true);
  });

  it('tanpa syarat apa pun DITOLAK, dan keenam yang kurang disebutkan', () => {
    const h = bolehNyalakanKendaliJauh({
      deviceCategory: 'INFUSION_PUMP',
      syarat: {
        hasWrittenApproval: false,
        hasClinicalRiskReview: false,
        allowedCommands: [],
        hasValueLimits: false,
        hasCommandLogging: false,
        hasEmergencyStop: false,
      },
    });
    expect(h.allowed).toBe(false);
    expect(h.missing).toHaveLength(6);
  });

  it('penolakannya menyebut mengapa aturannya sekeras itu', () => {
    /*
     * Pompa infus yang dapat dikendalikan jarak jauh adalah pompa yang dapat
     * dinaikkan dosisnya oleh siapa pun yang menembus jaringannya.
     */
    const h = bolehNyalakanKendaliJauh({
      deviceCategory: 'INFUSION_PUMP',
      syarat: { ...lengkap, hasEmergencyStop: false },
    });
    expect(h.message).toContain('tidak dapat diperbaiki');
  });

  it('kurang satu syarat pun tetap ditolak', () => {
    expect(
      bolehNyalakanKendaliJauh({
        deviceCategory: 'VENTILATOR',
        syarat: { ...lengkap, hasClinicalRiskReview: false },
      }).missing,
    ).toEqual(['telaah risiko klinis']);
  });

  it('daftar perintah kosong dianggap kurang', () => {
    expect(
      bolehNyalakanKendaliJauh({
        deviceCategory: 'PUMP',
        syarat: { ...lengkap, allowedCommands: [] },
      }).missing,
    ).toEqual(['daftar perintah yang diizinkan']);
  });
});

describe('pengiriman perintah', () => {
  it('kendali yang mati menolak semua perintah', () => {
    const h = bolehKirimPerintah({
      remoteControlEnabled: false,
      command: 'SET_RATE',
      allowedCommands: ['SET_RATE'],
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('Bawaannya memang mati');
  });

  it('perintah pada daftar putih diizinkan', () => {
    expect(
      bolehKirimPerintah({
        remoteControlEnabled: true,
        command: 'SET_RATE',
        allowedCommands: ['SET_RATE'],
      }).allowed,
    ).toBe(true);
  });

  it('perintah di LUAR daftar putih ditolak', () => {
    /*
     * Daftar hitam akan melewatkan setiap perintah yang ditambahkan pembaruan
     * perangkat lunak alat — dan pembaruan itu datang tanpa memberi tahu siapa
     * pun.
     */
    const h = bolehKirimPerintah({
      remoteControlEnabled: true,
      command: 'FACTORY_RESET',
      allowedCommands: ['SET_RATE'],
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('tanpa memberi tahu siapa pun');
  });

  it('nilai yang melampaui batas atas DITOLAK', () => {
    const h = bolehKirimPerintah({
      remoteControlEnabled: true,
      command: 'SET_RATE',
      allowedCommands: ['SET_RATE'],
      value: 500,
      maxValue: 100,
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('perintah yang mencelakakan');
  });

  it('nilai di bawah batas bawah ditolak', () => {
    expect(
      bolehKirimPerintah({
        remoteControlEnabled: true,
        command: 'SET_RATE',
        allowedCommands: ['SET_RATE'],
        value: 0,
        minValue: 1,
      }).allowed,
    ).toBe(false);
  });

  it('nilai di dalam batas diterima', () => {
    expect(
      bolehKirimPerintah({
        remoteControlEnabled: true,
        command: 'SET_RATE',
        allowedCommands: ['SET_RATE'],
        value: 50,
        minValue: 1,
        maxValue: 100,
      }).allowed,
    ).toBe(true);
  });
});

describe('kredensial', () => {
  it('rujukan brankas diterima', () => {
    expect(bolehSimpanKredensial({ secretRef: 'vault://gateway/1' }).allowed).toBe(true);
  });

  it('nilai mentah DITOLAK', () => {
    /*
     * Administrator yang menyimpannya tidak dapat membacanya kembali — ia dapat
     * menggantinya; ia tidak dapat melihatnya. Perbedaan itu menentukan siapa
     * yang harus dicurigai ketika ada kebocoran.
     */
    const h = bolehSimpanKredensial({ rawValue: 'kata-sandi-rahasia' });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('harus dicurigai ketika ada kebocoran');
  });

  it('rujukan kosong ditolak', () => {
    expect(bolehSimpanKredensial({ secretRef: '  ' }).allowed).toBe(false);
  });

  it('nilai mentah ditolak sekalipun rujukannya ada', () => {
    expect(
      bolehSimpanKredensial({ secretRef: 'vault://x', rawValue: 'rahasia' }).allowed,
    ).toBe(false);
  });
});

describe('deteksi duplikat', () => {
  it('pesan baru diterima', () => {
    expect(pesanDuplikat({ rawMessageHash: 'a', knownHashes: ['b'] }).duplicate).toBe(false);
  });

  it('pesan yang sudah pernah diterima dikenali lewat sidik jarinya', () => {
    /*
     * Alat yang menyimpan hasil selama jaringan terputus akan mengirim ulang
     * seluruh simpanannya begitu tersambung, dan deteksi berbasis waktu akan
     * menganggap seluruhnya baru.
     */
    const h = pesanDuplikat({ rawMessageHash: 'a', knownHashes: ['a', 'b'] });
    expect(h.duplicate).toBe(true);
    expect(h.message).toContain('bukan lewat waktunya');
  });

  it('daftar kosong tidak menghasilkan duplikat', () => {
    expect(pesanDuplikat({ rawMessageHash: 'a', knownHashes: [] }).duplicate).toBe(false);
  });
});
