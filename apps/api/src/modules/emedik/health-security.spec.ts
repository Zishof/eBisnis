import {
  PANJANG_ALASAN_MINIMUM,
  antreanTelaah,
  AWALAN_TABEL_KESEHATAN,
  bolehAiMelakukan,
  bolehKeAi,
  bolehKirimKeAi,
  periksaBreakGlass,
  periksaIsolasi,
  periksaTujuan,
  POLA_KESEHATAN,
  redaksiKesehatan,
  samarkanNilai,
  syaratTambahanTujuan,
  tabelMilikKesehatan,
  tindakanTerlarangAi,
  TINDAKAN_TERLARANG_AI,
  TUJUAN_PENGGUNAAN,
  ZONA,
  ZONA_TERLARANG_AI,
  type ZonaData,
} from './health-security';

describe('H-12 · Zona data kesehatan', () => {
  it('menggolongkan data menurut akibat kebocorannya, bukan menurut tingkat rendah/sedang/tinggi', () => {
    for (const z of Object.values(ZONA)) {
      expect(z.bilaBocor.length).toBeGreaterThan(30);
    }
  });

  it('setiap zona menjawab tiga pertanyaan yang sama, sehingga dapat dibandingkan', () => {
    for (const z of Object.values(ZONA)) {
      expect(typeof z.bolehKeAi).toBe('boolean');
      expect(typeof z.wajibTujuanPenggunaan).toBe('boolean');
      expect(typeof z.disamarkanPadaEkspor).toBe('boolean');
    }
  });

  it('kunci pada peta zona sama dengan medan zona di dalamnya', () => {
    for (const [kunci, z] of Object.entries(ZONA)) {
      expect(z.zona).toBe(kunci);
    }
  });

  it('data yang mengenali orang termasuk zona terjaga, sekalipun ia belum menyebut penyakit', () => {
    expect(ZONA.IDENTIFYING.bolehKeAi).toBe(false);
    expect(ZONA.IDENTIFYING.wajibTujuanPenggunaan).toBe(true);
    expect(ZONA.IDENTIFYING.disamarkanPadaEkspor).toBe(true);
  });

  it('zona publik dan operasional tidak menuntut tujuan penggunaan', () => {
    expect(ZONA.PUBLIC.wajibTujuanPenggunaan).toBe(false);
    expect(ZONA.OPERATIONAL.wajibTujuanPenggunaan).toBe(false);
  });

  it('tiga zona terjaga tidak pernah boleh sampai ke AI', () => {
    expect([...ZONA_TERLARANG_AI].sort()).toEqual(
      ['CLINICAL', 'IDENTIFYING', 'SENSITIVE_CLINICAL'].sort(),
    );
  });

  it('daftar zona terlarang AI sama persis dengan zona yang bolehKeAi-nya false', () => {
    const dariDefinisi = Object.values(ZONA)
      .filter((z) => !z.bolehKeAi)
      .map((z) => z.zona)
      .sort();
    expect(dariDefinisi).toEqual([...ZONA_TERLARANG_AI].sort());
  });

  it('setiap zona yang tidak boleh ke AI juga disamarkan pada ekspor', () => {
    for (const z of Object.values(ZONA)) {
      if (!z.bolehKeAi) expect(z.disamarkanPadaEkspor).toBe(true);
    }
  });

  it('penolakan zona menyebutkan sebabnya, bukan sekadar menolak', () => {
    const hasil = bolehKeAi('SENSITIVE_CLINICAL');
    expect(hasil.boleh).toBe(false);
    expect(hasil.alasan).toContain('log');
  });

  it('zona yang tidak dikenal ditolak, bukan diloloskan', () => {
    expect(bolehKeAi('TIDAK_ADA' as ZonaData).boleh).toBe(false);
  });

  it('zona operasional boleh ke AI — tarif dan jadwal alat bukan rekam medis', () => {
    expect(bolehKeAi('OPERATIONAL').boleh).toBe(true);
  });
});

