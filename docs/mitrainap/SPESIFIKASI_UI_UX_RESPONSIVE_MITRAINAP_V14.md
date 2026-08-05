# SPESIFIKASI UI/UX RESPONSIVE
# MITRAINAP.ID HOSPITALITY VERSI 14
# Public Portal, Direct Booking Engine, PMS Workspace, Mobile Operations, dan Design System Terpadu

**Versi:** 14.0  
**Tanggal:** 6 Agustus 2026  
**Portal:** `mitrainap.id`  
**Aplikasi:** `app.mitrainap.id`  
**Demo:** `demo.mitrainap.id`  
**Vertical:** `HOSPITALITY`  
**Status:** Kontrak desain dan implementasi; seluruh komponen harus mempunyai aksi nyata, state lengkap, permission, audit, serta test.

---

# 0. TUJUAN DOKUMEN

Dokumen ini menetapkan pengalaman pengguna MitraInap untuk:

```text
website pemasaran mitrainap.id
website publik tenant
booking engine langsung
aplikasi PMS/CRS dan back-office
front desk desktop/tablet
housekeeping dan engineering mobile
POS hospitality
revenue dan distribution workspace
night audit dan finance workspace
guest portal, kiosk, dan self-service
```

Desain tidak boleh berhenti sebagai mockup. Setiap tombol, menu, kartu, tabel, filter, kalender, drawer, dialog, shortcut, notifikasi, dan indikator harus terhubung ke capability backend atau tampil `disabled` dengan alasan yang dapat dipahami.

Prinsip dasar:

```text
Guest-first untuk kanal publik
Operation-first untuk staff
Exception-first untuk supervisor
Revenue-aware untuk manajemen
Mobile-first untuk pekerjaan lapangan
Keyboard-efficient untuk front desk dan kasir
Accessible by default
Tenant/property aware
Business-date aware
Permission and privacy aware
No dark patterns
No fake action
```

---

# 1. SASARAN DESAIN

1. Membuat petugas front desk dapat melihat keadaan property hari ini dalam beberapa detik.
2. Mengurangi perpindahan halaman untuk reservasi, check-in, room move, folio, dan check-out.
3. Membuat housekeeping dan engineering dapat menyelesaikan tugas dari ponsel dengan satu tangan.
4. Membuat tamu dapat memesan kamar tanpa kebingungan, biaya tersembunyi, atau alur login yang memaksa.
5. Membuat manajer dapat menemukan exception—overbooking, room discrepancy, unpaid folio, failed channel sync, late checkout, dan maintenance risk—sebelum menjadi insiden.
6. Mempertahankan konsistensi komponen dengan design system eBisnis, tetapi menyediakan brand variant hospitality yang lebih hangat, visual, dan berorientasi perjalanan.
7. Menjamin seluruh layar bekerja pada desktop besar, laptop, tablet landscape/portrait, serta ponsel.
8. Menjamin informasi sensitif hanya tampil sesuai permission dan kebutuhan kerja.

---

# 2. PERSONA DAN KONTEKS PERANGKAT

| Persona | Perangkat Utama | Kebutuhan UX |
|---|---|---|
| Tamu calon pemesan | Mobile browser | Pencarian cepat, harga transparan, foto berkualitas, checkout singkat |
| Tamu in-house | Mobile browser/kiosk | Layanan, chat, tagihan, checkout, permintaan fasilitas |
| Reservation agent | Desktop/laptop | Search cepat, multi-property availability, quote, modification |
| Front desk agent | Desktop/tablet | Arrivals, check-in, room assignment, folio, key, checkout |
| Night auditor | Desktop | Precheck, exception queue, posting, report, business-date roll |
| Housekeeper | Android/iOS | Daftar kamar, prioritas, timer, checklist, foto, issue |
| Housekeeping supervisor | Tablet/desktop | Room board, assignment, discrepancy, inspection |
| Engineer | Mobile/tablet | Work order, asset history, spare part, photo, downtime |
| Revenue manager | Desktop besar | Calendar grid, rate/restriction, pickup, forecast, channel comparison |
| F&B cashier | Touch desktop/tablet | POS cepat, table/room lookup, payment, room charge |
| General manager | Desktop/mobile | KPI, exception, alerts, drill-down |
| Tenant admin | Desktop | Property, role, integration, CMS, policy, audit |
| Platform admin | Desktop | Portal, tenant, entitlement, provisioning, billing, health |

---

# 3. IDENTITAS VISUAL DAN BRAND VARIANT

MitraInap menggunakan shared design token eBisnis dengan variant `HOSPITALITY`. Jangan membuat component library kedua.

## 3.1. Karakter Visual

```text
ramah dan terpercaya
bersih dan tenang
data-dense tanpa terlihat sesak
foto properti menjadi pendukung, bukan dekorasi berlebihan
status operasional mudah dikenali
warna bukan satu-satunya penanda
motion ringan dan purposeful
```

## 3.2. Token Semantik

Gunakan token semantik, bukan warna literal berulang:

```text
--surface-canvas
--surface-panel
--surface-elevated
--surface-muted
--text-primary
--text-secondary
--text-disabled
--border-default
--border-strong
--brand-primary
--brand-secondary
--brand-accent
--status-success
--status-warning
--status-danger
--status-info
--status-neutral
--focus-ring
--shadow-panel
--radius-card
--radius-control
```

Tenant dapat mengubah logo, warna utama, aksen, tipografi yang diizinkan, favicon, cover, dan tone melalui CMS/theme configuration. Kontras tetap divalidasi otomatis.

## 3.3. Typography

```text
Display: hero dan halaman pemasaran
Heading: page/section title
Body: 16px equivalent untuk kanal publik
Operational body: 14–16px sesuai density mode
Numeric/KPI: tabular numerals
Code/reference: monospaced hanya untuk reservation code, room number, dan technical ID
```

Nomor kamar, tanggal, occupancy, rate, amount, dan business date harus memakai angka tabular agar kolom stabil.

---

# 4. BREAKPOINT DAN DENSITY

Gunakan breakpoint design system existing; bila belum tersedia, baseline:

