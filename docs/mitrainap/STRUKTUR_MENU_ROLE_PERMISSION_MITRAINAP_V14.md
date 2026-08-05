# STRUKTUR MENU, ROLE, DUTY, PRIVILEGE, DATA SCOPE, DAN SEGREGATION OF DUTIES
# MITRAINAP.ID — HOSPITALITY VERSI 14

**Status:** Delta additive terhadap role dan menu eBisnis Versi 5–13.  
**Portal:** `mitrainap.id`  
**Vertical:** `HOSPITALITY`  
**Permission prefix:** `HOSPITALITY.*`  
**API namespace:** `/api/v1/hospitality/**`  
**Prinsip:** menu yang tidak berhak tidak ditampilkan, tetapi backend authorization tetap authoritative.

---

# A. PRINSIP RBAC MITRAINAP

```text
PlatformPerson
-> PlatformUser
-> TenantMembership
-> Active Role
-> Duty
-> Privilege
-> Resource Action
-> Data Scope
-> Field Mask
-> Approval Threshold
-> Property/Outlet/Business Date Context
-> Segregation of Duties
-> Effective Menu
```

Ketentuan:

1. Satu user dapat mempunyai banyak role, tetapi hanya satu `activeRoleId` pada active context.
2. Role tidak otomatis memberi akses ke semua property. Scope property/cluster harus eksplisit.
3. Permission frontend hanya untuk UX; backend memvalidasi ulang resource, property, state, threshold, dan field.
4. Data tamu, dokumen identitas, payment token, rate cost, commission, incident, dan do-not-rent memakai field mask.
5. Aksi finansial, rate publish, night audit, refund, room override, digital key, dan user access dapat memerlukan step-up/MFA.
6. Tenant custom role tidak dihapus oleh seed. Seed idempotent dan additive.
7. Role demo/sample hanya tersedia pada environment/tenant demo dan tidak mempunyai akses production.

---

# B. ROOT MENU APLIKASI

```text
Beranda
Pusat Operasi Hari Ini
Reservasi dan CRS
Front Office
Tamu dan CRM
Kamar dan Ketersediaan
Harga dan Revenue
Distribusi dan Channel
Housekeeping
Engineering dan Maintenance
Folio, Kasir, dan Night Audit
POS dan F&B
Group, Corporate, dan MICE
Layanan Tamu dan Fasilitas
Long Stay, Kos, dan Sewa
Owner dan Investor
Inventory dan Procurement
Finance dan Accounting
HR dan Workforce
Website, Booking Engine, dan CMS
Guest Portal dan Mobile
Analytics dan Laporan
Workflow dan Tugas
Notifikasi
Dokumen
AI dan Insight
Help Center
Administrasi Property
Administrasi Tenant
Ekosistem dan Modul
```

Menu Core ERP seperti POS, Inventory, Finance, Accounting, HR, Payroll, Asset, Investor, Marketplace, Ticketing, Surat, dan Workflow tetap menggunakan engine dan menu shared; MitraInap menambahkan deep-link dan workspace hospitality, bukan duplikasi.

---

# C. STRUKTUR MENU LENGKAP

## C.1. Beranda dan Pusat Operasi

```text
Beranda
├── Ringkasan Portfolio
├── Ringkasan Property Aktif
├── KPI Operasional
├── KPI Revenue
├── KPI Guest Experience
├── KPI Housekeeping
├── KPI Maintenance
├── KPI F&B/POS
├── KPI Finance
└── Exception dan Risiko

Pusat Operasi Hari Ini
├── Today Dashboard
├── Arrivals
├── Departures
├── In-House
├── Due-In Belum Siap
├── Due-Out Belum Selesai
├── Unassigned Rooms
├── Queue Rooms
├── VIP dan Special Request
├── Open Folio/High Balance
├── Open Cashier
├── Room Status Discrepancy
├── Housekeeping Backlog
├── Maintenance Critical
├── Channel Sync Exception
├── Payment Exception
├── Night Audit Readiness
└── Manager Logbook
```

## C.2. Reservasi dan CRS

