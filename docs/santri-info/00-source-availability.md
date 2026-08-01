# EP-0.1 — Ketersediaan Sumber

Mencatat **apa yang benar-benar tersedia** dan apa yang tidak. §2.6 melarang
mengaku sudah membaca dokumen yang tidak ada, dan melarang mengarang isinya.
Berkas ini adalah pelaksanaan larangan itu.

## Tersedia dan sudah dibaca

| Dokumen | Ukuran | Keterangan |
| --- | --- | --- |
| `PERINTAH_MASTER_..._SANTRI_INFO_EPESANTREN_MODERN_V2.md` | 4.682 baris | Perintah eksekusi utama. Dibaca sampai §15; sisanya dibaca sesuai kebutuhan fase. |
| `Presentasi_ePesantren_CV_Zishof.pdf` | 23 halaman | Seluruh halaman diekstrak dan dibaca. |
| `Presentasi_ePesantren_Kemitraan_BMT_CV_Zishof.pdf` | 28 halaman | Seluruh halaman diekstrak. Memuat isi berkas pertama ditambah Open API dan kemitraan BMT. |
| `PERINTAH_MASTER_..._PLATFORM_KOLABORATIF_MULTI_PORTAL_...md` | — | Dibaca sesi sebelumnya; hasilnya di `docs/ecosystem/`. |
| `RangkumanENterpiseEducationUntukBahanBrd.md` | 321 baris | Dibaca seluruhnya sesi sebelumnya. |
| `ebisnis.conf` | — | Konfigurasi Apache peladen. |

## TIDAK tersedia — belum pernah diberikan

Diminta §2.2-§2.6 tetapi tidak ada pada workspace maupun input. **Tidak satu pun
dibaca, dan tidak satu pun isinya diperkirakan.**

```text
MASTER_PROMPT_CODEX_CLAUDE_SANTRI_INFO_EPESANTREN_ESCHOOL.md
SPESIFIKASI_TERPISAH_V12_EMEDIK_...md
PROMPT_CODEX_CLAUDE_V7_GIT_ONLY_MIGRATION_...md
PROMPT_CODEX_CLAUDE_UPGRADE_INCREMENTAL_V5_PARTIAL_KE_V6.md
PROMPT_CODEX_CLAUDE_UPGRADE_INCREMENTAL_V5_V6_PARTIAL_KE_V7_...md
PROMPT_CODEX_CLAUDE_UPGRADE_INCREMENTAL_V7_KE_V8_R1_...md
PROMPT_CODEX_CLAUDE_UPGRADE_INCREMENTAL_V8_R1_KE_V9_...md
PROMPT_CODEX_CLAUDE_UPGRADE_INCREMENTAL_V9_KE_V10_...md
PROMPT_CODEX_CLAUDE_UPGRADE_INCREMENTAL_V10_KE_V11_...md
PERINTAH_CLAUDE_CODE_MENERAPKAN_EBISNIS_VERSI_8_REVISI_1_LENGKAP.md
PERINTAH_CLAUDE_CODE_MENERAPKAN_EBISNIS_VERSI_9_MARKETPLACE.md
PERINTAH_MASTER_..._EBISNIS_VERSI_9.md
PERINTAH_MASTER_..._EBISNIS_VERSI_10.md
PERINTAH_MASTER_..._GABUNGAN_EBISNIS_V10_DAN_V11.md
PERINTAH_PRIORITAS_..._POS_WEB_EBISNIS_SETELAH_V11.md
STRUKTUR_MENU_LENGKAP_EBISNIS_ID.md
STRUKTUR_MENU_LENGKAP_EBISNIS_ID_ENHANCED_V2.md
STRUKTUR_MENU_ROLE_PERMISSION_DEFAULT_EBISNIS_V8_R1.md
STRUKTUR_MENU_ROLE_PERMISSION_EBISNIS_V9_MARKETPLACE.md
STRUKTUR_MENU_ROLE_PERMISSION_EBISNIS_V11_AI_SAMPLE_FINANCE.md
BRD Enterprise Education versi terbaru
BRD eSchool versi terbaru
BRD eCampus versi terbaru
```

Pencarian di `docs/**` tidak menemukan satu pun di antaranya.

## Source legacy — tidak dapat dijangkau

§4.4 menunjuk `C:/opt/AIS/ais/src/main/**`. Pohon source Java/ZKoss-nya belum
pernah dibuka pada sesi ini. Satu berkas dari direktori induknya pernah dibaca
sesi sebelumnya (`SPESIFIKASI_FITUR_POS_DESKTOP_ANDROID.md`), dan darinya
diambil peta pintasan papan tik yang kini dipakai POS.

## Akibat bagi audit ini

Seluruh dokumen EP-0 disusun dari **source code, migrasi, dan basis data yang
benar-benar ada**. Di mana keputusan membutuhkan dokumen yang hilang, statusnya
`BLOCKED` beserta apa yang dibutuhkan untuk membukanya.
