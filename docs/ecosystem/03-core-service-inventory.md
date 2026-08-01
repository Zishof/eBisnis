# ECO-0 — Inventaris layanan inti

§26 menuntut satu core. §1394 melarang vertical membuat salinan layanan shared.

## Modul API yang ada (28)

```
accounting activity ai auth billing catalog checkout cms cooperative
fulfillment governance health listing marketing marketplace master-seed
notification observability order payment platform-admin pos pricing public
return seed-admin storefront surat tenant
```

## Pemetaan terhadap §26

| Layanan §26 | Modul / model | Status |
| --- | --- | --- |
| Identity and Access | `auth` | DONE (non-OIDC) |
| Tenant and Organization | `tenant` | PARTIAL — hierarki organisasi §10.2 belum |
| Product Catalog | `catalog`, `ModuleCatalog` | PARTIAL |
| Pricing and Billing | `pricing`, `billing` | PARTIAL |
| Subscription | `Subscription*` | DONE |
| Entitlement | `EntitlementSnapshot` | PARTIAL |
| Domain and Website | `storefront`, `VerticalSiteDomain` | PARTIAL |
| CMS | `cms` | DONE (multi-situs) |
| Workflow/SOP | `governance` | PARTIAL |
| Notification | `notification` | DONE |
| AI | `ai` | DONE |
| Observability | `observability` | DONE |
| Audit | trigger V008 + `Audit*` | DONE |
| Help | — | MISSING (V8-1/V8-2 masih tertunda) |
| Excel/PDF | — | MISSING (V8-5/6, V8-7 tertunda) |
| File Storage | port di koperasi | PARTIAL |
| Search | — | MISSING |
| API Gateway | NestJS + guard | DONE untuk kebutuhan sekarang |
| Event Bus | outbox | PARTIAL |
| Finance/Accounting | `accounting` | PARTIAL |
| HR/Payroll | — | MISSING |
| Procurement, Inventory | dalam ERP inti | PARTIAL |
| POS | `pos` | DONE |
| Marketplace | `marketplace`, `listing`, `order`, `checkout` | PARTIAL |
| Investor | — | MISSING |
| Document/Correspondence | `surat` | PARTIAL |

## Kesimpulan

Tidak ditemukan duplikasi layanan shared oleh vertical mana pun. `cooperative`
dan `health` memakai port, bukan salinan.

Larangan §1394 **belum dilanggar**. Yang perlu dijaga adalah saat eMedik (40
commit) dan info-desa (24 commit) digabung — keduanya belum diperiksa baris demi
baris pada audit ini.