```text
Reservasi dan CRS
├── Tape Chart / Room Diary
├── Kalender Property
├── Cari Ketersediaan
├── Buat Reservasi
├── Daftar Reservasi
├── Reservation Workspace
├── Quote dan Penawaran
├── Option/Hold
├── Waitlist
├── Walk-In
├── Day Use
├── Multi-Room Booking
├── Multi-Property Search
├── Share/Split/Link Reservation
├── Modification
├── Cancellation
├── Reinstate
├── No-Show
├── Walk Guest
├── Reservation Trace
├── Confirmation dan Resend
├── Deposit Schedule
├── Guarantee
├── Package dan Add-On
├── Transport/Arrival
├── Reservation Audit
└── Reservation Import/Export
```

## C.3. Front Office

```text
Front Office
├── Front Desk Workspace
├── Pre-Arrival
├── Online Registration Review
├── Due-In
├── Check-In
├── Room Assignment
├── Queue Room
├── Registration Card
├── Physical Key
├── Digital Key
├── In-House Guest
├── Room Move
├── Extend/Shorten Stay
├── Change Occupants
├── Guest Messages/Traces
├── Wake-Up Call
├── Visitor and Access
├── Luggage Storage
├── Due-Out
├── Check-Out
├── Express Checkout
├── Post-Stay Follow-Up
├── Front Desk Logbook
└── Shift Handover
```

## C.4. Tamu dan CRM

```text
Tamu dan CRM
├── Guest Profiles
├── Guest Search
├── Duplicate Candidates
├── Merge/Unmerge
├── Identity and Travel Document
├── Contact and Address
├── Companion/Relationship
├── Company/Corporate Link
├── Preferences
├── Accessibility Needs
├── Consent and Communication Preference
├── VIP and Loyalty
├── Stay History
├── Incident and Alert
├── Do-Not-Rent Review
├── Guest Data Request
├── Marketing Segment
├── Campaign/Audience
├── Feedback and Survey
├── Review/Reputation
└── Guest Audit
```

## C.5. Kamar dan Ketersediaan

```text
Kamar dan Ketersediaan
├── Property Structure
├── Building/Tower/Cluster
├── Floor/Zone
├── Room/Unit Type
├── Physical Room/Unit
├── Bed/Capsule/Slot
├── Room Feature/Amenity
├── Accessibility Feature
├── Occupancy Policy
├── Child/Extra Bed Policy
├── Meal Plan
├── Availability Calendar
├── Inventory Control
├── Availability Adjustment
├── Overbooking Limit
├── House Use/Owner Use
├── OOO/OOS Impact
├── Room Type Mapping
├── Room Status Reconciliation
└── Room/Unit Audit
```

## C.6. Harga dan Revenue

```text
Harga dan Revenue
├── Revenue Dashboard
├── Rate Plan
├── Rate Code
├── Rate Calendar
├── Rate Grid
├── Derived Rate
├── Occupancy Pricing
├── Package Rate
├── Corporate/Negotiated Rate
├── Weekly/Monthly Rate
├── Tax and Service Charge
├── Cancellation Policy
├── Deposit Policy
├── Restriction Calendar
├── Stop Sell
├── Min/Max Stay
├── CTA/CTD
├── Channel Allocation
├── Forecast
├── Pickup and Pace
├── Rate Recommendation
├── Restriction Recommendation
├── Publish/Approval Queue
├── Displacement Analysis
├── Budget/Target
├── Competitor/Market Data Adapter
├── Rate Override Audit
└── Revenue Report
```

## C.7. Distribusi dan Channel

```text
Distribusi dan Channel
├── Channel Dashboard
├── Channel Catalog
├── Channel Connection
├── Credential/Environment
├── Room Mapping
├── Rate Mapping
├── Tax/Fee Mapping
├── ARI Sync
├── Reservation Delivery
├── Modification/Cancellation Queue
├── Webhook/Polling Health
├── Sync History
├── Error and Exception Queue
├── Reconciliation
├── Commission Rule
├── Channel Cost
├── OTA Virtual Card
├── GDS/Travel Agent
├── Metasearch
├── Direct Channel
├── Distribution Performance
└── Channel Audit
```

