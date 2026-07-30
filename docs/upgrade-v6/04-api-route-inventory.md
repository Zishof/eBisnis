# 04 — Inventaris Route API

> Fase V6-0. Dihasilkan dari OpenAPI runtime (`GET /docs-yaml` pada API yang berjalan)
> lalu dicocokkan ke dekorator pada source. Seluruh 157 operasi berhasil dicocokkan
> ke handler sumbernya, sehingga daftar ini bukan hasil pembacaan manual.

## Ringkasan

| Metrik | Jumlah |
| --- | --- |
| Total operasi HTTP | 157 |
| Endpoint publik (`@Public`) | 31 |
| Punya permission tenant | 42 |
| Punya permission platform | 50 |
| Diblokir untuk demo (`@BlockDemo`) | 55 |
| Memerlukan step-up | 5 |
| **Terautentikasi tetapi TANPA dekorator permission** | **34** |

Baris terakhir adalah temuan; lihat [01-v5-regression-status.md](01-v5-regression-status.md)
temuan `V6-0-F03`.

## `auth` — Autentikasi dan sesi (9)

| Metode | Path | Publik | Permission tenant | Permission platform | Demo diblokir | Step-up | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | ya | — | — | — | — | `src/modules/auth/auth.controller.ts:101` |
| POST | `/api/v1/auth/refresh` | ya | — | — | — | — | `src/modules/auth/auth.controller.ts:114` |
| POST | `/api/v1/auth/logout` | — | — | — | — | — | `src/modules/auth/auth.controller.ts:126` |
| GET | `/api/v1/auth/me` | — | — | — | — | — | `src/modules/auth/auth.controller.ts:135` |
| POST | `/api/v1/auth/change-password` | — | — | — | — | — | `src/modules/auth/auth.controller.ts:158` |
| POST | `/api/v1/auth/step-up` | — | — | — | — | — | `src/modules/auth/auth.controller.ts:179` |
| GET | `/api/v1/me/context` | — | — | — | — | — | `src/modules/auth/auth.controller.ts:203` |
| GET | `/api/v1/me/menus` | — | — | — | — | — | `src/modules/auth/auth.controller.ts:218` |
| GET | `/api/v1/me/permissions` | — | — | — | — | — | `src/modules/auth/auth.controller.ts:226` |

## `public` — Publik (website, pendaftaran, demo) (24)

