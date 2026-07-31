# 20 — Fondasi Telemetri (V10-1)

Menutup O1–O5 pada [matriks gap V10](01-v10-gap-matrix.md).

## Yang dibangun

| Objek | Jumlah |
| --- | ---: |
| Schema baru | `platform_observability` |
| Tabel baru | 4 |
| Test baru | 91 |

## Satu sanitizer, bukan dua

Audit mencatat `maskPayload` sudah ada pada klien eSmartlink. Berkas
`telemetry-sanitizer.ts` **mengangkatnya** menjadi layanan bersama alih-alih
membuat penyamar kedua.

Dua sanitizer akan berbeda daftar medannya, dan yang satu akan lupa
menyamarkan apa yang disamarkan yang lain. Perbedaan itu baru ketahuan ketika
sesuatu yang seharusnya tersamar muncul pada log.

## Daftar izin untuk header, daftar larangan untuk medan

| | Cara | Alasan |
| --- | --- | --- |
| Header | daftar **izin** | header baru dari pustaka pihak ketiga tidak otomatis tersimpan; `authorization` bukan satu-satunya yang membawa rahasia |
| Medan payload | daftar **larangan** | bentuknya tidak terbatas; daftar izin berarti tidak ada payload yang pernah tersimpan |

Header di luar daftar izin **dibuang seluruhnya**, bukan disamarkan. Menyimpan
namanya beserta penanda tersamar tetap membocorkan bahwa header itu ada, dan
kadang keberadaannya sendiri yang menarik bagi penyerang.

## Penyamaran berdasarkan bentuk, bukan hanya nama

Pihak ketiga memberi nama medan sesukanya. Token JWT tetap terlihat seperti JWT
apa pun namanya, dan empat pola menangkapnya: bearer, JWT, kunci privat, dan
kunci penyedia.

## Tiga batas penelusuran

| Batas | Nilai | Alasan |
| --- | ---: | --- |
| Kedalaman objek | 8 | objek yang menunjuk dirinya sendiri |
| Panjang larik | 100 | satu permintaan berisi sepuluh ribu baris |
| Panjang teks | 2.000 | log bukan tempat menyimpan berkas |

Lingkaran rujukan menghasilkan penanda `[lingkaran]`, bukan penelusuran tanpa
henti.

## Alamat IP disamarkan, bukan disimpan utuh

Oktet terakhir dibuang untuk IPv4, separuh belakang untuk IPv6. Cukup untuk
mengelompokkan asal permintaan tanpa menyimpan alamat yang menunjuk satu orang.

## Jejak tumpukan dibersihkan dari jalur absolut

`C:\opt\eBisnisGithub\apps\api\src\...` memuat nama pengguna dan struktur
direktori server. Yang disimpan hanya jalur relatif.

**Cacat yang ditemukan saat menulis test:** pemotongan jalur pertama ikut
memakan **nama fungsi**, sehingga dua fungsi berbeda pada berkas yang sama
menghasilkan sidik yang sama. Nama fungsi adalah bagian paling berharga dari
sebuah bingkai; pemotongan kini hanya menyentuh bagian di dalam kurung.

## Pengelompokan menentukan segalanya

Satu kegagalan yang terjadi sepuluh ribu kali adalah **satu** masalah. Tanpa
pengelompokan, daftar galat menjadi dinding teks, dan masalah baru tenggelam di
antara pengulangan yang sudah diketahui.

### Yang ikut dan tidak ikut membentuk sidik

| Ikut | Tidak ikut | Mengapa tidak |
| --- | --- | --- |
| jenis galat | id, angka, waktu, surel | dinormalkan lebih dulu |
| kode galat aplikasi | nomor baris | perubahan komentar tidak boleh memecah kelompok |
| pesan yang dinormalkan | versi rilis | galat sama pada dua rilis tetap satu masalah |
| 3 bingkai teratas | id tenant | kegagalan sama pada banyak tenant adalah satu masalah |
| modul dan templat rute | bingkai `node_modules` | jalur pustaka berbeda memecah satu masalah |

Kode galat lebih dipercaya daripada pesan: pesan dapat diperbaiki kalimatnya
tanpa mengubah masalahnya.

## Tidak semua galat disimpan

Kesalahan validasi dan permintaan yang tidak ditemukan terjadi terus-menerus
pada sistem yang sehat. Menyimpan seluruhnya menghabiskan penyimpanan tanpa
menambah pengetahuan.

| Keadaan | Disimpan? |
| --- | --- |
| Tidak tertangani | ya |
| 5xx | ya |
| 401, 403 | ya — polanya menandakan usaha menembus |
| 429 | ya — menandakan penyalahgunaan |
| 400, 404, 422 | **tidak** |

Tingkat keparahan pun dibedakan: 4xx biasa adalah `INFO`, bukan `ERROR`.
Mencatatnya sebagai `ERROR` akan membuat galat sungguhan tenggelam.

## Observability di control plane, bukan schema tenant

Galat lintas tenant. Satu kegagalan pada pustaka bersama muncul pada belasan
tenant sekaligus, dan mengelompokkannya menuntut membaca seluruhnya.

`tenantId` disimpan sebagai **dimensi**, bukan pemilik. Administrator tenant
tidak berhak membacanya meski datanya berasal dari tenantnya.

Setiap akses tercatat pada `observability_access_log` — termasuk ketika yang
membaca adalah Super Admin. Alasan wajib untuk tindakan yang mengeluarkan data.

## Retensi sebagai data, bukan konstanta

Kebutuhan penyimpanan berbeda antar pemasangan, dan aturan kepatuhan berubah
tanpa menunggu rilis. `legalHold` menahan penghapusan meski batasnya lewat.

## Keterbatasan yang diketahui

**Belum ada yang menulis ke `error_log`.** Filter galat global sudah ada dan
sudah menangkap, tetapi penyambungannya ke penyimpanan adalah V10-2. Membangun
penyimpanan tanpa dasbor menghasilkan data yang tidak dibaca siapa pun.

**Belum ada partisi.** Tabel `error_log` akan tumbuh cepat; partisi per bulan
menyusul bersama kebijakan retensi yang berjalan.

**`traceId` dan `spanId` belum dipropagasi.** `RequestMeta` sekarang membawa
`requestId` dan `correlationId`; menambah dua lagi menuntut perubahan pada
middleware yang lebih baik dikerjakan bersama V10-3.

**Kebijakan retensi belum diseed.** Tabelnya ada; nilainya menunggu keputusan
tentang berapa lama data observability disimpan.
