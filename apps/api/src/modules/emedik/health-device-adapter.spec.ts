import {
  JENIS_HL7_DITERIMA,
  PROTOKOL_ADAPTER,
  bacaPemisah,
  bolehUrai,
  bukaEscape,
  checksumAstm,
  periksaChecksumAstm,
  petakanKode,
  punyaPengurai,
  susunAck,
  uraiAstm,
  uraiHl7,
  uraiWaktuHl7,
} from './health-device-adapter';

const PEMISAH_BAKU = {
  segmen: '\r',
  medan: '|',
  komponen: '^',
  ulangan: '~',
  escape: '\\',
  subkomponen: '&',
};

const hl7 = (...segmen: string[]) => segmen.join('\r');

const MSH = 'MSH|^~\\&|ANALYZER1|LAB|EMEDIK|RS|20260801093000||ORU^R01|MSG00001|P|2.5';

describe('pengurai tidak pernah melempar galat', () => {
  /*
   * Aturan yang tidak boleh dilanggar. Pengurai yang melempar akan menjatuhkan
   * seluruh jalur penerimaan ketika satu alat mengirim satu pesan cacat — dan
   * alat yang mengirim pesan cacat biasanya mengirimnya beruntun.
   */
  const rusak = [
    '',
    '   ',
    'BUKAN HL7 SAMA SEKALI',
    'MSH',
    'MSH|',
    'MSH|^~',
    'MSH|^~\\&',
    '\x00\x01\x02',
    'MSH|^~\\&|A|B|C|D|E||ORU^R01|1|P|2.5\rOBX|1|NM',
    'H|',
    'R|1',
    '\x02H|\\^&|||x\x0303',
  ];

  it.each(rusak)('uraiHl7 tidak melempar pada %j', (pesan) => {
    expect(() => uraiHl7(pesan)).not.toThrow();
  });

  it.each(rusak)('uraiAstm tidak melempar pada %j', (pesan) => {
    expect(() => uraiAstm(pesan)).not.toThrow();
  });

  it('yang rusak melaporkan kerusakannya, bukan diam', () => {
    const h = uraiHl7('BUKAN HL7');
    expect(h.valid).toBe(false);
    expect(h.temuan.length).toBeGreaterThan(0);
    expect(h.temuan[0].kode).toBe('NO_MSH');
  });

  it('dan protokolnya tetap disebutkan sekalipun pesannya kosong', () => {
    expect(uraiHl7('').protokol).toBe('HL7V2');
    expect(uraiAstm('').protokol).toBe('ASTM');
  });
});

describe('karakter pemisah HL7', () => {
  it('dibaca dari MSH-1 dan MSH-2, tidak diasumsikan', () => {
    /*
     * Standar mengizinkan pengirim memilih pemisahnya sendiri, dan sebagian
     * alat memakainya. Pengurai yang mengasumsikan |^~\& akan bekerja pada
     * sembilan puluh sembilan alat dan menghasilkan omong kosong pada yang
     * keseratus, tanpa galat apa pun.
     */
    const { pemisah } = bacaPemisah('MSH#@~\\$|sisa');
    expect(pemisah?.medan).toBe('#');
    expect(pemisah?.komponen).toBe('@');
    expect(pemisah?.ulangan).toBe('~');
    expect(pemisah?.escape).toBe('\\');
    expect(pemisah?.subkomponen).toBe('$');
  });

  it('pemisah baku dibaca benar pula', () => {
    const { pemisah } = bacaPemisah(MSH);
    expect(pemisah?.medan).toBe('|');
    expect(pemisah?.komponen).toBe('^');
  });

  it('pesan yang tidak dimulai MSH ditolak', () => {
    expect(bacaPemisah('PID|1').pemisah).toBeNull();
  });

  it('MSH yang terpotong ditolak dengan sebabnya', () => {
    const h = bacaPemisah('MSH|^~');
    expect(h.pemisah).toBeNull();
    expect(h.temuan[0].kode).toBe('MSH_TRUNCATED');
  });

  it('pesan dengan pemisah tidak lazim tetap terurai isinya', () => {
    const pesan = [
      'MSH#@~\\$#ANALYZER#LAB#EMEDIK#RS#20260801093000##ORU@R01#MSG9#P#2.5',
      'OBX#1#NM#HGB@Hemoglobin##13.5#g/dL',
    ].join('\r');
    const h = uraiHl7(pesan);
    expect(h.messageControlId).toBe('MSG9');
    expect(h.observations[0].observationCode).toBe('HGB');
    expect(h.observations[0].observationValue).toBe('13.5');
  });
});

