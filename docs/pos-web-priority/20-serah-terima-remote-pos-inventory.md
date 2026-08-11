# Serah-terima POS/Inventory — untuk dikendalikan dari jarak jauh

Ditulis untuk dipakai **tanpa menjelajah repo lebih dahulu**. Pemilik memberi
perintah dari ponsel ke komputer lain, jadi setiap tugas di sini berdiri
sendiri: apa yang dikerjakan, di berkas mana, dan apa yang menandakan selesai.

Bila hanya membaca satu bagian: baca **§2 (yang menunggu)** lalu **§6 (perintah
siap-tempel)**.

> **Dikoreksi 2026-08-11.** Versi pertama dokumen ini (10 Agustus) menyatakan
> paritas 48 layar "sudah selesai, jangan diaudit ulang". Pernyataan itu benar
> untuk tolok ukur yang berlaku saat itu, tetapi tolok ukurnya **diperlebar pada
> 11 Agustus** dan sekarang menyesatkan. Lihat §1 dan §9.

---

## 1. Keadaan hari ini

Repo: `Zishof/eBisnis` (privat). Baseline dokumen ini: `d298929`.

### Dua PR yang dulu menunggu — SUDAH DIGABUNG

| PR | Isi | Digabung |
| --- | --- | --- |
| [#117](https://github.com/Zishof/eBisnis/pull/117) | Status PO ikut turun ketika penerimaan barangnya dibatalkan | 10 Agu 2026 → `e5e896e` |
| [#116](https://github.com/Zishof/eBisnis/pull/116) | Layar **Transaksi Ditahan** + `GET /pos/held` | 10 Agu 2026 → `b7172a3` |

Keduanya sudah ada di `main`. Tidak ada yang perlu digabung lagi dari daftar ini.

### Paritas 48 layar Inventory — tolok ukurnya berubah, JANGAN pakai angka lama

Ini bagian terpenting dokumen ini, dan bagian yang paling mudah salah dibaca.

Pada 11 Agustus commit `e20b913` memperlebar model paritas: registry tidak lagi
menghitung hanya kemampuan **melihat** layar, melainkan `screen × surface ×
capability` — termasuk `create/update/post/reverse`, `print/export`, `offline`,
`reconciliation`, dan `hardware`.

| Ukuran | 10 Agu (model lama) | 11 Agu (model sekarang) |
| --- | --- | --- |
| Requirement di registry | 242 | **606** |
| Masih pending | 0 | **414** |
| Bukti `view` per surface | 48/48 | 48/48 (tidak berubah) |
| Layar lengkap di semua capability | tidak diukur | **0 / 48** |

Kedua angka itu benar. Yang berubah bukan kualitas kodenya, melainkan **apa yang
dihitung sebagai bukti**. Karena itu:

- **Jangan** mengatakan "paritas 48 layar sudah selesai". Menurut sumber
  kebenaran sekarang (`parity-48.json` + `parity-evidence.registry.ts`), seluruh
  layar berstatus **PARTIAL / EVIDENCE GAP**.
- **Jangan** pula memulai audit paritas dari nol. Auditnya sudah ada dan baru:
  `docs/implementation/inventory-sales-48/gap-analysis-video-48-2026-08-11.md`
  (374 baris, lengkap dengan prioritas P0/P1/P2). Kerjakan dari sana.

---

## 2. Yang menunggu dikerjakan, berurutan

Nomor **tidak pernah diubah** walau isinya selesai — perintah yang sudah
tersimpan di ponsel menunjuk nomor ini, dan nomor yang bergeser membuat perintah
lama mengerjakan hal yang salah. Yang selesai ditandai, bukan dihapus.

### 2.1 Un-blending rata-rata biaya saat pembalikan penerimaan — **SELESAI**

Ditutup pada `e20b913`. Diverifikasi ke kode, bukan ke dokumennya:
`applyBalanceDelta()` kini menerima `outboundCost` dan membalik rata-ratanya
secara matematis (`tenant-bootstrap.service.ts`), dan jalur pembalikan GR
mengisinya di `erp-purchasing.service.ts:1519`.

Tidak perlu dikerjakan lagi.

### 2.2 Pengaruh retur/void POS terhadap rata-rata biaya — **SELESAI**

Dulu: barang kembali ke stok lewat retur atau pembatalan tanpa memutakhirkan
`average_cost` — kuantitas bertambah tanpa nilainya ikut bertambah, sehingga
setiap retur mengencerkan nilai persediaan dan HPP penjualan berikutnya.

Aturannya sekarang di modul murni `apps/api/src/modules/pos/pos-biaya-retur.ts`,
dipakai `kembalikanStok()` pada `pos-return.service.ts` — satu-satunya jalur
yang mengembalikan barang, dipakai baik oleh retur maupun pembatalan.

Yang perlu diketahui bila menyentuhnya lagi:

- Biaya diambil dari `cost_snapshot` saat barang **dijual**, bukan rata-rata
  hari ini. Dengan begitu nilai persediaan bertambah persis sebesar COGS yang
  dibalik.
- **Biaya nol ditolak, bukan dicampur.** `cost_snapshot` bertipe `NOT NULL
  DEFAULT 0` dan diisi dari `COALESCE(average_cost, 0)`; seluruh penjualan
  sebelum 10 Agustus 2026 menyimpan nol. Mencampurkan nol akan menarik valuasi
  produk itu ke bawah selamanya, diam-diam.
- Hanya barang yang kembali ke stok jual yang menggeser rata-rata. Barang rusak
  masuk `damaged_qty`; barang dimusnahkan tidak kembali ke mana pun.
- Ekspresi SQL `average_cost` pada `kembalikanStok()` adalah cerminan
  `rataRataSesudahRetur()`. Bila salah satu berubah, yang lain harus ikut —
  ada penjaga yang membaca sumbernya di `pos-biaya-retur.spec.ts`.

### 2.3 Biaya penerimaan transfer antar-gudang — **TERBUKA, perlu keputusan**

Jalur transfer tidak punya data biaya sama sekali. Ini bukan sekadar
menyambungkan — perlu keputusan dari mana biayanya diambil (rata-rata gudang
asal, atau biaya lot). **Tanyakan pemilik sebelum membangun** (§5 nomor 2).

### 2.4 Jurnal pembalik untuk `accounting_event` yang sudah `POSTED` — **SELESAI**

Dulu: pembalikan hanya menyetel `SKIPPED` untuk event yang masih `PENDING`;
yang sudah terjurnal dibiarkan berdiri. Stok dan hutang dagang kembali, tetapi
jurnalnya tidak — selisih permanen tanpa galat apa pun.

Sekarang `AccountingPostingService.reversePostedEvents()` membentuk jurnal BARU
yang ditautkan lewat `journal_entry.reversal_of_id`, dipanggil dari dalam
transaksi yang sama dengan pembalikan dokumennya. Aturannya di modul murni
`apps/api/src/modules/accounting/reversal-journal.ts`.

Empat keputusan yang perlu diketahui bila menyentuhnya lagi:

- **Dibalik dari baris jurnal yang tercatat, bukan dihitung ulang dari aturan
  posting.** Aturan dapat diubah tanpa rilis; menghitung ulang akan menghasilkan
  angka berbeda begitu aturannya pernah disunting.
- **Peristiwa aslinya tetap `POSTED`.** Ia memang pernah terjurnal; itu riwayat.
  Pembaliknya dicatat pada `metadata` dan lewat `reversal_of_id`.
- **Kunci pembalik deterministik** (`ACCOUNTING_EVENT_REVERSAL:<id>`,
  `AER-<tanggal>-<hex>`) sehingga indeks unik menolak pembalik kedua. Membalik
  dua kali akan melewati nol dan berbalik arah — dan neracanya tetap seimbang,
  jadi tidak ada yang menandainya.
- **Periode pembalik adalah HARI INI dan wajib terbuka.** Tidak pernah
  ditanggalkan mundur ke periode yang sudah ditutup. Bila tidak ada periode
  terbuka, seluruh pembatalan digulung balik dengan pesan yang menyuruh membuka
  periode — disengaja, sebab membalik stok tanpa membalik jurnalnya adalah
  persis cacat yang baru saja ditutup ini. **Bila pemilik menghendaki
  pembatalan tetap jalan tanpa jurnal, ini titik yang diubah.**

Berlaku untuk pembatalan penerimaan barang. Jalur lain yang membalik dokumen
dapat memanggil `reversePostedEvents()` yang sama dengan `sourceType` masing
masing.

### 2.5 Matriks capability 48 layar — **TERBUKA, dan sekarang front terbesar**

414 dari 606 requirement masih pending. Jangan menyusun rencana sendiri; sudah
ada urutannya di `gap-analysis-video-48-2026-08-11.md` §6:

| Prioritas | Inti |
| --- | --- |
| **P0** | **SELESAI.** Kejujuran klaim katalog dan hak laporan per domain — keduanya di bawah |
| **P1** | Vertical slice transaksi lengkap per rentang layar (20–29, 30–42, 08–19, 43–48) |
| **P2** | ID test `NORMAL`/`VALIDATION`/`RBAC`/`AUDIT`/`PRINT-EXPORT`/`OFFLINE-RETRY`/`RECONCILIATION`/`VISUAL` per layar, lalu UAT perangkat nyata |

Gap yang berulang di ketiga surface, layak diketahui sebelum mulai: **outbox
Flutter belum dipakai** pembelian/AP/AR/nota/opname/price book/jurnal; **cetak
dan ekspor** umumnya dari data live, bukan snapshot server yang punya print log;
**bukti Windows dan Android** masih navigasi, belum transaksi.

#### P0 kejujuran klaim — selesai, dan apa yang ditemukan

Katalog menjawab "alurnya ada"; registry menjawab "sudah dibuktikan". Keduanya
sempat terbaca sebagai satu hal, dan yang terbaca orang adalah katalognya.

Dua cacat ditemukan pada penjaganya, keduanya sekaligus:

1. **`ensureCatalogWired()` tidak pernah dapat gagal.** Ia menuntut setiap layar
   `OPERATIONAL` tercatat pada `provenScreens()` **atau** `PENDING_PROOF`. Ketika
   registry masih menghitung `view` saja, syarat itu berarti sesuatu. Setelah
   registry diperluas menjadi 606 requirement dengan 414 pending, `PENDING_PROOF`
   memuat **seluruh 48 layar** — sehingga syaratnya dipenuhi tanpa kecuali.
   Penjaganya melemah justru ketika paling dibutuhkan.
2. **`ensureCatalogWired()` tidak pernah dipanggil dari mana pun.** Penjaga yang
   tidak dijalankan sama saja dengan penjaga yang tidak ada.

Yang sekarang berlaku:

- `surfaceEvidence(screen, surface)` melaporkan `required`/`proven`/`missing`
  per layar per surface, dengan **nama capability** yang kurang — bukan sekadar
  jumlah, sebab angka tanpa nama tidak dapat ditindaklanjuti.
- `/inventory/parity-contract` **tidak pernah lagi mengirim label sendirian**:
  setiap item membawa `evidence` per surface, plus `evidenceSummary` terpisah
  dari `summary` label.
- `catalogOverclaims()` menolak klaim tanpa bukti-buka pada surface itu, dan
  `ensureCatalogWired()` kini benar-benar dijalankan pada tiap CI.

Angka jujurnya, yang dulu tersamar:

| Surface | `view` terbukti | **Seluruh capability terbukti** | Requirement | Pending |
| --- | --- | --- | --- | --- |
| API | 48 | **0** | 168 | 120 |
| Web | 48 | **12** | 138 | 90 |
| Windows | 48 | **12** | 150 | 102 |
| Android | 48 | **12** | 150 | 102 |

Keduabelas layar itu memang hanya menuntut dapat dibuka (mis. "Membuka Daftar
Supplier"). API nol karena setiap layar masih menunggu bukti `reconciliation`.
Tidak ada satu layar pun yang lengkap pada semua surface sekaligus.

#### P0 hak laporan per domain — selesai

Seluruh laporan dijaga `SALES.READ`, termasuk `profit-loss` (laba rugi
akuntansi), `gross-profit` (laba kotor, memuat HPP per barang), `ap-aging`, dan
`ap-payment-register`. Siapa pun yang boleh membaca penjualan juga membaca
margin, hutang dagang, dan laba rugi perusahaan.

Petanya sekarang di modul murni `apps/api/src/modules/tenant/izin-laporan.ts`,
ditegakkan `PermissionGuard` lewat dekorator `@ReportPermission()` — mengikuti
pola `@ResourcePermission` yang sudah ada, supaya tidak lahir aturan kedua.

Yang perlu diketahui bila menyentuhnya lagi:

- **Kode laporan tak dikenal DITOLAK**, bukan jatuh ke hak bawaan. Laporan baru
  tanpa entri akan gagal saat pertama dipanggil — terlihat, lalu diperbaiki.
  Hak bawaan berarti laporan baru terbuka bagi semua orang tanpa seorang pun
  menyadarinya, dan itu persis cara cacat ini terbentuk sejak awal.
- **Snapshot tersimpan ikut dijaga.** Kode laporannya ada di dalam baris, bukan
  di URL, jadi pemeriksaannya sesudah baris dibaca. Tanpa ini perbaikannya
  kosmetik: laba rugi tetap terbaca lewat idnya, dan snapshot justru bentuk
  yang paling mudah beredar.
- Hak yang dipakai **seluruhnya sudah ada** pada katalog menu. Tidak ada migrasi
  maupun penyemaian baru; yang berubah hanya laporan mana menuntut hak mana.
  `SALES_REPORT.VIEW_PROFIT` sudah ada sejak awal dan belum pernah dipakai
  menjaga apa pun.
- Klien web sudah menampilkan galatnya sebagai pesan, bukan crash. Pemegang
  `SALES.READ` kini melihat "Hak akses tidak mencukupi" pada tab laba rugi —
  itu memang yang dimaksud. Menyembunyikan tabnya adalah pekerjaan UI
  tersendiri, belum dikerjakan.
- **Menambah penanda otorisasi baru: cukup di `AUTHORIZATION_MARKER_KEYS`.**
  Dulu daftarnya ditulis dua kali — di `PermissionGuard` dan di
  `assertEveryRouteIsMarked`. `@ReportPermission` sempat ditambahkan ke
  penjaganya saja, dan akibatnya bukan endpoint yang lolos melainkan **aplikasi
  yang tidak dapat menyala sama sekali**; auditnya berjalan saat bootstrap.
  Ketahuan dari uji peramban, bukan dari uji satuan mana pun. Sekarang satu
  daftar dipakai keduanya, plus penjaga yang menuntut setiap kunci metadata
  baru diputuskan: penanda, atau bukan.

---

## 3. Cara kerja yang WAJIB diikuti

1. **Branch baru dari `origin/main`** sebelum apa pun:
   `git fetch origin && git checkout -b <branch> origin/main`
2. Satu PR = satu perhatian. Squash-merge.
3. **Tidak pernah force-push.** Tidak pernah `--no-verify`.
4. **Migrasi tenant**: tidak pernah menyunting yang sudah applied — selalu
   berkas BARU, additive, dan **wajib didaftarkan di `manifest.json`**.
   Migrasi yang ada berkasnya tetapi tidak terdaftar TIDAK PERNAH dijalankan.
5. Tidak pernah menulis kredensial ke berkas, log, atau commit.
6. **Deploy dan `update.sh` di server produksi adalah tanggung jawab pemilik.**
   Jangan pernah SSH ke server produksi.
7. Aturan yang menyentuh uang hidup di **modul murni** yang dapat diuji tanpa
   basis data (`pos-pricing.ts`, `pos-promotion.ts`, `purchase-order-status.ts`,
   `pos-held.ts`). SQL hanya mengambil data; keputusannya di modul murni.
8. **Buktikan merah lebih dahulu.** Setiap penjaga baru disimulasikan cacatnya,
   dilihat merah, lalu dikembalikan.
9. **Klaim status diverifikasi ke kode, bukan ke dokumen** — termasuk dokumen
   ini. Kekeliruan yang dikoreksi pada §9 lolos justru karena dokumennya dibaca
   sebagai bukti.

---

## 4. Lingkungan — hal yang membuang waktu bila tidak diketahui

| Hal | Kenyataannya |
| --- | --- |
| Worktree | Banyak worktree berbagi satu repo. **`git worktree list` sebelum apa pun.** Jangan mengganti checkout worktree yang sedang dipakai sesi lain. `main` sendiri biasanya sudah di-checkout salah satu worktree, sehingga `git checkout main` gagal — buat cabang dari `origin/main` |
| `node_modules` | **Per worktree.** `pnpm install --frozen-lockfile` di worktree baru makan belasan menit — jalankan lebih awal, di latar belakang |
| Prisma | `pnpm db:generate` **wajib** sebelum `tsc`, kalau tidak ratusan galat palsu "Property does not exist on type 'PrismaService'" |
| Postgres lokal | Tidak selalu terjangkau. Karena itu aturan uang sengaja dipisah ke modul murni. Migrasi V064–V068 sudah diterapkan pada 16 schema tenant lokal di komputer yang menjalankan pass 11 Agustus |
| Git Bash | `git show "origin/main:path"` dipelintir jadi path Windows. Pakai `export MSYS_NO_PATHCONV=1`. Pernah membuat saya salah menyimpulkan berkas hilang dari `main` |
| `tsc -p tsconfig.json` | Menyertakan `.spec` dan memunculkan galat lama milik modul lain. Yang penting: tidak ada galat pada berkas yang sedang dikerjakan |
| `rich-text-sanitizer.spec.ts` | **Sudah rusak sebelum sesi ini** — galat transform Jest pada `sanitize-html`. Suite ini gagal DIMUAT, bukan gagal uji. Tercatat pada ringkasan 10 Agustus §6. Jangan dikira regresi Anda |
| Golden Flutter | Dibuat di Ubuntu CI, bukan Windows. Ada workflow `perbarui-golden-pos.yml` |

Perintah uji, beserta hitungan yang tercatat pada pass 11 Agustus:

```bash
pnpm --filter @ebisnis/api test      # Jest lulus seluruhnya
pnpm --filter @ebisnis/web test      # 46 berkas / 511 uji
pnpm --filter @ebisnis/api lint
pnpm --filter @ebisnis/web lint
cd apps/pos-flutter && flutter analyze && flutter test   # 203 uji
```

---

## 5. Keputusan yang menunggu pemilik

Jangan mulai pekerjaan yang bergantung pada ini.

| # | Keputusan | Menghalangi |
| --- | --- | --- |
| 1 | Penandatanganan Android: `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS` belum lengkap | Terbitnya APK ke rilis. Kuncinya **permanen** — sekali terbit dengan kunci X, semua pembaruan wajib kunci X |
| 2 | Sumber biaya untuk transfer antar-gudang (§2.3) | Gap 2.3 |
| 3 | Member POS: pakai anggota koperasi, atau entitas sendiri | Saldo/PIN kasir (§3.5–3.6 spesifikasi AIS) |
| 4 | Katalog kasir: hanya cache, atau live saat daring | §3.2 spesifikasi AIS |
| 5 | Keputusan UAT yang terdaftar di `gap-analysis-video-48-2026-08-11.md` §7: custody nota, mapping akun sales legacy, perilaku retur/void/write-off, kebijakan `HPP Tambah (%)`, definisi tiga laporan layar 41, dan perangkat lapangan | Sebagian besar P1 dan seluruh P2 |

---

## 6. Perintah siap-tempel

Dirancang untuk dikirim apa adanya dari ponsel. Masing-masing berdiri sendiri.

### Memeriksa keadaan

```text
Laporkan: PR apa saja yang terbuka beserta status checknya, commit terakhir
di main, dan apakah ada gap Inventory yang sudah ditutup sejak dokumen
serah-terima remote ditulis. Verifikasi ke kode, bukan ke dokumen.
Jangan mengerjakan apa pun dulu.
```

### Menyiapkan komputer baru

```text
Clone https://github.com/Zishof/eBisnis.git, checkout main, jalankan
pnpm install --frozen-lockfile lalu pnpm db:generate. Laporkan bila
node_modules atau Prisma bermasalah. Jangan menyentuh worktree lain.
```

### Mengerjakan gap berikutnya

```text
Baca docs/pos-web-priority/20-serah-terima-remote-pos-inventory.md bagian 2.2
sebagai contoh bentuk yang diinginkan, lalu kerjakan bagian 2.3 SETELAH saya
memutuskan sumber biayanya. Jangan mulai sebelum keputusan itu ada.
```

```text
Baca dokumen serah-terima remote POS/Inventory bagian 2.4, kerjakan jurnal
pembalik untuk accounting_event yang sudah POSTED, mengikuti pola
reversal_of_id yang sudah ada di journal_entry. PR terpisah.
```

### Mengerjakan matriks capability 48 layar

```text
Baca docs/implementation/inventory-sales-48/gap-analysis-video-48-2026-08-11.md
bagian 6, lalu kerjakan P0 nomor 1: turunkan klaim katalog yang belum punya
bukti di registry. Jangan menaikkan status apa pun tanpa test yang membuktikan
capability itu persis pada surface itu. Satu PR.
```

### Rilis aplikasi kasir

```text
Jalankan uji bangun tanpa menerbitkan:
gh workflow run rilis-pos.yml --ref main -f versi=X.Y.Z-uji
Laporkan hasilnya. Jangan membuat tag rilis tanpa persetujuan saya.
```

---

## 7. Yang TIDAK boleh dikerjakan tanpa diminta

- SSH atau deploy ke server produksi (`38.47.178.46`).
- Membuat tag rilis `pos-v*` / `inventory-v*`.
- Mengubah peta pintasan papan ketik. Ia sudah diputuskan mengikuti
  spesifikasi AIS §21, dan bila berubah **klien web dan Flutter harus berubah
  bersama** — peta berbeda antar klien lebih buruk daripada peta mana pun.
- Memecah `inventory_app.dart` sebagai rewrite besar. Ia memang layak dipecah,
  tetapi bukan syarat deploy dan tidak boleh jadi pekerjaan besar sendiri.
- Meregenerasi golden Flutter dari Windows. Golden dibuat di Ubuntu CI; ada
  workflow khusus `perbarui-golden-pos.yml` untuk itu.
- **Memulai audit paritas 48 layar dari nol.** Bukan karena paritasnya sudah
  selesai — ia belum, lihat §1 — melainkan karena auditnya sudah ada dan baru
  (`gap-analysis-video-48-2026-08-11.md`, 11 Agustus). Menulis audit kelima
  hanya menambah dokumen yang saling bertentangan. Kerjakan P0/P1/P2-nya.
- **Menaikkan status di `parity-evidence.registry.ts` tanpa test atau UAT yang
  membuktikan capability itu persis pada surface itu.** Registry adalah sumber
  kebenaran; menaikkannya tanpa bukti membuat seluruh angka §1 tidak berarti.

---

## 8. Dokumen pendamping

| Dokumen | Isi |
| --- | --- |
| `HANDOVER.md` (akar) | Indeks seluruh serah-terima aktif |
| `docs/implementation/inventory-sales-48/gap-analysis-video-48-2026-08-11.md` | **Audit paritas terbaru** — matriks per layar, P0/P1/P2, keputusan UAT terbuka |
| `docs/implementation/inventory-sales-48/parity-48.json` | Sumber kebenaran angka paritas (606 requirement) |
| `docs/session-notes/2026-08-10-ringkasan-sesi.md` | CI/CD, matrix build rilis, auto-update, empat perbaikan integritas |
| `docs/pos-inventory-parity/00-INDEX.md` | Dashboard paritas per layar + bukti |
| `docs/pos-inventory-parity/evidence/screen-20/uat.md` | Bukti penerimaan barang, termasuk tindak lanjut status PO |
| `docs/pos-web-priority/16-peta-spesifikasi-ais.md` | Peta selisih terhadap spesifikasi AIS + urutan tahap |
| `docs/pos-web-priority/15-rilis-dan-pembaruan.md` | Alur rilis `.exe`/`.apk` dan cek pembaruan |

---

## 9. Riwayat koreksi

Dicatat, bukan disunting diam-diam: dokumen ini pernah dipakai sebagai bukti,
jadi yang berubah harus dapat ditelusuri.

**11 Agustus 2026** — versi pertama (10 Agustus, PR #118) menyatakan:

> "Paritas 48 layar Inventory — sudah selesai, jangan diaudit ulang … Registry
> bukti: 48 PROVEN, `PENDING_PROOF` kosong"

dan mencantumkan "mengaudit ulang paritas 48 layar" pada daftar §7 sebagai hal
yang tidak boleh dikerjakan.

Pernyataan itu benar terhadap model 242-requirement yang berlaku 10 Agustus.
Tetapi commit `e20b913` (11 Agustus) memperlebar registry menjadi 606
requirement lintas capability, dan 414 di antaranya pending. Akibatnya kalimat
di atas justru **melarang pekerjaan yang kini paling terbuka** — persis
kegagalan yang paling mahal untuk dokumen yang dirancang diikuti tanpa membaca
repo lebih dahulu.

Yang diubah: §1 (angka paritas), §2 (2.1 ditandai selesai, 2.5 ditambahkan),
§4 (hitungan uji dan catatan `main` sudah ter-checkout worktree lain), §5
(keputusan UAT), §6 (perintah gabung PR dihapus karena sudah digabung; perintah
P0 ditambahkan), §7 (larangan diganti dengan alasan yang benar), §8
(audit baru didaftarkan).

Nomor §2.1–§2.4 sengaja **tidak digeser** agar perintah yang sudah tersimpan di
ponsel tetap menunjuk pekerjaan yang sama.
