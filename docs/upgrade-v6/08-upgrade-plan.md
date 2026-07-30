# 08 — Rencana Upgrade Additive V5 → V6

> Fase V6-0. Rencana ini **belum dieksekusi**. Tidak ada satu pun kode V6 yang
> ditulis pada fase ini, sesuai instruksi: "jangan implementasikan Referral
> sebelum audit V6-0 selesai".

## Prinsip yang mengikat seluruh fase

1. **Additive saja.** Tidak ada `DROP`, tidak ada perubahan tipe kolom, tidak ada
   rename pada fase EXPAND. Kolom baru selalu nullable atau berdefault.
2. **Migration lama immutable.** V001–V009 sudah diterapkan pada 10 schema.
   Migration V6 mulai dari **V010**.
3. **Feature flag.** Setiap capability V6 di balik flag; default `false` sampai
   migration dan test fase itu lulus.
4. **Satu fase satu vertical slice.** Model → migration → seed → service → API →
   OpenAPI → Orval → UI → permission → i18n → audit → test → regression V5.
5. **Regression V5 di antara fase.** 263 test baseline dijalankan sebelum dan
   sesudah setiap fase.
6. **Reuse sebelum membuat.** Daftar fondasi yang wajib dipakai ulang ada pada
   `02-v5-to-v6-gap-matrix.md` kolom "Fondasi existing".

## Pola expand-and-contract

```text
EXPAND     tambah tabel/kolom/index nullable
           deploy kode yang bisa membaca struktur lama DAN baru
BACKFILL   batch, resumable, checkpoint, catat baris ambigu
VERIFY     query verifikasi; hitung selisih; nol selisih baru lanjut
ENABLE     aktifkan feature flag pada development
ENFORCE    tambahkan constraint NOT NULL/UNIQUE setelah data bersih
CONTRACT   hapus kolom/tabel lama — RILIS TERPISAH, bukan fase yang sama
```

## Feature flag yang disiapkan

| Flag | Fase | Default dev | Default prod |
| --- | --- | --- | --- |
| `V6_REFERRAL_ENABLED` | V6-1 | true setelah gate lulus | false |
| `V6_MULTI_INVESTOR_ENABLED` | V6-2 | idem | false |
| `V6_TENANT_WEBSITE_ENABLED` | V6-3 | idem | false |
| `V6_CUSTOM_DOMAIN_ENABLED` | V6-3 | idem | false |
| `V6_WORKFLOW_ENGINE_ENABLED` | V6-4 | idem | false |
| `V6_WORKFLOW_PR_ENABLED` | V6-4 | idem | false |
| `V6_ACCOUNTING_EVENT_ENGINE_ENABLED` | V6-5 | idem | false |
| `V6_ADVANCED_FINANCE_ENABLED` | V6-6 | idem | false |

Aturan: flag hanya menentukan apakah modul aktif. Flag **tidak pernah** melewati
permission, tenant isolation, atau audit. Test wajib: flag aktif + pengguna tanpa
permission → tetap 403.

---

## Fase V6-0.x — Perbaikan prasyarat (sebelum V6-1)

Empat hal berikut adalah pelanggaran regression contract V5 atau prasyarat
teknis. Dikerjakan lebih dahulu karena V6 akan memperbesar dampaknya.

| # | Pekerjaan | Alasan mendahului V6-1 | Test penutup |
| --- | --- | --- | --- |
| 0.x-1 | Guard permission dinamis untuk master CRUD (temuan V6-0-F03) | referral/investor akan menambah master baru di atas engine yang sama | user tanpa permission gagal pada 9 endpoint master |
| 0.x-2 | Rekonsiliasi versi schema dari history (temuan V6-0-F01) | orkestrator migration V6 akan salah pada 2 schema | rekonsiliasi mengembalikan V008 untuk kedua schema |
| 0.x-3 | Ekspor OpenAPI ke berkas + generate Orval client | V6 menambah ±38 endpoint; kontrak perlu terikat tipe | `pnpm build` web lulus memakai client generated |
| 0.x-4 | Higiene SVN: `svn:ignore`, keluarkan `.env` dan `node_modules`, commit V5 | seluruh commit V6 bergantung pada repository yang sehat | `svn status` bersih kecuali perubahan fase |

