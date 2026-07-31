/**
 * Pengujian batas vertikal.
 *
 * Dijanjikan sejak D-0, dan alasannya ditulis di sana: *"Aturan yang hanya
 * tertulis di dokumen akan dilanggar suatu hari oleh orang yang belum pernah
 * membacanya."* Berkas ini memindai `modules/village/` dan menggagalkan
 * berkasnya pada hari batas itu dilanggar — bukan pada tinjauan kode berbulan
 * kemudian, ketika impornya sudah dipakai lima tempat lain.
 *
 * Tiga hal yang dijaga:
 *
 * 1. **Village tidak mengimpor modul vertikal lain.** Tidak dari `health`,
 *    tidak dari `cooperative`, tidak dari `pos`. Yang dipakai adalah port pada
 *    `ports/`, dan port itu diimplementasikan adapter — sehingga mengganti
 *    mitranya tidak menyentuh satu pun layanan village.
 * 2. **Village tidak menyentuh tabel di luar awalan `village_`**, kecuali
 *    daftar yang disebut di bawah beserta alasannya. Daftar izin, bukan daftar
 *    larangan: tabel Core yang baru ditambahkan tidak diam-diam menjadi boleh.
 * 3. **Nama skema tidak pernah berasal dari badan permintaan.** Ia selalu dari
 *    sesi atau dari registry penyewa.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const AKAR = __dirname;

function berkasTypeScript(dir: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) {
      hasil.push(...berkasTypeScript(jalur));
    } else if (nama.endsWith('.ts')) {
      hasil.push(jalur);
    }
  }
  return hasil;
}

const BERKAS = berkasTypeScript(AKAR);
const isi = new Map(BERKAS.map((f) => [f, readFileSync(f, 'utf8')]));
const namaPendek = (f: string) => f.slice(AKAR.length + 1).replace(/\\/g, '/');

/**
 * Tabel milik Core yang boleh disentuh village, beserta alasannya.
 *
 * Daftar ini pendek dengan sengaja. Setiap tambahan berarti village menyimpan
 * atau membaca sesuatu yang bukan miliknya, dan tiap kali itu terjadi, mengubah
 * Core menjadi lebih berisiko bagi vertikal yang tidak ikut ditinjau.
 */
const TABEL_CORE_DIIZINKAN: Record<string, string> = {
  accounting_event:
    'D-6. Village memakai mesin peristiwa akuntansi Core, bukan membangun buku besar kedua. ' +
    'Yang milik village hanyalah kode peristiwanya dan bagan akun APBDes-nya.',
  role: 'D-3. Peran village disemai ke registry peran Core agar satu pengguna punya satu daftar peran.',
  user_role_assignment: 'D-3. Penetapan peran memakai tabel Core yang sama dengan vertikal lain.',
  user_subject: 'D-3. Menautkan pengguna ke perangkat desa tanpa membuat tabel pengguna kedua.',
  schema_migration: 'Pembukuan migrasi penyewa; dipakai VillageMigrationService.',
};

/** Modul yang boleh diimpor village. */
const IMPOR_DIIZINKAN = [
  '../../common/',
  '../../infrastructure/',
  '../../config/',
];

