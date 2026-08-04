# Integration Request 001 — Nama `modules/health` sudah dipakai

**Vertical:** eMedik
**Diajukan:** 31 Juli 2026
**Branch:** `feature/v12-emedik`
**Status:** menunggu keputusan Core
**Menghalangi:** H-1 dan seterusnya (dapat berjalan sementara dengan nama lain)

---

## Kebutuhan

Perintah eMedik §6 dan panduan koordinasi §4 menetapkan namespace vertical
kesehatan:

```
apps/api/src/modules/health/**
```

Direktori itu sudah ada dan berisi hal lain: `HealthController`, yaitu pemeriksa
kesehatan aplikasi dan basis data (`liveness`/`readiness`) yang dipakai
pemantauan.

## Yang TIDAK menjadi masalah

Perlu ditegaskan supaya keputusannya diambil atas dasar yang benar.

**Rutenya tidak bertabrakan.** `apps/api/src/main.ts` mengecualikan `health`
dari awalan global:

```ts
app.setGlobalPrefix(apiPrefix, {
  exclude: ['health', 'docs', 'api-json'],
});
```

Pemeriksa kesehatan melayani `/health`; vertical akan melayani
`/api/v1/health/**`. Keduanya dapat hidup berdampingan tanpa perubahan apa pun.

## Yang menjadi masalah

Nama direktorinya. Tiga akibat, tidak satu pun bersifat teknis — dan justru
karena itu tidak akan tertangkap oleh pengujian mana pun:

1. **Orang salah masuk ruangan.** Yang mencari sebab pemeriksa ketersediaan
   gagal akan membuka direktori berisi puluhan berkas rekam medis. Yang mencari
   modul rawat inap akan menemukan `SELECT 1`.

2. **CODEOWNERS menjadi salah.** Panduan §14 menetapkan:

   ```
   /apps/api/src/modules/health/    @health-team
   ```

   Diterapkan apa adanya, kepemilikan pemeriksa ketersediaan platform berpindah
   ke tim kesehatan. Perubahan pada pemeriksa itu akan menunggu penelaah yang
   tidak memilikinya, dan tim yang memilikinya tidak akan diberi tahu.

3. **Pemisahan yang diminta panduan justru kabur.** Seluruh gagasan worktree
   paralel bertumpu pada batas kepemilikan yang jelas. Satu direktori dengan dua
   pemilik adalah pengecualian pertama, dan pengecualian pertama adalah yang
   dijadikan alasan untuk pengecualian kedua.

## Usulan

Tiga pilihan, dengan konsekuensinya masing-masing. Usulan eMedik adalah **B**.

### A. Vertical memakai `modules/health/`, pemeriksa dipindahkan

```
modules/health/          → vertical kesehatan
modules/platform-health/ → pemeriksa ketersediaan (dipindahkan)
```

- **Untung:** namespace persis seperti yang tertulis pada perintah.
- **Rugi:** memindahkan berkas milik Core, mengubah `app.module.ts` — berkas
  bersama yang rawan konflik. Harus dikerjakan Core, dan menghalangi eMedik
  sampai selesai.

### B. Vertical memakai `modules/emedik/` (usulan)

```
modules/health/   → tetap milik Core, tidak tersentuh
modules/emedik/   → vertical kesehatan
```

- **Untung:** tidak menyentuh satu pun berkas bersama. eMedik dapat mulai hari
  ini. Namanya justru lebih tepat — portalnya memang `emedik.id`, dan produknya
  disebut eMedik di seluruh spesifikasi.
- **Rugi:** berbeda dari huruf perintah §6. Rute API tetap `/api/v1/health/**`
  sesuai perintah; yang berbeda hanya nama direktori.
- CODEOWNERS menjadi jelas tanpa perdebatan:

  ```
  /apps/api/src/modules/emedik/   @health-team
  /apps/api/src/modules/health/   @core-team
  ```

### C. Vertical bersarang di dalamnya

```
modules/health/health.module.ts    → pemeriksa
modules/health/vertical/**         → vertical
```

- **Untung:** menuruti huruf perintah.
- **Rugi:** menggabungkan dua hal yang tidak berhubungan ke dalam satu pohon,
  dan CODEOWNERS harus memakai pengecualian bertingkat yang mudah salah tulis.
  Tidak diusulkan.

## Kontrak yang tidak berubah pada pilihan mana pun

```
API      : /api/v1/health/**
Permission: HEALTH.*
Event    : health.*
Docs     : docs/emedik/**
```

Ketiganya sudah sesuai perintah dan tidak terpengaruh nama direktori.

## Backward compatibility

Pilihan B tidak mengubah apa pun yang sudah ada. Tidak ada migrasi, tidak ada
perubahan rute, tidak ada perubahan perilaku.

## Pengujian

Tidak ada pengujian yang perlu diubah pada pilihan B. Pada pilihan A, seluruh
rujukan ke `modules/health` pada `app.module.ts` dan uji asapnya harus
disesuaikan Core.

## Yang dikerjakan eMedik sementara menunggu

Memakai `modules/emedik/`. Bila Core memilih A, pemindahannya adalah penggantian
nama direktori pada satu branch vertical — murah, dan tidak menyentuh berkas
bersama. Memilih menunggu justru menghentikan seluruh H-1 tanpa alasan teknis.

## Yang diminta dari Core

Satu keputusan: A, B, atau C. Bila tidak ada jawaban sampai H-1 selesai, eMedik
melanjutkan dengan B dan mencatatnya sebagai keputusan yang diambil karena
ketiadaan jawaban — bukan sebagai kesepakatan.
