# PERINTAH MASTER CLAUDE CODE / CODEX
# EKSEKUSI KHUSUS MITRAINAP.ID — HOSPITALITY VERSI 14
# PMS, CRS, BOOKING ENGINE, CHANNEL MANAGER, REVENUE, FRONT OFFICE,
# HOUSEKEEPING, MAINTENANCE, NIGHT AUDIT, HOTEL POS, MICE, LONG STAY,
# WEBSITE TENANT, MOBILE OPERATIONS, DAN INTEGRASI ERP EBISNIS

**Jenis pekerjaan:** Integrasi vertical dan product family Hospitality pada source existing; bukan membuat aplikasi baru dari nol.  
**Portal publik:** `https://mitrainap.id`  
**Application entry:** `https://app.mitrainap.id`  
**Demo:** `https://demo.mitrainap.id`  
**Pola tenant:** `https://{PUBLIC_TENANT_SLUG}.mitrainap.id`  
**Repository sumber kebenaran:** `https://github.com/Zishof/eBisnis`  
**Workspace core:** `C:\opt\eBisnisGithub\`  
**Worktree khusus:** `C:\opt\eBisnisGithub-mitrainap\`  
**Branch khusus:** `feature/v14-mitrainap-hospitality`  
**VCS:** Git-only  
**Vertical code:** `HOSPITALITY`  
**Portal code:** `MITRAINAP`  
**API namespace:** `/api/v1/hospitality/**`  
**Permission prefix:** `HOSPITALITY.*`  
**Event namespace:** `hospitality.*`  
**Migration naming:** `<timestamp>__hospitality__<description>`  

---

# 0. PERINTAH PEMBUKA WAJIB

Baca dokumen ini sampai selesai sebelum mengubah source. Baca pula BRD, menu/role, dan UI/UX MitraInap Versi 14 serta seluruh dokumen platform eBisnis yang dirujuk.

Sesudah membaca:

```text
jangan berhenti pada analisis
jangan berhenti pada dokumentasi
jangan berhenti pada wireframe
jangan berhenti pada schema/model
jangan berhenti pada skeleton/TODO/mock
```

Audit source dan database aktual, buat evidence ledger, lalu implementasikan vertical slice nyata sampai Definition of Done terpenuhi atau terdapat blocker yang benar-benar tidak dapat diselesaikan tanpa secret, kontrak provider, akses production, atau keputusan bisnis finansial yang tidak dapat dibuktikan.

Kalimat eksekusi utama:

```text
Audit seluruh source, migration, API, UI, test, portal registry, tenant registry, username policy,
product catalog, entitlement, provisioning, CMS/domain, identity, billing, POS, inventory,
finance/accounting, HR, workflow, notification, AI, observability, Help/Excel/PDF, dan capability
hospitality existing. Buat gap matrix berbasis evidence, lalu implementasikan mitrainap.id sebagai
vertical Hospitality pada satu platform eBisnis: portal, demo, website tenant, PMS, CRS, booking
engine, channel/distribution, revenue, front office, housekeeping, maintenance, folio, cashiering,
night audit, hotel POS, group/MICE, long stay, guest portal, mobile operations, reporting, security,
test, dokumentasi, commit, push, dan CI. Jangan membuat platform kedua dan jangan berhenti pada mock.
```

---

# 1. DOKUMEN WAJIB DIBACA

Cari dan baca versi yang benar-benar tersedia:

```text
BRD_eBisnis_ID_Versi_14_MitraInap_Hospitality_Lengkap.md
STRUKTUR_MENU_ROLE_PERMISSION_MITRAINAP_V14.md
SPESIFIKASI_UI_UX_RESPONSIVE_MITRAINAP_V14.md
PERINTAH_MASTER_CLAUDE_CODE_CODEX_EKSEKUSI_MITRAINAP_ID_HOSPITALITY_V14.md

PERINTAH_MASTER_CLAUDE_CODE_PLATFORM_KOLABORATIF_MULTI_PORTAL_*.md
BRD eBisnis Versi 13 atau versi terbaru yang tersedia
BRD eBisnis Versi 12, 11, 10 dan prompt implementasinya
PERINTAH_MASTER_CLAUDE_CODE_EKSEKUSI_SANTRI_INFO_EPESANTREN_MODERN_V2.md
PANDUAN_KOORDINASI_PARALEL_CORE_EMEDIK_EKOPERASI_INFO_DESA.md
PERINTAH_PRIORITAS_CLAUDE_CODE_IMPLEMENTASI_POS_WEB_EBISNIS_SETELAH_V11.md
PERINTAH_MASTER_CODEX_CLAUDE_IMPLEMENTASI_UI_EBISNIS_INVENTORY_48_LAYAR.md
PROMPT_CODEX_CLAUDE_V7_GIT_ONLY_MIGRATION_AND_CONTINUOUS_COMMIT.md
```

Baca source aktual:

```text
apps/api/package.json
apps/web/package.json
package.json
pnpm-workspace.yaml
apps/api/src/**
apps/api/prisma/**
apps/api/tenant-migrations/**
apps/web/src/**
apps/**flutter**/** jika tersedia
packages/**
docs/**
scripts/**
.github/workflows/**
```

Cari capability dengan istilah:

```text
portal, tenant, domain, CMS, identity, SSO, role, permission, active context
property, hotel, hospitality, room, reservation, booking, guest, folio
POS, inventory, procurement, finance, accounting, payment, refund
workflow, notification, Help, Excel, PDF, audit, observability, AI
```

Jika file tidak tersedia:

```text
jangan mengaku telah membacanya
catat MISSING_INPUT pada source manifest
lanjutkan berdasarkan source yang benar-benar tersedia
jangan mengarang perilaku provider/legacy
```

---

# 2. PRIORITAS SUMBER KEBENARAN

Jika terdapat konflik:

```text
1. Kebutuhan pengguna terbaru tentang mitrainap.id.
2. Dokumen master ini.
3. BRD MitraInap Versi 14.
4. Struktur menu/role dan spesifikasi UI/UX MitraInap Versi 14.
5. Dokumen platform kolaboratif multi-portal terbaru.
6. BRD/Prompt eBisnis versi terbaru yang benar-benar tersedia.
7. Source, migration, database, OpenAPI, dan test aktual sebagai kondisi implementasi.
8. Dokumentasi resmi provider/standar sebagai rekomendasi integrasi, bukan perilaku yang dikarang.
```

Label evidence:

```text
FACT
STRONG_INFERENCE
RECOMMENDATION
UAT_REQUIRED
```

Status implementation:

```text
DONE
PARTIAL
MISSING
BROKEN
CONFLICTING
BLOCKED
NOT_APPLICABLE
UNKNOWN
```

`DONE` hanya apabila seluruh bagian relevan tersedia dan lulus:

```text
model/migration
service/domain rule
API/DTO/OpenAPI
client generated
UI/route
permission/data scope/field mask
state transition/idempotency
notification/audit/observability
Help/Excel/PDF/report bila relevan
tests
build/smoke/UAT evidence
```

---

# 3. KEPUTUSAN ARSITEKTUR YANG TIDAK BOLEH DIUBAH SEMBARANGAN

## 3.1. Satu Platform

MitraInap harus memakai:

```text
satu repository
satu control plane
satu identity provider
satu tenant registry
satu global tenant username namespace
satu product/module catalog
satu pricing/contract/billing engine
satu subscription/entitlement engine
satu provisioning orchestrator
satu app shell
satu API gateway
satu event/outbox platform
satu workflow engine
satu notification hub
satu AI gateway
satu observability/audit platform
satu CMS/domain engine
satu Help/Excel/PDF framework
satu POS/inventory/procurement/finance/accounting/HR/asset/investor engine
```

Dilarang membuat repository, auth, billing, CMS, POS, inventory, accounting, workflow, notification, AI, audit, atau report engine kedua.

## 3.2. Portal dan Product

Tambahkan registry idempotent:

```text
PlatformPortal.code = MITRAINAP
PlatformPortal.primaryDomain = mitrainap.id
PlatformPortal.applicationDomain = app.mitrainap.id
PlatformPortal.demoDomain = demo.mitrainap.id
PlatformPortal.verticalCode = HOSPITALITY
PlatformPortal.preferredProductCode = MITRAINAP_HOSPITALITY
```

Product minimum:

```text
MITRAINAP_HOSPITALITY
MITRAINAP_PMS
MITRAINAP_BOOKING_ENGINE
MITRAINAP_CHANNEL_DISTRIBUTION
MITRAINAP_REVENUE
MITRAINAP_GUEST_EXPERIENCE
MITRAINAP_LONG_STAY
MITRAINAP_MICE
```

## 3.3. Global Username Tenant

Tenant username mengikuti registry platform existing:

```text
global unique case-insensitive di seluruh eBisnis
immutable setelah provisioning
lowercase
regex/policy existing
reserved words
atomic reservation
DB/service/API protection
mutation attempt audited
```

Jangan membuat namespace username khusus MitraInap.

Public subdomain memakai deterministic DNS-safe slug:

```text
tenantUsername: hotel_jaya
publicTenantSlug: hotel-jaya
host: hotel-jaya.mitrainap.id
```

Mapping disimpan versioned pada domain registry. Hostname tidak boleh langsung dikonversi menjadi schema.

## 3.4. Schema

Gunakan module schema registry, contoh:

```text
{tenantUsername}_core
{tenantUsername}_hospitality
{tenantUsername}_pos          jika entitlement aktif
{tenantUsername}_inventory    jika entitlement aktif
{tenantUsername}_finance      jika entitlement aktif
{tenantUsername}_accounting   jika entitlement aktif
{tenantUsername}_hr           jika entitlement aktif
{tenantUsername}_marketplace  jika entitlement aktif
{tenantUsername}_website      sesuai registry existing
```

Physical schema name hanya dari server-side registry.

## 3.5. Bounded Context dan Public Ports

Hospitality tidak boleh membaca internals modul lain langsung. Gunakan:

```text
IdentityPort
OrganizationPort
EntitlementPort
PricingPort
BillingPort
CmsPort
DomainPort
WorkflowPort
NotificationPort
PaymentPort
AccountingEventPort
InventoryPort
ProcurementPort
PosPort
HrPayrollPort
AssetPort
InvestorPort
FileStoragePort
SearchPort
AiGatewayPort
AuditPort
ObservabilityPort
TicketingPort
MarketplacePort
```

---

# 4. WORKTREE, BRANCH, DAN ANTI-BENTROK

Buat worktree khusus:

```powershell
Set-Location C:\opt\eBisnisGithub

git status --short --branch
git fetch origin
git checkout main
git pull --ff-only origin main

git worktree add C:\opt\eBisnisGithub-mitrainap `
  -b feature/v14-mitrainap-hospitality main

git worktree list
Set-Location C:\opt\eBisnisGithub-mitrainap
```

Jika branch sudah ada:

```powershell
git worktree add C:\opt\eBisnisGithub-mitrainap `
  feature/v14-mitrainap-hospitality
```

Verifikasi:

```powershell
(Get-Location).Path
git rev-parse --show-toplevel
git branch --show-current
git status
git remote -v
```

Expected:

```text
Path   = C:\opt\eBisnisGithub-mitrainap
Branch = feature/v14-mitrainap-hospitality
```

Jangan bekerja pada worktree Core/POS, Santri, eMedik, eKoperasi, info-desa, Enterprise Education, atau integrator lain.

## 4.1. File High-Conflict

Jangan mengubah langsung tanpa koordinasi:

```text
root package.json
pnpm-lock.yaml
pnpm-workspace.yaml
root tsconfig/build config
root Prisma loader/index
global migration catalog
global tenant/domain resolver
global identity/auth
shared accounting/POS/inventory semantics
global menu/role registry
root OpenAPI/Orval aggregate
root CHANGELOG.md
.github/workflows/**
CODEOWNERS
```

Jika shared change diperlukan, buat:

```text
docs/integration-requests/hospitality/<nomor>-<judul>.md
```

Dokumen harus memuat kebutuhan, kontrak, backward compatibility, migration, test, security, affected files, dan patch proposal. Sesi Core/Integrator yang menggabungkan shared change.

---

# 5. LARANGAN KERAS

Dilarang:

```text
membuat project NestJS/Vite/Flutter kedua tanpa ADR
membuat database platform kedua
membuat username tenant namespace kedua
menerima schema name dari client/host/header/body
mengubah tenant username setelah provisioning
menggunakan demo sebagai production data
menagihkan sample/demo data
menghard-code harga SaaS yang belum diputuskan
mengubah histori rate/price/contract yang sudah dipakai transaksi
menyimpan full card number/CVV/payment credential
menganggap payment URL sebagai bukti pembayaran
mengizinkan duplicate payment/check-in/check-out/night audit
mengurangi stock atau memposting jurnal dari frontend
mengedit posted folio/journal secara diam-diam
menghapus transaksi posted secara fisik
mengarang endpoint OTA/GDS/payment/digital key/IoT
memakai direct table access antar bounded context
mengaktifkan menu tanpa entitlement
mengandalkan hidden button sebagai security
menyimpan token di localStorage
mengirim PII/payment/incident mentah ke AI
memberi AI hak publish rate, refund, key issue, check-in/out, atau night audit otomatis
mengedit migration applied
prisma migrate reset
prisma db push sebagai pengganti migration
DROP DATABASE
DROP SCHEMA CASCADE
menimpa .env
commit secret/private key/customer upload/dump/log
force push branch bersama
mengklaim selesai sebelum test/build/smoke/CI benar-benar dijalankan
```

---

# 6. NAMESPACE IMPLEMENTASI

Ikuti struktur existing. Bila boundary belum tersedia, gunakan:

```text
apps/api/src/modules/hospitality/**
apps/web/src/verticals/hospitality/**
packages/hospitality-domain/**
packages/hospitality-contracts/**
packages/hospitality-ui/**
packages/api-client-hospitality/**
docs/mitrainap/**
docs/changelog/hospitality.md
docs/integration-requests/hospitality/**
```

API:

```text
/api/v1/hospitality/**
```

Permission:

```text
HOSPITALITY.*
```

Events:

```text
hospitality.*
```

OpenAPI vertical:

```text
openapi-hospitality.json
```

Jangan mengedit generated client manual.

---

# 7. FASE MI-0 — AUDIT DAN BASELINE

Jangan coding besar sebelum MI-0 selesai, di-commit, dan dipush.

## 7.1. Baseline Command

Gunakan script aktual, jangan mengarang:

```powershell
Set-Location C:\opt\eBisnisGithub-mitrainap

git status
git branch --show-current
git log -10 --oneline
gh auth status

pnpm install --frozen-lockfile
pnpm db:validate
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

Jika script berbeda, dokumentasikan command aktual dan hasilnya.

## 7.2. Capability Audit

Audit minimal:

```text
portal registry/theme/navigation/CMS/SEO
central SSO/BFF session/active role
platform person/user/tenant/membership
username reservation/immutability
subdomain/custom-domain registry/resolver/TLS
product/module/capability catalog
pricing/contract/subscription/usage/billing
entitlement/provisioning/schema registry/migration loader
app shell/context switcher/global search
workflow/task/notification/surat/ticketing
AI gateway/RAG/policy/audit
observability/logging/audit
Help/Excel/PDF/report snapshot
POS/inventory/procurement/finance/accounting/HR/asset/investor
payment/provider abstraction
website tenant/booking/e-commerce capability
existing hotel/property/reservation/room models
Flutter/mobile/offline capability
sample data factory
CI/CD/release/update/rollback
```

## 7.3. Dokumen Audit Wajib

Buat:

```text
docs/mitrainap/00-source-availability.md
docs/mitrainap/01-current-state.md
docs/mitrainap/02-portal-domain-username-inventory.md
docs/mitrainap/03-hospitality-capability-inventory.md
docs/mitrainap/04-reuse-extend-adapter-create-matrix.md
docs/mitrainap/05-data-model-gap.md
docs/mitrainap/06-api-route-map.md
docs/mitrainap/07-ui-route-map.md
docs/mitrainap/08-product-entitlement-schema-map.md
docs/mitrainap/09-pricing-billing-analysis.md
docs/mitrainap/10-role-permission-data-scope-analysis.md
docs/mitrainap/11-shared-port-adapter-map.md
docs/mitrainap/12-security-privacy-payment-threat-model.md
docs/mitrainap/13-demo-sample-plan.md
docs/mitrainap/14-migration-import-plan.md
docs/mitrainap/15-test-baseline.md
docs/mitrainap/16-implementation-plan.md
docs/mitrainap/17-high-conflict-file-map.md
docs/mitrainap/18-risk-register.md
docs/mitrainap/19-requirement-ledger.csv
```

Kolom ledger minimum:

```text
requirement_id
module
requirement
source
source_location
evidence_label
current_status
target_phase
model_evidence
migration_evidence
api_evidence
ui_evidence
permission_evidence
test_evidence
uat_evidence
owner
notes
```

## 7.4. Commit Audit

```powershell
git add docs/mitrainap docs/changelog/hospitality.md
git diff --cached
git commit -m "docs(hospitality): audit MitraInap platform and domain gaps"
git push -u origin feature/v14-mitrainap-hospitality
```

Jangan mengaku push/CI berhasil bila belum dilakukan.

---

# 8. MODEL PORTAL, PRODUCT, MODULE, DAN MANIFEST

## 8.1. Portal Registry

Seed idempotent:

```text
MITRAINAP
mitrainap.id
app.mitrainap.id
demo.mitrainap.id
HOSPITALITY
MITRAINAP_HOSPITALITY
id-ID
Asia/Jakarta default configurable
```

Brand token:

```text
logo
favicon
primary/secondary/accent
surface tokens
typography
illustration style
icon style
tone of voice
social image
```

## 8.2. Module Code Minimum

```text
HOSPITALITY_FOUNDATION
HOSPITALITY_PUBLIC_PORTAL
HOSPITALITY_TENANT_WEBSITE
HOSPITALITY_CMS
HOSPITALITY_DIRECT_BOOKING
HOSPITALITY_PROPERTY
HOSPITALITY_ROOM_INVENTORY
HOSPITALITY_GUEST_CRM
HOSPITALITY_RESERVATION
HOSPITALITY_CRS
HOSPITALITY_RATE
HOSPITALITY_REVENUE
HOSPITALITY_CHANNEL
HOSPITALITY_FRONT_OFFICE
HOSPITALITY_HOUSEKEEPING
HOSPITALITY_LINEN_LAUNDRY
HOSPITALITY_MAINTENANCE
HOSPITALITY_FOLIO
HOSPITALITY_CASHIER
HOSPITALITY_NIGHT_AUDIT
HOSPITALITY_POS_ADAPTER
HOSPITALITY_GROUP_CORPORATE
HOSPITALITY_MICE
HOSPITALITY_GUEST_SERVICE
HOSPITALITY_SPA_RECREATION
HOSPITALITY_LONG_STAY
HOSPITALITY_OWNER_MANAGEMENT
HOSPITALITY_GUEST_PORTAL
HOSPITALITY_STAFF_MOBILE
HOSPITALITY_KIOSK
HOSPITALITY_DIGITAL_KEY_ADAPTER
HOSPITALITY_IOT_ADAPTER
HOSPITALITY_REPORTING
HOSPITALITY_AI_USE_CASES
```

## 8.3. Manifest

Setiap module mempunyai manifest versioned:

```text
moduleCode
verticalCode
productCode
version
displayName
description
schemaSuffix
routes
menus
roles
permissions
dependencies
conflicts
eligibility
billingMetrics
migrations
seedProfiles
helpTopics
eventsPublished
eventsConsumed
portsRequired
dataClassification
retention
healthChecks
sampleDataProfile
```

---

# 9. DOMAIN, DEMO, TENANT WEBSITE, DAN RESOLUTION

Host:

```text
mitrainap.id                       public portal
www.mitrainap.id                   canonical redirect
app.mitrainap.id                   shared app shell
api.mitrainap.id                   jika arsitektur gateway existing memakai host ini
demo.mitrainap.id                  demo tenant/site reserved
{publicTenantSlug}.mitrainap.id    tenant public website/booking
custom domain verified             optional
```

Reserved slug minimum:

```text
www app api auth admin console support status docs assets cdn static media mail
login register demo sandbox test staging booking book reserve reservations
```

Resolution:

```text
Incoming Host
-> Normalize/IDNA
-> Reserved Host Check
-> Portal Domain Registry
-> Tenant Domain Registry
-> Tenant Status
-> Entitlement
-> CMS/Booking Site
-> Safe Context
```

`demo.mitrainap.id`:

```text
reserved
sample-only
not billable
resettable
banner DEMO
no production credential
no real payment by default
outbound notification sandboxed
```

---

# 10. PRICING DAN BILLING

Jangan mengarang harga MitraInap.

Sebelum keputusan komersial tersedia:

```text
priceStatus = PRICE_CONFIGURATION_REQUIRED
CTA = Minta Penawaran / Konsultasi
```

Pricing tetap memakai shared versioned catalog, contract, override, quote, usage, invoice, credit note, dan audit.

Metric yang dapat dikonfigurasi:

```text
PROPERTY_MONTH
SELLABLE_UNIT_MONTH
ACTIVE_ROOM_MONTH
BED_MONTH
RESERVATION_MONTH
BOOKING_ENGINE_TRANSACTION
CHANNEL_CONNECTION_MONTH
POS_REGISTER_MONTH
MODULE_BUNDLE
CONTRACT_DEFINED
```

Sample/demo/test/training/reversed usage tidak billable.

Pisahkan:

```text
Platform Subscription Payment
!= Guest Reservation Payment
!= POS Payment
!= Tenant Operational Receivable
!= Owner/Investor Settlement
```

---

# 11. FASE IMPLEMENTASI WAJIB

Kerjakan vertical slice; jangan membuat seluruh model dahulu lalu menunda UI/API/test.

## MI-1 — Portal Registry dan Ecosystem Integration

Implement:

```text
MITRAINAP portal registry
brand/theme/navigation/footer
cross-portal links
portal context
public routing
SEO foundation
registration attribution
```

DoD:

```text
mitrainap.id dirender shared portal engine
no duplicate CMS
unified login
portal code and analytics context correct
```

Commit contoh:

```text
feat(hospitality-portal): add MitraInap portal registry and branding
```

## MI-2 — Homepage MitraInap dan Marketing CMS

Implement seluruh section BRD/UI:

```text
homepage
solution pages
feature pages
pricing consultation
demo page
lead/contact/registration
FAQ/blog/help
SEO/structured data/sitemap
responsive/accessibility/performance
```

Commit:

```text
feat(hospitality-web): add CMS-driven MitraInap public portal
```

## MI-3 — Tenant Website, Subdomain, Custom Domain, Booking Site

Implement:

```text
publicTenantSlug mapping
wildcard tenant site
CMS provisioning
theme/page/article/gallery/menu
publication workflow
custom domain verification/TLS state
booking route
```

Commit:

```text
feat(hospitality-site): add tenant website domain and CMS provisioning
```

## MI-4 — Product, Package, Entitlement, Pricing, Provisioning

Implement:

```text
product/module manifests
package offerings without invented price
entitlement dependencies
schema provisioning
role/menu/help seed
usage meter contracts
health check
```

Commit:

```text
feat(hospitality-platform): add product entitlement and provisioning
```

## MI-5 — Property Foundation dan Active Context

Implement:

```text
portfolio/brand/legal entity/property/building/floor/zone
room type/room/unit/bed/space
facility/outlet/service point
business date/property timezone
active property/role/context
```

Commit:

```text
feat(hospitality-foundation): add property and operational context
```

## MI-6 — Room Inventory dan Availability

Implement:

```text
sellable inventory hierarchy
room status
OOO/OOS/block
inventory ledger by stay date
availability calculation
allotment/overbooking policy
room feature/accessibility
```

Concurrency and reconciliation tests wajib.

Commit:

```text
feat(hospitality-inventory): add room inventory and availability
```

## MI-7 — Guest Identity, CRM, Consent, Privacy

Implement:

```text
golden guest profile
identifier/contact/address
companion/relationship
preference/loyalty
consent/communication
company/travel agent link
duplicate detection and controlled merge
privacy request/retention
incident/do-not-rent restricted
```

Commit:

```text
feat(hospitality-guest): add guest CRM identity and privacy controls
```

## MI-8 — Reservation dan CRS

Implement:

```text
availability quote
reservation/room stay/guest
hold/confirm/modify/cancel/no-show/reinstate
multi-room/multi-guest
source/channel/market segment
special request/package/add-on
waitlist/walk-in
confirmation/document/audit
```

Idempotency, price snapshot, restriction snapshot, and optimistic lock wajib.

Commit:

```text
feat(hospitality-reservation): add PMS reservation and CRS lifecycle
```

## MI-9 — Direct Booking Engine

Implement:

```text
search/results/room/rate/add-on/guest/payment/confirmation/manage booking
transparent total/policy
rate/inventory validation
payment orchestration
abandoned/recovery flow
mobile-first/accessibility/SEO
```

No dark pattern. No duplicate booking/payment.

Commit:

```text
feat(hospitality-booking): add direct booking engine
```

## MI-10 — Rate, Restriction, dan Revenue Management

Implement:

```text
rate plan/rate code/package
BAR/derived rate
occupancy/pricing rule
MinLOS/MaxLOS/CTA/CTD/stop sell
rate calendar
pickup/pace/forecast
recommendation review
publish approval/audit
```

Commit:

```text
feat(hospitality-revenue): add rate restrictions and revenue workspace
```

## MI-11 — Channel Manager dan Distribution

Implement provider-neutral contracts:

```text
channel account
property/room/rate mapping
ARI push/pull
reservation delivery
modification/cancellation
queue/retry/dead-letter
reconciliation
health/parity dashboard
```

Jangan mengarang endpoint OTA/GDS. Live adapter `BLOCKED` sampai dokumentasi/credential tersedia; contract/test double tetap diimplementasikan.

Commit:

```text
feat(hospitality-channel): add distribution contracts and reconciliation
```

## MI-12 — Front Office

Implement:

```text
arrivals/departures/in-house
pre-arrival
registration card
room assignment
check-in
key/digital key contract
room move
extend/shorten
late checkout
check-out
walk/overbooking exception
shift handover
```

Commit:

```text
feat(hospitality-frontdesk): add guest stay and front-office operations
```

## MI-13 — Housekeeping, Linen, Laundry, Minibar, Lost-and-Found

Implement desktop supervisor and mobile worker:

```text
room board
assignment/task/checklist
start/pause/complete/inspect
DND/refused/discrepancy
linen/laundry
minibar posting adapter
lost-and-found custody
photo/offline queue
```

Commit:

```text
feat(hospitality-housekeeping): add room operations and mobile tasks
```

## MI-14 — Maintenance, Engineering, Asset, OOO/OOS

Implement:

```text
work request/order
triage/SLA/assignment
asset/room history
part/vendor
preventive maintenance
room closure impact
OOO/OOS approval
mobile engineer
```

Reuse shared asset/inventory/procurement.

Commit:

```text
feat(hospitality-maintenance): add engineering and room downtime
```

## MI-15 — Folio, Cashiering, Deposit, Payment, City Ledger

Implement:

```text
folio/windows
charge/tax/service/package
routing/split/transfer
adjustment/void/reversal
cashier/shift
payment/deposit/refund/authorization
invoice/receipt
city ledger/direct bill
credit limit
source-to-accounting trace
```

Money uses Decimal. Posted transactions immutable/reversal. Payment and completion idempotent.

Commit:

```text
feat(hospitality-folio): add cashiering folio and payment lifecycle
```

## MI-16 — Night Audit dan Income Audit

Implement:

```text
business date
precheck rules
exception queue
room/tax/package posting
no-show/late charge policy
cashier/POS/channel/interface check
balance reconciliation
report snapshot
step progress/retry/resume
final business-date roll
income audit review
```

No duplicate posting. Final roll step-up and immutable audit.

Commit:

```text
feat(hospitality-night-audit): add idempotent end-of-day control
```

## MI-17 — POS Hospitality dan F&B

Extend shared POS:

```text
property/outlet/register/shift context
room/guest lookup
room charge
meal plan/package entitlement
service charge/tax
restaurant/bar/room service/minibar/retail/spa outlets
kitchen/order status contract
stock/accounting/receipt/refund
```

Jangan membuat POS kedua.

Commit:

```text
feat(hospitality-pos): add room-charge and hotel outlet extensions
```

## MI-18 — Group, Corporate, Allotment, MICE, Banquet

Implement:

```text
company/travel agent contract
negotiated rate
group/block/allotment
pickup/cutoff
rooming list
master/sub folio
function space/calendar
event/BEO/setup/catering
billing instruction
conflict/revenue impact
```

Commit:

```text
feat(hospitality-mice): add group corporate and event operations
```

## MI-19 — Guest Service, Concierge, Ancillary, Reputation

Implement:

```text
guest request/task/SLA
concierge/transport/parking/activity/spa
parcel/visitor where relevant
pre/in/post-stay communication
preference/consent
feedback/review/reputation integration contracts
```

Commit:

```text
feat(hospitality-guest-service): add service journey and ancillary operations
```

## MI-20 — Long Stay, Kos, Rental, Owner Management

Implement configurable terminology and lifecycle:

```text
resident/tenant
unit/bed contract
move-in/out inspection
deposit/recurring rent
utility meter/charge
renewal/termination
collection
owner unit/contract/commission
owner statement/performance
```

Commit:

```text
feat(hospitality-longstay): add rental and owner management
```

## MI-21 — Guest Portal, Staff Mobile, Kiosk, Digital Key, IoT

Implement:

```text
guest booking/stay/folio/request/checkout
staff mobile role workspaces
offline queue/sync visibility
self check-in/out kiosk
digital key provider contract
IoT room/device provider contract
privacy/session residue controls
```

Provider live call tidak dibuat tanpa contract.

Commit:

```text
feat(hospitality-experience): add guest and staff self-service channels
```

## MI-22 — ERP Integration dan Accounting Events

Integrate:

```text
inventory/procurement
finance/accounting
cash/bank/AR/AP
HR/payroll/workforce
asset
investor/owner
workflow/surat/ticket
marketplace/add-on where relevant
```

Accounting events versioned; no debit/credit hard-code in controller.

Commit:

```text
feat(hospitality-erp): add canonical ERP ports events and reconciliation
```

## MI-23 — Reporting, AI, Help, Sample, Observability

Implement:

```text
operational/revenue/finance/guest/HK/maintenance/channel/POS reports
report snapshots/PDF/Excel
AI read-only/draft use cases with evidence
Help/flowchart/guided tour
sample data generator/demo reset
notification
observability/audit/security dashboards
```

Commit:

```text
feat(hospitality-insight): add reports AI Help and demo scenarios
```

## MI-24 — Security, Performance, UAT, Release

Run:

```text
full regression Core + Hospitality
migration rehearsal
cross-tenant/property negative tests
API/authorization/security tests
payment/replay/idempotency tests
load/concurrency tests
accessibility/visual tests
backup/restore/DR drill
UAT persona
release notes/runbook/rollback
```

Commit:

```text
test(hospitality): complete security performance and end-to-end UAT
```

---

# 12. DATA MODEL MINIMUM

Reuse first. Gap model minimum:

```text
HospitalityTenantProfile
HospitalityProperty
PropertyBuilding
PropertyFloor
PropertyZone
PropertyFacility
RoomType
Room
RoomFeature
BedType
SellableUnit
BusinessDate
RoomStatusHistory
RoomBlock
OutOfOrder
OutOfService
Guest
GuestIdentifier
GuestContact
GuestPreference
GuestConsent
GuestRelationship
GuestMergeCase
GuestRestriction
Reservation
ReservationRoomStay
ReservationGuest
ReservationRateSnapshot
ReservationRestrictionSnapshot
ReservationSource
ReservationStatusHistory
AvailabilityQuote
InventoryByStayDate
RatePlan
RateCode
DailyRate
Restriction
Package
AddOn
CompanyAccount
TravelAgent
ChannelAccount
ChannelMapping
AriMessage
ChannelReservationMessage
FrontOfficeRegistration
RoomAssignment
RoomMove
KeyAccessReference
Folio
FolioWindow
FolioTransaction
FolioRouting
Deposit
PaymentReference
CashierShift
CityLedgerAccount
HousekeepingTask
HousekeepingInspection
RoomDiscrepancy
LinenTransaction
LaundryOrder
LostAndFound
MaintenanceWorkOrder
PreventiveMaintenance
NightAuditRun
NightAuditStep
NightAuditException
NightAuditSnapshot
GroupBooking
RoomBlockAllotment
RoomingList
FunctionSpace
EventBooking
BanquetEventOrder
GuestServiceRequest
LongStayContract
RecurringCharge
UtilityMeter
OwnerUnit
OwnerContract
OwnerStatement
```

Cross-cutting fields:

```text
id
propertyId/tenantId via context
status
version
businessDate
createdAt/By
updatedAt/By
postedAt/By
cancelledAt/By/reason
reversalOfId
correlationId
idempotencyKey
source/channel
isSampleData/sampleBatchId
```

Uang, rate, tax, quantity, occupancy, percentage use Decimal/value objects; jangan floating point.

---

# 13. STATE MACHINE MINIMUM

```text
Reservation:
INQUIRY, QUOTED, ON_HOLD, CONFIRMED, WAITLISTED, CANCELLED, NO_SHOW,
PRE_REGISTERED, CHECKED_IN, CHECKED_OUT, WALKED, REINSTATED

Room Front Office:
VACANT, RESERVED, OCCUPIED, DUE_OUT, CHECKED_OUT, BLOCKED

Housekeeping:
CLEAN, DIRTY, INSPECT, PICKUP, DND, REFUSED, DISCREPANCY

Maintenance:
AVAILABLE, OUT_OF_SERVICE, OUT_OF_ORDER, MAINTENANCE_PENDING

Folio:
OPEN, PARTIALLY_PAID, SETTLED, CLOSED, REOPENED, DISPUTED, REVERSED

Night Audit:
DRAFT, PRECHECK, BLOCKED, RUNNING, PAUSED, FAILED, READY_TO_ROLL,
COMPLETED, REVERSED_BY_CONTROLLED_PROCESS

Sync:
LOCAL_DRAFT, QUEUED, SYNCING, SYNCED, CONFLICT, FAILED, REJECTED
```

Client tidak boleh mengubah status bebas; gunakan command service.

---

# 14. API MINIMUM

Gunakan endpoint existing bila setara. Semantik minimum:

```text
GET/POST/PATCH /api/v1/hospitality/properties
GET /api/v1/hospitality/context
GET/POST/PATCH /api/v1/hospitality/room-types
GET/POST/PATCH /api/v1/hospitality/rooms
GET /api/v1/hospitality/availability
POST /api/v1/hospitality/quotes
GET/POST/PATCH /api/v1/hospitality/guests
POST /api/v1/hospitality/guests/merge-preview
POST /api/v1/hospitality/guests/:id/merge
GET/POST/PATCH /api/v1/hospitality/reservations
POST /api/v1/hospitality/reservations/:id/confirm
POST /api/v1/hospitality/reservations/:id/modify
POST /api/v1/hospitality/reservations/:id/cancel
POST /api/v1/hospitality/reservations/:id/no-show
POST /api/v1/hospitality/reservations/:id/reinstate
POST /api/v1/hospitality/reservations/:id/assign-room
POST /api/v1/hospitality/reservations/:id/check-in
POST /api/v1/hospitality/stays/:id/room-move
POST /api/v1/hospitality/stays/:id/extend
POST /api/v1/hospitality/stays/:id/check-out
GET/POST/PATCH /api/v1/hospitality/rates
GET/POST/PATCH /api/v1/hospitality/restrictions
POST /api/v1/hospitality/rates/publish
GET /api/v1/hospitality/revenue/pickup
GET /api/v1/hospitality/channels/health
POST /api/v1/hospitality/channels/:id/sync
GET/POST/PATCH /api/v1/hospitality/housekeeping/tasks
POST /api/v1/hospitality/housekeeping/tasks/:id/start
POST /api/v1/hospitality/housekeeping/tasks/:id/complete
POST /api/v1/hospitality/housekeeping/tasks/:id/inspect
GET/POST/PATCH /api/v1/hospitality/maintenance/work-orders
POST /api/v1/hospitality/rooms/:id/out-of-order
GET/POST /api/v1/hospitality/folios
POST /api/v1/hospitality/folios/:id/charges
POST /api/v1/hospitality/folios/:id/payments
POST /api/v1/hospitality/folios/:id/refunds
POST /api/v1/hospitality/folios/:id/transfer
GET/POST /api/v1/hospitality/night-audits
POST /api/v1/hospitality/night-audits/:id/precheck
POST /api/v1/hospitality/night-audits/:id/run-step
POST /api/v1/hospitality/night-audits/:id/roll-business-date
GET/POST/PATCH /api/v1/hospitality/groups
GET/POST/PATCH /api/v1/hospitality/events
GET/POST/PATCH /api/v1/hospitality/long-stay/contracts
GET /api/v1/hospitality/reports
```

Public booking API terpisah dan rate-limited:

```text
GET  /api/v1/public/hospitality/sites/:site
POST /api/v1/public/hospitality/availability
POST /api/v1/public/hospitality/quotes
POST /api/v1/public/hospitality/bookings
GET  /api/v1/public/hospitality/bookings/:token
POST /api/v1/public/hospitality/bookings/:token/cancel
```

Public token signed/opaque; jangan expose tenant schema/internal ID.

---

# 15. RBAC, DATA SCOPE, FIELD MASK, SOD

Gunakan dokumen menu/role MitraInap.

Role minimum:

```text
Administrator MitraInap Tenant
Administrator Property
General Manager
Front Office Manager
Reservation Manager
Reservation Agent
Front Desk Agent
Night Auditor
Cashier
Housekeeping Manager
Housekeeping Supervisor
Housekeeper
Chief Engineer
Engineer
Revenue Manager
Distribution Manager
F&B Manager
POS Cashier
Sales/MICE Manager
Event Coordinator
Guest Service/Concierge
Long Stay Manager
Owner Portal User
Auditor Hospitality
Support Read-only Time-bound
```

Data scope:

```text
PLATFORM
TENANT
PORTFOLIO
BRAND
LEGAL_ENTITY
PROPERTY
BUILDING
FLOOR
ZONE
OUTLET
REGISTER
SHIFT
DEPARTMENT
OWN_RECORD
ASSIGNED_TASK
COMPANY_ACCOUNT
OWNER_UNIT
```

Sensitive fields:

```text
guest identity document
contact
payment token/reference
negotiated/net rate
commission
incident/do-not-rent
bank account
owner/investor data
staff personal data
```

SoD minimum:

```text
rate creator != final publisher where policy active
cashier != refund approver over threshold
front desk agent != own high-value adjustment approver
night auditor != unresolved exception owner final approval
housekeeper != inspector when dual inspection required
payment maker != reconciliation approver
owner portal cannot access other owner/unit
support access time-bound and audited
AI never acts as approver/poster/releaser
```

---

# 16. UI/UX IMPLEMENTATION STANDARD

Wajib mengikuti `SPESIFIKASI_UI_UX_RESPONSIVE_MITRAINAP_V14.md`.

```text
responsive desktop/tablet/mobile
shared design tokens/components
role-specific start page
Today Command Center
Tape Chart with mobile alternative
reservation/front-office workspace
mobile housekeeping/engineering
folio and night-audit control center
transparent no-dark-pattern booking engine
WCAG 2.2 AA target
loading/empty/error/offline/stale/permission states
keyboard/touch support
visual regression viewports
```

Tombol tidak boleh semu. Action disabled mempunyai alasan. Financial/operational final action menampilkan result/reference.

---

# 17. SECURITY, PRIVACY, PAYMENT, DAN AUDIT

Wajib:

```text
OIDC Authorization Code + PKCE/BFF session existing
HttpOnly Secure SameSite cookies
CSRF protection
CSP/XSS protection
BOLA/BFLA/mass-assignment negative tests
tenant/property/object authorization
rate limit and abuse detection
signed/replay-protected webhook
idempotency and correlation ID
payment tokenization/provider-hosted handling
no PAN/CVV storage
field masking and step-up
privacy consent/purpose/retention/export/delete workflow
audit for reveal/export/print/payment/refund/rate/night audit/key
secret vault
backup/restore/DR
```

Indonesian privacy and tourism requirements are configurable compliance inputs; do not claim certification without evidence.

---

# 18. TEST MATRIX

## 18.1. Unit

```text
availability
rate derivation/restriction
occupancy/ADR/RevPAR
reservation state machine
room status
folio/tax/routing
night audit posting
payment allocation
owner/long-stay calculation
```

## 18.2. Integration

```text
tenant/property isolation
transaction atomicity
idempotency
optimistic locking
outbox/retry
POS room charge
inventory/accounting event
payment callback/inquiry
channel queue
business date
```

## 18.3. E2E Critical Journey

```text
public search -> quote -> booking -> payment -> confirmation
OTA reservation delivery -> room assignment -> check-in -> POS charge -> checkout
housekeeping dirty -> clean -> inspect -> room ready
maintenance -> OOO -> repair -> inspect -> available
night audit precheck -> resolve -> post -> report -> roll business date
group block -> rooming list -> arrivals -> master folio
long stay contract -> recurring rent -> meter -> payment -> renewal/move-out
```

## 18.4. Security

```text
wrong tenant/property
IDOR/BOLA/BFLA
role switch
session fixation/CSRF/XSS
booking enumeration
webhook replay
payment duplicate
rate publish bypass
field reveal/export
AI data exfiltration
kiosk residue
offline replay
```

## 18.5. Performance

```text
availability search
booking concurrency
same last room race
Tape Chart large property
Today dashboard
housekeeping burst
channel message burst
POS room charge
night audit large property
report generation
multi-property dashboard
```

## 18.6. Accessibility/Visual

Gunakan viewport dan checks pada UI/UX document.

---

# 19. DEMO DAN SAMPLE DATA

`demo.mitrainap.id` minimum mempunyai beberapa scenario, bukan hanya satu hotel kosong:

```text
City Hotel
Resort/Cottage
Hostel/Capsule
Kos/Co-living Long Stay
Multi-property portfolio
```

Sample minimum reasonable:

```text
5 properties
10–20 room types
100–300 sellable rooms/units/beds
500–1,500 guest profiles
500–2,000 reservations across statuses
rate/restriction/channel history
housekeeping tasks and discrepancies
maintenance work orders
folios/payments/refunds
POS room charges
night audit runs
MICE/group/long-stay records
```

Semua record:

```text
isSampleData=true
sampleBatchId
sampleScenarioCode
not billable
soft-delete/resettable
```

Demo payment/provider/outbound communication uses sandbox/test doubles unless official sandbox credentials available.

---

# 20. MIGRATION DAN IMPORT

Support import from:

```text
CSV/Excel
legacy PMS export
channel reservation export
guest master
room/rate setup
future provider API
```

Flow:

```text
source manifest/checksum
-> quarantine
-> parse/stage
-> validate/normalize
-> duplicate/orphan analysis
-> preview
-> approval
-> apply idempotently
-> reconcile
-> report/sign-off
```

Jangan langsung menulis production from upload. Leading zeros, phone, confirmation number, and room number remain text. Formula injection and malicious file tests wajib.

---

# 21. OBSERVABILITY DAN OPERATIONS

Telemetry context:

```text
portalCode
verticalCode
productCode
moduleCode
tenantId
propertyId
businessDate
activeRoleId
reservationId/stayId/folioId where safe
channel/provider
correlationId
traceId
releaseVersion
```

Dashboard:

```text
availability latency/error
booking conversion/failure
channel sync queue/failure
payment pending/duplicate
check-in/out error
housekeeping SLA
maintenance downtime
night audit duration/blocker
POS room-charge failure
report duration
cross-tenant denial anomaly
```

Jangan log PII/payment secret/raw identity documents.

---

# 22. HELP, DOCUMENTATION, DAN TRAINING

Setiap production screen:

```text
Quick Help
Full Guide
Prerequisite Checklist
Click-by-click
Field Dictionary
Diagram/Flowchart
Troubleshooting
FAQ
What Next
Guided Tour
```

Guided tour tidak boleh melakukan booking/payment/check-in/out/rate publish/night audit/destructive action otomatis.

Buat user guides per persona and UAT scripts.

---

# 23. GIT, COMMIT, PUSH, CI

Setiap logical slice:

```powershell
git status
git diff --stat
git diff
git add <relevant files>
git diff --cached
git commit -m "<conventional commit>"
git push
```

Jangan campur audit, migration, backend, UI, generated client, and unrelated formatting dalam satu commit besar jika dapat dipisah aman.

Update modular changelog pada setiap user-facing change. Root changelog digabung Core/Integrator bila file high-conflict.

Jangan menyatakan fase selesai sebelum:

```text
test relevant green
build relevant green
commit SHA tersedia
push benar-benar berhasil
CI status diperiksa
working tree status diketahui
```

---

# 24. FORMAT LAPORAN PER FASE

```text
phase
status before
status after
requirements covered
files created/modified
migration/backfill
models/tables
service/rules/state machine
API/OpenAPI/generated client
UI/routes/responsive states
menu/role/permission/data scope
notification/audit/observability
Help/Excel/PDF/report
unit/integration/E2E/security/performance/accessibility tests
commands and results
known issues
risks
rollback/compatibility
commit SHA
push status
CI status
UAT evidence
next incomplete phase
```

Jangan hanya menulis `selesai`.

---

# 25. KONDISI BERHENTI

Lanjutkan otomatis untuk pekerjaan normal. Berhenti dan laporkan secara jujur hanya jika:

```text
secret/private credential terdeteksi
GitHub auth gagal dan push benar-benar wajib
production migration membutuhkan approval
destructive migration tidak dapat dihindari
risiko kehilangan booking/payment/folio/journal
provider contract/credential diperlukan untuk live call
critical accounting or inventory inconsistency
keputusan harga/fee/tax yang tidak dapat dibuktikan
regulatory/legal claim memerlukan konfirmasi resmi
```

Meskipun provider live blocked, implementasikan provider-neutral contract, test double, config, health UI, and honest `BLOCKED` status. Lanjutkan fase lain.

---

# 26. DEFINITION OF DONE

```text
MITRAINAP portal registered and active
mitrainap.id rendered from shared portal/CMS engine
app.mitrainap.id uses shared identity/app shell
demo.mitrainap.id reserved, sample-only, resettable, not billable
tenant username globally unique and immutable
publicTenantSlug deterministic and registry-backed
tenant subdomain/custom domain safe and isolated
product/module manifests and entitlement available
pricing uses versioned catalog without invented value
property/room/business-date context works
room inventory/availability concurrency safe
guest identity/consent/privacy works
reservation/CRS full lifecycle works
direct booking engine transparent and responsive
rate/restriction/revenue workspace works
channel contracts/queue/reconciliation work
front office check-in/room move/check-out works
housekeeping mobile and inspection work
maintenance/OOO/OOS work
folio/cashier/payment/refund/city ledger work
night audit idempotent and resumable
POS room charge uses shared POS/inventory/accounting
group/MICE and long-stay vertical slices work
guest portal/mobile/kiosk/provider contracts work
reports/AI/Help/PDF/Excel/sample/notification/observability work
permission/data scope/field mask/SoD server-side
tenant/property isolation tests green
payment and webhook replay tests green
migration and reconciliation evidence complete
OpenAPI/generated client synchronized
responsive/accessibility/visual tests green
full unit/integration/E2E/security/performance regression green
UAT signed
CI green
branch pushed
worktree clean
release notes/runbook/backup/rollback/DR complete
```

---

# 27. PERINTAH PERTAMA UNTUK SESI CLAUDE CODE / CODEX BARU

Tempelkan instruksi berikut setelah empat dokumen MitraInap tersedia di workspace:

```text
Baca seluruh isi file berikut sampai selesai:

1. BRD_eBisnis_ID_Versi_14_MitraInap_Hospitality_Lengkap.md
2. STRUKTUR_MENU_ROLE_PERMISSION_MITRAINAP_V14.md
3. SPESIFIKASI_UI_UX_RESPONSIVE_MITRAINAP_V14.md
4. PERINTAH_MASTER_CLAUDE_CODE_CODEX_EKSEKUSI_MITRAINAP_ID_HOSPITALITY_V14.md

Baca pula semua dokumen eBisnis yang diwajibkan pada Bab 1 dan source aktual repository.

Kerjakan hanya pada:
C:\opt\eBisnisGithub-mitrainap

Branch:
feature/v14-mitrainap-hospitality

Mulai dari MI-0. Audit source, database, migration, portal, tenant username, domain, CMS,
identity, product catalog, pricing, entitlement, provisioning, POS, inventory, finance,
accounting, HR, workflow, notification, AI, observability, Help/Excel/PDF, API, UI, mobile,
test, dan CI. Buat seluruh docs/mitrainap yang diwajibkan, requirement ledger, baseline test,
risk register, dan implementation plan. Commit dan push hasil audit serta laporkan SHA dan CI.

Sesudah MI-0 lulus, lanjutkan MI-1 satu vertical slice pada satu waktu.
Jangan membuat repository/platform/identity/billing/CMS/POS/inventory/accounting/notification/AI kedua.
Jangan reset/drop database, jangan mengubah migration applied, jangan menimpa .env, jangan
mengarang endpoint OTA/payment/digital-key/IoT, jangan hard-code harga, dan jangan mengklaim
selesai sebelum test/build/push/CI benar-benar dijalankan.
```

---

# 28. PERINTAH LANJUTAN SESI

```text
Lanjutkan implementasi MitraInap Versi 14 berdasarkan empat dokumen MitraInap dan hasil fase sebelumnya.

Cari fase MI berikutnya yang belum DONE. Kerjakan satu vertical slice end-to-end:
migration additive -> domain/service -> API/OpenAPI -> generated client -> UI responsive ->
permission/data scope/field mask -> audit/notification/observability -> Help/report -> tests ->
docs/changelog -> commit -> push -> CI evidence.

Gunakan source aktual sebagai kondisi kebenaran. Reuse shared platform. Jangan membuat mock yang
diklaim production-ready. Bila provider live blocked, selesaikan contract/test double/config/health
UI dan tandai BLOCKED secara jujur, lalu lanjutkan bagian lain.
```

# AKHIR PERINTAH MASTER MITRAINAP.ID HOSPITALITY V14