describe('H-12 · Tujuan penggunaan', () => {
  it('menolak tujuan yang kosong', () => {
    expect(periksaTujuan(null).sah).toBe(false);
    expect(periksaTujuan(undefined).sah).toBe(false);
    expect(periksaTujuan('').sah).toBe(false);
  });

  it('menolak tujuan bebas-teks — daftarnya tertutup', () => {
    const hasil = periksaTujuan('cek');
    expect(hasil.sah).toBe(false);
    expect(hasil.alasan).toContain('TERTUTUP');
  });

  it('menerima setiap tujuan pada daftar', () => {
    for (const t of TUJUAN_PENGGUNAAN) {
      expect(periksaTujuan(t).sah).toBe(true);
    }
  });

  it('KOSAKATANYA SAMA PERSIS dengan constraint health_access_purpose_valid pada H002', () => {
    /*
     * Disalin dari skema, tidak disusun dari ingatan.
     *
     * Rancangan pertamanya memuat PUBLIC_HEALTH yang tidak ada pada skema dan
     * menghilangkan QUALITY yang ada. Akibatnya bukan galat pada saat itu
     * juga, melainkan sebuah jalan yang MENERIMA tajuk PUBLIC_HEALTH,
     * membiarkan aksesnya berjalan, lalu gagal ketika mencatatnya — aksesnya
     * terjadi, catatannya tidak.
     */
    expect([...TUJUAN_PENGGUNAAN].sort()).toEqual(
      [
        'TREATMENT',
        'PAYMENT',
        'OPERATIONS',
        'QUALITY',
        'RESEARCH',
        'PATIENT_REQUEST',
        'LEGAL',
        'EMERGENCY',
      ].sort(),
    );
  });

  it('tidak memuat PUBLIC_HEALTH — tujuan yang tidak pernah ada pada skema ini', () => {
    expect(periksaTujuan('PUBLIC_HEALTH').sah).toBe(false);
  });

  it('membedakan huruf besar-kecil: treatment bukan TREATMENT', () => {
    expect(periksaTujuan('treatment').sah).toBe(false);
    expect(periksaTujuan('TREATMENT').sah).toBe(true);
  });

  it('pesan penolakannya menyebutkan seluruh tujuan yang sah', () => {
    const pesan = periksaTujuan(null).alasan;
    for (const t of TUJUAN_PENGGUNAAN) expect(pesan).toContain(t);
  });

  it('RESEARCH menuntut rujukan persetujuan etik', () => {
    expect(
      syaratTambahanTujuan({
        tujuan: 'RESEARCH',
        ethicsApprovalRef: null,
        breakGlass: false,
      }).sah,
    ).toBe(false);
  });

  it('RESEARCH dengan persetujuan etik diterima — uji kendali', () => {
    expect(
      syaratTambahanTujuan({
        tujuan: 'RESEARCH',
        ethicsApprovalRef: 'KEPK/2026/0112',
        breakGlass: false,
      }).sah,
    ).toBe(true);
  });

  it('EMERGENCY tanpa break-glass ditolak: ia sekadar kata yang membuka pintu', () => {
    const hasil = syaratTambahanTujuan({
      tujuan: 'EMERGENCY',
      ethicsApprovalRef: null,
      breakGlass: false,
    });
    expect(hasil.sah).toBe(false);
    expect(hasil.alasan).toContain('break-glass');
  });

  it('EMERGENCY bersama break-glass diterima — uji kendali', () => {
    expect(
      syaratTambahanTujuan({
        tujuan: 'EMERGENCY',
        ethicsApprovalRef: null,
        breakGlass: true,
      }).sah,
    ).toBe(true);
  });

  it('tujuan lain tidak menuntut syarat tambahan apa pun', () => {
    for (const t of ['TREATMENT', 'PAYMENT', 'OPERATIONS', 'LEGAL'] as const) {
      expect(
        syaratTambahanTujuan({ tujuan: t, ethicsApprovalRef: null, breakGlass: false }).sah,
      ).toBe(true);
    }
  });
});

