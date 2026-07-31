# Memasang `belanja.ebisnis.id` lewat Cloudflare Tunnel

Untuk topologi: **cloudflared berjalan di server Ubuntu dan meneruskan ke
Apache di `localhost:80`.** Apache yang memilah `ebisnis.id` dan
`belanja.ebisnis.id`, menyajikan berkas React, dan mem-proxy API ke NestJS.

Bila suatu saat memakai IP publik langsung tanpa tunnel, panduannya ada di
[`belanja-cloudflare.md`](belanja-cloudflare.md).

## Yang berbeda dengan tunnel

Tunnel membangun sambungan **keluar** dari server ke Cloudflare, lalu lalu
lintas pengunjung mengalir balik lewat sambungan itu. Akibatnya:

| Hal | Tanpa tunnel | Dengan tunnel |
| --- | --- | --- |
| Port masuk | 80 dan 443 harus terbuka | **tidak ada yang perlu dibuka** |
| Alamat IP server | terlihat pada DNS | tidak pernah tersiar |
| Sertifikat di server | perlu Let's Encrypt | **tidak perlu** |
| Record DNS | `A` ke alamat IP | `CNAME` ke tunnel |
| Yang mengakhiri TLS | Apache | Cloudflare, di tepi jaringan |

Dua baris terakhir yang paling sering menyita waktu bila terlewat.

## Ringkas

| Langkah | Di mana | Perlu diulang saat menambah subdomain? |
| --- | --- | --- |
| 1. Rute DNS tunnel | server (satu perintah) | ya |
| 2. Aturan ingress | server `config.yml` | ya |
| 3. `ServerAlias` | server Apache | ya |
| 4. `CORS_ORIGINS` | server `.env` | ya |
| 5. Isi katalog | server | tidak |

---

## 1. Pastikan tunnel yang mana

Di server:

```bash
cloudflared tunnel list
```

Catat nama dan id tunnel yang melayani `ebisnis.id`. Seluruh perintah di bawah
memakai nama itu; ganti `ebisnis` bila nama Anda berbeda.

Untuk memastikan tunnel benar-benar berjalan:

```bash
sudo systemctl status cloudflared --no-pager
```

## 2. Buat rute DNS

```bash
cloudflared tunnel route dns ebisnis belanja.ebisnis.id
```

Satu perintah ini membuat record `CNAME` di Cloudflare yang menunjuk ke
`<tunnel-id>.cfargotunnel.com`, dan menandainya Proxied.

**Jangan membuat record `A` untuk `belanja` secara manual.** Record `A` yang
menunjuk ke IP server akan melewati tunnel sepenuhnya — dan bila port 443 di
server memang tertutup (sebagaimana seharusnya dengan tunnel), pengunjung
mendapat error 522 yang penyebabnya tidak terlihat dari dashboard.

Bila perintah menjawab bahwa record sudah ada, periksa di dashboard bahwa
isinya `.cfargotunnel.com`, bukan alamat IP.

### Memeriksa

```bash
dig +short belanja.ebisnis.id
```

Yang muncul adalah alamat IP milik Cloudflare, bukan IP server Anda. Itu benar
— pengunjung memang tidak pernah menyentuh server secara langsung.

## 3. Tambahkan aturan ingress

Buka konfigurasi tunnel — biasanya `/etc/cloudflared/config.yml`:

```bash
sudo nano /etc/cloudflared/config.yml
```

Tambahkan `belanja.ebisnis.id` pada daftar `ingress`:

```yaml
tunnel: ebisnis
credentials-file: /etc/cloudflared/<tunnel-id>.json

ingress:
  - hostname: ebisnis.id
    service: http://localhost:80
  - hostname: www.ebisnis.id
    service: http://localhost:80
  - hostname: belanja.ebisnis.id
    service: http://localhost:80

  # Aturan penutup wajib ada dan wajib paling akhir.
  - service: http_status:404
```

Tiga hal yang menentukan berhasil tidaknya:

**Urutan dibaca dari atas.** Aturan pertama yang cocok dipakai, sisanya
diabaikan. Menaruh `belanja.ebisnis.id` **setelah** aturan tanpa `hostname`
membuatnya tidak pernah terpakai.

**Aturan penutup tanpa `hostname` wajib paling akhir.** cloudflared menolak
berjalan tanpanya.

**Jangan menambahkan `originRequest.httpHostHeader`.** Opsi itu menimpa header
`Host` sebelum diteruskan ke Apache. Akibatnya Apache tidak lagi dapat
membedakan `ebisnis.id` dari `belanja.ebisnis.id`, dan resolver storefront —
yang menentukan toko mana yang ditampilkan berdasarkan Host — akan menerima
alamat yang salah untuk **seluruh** pengunjung.

### Menyederhanakan dengan wildcard

Bila subdomain akan sering bertambah:

