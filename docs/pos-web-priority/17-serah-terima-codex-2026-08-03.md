# Handoff — POS Flutter, rilis, dan penyelarasan spesifikasi AIS (2026-08-03)

Ditulis untuk pindah alat bantu (Codex) di tengah pekerjaan. Tujuannya supaya
siapa pun yang melanjutkan tidak perlu membaca ulang riwayat percakapan — cukup
berkas ini, ditambah `git log` dan badan PR untuk detailnya.

Pendamping wajib: [`16-peta-spesifikasi-ais.md`](16-peta-spesifikasi-ais.md) —
peta selisih terhadap `C:\opt\AIS\ais\SPESIFIKASI_FITUR_POS_DESKTOP_ANDROID.md`,
berikut urutan tahap yang dipakai di bawah.

---

## 1. Konteks

**Repo**: `Zishof/eBisnis` (PRIVAT). Worktree yang dipakai pekerjaan POS ini:
`C:\opt\eBisnisGithub-pos`.

> Worktree utama `C:\opt\eBisnisGithub` dipakai sesi lain (saat ini pada
> `feat/v13-education-audit`). **Jangan mengganti checkout-nya.** Lihat §8.

**Yang dikerjakan sesi ini**, berurutan:

1. PWA kasir fase 1–4 (sudah lama tergabung, PR #53)
2. Klien kasir Flutter dari nol sampai dapat dirilis (#59)
3. Alur rilis GitHub `.exe` + `.apk`, dan cek pembaruan (#59, #62)
4. Perbaikan kegoyahan E2E pada `main` (#61)
5. Penyelarasan dengan spesifikasi AIS: peta (#62), pintasan + tahap 1–2 (#64),
   tahap 3 (#65), tahap 3b (#66, **masih terbuka**)

---

## 2. Keadaan sekarang

### Sudah tergabung ke `main`

| PR | Isi |
| --- | --- |
| #59 | Klien kasir Flutter: aturan uang berbagi vektor konformansi, ESC/POS, layar pelanggan, tampilan tiga kolom, alur rilis, cek pembaruan |
| #61 | Kasir tidak lagi terlempar ke halaman masuk karena dua `/auth/refresh` serentak |
| #62 | Rilis POS: citra Windows dipatok `windows-2022`; versi pratayang tidak lagi menggagalkan pemasang. Plus peta spesifikasi AIS |
| #64 | Peta pintasan AIS di kedua klien; antrean cetak; identitas mesin POS |
| #65 | Promosi kasir: aturan pemilihan keluar dari SQL ke modul murni; tiga cacat uang diperbaiki |

### Masih terbuka

**[PR #66](https://github.com/Zishof/eBisnis/pull/66)** — `feat/kelola-aturan-diskon`,
kelima check HIJAU, MERGEABLE. Isinya sisi API tahap 3b: validasi murni, layanan
CRUD, lima endpoint `POS_PROMO.*`, menu *Aturan Diskon*, dan penjaga urutan impor
modul.

**Langkah pertama bagi yang melanjutkan: gabungkan #66** (squash), lalu lanjut
§5.

> ### ⚠ CI mati sejak 2026-08-03 siang — kemungkinan kuota GitHub Actions
>
> Kelima check pada #66 sempat **hijau seluruhnya** (E2E 73 lulus, 0 flaky).
> Sesudah itu setiap run gagal **dalam hitungan detik dengan nol langkah
> dijalankan** — bukan hanya pada cabang ini, tetapi juga pada `main` dan pada
> cabang sesi lain (`docs/session-handoff-2026-08-03`).
>
> Job yang gagal tanpa satu pun langkah berjalan berarti runner-nya tidak pernah
> menyala. Yang paling cocok dengan gejala itu: **menit Actions habis atau batas
> pembayaran repo tercapai**. Perlu diperiksa pemilik pada Settings → Billing.
>
> **Jangan menyimpulkan kode yang salah dari merahnya CI hari ini.** Periksa
> dahulu apakah run pada `main` juga gagal seketika; bila ya, sebabnya bukan
> cabang Anda.

---

## 3. Aturan kerja yang berlaku

Sebagian standing rules pemilik, sebagian ditegaskan sepanjang sesi ini.

### Git dan PR

- Selalu `git fetch origin && git checkout -b <branch> origin/main` sebelum mulai.
- Satu PR = satu perhatian. Squash-merge.
- **Tidak pernah force-push.** (Pernah dilanggar sekali pada sesi lampau dan
  dilaporkan; jangan diulang.)
- Jangan menghapus riwayat Git tanpa persetujuan.
- Jangan commit `node_modules`, `dist`, `coverage`, log.

### Larangan pemilik yang tidak boleh dilanggar

- Jangan pakai SVN. Jangan membuat proyek baru. Jangan reset/drop database.
- Jangan mengubah migration yang sudah applied — selalu berkas migrasi BARU.
- Jangan menimpa `.env`. Jangan menyimpan credential di log atau prompt AI.
- Jangan membiarkan AI melakukan tindakan finansial/administratif otomatis.
- Kata sandi hanya Argon2. Audit append-only.
- Ekspresi diskon/harga **tidak pernah** `eval`, `Function`, atau SQL bebas.
- Nama schema **tidak pernah** dari request — hanya dari
  `platform.tenant_schema_registry`. `public` bukan fallback `search_path`.

### POS §4 (larangan khusus kasir)

Jangan mengurangi stok dari frontend. Jangan menghitung total final di browser.
Jangan mempercayai harga/diskon dari browser. Jangan mengizinkan kasir menghapus
transaksi final. Jangan refund tanpa permission. Jangan bertransaksi tanpa
konteks tenant/outlet/register/shift. Jangan double payment. Jangan nomor struk
duplikat. **Jangan mengabaikan idempotency, audit, atau timezone tenant.**

### Gaya kode yang dipakai konsisten di POS

- Penamaan Indonesia untuk kode baru POS (`hitungBaris`, `pilihPromosi`,
  `bersihkanNamaMesin`). Berkas Flutter seluruhnya Indonesia.
- **Aturan yang menyentuh uang hidup di modul MURNI** yang dapat diuji tanpa
  basis data: `pos-pricing.ts`, `pos-promotion.ts`, `pos-promotion-validasi.ts`,
  `apps/pos-flutter/lib/aturan/*`. SQL hanya mengambil kandidat.
- Komentar menjelaskan **mengapa** dan **akibatnya bila salah**, bukan apa.
- **Buktikan merah lebih dahulu.** Setiap penjaga baru disimulasikan cacatnya,
  dilihat merah, lalu dikembalikan. Dipakai berulang sesi ini dan menangkap tiga
  hal nyata.

---

## 4. Keputusan yang sudah diambil pemilik

| Keputusan | Isinya |
| --- | --- |
| Peta pintasan | **Ikuti spesifikasi AIS §21.** Sudah diterapkan di kedua klien (#64) |
| Pajak | eBisnis tetap menghitung pajak (varian Desktop AIS), bukan varian Android tanpa pajak |
| Urutan kerja | Tahap 0→1→2→3→3b sesuai §5 peta spesifikasi |

### Peta pintasan yang berlaku sekarang

| Tombol | Aksi | | Tombol | Aksi |
| --- | --- | --- | --- | --- |
| F1 | Bantuan | | F7 | Fokus keranjang |
| F2 | **Bayar** | | F8 | Sinkronkan |
| F3 | Tahan keranjang | | F9 | Layar pelanggan |
| F4 | Pilih metode bayar | | F10 | Batalkan transaksi |
| F5 | Pilih member | | F11 | Cetak ulang struk |
| F6 | **Buka laci kas** | | F12 | Tutup shift |
| | | | Esc | Tutup / batal |

F1–F9 persis spesifikasi; F10–F12 milik eBisnis (AIS tidak memakainya).
F4/F5/F7/F8/F9 sudah dipetakan tetapi perilakunya belum ada — menekannya
mengatakan "belum tersedia pada klien ini", bukan diam.

**Jangan mengubah peta ini sepihak.** Bila berubah, klien web
(`apps/web/src/pages/pos/PosPage.tsx`) dan Flutter
(`apps/pos-flutter/lib/layar/pintasan.dart`) harus berubah BERSAMA.

---

## 5. Yang harus dikerjakan berikutnya

### Segera

1. **Gabungkan PR #66** (hijau, mergeable).
2. **Tahap 3b sisanya: layar Aturan Diskon.** Endpoint sudah ada, pemilik gerai
   belum punya tempat memakainya. Rute yang sudah didaftarkan di menu:
   `/app/pos/aturan-diskon`, izin `POS_PROMO.*`.

   Endpoint yang tersedia:

   | Metode | Jalur | Izin |
   | --- | --- | --- |
   | GET | `/pos/promotions?includeInactive=true` | `POS_PROMO.READ` |
   | GET | `/pos/promotions/:id` | `POS_PROMO.READ` |
   | POST | `/pos/promotions` | `POS_PROMO.CREATE` |
   | PATCH | `/pos/promotions/:id` | `POS_PROMO.UPDATE` |
   | POST | `/pos/promotions/:id/deactivate` | `POS_PROMO.DELETE` |

   Bentuk badan dan seluruh aturan validasinya ada di
   `apps/api/src/modules/pos/pos-promotion-validasi.ts` beserta 33 ujinya —
   baca itu, jangan menebak.

### Sesudahnya (urutan dari peta §5)

| Tahap | Isi |
| --- | --- |
| 4 | §5 pesanan online + keranjang tertahan satu layar (`hold`/`resume` sudah ada, tinggal disambungkan ke modul `order`) |
| 5 | §14 stok opname, termasuk SO by Scan berantre |
| 6 | §6 + §3.5 + §3.6 member, saldo, PIN — **paling besar, menyentuh uang**, dan menunggu keputusan §6 di bawah |
| 7 | §3.4 cashback (menumpang aturan diskon yang sudah jadi) |
| 8 | §7.2 resep/HPP, §7.5 Excel, §7.6 price tag |
| 9 | §4 dashboard bertahap, §12–13 laporan |

---

## 6. Keputusan yang MASIH menunggu pemilik

Jangan mulai pekerjaan yang bergantung pada ini sebelum dijawab.

### 6.1 Rilis publik `.exe` dan `.apk`

Repo **PRIVAT** — aset rilis GitHub tidak dapat diunduh publik. Alur rilisnya
sudah jadi dan sudah diuji (`workflow_dispatch` menghasilkan
`ebisnis-pos-0.1.0-uji-windows.exe` 10.004.341 byte dan APK ~19 MB), tetapi
tautannya belum dapat dibagikan ke gerai.

Tiga jalan keluar ada di
[`15-rilis-dan-pembaruan.md`](15-rilis-dan-pembaruan.md) §1.

### 6.2 Kunci penandatanganan Android — PERMANEN

Android menolak memasang pembaruan berkunci berbeda; jalan keluarnya hanya
mencopot aplikasi, yang menghapus buku transaksi luring yang belum terkirim.
Alur rilis **menolak melampirkan APK berkunci debug** ke rilis; ia hanya menjadi
artefak workflow sampai empat rahasia disetel
(`ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_PASSWORD`,
`ANDROID_KEY_ALIAS`).

### 6.3 Katalog: hanya cache, atau live saat daring?

Spesifikasi §3.2 menuntut layar kasir **tidak pernah** memanggil peladen untuk
daftar produk jualan. eBisnis memanggil `/pos/catalog/search` saat daring. Itu
perubahan kebijakan, bukan perbaikan.

### 6.4 Member: anggota koperasi atau entitas POS sendiri?

Saldo, PIN, dan minimum mengendap (§3.6) adalah fitur uang. eBisnis sudah punya
anggota koperasi dengan simpanan. Memakai ulang entitas itu mencampur dua hal
beraturan berbeda; membuat entitas member POS sendiri berarti dua daftar orang.
**Menghalangi tahap 6.**

---

## 7. Jebakan yang ditemukan sesi ini

Ditulis karena keempatnya lolos dari `tsc`, `eslint`, dan uji satuan.

### 7.1 Dua `/auth/refresh` serentak mencabut seluruh sesi

Peladen memutar refresh token dan mendeteksi pemakaian ulang: token yang sudah
dipakai, bila dikirim lagi, membuatnya mencabut **seluruh keluarga token**. Itu
benar — begitulah pencurian token ketahuan.

Kliennya yang salah: `auth-context` memanggil `/auth/refresh` sendiri dengan
`skipRefresh`, melewati peredam di `lib/api.ts`. Setiap pemuatan halaman penuh
mengirim dua permintaan dengan token yang sama.

Sekarang **hanya `lib/api.ts` yang boleh memanggil alamat itu**, dijaga uji
tingkat sumber di `api.spec.ts`. Jangan menambah jalur kedua.

### 7.2 Impor di bawah kelas controller → peladen gagal menyala

`ReferenceError: Cannot access 'pos_promotion_service_1' before initialization`.

Dekorator `@Controller` menulis metadata `design:paramtypes` saat kelasnya
didefinisikan; bila `require` untuk salah satu tipe konstruktor baru berjalan
sesudahnya, pembacaannya jatuh pada zona mati temporal.

TypeScript, `nest build`, `eslint`, dan 2125 uji satuan semuanya diam. Yang
menangkapnya E2E — tempat paling mahal. Penjaganya sekarang
`pos-module-muat.spec.ts`. **Letakkan impor layanan di blok impor atas.**

### 7.3 Karakter kendali harfiah di dalam sumber

Uji yang menguji penolakan karakter kendali ditulis dengan mengetikkan karakter
itu **harfiah**. Uji benar, lulus, dan tidak terlihat pada editor mana pun —
siapa pun yang merapikan barisnya akan mengubah apa yang diuji tanpa diff.

Jebakan yang sama pernah terjadi pada pemisah U+001F buku besar. Penjaganya
sekarang menyapu `lib/` **dan** `test/` (`konformansi_test.dart`). Selalu tulis
`\u0000`, jangan karakternya.

### 7.4 Kesimpulan dari `grep`, bukan dari membaca jalurnya

Peta spesifikasi sempat menyatakan mesin diskon "belum dipakai POS". Itu dari
satu `grep` yang hanya menemukan sebuah **komentar**. Kenyataannya seluruh
rantainya sudah jalan. Koreksinya ada di `16-peta-spesifikasi-ais.md` §8.

Memeriksa ulang justru menemukan tiga cacat uang: hari/jam dibaca dari UTC bukan
zona tenant, jendela jam melewati tengah malam tidak pernah benar, dan
`minimum_purchase` tidak pernah diperiksa. Ketiganya diperbaiki di #65.

**Baris peta yang menyatakan sesuatu "belum ada" harus berasal dari membaca
jalurnya.**

---

## 8. Lingkungan kerja — hal yang membuang waktu bila tidak diketahui

| Hal | Kenyataannya |
| --- | --- |
| Worktree | Tujuh worktree berbagi satu repo. `C:\opt\eBisnisGithub` dipakai sesi lain; POS memakai `C:\opt\eBisnisGithub-pos`. `git worktree list` sebelum apa pun |
| `node_modules` | **Per worktree.** `pnpm install --frozen-lockfile` di worktree baru makan belasan menit. Jalankan lebih awal, di latar belakang |
| Prisma | `pnpm db:generate` wajib sebelum `tsc`, kalau tidak ratusan galat palsu "Property does not exist on type 'PrismaService'" |
| Postgres lokal | **Tidak terjangkau** dari mesin ini (5432/5433/5434 semuanya gagal). Karena itu aturan uang sengaja dipisah ke modul murni |
| Git Bash | `git show "origin/main:path"` dipelintir menjadi path Windows. Pakai `export MSYS_NO_PATHCONV=1`. Pernah membuat saya salah menyimpulkan berkas hilang dari `main` |
| `tsc -p tsconfig.json` | Menyertakan berkas `.spec` dan memunculkan galat lama milik modul lain (`cooperative-accounting.spec.ts`). Yang penting: tidak ada galat pada berkas yang sedang dikerjakan |
| Uji Flutter | `flutter test` dari `apps/pos-flutter`. 147 uji, tanpa emulator/perangkat/printer |
| Uji API | `pnpm --filter @ebisnis/api test` — 2127 uji, 80 berkas |
| Server produksi | `38.47.178.46:22031` menolak `publickey,password`; tidak ada kunci privat di mesin ini. **Deploy harus dijalankan pemilik**: `sudo bash /opt/ebisnis/app/deploy/update.sh` |

---

## 9. Peta berkas POS

### `apps/api/src/modules/pos/`

| Berkas | Sifat |
| --- | --- |
| `pos-pricing.ts` | **Murni.** Harga, pajak, diskon, kembalian |
| `pos-promotion.ts` | **Murni.** Aturan pemilihan promosi (zona waktu, jendela jam, cakupan) |
| `pos-promotion-validasi.ts` | **Murni.** Validasi aturan diskon sebelum disimpan |
| `pos-promotion.service.ts` | CRUD aturan diskon |
| `pos-catalog.service.ts` | Kuotasi harga; memuat kandidat promosi lalu menyerahkannya ke modul murni |
| `pos-offline.ts` | **Murni.** Aturan penerimaan transaksi luring (BOOK / QUARANTINE, tak pernah menolak) |
| `pos.module.ts` | Controller + wiring. **Impor layanan di blok atas** (lihat §7.2) |

### `apps/pos-flutter/lib/`

| Folder | Isi |
| --- | --- |
| `aturan/` | **Murni.** Diikat `packages/pos-rules-vectors/vectors.json` bersama sisi TypeScript |
| `layar/` | Layar kasir, bilah samping/atas, kisi produk, panel keranjang, layar pelanggan, peta pintasan |
| `perangkat/` | ESC/POS, pengangkutan jaringan & simpul perangkat, antrean cetak |
| `mesin/` | Identitas mesin POS (UUID permanen + nama) |
| `pembaruan/` | Perbandingan versi, sumber rilis, pengelola cek pembaruan |

**Vektor konformansi**: `packages/pos-rules-vectors/vectors.json` dibangkitkan
`pnpm vektor:bangkitkan`. Ia mengikat aturan uang TypeScript dan Dart. CI
menolak vektor yang tertinggal dari aturannya (langkah *Vektor konformansi
mutakhir* pada `ci.yml`).

---

## 10. Yang belum ada pada klien Flutter

Tercatat juga pada `apps/pos-flutter/README.md`.

| Belum ada | Akibatnya sekarang |
| --- | --- |
| Klien API | Katalog masih contoh tertanam pada `main.dart`; pelanggan, meja, shift, sesi kasir ikut kosong |
| Penyimpanan lokal | Keranjang hilang bila aplikasi ditutup |
| Buku transaksi luring | Penjualan belum tersimpan maupun terkirim |
| Pengangkutan Bluetooth SPP | Printer Bluetooth belum dapat dipakai (§19 menegaskan BLE tidak cukup) |
| Jendela layar kedua | Isi layar pelanggan sudah ada, jendelanya belum |
| Penandatanganan kode Windows | SmartScreen memperingatkan pada pemasangan pertama |

---

## 11. Cara merilis aplikasi kasir

```bash
git tag pos-v0.1.0 && git push origin pos-v0.1.0
```

Uji bangun tanpa menerbitkan apa pun — **lakukan ini sebelum membuat tag**:

```bash
gh workflow run rilis-pos.yml --ref main -f versi=0.1.0-uji
```

Tulis `[WAJIB]` pada catatan rilis hanya bila versi itu menutup cacat yang tidak
boleh dibiarkan berjalan di mesin kasir — pembaruan wajib menghentikan kasir di
tengah hari kerja.

Rinciannya di [`15-rilis-dan-pembaruan.md`](15-rilis-dan-pembaruan.md).
