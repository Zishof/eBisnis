# 01 — Matriks Gap Versi 10

Status dinilai dari basis data dan source aktual. Bukti setiap baris ada pada
[00-current-state.md](00-current-state.md).

Kode status: `DONE`, `PARTIAL`, `MISSING`, `BROKEN`, `CONFLICTING`, `BLOCKED`,
`NOT_APPLICABLE`.

## V10-1 Fondasi telemetri

| # | Requirement | Status | Bukti | Tindakan |
| --- | --- | --- | --- | --- |
| O1 | Schema `platform_observability` | MISSING | 0 schema cocok | migration baru |
| O2 | `TelemetryContext` propagasi | PARTIAL | `requestId` ada pada `RequestMeta`; `traceId`/`spanId` belum | perluas yang ada |
| O3 | Sanitizer atribut | PARTIAL | `maskPayload` ada pada `esmartlink.client` | angkat menjadi layanan bersama |
| O4 | Retensi dan partisi | MISSING | tidak ada kebijakan | migration + penjadwal |
| O5 | Akses hanya Super Admin | PARTIAL | `PlatformPermissions` ada; permission observability belum | seed permission baru |

**Catatan reuse:** `maskPayload` sudah menyamarkan muatan pembayaran. Mengangkatnya
menjadi sanitizer bersama lebih benar daripada membuat sanitizer kedua — dua
sanitizer akan berbeda daftar medannya, dan yang satu akan lupa menyamarkan apa
yang disamarkan yang lain.

## V10-2 ErrorLog

| # | Requirement | Status | Bukti | Tindakan |
| --- | --- | --- | --- | --- |
| O6 | `platform_observability.error_log` | MISSING | — | migration |
| O7 | `ErrorGroup` + fingerprint | MISSING | — | layanan baru |
| O8 | Tampilan error unik bawaan | MISSING | — | UI baru |
| O9 | Occurrence tetap tersimpan | MISSING | — | migration |
| O10 | Global exception filter | **DONE** | `AppError` + filter global sudah menangkap | sambungkan ke penyimpanan |
| O11 | Ekspor konteks AI | MISSING | — | menunggu V11-1 |
| O12 | Status dan penugasan | MISSING | — | migration |

**O10 penting:** penangkap galat sudah ada dan sudah mengembalikan respons aman.
Yang belum ada hanya penyimpanannya. Membuat filter kedua akan menghasilkan dua
jalur penanganan galat yang berbeda perilakunya.

## V10-3 PerformanceLog

| # | Requirement | Status | Tindakan |
| --- | --- | --- | --- |
| O13 | Metrik runtime (heap, RSS, GC, event loop) | MISSING | pengumpul baru |
| O14 | Agregat rute dan modul | MISSING | migration + pengumpul |
| O15 | Agregat kueri PostgreSQL | MISSING | butuh `pg_stat_statements`; belum diperiksa aktif |
| O16 | Alur bukti kebocoran memori | MISSING | layanan baru |
| O17 | Pengaman heap snapshot | MISSING | menuntut step-up yang sudah ada |

**Risiko O15:** `pg_stat_statements` belum diperiksa apakah aktif pada server
produksi (PostgreSQL 13.12). Perlu dipastikan sebelum dijanjikan.

## V10-4 LoginLog dan role aktif

| # | Requirement | Status | Bukti | Tindakan |
| --- | --- | --- | --- | --- |
| O18 | `LoginLog` | MISSING | 0 tabel | migration |
| O19 | `LoginAttemptLog` | MISSING | — | migration |
| O20 | Siklus sesi | PARTIAL | refresh token + rotasi ada | perluas pencatatan |
| O21 | Pemilihan role aktif saat login | MISSING | login sekarang tidak menanyakannya | ubah alur auth |
| O22 | `activeRoleId` pada sesi | MISSING | JWT memuat role, bukan role aktif | ubah token |
| O23 | Audit perpindahan role | MISSING | — | migration |

**O21 dan O22 mengubah alur masuk yang sudah berjalan.** Ini satu-satunya bagian
V10 yang menyentuh jalur kritis yang sudah dipakai; perlu dikerjakan dengan
kompatibilitas mundur agar sesi yang sedang berjalan tidak putus.

## V10-5 MenuLog, ActionLog, FunctionLog

| # | Requirement | Status | Bukti | Tindakan |
| --- | --- | --- | --- | --- |
| O24 | `MenuLog` | MISSING | — | migration |
| O25 | `UiActionLog` | MISSING | — | migration + instrumentasi web |
| O26 | `FunctionLog` | MISSING | — | migration |
| O27 | Analitik audit tabel | PARTIAL | `audit_row_change` sudah merekam per baris | tambahkan proyeksi analitik |
| O28 | Mutasi bisnis tidak disampling | **DONE** | trigger audit merekam setiap baris | pertahankan |

**O27 dan O28 penting:** audit baris sudah lengkap dan tidak disampling. Yang
kurang hanya tampilan analitiknya, bukan pencatatannya.

