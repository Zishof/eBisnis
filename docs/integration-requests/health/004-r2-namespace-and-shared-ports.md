# 004 · Namespace R2 dan Port Bersama yang Belum Ada

**Diajukan:** sesi eMedik · 1 Agustus 2026
**Untuk:** sesi Core/Integrator
**Menyusul:** [001](001-health-namespace-collision.md)

---

## 1. Namespace `modules/health/**` masih bertabrakan

Perintah R2 §11 menetapkan namespace:

```text
apps/api/src/modules/health/interoperability/**
apps/api/src/modules/health/payer-bpjs/**
...
```

**Direktori `apps/api/src/modules/health/` sudah ada dan milik Core** — ia
memuat `health.module.ts`, pemeriksa ketersediaan aplikasi. Ini persis yang
dicatat integration request 001 dan belum terjawab.

### Yang dilakukan sementara

Modul kesehatan tetap di `apps/api/src/modules/emedik/**`. **Rute API tetap
`/api/v1/health/**` sesuai perintah** — yang berbeda hanya nama direktorinya,
dan itu tidak terlihat pengguna mana pun.

Penyimpangan ini disengaja dan dicatat di sini supaya tidak terbaca sebagai
kelalaian. Memindahkan pemeriksa ketersediaan milik Core adalah perubahan pada
berkas bersama, dan R2 §3 melarangnya.

### Yang diminta

Salah satu:

- **(a)** Core memindahkan pemeriksa ketersediaan ke `modules/platform-health/`,
  membebaskan `modules/health/`; atau
- **(b)** Core menyetujui `modules/emedik/` sebagai namespace resmi vertical
  kesehatan, dan R2 §11 dibaca sebagai penetapan **rute**, bukan direktori.

Pilihan (b) lebih murah dan tidak menyentuh apa pun. Pilihan (a) lebih sesuai
huruf perintah.

---

## 2. Port bersama yang belum ada

R2 §12 menuntut sebelas port. Yang sudah ada di sisi kami baru enam, dan
seluruhnya kami definisikan sendiri sebagai antarmuka lokal — bukan kontrak
publik milik Core.

| Port | Status |
|---|---|
| `HealthIdentityPort` | Ada (lokal) |
| `HealthInventoryPort` | Ada (lokal), adapter dipakai H-4 |
| `HealthAuditPort` | Ada (lokal) |
| `HealthNotificationPort` | Ada (lokal) |
| `HealthPaymentPort` | Ada (lokal), belum dipakai |
| `HealthFileStoragePort` | Ada (lokal), belum dipakai |
| `HealthAiGatewayPort` | Ada (lokal), belum dipakai |
| **`HealthAccountingPort`** | **Belum ada** |
| **`HealthInvestorPort`** | **Belum ada** |
| **`HealthSecretVaultPort`** | **Belum ada** |
| **`HealthIntegrationEventPort`** | **Belum ada** |

### `HealthAccountingPort` — paling mendesak

Tanpa ini, tidak satu pun peristiwa keuangan kesehatan dapat masuk buku besar:
penyerahan obat tidak mencatat harga pokok, pendapatan layanan tidak berjurnal,
dan pembagian jasa tidak menghasilkan utang.

Yang dibutuhkan adalah kode peristiwa `HEALTH_*` pada `accounting_event`
milik Core — permintaan yang sama sudah diajukan sejak H-4 dan belum terjawab.

Kami **tidak** akan membuat buku besar kedua. R2 §15 melarangnya, dan larangan
itu benar.

### `HealthSecretVaultPort` — penghalang keamanan

Kredensial SATUSEHAT, BPJS, dan gateway alat **tidak boleh disimpan di basis
data tenant**. Yang dibutuhkan adalah brankas dengan sifat:

```text
menyimpan tanpa dapat dibaca kembali oleh penyimpannya
dapat diganti
setiap pembacaan tercatat
terpisah per penyewa
```

Tanpa ini, seluruh adapter integrasi tetap terhalang **bahkan setelah
kredensialnya tersedia** — sebab tidak ada tempat yang aman untuk menaruhnya.

### `HealthInvestorPort`

R2 §8 menuntut investor memakai mesin investor Core lewat kontrak publik. Kami
membutuhkan kontrak itu, beserta jaminan bahwa ia dapat dibatasi pada agregat.

### `HealthIntegrationEventPort`

Untuk mengantarkan peristiwa klinis ke pekerja SATUSEHAT dan BPJS tanpa
keduanya saling menghambat.

---

## 3. Yang diminta dari Core, ringkas

```text
1. Putuskan namespace: (a) atau (b).
2. Sediakan kode peristiwa akuntansi HEALTH_* — paling mendesak.
3. Sediakan HealthSecretVaultPort — penghalang keamanan.
4. Sediakan kontrak publik mesin investor.
5. Sediakan HealthIntegrationEventPort.
```

Butir 2 dan 3 menahan pekerjaan yang sudah siap dibangun. Butir 1 tidak
menahan apa pun; ia hanya perlu diputuskan supaya tidak menjadi utang yang
membesar.
