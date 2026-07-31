# 10 — Rencana Implementasi V10 dan V11

Disusun dari [matriks gap V10](01-v10-gap-matrix.md) dan
[matriks gap V11](02-v11-gap-matrix.md).

## Urutan yang tidak dapat ditukar

```text
V10-1 telemetri
  └─ V10-2 ErrorLog        (menuntut telemetri)
  └─ V10-3 PerformanceLog  (menuntut telemetri)
V10-4 LoginLog + role aktif  (berdiri sendiri, tetapi menyentuh alur masuk)
V10-7 master surat
  └─ V10-8 surat keluar    (menuntut master + workflow engine)
  └─ V10-9 surat masuk     (menuntut master + workflow engine)
V10-11 Notification Hub    (menuntut surat untuk sumber peristiwanya)

V11-1 AI gateway           (menuntut V10 selesai untuk konteksnya)
  └─ V11-4 Copilot
  └─ V11-5 AI per modul
V11-3 RAG                  (TERHALANG: tidak ada model embedding)
V11-6 Sample factory       (berdiri sendiri)
V11-8..12 keuangan         (berdiri sendiri; menuntut journal_entry yang sudah ada)
```

**Ketergantungan yang paling mudah terlewat:** RAG atas surat (V11-3 → A17)
menuntut surat ada lebih dahulu (V10-7). Ini yang membuat urutan "V10 sebelum
V11" bukan sekadar penomoran.

## Yang dapat dikerjakan paralel

Tiga jalur tidak saling bergantung dan dapat dikerjakan dalam urutan apa pun:

| Jalur | Fase | Tidak bergantung pada |
| --- | --- | --- |
| Observability | V10-1 sampai V10-6 | surat, AI, keuangan |
| Surat dan notifikasi | V10-7 sampai V10-12 | observability, AI |
| Keuangan | V11-8 sampai V11-12 | seluruhnya kecuali `journal_entry` |

Keuangan bahkan dapat dikerjakan **sebelum** observability bila itu yang lebih
mendesak secara bisnis. Urutan pada perintah master adalah urutan penomoran,
bukan urutan ketergantungan teknis — dan untuk keuangan, keduanya berbeda.

## Yang harus dipakai ulang, bukan dibangun ulang

Diambil dari 12 baris `PARTIAL` pada matriks V10 dan 8 pada V11.

| Jangan buat | Pakai yang ada |
| --- | --- |
| Engine workflow kedua | 42 tabel `workflow_definition/step/instance` |
| Framework audit kedua | trigger `audit_row_trigger` + `audit_event` |
| Sanitizer kedua | angkat `maskPayload` menjadi layanan bersama |
| Filter galat kedua | `AppError` + filter global yang sudah menangkap |
| Buku besar kedua | `journal_entry` + `journal_entry_line` |
| Outbox kedua | pola `sync_outbox` yang terbukti pada V9-5 |
| Penanda data contoh kedua | 812 kolom `is_sample` yang sudah ada |
| Rate limit kedua | `ThrottlerModule` yang sudah terpasang |

## Tiga keputusan yang menghalangi

Tidak dapat diputuskan dengan menebak, dan masing-masing menentukan bentuk
pekerjaan.

### 1. Model embedding (memblokir V11-3 sepenuhnya)

Inventaris Ollama tidak punya model embedding. Pilihan:

| Pilihan | Yang harus dilakukan |
| --- | --- |
| Tarik model embedding di server | operator menjalankannya; health check dilarang menariknya otomatis |
| Penyedia embedding lain | menuntut kontrak dan kredensial baru |
| Tunda V11-3 | V11-4, V11-5, dan sisanya tetap berjalan |

### 2. Zod atau JSON Schema untuk keluaran AI

Prompt menyebut Zod; repositori memakai `class-validator`. Menambah Zod berarti
dua pustaka validasi hidup berdampingan.

### 3. Registry data contoh terpusat atau tidak

Penanda `is_sample` sudah ada di 812 kolom. Registry terpusat di sampingnya
berarti dua sumber kebenaran tentang "baris ini contoh atau bukan".

Saran: penanda per baris sebagai kebenaran; registry hanya indeks yang dapat
dibangun ulang darinya.

## Dua hal yang perlu diperiksa sebelum dijanjikan

| Hal | Mengapa penting | Cara memeriksa |
| --- | --- | --- |
| `pg_stat_statements` aktif? | V10-3 O15 menuntutnya untuk agregat kueri | `SELECT * FROM pg_extension WHERE extname='pg_stat_statements'` pada produksi |
| `pgvector` tersedia? | V11-3 A15 menuntutnya bila RAG jadi dikerjakan | `SELECT * FROM pg_available_extensions WHERE name='vector'` |

Keduanya pada PostgreSQL 13.12 produksi, bukan pada 17.2 pengembangan.

## Kondisi berhenti yang sudah teridentifikasi

Menurut perintah master, berhenti hanya pada keadaan tertentu. Dua sudah
teridentifikasi sekarang:

| Blocker | Fase | Alasan sah |
| --- | --- | --- |
| Kredensial WhatsApp | V10-12 N8 | "provider WhatsApp/mobile docs/credential dibutuhkan" |
| Kredensial FCM | V10-12 N9 | sama |
| Model embedding | V11-3 | "jangan mengarang API provider/model" |

Untuk ketiganya, yang dapat dikerjakan adalah kontrak adapter, konfigurasi, dan
test double — bukan panggilan sungguhan. Itu bukan mock yang diklaim
production-ready; itu batas yang dinyatakan.

## Perkiraan besaran

Berdasarkan enam fase V9 yang selesai malam ini sebagai pembanding.

| Kelompok | Fase | Perkiraan tabel baru |
| --- | ---: | ---: |
| Observability V10-1..6 | 6 | ~25 |
| Surat V10-7..10 | 4 | ~20 |
| Notifikasi V10-11..12 | 2 | ~12 |
| AI V11-1..5 | 5 | ~25 |
| Sample factory V11-6..7 | 2 | ~8 |
| Keuangan V11-8..12 | 5 | ~40 |
| **Total** | **24** | **~130** |

Sebagai pembanding: seluruh sistem sekarang punya 168 tabel platform dan 140
tabel per tenant. V10 dan V11 bersama-sama menambah sekitar 45 persen dari
ukuran itu.