```text
xs  < 480px
sm  480–767px
md  768–1023px
lg  1024–1279px
xl  1280–1535px
2xl >= 1536px
```

Density mode:

```text
Comfortable  — default guest/public dan tablet
Compact      — front desk, reservation, revenue, report desktop
Touch        — POS, kiosk, housekeeping tablet
```

Pengguna operasional dapat menyimpan density preference per perangkat, tetapi tidak boleh membuat kontrol lebih kecil dari batas aksesibilitas.

---

# 5. APP SHELL DAN NAVIGASI

## 5.1. Desktop Shell

```text
Top Context Bar
├── Portal/brand
├── Tenant
├── Property/cluster
├── Business date
├── Shift/register bila relevan
├── Global search
├── Quick action
├── Task/notification
├── AI assistant
├── Help
└── User/active role

Left Navigation
├── Favorite/pinned
├── Operational modules
├── Back-office modules
├── Analytics
└── Administration

Main Workspace
├── Breadcrumb
├── Page title + context badge
├── Primary actions
├── Filter/search
├── Content
└── Audit/help/status drawer
```

Sidebar dapat collapse. Pada layar kurang dari `lg`, gunakan navigation drawer. Jangan menyisakan ruang kosong setelah collapse.

## 5.2. Mobile Shell

```text
Top bar: Back / title / contextual action
Bottom navigation: Hari Ini / Reservasi / Kamar-Tugas / Notifikasi / Lainnya
Primary action: sticky bottom button atau floating action sesuai screen
Filter: bottom sheet
Detail: full-screen route
Secondary action: overflow/bottom sheet
```

Bottom navigation berubah menurut role. Housekeeper tidak melihat menu Revenue; revenue manager tidak melihat tombol `Selesaikan Kamar` kecuali mempunyai role terkait.

## 5.3. Global Search

Search universal mengenali:

```text
reservation number
confirmation number
guest name
phone/email dengan masking
room number
folio number
group/block
company/travel agent
work order
lost-and-found
invoice/payment reference
menu/help topic
```

Hasil dikelompokkan, permission-filtered, tenant/property scoped, dan keyboard navigable.

## 5.4. Quick Actions

Contoh:

```text
Reservasi Baru
Walk-in
Check-in Cepat
Buat Guest Request
Buat Work Order
Posting Charge
Buka POS
Room Move
Cari Folio
Mulai Night Audit
```

Quick action hanya muncul jika precondition, context, dan permission terpenuhi.

---

# 6. KOMPONEN SHARED WAJIB

Gunakan komponen existing atau buat sekali pada shared hospitality UI package:

```text
HospitalityAppShell
PropertyContextBar
BusinessDateBadge
OperationalClock
ConnectionStatusBadge
SyncStatusBadge
ShiftStatusBadge
PageHeader
ActionToolbar
SmartCommandPalette
GlobalGuestSearch
ReservationSearch
AvailabilitySearchPanel
StayDateRangePicker
GuestOccupancySelector
PropertySelector
RoomTypeSelector
RatePlanSelector
ChannelBadge
GuaranteeBadge
ReservationStatusBadge
RoomStatusBadge
HousekeepingStatusBadge
MaintenanceStatusBadge
FolioBalanceBadge
PaymentStatusBadge
TapeChart
OccupancyCalendar
RateCalendar
RestrictionEditor
RoomRack
RoomCard
ArrivalDepartureList
GuestProfileSummary
StayTimeline
ReservationTimeline
FolioWorkspace
ChargeComposer
PaymentComposer
RoomAssignmentDrawer
RoomMoveWizard
CheckInWizard
CheckOutWizard
NightAuditChecklist
ExceptionQueue
HousekeepingBoard
HousekeepingTaskCard
MaintenanceBoard
WorkOrderCard
LostAndFoundCard
GroupBlockGrid
FunctionSpaceCalendar
BanquetEventOrderViewer
ChannelHealthPanel
AriSyncStatus
DirectBookingSummary
TransparentPriceBreakdown
GuestMessageTimeline
AuditTimeline
PermissionGate
SensitiveField
ReasonRequiredDialog
ApprovalDialog
UnsavedChangesGuard
ContextualHelpButton
GuidedTourAnchor
OfflineQueuePanel
ConflictResolutionDialog
ReportParameterPanel
ReportSnapshotPanel
```

Komponen wajib mempunyai loading, empty, error, stale, offline, permission denied, and success state.

---

# 7. ARSITEKTUR INFORMASI PUBLIC PORTAL MITRAINAP.ID

## 7.1. Navigasi Utama

```text
Beranda
Solusi
├── Hotel dan Resort
├── Penginapan, Losmen, dan Guest House
├── Villa, Cottage, Homestay, dan Glamping
├── Hostel dan Capsule
├── Kos, Co-living, dan Long Stay
└── Multi-Property dan Chain
Fitur
├── PMS dan Front Office
├── Booking Engine
├── Channel dan OTA
├── Housekeeping
├── POS dan F&B
├── Revenue
├── Finance dan ERP
└── Guest Experience
Harga
Demo
Mitra
Artikel
Bantuan
Hubungi Kami
Masuk
Daftarkan Properti
```

## 7.2. Homepage Structure

```text
Ecosystem top bar
Header
Hero dengan pencarian demo/CTA
Trust/value strip
Masalah yang diselesaikan
Property type solutions
Core operation journey
Direct booking and distribution
ERP integration
Mobile operations
Dashboard preview
Security and reliability
Implementation journey
Pricing/consultation
FAQ
Final CTA
Cross-portal footer
```

Homepage harus CMS-driven, cepat, SEO-ready, dan tidak mengklaim capability yang belum tersedia. Status fitur menggunakan `Tersedia`, `Pilot`, `Segera Hadir`, `Berdasarkan Aktivasi`, atau `Integrasi Khusus`.

## 7.3. Hero Copy Baseline

