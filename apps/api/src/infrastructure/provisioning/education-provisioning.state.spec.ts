/**
 * Pengujian state machine provisioning pendidikan.
 *
 * Yang diuji bukan bahwa jalur bahagianya berjalan — itu bagian termudah.
 * Yang diuji adalah perpindahan yang **tidak boleh** terjadi, sebab masing-masing
 * darinya menghapus atau menimpa sesuatu yang sudah dipakai institusi, dan
 * tidak satu pun menghasilkan galat ketika terjadi.
 */

import {
  EDUCATION_PROVISIONING_STATES,
  type EducationProvisioningState,
  bolehPindah,
  keadaanSaatGagal,
  pastikanPindah,
  sedangBerjalan,
  sedangTerpakai,
} from './education-provisioning.state';

describe('bentuk mesin keadaan', () => {
  it('empat belas keadaan sesuai BRD §186.2', () => {
    expect(EDUCATION_PROVISIONING_STATES).toHaveLength(14);
  });

  it('setiap keadaan punya aturan perpindahan', () => {
    // Keadaan tanpa aturan akan melempar saat dibaca, bukan menolak dengan
    // pesan — dan kegagalannya muncul di tengah provisioning.
    for (const s of EDUCATION_PROVISIONING_STATES) {
      expect(() => bolehPindah(s, 'ARCHIVED')).not.toThrow();
    }
  });

  it('hanya ARCHIVED yang tanpa jalan keluar', () => {
    const buntu = EDUCATION_PROVISIONING_STATES.filter(
      (s) => !EDUCATION_PROVISIONING_STATES.some((t) => t !== s && bolehPindah(s, t)),
    );
    expect(buntu).toEqual(['ARCHIVED']);
  });

  it('setiap keadaan dapat dicapai dari DRAFT', () => {
    /*
     * Keadaan yang tidak dapat dicapai adalah kode mati yang tampak seperti
     * penanganan kasus. Ia menenangkan pembacanya tanpa pernah berjalan.
     */
    const terjangkau = new Set<EducationProvisioningState>(['DRAFT']);
    let tumbuh = true;
    while (tumbuh) {
      tumbuh = false;
      for (const dari of [...terjangkau]) {
        for (const ke of EDUCATION_PROVISIONING_STATES) {
          if (!terjangkau.has(ke) && bolehPindah(dari, ke)) {
            terjangkau.add(ke);
            tumbuh = true;
          }
        }
      }
    }
    expect([...terjangkau].sort()).toEqual([...EDUCATION_PROVISIONING_STATES].sort());
  });
});

describe('jalur normal', () => {
  it('DRAFT sampai ACTIVE dapat ditempuh', () => {
    const jalur: EducationProvisioningState[] = [
      'DRAFT',
      'WAITING_CONTRACT',
      'WAITING_PAYMENT',
      'QUEUED',
      'PROVISIONING_CORE',
      'PROVISIONING_VERTICAL',
      'SEEDING',
      'VALIDATING',
      'READY_FOR_CONFIGURATION',
      'ACTIVE',
    ];
    for (let i = 0; i + 1 < jalur.length; i += 1) {
      expect(bolehPindah(jalur[i], jalur[i + 1])).toBe(true);
    }
  });

  it('kontrak dan pembayaran dapat dilewati untuk tenant yang sudah berkontrak', () => {
    expect(bolehPindah('DRAFT', 'QUEUED')).toBe(true);
  });

  it('kernel selalu sebelum vertical', () => {
    // Vertical merujuk tabel kernel. Terbalik, migrasinya gagal pada rujukan
    // yang belum terbentuk — di tengah provisioning, saat tenant menunggu.
    expect(bolehPindah('QUEUED', 'PROVISIONING_VERTICAL')).toBe(false);
    expect(bolehPindah('PROVISIONING_CORE', 'PROVISIONING_VERTICAL')).toBe(true);
  });
});