## C.8. Housekeeping

```text
Housekeeping
├── Housekeeping Board
├── Room Condition
├── Assignment
├── Auto Assignment
├── Workload Points
├── Task Sheet
├── Mobile Task Companion
├── Stayover/Checkout Cleaning
├── Turndown
├── DND/Make-Up Room
├── Inspection
├── Room Discrepancy
├── Supplies/Amenity Consumption
├── Linen
├── Laundry
├── Minibar
├── Lost and Found
├── Housekeeping Maintenance Escalation
├── Productivity
├── Shift Handover
└── Housekeeping Audit
```

## C.9. Engineering dan Maintenance

```text
Engineering dan Maintenance
├── Engineering Dashboard
├── Asset/Equipment
├── Work Order
├── Work Request
├── Preventive Maintenance
├── Inspection Checklist
├── Room OOO
├── Room OOS
├── Room Release/Verification
├── Spare Part
├── Vendor/Contractor
├── Meter Reading
├── Energy/Water Alert
├── Safety Incident Reference
├── SLA/Escalation
├── Cost and Downtime
├── Mobile Engineering Task
├── Maintenance Calendar
└── Engineering Audit
```

## C.10. Folio, Kasir, dan Night Audit

```text
Folio, Kasir, dan Night Audit
├── Guest Folio
├── Folio Windows
├── Posting Charge
├── Routing Instruction
├── Transfer Transaction
├── Adjustment/Allowance/Correction
├── Deposit
├── Payment
├── Refund
├── Chargeback/Dispute
├── Cashier
├── Open/Close Cashier
├── Cash Movement
├── Cash Count/Variance
├── Guest Ledger
├── Deposit Ledger
├── City Ledger/AR
├── House Account
├── Invoice/Receipt
├── Exchange Rate
├── Night Audit Readiness
├── Night Audit Run
├── Night Audit Exception
├── Night Audit Reports
├── Income Audit Review
├── Ledger Reconciliation
├── Interface Reconciliation
├── Business Date Control
└── Financial Audit
```

## C.11. POS dan F&B

```text
POS dan F&B
├── POS Workspace
├── Outlet/Register/Shift
├── Restaurant/Table
├── Quick Service
├── Bar/Cafe
├── Room Service
├── Banquet Posting
├── Minibar Posting
├── Spa/Laundry/Parking/Gift Shop
├── Menu/Recipe/HPP
├── Kitchen Display/Printer
├── Order and Course
├── Meal Plan/Package Entitlement
├── Room Charge Authorization
├── Payment/Mixed Payment
├── Tip/Gratuity/Service Charge
├── Void/Return/Refund
├── Daily Sales
├── Outlet Profitability
└── POS Audit
```

## C.12. Group, Corporate, dan MICE

```text
Group, Corporate, dan MICE
├── Corporate Account
├── Negotiated Rate
├── Travel Agent
├── Commission
├── Group Lead
├── Group Profile
├── Room Block
├── Allotment
├── Cutoff/Release
├── Pickup/Wash
├── Rooming List
├── Master Folio/Routing
├── Group Contract
├── Function Space
├── Event Lead/Opportunity
├── Event Calendar
├── Quotation
├── Package/Menu/Equipment
├── Setup/Teardown
├── BEO
├── Change Order
├── Event Deposit
├── Event Billing
├── Event Profitability
└── MICE Audit
```

## C.13. Layanan Tamu dan Fasilitas

```text
Layanan Tamu dan Fasilitas
├── Guest Request
├── Concierge
├── Complaint
├── Service Recovery
├── Airport Transfer
├── Shuttle/Transport
├── Vehicle/Driver
├── Activity/Tour
├── Spa/Wellness
├── Recreation/Golf
├── Restaurant Reservation
├── Parking
├── Pet Service
├── Parcel/Package
├── Amenity Delivery
├── Luggage
├── Visitor
├── SLA and Escalation
└── Guest Service Report
```

## C.14. Long Stay, Kos, dan Sewa