describe('urutan escape HL7', () => {
  it('\\F\\ menjadi pemisah medan', () => {
    expect(bukaEscape('A\\F\\B', PEMISAH_BAKU)).toBe('A|B');
  });

  it('\\S\\ menjadi pemisah komponen', () => {
    expect(bukaEscape('A\\S\\B', PEMISAH_BAKU)).toBe('A^B');
  });

  it('\\E\\ menjadi karakter escape itu sendiri', () => {
    expect(bukaEscape('O\\E\\Brien', PEMISAH_BAKU)).toBe('O\\Brien');
  });

  it('\\X..\\ membuka heksadesimal', () => {
    expect(bukaEscape('A\\X0D\\B', PEMISAH_BAKU)).toBe('A\rB');
  });

  it('escape yang tidak tertutup dibiarkan, BUKAN dibuang', () => {
    // Membuangnya menghilangkan sisa nilainya tanpa jejak.
    expect(bukaEscape('nilai\\rusak', PEMISAH_BAKU)).toBe('nilai\\rusak');
  });

  it('teks tanpa escape tidak berubah', () => {
    expect(bukaEscape('13.5', PEMISAH_BAKU)).toBe('13.5');
  });

  it('escape yang tidak dikenal menjadi kosong, bukan galat', () => {
    expect(bukaEscape('A\\Z\\B', PEMISAH_BAKU)).toBe('AB');
  });
});

describe('waktu HL7', () => {
  it('waktu lengkap berzona diurai apa adanya', () => {
    const h = uraiWaktuHl7('20260801093000+0700');
    expect(h.iso).toBe('2026-08-01T09:30:00+07:00');
    expect(h.adaZona).toBe(true);
    expect(h.temuan).toEqual([]);
  });

  it('ZONA YANG TIDAK DISEBUTKAN TIDAK DIANGGAP UTC', () => {
    /*
     * Alat medis hampir tidak pernah menyertakan zona waktu, dan menganggapnya
     * UTC menggeser seluruh hasil tujuh jam di Indonesia — cukup untuk
     * memindahkan hasil pagi ke hari sebelumnya.
     */
    const h = uraiWaktuHl7('20260801093000');
    expect(h.iso).toBe('2026-08-01T09:30:00');
    expect(h.iso).not.toMatch(/Z$/);
    expect(h.adaZona).toBe(false);
    expect(h.temuan[0].kode).toBe('NO_TIMEZONE');
  });

  it('dan sebabnya disebutkan', () => {
    expect(uraiWaktuHl7('20260801').temuan[0].pesan).toContain('tujuh jam');
  });

  it('tanggal saja diurai menjadi tengah malam', () => {
    expect(uraiWaktuHl7('20260801').iso).toBe('2026-08-01T00:00:00');
  });

  it('pecahan detik diabaikan tanpa galat', () => {
    expect(uraiWaktuHl7('20260801093000.5').iso).toBe('2026-08-01T09:30:00');
  });

  it('waktu yang tidak berbentuk waktu ditandai, bukan melempar', () => {
    const h = uraiWaktuHl7('kemarin sore');
    expect(h.iso).toBeNull();
    expect(h.temuan[0].kode).toBe('BAD_TIMESTAMP');
  });

  it('kosong menghasilkan null tanpa temuan', () => {
    expect(uraiWaktuHl7('').temuan).toEqual([]);
    expect(uraiWaktuHl7(null).iso).toBeNull();
  });
});

