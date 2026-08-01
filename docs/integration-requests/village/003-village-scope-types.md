# Integration Request 003 — Jenis cakupan wilayah desa pada `user_scope_assignment`

**Vertikal:** info-desa
**Cabang:** `feature/v12-info-desa`
**Diajukan:** 31 Juli 2026
**Sifat:** Bukan pemblokir. Village sudah berjalan dengan tabelnya sendiri;
permintaan ini untuk menyatukannya kelak.

---

## Kebutuhan

`user_scope_assignment` milik Core adalah tempat yang benar untuk menyimpan
cakupan data pengguna, dan village lebih suka memakainya. Tetapi
`ck_user_scope_type` membatasi jenis cakupan pada daftar tertutup:

```
PLATFORM, TENANT, LEGAL_ENTITY, BRAND, STORE, OUTLET, OUTLET_TERMINAL,
WAREHOUSE, FULFILLMENT_LOCATION, DEPARTMENT, TEAM, SELF, ASSIGNED_TRIP,
ASSIGNED_QUEUE, OWNERSHIP, API_SCOPE, PAYMENT_PROVIDER_ACCOUNT
```

Tidak ada dusun, RW, maupun RT — dan memang **tidak seharusnya ada sejak awal**:
itu kosakata pemerintahan desa, bukan kosakata perdagangan. Core tidak keliru;
ia hanya belum mengenal vertikal ini.

Menambahkannya berarti mengubah constraint pada tabel bersama, yang perintah §3
larang dilakukan langsung dari cabang vertikal.

## Yang diminta

Memperluas `ck_user_scope_type` dengan tujuh nilai:

```sql
ALTER TABLE "{{TENANT_SCHEMA}}".user_scope_assignment
  DROP CONSTRAINT ck_user_scope_type;

ALTER TABLE "{{TENANT_SCHEMA}}".user_scope_assignment
  ADD CONSTRAINT ck_user_scope_type CHECK (scope_type IN (
    -- yang sudah ada
    'PLATFORM','TENANT','LEGAL_ENTITY','BRAND','STORE','OUTLET','OUTLET_TERMINAL',
    'WAREHOUSE','FULFILLMENT_LOCATION','DEPARTMENT','TEAM','SELF',
    'ASSIGNED_TRIP','ASSIGNED_QUEUE','OWNERSHIP','API_SCOPE',
    'PAYMENT_PROVIDER_ACCOUNT',
    -- info-desa
    'VILLAGE_UNIT','VILLAGE_SUB_AREA','VILLAGE_RW','VILLAGE_RT',
    'VILLAGE_SELF','VILLAGE_AGGREGATE_ONLY','VILLAGE_NONE'
  ));
```

**Polanya sudah pernah dikerjakan.** `V012__marketplace_profiles.sql` melakukan
hal yang persis sama untuk `ck_role_module_profile_code` ketika marketplace
memerlukan kode profil M1–M9. Permintaan ini mengikuti jejak itu.

## Yang dikerjakan village sementara ini

Village **tidak menunggu**. D-3 memakai `village_scope_assignment` di dalam
skema tenant, dengan bentuk yang **sengaja dibuat sama persis** dengan milik
Core — kolom yang sama, nama yang sama, semantik `valid_from` / `valid_until` /
`revoked_at` yang sama.

Akibatnya, penggabungan kelak hanya memindahkan baris:

```sql
INSERT INTO user_scope_assignment
  (user_subject_id, scope_type, scope_id, valid_from, valid_until,
   note, created_at, created_by, revoked_at, revoked_by, revoke_reason)
SELECT user_subject_id, scope_type, scope_id, valid_from, valid_until,
       note, created_at, created_by, revoked_at, revoked_by, revoke_reason
  FROM village_scope_assignment;
```

Satu perbedaan yang disengaja: `scope_id` village boleh `NULL` untuk
`VILLAGE_UNIT`, `VILLAGE_AGGREGATE_ONLY`, dan `VILLAGE_NONE`, sedangkan Core
mewajibkannya `NOT NULL`. Ketiga jenis itu tidak menunjuk objek apa pun —
memaksakan UUID palsu hanya untuk memenuhi kolom akan menghasilkan id yang
menunjuk ke ketiadaan.

Bila Core menerima permintaan ini, ada dua pilihan: melonggarkan `scope_id`
menjadi nullable dengan constraint bersyarat (seperti yang village lakukan),
atau village memakai `VILLAGE_UNIT` dengan `scope_id` menunjuk `village_unit.id`
— yang sesungguhnya lebih tepat. Village bersedia menyesuaikan.

## Backward compatibility

Penuh. Memperluas daftar nilai pada `CHECK` tidak membatalkan baris mana pun
yang sudah ada.

## Pengujian yang diminta

```
tujuh nilai baru diterima
nilai di luar daftar tetap ditolak
baris lama tidak terpengaruh
indeks penugasan aktif tetap bekerja untuk jenis baru
```

## Catatan bagi sesi eMedik dan eKoperasi

Keduanya kemungkinan besar menghadapi hal yang sama. eMedik memerlukan cakupan
setingkat poli, bangsal, atau wilayah kerja Puskesmas; eKoperasi memerlukan
setingkat unit atau wilayah keanggotaan.

Bila benar demikian, lebih baik Core memperluas constraint itu **sekali** untuk
ketiga vertikal daripada tiga kali berturut-turut — dan lebih baik lagi bila
sekalian dipertimbangkan apakah daftar tertutup masih bentuk yang tepat ketika
vertikalnya bertambah.