```yaml
ingress:
  - hostname: "*.ebisnis.id"
    service: http://localhost:80
  - hostname: ebisnis.id
    service: http://localhost:80
  - service: http_status:404
```

Wildcard menghemat penyuntingan, tetapi **rute DNS tetap dibuat satu per satu**
(langkah 2) — wildcard di ingress tidak membuat record DNS.

Untuk wildcard DNS sekaligus, buat record `CNAME` `*` → `<tunnel-id>.cfargotunnel.com`
di dashboard. Pertimbangkan dampaknya: setiap subdomain yang belum ada pun akan
menjawab, dan salah ketik menghasilkan halaman aplikasi alih-alih pesan tidak
ditemukan.

### Terapkan

```bash
sudo cloudflared tunnel ingress validate
sudo systemctl restart cloudflared
```

`ingress validate` memeriksa berkas tanpa menjalankannya. Jalankan lebih dulu —
memulai ulang dengan konfigurasi yang salah membuat tunnel mati dan
`ebisnis.id` ikut hilang, bukan hanya alamat yang baru.

## 4. Apache: kenali alamat baru

Alamatnya sudah ada pada konfigurasi di repo. Terapkan lewat skrip pembaruan:

```bash
sudo bash /opt/ebisnis/app/deploy/update.sh
```

Skrip ini yang mengambil source, membangun ulang, menjalankan migration,
memasang konfigurasi Apache, dan memulai ulang layanan — berikut backup basis
data dan pengembalian otomatis bila health check gagal.

> **Jangan menjalankan `git pull` manual lebih dulu.** Skrip menentukan apa yang
> perlu dikerjakan dengan membandingkan source terhadap commit yang terakhir
> selesai dipasang. Menarik source di luar skrip membuat keduanya tampak sama
> padahal aplikasi belum dibangun ulang. Bila terlanjur, jalankan
> `sudo bash /opt/ebisnis/app/deploy/update.sh --force`.

Memastikan alamat dikenal Apache:

```bash
apache2ctl -S | grep belanja
```

### Yang tidak perlu disentuh

**`ProxyPreserveHost On`** sudah ada pada `ebisnis-app.inc` dan harus tetap.
Tanpanya Apache meneruskan `Host: 127.0.0.1:3000` ke NestJS, dan resolver
storefront kehilangan satu-satunya penanda toko mana yang diminta.

**Blok `VirtualHost *:443`** boleh dibiarkan apa adanya. Dengan tunnel ia tidak
menerima lalu lintas — cloudflared menyambung ke port 80. Membiarkannya tidak
merugikan, dan berguna bila suatu saat kembali memakai IP langsung.

**Sertifikat dan certbot tidak diperlukan.** Cloudflare mengakhiri TLS di tepi
jaringan, dan jalur dari sana ke server adalah tunnel yang sudah terenkripsi.

## 5. Izinkan alamat baru pada API

```bash
sudo nano /opt/ebisnis/app/.env
```

```bash
CORS_ORIGINS=https://ebisnis.id,https://www.ebisnis.id,https://belanja.ebisnis.id
```

```bash
sudo systemctl restart ebisnis-api
```

Tanpa langkah ini halaman marketplace **terbuka dengan normal tetapi
katalognya kosong**, dan satu-satunya petunjuk ada di konsol peramban berupa
penolakan CORS. Gejalanya menyesatkan — terlihat persis seperti katalog yang
memang belum berisi.

## 6. Isi katalog

Katalog kosong sampai ada produk yang benar-benar diterbitkan.

### Instalasi dari sebelum Versi 9

Program marketplace termasuk data dasar platform, dan instalasi yang menjalankan
seed platform sebelum Versi 9 belum memilikinya. Tanpa itu penanaman produk
contoh berhenti dengan "Belum ada program marketplace yang aktif":

```bash
sudo -u ebisnis bash -lc "cd /opt/ebisnis/app && pnpm --filter @ebisnis/api seed:platform"
```

Aman dijalankan pada instalasi yang sudah berisi: seluruh baris ditanam dengan
`upsert`, dan super admin yang sudah ada **tidak disentuh sama sekali** —
credentialnya tidak diubah dan kata sandinya tidak disetel ulang.

### Kategori dan produk

Kategori saja:

```bash
sudo -u ebisnis bash -lc "cd /opt/ebisnis/app && pnpm --filter @ebisnis/api seed:catalog"
```

Kategori beserta satu toko dan enam produk contoh:

```bash
sudo -u ebisnis bash -lc "cd /opt/ebisnis/app && pnpm --filter @ebisnis/api seed:marketplace-demo"
```

Keduanya aman diulang; menjalankannya dua kali tidak menggandakan apa pun.
Gerbang publikasi tetap dijalankan seperti biasa — data contoh hanya disiapkan
sampai memenuhi syaratnya, tidak menerobosnya.