describe('pesan hasil HL7', () => {
  const pesan = hl7(
    MSH,
    'PID|1||RM000123^^^RS^MR||Tono^Suryo||19700101|M',
    'OBR|1|ORD-9001|LAB-5501|CBC^Darah Lengkap',
    'OBX|1|NM|HGB^Hemoglobin||13.5|g/dL|12.0-16.0|N|||F|||20260801093000',
    'OBX|2|NM|WBC^Leukosit||8.2|10^3/uL|4.0-11.0|N|||F|||20260801093000',
  );

  it('terurai sah', () => {
    const h = uraiHl7(pesan);
    expect(h.valid).toBe(true);
    expect(h.temuan.filter((t) => t.tingkat === 'ERROR')).toEqual([]);
  });

  it('MSH dibaca dengan penomoran yang benar', () => {
    /*
     * MSH-1 adalah pemisah medannya sendiri, sehingga indeksnya bergeser satu.
     * Sumber kekeliruan paling umum pada pengurai buatan sendiri, dan ia tidak
     * menimbulkan galat: ia hanya membaca medan yang salah.
     */
    const h = uraiHl7(pesan);
    expect(h.messageControlId).toBe('MSG00001');
    expect(h.messageType).toBe('ORU^R01');
    expect(h.deviceIdentifier).toBe('ANALYZER1');
  });

  it('order ID diambil dari OBR-2, bukan OBR-3', () => {
    // OBR-2 adalah nomor yang KAMI berikan; OBR-3 nomor internal alat.
    expect(uraiHl7(pesan).orderId).toBe('ORD-9001');
  });

  it('OBR-3 dipakai bila OBR-2 kosong', () => {
    const tanpaObr2 = pesan.replace('OBR|1|ORD-9001|LAB-5501', 'OBR|1||LAB-5501');
    expect(uraiHl7(tanpaObr2).orderId).toBe('LAB-5501');
  });

  it('pengenal pasien dibaca dari PID-3', () => {
    expect(uraiHl7(pesan).patientIdentifier).toBe('RM000123');
  });

  it('seluruh OBX terbaca', () => {
    const h = uraiHl7(pesan);
    expect(h.observations).toHaveLength(2);
    expect(h.observations[0].observationCode).toBe('HGB');
    expect(h.observations[0].observationValue).toBe('13.5');
    expect(h.observations[0].observationUnit).toBe('g/dL');
    expect(h.observations[1].observationCode).toBe('WBC');
  });

  it('rentang rujukan dan penanda abnormal terbaca', () => {
    const h = uraiHl7(pesan);
    expect(h.observations[0].referenceRange).toBe('12.0-16.0');
    expect(h.observations[0].abnormalFlag).toBe('N');
  });

  it('pesan tanpa OBX ditolak dengan sebabnya', () => {
    const h = uraiHl7(hl7(MSH, 'PID|1||RM1'));
    expect(h.valid).toBe(false);
    expect(h.temuan.some((t) => t.kode === 'NO_OBX')).toBe(true);
  });

  it('OBX tanpa kode pemeriksaan ditandai', () => {
    const h = uraiHl7(hl7(MSH, 'OBX|1|NM|||13.5|g/dL'));
    expect(h.valid).toBe(false);
    expect(h.temuan.some((t) => t.kode === 'OBX_NO_CODE')).toBe(true);
  });

  it('JENIS PESAN ADALAH DAFTAR TERTUTUP', () => {
    /*
     * Jalur hasil alat sengaja tidak menerima ADT maupun ORM — pendaftaran
     * pasien dan pemesanan pemeriksaan datang dari eMedik, bukan dari alat.
     */
    const adt = uraiHl7(hl7(MSH.replace('ORU^R01', 'ADT^A01'), 'OBX|1|NM|X||1'));
    expect(adt.valid).toBe(false);
    expect(adt.temuan.some((t) => t.kode === 'UNSUPPORTED_MESSAGE_TYPE')).toBe(true);
  });

  it('dan penolakannya menyebut mengapa ADT tidak diterima', () => {
    const adt = uraiHl7(hl7(MSH.replace('ORU^R01', 'ADT^A01'), 'OBX|1|NM|X||1'));
    expect(adt.temuan.find((t) => t.kode === 'UNSUPPORTED_MESSAGE_TYPE')?.pesan).toContain(
      'bukan dari alat',
    );
  });

  it('seluruh jenis pada daftar diterima', () => {
    for (const jenis of JENIS_HL7_DITERIMA) {
      const h = uraiHl7(hl7(MSH.replace('ORU^R01', jenis), 'OBX|1|NM|HGB||13.5'));
      expect(h.temuan.some((t) => t.kode === 'UNSUPPORTED_MESSAGE_TYPE')).toBe(false);
    }
  });

  it('pesan tanpa control ID ditandai tetapi tidak ditolak', () => {
    const h = uraiHl7(hl7(MSH.replace('MSG00001', ''), 'OBX|1|NM|HGB||13.5'));
    expect(h.temuan.some((t) => t.kode === 'NO_CONTROL_ID')).toBe(true);
    expect(h.valid).toBe(true);
  });

  it('nilai yang memuat escape terbuka dengan benar', () => {
    const h = uraiHl7(hl7(MSH, 'OBX|1|ST|NOTE||Nilai\\S\\rujukan'));
    expect(h.observations[0].observationValue).toBe('Nilai^rujukan');
  });

  it('pemisah baris \\n diperlakukan sebagai pemisah segmen', () => {
    const dengan = [MSH, 'OBX|1|NM|HGB||13.5'].join('\n');
    expect(uraiHl7(dengan).observations).toHaveLength(1);
  });
});

