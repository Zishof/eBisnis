# Rencana implementasi incremental

Setiap fase adalah vertical slice migration → model/domain → API → permission → UI → test → docs/changelog. Status audit 9 Agustus 2026: MI-0, MI-1, MI-4, dan MI-12..MI-14 selesai; MI-2, MI-3, dan MI-5..MI-11 sudah memiliki vertical slice tetapi masih parsial terhadap BRD; MI-15..MI-24 belum selesai.

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
| MI-2 | PARSIAL | homepage, solusi, FAQ, dan public site tersedia; cakupan CMS/SEO BRD belum lengkap |
| MI-3 | PARSIAL | registrasi, provisioning subdomain, Apache alias, dan demo deploy tersedia; custom-domain/TLS lifecycle belum lengkap |
| MI-4 | SELESAI | produk/paket tanpa harga rekaan, modul/fitur/dependency, assignment entitlement, usage contract, provisioning/role/menu/support seed, dan health check tersedia |
| MI-5 | PARSIAL | property, room type, dan room tersedia; portfolio/building/floor/zone/active-context belum lengkap |
| MI-6 | PARSIAL | inventory block dan availability tersedia; ledger stay-date/allotment/concurrency coverage BRD belum lengkap |
| MI-7 | PARSIAL | guest profile, consent, merge, dan privacy tersedia; relasi/company/loyalty CRM belum lengkap |
| MI-8 | PARSIAL | reservation core lifecycle tersedia; quote/waitlist/group/detail lifecycle belum lengkap |
| MI-9 | PARSIAL | direct booking dan manage-booking berbasis trusted host tersedia; payment/provider dan acceptance a11y penuh belum lengkap |
| MI-10 | PARSIAL | rate plan, calendar, restriction, dan occupancy summary tersedia; forecast/recommendation/approval revenue belum lengkap |
| MI-11 | PARSIAL | kontrak provider-neutral, account/mapping, ARI/reservation queue, retry/DLQ, sanitasi, dan reconciliation exception tersedia; worker/UI/live adapter belum lengkap |
| MI-12 | SELESAI | board arrival/departure/in-house, pre-arrival, room assignment, check-in/out idempoten, physical/digital-key contract, room move/rekey, perubahan masa inap/late checkout, exception model, handover, RBAC sempit, dan UI operasional tersedia |
| MI-13 | SELESAI | supervisor room board, task/checklist lifecycle, mobile offline idempotency, DND/refused/discrepancy, inspection/rework, linen/laundry, minibar outbox, lost-and-found custody, role supervisor/attendant, dan UI responsif tersedia |
| MI-14 | SELESAI | work order/SLA/mobile events, shared product/supplier links, inventory issue outbox, asset/room history, preventive plan, approved OOO/OOS availability blocks, verified release, RBAC, dan UI tersedia |
| MI-15..24 | BELUM SELESAI | dilanjutkan incremental sesuai urutan fase dan gate di bawah |

Gate tiap fase: tidak ada TODO/skeleton sebagai acceptance; negative authorization dan tenant/property isolation lulus; migration additive; API/UI memakai data nyata; mobile/responsive diperiksa; ledger diperbarui. Live OTA/GDS/payment/digital-key/IoT tetap `BLOCKED_PROVIDER_INPUT` bila contract/credential belum tersedia, tetapi interface, fake adapter, queue, failure mode, dan tests tetap dibuat.
