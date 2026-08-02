# ECO-1 — Menyebarkan lima domain, dan satu perintah pembaruan

## 1. Bentuknya: satu aplikasi, lima merek

Kelima domain dilayani **satu** aplikasi. Yang membedakan jawaban untuk
`ebisnis.id` dan `emedik.id` adalah baris di `platform.platform_portal_domain`,
dibaca dari header `Host`.

```
Host  →  normalkanHost()  →  platform_portal_domain  →  platform_portal
      →  merek, tema, konten, tautan silang
```

Bukan lima penyebaran, lima build, atau lima berkas konfigurasi. Lima vhost yang
menunjuk root dan proxy yang sama hanya menghasilkan lima tempat yang harus
diperbarui bersamaan — dan yang terlupa satu akan menyajikan build lama tanpa
ada yang menyadarinya.

## 2. Host per portal

| Portal | Publik | Aplikasi |
| --- | --- | --- |
| `EBISNIS` | `ebisnis.id`, `www.ebisnis.id` | `app.ebisnis.id` |
| `ENTERPRISE_EDUCATION` | `enterprise-education.id`, `www.` | `app.enterprise-education.id` |
| `EMEDIK` | `emedik.id`, `www.` | `app.emedik.id` |
| `EKOPERASI` | `ekoperasi.id`, `www.` | `app.ekoperasi.id` |
| `INFO_DESA` | `info-desa.id`, `www.` | `app.info-desa.id` |

Penerbit identitas **satu untuk seluruh ekosistem**: `auth.ebisnis.id`. §521
menuntut hanya ada satu penerbit yang berwenang — lima penerbit berarti lima
sumber kebenaran tentang siapa yang sedang masuk, dan sesi yang sah di salah
satunya tidak dapat dipercaya oleh yang lain.

Ini diikat uji: `portal.catalog.spec.ts` menuntut daftar host `AUTH` berisi
tepat satu entri.

## 3. Memasang

```bash
# 1. DNS: kelima apex + www. + app. mengarah ke server
# 2. Sertifikat TLS yang memuat kelima domain (satu sertifikat SAN lebih mudah
#    diperbarui daripada lima yang kedaluwarsa pada tanggal berbeda)
# 3. Apache
sudo cp deploy/apache/ebisnis.conf /etc/apache2/sites-available/
sudo a2ensite ebisnis && sudo apache2ctl configtest
sudo systemctl reload apache2

# 4. Seed portal + periksa
sudo bash /opt/ebisnis/app/deploy/ekosistem.sh pasang
```

## 4. Satu perintah untuk memperbarui SELURUH modul

```bash
sudo bash /opt/ebisnis/app/deploy/ekosistem.sh perbarui
```

Yang dilakukannya, berurutan:

| Langkah | Milik |
| --- | --- |
| Backup basis data | `update.sh` |
| Ambil source dari GitHub | `update.sh` |
| Build seluruh aplikasi | `update.sh` |
| Migrasi platform | `update.sh` |
| Migrasi seluruh schema tenant | `update.sh` |
| Restart layanan | `update.sh` |
| Health check + **pengembalian otomatis bila gagal** | `update.sh` |
| Seed registry portal (idempoten) | `ekosistem.sh` |
| Periksa kelima domain benar-benar menjawab | `ekosistem.sh` |

**Seluruh modul diperbarui oleh satu panggilan itu** — bukan karena skripnya
pintar, melainkan karena memang ada satu aplikasi, satu build, dan satu basis
data. Itulah akibat langsung dari §7 (*"bukan lima aplikasi terpisah"*).

`ekosistem.sh` **tidak menyalin** isi `update.sh`; ia memanggilnya. Dua penyalin
yang berjalan sendiri-sendiri akan berselisih pada perubahan pertama yang
terburu-buru — dan yang berselisih di jalur penyebaran baru ketahuan saat
menyebarkan.

### Mengapa domain yang belum menjawab tidak membatalkan pembaruan

Bila aplikasinya sehat dan lolos health check, tetapi satu domain menjawab 000
atau 404, `ekosistem.sh` **memperingatkan** dan tidak mengembalikan apa pun.

Sebabnya: yang belum menjawab ada di lapisan DNS, TLS, atau Apache. Mengembalikan
aplikasi karenanya justru membatalkan pembaruan yang sebenarnya berhasil, dan
tidak memperbaiki satu pun dari ketiganya.

### Memeriksa tanpa mengubah apa pun

```bash
sudo bash /opt/ebisnis/app/deploy/ekosistem.sh periksa
```

Domain diperiksa lewat **namanya**, bukan lewat `127.0.0.1`: yang hendak
dibuktikan adalah DNS, TLS, Apache, **dan** aplikasi bekerja bersama. Memeriksa
lewat localhost melewatkan tiga dari empat — dan tiga itulah yang paling sering
putus.

## 5. Tombol di dalam aplikasi — yang sudah ada dan yang belum

Perintah tunggalnya **sudah ada** dan sudah dapat dijalankan.

Tombol di layar Super Admin **belum**, dan bentuk yang benar perlu disepakati
lebih dahulu. Aplikasi web **tidak boleh** menjalankan skrip shell: itu
menjadikan setiap celah pada aplikasi sebagai jalan menjalankan perintah sebagai
root di peladen.

Bentuk yang diusulkan:

```
Tombol Super Admin
  → POST /api/v1/platform/updates            (menulis PERMINTAAN, bukan menjalankan)
  → baris PlatformUpdateRequest, status QUEUED
  → agen ber-hak istimewa di peladen membacanya (systemd timer)
  → menjalankan deploy/ekosistem.sh perbarui
  → menulis kembali status dan keluarannya
  → layar menampilkan kemajuan dan hasilnya
```

Dengan begitu aplikasi web tidak pernah memegang kemampuan menjalankan perintah;
ia hanya menulis baris. Yang menjalankan adalah agen yang memang sudah
ber-hak istimewa, dan yang dijalankannya hanya satu skrip yang sudah tetap.

Yang perlu diputuskan sebelum dibangun: siapa yang boleh menekannya (§35
memisahkan Administrator Provisioning dari Super Admin), dan apakah pembaruan
boleh berjalan tanpa jendela pemeliharaan.

## 6. Yang belum terbukti

- Kelima domain **belum pernah dijalankan bersama**. DNS keempat domain selain
  `ebisnis.id` belum diperiksa, dan sertifikatnya belum ada.
- Migrasi `20260801150000_platform_portal_registry` **belum pernah diterapkan**
  ke basis data mana pun — tidak ada PostgreSQL terjangkau dari mesin
  pengembangan. Yang terbukti adalah skemanya sah (`prisma validate`) dan
  modelnya mengompilasi.
- `ekosistem.sh` **belum pernah dijalankan di peladen**. Sintaks bash-nya sah
  (`bash -n`), dan langkah-langkahnya memanggil hal yang memang ada.

Ketiganya menuntut peladen, bukan mesin pengembangan.
