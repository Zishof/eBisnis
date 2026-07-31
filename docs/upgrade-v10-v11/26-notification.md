# V10-7 — Notification Hub

Status: **SELESAI** (backend)
Cakupan: lonceng, deep link, status baca/tindak lanjut, pengelompokan, catatan
pengiriman per kanal, adapter kanal, dan eskalasi SLA.

---

## 1. Audit lebih dulu

| Yang ada | Keadaan |
|---|---|
| Tabel `notification` | **Ada sejak V004, berisi NOL baris** |
| Tabel `notification_template` | Ada, 10 templat tersemai, tidak pernah dipakai |
| Kode yang menulisi `notification` | **Tidak ada** |
| Endpoint yang membacanya | **Tidak ada** |
| Infrastruktur surel / push | **Tidak ada sama sekali** |

Temuan yang menentukan arah: tabelnya sudah ada dan sepenuhnya mati. Yang perlu
dikerjakan bukan membuat tabel, melainkan membuatnya berguna — dan yang membuat
tabel pemberitahuan berguna bukan kolomnya, melainkan **ada yang menulisinya**.

---

## 2. Kanal yang belum berkredensial melaporkan apa adanya

Surel, web push, WhatsApp, dan pemberitahuan seluler menuntut kredensial yang
tidak dimiliki sistem ini. Ada tiga cara menghadapinya, dan dua di antaranya
salah:

1. **Melaporkan berhasil padahal tidak terkirim.** Yang paling berbahaya: orang
   mengira sudah diberi tahu, pekerjaan berhenti menunggu seseorang yang tidak
   pernah tahu ia ditunggu, dan tidak ada satu pun tanda bahwa ada yang salah.
2. **Menolak seluruh pemberitahuan karena satu kanal belum siap.** Kanal yang
   bekerja ikut mati.
3. **Melaporkan `UNCONFIGURED` beserta apa yang kurang.** Inilah yang dilakukan.

