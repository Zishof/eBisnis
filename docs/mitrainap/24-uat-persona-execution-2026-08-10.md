# UAT Persona MitraInap v14 — eksekusi nyata, 10 Agustus 2026

Melanjutkan `20-uat-persona-matrix.md` ("skenario otomatis/API PASS lokal;
sign-off manusia dan provider eksternal tetap harus dicatat saat staging").
Dokumen ini mencatat eksekusi HTTP sungguhan (bukan hanya unit test) untuk
kesembilan persona, dijalankan dari checkout bersih
`feature/v14-mitrainap-hospitality-current` (commit dasar `1fe9535`) pada
basis data pengembangan lokal, memakai tenant nyata (`uat_persona_hotel`,
didaftarkan lewat `POST /public/hospitality/registrations` -- bukan seed).

Metode: setiap persona diuji lewat curl sungguhan terhadap API yang
berjalan, termasuk memicu path GAGAL secara sengaja (transisi tidak sah,
idempotency-key diulang, PAN mentah, EOD tanpa step-up) untuk membuktikan
guard-nya benar-benar menolak, bukan hanya membuktikan jalur sukses.

## Ringkasan hasil

| Persona | Hasil | Bug nyata ditemukan |
|---|---|---|
| Front Desk | LULUS penuh (arrival→check-in→room move→checkout→re-checkin ditolak) | 2 -- lihat §1 |
| Cashier/Night Auditor | LULUS penuh (folio+shift+EOD, semua guard uang) | 0 |
| Housekeeping | LULUS penuh (assign→start(offline replay)→complete→inspect→close) | 2 -- lihat §1 |
| Engineering/Maintenance | LULUS penuh (WO penuh→closure diblokir sebelum WO aktif→release diblokir sebelum VERIFIED) | 2 -- lihat §1 |
| Sales/MICE | LULUS penuh (account→group→allotment overbooking guard→rooming→event clash guard→BEO approve) | 1 -- lihat §1 |
| Resident/Owner (Longstay) | LULUS sebagian (kontrak/inspeksi/aktivasi/meter/reading LULUS; owner statement TIDAK DAPAT diuji) | 1 -- lihat §2 (gap, bukan bug baris kode) |
| Guest/Kiosk (Experience) | GAGAL -- portal/kiosk tidak dapat diakses tamu sama sekali | 1 KRITIS -- lihat §2 |
| ERP/Analyst | LULUS penuh (port→emit(idempoten)→delivery→reconcile; report+AI draft evidence-bound) | 1 -- lihat §1 (sama dengan pola erp delivery) |
| POS Outlet | Bug pola sama diperbaiki lewat sapuan statis; alur sale-ke-kitchen penuh TIDAK diuji langsung (butuh setup POS inti di luar cakupan hospitality) | 1 (ditemukan lewat sapuan, sama seperti di atas) |

Regresi: `pnpm test` (186 suite API/4176 test) LULUS penuh sesudah seluruh
perbaikan di bawah, `tsc --noEmit` bersih.

## §1 — Bug nyata ditemukan dan diperbaiki (7 lokasi, 2 pola)

### Pola A -- nama kolom Indonesia yang tidak pernah ada di skema

`hospitality_room` sungguhnya memakai kolom Inggris (`room_number`,
`floor`) dan `hospitality_room_type` memakai `name` -- bukan `nomor_kamar`/
`lantai`/`nama` yang justru ditulis sebagai kolom MENTAH pada tiga query
`SELECT`. Ini BUKAN salah ketik pada alias output (halaman lama seperti
`hospitality-properti.service.ts` MI-5 sudah benar memakai
`room_number AS nomor_kamar`) -- ini kolom mentah yang tidak pernah ada,
sehingga tiga endpoint di bawah 100% gagal untuk SETIAP permintaan sebelum
diperbaiki, bukan hanya kasus tepi:

- `HospitalityFrontdeskService.board()` -- papan arrival/departure gagal total.
- `HospitalityHousekeepingService.board()` -- papan housekeeping gagal total.
- `HospitalityMaintenanceService.board()` -- papan work order gagal total.

Diperbaiki dengan mengalias kolom asli ke nama keluaran yang sama
(`rm.room_number AS nomor_kamar`, dst) -- kontrak API tidak berubah.

### Pola B -- "inconsistent types deduced for parameter $N"

Persis bug yang sama yang pernah ditemukan dan diperbaiki di
`hospitality-reservation.service.ts` (MI-8, sesi sebelumnya): parameter
`$N` yang sama dipakai TELANJANG (tanpa cast) pada dua konteks tipe
berbeda dalam SATU query -- sekali sebagai nilai kolom (`status=$2`), sekali
sebagai pembanding literal string (`CASE WHEN $2='X'`). PostgreSQL kadang
tidak dapat menyimpulkan satu tipe konsisten untuk kasus ini, dan galatnya
HANYA muncul saat query sungguhan dijalankan -- tidak pernah terlihat dari
`tsc`/lint/unit test tiruan. Ditemukan di LIMA lokasi lain sesudah pola
yang sama diketahui, disapu secara sistematis ke seluruh modul baru
(bukan ditunggu ditemukan satu per satu lewat UAT):

- `HospitalityFrontdeskService.moveRoom()` -- juga "column reference id is
  ambiguous" terpisah (STAY_COLUMNS dipakai pada query yang JOIN dua tabel
  yang sama-sama punya kolom `id`; diperbaiki dengan mengualifikasi
  `gs.`).
