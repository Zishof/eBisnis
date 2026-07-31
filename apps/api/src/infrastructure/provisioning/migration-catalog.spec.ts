/**
 * Pengujian penggabungan katalog migrasi (IR-001).
 *
 * Yang dijaga paling ketat ada dua:
 *
 *   1. **Katalog tanpa modul menghasilkan urutan yang sama persis dengan
 *      sebelum perubahan ini.** Tiga puluh dua migrasi sudah diterapkan pada
 *      belasan skema; satu pun tidak boleh berjalan ulang atau ditolak.
 *   2. **Tabrakan id ditolak saat pemuatan.** Bila dibiarkan sampai penerapan,
 *      salah satunya dianggap sudah diterapkan dan dilewati tanpa galat — dan
 *      tabelnya tidak pernah terbentuk.
 */

import {
  CORE_MODULE,
  MAX_MIGRATION_ID_LENGTH,
  MigrationCatalogError,
  gabungkanKatalog,
  urutkanModul,
  versiIntiTertinggi,
  type CoreManifest,
  type ModuleManifest,
} from './migration-catalog';

const inti = (jumlah = 3): CoreManifest => ({
  schemaVersion: 1,
  migrations: Array.from({ length: jumlah }, (_, i) => ({
    version: `V${String(i + 1).padStart(3, '0')}`,
    sequence: i + 1,
    file: `V${String(i + 1).padStart(3, '0')}__inti.sql`,
    name: `Inti ${i + 1}`,
    description: '',
  })),
});

const modul = (
  nama: string,
  ids: string[],
  dependsOn?: string[],
): ModuleManifest => ({
  module: nama,
  schemaVersion: 2,
  dependsOn,
  migrations: ids.map((id) => ({ id, file: `${id}.sql`, name: id })),
});

describe('katalog tanpa modul tidak berubah sama sekali', () => {
  it('menghasilkan urutan yang sama persis', () => {
    const hasil = gabungkanKatalog(inti(5), []);
    expect(hasil.migrations.map((m) => m.version)).toEqual([
      'V001', 'V002', 'V003', 'V004', 'V005',
    ]);
  });

  it('tidak menambahkan medan module pada migrasi inti', () => {
    // Baris `schema_migration` yang sudah ada dikunci pada `version`. Selama
    // nilainya tidak berubah, tiga puluh dua migrasi yang sudah diterapkan
    // tetap dikenali.
    for (const m of gabungkanKatalog(inti(3), []).migrations) {
      expect(m.module).toBeUndefined();
    }
  });

  it('mengurutkan inti menurut sequence, bukan urutan dalam berkas', () => {
    const acak: CoreManifest = {
      schemaVersion: 1,
      migrations: [
        { version: 'V003', sequence: 3, file: 'c.sql', name: 'c', description: '' },
        { version: 'V001', sequence: 1, file: 'a.sql', name: 'a', description: '' },
        { version: 'V002', sequence: 2, file: 'b.sql', name: 'b', description: '' },
      ],
    };
    expect(gabungkanKatalog(acak, []).migrations.map((m) => m.version)).toEqual([
      'V001', 'V002', 'V003',
    ]);
  });

  it('katalog kosong tidak meledak', () => {
    expect(gabungkanKatalog({ schemaVersion: 1, migrations: [] }, []).migrations).toEqual([]);
  });
});

describe('migrasi inti selalu mendahului migrasi modul', () => {
  const hasil = gabungkanKatalog(inti(3), [
    modul('cooperative', ['20260731T160000__cooperative__profil']),
  ]);

  it('seluruh inti berada sebelum modul mana pun', () => {
    /*
     * Migrasi modul merujuk tabel inti — user_subject, customer_group, outlet.
     * Menjalankannya sebelum tabel itu ada akan gagal pada kunci asing.
     */
    const indeksModulPertama = hasil.migrations.findIndex((m) => m.module);
    const indeksIntiTerakhir = hasil.migrations.map((m) => Boolean(m.module)).lastIndexOf(false);
    expect(indeksIntiTerakhir).toBeLessThan(indeksModulPertama);
  });

  it('sequence modul melanjutkan sequence inti tanpa lompatan', () => {
    const urut = hasil.migrations.map((m) => m.sequence);
    expect(urut).toEqual([1, 2, 3, 4]);
  });

  it('jalur berkas modul diawali nama modulnya', () => {
    const m = hasil.migrations.find((x) => x.module === 'cooperative')!;
    expect(m.file).toBe('cooperative/20260731T160000__cooperative__profil.sql');
  });
});

