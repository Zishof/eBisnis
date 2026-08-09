# Rencana implementasi incremental

Setiap fase adalah vertical slice migration → model/domain → API → permission → UI → test → docs/changelog. Status awal: MI-0 in review; MI-1..24 not started.

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

Gate tiap fase: tidak ada TODO/skeleton sebagai acceptance; negative authorization dan tenant/property isolation lulus; migration additive; API/UI memakai data nyata; mobile/responsive diperiksa; ledger diperbarui. Live OTA/GDS/payment/digital-key/IoT tetap `BLOCKED_PROVIDER_INPUT` bila contract/credential belum tersedia, tetapi interface, fake adapter, queue, failure mode, dan tests tetap dibuat.
