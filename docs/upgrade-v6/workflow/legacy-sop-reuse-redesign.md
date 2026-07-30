# Keputusan Reuse dan Redesign SOP Legacy → Workflow V6

> Fase V6-0. Untuk setiap konsep legacy ditetapkan satu keputusan:
> **REUSE** (pakai yang sudah ada di eBisnis), **REDESIGN** (bawa perilakunya,
> ubah strukturnya), atau **DROP** (tidak dibawa, dengan alasan).

## Ringkasan keputusan

| Konsep legacy | Keputusan | Target V6 |
| --- | --- | --- |
| `Sop` (master + versi) | REDESIGN | `WorkflowDefinition` + `WorkflowDefinitionVersion` |
| `JenisSop` | REDESIGN | atribut `category` pada definition, bukan tabel |
| `AktorSop` (11 boolean) | REDESIGN | `WorkflowActorRule` berbasis baris |
| `AlurSop` (60 kolom graph) | REDESIGN | `WorkflowStep` + `WorkflowTransition` |
| `PembatasanAlurSop` (string bebas) | REDESIGN | `WorkflowCondition` whitelist |
| `KelompokParameterTambahan*` | REDESIGN | `WorkflowFormSchema` + `WorkflowFormField` |
| `DokumenAlurSop` | REDESIGN | `WorkflowDocumentRequirement` |
| `DisposisiSop` | REDESIGN | `WorkflowInstance` dengan kolom `status` eksplisit |
| `DisposisiAlurSop` | REDESIGN | `WorkflowTask` + `WorkflowInstanceVariable` |
| `KomentarDisposisi` | REDESIGN | `WorkflowComment` |
| `DasboardSop` | REDESIGN | task inbox + timeline API |
| `SopKodeUtil` | **REUSE** | `number_sequence` tenant yang sudah ada |
| Audit `oleh`/`olehId` | **REUSE** | audit append-only `<tenant>__audit` yang sudah ada |
| Lampiran | **REUSE** | `file_object` + `entity_attachment` yang sudah ada |
| Notifikasi | **REUSE** | `notification` + `notification_template` yang sudah ada |
| Approval baseline | **REUSE** | `workflow_definition`/`workflow_step`/`workflow_instance`/`workflow_action_log` yang **sudah ada** pada V5 (migration `V007`) |
| ZKoss | DROP | UI framework berbeda |
| Hibernate 3 | DROP | Prisma + `pg` |
| Domain akademik | DROP | dipetakan ke `legal_entity`/`outlet`/`department`/`employee` |
| `Thread` inline | DROP | outbox/queue replay-safe |

## Yang SUDAH ADA di V5 dan wajib diperluas, bukan diduplikasi

Migration `V007__workflow_reporting.sql` sudah membuat tabel berikut pada setiap
schema tenant:

```text
workflow_definition
workflow_step
workflow_instance
workflow_action_log
```

Konsekuensi untuk V6-4: **tidak boleh** membuat tabel `workflow_definition_v6`
atau sejenisnya. Rencananya adalah `ALTER TABLE ... ADD COLUMN` yang nullable
plus tabel baru untuk konsep yang benar-benar belum ada
(`workflow_transition`, `workflow_task`, `workflow_actor_rule`,
`workflow_form_schema`, `workflow_policy_assignment`, `workflow_sla_event`,
`workflow_business_command`, `workflow_entity_link`).

Struktur existing sudah diverifikasi terhadap database (schema `demo`), bukan
diasumsikan:

```text
demo.workflow_definition
  id, code, name, description, module_code, entity_type, definition_version,
  status, is_active, is_system, is_sample, sample_batch_id, sort_order,
  metadata, created_at, created_by, updated_at, updated_by,
  deactivated_at, deactivated_by, deleted_at, deleted_by, delete_reason, version

demo.workflow_step
  id, workflow_id, code, name_key, sequence, step_type,
  assignee_rule, sla_hours, created_at, updated_at, version
```