```text
Eyebrow:
Platform Operasional Penginapan Terpadu

Headline:
Satu Properti. Satu Sistem. Semua Operasional Terhubung.

Subheadline:
Kelola reservasi, kamar, tamu, housekeeping, pembayaran, POS, channel penjualan,
dan laporan bisnis melalui MitraInap.id yang terintegrasi dengan ERP eBisnis.

Primary CTA:
Daftarkan Properti

Secondary CTA:
Coba Demo

Tertiary CTA:
Jadwalkan Konsultasi
```

Copy dapat diubah CMS. Jangan hard-code angka harga yang belum ditetapkan.

---

# 8. WEBSITE PUBLIK TENANT

Template tenant harus mendukung:

```text
Beranda
Kamar/Unit
Paket dan Promo
Fasilitas
Galeri
Restoran/Spa/Aktivitas
Meeting dan Acara
Lokasi
Ulasan terverifikasi bila tersedia
Kebijakan
FAQ
Kontak
Booking Engine
Guest Portal
```

## 8.1. Mobile Public Website

- Header ringkas dengan CTA `Pesan Sekarang` sticky.
- Foto memakai responsive image, lazy loading, aspect ratio konsisten, dan alt text.
- Search bar dapat dibuka dari sticky bottom area tanpa menutupi keyboard.
- Harga awal selalu menjelaskan unit periode, pajak/fee, refundable/non-refundable, dan occupancy.
- Map, WhatsApp/contact, dan direction tidak mengganggu booking flow.

## 8.2. Desktop Public Website

- Hero visual dapat memakai carousel terbatas, tetapi tidak auto-rotate tanpa kontrol.
- Availability search visible above fold.
- Room cards mudah dibandingkan.
- Booking summary sticky di sisi kanan pada checkout.
- Social proof dan kebijakan diletakkan dekat keputusan pemesanan, bukan disembunyikan.

---

# 9. DIRECT BOOKING ENGINE UX

## 9.1. Alur Utama

```text
Pilih properti bila multi-property
-> tanggal menginap
-> jumlah kamar/tamu/anak
-> promo/corporate code optional
-> lihat ketersediaan
-> pilih kamar/unit
-> pilih rate plan/paket
-> add-on
-> data pemesan dan tamu
-> kebijakan dan consent
-> deposit/payment/guarantee
-> konfirmasi
-> manage booking
```

## 9.2. Prinsip Kepercayaan

```text
harga total terlihat sebelum payment
pajak, service charge, deposit, dan fee dipisahkan jelas
kebijakan pembatalan tampil sebelum memilih rate
sisa kamar hanya ditampilkan jika berasal dari data nyata
urgency message tidak boleh palsu
preselected add-on dilarang kecuali benar-benar wajib
opt-in marketing tidak boleh dicentang otomatis
guest checkout tersedia jika policy mengizinkan
error tidak menghapus pilihan pengguna
```

## 9.3. Search Result Card

Setiap card minimum:

```text
foto utama + jumlah foto
nama room type/unit
kapasitas dan bed configuration
luas/fasilitas utama
availability
rate plan
meal/package inclusion
cancellation policy
payment/guarantee policy
tax/fee indicator
price per night dan total stay
badge recommendation dengan alasan nyata
compare/select action
```

## 9.4. Mobile Checkout

```text
step indicator ringkas
sticky total + Lanjutkan
summary collapsible
input autocomplete
country/phone selector accessible
payment hosted/redirect sesuai provider
back navigation mempertahankan state
```

## 9.5. Error Recovery

```text
rate changed -> tampilkan old/new price dan minta konfirmasi
inventory lost -> rekomendasikan alternatif tanggal/room type
payment pending -> jangan membuat booking kedua
callback lost -> inquiry status
session expired -> restore cart/quote jika masih valid
invalid promo -> jelaskan tanpa menghapus booking
```

---

# 10. LOGIN, ACTIVE CONTEXT, DAN START PAGE

Setelah login:

```text
Resolve tenant memberships
-> pilih active role bila >1
-> pilih property/cluster bila >1
-> pilih business date/shift bila relevan
-> load effective menu
-> buka role-specific start page
```

Start page per role:

```text
Front Desk          -> Pusat Operasi Hari Ini
Reservation Agent   -> Reservation Workspace
Housekeeper          -> Tugas Saya
HK Supervisor       -> Housekeeping Board
Engineer             -> Work Order Saya
Revenue Manager      -> Rate and Revenue Calendar
Night Auditor        -> Night Audit Control
F&B Cashier          -> POS Register
General Manager      -> Executive Dashboard
Tenant Admin         -> Setup and Health Center
```

Context switch wajib membersihkan cache yang tidak relevan dan menutup detail sensitif dari property sebelumnya.

---

# 11. TODAY COMMAND CENTER

`Pusat Operasi Hari Ini` adalah layar utama operasional, bukan dashboard dekoratif.

## 11.1. Desktop Layout

```text
Top KPI strip
├── Occupancy
├── Arrivals
├── Departures
├── Stayovers
├── Rooms Ready
├── Dirty/Inspect
├── OOO/OOS
├── Open Balance
└── Exceptions

Main columns
├── Arrivals timeline/list
├── Departures timeline/list
├── In-house alerts
└── Room/housekeeping snapshot

Bottom
├── Channel/system health
├── Pending approval
├── Guest request SLA
└── Shift/night audit readiness
```

## 11.2. Mobile Layout

KPI menjadi horizontally scrollable summary cards dengan teks, bukan warna saja. Bagian default disesuaikan role. Card mempunyai quick action seperti `Check-in`, `Assign Room`, `Mark Ready`, `Open Folio`, atau `Resolve`.

## 11.3. Exception First

Exception minimum:

```text
overbooking risk
unassigned arrival dekat waktu check-in
room not ready
VIP/special request
deposit missing
payment failed/pending
duplicate guest candidate
room discrepancy
late checkout conflict
open folio balance
channel sync failure
maintenance blocking arrival
night audit blocker
```

Setiap exception mempunyai severity, owner, SLA, reason, suggested next action, dan audit trail.

---

# 12. TAPE CHART / RESERVATION CALENDAR

Tape chart adalah workspace data-dense paling kritis.

## 12.1. Desktop

