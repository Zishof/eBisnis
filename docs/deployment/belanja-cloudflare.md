# Menyalakan `belanja.ebisnis.id`

Marketplace publik memakai aplikasi web yang sama dengan `ebisnis.id`. Yang
berbeda hanya titik masuknya: pengunjung `belanja.ebisnis.id` langsung melihat
katalog, pengunjung `ebisnis.id` melihat website perusahaan.

Karena itu **tidak ada aplikasi kedua yang perlu dipasang.** Yang diperlukan
hanya membuat alamat baru menunjuk ke server yang sama.

> **Memakai Cloudflare Tunnel?** Ikuti [`belanja-tunnel.md`](belanja-tunnel.md),
> bukan panduan ini. Dengan tunnel tidak ada record `A`, tidak ada sertifikat
> yang perlu dipasang, dan tidak ada port yang perlu dibuka — mengikuti langkah
> di bawah justru akan melewati tunnel dan menghasilkan error 522.

## Ringkas

| Langkah | Di mana | Perlu diulang? |
| --- | --- | --- |
| 1. DNS record | Cloudflare | sekali |
| 2. Mode SSL | Cloudflare | sekali untuk seluruh domain |
| 3. `ServerAlias` | server | sekali |
| 4. Sertifikat | server | perpanjangan otomatis |
| 5. `CORS_ORIGINS` | server `.env` | saat alamat bertambah |

---

## 1. DNS di Cloudflare