Butir 0.x-4 memerlukan **keputusan pemilik** karena menyangkut rotasi kredensial
dan penghapusan berkas dari repository. Detail pada
[09-svn-change-plan.md](09-svn-change-plan.md).

---

## Fase V6-1 — Referral vertical slice

**Tujuan yang dapat dibuktikan:** link referral → pendaftaran → subscription
dibayar → ledger komisi 20% → statement.

### Migration

| Jenis | Isi | Catatan |
| --- | --- | --- |
| Platform (Prisma) | 23 model baru | referral hidup di control plane karena lintas tenant |
| Platform (Prisma) | `ALTER registration ADD COLUMN referral_code`, `referral_link_token`, `campaign_code`, `attribution_metadata` — semuanya nullable | tidak mengubah alur pendaftaran existing |
| Tenant | **tidak ada** | tidak ada data referral pada schema tenant |

### Model (23)

```text
ReferralPartner              ReferralCommissionPlan        ReferralPayoutMethod
ReferralPartnerProfile      ReferralCommissionPlanVersion  ReferralPayout
ReferralCode                ReferralCommissionRule         ReferralPayoutLine
ReferralLink                ReferralEligibilityRule        ReferralTaxDocument
ReferralCampaign            ReferralCommissionRun          ReferralStatement
ReferralTouch               ReferralCommissionRunItem      ReferralFraudCase
ReferralAttribution         ReferralCommissionLedger       ReferralDispute
ReferralAttributionEvidence ReferralCommissionAdjustment
```

Kunci integritas yang wajib:

| Aturan | Implementasi |
| --- | --- |
| Satu tenant referred hanya punya satu attribution | `ReferralAttribution.referredTenantId` UNIQUE |
| Ledger tidak dapat diubah | trigger `forbid_ledger_mutation` pada `referral_commission_ledger` |
| Tidak ada komisi ganda | `uniqueCalculationKey` UNIQUE (period + sourcePaymentId + partnerId + planVersionId) |
| Uang memakai Decimal | `Decimal(19,4)`; rate `Decimal(19,6)` agar 20.000000% presisi |
| Rate effective-dated | `ReferralCommissionPlanVersion.effectiveFrom/Until` |

### Reuse yang wajib

`Tenant`, `PlatformUser`, `Registration`, `Subscription`, `BillingInvoice`,
`PaymentOrder`, `PaymentCallbackEvent`, `BillingPaymentAllocation`,
`BillingCreditNote`, `AuditService`, `idempotency_record`, pola
`calculation_trace` dari `pricing_quote`.

### Basis komisi

```text
basis = collected eligible net subscription revenue
      - tax
      - provider fee
      - refund
      - chargeback
      - credit note
```

Diambil dari `billing_invoice.taxTotal`, `adminFeeTotal`,
`billing_payment_allocation`, dan `billing_credit_note` — semuanya sudah ada.
Basis dapat dikonfigurasi (gross / net-before-tax / collected cash / recognized /
first invoice / recurring / line tertentu).

### Attribution resolver

```text
kode eksplisit  ->  link/campaign valid  ->  eligibility  ->  cek self-referral
                ->  sinyal fraud         ->  kunci attribution
```

Larangan: `tenantId`/`referrerId` **tidak pernah** diambil dari client.

### API (12 endpoint)

Daftar lengkap pada `04-api-route-inventory.md` bagian "Route yang BELUM ada".

### UI

Tenant: Dashboard, Link/Kode, Pendaftar, Komisi, Statement, Pembayaran, Sengketa.
Platform: Partner, Commission Plan, Monthly Run, Payout, Fraud Review, Reconciliation.

Wajib memakai `DataGrid`, `PageHeader`, `StatusBadge`, `ConfirmDialog`,
`StepUpDialog` yang sudah ada.

### Test (minimum 12)

default 20%; override effective period; pembayaran duplikat; refund sebelum
payout; refund sesudah payout; self-referral; circular referral; fraud hold;
monthly run diulang; ledger immutable; isolasi lintas tenant; rekonsiliasi
akuntansi.

### Quality gate V6-1

