# 02 — Matriks Gap Versi 11

Status dinilai dari basis data, source aktual, dan pemeriksaan langsung
terhadap Ollama. Bukti ada pada [00-current-state.md](00-current-state.md).

## V11-1, V11-2 AI Gateway dan Ollama

| # | Requirement | Status | Bukti | Tindakan |
| --- | --- | --- | --- | --- |
| A1 | Ollama dapat dihubungi | **DONE** | `/api/version` menjawab `0.32.0` | — |
| A2 | Inventaris model | **DONE** | `/api/tags` menjawab 3 model | tampilkan pada UI admin |
| A3 | Model chat tersedia | **DONE** | tiga model `completion` | admin memilih |
| A4 | Model embedding tersedia | **BLOCKED** | **tidak satu pun menyatakan `embedding`** | lihat catatan di bawah |
| A5 | Tabel `ai_*` | MISSING | 0 tabel | migration |
| A6 | `AiGatewayModule` | MISSING | — | modul baru |
| A7 | `OllamaProviderAdapter` | MISSING | — | adapter baru |
| A8 | Health, degraded, circuit breaker | MISSING | — | layanan baru |
| A9 | Prompt template + versi | MISSING | — | migration |
| A10 | Structured output (Zod) | PARTIAL | Zod belum dipakai; `class-validator` yang dipakai | putuskan: tambah Zod atau pakai JSON Schema |
| A11 | Redaksi sebelum ke AI | PARTIAL | `maskPayload` ada untuk pembayaran | angkat menjadi layanan bersama |
| A12 | Kuota dan rate limit | PARTIAL | `ThrottlerModule` sudah terpasang | perluas per use case |
| A13 | Audit penggunaan AI | MISSING | — | migration |

### A4 adalah blocker yang tidak dapat dilewati dengan menebak

Ketiga model hanya menyatakan `completion` dan `tools`. Tanpa model embedding:

- V11-3 (RAG, knowledge base, pencarian semantik) **tidak dapat dibangun**
- V11-4 dan V11-5 tetap dapat dibangun — keduanya tidak menuntut embedding

Tiga jalan keluar, dan ketiganya menuntut keputusan Anda:

| Jalan | Konsekuensi |
| --- | --- |
| Tarik model embedding pada server Ollama | dilarang dilakukan otomatis oleh health check; harus dijalankan operator |
| Pakai penyedia embedding lain | menuntut kontrak dan kredensial baru |
| Tunda V11-3 | V11-4 dan V11-5 tetap berjalan tanpa RAG |

Perintah master melarang mengarang nama model, jadi tidak ada yang dapat
dikerjakan sebelum ini diputuskan.

### A10 perlu keputusan

Prompt V11 menyebut Zod. Repositori memakai `class-validator` di mana-mana.
Menambah Zod berarti dua pustaka validasi hidup berdampingan.

Alternatifnya memakai JSON Schema yang sudah dihasilkan Swagger untuk memvalidasi
keluaran AI. Itu memakai apa yang ada, tetapi kurang ringkas untuk skema keluaran
yang tidak berhubungan dengan endpoint.

## V11-3 RAG dan knowledge base

| # | Requirement | Status | Alasan |
| --- | --- | --- | --- |
| A14 | Tabel chunk dan embedding | **BLOCKED** | menunggu A4 |
| A15 | `pgvector` | **BELUM DIPERIKSA** | perlu dipastikan tersedia pada PostgreSQL 13.12 produksi |
| A16 | Penyaringan tenant sebelum similarity | BLOCKED | menunggu A14 |
| A17 | Sumber Help/SOP/Surat | BLOCKED | surat sendiri belum ada (V10-7) |

**A17 punya ketergantungan berantai:** RAG atas surat menuntut surat ada lebih
dahulu, dan surat adalah V10-7. Ini menegaskan urutan yang diperintahkan —
V10 sebelum V11.

## V11-4, V11-5 Copilot dan AI per modul

| # | Requirement | Status | Catatan |
| --- | --- | --- | --- |
| A18 | Tombol AI pada header | MISSING | tidak menuntut embedding |
| A19 | Konteks sadar rute | MISSING | data rute sudah ada pada registry menu |
| A20 | Kesimpulan dashboard | MISSING | tidak menuntut embedding |
| A21 | Analisis, anomali, rekomendasi | MISSING | tidak menuntut embedding |
| A22 | Draf surat | BLOCKED | menunggu V10-7 |
| A23 | Draf deskripsi produk | MISSING | dapat dikerjakan; listing sudah ada |
| A24 | Ringkasan error group | BLOCKED | menunggu V10-2 |

**Yang dapat dikerjakan tanpa blocker:** A18–A21 dan A23. Itu cukup untuk satu
irisan vertikal AI yang benar-benar berjalan.

## V11-6, V11-7 Sample Data Factory