```text
Long Stay, Kos, dan Sewa
├── Long-Stay Dashboard
├── Prospect/Application
├── Unit Offer
├── Contract
├── Occupant
├── Move-In
├── Security Deposit
├── Recurring Rent
├── Utility Meter
├── Utility Billing
├── Service Charge
├── Monthly Statement
├── Payment/AR
├── Late Fee
├── Maintenance Request
├── Unit Transfer
├── Renewal
├── Notice
├── Move-Out
├── Inspection/Damage
├── Deposit Settlement
└── Long-Stay Audit
```

## C.15. Owner dan Investor

```text
Owner dan Investor
├── Owner Profile
├── Property Agreement
├── Owner Use/Block
├── Revenue Allocation
├── Cost Allocation
├── Management Fee
├── Maintenance Reserve
├── Owner Statement
├── Owner Payout
├── Damage Claim
├── Investor Structure
├── Capital/Settlement
├── Owner Portal
└── Owner/Investor Audit
```

## C.16. Website, Booking Engine, dan CMS

```text
Website, Booking Engine, dan CMS
├── Website Dashboard
├── Theme/Brand
├── Domain/Subdomain
├── Custom Domain
├── Navigation/Footer
├── Page/Section/Block
├── Property/Room Content
├── Gallery/Media
├── Package/Promotion
├── News/Article/Event
├── FAQ/Policy
├── SEO/Sitemap/Redirect
├── Booking Widget
├── Booking Engine Settings
├── Guest Checkout Settings
├── Payment/Deposit Settings
├── Multi-language
├── Analytics/Consent
├── Publication Workflow
└── Website Audit
```

## C.17. Guest Portal dan Mobile

```text
Guest Portal dan Mobile
├── My Booking
├── Pre-Arrival Registration
├── Payment/Deposit
├── Guest Details/Consent
├── Service Request
├── Transport/Activity
├── Folio
├── Express Checkout
├── Invoice/Receipt
├── Loyalty/Profile
├── Message/Chat
├── Feedback
├── Digital Key
├── Kiosk Device
├── Staff Mobile Device
├── Offline Queue
└── Device Audit
```

## C.18. Analytics, Workflow, AI, Help, Administrasi

```text
Analytics dan Laporan
├── Daily Operations
├── Revenue
├── Distribution
├── Guest
├── Housekeeping
├── Maintenance
├── POS/F&B
├── Finance
├── Group/MICE
├── Long Stay
├── Owner/Investor
├── Sustainability
├── Saved Views
├── Report Snapshot
└── Export/Print History

Administrasi Property
├── Property Profile
├── Business Date/Calendar
├── Department/Outlet
├── Tax/Service Charge
├── Transaction Code
├── Payment Method
├── Cashier/Register
├── Room/Rate/Policy
├── Housekeeping Configuration
├── Maintenance Configuration
├── Night Audit Sequence
├── Numbering
├── Document Template
├── Communication Template
├── Integration
├── Role Assignment
├── Data Retention
└── Health Check
```

---

# D. ROLE PLATFORM

```text
SUPER_ADMIN_PLATFORM
ADMIN_PORTAL_MITRAINAP
ADMIN_PRODUCT_HOSPITALITY
ADMIN_MODULE_HOSPITALITY
ADMIN_PRICING_PLATFORM
ADMIN_CONTRACT_PLATFORM
ADMIN_BILLING_PLATFORM
ADMIN_ENTITLEMENT
ADMIN_PROVISIONING
ADMIN_DOMAIN
ADMIN_CMS_PLATFORM
ADMIN_SECURITY_PLATFORM
ADMIN_INTEGRATION_PLATFORM
AUDITOR_PLATFORM
SALES_ACCOUNT_MANAGER
CUSTOMER_SUCCESS
SUPPORT_PLATFORM_READ_ONLY
```

Role platform tidak otomatis mendapat akses operasional tenant. Support access harus explicit, time-bound, approved, purpose-bound, masked, and audited.

---

# E. ROLE TENANT/CORPORATE/PROPERTY

## E.1. Leadership dan Administration

