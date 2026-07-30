# Runbook operasional

## Memeriksa kesehatan sistem

```bash
curl -s http://localhost:3000/health
```

Balasan memuat status database, jumlah schema tenant terdaftar, ukuran cache
koneksi tenant, dan versi katalog migration tenant yang aktif. Bila
`tenantMigrationVersion` lebih tinggi daripada versi sebuah tenant, tenant itu
belum dimigrasikan.

## Provisioning tenant gagal

Provisioning berjalan sebagai state machine:

```
VALIDATING → RESERVED → CREATING_SCHEMAS → APPLYING_MIGRATIONS
           → INSTALLING_AUDIT → SEEDING → CREATING_OWNER → VERIFYING → READY
```

1. Buka portal platform → **Pendaftar**, atau panggil
   `GET /api/v1/platform/provisioning-jobs?status=FAILED`.
2. Ambil detail job untuk melihat step yang gagal beserta pesannya:
   `GET /api/v1/platform/provisioning-jobs/{id}`.
3. Setelah penyebabnya diperbaiki, ulangi:
   `POST /api/v1/platform/provisioning-jobs/{id}/retry`.

Provisioning bersifat idempotent per step, sehingga pengulangan tidak
menggandakan data.

## Menerapkan migration ke tenant

Setelah menambah berkas pada `apps/api/tenant-migrations/` dan mendaftarkannya di
`manifest.json`:

```bash
pnpm db:seed
```

Perintah di atas memigrasikan sandbox demo. Untuk tenant lain, gunakan portal
platform → **Tenant dan Schema** → **Terapkan Migration**, atau:

```bash
curl -X POST http://localhost:3000/api/v1/platform/tenants/{tenantId}/migrate -H "Authorization: Bearer $TOKEN"
```

Migration tenant **tidak boleh** mengubah berkas yang sudah diterapkan pada
environment bersama. Buat versi baru; checksum berkas dicatat pada
`platform.tenant_schema_migration_history` dan perubahan akan terdeteksi.

## Verifikasi seed gagal

```bash
pnpm seed:verify
```

Keluar dengan kode 1 bila ada master di bawah minimum. Perbaiki dengan:

```bash
pnpm seed:repair --schema <nama_schema>
```

Master yang memang tidak boleh diisi data contoh terdaftar pada
[pengecualian](../database/master-seed-exceptions.md) beserta alasannya.

## Data contoh sudah dipakai transaksi nyata

`pnpm seed:cleanup` melaporkan record semacam itu sebagai **terblokir** dan
membiarkannya. Ini benar: menghapusnya akan merusak dokumen historis. Nonaktifkan
record tersebut (`is_active = false`) agar tidak muncul pada pilihan baru.

## Stok tidak sesuai harapan

Titik yang paling sering disalahpahami:

- **Penerimaan barang tidak menambah stok saat dibuat.** Stok bertambah **hanya**
  saat penerimaan divalidasi. Registrasi kedatangan dan pemeriksaan fisik tidak
  mengubah saldo.
- **Pengiriman transfer** mengurangi stok tersedia gudang sumber dan menambah
  stok dalam perjalanan tujuan. Stok on-hand tujuan bertambah **setelah**
  penerimaan transfer divalidasi.
- `stock_balance` adalah proyeksi; `stock_movement` adalah sumber kebenaran.
  Bila keduanya berselisih, rekonstruksi dari `stock_movement`.

`stock_movement` immutable. Koreksi dilakukan dengan mutasi pembalik, bukan
dengan mengubah baris lama — trigger database akan menolaknya.

## Reset sandbox demo

Portal platform → **Reset Sandbox Demo**, atau:

```bash
curl -X POST http://localhost:3000/api/v1/platform/demo/reset -H "Authorization: Bearer $TOKEN"
```

Reset menerapkan migration terbaru, menjalankan seed ulang secara idempotent, dan
mencabut seluruh sesi demo aktif agar tidak ada pengguna yang melihat data
campuran.

## Pembayaran masuk tidak terproses

1. Periksa `host_to_host_log` — log **selalu** ditulis, termasuk untuk permintaan
   dari IP yang tidak dikenali atau payload yang gagal di-parse.
2. Periksa `payment_dead_letter` untuk peristiwa yang gagal setelah percobaan
   ulang, beserta alasan kegagalan.
3. Periksa `payment_status_transition` untuk melihat urutan status yang tercatat.
4. Jalankan pemeriksaan status ke provider melalui batch check; batasnya
   dikendalikan `ESMARTLINK_CHECK_BATCH_MAX` dan `ESMARTLINK_CHECK_CONCURRENCY`.

Callback bersifat idempotent terhadap `transaction_id`; pengiriman ulang oleh
provider tidak menggandakan pembayaran.

## Akses data tenant untuk dukungan

Jangan membuka koneksi psql langsung ke schema tenant untuk keperluan dukungan.
Gunakan **support context** agar setiap pembacaan dan perubahan tercatat pada
audit ganda:

```bash
curl -X POST http://localhost:3000/api/v1/platform/tenants/{tenantId}/support-sessions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"Investigasi tiket #123","accessMode":"READ_ONLY","durationMinutes":30}'
```

Mode `READ_WRITE` memerlukan permission `PLATFORM.TENANT.SUPPORT_WRITE`, step-up
authentication, dan alasan pada setiap perubahan.

## Menaikkan batas rate untuk pengujian

Batas bawaan 300 permintaan/menit/IP ditujukan untuk trafik produksi. Suite
Playwright dan smoke test menembak jauh lebih banyak dari satu IP, sehingga pada
lingkungan pengembangan:

```
THROTTLE_DEFAULT_LIMIT=5000
THROTTLE_AUTH_LIMIT=100
```

Jangan menaikkan nilai ini pada produksi.

## Memperbarui dokumentasi database

```bash
pnpm docs:generate
```

Generator melakukan introspeksi database yang sedang berjalan, sehingga dokumen
selalu mencerminkan migration yang benar-benar diterapkan. Berkas pada
`docs/database/` tidak boleh diedit manual.

Generator juga memvalidasi bahwa referensi pada `MASTER_RESOURCES` benar-benar
ada sebagai kolom, dan melaporkan foreign key yang belum memiliki index
pendukung.
