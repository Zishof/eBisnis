# 08 — Register Risiko Keamanan Versi 9

Versi 9 mengubah sifat sistem: dari ERP internal satu tenant menjadi platform
publik tempat orang asing memasukkan alamat, membayar, dan mengunggah berkas.
Permukaan serangannya berbeda, bukan sekadar lebih besar.

Tingkat: **KRITIS** (kehilangan uang atau data lintas tenant), **TINGGI**
(kerusakan nyata pada satu tenant), **SEDANG**, **RENDAH**.

## Yang sudah rusak sebelum Versi 9 dimulai

| # | Risiko | Tingkat | Bukti | Penanganan |
| --- | --- | --- | --- | --- |
| R01 | `PermissionGuard` keluar lebih awal bila handler tanpa metadata permission; 13 endpoint master tidak memilikinya | **KRITIS** | V6-0-F03, `docs/upgrade-v6/01-v5-regression-status.md` | **diperbaiki pada V9-1**, sebelum endpoint marketplace pertama |
| R02 | Batas data tersimpan tetapi tidak ditegakkan pada query | **KRITIS** | `role_data_scope` terisi; tidak ada resolver predikat | **diperbaiki pada V9-1** |

Keduanya sudah tercatat sejak V6-0. Menambah puluhan endpoint marketplace di
atasnya berarti setiap endpoint baru mewarisi lubang yang sama. Karena itu
keduanya dinaikkan ke fase pertama, bukan ditunda ke fase RBAC.

## Uang

| # | Risiko | Tingkat | Skenario | Penanganan |
| --- | --- | --- | --- | --- |
| R03 | `payment_url` dianggap bukti pembayaran | **KRITIS** | pembeli membuka halaman pembayaran lalu menutupnya; pesanan terlanjur diproses dan dikirim | hanya callback tervalidasi atau inquiry SUCCESS yang menandai lunas |
| R04 | Callback ganda menjadi pembayaran ganda | **KRITIS** | provider mengirim ulang callback saat gagal menerima ack | `@@unique([providerId, providerTransactionId])` **sudah ada**; ditambah pemeriksaan "sudah lunas → berhenti" |
| R05 | **Callback seller A melunasi order seller B** | **KRITIS** | penyerang menebak transaction id lalu mengirim callback | validasi bahwa akun provider pada callback adalah milik seller order tersebut |
| R06 | Jumlah callback berbeda dari jumlah order | **KRITIS** | pembayaran sebagian diterima sebagai lunas | tolak bila jumlah tidak sama persis |
| R07 | Callback dipalsukan dari IP mana pun | **TINGGI** | penyerang mengirim callback langsung | `allowedIps` **sudah ada** pada `PaymentProvider`; ditegakkan dan diperluas ke akun tenant |
| R08 | Credential seller bocor | **KRITIS** | satu tenant membaca credential tenant lain | terenkripsi, tidak pernah dikembalikan utuh, step-up, audit setiap pembacaan |
| R09 | Credential ditempel pada catatan tiket | **KRITIS** | admin membalas tiket dengan credential; terbaca banyak orang dan terindeks | credential hanya lewat formulir tersendiri; tiket mencatat status, bukan isi |
| R10 | Refund manual tanpa jejak | **TINGGI** | uang dikembalikan tanpa bukti, tidak dapat direkonsiliasi | setiap langkah refund punya pelaku, waktu, dan lampiran |

## Lintas tenant

| # | Risiko | Tingkat | Skenario | Penanganan |
| --- | --- | --- | --- | --- |
| R11 | Nama schema berasal dari permintaan publik | **KRITIS** | header atau query `?schema=` menentukan schema | schema **hanya** dari `platform.tenant_schema_registry`; aturan sejak Versi 5 |
| R12 | Host spoofing pada storefront | **KRITIS** | header `Host` palsu menampilkan katalog tenant lain | host dinormalkan lalu dicari pada registry domain **terverifikasi**; host tak dikenal ditolak |
| R13 | Domain milik orang lain didaftarkan | **TINGGI** | tenant A mendaftarkan domain tenant B | verifikasi kepemilikan lewat TXT record atau berkas `.well-known` sebelum dilayani |
| R14 | Custom domain menampilkan produk seller lain | **KRITIS** | penyaringan tenant terlupa pada satu query | penyaringan pada lapisan repository, bukan controller; diuji |
| R15 | Projection membocorkan listing belum terbit | **TINGGI** | worker menyalin seluruh listing | projection hanya memuat yang `PUBLISHED` dan seller aktif |
| R16 | Order seller lain terbaca | **KRITIS** | seller membuka order dengan id tebakan | batas data ditegakkan (lihat R02) |