```text
TENANT_OWNER
CORPORATE_HOSPITALITY_ADMIN
CHAIN_ADMIN
PROPERTY_ADMIN
GENERAL_MANAGER
RESIDENT_MANAGER
OPERATIONS_MANAGER
AUDITOR_HOSPITALITY
COMPLIANCE_PRIVACY_OFFICER
SECURITY_MANAGER
```

## E.2. Reservation, Revenue, Distribution

```text
RESERVATION_MANAGER
RESERVATION_AGENT
CENTRAL_RESERVATION_AGENT
REVENUE_MANAGER
REVENUE_ANALYST
DISTRIBUTION_MANAGER
CHANNEL_MANAGER_OPERATOR
CORPORATE_SALES_MANAGER
TRAVEL_AGENT_COMMISSION_OFFICER
```

## E.3. Front Office dan Guest Service

```text
FRONT_OFFICE_MANAGER
FRONT_DESK_SUPERVISOR
RECEPTIONIST
GUEST_RELATION_OFFICER
CONCIERGE
BELL_DOOR_ATTENDANT
TRANSPORT_DISPATCHER
NIGHT_MANAGER
NIGHT_AUDITOR
```

## E.4. Housekeeping dan Engineering

```text
EXECUTIVE_HOUSEKEEPER
HOUSEKEEPING_SUPERVISOR
ROOM_ATTENDANT
PUBLIC_AREA_ATTENDANT
LINEN_LAUNDRY_OFFICER
MINIBAR_ATTENDANT
LOST_FOUND_CUSTODIAN
CHIEF_ENGINEER
MAINTENANCE_SUPERVISOR
TECHNICIAN
ENERGY_SUSTAINABILITY_OFFICER
```

## E.5. F&B, POS, MICE

```text
FNB_DIRECTOR
OUTLET_MANAGER
POS_CASHIER
WAITER_SERVER
KITCHEN_MANAGER
ROOM_SERVICE_OPERATOR
BANQUET_MANAGER
MICE_SALES_MANAGER
EVENT_COORDINATOR
SPA_RECREATION_MANAGER
```

## E.6. Finance dan Back Office

```text
FINANCE_CONTROLLER
INCOME_AUDITOR
GENERAL_CASHIER
ACCOUNTS_RECEIVABLE_OFFICER
ACCOUNTS_PAYABLE_OFFICER
ACCOUNTANT
PURCHASING_MANAGER
STOREKEEPER
COST_CONTROLLER
HR_MANAGER
WORKFORCE_SCHEDULER
PAYROLL_OFFICER
```

## E.7. Long Stay dan Owner

```text
LONG_STAY_MANAGER
LEASING_OFFICER
UTILITY_BILLING_OFFICER
PROPERTY_OWNER
OWNER_RELATION_OFFICER
INVESTOR_VIEWER
```

## E.8. External/Self-Service

```text
GUEST_SELF_SERVICE
LONG_STAY_TENANT_SELF_SERVICE
CORPORATE_BOOKER
TRAVEL_AGENT_USER
OWNER_PORTAL_USER
SERVICE_ACCOUNT_CHANNEL
SERVICE_ACCOUNT_DOOR_LOCK
SERVICE_ACCOUNT_IOT
```

---

# F. PERMISSION NAMING

Pola:

```text
HOSPITALITY.<RESOURCE>.<ACTION>
```

Action standar:

```text
READ
CREATE
UPDATE
DEACTIVATE
DELETE_DRAFT
RESTORE
SUBMIT
APPROVE
REJECT
POST
VOID
CANCEL
REINSTATE
CHECK_IN
CHECK_OUT
ROOM_MOVE
ASSIGN
PUBLISH
SYNC
RECONCILE
REFUND
REVERSE
PRINT
EXPORT
IMPORT
AUDIT_READ
VIEW_SENSITIVE
MANAGE_OFFLINE
CONFIGURE
```

Contoh permission kritis:

```text
HOSPITALITY.RESERVATION.CREATE
HOSPITALITY.RESERVATION.MODIFY
HOSPITALITY.RESERVATION.CANCEL
HOSPITALITY.RESERVATION.REINSTATE
HOSPITALITY.RESERVATION.VIEW_RATE
HOSPITALITY.RESERVATION.VIEW_COST
HOSPITALITY.FRONT_DESK.CHECK_IN
HOSPITALITY.FRONT_DESK.CHECK_OUT
HOSPITALITY.FRONT_DESK.ROOM_MOVE
HOSPITALITY.FRONT_DESK.OVERRIDE_ROOM_STATUS
HOSPITALITY.RATE.UPDATE
HOSPITALITY.RATE.PUBLISH
HOSPITALITY.RATE.OVERRIDE_FLOOR
HOSPITALITY.INVENTORY.OVERBOOK
HOSPITALITY.CHANNEL.CONFIGURE
HOSPITALITY.CHANNEL.SYNC
HOSPITALITY.CHANNEL.RECONCILE
HOSPITALITY.GUEST.VIEW_IDENTITY
HOSPITALITY.GUEST.VIEW_INCIDENT
HOSPITALITY.GUEST.MANAGE_DNR
HOSPITALITY.FOLIO.POST
HOSPITALITY.FOLIO.ADJUST
HOSPITALITY.FOLIO.VOID
HOSPITALITY.PAYMENT.RECORD
HOSPITALITY.PAYMENT.REFUND
HOSPITALITY.CASHIER.OPEN
HOSPITALITY.CASHIER.CLOSE
HOSPITALITY.NIGHT_AUDIT.PRECHECK
HOSPITALITY.NIGHT_AUDIT.RUN
HOSPITALITY.NIGHT_AUDIT.RESOLVE_EXCEPTION
HOSPITALITY.NIGHT_AUDIT.ROLL_BUSINESS_DATE
HOSPITALITY.HOUSEKEEPING.ASSIGN
HOSPITALITY.HOUSEKEEPING.UPDATE_ROOM_STATUS
HOSPITALITY.HOUSEKEEPING.INSPECT
HOSPITALITY.MAINTENANCE.CREATE_OOO
HOSPITALITY.MAINTENANCE.RELEASE_ROOM
HOSPITALITY.POS.POST_ROOM_CHARGE
HOSPITALITY.DIGITAL_KEY.ISSUE
HOSPITALITY.DIGITAL_KEY.REVOKE
```

---

# G. DATA SCOPE DAN FIELD MASK

## G.1. Data Scope

```text
PLATFORM
TENANT
LEGAL_ENTITY
CHAIN
BRAND
PROPERTY_CLUSTER
PROPERTY
BUILDING
FLOOR_ZONE
DEPARTMENT
OUTLET
REGISTER
ROOM_TYPE
ROOM_OR_UNIT
COST_CENTER
PROFIT_CENTER
CORPORATE_ACCOUNT
ASSIGNED_RESERVATION
ASSIGNED_TASK
OWN_PROFILE
OWN_BOOKING
OWN_CONTRACT
```

## G.2. Field Mask

| Data | Default Mask/Control |
|---|---|
| Passport/ID | masked; full only for authorized purpose |
| Phone/email | partial mask outside operational role |
| Address | property/role scoped |
| Payment card | token + last digits only; CVV never stored |
| Bank account | masked, step-up for full view/change |
| Rate cost/margin | revenue/finance permission only |
| OTA commission | distribution/finance permission |
| Incident/DNR | security/manager limited |
| Guest preference sensitive | purpose-bound |
| Digital key/access event | security/front-office limited |
| Salary/payroll | HR/payroll only |
| Owner/investor financial | assigned owner/investor scope |

---

# H. APPROVAL THRESHOLD

Configurable threshold:

```text
rate override below floor
complimentary/house use
manual overbooking
walk guest compensation
room status override
late checkout waiver
early check-in waiver
folio adjustment/allowance/void
refund
cash variance
city ledger credit
OOO/OOS duration
maintenance vendor cost
MICE discount
long-stay discount/late fee waiver
deposit refund
owner payout
night audit forced exception resolution
```

Threshold dapat berdasarkan amount, percentage, room nights, property class, segment, user role, and risk level.

---

# I. SEGREGATION OF DUTIES