- `HospitalityHousekeepingService.transition()` -- transisi tugas
  housekeeping (START/PAUSE/dst) gagal total untuk SETIAP aksi.
- `HospitalityMaintenanceService.transition()` -- transisi work order
  gagal total untuk SETIAP aksi SELAIN status pertama (NEW→TRIAGED masih
  lolos secara kebetulan tergantung query lain; transisi berikutnya gagal).
- `HospitalityMaintenanceService.closeRoom()` -- **bug TERPISAH**, bukan
  pola B: kolom `approved_at TIMESTAMPTZ NOT NULL` tidak pernah diisi pada
  INSERT (hilang dari daftar kolom sama sekali), sehingga SETIAP
  penutupan kamar (OOO/OOS) gagal dengan pelanggaran NOT NULL. Diperbaiki
  dengan menambahkan `approved_at` = `now()` ke INSERT.
- `HospitalityGoLiveService` (delivery job channel manager) -- retry/DLQ
  distribution job.
- `HospitalityGuestServiceOperations.update()` -- update status permintaan
  tamu (concierge/ancillary).
- `HospitalityMiceService.beo()` -- approval BEO (banquet event order).
- `HospitalityErpService.delivery()` -- update status pengiriman event ERP.
- `PosHospitalityService.kitchen()` -- transisi status tiket dapur
  (PREPARING/READY/SERVED).

Diperbaiki dengan cast eksplisit `$N::varchar` pada SETIAP kemunculan
parameter yang bersangkutan dalam query yang sama (bukan hanya kemunculan
pertama) -- pola sama yang sudah dipakai sejak perbaikan MI-8.

## §2 — Temuan yang SENGAJA TIDAK diperbaiki tergesa-gesa

### Guest/Kiosk (Experience) -- KRITIS, portal tamu tidak dapat diakses tamu

`HospitalityExperienceController.portal()`/`kiosk()`/`verify()` memakai
`@CurrentUser() u: AuthenticatedUser` dan `@Permissions(...)` seperti
endpoint staf biasa -- padahal `HospitalityExperienceService.portal()`
SENDIRI sudah dirancang benar sebagai mekanisme tanpa login staf: ia
memverifikasi identitas lewat hash token sesi tamu
(`hospitality_guest_portal_session.token_hash`), bukan JWT. Akibatnya
SETIAP permintaan tamu/kiosk sungguhan (tanpa kredensial staf) ditolak
`UNAUTHORIZED` sebelum sampai ke logika yang benar itu -- dibuktikan
lewat `curl` tanpa header Authorization, menghasilkan "Token akses tidak
ditemukan."

