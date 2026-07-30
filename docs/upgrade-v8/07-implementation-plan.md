# 07 — Rencana Implementasi Versi 8 Revisi 1

## Ukuran pekerjaan, dinyatakan terus terang

Audit V8-0 menemukan **nol** kapabilitas Versi 8 pada source. Yang diminta
mencakup:

| Area | Ukuran kasar |
| --- | ---: |
| Model Help Center | ~35 tabel |
| Model Excel dan impor | ~16 tabel |
| Model PDF | ~5 tabel |
| Model menu, role, duty, privilege, scope, SoD | ~10 tabel |
| Model Google login | 2 tabel |
| Menu | dari 73 menjadi ±520 node |
| Role default | dari 6 menjadi ±140 |
| Halaman diberi CrudActionGroup + help + Excel + PDF | 12 halaman pilot, lalu sisanya |
| Endpoint API baru | ±40 |

Ini bukan pekerjaan satu sesi. Rencana di bawah memecahnya menjadi vertical
slice yang masing-masing benar-benar berjalan dan dapat dipakai, bukan skeleton.
Setiap fase berakhir dengan commit, push, dan CI hijau.

## Prasyarat sebelum fase mana pun

Satu hal harus diselesaikan lebih dulu karena seluruh aturan tombol Versi 8
bergantung padanya.

**V6-0-F03 — endpoint CRUD master tidak memverifikasi permission.**
`PermissionGuard` keluar lebih awal bila handler tidak punya metadata
permission, dan 13 endpoint master tidak memilikinya
([bukti](../upgrade-v6/01-v5-regression-status.md)).

Selama ini belum diperbaiki, aturan "Upload hanya tampil bila UPDATE dan DELETE"
hanya berlaku di UI dan dapat dilewati dengan memanggil API langsung. Blueprint
sendiri menegaskan penyembunyian tombol bukan kontrol keamanan — maka kontrol
yang sesungguhnya harus ada lebih dulu.

Dikerjakan sebagai bagian **V8-4**, sebelum tombol Upload muncul di mana pun.

## Urutan fase

| Fase | Isi | Hasil yang dapat dipakai |
| --- | --- | --- |
| **V8-0** | audit, gap matrix, baseline | dokumen dan bukti |
| **V8-1** | Help backend: model, migration V010, seed, service, API | API help hidup, dapat dipanggil |
| **V8-2** | Help UI: drawer, tombol, admin, coverage | pengguna melihat bantuan di halaman |
| **V8-3** | diagram Mermaid dirender server, guided tour | bantuan bergambar dan berpandu |
| **V8-4** | guard permission dinamis + CrudActionGroup | tombol seragam dan benar-benar diamankan |
| **V8-5** | template Excel bertanda tangan dan ekspor | pengguna dapat mengunduh |
| **V8-6** | unggah aman, dry-run, pratinjau, error workbook | pengguna dapat mengunggah |
| **V8-7** | PDF print job | pengguna dapat mencetak |
| **V8-R1a** | MenuCatalog 33 root | menu lengkap, satu sumber kebenaran |
| **V8-R1b** | duty, privilege, data scope, SoD | otorisasi berlapis |
| **V8-R1c** | seed ±140 role Indonesia | role siap pakai |
| **V8-R1d** | sample user per role, kasir per brand-outlet | akun uji dengan kredensial aman |
| **V8-R1e** | Google login | masuk dengan Google |
| **V8-8** | pilot Penerimaan Barang lengkap | satu halaman memenuhi seluruh standar V8 |
| **V8-9** | migrasi 12 halaman berikutnya | standar menyebar |
| **V8-10** | coverage dan content QA | tidak ada menu tanpa bantuan |
| **V8-11** | regression penuh dan rilis | tag dan GitHub Release |

Urutan ini berbeda dari daftar pada perintah dalam satu hal: **V8-R1a sampai
V8-R1e ditempatkan setelah V8-7, bukan di akhir.** Alasannya, pilot Penerimaan
Barang (V8-8) menuntut role dan permission yang benar untuk membuktikan aturan
tombol dan data scope. Mengerjakannya setelah pilot berarti pilot harus diuji
dua kali.

## Prinsip yang berlaku di seluruh fase

**Additive.** Migration dimulai dari V010. V001–V009 sudah diterapkan pada 10
schema pengembangan dan 1 produksi; tidak boleh disentuh.

**PostgreSQL 13 sebagai batas bawah.** Produksi berjalan di 13.12. Fitur yang
hanya ada pada 14+ tidak boleh dipakai.

**Reuse sebelum membuat.** `file_object`, `background_job`, audit append-only,
i18n, kontrak lifecycle master, dan registry resource sudah ada dan wajib
dipakai.

**Feature flag.** Setiap kapabilitas di balik flag, default `false` di produksi
sampai terbukti:

```text
V8_HELP_CENTER_ENABLED       V8_EXCEL_EXPORT_ENABLED
V8_EXCEL_IMPORT_ENABLED      V8_PDF_PRINT_ENABLED
V8_MENU_CATALOG_V8_ENABLED   V8_DUTY_PRIVILEGE_ENABLED
V8_GOOGLE_LOGIN_ENABLED
```

Flag tidak pernah menggantikan permission.

**Regression setiap fase.** 83 unit test dan 124 asersi smoke dijalankan sebelum
dan sesudah. Kegagalan diklasifikasikan, tidak diberi label "tidak terkait".

## Ketergantungan baru

| Paket | Untuk | Catatan |
| --- | --- | --- |
| `exceljs` | Excel | multi-sheet, proteksi sheet, pembacaan streaming |
| `pdfkit` | PDF | tanpa browser headless |
| `mermaid` | diagram | dirender di server, SVG disanitasi |
| `google-auth-library` | Google login | verifikasi ID token dan JWKS |
| `dompurify` + `jsdom` | sanitasi SVG | wajib sebelum SVG apa pun disajikan |

Antrean **tidak** memakai Redis. Tabel `background_job` pada migration V007
dipakai sebagai antrean dengan worker yang mengambil pekerjaan lewat
`SELECT ... FOR UPDATE SKIP LOCKED`. Alasannya deployment: satu server yang juga
menjalankan aplikasi lain, dan menambah Redis berarti menambah komponen
operasional yang harus dijaga.

Keputusan ini ditulis sebagai ADR pada fasenya.

## Definisi selesai per halaman

Sebuah halaman dianggap memenuhi standar Versi 8 hanya bila seluruhnya ada:

```text
resource definition        CrudActionGroup
definisi Excel             definisi PDF
help topic                 diagram
page mapping               permission diverifikasi server
audit                      unit + integration + E2E
```

Delapan poin, tanpa pengecualian. Halaman yang baru punya sebagiannya dicatat
`CRUD_V8_PARTIAL`, bukan selesai.

## Yang akan dilaporkan setiap fase

```text
status sebelum dan sesudah      migration dan tabel
berkas dibuat dan diubah        API, OpenAPI, Orval
UI                              permission, i18n, seed, audit
test dan hasil sebenarnya       regresi
commit SHA, push, CI            cara menguji
risiko dan rollback             keterbatasan yang diketahui
```