## Berkas dan media

| # | Risiko | Tingkat | Skenario | Penanganan |
| --- | --- | --- | --- | --- |
| R17 | Unggahan berisi kode yang dieksekusi | **KRITIS** | berkas `.php`/`.svg` berisi skrip diunggah lalu diakses | karantina, validasi tipe nyata (bukan ekstensi), sajikan dari domain terpisah tanpa cookie |
| R18 | Bom dekompresi gambar | **TINGGI** | PNG kecil yang mengembang menjadi gigabyte | batas dimensi dan piksel sebelum decode penuh |
| R19 | SVG berisi skrip | **TINGGI** | `<svg><script>` | SVG tidak diterima sebagai gambar produk, atau disanitasi ketat |
| R20 | Metadata EXIF membocorkan lokasi | **SEDANG** | koordinat rumah penjual terbawa | EXIF dibuang saat membuat turunan |
| R21 | URL YouTube menjadi iframe sembarang | **TINGGI** | `youtubeUrl` berisi HTML | hanya host resmi; ekstrak id video; embed dibangun sistem, bukan dari input |
| R22 | Lampiran chat menyebarkan malware | **TINGGI** | penjual mengirim berkas berbahaya ke pembeli | pipeline yang sama dengan media produk |

## Stok

| # | Risiko | Tingkat | Skenario | Penanganan |
| --- | --- | --- | --- | --- |
| R23 | Oversell | **TINGGI** | dua pembeli checkout barang terakhir bersamaan | reservasi dengan penguncian baris; `stock_reservation` sudah ada |
| R24 | Reservasi bocor | **SEDANG** | pembayaran gagal tetapi stok tetap tertahan | pelepasan idempoten + kedaluwarsa |
| R25 | Pelepasan ganda menambah stok | **TINGGI** | dua peristiwa melepas reservasi yang sama | idempotensi pada peristiwa, bukan pada pemanggil |

## Penyalahgunaan publik

| # | Risiko | Tingkat | Skenario | Penanganan |
| --- | --- | --- | --- | --- |
| R26 | Pencarian dipakai menguras katalog | **SEDANG** | scraping seluruh listing | batas laju, paginasi berbatas |
| R27 | Ulasan palsu | **SEDANG** | ulasan tanpa pembelian | hanya dari baris order yang benar-benar terkirim |
| R28 | Enumerasi order lewat id | **TINGGI** | id berurutan ditebak | UUID + pemeriksaan kepemilikan |
| R29 | Data pribadi pembeli terbaca seller lain | **KRITIS** | alamat dan telepon bocor | penyamaran; seller hanya melihat pembeli yang memesan kepadanya |
| R30 | Checkout dipakai menguji kartu curian | **SEDANG** | percobaan pembayaran beruntun | batas laju per pembeli dan per IP |

## Yang tidak akan dibangun

| Diminta | Alasan tidak dibangun |
| --- | --- |
| Escrow platform | menahan uang seller memerlukan izin dan kontrak yang tidak dimiliki |
| Split settlement | provider tidak mendukung; mengklaimnya berarti berjanji yang tidak dapat ditepati |
| Refund otomatis | tidak ada API resmi; mengarangnya berarti kehilangan uang saat gagal diam-diam |
| Pemotongan fee dari aliran provider | provider tidak mendukung; fee diakru dan ditagih terpisah |

## Urutan penanganan

**Sebelum endpoint marketplace pertama:** R01, R02.

**Bersama fase yang memperkenalkannya:** R03–R10 pada V9-2 dan V9-7; R11–R16 pada
V9-3 dan V9-5; R17–R22 pada V9-4; R23–R25 pada V9-8; R26–R30 pada V9-5 dan V9-6.

Setiap risiko KRITIS wajib punya test yang gagal bila penanganannya dicabut.
Test yang hanya membuktikan jalur normal tidak menutup risiko apa pun.
