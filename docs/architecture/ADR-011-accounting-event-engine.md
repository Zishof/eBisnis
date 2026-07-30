# ADR-011 — Posting akuntansi melalui event dan rule, bukan debit/kredit di controller

- Status: Diterima (fase V6-0, sebelum implementasi V6-5)
- Tanggal: 2026-07-30

## Konteks

Versi 5 sudah memiliki fondasi akuntansi pada schema tenant: `chart_of_account`,
`account_type`, `journal_entry`, `journal_entry_line`, `fiscal_period`, ditambah
trigger `forbid_posted_journal_mutation` yang menolak perubahan jurnal berstatus
POSTED. Semuanya **tanpa service, API, maupun UI**.

Versi 6 mensyaratkan setiap modul operasional (POS, pembelian, persediaan,
payroll, langganan, referral, settlement investor, proyek) menghasilkan jurnal.
Cara termudah adalah setiap controller membuat baris debit/kredit sendiri. Cara itu
ditolak.

## Keputusan

### 1. Satu general ledger, diperluas — bukan dua yang paralel

`journal_entry` dan `journal_entry_line` yang sudah ada **dipakai ulang** dan
diperluas dengan `ledger_id`, `book_id`, `posting_key`, dan dimensi. Membuat
`JournalEntry` baru di samping yang lama akan menghasilkan dua buku besar yang
saldonya tidak dapat direkonsiliasi.

Trigger `forbid_posted_journal_mutation` yang sudah ada tetap berlaku dan menjadi
penegak utama immutability.

### 2. Modul operasional memancarkan event bertipe, bukan jurnal

```text
AccountingEvent
  sourceModule        POS | PURCHASING | INVENTORY | PAYROLL | SUBSCRIPTION
                      | REFERRAL | INVESTOR | PROJECT
  sourceEntityType    nama tabel sumber
  sourceEntityId      id baris sumber
  businessEventType   mis. GOODS_RECEIPT_VALIDATED
  eventDate           kapan terjadi
  accountingDate      periode akuntansi
  legalEntityId       entitas hukum
  ledgerContext       buku dan ledger yang dituju
  currency
  amounts             kumpulan jumlah bernama
  dimensions          outlet, gudang, produk, proyek, cost center
  postingKey          UNIK — mencegah posting ganda
  payloadVersion      versi skema payload
```

Controller domain **tidak pernah** menulis `journal_line` secara langsung untuk
event otomatis. Jurnal manual tetap ada sebagai jalur terpisah dengan approval.

### 3. Engine menurunkan jurnal dari rule berversi

```text
validasi event
  -> pilih AccountingRuleSet versi yang efektif pada accountingDate
  -> AccountDerivationRule  menurunkan akun
  -> JournalLineRule        menurunkan baris debit/kredit
  -> bentuk jurnal balanced
  -> tautkan ke sumber (dua arah)
  -> tandai hasil posting pada event
```

Rule bersifat effective-dated. Mengubah rule **tidak** mengubah jurnal historis —
sama seperti `SubscriptionPlanVersion` pada Versi 5.

### 4. `postingKey` unik adalah penegak idempotensi

Satu `postingKey` menghasilkan paling banyak satu jurnal. Callback pembayaran
ganda, run bulanan yang diulang, atau retry terminal command workflow tidak dapat
menghasilkan jurnal kedua. Penegakannya adalah UNIQUE constraint di database,
bukan pemeriksaan di kode aplikasi.

### 5. Penelusuran wajib dua arah

- dari dokumen sumber → jurnal yang dihasilkannya;
- dari baris jurnal → dokumen sumbernya.

Tanpa arah kedua, auditor tidak dapat menjawab "angka ini dari mana", dan itu
membuat laporan keuangan tidak dapat dipertanggungjawabkan.

### 6. Aktivasi bertahap, rekonsiliasi dahulu

Posting otomatis diaktifkan **satu sumber sekali**, dan sumber berikutnya hanya
diaktifkan setelah rekonsiliasi sumber sebelumnya nol selisih:

```text
POS -> pembelian -> persediaan -> payroll -> langganan -> referral -> investor
```

Mengaktifkan seluruh posting sekaligus akan menghasilkan ribuan jurnal yang
selisihnya tidak dapat dilacak ke penyebabnya.

## Rekonsiliasi yang wajib ada

AR→GL, AP→GL, persediaan→GL, aset tetap→GL, payroll→GL, bank→kas→GL, pajak→GL,
ledger komisi referral→utang→GL, settlement investor→utang→GL,
tagihan/pembayaran langganan→AR/kas→GL, intercompany provider→receiver→eliminasi,
subledger proyek→GL.

Masing-masing harus dapat melaporkan selisih, bukan hanya menyamakan angka
secara otomatis. Penyesuaian otomatis pada data keuangan menyembunyikan masalah.

## Yang ditolak

| Ditolak | Alasan |
| --- | --- |
| Controller membuat debit/kredit untuk event otomatis | aturan akuntansi tersebar dan tidak dapat diaudit |
| Menghapus atau mengubah jurnal POSTED | trigger database menolaknya; koreksi memakai reversal |
| Aturan regulasi di-hardcode ke controller | localization pack berversi per negara |
| Mengaktifkan seluruh posting sebelum rekonsiliasi lulus | selisih tidak dapat dilacak |
| Menyamakan selisih rekonsiliasi secara otomatis | menyembunyikan cacat, bukan menyelesaikannya |

## Catatan tentang klaim produk

BRD V6 bab 28 dan bab 37 menegaskan: cakupan fitur perangkat lunak akuntansi lain
dipakai sebagai **checklist benchmark**, bukan sebagai pernyataan kesetaraan atau
keunggulan. Klaim apa pun tentang keunggulan produk hanya boleh dibuat setelah
implementasi, benchmark, audit, dan UAT. Dokumen ini tidak membuat klaim tersebut.

## Rujukan

- BRD V6 bab 28 (11.1 … 11.17)
- Master Prompt V6 Lampiran V6-E
- [ADR-002 — Audit append-only](ADR-002-append-only-audit.md)
- [ADR-004 — Price waterfall](ADR-004-pricing-waterfall.md) — pola rule berversi