| Kanal | Keadaan | Yang dibutuhkan |
|---|---|---|
| `IN_APP` | **Siap** | — |
| `EMAIL` | Belum | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |
| `WEB_PUSH` | Belum | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| `WHATSAPP` | Belum | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` — **dan** templat pesan yang sudah disetujui Meta |
| `MOBILE_PUSH` | Belum | `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` |

Keterangan WhatsApp sengaja menyebutkan persetujuan templat Meta: kredensial
saja tidak cukup, dan operator yang tidak tahu itu akan menyiapkan token lalu
bingung mengapa pesannya tetap ditolak.

Adapter memeriksa env **saat dipanggil**, bukan saat dibuat — kredensial dapat
dipasang tanpa membangun ulang aplikasi. Kredensial yang sudah ada tetapi
pengirimnya belum ditulis menghasilkan `FAILED`, bukan `UNCONFIGURED`: operator
yang sudah menyiapkan kredensial tidak boleh mengira setelannya yang salah.

---

## 3. Lonceng mendahulukan yang menuntut tindakan

Lonceng yang mengurutkan menurut waktu akan mengubur permintaan persetujuan
kemarin di bawah sepuluh kabar hari ini.

Urutannya: **menuntut tindakan dan belum ditindaklanjuti** → belum dibaca →
terbaru.

### 3.1 Dibaca berbeda dari ditindaklanjuti

Melihat permintaan persetujuan tidak sama dengan menyetujuinya. Lonceng yang
menganggapnya sama akan menyembunyikan pekerjaan yang belum selesai begitu
seseorang menggulir melewatinya.

### 3.2 Yang menuntut tindakan tidak dapat ditutup begitu saja

Menutupnya akan membuat pekerjaan orang lain berhenti menunggu tanpa ada yang
tahu sebabnya. Ditolak `400` dengan pesan yang menyebutkan apa yang harus
dilakukan.

Alasan yang sama membuat preferensi kanal **tidak boleh mematikan** kanal dalam
aplikasi untuk pemberitahuan yang menuntut tindakan. Preferensi boleh mengurangi
kebisingan; ia tidak boleh memutus alur kerja.

### 3.3 Deep link

Pemberitahuan tanpa tautan hanya memberi tahu bahwa sesuatu terjadi lalu
membiarkan orangnya mencari sendiri di mana. Yang tidak dapat ditindaklanjuti
dengan satu ketukan pada akhirnya diabaikan.

Disimpan sebagai **jalur relatif**, bukan URL lengkap: URL lengkap memuat nama
host, dan pemberitahuan yang dibuat di lingkungan pengembangan akan menautkan ke
`localhost` selamanya.

---

## 4. Dua cacat yang ditemukan skrip bukti

### 4.1 NULL pada indeks unik membuat pengelompokan tidak bekerja

Indeks pengelompokan V020 ditulis `UNIQUE (group_key, recipient_subject_id,
channel)`, dan **tidak bekerja sama sekali** untuk pemberitahuan yang ditujukan
kepada peran — karena `recipient_subject_id`-nya `NULL`, dan PostgreSQL
memperlakukan `NULL` sebagai nilai yang selalu berbeda dari `NULL` lain.

Akibatnya terlihat langsung pada bukti: tiga kali pemeriksaan SLA menghasilkan
**tiga baris**, bukan satu. Pemeriksaan berjalan tiap jam, jadi surat yang
terlambat tiga hari akan menghasilkan 72 baris lonceng — yang menenggelamkan
segala hal lain dan membuat lonceng itu diabaikan. Eskalasi yang dibangun untuk
menarik perhatian justru menghilangkan perhatian.

Diperbaiki pada `V021` dengan indeks berbasis ekspresi `COALESCE`. **Bukan**
`UNIQUE NULLS NOT DISTINCT`: itu menuntut PostgreSQL 15, sedangkan produksi
menjalankan 13.12 — migration akan berhasil pada pengembangan lalu gagal pada
produksi, kegagalan yang baru ketahuan saat rilis.

### 4.2 Kegagalan mencatat pengiriman menggagalkan pemberitahuannya

Satu galat SQL pada penulisan `notification_delivery` membuat `notify()`
melaporkan gagal padahal barisnya sudah tersimpan dan sudah tampil pada lonceng.
Pemanggil yang mengira pemberitahuannya gagal dapat mengirim ulang, dan
penerimanya melihat pesan yang sama dua kali.

Pencatatan pengiriman kini menangkap galatnya sendiri: ia adalah langkah
**pencatatan**, dan kegagalannya tidak boleh membatalkan pemberitahuan yang
sudah sampai.

---

## 5. Catatan pengiriman terpisah per kanal

Satu pemberitahuan dapat dikirim lewat beberapa kanal, dan setiap kanal berhasil
atau gagal sendiri-sendiri. Kolom `status` tunggal tidak dapat menyatakan
"sampai lewat aplikasi, gagal lewat surel" — dan menyatakannya sebagai satu
status akan menyembunyikan kegagalan yang perlu ditangani.

Status pada `notification` mencerminkan apakah **setidaknya satu** kanal sampai.
Pemberitahuan yang sampai lewat aplikasi tetapi gagal lewat surel tetap sampai;
menandainya gagal akan menyembunyikan yang berhasil.

---

## 6. Eskalasi SLA menutup celah V10-6

V10-6 menghitung dan menyimpan `due_at` pada setiap langkah persetujuan, tetapi
tidak ada yang membacanya. Batas waktu yang tercatat tanpa ada yang
menindaklanjutinya sama tidak bergunanya dengan tidak ada batas waktu — suratnya
tetap menunggu, dan tidak ada seorang pun yang tahu.

`SlaEscalationService` berjalan **tiap jam** — bukan tiap menit: batas waktu
persetujuan diukur dalam jam, dan memeriksa tiap menit hanya membebani basis
data untuk ketelitian yang tidak dibutuhkan siapa pun.

Terlambat ≥ 24 jam naik dari `WARNING` menjadi `CRITICAL`. Satu tenant yang
gagal tidak menghentikan tenant lain.

Endpoint `POST /notifications/sapu-sla` memaksa pemeriksaan sekarang — berguna
setelah alur diubah, dan membuat eskalasi dapat diuji tanpa menunggu satu jam.
Aman dipanggil berulang karena eskalasinya dikelompokkan.

---

## 7. Produsen pemberitahuan yang nyata

Tabel berhenti kosong karena ada yang menulisinya:

| Pemicu | Penerima | Menuntut tindakan |
|---|---|---|
| Disposisi surat masuk | Orang atau peran tujuan | Ya |
| Langkah persetujuan dibuka | Peran penyetuju langkah itu | Ya |
| Batas waktu persetujuan terlampaui | Peran penyetuju | Ya |

Disposisi adalah **perintah**, bukan kabar — karena itu menuntut tindakan.
Penyetuju yang tidak tahu gilirannya tiba akan membuat suratnya menunggu sampai
ada yang menanyakannya secara langsung.

---

## 8. Endpoint

| Method | Jalur | Izin |
|---|---|---|
| GET | `/notifications` | Terautentikasi |
| POST | `/notifications/baca` | Terautentikasi |
| POST | `/notifications/:id/tindaklanjuti` | Terautentikasi |
| POST | `/notifications/:id/tutup` | Terautentikasi |
| POST | `/notifications/sapu-sla` | `SURAT_KELUAR.APPROVE` |
| GET | `/notifications/kanal` | Terautentikasi |

---

## 9. Bukti

Skrip: `apps/api/scripts/prove-v10-7-notification.mjs`
Keluaran: `docs/upgrade-v10-v11/bukti-v10-7-notification.txt`

Delapan bagian, seluruhnya lulus:

1. Kanal melaporkan keadaannya apa adanya; `EMAIL` menyebut `SMTP_HOST` yang
   kurang.
2. Disposisi muncul pada lonceng dengan tautan menuju suratnya.
3. Langkah persetujuan memberi tahu perannya; yang menuntut tindakan
   didahulukan.
4. Penutupan pemberitahuan yang menuntut tindakan ditolak.
5. Ditandai dibaca **tidak** menghilangkannya dari daftar tindakan.
6. Tiga pemeriksaan SLA menghasilkan **satu** baris dengan penghitung 3;
   terlambat > 24 jam menjadi `CRITICAL`.
7. Catatan pengiriman per kanal tertulis; tidak ada yang mengaku `SENT` tanpa
   benar-benar terkirim.
8. Tabel terisi oleh perbuatan nyata.

Uji unit: `channel-adapter.spec.ts` (18 uji).

---

## 10. Yang belum dikerjakan

- **UI lonceng belum ada.** Endpoint lengkap dan teruji; ikon lonceng, daftar,
  dan penanda belum-dibaca dikerjakan pada V10-8.
- **Pengiriman surel, web push, WhatsApp, dan seluler BLOCKED** — bukan karena
  belum dikerjakan, melainkan karena kredensialnya tidak ada. Kerangkanya siap:
  begitu kredensial tersedia, yang perlu ditulis hanya isi `send()` pada adapter
  masing-masing. Keadaan ini dilaporkan terus-menerus lewat
  `GET /notifications/kanal`, bukan disembunyikan.
- **Preferensi kanal per pengguna belum punya endpoint.** Tabelnya ada dan
  aturannya tertulis; CRUD-nya menyusul bersama UI.
- **Templat pemberitahuan belum dipakai produsen baru.** Sepuluh templat yang
  tersemai berasal dari alur pembelian dan belum ada yang memicunya; produsen
  V10-7 memakai judul dan isi langsung. Menghubungkan keduanya menuntut
  penambahan templat surat, yang dikerjakan bersama seed V10-8.
- **Pembersihan pemberitahuan lama belum ada.** `expires_at` dihormati saat
  membaca, tetapi belum ada pekerjaan yang menghapus baris kedaluwarsa.