Implikasi konkret untuk migration V6-4:

| Kebutuhan V6 | Kolom existing | Tindakan |
| --- | --- | --- |
| Versi definisi immutable | `definition_version` (integer, pada tabel definition) | tabel baru `workflow_definition_version`; kolom lama tetap sebagai versi aktif |
| SLA bersatuan | `sla_hours` (integer, jam saja) | `ADD COLUMN sla_duration`, `sla_unit`; `sla_hours` di-backfill dan dipertahankan sampai fase CONTRACT |
| Aturan aktor | `assignee_rule` (satu kolom) | tabel baru `workflow_actor_rule`; `assignee_rule` di-backfill menjadi satu baris |
| Transisi | **tidak ada** | tabel baru `workflow_transition` |
| Flag step (22 perilaku legacy) | **tidak ada** | `ADD COLUMN` nullable pada `workflow_step` |
| `entity_type` | sudah ada pada definition | REUSE |

Tidak ada kolom existing yang perlu dihapus atau diubah tipenya pada fase EXPAND.

## Pemetaan struktur graph

### Legacy

```text
AlurSop
  sebelumnya          FK
  setelahnya          FK   opsiSetelahnya    persetujuanAdaDiSini
  setelahnya2         FK   opsiSetelahnya2   persetujuanAdaDiSini1
  ...                      ...               ...
  setelahnya20        FK   opsiSetelahnya20  persetujuanAdaDiSini20
```

60 kolom, batas keras 20 cabang, tidak dapat di-query balik.

### V6

```text
workflow_step
  id, workflow_definition_version_id, code, name, step_type, sequence,
  sla_duration, sla_unit, is_start, is_end,
  form_schema_id, allow_note, require_note, require_attachment,
  freeze_form_after, freeze_document_after,
  auto_advance, next_optional, next_is_choice,
  return_to_requester, return_to_previous_actor,
  complete_on_approve, menu_code

workflow_transition
  id, from_step_id, to_step_id, sequence, label, label_key,
  transition_type (DEFAULT|CHOICE|CONDITIONAL|APPROVE|REJECT|RETURN),
  condition_group_id, is_approval_point, is_rejection_point
```

Tidak ada batas jumlah cabang; "step apa saja yang menuju X" menjadi satu query
`WHERE to_step_id = X`.

## Pemetaan flag `AlurSop` ke kolom V6

| Flag legacy | Kolom V6 | Dipertahankan |
| --- | --- | --- |
| `nomor` | `workflow_step.sequence` | ya |
| `start` | `workflow_step.is_start` | ya |
| `jangkaWaktu` | `workflow_step.sla_duration` + `sla_unit` | ya, satuan dieksplisitkan |
| `aktor` / `aktorSop` / `khususUsername` | baris `workflow_actor_rule` | ya |
| `alurSetelahnyaOtomatis` | `auto_advance` | ya |
| `alurSetelahnyaTidakWajib` | `next_optional` | ya |
| `alurSetelahnyaBerupaPilihan` | `next_is_choice` | ya |
| `persetujuanAdaDiSini*` | `workflow_transition.is_approval_point` | ya, per transisi |
| `penolakanAdaDiSini` | `workflow_transition.is_rejection_point` | ya |
| `kembaliKePengaju` | `return_to_requester` | ya |
| `kembaliKeAktorSebelumnya` | `return_to_previous_actor` | ya |
| `bolehDiisiCatatan` | `allow_note` | ya |
| `catatanWajibDiisi` | `require_note` | ya |
| `lampiranCatatanWajibDiisi` | `require_attachment` | ya |
| `bekukanFormTampilan` | `freeze_form_after` | ya |
| `bekukanDokumen` | `freeze_document_after` | ya |
| `tanggalDisposisiBolehDiubah` | `allow_backdate` | ya |
| `jikaProsesDisetujuiMakaSelesai` | `complete_on_approve` | ya |
| `formInputan` / `labelFormInputan` | `form_schema_id` → `workflow_form_field` | ya, jadi bertipe |
| `halamanMenu` | `menu_code` | ya |
| `opsi` | `workflow_transition.label` | ya |
| `kodeUnik` | `workflow_step.code` | ya |