Ini BUKAN kesalahan satu baris. Layanan tamu publik yang tetap terikat ke
satu penyewa memerlukan mekanisme resolusi schema yang aman dari sisi
permintaan -- pola yang sama dengan `PublicTenantResolver`/host resolution
yang dibangun untuk situs properti publik MI-3
(`HospitalityPublicSiteService`) -- BUKAN sekadar menambah `@Public()`
pada endpoint yang masih memanggil `sc(u)` (yang akan tetap gagal sebab
`u` tidak ada pada permintaan tanpa JWT). Memperbaikinya tergesa-gesa
berisiko menghasilkan kebocoran lintas tenant tepat seperti yang dilarang
kriteria gagal `20-uat-persona-matrix.md` -- karena itu SENGAJA didiamkan
sebagai temuan tercatat, bukan ditambal dengan asumsi yang belum
diverifikasi.

**Tindak lanjut yang direkomendasikan**: bangun ulang resolusi tenant
untuk `portal`/`kiosk`/`verify` memakai `PublicTenantResolver` (host) atau
pola token-membawa-konteks-tenant yang setara, ditinjau sebagai perubahan
tersendiri dengan uji keamanan lintas-tenant eksplisit -- bukan diperbaiki
sebagai bagian dari UAT ini.

### Resident/Owner -- statement pemilik tidak dapat dibuat

`hospitality_owner_statement.owner_contract_id` mengacu ke
`hospitality_owner_contract` (entitas KEPEMILIKAN properti, kolom
`owner_name`/`commission_percent`/`room_id`) -- entitas yang BERBEDA dari
`hospitality_rental_contract` (kontrak sewa PENGHUNI, yang dites lengkap
LULUS di atas). Tidak ada satu pun endpoint di
`HospitalityLongstayController` yang membuat baris
`hospitality_owner_contract` -- artinya fitur "owner statement" (bagian
dari persona Resident/**Owner**) tidak dapat dipakai ujung ke ujung sama
sekali, terlepas dari data appartemen/penghuni yang sudah benar. Dicatat
sebagai gap fitur (endpoint CRUD `hospitality_owner_contract` hilang),
bukan diperbaiki di sini -- menambah endpoint baru adalah cakupan
implementasi, bukan verifikasi UAT.

### POS Outlet -- alur sale-ke-kitchen-ke-room-charge penuh belum diuji langsung

Bug pola B pada `PosHospitalityService.kitchen()` sudah diperbaiki (lihat
§1), tetapi menguji alur LENGKAP (buat sale POS inti → tautkan konteks
hospitality → tiket dapur → room charge ke folio → refund) memerlukan
penyiapan modul POS inti (outlet, produk, harga) yang berada di luar
cakupan modul hospitality itu sendiri. Diverifikasi lewat perbaikan kode
dan `pos-hospitality.spec.ts` (lulus), TIDAK lewat curl ujung-ke-ujung
seperti delapan persona lain.

## Data uji

Tenant `uat_persona_hotel` (didaftarkan sungguhan, bukan seed) dengan satu
properti (`UAT Persona Hotel Property`), satu tipe kamar (`Deluxe Room`),
dua kamar (101, 102), satu tamu, satu reservasi, satu kontrak sewa jangka
panjang, satu akun korporat MICE, satu event/BEO, dan berbagai work
order/tugas housekeeping yang dibuat selama pengujian ini. Tenant ini
DIBIARKAN di basis data pengembangan lokal (bukan dihapus) -- lihat catatan
serupa pada `docs/changelog/hospitality.md` MI-3 soal risiko
`DROP SCHEMA ... CASCADE` pada Postgres lokal ini.