## V10-6 Log operasional tambahan

| # | Requirement | Status | Bukti |
| --- | --- | --- | --- |
| O29 | `IntegrationLog` / `WebhookLog` | PARTIAL | `host_to_host_log` ada untuk pembayaran |
| O30 | `PaymentCallbackLog` | **DONE** | `payment_callback_event` |
| O31 | `NotificationDeliveryLog` | MISSING | — |
| O32 | `PermissionDeniedLog` | MISSING | guard menolak tetapi tidak mencatat |
| O33 | `MigrationExecutionLog` | **DONE** | `schema_migration` per tenant |
| O34 | `ConfigurationChangeLog` | PARTIAL | audit baris mencakup `app_setting` |

## V10-7 sampai V10-10 Tata kelola surat

Seluruhnya `MISSING` pada basis data; seluruh source legacy **tersedia**.

| # | Requirement | Status | Source legacy |
| --- | --- | --- | --- |
| S1 | Master klasifikasi surat | MISSING | `KlasifikasiSuratMasukAction`, `KlasifikasiSuratKeluarAction` |
| S2 | Sifat dan kerahasiaan | MISSING | `SifatSuratAction` |
| S3 | Loker surat | MISSING | `LokerSuratAction` |
| S4 | Masa berlaku | MISSING | `MasaBerlakuSuratAction` |
| S5 | Kop surat dan template | MISSING | `KopSuratAction` |
| S6 | Kelompok dan penomoran | MISSING | `KelompokNomorSuratAction`, `NomorSuratAction`, `SinkronNomorSuratHelper` |
| S7 | Opsi surat masuk/keluar | MISSING | `OpsiSuratMasukAction`, `OpsiSuratKeluarAction` |
| S8 | Surat keluar + persetujuan | MISSING | `AlurPersetujuanSuratKeluarAction` + `Status` + `Tree` |
| S9 | Surat masuk + disposisi | MISSING | `AlurPersetujuanSuratMasukAction` + `Status` + `Tree` |
| S10 | Arsip masuk/keluar | MISSING | `ArsipMasukAction`, `ArsipKeluarAction` |

**Reuse wajib:** workflow engine sudah ada (42 tabel). Alur persetujuan surat
harus memakainya, bukan membuat engine kedua. Legacy memakai pohon
parent-child; itu semantik yang perlu dipetakan, bukan disalin.

**`SinkronNomorSuratHelper` perlu dibaca lebih dulu** — penomoran surat yang
aman terhadap kejadian bersamaan adalah bagian yang paling mudah salah.

## V10-11, V10-12 Notification Hub

| # | Requirement | Status | Bukti | Tindakan |
| --- | --- | --- | --- | --- |
| N1 | Model notifikasi | **PARTIAL** | 28 tabel `notification` + `notification_template` | perluas, jangan ganti |
| N2 | Lonceng di header | MISSING | — | UI baru |
| N3 | Beda `READ` dan `ACTIONED` | MISSING | model sekarang belum membedakannya | migration additive |
| N4 | Deep link berizin | MISSING | — | layanan baru |
| N5 | Outbox transaksional | PARTIAL | `sync_outbox` ada dan terbukti dipakai V9-5 | pakai ulang polanya |
| N6 | Adapter Web Push | MISSING | — | butuh VAPID key |
| N7 | Adapter Email | MISSING | belum diperiksa apakah SMTP tersedia | perlu konfirmasi |
| N8 | Adapter WhatsApp | **BLOCKED** | tidak ada kontrak penyedia | buat kontrak adapter + test double, tandai BLOCKED |
| N9 | Adapter Mobile Push | **BLOCKED** | tidak ada kredensial FCM | sama seperti N8 |

**N8 dan N9 adalah kondisi berhenti yang sah** menurut perintah master:
"provider WhatsApp/mobile docs/credential dibutuhkan untuk live call". Yang
dapat dikerjakan adalah kontrak adapter, konfigurasi, dan test double —
bukan panggilan sungguhan.

## V10-13, V10-14 RBAC, Help, regresi

| # | Requirement | Status | Bukti |
| --- | --- | --- | --- |
| R1 | Seed menu V10 | MISSING | menu observability dan surat belum ada |
| R2 | Observability hanya Super Admin | MISSING | permission belum ada |
| R3 | Help pada halaman baru | PARTIAL | kerangka Help ada dari V8 |
| R4 | Excel/PDF | PARTIAL | belum diverifikasi pada fase ini |
| R5 | Regresi V5–V9 | DONE | 582 test lulus |

## Ringkasan

| Status | Jumlah |
| --- | ---: |
| DONE | 5 |
| PARTIAL | 12 |
| MISSING | 30 |
| BLOCKED | 2 |

Yang paling penting dari matriks ini bukan jumlahnya, melainkan **12 baris
PARTIAL**: itu daftar hal yang sudah ada dan harus diperluas, bukan dibangun
ulang. Membangun ulang salah satunya akan menghasilkan kapabilitas kedua yang
segera menyimpang dari yang pertama.