```text
Sticky property/date toolbar
Sticky room/room-type columns
Horizontal date timeline
Reservation bars
Room status overlay
Maintenance/OOO overlay
Group/allotment overlay
Drag/resize dengan server validation
Context menu
Detail drawer
Mini-map/scroll navigator
```

## 12.2. Interaksi

- Drag reservation hanya membuat proposal; server memvalidasi room type, rate, restriction, clean status, lock, dan conflict sebelum commit.
- Resize stay menampilkan perubahan rate/tax/availability sebelum simpan.
- Klik cell kosong membuka availability-aware reservation drawer.
- Klik bar membuka reservation quick view; double-click atau `Enter` membuka full workspace.
- Multi-select dibatasi permission dan mempunyai confirmation summary.
- Keyboard: arrow untuk navigasi, Enter detail, Shift+arrow range, `/` search, `N` reservation baru bila tidak konflik input.

## 12.3. Visual Semantics

Bar menampilkan:

```text
guest/group name sesuai masking
status icon
arrival/departure marker
channel
VIP/special request
balance/guarantee warning
room move link
```

Warna status disertai pattern/icon/label. Do-not-rent atau incident tidak boleh ditampilkan sebagai label terbuka pada board umum.

## 12.4. Mobile

Tape chart penuh tidak dipaksakan ke layar kecil. Gunakan:

```text
room/date card list
horizontal 3–7 day mini-calendar
filter room type/floor/status
reservation full-screen detail
quick move wizard
```

Tidak ada data hilang; detail lengkap tersedia melalui route.

---

# 13. RESERVATION WORKSPACE

Gunakan satu workspace dengan tab/panel, bukan banyak popup lepas.

```text
Header
├── confirmation number
├── status
├── property/stay dates
├── guest
├── channel/source
├── guarantee/deposit
├── balance
└── primary actions

Tabs
├── Stay and Rooms
├── Guests
├── Rate and Packages
├── Add-ons
├── Payment/Deposit
├── Folio Preview
├── Requests/Notes
├── Communication
├── Documents
├── History/Audit
└── Related Reservations
```

Primary actions berubah sesuai state:

```text
Quote
Hold
Confirm
Modify
Cancel
No-show
Reinstate
Assign room
Pre-register
Check-in
Room move
Extend/shorten
Check-out
```

Action yang tidak tersedia disabled dengan alasan, misalnya `Tidak dapat check-in: kamar masih DIRTY dan override tidak diizinkan`.

---

# 14. GUEST PROFILE UX

Guest profile adalah golden profile, bukan hanya alamat.

```text
Identity summary
Contact and consent
Stay history
Preference
Loyalty/membership
Company/travel agent link
Communication timeline
Service request
Feedback
Payment token reference masked
Incident/restriction highly restricted
Duplicate/merge review
Privacy request and retention
```

Sensitive area memakai `SensitiveField`, reveal sementara, reason, permission, dan audit. Merge guest menampilkan side-by-side survivorship preview dan tidak boleh dilakukan otomatis hanya dari kemiripan nama.

---

# 15. ARRIVAL, CHECK-IN, IN-HOUSE, DAN DEPARTURE

## 15.1. Arrival List

Filter cepat:

```text
belum assign
room not ready
VIP
special request
deposit missing
online check-in complete
early arrival
group
channel
```

Row/card action:

```text
Open
Assign Room
Pre-authorize/Collect Deposit
Send Message
Check-in
Create Task
```

## 15.2. Check-In Wizard

```text
1. Verifikasi reservasi dan guest
2. Registrasi guest/companion
3. Dokumen/consent sesuai policy
4. Verifikasi payment/guarantee/deposit
5. Assign room dan readiness
6. Key/digital key
7. Informasi fasilitas dan request
8. Konfirmasi check-in
```

Wizard mendukung express mode untuk reservation lengkap, tetapi tidak melewati kontrol wajib.

## 15.3. In-House Workspace

```text
current room and stay
companion
folio and credit limit
service requests
housekeeping preference
maintenance issue
message
key access
extension/room move
incident restricted
```

## 15.4. Check-Out Wizard

```text
late charge check
open POS charge check
folio review
split/route adjustment
payment/refund
invoice/receipt
key deactivate
room status transition
feedback/next stay
```

Final checkout boundary harus atomik/idempotent. Jika payment sukses tetapi response hilang, user diarahkan ke status inquiry, bukan menekan bayar ulang.

---

# 16. ROOM RACK DAN ROOM DETAIL

Room rack menampilkan kartu per kamar dengan:

```text
room number/name
room type/floor/zone
front-office status
housekeeping status
inspection status
maintenance status
current/next guest masked
arrival/departure time
open request
last cleaned/inspected
```

Quick actions:

```text
Assign
Block
Mark OOO/OOS
Create Work Order
Open Task
Inspect
View History
```

Room detail drawer/full-screen memiliki tab `Overview`, `Stay Timeline`, `Housekeeping`, `Maintenance`, `Asset`, `Minibar`, `History`.

---

# 17. HOUSEKEEPING BOARD DAN MOBILE TASK

## 17.1. Supervisor Board

Views:

```text
Kanban by status
Floor/zone grid
Employee workload
Timeline
Inspection queue
Discrepancy queue
```

Filters:

```text
property/building/floor/zone
room type
arrival priority
VIP/special request
dirty/clean/inspect
DND/refused service
maintenance dependency
assigned/unassigned
```

Assignment mendukung drag/drop dengan capacity and shift validation. Batch action menampilkan confirmation summary.

## 17.2. Mobile Housekeeper

Task card minimum:

```text
room
priority
stay status
service type
special instruction sanitized
estimated effort
start/pause/complete
checklist
linen/minibar usage
issue/photo
DND/refused
request supervisor
```

One-handed design:

- Primary action berada di bawah.
- Nomor kamar dan status dapat dibaca dari jarak wajar.
- Offline queue terlihat.
- Photo upload dikompresi dan retryable.
- Guest name disembunyikan kecuali diperlukan.
- Completion tidak otomatis membuat room ready jika inspection policy wajib.

## 17.3. Discrepancy

Contoh:

```text
PMS OCCUPIED, HK VACANT
PMS VACANT, HK OCCUPIED
room physically blocked
guest belongings found
minibar variance
```

