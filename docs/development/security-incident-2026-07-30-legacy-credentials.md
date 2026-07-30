# Insiden: kredensial integrasi bank pada source legacy

- Ditemukan: 2026-07-30, oleh gitleaks pada GitHub Actions run `30557456049`
- Status: **diredaksi pada HEAD, masih ada pada riwayat commit**
- Memerlukan keputusan dan tindakan pemilik

## Apa yang terjadi

Berkas source legacy pada `docs/input/` disalin apa adanya dari workspace lama
saat cutover. Dua di antaranya memuat kredensial produksi sebagai nilai default
pada pemanggilan `Common.getKonfigurasi(key, default)`.

Scan manual pra-migrasi **tidak menangkapnya**. Scan itu berbasis pola kata
kunci (`password=`, `secret=`, connection string), sementara kredensial ini
berupa argumen kedua pada pemanggilan fungsi. gitleaks menangkapnya karena
memakai deteksi entropi. Keterbatasan ini memang sudah dicatat pada
`docs/git-migration/01-secret-scan.md`, dan inilah wujud nyatanya.

## Yang terekspos

| Berkas | Kunci konfigurasi | Jenis |
| --- | --- | --- |
| `VirtualAccountBankAction.java` | `key_bankaltimtara_baru` | API key Bank Kaltimtara (50 karakter) |
| `VirtualAccountBankAction.java` | `app_id_bankaltimtara_baru` | application id (32 karakter) |
| `VirtualAccountBankAction.java` | `password_va_e_smartlink` | kata sandi akun VA Esmartlink |
| `VirtualAccountBankAction.java` | `username_va_e_smartlink` | akun sandbox Esmartlink |
| `VirtualAccountBankAction.java` | `url_status_va_bankaltimtara_baru` | alamat IP endpoint bank internal |
| `DownloadTagihanSiswaBankOnline.java` | `qris_jaring_screet_key` | secret key QRIS JARING (base64) |
| `DownloadTagihanSiswaBankOnline.java` | `va_jaring_screet_key` | secret key VA JARING (base64) |
| `DownloadTagihanSiswaBankOnline.java` | `qris_jaring_merchantId`, `qris_jaring_terminalId` | identitas merchant dan terminal |

Kredensial ini **bukan milik eBisnis.id**. Ia milik integrasi sistem AIS dengan
Bank Kaltimtara, Esmartlink, dan JARING.

## Sejauh mana paparannya

| Tempat | Status |
| --- | --- |
| `C:\opt\AIS\...` (source asli) | sudah ada sejak awal, di luar kendali repository ini |
| `C:\opt\eBisnis\docs\input\` (workspace lama) | ada; workspace lama adalah working copy SVN |
| SVN `svn://38.47.178.34/pos/eBisnis` | `docs/input/**` **sudah versioned** sejak sebelum migrasi |
| GitHub `Zishof/eBisnis` | masuk pada commit `a463093`, repository **privat** |
| HEAD repository | **sudah diredaksi** |

Paparannya **mendahului** migrasi Git: berkas tersebut sudah berada di SVN.
Migrasi memindahkannya, tidak menciptakannya.

## Yang sudah dilakukan

1. Seluruh nilai kredensial diganti placeholder (`<REDACTED_API_KEY>` dan
   sejenisnya) pada kedua berkas. Nama kunci konfigurasi dipertahankan karena di
   situlah nilai referensinya: ia menunjukkan kunci apa yang dipakai integrasi.
2. Diverifikasi tidak ada sisa nilai kredensial pada seluruh berkas repository.
3. gitleaks kini berjalan pada setiap push dan menjadi bagian tetap CI.

## Yang MEMERLUKAN keputusan pemilik

### 1. Rotasi kredensial — mendesak

Kredensial ini harus dianggap bocor dan dirotasi oleh pemilik masing-masing
integrasi:

- API key dan application id Bank Kaltimtara;
- kata sandi akun VA Esmartlink;
- secret key QRIS dan VA JARING.

Redaksi pada repository **tidak** membatalkan paparan yang sudah terjadi.

### 2. Riwayat commit

Nilai kredensial masih ada pada commit `a463093`. Menghapusnya menuntut
penulisan ulang riwayat dan `git push --force`, yang dilarang oleh aturan
proyek tanpa persetujuan eksplisit.

Saat ini biayanya murah: repository baru berumur beberapa commit, privat, dan
hanya satu pengembang yang memakainya. Semakin lama ditunda, semakin mahal.

Dua pilihan:

| Pilihan | Konsekuensi |
| --- | --- |
| Tulis ulang riwayat (`git filter-repo`), lalu force-push sekali | riwayat bersih; seluruh clone yang ada harus di-clone ulang; memerlukan persetujuan eksplisit karena melanggar aturan force-push |
| Biarkan riwayat, cukup rotasi kredensial | riwayat tetap memuat nilai lama, tetapi nilainya sudah tidak berlaku setelah rotasi |

Rotasi kredensial tetap wajib pada kedua pilihan. Tanpa rotasi, membersihkan
riwayat Git saja tidak menyelesaikan apa pun — nilainya juga ada di SVN.

### 3. Apakah `docs/input/**` perlu tetap ada di repository

Berkas itu adalah source sistem lain yang dipakai sebagai referensi
karakterisasi. Perilaku yang perlu dipertahankan sudah didokumentasikan pada
`docs/modules/billing/*.md`. Bila dokumentasi itu dianggap cukup, source
mentahnya dapat dikeluarkan dari repository.

## Pelajaran

Scan manual berbasis pola tidak memadai dan sudah diganti oleh gitleaks pada CI.
Untuk source pihak ketiga yang masuk repository, pemindaian entropi wajib
dijalankan **sebelum** commit pertama, bukan sesudahnya.