```text
Reservation creator tidak otomatis dapat publish rate.
Revenue recommendation creator tidak final approve rekomendasi sendiri jika dual control aktif.
Front desk tidak boleh mengubah room menjadi clean/inspected tanpa housekeeping privilege.
Room attendant tidak dapat me-release OOO/OOS.
POS cashier tidak dapat approve refund sendiri.
Cashier tidak dapat approve cash variance sendiri.
Folio adjustment creator tidak final approve adjustment di atas threshold.
Night auditor tidak boleh mengubah source transaction untuk menyeimbangkan ledger secara tersembunyi.
Night audit forced exception memerlukan supervisor/manager sesuai policy.
Payment recorder tidak dapat mengubah token/provider result.
Do-not-rent creator tidak final approve dan tidak dapat menghapus histori.
Digital-key issuer tidak dapat memperpanjang stay atau room assignment tanpa front-office authority.
Purchaser tidak dapat menerima dan membayar PO sendiri bila SoD aktif.
Owner statement preparer tidak release payout sendiri.
Long-stay deposit collector tidak final approve refund sendiri.
CMS editor tidak otomatis publisher.
Channel credential administrator tidak otomatis dapat melihat guest identity.
AI tidak menjadi approver, cashier, rate publisher, night auditor, atau door controller.
Support platform tidak mempunyai standing tenant access.
```

---

# J. ROLE-TO-WORKSPACE RINGKAS

| Role | Workspace Utama | Aksi Kritis |
|---|---|---|
| General Manager | Portfolio/Property KPI, exception | approve high-risk operational exceptions |
| Reservation Agent | Availability, quote, reservation | create/modify/cancel within policy |
| Revenue Manager | Forecast, rate, restriction | publish rate/restriction with threshold |
| Front Desk | arrivals, check-in/out, folio | room assignment, key, payment within role |
| Night Auditor | precheck, ledger, EOD | execute night audit; no hidden source edit |
| Housekeeping | board, assignments, inspection | room condition and task completion |
| Engineering | work order, OOO/OOS | maintenance and room release by authority |
| POS Cashier | POS outlet/register | sell, room charge, request void/refund |
| Finance Controller | ledgers, journal, reconciliation | approve adjustment/refund/close exceptions |
| MICE Sales | lead, block, event, BEO | quote/contract within threshold |
| Long Stay Manager | contract, rent, utility, deposit | approve contract and settlement policy |
| Guest | own booking/folio/service | only own authorized data and actions |
| Owner | owner statement | read own property/statement only |
| Auditor | read-only audit/report | no mutation |

---

# K. SAMPLE USER POLICY

Sample account hanya untuk `demo.mitrainap.id`, development, test, atau tenant demo yang disetujui.

Wajib:

```text
isSampleAccount = true
random one-time password or magic demo session
expiresAt
mustChangePassword when applicable
no production tenant membership
no real payment credential
no real messaging recipient
no unrestricted export
reset/regenerate support
banner DEMO
```

Tidak boleh menuliskan password sample permanen di repository atau dokumen publik.

---

# L. AUTHORIZATION TEST MATRIX

Setiap resource minimum diuji:

```text
allowed role and scope
wrong tenant
wrong property
wrong outlet/register
wrong business state
wrong amount threshold
field mask
IDOR/BOLA
mass assignment/BOPLA
hidden menu direct API
role switch
session expiry
step-up required
service account scope
support time-bound access
export/print masking
audit event
```

---

# M. DEFINITION OF DONE MENU/RBAC

```text
seluruh menu mempunyai route/resource/help code
menu catalog modular hospitality tersedia
role catalog modular hospitality tersedia
permission catalog modular hospitality tersedia
seed idempotent dan tidak menghapus custom role
backend guards tenant/property/object/field/action
active role dan active property context tervalidasi
data scope dan field mask teruji
SoD rules teruji
approval threshold teruji
sample accounts hanya demo/test
negative API tests green
menu visibility tests green
audit access and denial tersedia
```

# AKHIR STRUKTUR MENU, ROLE, DAN HAK AKSES MITRAINAP V14
