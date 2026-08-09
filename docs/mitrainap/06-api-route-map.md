# Peta API target

Namespace tunggal: `/api/v1/hospitality/**`.

| Fase | Prefix |
|---|---|
| MI-1..4 | `/portal`, `/sites`, `/products`, `/provisioning`, `/health` |
| MI-5..6 | `/properties`, `/room-types`, `/rooms`, `/spaces`, `/availability`, `/inventory-blocks` |
| MI-7..9 | `/guests`, `/consents`, `/companies`, `/quotes`, `/reservations`, `/booking` |
| MI-10..11 | `/rates`, `/restrictions`, `/revenue`, `/channels`, `/distribution-jobs`, `/reconciliation` |
| MI-12..14 | `/front-office`, `/arrivals`, `/stays`, `/housekeeping`, `/linen`, `/lost-found`, `/maintenance` |
| MI-15..17 | `/folios`, `/cashiers`, `/payments`, `/city-ledger`, `/night-audit`, `/pos` |
| MI-18..21 | `/groups`, `/mice`, `/guest-services`, `/long-stay`, `/owners`, `/guest-portal`, `/mobile`, `/kiosk` |
| MI-22..24 | `/erp`, `/events`, `/reports`, `/ai`, `/help`, `/sample`, `/operations` |

Setiap route harus menyatakan authentication/permission metadata yang lulus route authorization audit, mengambil tenant/property scope dari trusted context, memakai idempotency key untuk create/payment/posting/completion, ETag/version untuk konflik, cursor pagination, error envelope platform, dan tidak menerima schema name dari request.