```text
link -> registration -> paid subscription -> commission ledger -> statement
```

lulus end-to-end, ditambah 263 test baseline V5 tetap hijau.

---

## Fase V6-2 — Multi-investor dan ownership

**Fondasi existing:** `party`, `owner_profile`, `investor_profile`,
`ownership_interest`, `investment_contract`, `revenue_share_contract`,
`revenue_share_settlement` **sudah ada** pada schema tenant. Ini `PARTIAL`,
bukan `MISSING` — dilarang membuat identitas investor kedua.

| Jenis | Isi |
| --- | --- |
| Migration tenant V010 | `ALTER ownership_interest` tambah `economic_share`, `voting_share`, `effective_from/until`, `ownership_class_id`; tabel baru `ownership_group`, `ownership_group_member`, `ownership_class`, `ownership_transfer`, `capital_commitment`, `capital_contribution`, `capital_withdrawal`, `capital_account_ledger`, `investor_voting_right`, `investor_beneficiary_account`, `investment_vehicle`, `investor_exit_request`, `investor_approval_vote`, `investor_document`, `investor_statement`, `revenue_share_scheme`, `revenue_share_tier` |
| Trigger | `forbid_ledger_mutation` pada `capital_account_ledger` |
| Seed demo | 5 investor, 1 ownership group, 1 brand, 3 outlet, 9 perangkat POS, kontribusi modal, persentase ekonomi ≠ voting, 1 settlement draft + 1 approved |

Presisi persentase `Decimal(19,8)`. Validasi: overlap periode ditolak, total per
target/periode sesuai policy, transfer tidak melebihi kepemilikan.

---

## Fase V6-3 — Tenant website dan custom domain

| Jenis | Isi |
| --- | --- |
| Migration platform | `TenantWebsiteRegistry`, `TenantWebsiteDomain`, `TenantDomainVerificationAttempt`, `TenantDomainCertificate`, `TenantDomainRoutingAudit` — mapping domain **wajib global** agar unik lintas tenant |
| Migration tenant V011 | 24 tabel `tenant_website*`, `tenant_cms_*`, `website_*` |

Host resolver:

```text
normalisasi Host (IDNA/punycode)
-> tolak host tidak valid
-> cari pada registry domain global
-> domain ACTIVE + VERIFIED?  tenant ACTIVE?
-> ambil tenantId + websiteId
-> ambil schema dari tenant_schema_registry   <-- bukan dari host
-> cache key = host + mappingVersion
-> layani konten tenant
```

Larangan yang wajib diuji: schema tidak pernah berasal dari Host; unknown host
tidak jatuh ke tenant mana pun; custom domain tidak menjadi username/schema;
`X-Forwarded-Host` hanya dipercaya dari trusted proxy.

Mode development: `tenant-slug.localhost`, mock DNS verifier, mock certificate
provider. Tidak boleh mengklaim TLS publik berhasil pada localhost.

---

## Fase V6-4 — Workflow/SOP + PR direct vs workflow

**Prasyarat khusus:** tabel `purchase_requisition` dan
`purchase_requisition_line` **belum ada** dan harus dibuat lebih dahulu.
`request_order` yang sudah ada berbeda peran (permintaan stok internal) dan
tidak boleh dipakai sebagai PR.

| Jenis | Isi |
| --- | --- |
| Migration tenant V012 | `ADD COLUMN` pada `workflow_definition` dan `workflow_step` (22 flag perilaku legacy, `sla_duration`+`sla_unit`); tabel baru `workflow_definition_version`, `workflow_transition`, `workflow_actor_rule`, `workflow_condition`, `workflow_policy_assignment`, `workflow_form_schema`, `workflow_form_field`, `workflow_document_requirement`, `workflow_instance_variable`, `workflow_submission`, `workflow_entity_link`, `workflow_task`, `workflow_task_candidate`, `workflow_comment`, `workflow_attachment`, `workflow_sla_event`, `workflow_timer`, `workflow_escalation`, `workflow_business_command`, `workflow_integration_call`, `workflow_error`; ditambah `purchase_requisition`, `purchase_requisition_line` |
| Backfill | `assignee_rule` → satu baris `workflow_actor_rule`; `sla_hours` → `sla_duration=sla_hours, sla_unit='HOUR'` |