| Metode | Path | Publik | Permission tenant | Permission platform | Demo diblokir | Step-up | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/health` | ya | — | — | — | — | `src/modules/health/health.module.ts:21` |
| GET | `/api/v1/api/v1/health` | ya | — | — | — | — | `src/modules/health/health.module.ts:52` |
| GET | `/api/v1/public/site` | ya | — | — | — | — | `src/modules/public/public.controller.ts:225` |
| GET | `/api/v1/public/pages/{slug}` | ya | — | — | — | — | `src/modules/public/public.controller.ts:232` |
| GET | `/api/v1/public/navigation` | ya | — | — | — | — | `src/modules/public/public.controller.ts:239` |
| GET | `/api/v1/public/marketing` | ya | — | — | — | — | `src/modules/public/public.controller.ts:246` |
| GET | `/api/v1/public/news` | ya | — | — | — | — | `src/modules/public/public.controller.ts:253` |
| GET | `/api/v1/public/news/{slug}` | ya | — | — | — | — | `src/modules/public/public.controller.ts:266` |
| GET | `/api/v1/public/announcements` | ya | — | — | — | — | `src/modules/public/public.controller.ts:273` |
| GET | `/api/v1/public/faqs` | ya | — | — | — | — | `src/modules/public/public.controller.ts:280` |
| GET | `/api/v1/public/packages` | ya | — | — | — | — | `src/modules/public/public.controller.ts:287` |
| GET | `/api/v1/public/subscription-packages` | ya | — | — | — | — | `src/modules/public/public.controller.ts:297` |
| GET | `/api/v1/public/subscription-packages/compare` | ya | — | — | — | — | `src/modules/public/public.controller.ts:304` |
| GET | `/api/v1/public/locales` | ya | — | — | — | — | `src/modules/public/public.controller.ts:311` |
| GET | `/api/v1/public/translations/{locale}` | ya | — | — | — | — | `src/modules/public/public.controller.ts:331` |
| GET | `/api/v1/public/registration-config` | ya | — | — | — | — | `src/modules/public/public.controller.ts:350` |
| POST | `/api/v1/public/usernames/check` | ya | — | — | — | — | `src/modules/public/public.controller.ts:358` |
| POST | `/api/v1/public/registrations` | ya | — | — | — | — | `src/modules/public/public.controller.ts:367` |
| GET | `/api/v1/public/registrations/{id}/status` | ya | — | — | — | — | `src/modules/public/public.controller.ts:384` |
| POST | `/api/v1/public/registrations/{id}/retry` | ya | — | — | — | — | `src/modules/public/public.controller.ts:392` |
| POST | `/api/v1/public/demo/session` | ya | — | — | — | — | `src/modules/public/public.controller.ts:403` |
| GET | `/api/v1/public/demo/status` | ya | — | — | — | — | `src/modules/public/public.controller.ts:419` |
| POST | `/api/v1/public/contact` | ya | — | — | — | — | `src/modules/public/public.controller.ts:449` |
| POST | `/api/v1/public/newsletter/subscribe` | ya | — | — | — | — | `src/modules/public/public.controller.ts:462` |

## `platform` — Platform Super Admin (23)

| Metode | Path | Publik | Permission tenant | Permission platform | Demo diblokir | Step-up | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/platform/dashboard` | — | — | `PLATFORM.TENANT.READ` | — | — | `src/modules/platform-admin/platform-admin.module.ts:75` |
| GET | `/api/v1/platform/registrations` | — | — | `PLATFORM.REGISTRATION.READ` | — | — | `src/modules/platform-admin/platform-admin.module.ts:122` |
| GET | `/api/v1/platform/registrations/{id}` | — | — | `PLATFORM.REGISTRATION.READ` | — | — | `src/modules/platform-admin/platform-admin.module.ts:146` |
| GET | `/api/v1/platform/tenants` | — | — | `PLATFORM.TENANT.READ` | — | — | `src/modules/platform-admin/platform-admin.module.ts:163` |
| GET | `/api/v1/platform/tenants/{id}` | — | — | `PLATFORM.TENANT.READ` | — | — | `src/modules/platform-admin/platform-admin.module.ts:190` |
| GET | `/api/v1/platform/tenants/{id}/schema-status` | — | — | `PLATFORM.TENANT.SCHEMA_STATUS` | — | — | `src/modules/platform-admin/platform-admin.module.ts:208` |
| POST | `/api/v1/platform/tenants/{id}/migrate` | — | — | `PLATFORM.TENANT.MIGRATE` | ya | — | `src/modules/platform-admin/platform-admin.module.ts:234` |
| POST | `/api/v1/platform/tenants/{id}/activate` | — | — | `PLATFORM.TENANT.ACTIVATE` | ya | — | `src/modules/platform-admin/platform-admin.module.ts:260` |
| POST | `/api/v1/platform/tenants/{id}/suspend` | — | — | `PLATFORM.TENANT.SUSPEND` | ya | `TENANT_SUSPEND` | `src/modules/platform-admin/platform-admin.module.ts:290` |
| GET | `/api/v1/platform/provisioning-jobs` | — | — | `PLATFORM.TENANT.READ` | — | — | `src/modules/platform-admin/platform-admin.module.ts:320` |
| GET | `/api/v1/platform/provisioning-jobs/{id}` | — | — | `PLATFORM.TENANT.READ` | — | — | `src/modules/platform-admin/platform-admin.module.ts:332` |
| POST | `/api/v1/platform/provisioning-jobs/{id}/retry` | — | — | `PLATFORM.TENANT.MIGRATE` | ya | — | `src/modules/platform-admin/platform-admin.module.ts:345` |
| POST | `/api/v1/platform/tenants/{id}/support-sessions` | — | — | `PLATFORM.TENANT.SUPPORT_READ` | ya | — | `src/modules/platform-admin/platform-admin.module.ts:356` |
| DELETE | `/api/v1/platform/support-sessions/{id}` | — | — | `PLATFORM.TENANT.SUPPORT_READ` | — | — | `src/modules/platform-admin/platform-admin.module.ts:421` |
| GET | `/api/v1/platform/support-sessions/{id}/master-data/{resource}` | — | — | `PLATFORM.TENANT.SUPPORT_READ` | — | — | `src/modules/platform-admin/platform-admin.module.ts:443` |
| PATCH | `/api/v1/platform/support-sessions/{id}/master-data/{resource}/{recordId}` | — | — | `PLATFORM.TENANT.SUPPORT_WRITE` | ya | `SUPPORT_WRITE` | `src/modules/platform-admin/platform-admin.module.ts:506` |
| GET | `/api/v1/platform/audit` | — | — | `PLATFORM.AUDIT.READ` | — | — | `src/modules/platform-admin/platform-admin.module.ts:586` |
| GET | `/api/v1/platform/security-events` | — | — | `PLATFORM.AUDIT.READ` | — | — | `src/modules/platform-admin/platform-admin.module.ts:606` |
| GET | `/api/v1/platform/locales` | — | — | `PLATFORM.I18N.MANAGE` | — | — | `src/modules/platform-admin/platform-admin.module.ts:618` |
| PATCH | `/api/v1/platform/locales/{code}` | — | — | `PLATFORM.I18N.MANAGE` | ya | — | `src/modules/platform-admin/platform-admin.module.ts:626` |
| GET | `/api/v1/platform/translations` | — | — | `PLATFORM.I18N.MANAGE` | — | — | `src/modules/platform-admin/platform-admin.module.ts:652` |
| GET | `/api/v1/platform/translations/export` | — | — | `PLATFORM.I18N.MANAGE` | — | — | `src/modules/platform-admin/platform-admin.module.ts:667` |
| POST | `/api/v1/platform/demo/reset` | — | — | `PLATFORM.TENANT.MIGRATE` | ya | — | `src/modules/platform-admin/platform-admin.module.ts:687` |

