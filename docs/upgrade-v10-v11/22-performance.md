# V10-3 — PerformanceLog

Status: **SELESAI**
Cakupan: agregat kinerja per rute, cuplikan proses, analisis kebocoran memori,
statistik kueri PostgreSQL.

---

## 1. Keputusan yang membentuk rancangan ini

### 1.1 Agregat di memori, bukan satu baris per permintaan

Mencatat satu baris per permintaan berarti tabel yang tumbuh sebesar lalu lintas
— dan pertanyaan yang benar-benar ditanyakan hampir selalu tentang persentil,
bukan tentang satu permintaan tertentu. "Berapa p95 endpoint checkout kemarin"
tidak menuntut adanya satu juta baris; ia menuntut adanya persentil.

Karena itu durasi dikumpulkan pada ember di memori dan ditulis sekali per
jendela lima menit.

**Konsekuensi yang diakui:** agregat yang belum tertulis **hilang** bila proses
mati mendadak. Itu pertukaran yang disengaja — kehilangan lima menit data
kinerja jauh lebih ringan daripada memperlambat setiap permintaan. `flushWindow`
dipanggil juga pada `onModuleDestroy`, sehingga penghentian yang tertib tidak
kehilangan apa pun.

### 1.2 Pengukur tidak boleh membebani yang diukur

Interceptor hanya memanggil `process.hrtime.bigint()` dua kali dan menambah
angka ke `Map`. Tidak ada I/O, tidak ada `await`, tidak ada sentuhan basis data
pada jalur permintaan. Pengumpul yang menulis ke basis data setiap permintaan
akan menjadi bagian dari masalah yang hendak diukurnya.

Batas seribu sampel per ember per jendela: persentil dari sepuluh ribu sampel
tidak lebih tepat daripada dari seribu, tetapi memakan sepuluh kali memori.

### 1.3 Rute dinormalkan sebelum menjadi kunci

`GET /orders/8f3c…/items` dan `GET /orders/1a2b…/items` adalah **satu** rute.
Tanpa normalisasi, setiap id menjadi baris tersendiri dengan `n=1`, dan
persentil kehilangan artinya sepenuhnya.

Templat diambil dari `request.route.path` bila Express menyediakannya, dan
`normalizeRoute()` dipakai sebagai cadangan. Kueri string tidak pernah ikut —
lihat bagian 4.

### 1.4 Yang dihitung galat hanya kegagalan server

Penolakan validasi (400) dan penolakan izin (403) adalah **hasil yang benar**.
Memasukkannya ke `errorCount` membuat tingkat galat per rute tidak berarti:
endpoint login yang sehat akan tampak "gagal 30%" hanya karena orang salah
mengetik kata sandi.

Galat yang dilempar sebelum status ditetapkan dihitung sebagai kegagalan server,
karena `response.statusCode` saat itu belum mencerminkan apa yang akan
dikembalikan filter.

### 1.5 Diurutkan menurut p95, bukan rata-rata

Rata-rata menyembunyikan ekor yang justru dirasakan pengguna. Rute dengan
rata-rata 50 ms tetapi p95 3 detik terasa lambat bagi satu dari dua puluh orang
— dan merekalah yang menelepon.

---

## 2. Analisis kebocoran memori menahan diri

Satu grafik RAM yang naik **bukan** bukti kebocoran. Proses Node yang sehat
memang menaikkan heap sampai GC berjalan; menyebut itu kebocoran akan membuat
orang mengejar hantu.

`leak-heuristics.ts` karena itu mengembalikan salah satu dari lima putusan,
beserta angka yang mendasarinya:

| Putusan | Arti |
|---|---|
| `INSUFFICIENT_EVIDENCE` | Sampel belum cukup (< 12 sampel atau < 30 menit). Ini jawaban jujur, bukan kegagalan. |
| `NORMAL` | Naik-turun, tidak ada kecenderungan tumbuh. |
| `TEMPORARY_SPIKE` | Sempat naik lalu turun kembali. |
| `SUSPICIOUS` | Dasar (nilai terendah setelah GC) tumbuh ≥ 1,25×. |
| `REPRODUCED` | Dasar tumbuh ≥ 2× dan kecenderungannya konsisten. |