describe('perpindahan yang dilarang', () => {
  it('ACTIVE TIDAK dapat kembali ke provisioning', () => {
    /*
     * Menjalankan ulang provisioning pada modul yang sudah dipakai berarti
     * menyemai ulang peran dan menu di atas data yang sudah disunting
     * institusi. Yang sah hanyalah migrasi tambahan, dan itu bukan perpindahan
     * keadaan.
     */
    for (const ke of ['QUEUED', 'PROVISIONING_CORE', 'PROVISIONING_VERTICAL', 'SEEDING'] as const) {
      expect(bolehPindah('ACTIVE', ke)).toBe(false);
    }
  });

  it('SUSPENDED kembali ke ACTIVE, bukan ke provisioning', () => {
    /*
     * Berlangganan yang berakhir menutup akses, TIDAK menghapus schema. Data
     * akademik milik institusi; mengaktifkan kembali berarti membuka pintu,
     * bukan membangun ulang di atas data yang masih ada.
     */
    expect(bolehPindah('SUSPENDED', 'ACTIVE')).toBe(true);
    expect(bolehPindah('SUSPENDED', 'QUEUED')).toBe(false);
    expect(bolehPindah('SUSPENDED', 'SEEDING')).toBe(false);
  });

  it('ARCHIVED adalah akhir', () => {
    for (const ke of EDUCATION_PROVISIONING_STATES) {
      expect(bolehPindah('ARCHIVED', ke)).toBe(false);
    }
  });

  it('tahap yang sedang berjalan tidak dapat melompat ke ACTIVE', () => {
    // Melompat ke ACTIVE tanpa melewati validasi berarti modul dinyatakan siap
    // sebelum ada yang memeriksanya.
    for (const dari of ['QUEUED', 'PROVISIONING_CORE', 'SEEDING', 'VALIDATING'] as const) {
      expect(bolehPindah(dari, 'ACTIVE')).toBe(false);
    }
  });
});

describe('kegagalan dan pemulihan', () => {
  it('setiap tahap berjalan dapat gagal', () => {
    for (const dari of ['QUEUED', 'PROVISIONING_CORE', 'PROVISIONING_VERTICAL', 'SEEDING', 'VALIDATING'] as const) {
      expect(keadaanSaatGagal(dari)).toBe('FAILED');
    }
  });

  it('tahap sebelum berjalan TIDAK menjadi FAILED', () => {
    /*
     * Tidak ada yang perlu dibatalkan, dan menandainya gagal membuat daftar
     * kegagalan penuh oleh tenant yang sekadar belum menyelesaikan kontrak —
     * lalu daftar itu berhenti dibaca.
     */
    expect(keadaanSaatGagal('DRAFT')).toBeNull();
    expect(keadaanSaatGagal('WAITING_CONTRACT')).toBeNull();
    expect(keadaanSaatGagal('WAITING_PAYMENT')).toBeNull();
  });

  it('FAILED dapat dicoba lagi maupun dibatalkan', () => {
    expect(bolehPindah('FAILED', 'QUEUED')).toBe(true);
    expect(bolehPindah('FAILED', 'ROLLING_BACK')).toBe(true);
  });

  it('pembatalan yang berhasil kembali ke DRAFT', () => {
    expect(bolehPindah('ROLLING_BACK', 'DRAFT')).toBe(true);
  });

  it('pembatalan yang gagal tetap FAILED, bukan diam-diam ACTIVE', () => {
    expect(bolehPindah('ROLLING_BACK', 'FAILED')).toBe(true);
    expect(bolehPindah('ROLLING_BACK', 'ACTIVE')).toBe(false);
  });
});

describe('penggolongan keadaan', () => {
  it('terpakai berarti institusi sudah dapat menyentuhnya', () => {
    expect(sedangTerpakai('ACTIVE')).toBe(true);
    expect(sedangTerpakai('READY_FOR_CONFIGURATION')).toBe(true);
    // Ditangguhkan tetap terpakai: schema dan datanya masih ada.
    expect(sedangTerpakai('SUSPENDED')).toBe(true);
    expect(sedangTerpakai('QUEUED')).toBe(false);
    expect(sedangTerpakai('FAILED')).toBe(false);
  });

  it('berjalan berarti tidak boleh dijalankan lagi bersamaan', () => {
    expect(sedangBerjalan('PROVISIONING_VERTICAL')).toBe(true);
    expect(sedangBerjalan('ROLLING_BACK')).toBe(true);
    expect(sedangBerjalan('ACTIVE')).toBe(false);
    expect(sedangBerjalan('DRAFT')).toBe(false);
  });
});

describe('pesan penolakan', () => {
  it('menyebutkan tujuan yang sah', () => {
    // Kegagalan perpindahan hampir selalu berarti pemanggilnya salah membaca
    // keadaan sekarang, dan daftar tujuan yang sah adalah petunjuk tercepat.
    expect(() => pastikanPindah('ACTIVE', 'SEEDING')).toThrow(/SUSPENDED/);
  });

  it('menyebutkan bahwa ARCHIVED adalah akhir', () => {
    expect(() => pastikanPindah('ARCHIVED', 'ACTIVE')).toThrow(/keadaan akhir/);
  });

  it('perpindahan yang sah tidak melempar', () => {
    expect(() => pastikanPindah('DRAFT', 'QUEUED')).not.toThrow();
  });
});
