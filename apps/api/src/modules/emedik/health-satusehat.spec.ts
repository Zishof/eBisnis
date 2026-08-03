import {
  KEMAMPUAN_SATUSEHAT,
  SYARAT_VERIFIKASI,
  bolehKirim,
  bolehNaikkanStatus,
  bolehSimpanKredensial,
  bolehUlangi,
  kemampuanDikenal,
  kunciIdempotensi,
  rekonsiliasi,
  ringkasKesiapan,
  susunPayload,
  syaratSah,
} from './health-satusehat';

describe('matriks kemampuan', () => {
  it('setiap kemampuan menyebut penghalangnya', () => {
    /*
     * Daftar yang hanya berkata "belum" akan ditanyakan ulang setiap tiga bulan
     * oleh orang yang berbeda.
     */
    for (const k of KEMAMPUAN_SATUSEHAT) {
      expect(k.penghalang.length).toBeGreaterThan(10);
    }
  });

  it('kode sumber daya unik', () => {
    const kode = KEMAMPUAN_SATUSEHAT.map((k) => k.resource);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('sebagian besar sudah punya sumber datanya di sisi kami', () => {
    /*
     * Ini yang membedakan "belum dibangun" dari "belum dapat dibangun".
     * Penghalangnya benar-benar hanya pada lapisan pertukaran.
     */
    const punya = KEMAMPUAN_SATUSEHAT.filter((k) => k.sumberLokal).length;
    expect(punya).toBeGreaterThan(KEMAMPUAN_SATUSEHAT.length * 0.8);
  });

  it('yang belum punya sumber lokal adalah yang memang belum dibangun', () => {
    const tanpa = KEMAMPUAN_SATUSEHAT.filter((k) => !k.sumberLokal).map((k) => k.resource);
    expect(tanpa.sort()).toEqual(['CarePlan', 'ImagingStudy']);
  });

  it('sumber daya yang tidak tercatat tidak dikenal', () => {
    expect(kemampuanDikenal('Patient')).toBe(true);
    expect(kemampuanDikenal('Questionnaire')).toBe(false);
  });
});

describe('syarat verifikasi', () => {
  it('ada enam, dan daftarnya sengaja panjang', () => {
    expect(SYARAT_VERIFIKASI).toHaveLength(6);
  });

  it('kodenya unik', () => {
    const kode = SYARAT_VERIFIKASI.map((s) => s.kode);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('syarat yang tidak dikenal ditolak', () => {
    expect(syaratSah('SANDBOX_CREDENTIAL')).toBe(true);
    expect(syaratSah('SUDAH_DIBACA')).toBe(false);
  });
});

describe('gerbang pengiriman', () => {
  const dasar = {
    resource: 'Patient',
    status: 'VERIFIED' as const,
    lingkunganAktif: true,
    adaRujukanKredensial: true,
  };

  it('kemampuan terverifikasi boleh dikirim', () => {
    expect(bolehKirim(dasar).boleh).toBe(true);
  });

  it('KEMAMPUAN YANG BELUM VERIFIED DITOLAK, BUKAN DIPERINGATKAN', () => {
    /*
     * Adapter yang berjalan dengan tebakan akan mengirimkan data pasien ke
     * tempat yang salah, dan pengiriman itu tidak dapat ditarik kembali.
     * Peringatan yang dapat diabaikan akan diabaikan pada malam ketika
     * tenggatnya besok.
     */
    for (const status of ['BLOCKED', 'DOCUMENTED', 'SANDBOX_TESTED'] as const) {
      const h = bolehKirim({ ...dasar, status });
      expect(h.boleh).toBe(false);
      expect(h.alasan).toContain('MENOLAK');
    }
  });

  it('dan penolakannya menyebut penghalang sumber dayanya', () => {
    const h = bolehKirim({ ...dasar, resource: 'Medication', status: 'BLOCKED' });
    expect(h.alasan).toContain('KFA');
  });

  it('tanpa lingkungan aktif ditolak', () => {
    expect(bolehKirim({ ...dasar, lingkunganAktif: false }).boleh).toBe(false);
  });

  it('tanpa rujukan kredensial ditolak', () => {
    const h = bolehKirim({ ...dasar, adaRujukanKredensial: false });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('rujukan ke brankas');
  });

  it('SUMBER DAYA YANG TIDAK TERCATAT DITOLAK', () => {
    // Matriksnya daftar tertutup: yang tidak tercatat berarti belum ditelaah.
    const h = bolehKirim({ ...dasar, resource: 'Questionnaire' });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('belum ditelaah');
  });

  it('yang ditolak menyebutkan apa yang dibutuhkan', () => {
    const h = bolehKirim({ ...dasar, status: 'BLOCKED' });
    expect(h.yangDibutuhkan).toHaveLength(6);
  });
});

describe('kenaikan status kemampuan', () => {
  const lengkap = SYARAT_VERIFIKASI.map((s) => s.kode);

  it('kenaikan satu tahap diizinkan', () => {
    expect(
      bolehNaikkanStatus({ dari: 'BLOCKED', ke: 'DOCUMENTED', olehManusia: true, buktiSyarat: [] })
        .boleh,
    ).toBe(true);
  });

  it('KENAIKAN YANG MELOMPAT DITOLAK', () => {
    /*
     * Tahap yang dilompati justru yang menemukan bahwa dokumentasinya berbeda
     * dari sandbox-nya — dan perbedaan itu selalu ada.
     */
    const h = bolehNaikkanStatus({
      dari: 'BLOCKED',
      ke: 'VERIFIED',
      olehManusia: true,
      buktiSyarat: lengkap,
    });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('melompati tahap');
  });

  it('VERIFIED TIDAK BOLEH DIBERIKAN PROGRAM', () => {
    const h = bolehNaikkanStatus({
      dari: 'SANDBOX_TESTED',
      ke: 'VERIFIED',
      olehManusia: false,
      buktiSyarat: lengkap,
    });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('akan dinaikkan program');
  });

  it('VERIFIED menuntut keenam syaratnya', () => {
    const h = bolehNaikkanStatus({
      dari: 'SANDBOX_TESTED',
      ke: 'VERIFIED',
      olehManusia: true,
      buktiSyarat: lengkap.slice(0, 3),
    });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tergesa');
  });

  it('VERIFIED dengan keenamnya dan oleh manusia diizinkan', () => {
    expect(
      bolehNaikkanStatus({
        dari: 'SANDBOX_TESTED',
        ke: 'VERIFIED',
        olehManusia: true,
        buktiSyarat: lengkap,
      }).boleh,
    ).toBe(true);
  });

  it('PENURUNAN SELALU DIIZINKAN', () => {
    /*
     * Yang ternyata tidak bekerja harus dapat dikembalikan tanpa perdebatan.
     * Penurunan yang sulit adalah penurunan yang tidak akan dilakukan.
     */
    expect(
      bolehNaikkanStatus({
        dari: 'VERIFIED',
        ke: 'BLOCKED',
        olehManusia: false,
        buktiSyarat: [],
      }).boleh,
    ).toBe(true);
  });

  it('status yang sama ditolak', () => {
    expect(
      bolehNaikkanStatus({
        dari: 'DOCUMENTED',
        ke: 'DOCUMENTED',
        olehManusia: true,
        buktiSyarat: [],
      }).boleh,
    ).toBe(false);
  });
});

describe('kredensial', () => {
  it('rujukan brankas diterima', () => {
    expect(bolehSimpanKredensial({ secretRef: 'vault://ss/1', rawValue: null }).boleh).toBe(true);
  });

  it('NILAI MENTAH DITOLAK', () => {
    const h = bolehSimpanKredensial({ secretRef: null, rawValue: 'rahasia' });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('atas nama fasilitas itu');
  });

  it('nilai mentah ditolak sekalipun rujukannya ada', () => {
    expect(
      bolehSimpanKredensial({ secretRef: 'vault://ss/1', rawValue: 'rahasia' }).boleh,
    ).toBe(false);
  });

  it('rujukan tanpa skema brankas ditolak', () => {
    expect(bolehSimpanKredensial({ secretRef: 'client-secret-abc', rawValue: null }).boleh).toBe(
      false,
    );
  });

  it('kms:// dan secret:// diterima pula', () => {
    expect(bolehSimpanKredensial({ secretRef: 'kms://a', rawValue: null }).boleh).toBe(true);
    expect(bolehSimpanKredensial({ secretRef: 'secret://a', rawValue: null }).boleh).toBe(true);
  });

  it('rujukan kosong ditolak', () => {
    expect(bolehSimpanKredensial({ secretRef: null, rawValue: null }).boleh).toBe(false);
  });
});

describe('idempotensi', () => {
  it('kunci deterministik dari isinya', () => {
    const a = kunciIdempotensi({ facilityCode: 'RS1', resource: 'Patient', localId: 'x', versi: 1 });
    const b = kunciIdempotensi({ facilityCode: 'RS1', resource: 'Patient', localId: 'x', versi: 1 });
    expect(a).toBe(b);
  });

  it('BUKAN dari waktunya', () => {
    // Kunci yang bergantung waktu membuat setiap percobaan ulang menjadi
    // pengiriman baru, dan sumber daya ganda di sistem nasional tidak dapat
    // dihapus dari sini.
    const a = kunciIdempotensi({ facilityCode: 'RS1', resource: 'Patient', localId: 'x', versi: 1 });
    expect(a).not.toMatch(/\d{13}/);
  });

  it('versi yang berbeda menghasilkan kunci berbeda', () => {
    const a = kunciIdempotensi({ facilityCode: 'RS1', resource: 'Patient', localId: 'x', versi: 1 });
    const b = kunciIdempotensi({ facilityCode: 'RS1', resource: 'Patient', localId: 'x', versi: 2 });
    expect(a).not.toBe(b);
  });

  it('fasilitas yang berbeda menghasilkan kunci berbeda', () => {
    const a = kunciIdempotensi({ facilityCode: 'RS1', resource: 'Patient', localId: 'x', versi: 1 });
    const b = kunciIdempotensi({ facilityCode: 'RS2', resource: 'Patient', localId: 'x', versi: 1 });
    expect(a).not.toBe(b);
  });
});

describe('pengulangan percobaan', () => {
  it('yang gagal boleh diulang', () => {
    expect(
      bolehUlangi({ statusTerakhir: 'FAILED', jumlahPercobaan: 1, batasPercobaan: 5 }).boleh,
    ).toBe(true);
  });

  it('YANG SUDAH BERHASIL TIDAK DIULANG', () => {
    const h = bolehUlangi({ statusTerakhir: 'SUCCESS', jumlahPercobaan: 1, batasPercobaan: 5 });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tidak dapat dihapus dari sini');
  });

  it('YANG DITOLAK TIDAK DIULANG — yang salah datanya, bukan percobaannya', () => {
    const h = bolehUlangi({ statusTerakhir: 'REJECTED', jumlahPercobaan: 1, batasPercobaan: 5 });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('datanya, bukan');
  });

  it('yang melampaui batas percobaan menunggu manusia', () => {
    const h = bolehUlangi({ statusTerakhir: 'FAILED', jumlahPercobaan: 5, batasPercobaan: 5 });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('diblokir');
  });

  it('PENDING boleh diulang', () => {
    expect(
      bolehUlangi({ statusTerakhir: 'PENDING', jumlahPercobaan: 0, batasPercobaan: 3 }).boleh,
    ).toBe(true);
  });
});

describe('rekonsiliasi', () => {
  it('yang seimbang dinyatakan seimbang', () => {
    const h = rekonsiliasi({ dikirim: 100, diterima: 95, gagal: 5 });
    expect(h.seimbang).toBe(true);
    expect(h.selisih).toBe(0);
  });

  it('SELISIH YANG TIDAK BERKESUDAHAN DINAMAI', () => {
    /*
     * Inilah yang paling berbahaya: "sudah dikirim" yang sesungguhnya berarti
     * "sudah kami coba, dan kami tidak tahu apa yang terjadi sesudahnya".
     */
    const h = rekonsiliasi({ dikirim: 100, diterima: 90, gagal: 5 });
    expect(h.seimbang).toBe(false);
    expect(h.selisih).toBe(5);
    expect(h.keterangan).toContain('sudah kami coba');
  });

  it('tanpa pengiriman dinyatakan seimbang', () => {
    expect(rekonsiliasi({ dikirim: 0, diterima: 0, gagal: 0 }).seimbang).toBe(true);
  });
});

describe('payload FHIR sengaja tidak disusun', () => {
  it('PENYUSUNAN PAYLOAD MELEMPAR, DAN ITU DISENGAJA', () => {
    /*
     * Payload yang dikarang akan diterima sandbox, ditolak produksi, dan di
     * antara keduanya seseorang akan menyimpulkan bahwa integrasinya berfungsi.
     */
    expect(() => susunPayload('Patient')).toThrow('PAYLOAD_NOT_BUILDABLE');
  });

  it('dan penolakannya menyebut penghalang sumber dayanya', () => {
    expect(() => susunPayload('Medication')).toThrow(/KFA/);
  });

  it('menjelaskan mengapa, bukan sekadar menolak', () => {
    expect(() => susunPayload('Patient')).toThrow(/menyimpulkan bahwa integrasinya berfungsi/);
  });
});

describe('ringkasan kesiapan', () => {
  it('tanpa satu pun terverifikasi, dikatakan apa adanya', () => {
    const h = ringkasKesiapan([]);
    expect(h.terverifikasi).toBe(0);
    expect(h.terhalang).toBe(KEMAMPUAN_SATUSEHAT.length);
    expect(h.siapKirim).toEqual([]);
  });

  it('dan dijelaskan bahwa ini bukan kegagalan pembangunan', () => {
    expect(ringkasKesiapan([]).keterangan).toContain('bukan kegagalan pembangunan');
  });

  it('yang terverifikasi dihitung', () => {
    const h = ringkasKesiapan([
      { resource: 'Patient', status: 'VERIFIED' },
      { resource: 'Encounter', status: 'DOCUMENTED' },
    ]);
    expect(h.terverifikasi).toBe(1);
    expect(h.siapKirim).toEqual(['Patient']);
  });

  it('totalnya dihitung dari daftarnya, bukan ditulis tangan', () => {
    expect(ringkasKesiapan([]).total).toBe(KEMAMPUAN_SATUSEHAT.length);
  });

  it('yang tidak disebutkan dianggap BLOCKED', () => {
    const h = ringkasKesiapan([{ resource: 'Patient', status: 'VERIFIED' }]);
    expect(h.terhalang).toBe(KEMAMPUAN_SATUSEHAT.length - 1);
  });
});