describe('tabrakan id ditolak SAAT PEMUATAN', () => {
  it('menolak dua modul yang memakai id sama', () => {
    /*
     * Inilah cacat yang IR-001 cegah. Bila dibiarkan sampai penerapan, penyewa
     * yang sudah menerapkan versi milik satu modul akan MELEWATI versi milik
     * modul lain — tanpa galat, dan tabelnya tidak pernah terbentuk.
     */
    // Id yang memuat KEDUA nama modul — satu-satunya bentuk yang lolos
    // pemeriksaan nama pada dua modul sekaligus, jadi inilah tabrakan yang
    // benar-benar mungkin terjadi.
    const bentrok = '20260731T160000__cooperative__health__bersama';
    expect(() =>
      gabungkanKatalog(inti(1), [
        { ...modul('cooperative', []), migrations: [{ id: bentrok, file: 'a.sql', name: 'a' }] },
        { ...modul('health', []), migrations: [{ id: bentrok, file: 'b.sql', name: 'b' }] },
      ]),
    ).toThrow(MigrationCatalogError);
  });

  it('pesannya menyebut KEDUA modulnya', () => {
    const bentrok = '20260731T160000__cooperative__health__bersama';
    let pesan = '';
    try {
      gabungkanKatalog(inti(1), [
        { ...modul('cooperative', []), migrations: [{ id: bentrok, file: 'a.sql', name: 'a' }] },
        { ...modul('health', []), migrations: [{ id: bentrok, file: 'b.sql', name: 'b' }] },
      ]);
    } catch (e) {
      pesan = (e as Error).message;
    }
    expect(pesan).toContain('cooperative');
    expect(pesan).toContain('health');
  });

  it('menolak modul yang memakai id migrasi inti', () => {
    expect(() =>
      gabungkanKatalog(inti(3), [
        { ...modul('cooperative', []), migrations: [{ id: 'V002', file: 'a.sql', name: 'a' }] },
      ]),
    ).toThrow(/V002/);
  });

  it('menolak id yang sama di dalam satu modul', () => {
    const id = '20260731T160000__cooperative__profil';
    expect(() =>
      gabungkanKatalog(inti(1), [modul('cooperative', [id, id])]),
    ).toThrow(MigrationCatalogError);
  });
});

describe('id migrasi modul', () => {
  it('menolak nama modul yang hanya berawalan sama', () => {
    // Modul `coop` tidak boleh mengklaim id milik `coop_extra`.
    expect(() =>
      gabungkanKatalog(inti(1), [modul('coop', ['20260731T160000__coop_extra__a'])]),
    ).toThrow(/tidak memuat/);
  });

  it('wajib memuat nama modulnya', () => {
    // Itulah yang membuat tabrakan antarmodul praktis mustahil, dan yang
    // membuat baris schema_migration dapat dibaca tanpa membuka manifest.
    expect(() =>
      gabungkanKatalog(inti(1), [modul('cooperative', ['20260731T160000__profil'])]),
    ).toThrow(/tidak memuat "__cooperative__"/);
  });

  it('menerima pola <timestamp>__<modul>__<keterangan>', () => {
    expect(() =>
      gabungkanKatalog(inti(1), [modul('cooperative', ['20260731T160000__cooperative__profil'])]),
    ).not.toThrow();
  });

  it('menolak id yang melebihi batas kolom', () => {
    const panjang = `20260731T160000__cooperative__${'x'.repeat(MAX_MIGRATION_ID_LENGTH)}`;
    expect(() => gabungkanKatalog(inti(1), [modul('cooperative', [panjang])])).toThrow(
      /melebihi batas/,
    );
  });

  it('menerima id sepanjang 50 aksara — panjang sungguhan milik koperasi', () => {
    /*
     * Panjang inilah yang dulu gagal: kolom schema_migration.version bertipe
     * VARCHAR(16), sedangkan id modular koperasi 50 aksara.
     */
    const id = '20260731T160000__cooperative__profile_and_legality';
    expect(id.length).toBe(50);
    expect(() => gabungkanKatalog(inti(1), [modul('cooperative', [id])])).not.toThrow();
  });
});

