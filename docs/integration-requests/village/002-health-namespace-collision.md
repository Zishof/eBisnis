# Integration Request 002 — Tabrakan namespace `modules/health/`

**Vertikal:** info-desa (pelapor; bukan pemilik masalahnya)
**Cabang:** `feature/v12-info-desa`
**Diajukan:** 31 Juli 2026
**Untuk perhatian:** sesi Core dan sesi eMedik
**Sifat:** Peringatan dini. Tidak memblokir village.

---

## Temuan

Panduan koordinasi paralel §4 menugaskan namespace berikut kepada sesi eMedik:

```
apps/api/src/modules/health/**
```

Direktori itu **sudah ada** pada `origin/main` @ `4f7ab88`, dan isinya bukan
milik vertikal kesehatan:

```
apps/api/src/modules/health/health.module.ts
```

Isinya `HealthController` — pemeriksa kesehatan aplikasi:

```ts
@Public()
@Get('health')
@ApiOperation({ summary: 'Health check aplikasi dan database' })
async health() { ... }   // liveness/readiness, hitung tenant READY
```

Endpoint `GET /health` ini dipakai pemantauan infrastruktur. `deploy/update.sh`
dan konfigurasi Apache/Cloudflare menyandarkan diri padanya.

## Mengapa dilaporkan dari sesi village

Ini bukan wilayah village, dan village tidak akan menyentuhnya. Dilaporkan
karena tiga alasan:

1. Sesi eMedik akan menabraknya begitu membuat berkas pertamanya, dan tabrakan
   yang diketahui saat audit jauh lebih murah daripada yang diketahui saat merge.
2. Village memerlukan `HealthAggregatePort` untuk data Posyandu (spesifikasi §14).
   Bila namanya tetap kabur, akan ada dua hal berbeda bernama sama di dalam satu
   basis kode, dan salah satu impor yang keliru tidak akan langsung ketahuan.
3. `GET /health` menyangkut ketersediaan produksi. Bila sesi eMedik menimpanya
   tanpa menyadari, pemantauan berhenti bekerja diam-diam — dan pemantauan yang
   berhenti bekerja diam-diam adalah jenis kegagalan yang paling lambat
   ketahuan.

## Tiga jalan keluar

| Pilihan | Isinya | Risiko |
|---|---|---|
| **A. Pindahkan pemeriksa aplikasi** ke `modules/system-health/` atau `infrastructure/health/`, bebaskan `modules/health/` untuk eMedik | Paling bersih secara namespace | Rute `GET /health` **harus tetap** di tempatnya. Memindahkan berkas boleh; memindahkan rute tidak — itu memutus pemantauan produksi |
| **B. Beri eMedik namespace `modules/emedik/`** | Tidak menyentuh apa pun yang berjalan | Menyimpang dari panduan koordinasi yang sudah diedarkan |
| **C. Biarkan eMedik memakai `modules/health/` dan menambahkan berkas di sebelahnya** | Tanpa perubahan | Satu direktori berisi dua hal yang tidak berhubungan. Cepat atau lambat seseorang mengira `HealthController` adalah pengendali vertikal kesehatan |

**Yang disarankan village: B.** Alasannya bukan kerapian melainkan risiko —
pilihan A menyentuh jalur pemantauan produksi demi keuntungan penamaan, dan itu
pertukaran yang tidak sepadan. `modules/emedik/` juga lebih cocok dengan
penamaan portalnya sendiri (`/emedik/**` pada rute frontend, yang sudah
ditetapkan panduan §4).

Keputusannya ada pada sesi Core; village hanya melaporkan.

## Akibat bagi village

Kecil, tetapi ada. Port kesehatan yang dipakai village akan dinamai lengkap:

```ts
// modules/village/ports/health-aggregate.port.ts
export interface HealthAggregatePort { ... }
```

Bukan `HealthPort`, supaya tidak pernah tertukar dengan pemeriksa kesehatan
aplikasi — apa pun keputusan yang diambil atas tabrakan ini.

## File shared yang perlu diubah

Bergantung pilihan. Untuk pilihan B: tidak ada — hanya panduan koordinasi yang
diperbarui.

## Backward compatibility

Pilihan B dan C: penuh. Pilihan A: `GET /health` wajib tetap pada path yang
sama; bila rutenya ikut pindah, `deploy/update.sh` dan konfigurasi reverse proxy
harus ikut diperbarui pada saat yang sama.
