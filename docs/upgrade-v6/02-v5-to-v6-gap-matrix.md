# 02 — Matriks Gap Versi 5 → Versi 6

> Fase V6-0. Status per requirement Versi 6 terhadap implementasi yang benar-benar
> ada. Sumber requirement: BRD V6 bab 22–37 dan Master Prompt V6 Lampiran V6-A
> sampai V6-H.

## Rekapitulasi

| Status | Jumlah |
| --- | --- |
| MISSING | 58 |
| PARTIAL | 11 |
| DONE | 0 |
| **Total requirement V6 yang dilacak** | **69** |

Nol `DONE` adalah hasil yang diharapkan: Versi 6 belum dimulai. Yang `PARTIAL`
adalah area yang sudah punya fondasi V5 sehingga **wajib diperluas, bukan
diduplikasi**.

## A. Referral / Affiliate Commission (fase V6-1)

| ID | Requirement | Status | Fondasi existing yang dipakai | Tindakan |
| --- | --- | --- | --- | --- |
| REF-001 | Tenant READY dapat menjadi referral partner | MISSING | `platform.tenant` (status READY sudah ada) | model `ReferralPartner` |
| REF-002 | Kode dan link unik tanpa mengungkap schema name | MISSING | — | `ReferralCode`, `ReferralLink` dengan token acak |
| REF-003 | Registration menerima kode/link + evidence snapshot | PARTIAL | `platform.registration` sudah ada, tinggal tambah kolom | `ADD COLUMN` + `ReferralTouch`, `ReferralAttributionEvidence` |
| REF-004 | Attribution resolver first/last/code/manual | MISSING | — | `ReferralAttribution` dengan `referredTenantId` UNIQUE |
| REF-005 | Default 20% dan plan version baru | MISSING | pola versioning `SubscriptionPlanVersion` dapat dicontoh | `ReferralCommissionPlan(Version)` |
| REF-006 | Rate khusus per referrer/tenant/campaign/paket/periode | MISSING | pola `DiscountProgram` + whitelist kondisi dapat dicontoh | `ReferralCommissionRule` |
| REF-007 | Monthly run eligible dan idempotent | MISSING | pola `payment_check_batch` dapat dicontoh | `ReferralCommissionRun(Item)` |
| REF-008 | Ledger simpan basis, rate, komisi, currency, source payment, trace | MISSING | pola `calculation_trace` pada `pricing_quote` sudah terbukti | `ReferralCommissionLedger` + `uniqueCalculationKey` |
| REF-009 | Refund/cancel membentuk adjustment/clawback | MISSING | `billing_credit_note` sudah ada sebagai pemicu | `ReferralCommissionAdjustment` |
| REF-010 | Payout digabung per partner dan periode | MISSING | — | `ReferralPayout(Line)` |
| REF-011 | Payout: approval, withholding, validasi bank, rekonsiliasi | MISSING | pola `payment_reconciliation_run` dapat dicontoh | `ReferralPayoutMethod`, `ReferralTaxDocument` |
| REF-012 | Dashboard partner: clicks, registrations, conversions, revenue | MISSING | — | agregasi + UI |
| REF-013 | Freeze partner/komisi tanpa hapus histori | MISSING | pola lifecycle `is_active`/`deleted_at` sudah standar | ikuti kontrak master |
| REF-014 | Deteksi fraud: self-referral, IP/device, circular, anomali | MISSING | `platform_login_attempt` menyimpan IP | `ReferralFraudCase` |
| REF-015 | Seluruh perubahan masuk platform audit | PARTIAL | `AuditService.record()` sudah ada dan dipakai 50+ tempat | panggil dari service referral |
| REF-A1 | Basis: collected eligible net revenue, kecualikan pajak/fee/refund/chargeback/credit note | MISSING | `billing_invoice` punya `taxTotal`, `adminFeeTotal`; `billing_payment_allocation` ada | fungsi basis dapat dikonfigurasi |
| REF-A2 | Ledger immutable, koreksi lewat adjustment | MISSING | pola trigger `forbid_ledger_mutation` sudah terbukti | trigger sama untuk ledger komisi |
| REF-A3 | 4 accounting event (EARNED/WITHHELD/PAID/CLAWBACK) | MISSING | — | bergantung V6-5; sementara catat sebagai event pending |