describe('H-12 · Break-glass', () => {
  it('SATU-SATUNYA dasar penolakan adalah alasan yang lebih pendek dari sepuluh huruf', () => {
    /*
     * Angkanya disalin dari constraint health_access_breakglass_needs_reason
     * pada H002, tidak dipilih di sini. Fungsi yang memakai angka berbeda akan
     * meloloskan permintaan yang kemudian ditolak basis data, dengan pesan
     * galat yang tidak dapat dibaca siapa pun.
     */
    expect(PANJANG_ALASAN_MINIMUM).toBe(10);
    for (const alasan of [null, '', 'cek', 'darurat']) {
      expect(periksaBreakGlass({ alasan, patientTerdaftarPadaAktor: false }).diizinkan).toBe(false);
    }
  });

  it('penolakannya menyatakan bahwa ia BUKAN penilaian tentang keadaan daruratnya', () => {
    const h = periksaBreakGlass({ alasan: 'cek', patientTerdaftarPadaAktor: false });
    expect(h.alasan).toContain('SATU-SATUNYA');
    expect(h.alasan).toContain('health_access_breakglass_needs_reason');
  });

  it('percobaan yang ditolak pun tetap wajib ditelaah', () => {
    // Percobaan break-glass yang gagal berulang kali adalah pola yang perlu
    // dilihat orang.
    expect(periksaBreakGlass({ alasan: '', patientTerdaftarPadaAktor: false }).wajibTelaah).toBe(
      true,
    );
  });

  it('alasan sepuluh huruf DITERIMA — uji kendali pada batasnya persis', () => {
    const tepat = periksaBreakGlass({ alasan: '1234567890', patientTerdaftarPadaAktor: false });
    expect(tepat.diizinkan).toBe(true);
  });

  it('alasan yang sah tetapi pendek tidak menahan akses, hanya menaikkan telaahnya', () => {
    const pendek = periksaBreakGlass({ alasan: 'perlu segera', patientTerdaftarPadaAktor: false });
    expect(pendek.diizinkan).toBe(true);
    expect(pendek.wajibTelaah).toBe(true);
    expect(pendek.alasan).toContain('DIIZINKAN');
  });

  it('akses ke pasien yang bukan pasiennya sendiri selalu ditelaah', () => {
    expect(
      periksaBreakGlass({
        alasan: 'Pasien tidak sadarkan diri di IGD, keluarga belum tiba.',
        patientTerdaftarPadaAktor: false,
      }).wajibTelaah,
    ).toBe(true);
  });

  it('akses ke pasiennya sendiri tidak wajib ditelaah — tetapi tetap dicatat', () => {
    expect(
      periksaBreakGlass({
        alasan: 'Pasien tidak sadarkan diri di IGD, keluarga belum tiba.',
        patientTerdaftarPadaAktor: true,
      }).wajibTelaah,
    ).toBe(false);
  });

  it('antrean telaah diurut menurut yang paling mencurigakan, bukan menurut waktu', () => {
    const hasil = antreanTelaah([
      {
        id: 'wajar',
        alasan: 'Pasien tidak sadarkan diri di IGD, keluarga belum tiba.',
        umurJam: 1,
        aktorMerawatPasien: true,
        diLuarJamKerja: false,
      },
      {
        id: 'mencurigakan',
        alasan: 'cek',
        umurJam: 200,
        aktorMerawatPasien: false,
        diLuarJamKerja: true,
      },
    ]);
    expect(hasil[0].accessLogId).toBe('mencurigakan');
    expect(hasil[0].prioritas).toBe('HIGH');
    expect(hasil[1].prioritas).toBe('LOW');
  });

  it('tiga tanda menghasilkan HIGH, satu tanda MEDIUM, nol tanda LOW', () => {
    const [tiga, satu, nol] = antreanTelaah([
      { id: 'a', alasan: 'x', umurJam: 1, aktorMerawatPasien: false, diLuarJamKerja: true },
      {
        id: 'b',
        alasan: 'Pasien tidak sadarkan diri di IGD, keluarga belum tiba.',
        umurJam: 1,
        aktorMerawatPasien: false,
        diLuarJamKerja: false,
      },
      {
        id: 'c',
        alasan: 'Pasien tidak sadarkan diri di IGD, keluarga belum tiba.',
        umurJam: 1,
        aktorMerawatPasien: true,
        diLuarJamKerja: false,
      },
    ]);
    expect(tiga.prioritas).toBe('HIGH');
    expect(satu.prioritas).toBe('MEDIUM');
    expect(nol.prioritas).toBe('LOW');
  });

  it('temuan menyebutkan mengapa ia perlu ditelaah', () => {
    const [t] = antreanTelaah([
      { id: 'a', alasan: 'x', umurJam: 1, aktorMerawatPasien: false, diLuarJamKerja: true },
    ]);
    expect(t.alasan).toContain('bukan pasien yang dirawatnya');
    expect(t.alasan).toContain('alasannya pendek');
    expect(t.alasan).toContain('di luar jam kerja');
  });

  it('antrean kosong menghasilkan antrean kosong, bukan galat', () => {
    expect(antreanTelaah([])).toEqual([]);
  });

  it('yang lebih lama menunggu didahulukan di antara yang sama mencurigakannya', () => {
    const hasil = antreanTelaah([
      { id: 'baru', alasan: 'x', umurJam: 2, aktorMerawatPasien: false, diLuarJamKerja: false },
      { id: 'lama', alasan: 'y', umurJam: 90, aktorMerawatPasien: false, diLuarJamKerja: false },
    ]);
    expect(hasil.map((h) => h.accessLogId)).toEqual(['lama', 'baru']);
  });
});