Yang dikembalikan bukan hanya kesimpulan melainkan `evidence` — kemiringan per
jam, dasar awal dan akhir, rasio, jumlah sampel — supaya pembacanya dapat
menilai sendiri apakah kesimpulannya masuk akal.

### 2.1 Mengapa penghitung pegangan diganti

`process._getActiveHandles()` adalah API internal yang **tidak menghitung
timer**. Diuji langsung: dengan satu server HTTP dan satu `setInterval` aktif,
API itu melaporkan `1` — hanya servernya.

Padahal `setInterval` yang tidak pernah dibersihkan adalah salah satu bentuk
kebocoran paling sering terjadi. Diukur dengan API itu, kebocoran timer akan
tampak sebagai angka tetap, dan heuristiknya akan menyimpulkan `NORMAL`
selamanya — persis pada kasus yang paling perlu terdeteksi.

Penggantinya `process.getActiveResourcesInfo()`, API resmi sejak Node 17, yang
menghitung keduanya. API lama tetap dipakai sebagai cadangan pada runtime yang
belum memilikinya. Diuji pada `performance-collector.spec.ts`.

---

## 3. Statistik kueri: melaporkan tidak tersedia, bukan mengarang

Agregat kueri menuntut ekstensi `pg_stat_statements`. Ekstensi itu **tidak
terpasang** pada basis data pengembangan (PostgreSQL 17.2), dan memasangnya
menuntut mengubah `shared_preload_libraries` lalu memulai ulang server —
perubahan konfigurasi yang bukan wewenang aplikasi.

`QueryStatsAdapter` karena itu memeriksa keberadaannya dan mengembalikan status
yang jujur:

| Status | Arti | Penyelesaian |
|---|---|---|
| `AVAILABLE` | Terpasang dan terbaca. | — |
| `EXTENSION_MISSING` | Belum terpasang. | Operator menambahkan pada `shared_preload_libraries`, memulai ulang, lalu `CREATE EXTENSION`. |
| `NOT_PERMITTED` | Terpasang tetapi pengguna basis data tidak berhak. | Berikan `pg_read_all_stats`. |
| `ERROR` | Sebab lain, disertakan pesannya. | Bergantung pesan. |

Mengarang angka kinerja kueri akan membuat orang mengoptimalkan sesuatu yang
tidak pernah diukur. Ketiga status selain `AVAILABLE` mengembalikan `rows: []` —
tidak ada baris yang dikarang.

Teks kueri yang dikembalikan `pg_stat_statements` **sudah dinormalkan
PostgreSQL**: nilai literal diganti `$1`, `$2`. Nomor rekening dan kata sandi
yang pernah masuk kueri tidak muncul di sini, dan normalisasi itu dilakukan
PostgreSQL — bukan oleh kita.

---

## 4. Batas keamanan

- **Kueri string tidak pernah masuk templat rute.** Yang disimpan hanya jalur.
  `?password=…&token=…` tidak pernah tercatat. Dibuktikan pada bagian 8 skrip
  bukti.
- **Seluruh endpoint menuntut `PLATFORM.OBSERVABILITY.*`**, yang hanya dimiliki
  Super Admin. Administrator tenant tidak memilikinya meski datanya berasal dari
  tenantnya — observability memuat jejak seluruh tenant, dan siapa pun yang
  dapat membacanya dapat melihat data tenant mana pun tanpa melewati support
  session yang tercatat.
- **Masuk saja tidak cukup.** Skrip bukti membuat petugas platform kedua dengan
  peran `PLATFORM_CONTENT_EDITOR`, membuktikan ia **dapat masuk** namun tetap
  ditolak `403` pada keempat endpoint. Yang menjaga adalah izinnya, bukan sekadar
  adanya token.