Pemetaan 22 perilaku step legacy ke kolom V6 sudah selesai dan tercatat pada
`workflow/legacy-sop-reuse-redesign.md`. Tidak ada perilaku legacy yang hilang.

Pola non-negotiable:

```text
UI Direct ─┐
           ├─> PurchaseRequisitionDto -> Validator -> ApplicationService -> purchase_requisition
Workflow  ─┘                                                                purchase_requisition_line
```

Perbedaan hanya `sourceMode` (kolom pada tabel dokumen) dan
`workflow_entity_link` (tabel generik untuk instance/version/submission).

---

## Fase V6-5 — Fondasi enterprise accounting

**Audit dahulu, model kemudian.** Yang sudah ada: `chart_of_account`,
`account_type`, `journal_entry`, `journal_entry_line`, `fiscal_period`, plus
trigger `forbid_posted_journal_mutation`. Semua tanpa service.

Keputusan reuse/extend/replace wajib ditulis pada ADR-011 **sebelum** model baru
dibuat, agar tidak muncul dua general ledger paralel (risiko R-13).

| Jenis | Isi |
| --- | --- |
| Migration tenant V013 | `AccountingBook`, `Ledger`, `LedgerCurrency`, `AccountingCalendar`, `AccountingPeriod`, `AccountSegment`, `AccountCombination`, `AccountValidationRule`, `AccountingEventClass`, `AccountingEventType`, `AccountingRuleSet`, `AccountDerivationRule`, `JournalLineRule`, `SubledgerJournal`, `JournalBatch`, `JournalApproval` |
| Extend | `journal_entry`/`journal_entry_line` tambah `ledger_id`, `book_id`, `posting_key`, dimensi |

Kontrak posting universal (13 field) dan urutan engine:

```text
validasi event -> pilih versi rule efektif -> derive akun -> derive dimensi
-> buat jurnal balanced -> tautkan sumber -> tandai hasil posting
```

Controller domain **tidak pernah** membuat debit/kredit sendiri.

Posting pilot bertahap, satu sumber sekali: POS → purchase → inventory → payroll
→ subscription → referral → investor settlement. Reconciliation harus nol
selisih sebelum sumber berikutnya diaktifkan.

---

## Fase V6-6 — Advanced finance

Dikerjakan hanya setelah V6-5 stabil dan seluruh rekonsiliasi nol selisih.
Satu submodul satu vertical slice: recurring journal, allocation, accrual,
deferral, intercompany, elimination, consolidation, currency translation, lease,
revenue recognition, treasury, debt, cash forecast, credit & collection, ECL,
project accounting, report designer.

---

## Fase V6-7 — Modul ERP tambahan

Yang dikerjakan **sekarang** hanyalah reservasi: module code pada
`platform.module_catalog` (sudah ada, 20 modul), menu tree, permission,
entitlement, data dictionary, integration event, roadmap. Bukan UI.

Prioritas: P1 project/expense/field-service/e-commerce/GRC → P2 PLM/S&OP/
sourcing/MDM/franchise → P3 EHS/ESG/AI.

---

## Fase V6-8 — Hardening

Load/performance terhadap target p95 BRD bab 12.2, security review, DR drill,
observabilitas, UAT, dokumentasi, runbook support.

## Urutan eksekusi dan gerbang antar fase

```text
V6-0    audit  (SELESAI dengan dokumen ini)
V6-0.x  prasyarat: permission guard, rekonsiliasi registry, Orval, higiene SVN
V6-1    referral        gate: link->paid->ledger->statement
V6-2    multi-investor  gate: 5 investor/1 brand/3 outlet/9 POS + settlement
V6-3    website/domain  gate: domain terverifikasi menyajikan situs tenant terisolasi
V6-4    workflow + PR   gate: PR direct == PR workflow pada tabel yang sama
V6-5    accounting      gate: subledger->GL nol selisih, close pilot
V6-6    advanced finance
V6-7    modul tambahan
V6-8    hardening
```

Setiap gerbang mengharuskan: 263 test baseline V5 hijau + test fase itu hijau +
`svn diff` hanya menyentuh berkas fase itu.