describe('urutan antarmodul', () => {
  it('menghormati dependsOn', () => {
    const urut = urutkanModul([
      modul('village', [], ['cooperative']),
      modul('cooperative', []),
    ]);
    expect(urut.indexOf('cooperative')).toBeLessThan(urut.indexOf('village'));
  });

  it('modul yang saling bebas diurutkan menurut namanya', () => {
    /*
     * Deterministik dengan sengaja. Urutan penemuan di sistem berkas berbeda
     * antara Windows dan Linux, dan urutan penerapan migrasi yang berbeda
     * antara mesin pengembang dan CI adalah sumber cacat yang sangat sulit
     * ditelusuri.
     */
    expect(urutkanModul([modul('village', []), modul('cooperative', []), modul('health', [])]))
      .toEqual(['cooperative', 'health', 'village']);
  });

  it('core boleh disebut pada dependsOn dan diabaikan', () => {
    // Migrasi inti memang selalu lebih dahulu; menyebutnya tidak salah.
    expect(() => urutkanModul([modul('cooperative', [], [CORE_MODULE])])).not.toThrow();
  });

  it('menolak dependsOn ke modul yang tidak ada', () => {
    expect(() => urutkanModul([modul('cooperative', [], ['tidak_ada'])])).toThrow(
      /tidak ditemukan/,
    );
  });

  it('menolak ketergantungan berputar', () => {
    expect(() =>
      urutkanModul([
        modul('a', [], ['b']),
        modul('b', [], ['a']),
      ]),
    ).toThrow(/berputar/);
  });

  it('menolak modul yang bergantung pada dirinya sendiri', () => {
    expect(() => urutkanModul([modul('a', [], ['a'])])).toThrow(/berputar/);
  });

  it('menangani rantai ketergantungan panjang', () => {
    const urut = urutkanModul([
      modul('c', [], ['b']),
      modul('a', []),
      modul('b', [], ['a']),
    ]);
    expect(urut).toEqual(['a', 'b', 'c']);
  });
});

describe('urutan di dalam satu modul', () => {
  it('menurut id, yang bertimestamp', () => {
    const hasil = gabungkanKatalog(inti(1), [
      modul('cooperative', [
        '20260801T090000__cooperative__portal',
        '20260731T160000__cooperative__profil',
        '20260731T200000__cooperative__rapat',
      ]),
    ]);
    expect(hasil.migrations.filter((m) => m.module).map((m) => m.version)).toEqual([
      '20260731T160000__cooperative__profil',
      '20260731T200000__cooperative__rapat',
      '20260801T090000__cooperative__portal',
    ]);
  });
});

describe('versi skema tetap berarti versi INTI', () => {
  it('mengabaikan migrasi modul', () => {
    /*
     * `latestVersion()` dipakai health check dan pencatatan versi skema
     * penyewa. Bila ia mulai mengembalikan id modul, angka itu berubah artinya
     * — dan berubah setiap kali ada vertikal baru, meskipun intinya tetap.
     */
    const hasil = gabungkanKatalog(inti(32), [
      modul('cooperative', ['20260731T160000__cooperative__profil']),
    ]);
    expect(versiIntiTertinggi(hasil.migrations)).toBe('V032');
  });

  it('mengembalikan V000 bila belum ada migrasi inti', () => {
    expect(versiIntiTertinggi([])).toBe('V000');
  });
});

describe('penggabungan bersifat murni', () => {
  it('tidak mengubah manifest masukannya', () => {
    const core = inti(3);
    const salinan = JSON.parse(JSON.stringify(core));
    gabungkanKatalog(core, [modul('cooperative', ['20260731T160000__cooperative__a'])]);
    expect(core).toEqual(salinan);
  });

  it('dua pemanggilan menghasilkan hasil yang sama', () => {
    const m = [modul('village', [], ['cooperative']), modul('cooperative', ['20260731T160000__cooperative__a'])];
    const a = gabungkanKatalog(inti(3), m);
    const b = gabungkanKatalog(inti(3), m);
    expect(a).toEqual(b);
  });
});