describe('H-12 · Penyamaran medan', () => {
  it('menyisakan bentuknya, bukan menghapusnya', () => {
    expect(samarkanNilai('Tono Suryo', 'IDENTIFYING')).toBe('T*** S****');
  });

  it('dua nama berbeda tetap terlihat berbeda sesudah disamarkan', () => {
    const a = samarkanNilai('Tono Suryo', 'IDENTIFYING');
    const b = samarkanNilai('Sri Wahyuni', 'IDENTIFYING');
    expect(a).not.toBe(b);
  });

  it('nomor menyisakan empat huruf terakhir — cukup mencocokkan, tidak cukup mengenali', () => {
    expect(samarkanNilai('3201234567890001', 'IDENTIFYING')).toBe('************0001');
  });

  it('tidak menyamarkan zona publik dan operasional', () => {
    expect(samarkanNilai('Poliklinik Anak', 'PUBLIC')).toBe('Poliklinik Anak');
    expect(samarkanNilai('150000', 'OPERATIONAL')).toBe('150000');
  });

  it('menyamarkan zona klinis dan klinis sangat sensitif', () => {
    expect(samarkanNilai('B20', 'SENSITIVE_CLINICAL')).not.toBe('B20');
    expect(samarkanNilai('J18.9', 'CLINICAL')).not.toBe('J18.9');
  });

  it('nilai kosong tetap kosong; satu huruf menjadi satu bintang', () => {
    expect(samarkanNilai(null, 'IDENTIFYING')).toBeNull();
    expect(samarkanNilai('', 'IDENTIFYING')).toBe('');
    expect(samarkanNilai('A', 'IDENTIFYING')).toBe('*');
  });

  it('nomor pendek disamarkan seluruhnya — empat huruf terakhir dari nilai empat huruf adalah nilai itu sendiri', () => {
    expect(samarkanNilai('0001', 'IDENTIFYING')).toBe('****');
  });

  it('nama satu kata tetap menyisakan huruf pertamanya', () => {
    expect(samarkanNilai('Budi', 'IDENTIFYING')).toBe('B***');
  });
});

describe('H-12 · Isolasi antar-tenant', () => {
  it('meloloskan permintaan yang ruang kerjanya sesuai — uji kendali', () => {
    expect(periksaIsolasi({ schemaDiminta: 'demo', schemaToken: 'demo' }).sah).toBe(true);
  });

  it('menolak ruang kerja yang berbeda', () => {
    const hasil = periksaIsolasi({ schemaDiminta: 'klinik_b', schemaToken: 'demo' });
    expect(hasil.sah).toBe(false);
    expect(hasil.alasan).toContain('berbeda');
  });

  it('menolak permintaan tanpa ruang kerja — tidak ada nilai bawaan', () => {
    expect(periksaIsolasi({ schemaDiminta: null, schemaToken: 'demo' }).sah).toBe(false);
    expect(periksaIsolasi({ schemaDiminta: undefined, schemaToken: 'demo' }).sah).toBe(false);
    expect(periksaIsolasi({ schemaDiminta: '', schemaToken: 'demo' }).sah).toBe(false);
  });

  it('menolak token yang tidak menyebut ruang kerja mana pun', () => {
    expect(periksaIsolasi({ schemaDiminta: 'demo', schemaToken: null }).sah).toBe(false);
  });

  it('tidak pernah jatuh ke public sebagai nilai bawaan', () => {
    expect(periksaIsolasi({ schemaDiminta: 'public', schemaToken: 'demo' }).sah).toBe(false);
    expect(periksaIsolasi({ schemaDiminta: null, schemaToken: null }).sah).toBe(false);
  });

  it('membedakan huruf besar-kecil: Demo bukan demo', () => {
    expect(periksaIsolasi({ schemaDiminta: 'Demo', schemaToken: 'demo' }).sah).toBe(false);
  });
});

