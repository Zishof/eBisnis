# Pesantren Security Gate Flutter

Aplikasi pendamping untuk tablet Android atau PC security pondok. Source ini disiapkan sebagai starter Flutter yang memakai API ePesantren:

- `GET /api/v1/pesantren/gerbang/kartu/{nomorKartu}`
- `GET /api/v1/pesantren/gerbang/izin-aktif`
- `POST /api/v1/pesantren/gerbang`

Mode scan utama memakai RFID/QR scanner yang bertindak sebagai keyboard input. Untuk fingerprint, tiap alat biasanya punya SDK vendor sendiri; aplikasi ini menyiapkan field `fingerprintId` dan titik integrasi agar adapter SDK bisa ditambahkan tanpa mengubah workflow gerbang.

## Jalankan

```bash
flutter pub get
flutter run
```

Isi API Base URL, access token akun petugas/perangkat, lalu buka tab Daftar atau pindai nomor kartu.
