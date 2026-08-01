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
/** `src/`, untuk menamai berkas luar dengan jalur yang stabil. */
const SRC = resolve(AKAR, '..', '..');

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

/** Direktori bersama yang boleh diimpor village. */
const IMPOR_DIIZINKAN = [
  '../../common/',
  '../../infrastructure/',
  '../../config/',
];

/**
 * Berkas dari modul lain yang boleh diimpor village, beserta alasannya.
 *
 * Daftar ini pendek dengan sengaja, sama seperti `TABEL_CORE_DIIZINKAN`. Setiap
 * tambahan mengikat village pada perubahan modul yang tidak ikut ditinjau
 * ketika modul itu diubah.
 */
const BERKAS_LUAR_DIIZINKAN: Record<string, string> = {
  'modules/auth/tenant-permission.service':
    'Daftar untuk layar petugas memeriksa hak akses PER DAFTAR, sebab satu rute melayani ' +
    'dua puluh daftar dan @Permissions menempel pada rute. Pemeriksaannya memakai layanan ' +
    'yang sama dengan penjaga rute Core — menulis pemeriksaan sendiri berarti dua aturan ' +
    'otorisasi yang akan berbeda suatu hari, dan yang lebih longgar yang akan dipakai.',
};

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
        if (IMPOR_DIIZINKAN.some((izin) => jalurNaik.includes(izin.replace(/^\.\.\/\.\.\//, '')))) {
          continue;
        }

        // Berkas tunggal yang dinyatakan boleh, beserta alasannya. Dinamai
        // relatif terhadap `src/` supaya kuncinya tidak berubah ketika berkas
        // yang mengimpornya pindah kedalaman direktori.
        const dariSrc = relative(SRC, tujuan).replace(/\\/g, '/');
        if (dariSrc in BERKAS_LUAR_DIIZINKAN) continue;

        pelanggaran.push(`${namaPendek(f)} → ${m[1]}`);
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

  /**
   * Seluruh tempat hak akses village dinyatakan.
   *
   * Dikumpulkan dari **dua** sumber, dan itu bukan kelengkapan yang berlebihan:
   * pemeriksaan ini semula hanya memindai dekorator `@Permissions()` pada
   * `village.module.ts`. Ketika lapisan daftar lahir, dua puluh dua hak akses
   * pindah menjadi nilai `hakAkses` pada `village-listing.ts` — dan tidak lagi
   * diperiksa siapa pun, meskipun nama pengujiannya tetap berbunyi "setiap hak
   * akses yang dipakai rute".
   *
   * Yang baru ditambahkan cenderung memakai cara yang baru pula. Sumbernya
   * didaftar di sini supaya cara ketiga kelak ikut ditambahkan ke tempat yang
   * sama, bukan lolos diam-diam seperti yang kedua.
   */
  function hakAksesYangDipakai(): Array<{ izin: string; asal: string }> {
    const hasil: Array<{ izin: string; asal: string }> = [];

    const modul = isi.get(join(AKAR, 'village.module.ts'))!;
    for (const m of modul.matchAll(/@Permissions\('([^']+)'\)/g)) {
      hasil.push({ izin: m[1], asal: '@Permissions pada village.module.ts' });
    }

    const daftar = isi.get(join(AKAR, 'village-listing.ts'))!;
    for (const m of daftar.matchAll(/hakAkses:\s*'([^']+)'/g)) {
      hasil.push({ izin: m[1], asal: 'hakAkses pada village-listing.ts' });
    }

    return hasil;
  }

  it('menemukan hak akses dari SELURUH sumbernya', () => {
    // Bila salah satu sumber berhenti terbaca, pengujian di bawah akan lulus
    // tanpa memeriksa apa pun dari sumber itu — persis kegagalan yang sedang
    // diperbaiki. Jumlahnya diperiksa supaya kegagalan itu terlihat.
    const dipakai = hakAksesYangDipakai();
    const dariModul = dipakai.filter((d) => d.asal.includes('village.module'));
    const dariDaftar = dipakai.filter((d) => d.asal.includes('village-listing'));

    expect(dariModul.length).toBeGreaterThan(50);
    expect(dariDaftar.length).toBeGreaterThan(15);
  });

  it('setiap hak akses yang dipakai BENAR-BENAR ada pada katalog, menu DAN aksinya', () => {
    // Hak akses yang tidak ada pada katalog tidak akan pernah dapat dipanggil
    // siapa pun: ia tidak dapat diberikan kepada peran mana pun. Gagalnya
    // tertutup — jadi bukan lubang keamanan, melainkan satu layar penuh yang
    // mati diam-diam, dengan pesan "Hak akses tidak mencukupi" bagi SEMUA
    // orang termasuk admin.
    //
    // Paruh AKSI ikut diperiksa. `VILLAGE_COMPLAINT.HAPUS_SEMUA` menyebut menu
    // yang ada dengan aksi yang tidak pernah didaftarkan menu itu, dan
    // akibatnya sama persis — sementara pemeriksaan yang hanya memastikan
    // aksinya "tidak kosong" akan meloloskannya.
    const katalog = isi.get(join(AKAR, 'catalog', 'village-permission.catalog.ts'))!;

    const aksiPerMenu = new Map<string, Set<string>>();
    for (const m of katalog.matchAll(
      /code:\s*'(VILLAGE[A-Z_]*)'[\s\S]*?actions:\s*\[([^\]]*)\]/g,
    )) {
      aksiPerMenu.set(
        m[1],
        new Set([...m[2].matchAll(/'([A-Z_]+)'/g)].map((a) => a[1])),
      );
    }

    const pelanggaran: string[] = [];
    for (const { izin, asal } of hakAksesYangDipakai()) {
      const [menu, aksi] = izin.split('.');
      const aksiSah = aksiPerMenu.get(menu);

      if (!aksiSah) {
        pelanggaran.push(`${izin} — menu ${menu} tidak ada di katalog (${asal})`);
      } else if (!aksi) {
        pelanggaran.push(`${izin} — tanpa aksi (${asal})`);
      } else if (!aksiSah.has(aksi)) {
        pelanggaran.push(
          `${izin} — aksi ${aksi} tidak terdaftar pada ${menu}; ` +
            `yang ada: ${[...aksiSah].sort().join(', ')} (${asal})`,
        );
      }
    }

    expect([...new Set(pelanggaran)]).toEqual([]);
  });

  it('setiap berkas luar yang diizinkan menyebutkan alasannya', () => {
    // Aturan yang sama dengan TABEL_CORE_DIIZINKAN: pengecualian tanpa alasan
    // yang tertulis akan bertambah satu per satu sampai daftarnya tidak lagi
    // berarti apa-apa. Alasan yang harus diketik membuat orang berpikir dua
    // kali sebelum menambahkannya.
    for (const [berkas, alasan] of Object.entries(BERKAS_LUAR_DIIZINKAN)) {
      expect([berkas, alasan.length > 60]).toEqual([berkas, true]);
    }
    expect(Object.keys(BERKAS_LUAR_DIIZINKAN).length).toBeLessThanOrEqual(3);
  });

  it('seluruh rute menu berada di bawah /app/info-desa', () => {
    // Rute menu dipakai sidebar APA ADANYA (`<NavLink to={menu.route}>`).
    // Seluruh aplikasi penyewa hidup di bawah `/app`; rute di luar itu jatuh ke
    // penangkap `*` router lalu MEMANTULKAN petugas ke halaman depan.
    //
    // Kekeliruan seperti ini tidak menghasilkan galat apa pun — menunya tampil,
    // dapat diklik, lalu membuang penggunanya keluar dari aplikasi. Tidak ada
    // yang menangkapnya selain pengujian ini atau petugas yang kebingungan.
    const katalog = isi.get(join(AKAR, 'catalog', 'village-permission.catalog.ts'))!;
    const rute = [...katalog.matchAll(/route:\s*'([^']+)'/g)].map((m) => m[1]);

    expect(rute.length).toBeGreaterThan(20);
    expect(rute.filter((r) => !r.startsWith('/app/info-desa/'))).toEqual([]);
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