describe('H-12 · Isolasi antar-vertical', () => {
  it('mengenali tabel kesehatan dari awalannya', () => {
    for (const t of [
      'health_access_log',
      'patient',
      'patient_portal_account',
      'lab_result',
      'rx_prescription',
      'medical_device',
      'bpjs_claim',
      'satusehat_resource_map',
      'kfa_item',
    ]) {
      expect(tabelMilikKesehatan(t)).toBe(true);
    }
  });

  it('tidak mengakui tabel milik vertical lain sebagai tabel kesehatan', () => {
    for (const t of [
      'member',
      'savings_account',
      'loan',
      'pos_order',
      'journal_entry',
      'inventory_item',
      'user',
      'role',
    ]) {
      expect(tabelMilikKesehatan(t)).toBe(false);
    }
  });

  it('member pada koperasi bukan patient pada kesehatan, sekalipun keduanya orang', () => {
    expect(tabelMilikKesehatan('member')).toBe(false);
    expect(tabelMilikKesehatan('patient')).toBe(true);
  });

  it('daftar awalannya tidak memuat awalan kosong yang akan mencocokkan segalanya', () => {
    for (const a of AWALAN_TABEL_KESEHATAN) {
      expect(a.length).toBeGreaterThan(2);
    }
  });
});

describe('H-12 · Redaksi AI untuk data kesehatan', () => {
  it('menyamarkan nomor rekam medis', () => {
    const h = redaksiKesehatan('Pasien RM-004512 datang kembali.');
    expect(h.teks).toContain('[RM-DISAMARKAN]');
    expect(h.teks).not.toContain('004512');
  });

  it('menyamarkan kode diagnosis ICD-10', () => {
    const h = redaksiKesehatan('Diagnosis J18.9 dan B20.');
    expect(h.teks).not.toContain('J18.9');
    expect(h.teks).not.toContain('B20');
  });

  it('menyamarkan nomor SEP dan nomor kepesertaan JKN', () => {
    const h = redaksiKesehatan('SEP-0301R0112500001 untuk peserta 0001234567890.');
    expect(h.teks).not.toContain('0301R0112500001');
    expect(h.teks).not.toContain('0001234567890');
  });

  it('melaporkan apa yang disamarkan, tidak membuangnya diam-diam', () => {
    const h = redaksiKesehatan('Diagnosis J18.9 dan B20 pada RM-004512.');
    expect(h.disamarkan.map((d) => d.nama)).toContain('kode diagnosis ICD-10');
    expect(h.disamarkan.find((d) => d.nama === 'kode diagnosis ICD-10')?.jumlah).toBe(2);
  });

  it('teks tanpa pola kesehatan tidak berubah sedikit pun', () => {
    const asli = 'Jam praktik poliklinik anak hari Senin sampai Jumat.';
    const h = redaksiKesehatan(asli);
    expect(h.teks).toBe(asli);
    expect(h.disamarkan).toEqual([]);
    expect(h.bersih).toBe(true);
  });

  it('teks yang sudah disamarkan dinyatakan bersih', () => {
    expect(redaksiKesehatan('Pasien RM-004512 dengan J18.9.').bersih).toBe(true);
  });

  it('penggantinya tidak memuat angka, sehingga tidak tercocokkan ulang', () => {
    for (const p of POLA_KESEHATAN) {
      expect(p.ganti).not.toMatch(/\d/);
    }
  });

  it('penyamaran dua kali menghasilkan hasil yang sama — ia mantap', () => {
    const sekali = redaksiKesehatan('RM-004512 J18.9').teks;
    expect(redaksiKesehatan(sekali).teks).toBe(sekali);
  });

  it('setiap pola memakai tanda global, sehingga kemunculan kedua ikut disamarkan', () => {
    for (const p of POLA_KESEHATAN) {
      expect(p.pola.flags).toContain('g');
    }
    const h = redaksiKesehatan('RM-004512 lalu RM-004513');
    expect(h.teks).not.toContain('004513');
  });
});

