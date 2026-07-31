# 00 — Keadaan Aktual Sebelum Versi 10 dan 11

Diambil dari basis data dan source yang benar-benar dibaca pada 31 Juli 2026,
bukan dari dokumen rencana.

## Cara audit ini dibuat

Setiap angka di bawah berasal dari kueri terhadap basis data pengembangan
(PostgreSQL 17.2, port 5433) atau dari pembacaan berkas. Tidak ada yang
disimpulkan dari nama modul maupun dari dokumen versi sebelumnya.

Alasannya: dokumen rencana V9 menyebut modul ekspedisi dan ticketing sebagai
tersedia, dan audit V9-0 menemukan keduanya tidak ada. Kesalahan yang sama
tidak boleh terulang untuk V10 dan V11.

## Ukuran sistem saat ini

| Hal | Jumlah |
| --- | ---: |
| Tabel schema `platform` | 168 |
| Tabel per schema tenant | 140 |
| Schema tenant terdaftar | 14 |
| Migration tenant | V001–V014 |
| Migration platform (Prisma) | 21 |
| Test lulus | 582 |
| Menu template | 124 |
| Role template global | 6 |
| Katalog role tenant | 169 |
| Resource action | 40 |

## Yang sudah ada dan dapat dipakai ulang

Bagian ini menentukan apa yang **tidak boleh dibangun dua kali**.

| Kapabilitas | Bukti | Status |
| --- | --- | --- |
| Workflow engine | 42 tabel `workflow_definition/step/instance` lintas schema | DONE |
| Audit framework | 15 tabel `audit_event` + trigger baris | DONE |
| Notification model | 28 tabel `notification` + `notification_template` | PARTIAL |
| Penanda data contoh | 812 kolom `is_sample` di seluruh schema | DONE |
| Registry menu/role/permission | 124 menu, 169 role, 40 action | DONE |
| Outbox | `sync_outbox` per tenant, dipakai katalog sejak V9-5 | DONE |
| Sanitasi credential | `SecretBoxService` AES-256-GCM + rotasi | DONE |
| Log akses credential | `payment_credential_access_log` | DONE |
| Log host-to-host | `host_to_host_log` | DONE |

**812 kolom `is_sample`** adalah temuan penting untuk V11-6: penanda data contoh
sudah ada di hampir seluruh tabel, sehingga `SampleDataRegistry` terpusat
mungkin tidak diperlukan sebagai satu-satunya mekanisme.

## Yang tidak ada sama sekali

Diperiksa dengan kueri, bukan dengan menebak.

| Kapabilitas | Kueri | Hasil |
| --- | --- | ---: |
| Schema `platform_observability` | `information_schema.schemata` | **0** |
| Tabel `error_log` / `performance_log` | pola `%error%`, `%_log` pada platform | 5, tidak satu pun observability |
| Tabel `login_log` / session analytics | pencarian pada seluruh schema Prisma | **0** |
| Tabel surat | pola `%letter%`, `%surat%`, `%correspond%` | **0** (yang cocok hanya `newsletter_subscriber` dan `payment_dead_letter`) |
| Tabel AI | pola `ai_%` | **0** |
| Tabel sample data factory | pola `sample_%` | **0** |
| Tabel kas besar / kas kecil / uang muka / SI | pola `%cash_advance%`, `%petty%`, `%big_cash%`, `%standing_instruction%` | **0** |
| Tabel ekspedisi / trip / GPS / POD | audit V9-9 terhadap 133 tabel tenant | **0** |

Lima tabel yang cocok pola log pada platform seluruhnya bukan observability:
`feature_catalog`, `host_to_host_log`, `module_catalog`,
`payment_credential_access_log`, `schema_migration_catalog`.

Satu-satunya tabel keuangan tenant yang menyerupai kas adalah
`cash_drawer_movement` — laci kasir POS, bukan kas besar maupun kas kecil.

## Source legacy tersedia

Berbeda dari asumsi audit V9, `C:\opt\AIS` **dapat diakses**.

| Direktori | Berkas |
| --- | ---: |
| `action/master/surat/` | 26 |
| `action/master/akunting/` | 30 kelas yang relevan V11 |

Seluruh kelas yang disebut blueprint V10 dan V11 benar-benar ada, termasuk
`UangMukaAction`, `PertangungjawabanAction`, `KasBesarAction`, `KasKecilAction`,
`PenggantianKasKecilAction`, `DaftarPengajuanTransferAction`,
`StandingInstructionAction`, dan `ProsesTransferStandingInstructionAction`.

Artinya tidak ada alasan mengarang semantik bisnis; rujukannya ada.

## Ollama dapat dihubungi

Diperiksa langsung, bukan diasumsikan.

```text
GET http://38.47.182.162:11434/api/version  ->  {"version":"0.32.0"}
GET http://38.47.182.162:11434/api/tags     ->  3 model
```

| Model | Ukuran | Konteks | Kemampuan |
| --- | ---: | ---: | --- |
| `qwen2.5:1.5b-instruct-q4_K_M` | 1,5 B | 32.768 | completion, tools |
| `qwen2.5:3b-instruct-q4_K_M` | 3,1 B | 32.768 | completion, tools |
| `ecampus-translator:latest` | 3,1 B | 32.768 | completion, tools |

### Tidak ada model embedding

**Ketiganya hanya `completion` dan `tools`.** Tidak satu pun menyatakan
kemampuan `embedding`.

Akibatnya bagi V11-3 (RAG dan knowledge base): pencarian semantik **tidak dapat
dibangun** dengan inventaris model saat ini. Menarik model embedding secara
otomatis dilarang oleh perintah master ("health check tidak boleh menarik model
otomatis"), dan mengarang nama model juga dilarang.

Ini dicatat sebagai `BLOCKED`, bukan diselesaikan dengan menebak.

## Kesimpulan status

| Fase | Status | Alasan |
| --- | --- | --- |
| V10-1 sampai V10-6 (observability) | MISSING | tidak ada schema maupun tabelnya |
| V10-7 sampai V10-10 (surat) | MISSING | tidak ada tabelnya; source legacy tersedia |
| V10-11, V10-12 (notification) | PARTIAL | model dasar ada, hub dan adapter belum |
| V11-1, V11-2 (AI gateway) | MISSING | tidak ada tabelnya; Ollama dapat dihubungi |
| V11-3 (RAG) | **BLOCKED** | tidak ada model embedding pada inventaris |
| V11-6, V11-7 (sample data) | PARTIAL | penanda `is_sample` ada di 812 kolom; factory belum |
| V11-8 sampai V11-12 (keuangan) | MISSING | tidak ada tabelnya; source legacy tersedia |

Rincian per requirement ada pada [01](01-v10-gap-matrix.md) dan
[02](02-v11-gap-matrix.md).
