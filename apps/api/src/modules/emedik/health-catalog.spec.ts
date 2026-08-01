/**
 * Pengujian katalog menu, peran, dan hak akses kesehatan.
 *
 * Yang dijaga di sini adalah kesalahan yang tidak menimbulkan galat: peran yang
 * menunjuk hak akses yang tidak ada tetap dapat disimpan, tetapi hak itu tidak
 * pernah berlaku — dan tidak ada yang menyadarinya sampai seseorang mengeluh
 * tidak dapat membuka menu yang seharusnya boleh.
 */

import {
  HEALTH_MENU,
  HEALTH_PERMISSION_ACTIONS,
  HEALTH_ROLES,
  HEALTH_SOD_RULES,
  daftarHakAkses,
} from './health-catalog';

describe('menu kesehatan', () => {
  it('kode menu unik', () => {
    const kode = HEALTH_MENU.map((m) => m.code);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('seluruhnya berawalan HEALTH', () => {
    // Panduan koordinasi §4 menetapkan awalan per vertical. Menu tanpa awalan
    // akan bertabrakan dengan menu vertical lain saat digabungkan Core.
    for (const m of HEALTH_MENU) {
      expect(m.code.startsWith('HEALTH')).toBe(true);
    }
  });

  it('setiap induk yang ditunjuk benar-benar ada', () => {
    const kode = new Set(HEALTH_MENU.map((m) => m.code));
    for (const m of HEALTH_MENU) {
      if (m.parentCode) expect(kode.has(m.parentCode)).toBe(true);
    }
  });

  it('hanya ada satu akar', () => {
    const akar = HEALTH_MENU.filter((m) => !m.parentCode);
    expect(akar).toHaveLength(1);
    expect(akar[0].code).toBe('HEALTH');
  });

  it('setiap menu punya sekurang-kurangnya aksi READ', () => {
    // Menu tanpa READ tidak dapat dibuka siapa pun, sehingga aksi lainnya
    // tidak pernah terpakai.
    for (const m of HEALTH_MENU) {
      expect(m.actions).toContain('READ');
    }
  });

  it('menu yang punya rute tidak ditandai sedang dibangun', () => {
    for (const m of HEALTH_MENU) {
      if (m.route) expect(m.comingSoon ?? false).toBe(false);
    }
  });

  it('menu yang belum punya rute ditandai sedang dibangun', () => {
    /*
     * Ditandai, bukan disembunyikan. Menu yang diklik lalu tidak menampilkan
     * apa pun jauh lebih buruk daripada menu yang mengatakan sedang dibangun —
     * yang pertama terasa seperti kerusakan.
     */
    for (const m of HEALTH_MENU) {
      if (!m.route && m.parentCode) expect(m.comingSoon).toBe(true);
    }
  });

  it('jejak pembacaan hanya dapat dibaca dan diekspor', () => {
    // Jejak yang dapat disunting pihak yang diaudit tidak membuktikan apa pun
    // ketika benar-benar dibutuhkan.
    const jejak = HEALTH_MENU.find((m) => m.code === 'HEALTH_ACCESS_LOG');
    expect(jejak?.actions.sort()).toEqual(['EXPORT', 'READ']);
  });
});

describe('aksi hak akses kesehatan', () => {
  it('kode aksi unik', () => {
    const kode = HEALTH_PERMISSION_ACTIONS.map((a) => a.code);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('setiap aksi baru menyertakan alasan keberadaannya', () => {
    /*
     * Aksi tanpa alasan adalah aksi yang tidak dapat dinilai apakah memang
     * perlu, dan daftar hak akses yang membengkak tanpa alasan adalah daftar
     * yang akhirnya diberikan seluruhnya kepada semua orang.
     */
    for (const a of HEALTH_PERMISSION_ACTIONS) {
      expect(a.reason.length).toBeGreaterThan(30);
    }
  });

  it('meresepkan dan menyerahkan obat adalah dua aksi berbeda', () => {
    // Supaya peresep tidak menyerahkan obatnya sendiri.
    const kode = HEALTH_PERMISSION_ACTIONS.map((a) => a.code);
    expect(kode).toContain('PRESCRIBE');
    expect(kode).toContain('DISPENSE');
  });
});

describe('peran kesehatan', () => {
  it('kode peran unik', () => {
    const kode = HEALTH_ROLES.map((r) => r.code);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('setiap hak akses yang ditunjuk peran benar-benar ada pada katalog menu', () => {
    /*
     * Inilah kesalahan yang tidak menimbulkan galat. Peran yang menunjuk
     * `HEALTH_PATIENT.PRESCRIBE` tetap tersimpan, tetapi haknya tidak pernah
     * berlaku karena menu itu tidak punya aksi tersebut — dan yang mengeluh
     * kemudian adalah dokter yang tidak dapat bekerja.
     */
    const sah = daftarHakAkses();
    const salah: string[] = [];
    for (const r of HEALTH_ROLES) {
      for (const p of r.permissions) {
        if (!sah.has(p)) salah.push(`${r.code} -> ${p}`);
      }
    }
    expect(salah).toEqual([]);
  });

  it('setiap peran punya keterangan yang bermakna', () => {
    for (const r of HEALTH_ROLES) {
      expect(r.description.length).toBeGreaterThan(25);
    }
  });

  it('administrator TIDAK dapat membaca rekam medis pasien', () => {
    /*
     * Mengelola sistem tidak menuntut membaca diagnosis siapa pun. Hak yang
     * tidak dibutuhkan adalah hak yang akan disalahgunakan — dan administrator
     * adalah peran yang paling sering diberikan kepada orang yang paling
     * banyak dimintai tolong.
     */
    const admin = HEALTH_ROLES.find((r) => r.code === 'HEALTH_ADMIN');
    expect(admin?.permissions).not.toContain('HEALTH_PATIENT.READ');
    expect(admin?.permissions.some((p) => p.startsWith('HEALTH_PATIENT.'))).toBe(false);
  });

  it('petugas pendaftaran tidak dapat menggabungkan rekam medis', () => {
    // Menandai dugaan ganda dan menggabungkannya adalah dua wewenang berbeda.
    const clerk = HEALTH_ROLES.find((r) => r.code === 'HEALTH_REGISTRATION_CLERK');
    expect(clerk?.permissions).toContain('HEALTH_PATIENT_DUPLICATE.REVIEW');
    expect(clerk?.permissions.some((p) => p.endsWith('.MERGE_PATIENT'))).toBe(false);
  });

  it('hanya petugas rekam medis yang dapat menggabungkan', () => {
    const boleh = HEALTH_ROLES.filter((r) =>
      r.permissions.some((p) => p.endsWith('.MERGE_PATIENT')),
    ).map((r) => r.code);
    expect(boleh).toEqual(['HEALTH_MEDICAL_RECORD_OFFICER']);
  });

  it('hanya dokter yang punya akses darurat', () => {
    const boleh = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_PATIENT.BREAK_GLASS'),
    ).map((r) => r.code);
    expect(boleh).toEqual(['HEALTH_DOCTOR']);
  });

  it('pelaporan insiden diberikan LUAS kepada peran klinis', () => {
    /*
     * Sengaja longgar. Program keselamatan pasien bergantung pada orang yang mau
     * melapor, dan yang paling sering melihat kejadian bukan petugas mutu —
     * melainkan perawat malam, apoteker yang menerima resep aneh, dan analis
     * yang menerima spesimen tanpa label.
     */
    const boleh = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_SAFETY.CREATE'),
    ).map((r) => r.code);
    expect(boleh.length).toBeGreaterThanOrEqual(12);
    for (const wajib of [
      'HEALTH_NURSE',
      'HEALTH_DOCTOR',
      'HEALTH_PHARMACIST',
      'HEALTH_LAB_ANALYST',
      'HEALTH_WARD_CLERK',
      'HEALTH_CADRE',
    ]) {
      expect(boleh).toContain(wajib);
    }
  });

  it('menutup laporan insiden diberikan SEMPIT', () => {
    // Melapor dan menutup adalah dua wewenang yang berlawanan sifatnya.
    const boleh = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_SAFETY.APPROVE'),
    ).map((r) => r.code).sort();
    expect(boleh).toEqual(['HEALTH_PATIENT_SAFETY_OFFICER', 'HEALTH_QUALITY_MANAGER']);
  });

  it('direktur melihat insiden tetapi tidak menutup dan tidak melapor', () => {
    /*
     * Direktur yang dapat menutup laporan tentang fasilitasnya sendiri adalah
     * pihak yang paling berkepentingan agar angkanya bagus.
     */
    const direktur = HEALTH_ROLES.find((r) => r.code === 'HEALTH_DIRECTOR');
    expect(direktur?.permissions).toContain('HEALTH_SAFETY.READ');
    expect(direktur?.permissions).not.toContain('HEALTH_SAFETY.APPROVE');
    expect(direktur?.permissions).not.toContain('HEALTH_SAFETY.CREATE');
  });

  it('penahanan hukum hanya dipegang petugas hukum', () => {
    // Menahan seluruh rekam medis seorang pasien adalah wewenang yang tidak
    // boleh melekat pada peran yang dipegang puluhan orang.
    const boleh = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_LEGAL_HOLD.CREATE'),
    ).map((r) => r.code);
    expect(boleh).toEqual(['HEALTH_LEGAL_OFFICER']);
  });

  it('yang memutuskan pelepasan informasi bukan yang menyerahkan berkasnya', () => {
    const memutuskan = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_INFO_RELEASE.CREATE'),
    ).map((r) => r.code);
    const menyerahkan = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_INFO_RELEASE.EXPORT'),
    ).map((r) => r.code);
    expect(memutuskan).toEqual(['HEALTH_LEGAL_OFFICER']);
    expect(menyerahkan).toEqual(['HEALTH_MEDICAL_RECORD_OFFICER']);
  });

  it('yang memetakan layanan bukan yang mengaktifkannya', () => {
    const memetakan = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_SERVICE_CATALOG.UPDATE'),
    ).map((r) => r.code);
    const mengaktifkan = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_SERVICE_CATALOG.ACTIVATE'),
    ).map((r) => r.code);
    expect(memetakan).toEqual(['HEALTH_SERVICE_CATALOGUER']);
    expect(mengaktifkan).toEqual(['HEALTH_ADMIN']);
  });

  it('petugas keuangan TIDAK dapat membaca rekam medis pasien', () => {
    /*
     * Ia perlu tahu bahwa pendapatan laboratorium masuk ke akun 4160; ia tidak
     * perlu tahu siapa yang diperiksa. Menggabungkan keduanya adalah cara
     * paling sunyi untuk membocorkan seluruh riwayat pasien: jejaknya tenggelam
     * di antara ribuan pembacaan yang sah.
     */
    const keuangan = HEALTH_ROLES.find((r) => r.code === 'HEALTH_FINANCE_OFFICER');
    expect(keuangan?.permissions).toContain('HEALTH_ACCOUNTING_MAP.UPDATE');
    expect(keuangan?.permissions.some((p) => p.startsWith('HEALTH_PATIENT'))).toBe(false);
  });

  it('yang memetakan akuntansi bukan yang mengaktifkan profilnya', () => {
    const memetakan = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_ACCOUNTING_MAP.UPDATE'),
    ).map((r) => r.code);
    const mengaktifkan = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_ACCOUNTING_MAP.ACTIVATE'),
    ).map((r) => r.code);
    expect(memetakan).toEqual(['HEALTH_FINANCE_OFFICER']);
    expect(mengaktifkan).toEqual(['HEALTH_ADMIN']);
  });

  it('yang mengimpor tarif bukan yang menyetujuinya', () => {
    /*
     * Persetujuan tarif mengubah seluruh tagihan rumah sakit sejak tanggal
     * berlakunya. Yang pertama menyadari penyatuannya adalah penjamin yang
     * menolak seluruh klaim bulan itu.
     */
    const mengimpor = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_TARIFF.IMPORT'),
    ).map((r) => r.code);
    const menyetujui = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_TARIFF.APPROVE'),
    ).map((r) => r.code);
    expect(mengimpor).toEqual(['HEALTH_TARIFF_OFFICER']);
    expect(menyetujui).toEqual(['HEALTH_ADMIN']);
  });

  it('petugas pendaftaran melihat tanggungan penjamin saat pasien datang', () => {
    // Bukan saat tagihannya dicetak — saat itu sudah terlambat bagi pasien
    // yang mengira layanannya ditanggung.
    const clerk = HEALTH_ROLES.find((r) => r.code === 'HEALTH_REGISTRATION_CLERK');
    expect(clerk?.permissions).toContain('HEALTH_PAYER.READ');
    expect(clerk?.permissions).not.toContain('HEALTH_PAYER.UPDATE');
  });

  it('penyusun kebijakan jasa bukan penyetujunya', () => {
    const menyusun = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_FEE_POLICY.CREATE'),
    ).map((r) => r.code);
    const menyetujui = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_FEE_POLICY.APPROVE'),
    ).map((r) => r.code);
    expect(menyusun).toEqual(['HEALTH_FEE_ADMINISTRATOR']);
    expect(menyetujui).toEqual(['HEALTH_FEE_APPROVER']);
  });

  it('yang mencatat kontributor adalah yang berada di kamar operasi', () => {
    /*
     * Merekalah yang melihat siapa yang hadir. Bagian keuangan hanya melihat
     * daftarnya, dan daftar yang disusun dari jauh adalah daftar keinginan.
     */
    const mencatat = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_FEE_CONTRIBUTOR.CREATE'),
    ).map((r) => r.code).sort();
    expect(mencatat).toEqual(['HEALTH_FEE_ADMINISTRATOR', 'HEALTH_SCRUB_NURSE']);
  });

  it('empat wewenang settlement dipegang empat peran berbeda', () => {
    /*
     * Menghitung, menyetujui, mengunci dan membayar, lalu mengoreksi. Tidak
     * satu pun peran bawaan memegang dua di antaranya — dan aturan SoD-nya
     * menegakkan itu pula.
     */
    const pemegang = (aksi: string) =>
      HEALTH_ROLES.filter((r) => r.permissions.includes(`HEALTH_FEE_SETTLEMENT.${aksi}`))
        .map((r) => r.code);

    expect(pemegang('CREATE')).toEqual(['HEALTH_SETTLEMENT_CLERK']);
    expect(pemegang('APPROVE')).toEqual(['HEALTH_FEE_APPROVER']);
    expect(pemegang('POST')).toEqual(['HEALTH_SETTLEMENT_PAYER']);
    expect(pemegang('REVERSE')).toEqual(['HEALTH_FINANCE_OFFICER']);
  });

  it('tidak ada peran yang dapat menerbitkan pernyataan sekaligus menghitungnya', () => {
    const menerbitkan = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_FEE_STATEMENT.CREATE'),
    );
    for (const r of menerbitkan) {
      expect(r.permissions).not.toContain('HEALTH_FEE_SETTLEMENT.CREATE');
    }
  });

  it('pemegang kontrak investor TIDAK memperoleh satu pun hak klinis', () => {
    /*
     * Yang membedakan pembagian hasil dari pembukaan rekam medis bukan niat,
     * melainkan hak akses mana yang pernah diberikan — dan hak yang pernah
     * diberikan jarang ditarik kembali, sebab menariknya menuntut seseorang
     * menyadari bahwa ia pernah diberikan.
     */
    const investor = HEALTH_ROLES.find((r) => r.code === 'HEALTH_INVESTOR_VIEWER');
    expect(investor?.permissions).toEqual([
      'HEALTH.READ',
      'HEALTH_FEE_CONTRACT.READ',
      'HEALTH_INVESTOR_DASHBOARD.READ',
    ]);

    const terlarang = [
      'HEALTH_PATIENT',
      'HEALTH_HIM_CODING',
      'HEALTH_SAFETY',
      'HEALTH_LAB_RESULT',
      'HEALTH_PRESCRIPTION',
      'HEALTH_ACCESS_LOG',
      'HEALTH_LEGAL_HOLD',
      'HEALTH_INFO_RELEASE',
    ];
    for (const p of investor?.permissions ?? []) {
      expect(terlarang.some((t) => p.startsWith(`${t}.`))).toBe(false);
    }
  });

  it('kontrak fee menuntut tiga peran berbeda', () => {
    const pemegang = (aksi: string) =>
      HEALTH_ROLES.filter((r) => r.permissions.includes(`HEALTH_FEE_CONTRACT.${aksi}`))
        .map((r) => r.code);

    expect(pemegang('CREATE')).toEqual(['HEALTH_CONTRACT_DRAFTER']);
    expect(pemegang('REVIEW')).toEqual(['HEALTH_LEGAL_OFFICER']);
    expect(pemegang('APPROVE')).toEqual(['HEALTH_CONTRACT_APPROVER']);
  });

  it('yang memverifikasi klaim bukan yang mengajukannya', () => {
    const memverifikasi = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_CLAIM.VERIFY'),
    ).map((r) => r.code);
    const mengajukan = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_CLAIM.SUBMIT'),
    ).map((r) => r.code);
    expect(memverifikasi).toEqual(['HEALTH_CLAIM_VERIFIER']);
    expect(mengajukan).toEqual(['HEALTH_CLAIM_OFFICER']);
  });

  it('koder membaca klaim tetapi tidak memverifikasinya', () => {
    /*
     * Verifikasi oleh yang mengodenya hanya membaca ulang pilihannya sendiri.
     * Pemisahannya per klaim, bukan per hak akses — tetapi peran bawaan koder
     * memang tidak diberi VERIFY.
     */
    const koder = HEALTH_ROLES.find((r) => r.code === 'HEALTH_CODER');
    expect(koder?.permissions).toContain('HEALTH_CLAIM.READ');
    expect(koder?.permissions).not.toContain('HEALTH_CLAIM.VERIFY');
  });

  it('penghapusan data contoh hanya dipegang administrator', () => {
    // Penghapusannya menolak bila ada data nyata yang merujuknya, dan keputusan
    // atas penolakan itu harus diambil orang yang dapat menilai akibatnya.
    const boleh = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_MASTER_DATA.DELETE'),
    ).map((r) => r.code);
    expect(boleh).toEqual(['HEALTH_ADMIN']);
  });

  it('koder tidak memverifikasi, verifikator tidak mengode', () => {
    const koder = HEALTH_ROLES.find((r) => r.code === 'HEALTH_CODER');
    const verifikator = HEALTH_ROLES.find((r) => r.code === 'HEALTH_CODING_VERIFIER');
    expect(koder?.permissions).toContain('HEALTH_HIM_CODING.CREATE');
    expect(koder?.permissions).not.toContain('HEALTH_HIM_CODING.VERIFY');
    expect(verifikator?.permissions).toContain('HEALTH_HIM_CODING.VERIFY');
    expect(verifikator?.permissions).not.toContain('HEALTH_HIM_CODING.CREATE');
  });

  it('teknisi elektromedis TIDAK menyalakan kendali jarak jauh', () => {
    const teknisi = HEALTH_ROLES.find((r) => r.code === 'HEALTH_BIOMEDICAL_ENGINEER');
    expect(teknisi?.permissions).toContain('HEALTH_DEVICE.MANAGE_DEVICE');
    expect(teknisi?.permissions).not.toContain('HEALTH_DEVICE.ACTIVATE');
  });

  it('teknisi elektromedis TIDAK membaca rekam medis pasien', () => {
    /*
     * Ia mengurus benda. Alat yang dipasangnya menghasilkan angka tentang
     * pasien, tetapi merawat alatnya tidak menuntut mengetahui siapa yang
     * diperiksa.
     */
    const teknisi = HEALTH_ROLES.find((r) => r.code === 'HEALTH_BIOMEDICAL_ENGINEER');
    expect(teknisi?.permissions).not.toContain('HEALTH_PATIENT.READ');
  });

  it('tidak ada peran bawaan yang menyalakan kendali jarak jauh alat', () => {
    /*
     * ACTIVATE sengaja tidak diberikan kepada peran bawaan mana pun. Ia harus
     * diberikan dengan sadar oleh administrator tenant kepada orang yang
     * ditunjuk namanya — bukan diwarisi seseorang karena perannya kebetulan
     * bernama "administrator".
     */
    const pemegang = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_DEVICE.ACTIVATE'),
    ).map((r) => r.code);
    expect(pemegang).toEqual([]);
  });

  it('yang mengaitkan hasil alat bukan yang menelaahnya', () => {
    const petugas = HEALTH_ROLES.find((r) => r.code === 'HEALTH_DEVICE_INBOX_CLERK');
    expect(petugas?.permissions).toContain('HEALTH_DEVICE_INBOX.ASSIGN');
    expect(petugas?.permissions).not.toContain('HEALTH_DEVICE_INBOX.REVIEW');
  });

  it('ANALIS KEAMANAN TIDAK DAPAT MENYENTUH ALAT', () => {
    /*
     * Aturan yang paling penting pada H-9J, dan ia berbentuk KETIADAAN.
     *
     * Analis keamanan yang dapat mematikan alat adalah analis keamanan yang,
     * pada suatu malam yang buruk, akan mematikan alat yang sedang menopang
     * seseorang.
     */
    const analis = HEALTH_ROLES.find((r) => r.code === 'HEALTH_DEVICE_SECURITY_ANALYST');
    const terlarang = [
      'HEALTH_DEVICE.MANAGE_DEVICE',
      'HEALTH_DEVICE.ACTIVATE',
      'HEALTH_DEVICE.UPDATE',
      'HEALTH_DEVICE.CREATE',
    ];
    expect(terlarang.filter((p) => analis?.permissions.includes(p))).toEqual([]);
    expect(analis?.permissions).toContain('HEALTH_DEVICE.READ');
  });

  it('yang menilai risiko alat bukan yang memutuskan penerimaannya', () => {
    const analis = HEALTH_ROLES.find((r) => r.code === 'HEALTH_DEVICE_SECURITY_ANALYST');
    expect(analis?.permissions).toContain('HEALTH_DEVICE_SECURITY.CREATE');
    expect(analis?.permissions).not.toContain('HEALTH_DEVICE_SECURITY.APPROVE');
  });

  it('tidak ada peran bawaan yang memutuskan penerimaan risiko alat', () => {
    // Sama seperti ACTIVATE: keputusannya menyangkut uang dan pelayanan yang
    // terhenti, dan ia harus diberikan dengan sadar kepada orang yang ditunjuk
    // namanya.
    const pemegang = HEALTH_ROLES.filter((r) =>
      r.permissions.includes('HEALTH_DEVICE_SECURITY.APPROVE'),
    ).map((r) => r.code);
    expect(pemegang).toEqual([]);
  });

  it('teknisi menutup pekerjaan tetapi tidak menilai risiko siber', () => {
    const teknisi = HEALTH_ROLES.find((r) => r.code === 'HEALTH_BIOMEDICAL_ENGINEER');
    expect(teknisi?.permissions).toContain('HEALTH_DEVICE_MAINTENANCE.RELEASE');
    expect(teknisi?.permissions).toContain('HEALTH_DEVICE_SECURITY.READ');
    expect(teknisi?.permissions).not.toContain('HEALTH_DEVICE_SECURITY.CREATE');
  });

  it('INVESTOR TIDAK DAPAT MENGHITUNG PROYEKSINYA SENDIRI', () => {
    /*
     * Aturan per PERAN, bukan pasangan hak akses — lihat catatan pada
     * HEALTH_SOD_RULES. Analis investasi memegang READ maupun CREATE dengan
     * sah; yang dilarang adalah investor memegang CREATE.
     *
     * Menghitung ulang dengan ambang kohort yang lebih longgar adalah cara
     * paling rapi untuk menembus penyamaran tanpa pernah melanggar satu pun
     * aturan yang tertulis.
     */
    const investor = HEALTH_ROLES.find((r) => r.code === 'HEALTH_INVESTOR_VIEWER');
    expect(investor?.permissions).toContain('HEALTH_INVESTOR_DASHBOARD.READ');
    expect(investor?.permissions).not.toContain('HEALTH_INVESTOR_DASHBOARD.CREATE');
    expect(investor?.permissions).not.toContain('HEALTH_INVESTOR_DASHBOARD.UPDATE');
  });

  it('dan tidak melihat distribusi maupun waterfall', () => {
    // Ia melihat hasil usahanya, bukan mesin yang membaginya.
    const investor = HEALTH_ROLES.find((r) => r.code === 'HEALTH_INVESTOR_VIEWER');
    expect(
      investor?.permissions.filter(
        (p) => p.startsWith('HEALTH_INVESTOR_DISTRIBUTION') || p.startsWith('HEALTH_INVESTOR_WATERFALL'),
      ),
    ).toEqual([]);
  });

  it('analis investasi menghitung tetapi TIDAK menyetujui dan TIDAK membayar', () => {
    const analis = HEALTH_ROLES.find((r) => r.code === 'HEALTH_INVESTOR_ANALYST');
    expect(analis?.permissions).toContain('HEALTH_INVESTOR_DISTRIBUTION.CREATE');
    expect(analis?.permissions).not.toContain('HEALTH_INVESTOR_DISTRIBUTION.APPROVE');
    expect(analis?.permissions).not.toContain('HEALTH_INVESTOR_DISTRIBUTION.POST');
  });

  it('analis investasi TIDAK membaca rekam medis pasien', () => {
    /*
     * Sekalipun perhitungannya membaca tabel klinis, ia melakukannya lewat
     * jalan yang menyamarkan. Memberinya HEALTH_PATIENT.READ akan membuat
     * penyamaran itu dapat dilewati dengan cara paling sederhana: membuka
     * layar yang lain.
     */
    const analis = HEALTH_ROLES.find((r) => r.code === 'HEALTH_INVESTOR_ANALYST');
    expect(analis?.permissions.some((p) => p.startsWith('HEALTH_PATIENT'))).toBe(false);
  });

  it('tiga wewenang distribusi dipegang tiga peran berbeda', () => {
    const pemegang = (hak: string) =>
      HEALTH_ROLES.filter((r) => r.permissions.includes(hak)).map((r) => r.code);
    const hitung = pemegang('HEALTH_INVESTOR_DISTRIBUTION.CREATE');
    const setuju = pemegang('HEALTH_INVESTOR_DISTRIBUTION.APPROVE');
    const bayar = pemegang('HEALTH_INVESTOR_DISTRIBUTION.POST');
    expect(hitung.filter((r) => setuju.includes(r))).toEqual([]);
    expect(setuju.filter((r) => bayar.includes(r))).toEqual([]);
    expect(hitung.filter((r) => bayar.includes(r))).toEqual([]);
  });

  it('teknisi menerima pesan alat tetapi TIDAK memetakan kodenya', () => {
    /*
     * Kode "K" yang dipetakan ke kalium alih-alih kreatinin menghasilkan hasil
     * laboratorium yang tampak sempurna dan salah seluruhnya. Yang dapat
     * membedakannya adalah orang yang mengenal pemeriksaannya.
     */
    const teknisi = HEALTH_ROLES.find((r) => r.code === 'HEALTH_BIOMEDICAL_ENGINEER');
    expect(teknisi?.permissions).toContain('HEALTH_DEVICE_MESSAGE.CREATE');
    expect(teknisi?.permissions).toContain('HEALTH_DEVICE_CODE_MAP.READ');
    expect(teknisi?.permissions).not.toContain('HEALTH_DEVICE_CODE_MAP.CREATE');
  });

  it('petugas interoperabilitas memverifikasi tetapi TIDAK memasang kredensial', () => {
    const io = HEALTH_ROLES.find((r) => r.code === 'HEALTH_INTEROP_OFFICER');
    expect(io?.permissions).toContain('HEALTH_SATUSEHAT_CAPABILITY.VERIFY');
    expect(io?.permissions).not.toContain('HEALTH_SATUSEHAT.MANAGE_CREDENTIAL');
    expect(io?.permissions).not.toContain('HEALTH_SATUSEHAT.ACTIVATE');
  });

  it('petugas interoperabilitas TIDAK membaca data pasien', () => {
    // Ia memeriksa apakah jalurnya bekerja, bukan apa yang lewat di dalamnya.
    const io = HEALTH_ROLES.find((r) => r.code === 'HEALTH_INTEROP_OFFICER');
    expect(io?.permissions.some((p) => p.startsWith('HEALTH_PATIENT'))).toBe(false);
  });

  it('tidak ada peran bawaan yang memverifikasi kemampuan SATUSEHAT sekaligus mengaktifkannya', () => {
    const bahaya = HEALTH_ROLES.filter(
      (r) =>
        r.permissions.includes('HEALTH_SATUSEHAT.ACTIVATE') &&
        r.permissions.includes('HEALTH_SATUSEHAT_CAPABILITY.VERIFY'),
    ).map((r) => r.code);
    expect(bahaya).toEqual([]);
  });

  it('tidak ada peran yang memiliki hak atas menu yang belum dibangun', () => {
    /*
     * Peran yang sudah diberi hak atas modul yang belum ada akan tampak
     * berfungsi sampai modulnya jadi, lalu tiba-tiba memberi akses yang tidak
     * pernah ditinjau siapa pun.
     */
    const belumJadi = new Set(
      HEALTH_MENU.filter((m) => m.comingSoon).map((m) => m.code),
    );
    const salah: string[] = [];
    for (const r of HEALTH_ROLES) {
      for (const p of r.permissions) {
        const menu = p.split('.')[0];
        if (belumJadi.has(menu)) salah.push(`${r.code} -> ${p}`);
      }
    }
    expect(salah).toEqual([]);
  });
});