- **Setiap pembacaan tercatat** pada `observability_access_log`.

---

## 5. Skema

Migration: `add_performance_observability` (additive, skema
`platform_observability`).

| Tabel | Isi | Catatan |
|---|---|---|
| `performance_snapshot` | Cuplikan proses tiap 60 detik | heap, rss, GC, event loop, pegangan, CPU, uptime |
| `performance_route_aggregate` | Agregat per jendela 5 menit | unik pada `(windowStart, routeTemplate, httpMethod, serviceName)` |
| `performance_anomaly` | Anomali kinerja terdeteksi | sidik anomali agar tidak berulang |
| `performance_baseline` | Dasar pembanding per rute | untuk membandingkan rilis |

---

## 6. Endpoint

| Method | Jalur | Izin |
|---|---|---|
| GET | `/platform/observability/performance/routes?jam=` | `PLATFORM.OBSERVABILITY.READ` |
| GET | `/platform/observability/performance/memory?jam=` | `PLATFORM.OBSERVABILITY.READ` |
| GET | `/platform/observability/performance/queries` | `PLATFORM.OBSERVABILITY.READ` |
| POST | `/platform/observability/performance/flush` | `PLATFORM.OBSERVABILITY.MANAGE` |

---

## 7. Bukti

Skrip: `apps/api/scripts/prove-v10-3-performance.mjs`
Keluaran: `docs/upgrade-v10-v11/bukti-v10-3-performance.txt`

Skrip ini **tidak memakai akun super admin bawaan**. Akun itu wajib mengganti
kata sandi sebelum dapat membuka apa pun — penjagaan yang benar, dan sebuah
skrip bukti tidak berhak melumpuhkannya ataupun mengganti kata sandi milik orang
lain. Sebagai gantinya skrip membuat petugas sementara dengan kata sandi acak,
memakainya, lalu menghapusnya kembali; bagian 9 membuktikan penghapusannya.

Sembilan bagian yang dibuktikan terhadap API yang benar-benar berjalan:

1. Tiga id berbeda menjadi satu templat rute — bukan tiga baris.
2. `p50 ≤ p90 ≤ p95 ≤ p99 ≤ max` pada seluruh baris, dan `/routes` mengurutkan
   menurut p95.
3. Cuplikan proses benar-benar terambil dengan heap bukan nol.
4. Analisis kebocoran menjawab `INSUFFICIENT_EVIDENCE` saat sampel belum cukup.
5. Statistik kueri melaporkan `EXTENSION_MISSING` beserta cara mengaktifkannya,
   tanpa satu pun baris dikarang.
6. Tanpa token `401`; petugas platform tanpa izin observability `403` pada
   keempat endpoint.
7. Pembacaan tercatat pada `observability_access_log`.
8. Kueri string tidak pernah tersimpan pada templat rute.
9. Petugas sementara terhapus.

Uji unit: `performance-collector.spec.ts`, `leak-heuristics.spec.ts`,
`query-stats.spec.ts` — 153 uji pada modul observability.

---

## 8. Yang belum dikerjakan

- **`performance_anomaly` dan `performance_baseline` belum diisi.** Tabelnya ada
  dan berfungsi, tetapi belum ada pekerjaan berkala yang membandingkan jendela
  berjalan terhadap dasar lalu menulis anomali. Deteksi anomali kinerja yang
  berguna menuntut dasar dari lalu lintas nyata selama berhari-hari; mengisinya
  sekarang dengan dasar dari lalu lintas pengembangan hanya akan menghasilkan
  peringatan palsu.
- **`eventLoopUtilization` selalu 0.** Kolomnya ada, nilainya belum diambil dari
  `performance.eventLoopUtilization()`.
- **`pg_stat_statements` belum terpasang** pada dev maupun produksi. Selama itu,
  endpoint `/queries` akan selalu menjawab `EXTENSION_MISSING`.