| # | Requirement | Status | Bukti | Tindakan |
| --- | --- | --- | --- | --- |
| S1 | Penanda baris contoh | **DONE** | **812 kolom `is_sample`** lintas schema | pakai apa adanya |
| S2 | `sampleBatchId` | **PARTIAL** | kolom `sample_batch_id` ada berdampingan | verifikasi cakupannya |
| S3 | `SampleDatasetProfile` | MISSING | 0 tabel `sample_%` | migration |
| S4 | `SampleDataRegistry` terpusat | **PERLU DIPUTUSKAN** | penanda per baris sudah ada | lihat catatan |
| S5 | Generasi latar belakang | MISSING | — | worker baru |
| S6 | 500 produk pada profil standar | PARTIAL | 25 produk contoh sudah ada dari V9-5 | perluas |
| S7 | Verifikasi integritas | MISSING | — | layanan baru |
| S8 | Tombol hapus hanya bila ada | **PARTIAL** | sudah berlaku untuk produk contoh V9-5 | perluas polanya |
| S9 | Soft delete saja | PARTIAL | `SampleCatalogService` sudah menariknya dari publikasi | perluas |
| S10 | Terhalang bila data nyata bergantung | MISSING | — | layanan baru |

### S4 perlu diputuskan

Prompt V11 menyarankan `SampleDataRegistry` terpusat **bila** menambah kolom
pada semua tabel tidak layak. Audit menunjukkan kolomnya **sudah ada di 812
tempat**.

Registry terpusat di samping penanda per baris berarti dua sumber kebenaran
tentang "baris ini contoh atau bukan" — dan keduanya akan berbeda pendapat
begitu ada jalur penulisan yang lupa memperbarui salah satunya.

Saran: pakai penanda per baris sebagai kebenaran, dan registry hanya sebagai
indeks pencarian yang dibangun ulang dari penanda — bukan sebagai kebenaran
kedua.

## V11-8 sampai V11-12 Keuangan

Seluruhnya `MISSING` pada basis data; seluruh source legacy **tersedia**.

| # | Requirement | Status | Source legacy | Verdict kesetaraan |
| --- | --- | --- | --- | --- |
| F1 | Jenis uang muka | MISSING | `JenisUangMukaAction` | MISSING |
| F2 | Pengajuan uang muka | MISSING | `UangMukaAction` | MISSING |
| F3 | Persetujuan uang muka | MISSING | `PersetujuanUangMukaAction` | MISSING |
| F4 | Posting uang muka | MISSING | `PostingUangMukaAction` | NEEDS_ADAPTER |
| F5 | LPJ | MISSING | `PertangungjawabanAction` | MISSING |
| F6 | Persetujuan LPJ | MISSING | `PersetujuanPertangungjawabanAction` | MISSING |
| F7 | Pengembalian kelebihan | MISSING | `PertangungjawabanPengembalianAction` | MISSING |
| F8 | Pajak pada LPJ | MISSING | `PertangungjawabanPajakAction` | MISSING |
| F9 | Kas besar | MISSING | `KasBesarAction`, `JenisKasBesarAction` | MISSING |
| F10 | Pertanggungjawaban kas besar | MISSING | `PertangungjawabanKasBesarAction` | MISSING |
| F11 | Kas kecil | MISSING | `KasKecilAction`, `JenisKasKecilAction` | MISSING |
| F12 | Penggantian kas kecil | MISSING | `PenggantianKasKecilAction` | MISSING |
| F13 | Daftar pengajuan transfer (DPC) | MISSING | `DaftarPengajuanTransferAction` | MISSING |
| F14 | Standing instruction | MISSING | `StandingInstructionAction` | MISSING |
| F15 | Proses transfer SI | MISSING | `ProsesTransferStandingInstructionAction` | MISSING |
| F16 | Persetujuan proses transfer SI | MISSING | `PersetujuanProsesTransferStandingInstructionAction` | MISSING |

### Verdict kesetaraan terhadap kapabilitas yang ada

Prompt V11 memperkirakan sebagian besar `PARTIAL_EQUIVALENT`. Audit
menunjukkan lebih keras dari itu:

| Kapabilitas generik yang diklaim ada | Kenyataan |
| --- | --- |
| Cash and Bank | hanya `cash_drawer_movement` (laci kasir POS) |
| Treasury | tidak ada tabelnya |
| Petty Cash | tidak ada tabelnya |
| Expense Management | tidak ada tabelnya |
| Payroll Payment | tidak ada tabelnya |

Yang ada dan dapat dipakai ulang: **`journal_entry` dan `journal_entry_line`**,
serta `chart_of_account` dan `fiscal_period`. Itu berarti seluruh modul
keuangan V11 harus menghasilkan jurnal lewat tabel itu, bukan membuat buku besar
kedua — dan itulah satu-satunya larangan "jangan menduplikasi ledger" yang
benar-benar berlaku di sini.

`PostingUangMukaAction` dan kawan-kawannya ditandai `NEEDS_ADAPTER` karena
semantik postingnya harus diterjemahkan ke `journal_entry`, bukan disalin.

## Ringkasan

| Status | Jumlah |
| --- | ---: |
| DONE | 4 |
| PARTIAL | 8 |
| MISSING | 30 |
| BLOCKED | 5 |
| PERLU DIPUTUSKAN | 3 |

## Tiga keputusan yang menghalangi

1. **Model embedding** (A4) — tanpa ini V11-3 tidak dapat dikerjakan sama sekali.
2. **Zod atau JSON Schema** (A10) — menentukan bentuk seluruh validasi keluaran AI.
3. **Registry contoh terpusat atau tidak** (S4) — menentukan apakah ada dua
   sumber kebenaran tentang data contoh.

Ketiganya bukan hal yang dapat diputuskan dengan menebak, dan ketiganya
menentukan bentuk pekerjaan berikutnya.
