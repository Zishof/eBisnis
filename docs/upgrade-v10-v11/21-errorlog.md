# 21 — ErrorLog Terpusat (V10-2)

Menutup O6–O12 pada [matriks gap V10](01-v10-gap-matrix.md).

## Yang dibangun

| Objek | Jumlah |
| --- | ---: |
| Permission baru | 4 |
| Endpoint baru | 5 |
| Test baru | 12 |

## Menangkap galat tidak boleh menggagalkan permintaan

Aturan pertama dan terpenting. Sistem observability yang membuat aplikasi ikut
jatuh ketika penyimpanannya bermasalah **lebih merugikan** daripada tidak punya
observability sama sekali.

Karena itu penyimpanan berjalan **setelah** respons dikirim, hasilnya tidak
ditunggu, dan kegagalannya hanya dicatat pada log proses.

Konsekuensinya nyata dan harus diakui: penangkapan bersifat *best-effort*.
Bukti V10-2 sempat gagal karena mengandaikan jeda tetap dua detik; ia kini
menunggu sampai keadaan berhenti berubah. **Yang salah asumsi buktinya, bukan
kodenya.**

## Filter yang sudah ada, bukan filter kedua

`AllExceptionsFilter` sudah menangkap seluruh galat dan mengembalikan respons
aman. Yang ditambahkan hanya penyimpanannya.

Pendaftarannya dipindah dari `useGlobalFilters(new AllExceptionsFilter())` di
`main.ts` ke `APP_FILTER` pada modul — filter yang dibuat manual tidak menerima
dependensi apa pun, sehingga penangkapnya tidak akan pernah terinjeksi.

Penangkap dideklarasikan `@Optional()`: filter ini juga dipakai sebelum modul
infrastruktur siap, mis. pada galat saat aplikasi menyala. Menuntutnya selalu
ada akan membuat kegagalan penyalaan tidak terjawab sama sekali.

### Pesan asli, bukan pesan produksi

Yang dikirim ke penangkap adalah pesan **asli**, bukan `Terjadi kesalahan pada
server.` yang ditampilkan di produksi. Observability memang ada untuk melihat
penyebab sesungguhnya; penyamaran datanya dilakukan sanitizer.

## Pengelompokan saat menulis, bukan saat membaca

Menghitung kelompok saat membaca menuntut memindai seluruh kejadian setiap kali
dasbor dibuka. Dengan jutaan baris, itu tidak dapat dilakukan.

Kelompok diperbarui pada setiap kejadian. Yang **tidak** dihitung setiap kali
adalah jumlah tenant dan pengguna terdampak — menghitung `DISTINCT` pada setiap
galat akan membuat penangkapan lebih mahal daripada permintaan yang
menyebabkannya. Angka itu disegarkan berkala.

### Regresi terdeteksi otomatis

Galat yang sudah dinyatakan `RESOLVED` lalu muncul lagi menjadi `REGRESSED`.
Tanpa penanda itu, perbaikan yang gagal terlihat sama dengan galat lama yang
belum sempat dibersihkan.

## Kebocoran yang ditemukan bukti

Bukti V10-2 menemukan **jalur absolut server masih tersimpan**. Jejak dari
`node_modules` tidak memuat penanda `apps/packages/src`, sehingga dua aturan
pembersih yang ada tidak menyentuhnya:

```text
at GuardsConsumer.tryActivate (C:/opt/eBisnisGithub/node_modules/.pnpm/…)
```

Dua aturan ditambahkan: jalur pustaka dipotong sampai `node_modules/`, dan sisa
jalur absolut apa pun dipotong sampai dua segmen terakhir.

Aturan kedua sempat merusak jalur yang sudah bersih — `apps/api/src/x.ts`
menjadi `apps…/x.ts`, dan nama aplikasinya hilang. Ia kini wajib berawal tepat
setelah kurung **dan** benar-benar absolut.

## Hanya Super Admin, dan itu diuji

Empat permission baru: `READ`, `EXPORT`, `MANAGE`, `PURGE`.

Tidak satu pun diberikan kepada role lain — termasuk **Auditor dan Support**,
yang paling mungkin dianggap "boleh saja". Justru itu yang membuatnya diuji
secara khusus.

Super Admin memperolehnya lewat `permissions: '*'`, bukan lewat daftar,
sehingga menambah permission observability baru tidak menuntut mengubah
definisi rolenya.

## Tampilan bawaan menyembunyikan yang sudah selesai

`RESOLVED`, `IGNORED`, `DUPLICATE`, dan `NOT_ACTIONABLE` tidak muncul pada
tampilan bawaan — keempatnya bukan pekerjaan yang menunggu.

Kejadiannya tetap tersimpan utuh. Pengelompokan hanya menentukan tampilan
bawaan, bukan apa yang disimpan.

## Alasan wajib pada dua tempat

| Tindakan | Mengapa beralasan |
| --- | --- |
| Menandai `IGNORED` | galat yang diabaikan tanpa alasan akan diabaikan lagi oleh orang berikutnya tanpa tahu mengapa |
| Ekspor konteks | ekspor mengeluarkan data dari sistem, dan ekspor tanpa alasan tidak dapat ditinjau kemudian |

## Ekspor tidak menyamarkan ulang

Isinya sudah tersanitasi sejak disimpan. Penyamaran yang dilakukan dua kali di
dua tempat akan berbeda, dan yang satu akan lupa apa yang disamarkan yang lain.

Paket ekspor menutup dengan pernyataan bahwa analisis apa pun atasnya adalah
**saran, bukan kebenaran** — perbaikan tetap menuntut cabang, test, dan
peninjauan manusia.

## Bukti

[`evidence/v10-2-errorlog.txt`](evidence/v10-2-errorlog.txt), dijalankan
terhadap API yang benar-benar berjalan.

```text
3 galat sama         ->  1 kelompok, 3 kejadian tersimpan
10 permintaan 404    ->  0 baris bertambah
header rahasia       ->  tidak tersimpan sama sekali
?password=rahasia123 ->  {"password":"***MASKED***"} — nama terlihat, nilai tidak
jalur absolut        ->  0
alamat IP utuh       ->  0
id sesi mentah       ->  0
role berhak          ->  PLATFORM_SUPER_ADMIN saja
```

## Keterbatasan yang diketahui

**Belum ada dasbor.** Endpoint-nya lengkap dan diuji; halaman Pusat
Observability menyusul. Tanpa itu, satu-satunya cara membacanya adalah lewat
API.

**Belum ada partisi.** `error_log` akan tumbuh cepat pada sistem yang sibuk.
Partisi bulanan menyusul bersama penjadwal retensi.

**Galat peramban dan worker belum masuk.** Kolomnya ada (`source`,
`workerName`, `queueName`) tetapi hanya jalur API yang memanggil penangkap.

**Penjadwal penyegaran dampak belum berjalan.** `refreshImpactCounts` tersedia
sebagai endpoint tetapi belum dipanggil otomatis, sehingga jumlah tenant
terdampak tetap nol sampai dipicu.

**Kebijakan retensi belum berjalan.** Tabelnya ada sejak V10-1; penghapusnya
belum dibuat.