Resolution memerlukan reason, actor, time, evidence optional, and audit.

---

# 18. MAINTENANCE DAN ENGINEERING UX

## 18.1. Work Order Board

```text
New
Triaged
Assigned
In Progress
Waiting Part
Waiting Vendor
Testing
Completed
Closed
Cancelled
```

Card menampilkan asset/room, severity, guest impact, OOO/OOS impact, SLA, assignee, part status, photo, dan source.

## 18.2. Mobile Engineer

```text
scan QR asset/room
lihat history
start work
diagnosis
checklist
part consumption
photo before/after
vendor handoff
safety note
complete/test
request reopen/OOO extension
```

## 18.3. Preventive Maintenance Calendar

Calendar mempunyai workload balancing, blackout date, occupancy overlay, room closure impact, and overdue indicator. Planner dapat melihat dampak revenue sebelum menutup kamar.

---

# 19. FOLIO DAN CASHIER WORKSPACE

Gunakan workspace split view:

```text
Left: folio window/account list
Center: transaction ledger
Right: guest/stay/payment summary dan actions
```

Functions:

```text
post charge
adjust/void/reverse
transfer charge
split folio
route charge
apply deposit
payment
refund
invoice/receipt
city ledger transfer
authorization/release
close folio
reopen with permission
```

Setiap line menampilkan source, date/time, business date, outlet, reference, tax, amount, currency, operator, and status. Posted line tidak diedit diam-diam; koreksi melalui adjustment/reversal.

Payment dialog:

```text
amount due
selected folio
payment method
currency/exchange rate
provider status
reference
change/refund
receipt destination
```

Full card data/CVV tidak pernah ditampilkan atau disimpan oleh UI.

---

# 20. NIGHT AUDIT CONTROL CENTER

Night audit adalah guided operational control, bukan satu tombol tanpa visibilitas.

## 20.1. Layout

```text
Business Date Header
System and Integration Health
Precheck Checklist
Exception Queue
Posting Preview
Report Checklist
Progress Timeline
Final Roll Control
Audit Log
```

## 20.2. Precheck Categories

```text
arrivals unresolved
no-show candidates
departures/open balance
unposted room/tax/package
open cashier/shift
pending POS charge
failed payment/channel message
room discrepancy
unbalanced ledger
interface queue
report generation readiness
backup/health policy
```

Setiap blocker mempunyai deep link, owner, severity, and resolution status. Retry per step idempotent. User dapat resume setelah interruption. Final roll memerlukan permission, step-up, typed confirmation, dan immutable snapshot.

---

# 21. REVENUE DAN RATE CALENDAR

## 21.1. Desktop Workspace

```text
Date grid by room type
Occupancy/pickup/forecast overlay
BAR/rate plan
Min/Max LOS
CTA/CTD
Stop sell
Overbooking limit
Event/competitor note
Channel parity
Recommendation panel
Change audit
```

Bulk edit memakai scope preview:

```text
property
room type
rate plan
channel
stay date range
day of week
restriction
old/new value
affected sellable nights
```

Publish memerlukan optimistic lock dan approval sesuai threshold. Recommendation AI/RMS tidak pernah auto-publish tanpa policy and confirmation.

## 21.2. Mobile

Revenue mobile bersifat monitoring and limited approval. Grid kompleks menjadi date cards dan exception list. Bulk rate editing penuh diarahkan ke tablet/desktop kecuali urgent one-date override dengan permission.

---

# 22. CHANNEL MANAGER HEALTH UX

Dashboard minimum:

```text
channel connection status
last successful ARI push
pending/failed queue
reservation delivery latency
mapping completeness
rate parity exception
inventory mismatch
credential/certificate expiry
webhook replay/security issue
```

Mapping editor memakai side-by-side mapping dan validation. Unknown external codes masuk exception queue, bukan diabaikan. Manual resend mempunyai idempotency key, preview, reason, and audit.

---

# 23. POS HOSPITALITY UX

Reuse Core POS dengan hospitality extension.

## 23.1. Layout

```text
Context: property/outlet/register/shift
Product/category/search
Table/order or service context
Cart always visible on desktop/tablet
Guest/room lookup
Discount/service charge/tax
Payment/room charge
Kitchen/order status if enabled
```

## 23.2. Room Charge

Flow:

```text
Open room lookup
-> search room/guest/confirmation
-> show masked guest and stay validity
-> validate charge privilege/credit limit/folio routing
-> guest signature/PIN policy optional
-> post charge idempotently
-> print/send receipt
```

Wrong room/checked-out/blocked folio must fail safely without losing POS order.

## 23.3. Touch and Keyboard

- Target besar untuk touch.
- Scanner/keyboard capture tidak kehilangan fokus.
- `F2` search, `F4` guest/room, `F6` hold, `F8` discount, `F9` payment/room charge, `Esc` close modal; configurable bila konflik.
- Network and sync status always visible.

---

# 24. GROUP, CORPORATE, MICE, DAN FUNCTION SPACE UX

## 24.1. Group Workspace

```text
group profile
block/allotment grid
rooming list
pickup and cutoff
rate/contract
billing instruction
master/sub folio
arrival plan
task/message
history
```

Rooming list import mempunyai template signed, preview, duplicate detection, and row-level errors.

## 24.2. Function Space Calendar

- Calendar/day/week/timeline view.
- Setup/teardown buffer terlihat.
- Conflict tidak hanya berdasarkan event time, tetapi room split/combine, setup, cleaning, and maintenance.
- Drag/drop membuat proposal dan conflict check.
- BEO preview berisi version and approval status.

---

# 25. LONG-STAY, KOS, DAN RENTAL UX

Workspace contract:

```text
tenant/resident profile
unit/bed
contract period
rent schedule
deposit
utility meter
recurring charge
service request
visitor/parking policy
renewal/termination
move-in/move-out inspection
outstanding and collection
```

Mobile resident portal:

```text
lihat tagihan
bayar
lihat meter/mutasi
buat request
visitor/parcel
contract document
notice/renewal
```

