# Integration Request 003 — Indeks pasien lintas fasilitas di control plane

**Vertical:** eMedik
**Diajukan:** 1 Agustus 2026
**Branch:** `feature/v12-emedik`
**Status:** menunggu keputusan Core
**Menghalangi:** identitas pasien lintas fasilitas (H-2 sebagian, H-10 penuh)

---

## Kebutuhan

Pemilik sistem memutuskan **satu fasilitas, satu skema**: setiap pendaftaran
rumah sakit, puskesmas, posyandu, klinik, atau apotek memperoleh skema basis
data sendiri agar datanya tidak bercampur.

Arsitektur inti sudah melakukannya — `tenant_schema_registry.tenantId` unik,
sehingga satu pendaftaran menghasilkan satu skema. Tidak ada perubahan yang
diperlukan untuk itu.

Yang belum terjawab: spesifikasi eMedik §5 mewajibkan **Enterprise Master
Patient Index** — satu identitas pasien lintas fasilitas, supaya alergi yang
tercatat di klinik A terlihat saat meresepkan di rumah sakit B.

Kedua hal itu tidak dapat dipenuhi sekaligus di dalam satu skema. Tabel
`patient` klinik A memang tidak dapat dibaca dari skema rumah sakit B — itulah
gunanya pemisahan, dan melubanginya membatalkan keputusan pemilik sistem.

Identitas lintas fasilitas karena itu harus berada **di atas** skema.

## Usulan

Dua tabel pada `platform`:

```prisma
model EnterprisePatient {
  id            String   @id @default(uuid()) @db.Uuid
  // Nilai yang dibawa ke seluruh fasilitas.
  publicId      String   @unique @map("public_id") @db.VarChar(64)
  // Pengenal yang dapat memutuskan secara mutlak. Disimpan sebagai hash,
  // bukan nilai mentah: control plane tidak perlu tahu NIK siapa pun, ia
  // hanya perlu tahu apakah dua fasilitas menunjuk orang yang sama.
  nikHash       String?  @unique @map("nik_hash") @db.VarChar(64)
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  links         EnterprisePatientLink[]
  @@map("enterprise_patient")
}

model EnterprisePatientLink {
  id                  String   @id @default(uuid()) @db.Uuid
  enterprisePatientId String   @map("enterprise_patient_id") @db.Uuid
  tenantId            String   @map("tenant_id") @db.Uuid
  schemaName          String   @map("schema_name") @db.VarChar(64)
  // patient.id pada skema fasilitas itu.
  localPatientId      String   @map("local_patient_id") @db.Uuid
  medicalRecordNumber String?  @map("medical_record_number") @db.VarChar(96)
  linkedAt            DateTime @default(now()) @map("linked_at") @db.Timestamptz(6)
  unlinkedAt          DateTime? @map("unlinked_at") @db.Timestamptz(6)

  enterprisePatient EnterprisePatient @relation(fields: [enterprisePatientId], references: [id])

  @@unique([tenantId, localPatientId])
  @@index([enterprisePatientId])
  @@map("enterprise_patient_link")
}
```

### Yang TIDAK disimpan di control plane

Disebutkan tegas, karena inilah yang menentukan apakah usulan ini aman:

```
nama pasien
tanggal lahir
alamat, telepon, surel
diagnosis, alergi, hasil, resep — apa pun yang bersifat klinis
NIK mentah
```

Control plane hanya menyimpan **penunjuk**: orang ini punya rekam di fasilitas
mana saja. Isinya tetap di skema fasilitas masing-masing.

Sebabnya bukan kehati-hatian berlebihan. Control plane dapat dibaca operator
platform, dan operator platform tidak berhak mengetahui nama pasien fasilitas
mana pun — apalagi diagnosisnya. Indeks yang menyimpan nama akan menjadi
daftar seluruh pasien di seluruh Indonesia dalam satu tabel, dan itu justru
kebalikan dari yang diminta pemilik sistem.

### Alur pencarian lintas fasilitas

```
1. Fasilitas B mencari pasien dengan NIK tertentu
2. Hash NIK  →  cari pada platform.enterprise_patient
3. Ketemu    →  daftar fasilitas lain yang punya rekamnya
4. Fasilitas B MEMINTA PERSETUJUAN pasien
5. Persetujuan diberikan → fasilitas A membuka ringkasan lewat kontrak,
   tercatat pada health_access_log kedua fasilitas
```

Langkah 4 bukan formalitas. Akses lintas fasilitas menjadi tindakan sadar yang
tercatat — lebih baik daripada tabel bersama, di mana hal itu terjadi diam-diam
setiap kali seseorang membuka layar.

## Backward compatibility

Sepenuhnya aditif. Dua tabel baru pada `platform`; tidak ada tabel atau kolom
yang berubah. Tenant yang tidak memakai vertical kesehatan tidak terpengaruh.

## Migrasi data

Tidak ada. Belum ada pasien di lingkungan mana pun.

## Pengujian

- Dua fasilitas menautkan pasien yang sama → satu `EnterprisePatient`, dua
  `EnterprisePatientLink`.
- Satu pasien tidak dapat ditautkan dua kali dari tenant yang sama
  (`@@unique([tenantId, localPatientId])`).
- Hash NIK yang sama dari dua fasilitas menghasilkan satu identitas.
- **Control plane tidak menyimpan satu pun medan klinis maupun identitas
  langsung** — diuji dengan memeriksa daftar kolom, bukan hanya dengan niat.
- Pencabutan tautan tidak menghapus rekam lokal.

## Yang dikerjakan eMedik sementara menunggu

`patient.enterprise_patient_id` sudah ada sejak H002 dan tetap dipakai, tetapi
**nilainya hanya berlaku dalam satu skema**. API pencarian pasien pada H-2
menyatakan hal itu pada jawabannya sendiri (`scope: 'FACILITY_LOCAL'`) alih-alih
membiarkannya tampak sudah lintas fasilitas.

Kolom bernama "enterprise" yang ternyata hanya lokal adalah jenis kekeliruan
yang paling mahal ditemukan belakangan: seseorang akan mengandalkannya untuk
menyimpulkan bahwa pasien tidak punya alergi.

## Yang diminta dari Core

1. Keputusan atas kedua tabel `platform` di atas.
2. Bila disetujui, siapa yang mengimplementasikan — Core atau eMedik dengan
   penelaahan Core (berkas `prisma/platform` termasuk rawan konflik).