## B. Multi-Investor dan Ownership (fase V6-2)

| ID | Requirement | Status | Fondasi existing | Tindakan |
| --- | --- | --- | --- | --- |
| OWN-001 | Satu brand/outlet dimiliki banyak investor | PARTIAL | tabel `ownership_interest` **sudah ada** di schema tenant | perluas jadi effective-dated many-to-many |
| OWN-002 | Satu investor punya interest pada banyak target | PARTIAL | idem | idem |
| OWN-003 | Economic share, voting share, effective date terpisah | MISSING | — | kolom terpisah `Decimal(19,8)` |
| OWN-004 | Validasi overlap dan total persentase per target/periode | MISSING | — | constraint + validator |
| OWN-005 | Kontribusi modal masuk ledger immutable | MISSING | `investor_profile`, `owner_profile` ada | `CapitalContribution`, `CapitalAccountLedger` + trigger |
| OWN-006 | Transfer interest dengan transferor/transferee/approval | MISSING | — | `OwnershipTransfer` |
| OWN-007 | Waterfall: pre/post BEP, preferred return, reserve, fee, tier | MISSING | `ownership_interest` ada tetapi tanpa formula | `RevenueShareScheme/Tier/Contract` |
| OWN-008 | Settlement per outlet/brand/company/group | MISSING | — | `RevenueShareCalculation/Settlement` |
| OWN-009 | Investor hanya melihat target yang jadi haknya | MISSING | `role_scope` sudah ada sebagai pola scope | scope data investor |
| OWN-010 | Perubahan rekening payout butuh step-up + approval | MISSING | `StepUpDialog` + `RequireStepUp` sudah ada | `InvestorBeneficiaryAccount` |
| OWN-011 | Setiap settlement punya posting key unik | MISSING | pola posting key sudah dipakai transfer/receipt | ikuti pola |
| OWN-012 | Statement bulanan/tahunan multi-bahasa | MISSING | i18n 4 bahasa sudah ada | `InvestorStatement` |
| OWN-A1 | Dataset acceptance: 5 investor, 1 group, 1 brand, 3 outlet, 9 POS | MISSING | seed demo sudah punya brand/outlet | tambah ke seed demo |
| OWN-A2 | Tidak ada kolom `investor1..N` | DONE (tercegah) | `ownership_interest` sudah tabel relasi | pertahankan |

## C. Tenant Website dan Custom Domain (fase V6-3)

| ID | Requirement | Status | Fondasi existing | Tindakan |
| --- | --- | --- | --- | --- |
| WEB-001 | Tenant punya satu/banyak website | MISSING | 35 model CMS platform dapat dicontoh strukturnya | `TenantWebsite` pada schema tenant |
| WEB-002 | CMS tenant terpisah dari CMS platform | MISSING | CMS platform sudah lengkap | tabel `tenant_cms_*` pada schema tenant |
| WEB-003 | Subdomain default `<slug>.ebisnis.id` | MISSING | `tenant.slug` sudah ada | `TenantWebsiteDomain` |
| WEB-004 | Custom domain + verifikasi TXT/CNAME | MISSING | — | `TenantDomainVerificationAttempt` |
| WEB-005 | Host resolver aman, unknown host tidak fallback ke tenant | MISSING | `validateSchemaName` + registry sudah menegakkan prinsip "schema hanya dari registry" | resolver berbasis `TenantWebsiteDomain` global |
| WEB-006 | IDNA normalization + unique global | MISSING | — | normalisasi + unique index |
| WEB-007 | TLS/ACME abstraction + monitoring sertifikat | MISSING | — | `TenantDomainCertificate` + interface provider |
| WEB-008 | Primary domain + alias redirect | MISSING | `redirect_rule` platform ada sebagai pola | idem per tenant |
| WEB-009 | Cooling period setelah remove | MISSING | — | state machine domain 9 status |
| WEB-010 | Catalog/price/order scope per website | MISSING | `price_book` sudah ada | `WebsiteCatalogScope`, `WebsitePriceBookScope` |
| WEB-011 | Website tenant mendukung id/en/ar/zh-CN + RTL | PARTIAL | i18n + `applyLocaleDirection` RTL **sudah terbukti** | pakai ulang |
| WEB-012 | Mode development `tenant-slug.localhost` | MISSING | — | fallback mapping + mock verifier |

