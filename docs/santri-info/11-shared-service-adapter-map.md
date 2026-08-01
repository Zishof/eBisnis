# EP-0.12 — Peta Adapter Layanan Bersama

§4.3 menuntut ePesantren memakai layanan bersama lewat port/adapter, bukan
membangun ulang.

| Port §4.3 | Modul tujuan | Ada? | Adapter ePesantren |
| --- | --- | --- | --- |
| `IdentityPort` | `auth` | DONE | MISSING |
| `OrganizationPort` | `tenant` | DONE | MISSING |
| `EducationPort` | — | **MISSING** | MISSING |
| `EntitlementPort` | `subscription` | DONE | MISSING |
| `PricingPort` | `pricing` | DONE | MISSING |
| `BillingPort` | `billing` | DONE | MISSING |
| `PaymentPort` | `payment` | DONE | MISSING |
| `AccountingEventPort` | `accounting` | DONE | MISSING |
| `InventoryPort` | `catalog` | DONE | MISSING |
| `PosPort` | `pos` | DONE | MISSING |
| `ProcurementPort` | — | MISSING | MISSING |
| `HrPayrollPort` | — | MISSING | MISSING |
| `WorkflowPort` | `governance` | PARTIAL | MISSING |
| `NotificationPort` | `notification` | DONE | MISSING |
| `AiGatewayPort` | `ai` | DONE | MISSING |
| `AuditPort` | `infrastructure/audit` | DONE | MISSING |
| `FileStoragePort` | `cms` (MediaAsset) | PARTIAL | MISSING |
| `SearchPort` | — | MISSING | MISSING |
| `CooperativePort` | `cooperative` | DONE | MISSING |
| `HealthPort` | `health` | PARTIAL | MISSING |
| `CmsPort` | `cms` | PARTIAL | MISSING |
| `DomainPort` | `infrastructure/portal` | PARTIAL | MISSING |
| `TicketingPort` | `ticketing.prisma` | PARTIAL | MISSING |

## Contoh yang sudah benar

`apps/api/src/modules/cooperative/adapters/pos-adapter-readonly.spec.ts`
menunjukkan pola yang diminta: vertikal koperasi membaca POS lewat adapter yang
hanya membaca, bukan menyentuh tabel POS langsung.

Pola itu yang harus diikuti seluruh adapter ePesantren.

## Yang belum ada sama sekali

`EducationPort` tidak punya modul tujuan. Ia bukan adapter yang belum dibuat —
yang diadaptasinya sendiri belum ada.
