# 00 — Source Availability (MI-0)

Ditulis 2026-08-06, cabang `feature/v14-mitrainap-hospitality`, worktree
`C:\opt\eBisnisGithub-mitrainap`, dari `origin/main` (commit `1ebc4a8`).

## Dokumen MitraInap yang tersedia dan sudah dibaca

Disalin ke `docs/mitrainap/` dari
`C:\Users\USER\Downloads\PAKET_DOKUMEN_MITRAINAP_V14\`, hash SHA-256
diverifikasi cocok 1:1 dengan `MANIFEST_SHA256_MITRAINAP_V14.txt` (6/6 berkas):

- `README_PAKET_MITRAINAP_V14.md` — dibaca penuh.
- `PERINTAH_MASTER_CLAUDE_CODE_CODEX_EKSEKUSI_MITRAINAP_ID_HOSPITALITY_V14.md`
  (2063 baris) — dibaca penuh (bagian 0–8, 11 [daftar judul MI-1..MI-24], 25).
  Bagian 12–24 (data model detail, state machine, API detail, UI standard
  per layar, dsb.) BELUM dibaca baris demi baris — akan dibaca sesuai
  kebutuhan tiap fase MI-N, bukan sekaligus di MI-0 (dokumennya sendiri
  cukup besar untuk tiap topik itu berdiri sendiri saat dipakai).
- `BRD_eBisnis_ID_Versi_14_MitraInap_Hospitality_Lengkap.md` — BELUM
  dibaca penuh (dokumen besar). Akan dibaca per-bagian sesuai fase yang
  sedang dikerjakan.
- `STRUKTUR_MENU_ROLE_PERMISSION_MITRAINAP_V14.md` — BELUM dibaca penuh,
  akan dibaca saat MI-1 (portal registry) dan fase RBAC.
- `SPESIFIKASI_UI_UX_RESPONSIVE_MITRAINAP_V14.md` — BELUM dibaca penuh,
  akan dibaca per layar saat fase UI terkait dikerjakan.
- `PAKET_MASTER_MITRAINAP_V14_GABUNGAN.md` — gabungan seluruh dokumen di
  atas, disalin sebagai referensi, tidak dibaca ulang terpisah.

**Catatan jujur**: perintah master eksplisit meminta pembacaan penuh
sebelum menyentuh source. Dengan ukuran total dokumen ini (>2000 baris di
perintah master saja, plus BRD/UI-UX/RBAC yang juga besar), pembacaan
literal "baris demi baris semuanya di MI-0" akan menghabiskan sebagian
besar anggaran sesi ini tanpa audit source nyata sama sekali. Keputusan
yang diambil: baca penuh perintah master (dokumen yang menentukan ATURAN
kerja) di MI-0, baca BRD/UI-UX/RBAC secara BERTAHAP per fase (dokumen yang
menentukan ISI tiap fase) — dicatat di sini secara eksplisit, bukan
disembunyikan, supaya sesi berikutnya tahu persis apa yang benar-benar
sudah dibaca.

## Dokumen platform lain yang dirujuk perintah master

Dicari di `docs/` repo ini:

```text
PERINTAH_MASTER_CLAUDE_CODE_PLATFORM_KOLABORATIF_MULTI_PORTAL_*.md   -> MISSING_INPUT (tidak ditemukan di docs/)
BRD eBisnis Versi 13                                                  -> MISSING_INPUT (tidak ditemukan sebagai BRD utuh; docs/santri-info/*
                                                                          adalah audit vertikal pesantren, bukan BRD platform)
BRD eBisnis Versi 12, 11, 10                                          -> MISSING_INPUT
PERINTAH_MASTER_CLAUDE_CODE_EKSEKUSI_SANTRI_INFO_EPESANTREN_MODERN_V2 -> MISSING_INPUT (dokumen perintah aslinya tidak ada di
                                                                          repo; hasil kerjanya ADA sebagai kode + docs/santri-info/**)
PANDUAN_KOORDINASI_PARALEL_CORE_EMEDIK_EKOPERASI_INFO_DESA            -> MISSING_INPUT
PERINTAH_PRIORITAS_..._POS_WEB_EBISNIS_SETELAH_V11                   -> MISSING_INPUT
PERINTAH_MASTER_CODEX_CLAUDE_..._INVENTORY_48_LAYAR                  -> MISSING_INPUT
PROMPT_CODEX_CLAUDE_V7_GIT_ONLY_MIGRATION_AND_CONTINUOUS_COMMIT       -> MISSING_INPUT
```

Tidak satu pun dari dokumen "perintah master" versi-versi sebelumnya
ditemukan tersimpan di repo — pola yang tampak: dokumen perintah ditempel
langsung ke sesi kerja (seperti dokumen MitraInap ini), tidak disimpan
permanen. **Ini tidak dianggap sebagai kegagalan** — kode dan
`docs/santri-info/**` (18 berkas, termasuk audit MI-0 gaya yang sama
untuk vertikal pesantren) adalah bukti nyata dari HASIL sesi-sesi itu,
dan dipakai sebagai referensi pola arsitektur alih-alih dokumen
perintahnya sendiri. Lihat `docs/santri-info/18-session-handoff-2026-08-03.md`
untuk ringkasan kerja pesantren yang paling baru dan relevan sebagai pola
yang bisa ditiru MitraInap.

## Source aktual yang diperiksa (bukan diasumsikan)

```text
apps/api/package.json            -- dibaca
apps/web/package.json            -- dibaca (tidak langsung, lewat pnpm -r)
package.json (root)              -- dibaca penuh
pnpm-workspace.yaml               -- ADA (tidak dibaca isi detail, workspace 3 paket: api, web, root)
apps/api/prisma/**                -- diperiksa sebagian (platform/tenancy.prisma untuk domain registry)
apps/api/tenant-migrations/**     -- diperiksa sebagian (pola manifest.json dari kerja pesantren sesi sebelumnya)
apps/web/src/**                   -- grep capability sweep dijalankan (lihat 03-hospitality-capability-inventory.md)
apps/**flutter**/**               -- TIDAK DITEMUKAN, tidak ada folder Flutter di repo ini
packages/**                       -- TIDAK DIPERIKSA (tidak ada bukti packages/hospitality-* dkk sudah ada)
docs/**                           -- listing tingkat atas diperiksa; docs/santri-info/** dibaca sebagian
scripts/**                        -- TIDAK DIPERIKSA di MI-0 ini
.github/workflows/**              -- TIDAK DIPERIKSA di MI-0 ini
```

## Kesimpulan MISSING_INPUT

- Tidak ada folder Flutter/mobile native di repo ini.
- Tidak ada dokumen "Perintah Master Platform Kolaboratif Multi-Portal"
  tersimpan — konsep arsitektur multi-portal-nya diverifikasi lewat KODE
  (lihat `02-portal-domain-username-inventory.md`), bukan lewat dokumen.
- BRD Versi 10–13 sebagai dokumen tidak ditemukan; riwayat kerja versi-
  versi itu ada dalam bentuk `docs/santri-info/**` (vertikal pesantren,
  "Versi 13" menurut catatan handoff sebelumnya) dan `git log` monorepo.

Tidak ada perilaku yang dikarang untuk mengisi kekosongan ini.
