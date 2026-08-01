/**
 * Pengujian aparatur dan cakupan data.
 *
 * Dua aturan dijaga paling ketat:
 *
 * - **Masa jabatan yang tanggalnya sudah lewat mencabut akses**, meskipun kolom
 *   statusnya masih tertulis AKTIF.
 * - **Cakupan yang tidak dapat ditentukan berarti NONE**, bukan UNIT.
 */

import {
  adaLingkaran,
  bolehLihatPerorangan,
  cakupanEfektif,
  jabatanBerlaku,
  keteranganCakupan,
  pelimpahanBerlaku,
  penugasanBerlaku,
  periksaPelimpahan,
  type PenugasanCakupan,
} from './village-officer';

const HARI_INI = '2026-07-31';

const tugas = (over: Partial<PenugasanCakupan> = {}): PenugasanCakupan => ({
  scopeType: 'VILLAGE_UNIT',
  scopeId: null,
  validFrom: '2026-01-01',
  validUntil: null,
  revokedAt: null,
  ...over,
});

describe('masa jabatan', () => {
  it('jabatan aktif tanpa tanggal berakhir tetap berlaku', () => {
    expect(jabatanBerlaku({ status: 'AKTIF', startDate: '2024-01-01', endDate: null }, HARI_INI).aktif)
      .toBe(true);
  });

  it('jabatan yang belum dimulai belum berlaku', () => {
    const h = jabatanBerlaku({ status: 'AKTIF', startDate: '2027-01-01', endDate: null }, HARI_INI);
    expect(h.aktif).toBe(false);
    expect(h.alasan).toContain('2027-01-01');
  });

  it('TANGGAL yang menentukan, bukan kolom status', () => {
    /*
     * Inilah yang paling mudah luput. Masa jabatan yang tanggal berakhirnya
     * sudah lewat tetap bertuliskan AKTIF sampai ada yang memperbaruinya, dan
     * di kantor desa hal itu bisa tertunda berbulan-bulan. Aparatur yang
     * purnatugas tetapi aksesnya menyala masih tinggal di kampung yang sama dan
     * masih kenal semua orang.
     */
    const h = jabatanBerlaku({ status: 'AKTIF', startDate: '2020-01-01', endDate: '2026-01-01' }, HARI_INI);
    expect(h.aktif).toBe(false);
    expect(h.alasan).toContain('belum diperbarui');
  });

  it('tepat pada tanggal berakhir masih berlaku', () => {
    expect(
      jabatanBerlaku({ status: 'AKTIF', startDate: '2020-01-01', endDate: HARI_INI }, HARI_INI).aktif,
    ).toBe(true);
  });

  it('diberhentikan dan berakhir tidak berlaku', () => {
    for (const s of ['DIBERHENTIKAN', 'BERAKHIR'] as const) {
      expect(jabatanBerlaku({ status: s, startDate: '2020-01-01', endDate: null }, HARI_INI).aktif)
        .toBe(false);
    }
  });

  it('cuti tidak berlaku, dan mengarahkan ke pelimpahan', () => {
    const h = jabatanBerlaku({ status: 'CUTI', startDate: '2020-01-01', endDate: null }, HARI_INI);
    expect(h.aktif).toBe(false);
    expect(h.alasan).toContain('dilimpahkan');
  });
});