describe('checksum ASTM', () => {
  it('dihitung modulo 256 dua digit huruf besar', () => {
    expect(checksumAstm('A')).toBe('41');
    expect(checksumAstm('')).toBe('00');
  });

  it('checksum yang cocok dikenali', () => {
    const isi = '1H|\\^&|||Analyzer\x03';
    const h = periksaChecksumAstm(`\x02${isi}${checksumAstm(isi)}\r\n`);
    expect(h.cocok).toBe(true);
  });

  it('checksum yang salah dikenali beserta yang diharapkan', () => {
    const isi = '1H|\\^&|||Analyzer\x03';
    const h = periksaChecksumAstm(`\x02${isi}ZZ\r\n`);
    expect(h.cocok).toBe(false);
    expect(h.diharapkan).toBe(checksumAstm(isi));
    expect(h.ditemukan).toBe('ZZ');
  });

  it('bingkai tanpa checksum dikenali sebagai tidak cocok, bukan melempar', () => {
    const h = periksaChecksumAstm('H|\\^&|||Analyzer');
    expect(h.cocok).toBe(false);
    expect(h.diharapkan).toBeNull();
  });
});

describe('pesan hasil ASTM', () => {
  const pesan = [
    'H|\\^&|||ANALYZER2^1.0|||||||P|1|20260801093000',
    'P|1||RM000123||Tono^Suryo||19700101|M',
    'O|1|ORD-9002||^^^CBC|R|20260801090000',
    'R|1|^^^HGB|13.5|g/dL|12.0-16.0|N||F||||20260801093000',
    'R|2|^^^WBC|8.2|10*3/uL|4.0-11.0|N||F||||20260801093000',
    'L|1|N',
  ].join('\r\n');

  it('terurai sah', () => {
    const h = uraiAstm(pesan);
    expect(h.valid).toBe(true);
    expect(h.protokol).toBe('ASTM');
  });

  it('pengenal alat dibaca dari rekaman H', () => {
    expect(uraiAstm(pesan).deviceIdentifier).toBe('ANALYZER2');
  });

  it('pengenal pasien dan pesanan terbaca', () => {
    const h = uraiAstm(pesan);
    expect(h.patientIdentifier).toBe('RM000123');
    expect(h.orderId).toBe('ORD-9002');
  });

  it('seluruh rekaman R terbaca', () => {
    const h = uraiAstm(pesan);
    expect(h.observations).toHaveLength(2);
    expect(h.observations[0].observationCode).toBe('HGB');
    expect(h.observations[0].observationValue).toBe('13.5');
    expect(h.observations[1].observationCode).toBe('WBC');
  });

  it('pesan tanpa rekaman H ditolak', () => {
    const h = uraiAstm('R|1|^^^HGB|13.5');
    expect(h.valid).toBe(false);
    expect(h.temuan.some((t) => t.kode === 'NO_HEADER')).toBe(true);
  });

  it('pesan tanpa rekaman R ditolak', () => {
    const h = uraiAstm('H|\\^&|||A\r\nL|1|N');
    expect(h.valid).toBe(false);
    expect(h.temuan.some((t) => t.kode === 'NO_RESULT')).toBe(true);
  });

  it('bingkai berkarakter kendali terurai isinya', () => {
    const berbingkai = pesan
      .split('\r\n')
      .map((b, i) => `\x02${i + 1}${b}\x03${checksumAstm(`${b}\x03`)}`)
      .join('\r\n');
    const h = uraiAstm(berbingkai);
    expect(h.observations).toHaveLength(2);
  });
});

describe('pemetaan kode', () => {
  const peta = [
    { kodeAlat: 'HGB', kodeLokal: 'LAB-HB', satuanAlat: 'g/dL', satuanLokal: 'g/dL' },
    { kodeAlat: 'WBC', kodeLokal: 'LAB-WBC', satuanAlat: '10^3/uL', satuanLokal: '10^3/uL' },
  ];

  it('kode yang terpeta dipetakan', () => {
    const h = petakanKode('HGB', peta, 'g/dL');
    expect(h.terpetakan).toBe(true);
    expect(h.kodeLokal).toBe('LAB-HB');
  });

  it('pencocokannya tidak peka huruf besar-kecil', () => {
    expect(petakanKode('hgb', peta).terpetakan).toBe(true);
  });

  it('YANG TIDAK TERPETA TIDAK DITEBAK', () => {
    /*
     * Menebaknya — dengan kemiripan nama, dengan urutan, dengan "biasanya HGB
     * berarti hemoglobin" — akan benar hampir selalu dan salah sekali, dan yang
     * sekali itu menaruh kadar kalium pada baris natrium.
     */
    const h = petakanKode('K', peta);
    expect(h.terpetakan).toBe(false);
    expect(h.kodeLokal).toBeNull();
    expect(h.keterangan).toContain('baris natrium');
  });

  it('SATUAN YANG BERUBAH DIAM-DIAM DITANDAI', () => {
    /*
     * Satuan yang berubah adalah cara alat yang baru diperbarui melipatgandakan
     * seluruh hasilnya tanpa ada yang tahu.
     */
    const h = petakanKode('HGB', peta, 'mmol/L');
    expect(h.terpetakan).toBe(true);
    expect(h.satuanBerbeda).toBe(true);
    expect(h.keterangan).toContain('melipatgandakan');
  });

  it('satuan yang sama tidak ditandai', () => {
    expect(petakanKode('HGB', peta, 'g/dL').satuanBerbeda).toBe(false);
  });

  it('tanpa satuan tidak ditandai', () => {
    expect(petakanKode('HGB', peta).satuanBerbeda).toBe(false);
  });

  it('peta kosong tidak melempar', () => {
    expect(() => petakanKode('HGB', [])).not.toThrow();
    expect(petakanKode('HGB', []).terpetakan).toBe(false);
  });
});