## Memeriksa hasilnya

Dari mana saja:

```bash
curl -s https://belanja.ebisnis.id/api/v1/public/catalog/search | head -c 300
```

Lalu buka `https://belanja.ebisnis.id` di peramban. Yang seharusnya terlihat:
daftar kategori dan produk terbaru, tanpa diminta masuk.

Untuk memastikan Apache benar-benar menerima Host yang tepat — dijalankan **di
server**, melewati tunnel:

```bash
curl -s -H "Host: belanja.ebisnis.id" http://localhost/api/v1/public/catalog/categories | head -c 200
```

Bila perintah ini berhasil tetapi lewat `https://belanja.ebisnis.id` gagal,
masalahnya ada di tunnel atau DNS, bukan di Apache maupun aplikasi. Itu
memisahkan separuh kemungkinan sekaligus.

## Bila belum berhasil

| Gejala | Penyebab yang paling sering | Yang diperiksa |
| --- | --- | --- |
| Error 1033 | rute DNS belum dibuat, atau tunnel mati | `cloudflared tunnel list`; `systemctl status cloudflared` |
| Error 502 | ingress menunjuk port yang salah, atau Apache mati | `systemctl status apache2`; cocokkan port pada `config.yml` |
| Error 522 | ada record `A` manual yang melewati tunnel | dashboard DNS: isinya harus `.cfargotunnel.com` |
| Halaman 404 dari Cloudflare | hostname tidak cocok aturan ingress mana pun | urutan aturan; salah ketik nama host |
| Halaman website perusahaan, bukan katalog | berkas web belum dibangun ulang | `pnpm build` lalu `update.sh` |
| Semua alamat menampilkan hal yang sama | `httpHostHeader` disetel pada ingress | hapus opsi itu |
| Katalog kosong, konsol menolak CORS | `CORS_ORIGINS` belum memuat alamat baru | `.env`, lalu restart API |
| Katalog kosong, konsol bersih | memang belum ada produk terbit | jalankan `seed:marketplace-demo` |
| Perubahan tidak terlihat | Cloudflare menyajikan versi lama | **Caching** → **Purge Everything** |

### Melihat log

```bash
sudo journalctl -u cloudflared -f
```

```bash
sudo tail -f /var/log/apache2/ebisnis-access.log | grep belanja
```

```bash
sudo journalctl -u ebisnis-api -f
```

Urutannya sengaja: bila permintaan tidak muncul pada log cloudflared, ia belum
sampai ke server sama sekali dan tidak ada gunanya memeriksa dua log berikutnya.

## Mode SSL di dashboard

**SSL/TLS → Overview.** Dengan tunnel, pilihan yang benar adalah **Full**.

Peringatan "jangan pakai Flexible" pada panduan tanpa-tunnel berlaku karena di
sana lalu lintas Cloudflare→server melintasi internet terbuka. Dengan tunnel,
jalur itu **adalah** tunnel yang sudah terenkripsi dan terautentikasi; bagian
HTTP hanya terjadi di dalam server, dari cloudflared ke Apache lewat
`localhost`.

Meski begitu tetap pilih **Full**, bukan Flexible: setelan itu berlaku untuk
seluruh domain, dan bila suatu saat ada subdomain yang dilayani tanpa tunnel,
Flexible akan membuka jalur polos untuk subdomain itu tanpa ada yang
menyadarinya.

## Menambah subdomain berikutnya

Empat langkah, dan hanya empat:

```bash
cloudflared tunnel route dns ebisnis <subdomain>.ebisnis.id
```

1. Perintah di atas.
2. Tambahkan `hostname` pada `config.yml`, lalu `cloudflared tunnel ingress validate` dan restart.
3. Tambahkan ke `ServerAlias` pada `ebisnis.conf`, lalu `configtest` dan reload.
4. Tambahkan ke `CORS_ORIGINS`, lalu restart API.

Tidak ada langkah sertifikat, dan tidak ada port yang perlu dibuka.

## Catatan tentang domain penjual

Panduan ini hanya untuk `belanja.ebisnis.id`, alamat marketplace platform.

Domain milik penjual sendiri (`tokojoni.com`) berjalan lewat mekanisme
tersendiri: penjual mendaftarkannya, membuktikan kepemilikannya lewat TXT
record, dan **domain yang belum terverifikasi tidak dilayani sama sekali** —
bukan diarahkan ke toko bawaan. Lihat
[`docs/upgrade-v9/17-storefront-domain.md`](../upgrade-v9/17-storefront-domain.md).

Untuk melayaninya lewat tunnel yang sama, penjual mengarahkan `CNAME` domainnya
ke `<tunnel-id>.cfargotunnel.com`, dan domain itu ditambahkan ke ingress. Karena
resolver menolak host yang belum terverifikasi, menambahkannya ke ingress lebih
dahulu tidak membuka apa pun.
