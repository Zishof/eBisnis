# Rencana implementasi incremental

Setiap fase adalah vertical slice migration → model/domain → API → permission → UI → test → docs/changelog. Status audit ulang 9 Agustus 2026: MI-0..MI-23 memiliki implementasi fungsional; migration penyelesaian H071 lulus pada 16 schema. MI-24 tetap memisahkan bukti lokal dari keputusan produksi: sign-off staging/perangkat, backup-restore/DR, DNS/TLS, provider eksternal, dan persetujuan manusia wajib sebelum cutover.

| Fase | Outcome |
|---|---|
| MI-0 | audit, ledger, baseline, risk, commit |
| MI-1..4 | portal/CMS/site/domain/product/entitlement/provisioning |
| MI-5..9 | property/inventory/guest/reservation/direct booking |
| MI-10..11 | rate/revenue/channel contracts |
| MI-12..17 | front office/HK/maintenance/folio/night audit/POS adapter |
| MI-18..21 | group/MICE/service/long stay/owner/guest+staff mobile/kiosk/provider ports |
| MI-22..23 | ERP events/report/AI/help/sample/observability |
| MI-24 | regression, migration/security/performance/a11y/UAT/release/rollback |

## Status implementasi terverifikasi

| Fase | Status | Bukti dan gap utama |
|---|---|---|
| MI-0 | SELESAI | audit baseline dan ledger pada direktori ini; commit `62c93e2` |
| MI-1 | SELESAI | portal/host/branding MitraInap terdaftar dan diuji |
| MI-2 | SELESAI | portal homepage/solusi/harga/demo/blog/FAQ/bantuan, lead/registration, sitemap/robots, CMS workflow dan host-scoped publication tersedia |
| MI-3 | SELESAI | registrasi/subdomain, tenant CMS, custom-domain DNS TXT hash verification, revoke dan TLS lifecycle state tersedia |
| MI-4 | SELESAI | produk/paket tanpa harga rekaan, modul/fitur/dependency, assignment entitlement, usage contract, provisioning/role/menu/support seed, dan health check tersedia |
| MI-5 | SELESAI | legal entity/portfolio/brand/property/building/floor/zone, sellable room/unit/bed/space dan active context tersedia |
| MI-6 | SELESAI | block, stay-date ledger, allotment, overbooking, accessibility, transactional reconciliation dan concurrency guard tersedia |
| MI-7 | SELESAI | profile/consent/merge/privacy/restricted guest, relationship/companion/loyalty dan business-account link tersedia |
| MI-8 | SELESAI | quote snapshot, reservation lifecycle, multi-room/guest, waitlist/walk-in dan group rooming tersedia |
| MI-9 | SELESAI | direct/manage booking, transparent total/policy, provider-neutral payment intent, idempotency dan recovery tersedia |
| MI-10 | SELESAI | rate/restriction/calendar, pickup/pace forecast, evidence recommendation, review dan approval-before-publish tersedia |
| MI-11 | SELESAI | provider-neutral mapping/ARI/reservation queue, SKIP LOCKED worker, attempt audit, retry/DLQ, parity dan reconciliation tersedia |
| MI-12 | SELESAI | board arrival/departure/in-house, pre-arrival, room assignment, check-in/out idempoten, physical/digital-key contract, room move/rekey, perubahan masa inap/late checkout, exception model, handover, RBAC sempit, dan UI operasional tersedia |
| MI-13 | SELESAI | supervisor room board, task/checklist lifecycle, mobile offline idempotency, DND/refused/discrepancy, inspection/rework, linen/laundry, minibar outbox, lost-and-found custody, role supervisor/attendant, dan UI responsif tersedia |
| MI-14 | SELESAI | work order/SLA/mobile events, shared product/supplier links, inventory issue outbox, asset/room history, preventive plan, approved OOO/OOS availability blocks, verified release, RBAC, dan UI tersedia |
| MI-15 | SELESAI | folio immutable Decimal, routing/transfer, cashier shift, pembayaran tokenized, invoice, dan city ledger; migrasi idempoten 16 schema |
| MI-16 | SELESAI | night audit resumable/idempoten, exception queue, snapshot, step-up final roll, dan income review |
| MI-17 | SELESAI | shared POS diperluas dengan property/outlet, room charge, meal entitlement, kitchen status, stock/accounting trace |
| MI-18 | SELESAI | corporate/travel account, negotiated rate, group allotment/pickup, rooming list, function calendar, event/BEO |
| MI-19 | SELESAI | guest request SLA, concierge/ancillary, consent-bound communication, feedback dan reputation provider contract |
| MI-20 | SELESAI | configurable rental contract, move inspection, recurring rent/deposit, utility, collection, owner commission/statement |
| MI-21 | SELESAI | guest portal session, staff offline queue, kiosk, privacy purge, digital-key/IoT provider-neutral contracts |
| MI-22 | SELESAI | canonical versioned events, ERP ports/delivery, accounting trace, retry dan reconciliation |
| MI-23 | SELESAI | report snapshots/export, evidence-bound AI drafts, help, demo markers, notification outbox dan observability |
| MI-24 | LOCAL GATE PASS | 186 suite/4.176 API test dan 45 file/518 Web test pass; lint, API/Web production build, release gate, 20 migration hospitality idempoten pada 16 schema, serta backup dan restore isolasi lokal pass; staging UAT, device/a11y visual, load, DNS/TLS/provider dan go-live sign-off pending |

Gate tiap fase: tidak ada TODO/skeleton sebagai acceptance; negative authorization dan tenant/property isolation lulus; migration additive; API/UI memakai data nyata; mobile/responsive diperiksa; ledger diperbarui. Live OTA/GDS/payment/digital-key/IoT tetap `BLOCKED_PROVIDER_INPUT` bila contract/credential belum tersedia, tetapi interface, fake adapter, queue, failure mode, dan tests tetap dibuat.
