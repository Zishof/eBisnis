# 01 — Status Penerapan Versi 8 Revisi 1

Versi 9 menuntut setiap halaman barunya mengikuti standar Versi 8: Help, Excel,
PDF, dan CrudActionGroup. Dokumen ini memeriksa mana dari standar itu yang
benar-benar sudah ada.

Metode: pencarian penanda pada seluruh `apps/` dan `packages/`, lalu pemeriksaan
manual pada berkas yang cocok. Bukti pada
[`evidence/baseline-v9-0.txt`](evidence/baseline-v9-0.txt).

## Ringkasan

| Kapabilitas V8 R1 | Status | Bukti |
| --- | --- | --- |
| Help Center (backend) | **MISSING** | 0 berkas memuat `HelpTopic`/`help_topic` |
| Help Drawer (UI) | **MISSING** | tidak ada komponen help |
| Diagram / flowchart | **MISSING** | `mermaid` bukan dependency |
| Guided tour | **MISSING** | 0 berkas |
| CrudActionGroup | **MISSING** | 0 berkas |
| Excel template / download | **MISSING** | `exceljs` bukan dependency |
| Excel upload / dry-run / preview | **MISSING** | 0 berkas |
| PDF print job | **MISSING** | `pdfkit` bukan dependency |
| Menu registry | **PARTIAL** | `MENU_TREE_SEED` 73 node / 21 root; blueprint menuntut 33 root |
| Role / duty / privilege | **DONE (varian)** | V010; profil per modul, bukan tabel Duty |
| Data scope | **PARTIAL** | tersimpan pada `role_data_scope`; **tidak ditegakkan pada query** |
| Segregation of duty | **DONE** | 13 aturan, ditegakkan saat penetapan role |
| Sample user per role | **MISSING** | belum ada generator akun uji |
| Google login | **MISSING** | `google-auth-library` bukan dependency; rancangan ada di `docs/upgrade-v8/17` |
| Tenant custom domain | **MISSING** | `Website` tidak punya `tenantId` |
| Tenant website / storefront | **MISSING** | CMS yang ada adalah situs platform |

## Arti bagi Versi 9

Dokumen Versi 9 menyatakan:

> "Jika V8 R1 belum diterapkan, selesaikan prerequisite V8 yang diperlukan
> sebelum halaman V9. Jangan membuat implementasi kedua yang paralel."

Berdasarkan tabel di atas, **11 dari 16 kapabilitas Versi 8 belum ada**. Yang
menjadi prasyarat nyata bagi Versi 9, bukan sekadar diinginkan:

### Prasyarat keras

**1. CrudActionGroup + penegakan permission (V8-4).**
Aturan Versi 9 "Upload hanya tampil jika UPDATE dan DELETE" tidak berarti apa-apa
tanpa ini. Lebih penting lagi, temuan V6-0-F03 masih berlaku: `PermissionGuard`
keluar lebih awal bila handler tidak punya metadata permission, dan 13 endpoint
master tidak memilikinya. Selama itu belum diperbaiki, setiap aturan tombol
Versi 9 dapat dilewati dengan memanggil API langsung.

Versi 9 menambah puluhan endpoint yang menyentuh uang dan stok. Menambahkannya di
atas guard yang bocor memperbesar permukaan masalah, bukan menundanya.

**2. Menu registry yang dapat menampung modul baru.**
Katalog role Versi 8 menunjuk **modul** (kode menu root). Menu Versi 9 memerlukan
root baru — Marketplace, Toko Online, Fulfillment, Shipping. Selama root itu
belum ada, role Versi 9 tidak dapat menyatakan haknya.

Ini murah: menambah root pada `MENU_TREE_SEED` dan mendaftarkannya pada katalog
role. Tidak memerlukan Help maupun Excel.

**3. Media / file pipeline.**
Aturan "minimal tiga gambar aktif" menuntut unggah, validasi, dan turunan gambar.
`file_object` sudah ada sebagai tabel tetapi **tidak dipakai satu pun service** —
pencarian `file_object` pada `apps/api/src` hanya menemukan generator dokumentasi.

Jadi penyimpanan berkas bukan "sudah ada dan tinggal dipakai"; ia tabel kosong
tanpa layanan.

### Bukan prasyarat

**Help Center, Excel, PDF, guided tour, diagram.** Semuanya standar penyajian.
Halaman Versi 9 dapat berjalan dan diuji tanpanya, lalu distandarkan pada fase
V9-13B seperti yang memang dijadwalkan dokumen Versi 9.

Mengerjakan Help Center penuh (±35 tabel) lebih dulu berarti menunda seluruh
marketplace demi lapisan bantuan untuk halaman yang belum ada.

**Google login.** Dokumen Versi 9 menyebutnya untuk pembeli, tetapi pembeli
marketplace dapat memakai email/kata sandi lebih dulu. Rancangannya sudah selesai
pada `docs/upgrade-v8/17-google-login-design.md` dan dapat diterapkan kapan saja
tanpa membongkar apa pun.

## Yang tidak akan diduplikasi

Agar tidak melanggar larangan "jangan membuat framework kedua", berikut komponen
Versi 8 yang **akan dipakai apa adanya** oleh Versi 9:

| Komponen | Dipakai untuk |
| --- | --- |
| `role-profile.ts` P0–P12 | profil M1–M8 Versi 9 diturunkan sebagai profil tambahan pada berkas yang sama |
| `role-expansion.ts` | penurunan izin menu role marketplace |
| `tenant-role.seed.ts` | katalog role Versi 9 ditambahkan ke katalog yang sama |
| `SegregationOfDutyService` | aturan SoD Versi 9 memakai tabel dan penegakan yang sama |
| `MasterLifecycleService` | lifecycle listing dan master marketplace |
| `MasterSeedRegistry` | seed kategori dan atribut marketplace |
| Audit trigger generik V008 | audit tabel marketplace |
| `idempotency_record` | idempotensi callback dan webhook |
| `number_sequence` | nomor order marketplace |
| `job_execution` | worker projection dan rekonsiliasi |

## Utang yang dicatat, bukan diselesaikan sekarang

| Utang | Dampak pada V9 | Rencana |
| --- | --- | --- |
| V6-0-F03 guard bocor | aturan tombol V9 dapat dilewati | **diselesaikan pada V9-1**, sebelum endpoint marketplace pertama |
| Data scope tidak ditegakkan | seller dapat melihat data seller lain bila query tidak disaring | ditegakkan bersama V6-0-F03 |
| Help/Excel/PDF | halaman V9 tanpa bantuan dan tanpa impor massal | V9-13B sesuai jadwal dokumen |
| Sample user | tidak ada akun uji per role | V9-13 |
