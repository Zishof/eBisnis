# Serah-terima POS/Inventory — untuk dikendalikan dari jarak jauh

Ditulis untuk dipakai **tanpa menjelajah repo lebih dahulu**. Pemilik memberi
perintah dari ponsel ke komputer lain, jadi setiap tugas di sini berdiri
sendiri: apa yang dikerjakan, di berkas mana, dan apa yang menandakan selesai.

Bila hanya membaca satu bagian: baca **§2 (yang menunggu)** lalu **§6 (perintah
siap-tempel)**.

---

## 1. Keadaan hari ini

Repo: `Zishof/eBisnis` (privat). `main` mutakhir per serah-terima ini.

### Dua PR menunggu digabung — keduanya HIJAU dan MERGEABLE

| PR | Isi | Mengapa perlu |
| --- | --- | --- |
| [#116](https://github.com/Zishof/eBisnis/pull/116) | Layar **Transaksi Ditahan** + `GET /pos/held` | Menu "Transaksi Ditahan" menunjuk `/app/pos/ditahan` sejak lama dan **rutenya tidak pernah ada** — kasir yang menahan keranjang tidak punya jalan mengambilnya kembali |
| [#117](https://github.com/Zishof/eBisnis/pull/117) | Status PO ikut turun ketika penerimaan barangnya dibatalkan | PO tetap `RECEIVED` untuk barang yang tidak jadi masuk → tidak ada yang menagih pemasok; `received_qty` menggelembung → sisa pesanan salah selamanya |

**Gabungkan #117 lebih dahulu** (menyentuh uang/stok), lalu #116.

### Paritas 48 layar Inventory — sudah selesai, jangan diaudit ulang

Diperiksa langsung ke kode pada sesi ini, bukan ke dokumennya saja:

| Yang dicek | Kenyataannya |
| --- | --- |
| Registry bukti | **48 PROVEN, `PENDING_PROOF` kosong** |
| Test paritas yang dulu "mengunci klaim 48/48" | Sudah diperbaiki — kini eksplisit tidak mengunci, plus penjaga regresi |
| `invoiceSalesOrder` tidak cek stok | Sudah diperbaiki (stok sempat −15 pada produk `allow_negative_stock: false`) |
| AP_PAYMENT/AR_RECEIPT tidak teraudit | Sudah diperbaiki |

Jangan memulai ulang audit paritas. Yang tersisa ada di §2.

---

## 2. Yang menunggu dikerjakan, berurutan

Empat gap Inventory yang **sudah dikonfirmasi nyata** dan dicatat sebagai "di
luar cakupan" pada pass sebelumnya. Urutan di bawah dari yang paling jelas
batasnya.

### 2.1 Un-blending rata-rata biaya saat pembalikan penerimaan

`stock_balance.average_cost` dihitung moving-average saat barang diterima.
Ketika penerimaan itu **dibalik**, rata-ratanya tidak dikembalikan — biaya
sisa tetap tercampur dengan biaya penerimaan yang sudah dibatalkan.

Menyentuh HPP penjualan POS (dijurnal sebagai COGS) dan valuasi stok.

Berkas: `applyBalanceDelta()` dan `reverseGoodsReceiptValidation()` di
`apps/api/src/modules/tenant/erp-purchasing.service.ts`.

### 2.2 Pengaruh retur/void POS terhadap rata-rata biaya

Sama seperti 2.1 tetapi dari arah penjualan: barang yang kembali ke stok lewat
retur tidak memutakhirkan `average_cost`.

### 2.3 Biaya penerimaan transfer antar-gudang

Jalur transfer **tidak punya data biaya sama sekali**. Ini bukan sekadar
menyambungkan — perlu keputusan dari mana biayanya diambil (rata-rata gudang
asal, atau biaya lot). **Tanyakan pemilik sebelum membangun.**

### 2.4 Jurnal pembalik untuk `accounting_event` yang sudah `POSTED`

Saat ini pembalikan hanya melewati event yang masih `PENDING`. Yang sudah
terjurnal butuh jurnal pembalik terpisah mengikuti pola `reversal_of_id` yang
sudah ada di `journal_entry`. Jarang terjadi karena aturan posting tidak
disemai default per tenant.

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

---

## 4. Lingkungan — hal yang membuang waktu bila tidak diketahui

| Hal | Kenyataannya |
| --- | --- |
| Worktree | Banyak worktree berbagi satu repo. **`git worktree list` sebelum apa pun.** Jangan mengganti checkout worktree yang sedang dipakai sesi lain |
| `node_modules` | **Per worktree.** `pnpm install --frozen-lockfile` di worktree baru makan belasan menit — jalankan lebih awal, di latar belakang |
| Prisma | `pnpm db:generate` **wajib** sebelum `tsc`, kalau tidak ratusan galat palsu "Property does not exist on type 'PrismaService'" |
| Postgres lokal | **Tidak terjangkau** dari mesin sesi ini. Karena itu aturan uang sengaja dipisah ke modul murni |
| Git Bash | `git show "origin/main:path"` dipelintir jadi path Windows. Pakai `export MSYS_NO_PATHCONV=1`. Pernah membuat saya salah menyimpulkan berkas hilang dari `main` |
| `tsc -p tsconfig.json` | Menyertakan `.spec` dan memunculkan galat lama milik modul lain. Yang penting: tidak ada galat pada berkas yang sedang dikerjakan |
| `rich-text-sanitizer.spec.ts` | **Sudah rusak sebelum sesi ini** — galat transform Jest pada `sanitize-html`. Suite ini gagal DIMUAT, bukan gagal uji. Tercatat pada ringkasan 10 Agustus §6. Jangan dikira regresi Anda |

Perintah uji:

```bash
pnpm --filter @ebisnis/api test      # ~4030 uji
pnpm --filter @ebisnis/api lint
pnpm --filter @ebisnis/web lint
cd apps/pos-flutter && flutter test  # ~147 uji
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

---

## 6. Perintah siap-tempel

Dirancang untuk dikirim apa adanya dari ponsel. Masing-masing berdiri sendiri.

### Menggabungkan yang sudah siap

```text
Gabungkan PR #117 lalu #116 dengan squash-merge. Pastikan checknya hijau
lebih dahulu; kalau ada yang merah, laporkan dan jangan digabung.
```

### Menyiapkan komputer baru

```text
Clone https://github.com/Zishof/eBisnis.git, checkout main, jalankan
pnpm install --frozen-lockfile lalu pnpm db:generate. Laporkan bila
node_modules atau Prisma bermasalah. Jangan menyentuh worktree lain.
```

### Mengerjakan gap berikutnya

```text
Baca docs/pos-web-priority/20-serah-terima-remote-pos-inventory.md bagian 2.1,
lalu kerjakan un-blending rata-rata biaya saat pembalikan penerimaan. Taruh
aturannya di modul murni yang dapat diuji tanpa basis data, buktikan merah
lebih dahulu, lalu buka PR.
```

```text
Baca dokumen serah-terima remote POS/Inventory bagian 2.2, kerjakan pengaruh
retur/void POS terhadap rata-rata biaya. Aturan di modul murni, uji tanpa
basis data, PR terpisah.
```

### Memeriksa keadaan

```text
Laporkan: PR apa saja yang terbuka beserta status checknya, commit terakhir
di main, dan apakah ada gap Inventory yang sudah ditutup sejak dokumen
serah-terima remote ditulis. Jangan mengerjakan apa pun dulu.
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
- Mengaudit ulang paritas 48 layar. Sudah 48/48 dengan bukti.

---

## 8. Dokumen pendamping

| Dokumen | Isi |
| --- | --- |
| `HANDOVER.md` (akar) | Indeks seluruh serah-terima aktif |
| `docs/session-notes/2026-08-10-ringkasan-sesi.md` | CI/CD, matrix build rilis, auto-update, empat perbaikan integritas |
| `docs/pos-inventory-parity/00-INDEX.md` | Dashboard paritas 48 layar + bukti per layar |
| `docs/pos-inventory-parity/evidence/screen-20/uat.md` | Bukti penerimaan barang, termasuk tindak lanjut status PO |
| `docs/pos-web-priority/16-peta-spesifikasi-ais.md` | Peta selisih terhadap spesifikasi AIS + urutan tahap |
| `docs/pos-web-priority/15-rilis-dan-pembaruan.md` | Alur rilis `.exe`/`.apk` dan cek pembaruan |