## D. Workflow / SOP Engine (fase V6-4)

| ID | Requirement | Status | Fondasi existing | Tindakan |
| --- | --- | --- | --- | --- |
| WF-001 | Designer graph tanpa code | MISSING | — | UI designer |
| WF-002 | Definition published immutable, perubahan buat versi baru | PARTIAL | `workflow_definition.definition_version` (integer) ada | tabel `workflow_definition_version` |
| WF-003 | Policy berbeda per company/outlet/amount | MISSING | — | `WorkflowPolicyAssignment` |
| WF-004 | Direct dan workflow memakai shared service + validator | MISSING | pola service tunggal sudah dipakai `erp-purchasing.service.ts` | `PurchaseRequisitionApplicationService` |
| WF-005 | Business table tidak diduplikasi workflow | MISSING | — | `WorkflowEntityLink` |
| WF-006 | Instance simpan entityType/entityId setelah objek terbentuk | PARTIAL | `workflow_instance` ada | `ADD COLUMN` + link table |
| WF-007 | Draft data sebagai typed payload atau domain draft | MISSING | — | `WorkflowSubmission` |
| WF-008 | Actor resolver: role, user, manager, owner, requester, dynamic | PARTIAL | `workflow_step.assignee_rule` (satu kolom) ada | `WorkflowActorRule` berbasis baris |
| WF-009 | Parallel approval all/any/quorum | MISSING | — | step type + join semantics |
| WF-010 | SLA memakai business calendar dan hari libur | PARTIAL | `workflow_step.sla_hours` ada (jam saja, tanpa kalender) | `sla_duration`+`sla_unit`+kalender |
| WF-011 | Delegate/escalate/return/revise tanpa kehilangan audit | PARTIAL | `workflow_action_log` ada | perluas aksi |
| WF-012 | Rejected request tidak membuat posted transaction | MISSING | — | terminal command hanya pada APPROVE |
| WF-013 | Final command idempotent dan retry-safe | MISSING | pola `idempotency_record` sudah ada | `WorkflowBusinessCommand` + idempotency key |
| WF-014 | Workflow untuk PR, PO, payment, journal, HR, asset, CMS, domain, investor | MISSING | — | mulai dari PR |
| WF-015 | Analitik bottleneck, overdue, approval time, SLA compliance | MISSING | — | laporan |
| WF-A1 | Tabel `purchase_requisition` + line | **MISSING** | **tidak ada** (`request_order` berbeda peran) | migration tenant baru |
| WF-A2 | Tidak ada batas jumlah next step | MISSING | legacy punya batas 20 | `workflow_transition` tanpa batas |

## E. Enterprise Accounting (fase V6-5, V6-6)

| ID | Requirement | Status | Fondasi existing | Tindakan |
| --- | --- | --- | --- | --- |
| ACC-001 | Books, ledgers, calendar, periode | PARTIAL | `fiscal_period`, `chart_of_account`, `account_type` **ada tanpa service** | tambah `AccountingBook`, `Ledger` |
| ACC-002 | Subledger accounting configurable (event class → rule → line rule) | MISSING | — | rule engine effective-dated |
| ACC-003 | Journal batch/entry/line multi-currency, balanced | PARTIAL | `journal_entry`, `journal_entry_line` ada + guard POSTED immutable | tambah batch, currency, dimensi |
| ACC-004 | Universal posting contract (13 field event) | MISSING | — | `AccountingEvent` + posting key unik |
| ACC-005 | Posting pilot: POS, purchase, inventory, payroll, subscription, referral, investor | MISSING | sumber datanya sudah ada untuk purchase/inventory/subscription | bertahap, satu sumber sekali |
| ACC-006 | 12 rekonsiliasi subledger→GL | MISSING | — | per sumber |
| ACC-007 | Period close: template, run, task, lock, sertifikasi | MISSING | `fiscal_period` ada | `CloseTemplate/Run/Task` |
| ACC-008 | Financial report designer + drill-down | MISSING | — | fase V6-6 |
| ACC-009 | Intercompany, elimination, consolidation, translation | MISSING | `legal_entity` ada | fase V6-6 |
| ACC-010 | Lease, revenue recognition, treasury, ECL, project accounting | MISSING | — | fase V6-6, per submodul |
| ACC-A1 | Posting key unik mencegah double posting | MISSING | pola posting key sudah dipakai di stok | ikuti pola |
| ACC-A2 | Perubahan rule effective-dated, tidak mengubah histori | MISSING | pola `SubscriptionPlanVersion` sudah terbukti | ikuti pola |