describe('protokol yang terhalang', () => {
  it('HL7 dan ASTM siap', () => {
    expect(bolehUrai('HL7V2').boleh).toBe(true);
    expect(bolehUrai('ASTM').boleh).toBe(true);
  });

  it('DICOM DITOLAK DENGAN PENGHALANGNYA DISEBUT', () => {
    const h = bolehUrai('DICOM');
    expect(h.boleh).toBe(false);
    expect(h.pesan).toContain('PACS');
    expect(h.pesan).toContain('cadangan');
  });

  it('FHIR ditolak dengan penghalangnya', () => {
    expect(bolehUrai('FHIR').pesan).toContain('SATUSEHAT');
  });

  it('setiap protokol yang belum siap menyebutkan penghalangnya', () => {
    for (const [kode, p] of Object.entries(PROTOKOL_ADAPTER)) {
      if (!p.siap) {
        expect(p.penghalang).toBeTruthy();
        expect(String(p.penghalang).length).toBeGreaterThan(15);
        expect(bolehUrai(kode).pesan).toContain(String(p.penghalang).slice(0, 20));
      }
    }
  });

  it('protokol yang tidak dikenal ditolak', () => {
    expect(bolehUrai('TELEPATI').boleh).toBe(false);
  });

  it('hanya HL7 dan ASTM yang punya pengurai sungguhan', () => {
    // Yang lain "siap" berarti alatnya boleh terdaftar, bukan bahwa pesannya
    // dapat diurai di sini.
    expect(punyaPengurai('HL7V2')).toBe(true);
    expect(punyaPengurai('ASTM')).toBe(true);
    expect(punyaPengurai('SFTP')).toBe(false);
    expect(punyaPengurai('DICOM')).toBe(false);
  });
});

describe('balasan ACK', () => {
  it('pesan yang diterima dibalas AA', () => {
    const h = susunAck({ messageControlId: 'MSG1', diterima: true, temuan: [] });
    expect(h.kode).toBe('AA');
    expect(h.teks).toContain('MSA|AA|MSG1');
  });

  it('PESAN YANG CACAT DIBALAS AE, BUKAN AR', () => {
    /*
     * AR membuat sebagian alat mengirim ulang pesan yang sama tanpa henti;
     * AE membuatnya melanjutkan. Pesan yang cacat karena isinya akan tetap
     * cacat berapa kali pun dikirim ulang, dan alat yang mengirim ulang tanpa
     * henti akan memenuhi antrean sampai hasil pasien lain tidak dapat masuk.
     */
    const h = susunAck({
      messageControlId: 'MSG2',
      diterima: false,
      temuan: [{ tingkat: 'ERROR', kode: 'NO_OBX', pesan: 'x' }],
    });
    expect(h.kode).toBe('AE');
    expect(h.kode).not.toBe('AR');
  });

  it('kode temuannya ikut dibalas', () => {
    const h = susunAck({
      messageControlId: 'MSG3',
      diterima: false,
      temuan: [
        { tingkat: 'ERROR', kode: 'NO_OBX', pesan: 'x' },
        { tingkat: 'WARNING', kode: 'NO_TIMEZONE', pesan: 'y' },
      ],
    });
    expect(h.teks).toContain('NO_OBX');
    expect(h.teks).not.toContain('NO_TIMEZONE');
  });

  it('pesan tanpa control ID tetap dapat dibalas', () => {
    const h = susunAck({ messageControlId: null, diterima: true, temuan: [] });
    expect(h.teks).toContain('UNKNOWN');
  });
});
