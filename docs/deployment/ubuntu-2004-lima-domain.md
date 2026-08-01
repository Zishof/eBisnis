# Menyebarkan lima portal di Ubuntu 20.04

Panduan untuk peladen yang sudah menjalankan eBisnis.id, dengan PostgreSQL pada
porta **5434** dan Apache yang sudah memakai `ebisnis.conf`.

Yang ditambahkan hanyalah empat domain baru. Aplikasinya tidak berlipat.

---

## 0. Sebelum apa pun: kredensial

Panduan ini **tidak memuat kata sandi**. Ia hanya ada di
`/etc/ebisnis/ebisnis.env` pada peladen, berhak akses `600`, dan tidak pernah
masuk Git.

Dua hal yang perlu dikerjakan terpisah dari penyebaran ini:

1. **Rotasi kata sandi basis data.** Kata sandi yang pernah tertulis di luar
   peladen — pada catatan, percakapan, atau tangkapan layar — harus dianggap
   sudah diketahui orang lain. Akun yang berhak `CREATE` pada seluruh schema
   tenant adalah akun yang paling mahal bila bocor.
2. **Pertimbangkan pengguna basis data selain `root`.** Nama itu mengundang
   percobaan tebak otomatis, dan pada PostgreSQL ia tidak memberi keuntungan apa
   pun dibanding nama lain.

Keduanya tidak menghalangi langkah di bawah; keduanya perlu dijadwalkan.

---

## 1. Memeriksa keadaan sekarang

```bash
# Basis data menjawab?
sudo -u postgres psql -p 5434 -d ebisnis -c 'select version()'

# Aplikasi hidup?
systemctl status ebisnis-api --no-pager
curl -s http://127.0.0.1:3000/health

# Apache?
sudo apache2ctl -S 2>&1 | head -20
```

Bila `ebisnis.id` sudah menjawab, seluruh fondasinya sudah ada dan yang tersisa
hanyalah empat domain.

---

## 2. DNS

Arahkan ke IP peladen ini, untuk **masing-masing** dari empat domain baru:

```
enterprise-education.id        A   <IP peladen>
www.enterprise-education.id    A   <IP peladen>
app.enterprise-education.id    A   <IP peladen>

emedik.id                      A   <IP peladen>
www.emedik.id                  A   <IP peladen>
app.emedik.id                  A   <IP peladen>

ekoperasi.id                   A   <IP peladen>
www.ekoperasi.id               A   <IP peladen>
app.ekoperasi.id               A   <IP peladen>

info-desa.id                   A   <IP peladen>
www.info-desa.id               A   <IP peladen>
app.info-desa.id               A   <IP peladen>
```

Ditambah dua untuk eBisnis yang mungkin belum ada:

```
app.ebisnis.id                 A   <IP peladen>
auth.ebisnis.id                A   <IP peladen>
```

Periksa sebelum lanjut — Apache dan sertifikat tidak dapat memperbaiki DNS yang
belum menyebar:

```bash
for h in ebisnis.id enterprise-education.id emedik.id ekoperasi.id info-desa.id; do
  printf '%-28s %s\n' "$h" "$(dig +short "$h" | tr '\n' ' ')"
done
```

---

## 3. Memperbarui source

```bash
sudo bash /opt/ebisnis/app/deploy/update.sh
```

Ini yang membawa registry portal beserta migrasinya. Ia sudah membuat backup
basis data lebih dahulu, dan mengembalikan aplikasi sendiri bila health check
gagal.

**Catatan Ubuntu 20.04.** Bila `pg_dump` mengeluh versinya lebih tua daripada
peladen, itu sudah dibahas pada [ubuntu.md](ubuntu.md) §464. Jangan melewati
backup dengan `SKIP_DB_BACKUP=1` kecuali Anda sudah mengambil backup dengan cara
lain — langkah itu ada supaya ada jalan pulang.

---

## 4. Apache

```bash
sudo cp /opt/ebisnis/app/deploy/apache/ebisnis.conf /etc/apache2/sites-available/ebisnis.conf
sudo cp /opt/ebisnis/app/deploy/apache/ebisnis-app.inc /etc/apache2/conf-available/ebisnis-app.inc

sudo a2enmod proxy proxy_http headers rewrite ssl deflate expires
sudo a2ensite ebisnis
sudo apache2ctl configtest
sudo systemctl reload apache2
```

Konfigurasi itu **satu VirtualHost untuk kelima domain**. Blok legacy `:3449`
untuk sistem Java lama dipertahankan apa adanya.

Periksa Apache benar-benar mengenali kelimanya:

```bash
sudo apache2ctl -S 2>&1 | grep -E "ebisnis|emedik|ekoperasi|info-desa|enterprise"
```

---

## 5. Sertifikat TLS

Selama masih memakai sertifikat swa-tanda, keempat domain baru akan menampilkan
peringatan peramban. Itu dapat diterima untuk uji, **tidak** untuk halaman
pemasaran: pengunjung yang diperingatkan tidak kembali.

Satu sertifikat yang memuat kelimanya:

```bash
sudo apt install -y certbot python3-certbot-apache

sudo certbot --apache \
  -d ebisnis.id -d www.ebisnis.id -d app.ebisnis.id -d auth.ebisnis.id \
  -d enterprise-education.id -d www.enterprise-education.id -d app.enterprise-education.id \
  -d emedik.id -d www.emedik.id -d app.emedik.id \
  -d ekoperasi.id -d www.ekoperasi.id -d app.ekoperasi.id \
  -d info-desa.id -d www.info-desa.id -d app.info-desa.id
```

Satu sertifikat SAN, bukan lima terpisah: lima sertifikat kedaluwarsa pada
tanggal berbeda, dan yang kedaluwarsa diam-diam adalah yang paling lama tidak
ketahuan.

Certbot akan menawarkan mengaktifkan pengalihan HTTP→HTTPS. **Terima setelah
sertifikatnya jadi**, bukan sebelumnya — pengalihan yang dipasang lebih dahulu
memaksa setiap pengunjung ke halaman yang peramban sendiri peringatkan.

---

## 6. Menyalakan kelima portal

```bash
sudo bash /opt/ebisnis/app/deploy/ekosistem.sh pasang
```

Yang dilakukannya: menyeed registry portal, memastikan peladen sehat, lalu
memeriksa kelima domain benar-benar menjawab dari luar.

Domain diperiksa lewat **namanya**, bukan lewat `127.0.0.1`. Yang hendak
dibuktikan adalah DNS, TLS, Apache, dan aplikasi bekerja **bersama** — memeriksa
lewat localhost melewatkan tiga dari empat, dan tiga itulah yang paling sering
putus.

Memastikan registrynya terisi:

```bash
curl -s https://ebisnis.id/api/v1/public/portals | head -40
```

---

## 7. Pembaruan berikutnya — satu perintah

```bash
sudo bash /opt/ebisnis/app/deploy/ekosistem.sh perbarui
```

Backup → ambil source → build → migrasi platform → migrasi seluruh schema tenant
→ restart → health check → pengembalian otomatis bila gagal → seed portal →
periksa kelima domain.

**Seluruh modul ikut** bukan karena skripnya pintar, melainkan karena memang ada
satu aplikasi, satu build, dan satu basis data.

Memeriksa tanpa mengubah apa pun:

```bash
sudo bash /opt/ebisnis/app/deploy/ekosistem.sh periksa
```

---

## 8. Bila ada yang tidak beres

| Gejala | Kemungkinan besar | Periksa |
| --- | --- | --- |
| `curl https://emedik.id` → 000 | DNS belum menyebar, atau porta 443 tertutup | `dig +short emedik.id`, `sudo ufw status` |
| Peringatan sertifikat | Sertifikat belum memuat domain itu | `openssl s_client -connect emedik.id:443 -servername emedik.id </dev/null 2>/dev/null \| openssl x509 -noout -text \| grep DNS:` |
| Halaman eBisnis muncul di emedik.id | Registry portal belum diseed | `curl -s https://ebisnis.id/api/v1/public/portals` |
| 404 pada seluruh domain baru | Apache belum reload, atau `ServerAlias` belum ada | `sudo apache2ctl -S` |
| 502 pada `/api/` | NestJS mati | `journalctl -u ebisnis-api -n 100` |
| Portal kosong pada jawaban API | Seed gagal | `sudo -u ebisnis bash -lc "cd /opt/ebisnis/app && pnpm seed:platform"` |

---

## 9. Yang belum pernah dijalankan

Panduan ini disusun dari source dan konfigurasi peladen, **bukan** dari
penyebaran yang sudah dicoba:

- Migrasi `20260801150000_platform_portal_registry` belum pernah diterapkan ke
  basis data mana pun. Yang terbukti hanyalah skemanya sah dan modelnya
  mengompilasi.
- `ekosistem.sh` belum pernah dijalankan di peladen. Sintaks bash-nya sah.
- Kelima domain belum pernah menjawab bersama.

Karena itu jalankan langkah 3 pada jam sepi, dan pastikan backup yang dibuatnya
benar-benar jadi sebelum melanjutkan. Langkah 4–6 tidak menyentuh data.
