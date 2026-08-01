# Menyebarkan santri.info

Portal ePesantren. Berbeda dari lima domain lain dalam satu hal yang menentukan
seluruh langkah di bawah: **ia melayani subdomain yang belum ada saat dipasang.**

```
santri.info                    → halaman portal (jualan platform)
www.santri.info                → sama
app.santri.info                → pintu aplikasi
raudlatul-ulum.santri.info     → situs PONDOK
al-hikam.santri.info           → situs PONDOK lain
raudlatul-ulum.com             → situs pondok, domain miliknya sendiri
```

Setiap pondok yang mendaftar menambah satu host. Kalau tiap penambahan menuntut
sunting berkas Apache dan terbitkan sertifikat baru, pendaftaran berhenti
menjadi mandiri.

---

## 1. DNS

```
santri.info        A      <IP peladen>
www.santri.info    A      <IP peladen>
app.santri.info    A      <IP peladen>
*.santri.info      A      <IP peladen>
```

Baris keempat itu yang membuat pondok baru langsung menjawab tanpa menyentuh
DNS lagi.

`*.santri.info` **tidak** mencakup `santri.info` sendiri — wildcard DNS hanya
berlaku untuk label di bawahnya. Karena itu apex tetap ditulis terpisah.

Periksa:

```bash
for h in santri.info www.santri.info app.santri.info uji-wildcard.santri.info; do
  printf '%-32s %s\n' "$h" "$(dig +short "$h" | tr '\n' ' ')"
done
```

`uji-wildcard.santri.info` sengaja nama yang tidak pernah didaftarkan. Kalau ia
menjawab IP peladen, wildcard-nya bekerja.

---

## 2. TLS — di sinilah santri.info berbeda

Sertifikat wildcard **tidak dapat diterbitkan lewat tantangan HTTP-01**. Let's
Encrypt hanya mengeluarkan `*.santri.info` lewat **DNS-01**, yaitu dengan
menaruh rekaman TXT pada zona DNS.

Kalau penyedia DNS-nya punya plugin certbot, pakai itu supaya perpanjangannya
otomatis. Contoh Cloudflare:

```bash
sudo apt install -y python3-certbot-dns-cloudflare

# Berkas kredensial: chmod 600, di luar repo, tidak pernah masuk Git.
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d santri.info -d '*.santri.info'
```

Kalau penyedianya tidak punya plugin, tantangannya harus ditaruh manual:

```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d santri.info -d '*.santri.info'
```

**Jangan pilih cara manual untuk produksi.** Sertifikatnya berlaku 90 hari, dan
yang diperbarui dengan tangan adalah yang suatu hari terlupa — biasanya pada
hari libur, dan yang pertama tahu adalah pengunjung.

Kalau wildcard belum memungkinkan hari ini, jalankan dulu tanpa wildcard:

```bash
sudo certbot --apache -d santri.info -d www.santri.info -d app.santri.info
```

Portalnya hidup, pondok belum. Itu keadaan yang sah selama belum ada pondok yang
mendaftar — tetapi tuliskan sebagai utang, karena pondok pertama yang mendaftar
akan disambut peringatan sertifikat.

---

## 3. Apache

Sudah ada di `deploy/apache/ebisnis.conf`:

```apache
ServerAlias santri.info www.santri.info app.santri.info *.santri.info
```

Wildcard-nya ditaruh **paling akhir** pada barisnya. Apache mencocokkan
`ServerAlias` yang persis lebih dahulu, jadi urutan sebenarnya tidak menentukan
— tetapi menuliskannya terakhir membuat maksudnya terbaca: yang tiga di depan
adalah host platform, yang satu di belakang adalah milik penyewa.

```bash
sudo cp /opt/ebisnis/app/deploy/apache/ebisnis.conf /etc/apache2/sites-available/
sudo apache2ctl configtest
sudo systemctl reload apache2
sudo apache2ctl -S 2>&1 | grep santri
```

---

## 4. Registry

```bash
sudo bash /opt/ebisnis/app/deploy/ekosistem.sh perbarui
```

Seed portal berjalan idempoten; `SANTRI_INFO` ikut karena sudah ada di
`portal.catalog.ts`.

```bash
curl -s https://ebisnis.id/api/v1/public/portals | grep -o '"code":"[A-Z_]*"'
```

Harus memuat `"code":"SANTRI_INFO"`.

---

## 5. Domain milik pondok sendiri

Pondok yang sudah punya `raudlatul-ulum.com` memakai alamat itu. Alurnya berbeda
dari subdomain, dan perbedaannya bukan kerapian:

1. Pengurus memasukkan domainnya pada pengaturan situs.
2. Platform memberi nilai TXT untuk ditaruh pada DNS domain itu.
3. Platform memeriksa TXT-nya muncul, lalu menandai `verifiedAt`.
4. Baru setelah itu domainnya boleh melayani
   (`domainBolehMelayani` menolak baris ber-`verifiedAt` null).
5. Sertifikatnya diterbitkan per domain — bukan wildcard, sebab zonanya bukan
   milik kita.
6. `ServerAlias` domain itu ditambahkan, atau dipakai `mod_md` untuk menerbitkan
   sesuai permintaan.

Langkah 2–3 tidak boleh dilewati. Tanpanya, siapa pun dapat mendaftarkan
`bank-terkenal.co.id` dan memperoleh halaman yang dilayani infrastruktur kita —
lengkap dengan sertifikat sah, yang justru membuatnya lebih meyakinkan.

---

## 6. Yang belum terbukti

Disusun dari source dan konfigurasi, **bukan** dari penyebaran yang sudah dicoba:

- `santri.info` belum pernah menjawab. DNS-nya belum dibuat.
- Sertifikat wildcard belum pernah diterbitkan untuk domain ini.
- Alur verifikasi domain milik pondok (§5) **belum ada implementasinya**; yang
  ada baru tabel `platform_portal_domain` beserta CHECK-nya dan
  `domainBolehMelayani` yang menolak yang belum terverifikasi.
- Situs pondok yang dapat disunting sendiri **belum dibangun**. Yang tampil di
  `<pondok>.santri.info` sekarang adalah halaman "sedang disiapkan"
  (`apps/web/src/verticals/pesantren/SitusPondokPage.tsx`).