Property dapat memilih terminology `Tamu`, `Penghuni`, `Penyewa`, `Unit`, `Kamar`, atau `Bed` melalui localization profile tanpa mengubah model inti.

---

# 26. REPORTING UX

Report center:

```text
favorite reports
recent
scheduled
operational
revenue
finance
housekeeping
maintenance
guest
channel
POS
long stay
owner/investor
compliance
```

Report parameter panel memakai defaults yang jelas, validation, business date/timezone, permission masking, preview, snapshot, PDF/Excel, schedule, and reprint log.

Large report asynchronous dengan progress dan notification. Export mengikuti filter/sort/column selection yang terlihat.

---

# 27. NOTIFICATION DAN TASK UX

Notification center membedakan:

```text
Informasi
Perlu Tindakan
Persetujuan
Peringatan
Kritis
Selesai
```

`READ` berbeda dari `ACTIONED`. Deep link memvalidasi context dan permission. Notification card memuat objek, property, waktu, SLA, action, and help. Sensitive guest details dimasking pada push/lock screen.

Task inbox:

```text
My Tasks
Team Queue
Due Soon
Overdue
Escalated
Delegated
Completed
```

---

# 28. AI UX

AI assistant berada dekat Help/Notification dan memakai context halaman yang diizinkan.

Actions:

```text
Ringkas Hari Ini
Jelaskan Angka
Temukan Exception
Analisis Pickup
Buat Draft Balasan Tamu
Buat Draft Shift Handover
Ringkas Ulasan
Jelaskan Night Audit Blocker
Buat Draft Work Order
```

Hasil AI menampilkan source/evidence, periode, filter, confidence/limitation, and `Draft` label. AI tidak boleh mempublikasikan rate, memproses refund, check-in/out, memberi digital key, atau menjalankan night audit otomatis.

---

# 29. FORM, TABLE, DRAWER, DAN DIALOG STANDARD

## 29.1. Form

```text
sectioned and progressive disclosure
required label + reason
inline validation
server error mapping
lookup search
money/quantity/date/time correct type
business-date vs wall-clock explanation
unsaved changes guard
auto-save hanya untuk draft yang aman
```

## 29.2. Data Table

```text
server pagination/sort/filter
sticky key columns
column chooser
saved view
row density
selection summary
bulk action preview
export active filter
keyboard navigation
mobile card transformation
```

## 29.3. Drawer

Drawer untuk quick view dan task singkat. Full edit kompleks menggunakan route. Drawer mempunyai URL/deep link bila perlu agar dapat dipulihkan.

## 29.4. Dialog

Dialog hanya untuk decision ringkas. Wizard/large form tidak ditempatkan dalam dialog sempit. Destructive/financial action menggunakan reason and explicit summary.

---

# 30. STATUS, EMPTY, LOADING, ERROR, OFFLINE, DAN STALE

Setiap layar wajib memiliki:

```text
skeleton/loading
empty state with next action
no result state with clear filters
permission denied
feature not entitled
property not configured
business date locked
provider unavailable
offline cached data
stale data timestamp
sync queued/syncing/conflict/failed
recoverable error with correlation ID
```

Toast tidak boleh menjadi satu-satunya bukti keberhasilan transaksi penting. Check-in, payment, posting, room charge, night audit, and publish harus menampilkan final state/reference.

---

# 31. RESPONSIVE BEHAVIOR MATRIX

| Pattern | Desktop | Tablet | Mobile |
|---|---|---|---|
| App navigation | Sidebar | Collapsible drawer | Bottom nav + drawer |
| Tape chart | Full grid | Reduced grid | Card/date list |
| Data table | Multi-column | Priority columns + scroll | Card list/full detail |
| Filter | Inline + drawer | Drawer | Bottom sheet |
| Detail | Side drawer or split | Full drawer | Full-screen route |
| Primary action | Header toolbar | Header/sticky | Sticky bottom |
| KPI | Grid | 2–4 columns | Horizontal cards |
| Reservation form | Multi-column | 2 columns | Single column |
| Night audit | Multi-panel | Stacked panels | Monitor/resolve only; final roll desktop policy configurable |
| Revenue calendar | Full grid | Reduced grid | Date cards/approval |
| POS | Product + cart split | Touch split | Limited/mobile POS profile |

---

# 32. ACCESSIBILITY

Target minimum WCAG 2.2 AA.

```text
keyboard complete
visible focus
skip links
landmark and heading order
accessible names for icon controls
screen reader status announcements
error association
contrast validation
not color-only
minimum target size
zoom/reflow
reduced motion
caption/transcript for media
alt text workflow
accessible calendar/table alternative
```

Operational grids menyediakan alternative list/table semantics. Drag/drop selalu mempunyai keyboard/menu alternative.

---

# 33. KEYBOARD SHORTCUT

Shortcut global baseline:

```text
Ctrl/Cmd + K  Command palette
/             Search pada workspace ketika tidak fokus input
Alt + N       New sesuai context
Ctrl/Cmd + S  Save draft
Ctrl/Cmd + P  Preview/print
Esc           Close drawer/dialog satu tingkat
?             Contextual shortcut/help
```

Front desk/POS shortcuts hanya aktif pada route terkait dan mempunyai tooltip/menu alternative. Shortcut tidak boleh mengambil alih kombinasi browser/OS tanpa fallback.

---

# 34. PERFORMANCE DAN PERCEIVED SPEED

Target UI awal harus divalidasi melalui baseline:

```text
public LCP/INP/CLS sesuai web performance budget
booking availability response dengan skeleton dan cancelable request
Today dashboard useful content segera terlihat
virtualized tape chart/large room list
lazy-load tabs dan media
prefetch reservation detail yang aman
optimistic UI hanya untuk low-risk action
no optimistic final payment/check-in/night-audit
image responsive and CDN-ready
cache partitioned by tenant/property/context
```

No cross-tenant cache key. Property switch membersihkan query cache sensitif.

---

# 35. OFFLINE DAN RESILIENCE UX

Offline tidak berarti semua aksi diizinkan.

```text
READ_CACHED
LOCAL_DRAFT
QUEUED_COMMAND
ONLINE_REQUIRED
CONFLICT
REJECTED
```