describe('pelimpahan wewenang', () => {
  it('berlaku dalam rentang tanggalnya', () => {
    const p = {
      fromOfficerId: 'A',
      toOfficerId: 'B',
      startDate: '2026-07-01',
      endDate: '2026-08-31',
      status: 'AKTIF' as const,
    };
    expect(pelimpahanBerlaku(p, HARI_INI)).toBe(true);
    expect(pelimpahanBerlaku(p, '2026-09-01')).toBe(false);
    expect(pelimpahanBerlaku(p, '2026-06-30')).toBe(false);
  });

  it('yang dicabut tidak berlaku meski masih dalam rentang', () => {
    expect(
      pelimpahanBerlaku(
        { fromOfficerId: 'A', toOfficerId: 'B', startDate: '2026-07-01', endDate: '2026-08-31', status: 'DICABUT' },
        HARI_INI,
      ),
    ).toBe(false);
  });

  it('menolak pelimpahan kepada diri sendiri', () => {
    const h = periksaPelimpahan({
      fromOfficerId: 'A',
      toOfficerId: 'A',
      startDate: '2026-07-01',
      endDate: '2026-07-10',
    });
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('diri sendiri');
  });

  it('menolak rentang terbalik', () => {
    expect(
      periksaPelimpahan({
        fromOfficerId: 'A',
        toOfficerId: 'B',
        startDate: '2026-08-01',
        endDate: '2026-07-01',
      }).sah,
    ).toBe(false);
  });

  it('menolak pelimpahan yang terlalu panjang', () => {
    /*
     * Pelimpahan yang berlangsung setahun bukan pelimpahan melainkan pergantian
     * jabatan — dan itu prosedur berbeda dengan surat keputusan berbeda pula.
     */
    const h = periksaPelimpahan({
      fromOfficerId: 'A',
      toOfficerId: 'B',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(h.sah).toBe(false);
    expect(h.alasan).toContain('pergantian jabatan');
  });

  it('menerima pelimpahan cuti yang wajar', () => {
    expect(
      periksaPelimpahan({
        fromOfficerId: 'A',
        toOfficerId: 'B',
        startDate: '2026-07-01',
        endDate: '2026-07-14',
      }).sah,
    ).toBe(true);
  });
});

describe('struktur organisasi', () => {
  it('struktur pohon biasa tidak melingkar', () => {
    expect(
      adaLingkaran([
        { id: 'kades', parentId: null },
        { id: 'sekdes', parentId: 'kades' },
        { id: 'kaur1', parentId: 'sekdes' },
        { id: 'kaur2', parentId: 'sekdes' },
      ]).melingkar,
    ).toBe(false);
  });

  it('mendeteksi lingkaran', () => {
    // Penelusuran atasan yang berputar tanpa henti biasanya ditemukan oleh
    // permintaan persetujuan yang tidak pernah sampai kepada siapa pun.
    const h = adaLingkaran([
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'c' },
      { id: 'c', parentId: 'a' },
    ]);
    expect(h.melingkar).toBe(true);
    expect(h.jalur?.length).toBeGreaterThan(0);
  });

  it('mendeteksi simpul yang menjadi induknya sendiri', () => {
    expect(adaLingkaran([{ id: 'a', parentId: 'a' }]).melingkar).toBe(true);
  });

  it('struktur kosong tidak melingkar', () => {
    expect(adaLingkaran([]).melingkar).toBe(false);
  });
});

describe('berlakunya penugasan cakupan', () => {
  it('penugasan tanpa batas waktu berlaku', () => {
    expect(penugasanBerlaku(tugas(), HARI_INI)).toBe(true);
  });

  it('penugasan yang dicabut tidak berlaku', () => {
    expect(penugasanBerlaku(tugas({ revokedAt: '2026-06-01' }), HARI_INI)).toBe(false);
  });

  it('penugasan yang kedaluwarsa tidak berlaku', () => {
    expect(penugasanBerlaku(tugas({ validUntil: '2026-06-30' }), HARI_INI)).toBe(false);
  });

  it('penugasan yang belum mulai tidak berlaku', () => {
    expect(penugasanBerlaku(tugas({ validFrom: '2027-01-01' }), HARI_INI)).toBe(false);
  });
});

describe('cakupan efektif', () => {
  it('mengambil penugasan yang berlaku', () => {
    const c = cakupanEfektif([tugas({ scopeType: 'VILLAGE_RT', scopeId: 'RT-1' })], null, HARI_INI);
    expect(c.level).toBe('RT');
    expect(c.rtId).toBe('RT-1');
    expect(c.sumber).toBe('PENUGASAN');
  });

  it('mengambil yang TERLUAS bila ada beberapa', () => {
    /*
     * Satu orang dapat menjadi Ketua RT sekaligus operator kependudukan. Ia
     * tidak boleh kehilangan akses desa-luasnya hanya karena juga memimpin RT.
     */
    const c = cakupanEfektif(
      [
        tugas({ scopeType: 'VILLAGE_RT', scopeId: 'RT-1' }),
        tugas({ scopeType: 'VILLAGE_UNIT' }),
      ],
      null,
      HARI_INI,
    );
    expect(c.level).toBe('UNIT');
  });

  it('mengabaikan penugasan yang sudah dicabut', () => {
    const c = cakupanEfektif(
      [
        tugas({ scopeType: 'VILLAGE_UNIT', revokedAt: '2026-06-01' }),
        tugas({ scopeType: 'VILLAGE_RT', scopeId: 'RT-1' }),
      ],
      null,
      HARI_INI,
    );
    expect(c.level).toBe('RT');
  });

  it('tanpa penugasan dan tanpa peran berarti NONE', () => {
    /*
     * Yang paling mudah salah. Bawaan yang longgar pada data kependudukan
     * berarti pengguna yang penugasannya belum sempat diisi melihat seluruh
     * warga desa — dan tidak ada yang menyadarinya, karena tidak ada yang error.
     */
    const c = cakupanEfektif([], null, HARI_INI);
    expect(c.level).toBe('NONE');
    expect(c.sumber).toBe('BAWAAN_TERKUNCI');
  });

  it('bawaan peran UNIT dipakai bila tidak ada penugasan', () => {
    const c = cakupanEfektif([], 'UNIT', HARI_INI);
    expect(c.level).toBe('UNIT');
    expect(c.sumber).toBe('PERAN');
  });

  it('bawaan peran RT TANPA penugasan menjadi NONE', () => {
    /*
     * Ketua RT tanpa penugasan RT tidak tahu RT mana yang dimaksud. Memberinya
     * cakupan RT tanpa objeknya akan menghasilkan penyaring yang tidak
     * menyaring apa-apa — atau, lebih buruk, menyaring seluruhnya menjadi
     * kosong tanpa keterangan.
     */
    const c = cakupanEfektif([], 'RT', HARI_INI);
    expect(c.level).toBe('NONE');
    expect(c.sumber).toBe('BAWAAN_TERKUNCI');
  });

  it('bawaan peran AGGREGATE_ONLY dipakai apa adanya', () => {
    const c = cakupanEfektif([], 'AGGREGATE_ONLY', HARI_INI);
    expect(c.level).toBe('AGGREGATE_ONLY');
    expect(c.sumber).toBe('PERAN');
  });

  it('penugasan SELF membawa id penduduknya', () => {
    const c = cakupanEfektif([tugas({ scopeType: 'VILLAGE_SELF', scopeId: 'P-9' })], null, HARI_INI);
    expect(c.level).toBe('SELF');
    expect(c.residentId).toBe('P-9');
  });

  it('penugasan yang seluruhnya kedaluwarsa jatuh ke bawaan peran', () => {
    const c = cakupanEfektif([tugas({ validUntil: '2026-01-01' })], 'AGGREGATE_ONLY', HARI_INI);
    expect(c.level).toBe('AGGREGATE_ONLY');
  });
});

describe('izin melihat baris perorangan', () => {
  it('cakupan wilayah boleh melihat perorangan', () => {
    for (const l of ['UNIT', 'SUB_AREA', 'RW', 'RT', 'SELF'] as const) {
      expect(bolehLihatPerorangan(l)).toBe(true);
    }
  });

  it('agregat dan tanpa cakupan tidak boleh', () => {
    // BPD mengawasi, tidak menyelidiki.
    expect(bolehLihatPerorangan('AGGREGATE_ONLY')).toBe(false);
    expect(bolehLihatPerorangan('NONE')).toBe(false);
  });
});

describe('keterangan cakupan', () => {
  it('menerangkan setiap tingkat', () => {
    for (const l of ['UNIT', 'SUB_AREA', 'RW', 'RT', 'SELF', 'AGGREGATE_ONLY'] as const) {
      expect(keteranganCakupan({ level: l, sumber: 'PENUGASAN' }).length).toBeGreaterThan(20);
    }
  });

  it('cakupan yang belum ditetapkan mengarahkan ke administrator', () => {
    /*
     * "Tidak ada data" dan "Anda tidak berwenang melihat data ini" adalah dua
     * hal yang sangat berbeda. Menyamakannya membuat petugas mengira sistemnya
     * rusak, lalu meminta administrator memperbaiki hal yang tidak rusak.
     */
    const k = keteranganCakupan({ level: 'NONE', sumber: 'BAWAAN_TERKUNCI' });
    expect(k).toContain('administrator');
  });

  it('peran tanpa akses kependudukan diterangkan berbeda', () => {
    const k = keteranganCakupan({ level: 'NONE', sumber: 'PERAN' });
    expect(k).toContain('Peran Anda');
    expect(k).not.toContain('administrator');
  });
});