## `cms` — CMS platform (11)

| Metode | Path | Publik | Permission tenant | Permission platform | Demo diblokir | Step-up | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/platform/cms/pages` | — | — | `PLATFORM.CMS.READ` | — | — | `src/modules/cms/cms.module.ts:131` |
| GET | `/api/v1/platform/cms/pages/{code}` | — | — | `PLATFORM.CMS.READ` | — | — | `src/modules/cms/cms.module.ts:149` |
| PATCH | `/api/v1/platform/cms/pages/{code}/versions/{versionId}` | — | — | `PLATFORM.CMS.MANAGE` | ya | — | `src/modules/cms/cms.module.ts:176` |
| PATCH | `/api/v1/platform/cms/blocks/{blockId}` | — | — | `PLATFORM.CMS.MANAGE` | ya | — | `src/modules/cms/cms.module.ts:217` |
| POST | `/api/v1/platform/cms/pages/{code}/versions/{versionId}/status` | — | — | `PLATFORM.CMS.PUBLISH` | ya | — | `src/modules/cms/cms.module.ts:270` |
| POST | `/api/v1/platform/cms/pages/{code}/versions` | — | — | `PLATFORM.CMS.MANAGE` | ya | — | `src/modules/cms/cms.module.ts:334` |
| GET | `/api/v1/platform/cms/news` | — | — | `PLATFORM.CMS.READ` | — | — | `src/modules/cms/cms.module.ts:414` |
| GET | `/api/v1/platform/cms/announcements` | — | — | `PLATFORM.CMS.READ` | — | — | `src/modules/cms/cms.module.ts:429` |
| GET | `/api/v1/platform/cms/faqs` | — | — | `PLATFORM.CMS.READ` | — | — | `src/modules/cms/cms.module.ts:440` |
| GET | `/api/v1/platform/cms/media` | — | — | `PLATFORM.CMS.READ` | — | — | `src/modules/cms/cms.module.ts:452` |
| GET | `/api/v1/platform/cms/contact-messages` | — | — | `PLATFORM.CMS.READ` | — | — | `src/modules/cms/cms.module.ts:464` |

## `pricing` — Katalog paket dan pricing (8)

| Metode | Path | Publik | Permission tenant | Permission platform | Demo diblokir | Step-up | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/platform/modules` | ya | — | — | — | — | `src/modules/pricing/pricing.module.ts:94` |
| GET | `/api/v1/platform/features` | ya | — | — | — | — | `src/modules/pricing/pricing.module.ts:111` |
| GET | `/api/v1/platform/subscription-plans` | — | — | `PLATFORM.PRICING.READ` | — | — | `src/modules/pricing/pricing.module.ts:123` |
| GET | `/api/v1/platform/subscription-plans/{id}` | — | — | `PLATFORM.PRICING.READ` | — | — | `src/modules/pricing/pricing.module.ts:147` |
| GET | `/api/v1/platform/discount-programs` | — | — | `PLATFORM.DISCOUNT.READ` | — | — | `src/modules/pricing/pricing.module.ts:170` |
| POST | `/api/v1/platform/pricing/simulate` | — | — | `PLATFORM.PRICING.READ` | — | — | `src/modules/pricing/pricing.module.ts:192` |
| POST | `/api/v1/platform/discount-programs/{id}/simulate` | — | — | `PLATFORM.DISCOUNT.READ` | — | — | `src/modules/pricing/pricing.module.ts:223` |
| GET | `/api/v1/public/pricing/preview` | ya | — | — | — | — | `src/modules/pricing/pricing.module.ts:258` |