describe('pemisahan wewenang', () => {
  it('kode aturan unik', () => {
    const kode = HEALTH_SOD_RULES.map((r) => r.code);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('setiap aturan menyebut dua hak akses yang benar-benar ada', () => {
    const sah = daftarHakAkses();
    for (const r of HEALTH_SOD_RULES) {
      expect(r.conflictingPermissions).toHaveLength(2);
      for (const p of r.conflictingPermissions) {
        expect(sah.has(p)).toBe(true);
      }
    }
  });

  it('setiap aturan menjelaskan mengapa keduanya berbahaya bila digabung', () => {
    // Aturan pemisahan wewenang tanpa alasan akan dinonaktifkan orang pertama
    // yang merasa terhalang olehnya.
    for (const r of HEALTH_SOD_RULES) {
      expect(r.description.length).toBeGreaterThan(60);
    }
  });

  it('tidak ada peran bawaan yang melanggar aturannya sendiri', () => {
    /*
     * Peran bawaan yang melanggar aturan SoD bawaan berarti aturannya akan
     * dilanggar sejak tenant pertama dibuat — lalu dinonaktifkan karena
     * dianggap mengganggu.
     */
    const pelanggaran: string[] = [];
    for (const role of HEALTH_ROLES) {
      for (const rule of HEALTH_SOD_RULES) {
        const [a, b] = rule.conflictingPermissions;
        if (role.permissions.includes(a) && role.permissions.includes(b)) {
          pelanggaran.push(`${role.code} melanggar ${rule.code}`);
        }
      }
    }
    expect(pelanggaran).toEqual([]);
  });
});