Seluruh 22 perilaku step legacy terpetakan. Tidak ada yang hilang.

## Yang WAJIB ditambahkan V6 (tidak ada pada legacy)

Sesuai BRD V6 bab 26 dan Master Prompt Lampiran V6-D:

| Kebutuhan | Alasan tidak bisa diturunkan dari legacy |
| --- | --- |
| `PARALLEL_SPLIT` / `PARALLEL_JOIN` / quorum | legacy hanya sekuensial dengan pilihan cabang |
| `TIMER` / `WAIT_EVENT` | legacy tidak punya step berbasis waktu/event |
| `BUSINESS_COMMAND` | legacy tidak menulis ke tabel domain ERP |
| `DELEGATE` / `CLAIM` / `RELEASE` | legacy tidak punya konsep klaim task |
| `ESCALATE` otomatis | legacy hanya menyimpan `waktuMaksimal`, tanpa aksi |
| Business calendar + hari libur | legacy memakai tanggal kalender biasa |
| `WorkflowPolicyAssignment` (direct vs workflow) | legacy tidak punya jalur direct |
| `WorkflowEntityLink` | legacy tidak terhubung ke entitas ERP |
| Idempotency terminal command | legacy tidak punya terminal command |
| Instance memakai versi definisi terkunci | legacy instance ikut berubah saat definisi diedit |

## Pola non-negotiable: direct dan workflow menulis tabel yang sama

Ini syarat paling ketat pada BRD V6 (WF-004, WF-005) dan acceptance criteria 9.8.

```text
UI Direct                     Workflow terminal
  |                             |
  v                             v
PurchaseRequisitionDto  <-- sama -->  PurchaseRequisitionDto
  |                             |
  v                             v
PurchaseRequisitionValidator  <-- sama -->
  |                             |
  v                             v
PurchaseRequisitionApplicationService.create(...)  <-- SATU service
  |
  v
purchase_requisition + purchase_requisition_line   <-- SATU tabel
```

Perbedaan hanya pada metadata asal:

```text
sourceMode                   DIRECT | WORKFLOW | IMPORT | API | SYSTEM
workflowInstanceId           nullable
workflowDefinitionVersionId  nullable
submissionId                 nullable
```

Keputusan: metadata di atas disimpan pada **`workflow_entity_link`** (tabel generik),
bukan sebagai empat kolom pada setiap tabel dokumen. Alasannya, Master Prompt V6
D.1 secara eksplisit meminta demikian, dan menambah empat kolom ke puluhan tabel
dokumen akan menjadi perubahan besar yang sulit dibalik. Satu pengecualian:
`sourceMode` tetap disimpan sebagai kolom pada tabel dokumen, karena hampir setiap
query daftar dokumen perlu menampilkannya tanpa join.

## Catatan penting: `purchase_requisition` BELUM ADA

Audit database menunjukkan schema tenant memiliki `request_order` dan
`purchase_order`, tetapi **tidak** memiliki `purchase_requisition`. Bukti:
`docs/database/full-data-dictionary.md`, daftar tabel schema `demo`.

Konsekuensi: fase V6-4 harus membuat tabel `purchase_requisition` dan
`purchase_requisition_line` terlebih dahulu, lalu membangun kedua jalur (direct
dan workflow) di atasnya. Ini bukan mengganti `request_order` — keduanya berbeda:

| Konsep | Ada di V5 | Peran |
| --- | --- | --- |
| `request_order` | ya | permintaan stok dari toko/gudang ke gudang parent (internal) |
| `purchase_requisition` | **tidak** | permintaan pengadaan yang butuh persetujuan sebelum jadi PO |

Keduanya hidup bersama; PR adalah objek acceptance V6 untuk membuktikan pola
direct-vs-workflow.