## `billing` — Perangkat, quote, subscription, invoice (10)

| Metode | Path | Publik | Permission tenant | Permission platform | Demo diblokir | Step-up | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/devices` | — | — | — | — | — | `src/modules/billing/billing.module.ts:111` |
| POST | `/api/v1/devices` | — | — | — | ya | — | `src/modules/billing/billing.module.ts:129` |
| POST | `/api/v1/devices/{id}/revoke` | — | — | — | ya | — | `src/modules/billing/billing.module.ts:139` |
| POST | `/api/v1/subscriptions/quotes` | — | — | — | — | — | `src/modules/billing/billing.module.ts:154` |
| GET | `/api/v1/subscriptions/quotes/{id}` | — | — | — | — | — | `src/modules/billing/billing.module.ts:173` |
| POST | `/api/v1/subscriptions/quotes/{id}/accept` | — | — | — | ya | — | `src/modules/billing/billing.module.ts:188` |
| GET | `/api/v1/subscriptions` | — | — | — | — | — | `src/modules/billing/billing.module.ts:199` |
| GET | `/api/v1/billing/invoices` | — | — | — | — | — | `src/modules/billing/billing.module.ts:214` |
| GET | `/api/v1/billing/invoices/{id}` | — | — | — | — | — | `src/modules/billing/billing.module.ts:229` |
| GET | `/api/v1/devices/{id}/entitlements` | — | — | — | — | — | `src/modules/billing/billing.module.ts:248` |

## `payments` — Pembayaran dan Esmartlink (14)

| Metode | Path | Publik | Permission tenant | Permission platform | Demo diblokir | Step-up | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/payments/esmartlink/callback` | ya | — | — | — | — | `src/modules/payment/payment.module.ts:83` |
| POST | `/api/v1/billing/invoices/{id}/payment-orders` | — | — | — | ya | — | `src/modules/payment/payment.module.ts:107` |
| POST | `/api/v1/payments/esmartlink/orders` | — | — | — | ya | — | `src/modules/payment/payment.module.ts:125` |
| POST | `/api/v1/billing/payment-orders/{id}/check-payment` | — | — | — | ya | — | `src/modules/payment/payment.module.ts:134` |
| GET | `/api/v1/payments/orders/{id}` | — | — | — | — | — | `src/modules/payment/payment.module.ts:148` |
| GET | `/api/v1/platform/payment-providers/esmartlink` | — | — | `PLATFORM.PAYMENT.READ` | — | — | `src/modules/payment/payment.module.ts:171` |
| GET | `/api/v1/platform/payment-channels` | — | — | `PLATFORM.PAYMENT.READ` | — | — | `src/modules/payment/payment.module.ts:185` |
| POST | `/api/v1/platform/payment-channels/import-legacy-config` | — | — | `PLATFORM.ESMARTLINK.MANAGE` | ya | — | `src/modules/payment/payment.module.ts:197` |
| POST | `/api/v1/platform/payments/check-batches` | — | — | `PLATFORM.PAYMENT.RECONCILE` | ya | — | `src/modules/payment/payment.module.ts:255` |
| GET | `/api/v1/platform/payments/check-batches/{id}` | — | — | `PLATFORM.PAYMENT.READ` | — | — | `src/modules/payment/payment.module.ts:264` |
| GET | `/api/v1/platform/payments/check-batches/{id}/items` | — | — | `PLATFORM.PAYMENT.READ` | — | — | `src/modules/payment/payment.module.ts:274` |
| GET | `/api/v1/platform/payment-h2h-logs` | — | — | `PLATFORM.PAYMENT.READ` | — | — | `src/modules/payment/payment.module.ts:286` |
| POST | `/api/v1/platform/payment-callbacks/{id}/replay` | — | — | `PLATFORM.PAYMENT.RECONCILE` | ya | `PAYMENT_REPLAY` | `src/modules/payment/payment.module.ts:299` |
| GET | `/api/v1/public/payment-channels` | ya | — | — | — | — | `src/modules/payment/payment.module.ts:322` |