Housekeeping, maintenance, guest request, and selected POS draft dapat di-queue sesuai policy. Check-in final, payment final, digital key activation, rate publish, and night audit default `ONLINE_REQUIRED` kecuali arsitektur offline telah dibuktikan aman.

Offline queue panel menampilkan object, command, time, retry, failure reason, and conflict resolution. Tidak ada silent retry tanpa status.

---

# 36. PRIVACY DAN FIELD MASKING DI UI

Default masking:

```text
identity document number
full address where unnecessary
phone/email on shared board
payment token/account
corporate negotiated rate
commission and net rate
incident/do-not-rent
staff personal data
owner/investor data
```

Reveal memakai permission, reason, limited duration, and audit. Screenshot/export/print mengikuti masking aktif, bukan menampilkan field tersembunyi.

---

# 37. VISUAL REGRESSION DAN VIEWPORT

Minimum screenshot/evidence:

```text
1920x1080
1440x900
1366x768
1024x768
768x1024
430x932
390x844
360x800
```

Test tema light/dark bila dark mode didukung, locale Indonesia/English, long text, RTL hanya jika portal mengaktifkan bahasa RTL, high zoom, empty/error/loading/offline, dan role/permission variants.

Reference snapshot tidak boleh diperbarui otomatis untuk menyembunyikan regresi. Functional component parity lebih penting daripada kemiripan dekoratif.

---

# 38. KATALOG LAYAR MINIMUM

| ID | Layar | Kelompok | Target Perangkat |
|---|---|---|---|
| `PUB-01` | Homepage MitraInap | Public | Desktop/Mobile |
| `PUB-02` | Solusi per Jenis Properti | Public | Desktop/Mobile |
| `PUB-03` | Daftar Fitur | Public | Desktop/Mobile |
| `PUB-04` | Harga dan Konsultasi | Public | Desktop/Mobile |
| `PUB-05` | Demo | Public | Desktop/Mobile |
| `PUB-06` | Registrasi Properti | Public | Desktop/Mobile |
| `TEN-01` | Homepage Tenant | Tenant Website | Desktop/Mobile |
| `TEN-02` | Daftar Kamar/Unit | Tenant Website | Desktop/Mobile |
| `TEN-03` | Detail Kamar/Unit | Tenant Website | Desktop/Mobile |
| `TEN-04` | Promo/Paket | Tenant Website | Desktop/Mobile |
| `TEN-05` | Fasilitas/Acara | Tenant Website | Desktop/Mobile |
| `TEN-06` | Kontak/Lokasi/FAQ | Tenant Website | Desktop/Mobile |
| `BE-01` | Search Availability | Booking Engine | Desktop/Mobile |
| `BE-02` | Room and Rate Results | Booking Engine | Desktop/Mobile |
| `BE-03` | Add-on Selection | Booking Engine | Desktop/Mobile |
| `BE-04` | Guest Details | Booking Engine | Desktop/Mobile |
| `BE-05` | Payment/Guarantee | Booking Engine | Desktop/Mobile |
| `BE-06` | Confirmation | Booking Engine | Desktop/Mobile |
| `BE-07` | Manage Booking | Booking Engine | Desktop/Mobile |
| `CTX-01` | Login and Role Selection | Platform | Desktop/Mobile |
| `CTX-02` | Property/Context Selection | Platform | Desktop/Mobile |
| `OPS-01` | Portfolio Dashboard | Operations | Desktop/Tablet |
| `OPS-02` | Today Command Center | Operations | Desktop/Tablet/Mobile |
| `OPS-03` | Exception Queue | Operations | Desktop/Tablet/Mobile |
| `RES-01` | Reservation Search/List | Reservation | Desktop/Tablet/Mobile |
| `RES-02` | Tape Chart | Reservation | Desktop/Tablet |
| `RES-03` | Mobile Reservation Calendar | Reservation | Mobile |
| `RES-04` | New Reservation | Reservation | Desktop/Tablet/Mobile |
| `RES-05` | Reservation Workspace | Reservation | Desktop/Tablet/Mobile |
| `RES-06` | Quote/Proposal | Reservation | Desktop/Tablet |
| `RES-07` | Cancellation/No-show | Reservation | Desktop/Tablet/Mobile |
| `FO-01` | Arrival List | Front Office | Desktop/Tablet/Mobile |
| `FO-02` | Check-in Wizard | Front Office | Desktop/Tablet |
| `FO-03` | In-house List | Front Office | Desktop/Tablet/Mobile |
| `FO-04` | Room Assignment | Front Office | Desktop/Tablet |
| `FO-05` | Room Move | Front Office | Desktop/Tablet/Mobile |
| `FO-06` | Departure List | Front Office | Desktop/Tablet/Mobile |
| `FO-07` | Check-out Wizard | Front Office | Desktop/Tablet |
| `GUEST-01` | Guest Search | Guest CRM | Desktop/Tablet/Mobile |
| `GUEST-02` | Guest Profile | Guest CRM | Desktop/Tablet/Mobile |
| `GUEST-03` | Duplicate/Merge Review | Guest CRM | Desktop |
| `GUEST-04` | Consent/Privacy Request | Guest CRM | Desktop/Tablet |
| `ROOM-01` | Room Rack | Rooms | Desktop/Tablet/Mobile |
| `ROOM-02` | Room Detail | Rooms | Desktop/Tablet/Mobile |
| `ROOM-03` | Room Type and Inventory | Rooms | Desktop |
| `HK-01` | Housekeeping Board | Housekeeping | Desktop/Tablet |
| `HK-02` | My Housekeeping Tasks | Housekeeping | Mobile |
| `HK-03` | Housekeeping Task Detail | Housekeeping | Mobile |
| `HK-04` | Inspection Queue | Housekeeping | Tablet/Mobile |
| `HK-05` | Discrepancy Queue | Housekeeping | Desktop/Tablet |
| `HK-06` | Linen/Laundry | Housekeeping | Desktop/Tablet/Mobile |
| `HK-07` | Lost and Found | Housekeeping | Desktop/Tablet/Mobile |
| `ENG-01` | Maintenance Board | Engineering | Desktop/Tablet |
| `ENG-02` | My Work Orders | Engineering | Mobile |
| `ENG-03` | Work Order Detail | Engineering | Desktop/Tablet/Mobile |
| `ENG-04` | Preventive Calendar | Engineering | Desktop/Tablet |
| `ENG-05` | OOO/OOS Planner | Engineering | Desktop/Tablet |
| `FOL-01` | Folio Workspace | Cashiering | Desktop/Tablet |
| `FOL-02` | Post Charge | Cashiering | Desktop/Tablet |
| `FOL-03` | Payment/Refund | Cashiering | Desktop/Tablet |
| `FOL-04` | City Ledger | Cashiering | Desktop |
| `NA-01` | Night Audit Control | Night Audit | Desktop/Tablet |
| `NA-02` | Night Audit Exceptions | Night Audit | Desktop/Tablet |
| `NA-03` | Night Audit Reports | Night Audit | Desktop |
| `REV-01` | Rate Calendar | Revenue | Desktop/Tablet |
| `REV-02` | Restrictions | Revenue | Desktop/Tablet |
| `REV-03` | Pickup/Forecast | Revenue | Desktop/Tablet/Mobile |
| `REV-04` | Rate Recommendation Review | Revenue | Desktop/Tablet |
| `CH-01` | Channel Dashboard | Distribution | Desktop/Tablet |
| `CH-02` | Channel Mapping | Distribution | Desktop |
| `CH-03` | ARI Queue | Distribution | Desktop/Tablet |
| `CH-04` | Reservation Delivery Exception | Distribution | Desktop/Tablet |
| `POS-01` | POS Register | POS/F&B | Desktop/Tablet |
| `POS-02` | Room Charge Lookup | POS/F&B | Desktop/Tablet |
| `POS-03` | Kitchen/Order Status | POS/F&B | Desktop/Tablet |
| `POS-04` | Shift Reconciliation | POS/F&B | Desktop/Tablet |
| `GRP-01` | Group Block | Group/MICE | Desktop/Tablet |
| `GRP-02` | Rooming List | Group/MICE | Desktop/Tablet |
| `MICE-01` | Function Space Calendar | Group/MICE | Desktop/Tablet |
| `MICE-02` | Event Workspace/BEO | Group/MICE | Desktop/Tablet |
| `LNG-01` | Long-stay Contract | Long Stay | Desktop/Tablet |
| `LNG-02` | Recurring Billing | Long Stay | Desktop/Tablet |
| `LNG-03` | Utility Meter | Long Stay | Desktop/Tablet/Mobile |
| `OWN-01` | Owner Statement | Owner | Desktop/Mobile |
| `OWN-02` | Unit Performance | Owner | Desktop/Mobile |
| `GP-01` | Guest Portal Home | Guest Portal | Mobile/Desktop |
| `GP-02` | My Booking/Stay | Guest Portal | Mobile/Desktop |
| `GP-03` | Guest Request | Guest Portal | Mobile |
| `GP-04` | Folio and Checkout | Guest Portal | Mobile/Desktop |
| `KSK-01` | Self Check-in Kiosk | Kiosk | Kiosk |
| `KSK-02` | Self Checkout Kiosk | Kiosk | Kiosk |
| `CMS-01` | Tenant Website Dashboard | CMS | Desktop |
| `CMS-02` | Page/Article Editor | CMS | Desktop/Tablet |
| `CMS-03` | Theme and Preview | CMS | Desktop/Tablet/Mobile Preview |
| `RPT-01` | Report Center | Reporting | Desktop/Tablet/Mobile |
| `RPT-02` | Report Preview | Reporting | Desktop/Tablet |
| `ADM-01` | Property Setup | Administration | Desktop |
| `ADM-02` | Room/Rate Setup | Administration | Desktop |
| `ADM-03` | Role/Permission | Administration | Desktop |
| `ADM-04` | Integration Health | Administration | Desktop |
| `ADM-05` | Audit | Administration | Desktop |
| `PLT-01` | Portal and Product Admin | Platform | Desktop |
| `PLT-02` | Tenant Provisioning | Platform | Desktop |
| `PLT-03` | Subscription/Billing | Platform | Desktop |


