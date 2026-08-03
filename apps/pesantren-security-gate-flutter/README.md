# Pesantren Security Gate Flutter

Aplikasi pendamping untuk tablet Android atau PC security pondok. Source ini disiapkan sebagai starter Flutter yang memakai API ePesantren:

- `GET /api/v1/pesantren/gerbang/kartu/{nomorKartu}`
- `GET /api/v1/pesantren/gerbang/izin-aktif`
- `POST /api/v1/pesantren/gerbang`

Mode scan utama memakai RFID/QR scanner yang bertindak sebagai keyboard input. Fingerprint disiapkan sebagai tahap lanjutan karena tiap alat biasanya punya SDK vendor sendiri; workflow gerbang tetap sama dan adapter SDK dapat ditambahkan kemudian di atas endpoint yang sudah ada.

## Jalankan

```bash
flutter pub get
flutter run
```

Isi API Base URL, access token akun petugas/perangkat, lalu buka tab Daftar atau pindai nomor kartu.
