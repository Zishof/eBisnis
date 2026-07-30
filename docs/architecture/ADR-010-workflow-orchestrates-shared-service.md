# ADR-010 — Workflow mengorkestrasi service yang sama, tidak menduplikasi tabel

- Status: Diterima (fase V6-0, sebelum implementasi V6-4)
- Tanggal: 2026-07-30

## Konteks

Versi 6 menghadirkan workflow/SOP generik: satu transaksi dapat dibuat **langsung**
dari menu modul, atau **melalui pengajuan** dengan rangkaian persetujuan. Contoh
kanonik adalah Purchase Requisition.

Cara termudah membangunnya adalah membuat tabel sendiri untuk data pengajuan
(`workflow_pr_draft`), lalu menyalinnya ke tabel PR setelah disetujui. Cara itu
ditolak.

## Keputusan

Workflow adalah **orkestrasi**, bukan modul ERP kedua.

```text
UI Direct ─────────┐
                   ├──> DTO yang sama
                   │    Validator yang sama
Workflow terminal ─┘    Application Service yang sama
                              │
                              v
                   Tabel domain yang SAMA
```

Untuk Purchase Requisition, kedua jalur memanggil:

```text
PurchaseRequisitionApplicationService
PurchaseRequisitionValidator
PurchaseRequisitionRepository
```

dan keduanya menulis ke `purchase_requisition` + `purchase_requisition_line`.

### Mengapa bukan tabel terpisah

Bila jalur workflow punya tabel sendiri, maka:

- aturan bisnis (batas anggaran, validasi pemasok, perhitungan pajak) harus
  ditulis dua kali dan akan menyimpang;
- laporan harus menggabungkan dua sumber;
- BRD V6 WF-004 dan WF-005 secara eksplisit melarangnya;
- acceptance criteria 9.8 mensyaratkan "perhitungan, constraint, dan posting
  behavior sama" — yang hanya dapat dijamin bila kodenya memang satu.

### Metadata asal

Perbedaan kedua jalur hanya metadata:

| Metadata | Disimpan di mana | Alasan |
| --- | --- | --- |
| `sourceMode` (`DIRECT`/`WORKFLOW`/`IMPORT`/`API`/`SYSTEM`) | **kolom pada tabel dokumen** | hampir setiap daftar dokumen perlu menampilkannya tanpa join |
| `workflowInstanceId`, `workflowDefinitionVersionId`, `submissionId` | **tabel `workflow_entity_link`** | menambah tiga kolom ke puluhan tabel dokumen adalah perubahan besar yang sulit dibalik; Master Prompt V6 D.1 meminta tabel link generik |

## Graph sebagai koleksi, bukan kolom bernomor

Source SOP legacy menyimpan graph sebagai 60 kolom sejajar: `setelahnya` …
`setelahnya20`, `opsiSetelahnya` … `opsiSetelahnya20`, `persetujuanAdaDiSini` …
`persetujuanAdaDiSini20` (terbukti pada `AlurSop.java:131-202`).

Versi 6 memakai satu tabel:

```text
workflow_transition
  from_step_id, to_step_id, sequence, label,
  transition_type (DEFAULT|CHOICE|CONDITIONAL|APPROVE|REJECT|RETURN),
  condition_group_id, is_approval_point, is_rejection_point
```

Manfaat yang konkret: tidak ada batas jumlah cabang (BRD 9.8), pertanyaan
"step apa saja yang menuju X" menjadi `WHERE to_step_id = X`, dan kondisi cabang
menjadi data terstruktur yang dapat dievaluasi mesin.

## Versi definisi mengikat instance

Pada legacy, mengedit `AlurSop` mengubah instance yang sedang berjalan, karena
instance menunjuk baris definisi yang sama. Versi 6 membalik ini: instance
menunjuk `workflow_definition_version_id`, dan versi yang sudah published bersifat
immutable. Publish menghasilkan versi baru; instance lama tetap memakai versi
lamanya (BRD 9.8).

## Terminal command harus idempotent

Aturan urutan yang tidak boleh dilanggar:

```text
1. jalankan business command (tulis tabel domain) di dalam transaksi
2. commit transaksi domain
3. BARU tandai workflow COMPLETE
```

Bila dibalik, kegagalan pada langkah 1 menghasilkan workflow yang "selesai" tanpa
dokumen. Bila command gagal, task/instance tetap `WAITING_RETRY`/`ERROR` dan dapat
dicoba ulang. Retry dengan idempotency key yang sama menghasilkan dokumen yang
sama, bukan dokumen kedua.

## Policy tanpa ekspresi bebas

Hasil evaluasi policy: `DIRECT_ALLOWED`, `WORKFLOW_REQUIRED`,
`DIRECT_WITH_POST_REVIEW`, `AUTO_APPROVE`, `DENY`.

Field kondisi memakai **whitelist** — `entityType`, `action`, `legalEntity`,
`outlet`, `department`, `role`, `amount`, kategori produk, risiko pemasok/pelanggan,
status anggaran, sumber, tanggal, dan metadata terstruktur. `eval`, konstruktor
`Function`, dan SQL bebas dilarang. Pola ini sudah terbukti pada
`DiscountEvaluatorService` Versi 5 dan dipakai ulang.

## `purchase_requisition` adalah tabel baru

Audit V6-0 memastikan schema tenant **tidak** memiliki `purchase_requisition`.
Yang ada adalah `request_order`, dan keduanya berbeda peran:

| Tabel | Peran |
| --- | --- |
| `request_order` (ada) | permintaan stok dari toko/gudang ke gudang parent, internal |
| `purchase_requisition` (baru) | permintaan pengadaan yang memerlukan persetujuan sebelum menjadi PO |

Keduanya hidup bersama. PR dipilih sebagai objek acceptance karena ia yang
membuktikan pola direct-vs-workflow.

## Rujukan

- BRD V6 bab 26 (WF-001 … WF-015)
- Master Prompt V6 Lampiran V6-D
- `docs/upgrade-v6/workflow/legacy-sop-reuse-redesign.md` — pemetaan 22 perilaku step legacy
- [ADR-004 — Price waterfall](ADR-004-pricing-waterfall.md) — pola whitelist kondisi