describe('H-12 · Penjaga pengiriman ke AI', () => {
  it('menolak zona klinis, sekalipun teksnya sudah bersih', () => {
    const h = bolehKirimKeAi({ zona: 'CLINICAL', teks: 'tidak ada apa-apa', tenantIds: ['a'] });
    expect(h.boleh).toBe(false);
  });

  it('meloloskan zona operasional dengan teks bersih dan satu tenant — uji kendali', () => {
    const h = bolehKirimKeAi({
      zona: 'OPERATIONAL',
      teks: 'Tarif poliklinik anak naik.',
      tenantIds: ['a', 'a'],
    });
    expect(h.boleh).toBe(true);
  });

  it('menolak permintaan yang menggabungkan dua tenant, sekalipun zonanya boleh', () => {
    const h = bolehKirimKeAi({
      zona: 'OPERATIONAL',
      teks: 'Bandingkan tarif kedua klinik.',
      tenantIds: ['a', 'b'],
    });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('dibandingkan');
  });

  it('pemeriksaan lintas-tenant didahulukan atas pemeriksaan zona', () => {
    const h = bolehKirimKeAi({ zona: 'PUBLIC', teks: 'apa pun', tenantIds: ['a', 'b'] });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tenant');
  });

  it('selalu mengembalikan hasil redaksinya, termasuk ketika menolak', () => {
    const h = bolehKirimKeAi({ zona: 'CLINICAL', teks: 'RM-004512', tenantIds: ['a'] });
    expect(h.hasilRedaksi.teks).toContain('[RM-DISAMARKAN]');
  });

  it('tenant kosong pada daftar tidak dihitung sebagai tenant kedua', () => {
    const h = bolehKirimKeAi({ zona: 'PUBLIC', teks: 'apa pun', tenantIds: ['a', '', 'a'] });
    expect(h.boleh).toBe(true);
  });
});

describe('H-12 · Tindakan yang tidak boleh dilakukan AI', () => {
  it('menolak setiap tindakan pada daftar terlarang', () => {
    for (const t of TINDAKAN_TERLARANG_AI) {
      expect(bolehAiMelakukan(t.kode).boleh).toBe(false);
      expect(tindakanTerlarangAi(t.kode)).toBe(true);
    }
  });

  it('setiap larangan menyebutkan sebabnya', () => {
    for (const t of TINDAKAN_TERLARANG_AI) {
      expect(t.sebab.length).toBeGreaterThan(20);
    }
  });

  it('memuat pembayaran, penjurnalan, persetujuan, penghapusan, dan hak akses', () => {
    const kode = TINDAKAN_TERLARANG_AI.map((t) => t.kode);
    for (const k of ['PAYMENT', 'POSTING', 'APPROVAL', 'DELETE', 'RBAC']) {
      expect(kode).toContain(k);
    }
  });

  it('memuat pula yang khas kesehatan: peresepan, perintah alat, dan pelepasan hasil', () => {
    const kode = TINDAKAN_TERLARANG_AI.map((t) => t.kode);
    for (const k of ['PRESCRIBE', 'DEVICE_COMMAND', 'RESULT_RELEASE']) {
      expect(kode).toContain(k);
    }
  });

  it('penolakannya menyebutkan apa yang MASIH dapat dilakukan AI', () => {
    const h = bolehAiMelakukan('PAYMENT');
    expect(h.alasan).toContain('mengusulkan');
  });

  it('tindakan yang tidak terlarang diloloskan — uji kendali', () => {
    expect(bolehAiMelakukan('SUMMARIZE').boleh).toBe(true);
    expect(tindakanTerlarangAi('SUMMARIZE')).toBe(false);
  });

  it('kode larangan tidak berulang', () => {
    const kode = TINDAKAN_TERLARANG_AI.map((t) => t.kode);
    expect(new Set(kode).size).toBe(kode.length);
  });
});