Setiap layar mempunyai test minimum:

```text
<SCREEN-ID>-NORMAL
<SCREEN-ID>-VALIDATION
<SCREEN-ID>-RBAC
<SCREEN-ID>-AUDIT
<SCREEN-ID>-RESPONSIVE
<SCREEN-ID>-ACCESSIBILITY
<SCREEN-ID>-ERROR-OFFLINE
<SCREEN-ID>-VISUAL
```

Kategori `PRINT_EXPORT`, `CONCURRENCY`, `IDEMPOTENCY`, `PAYMENT`, `SYNC`, atau `SECURITY` ditambahkan sesuai fungsi layar.

---

# 39. ACCEPTANCE CHECKLIST UI/UX

```text
[ ] seluruh route memakai app shell dan context yang benar
[ ] tidak ada tombol tanpa handler nyata
[ ] disabled action mempunyai alasan
[ ] desktop/tablet/mobile layouts diuji
[ ] data-dense grid mempunyai mobile alternative
[ ] keyboard and touch supported sesuai persona
[ ] no dark pattern pada booking engine
[ ] total dan policy terlihat sebelum payment
[ ] tenant/property/business-date context selalu jelas
[ ] sensitive fields masked dan reveal audited
[ ] loading/empty/error/offline/stale states lengkap
[ ] deep link permission-safe
[ ] drag/drop mempunyai alternative
[ ] WCAG 2.2 AA target diuji
[ ] visual snapshots pada viewport wajib tersedia
[ ] performance budget lulus
[ ] no cross-tenant cache leakage
[ ] Help/guided tour/shortcut tersedia
[ ] final financial/operational action menunjukkan reference/status
[ ] UAT front desk, guest, housekeeping, engineering, revenue, night audit, dan management ditandatangani
```

# AKHIR SPESIFIKASI UI/UX RESPONSIVE MITRAINAP V14