## F. Modul ERP Tambahan (fase V6-7)

Seluruhnya MISSING. Sesuai Master Prompt V6 Lampiran V6-F, pada fase ini yang
**wajib disiapkan sekarang** hanyalah reservasi arsitektur, bukan UI:

| Prioritas | Modul | Yang direservasi di V6-0/V6-7 |
| --- | --- | --- |
| P0 | Referral, multi-investor, website/domain, workflow, accounting foundation | fase V6-1 s.d. V6-5 |
| P1 | Project accounting, expense, field service/helpdesk, e-commerce/OMS, GRC | module code, menu, entitlement, data dictionary |
| P2 | PLM, demand planning/S&OP, contract sourcing, MDM, franchise | idem |
| P3 | EHS/ESG, AI/optimization, ekstensi industri | idem |

Modul catalog existing (`platform.module_catalog`) sudah memuat 20 modul dan
menjadi tempat reservasi kode modul baru — tidak perlu tabel baru.

## G. Cross-cutting V6

| Requirement | Status | Catatan |
| --- | --- | --- |
| Schema hanya dari registry, tidak dari request | DONE | sudah ditegakkan; resolver domain V6 wajib ikut aturan ini |
| Audit append-only platform + tenant | DONE | dipakai ulang oleh seluruh fase V6 |
| Kontrak kolom lifecycle master | DONE | master V6 wajib mengikuti |
| Seed minimal 10 record | DONE (mekanisme) | master V6 relevan wajib ikut; pengecualian didokumentasikan |
| i18n 4 bahasa + RTL | DONE | label V6 wajib memakai translation key |
| Decimal untuk uang/persentase/kuantitas | DONE | `decimal.js` + `Decimal(19,x)`; V6 wajib sama |
| Tidak ada `eval`/SQL bebas | DONE | evaluator diskon whitelist jadi contoh untuk policy workflow |
| Step-up untuk aksi sensitif | PARTIAL | mekanisme ada; **otorisasi belum**, lihat V6-0-F03 |
| Idempotency | PARTIAL | `idempotency_record` + kunci pada quote/transfer; belum menyeluruh |
| Feature flag | MISSING | belum ada satu pun `V6_*_ENABLED` |
| OpenAPI + Orval | PARTIAL | OpenAPI hidup; client belum digenerate |
| SSRF protection (domain/payment/webhook) | MISSING | dibutuhkan V6-3 (verifikasi DNS) dan V6-1 (payout) |
| Host header validation | MISSING | dibutuhkan V6-3 |

## Skenario acceptance akhir V6 dan kesiapannya

| # | Skenario | Kesiapan fondasi | Fase pembuktian |
| --- | --- | --- | --- |
| 1 | Tenant R jadi referral partner | tenant + status READY ada | V6-1 |
| 2 | Tenant A daftar via referral R | registration ada, kolom referral belum | V6-1 |
| 3 | A bayar subscription | invoice + payment + Esmartlink ada | V6-1 |
| 4 | R dapat komisi default 20% | pricing/invoice ada, ledger komisi belum | V6-1 |
| 5 | Refund menghasilkan clawback | credit note ada, adjustment belum | V6-1 |
| 6 | 5 investor, 1 brand, 3 outlet, 9 POS | brand/outlet/device ada, ownership belum lengkap | V6-2 |
| 7 | Tenant punya website default + custom domain | CMS platform ada, CMS tenant belum | V6-3 |
| 8 | Host custom domain menampilkan website tenant benar | registry schema ada, domain registry belum | V6-3 |
| 9 | PR direct dan PR workflow menulis tabel yang sama | **tabel PR belum ada** | V6-4 |
| 10 | Seluruh modul menghasilkan accounting event | jurnal ada tanpa service | V6-5 |
| 11 | Accounting event dapat ditelusuri dua arah | belum ada | V6-5 |