## `seed` — Data contoh (seed tools) (9)

| Metode | Path | Publik | Permission tenant | Permission platform | Demo diblokir | Step-up | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/sample-data/verify` | — | `MASTER_SEED_TOOLS.READ` | — | — | — | `src/modules/seed-admin/seed-admin.module.ts:48` |
| POST | `/api/v1/sample-data/repair` | — | `MASTER_SEED_TOOLS.CREATE` | — | ya | — | `src/modules/seed-admin/seed-admin.module.ts:62` |
| POST | `/api/v1/sample-data/cleanup` | — | `MASTER_SEED_TOOLS.DELETE` | — | ya | — | `src/modules/seed-admin/seed-admin.module.ts:82` |
| POST | `/api/v1/sample-data/purge` | — | `MASTER_SEED_TOOLS.DELETE` | — | ya | `SEED_CLEANUP` | `src/modules/seed-admin/seed-admin.module.ts:118` |
| POST | `/api/v1/sample-data/restore` | — | `MASTER_SEED_TOOLS.RESTORE` | — | ya | — | `src/modules/seed-admin/seed-admin.module.ts:146` |
| GET | `/api/v1/sample-data/exceptions` | — | `MASTER_SEED_TOOLS.READ` | — | — | — | `src/modules/seed-admin/seed-admin.module.ts:165` |
| GET | `/api/v1/platform/seed/verify` | — | — | `PLATFORM.SEED.MANAGE` | — | — | `src/modules/seed-admin/seed-admin.module.ts:175` |
| POST | `/api/v1/platform/seed/run` | — | — | `PLATFORM.SEED.MANAGE` | ya | — | `src/modules/seed-admin/seed-admin.module.ts:194` |
| POST | `/api/v1/platform/seed/tenants/{schemaName}/repair` | — | — | `PLATFORM.SEED.MANAGE` | ya | — | `src/modules/seed-admin/seed-admin.module.ts:211` |

## `tenant` — Operasional tenant (master + ERP) (49)

| Metode | Path | Publik | Permission tenant | Permission platform | Demo diblokir | Step-up | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/request-orders` | — | — | — | — | — | `src/modules/tenant/tenant.module.ts:602` |
| POST | `/api/v1/request-orders` | — | `PURCHASING_REQUEST_ORDER.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:656` |
| GET | `/api/v1/request-orders/{id}` | — | `PURCHASING_REQUEST_ORDER.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:626` |
| POST | `/api/v1/request-orders/generate-min-stock` | — | `PURCHASING_REQUEST_ORDER.CREATE` | — | ya | — | `src/modules/tenant/tenant.module.ts:669` |
| POST | `/api/v1/request-orders/{id}/submit` | — | `PURCHASING_REQUEST_ORDER.CREATE` | — | ya | — | `src/modules/tenant/tenant.module.ts:681` |
| POST | `/api/v1/request-orders/{id}/approve` | — | `PURCHASING_REQUEST_ORDER.SUBMIT` | — | ya | — | `src/modules/tenant/tenant.module.ts:694` |
| POST | `/api/v1/request-orders/{id}/reject` | — | `PURCHASING_REQUEST_ORDER.APPROVE` | — | ya | — | `src/modules/tenant/tenant.module.ts:710` |
| GET | `/api/v1/products/{id}/suppliers` | — | `PURCHASING_REQUEST_ORDER.REJECT` | — | ya | — | `src/modules/tenant/tenant.module.ts:728` |
| GET | `/api/v1/purchase-orders` | — | `CATALOG_PRODUCT.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:739` |
| POST | `/api/v1/purchase-orders` | — | `PURCHASING_PO.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:792` |
| GET | `/api/v1/purchase-orders/{id}` | — | `PURCHASING_PO.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:762` |
| POST | `/api/v1/purchase-orders/{id}/submit` | — | `PURCHASING_PO.CREATE` | — | ya | — | `src/modules/tenant/tenant.module.ts:805` |
| POST | `/api/v1/purchase-orders/{id}/approve` | — | `PURCHASING_PO.SUBMIT` | — | ya | — | `src/modules/tenant/tenant.module.ts:818` |
| POST | `/api/v1/purchase-orders/{id}/send` | — | `PURCHASING_PO.APPROVE` | — | ya | — | `src/modules/tenant/tenant.module.ts:831` |
| GET | `/api/v1/goods-receipts` | — | `PURCHASING_PO.SUBMIT` | — | ya | — | `src/modules/tenant/tenant.module.ts:846` |
| POST | `/api/v1/goods-receipts` | — | `PURCHASING_RECEIPT.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:900` |
| GET | `/api/v1/goods-receipts/{id}` | — | `PURCHASING_RECEIPT.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:869` |
| POST | `/api/v1/goods-receipts/{id}/inspect` | — | `PURCHASING_RECEIPT.CREATE` | — | ya | — | `src/modules/tenant/tenant.module.ts:916` |
| POST | `/api/v1/goods-receipts/{id}/validate` | — | `PURCHASING_RECEIPT.REVIEW` | — | ya | — | `src/modules/tenant/tenant.module.ts:930` |
| POST | `/api/v1/goods-receipts/{id}/reverse-validation` | — | `PURCHASING_RECEIPT.POST` | — | ya | — | `src/modules/tenant/tenant.module.ts:946` |
| POST | `/api/v1/goods-receipts/{id}/create-backorder` | — | `PURCHASING_RECEIPT.CANCEL` | — | ya | — | `src/modules/tenant/tenant.module.ts:960` |
| GET | `/api/v1/backorders` | — | `PURCHASING_BACKORDER.CREATE` | — | ya | — | `src/modules/tenant/tenant.module.ts:981` |
| GET | `/api/v1/backorders/{id}` | — | `PURCHASING_BACKORDER.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:1007` |
| POST | `/api/v1/backorders/{id}/assign-supplier` | — | `PURCHASING_BACKORDER.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:1038` |
| POST | `/api/v1/backorders/{id}/create-purchase-order` | — | `PURCHASING_BACKORDER.APPROVE` | — | ya | — | `src/modules/tenant/tenant.module.ts:1052` |
| GET | `/api/v1/inventory/stock-tree` | — | `PURCHASING_BACKORDER.CREATE` | — | ya | — | `src/modules/tenant/tenant.module.ts:1067` |
| GET | `/api/v1/inventory/balances` | — | `INVENTORY_STOCK_TREE.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:1078` |
| GET | `/api/v1/inventory/movements` | — | `INVENTORY_STOCK_TREE.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:1090` |
| GET | `/api/v1/stock-alerts` | — | `INVENTORY_MOVEMENT.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:1107` |
| GET | `/api/v1/internal-transfers` | — | `INVENTORY_ALERT.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:1120` |
| POST | `/api/v1/internal-transfers` | — | `INVENTORY_TRANSFER.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:1173` |
| GET | `/api/v1/internal-transfers/{id}` | — | `INVENTORY_TRANSFER.READ` | — | — | — | `src/modules/tenant/tenant.module.ts:1142` |
| POST | `/api/v1/internal-transfers/{id}/approve` | — | `INVENTORY_TRANSFER.CREATE` | — | ya | — | `src/modules/tenant/tenant.module.ts:1186` |
| POST | `/api/v1/internal-transfers/{id}/allocate` | — | `INVENTORY_TRANSFER.APPROVE` | — | ya | — | `src/modules/tenant/tenant.module.ts:1199` |
| POST | `/api/v1/internal-transfers/{id}/dispatch` | — | `INVENTORY_TRANSFER.UPDATE` | — | ya | — | `src/modules/tenant/tenant.module.ts:1212` |
| POST | `/api/v1/internal-transfers/{id}/arrive` | — | `INVENTORY_TRANSFER.POST` | — | ya | — | `src/modules/tenant/tenant.module.ts:1228` |
| POST | `/api/v1/internal-transfers/{id}/validate-receipt` | — | `INVENTORY_TRANSFER.UPDATE` | — | ya | — | `src/modules/tenant/tenant.module.ts:1241` |
| GET | `/api/v1/master-resources` | — | — | — | — | — | `src/modules/tenant/tenant.module.ts:427` |
| GET | `/api/v1/{resource}` | — | — | — | — | — | `src/modules/tenant/tenant.module.ts:442` |
| POST | `/api/v1/{resource}` | — | — | — | — | — | `src/modules/tenant/tenant.module.ts:464` |
| GET | `/api/v1/{resource}/{id}` | — | — | — | — | — | `src/modules/tenant/tenant.module.ts:453` |
| PATCH | `/api/v1/{resource}/{id}` | — | — | — | ya | — | `src/modules/tenant/tenant.module.ts:477` |
| DELETE | `/api/v1/{resource}/{id}` | — | — | — | ya | — | `src/modules/tenant/tenant.module.ts:518` |
| POST | `/api/v1/{resource}/{id}/deactivate` | — | — | — | ya | — | `src/modules/tenant/tenant.module.ts:491` |
| POST | `/api/v1/{resource}/{id}/activate` | — | — | — | ya | — | `src/modules/tenant/tenant.module.ts:505` |
| POST | `/api/v1/{resource}/{id}/restore` | — | — | — | ya | — | `src/modules/tenant/tenant.module.ts:531` |
| GET | `/api/v1/{resource}/{id}/references` | — | — | — | ya | — | `src/modules/tenant/tenant.module.ts:544` |
| POST | `/api/v1/{resource}/{id}/purge` | — | — | — | — | — | `src/modules/tenant/tenant.module.ts:555` |
| GET | `/api/v1/{resource}/{id}/audit` | — | — | — | ya | `HARD_DELETE` | `src/modules/tenant/tenant.module.ts:574` |