describe('batas vertikal: impor', () => {
  it('memindai berkas yang jumlahnya masuk akal', () => {
    // Bila jumlahnya nol, pemindaiannya rusak dan seluruh pengujian di bawah
    // akan lulus tanpa memeriksa apa pun.
    expect(BERKAS.length).toBeGreaterThan(20);
  });

  it('TIDAK mengimpor modul vertikal lain', () => {
    // Jalur diselesaikan relatif terhadap berkasnya, lalu diperiksa apakah ia
    // masih berada di dalam direktori village. Memeriksa bentuk teksnya saja
    // akan salah menuduh `catalog/x.ts` yang mengimpor `../village-profile` —
    // itu tetap di dalam village.
    const pelanggaran: string[] = [];
    for (const [f, teks] of isi) {
      for (const m of teks.matchAll(/from\s+'(\.[^']+)'/g)) {
        const tujuan = resolve(dirname(f), m[1]);
        if (tujuan.startsWith(AKAR)) continue;

        const relatif = relative(AKAR, tujuan).replace(/\\/g, '/');
        const jalurNaik = `${relatif.startsWith('.') ? relatif : `./${relatif}`}`;
        if (!IMPOR_DIIZINKAN.some((izin) => jalurNaik.includes(izin.replace(/^\.\.\/\.\.\//, '')))) {
          pelanggaran.push(`${namaPendek(f)} → ${m[1]}`);
        }
      }
    }
    expect(pelanggaran).toEqual([]);
  });

  it('tidak menyebut modul health, cooperative, atau pos pada jalur impor', () => {
    const pelanggaran: string[] = [];
    for (const [f, teks] of isi) {
      for (const m of teks.matchAll(/from\s+'([^']+)'/g)) {
        if (/\/(health|cooperative|koperasi|pos|marketplace|emedik|ekoperasi)\//i.test(m[1])) {
          pelanggaran.push(`${namaPendek(f)} → ${m[1]}`);
        }
      }
    }
    expect(pelanggaran).toEqual([]);
  });

  it('tidak menyalin modul kesehatan atau koperasi ke dalam village', () => {
    // Tidak ada tabel kesehatan maupun koperasi pada migrasi village kecuali
    // `village_cooperative_presence`, yang hanya mencatat keberadaan dan tidak
    // memuat simpanan, pinjaman, maupun tunggakan.
    const berkasMigrasi = readdirSync(join(AKAR, '..', '..', '..', 'tenant-migrations', 'village'))
      .filter((n) => n.endsWith('.sql'))
      .map((n) => readFileSync(join(AKAR, '..', '..', '..', 'tenant-migrations', 'village', n), 'utf8'));

    const tabel = berkasMigrasi
      .flatMap((sql) => [...sql.matchAll(/CREATE TABLE IF NOT EXISTS "\{\{TENANT_SCHEMA\}\}"\.(\w+)/g)])
      .map((m) => m[1]);

    expect(tabel.length).toBeGreaterThan(80);
    for (const t of tabel) {
      expect([t, t.startsWith('village_')]).toEqual([t, true]);
    }
    // Tidak ada tabel rekam medis maupun simpan-pinjam.
    for (const t of tabel) {
      expect(t).not.toMatch(/medical|diagnos|patient|pasien|rekam_medis|simpanan|pinjaman|savings|loan/i);
    }
  });
});

describe('batas vertikal: tabel', () => {
  /** Mengumpulkan nama tabel yang muncul pada kueri SQL. */
  function tabelYangDisentuh(): Map<string, Set<string>> {
    const peta = new Map<string, Set<string>>();
    for (const [f, teks] of isi) {
      if (f.endsWith('.spec.ts')) continue;
      for (const m of teks.matchAll(/(?:FROM|INTO|UPDATE|JOIN)\s+"\$\{schemaName\}"\.(\w+)/g)) {
        if (!peta.has(m[1])) peta.set(m[1], new Set());
        peta.get(m[1])!.add(namaPendek(f));
      }
    }
    return peta;
  }

  it('menemukan tabel yang disentuh', () => {
    expect(tabelYangDisentuh().size).toBeGreaterThan(40);
  });

  it('hanya menyentuh tabel village atau yang ada pada daftar izin', () => {
    const pelanggaran: string[] = [];
    for (const [tabel, berkas] of tabelYangDisentuh()) {
      if (tabel.startsWith('village_')) continue;
      if (tabel in TABEL_CORE_DIIZINKAN) continue;
      pelanggaran.push(`${tabel} (dipakai ${[...berkas].join(', ')})`);
    }
    expect(pelanggaran).toEqual([]);
  });

  it('setiap tabel Core yang diizinkan menyebutkan alasannya', () => {
    // Daftar izin tanpa alasan akan bertambah panjang tanpa ada yang
    // mempertanyakannya.
    for (const [tabel, alasan] of Object.entries(TABEL_CORE_DIIZINKAN)) {
      expect([tabel, alasan.length > 40]).toEqual([tabel, true]);
    }
  });

  it('daftar izin tidak memuat tabel vertikal lain', () => {
    for (const tabel of Object.keys(TABEL_CORE_DIIZINKAN)) {
      expect(tabel).not.toMatch(/^(health|clinic|patient|cooperative|member|pos_|outlet|listing)/i);
    }
  });

  it('daftar izin tidak menumpuk: paling banyak delapan tabel Core', () => {
    // Bukan angka keramat. Ia pagar yang memaksa penambahan kesembilan menjadi
    // keputusan yang disengaja, bukan satu baris lagi pada daftar yang sudah
    // panjang.
    expect(Object.keys(TABEL_CORE_DIIZINKAN).length).toBeLessThanOrEqual(8);
  });
});

describe('batas vertikal: nama skema', () => {
  it('nama skema tidak pernah diambil dari badan permintaan', () => {
    const pelanggaran: string[] = [];
    for (const [f, teks] of isi) {
      if (f.endsWith('.spec.ts')) continue;
      // Pola yang dicari: schemaName yang diambil dari dto/body/query/params.
      for (const pola of [
        /schemaName\s*[:=]\s*(dto|body|query|params|input)\./g,
        /const\s+schemaName\s*=\s*req\./g,
      ]) {
        for (const m of teks.matchAll(pola)) {
          pelanggaran.push(`${namaPendek(f)}: ${m[0]}`);
        }
      }
    }
    expect(pelanggaran).toEqual([]);
  });

  it('setiap layanan menerima schemaName dari pemanggilnya, bukan menyusunnya sendiri', () => {
    const pelanggaran: string[] = [];
    for (const [f, teks] of isi) {
      if (f.endsWith('.spec.ts')) continue;
      // Rangkaian teks yang membentuk nama skema dari potongan lain.
      for (const m of teks.matchAll(/`tenant_\$\{[^}]+\}`/g)) {
        pelanggaran.push(`${namaPendek(f)}: ${m[0]}`);
      }
    }
    expect(pelanggaran).toEqual([]);
  });
});

describe('batas vertikal: awalan', () => {
  it('seluruh rute berawalan village', () => {
    const modul = isi.get(join(AKAR, 'village.module.ts'))!;
    const controller = [...modul.matchAll(/@Controller\('([^']*)'\)/g)].map((m) => m[1]);
    expect(controller.length).toBeGreaterThan(0);
    for (const c of controller) {
      expect([c, c === 'village' || c.startsWith('village/')]).toEqual([c, true]);
    }
  });

  it('seluruh hak akses berawalan VILLAGE_', () => {
    const modul = isi.get(join(AKAR, 'village.module.ts'))!;
    const izin = [...modul.matchAll(/@Permissions\('([^']+)'\)/g)].map((m) => m[1]);
    expect(izin.length).toBeGreaterThan(30);
    for (const p of izin) {
      expect([p, p.startsWith('VILLAGE_')]).toEqual([p, true]);
    }
  });

  it('setiap hak akses yang dipakai rute BENAR-BENAR ada pada katalog', () => {
    // Rute yang menuntut hak akses yang tidak ada pada katalog tidak akan
    // pernah dapat dipanggil siapa pun: hak itu tidak dapat diberikan kepada
    // peran mana pun. Kekeliruannya tidak terlihat sampai seseorang mencobanya.
    const modul = isi.get(join(AKAR, 'village.module.ts'))!;
    const katalog = isi.get(join(AKAR, 'catalog', 'village-permission.catalog.ts'))!;
    const menuKatalog = new Set(
      [...katalog.matchAll(/code:\s*'(VILLAGE_[A-Z_]+)'/g)].map((m) => m[1]),
    );

    const pelanggaran: string[] = [];
    for (const m of modul.matchAll(/@Permissions\('([^']+)'\)/g)) {
      const [menu, aksi] = m[1].split('.');
      if (!menuKatalog.has(menu)) pelanggaran.push(`${m[1]} (menu ${menu} tidak ada di katalog)`);
      else if (!aksi) pelanggaran.push(`${m[1]} (tanpa aksi)`);
    }
    expect([...new Set(pelanggaran)]).toEqual([]);
  });

  it('seluruh kode peristiwa akuntansi berawalan VILLAGE_', () => {
    const anggaran = isi.get(join(AKAR, 'village-budget.ts'))!;
    const blok = anggaran.match(/export const VILLAGE_EVENTS = \[([\s\S]*?)\] as const;/)![1];
    const kode = [...blok.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(kode.length).toBeGreaterThan(5);
    for (const k of kode) {
      expect([k, k.startsWith('VILLAGE_')]).toEqual([k, true]);
    }
  });
});
