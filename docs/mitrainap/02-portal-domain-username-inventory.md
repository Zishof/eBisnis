# Portal, domain, dan username

| Kemampuan | Bukti aktual | Putusan |
|---|---|---|
| Portal registry | `apps/api/src/infrastructure/portal/portal.catalog.ts`; model/migration `platform_portal*` | EXTEND dengan `MITRAINAP` |
| Shared auth host | `HOST_AUTH_KANONIK=auth.ebisnis.id` | REUSE; jangan buat issuer baru |
| Tenant public domain | `vertical_site_domain` dan `PublicTenantResolver` | EXTEND untuk vertical `HOSPITALITY` |
| Host normalization/fail closed | `public-host.ts`, resolver lookup control plane | REUSE dan tambah test wildcard/reserved host |
| Tenant/schema mapping | `tenant_schema_registry` | REUSE |
| Username | auth/person/user/membership control-plane existing | REUSE; audit immutability/reservation pada MI-1/MI-3 |
| Custom domain | status/verification pada `vertical_site_domain` | EXTEND; TLS tetap concern deployment |

Target host: `mitrainap.id`, `www.mitrainap.id`, `app.mitrainap.id`, opsional `api.mitrainap.id` bila gateway memakainya, `demo.mitrainap.id`, `{publicTenantSlug}.mitrainap.id`, dan custom domain terverifikasi. Reserved slug minimum mengikuti master (`www`, `app`, `api`, `auth`, `admin`, `demo`, `booking`, dan set lengkapnya). Resolver harus berurutan: normalize/IDNA → reserved check → portal registry → tenant domain → tenant status → entitlement → site/booking context; tidak ada fallback ke schema `public`.