## Route yang BELUM ada dan dibutuhkan Versi 6

Seluruh route berikut MISSING pada implementasi saat ini. Sumber: BRD V6 bab 31 dan
Master Prompt V6 Lampiran V6-A/C/D.

| Area | Route target V6 | Fase |
| --- | --- | --- |
| Referral | `POST /api/v1/referrals/links` | V6-1 |
| Referral | `GET /api/v1/referrals/dashboard` | V6-1 |
| Referral | `GET /api/v1/referrals/attributions` | V6-1 |
| Referral | `GET /api/v1/referrals/commissions` | V6-1 |
| Referral | `GET /api/v1/referrals/statements/:period` | V6-1 |
| Referral | `POST /api/v1/platform/referral-plans` | V6-1 |
| Referral | `POST /api/v1/platform/referral-plans/:id/versions` | V6-1 |
| Referral | `POST /api/v1/platform/referral-runs` | V6-1 |
| Referral | `POST /api/v1/platform/referral-runs/:id/recalculate` | V6-1 |
| Referral | `POST /api/v1/platform/referral-payouts` | V6-1 |
| Referral | `POST /api/v1/platform/referral-adjustments` | V6-1 |
| Referral | `POST /api/v1/platform/referral-fraud-cases/:id/resolve` | V6-1 |
| Investor | `GET/POST /api/v1/investors` | V6-2 |
| Investor | `GET/POST /api/v1/ownership-groups` | V6-2 |
| Investor | `POST /api/v1/ownership-interests` | V6-2 |
| Investor | `POST /api/v1/ownership-transfers` | V6-2 |
| Investor | `POST /api/v1/investment-contributions` | V6-2 |
| Investor | `POST /api/v1/revenue-share/calculations` | V6-2 |
| Investor | `POST /api/v1/revenue-share/settlements` | V6-2 |
| Investor | `GET /api/v1/investor-portal/statements` | V6-2 |
| Website | `GET/POST /api/v1/websites` | V6-3 |
| Website | `POST /api/v1/websites/:id/domains` | V6-3 |
| Website | `POST /api/v1/websites/domains/:id/verify` | V6-3 |
| Website | `POST /api/v1/websites/domains/:id/activate` | V6-3 |
| Website | `POST /api/v1/websites/domains/:id/set-primary` | V6-3 |
| Website | `GET/POST /api/v1/websites/:id/pages` | V6-3 |
| Website | `POST /api/v1/websites/:id/publish` | V6-3 |
| Website | `GET /api/v1/public/tenant-site/resolve` | V6-3 |
| Workflow | `GET/POST /api/v1/workflow/definitions` | V6-4 |
| Workflow | `POST /api/v1/workflow/definitions/:id/versions` | V6-4 |
| Workflow | `POST /api/v1/workflow/versions/:id/publish` | V6-4 |
| Workflow | `GET/POST /api/v1/workflow/policies` | V6-4 |
| Workflow | `POST /api/v1/workflow/submissions` | V6-4 |
| Workflow | `GET /api/v1/workflow/tasks/my` | V6-4 |
| Workflow | `POST /api/v1/workflow/tasks/:id/actions` | V6-4 |
| Workflow | `GET /api/v1/workflow/instances/:id/timeline` | V6-4 |
| Workflow | `POST /api/v1/workflow/instances/:id/cancel` | V6-4 |
| Workflow | `POST /api/v1/purchase-requisitions (direct)` | V6-4 |

Total route V6 yang harus ditambahkan: **38** (belum termasuk accounting fase V6-5/V6-6).