Masuk ke [dash.cloudflare.com](https://dash.cloudflare.com) → pilih domain
**ebisnis.id** → menu **DNS** → **Records** → **Add record**.

| Kolom | Isi |
| --- | --- |
| Type | `A` |
| Name | `belanja` |
| IPv4 address | `38.47.178.34` |
| Proxy status | **Proxied** (awan oranye) |
| TTL | Auto |

Simpan.

> `Name` diisi `belanja` saja, bukan `belanja.ebisnis.id`. Cloudflare
> menambahkan nama domainnya sendiri; menuliskannya lengkap menghasilkan
> `belanja.ebisnis.id.ebisnis.id`.

### Mengapa Proxied, bukan DNS only

Awan oranye berarti lalu lintas melewati Cloudflare lebih dulu. Untuk katalog
publik yang memang dibuka siapa pun, itu yang diinginkan:

- alamat IP server tidak terlihat langsung, sehingga serangan tidak dapat
  melewati Cloudflare dengan menyerang IP-nya
- HTTPS di sisi pengunjung tetap sah meski sertifikat di server belum tepercaya
- gambar dan berkas statis dilayani dari tepi jaringan

Bila suatu saat perlu mendiagnosis dengan menyentuh server langsung, ubah
sementara menjadi **DNS only** (awan abu-abu), lalu kembalikan.

### Jika memakai CNAME

Bila `ebisnis.id` sudah menunjuk ke server dan Anda lebih suka satu tempat
untuk diubah:

| Kolom | Isi |
| --- | --- |
| Type | `CNAME` |
| Name | `belanja` |
| Target | `ebisnis.id` |
| Proxy status | **Proxied** |

Keduanya sama-sama benar. `A` lebih langsung; `CNAME` berarti mengubah IP
server cukup di satu record.

## 2. Mode SSL

**SSL/TLS** → **Overview** → pilih mode.

| Mode | Kapan dipakai |
| --- | --- |
| **Full** | server memakai sertifikat self-signed — **pilih ini bila Let's Encrypt belum dipasang** |
| **Full (strict)** | server sudah memakai Let's Encrypt; **pilih ini bila sudah** |
| Flexible | **jangan** |

**Jangan memakai Flexible.** Mode itu membuat Cloudflare menghubungi server
lewat HTTP polos. Lalu lintas antara Cloudflare dan server berjalan tanpa
enkripsi, dan aplikasi mengira permintaannya sudah aman padahal tidak — cookie
yang ditandai `Secure` akan tetap dikirim melalui jalur terbuka.

Bila server masih memakai sertifikat self-signed, **Full** sudah benar:
sambungannya tetap terenkripsi, hanya sertifikatnya yang tidak diverifikasi.

### Setelah Let's Encrypt terpasang

Naikkan ke **Full (strict)**. Sejak saat itu Cloudflare menolak menyambung bila
sertifikat server kedaluwarsa atau salah — yang justru diinginkan.

## 3. Server: kenali alamat baru

Alamatnya sudah masuk ke berkas konfigurasi pada repo. Setelah menarik
perubahan:

```bash
sudo cp /opt/ebisnis/deploy/apache/ebisnis.conf /etc/apache2/sites-available/ebisnis.conf
```

Lalu periksa dan muat ulang:

```bash
sudo apache2ctl configtest && sudo systemctl reload apache2
```

`configtest` harus menjawab `Syntax OK` sebelum `reload` dijalankan. Memuat
ulang konfigurasi yang salah membuat Apache berhenti melayani **seluruh**
alamat, bukan hanya yang baru.

Untuk memeriksa alamat sudah dikenal:

```bash
apache2ctl -S | grep belanja
```

## 4. Sertifikat

Bila sudah memakai Let's Encrypt, tambahkan alamat baru ke sertifikat yang ada:

```bash
sudo certbot --apache -d ebisnis.id -d www.ebisnis.id -d belanja.ebisnis.id --expand
```

`--expand` menambahkan nama ke sertifikat yang sudah ada. Tanpanya certbot akan
bertanya apakah ingin mengganti sertifikat, dan jawaban yang keliru menghapus
alamat lama dari sertifikat.

> Karena DNS diproksikan Cloudflare, verifikasi HTTP-01 milik certbot dapat
> gagal — Cloudflare menjawab lebih dulu. Bila itu terjadi, ubah record
> `belanja` menjadi **DNS only** sementara, jalankan certbot, lalu kembalikan
> ke **Proxied**.

## 5. Izinkan alamat baru pada API

Pada `.env` di server, tambahkan alamat marketplace:

```bash
CORS_ORIGINS=https://ebisnis.id,https://www.ebisnis.id,https://belanja.ebisnis.id
```

Lalu jalankan ulang API:

```bash
sudo systemctl restart ebisnis-api
```

Tanpa langkah ini halaman marketplace akan terbuka tetapi katalognya kosong,
dan peramban mencatat penolakan CORS di konsol. Gejalanya menyesatkan — terlihat
seperti katalog memang kosong.

## 6. Isi katalog

Katalog kosong sampai ada produk yang benar-benar diterbitkan. Untuk mencoba
dengan data contoh:

```bash
cd /opt/ebisnis && pnpm --filter @ebisnis/api seed:marketplace-demo
```

Perintah ini menyiapkan satu toko dan enam produk pada tenant `demo`, lalu
menyegarkan katalog. Gerbang publikasi tetap dijalankan seperti biasa — data
contoh hanya disiapkan sampai memenuhi syaratnya.

Kategori saja, tanpa produk contoh:

```bash
cd /opt/ebisnis && pnpm --filter @ebisnis/api seed:catalog
```

Keduanya aman diulang; menjalankannya dua kali tidak menggandakan apa pun.

## Memeriksa hasilnya

```bash
curl -s https://belanja.ebisnis.id/api/v1/public/catalog/search | head -c 300
```

Lalu buka `https://belanja.ebisnis.id` di peramban. Yang seharusnya terlihat:
daftar kategori dan produk terbaru, tanpa diminta masuk.

## Bila belum berhasil

| Gejala | Kemungkinan sebab | Yang diperiksa |
| --- | --- | --- |
| Halaman Cloudflare "DNS record not found" | record belum tersimpan atau salah nama | `dig belanja.ebisnis.id` harus menjawab |
| Error 521 | Cloudflare tidak dapat menghubungi server | Apache berjalan? firewall mengizinkan port 443? |
| Error 526 | mode **Full (strict)** tetapi sertifikat server belum tepercaya | turunkan ke **Full**, atau pasang Let's Encrypt |
| Halaman website perusahaan, bukan katalog | berkas web belum dibangun ulang setelah perubahan | `pnpm build` lalu salin ulang `apps/web/dist` |
| Katalog kosong padahal ada produk | `CORS_ORIGINS` belum memuat alamat baru | lihat konsol peramban; cari penolakan CORS |
| Katalog kosong dan konsol bersih | memang belum ada produk terbit | jalankan `seed:marketplace-demo` |
| Perubahan tidak terlihat | Cloudflare masih menyajikan versi lama | **Caching** → **Purge Everything** |

### Melihat log server

```bash
sudo tail -f /var/log/apache2/ebisnis-ssl-access.log | grep belanja
sudo journalctl -u ebisnis-api -f
```

## Catatan tentang domain penjual

Panduan ini hanya untuk `belanja.ebisnis.id`, alamat marketplace platform.

Domain milik penjual sendiri (`tokojoni.com`) berjalan lewat mekanisme
tersendiri: penjual mendaftarkannya, membuktikan kepemilikannya lewat TXT
record, dan **domain yang belum terverifikasi tidak dilayani sama sekali** —
bukan diarahkan ke toko bawaan. Lihat
[`docs/upgrade-v9/17-storefront-domain.md`](../upgrade-v9/17-storefront-domain.md).
